import type { AppConfig, ExecutionMode } from '../../../shared/config/configuration';
import type { ProductionRiskConfig, ProductionRiskTier } from '../domain/productionRiskGate';

/** Techo REAL_* declarado por el operador (env); alimenta el gate en REAL_MANUAL. */
export interface RealLimits {
  realMaxStakeCop?: number;
  realMaxDailyExposureCop?: number;
  realMaxDailyLossCop?: number;
  realMaxOpenBets?: number;
}

/** Convierte la configuración del proceso en el contrato puro del gate. */
export function productionRiskConfigFromAppConfig(appConfig: AppConfig): ProductionRiskConfig {
  return productionRiskConfigForExecution(
    appConfig.productionRisk,
    appConfig.executionMode,
    appConfig,
  );
}

/** Config del gate según modo de ejecución: los REAL_* alimentan el gate en REAL_MANUAL. */
export function productionRiskConfigForExecution(
  values: AppConfig['productionRisk'],
  executionMode: ExecutionMode,
  real: RealLimits,
): ProductionRiskConfig {
  const config = productionRiskConfigFromValues(values);
  // H4: en REAL_MANUAL los límites REAL_* de la env SON los del gate, no solo
  // validación de arranque. Nunca elevan un valor: solo aplican el techo más
  // restrictivo entre lo configurado en el gate y el límite REAL declarado.
  return executionMode === 'REAL_MANUAL' ? withRealLimits(config, real) : config;
}

/** Aplica los techos REAL_* sobre el contrato del gate (con clamping de tiers). */
export function withRealLimits(
  config: ProductionRiskConfig,
  real: RealLimits,
): ProductionRiskConfig {
  const maxStakeCop = positiveMin(config.maxStakeCop, real.realMaxStakeCop);
  const clampStake = (stake: number): number => Math.min(stake, maxStakeCop);
  const clamped: ProductionRiskConfig = {
    ...config,
    maxStakeCop,
    baseStakeCop: Math.min(config.baseStakeCop, maxStakeCop),
    elevatedStakeCop: Math.min(config.elevatedStakeCop, maxStakeCop),
    highStakeCop: clampStake(config.highStakeCop),
    maxDailyExposureCop: positiveMin(config.maxDailyExposureCop, real.realMaxDailyExposureCop),
    maxDailyLossCop: positiveMin(config.maxDailyLossCop, real.realMaxDailyLossCop),
    maxOpenBets: positiveMin(config.maxOpenBets, real.realMaxOpenBets),
  };
  return reorderTiers(clamped);
}

export function productionRiskConfigFromValues(
  config: AppConfig['productionRisk'],
): ProductionRiskConfig {
  return {
    baseStakeCop: config.baseStakeCop,
    elevatedStakeCop: config.elevatedStakeCop,
    highStakeCop: config.highStakeCop,
    maxStakeCop: config.maxStakeCop,
    maxBetsPerDay: config.maxBetsPerDay,
    maxDailyExposureCop: config.maxDailyExposureCop,
    maxDailyLossCop: config.maxDailyLossCop,
    maxOpenBets: config.maxOpenBets,
    killSwitch: config.killSwitch,
    manualPause: config.manualPause,
    enabledTiers: enabledTiers(config.enableElevated, config.enableHigh),
    activeTier: config.activeTier,
  };
}

function positiveMin(current: number, cap: number | undefined): number {
  if (cap === undefined || !Number.isSafeInteger(cap) || cap <= 0) return current;
  return Math.min(current, cap);
}

/** El clamping puede desordenar los tiers; el contrato exige orden creciente. */
function reorderTiers(config: ProductionRiskConfig): ProductionRiskConfig {
  const [
    base = config.baseStakeCop,
    elevated = config.elevatedStakeCop,
    high = config.highStakeCop,
  ] = [config.baseStakeCop, config.elevatedStakeCop, config.highStakeCop].sort((a, b) => a - b);
  return { ...config, baseStakeCop: base, elevatedStakeCop: elevated, highStakeCop: high };
}

function enabledTiers(enableElevated: boolean, enableHigh: boolean): readonly ProductionRiskTier[] {
  const tiers: ProductionRiskTier[] = ['BASE'];
  if (enableElevated) tiers.push('ELEVATED');
  if (enableHigh) tiers.push('HIGH');
  return tiers;
}
