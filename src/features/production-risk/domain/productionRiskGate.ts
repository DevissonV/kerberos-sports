/**
 * Gate determinista para completar el stake de una recomendación manual.
 * No conoce LLM, red, casas de apuestas ni persistencia.
 */

export const MAXIMUM_SUPPORTED_STAKE_COP = 20_000;

export const PRODUCTION_RISK_TIERS = ['BASE', 'ELEVATED', 'HIGH'] as const;

export type ProductionRiskTier = (typeof PRODUCTION_RISK_TIERS)[number];
export type ProductionRiskStatus = 'APPROVED' | 'REDUCED' | 'BLOCKED';
export type ProductionRiskReason =
  | 'APPROVED'
  | 'TIER_NOT_ENABLED'
  | 'DAILY_LOSS_LIMIT'
  | 'MAX_DAILY_EXPOSURE'
  | 'MAX_BETS_PER_DAY'
  | 'MAX_OPEN_BETS'
  | 'MANUAL_PAUSE'
  | 'KILL_SWITCH'
  | 'INCOMPLETE_STATE';

export interface ProductionRiskConfig {
  baseStakeCop: number;
  elevatedStakeCop: number;
  highStakeCop: number;
  maxStakeCop: number;
  maxBetsPerDay: number;
  maxDailyExposureCop: number;
  maxDailyLossCop: number;
  maxOpenBets: number;
  killSwitch: boolean;
  manualPause: boolean;
  enabledTiers: readonly ProductionRiskTier[];
  /** Selección administrativa actual; por defecto BASE. */
  activeTier: ProductionRiskTier;
}

export interface ProductionRiskState {
  betsToday: number;
  dailyExposureCop: number;
  dailyLossCop: number;
  openBets: number;
}

export interface ProductionRiskInput {
  config: ProductionRiskConfig;
  /** Un estado ausente o corrupto bloquea la recomendación. */
  state: ProductionRiskState | null | undefined;
}

export interface ProductionRiskDecision {
  status: ProductionRiskStatus;
  reason: ProductionRiskReason;
  stakeCop: number;
  tier: ProductionRiskTier;
  /** La aprobación no ejecuta nada: requiere confirmación manual externa. */
  manualExecutionRequired: true;
}

/** Contrato estructural compatible con la recomendación de KS-02. */
export interface RecommendationForRiskGate {
  status: 'BET' | 'NO_BET';
  suggestedStakeCop: number | null;
}

export type RiskGatedRecommendation<T extends RecommendationForRiskGate> = Omit<
  T,
  'status' | 'suggestedStakeCop'
> & {
  status: 'BET' | 'NO_BET';
  /** Stake final; siempre nulo cuando la recomendación no puede ser BET. */
  suggestedStakeCop: number | null;
  riskDecision: ProductionRiskDecision | null;
};

export const DEFAULT_PRODUCTION_RISK_CONFIG: ProductionRiskConfig = {
  baseStakeCop: 10_000,
  elevatedStakeCop: 15_000,
  highStakeCop: 20_000,
  maxStakeCop: MAXIMUM_SUPPORTED_STAKE_COP,
  maxBetsPerDay: 3,
  maxDailyExposureCop: 30_000,
  maxDailyLossCop: 30_000,
  maxOpenBets: 2,
  killSwitch: false,
  manualPause: false,
  enabledTiers: ['BASE'],
  activeTier: 'BASE',
};

/** Evalúa límites del día sin depender de rachas, pérdidas previas ni LLM. */
export function evaluateProductionRisk(input: ProductionRiskInput): ProductionRiskDecision {
  assertConfig(input.config);
  const tier = resolveEnabledTier(input.config.activeTier, input.config.enabledTiers);
  if (!isCompleteState(input.state)) return blocked('INCOMPLETE_STATE', tier);

  const requestedStakeCop = stakeForTier(tier, input.config);
  const disabledTier = tier !== input.config.activeTier;
  const blockReason = blockingReason(input.config, input.state);

  if (blockReason !== undefined) return blocked(blockReason, tier);

  const remainingExposureCop = input.config.maxDailyExposureCop - input.state.dailyExposureCop;
  if (remainingExposureCop <= 0) return blocked('MAX_DAILY_EXPOSURE', tier);
  if (remainingExposureCop < requestedStakeCop) {
    return blocked('MAX_DAILY_EXPOSURE', tier);
  }
  if (disabledTier) return decision('REDUCED', 'TIER_NOT_ENABLED', requestedStakeCop, tier);

  return decision('APPROVED', 'APPROVED', requestedStakeCop, tier);
}

/**
 * Completa la recomendación de KS-02 con el único stake autorizado. Ignora por
 * completo su stake de entrada: así un LLM u otra fuente no puede modificarlo.
 */
export function applyProductionRisk<T extends RecommendationForRiskGate>(
  recommendation: T,
  input: ProductionRiskInput,
): RiskGatedRecommendation<T> {
  if (recommendation.status !== 'BET') {
    return { ...recommendation, status: 'NO_BET', suggestedStakeCop: null, riskDecision: null };
  }

  const riskDecision = evaluateProductionRisk(input);
  if (riskDecision.status === 'BLOCKED') {
    return { ...recommendation, status: 'NO_BET', suggestedStakeCop: null, riskDecision };
  }
  return {
    ...recommendation,
    status: 'BET',
    suggestedStakeCop: riskDecision.stakeCop,
    riskDecision,
  };
}

function blockingReason(
  config: ProductionRiskConfig,
  state: ProductionRiskState,
): ProductionRiskReason | undefined {
  if (config.killSwitch) return 'KILL_SWITCH';
  if (config.manualPause) return 'MANUAL_PAUSE';
  if (state.dailyLossCop >= config.maxDailyLossCop) return 'DAILY_LOSS_LIMIT';
  if (state.openBets >= config.maxOpenBets) return 'MAX_OPEN_BETS';
  if (state.betsToday >= config.maxBetsPerDay) return 'MAX_BETS_PER_DAY';
  return undefined;
}

function resolveEnabledTier(
  requestedTier: ProductionRiskTier,
  enabledTiers: readonly ProductionRiskTier[],
): ProductionRiskTier {
  return enabledTiers.includes(requestedTier) ? requestedTier : 'BASE';
}

function stakeForTier(tier: ProductionRiskTier, config: ProductionRiskConfig): number {
  const configuredStake =
    tier === 'BASE'
      ? config.baseStakeCop
      : tier === 'ELEVATED'
        ? config.elevatedStakeCop
        : config.highStakeCop;
  return Math.min(configuredStake, config.maxStakeCop, MAXIMUM_SUPPORTED_STAKE_COP);
}

function blocked(reason: ProductionRiskReason, tier: ProductionRiskTier): ProductionRiskDecision {
  return decision('BLOCKED', reason, 0, tier);
}

function decision(
  status: ProductionRiskStatus,
  reason: ProductionRiskReason,
  stakeCop: number,
  tier: ProductionRiskTier,
): ProductionRiskDecision {
  return { status, reason, stakeCop, tier, manualExecutionRequired: true };
}

function assertConfig(config: ProductionRiskConfig): void {
  const monetaryLimits = [
    config.baseStakeCop,
    config.elevatedStakeCop,
    config.highStakeCop,
    config.maxStakeCop,
    config.maxDailyExposureCop,
    config.maxDailyLossCop,
  ];
  if (monetaryLimits.some((amount) => !Number.isSafeInteger(amount) || amount <= 0)) {
    throw new Error('Los límites COP deben ser enteros positivos seguros');
  }
  if (config.maxStakeCop > MAXIMUM_SUPPORTED_STAKE_COP) {
    throw new Error(`maxStakeCop no puede superar ${MAXIMUM_SUPPORTED_STAKE_COP} COP`);
  }
  if (
    config.baseStakeCop > config.elevatedStakeCop ||
    config.elevatedStakeCop > config.highStakeCop ||
    config.highStakeCop > config.maxStakeCop
  ) {
    throw new Error('Los tiers deben ser crecientes y no superar maxStakeCop');
  }
  if (!Number.isSafeInteger(config.maxBetsPerDay) || config.maxBetsPerDay < 0) {
    throw new Error('maxBetsPerDay debe ser un entero no negativo');
  }
  if (!Number.isSafeInteger(config.maxOpenBets) || config.maxOpenBets < 0) {
    throw new Error('maxOpenBets debe ser un entero no negativo');
  }
  if (!config.enabledTiers.includes('BASE')) {
    throw new Error('BASE debe permanecer habilitado');
  }
}

function isCompleteState(
  state: ProductionRiskState | null | undefined,
): state is ProductionRiskState {
  if (state === null || state === undefined) return false;
  const values = [state.betsToday, state.dailyExposureCop, state.dailyLossCop, state.openBets];
  return values.every((value) => Number.isSafeInteger(value) && value >= 0);
}
