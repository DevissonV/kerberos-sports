/**
 * Servicio Nest del vertical slice QUANT: orquesta el scan de red (fixtures+odds),
 * el pipeline QUANT puro, el flush de PaperBets a SQLite y el Telegram. Todo el
 * cálculo determinista vive en `runQuantPipeline` y `flushQuantBets`.
 */

import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ScanningService } from '../../scanning/application/scanningService';
import type { ScanOutput } from '../../scanning/application/scanPipeline';
import { PAPER_BET_STORE } from '../../paper-betting/ports/paperBetStore';
import type { PaperBetStatus, PaperBet } from '../../paper-betting/domain/concepts';
import type { PaperBetStore } from '../../paper-betting/ports/paperBetStore';
import { NOTIFICATION_PORT } from '../../notifications/ports/notificationPort';
import type { NotificationPort } from '../../notifications/ports/notificationPort';
import { loadLocalHistoricalMatches } from '../../poisson/adapters/localCsvHistoricalMatches';
import { historicalMatchesForLeague } from '../../poisson/adapters/historicalLeagueRegistry';
import type { HistoricalMatch } from '../../poisson/domain/concepts';
import { INITIAL_BANKROLL } from '../domain/quantCandidate';
import { logger } from '../../../shared/logging/logger';
import { runQuantPipeline, type QuantPipelineResult } from './quantPipeline';
import { flushQuantBets } from './flushQuantBets';
import { formatQuantAnalysisMessage } from '../../notifications/domain/quantAnalysisMessage';
import { LunaShadowService } from '../../luna/application/lunaShadowService';
import type { Fixture } from '../../scanning/domain/concepts';
import { ProductionRiskService } from '../../production-risk/application/productionRiskService';

export interface QuantScanSummary {
  scan: ScanOutput;
  result: QuantPipelineResult;
  paperBetsCreated: number;
  duplicatesSkipped: number;
  telegramSent: number;
  analysisMessagesSent: number;
  luna: Awaited<ReturnType<LunaShadowService['evaluate']>>;
}

@Injectable()
export class QuantScanService {
  constructor(
    private readonly scanningService: ScanningService,
    @Inject(PAPER_BET_STORE) private readonly paperBetStore: PaperBetStore,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly lunaShadow: LunaShadowService,
    private readonly productionRisk: ProductionRiskService,
    /**
     * Histórico causal para Poisson (inyectable para tests deterministas); sin
     * proveedor Nest se usa el histórico local versionado por defecto.
     */
    @Optional()
    private readonly loadHistoricalMatches:
      (() => readonly HistoricalMatch[]) | undefined = loadLocalHistoricalMatches,
  ) {}

  /** Corrida completa: scan de red -> QUANT -> PaperBets -> Telegram. */
  async runScan(limit: number): Promise<QuantScanSummary> {
    const scan = await this.scanningService.scan(limit);
    return this.finishScan(scan);
  }

  async runScanForFixtures(
    fixtures: readonly Fixture[],
    now = new Date(),
  ): Promise<QuantScanSummary> {
    return this.finishScan(await this.scanningService.scanFixtures(fixtures, now), now);
  }

  private async finishScan(scan: ScanOutput, now = new Date()): Promise<QuantScanSummary> {
    const loadHistorical = this.loadHistoricalMatches ?? loadLocalHistoricalMatches;
    const historicalMatches = loadHistorical();
    const bankroll = paperBankrollState(this.paperBetStore);
    const result = runQuantPipeline({
      candidates: scan.report.candidates,
      historicalMatches,
      historicalMatchesForFixture: (fixture) =>
        historicalMatchesForLeague(fixture.leagueId ?? -1, fixture.country ?? ''),
      now,
      initialBankroll: INITIAL_BANKROLL,
      openStakesSum: bankroll.openStakesSum,
      settledPnlSum: bankroll.settledPnlSum,
      findExistingBet: (key) => this.paperBetStore.findByIdempotencyKey(key),
    });
    const luna = await this.lunaShadow.evaluate(result, now);
    const flush = await flushQuantBets({
      prepared: result.prepared,
      store: this.paperBetStore,
      send: (message) => this.notifications.send(message),
      // El mensaje por fixture se envía debajo, tanto para BET como para NO_BET.
      messageFor: () => null,
      newId: () => randomUUID(),
      onSendError: (betId, cause) =>
        logger.warn('Telegram fallo para PaperBet nueva', {
          betId,
          error: cause instanceof Error ? cause.message : String(cause),
        }),
      onSaveError: (betId, cause) =>
        logger.warn('save de PaperBet fallo', {
          betId,
          error: cause instanceof Error ? cause.message : String(cause),
        }),
    });
    let analysisMessagesSent = 0;
    for (const analysis of result.analyses) {
      const message = formatQuantAnalysisMessage(analysis);
      if (message === null) continue;
      try {
        await this.notifications.send(message);
        analysisMessagesSent += 1;
      } catch (cause) {
        logger.warn('Telegram fallo para análisis QUANT', {
          fixtureId: analysis.fixture.id,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
    return {
      scan,
      result,
      paperBetsCreated: flush.paperBetsCreated,
      duplicatesSkipped: flush.duplicatesSkipped,
      telegramSent: flush.telegramSent,
      analysisMessagesSent,
      luna,
    };
  }
}

/** Bankroll PAPER actual a partir de las bets persistidas (stake OPEN + pnl resuelto). */
export function paperBankrollState(store: PaperBetStore): {
  openStakesSum: number;
  settledPnlSum: number;
} {
  const openStakesSum = store.listByStatus('OPEN').reduce((sum, bet) => sum + bet.stake, 0);
  const settledPnlSum = (['WON', 'LOST', 'VOID'] as readonly PaperBetStatus[])
    .flatMap((status: PaperBetStatus) => store.listByStatus(status))
    .reduce((sum: number, bet: PaperBet) => sum + (bet.pnl ?? 0), 0);
  return { openStakesSum, settledPnlSum };
}
