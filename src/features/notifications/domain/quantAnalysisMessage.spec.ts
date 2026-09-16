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

it('muestra análisis NO_BET con modelo, mercado y motivo', () => {
  const message = formatQuantAnalysisMessage(analysis);
  expect(message).toContain('🇪🇸 LaLiga');
  expect(message).toContain('Barcelona vs Sevilla');
  expect(message).toContain('⚪ NO BET');
  expect(message).toContain('edge insuficiente');
});
