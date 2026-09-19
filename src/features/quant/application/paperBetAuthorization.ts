/** Separación H5: PaperBet OPEN nunca es equivalente a una apuesta autorizada. */

import type { PaperBet } from '../../paper-betting/domain/concepts';
import type {
  ProductionRiskDecision,
  RecommendationForRiskGate,
  RiskGatedRecommendation,
} from '../../production-risk/domain/productionRiskGate';

/** Evalúa producción de riesgo para una PaperBet nueva; null = sin gate disponible. */
export type PaperBetRiskGate = (
  bet: PaperBet,
) => RiskGatedRecommendation<RecommendationForRiskGate> | null;

export interface PaperBetAuthorization {
  /**
   * PaperBets con decision explícita del ProductionRiskService (APPROVED/REDUCED):
   * únicas elegibles para mostrarse como REAL_AUTHORIZED_BET (🚨 APUESTA AUTORIZADA).
   */
  authorized: { bet: PaperBet; riskDecision: ProductionRiskDecision }[];
  /** PaperBets simulación o con el gate bloqueado: jamás se presentan como autorizadas. */
  paperOnly: PaperBet[];
}

/**
 * Función pura: particiona las PaperBets creadas en este tick entre autorizadas
 * reales (con decisión explícita del Risk Gate) y señales PAPER. El stake visible
 * como COP autorizado proviene SIEMPRE del riskDecision, nunca de `bet.stake`
 * (que son unidades del bankroll PAPER de simulación).
 */
export function classifyPaperBetAuthorization(
  bets: readonly PaperBet[],
  gate: PaperBetRiskGate,
): PaperBetAuthorization {
  const authorized: { bet: PaperBet; riskDecision: ProductionRiskDecision }[] = [];
  const paperOnly: PaperBet[] = [];
  for (const bet of bets) {
    const gated = gate(bet);
    if (
      gated !== null &&
      gated.status === 'BET' &&
      gated.riskDecision !== null &&
      gated.riskDecision.stakeCop > 0
    ) {
      authorized.push({ bet, riskDecision: gated.riskDecision });
    } else {
      paperOnly.push(bet);
    }
  }
  return { authorized, paperOnly };
}
