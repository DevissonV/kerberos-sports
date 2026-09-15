import { overUnderProbabilities, poissonPmf } from './poissonDistribution';

describe('poissonPmf', () => {
  it('PMF(0, lambda) = e^-lambda', () => {
    expect(poissonPmf(0, 2)).toBeCloseTo(Math.exp(-2));
  });

  it('nunca produce NaN/Infinity para lambdas razonables', () => {
    for (const lambda of [0.1, 1, 2.7, 5, 10]) {
      for (const k of [0, 1, 2, 3]) {
        const value = poissonPmf(k, lambda);
        expect(Number.isFinite(value)).toBe(true);
        expect(Number.isNaN(value)).toBe(false);
      }
    }
  });
});

describe('overUnderProbabilities', () => {
  it('pOver + pUnder ≈ 1 para distintos lambdas', () => {
    for (const lambdaTotal of [0.5, 1.5, 2.5, 3.5, 5]) {
      const { pOver, pUnder } = overUnderProbabilities(lambdaTotal);
      expect(Math.abs(pOver + pUnder - 1)).toBeLessThan(1e-9);
      expect(pOver).toBeGreaterThanOrEqual(0);
      expect(pOver).toBeLessThanOrEqual(1);
      expect(pUnder).toBeGreaterThanOrEqual(0);
      expect(pUnder).toBeLessThanOrEqual(1);
    }
  });

  it('lambda bajo favorece UNDER 2.5', () => {
    const { pOver, pUnder } = overUnderProbabilities(1.0);
    expect(pUnder).toBeGreaterThan(pOver);
  });

  it('lambda alto favorece OVER 2.5', () => {
    const { pOver, pUnder } = overUnderProbabilities(4.5);
    expect(pOver).toBeGreaterThan(pUnder);
  });
});
