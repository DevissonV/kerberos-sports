import type { Prediction, PredictionSelection } from './prediction';

export interface PredictionMetrics {
  settledPredictions: number;
  hits: number;
  misses: number;
  hitRate: number;
  brierScore: number;
  logLoss: number;
}

export interface ProbabilityBucket extends PredictionMetrics {
  label: string;
  sampleLabel: string;
}

export function sampleSizeLabel(size: number): string {
  if (size < 20) return 'Muestra muy pequeña';
  if (size < 50) return 'Muestra preliminar';
  if (size < 100) return 'Muestra en formación';
  return 'Muestra útil para análisis inicial';
}

export function calculatePredictionMetrics(predictions: readonly Prediction[]): PredictionMetrics {
  const settled = predictions.filter(
    (prediction) =>
      prediction.isPrimary && (prediction.result === 'HIT' || prediction.result === 'MISS'),
  );
  const hits = settled.filter((prediction) => prediction.result === 'HIT').length;
  const misses = settled.length - hits;
  const brier = settled.reduce((sum, prediction) => {
    const outcome = prediction.result === 'HIT' ? 1 : 0;
    return sum + (prediction.modelProbability - outcome) ** 2;
  }, 0);
  const logLoss = settled.reduce((sum, prediction) => {
    const outcome = prediction.result === 'HIT' ? 1 : 0;
    const probability = Math.min(Math.max(prediction.modelProbability, 1e-12), 1 - 1e-12);
    return sum - (outcome * Math.log(probability) + (1 - outcome) * Math.log(1 - probability));
  }, 0);
  return {
    settledPredictions: settled.length,
    hits,
    misses,
    hitRate: settled.length === 0 ? 0 : hits / settled.length,
    brierScore: settled.length === 0 ? 0 : brier / settled.length,
    logLoss: settled.length === 0 ? 0 : logLoss / settled.length,
  };
}

const BUCKETS = [
  { label: '50–54.99%', min: 0.5, max: 0.55 },
  { label: '55–59.99%', min: 0.55, max: 0.6 },
  { label: '60–64.99%', min: 0.6, max: 0.65 },
  { label: '65–69.99%', min: 0.65, max: 0.7 },
  { label: '70%+', min: 0.7, max: Infinity },
] as const;

export function metricsByProbabilityBucket(
  predictions: readonly Prediction[],
): readonly ProbabilityBucket[] {
  return BUCKETS.map((bucket) => {
    const metrics = calculatePredictionMetrics(
      predictions.filter(
        (prediction) =>
          prediction.modelProbability >= bucket.min && prediction.modelProbability < bucket.max,
      ),
    );
    return {
      label: bucket.label,
      ...metrics,
      sampleLabel: sampleSizeLabel(metrics.settledPredictions),
    };
  });
}

export function metricsBySelection(
  predictions: readonly Prediction[],
  selection: PredictionSelection,
): PredictionMetrics {
  return calculatePredictionMetrics(
    predictions.filter((prediction) => prediction.selection === selection),
  );
}

export function metricsByLeague(
  predictions: readonly Prediction[],
): Readonly<Record<string, PredictionMetrics>> {
  const leagues = new Set(predictions.map((prediction) => prediction.league));
  return Object.fromEntries(
    [...leagues].map((league) => [
      league,
      calculatePredictionMetrics(predictions.filter((prediction) => prediction.league === league)),
    ]),
  );
}
