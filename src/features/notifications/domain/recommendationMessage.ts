/** Formatter Telegram para la apuesta autorizada (PAPER, ejecución manual). */

import type { Recommendation } from '../../recommendations/domain/recommendation';
import type { ProductionRiskDecision } from '../../production-risk/domain/productionRiskGate';
import { marketLanguage } from './marketLanguage';
import { formatFixtureIdentity } from './fixtureIdentity';

/** Código corto operable: últimos 6 caracteres del recommendationId, en mayúsculas. */
export function shortRecommendationId(recommendationId: string): string {
  return recommendationId.slice(-6).toUpperCase();
}

const STAKE_TIERS_COP = [10_000, 15_000, 20_000] as const;

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function cop(value: number): string {
  return `${Math.round(value).toLocaleString('es-CO')} COP`;
}

export interface RecommendationMessageOptions {
  expectedValue?: number;
  /** Bankroll REAL leído del ledger manual; nunca se sustituye por el stake PAPER. */
  currentRealBankrollCop: number;
  /** Decisión ya emitida por ProductionRiskService; el formatter no calcula riesgo. */
  riskDecision: ProductionRiskDecision;
  /** Identidad de fixture para la cabecera (equipos, torneo, fecha/hora Bogotá). */
  kickoffAt?: Date;
  competitionName?: string;
}

/** Un NO_BET no genera texto de ejecución ni se puede enviar como pick. */
export function formatRecommendationTelegramMessage(
  recommendation: Recommendation,
  matchName: string,
  options: RecommendationMessageOptions,
): string | null {
  if (
    recommendation.status !== 'BET' ||
    recommendation.league === null ||
    recommendation.market === null ||
    recommendation.selection === null ||
    recommendation.observedOdds === null ||
    recommendation.minimumAcceptableOdds === null ||
    recommendation.modelProbability === null ||
    recommendation.fairMarketProbability === null ||
    recommendation.edge === null ||
    recommendation.confidence === null ||
    recommendation.suggestedStakeCop === null ||
    recommendation.expiresAt === null
  ) {
    return null;
  }

  if (options.riskDecision.status === 'BLOCKED') return null;
  const market = marketLanguage(recommendation.selection);
  const selectedStake = recommendation.suggestedStakeCop;
  const tierLines = STAKE_TIERS_COP.flatMap((stake, index) => {
    const authorized = stake === selectedStake && options.riskDecision.stakeCop === stake;
    const marker = index === 0 ? '🟢' : index === 1 ? '🟡' : '🔴';
    const percentage = (stake / options.currentRealBankrollCop) * 100;
    return [
      `${marker} ${cop(stake)} — ${percentage.toFixed(1)}%`,
      authorized ? '✅ AUTORIZADA' : '🔒 NO AUTORIZADA',
    ];
  });
  const [homeTeam = matchName, , awayTeam = ''] = matchName.split(' vs ');
  const identity = formatFixtureIdentity({
    homeTeam,
    awayTeam,
    league: recommendation.league,
    kickoffAt: options.kickoffAt,
  });

  return [
    '🚨 APUESTA AUTORIZADA',
    '',
    ...identity,
    '',
    `🎯 Mercado: ${market.title}`,
    `👉 En palabras simples: ${market.explanation}`,
    `✅ Ganas con: ${market.winningExamples}`,
    `❌ Pierdes con: ${market.losingExamples}`,
    '',
    '📊 ANÁLISIS KERBEROS',
    '',
    `🧠 Probabilidad Kerberos: ${percent(recommendation.modelProbability)}`,
    `Probabilidad justa mercado: ${percent(recommendation.fairMarketProbability)}`,
    `📈 Ventaja: ${signedPercent(recommendation.edge)} puntos`,
    ...(options.expectedValue === undefined
      ? []
      : [`💵 EV: ${signedPercent(options.expectedValue)}`]),
    '',
    `💰 Cuota actual: ${recommendation.observedOdds.toFixed(2)}`,
    `🎯 Cuota mínima aceptable: ${recommendation.minimumAcceptableOdds.toFixed(2)}`,
    `Si la cuota actual es menor que ${recommendation.minimumAcceptableOdds.toFixed(2)}, NO APUESTES.`,
    '',
    '💰 TAMAÑO DE APUESTA',
    '',
    `Bankroll real actual: ${cop(options.currentRealBankrollCop)}`,
    '',
    ...tierLines,
    '',
    `🛡️ Risk Gate: ${options.riskDecision.status === 'APPROVED' ? 'APROBADO' : 'APROBADO CON REDUCCIÓN'}`,
    `💰 Stake autorizado: ${cop(selectedStake)}`,
    '',
    `🔖 Registro: ${shortRecommendationId(recommendation.recommendationId)}`,
    '',
    '👤 EJECUCIÓN MANUAL',
  ].join('\n');
}
