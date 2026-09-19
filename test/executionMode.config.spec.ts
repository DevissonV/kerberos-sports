import { createConfig, resolveExecutionMode } from '../src/shared/config/configuration';

describe('EXECUTION_MODE', () => {
  const REAL_KEYS = [
    'REAL_BANKROLL_COP',
    'REAL_MAX_STAKE_COP',
    'REAL_MAX_DAILY_EXPOSURE_COP',
    'REAL_MAX_DAILY_LOSS_COP',
    'REAL_MAX_OPEN_BETS',
  ];
  const snapshot = { ...process.env };

  beforeEach(() => {
    delete process.env.EXECUTION_MODE;
    for (const key of REAL_KEYS) delete process.env[key];
  });

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('default seguro PAPER sin límites de dinero real', () => {
    const fresh = createConfig();
    expect(fresh.executionMode).toBe('PAPER');
    expect(fresh.realBankrollCop).toBeUndefined();
  });

  it('REAL_MANUAL con límites configurados se acepta y los expone', () => {
    process.env.EXECUTION_MODE = 'REAL_MANUAL';
    process.env.REAL_BANKROLL_COP = '100000';
    process.env.REAL_MAX_STAKE_COP = '10000';
    process.env.REAL_MAX_DAILY_EXPOSURE_COP = '30000';
    process.env.REAL_MAX_DAILY_LOSS_COP = '30000';
    process.env.REAL_MAX_OPEN_BETS = '2';
    const fresh = createConfig();
    expect(fresh.executionMode).toBe('REAL_MANUAL');
    expect(fresh.realBankrollCop).toBe(100_000);
    expect(fresh.realMaxStakeCop).toBe(10_000);
    expect(fresh.realMaxOpenBets).toBe(2);
  });

  it('REAL_MANUAL sin límites reales falla cerrado', () => {
    process.env.EXECUTION_MODE = 'REAL_MANUAL';
    expect(() => createConfig()).toThrow('REAL_MANUAL exige configurar');
  });

  it('REAL_AUTOMATED no existe como modo (fail-closed)', () => {
    process.env.EXECUTION_MODE = 'REAL_AUTOMATED';
    expect(() => resolveExecutionMode()).toThrow('ejecución automática está prohibida');
  });

  it('un valor ilegal no llega a crear config destructiva', () => {
    process.env.EXECUTION_MODE = 'PAPER_ONLY';
    expect(() => resolveExecutionMode()).toThrow('EXECUTION_MODE inválida');
  });
});
