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
 * Cuota decimal minima compatible con un edge minimo.
 *
 * Definicion: las cuotas del mercado implican una probabilidad fair de mercado
 * pFair = 1/odds (tras de-vig de un two-way, la cuota fair es la referencia).
 * Exigimos edge = pModel - pFair >= minEdge  =>  pFair <= pModel - minEdge.
 * La cuota minima que satisface la igualdad es minOdds = 1 / (pModel - minEdge).
 * Devuelve Infinity si pModel <= minEdge (ninguna cuota finita para: el edge
 * requerido igualaria toda la probabilidad del modelo).
 */
export function calculateMinimumAcceptableOdds(modelProbability: number, minEdge: number): number {
  assertValidProbability(modelProbability, 'modelProbability');
  if (!Number.isFinite(minEdge) || minEdge < 0) {
    throw new Error(`minEdge invalida: ${minEdge} (debe ser >= 0 y finita)`);
  }
  const fairCap = modelProbability - minEdge;
  return fairCap > 0 ? 1 / fairCap : Number.POSITIVE_INFINITY;
}

// Re-export helper de validación de probabilidades para uso interno de la feature.
export function assertValidProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(
      `probabilidad invalida: ${name} = ${value} (debe estar en [0, 1] y ser finita)`,
    );
  }
}
