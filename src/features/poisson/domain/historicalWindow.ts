/**
 * Ventana causal del histórico Poisson V1 (protocolo sección 5, verificado en
 * `resources/temp/KSS-HISTORY-GATE-01B.md` sección 2): `snapshotAt - 24 meses <= match.date <
 * snapshotAt`. Puro: recibe `snapshotAt` como parámetro, nunca lee el reloj del sistema.
 */

import type { HistoricalMatch } from './concepts';

export const HISTORICAL_WINDOW_MONTHS = 24;

/** `snapshotAt` menos 24 meses, en UTC. */
export function windowStart(snapshotAt: Date): Date {
  const start = new Date(snapshotAt.getTime());
  start.setUTCMonth(start.getUTCMonth() - HISTORICAL_WINDOW_MONTHS);
  return start;
}

/** Filtro causal estricto: nunca se usa un partido en o después del snapshot. */
export function isCausal(matchDate: Date, snapshotAt: Date): boolean {
  return matchDate.getTime() < snapshotAt.getTime();
}

/**
 * Filtra el histórico combinado a `[snapshotAt - 24 meses, snapshotAt)`. Aplica tanto el
 * filtro causal (nunca partidos futuros u ocurriendo en el snapshot) como el tope de 24 meses.
 */
export function filterHistoricalWindow(
  matches: readonly HistoricalMatch[],
  snapshotAt: Date,
): HistoricalMatch[] {
  const start = windowStart(snapshotAt).getTime();
  const end = snapshotAt.getTime();
  return matches.filter((match) => {
    const time = match.date.getTime();
    return time >= start && time < end;
  });
}
