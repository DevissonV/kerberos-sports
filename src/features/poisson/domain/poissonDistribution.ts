/**
 * Distribución de Poisson y probabilidades Over/Under 2.5 (protocolo sección 5/8).
 */

function factorial(k: number): number {
  let result = 1;
  for (let i = 2; i <= k; i += 1) result *= i;
  return result;
}

/** P(X = k) para X ~ Poisson(lambda). */
export function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

export interface OverUnderProbabilities {
  pOver: number;
  pUnder: number;
}

/**
 * `P(UNDER 2.5) = PMF(0) + PMF(1) + PMF(2)`, `P(OVER 2.5) = 1 - P(UNDER 2.5)`.
 */
export function overUnderProbabilities(lambdaTotal: number): OverUnderProbabilities {
  const pUnder =
    poissonPmf(0, lambdaTotal) + poissonPmf(1, lambdaTotal) + poissonPmf(2, lambdaTotal);
  const pOver = 1 - pUnder;
  return { pOver, pUnder };
}
