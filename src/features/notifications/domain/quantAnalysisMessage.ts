import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';
import { marketLanguage } from './marketLanguage';
import { formatFixtureIdentity } from './fixtureIdentity';
import type { AnalystOutput } from '../../llm-analyst/domain/contracts';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatQuantAnalysisMessage(
  analysis: QuantFixtureAnalysis,
  context?: AnalystOutput,
): string | null {
  if (analysis.side === undefined) return null;
  const market = marketLanguage(analysis.side.selection);
  const identity = formatFixtureIdentity({
    homeTeam: analysis.fixture.homeTeam,
    awayTeam: analysis.fixture.awayTeam,
    league: analysis.fixture.league,
    leagueId: analysis.fixture.leagueId,
    country: analysis.fixture.country,
    kickoffAt: analysis.fixture.kickoffAt,
  });
  if (analysis.decision === 'BET') {
    return [
      '🔎 EVALUANDO CUOTAS',
      '',
      ...identity,
      '',
      `🎯 Predicción: ${market.title}`,
      `🧠 Kerberos: ${percent(analysis.side.modelProbability)}`,
      `💰 Cuota: ${analysis.side.offeredOdds.toFixed(2)}`,
      `🎯 Cuota mínima: ${analysis.side.minimumAcceptableOdds.toFixed(2)}`,
      `📈 Edge: ${analysis.side.edge >= 0 ? '+' : ''}${(analysis.side.edge * 100).toFixed(1)} pp`,
      `💵 EV: ${analysis.side.expectedValue >= 0 ? '+' : ''}${(analysis.side.expectedValue * 100).toFixed(1)}%`,
      '',
      '⚠️ Espera la autorización de riesgo antes de actuar.',
      ...formatAnalystContext(context),
    ].join('\n');
  }
  return [
    '⚪ NO APOSTAR',
    '',
    ...identity,
    '',
    `🎯 Mercado: ${market.title}`,
    `🧠 Probabilidad Kerberos: ${percent(analysis.side.modelProbability)}`,
    `💰 Cuota observada: ${analysis.side.offeredOdds.toFixed(2)}`,
    '',
    '📌 Motivo:',
    reasonLabel(analysis.reason, analysis.side),
    '',
    '⚠️ Todavía no es una apuesta aprobada.',
    ...formatAnalystContext(context),
  ].join('\n');
}

function formatAnalystContext(context: AnalystOutput | undefined): string[] {
  if (context === undefined) return [];
  return [
    '',
    '🧠 CONTEXTO KERBEROS',
    ...context.supportingFactors.slice(0, 2).map((factor) => `• ${factor}`),
    ...context.alerts.slice(0, 2).map((alert) => `⚠️ ${alert}`),
    `Prioridad contextual: ${context.priority}`,
    '⚠️ El contexto no modifica la probabilidad matemática ni el stake.',
  ];
}

function reasonLabel(
  reason: QuantFixtureAnalysis['reason'],
  side: QuantFixtureAnalysis['side'],
): string {
  switch (reason) {
    case 'EDGE':
      return 'ventaja insuficiente';
    case 'EV':
      return 'valor esperado insuficiente';
    case 'ODDS_RANGE':
      if (side !== undefined && side.offeredOdds < side.minimumAcceptableOdds)
        return 'cuota demasiado baja';
      return 'cuota fuera del rango permitido (supera el máximo)';
    case 'RISK':
      return 'límite de riesgo alcanzado';
    default:
      return 'datos insuficientes';
  }
}
