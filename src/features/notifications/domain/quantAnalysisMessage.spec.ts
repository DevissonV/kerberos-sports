import { formatQuantAnalysisMessage } from './quantAnalysisMessage';
import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';

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
    over: {
      bookmaker: 'pinnacle',
      selection: 'OVER_2_5',
      decimalOdds: 1.86,
      capturedAt: new Date(),
    },
    under: {
      bookmaker: 'pinnacle',
      selection: 'UNDER_2_5',
      decimalOdds: 1.98,
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

it('muestra NO_BET breve, sin stake ejecutable', () => {
  const message = formatQuantAnalysisMessage(analysis);
  expect(message).toContain('Barcelona vs Sevilla');
  expect(message).toContain('⚪ KERBEROS SPORTS — NO APOSTAR');
  expect(message).toContain('MÁS DE 2.5 GOLES');
  expect(message).toContain('💰 Apostar: 0 COP');
  expect(message).not.toContain('Stake sugerido');
});

it('muestra preview como no ejecutable', () => {
  const message = formatQuantAnalysisMessage({ ...analysis, decision: 'BET' });
  expect(message).toContain('👀 PREANÁLISIS — NO APOSTAR TODAVÍA');
  expect(message).toContain('Stake: NO DISPONIBLE');
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
