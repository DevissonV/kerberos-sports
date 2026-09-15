// Cálculo de stake para modo PAPER. Sin Kelly. Determinista.

export type StakeMode = 'FIXED' | 'PERCENT';

export interface StakeConfig {
  mode: StakeMode;
  /**
   * Monto interpretado según mode:
   * - FIXED: monto absoluto por apuesta (unidades de bankroll).
   * - PERCENT: fracción del bankroll actual como DECIMAL (0.01 = 1%).
   *   Interpretación inequívoca: stake = bankroll * percent; 1 = 100%.
   */
  amount: number;
}

export interface StakeQuote {
  stake: number;
  /** Cuota techo: min(stake propuesto, bankroll, exposición diaria restante). */
  cappedBy: 'NONE' | 'BANKROLL' | 'DAILY_EXPOSURE';
}

/** Clamps aplicados: stake >= 0, <= bankroll, <= expositionRestante si se provee. */
export function calculateStake(
  bankroll: number,
  stakeConfig: StakeConfig,
  maxDailyExposure?: number,
  usedDailyExposure?: number,
): StakeQuote {
  assertPositive(bankroll, 'bankroll');
  assertAmount(stakeConfig.amount, stakeConfig.mode);

  let stake = stakeConfig.mode === 'FIXED' ? stakeConfig.amount : bankroll * stakeConfig.amount;
  let cappedBy: StakeQuote['cappedBy'] = 'NONE';

  if (stake > bankroll) {
    stake = bankroll;
    cappedBy = 'BANKROLL';
  }

  if (maxDailyExposure !== undefined && usedDailyExposure !== undefined) {
    assertNonNegative(maxDailyExposure, 'maxDailyExposure');
    assertNonNegative(usedDailyExposure, 'usedDailyExposure');
    const maxRemaining = maxDailyExposure - usedDailyExposure;
    if (maxRemaining < stake) {
      stake = Math.max(maxRemaining, 0);
      cappedBy = stake < maxRemaining ? cappedBy : 'DAILY_EXPOSURE';
      if (maxRemaining <= 0) {
        return { stake: 0, cappedBy: 'DAILY_EXPOSURE' };
      }
    }
  }

  return { stake, cappedBy };
}

function assertAmount(amount: number, mode: StakeMode): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`amount invalida: ${amount} (debe ser >= 0 y finita)`);
  }
  if (mode === 'PERCENT' && amount > 1) {
    throw new Error(`percent invalido: ${amount} (debe estar en [0, 1]; 0.01 = 1%)`);
  }
}

function assertPositive(n: number, name: string): void {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} invalida: ${n} (debe ser > 0 y finita)`);
  }
}

function assertNonNegative(n: number, name: string): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} invalida: ${n} (debe ser >= 0 y finita)`);
  }
}
