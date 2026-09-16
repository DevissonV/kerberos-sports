/** Formatter Telegram neutral para recomendaciones accionables en modo PAPER. */

import type { Recommendation } from '../../recommendations/domain/recommendation';

const SELECTION_LABELS = {
  OVER_2_5: 'OVER 2.5',
  UNDER_2_5: 'UNDER 2.5',
} as const;

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

/** Un NO_BET no genera texto de ejecución ni se puede enviar como pick. */
export function formatRecommendationTelegramMessage(
  recommendation: Recommendation,
  matchName: string,
): string | null {
  if (
    recommendation.status !== 'BET' ||
    recommendation.league === null ||
    recommendation.market === null ||
    recommendation.selection === null ||
    recommendation.observedOdds === null ||
    recommendation.minimumAcceptableOdds === null ||
    recommendation.modelProbability === null ||
    recommendation.edge === null ||
    recommendation.confidence === null ||
    recommendation.suggestedStakeCop === null ||
    recommendation.expiresAt === null
  ) {
    return null;
  }

  return [
    '⚽ KERBEROS SPORTS — PAPER',
    '',
    `Partido: ${matchName}`,
    `Liga: ${recommendation.league}`,
    `Mercado: ${recommendation.market}`,
    `Selección: ${SELECTION_LABELS[recommendation.selection]}`,
    `Cuota actual: ${recommendation.observedOdds.toFixed(2)}`,
    `Cuota mínima: ${recommendation.minimumAcceptableOdds.toFixed(2)}`,
    `Probabilidad Kerberos: ${percent(recommendation.modelProbability)}`,
    `Edge: ${signedPercent(recommendation.edge)}`,
    `Confianza: ${percent(recommendation.confidence)}`,
    `Stake sugerido: COP ${recommendation.suggestedStakeCop.toFixed(0)}`,
    `Vigencia: ${recommendation.expiresAt.toISOString()}`,
    'Motivo: ventaja QUANT validada',
    'EJECUCIÓN: MANUAL',
  ].join('\n');
}
