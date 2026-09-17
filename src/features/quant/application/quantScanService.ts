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
import type { PoissonModelOutput } from '../../poisson/domain/concepts';
import { INITIAL_BANKROLL } from '../domain/quantCandidate';
import { logger } from '../../../shared/logging/logger';
import { runQuantPipeline, type QuantPipelineResult } from './quantPipeline';
import { flushQuantBets } from './flushQuantBets';
import { formatQuantAnalysisMessage } from '../../notifications/domain/quantAnalysisMessage';
import { LunaShadowService } from '../../luna/application/lunaShadowService';
import type { Fixture } from '../../scanning/domain/concepts';
import { ProductionRiskService } from '../../production-risk/application/productionRiskService';
import { ManualLedgerService } from '../../manual-ledger/application/manualLedgerService';
import { formatQuantPaperMessageFor } from './quantRiskMessage';
import { MODEL_ANALYSIS_STORE } from '../ports/modelAnalysisStore';
import type { ModelAnalysisStore } from '../ports/modelAnalysisStore';
import { SqliteModelAnalysisStore } from '../adapters/sqliteModelAnalysisStore';
import { AnalystService } from '../../llm-analyst/application/analystService';
import type { AnalystRunResult } from '../../llm-analyst/application/analystService';
import { config } from '../../../shared/config/configuration';

export interface QuantScanSummary {
  scan: ScanOutput;
  result: QuantPipelineResult;
  paperBetsCreated: number;
  duplicatesSkipped: number;
  telegramSent: number;
  analysisMessagesSent: number;
  luna: Awaited<ReturnType<LunaShadowService['evaluate']>>;
  analyst: AnalystRunResult;
}

@Injectable()
export class QuantScanService {
  constructor(
    private readonly scanningService: ScanningService,
    @Inject(PAPER_BET_STORE) private readonly paperBetStore: PaperBetStore,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    private readonly lunaShadow: LunaShadowService,
    private readonly productionRisk: ProductionRiskService,
    private readonly manualLedger: ManualLedgerService,
    private readonly analyst: AnalystService,
    @Optional()
    @Inject(MODEL_ANALYSIS_STORE)
    private readonly modelAnalysisStore: ModelAnalysisStore = new SqliteModelAnalysisStore(
      ':memory:',
    ),
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
    const modelByFixture = new Map<string, PoissonModelOutput>();
    for (const candidate of scan.report.candidates) {
      const model = this.modelAnalysisStore.findLatest(candidate.fixture.id, 'PREANALYSIS')?.model;
      if (model !== undefined) modelByFixture.set(candidate.fixture.id, model);
    }
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
      modelByFixture,
    });
    const analyst = await this.analyst.analyze(result.analyses, now, {
      enabled: config.llmAnalystEnabled,
      maxAnalyses: config.maxLlmAnalysesPerTick,
    });
    if (!config.llmAnalystEnabled) {
      logger.info('LLM_SKIPPED', { reason: 'FEATURE_DISABLED', count: analyst.skipped });
    }
    const contextByFixture = new Map(
      analyst.records
        .filter((record) => record.output !== null)
        .map((record) => [record.fixtureId, record.output!]),
    );
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
      this.modelAnalysisStore.saveMarketAnalysis(analysis);
      logger.info('MARKET_ANALYSIS_STARTED', {
        fixtureId: analysis.fixture.id,
        fixture: `${analysis.fixture.homeTeam} vs ${analysis.fixture.awayTeam}`,
        timestamp: now.toISOString(),
      });
      const prepared = result.prepared.find(
        (entry) => entry.bet.fixtureId === Number(analysis.fixture.id),
      );
      const message =
        analysis.decision === 'BET' && prepared !== undefined
          ? this.actionableMessage(prepared.bet, now)
          : formatQuantAnalysisMessage(analysis, contextByFixture.get(analysis.fixture.id));
      let telegramSent = false;
      if (message !== null) {
        try {
          await this.notifications.send(message);
          analysisMessagesSent += 1;
          telegramSent = true;
        } catch (cause) {
          logger.warn('Telegram fallo para análisis QUANT', {
            fixtureId: analysis.fixture.id,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
      logger.info('MARKET_ANALYSIS_COMPLETED', {
        fixtureId: analysis.fixture.id,
        league: analysis.fixture.league,
        homeTeam: analysis.fixture.homeTeam,
        awayTeam: analysis.fixture.awayTeam,
        fixture: `${analysis.fixture.homeTeam} vs ${analysis.fixture.awayTeam}`,
        selection: analysis.side?.selection ?? null,
        modelProbability: analysis.side?.modelProbability ?? null,
        observedOdds: analysis.side?.offeredOdds ?? null,
        minimumAcceptableOdds: analysis.side?.minimumAcceptableOdds ?? null,
        edge: analysis.side?.edge ?? null,
        ev: analysis.side?.expectedValue ?? null,
        decision: analysis.decision,
        reason: analysis.reason ?? null,
        riskDecision: analysis.reason === 'RISK' ? analysis.reason : null,
        telegramSent,
        timestamp: now.toISOString(),
      });
      logger.info('FINAL_DECISION', {
        fixtureId: analysis.fixture.id,
        fixture: `${analysis.fixture.homeTeam} vs ${analysis.fixture.awayTeam}`,
        selection: analysis.side?.selection ?? null,
        modelProbability: analysis.side?.modelProbability ?? null,
        observedOdds: analysis.side?.offeredOdds ?? null,
        minimumAcceptableOdds: analysis.side?.minimumAcceptableOdds ?? null,
        edge: analysis.side?.edge ?? null,
        ev: analysis.side?.expectedValue ?? null,
        decision: analysis.decision,
        reason: analysis.reason ?? null,
        riskDecision: analysis.reason === 'RISK' ? analysis.reason : null,
        telegramSent,
      });
    }
    return {
      scan,
      result,
      paperBetsCreated: flush.paperBetsCreated,
      duplicatesSkipped: flush.duplicatesSkipped,
      telegramSent: flush.telegramSent,
      analysisMessagesSent,
      luna,
      analyst,
    };
  }

  /** Un bankroll real no inicializado impide una instrucción ejecutable (fail-closed). */
  private actionableMessage(bet: PaperBet, now: Date): string | null {
    try {
      return formatQuantPaperMessageFor(
        bet,
        now,
        this.productionRisk,
        this.manualLedger.realBankrollCop(),
      );
    } catch {
      return null;
    }
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
