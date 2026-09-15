/**
 * Orquestación pura de Poisson V1: combina ventana causal, medias de liga, historial por rol,
 * shrinkage y lambdas en un único `PoissonModelOutput` (protocolo sección 5/9). Sin red, sin
 * reloj: `snapshotAt` y el histórico completo se reciben como parámetros.
 */

import { computeLambdas } from './attackDefense';
import type { DataQualityFlag, HistoricalMatch, PoissonModelResult } from './concepts';
import { POISSON_MODEL_VERSION } from './concepts';
import { filterHistoricalWindow } from './historicalWindow';
import { computeLeagueBaselines } from './leagueBaselines';
import { overUnderProbabilities } from './poissonDistribution';
import {
  aggregateAwayRoleStats,
  aggregateHomeRoleStats,
  awayRoleHistory,
  homeRoleHistory,
  MIN_TEAM_ROLE_MATCHES,
} from './roleHistory';
import { shrinkStat } from './shrinkage';

export interface PoissonModelInput {
  fixtureId: string;
  league: string;
  home: string;
  away: string;
  snapshotAt: Date;
  historicalMatches: readonly HistoricalMatch[];
}

function roleDataQuality(matches: number): 'NONE' | 'INSUFFICIENT' | 'OK' {
  if (matches === 0) return 'NONE';
  if (matches < MIN_TEAM_ROLE_MATCHES) return 'INSUFFICIENT';
  return 'OK';
}

export function computePoissonV1(input: PoissonModelInput): PoissonModelResult {
  const matchesInWindow = filterHistoricalWindow(input.historicalMatches, input.snapshotAt);

  const leagueBaselines = computeLeagueBaselines(matchesInWindow);
  if (leagueBaselines === 'LEAGUE_NOT_ENABLED') return { status: 'LEAGUE_NOT_ENABLED' };
  const { leagueHomeGoalsMean, leagueAwayGoalsMean } = leagueBaselines;

  const homeMatches = homeRoleHistory(matchesInWindow, input.home);
  const awayMatches = awayRoleHistory(matchesInWindow, input.away);
  const homeStats = aggregateHomeRoleStats(homeMatches);
  const awayStats = aggregateAwayRoleStats(awayMatches);

  const shrunkHomeGF = shrinkStat(homeStats.matches, homeStats.goalsForSum, leagueHomeGoalsMean);
  const shrunkHomeGA = shrinkStat(
    homeStats.matches,
    homeStats.goalsAgainstSum,
    leagueAwayGoalsMean,
  );
  const shrunkAwayGF = shrinkStat(awayStats.matches, awayStats.goalsForSum, leagueAwayGoalsMean);
  const shrunkAwayGA = shrinkStat(
    awayStats.matches,
    awayStats.goalsAgainstSum,
    leagueHomeGoalsMean,
  );

  const { lambdaHome, lambdaAway, lambdaTotal } = computeLambdas({
    leagueHomeGoalsMean,
    leagueAwayGoalsMean,
    shrunkHomeGF,
    shrunkHomeGA,
    shrunkAwayGF,
    shrunkAwayGA,
  });

  const { pOver, pUnder } = overUnderProbabilities(lambdaTotal);

  const dataQuality: DataQualityFlag[] = [];
  const homeQuality = roleDataQuality(homeStats.matches);
  const awayQuality = roleDataQuality(awayStats.matches);
  if (homeQuality === 'NONE') dataQuality.push('HOME_NO_ROLE_HISTORY');
  if (homeQuality === 'INSUFFICIENT') dataQuality.push('HOME_INSUFFICIENT_ROLE_HISTORY');
  if (awayQuality === 'NONE') dataQuality.push('AWAY_NO_ROLE_HISTORY');
  if (awayQuality === 'INSUFFICIENT') dataQuality.push('AWAY_INSUFFICIENT_ROLE_HISTORY');

  return {
    status: 'OK',
    output: {
      modelVersion: POISSON_MODEL_VERSION,
      snapshotAt: input.snapshotAt,
      fixtureId: input.fixtureId,
      league: input.league,
      home: input.home,
      away: input.away,
      leagueHomeGoalsMean,
      leagueAwayGoalsMean,
      homeRoleMatches: homeStats.matches,
      awayRoleMatches: awayStats.matches,
      lambdaHome,
      lambdaAway,
      lambdaTotal,
      pOver,
      pUnder,
      dataQuality,
    },
  };
}
