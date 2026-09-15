import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../../../shared/config/configuration';
import { PROTOCOL_COHORT_ID } from '../../scanning/domain/protocol';
import { ScanningService } from '../../scanning/application/scanningService';
import { PAPER_BET_STORE } from '../../paper-betting/ports/paperBetStore';
import type { PaperBetStore } from '../../paper-betting/ports/paperBetStore';
import { SettlementService } from '../../settlement/application/settlementService';
import { NOTIFICATION_PORT } from '../../notifications/ports/notificationPort';
import type { NotificationPort } from '../../notifications/ports/notificationPort';
import { formatRefinementHeartbeat } from '../../notifications/domain/refinementHeartbeat';
import { REFINEMENT_STORE } from '../ports/refinementStore';
import type { RefinementStore } from '../ports/refinementStore';
import { QuantScanService } from './quantScanService';

export interface RefinementTickSummary {
  precheckOnly: boolean;
  premierLeagueFixtures: number;
  decisionWindowFixtures: number;
  fullOddsScans: number;
  oddsPapiRequests: number;
  quantCandidates: number;
  paperBetsCreated: number;
  lunaCalls: number;
  settlements: number;
  heartbeatSent: boolean;
  budgetGuard: boolean;
  error?: string;
}

@Injectable()
export class RefinementService {
  constructor(
    private readonly scanning: ScanningService,
    private readonly quant: QuantScanService,
    private readonly settlement: SettlementService,
    @Inject(PAPER_BET_STORE) private readonly bets: PaperBetStore,
    @Inject(REFINEMENT_STORE) private readonly refinementStore: RefinementStore,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
  ) {}

  async runTick(
    config: Pick<AppConfig, 'refinementMode' | 'maxOddsPapiFullScansPerDay'>,
    now = new Date(),
  ): Promise<RefinementTickSummary> {
    const day = now.toISOString().slice(0, 10);
    let counters = this.refinementStore.increment(day, { ticks: 1 });
    let error: string | undefined;
    let settlementCount = 0;
    try {
      settlementCount = (await this.settlement.settleOpenBets()).settled;
      if (settlementCount > 0)
        counters = this.refinementStore.increment(day, { settlements: settlementCount });
    } catch (cause) {
      error = messageOf(cause);
      counters = this.refinementStore.increment(day, { errors: 1 });
    }

    try {
      const precheck = await this.scanning.precheck(20, now);
      counters = this.refinementStore.increment(day, {
        eligibleFixtures: precheck.eligibleFixtures,
      });
      const budgetGuard = counters.fullOddsScans >= config.maxOddsPapiFullScansPerDay;
      const pending = budgetGuard
        ? []
        : precheck.decisionWindowFixtures.filter((entry) =>
            this.refinementStore.claimDecisionSnapshot(
              PROTOCOL_COHORT_ID,
              entry.fixture.id,
              entry.decisionAt,
            ),
          );
      if (pending.length > 0) {
        counters = this.refinementStore.increment(day, {
          decisionSnapshotsCaptured: pending.length,
        });
        if (budgetGuard) {
          error = 'BUDGET_GUARD';
        } else {
          const requestsBefore = this.scanning.oddsPapiRequests();
          const result = await this.quant.runScanForFixtures(
            pending.map((entry) => entry.fixture),
            now,
          );
          const requests = this.scanning.oddsPapiRequests() - requestsBefore;
          counters = this.refinementStore.increment(day, {
            fullOddsScans: 1,
            oddsPapiRequests: requests,
            quantCandidates: result.result.quantCandidates,
            paperBetsCreated: result.paperBetsCreated,
            lunaCalls: result.luna.apiCalls,
          });
        }
      } else {
        counters = this.refinementStore.increment(day, { precheckOnly: 1 });
      }
      const summary: RefinementTickSummary = {
        precheckOnly: pending.length === 0,
        premierLeagueFixtures: precheck.eligibleFixtures,
        decisionWindowFixtures: precheck.decisionWindowFixtures.length,
        fullOddsScans: counters.fullOddsScans,
        oddsPapiRequests: counters.oddsPapiRequests,
        quantCandidates: counters.quantCandidates,
        paperBetsCreated: counters.paperBetsCreated,
        lunaCalls: counters.lunaCalls,
        settlements: counters.settlements,
        heartbeatSent: false,
        budgetGuard: error === 'BUDGET_GUARD',
        error,
      };
      if (config.refinementMode) {
        await this.notifications.send(
          formatRefinementHeartbeat({
            now,
            premierLeagueFixtures: summary.premierLeagueFixtures,
            decisionWindowFixtures: summary.decisionWindowFixtures,
            counters,
            openBets: this.bets.listByStatus('OPEN').length,
            error,
          }),
        );
        summary.heartbeatSent = true;
      }
      return summary;
    } catch (cause) {
      error = messageOf(cause);
      counters = this.refinementStore.increment(day, { errors: 1 });
      if (config.refinementMode) {
        await this.notifications.send(
          formatRefinementHeartbeat({
            now,
            premierLeagueFixtures: 0,
            decisionWindowFixtures: 0,
            counters,
            openBets: this.bets.listByStatus('OPEN').length,
            error,
          }),
        );
      }
      return {
        precheckOnly: true,
        premierLeagueFixtures: 0,
        decisionWindowFixtures: 0,
        fullOddsScans: counters.fullOddsScans,
        oddsPapiRequests: counters.oddsPapiRequests,
        quantCandidates: counters.quantCandidates,
        paperBetsCreated: counters.paperBetsCreated,
        lunaCalls: counters.lunaCalls,
        settlements: counters.settlements,
        heartbeatSent: config.refinementMode,
        budgetGuard: false,
        error,
      };
    }
  }
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
