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
import {
  calendarDateInBogota,
  prioritizeTodayFirst,
  selectTodayFirst,
} from '../../scanning/domain/todayFirst';
import type { Fixture } from '../../scanning/domain/concepts';
import type { HistoricalMatch } from '../../poisson/domain/concepts';
import { filterHistoricalWindow } from '../../poisson/domain/historicalWindow';
import { fixtureHistoryStatus, type FixtureHistoryStatus } from '../../poisson/domain/roleHistory';
import { classifyTodayFixtures } from '../../scanning/domain/todayFunnel';
import {
  auditEuropaFixture,
  computeEuropaExperimentalModel,
} from '../../scanning/domain/europaCoverage';
import { LEAGUE_UNIVERSE } from '../../scanning/domain/leagueUniverse';
import { evaluateDecisionWindow } from '../../scanning/domain/decisionWindow';
import { formatKickoffBogota } from '../../notifications/domain/formatKickoff';
import { logger } from '../../../shared/logging/logger';
import type {
  RefinementHeartbeatApprovedBet,
  RefinementHeartbeatNoBetEntry,
} from '../../notifications/domain/refinementHeartbeat';
import { PredictionLedgerService } from '../../prediction-ledger/application/predictionLedgerService';

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
  marketAnalysisAttempted?: number;
  marketAnalysisCompleted?: number;
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
  todayRawFixtures?: number;
  todayModelEnabled?: number;
  todayModelable?: number;
  todayHistoryReady?: number;
  todayAliasReady?: number;
  todayInsufficientHistory?: number;
  todayWithinModelHorizon?: number;
  todayStarted?: number;
  todayExpired?: number;
  todayRejected?: number;
  todayRejectionExamples?: readonly { home: string; away: string; reason: string }[];
  todayModelEligible?: number;
  todayModelled?: number;
  todayPreanalysis?: number;
  todayMarketWindow?: number;
  todayMarketAnalyzed?: number;
  upcomingModelled?: number;
  upcomingPreanalysis?: number;
  todayExclusions?: Record<string, number>;
  radarTodayShown?: number;
  radarUpcomingShown?: number;
  nextT6FixtureId?: string;
  nextT6Fixture?: string;
  nextT6Home?: string;
  nextT6Away?: string;
  nextT6League?: string;
  nextT6LeagueId?: number;
  nextT6Country?: string;
  nextT6KickoffAt?: string;
  nextT6KickoffBogota?: string;
  nextT6HoursRemaining?: number;
  nextT6At?: string;
}

export function refinementTickId(now: Date): string {
  const bucket = new Date(now);
  bucket.setUTCMinutes(bucket.getUTCMinutes() - (bucket.getUTCMinutes() % 30), 0, 0);
  return bucket.toISOString().slice(0, 16);
}

/** Presupuesto de detección por tick: fixtures crudos que el precheck analiza. */
export const PRECHECK_FIXTURE_LIMIT = 60;

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
    `PREANALYSIS_ACTIVE=${summary.preAnalysisCount ?? 0}`,
    `T6_ELIGIBLE=${summary.decisionWindowFixtures}`,
    `oddsRequested=${summary.oddsRequested ?? 0}`,
    `oddsAvailableFixtures=${summary.oddsAvailableFixtures ?? 0}`,
    `ODDS_AVAILABLE=${summary.oddsAvailable ?? summary.oddsAvailableFixtures ?? 0}`,
    `analyzedFixtures=${summary.analyzedFixtures ?? 0}`,
    `marketAnalyzed=${summary.marketAnalyzed ?? 0}`,
    `MARKET_ANALYSIS_ATTEMPTED=${summary.marketAnalysisAttempted ?? 0}`,
    `MARKET_ANALYSIS_COMPLETED=${summary.marketAnalysisCompleted ?? 0}`,
    `TODAY_RAW_FIXTURES=${summary.todayRawFixtures ?? 0}`,
    `TODAY_MODEL_ENABLED=${summary.todayModelEnabled ?? 0}`,
    `TODAY_MODELABLES=${summary.todayModelable ?? 0}`,
    `TODAY_HISTORY_READY=${summary.todayHistoryReady ?? 0}`,
    `TODAY_ALIAS_READY=${summary.todayAliasReady ?? 0}`,
    `TODAY_INSUFFICIENT_HISTORY=${summary.todayInsufficientHistory ?? 0}`,
    `TODAY_WITHIN_MODEL_HORIZON=${summary.todayWithinModelHorizon ?? 0}`,
    `TODAY_MODEL_ELIGIBLE=${summary.todayModelEligible ?? 0}`,
    `TODAY_MODELLED=${summary.todayModelled ?? 0}`,
    `TODAY_PREANALYSIS=${summary.todayPreanalysis ?? 0}`,
    `TODAY_MARKET_WINDOW=${summary.todayMarketWindow ?? 0}`,
    `TODAY_MARKET_ANALYZED=${summary.todayMarketAnalyzed ?? 0}`,
    `TODAY_STARTED=${summary.todayStarted ?? 0}`,
    `TODAY_EXPIRED=${summary.todayExpired ?? 0}`,
    `TODAY_REJECTED=${summary.todayRejected ?? 0}`,
    `UPCOMING_MODELLED=${summary.upcomingModelled ?? 0}`,
    `UPCOMING_PREANALYSIS=${summary.upcomingPreanalysis ?? 0}`,
    ...Object.entries(summary.todayExclusions ?? {}).map(([reason, count]) => `${reason}=${count}`),
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
    `BUDGET_BLOCKED_COUNT=${summary.budgetBlocked ?? 0}`,
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
    @Optional()
    private readonly predictionLedger?: PredictionLedgerService,
  ) {}

  async runTick(
    config: Pick<AppConfig, 'refinementMode' | 'maxOddsPapiFullScansPerDay'> &
      Partial<Pick<AppConfig, 'dailyReportTimeBogota'>>,
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
      fixtureId?: string;
      home: string;
      away: string;
      league: string;
      leagueId?: number;
      country?: string;
      selection: string;
      explanation: string;
      shortHint: string;
      marketEmoji: string;
      probability: number;
      kickoffAt: Date;
      experimental: boolean;
    }[] = [];
    let approvedBets: RefinementHeartbeatApprovedBet[] = [];
    let noBetEntries: RefinementHeartbeatNoBetEntry[] = [];
    try {
      const settlement = await this.settlement.settleOpenBets();
      tick.settlements = settlement.settled;
      tick.telegramSettlementMessages = settlement.telegramSent;
    } catch (cause) {
      markError(tick, cause, 'PARTIAL');
    }
    try {
      const predictionSettlement = await this.predictionLedger?.settlePending(now);
      if (predictionSettlement !== undefined) {
        tick.settlements += predictionSettlement.settled;
        if (predictionSettlement.errors > 0) tick.errors += predictionSettlement.errors;
      }
    } catch (cause) {
      markError(tick, cause, 'PARTIAL');
    }

    try {
      const precheck = await this.scanning.precheck(PRECHECK_FIXTURE_LIMIT, now);
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
      const historyByFixture = new Map<string, readonly HistoricalMatch[]>();
      const historyForFixture = (fixture: Fixture): readonly HistoricalMatch[] => {
        const cached = historyByFixture.get(fixture.id);
        if (cached !== undefined) return cached;
        const matches = historicalMatchesForLeague(fixture.leagueId ?? -1, fixture.country ?? '');
        historyByFixture.set(fixture.id, matches);
        return matches;
      };
      const modelAnalysis = runModelAnalysis(
        (precheck.preAnalysisFixtures ?? []).map((entry) => entry.fixture),
        historyForFixture,
        now,
      );
      const domesticSources = LEAGUE_UNIVERSE.filter(
        (league) => league.status === 'MODEL_ENABLED' && league.historicalDataset !== null,
      ).map((league) => ({
        league: league.canonicalName,
        matches: historicalMatchesForLeague(league.leagueId, league.country),
      }));
      const experimentalAnalyses = (precheck.experimentalPreAnalysisFixtures ?? [])
        .map((entry) => auditEuropaFixture(entry.fixture, domesticSources, now))
        .map((coverage) => {
          const model = computeEuropaExperimentalModel(coverage, now);
          return model === null
            ? null
            : {
                fixture: coverage.fixture,
                snapshotAt: now,
                snapshotType: 'PREANALYSIS' as const,
                model,
                decision: 'PREANALYSIS' as const,
                modelMode: 'CROSS_LEAGUE_EXPERIMENTAL' as const,
                homeDomesticLeague: coverage.home.domesticLeague,
                awayDomesticLeague: coverage.away.domesticLeague,
              };
        })
        .filter((analysis): analysis is NonNullable<typeof analysis> => analysis !== null);
      for (const analysis of modelAnalysis.analyses)
        this.modelAnalysisStore.saveModelAnalysis(analysis);
      for (const analysis of experimentalAnalyses)
        this.modelAnalysisStore.saveModelAnalysis(analysis);
      for (const analysis of modelAnalysis.analyses)
        this.predictionLedger?.recordPreanalysis(analysis);
      for (const analysis of experimentalAnalyses)
        this.predictionLedger?.recordPreanalysis(analysis);
      const allAnalyses = [...modelAnalysis.analyses, ...experimentalAnalyses];
      tick.preAnalysisCount = allAnalyses.length;
      tick.modelledFixtures = tick.preAnalysisCount;
      for (const analysis of allAnalyses) {
        logPreanalysisFixture(analysis.fixture, now);
      }
      const nextT6 = nextT6Fixture(precheck.preAnalysisFixtures ?? [], now);
      tick.nextT6FixtureId = nextT6?.fixture.id;
      tick.nextT6Fixture = nextT6?.fixtureLabel;
      tick.nextT6Home = nextT6?.fixture.homeTeam;
      tick.nextT6Away = nextT6?.fixture.awayTeam;
      tick.nextT6League = nextT6?.fixture.league;
      tick.nextT6LeagueId = nextT6?.fixture.leagueId;
      tick.nextT6Country = nextT6?.fixture.country;
      tick.nextT6KickoffAt = nextT6?.fixture.kickoffAt.toISOString();
      tick.nextT6KickoffBogota = nextT6?.fixture.kickoffAt
        ? formatKickoffBogota(nextT6.fixture.kickoffAt)
        : undefined;
      tick.nextT6HoursRemaining = nextT6?.decisionAt
        ? hoursUntilKickoff(nextT6.decisionAt, now)
        : undefined;
      tick.nextT6At = nextT6?.decisionAt.toISOString();
      if (nextT6 !== undefined) {
        logger.info('NEXT_T6_FIXTURE', {
          fixtureId: nextT6.fixture.id,
          league: nextT6.fixture.league,
          fixture: nextT6.fixtureLabel,
          kickoffAtBogota: formatKickoffBogota(nextT6.fixture.kickoffAt),
          hoursRemaining: hoursUntilKickoff(nextT6.decisionAt, now),
        });
        logger.info('NEXT_T6_AT', { nextT6At: nextT6.decisionAt.toISOString() });
      }
      tick.insufficientData =
        modelAnalysis.insufficientData +
        (precheck.experimentalPreAnalysisFixtures?.length ?? 0) -
        experimentalAnalyses.length;
      const radarEntries = allAnalyses.map((analysis) => {
        const market = marketLanguage(
          analysis.model.pOver >= analysis.model.pUnder ? 'OVER_2_5' : 'UNDER_2_5',
        );
        return {
          fixtureId: analysis.fixture.id,
          home: analysis.fixture.homeTeam,
          away: analysis.fixture.awayTeam,
          league: analysis.fixture.league,
          leagueId: analysis.fixture.leagueId,
          country: analysis.fixture.country,
          selection: market.title,
          explanation: market.explanation,
          shortHint: market.shortHint,
          marketEmoji: market.emoji,
          probability: Math.max(analysis.model.pOver, analysis.model.pUnder),
          kickoffAt: analysis.fixture.kickoffAt,
          experimental: analysis.fixture.leagueId === 3,
        };
      });
      const radarSelection = selectTodayFirst(radarEntries, now);
      radar = [...radarSelection.today, ...radarSelection.upcoming];
      tick.radarTodayShown = radarSelection.today.length;
      tick.radarUpcomingShown = radarSelection.upcoming.length;
      const todayDate = calendarDateInBogota(now);
      const todayPreanalysis = allAnalyses.filter(
        (analysis) => calendarDateInBogota(analysis.fixture.kickoffAt) === todayDate,
      );
      const historyStatusById = new Map<string, FixtureHistoryStatus>(
        (precheck.preAnalysisFixtures ?? []).map((entry) => [
          entry.fixture.id,
          fixtureHistoryStatus(
            filterHistoricalWindow(historyForFixture(entry.fixture), now),
            entry.fixture.homeTeam,
            entry.fixture.awayTeam,
          ),
        ]),
      );
      const todayFunnel = classifyTodayFixtures(
        precheck.rawFixtureList ?? [],
        now,
        new Set(todayPreanalysis.map((analysis) => analysis.fixture.id)),
        (fixture) => historyStatusById.get(fixture.id) ?? 'READY',
      );
      tick.todayRawFixtures = todayFunnel.raw;
      tick.todayModelEnabled = todayFunnel.modelEnabled;
      tick.todayModelable = todayFunnel.modelable;
      tick.todayHistoryReady = todayFunnel.historyReady;
      tick.todayAliasReady = todayFunnel.aliasReady;
      tick.todayInsufficientHistory = todayFunnel.insufficientHistory;
      tick.todayWithinModelHorizon = todayFunnel.withinModelHorizon;
      tick.todayStarted = todayFunnel.started;
      tick.todayExpired = todayFunnel.expired;
      tick.todayRejected = todayFunnel.rejected;
      tick.todayRejectionExamples = todayFunnel.rejectionExamples;
      tick.todayModelEligible = todayFunnel.modelable;
      tick.todayPreanalysis = todayPreanalysis.length;
      tick.todayMarketWindow = precheck.decisionWindowFixtures.filter(
        (entry) => calendarDateInBogota(entry.fixture.kickoffAt) === todayDate,
      ).length;
      tick.upcomingPreanalysis = allAnalyses.length - todayPreanalysis.length;
      tick.todayModelled = todayPreanalysis.length;
      tick.upcomingModelled = tick.upcomingPreanalysis;
      tick.todayExclusions = todayFunnel.rejectionBreakdown;
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
        modelled: allAnalyses.filter((analysis) => analysis.fixture.leagueId === entry.leagueId)
          .length,
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
        // El guard solo informa que no queda cupo de full scans; no bloquea el
        // refinamiento dirigido de fixtures ya elegibles en T-6.
        tick.budgetBlocked = 0;
      }
      // El presupuesto limita full scans, no las consultas dirigidas de fixtures
      // que ya alcanzaron T-6. Esas consultas son necesarias para cerrar el estado.
      const pending = prioritizeTodayFirst(
        precheck.decisionWindowFixtures.map((entry) => ({
          entry,
          fixtureId: entry.fixture.id,
          kickoffAt: entry.fixture.kickoffAt,
        })),
        now,
      )
        .map((item) => item.entry)
        .filter((entry) =>
          this.refinementStore.claimDecisionSnapshot(
            PROTOCOL_COHORT_ID,
            entry.fixture.id,
            entry.decisionAt,
          ),
        );
      if (pending.length > 0) {
        tick.marketAnalysisAttempted = pending.length;
        for (const entry of pending) {
          if (entry.fixture.kickoffAt instanceof Date) {
            logger.info('T6_TRANSITION', {
              fixtureId: entry.fixture.id,
              league: entry.fixture.league,
              homeTeam: entry.fixture.homeTeam,
              awayTeam: entry.fixture.awayTeam,
              fixture: fixtureLabel(entry.fixture),
              kickoffAt: entry.fixture.kickoffAt.toISOString(),
              previousState: 'PREANALYSIS',
              newState: 'T6',
              timestamp: now.toISOString(),
            });
          }
          logger.info('MARKET_ANALYSIS_STARTED', {
            fixtureId: entry.fixture.id,
            league: entry.fixture.league,
            homeTeam: entry.fixture.homeTeam,
            awayTeam: entry.fixture.awayTeam,
            fixture: fixtureLabel(entry.fixture),
            kickoffAt:
              entry.fixture.kickoffAt instanceof Date
                ? entry.fixture.kickoffAt.toISOString()
                : null,
            timestamp: now.toISOString(),
          });
        }
        const result = await this.quant.runScanForFixtures(
          pending.map((entry) => entry.fixture),
          now,
        );
        tick.precheckOnly = false;
        tick.fullOddsScans = budgetGuard ? 0 : 1;
        tick.poissonModeled = result.result.poissonModeled;
        const modelledFixtures = new Map<string, Fixture>();
        for (const analysis of allAnalyses)
          modelledFixtures.set(analysis.fixture.id, analysis.fixture);
        for (const analysis of result.result.analyses ?? [])
          modelledFixtures.set(analysis.fixture.id, analysis.fixture);
        tick.modelledFixtures = Math.max(modelledFixtures.size, result.result.poissonModeled);
        tick.todayModelled = [...modelledFixtures.values()].filter(
          (fixture) => calendarDateInBogota(fixture.kickoffAt) === todayDate,
        ).length;
        tick.upcomingModelled = tick.modelledFixtures - (tick.todayModelled ?? 0);
        tick.marketAnalyzed = result.result.analyses?.length ?? result.result.quantCandidates;
        tick.marketAnalysisCompleted = pending.length;
        tick.todayMarketAnalyzed =
          result.result.analyses?.filter(
            (analysis) => calendarDateInBogota(analysis.fixture.kickoffAt) === todayDate,
          ).length ?? 0;
        tick.oddsAvailable = result.scan?.report.candidatesNormalized ?? 0;
        tick.noOdds = result.result.rejected?.NO_BOOKMAKER ?? 0;
        tick.quantCandidates = result.result.quantCandidates;
        tick.paperBetsCreated = result.paperBetsCreated;
        tick.noBets =
          result.result.analyses?.filter((analysis) => analysis.decision === 'NO_BET').length ?? 0;
        noBetEntries = (result.result.analyses ?? [])
          .filter((analysis) => analysis.decision === 'NO_BET')
          .map((analysis) => ({
            home: analysis.fixture.homeTeam,
            away: analysis.fixture.awayTeam,
            reason: analysis.reason ?? 'INSUFFICIENT_DATA',
            league: analysis.fixture.league,
            leagueId: analysis.fixture.leagueId,
            country: analysis.fixture.country,
            kickoffAt: analysis.fixture.kickoffAt,
          }));
        tick.noBetCount = tick.noBets;
        tick.insufficientData = result.result.rejected?.MODEL_DATA ?? 0;
        tick.oddsUnavailable = Math.max(
          0,
          (result.scan?.report.temporalEligible ?? 0) -
            (result.scan?.report.candidatesNormalized ?? 0),
        );
        const analyzedIds = new Set(
          (result.result.analyses ?? []).map((analysis) => analysis.fixture.id),
        );
        const modelByFixture = new Map(
          allAnalyses.map((analysis) => [analysis.fixture.id, analysis]),
        );
        for (const entry of pending) {
          if (analyzedIds.has(entry.fixture.id)) continue;
          const model = modelByFixture.get(entry.fixture.id)?.model;
          if (model === undefined) continue;
          const terminalDecision = {
            fixture: entry.fixture,
            snapshotAt: now,
            model,
            decision: 'NO_ODDS' as const,
            reason: 'NO_BOOKMAKER',
          };
          this.modelAnalysisStore.saveTerminalMarketDecision(terminalDecision);
          this.predictionLedger?.recordTerminalMarketDecision(terminalDecision);
        }
        for (const entry of pending) {
          const analysis = result.result.analyses?.find(
            (candidate) => candidate.fixture.id === entry.fixture.id,
          );
          if (analysis !== undefined) {
            continue;
          }
          const model = modelByFixture.get(entry.fixture.id)?.model;
          if (model !== undefined) {
            logger.info('MARKET_ANALYSIS_COMPLETED', {
              fixtureId: entry.fixture.id,
              league: entry.fixture.league,
              homeTeam: entry.fixture.homeTeam,
              awayTeam: entry.fixture.awayTeam,
              fixture: fixtureLabel(entry.fixture),
              selection: model.pOver >= model.pUnder ? 'OVER_2_5' : 'UNDER_2_5',
              modelProbability: Math.max(model.pOver, model.pUnder),
              observedOdds: null,
              minimumAcceptableOdds: null,
              edge: null,
              ev: null,
              decision: 'NO_ODDS',
              reason: 'NO_BOOKMAKER',
              riskDecision: null,
              telegramSent: false,
              timestamp: now.toISOString(),
            });
            logFinalDecision({
              fixture: entry.fixture,
              selection: model.pOver >= model.pUnder ? 'OVER_2_5' : 'UNDER_2_5',
              modelProbability: Math.max(model.pOver, model.pUnder),
              observedOdds: null,
              minimumAcceptableOdds: null,
              edge: null,
              ev: null,
              decision: 'NO_ODDS',
              reason: 'NO_BOOKMAKER',
              riskDecision: null,
              telegramSent: false,
              now,
            });
          }
        }
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
      }
    } catch (cause) {
      markError(tick, cause, 'ERROR');
    }

    tick.openPaperBets = this.bets.listByStatus('OPEN').length;
    if (tick.paperBetsCreated > 0) {
      approvedBets = this.bets
        .listByStatus('OPEN')
        .filter((bet) => bet.createdAt.getTime() >= now.getTime())
        .map((bet) => ({
          home: bet.homeTeam,
          away: bet.awayTeam,
          league: bet.league,
          kickoffAt: bet.kickoff,
          selection: bet.selection,
          modelProbability: bet.modelProbability,
          offeredOdds: bet.placedOdds,
          minimumAcceptableOdds: bet.minimumAcceptableOdds,
          edge: bet.edge,
          expectedValue: bet.expectedValue,
          stakeCop: bet.stake,
        }));
    }
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

    if (config.refinementMode) {
      try {
        const heartbeat = formatRefinementHeartbeat({
          now,
          byLeague: tick.byLeague.map((entry) => ({
            leagueId: entry.leagueId,
            status: entry.status,
            fixturesDetected: entry.fixturesDetected,
            modelled: entry.modelled,
          })),
          counters: countersForHeartbeat(tick),
          openBets: tick.openPaperBets,
          fixturesModelled: tick.modelledFixtures,
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
          radar: radar.map((entry) => ({ ...entry, experimental: entry.experimental })),
          closedFollowups: this.closedFollowups(now, radar),
          approvedBets,
          noBetEntries,
          todayRawFixtures: tick.todayRawFixtures,
          todayModelEnabled: tick.todayModelEnabled,
          todayModelable: tick.todayModelable,
          todayHistoryReady: tick.todayHistoryReady,
          todayAliasReady: tick.todayAliasReady,
          todayWithinModelHorizon: tick.todayWithinModelHorizon,
          todayPreanalysis: tick.todayPreanalysis,
          todayStarted: tick.todayStarted,
          todayExpired: tick.todayExpired,
          todayRejected: tick.todayRejected,
          todayRejectionExamples: tick.todayRejectionExamples,
          upcomingPreanalysis: tick.upcomingPreanalysis,
          radarTodayShown: tick.radarTodayShown,
          radarUpcomingShown: tick.radarUpcomingShown,
          nextT6:
            tick.nextT6Home !== undefined &&
            tick.nextT6League !== undefined &&
            tick.nextT6At !== undefined
              ? {
                  home: tick.nextT6Home,
                  away: tick.nextT6Away ?? tick.nextT6Home,
                  league: tick.nextT6League,
                  leagueId: tick.nextT6LeagueId,
                  country: tick.nextT6Country,
                  kickoffAt:
                    tick.nextT6KickoffAt === undefined ? undefined : new Date(tick.nextT6KickoffAt),
                  decisionAt: new Date(tick.nextT6At),
                }
              : undefined,
        });
        const material = {
          radar: radar.map((entry) => ({
            fixtureId: entry.fixtureId,
            selection: entry.selection,
            probabilityBand: Math.round(entry.probability * 1_000),
          })),
          decisions: { bets: tick.paperBetsCreated, noBets: tick.noBets, noOdds: tick.noOdds },
          closed: this.closedFollowups(now, radar).map((entry) => `${entry.home}|${entry.away}`),
          status: tick.status,
        };
        const shouldSend =
          this.predictionLedger?.shouldSendEvent('operational-heartbeat', material, now) ??
          this.refinementStore.claimHeartbeat(tickId);
        if (shouldSend) {
          await this.notifications.send(heartbeat);
          tick.telegramHeartbeatSent = true;
        }
      } catch (cause) {
        markError(tick, cause, 'PARTIAL');
      }
    }

    try {
      await this.predictionLedger?.sendDailyReportIfDue(
        now,
        config.dailyReportTimeBogota ?? '22:30',
      );
    } catch (cause) {
      markError(tick, cause, 'PARTIAL');
    }

    process.stdout.write(`${renderRefinementTick(tick)}\n`);
    if (tick.nextT6Fixture === undefined) {
      logger.info('NEXT_T6_FIXTURE', { fixture: 'NONE' });
      logger.info('NEXT_T6_AT', { nextT6At: 'NONE' });
    }
    return tick;
  }

  private closedFollowups(
    now: Date,
    radar: readonly { fixtureId?: string; home: string; away: string }[],
  ) {
    const activeIds = new Set(radar.map((entry) => entry.fixtureId));
    return (this.modelAnalysisStore.listLatest?.('PREANALYSIS') ?? [])
      .filter(
        (entry) =>
          entry.fixture.kickoffAt.getTime() <= now.getTime() &&
          calendarDateInBogota(entry.fixture.kickoffAt) === calendarDateInBogota(now) &&
          !activeIds.has(entry.fixture.id),
      )
      .map((entry) => {
        const market = marketLanguage(
          entry.model.pOver >= entry.model.pUnder ? 'OVER_2_5' : 'UNDER_2_5',
        );
        return {
          home: entry.fixture.homeTeam,
          away: entry.fixture.awayTeam,
          league: entry.fixture.league,
          leagueId: entry.fixture.leagueId,
          country: entry.fixture.country,
          selection: market.title,
          probability: Math.max(entry.model.pOver, entry.model.pUnder),
          kickoffAt: entry.fixture.kickoffAt,
          reason: 'Partido iniciado / ventana prepartido cerrada',
        };
      });
  }
}

function nextUtcDay(day: string): string {
  const next = new Date(`${day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function fixtureLabel(fixture: Fixture): string {
  return `${fixture.homeTeam} vs ${fixture.awayTeam}`;
}

export function hoursUntilKickoff(kickoffAt: Date, now: Date): number {
  return Number(((kickoffAt.getTime() - now.getTime()) / 3_600_000).toFixed(2));
}

export function logPreanalysisFixture(fixture: Fixture, now: Date): void {
  logger.info('PREANALYSIS_FIXTURE', {
    fixtureId: fixture.id,
    league: fixture.league,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    kickoffAtUtc: fixture.kickoffAt.toISOString(),
    kickoffAtBogota: formatKickoffBogota(fixture.kickoffAt),
    currentState: 'PREANALYSIS',
    hoursUntilKickoff: hoursUntilKickoff(fixture.kickoffAt, now),
    t6Eligible: evaluateDecisionWindow(fixture.kickoffAt, now) === 'ELIGIBLE_AT_DECISION_WINDOW',
  });
}

export function nextT6Fixture(
  entries: readonly { fixture: Fixture; decisionAt: Date }[],
  now: Date,
): { fixture: Fixture; fixtureLabel: string; decisionAt: Date } | undefined {
  return entries
    .filter(
      (entry) =>
        entry.fixture.kickoffAt instanceof Date && entry.decisionAt.getTime() > now.getTime(),
    )
    .sort((left, right) => {
      const decisionDiff = left.decisionAt.getTime() - right.decisionAt.getTime();
      if (decisionDiff !== 0) return decisionDiff;
      const kickoffDiff = left.fixture.kickoffAt.getTime() - right.fixture.kickoffAt.getTime();
      if (kickoffDiff !== 0) return kickoffDiff;
      return left.fixture.id.localeCompare(right.fixture.id);
    })
    .map((entry) => ({
      fixture: entry.fixture,
      fixtureLabel: fixtureLabel(entry.fixture),
      decisionAt: entry.decisionAt,
    }))[0];
}

function logFinalDecision(input: {
  fixture: Fixture;
  selection: string | null;
  modelProbability: number | null;
  observedOdds: number | null;
  minimumAcceptableOdds: number | null;
  edge: number | null;
  ev: number | null;
  decision: string;
  reason: string | null;
  riskDecision: string | null;
  telegramSent: boolean;
  now: Date;
}): void {
  logger.info('FINAL_DECISION', {
    fixtureId: input.fixture.id,
    fixture: fixtureLabel(input.fixture),
    selection: input.selection,
    modelProbability: input.modelProbability,
    observedOdds: input.observedOdds,
    minimumAcceptableOdds: input.minimumAcceptableOdds,
    edge: input.edge,
    ev: input.ev,
    decision: input.decision,
    reason: input.reason,
    riskDecision: input.riskDecision,
    telegramSent: input.telegramSent,
    timestamp: input.now.toISOString(),
  });
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
    if (summary.leagueId === 3) return summary;
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
