import { formatQuantAnalysisMessage } from './quantAnalysisMessage';
import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';
import type { AnalystOutput } from '../../llm-analyst/domain/contracts';

const analysis: QuantFixtureAnalysis = {
  fixture: {
    id: '1',
    sport: 'FOOTBALL',
    league: 'LaLiga',
    leagueId: 140,
    country: 'Spain',
    homeTeam: 'Barcelona',
    awayTeam: 'Sevilla',
    kickoffAt: new Date('2026-09-20T19:00:00Z'),
    status: 'NS',
  },
  pair: {
    fixtureId: '1',
    bookmaker: 'pinnacle',
    line: 2.5,
    over: {
      bookmaker: 'pinnacle',
      selection: 'OVER_2_5',
      decimalOdds: 1.86,
      marketId: '1010',
      observedAt: new Date(),
      capturedAt: new Date(),
    },
    under: {
      bookmaker: 'pinnacle',
      selection: 'UNDER_2_5',
      decimalOdds: 1.98,
      marketId: '1010',
      observedAt: new Date(),
      capturedAt: new Date(),
    },
  },
  model: {
    fixtureId: '1',
    modelVersion: 'poisson-v1',
    league: 'LaLiga',
    home: 'Barcelona',
    away: 'Sevilla',
    snapshotAt: new Date(),
    leagueHomeGoalsMean: 1.5,
    leagueAwayGoalsMean: 1.1,
    homeRoleMatches: 10,
    awayRoleMatches: 10,
    lambdaHome: 1.6,
    lambdaAway: 1.1,
    lambdaTotal: 2.7,
    pOver: 0.506,
    pUnder: 0.494,
    dataQuality: [],
  },
  side: {
    selection: 'OVER_2_5',
    bookmaker: 'pinnacle',
    offeredOdds: 1.86,
    modelProbability: 0.506,
    fairMarketProbability: 0.51,
    edge: -0.004,
    expectedValue: -0.059,
    minimumAcceptableOdds: 2.03,
  },
  decision: 'NO_BET',
  reason: 'EDGE',
};

it('muestra NO_BET con identidad completa, sin stake ejecutable', () => {
  const message = formatQuantAnalysisMessage(analysis);
  expect(message).toContain('⚪ NO APOSTAR');
  expect(message).toContain('⚽ Barcelona vs Sevilla');
  expect(message).toContain('🏆 LaLiga');
  expect(message).toContain('📅 20 Sep 2026 · 🕐 2:00 p. m.');
  expect(message).toContain('MÁS DE 2.5 GOLES');
  expect(message).not.toContain('Stake sugerido');
  expect(message).not.toMatch(/\bBET\b/);
});

it('muestra la evaluación de mercado como no ejecutable todavía', () => {
  const message = formatQuantAnalysisMessage({ ...analysis, decision: 'BET' });
  expect(message).toContain('🔎 EVALUANDO CUOTAS');
  expect(message).toContain('⚽ Barcelona vs Sevilla');
  expect(message).toContain('🏆 LaLiga');
  expect(message).toContain('📅 20 Sep 2026 · 🕐 2:00 p. m.');
  expect(message).toContain('💵 EV: -5.9%');
  expect(message).not.toContain('Stake sugerido');
});

it('renderiza contexto sin darle autoridad de apuesta', () => {
  const context: AnalystOutput = {
    fixtureId: '1',
    contextScore: 80,
    priority: 'HIGH',
    alerts: ['lesión por verificar'],
    supportingFactors: ['ritmo reciente'],
    contradictingFactors: [],
    suggestedMarketsToInvestigate: ['BTTS'],
    summary: 'Revisar',
    confidenceInContext: 'MEDIUM',
  };
  const message = formatQuantAnalysisMessage(analysis, context);
  expect(message).toContain('🧠 CONTEXTO KERBEROS');
  expect(message).toContain('Prioridad contextual: HIGH');
  expect(message).toContain('no modifica la probabilidad matemática ni el stake');
  expect(message).not.toContain('finalBetDecision');
});

it('no llama cuota demasiado baja cuando la cuota supera la mínima', () => {
  const message = formatQuantAnalysisMessage({
    ...analysis,
    side: { ...analysis.side!, offeredOdds: 2.3, minimumAcceptableOdds: 1.76 },
    reason: 'ODDS_RANGE',
  });
  expect(message).toContain('cuota fuera del rango permitido (supera el máximo)');
  expect(message).not.toContain('cuota demasiado baja');
});

it('llama cuota demasiado baja solo cuando está por debajo de la mínima', () => {
  const message = formatQuantAnalysisMessage({
    ...analysis,
    side: { ...analysis.side!, offeredOdds: 1.6, minimumAcceptableOdds: 1.76 },
    reason: 'ODDS_RANGE',
  });
  expect(message).toContain('cuota demasiado baja');
});
