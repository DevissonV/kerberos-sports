/**
 * Integridad de pares de cuotas (H1 — KSS-ASTRA-ADVERSARIAL-REVIEW-01).
 * Validaciones puras y sin umbrales inventados: solo se rechaza lo matemáticamente
 * imposible o claramente inválido según los contratos vigentes (odds > 1 finitas,
 * par completo, mismo bookmaker/market, timestamps no futuros, overround >= 1).
 */

import type { OddsPair } from './concepts';

export type OddsPairIntegrityReason = 'INVALID_ODDS' | 'FUTURE_TIMESTAMP' | 'IMPOSSIBLE_OVERROUND';

/** Overround = suma de probabilidades implícitas del par (>= 1 en un book real). */
export function overroundOf(pair: Pick<OddsPair, 'over' | 'under'>): number {
  return 1 / pair.over.decimalOdds + 1 / pair.under.decimalOdds;
}

/**
 * Valida un par O/U 2.5 en un instante de decisión dado (el instante de la
 * corrida, no el `decisionAt` del fixture): rechaza cuotas no finitas o <= 1,
 * timestamps del proveedor claramente posteriores al instante de decisión y
 * overrounds < 1 (arbitraje matemáticamente imposible en un book con margen).
 * No impone TTL: sin evidencia contratual no se inventa una edad máxima.
 */
export function validateOddsPairIntegrity(
  pair: OddsPair,
  decisionInstant: Date,
): OddsPairIntegrityReason | null {
  const sides = [pair.over.decimalOdds, pair.under.decimalOdds] as const;
  if (sides.some((odds) => !Number.isFinite(odds) || odds <= 1)) return 'INVALID_ODDS';
  const changedAts = [pair.over.changedAt, pair.under.changedAt].filter(
    (changedAt): changedAt is Date => changedAt instanceof Date,
  );
  if (
    changedAts.some((changedAt) => changedAt.getTime() > decisionInstant.getTime()) ||
    [pair.over.observedAt, pair.under.observedAt].some(
      (observedAt) => observedAt.getTime() > decisionInstant.getTime(),
    )
  ) {
    return 'FUTURE_TIMESTAMP';
  }
  if (overroundOf(pair) < 1) return 'IMPOSSIBLE_OVERROUND';
  return null;
}
