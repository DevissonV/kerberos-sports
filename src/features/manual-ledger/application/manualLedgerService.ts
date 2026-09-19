import type { ManualBetResult, ManualLedgerEntry } from '../domain/manualLedger';
import type { ManualLedgerStore } from '../ports/manualLedgerStore';
import type { ProductionRiskStateStore } from '../../production-risk/ports/productionRiskStateStore';
import { realBetsDailyStats, type RealBetsDailyStats } from '../domain/realBetsStats';
import type { NotificationPort } from '../../notifications/ports/notificationPort';
import {
  formatManualExecutedMessage,
  formatManualSettlementMessage,
} from '../../notifications/domain/manualExecutionMessage';
import { logger } from '../../../shared/logging/logger';

/**
 * Registro de apuestas que un operador ejecutó por su cuenta. El dinero real
 * NUNCA lo mueve un bot: este servicio solo documenta, controla límites via
 * `ProductionRiskStateStore` y reconcilia ledger/risk tras fallos.
 */
export class ManualLedgerService {
  constructor(
    private readonly store: ManualLedgerStore,
    private readonly riskStateStore: ProductionRiskStateStore,
    /** Opcional: Telegram avisando ejecución y settlement reales, exactamente una vez. */
    private readonly notifications?: NotificationPort,
  ) {}

  initializeRealBankroll(initialBankrollCop: number): number {
    return this.store.initializeRealBankroll(initialBankrollCop);
  }
  realBankrollCop(): number {
    return this.store.realBankrollCop();
  }
  recommend(recommendationId: string, now: Date): ManualLedgerEntry {
    return this.store.saveRecommendation(recommendationId, now);
  }

  /**
   * Resuelve el objetivo aceptando el recommendationId completo o su sufijo corto
   * (6 caracteres, el código impreso en Telegram) entre recomendaciones abiertas.
   * Si no hay ninguna recomendación abierta que coincida, se acepta el ID tal cual
   * para no bloquear registros EXTERNOS ya creados por el propio pipeline.
   */
  resolveRecommendationId(recommendationIdLike: string): string {
    const exact = this.store.findByRecommendationId(recommendationIdLike);
    if (exact !== null) return exact.recommendationId;
    const candidates = this.store
      .listEntries()
      .filter(
        (entry) =>
          entry.status === 'RECOMMENDED' &&
          shortId(entry.recommendationId) === recommendationIdLike.toUpperCase(),
      );
    if (candidates.length > 1)
      throw new Error(
        `El código de registro es ambiguo: ${recommendationIdLike} (usa el recommendationId completo)`,
      );
    return candidates[0]?.recommendationId ?? recommendationIdLike;
  }

  /**
   * #8 (KSS-RISK-ODDS-INTEGRITY-02): si la apuesta está relacionada con una
   * recomendación Kerberos, se exige autorización real del Risk Gate (reserva
   * con stake >= ejecutado y selección consistente). Si es una apuesta externa
   * al bot, se registra contablemente pero queda etiquetada EXTERNAL_MANUAL_ENTRY
   * y jamás se cuenta como "Kerberos autorizada".
   */
  async execute(input: {
    recommendationId: string;
    executionId: string;
    bookmaker: string;
    executedOdds: number;
    executedStakeCop: number;
    executedAt: Date;
    now: Date;
    identity: {
      homeTeam: string;
      awayTeam: string;
      competition: string;
      kickoffAt: Date;
      selection: string;
    };
  }): Promise<ManualLedgerEntry> {
    const { now, identity, ...execution } = input;
    // Repara divergencias ledger/risk heredadas antes de aplicar cambios nuevos.
    this.reconcile();
    const recommendationId = this.resolveRecommendationId(execution.recommendationId);
    const entrySource = this.classifyEntrySource(recommendationId);
    if (entrySource === 'KERBEROS_AUTHORIZED') {
      this.assertRiskAuthorization(recommendationId, input.executedStakeCop, identity.selection);
    }
    const entry = this.store.execute({
      ...execution,
      recommendationId,
      identity,
      entrySource,
      createdAt: now,
    });
    // El registro financiero ya es duradero: una falla de risk-state no rompe la
    // operación; el reconciliador la repara en la próxima llamada.
    try {
      this.syncRiskState(entry);
    } catch {
      // Ya logueado dentro de syncRiskState.
    }
    await this.notifyExecuted(entry);
    return entry;
  }

  async settle(input: {
    executionId: string;
    result: ManualBetResult;
    closingOdds?: number;
    now: Date;
  }): Promise<ManualLedgerEntry> {
    const { now, ...settlement } = input;
    // Repara divergencias heredadas antes de actuar (p. ej. ledger SETTLED con
    // risk OPEN de un fallo anterior: quedará reparado aunque el reintento falle).
    this.reconcile();
    let entry: ManualLedgerEntry;
    try {
      entry = this.store.settle({ ...settlement, settledAt: now });
      if (entry.netPnlCop === undefined) throw new Error('Settlement manual sin PnL');
    } catch (cause) {
      // Reintento de settlement: antes de fallar, repara el estado de riesgo y
      // notifica lo pendiente; el error original conserva su semántica.
      this.syncRiskStateForExecution(input.executionId);
      await this.notifySettledFromExecution(input.executionId);
      throw cause;
    }
    this.syncRiskState(entry);
    await this.notifySettled(entry);
    return entry;
  }

  /**
   * #7: reconciliación idempotente ledger → risk. Detecta y repara:
   * - ledger EXECUTED/SETTLED sin registro en risk (lo crea con el día de ejecución).
   * - ledger SETTLED con risk aún OPEN/RESERVED (lo resuelve con el pnl del ledger).
   * Nunca re-aplica dinero: el pnl viene de la entrada del ledger, y el UPDATE de
   * risk solo pasa de OPEN/RESERVED a SETTLED (rechazado si ya está SETTLED).
   */
  reconcile(): { reconciled: number; failed: number } {
    let reconciled = 0;
    let failed = 0;
    for (const entry of this.store.listEntries()) {
      if (entry.status === 'RECOMMENDED' || entry.executionId === undefined) continue;
      try {
        this.syncRiskState(entry);
        reconciled += 1;
      } catch (cause) {
        failed += 1;
        logger.warn('Reconciliación ledger→risk falló', {
          recommendationId: entry.recommendationId,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
    return { reconciled, failed };
  }

  /**
   * Sincroniza el estado de riesgo con la entrada del ledger (idempotente):
   * - EXECUTED/SETTLED sin registro de riesgo → lo registra.
   * - SETTLED con risk no settled → lo resuelve con el netPnlCop del ledger.
   */
  private syncRiskState(entry: ManualLedgerEntry): void {
    if (entry.executedStakeCop === undefined) return;
    try {
      const id = entry.recommendationId;
      const risk = this.riskStateStore.findManualBet(id);
      if (risk === null || risk.status === 'RESERVED') {
        this.riskStateStore.recordManualBet({
          id,
          day: utcDay(entry.executedAt ?? entry.createdAt),
          stakeCop: entry.executedStakeCop,
          operatorApprovalId: entry.executionId ?? id,
          selection: entry.selection,
        });
      }
      if (entry.status === 'SETTLED' && entry.netPnlCop !== undefined) {
        const current = this.riskStateStore.findManualBet(id);
        if (current !== null && current.status !== 'SETTLED') {
          this.riskStateStore.settleManualBet(id, entry.netPnlCop);
        }
      }
    } catch (cause) {
      // La divergencia no rompe el registro financiero (ya duradero); el
      // reconciliador la repara en la próxima operación.
      logger.warn('syncRiskState falló (reconcile lo reintentará)', {
        recommendationId: entry.recommendationId,
        error: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  }

  /**
   * #8: clasificación del registro. Kerberos = existe recomendación en el ledger
   * o autorización de riesgo previa (reserva del Risk Gate). Resto = externo.
   */
  private classifyEntrySource(recommendationId: string): ManualLedgerEntry['entrySource'] {
    const ledgerEntry = this.store.findByRecommendationId(recommendationId);
    if (ledgerEntry !== null && ledgerEntry.status === 'RECOMMENDED') {
      return 'KERBEROS_AUTHORIZED';
    }
    const riskBet = this.riskStateStore.findManualBet(recommendationId);
    if (riskBet !== null && (riskBet.status === 'RESERVED' || riskBet.status === 'OPEN')) {
      return 'KERBEROS_AUTHORIZED';
    }
    return 'EXTERNAL_MANUAL_ENTRY';
  }

  /** Fail-closed: la autorización real del Risk Gate es obligatoria para Kerberos. */
  private assertRiskAuthorization(
    recommendationId: string,
    stakeCop: number,
    selection: string,
  ): void {
    const riskBet = this.riskStateStore.findManualBet(recommendationId);
    if (riskBet === null || riskBet.status === 'SETTLED') {
      throw new Error(
        `La recomendación Kerberos ${shortId(recommendationId)} no tiene autorización de riesgo activa (Risk Gate). Registro bloqueado.`,
      );
    }
    if (stakeCop > riskBet.stakeCop) {
      throw new Error(
        `Stake ${stakeCop} COP supera el stake autorizado por el Risk Gate (${riskBet.stakeCop} COP)`,
      );
    }
    if (riskBet.selection !== undefined && riskBet.selection !== selection) {
      throw new Error(
        `La selección ${selection} no coincide con la autorizada por el Risk Gate (${riskBet.selection})`,
      );
    }
  }

  private syncRiskStateForExecution(executionId: string): void {
    const entry = this.store.findByExecutionId(executionId);
    if (entry !== null) this.syncRiskState(entry);
  }

  private notifySettledFromExecution(executionId: string): Promise<void> {
    const entry = this.store.findByExecutionId(executionId);
    if (entry === null) return Promise.resolve();
    return this.notifySettled(entry);
  }

  /** Telegram una sola vez por registro (dedupe durable por telegramNotifiedAt). */
  private async notifyExecuted(entry: ManualLedgerEntry): Promise<void> {
    if (this.notifications === undefined) return;
    try {
      if (!this.pendingTelegramNotification(entry)) return;
      await this.notifications.send(formatManualExecutedMessage(entry));
      this.markTelegramNotified(entry.executionId ?? '', new Date());
    } catch {
      // El registro financiero ya está duradero: la notificación se reintenta en el próximo uso.
    }
  }

  private async notifySettled(entry: ManualLedgerEntry): Promise<void> {
    if (this.notifications === undefined) return;
    try {
      if (!this.pendingTelegramNotification(entry, 'SETTLED')) return;
      await this.notifications.send(formatManualSettlementMessage(entry));
      this.markTelegramNotified(entry.executionId ?? '', new Date(), 'SETTLED');
    } catch {
      // Igual que la ejecución: jamás se repite ni rompe el settlement por un fallo de red.
    }
  }

  /** Estadísticas del día Bogotá para la sección 💰 APUESTAS REALES del reporte. */
  realBetsDaily(dayBogota: string): RealBetsDailyStats {
    return realBetsDailyStats(this.store.listEntries(), dayBogota);
  }

  /** Si un registro ya fue notificado siempre (idempotencia 0 duplicados de Telegram). */
  pendingTelegramNotification(
    entry: ManualLedgerEntry,
    event: 'EXECUTED' | 'SETTLED' = 'EXECUTED',
  ): boolean {
    const notifiedAt = event === 'EXECUTED' ? entry.telegramNotifiedAt : entry.settledNotifiedAt;
    return notifiedAt === undefined || notifiedAt.getTime() === 0;
  }
  markTelegramNotified(
    executionId: string,
    notifiedAt: Date,
    event: 'EXECUTED' | 'SETTLED' = 'EXECUTED',
  ): void {
    this.store.markTelegramNotified(executionId, notifiedAt, event);
  }
}

export function shortId(recommendationId: string): string {
  return recommendationId.slice(-6).toUpperCase();
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}
