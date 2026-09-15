/**
 * Medias de liga (protocolo sección 5 y sección 1): `leagueHomeGoalsMean` /
 * `leagueAwayGoalsMean` sobre el histórico ya filtrado a la ventana causal. Si la liga no
 * alcanza el mínimo de partidos, queda `LEAGUE_NOT_ENABLED` (nunca se inventa una media).
 */

import type { HistoricalMatch } from './concepts';

export const LEAGUE_MIN_MATCHES = 200;

export interface LeagueBaselines {
  leagueHomeGoalsMean: number;
  leagueAwayGoalsMean: number;
  leagueMatches: number;
}

/** `matchesInWindow` debe venir ya filtrado por `filterHistoricalWindow`. */
export function computeLeagueBaselines(
  matchesInWindow: readonly HistoricalMatch[],
): LeagueBaselines | 'LEAGUE_NOT_ENABLED' {
  const leagueMatches = matchesInWindow.length;
  if (leagueMatches < LEAGUE_MIN_MATCHES) return 'LEAGUE_NOT_ENABLED';

  const totalHomeGoals = matchesInWindow.reduce((sum, match) => sum + match.homeGoals, 0);
  const totalAwayGoals = matchesInWindow.reduce((sum, match) => sum + match.awayGoals, 0);

  return {
    leagueHomeGoalsMean: totalHomeGoals / leagueMatches,
    leagueAwayGoalsMean: totalAwayGoals / leagueMatches,
    leagueMatches,
  };
}
