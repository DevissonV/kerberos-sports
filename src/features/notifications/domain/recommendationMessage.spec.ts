import {
  formatRecommendationTelegramMessage,
  type RecommendationMessageOptions,
} from './recommendationMessage';
import type { Recommendation } from '../../recommendations/domain/recommendation';

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    recommendationId: 'quant-9001-over',
    fixtureId: 'Arsenal vs Chelsea',
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
    executionMode: 'MANUAL',
    status: 'BET',
    reason: null,
    ...overrides,
  };
}

describe('formatRecommendationTelegramMessage', () => {
  const options: RecommendationMessageOptions = {
    expectedValue: 0.2,
    currentRealBankrollCop: 500_000,
    riskDecision: {
      status: 'APPROVED',
      reason: 'APPROVED',
      stakeCop: 10_000,
      tier: 'BASE',
      manualExecutionRequired: true,
    },
  };

  it('traduce OVER, explica resultado y muestra los tres tiers con porcentajes reales', () => {
    const message = formatRecommendationTelegramMessage(
      recommendation(),
      'Arsenal vs Chelsea',
      options,
    );
    expect(message).toContain('MÁS DE 2.5 GOLES');
    expect(message).toContain('3 goles o más');
    expect(message).toContain('✅ Ganas con: 2-1, 1-2, 3-0, 2-2, 3-1');
    expect(message).toContain('❌ Pierdes con: 0-0, 1-0, 0-1, 1-1, 2-0');
    expect(message).toContain('🟢 10.000 COP — 2.0%\n✅ AUTORIZADA');
    expect(message).toContain('🟡 15.000 COP — 3.0%\n🔒 NO AUTORIZADA');
    expect(message).toContain('🔴 20.000 COP — 4.0%\n🔒 NO AUTORIZADA');
    expect(message).toContain('🚨 APUESTA AUTORIZADA');
    expect(message).toContain('💰 Stake autorizado: 10.000 COP');
    expect(message).toContain('👤 EJECUCIÓN MANUAL');
  });

  it('traduce UNDER y solo autoriza el stake emitido por el Risk Gate', () => {
    const message = formatRecommendationTelegramMessage(
      recommendation({ selection: 'UNDER_2_5', suggestedStakeCop: 15_000 }),
      'Arsenal vs Chelsea',
      { ...options, riskDecision: { ...options.riskDecision, stakeCop: 15_000, tier: 'ELEVATED' } },
    );
    expect(message).toContain('MENOS DE 2.5 GOLES');
    expect(message).toContain('2 goles o menos');
    expect(message).toContain('🟡 15.000 COP — 3.0%\n✅ AUTORIZADA');
  });

  it('no produce instrucción Telegram para NO_BET', () => {
    expect(
      formatRecommendationTelegramMessage(
        recommendation({ status: 'NO_BET', reason: 'EXPIRED', suggestedStakeCop: null }),
        'Arsenal vs Chelsea',
        options,
      ),
    ).toBeNull();
  });
});
