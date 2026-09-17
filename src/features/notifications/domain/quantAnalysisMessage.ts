import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';
import { findLeagueDefinition } from '../../scanning/domain/leagueUniverse';
import { marketLanguage } from './marketLanguage';
import type { AnalystOutput } from '../../llm-analyst/domain/contracts';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Presenta una decisión sin convertir un análisis en una instrucción de ejecución. */
export function formatQuantAnalysisMessage(
  analysis: QuantFixtureAnalysis,
  context?: AnalystOutput,
): string | null {
  if (analysis.side === undefined) return null;
  const league = findLeagueDefinition(analysis.fixture)?.heartbeatLabel ?? analysis.fixture.league;
  const market = marketLanguage(analysis.side.selection);
  if (analysis.decision === 'BET') {
    return [
      '👀 PREANÁLISIS — NO APOSTAR TODAVÍA',
      '',
      league,
      `${analysis.fixture.homeTeam} vs ${analysis.fixture.awayTeam}`,
      '',
      market.title,
      market.explanation,
      '',
      `Probabilidad Kerberos: ${percent(analysis.side.modelProbability)}`,
      'Stake: NO DISPONIBLE',
      'Próxima revisión: T-6',
      ...formatAnalystContext(context),
    ].join('\n');
  }
  return [
    '⚪ KERBEROS SPORTS — NO APOSTAR',
    '',
    `${analysis.fixture.homeTeam} vs ${analysis.fixture.awayTeam}`,
    '',
    'Mercado analizado:',
    market.title,
    `= ${market.explanation.charAt(0).toLowerCase()}${market.explanation.slice(1)}`,
    '',
    '❌ NO APOSTAR',
    '',
    `Motivo: ${reasonLabel(analysis.reason, analysis.side)}`,
    '',
    `Cuota actual: ${analysis.side.offeredOdds.toFixed(2)}`,
    `Cuota mínima: ${analysis.side.minimumAcceptableOdds.toFixed(2)}`,
    '',
    '💰 Apostar: 0 COP',
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
