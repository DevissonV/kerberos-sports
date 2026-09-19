import { calculatePredictionMetrics, metricsByProbabilityBucket, sampleSizeLabel } from './metrics';
import type { Prediction } from './prediction';

const base: Prediction = {
  predictionId: '1',
  fixtureId: '1',
  league: 'A',
  homeTeam: 'H',
  awayTeam: 'A',
  kickoffAt: new Date(),
  createdAt: new Date(),
  snapshotAt: new Date(),
  market: 'OVER_UNDER_2_5',
  selection: 'OVER_2_5',
  modelProbability: 0.6,
  modelVersion: 'v1',
  strategyVersion: 's1',
  predictionStage: 'PREANALYSIS',
  result: 'HIT',
  betAuthorized: false,
  betExecuted: false,
  isPrimary: true,
};

describe('métricas de predicciones', () => {
  it('calcula diario/acumulado, Brier y excluye snapshots no primarios', () => {
    const result = calculatePredictionMetrics([
      base,
      { ...base, predictionId: '2', fixtureId: '2', modelProbability: 0.7, result: 'MISS' },
      { ...base, predictionId: '3', fixtureId: '3', result: 'MISS', isPrimary: false },
      { ...base, predictionId: '4', fixtureId: '4', result: 'PENDING' },
    ]);
    expect(result).toMatchObject({ settledPredictions: 2, hits: 1, misses: 1, hitRate: 0.5 });
    expect(result.brierScore).toBeCloseTo((0.4 ** 2 + 0.7 ** 2) / 2);
  });

  it('agrupa todos los buckets y siempre expone N', () => {
    const buckets = metricsByProbabilityBucket([
      { ...base, modelProbability: 0.5499 },
      { ...base, predictionId: '2', fixtureId: '2', modelProbability: 0.65 },
    ]);
    expect(buckets.map((bucket) => bucket.settledPredictions)).toEqual([1, 0, 0, 1, 0]);
  });

  it.each([
    [0, 'Muestra muy pequeña'],
    [20, 'Muestra preliminar'],
    [50, 'Muestra en formación'],
    [100, 'Muestra útil para análisis inicial'],
  ] as const)('etiqueta N=%d', (n, label) => expect(sampleSizeLabel(n)).toBe(label));
});
