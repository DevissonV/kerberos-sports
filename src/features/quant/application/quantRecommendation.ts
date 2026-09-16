/** Puente puro entre el resultado QUANT ya aprobado y su contrato de recomendación. */

import {
  DECISION_WINDOW_TOLERANCE_MINUTES,
  decisionAtFromKickoff,
} from '../../scanning/domain/decisionWindow';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import {
  evaluateRecommendation,
  type Recommendation,
} from '../../recommendations/domain/recommendation';

/**
 * La confianza expresa magnitud de edge sobre el mínimo de cohorte, acotada para
 * no comunicar certeza absoluta. No interviene en el gate ni en el stake.
 */
export function confidenceForQuantEdge(edge: number): number {
  return Math.min(0.95, Math.max(0.5, 0.5 + edge));
}

export function recommendationFromQuantBet(bet: PaperBet, now: Date): Recommendation {
  const expiresAt = new Date(
    decisionAtFromKickoff(bet.kickoff).getTime() + DECISION_WINDOW_TOLERANCE_MINUTES * 60_000,
  );
  return evaluateRecommendation(
    {
      recommendationId: bet.id,
      fixtureId: String(bet.fixtureId),
      league: bet.league,
      market: bet.market,
      selection: bet.selection as 'OVER_2_5' | 'UNDER_2_5',
      observedOdds: bet.placedOdds,
      minimumAcceptableOdds: bet.minimumAcceptableOdds,
      modelProbability: bet.modelProbability,
      fairMarketProbability: bet.fairMarketProbability,
      edge: bet.edge,
      confidence: confidenceForQuantEdge(bet.edge),
      suggestedStakeCop: bet.stake,
      expiresAt,
    },
    now,
  );
}
