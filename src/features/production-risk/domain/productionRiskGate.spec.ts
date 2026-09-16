import {
  applyProductionRisk,
  DEFAULT_PRODUCTION_RISK_CONFIG,
  MAXIMUM_SUPPORTED_STAKE_COP,
  evaluateProductionRisk,
  type ProductionRiskState,
} from './productionRiskGate';

const clearState: ProductionRiskState = {
  betsToday: 0,
  dailyExposureCop: 0,
  dailyLossCop: 0,
  openBets: 0,
};

describe('production risk gate', () => {
  it('usa el tier BASE de 10.000 COP por defecto', () => {
    expect(
      evaluateProductionRisk({ config: DEFAULT_PRODUCTION_RISK_CONFIG, state: clearState }),
    ).toMatchObject({ status: 'APPROVED', reason: 'APPROVED', stakeCop: 10_000 });
  });

  it('autoriza el tier ELEVATED de 15.000 COP solo cuando está habilitado', () => {
    const decision = evaluateProductionRisk({
      config: {
        ...DEFAULT_PRODUCTION_RISK_CONFIG,
        enabledTiers: ['BASE', 'ELEVATED'],
        activeTier: 'ELEVATED',
      },
      state: clearState,
    });
    expect(decision.stakeCop).toBe(15_000);
  });

  it('autoriza el tier HIGH de 20.000 COP solo cuando está habilitado', () => {
    const decision = evaluateProductionRisk({
      config: {
        ...DEFAULT_PRODUCTION_RISK_CONFIG,
        enabledTiers: ['BASE', 'ELEVATED', 'HIGH'],
        activeTier: 'HIGH',
      },
      state: clearState,
    });
    expect(decision.stakeCop).toBe(20_000);
  });

  it('aplica maxStakeCop al stake final', () => {
    const decision = evaluateProductionRisk({
      config: {
        ...DEFAULT_PRODUCTION_RISK_CONFIG,
        elevatedStakeCop: 10_000,
        highStakeCop: 10_000,
        maxStakeCop: 10_000,
      },
      state: clearState,
    });
    expect(decision.stakeCop).toBe(10_000);
    expect(decision.stakeCop).toBeLessThanOrEqual(MAXIMUM_SUPPORTED_STAKE_COP);
  });

  it.each([
    ['MAX_DAILY_EXPOSURE', { dailyExposureCop: 30_000 }],
    ['MAX_DAILY_EXPOSURE', { dailyExposureCop: 25_000 }],
    ['MAX_BETS_PER_DAY', { betsToday: 3 }],
    ['MAX_OPEN_BETS', { openBets: 2 }],
    ['DAILY_LOSS_LIMIT', { dailyLossCop: 30_000 }],
  ] as const)('bloquea por %s', (reason, partialState) => {
    const decision = evaluateProductionRisk({
      config: DEFAULT_PRODUCTION_RISK_CONFIG,
      state: { ...clearState, ...partialState },
    });
    expect(decision).toMatchObject({ status: 'BLOCKED', reason, stakeCop: 0 });
  });

  it.each(['manualPause', 'killSwitch'] as const)('bloquea con %s', (flag) => {
    const decision = evaluateProductionRisk({
      config: { ...DEFAULT_PRODUCTION_RISK_CONFIG, [flag]: true },
      state: clearState,
    });
    expect(decision).toMatchObject({
      status: 'BLOCKED',
      reason: flag === 'manualPause' ? 'MANUAL_PAUSE' : 'KILL_SWITCH',
      stakeCop: 0,
    });
  });

  it('no aumenta el stake después de una pérdida: no hay martingala ni recovery stake', () => {
    const decision = evaluateProductionRisk({
      config: DEFAULT_PRODUCTION_RISK_CONFIG,
      state: { ...clearState, dailyLossCop: 5_000 },
    });
    expect(decision.stakeCop).toBe(10_000);
  });

  it('ignora el stake de KS-02/LLM y completa uno determinista', () => {
    const result = applyProductionRisk(
      { status: 'BET' as const, suggestedStakeCop: 999_999, source: 'llm' },
      { config: DEFAULT_PRODUCTION_RISK_CONFIG, state: clearState },
    );
    expect(result).toMatchObject({ status: 'BET', suggestedStakeCop: 10_000 });
  });

  it('convierte BET en NO_BET cuando el gate bloquea', () => {
    const result = applyProductionRisk(
      { status: 'BET' as const, suggestedStakeCop: 10_000 },
      { config: { ...DEFAULT_PRODUCTION_RISK_CONFIG, manualPause: true }, state: clearState },
    );
    expect(result).toMatchObject({
      status: 'NO_BET',
      suggestedStakeCop: null,
      riskDecision: { reason: 'MANUAL_PAUSE' },
    });
  });

  it('falla cerrado ante estado incompleto', () => {
    const decision = evaluateProductionRisk({
      config: DEFAULT_PRODUCTION_RISK_CONFIG,
      state: { ...clearState, openBets: Number.NaN },
    });
    expect(decision).toMatchObject({ status: 'BLOCKED', reason: 'INCOMPLETE_STATE', stakeCop: 0 });
  });
});
