import { formatRecommendationTelegramMessage } from '../../notifications/domain/recommendationMessage';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import type { ProductionRiskService } from '../../production-risk/application/productionRiskService';
import { recommendationFromQuantBet } from './quantRecommendation';

/** Aplica riesgo antes de convertir una recomendación QUANT en Telegram accionable. */
export function formatQuantPaperMessageFor(
  bet: PaperBet,
  now: Date,
  productionRisk: ProductionRiskService,
): string | null {
  const recommendation = productionRisk.applyToRecommendation(
    recommendationFromQuantBet(bet, now),
    now.toISOString().slice(0, 10),
  );
  return formatRecommendationTelegramMessage(
    recommendation,
    `${bet.homeTeam} vs ${bet.awayTeam}`,
    bet.expectedValue,
  );
}
