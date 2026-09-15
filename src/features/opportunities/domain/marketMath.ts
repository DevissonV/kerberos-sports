// Matemática de mercado para el mercado Over/Under 2.5 (two-way).
// Todas las funciones son puras y deterministas. Sin expresiones no finitas.

/** Probabilidad implícita (vig incluida) de una cuota decimal: 1 / odds. */
const impliedProbability = (odds: number): number => 1 / odds;

/**
 * Normaliza un par de cuotas two-way eliminando el margen (de-vig):
 * rawP_i = 1/odds_i, luego p_i^fair = rawP_i / (rawP_over + rawP_under),
 * garantizando pOverFair + pUnderFair = 1.
 */
export interface FairTwoWay {
  pOverFair: number;
  pUnderFair: number;
  fairOverOdds: number;
  fairUnderOdds: number;
}

export function devigTwoWay(overOdds: number, underOdds: number): FairTwoWay {
  assertValidOdds(overOdds, 'overOdds');
  assertValidOdds(underOdds, 'underOdds');
  const rawOver = impliedProbability(overOdds);
  const rawUnder = impliedProbability(underOdds);
  const sum = rawOver + rawUnder;
  const pOverFair = rawOver / sum;
  return {
    pOverFair,
    pUnderFair: 1 - pOverFair,
    fairOverOdds: 1 / pOverFair,
    fairUnderOdds: 1 / (1 - pOverFair),
  };
}

function assertValidOdds(odds: number, name: string): void {
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new Error(`cuota invalida: ${name} = ${odds} (debe ser > 1 y finita)`);
  }
}

/** Edge = p_modelo - p_fair_de_mercado. */
export function calculateEdge(modelProbability: number, fairMarketProbability: number): number {
  assertValidProbability(modelProbability, 'modelProbability');
  assertValidProbability(fairMarketProbability, 'fairMarketProbability');
  return modelProbability - fairMarketProbability;
}

/**
 * Valor esperado por unidad apostada a una cuota decimal:
 * EV = p * (decimalOdds - 1) - (1 - p)
 */
export function calculateExpectedValuePerUnit(
  modelProbability: number,
  decimalOdds: number,
): number {
  assertValidProbability(modelProbability, 'modelProbability');
  assertValidOdds(decimalOdds, 'decimalOdds');
  return modelProbability * (decimalOdds - 1) - (1 - modelProbability);
}

/**
 * Cuota decimal mínima para alcanzar un EV mínimo por unidad apostada:
 *   EV = p * odds - 1  >=  minEV   =>   odds >= (1 + minEV) / p
 * Con minEV = 0 es la cuota de break-even: 1 / p.
 *
 * NOTA conceptual (PRICE vs EDGE): esta cota NO es un edge. El edge se define
 * contra la probabilidad fair de-vigged del mercado, que requiere el PAR de
 * cuotas (ver devigTwoWay) y se verifica por separado en el gate mediante
 * fairMarketProbability. Mezclar aquí la probabilidad implícita cruda de una
 * sola cuota (1/odds, con vig) con el edge contra fair sería inconsistente.
 * Devuelve Infinity si p <= 0 (ninguna cuota finita alcanza el EV mínimo).
 */
export function calculateMinimumOddsForExpectedValue(
  modelProbability: number,
  minExpectedValue: number,
): number {
  assertValidProbability(modelProbability, 'modelProbability');
  if (!Number.isFinite(minExpectedValue) || minExpectedValue < 0) {
    throw new Error(`minExpectedValue invalido: ${minExpectedValue} (debe ser >= 0 y finito)`);
  }
  return modelProbability > 0
    ? (1 + minExpectedValue) / modelProbability
    : Number.POSITIVE_INFINITY;
}

// Re-export helper de validación de probabilidades para uso interno de la feature.
export function assertValidProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(
      `probabilidad invalida: ${name} = ${value} (debe estar en [0, 1] y ser finita)`,
    );
  }
}
