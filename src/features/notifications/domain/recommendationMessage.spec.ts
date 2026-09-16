import { formatRecommendationTelegramMessage } from './recommendationMessage';
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
  it('incluye todos los datos accionables del BET y ejecución manual', () => {
    expect(formatRecommendationTelegramMessage(recommendation(), 'Arsenal vs Chelsea')).toBe(
      [
        '⚽ KERBEROS SPORTS — PAPER',
        '',
        'Partido: Arsenal vs Chelsea',
        'Liga: Premier League',
        'Mercado: OVER_UNDER_2_5',
        'Selección: OVER 2.5',
        'Cuota actual: 2.05',
        'Cuota mínima: 1.80',
        'Probabilidad Kerberos: 60.0%',
        'Edge: +5.0%',
        'Confianza: 70.0%',
        'Stake sugerido: COP 10000',
        'Vigencia: 2026-09-20T15:00:00.000Z',
        'Motivo: ventaja QUANT validada',
        'EJECUCIÓN: MANUAL',
      ].join('\n'),
    );
  });

  it('no produce instrucción Telegram para NO_BET', () => {
    expect(
      formatRecommendationTelegramMessage(
        recommendation({ status: 'NO_BET', reason: 'EXPIRED', suggestedStakeCop: null }),
        'Arsenal vs Chelsea',
      ),
    ).toBeNull();
  });
});
