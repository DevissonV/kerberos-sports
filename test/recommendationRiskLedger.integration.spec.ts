import { SqliteManualLedgerStore } from '../src/features/manual-ledger/adapters/sqliteManualLedgerStore';
import { ManualLedgerService } from '../src/features/manual-ledger/application/manualLedgerService';
import { SqliteProductionRiskStateStore } from '../src/features/production-risk/adapters/sqliteProductionRiskStateStore';
import {
  applyProductionRisk,
  DEFAULT_PRODUCTION_RISK_CONFIG,
  type ProductionRiskConfig,
} from '../src/features/production-risk/domain/productionRiskGate';
import {
  evaluateRecommendation,
  type Recommendation,
  type RecommendationInput,
} from '../src/features/recommendations/domain/recommendation';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const CLEAR_STATE = { betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 };

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    recommendationId: 'rec-1',
    fixtureId: 'fixture-1',
    league: 'England Premier League',
    market: 'OVER_UNDER_2_5',
    selection: 'OVER_2_5',
    observedOdds: 2,
    minimumAcceptableOdds: 1.9,
    modelProbability: 0.6,
    fairMarketProbability: 0.5,
    edge: 0.1,
    confidence: 0.8,
    suggestedStakeCop: 999_999,
    expiresAt: new Date('2026-09-16T18:00:00.000Z'),
    ...overrides,
  };
}

function recommended(overrides: Partial<RecommendationInput> = {}): Recommendation {
  return evaluateRecommendation(input(overrides), NOW);
}

function riskGate(
  recommendation: Recommendation,
  config: ProductionRiskConfig = DEFAULT_PRODUCTION_RISK_CONFIG,
) {
  return applyProductionRisk(recommendation, { config, state: CLEAR_STATE });
}

function ledger(): {
  store: SqliteManualLedgerStore;
  riskStore: SqliteProductionRiskStateStore;
  service: ManualLedgerService;
} {
  const store = new SqliteManualLedgerStore(':memory:');
  const riskStore = new SqliteProductionRiskStateStore(':memory:');
  return { store, riskStore, service: new ManualLedgerService(store, riskStore) };
}

function execute(service: ManualLedgerService, executionId = 'exec-1') {
  return service.execute({
    recommendationId: 'rec-1',
    executionId,
    bookmaker: 'Pinnacle',
    executedOdds: 2,
    executedStakeCop: 10_000,
    executedAt: NOW,
    now: NOW,
  });
}

describe('integración recomendación, riesgo y ledger manual', () => {
  it('A: aprueba una BET válida con stake determinista de 10k y ejecución MANUAL', () => {
    const result = riskGate(recommended());
    expect(result).toMatchObject({
      status: 'BET',
      suggestedStakeCop: 10_000,
      executionMode: 'MANUAL',
      riskDecision: { status: 'APPROVED', manualExecutionRequired: true },
    });
  });

  it('B: convierte cuotas bajas en NO_BET sin stake', () => {
    const result = riskGate(recommended({ observedOdds: 1.8 }));
    expect(result).toMatchObject({
      status: 'NO_BET',
      reason: 'ODDS_TOO_LOW',
      suggestedStakeCop: null,
    });
  });

  it('C: convierte una recomendación expirada en NO_BET', () => {
    const result = riskGate(recommended({ expiresAt: NOW }));
    expect(result).toMatchObject({ status: 'NO_BET', reason: 'EXPIRED', suggestedStakeCop: null });
  });

  it('D: bloquea con manualPause', () => {
    const result = riskGate(recommended(), {
      ...DEFAULT_PRODUCTION_RISK_CONFIG,
      manualPause: true,
    });
    expect(result).toMatchObject({
      status: 'NO_BET',
      suggestedStakeCop: null,
      riskDecision: { reason: 'MANUAL_PAUSE' },
    });
  });

  it('E: bloquea con killSwitch', () => {
    const result = riskGate(recommended(), { ...DEFAULT_PRODUCTION_RISK_CONFIG, killSwitch: true });
    expect(result).toMatchObject({
      status: 'NO_BET',
      suggestedStakeCop: null,
      riskDecision: { reason: 'KILL_SWITCH' },
    });
  });

  it('F: registra la ejecución manual en el ledger', () => {
    const { store, riskStore, service } = ledger();
    try {
      service.initializeRealBankroll(100_000);
      expect(execute(service)).toMatchObject({
        status: 'EXECUTED_MANUALLY',
        recommendationId: 'rec-1',
      });
    } finally {
      store.close();
      riskStore.close();
    }
  });

  it('G: liquida una victoria una sola vez y actualiza el bankroll real', () => {
    const { store, riskStore, service } = ledger();
    try {
      service.initializeRealBankroll(100_000);
      execute(service);
      expect(service.settle({ executionId: 'exec-1', result: 'WIN', now: NOW })).toMatchObject({
        status: 'SETTLED',
        netPnlCop: 10_000,
      });
      expect(service.realBankrollCop()).toBe(110_000);
      expect(() => service.settle({ executionId: 'exec-1', result: 'WIN', now: NOW })).toThrow();
      expect(service.realBankrollCop()).toBe(110_000);
    } finally {
      store.close();
      riskStore.close();
    }
  });

  it('H: liquida una pérdida una sola vez y actualiza el bankroll real', () => {
    const { store, riskStore, service } = ledger();
    try {
      service.initializeRealBankroll(100_000);
      execute(service);
      expect(service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW })).toMatchObject({
        status: 'SETTLED',
        netPnlCop: -10_000,
      });
      expect(service.realBankrollCop()).toBe(90_000);
      expect(() => service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW })).toThrow();
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
      riskStore.close();
    }
  });

  it('I: una RECOMMENDED no ejecutada no altera el bankroll real', () => {
    const { store, riskStore, service } = ledger();
    try {
      service.initializeRealBankroll(100_000);
      expect(service.recommend('rec-1', NOW).status).toBe('RECOMMENDED');
      expect(service.realBankrollCop()).toBe(100_000);
    } finally {
      store.close();
      riskStore.close();
    }
  });

  it('J: el stake de Luna no altera el stake ni el riesgo deterministas', () => {
    const result = riskGate(recommended({ suggestedStakeCop: 999_999 }));
    expect(result).toMatchObject({ status: 'BET', suggestedStakeCop: 10_000 });
  });
});
