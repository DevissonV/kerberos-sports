import type { AppConfig } from '../../../shared/config/configuration';
import type { ProductionRiskConfig, ProductionRiskTier } from '../domain/productionRiskGate';

/** Convierte la configuración del proceso en el contrato puro del gate. */
export function productionRiskConfigFromAppConfig(appConfig: AppConfig): ProductionRiskConfig {
  return productionRiskConfigFromValues(appConfig.productionRisk);
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

function enabledTiers(enableElevated: boolean, enableHigh: boolean): readonly ProductionRiskTier[] {
  const tiers: ProductionRiskTier[] = ['BASE'];
  if (enableElevated) tiers.push('ELEVATED');
  if (enableHigh) tiers.push('HIGH');
  return tiers;
}
