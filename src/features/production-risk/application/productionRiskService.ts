import {
  applyProductionRisk,
  type ProductionRiskConfig,
  type ProductionRiskDecision,
  type RecommendationForRiskGate,
  type RiskGatedRecommendation,
} from '../domain/productionRiskGate';
import { logger } from '../../../shared/logging/logger';
import type { ProductionRiskStateStore } from '../ports/productionRiskStateStore';

/**
 * Orquesta recomendación → estado durable → gate → reserva. No registra ni ejecuta
 * apuestas contra casas de apuestas: la aprobación solo prepara ejecución manual.
 */
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

  /**
   * Igual que `applyToRecommendation`, pero una decisión APPROVED (o REDUCED con
   * stake > 0) RESERVA duramente slot de abiertas + exposición + stake del día
   * ANTES de presentar la ejecución autorizada (#6). Idempotente por reservationId:
   * llamarlo varias veces para la misma recomendación no duplica la reserva.
   * `reservationId` debe ser la identidad durable de la recomendación (bet id /
   * recommendationId) para que la ejecución del ledger la consuma por el mismo id.
   */
  applyToRecommendationWithReservation<T extends RecommendationForRiskGate>(
    recommendation: T,
    day: string,
    reservationId: string,
  ): RiskGatedRecommendation<T> {
    const gated = this.applyToRecommendation(recommendation, day);
    const decision: ProductionRiskDecision | null = gated.riskDecision;
    if (
      reservationId.length > 0 &&
      decision !== null &&
      (decision.status === 'APPROVED' || decision.status === 'REDUCED') &&
      decision.stakeCop > 0
    ) {
      try {
        this.stateStore.reserveBet({
          id: reservationId,
          day,
          stakeCop: decision.stakeCop,
          operatorApprovalId: reservationId,
          selection: selectionOf(recommendation),
        });
      } catch (cause) {
        // Sin reserva durable no se presenta autorización (fail-closed): el gate
        // pierde el estado y la próxima evaluación devuelve INCOMPLETE_STATE.
        logger.warn('Reserva de riesgo falló', {
          reservationId,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
    return gated;
  }
}

function selectionOf(recommendation: RecommendationForRiskGate): string | undefined {
  const candidate = recommendation as { selection?: unknown };
  return typeof candidate.selection === 'string' ? candidate.selection : undefined;
}
