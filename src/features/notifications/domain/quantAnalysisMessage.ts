import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';
import { findLeagueDefinition } from '../../scanning/domain/leagueUniverse';

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signed(value: number, suffix: string): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}${suffix}`;
}

/** Presenta una decisión QUANT, incluida la evidencia `NO_BET`, sin conocer Telegram. */
export function formatQuantAnalysisMessage(analysis: QuantFixtureAnalysis): string | null {
  if (analysis.side === undefined) return null;
  const league = findLeagueDefinition(analysis.fixture)?.heartbeatLabel ?? analysis.fixture.league;
  const reason =
    analysis.decision === 'BET' ? 'criterios QUANT satisfechos' : reasonLabel(analysis.reason);
  return [
    '⚽ KERBEROS SPORTS',
    '',
    league,
    `${analysis.fixture.homeTeam} vs ${analysis.fixture.awayTeam}`,
    '',
    '📊 Análisis O/U 2.5',
    '',
    'Kerberos:',
    `Over: ${percent(analysis.model.pOver)}`,
    `Under: ${percent(analysis.model.pUnder)}`,
    '',
    `Mercado (${analysis.pair.bookmaker}):`,
    `Over @ ${analysis.pair.over.decimalOdds.toFixed(2)}`,
    `Under @ ${analysis.pair.under.decimalOdds.toFixed(2)}`,
    '',
    'Probabilidad justa mercado:',
    `Over: ${percent(1 / analysis.pair.over.decimalOdds / (1 / analysis.pair.over.decimalOdds + 1 / analysis.pair.under.decimalOdds))}`,
    `Under: ${percent(1 / analysis.pair.under.decimalOdds / (1 / analysis.pair.over.decimalOdds + 1 / analysis.pair.under.decimalOdds))}`,
    '',
    `Edge (${analysis.side.selection === 'OVER_2_5' ? 'Over' : 'Under'}): ${signed(analysis.side.edge, ' pp')}`,
    `EV: ${signed(analysis.side.expectedValue, '%')}`,
    '',
    `Resultado: ${analysis.decision === 'BET' ? '✅ BET' : '⚪ NO BET'}`,
    `Motivo: ${reason}`,
    '',
    '🧪 PAPER ONLY',
  ].join('\n');
}

function reasonLabel(reason: QuantFixtureAnalysis['reason']): string {
  switch (reason) {
    case 'EDGE':
      return 'edge insuficiente';
    case 'EV':
      return 'EV insuficiente';
    case 'ODDS_RANGE':
      return 'cuota fuera de rango';
    case 'RISK':
      return 'límite PAPER de exposición';
    default:
      return 'datos insuficientes';
  }
}
