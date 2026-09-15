/**
 * Ventana de decisión T-6h del protocolo KSS-V1-C01: una oportunidad solo es aceptable si
 * la corrida ocurre cerca de `kickoffAt - 6h`. Puro y determinista: recibe `now` explícito,
 * nunca lee el reloj del sistema.
 */

export const DECISION_WINDOW_HOURS = 6;
/**
 * Tolerancia tras `decisionAt` durante la cual una corrida todavía se considera "en la
 * ventana de decisión". Sin cron todavía (fuera de alcance de esta tarea): una corrida
 * manual/diaria rara vez cae exactamente en T-6h, así que se acepta un margen razonable
 * antes de considerar la ventana perdida (`MISSED_WINDOW`).
 */
export const DECISION_WINDOW_TOLERANCE_MINUTES = 60;

export type DecisionWindowStatus =
  'TOO_EARLY' | 'ELIGIBLE_AT_DECISION_WINDOW' | 'MISSED_WINDOW' | 'STARTED';

export function decisionAtFromKickoff(kickoffAt: Date): Date {
  return new Date(kickoffAt.getTime() - DECISION_WINDOW_HOURS * 60 * 60 * 1000);
}

/** Todas las comparaciones son en UTC: `Date#getTime()` es un instante absoluto (epoch ms). */
export function evaluateDecisionWindow(kickoffAt: Date, now: Date): DecisionWindowStatus {
  if (now.getTime() >= kickoffAt.getTime()) return 'STARTED';
  const decisionAt = decisionAtFromKickoff(kickoffAt);
  if (now.getTime() < decisionAt.getTime()) return 'TOO_EARLY';
  const windowEnd = decisionAt.getTime() + DECISION_WINDOW_TOLERANCE_MINUTES * 60_000;
  if (now.getTime() <= windowEnd) return 'ELIGIBLE_AT_DECISION_WINDOW';
  return 'MISSED_WINDOW';
}
