/**
 * Gate de cobertura para fixtures UEFA: cada equipo se evalúa contra el histórico
 * de su propia liga doméstica. La salida experimental nunca es una recomendación
 * ejecutable ni llama a odds/riesgo.
 */

import { computeLeagueBaselines } from '../../poisson/domain/leagueBaselines';
import { filterHistoricalWindow } from '../../poisson/domain/historicalWindow';
import {
  aggregateAwayRoleStats,
  aggregateHomeRoleStats,
  awayRoleHistory,
  homeRoleHistory,
  MIN_TEAM_ROLE_MATCHES,
} from '../../poisson/domain/roleHistory';
import { overUnderProbabilities } from '../../poisson/domain/poissonDistribution';
import { shrinkStat } from '../../poisson/domain/shrinkage';
import { computeLambdas } from '../../poisson/domain/attackDefense';
import { POISSON_MODEL_VERSION } from '../../poisson/domain/concepts';
import type { HistoricalMatch, PoissonModelOutput } from '../../poisson/domain/concepts';
import type { Fixture } from './concepts';

export type EuropaSupportClass =
  'BOTH_SIDES_SUPPORTED' | 'ONE_SIDE_SUPPORTED' | 'NO_SUPPORTED_HISTORY';
export type EuropaModelStatus =
  'CROSS_LEAGUE_MODEL_VALIDATED' | 'EXPERIMENTAL_ONLY' | 'INSUFFICIENT_DATA';

export interface DomesticTeamSupport {
  domesticLeague: string | null;
  history: readonly HistoricalMatch[];
  historyAvailable: boolean;
  baselineAvailable: boolean;
  aliasesReady: boolean;
}

export interface EuropaFixtureCoverage {
  fixture: Fixture;
  home: DomesticTeamSupport;
  away: DomesticTeamSupport;
  supportClass: EuropaSupportClass;
  modelStatus: EuropaModelStatus;
}

export interface DomesticHistorySource {
  league: string;
  matches: readonly HistoricalMatch[];
}

const MIN_SUPPORTED_HISTORY = MIN_TEAM_ROLE_MATCHES;

/** Audita un fixture sin aplicar nunca un baseline de otra liga. */
export function auditEuropaFixture(
  fixture: Fixture,
  sources: readonly DomesticHistorySource[],
  snapshotAt: Date,
): EuropaFixtureCoverage {
  const home = supportForTeam(fixture.homeTeam, sources, snapshotAt, true);
  const away = supportForTeam(fixture.awayTeam, sources, snapshotAt, false);
  const supported = [home, away].filter((side) => side.aliasesReady && side.baselineAvailable);
  const supportClass =
    supported.length === 2
      ? 'BOTH_SIDES_SUPPORTED'
      : supported.length === 1
        ? 'ONE_SIDE_SUPPORTED'
        : 'NO_SUPPORTED_HISTORY';
  return {
    fixture,
    home,
    away,
    supportClass,
    modelStatus:
      supportClass === 'BOTH_SIDES_SUPPORTED' ? 'EXPERIMENTAL_ONLY' : 'INSUFFICIENT_DATA',
  };
}

/**
 * Poisson experimental interliga: normaliza cada fuerza con la media doméstica
 * correspondiente y usa el promedio de las medias home/away de ambas ligas como
 * ancla neutral. No tiene gate de edge, stake ni ejecución.
 */
export function computeEuropaExperimentalModel(
  coverage: EuropaFixtureCoverage,
  snapshotAt: Date,
): PoissonModelOutput | null {
  if (coverage.supportClass !== 'BOTH_SIDES_SUPPORTED') return null;
  const homeMatches = filterHistoricalWindow(coverage.home.history, snapshotAt);
  const awayMatches = filterHistoricalWindow(coverage.away.history, snapshotAt);
  const homeBaseline = computeLeagueBaselines(homeMatches);
  const awayBaseline = computeLeagueBaselines(awayMatches);
  if (homeBaseline === 'LEAGUE_NOT_ENABLED' || awayBaseline === 'LEAGUE_NOT_ENABLED') return null;
  const homeStats = aggregateHomeRoleStats(homeRoleHistory(homeMatches, coverage.fixture.homeTeam));
  const awayStats = aggregateAwayRoleStats(awayRoleHistory(awayMatches, coverage.fixture.awayTeam));
  if (homeStats.matches < MIN_SUPPORTED_HISTORY || awayStats.matches < MIN_SUPPORTED_HISTORY)
    return null;
  const shrunkHomeGF = shrinkStat(
    homeStats.matches,
    homeStats.goalsForSum,
    homeBaseline.leagueHomeGoalsMean,
  );
  const shrunkHomeGA = shrinkStat(
    homeStats.matches,
    homeStats.goalsAgainstSum,
    homeBaseline.leagueAwayGoalsMean,
  );
  const shrunkAwayGF = shrinkStat(
    awayStats.matches,
    awayStats.goalsForSum,
    awayBaseline.leagueAwayGoalsMean,
  );
  const shrunkAwayGA = shrinkStat(
    awayStats.matches,
    awayStats.goalsAgainstSum,
    awayBaseline.leagueHomeGoalsMean,
  );
  const pooled = computeLambdas({
    leagueHomeGoalsMean: (homeBaseline.leagueHomeGoalsMean + awayBaseline.leagueHomeGoalsMean) / 2,
    leagueAwayGoalsMean: (homeBaseline.leagueAwayGoalsMean + awayBaseline.leagueAwayGoalsMean) / 2,
    shrunkHomeGF:
      shrunkHomeGF * (homeBaseline.leagueHomeGoalsMean / homeBaseline.leagueHomeGoalsMean),
    shrunkHomeGA:
      shrunkHomeGA * (awayBaseline.leagueHomeGoalsMean / homeBaseline.leagueAwayGoalsMean),
    shrunkAwayGF:
      shrunkAwayGF * (awayBaseline.leagueAwayGoalsMean / awayBaseline.leagueAwayGoalsMean),
    shrunkAwayGA:
      shrunkAwayGA * (homeBaseline.leagueAwayGoalsMean / awayBaseline.leagueHomeGoalsMean),
  });
  const probabilities = overUnderProbabilities(pooled.lambdaTotal);
  return {
    modelVersion: POISSON_MODEL_VERSION,
    snapshotAt,
    fixtureId: coverage.fixture.id,
    league: coverage.fixture.league,
    home: coverage.fixture.homeTeam,
    away: coverage.fixture.awayTeam,
    leagueHomeGoalsMean: (homeBaseline.leagueHomeGoalsMean + awayBaseline.leagueHomeGoalsMean) / 2,
    leagueAwayGoalsMean: (homeBaseline.leagueAwayGoalsMean + awayBaseline.leagueAwayGoalsMean) / 2,
    homeRoleMatches: homeStats.matches,
    awayRoleMatches: awayStats.matches,
    ...pooled,
    ...probabilities,
    dataQuality: [],
  };
}

function supportForTeam(
  team: string,
  sources: readonly DomesticHistorySource[],
  snapshotAt: Date,
  homeRole: boolean,
): DomesticTeamSupport {
  for (const source of sources) {
    const history = filterHistoricalWindow(source.matches, snapshotAt);
    const roleMatches = homeRole ? homeRoleHistory(history, team) : awayRoleHistory(history, team);
    if (roleMatches.length >= MIN_SUPPORTED_HISTORY) {
      return {
        domesticLeague: source.league,
        history: source.matches,
        historyAvailable: true,
        baselineAvailable: computeLeagueBaselines(history) !== 'LEAGUE_NOT_ENABLED',
        aliasesReady: true,
      };
    }
  }
  return {
    domesticLeague: null,
    history: [],
    historyAvailable: false,
    baselineAvailable: false,
    aliasesReady: false,
  };
}
