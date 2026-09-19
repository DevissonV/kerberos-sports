import { settlePrediction, type Prediction } from './prediction';

function prediction(selection: Prediction['selection']): Prediction {
  return {
    predictionId: 'p1',
    fixtureId: '1',
    league: 'Premier League',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoffAt: new Date('2026-09-18T20:00:00Z'),
    createdAt: new Date('2026-09-18T10:00:00Z'),
    snapshotAt: new Date('2026-09-18T10:00:00Z'),
    market: 'OVER_UNDER_2_5',
    selection,
    modelProbability: 0.6,
    modelVersion: 'poisson-v1',
    strategyVersion: 'KSS-V1-C01',
    predictionStage: 'PREANALYSIS',
    result: 'PENDING',
    betAuthorized: false,
    betExecuted: false,
    isPrimary: true,
  };
}

describe('settlePrediction', () => {
  it.each([
    ['OVER_2_5', 2, 1, 'HIT'],
    ['OVER_2_5', 1, 1, 'MISS'],
    ['UNDER_2_5', 1, 1, 'HIT'],
    ['UNDER_2_5', 2, 1, 'MISS'],
  ] as const)('%s con %d-%d produce %s', (selection, home, away, expected) => {
    const settled = settlePrediction(
      prediction(selection),
      { home, away },
      new Date('2026-09-18T22:00:00Z'),
    );
    expect(settled.result).toBe(expected);
    expect(settled.totalGoals).toBe(home + away);
    expect(settled.finalScoreHome).toBe(home);
    expect(settled.finalScoreAway).toBe(away);
  });
});
