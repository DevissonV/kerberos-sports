import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ModelAnalysis } from '../../quant/domain/modelAnalysis';
import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';
import type { TerminalMarketDecision } from '../../quant/ports/modelAnalysisStore';
import { RESULTS_PROVIDER, type ResultsProvider } from '../../scanning/ports/resultsProvider';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';
import {
  NOTIFICATION_PORT,
  type NotificationPort,
} from '../../notifications/ports/notificationPort';
import { settlePrediction, type Prediction } from '../domain/prediction';
import {
  calculatePredictionMetrics,
  metricsByProbabilityBucket,
  metricsBySelection,
} from '../domain/metrics';
import { PREDICTION_STORE, type PredictionStore } from '../ports/predictionStore';
import { formatDailyPredictionReport } from '../../notifications/domain/dailyPredictionReport';
import { REAL_BETS_SUMMARY, type RealBetsSummary } from '../ports/realBetsSummary';

const TERMINAL_STATUSES = new Set(['FT', 'AET', 'PEN']);
const VOID_STATUSES = new Set(['CANC', 'ABD', 'AWD', 'WO']);

function eventFingerprint(material: unknown): string {
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

@Injectable()
export class PredictionLedgerService {
  constructor(
    @Inject(PREDICTION_STORE) private readonly store: PredictionStore,
    @Inject(RESULTS_PROVIDER) private readonly results: ResultsProvider,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
    @Inject(REAL_BETS_SUMMARY) private readonly realBets?: RealBetsSummary,
  ) {}

  recordPreanalysis(analysis: ModelAnalysis): Prediction {
    const selection = analysis.model.pOver >= analysis.model.pUnder ? 'OVER_2_5' : 'UNDER_2_5';
    return this.store.save({
      fixtureId: analysis.fixture.id,
      league: analysis.fixture.league,
      homeTeam: analysis.fixture.homeTeam,
      awayTeam: analysis.fixture.awayTeam,
      kickoffAt: analysis.fixture.kickoffAt,
      createdAt: analysis.snapshotAt,
      snapshotAt: analysis.snapshotAt,
      market: 'OVER_UNDER_2_5',
      selection,
      modelProbability: selection === 'OVER_2_5' ? analysis.model.pOver : analysis.model.pUnder,
      expectedGoals: analysis.model.lambdaTotal,
      modelVersion: analysis.model.modelVersion,
      strategyVersion: 'KSS-V1-C01',
      predictionStage: 'PREANALYSIS',
      betAuthorized: false,
      betExecuted: false,
    });
  }

  recordMarketAnalysis(analysis: QuantFixtureAnalysis): Prediction {
    const selection = analysis.model.pOver >= analysis.model.pUnder ? 'OVER_2_5' : 'UNDER_2_5';
    const marketSideMatchesPrediction = analysis.side?.selection === selection;
    return this.store.save({
      fixtureId: analysis.fixture.id,
      league: analysis.fixture.league,
      homeTeam: analysis.fixture.homeTeam,
      awayTeam: analysis.fixture.awayTeam,
      kickoffAt: analysis.fixture.kickoffAt,
      createdAt: analysis.snapshotAt ?? analysis.model.snapshotAt,
      snapshotAt: analysis.snapshotAt ?? analysis.model.snapshotAt,
      market: 'OVER_UNDER_2_5',
      selection,
      modelProbability: selection === 'OVER_2_5' ? analysis.model.pOver : analysis.model.pUnder,
      expectedGoals: analysis.model.lambdaTotal,
      modelVersion: analysis.model.modelVersion,
      strategyVersion: 'KSS-V1-C01',
      predictionStage: analysis.decision === 'BET' ? 'BET' : 'NO_BET',
      oddsAtPrediction: marketSideMatchesPrediction ? analysis.side?.offeredOdds : undefined,
      fairMarketProbability: marketSideMatchesPrediction
        ? analysis.side?.fairMarketProbability
        : undefined,
      edge: marketSideMatchesPrediction ? analysis.side?.edge : undefined,
      ev: marketSideMatchesPrediction ? analysis.side?.expectedValue : undefined,
      betAuthorized: analysis.decision === 'BET',
      betExecuted: false,
    });
  }

  recordTerminalMarketDecision(decision: TerminalMarketDecision): Prediction {
    const selection = decision.model.pOver >= decision.model.pUnder ? 'OVER_2_5' : 'UNDER_2_5';
    return this.store.save({
      fixtureId: decision.fixture.id,
      league: decision.fixture.league,
      homeTeam: decision.fixture.homeTeam,
      awayTeam: decision.fixture.awayTeam,
      kickoffAt: decision.fixture.kickoffAt,
      createdAt: decision.snapshotAt,
      snapshotAt: decision.snapshotAt,
      market: 'OVER_UNDER_2_5',
      selection,
      modelProbability: selection === 'OVER_2_5' ? decision.model.pOver : decision.model.pUnder,
      expectedGoals: decision.model.lambdaTotal,
      modelVersion: decision.model.modelVersion,
      strategyVersion: 'KSS-V1-C01',
      predictionStage: 'NO_BET',
      betAuthorized: false,
      betExecuted: false,
    });
  }

  async settlePending(
    now = new Date(),
  ): Promise<{ inspected: number; settled: number; pending: number; errors: number }> {
    const candidates = this.store.listPendingPrimary(now);
    let settled = 0;
    let pending = 0;
    let errors = 0;
    for (const prediction of candidates) {
      try {
        const result = await this.results.result(prediction.fixtureId);
        if (
          result === null ||
          (!TERMINAL_STATUSES.has(result.status) && !VOID_STATUSES.has(result.status))
        ) {
          pending += 1;
          continue;
        }
        const fixturePredictions = this.store
          .list()
          .filter(
            (entry) => entry.fixtureId === prediction.fixtureId && entry.result === 'PENDING',
          );
        if (VOID_STATUSES.has(result.status)) {
          for (const entry of fixturePredictions)
            this.store.void(entry.predictionId, result.finishedAt ?? now);
          settled += fixturePredictions.length;
          continue;
        }
        if (result.fulltimeHome === null || result.fulltimeAway === null) {
          pending += 1;
          continue;
        }
        for (const entry of fixturePredictions) {
          this.store.settle(
            settlePrediction(
              entry,
              { home: result.fulltimeHome, away: result.fulltimeAway },
              result.finishedAt ?? now,
            ),
          );
        }
        settled += fixturePredictions.length;
      } catch {
        errors += 1;
      }
    }
    return { inspected: candidates.length, settled, pending, errors };
  }

  async sendDailyReportIfDue(now: Date, reportTime: string): Promise<boolean> {
    const [hour = 22, minute = 30] = reportTime.split(':').map(Number);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const currentHour = Number(parts.find((part) => part.type === 'hour')?.value ?? -1);
    const currentMinute = Number(parts.find((part) => part.type === 'minute')?.value ?? -1);
    if (currentHour * 60 + currentMinute < hour * 60 + minute) return false;
    const day = calendarDateInBogota(now);
    if (!this.store.claimDailyReport(day, now)) return false;
    try {
      const realStats = this.realBets?.daily(day);
      await this.notifications.send(formatDailyPredictionReport(this.store.list(), day, realStats));
      return true;
    } catch (error) {
      this.store.releaseDailyReport(day);
      throw error;
    }
  }

  shouldSendEvent(eventId: string, material: unknown, now: Date): boolean {
    const fingerprint = eventFingerprint(material);
    return this.store.claimEvent(`${eventId}:${fingerprint}`, fingerprint, now);
  }

  /** Libera el claim de un evento cuyo envío falló, para que el siguiente tick reintente. */
  releaseEvent(eventId: string, material: unknown): void {
    const fingerprint = eventFingerprint(material);
    this.store.releaseEvent(`${eventId}:${fingerprint}`, fingerprint);
  }

  snapshot() {
    const predictions = this.store.list();
    const primary = predictions.filter((prediction) => prediction.isPrimary);
    return {
      predictions,
      cumulative: calculatePredictionMetrics(primary),
      buckets: metricsByProbabilityBucket(primary),
      over: metricsBySelection(primary, 'OVER_2_5'),
      under: metricsBySelection(primary, 'UNDER_2_5'),
      authorizedBets: primary.filter((prediction) => prediction.betAuthorized).length,
      executedBets: primary.filter((prediction) => prediction.betExecuted).length,
    };
  }
}
