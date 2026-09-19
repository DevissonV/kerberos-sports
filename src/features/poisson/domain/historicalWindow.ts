/**
 * Ventana causal del histórico Poisson V1 (protocolo sección 5, verificado en
 * `resources/temp/KSS-HISTORY-GATE-01B.md` sección 2), endurecida por la política
 * conservadora de resultados del mismo día (KSS-ASTRA-ADVERSARIAL-REVIEW-01 C1).
 * Puro: recibe `snapshotAt` como parámetro, nunca lee el reloj del sistema.
 */

import type { HistoricalMatch } from './concepts';

export const HISTORICAL_WINDOW_MONTHS = 24;

/** Medianoche UTC del día calendario de `at`. */
export function utcDayStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

/** `snapshotAt` menos 24 meses, en UTC. */
export function windowStart(snapshotAt: Date): Date {
  const start = new Date(snapshotAt.getTime());
  start.setUTCMonth(start.getUTCMonth() - HISTORICAL_WINDOW_MONTHS);
  return start;
}

/**
 * Política causal conservadora para resultados con fecha sin hora disponible: una fila
 * CSV solo certifica la fecha calendario del partido, no la hora en que el resultado
 * quedó publicado. Por tanto un partido solo entra al histórico si su día calendario UTC
 * es estrictamente ANTERIOR al día calendario del snapshot; partidos de la misma fecha
 * del snapshot NUNCA se consideran causalmente disponibles (no se inventan horas de
 * finalización). Ver `KSS-ASTRA-ADVERSARIAL-REVIEW-01` C1 y
 * `resources/functional/analysis/KSS-CRITICAL-INTEGRITY-FIX-01.md`.
 */
export function isCausal(matchDate: Date, snapshotAt: Date): boolean {
  return utcDayStart(matchDate).getTime() < utcDayStart(snapshotAt).getTime();
}

/**
 * Filtra el histórico combinado a `[snapshotAt - 24 meses, día calendario del snapshot)`.
 * Aplica el tope de 24 meses y la política causal conservadora de C1: nunca partidos
 * futuros, de la fecha del snapshot ni de fechas posteriores.
 */
export function filterHistoricalWindow(
  matches: readonly HistoricalMatch[],
  snapshotAt: Date,
): HistoricalMatch[] {
  const start = windowStart(snapshotAt).getTime();
  const end = utcDayStart(snapshotAt).getTime();
  return matches.filter((match) => match.date.getTime() >= start && match.date.getTime() < end);
}
