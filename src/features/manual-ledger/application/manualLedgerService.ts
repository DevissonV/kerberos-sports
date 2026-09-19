import type { ManualBetResult, ManualLedgerEntry } from '../domain/manualLedger';
import type { ManualLedgerStore } from '../ports/manualLedgerStore';
import type { ProductionRiskStateStore } from '../../production-risk/ports/productionRiskStateStore';
import { realBetsDailyStats, type RealBetsDailyStats } from '../domain/realBetsStats';
import type { NotificationPort } from '../../notifications/ports/notificationPort';
import {
  formatManualExecutedMessage,
  formatManualSettlementMessage,
} from '../../notifications/domain/manualExecutionMessage';

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
   * para no bloquear registrosEXTERNOS ya creados por el propio pipeline.
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
    const entry = this.store.execute({
      ...execution,
      recommendationId: this.resolveRecommendationId(execution.recommendationId),
      identity,
      createdAt: now,
    });
    this.riskStateStore.recordManualBet({
      id: entry.executionId ?? input.executionId,
      day: utcDay(input.executedAt),
      stakeCop: input.executedStakeCop,
      operatorApprovalId: entry.executionId ?? input.executionId,
    });
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
    const entry = this.store.settle({ ...settlement, settledAt: now });
    if (entry.netPnlCop === undefined) throw new Error('Settlement manual sin PnL');
    this.riskStateStore.settleManualBet(input.executionId, entry.netPnlCop);
    await this.notifySettled(entry);
    return entry;
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
