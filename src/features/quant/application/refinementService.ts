import { Inject, Injectable, Optional } from '@nestjs/common';
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
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';
import { runModelAnalysis } from '../domain/modelAnalysis';
import { marketLanguage } from '../../notifications/domain/marketLanguage';
import { MODEL_ANALYSIS_STORE } from '../ports/modelAnalysisStore';
import type { ModelAnalysisStore } from '../ports/modelAnalysisStore';
import { SqliteModelAnalysisStore } from '../adapters/sqliteModelAnalysisStore';
import { historicalMatchesForLeague } from '../../poisson/adapters/historicalLeagueRegistry';

export interface RefinementLeagueSummary {
  leagueId: number;
  league: string;
  status: LeagueStatus;
  fixturesDetected: number;
  modelEligible: number;
  inDecisionWindow?: number;
  modelled?: number;
  oddsAvailable?: number;
  analyzed?: number;
  bet?: number;
  noBet?: number;
  rejectionReason?: string;
  oddsRequested: number;
  quantCandidates: number;
  paperBets: number;
}

export interface RefinementTickSummary {
  timestamp: string;
  cohort: string;
  refinementMode: boolean;
  tickId: string;
  precheckOnly: boolean;
  rawFixtures: number;
  supportedFixtures?: number;
  supportedLeagueFixtures?: number;
  eligibleFixtures: number;
  modelEnabledFixtures?: number;
  observationFixtures: number;
  decisionWindowFixtures: number;
  preAnalysisEligible?: number;
  outsideDecisionWindow?: number;
  historyReady?: number;
  aliasesReady?: number;
  modelledFixtures?: number;
  preAnalysisCount?: number;
  oddsRequested?: number;
  oddsAvailableFixtures?: number;
  analyzedFixtures?: number;
  marketAnalyzed?: number;
  oddsAvailable?: number;
  noOdds?: number;
  noBetCount?: number;
  budgetBlocked?: number;
  budgetGuardType?: string;
  budgetProvider?: string;
  budgetLimit?: number;
  budgetCurrentUsage?: number;
  budgetRemaining?: number;
  budgetResetAt?: string;
  byLeague: RefinementLeagueSummary[];
  fullOddsScans: number;
  oddsPapiRequests: number;
  apiFootballRequests: number;
  fixtureCacheHit: boolean;
  fixtureCacheAgeMinutes: number;
  poissonModeled: number;
  noBets?: number;
  insufficientData?: number;
  oddsUnavailable?: number;
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
    `RAW_FIXTURES=${summary.rawFixtures}`,
    `supportedLeagueFixtures=${summary.supportedLeagueFixtures ?? 0}`,
    `SUPPORTED_FIXTURES=${summary.supportedFixtures ?? summary.supportedLeagueFixtures ?? 0}`,
    `eligibleFixtures=${summary.eligibleFixtures}`,
    `MODEL_ENABLED_FIXTURES=${summary.modelEnabledFixtures ?? summary.eligibleFixtures}`,
    `observationFixtures=${summary.observationFixtures}`,
    `decisionWindowFixtures=${summary.decisionWindowFixtures}`,
    `outsideDecisionWindow=${summary.outsideDecisionWindow ?? 0}`,
    `historyReady=${summary.historyReady ?? 0}`,
    `aliasesReady=${summary.aliasesReady ?? 0}`,
    `modelledFixtures=${summary.modelledFixtures ?? 0}`,
    `preAnalysisCount=${summary.preAnalysisCount ?? 0}`,
    `PREANALYSIS_ELIGIBLE=${summary.preAnalysisEligible ?? 0}`,
    `oddsRequested=${summary.oddsRequested ?? 0}`,
    `oddsAvailableFixtures=${summary.oddsAvailableFixtures ?? 0}`,
    `ODDS_AVAILABLE=${summary.oddsAvailable ?? summary.oddsAvailableFixtures ?? 0}`,
    `analyzedFixtures=${summary.analyzedFixtures ?? 0}`,
    `marketAnalyzed=${summary.marketAnalyzed ?? 0}`,
    `noOdds=${summary.noOdds ?? 0}`,
    `budgetBlocked=${summary.budgetBlocked ?? 0}`,
    '',
    ...summary.byLeague.flatMap((entry) => [
      `league=${entry.league}`,
      `status=${entry.status}`,
      `fixturesDetected=${entry.fixturesDetected}`,
      `modelEligible=${entry.modelEligible}`,
      `inDecisionWindow=${entry.inDecisionWindow ?? 0}`,
      `modelled=${entry.modelled ?? 0}`,
      `oddsAvailable=${entry.oddsAvailable ?? 0}`,
      `analyzed=${entry.analyzed ?? 0}`,
      `bet=${entry.bet ?? 0}`,
      `noBet=${entry.noBet ?? 0}`,
      ...(entry.rejectionReason === undefined ? [] : [`rejectionReason=${entry.rejectionReason}`]),
      `oddsRequested=${entry.oddsRequested}`,
      `quantCandidates=${entry.quantCandidates}`,
      `paperBets=${entry.paperBets}`,
      '',
    ]),
    `DISCOVERED_FIXTURES=${summary.rawFixtures}`,
    `OBSERVATION_FIXTURES=${summary.observationFixtures}`,
    `MODEL_ENABLED_FIXTURES=${summary.eligibleFixtures}`,
    '',
    `fullOddsScans=${summary.fullOddsScans}`,
    `oddsPapiRequests=${summary.oddsPapiRequests}`,
    '',
    `poissonModeled=${summary.poissonModeled}`,
    `ANALYZED_FIXTURES=${summary.poissonModeled}`,
    `quantCandidates=${summary.quantCandidates}`,
    `paperBetsCreated=${summary.paperBetsCreated}`,
    `BET_COUNT=${summary.paperBetsCreated}`,
    `NO_BET_COUNT=${summary.noBets ?? 0}`,
    `NO_ODDS_COUNT=${summary.oddsUnavailable ?? 0}`,
    `INSUFFICIENT_DATA_COUNT=${summary.insufficientData ?? 0}`,
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
    @Optional()
    @Inject(MODEL_ANALYSIS_STORE)
    private readonly modelAnalysisStore: ModelAnalysisStore = new SqliteModelAnalysisStore(
      ':memory:',
    ),
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
      supportedLeagueFixtures: 0,
      supportedFixtures: 0,
      eligibleFixtures: 0,
      modelEnabledFixtures: 0,
      observationFixtures: 0,
      decisionWindowFixtures: 0,
      preAnalysisEligible: 0,
      outsideDecisionWindow: 0,
      historyReady: 0,
      aliasesReady: 0,
      modelledFixtures: 0,
      preAnalysisCount: 0,
      oddsRequested: 0,
      oddsAvailableFixtures: 0,
      analyzedFixtures: 0,
      marketAnalyzed: 0,
      oddsAvailable: 0,
      noOdds: 0,
      noBetCount: 0,
      budgetBlocked: 0,
      byLeague: [],
      fullOddsScans: 0,
      oddsPapiRequests: 0,
      apiFootballRequests: 0,
      fixtureCacheHit: false,
      fixtureCacheAgeMinutes: 0,
      poissonModeled: 0,
      noBets: 0,
      insufficientData: 0,
      oddsUnavailable: 0,
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
    let radar: {
      home: string;
      away: string;
      selection: string;
      explanation: string;
      shortHint: string;
      marketEmoji: string;
      probability: number;
      kickoffAt: Date;
    }[] = [];
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
      tick.supportedLeagueFixtures =
        precheck.supportedLeagueFixtures ??
        precheck.rawFixtures -
          precheck.byLeague
            .filter((entry) => entry.status === 'EXCLUDED')
            .reduce((sum, entry) => sum + entry.fixturesDetected, 0);
      tick.supportedFixtures = tick.supportedLeagueFixtures;
      tick.eligibleFixtures = precheck.eligibleFixtures;
      tick.modelEnabledFixtures = precheck.eligibleFixtures;
      tick.observationFixtures = precheck.observationFixtures;
      tick.decisionWindowFixtures = precheck.decisionWindowFixtures.length;
      tick.preAnalysisEligible = precheck.preAnalysisFixtures?.length ?? 0;
      const modelAnalysis = runModelAnalysis(
        (precheck.preAnalysisFixtures ?? []).map((entry) => entry.fixture),
        (fixture) => historicalMatchesForLeague(fixture.leagueId ?? -1, fixture.country ?? ''),
        now,
      );
      for (const analysis of modelAnalysis.analyses)
        this.modelAnalysisStore.saveModelAnalysis(analysis);
      tick.preAnalysisCount = modelAnalysis.analyses.length;
      tick.modelledFixtures = modelAnalysis.analyses.length;
      tick.insufficientData = modelAnalysis.insufficientData;
      radar = modelAnalysis.analyses
        .map((analysis) => {
          const market = marketLanguage(
            analysis.model.pOver >= analysis.model.pUnder ? 'OVER_2_5' : 'UNDER_2_5',
          );
          return {
            home: analysis.fixture.homeTeam,
            away: analysis.fixture.awayTeam,
            selection: market.title,
            explanation: market.explanation,
            shortHint: market.shortHint,
            marketEmoji: market.emoji,
            probability: Math.max(analysis.model.pOver, analysis.model.pUnder),
            kickoffAt: analysis.fixture.kickoffAt,
          };
        })
        .sort((a, b) => b.probability - a.probability);
      tick.outsideDecisionWindow = precheck.eligibleFixtures - tick.decisionWindowFixtures;
      tick.byLeague = precheck.byLeague.map((entry) => ({
        leagueId: entry.leagueId,
        league: entry.canonicalName,
        status: entry.status,
        fixturesDetected: entry.fixturesDetected,
        modelEligible: entry.status === 'MODEL_ENABLED' ? entry.fixturesDetected : 0,
        inDecisionWindow: precheck.decisionWindowFixtures.filter(
          (candidate) => candidate.fixture.leagueId === entry.leagueId,
        ).length,
        modelled: modelAnalysis.analyses.filter(
          (analysis) => analysis.fixture.leagueId === entry.leagueId,
        ).length,
        oddsRequested: 0,
        quantCandidates: 0,
        paperBets: 0,
      }));
      const daily = this.refinementStore.dailyCounters(day);
      const budgetGuard = daily.fullOddsScans >= config.maxOddsPapiFullScansPerDay;
      if (budgetGuard) {
        tick.budgetGuardType = 'INTERNAL_DAILY_FULL_ODDS_SCANS';
        tick.budgetProvider = 'OddsPapi';
        tick.budgetLimit = config.maxOddsPapiFullScansPerDay;
        tick.budgetCurrentUsage = daily.fullOddsScans;
        tick.budgetRemaining = Math.max(0, config.maxOddsPapiFullScansPerDay - daily.fullOddsScans);
        tick.budgetResetAt = nextUtcDay(day);
        tick.budgetBlocked = precheck.decisionWindowFixtures.length;
      }
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
        tick.modelledFixtures = Math.max(tick.modelledFixtures ?? 0, result.result.poissonModeled);
        tick.marketAnalyzed = result.result.analyses?.length ?? result.result.quantCandidates;
        tick.oddsAvailable = result.scan?.report.candidatesNormalized ?? 0;
        tick.noOdds = result.result.rejected?.NO_BOOKMAKER ?? 0;
        tick.quantCandidates = result.result.quantCandidates;
        tick.paperBetsCreated = result.paperBetsCreated;
        tick.noBets =
          result.result.analyses?.filter((analysis) => analysis.decision === 'NO_BET').length ?? 0;
        tick.noBetCount = tick.noBets;
        tick.insufficientData = result.result.rejected?.MODEL_DATA ?? 0;
        tick.oddsUnavailable = Math.max(
          0,
          (result.scan?.report.temporalEligible ?? 0) -
            (result.scan?.report.candidatesNormalized ?? 0),
        );
        tick.oddsRequested = tick.oddsPapiRequests;
        tick.oddsAvailableFixtures = result.scan?.report.candidatesNormalized ?? 0;
        tick.analyzedFixtures = result.result.analyses?.length ?? 0;
        tick.historyReady =
          result.result.poissonModeled + (result.result.rejected?.MODEL_DATA ?? 0);
        tick.aliasesReady = tick.historyReady;
        tick.byLeague = enrichLeagueSummaries(tick.byLeague, precheck, result);
        tick.telegramBetMessages = result.telegramSent;
        tick.lunaSelected = result.luna.selected;
        tick.lunaCalls = result.luna.apiCalls;
        tick.lunaCacheHits = result.luna.cacheHits;
        tick.paperBetsCreated = result.paperBetsCreated;
        tick.quantCandidates = result.result.quantCandidates;
      } else if (budgetGuard && precheck.decisionWindowFixtures.length > 0) {
        markError(tick, new Error('BUDGET_GUARD'), 'PARTIAL');
      }
    } catch (cause) {
      markError(tick, cause, 'ERROR');
    }

    tick.openPaperBets = this.bets.listByStatus('OPEN').length;
    tick.oddsPapiRequests = this.scanning.oddsPapiRequests() - beforeOdds;
    tick.oddsRequested = tick.oddsPapiRequests;
    tick.apiFootballRequests =
      this.scanning.apiFootballRequests() +
      this.settlement.apiFootballRequests() -
      beforeApiFootball;
    tick.fixtureCacheHit = this.scanning.fixtureCacheHit?.() ?? false;
    tick.fixtureCacheAgeMinutes = this.scanning.fixtureCacheAgeMinutes?.() ?? 0;
    tick.byLeague = tick.byLeague.map((entry) =>
      entry.status === 'MODEL_ENABLED'
        ? {
            ...entry,
            oddsRequested: tick.oddsPapiRequests,
            quantCandidates: entry.quantCandidates,
            paperBets: entry.bet === undefined ? entry.paperBets : entry.bet,
          }
        : entry,
    );
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
            byLeague: tick.byLeague.map((entry) => ({
              leagueId: entry.leagueId,
              status: entry.status,
              fixturesDetected: entry.fixturesDetected,
            })),
            counters: countersForHeartbeat(tick),
            openBets: tick.openPaperBets,
            fixturesModelled: tick.poissonModeled,
            bets: tick.paperBetsCreated,
            noBets: tick.noBets,
            insufficientData: tick.insufficientData,
            oddsUnavailable: tick.oddsUnavailable,
            budgetBlocked: tick.budgetBlocked,
            budgetProvider: tick.budgetProvider,
            budgetResetAt: tick.budgetResetAt,
            error: tick.error,
            preAnalysisCount: tick.preAnalysisCount,
            marketAnalyzed: tick.marketAnalyzed,
            noOdds: tick.noOdds,
            radar,
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

function nextUtcDay(day: string): string {
  const next = new Date(`${day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function enrichLeagueSummaries(
  summaries: RefinementLeagueSummary[],
  precheck: Awaited<ReturnType<ScanningService['precheck']>>,
  result: Awaited<ReturnType<QuantScanService['runScanForFixtures']>>,
): RefinementLeagueSummary[] {
  return summaries.map((summary) => {
    const fixtures = precheck.decisionWindowFixtures.filter(
      (entry) => entry.fixture.leagueId === summary.leagueId,
    );
    const rawAnalyses = result.result.analyses;
    if (rawAnalyses === undefined) {
      return {
        ...summary,
        inDecisionWindow: fixtures.length,
        quantCandidates:
          summary.status === 'MODEL_ENABLED'
            ? result.result.quantCandidates
            : summary.quantCandidates,
        paperBets: summary.status === 'MODEL_ENABLED' ? result.paperBetsCreated : summary.paperBets,
      };
    }
    const analyses = rawAnalyses.filter(
      (analysis) => analysis.fixture.leagueId === summary.leagueId,
    );
    const modelled = analyses.length;
    const bet = analyses.filter((analysis) => analysis.decision === 'BET').length;
    return {
      ...summary,
      inDecisionWindow: fixtures.length,
      modelled,
      oddsAvailable: analyses.length,
      analyzed: analyses.length,
      bet,
      noBet: analyses.length - bet,
      rejectionReason: analyses.find((analysis) => analysis.reason)?.reason,
    };
  });
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
