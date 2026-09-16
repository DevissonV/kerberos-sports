import { evaluateRecommendation, type RecommendationInput } from './recommendation';

const now = new Date('2026-09-20T14:00:00Z');

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    recommendationId: 'quant-9001-over',
    fixtureId: '9001',
    league: 'Premier League',
    market: 'OVER_UNDER_2_5',
    selection: 'OVER_2_5',
    observedOdds: 2.05,
    minimumAcceptableOdds: 1.8,
    modelProbability: 0.6,
    fairMarketProbability: 0.55,
    edge: 0.05,
    confidence: 0.7,
    suggestedStakeCop: 10_000,
    expiresAt: new Date('2026-09-20T15:00:00Z'),
    ...overrides,
  };
}

describe('evaluateRecommendation', () => {
  it('emite BET válido, con stake y ejecución MANUAL', () => {
    const result = evaluateRecommendation(input(), now);

    expect(result.status).toBe('BET');
    expect(result.reason).toBeNull();
    expect(result.suggestedStakeCop).toBe(10_000);
    expect(result.executionMode).toBe('MANUAL');
  });

  it('rechaza cuotas inferiores al mínimo', () => {
    const result = evaluateRecommendation(input({ observedOdds: 1.79 }), now);

    expect(result).toMatchObject({
      status: 'NO_BET',
      reason: 'ODDS_TOO_LOW',
      suggestedStakeCop: null,
    });
  });

  it('rechaza una recomendación expirada', () => {
    const result = evaluateRecommendation(input({ expiresAt: now }), now);

    expect(result).toMatchObject({ status: 'NO_BET', reason: 'EXPIRED', suggestedStakeCop: null });
  });

  it('falla cerrado si falta un dato requerido', () => {
    const result = evaluateRecommendation(input({ modelProbability: undefined }), now);

    expect(result).toMatchObject({
      status: 'NO_BET',
      reason: 'INSUFFICIENT_DATA',
      suggestedStakeCop: null,
    });
  });
});
