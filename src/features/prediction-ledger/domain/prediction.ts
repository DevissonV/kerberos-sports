import { createHash } from 'node:crypto';

export type PredictionStage = 'PREANALYSIS' | 'MARKET_ANALYSIS' | 'BET' | 'NO_BET';
export type PredictionResult = 'PENDING' | 'HIT' | 'MISS' | 'VOID' | 'UNKNOWN';
export type PredictionSelection = 'OVER_2_5' | 'UNDER_2_5';

export interface Prediction {
  predictionId: string;
  fixtureId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  createdAt: Date;
  snapshotAt: Date;
  market: 'OVER_UNDER_2_5';
  selection: PredictionSelection;
  modelProbability: number;
  expectedGoals?: number;
  modelVersion: string;
  strategyVersion: string;
  predictionStage: PredictionStage;
  oddsAtPrediction?: number;
  fairMarketProbability?: number;
  edge?: number;
  ev?: number;
  finalScoreHome?: number;
  finalScoreAway?: number;
  totalGoals?: number;
  result: PredictionResult;
  settledAt?: Date;
  betAuthorized: boolean;
  betExecuted: boolean;
  isPrimary: boolean;
}

/** Identidad de contenido: excluye timestamps y tolera variaciones menores a 0,1 pp. */
export function predictionIdOf(
  prediction: Omit<Prediction, 'predictionId' | 'isPrimary' | 'result'>,
): string {
  const probabilityBand = Math.round(prediction.modelProbability * 1_000);
  const material = [
    prediction.fixtureId,
    prediction.market,
    prediction.modelVersion,
    prediction.predictionStage,
    prediction.selection,
    probabilityBand,
    prediction.oddsAtPrediction ?? '',
    prediction.betAuthorized ? 1 : 0,
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

export function settlePrediction(
  prediction: Prediction,
  score: { home: number; away: number },
  settledAt: Date,
): Prediction {
  const totalGoals = score.home + score.away;
  const hit = prediction.selection === 'OVER_2_5' ? totalGoals >= 3 : totalGoals <= 2;
  return {
    ...prediction,
    finalScoreHome: score.home,
    finalScoreAway: score.away,
    totalGoals,
    result: hit ? 'HIT' : 'MISS',
    settledAt,
  };
}

export function primaryPriority(stage: PredictionStage): number {
  return stage === 'PREANALYSIS' ? 1 : 2;
}
