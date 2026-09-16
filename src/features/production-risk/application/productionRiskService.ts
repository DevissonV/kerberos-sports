import {
  applyProductionRisk,
  type ProductionRiskConfig,
  type RecommendationForRiskGate,
  type RiskGatedRecommendation,
} from '../domain/productionRiskGate';
import type { ProductionRiskStateStore } from '../ports/productionRiskStateStore';

/** Orquesta recomendación → estado durable → gate; no registra ni ejecuta apuestas. */
export class ProductionRiskService {
  constructor(
    private readonly config: ProductionRiskConfig,
    private readonly stateStore: ProductionRiskStateStore,
  ) {}

  applyToRecommendation<T extends RecommendationForRiskGate>(
    recommendation: T,
    day: string,
  ): RiskGatedRecommendation<T> {
    try {
      return applyProductionRisk(recommendation, {
        config: this.config,
        state: this.stateStore.getDailyState(day),
      });
    } catch {
      return applyProductionRisk(recommendation, {
        config: this.config,
        state: undefined,
      });
    }
  }
}
