import { ProductionRiskService } from './productionRiskService';
import { DEFAULT_PRODUCTION_RISK_CONFIG } from '../domain/productionRiskGate';
import type { ProductionRiskStateStore } from '../ports/productionRiskStateStore';

describe('ProductionRiskService', () => {
  it('integra recomendación → estado → suggestedStakeCop final', () => {
    const stateStore: ProductionRiskStateStore = {
      getDailyState: () => ({ betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 }),
      recordManualBet: jest.fn(),
      reserveBet: jest.fn(),
      findManualBet: jest.fn(() => null),
      settleManualBet: jest.fn(),
    };
    const service = new ProductionRiskService(DEFAULT_PRODUCTION_RISK_CONFIG, stateStore);

    expect(
      service.applyToRecommendation({ status: 'BET', suggestedStakeCop: 99_999 }, '2026-09-16'),
    ).toMatchObject({
      status: 'BET',
      suggestedStakeCop: 10_000,
      riskDecision: { reason: 'APPROVED' },
    });
  });

  it('falla cerrado si no puede obtener el estado durable', () => {
    const stateStore: ProductionRiskStateStore = {
      getDailyState: () => {
        throw new Error('SQLite unavailable');
      },
      recordManualBet: jest.fn(),
      reserveBet: jest.fn(),
      findManualBet: jest.fn(() => null),
      settleManualBet: jest.fn(),
    };
    const service = new ProductionRiskService(DEFAULT_PRODUCTION_RISK_CONFIG, stateStore);

    expect(
      service.applyToRecommendation({ status: 'BET', suggestedStakeCop: 10_000 }, '2026-09-16'),
    ).toMatchObject({
      status: 'NO_BET',
      suggestedStakeCop: null,
      riskDecision: { reason: 'INCOMPLETE_STATE' },
    });
  });
});
