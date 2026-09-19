import {
  computeResultForSelection,
  diagnoseAttribution,
  settlePrediction,
  type Prediction,
} from './prediction';

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

describe('diagnoseAttribution (KSS-PREDICTION-ATTRIBUTION-AUDIT-02)', () => {
  it('reconstruye el lado mayor: OVER 65.8% con final 3-0 debe ser HIT', () => {
    const fix = diagnoseAttribution(
      {
        selection: 'UNDER_2_5',
        modelProbability: 0.3415813291594956,
        result: 'MISS',
        finalScoreHome: 3,
        finalScoreAway: 0,
      },
      { probabilityOver: 0.6584186708405044, probabilityUnder: 0.3415813291594956 },
    );
    expect(fix).toEqual({
      type: 'REBUILD',
      selection: 'OVER_2_5',
      modelProbability: 0.6584186708405044,
      result: 'HIT',
    });
  });

  it(' UNDER 54.6% queda intacta y con final 2-1 sigue siendo MISS', () => {
    const row = {
      selection: 'UNDER_2_5' as const,
      modelProbability: 0.5457575167444635,
      result: 'PENDING' as const,
      finalScoreHome: 2,
      finalScoreAway: 1,
    };
    expect(
      diagnoseAttribution(row, {
        probabilityOver: 0.4542424832555365,
        probabilityUnder: 0.5457575167444635,
      }),
    ).toEqual({ type: 'KEEP' });
  });

  it('sin evidencia y probability < 0.50 marca UNKNOWN sin inventar selección', () => {
    expect(
      diagnoseAttribution(
        { selection: 'UNDER_2_5', modelProbability: 0.342, result: 'MISS' },
        undefined,
      ),
    ).toEqual({ type: 'UNKNOWN' });
  });

  it('REBUILD sin marcador final conserva PENDING; ya disputada se marca UNKNOWN', () => {
    expect(
      diagnoseAttribution(
        { selection: 'UNDER_2_5', modelProbability: 0.342, result: 'PENDING' },
        { probabilityOver: 0.658, probabilityUnder: 0.342 },
      ).type,
    ).toBe('REBUILD');
    expect(
      diagnoseAttribution(
        { selection: 'UNDER_2_5', modelProbability: 0.342, result: 'MISS' },
        { probabilityOver: 0.658, probabilityUnder: 0.342 },
      ),
    ).toEqual({
      type: 'REBUILD',
      selection: 'OVER_2_5',
      modelProbability: 0.658,
      result: 'UNKNOWN',
    });
  });

  it('una fila con el lado mayor pero probabilidad del lado opuesto se reconstruye', () => {
    // Inversión selection/probability pura: UNDER con la probabilidad del OVER.
    expect(
      diagnoseAttribution(
        { selection: 'UNDER_2_5', modelProbability: 0.658, result: 'MISS' },
        { probabilityOver: 0.658, probabilityUnder: 0.342 },
      ),
    ).toEqual({
      type: 'REBUILD',
      selection: 'OVER_2_5',
      modelProbability: 0.658,
      result: 'UNKNOWN',
    });
  });

  it('computeResultForSelection reusa la misma regla binaria de settlement', () => {
    expect(computeResultForSelection('OVER_2_5', { home: 3, away: 0 })).toBe('HIT');
    expect(computeResultForSelection('UNDER_2_5', { home: 3, away: 0 })).toBe('MISS');
  });
});
