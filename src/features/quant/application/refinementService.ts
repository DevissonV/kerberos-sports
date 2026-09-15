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
import type { RefinementCounters, RefinementStore } from '../ports/refinementStore';
import { QuantScanService } from './quantScanService';

export interface RefinementTickSummary {
  timestamp: string;
  cohort: string;
  refinementMode: boolean;
  tickId: string;
  precheckOnly: boolean;
  rawFixtures: number;
  eligibleFixtures: number;
  decisionWindowFixtures: number;
  fullOddsScans: number;
  oddsPapiRequests: number;
  apiFootballRequests: number;
  fixtureCacheHit: boolean;
  fixtureCacheAgeMinutes: number;
  poissonModeled: number;
  quantCandidates: number;
  paperBetsCreated: number;
  lunaSelected: number;
  lunaCalls: number;
  lunaCacheHits: number;
  openPaperBets: number;
  settlements: number;
  telegramHeartbeatSent: boolean;
  telegramBetMessages: number;
  telegramSettlementMessages: number;
  errors: number;
  status: 'OK' | 'PARTIAL' | 'ERROR';
  error?: string;
}

export function refinementTickId(now: Date): string {
  const bucket = new Date(now);
  bucket.setUTCMinutes(bucket.getUTCMinutes() - (bucket.getUTCMinutes() % 30), 0, 0);
  return bucket.toISOString().slice(0, 16);
}

export function renderRefinementTick(summary: RefinementTickSummary): string {
  return [
    '[KSS_REFINEMENT_TICK]',
    `timestamp=${summary.timestamp}`,
    `cohort=${summary.cohort}`,
    `refinementMode=${summary.refinementMode}`,
    '',
    `precheckOnly=${summary.precheckOnly}`,
    `rawFixtures=${summary.rawFixtures}`,
    `eligibleFixtures=${summary.eligibleFixtures}`,
    `decisionWindowFixtures=${summary.decisionWindowFixtures}`,
    '',
    `fullOddsScans=${summary.fullOddsScans}`,
    `oddsPapiRequests=${summary.oddsPapiRequests}`,
    '',
    `poissonModeled=${summary.poissonModeled}`,
    `quantCandidates=${summary.quantCandidates}`,
    `paperBetsCreated=${summary.paperBetsCreated}`,
    '',
    `lunaSelected=${summary.lunaSelected}`,
    `lunaCalls=${summary.lunaCalls}`,
    `lunaCacheHits=${summary.lunaCacheHits}`,
    '',
    `openPaperBets=${summary.openPaperBets}`,
    `settlements=${summary.settlements}`,
    '',
    `telegramHeartbeatSent=${summary.telegramHeartbeatSent}`,
    `telegramBetMessages=${summary.telegramBetMessages}`,
    `telegramSettlementMessages=${summary.telegramSettlementMessages}`,
    '',
    `apiFootballRequests=${summary.apiFootballRequests}`,
    `fixtureCacheHit=${summary.fixtureCacheHit}`,
    `fixtureCacheAgeMinutes=${summary.fixtureCacheAgeMinutes}`,
    `errors=${summary.errors}`,
    `status=${summary.status}`,
    '[/KSS_REFINEMENT_TICK]',
  ].join('\n');
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
    const tickId = refinementTickId(now);
    const day = now.toISOString().slice(0, 10);
    const beforeOdds = this.scanning.oddsPapiRequests();
    const beforeApiFootball =
      this.scanning.apiFootballRequests() + this.settlement.apiFootballRequests();
    const tick: RefinementTickSummary = {
      timestamp: now.toISOString(),
      cohort: PROTOCOL_COHORT_ID,
      refinementMode: config.refinementMode,
      tickId,
      precheckOnly: true,
      rawFixtures: 0,
      eligibleFixtures: 0,
      decisionWindowFixtures: 0,
      fullOddsScans: 0,
      oddsPapiRequests: 0,
      apiFootballRequests: 0,
      fixtureCacheHit: false,
      fixtureCacheAgeMinutes: 0,
      poissonModeled: 0,
      quantCandidates: 0,
      paperBetsCreated: 0,
      lunaSelected: 0,
      lunaCalls: 0,
      lunaCacheHits: 0,
      openPaperBets: 0,
      settlements: 0,
      telegramHeartbeatSent: false,
      telegramBetMessages: 0,
      telegramSettlementMessages: 0,
      errors: 0,
      status: 'OK',
    };

    this.refinementStore.increment(day, { ticks: 1 });
    try {
      const settlement = await this.settlement.settleOpenBets();
      tick.settlements = settlement.settled;
      tick.telegramSettlementMessages = settlement.telegramSent;
    } catch (cause) {
      markError(tick, cause, 'PARTIAL');
    }

    try {
      const precheck = await this.scanning.precheck(20, now);
      tick.rawFixtures = precheck.rawFixtures;
      tick.eligibleFixtures = precheck.eligibleFixtures;
      tick.decisionWindowFixtures = precheck.decisionWindowFixtures.length;
      const daily = this.refinementStore.dailyCounters(day);
      const budgetGuard = daily.fullOddsScans >= config.maxOddsPapiFullScansPerDay;
      const pending = budgetGuard
        ? []
        : precheck.decisionWindowFixtures.filter((entry) =>
            this.refinementStore.claimDecisionSnapshot(
              PROTOCOL_COHORT_ID,
              entry.fixture.id,
              entry.decisionAt,
            ),
          );
      if (pending.length > 0 && !budgetGuard) {
        const result = await this.quant.runScanForFixtures(
          pending.map((entry) => entry.fixture),
          now,
        );
        tick.precheckOnly = false;
        tick.fullOddsScans = 1;
        tick.poissonModeled = result.result.poissonModeled;
        tick.quantCandidates = result.result.quantCandidates;
        tick.paperBetsCreated = result.paperBetsCreated;
        tick.telegramBetMessages = result.telegramSent;
        tick.lunaSelected = result.luna.selected;
        tick.lunaCalls = result.luna.apiCalls;
        tick.lunaCacheHits = result.luna.cacheHits;
      } else if (budgetGuard && precheck.decisionWindowFixtures.length > 0) {
        markError(tick, new Error('BUDGET_GUARD'), 'PARTIAL');
      }
    } catch (cause) {
      markError(tick, cause, 'ERROR');
    }

    tick.openPaperBets = this.bets.listByStatus('OPEN').length;
    tick.oddsPapiRequests = this.scanning.oddsPapiRequests() - beforeOdds;
    tick.apiFootballRequests =
      this.scanning.apiFootballRequests() +
      this.settlement.apiFootballRequests() -
      beforeApiFootball;
    tick.fixtureCacheHit = this.scanning.fixtureCacheHit?.() ?? false;
    tick.fixtureCacheAgeMinutes = this.scanning.fixtureCacheAgeMinutes?.() ?? 0;
    this.refinementStore.increment(day, {
      precheckOnly: tick.precheckOnly ? 1 : 0,
      eligibleFixtures: tick.eligibleFixtures,
      fullOddsScans: tick.fullOddsScans,
      oddsPapiRequests: tick.oddsPapiRequests,
      quantCandidates: tick.quantCandidates,
      paperBetsCreated: tick.paperBetsCreated,
      lunaCalls: tick.lunaCalls,
      settlements: tick.settlements,
      errors: tick.errors,
    });

    if (config.refinementMode && this.refinementStore.claimHeartbeat(tickId)) {
      try {
        await this.notifications.send(
          formatRefinementHeartbeat({
            now,
            premierLeagueFixtures: tick.eligibleFixtures,
            decisionWindowFixtures: tick.decisionWindowFixtures,
            counters: countersForHeartbeat(tick),
            openBets: tick.openPaperBets,
            error: tick.error,
          }),
        );
        tick.telegramHeartbeatSent = true;
      } catch (cause) {
        markError(tick, cause, 'PARTIAL');
      }
    }

    process.stdout.write(`${renderRefinementTick(tick)}\n`);
    return tick;
  }
}

function countersForHeartbeat(tick: RefinementTickSummary): RefinementCounters {
  return {
    ticks: 1,
    precheckOnly: tick.precheckOnly ? 1 : 0,
    eligibleFixtures: tick.eligibleFixtures,
    decisionSnapshotsCaptured: 0,
    fullOddsScans: tick.fullOddsScans,
    oddsPapiRequests: tick.oddsPapiRequests,
    quantCandidates: tick.quantCandidates,
    paperBetsCreated: tick.paperBetsCreated,
    lunaCalls: tick.lunaCalls,
    settlements: tick.settlements,
    errors: tick.errors,
  };
}

function markError(tick: RefinementTickSummary, cause: unknown, status: 'PARTIAL' | 'ERROR'): void {
  tick.errors += 1;
  tick.status = status === 'ERROR' ? 'ERROR' : tick.status === 'ERROR' ? 'ERROR' : 'PARTIAL';
  tick.error ??= cause instanceof Error ? cause.message : String(cause);
}
