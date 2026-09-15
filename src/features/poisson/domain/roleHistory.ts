/**
 * Historial específico de rol (protocolo sección 5): hasta 30 partidos por rol (home/away
 * separados, nunca mezclados), dentro de la ventana ya filtrada de 24 meses.
 */

import type { HistoricalMatch } from './concepts';

export const ROLE_WINDOW_MATCHES = 30;
export const MIN_TEAM_ROLE_MATCHES = 8;

export interface RoleStatsTotals {
  matches: number;
  goalsForSum: number;
  goalsAgainstSum: number;
}

/** Últimos hasta 30 partidos de `team` como local, dentro de `matchesInWindow`. */
export function homeRoleHistory(
  matchesInWindow: readonly HistoricalMatch[],
  team: string,
): HistoricalMatch[] {
  return matchesInWindow
    .filter((match) => match.homeTeam === team)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, ROLE_WINDOW_MATCHES);
}

/** Últimos hasta 30 partidos de `team` como visitante, dentro de `matchesInWindow`. */
export function awayRoleHistory(
  matchesInWindow: readonly HistoricalMatch[],
  team: string,
): HistoricalMatch[] {
  return matchesInWindow
    .filter((match) => match.awayTeam === team)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, ROLE_WINDOW_MATCHES);
}

/** Agrega goles a favor/en contra sobre partidos de local. */
export function aggregateHomeRoleStats(homeMatches: readonly HistoricalMatch[]): RoleStatsTotals {
  return homeMatches.reduce<RoleStatsTotals>(
    (totals, match) => ({
      matches: totals.matches + 1,
      goalsForSum: totals.goalsForSum + match.homeGoals,
      goalsAgainstSum: totals.goalsAgainstSum + match.awayGoals,
    }),
    { matches: 0, goalsForSum: 0, goalsAgainstSum: 0 },
  );
}

/** Agrega goles a favor/en contra sobre partidos de visitante. */
export function aggregateAwayRoleStats(awayMatches: readonly HistoricalMatch[]): RoleStatsTotals {
  return awayMatches.reduce<RoleStatsTotals>(
    (totals, match) => ({
      matches: totals.matches + 1,
      goalsForSum: totals.goalsForSum + match.awayGoals,
      goalsAgainstSum: totals.goalsAgainstSum + match.homeGoals,
    }),
    { matches: 0, goalsForSum: 0, goalsAgainstSum: 0 },
  );
}
