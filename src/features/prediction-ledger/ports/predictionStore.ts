import type { Prediction } from '../domain/prediction';

export const PREDICTION_STORE = Symbol('PredictionStore');

export interface PredictionStore {
  save(prediction: Omit<Prediction, 'predictionId' | 'isPrimary' | 'result'>): Prediction;
  list(): readonly Prediction[];
  listPendingPrimary(before: Date): readonly Prediction[];
  settle(prediction: Prediction): Prediction;
  void(predictionId: string, settledAt: Date): Prediction;
  claimEvent(eventId: string, fingerprint: string, now: Date): boolean;
  /** Libera un claim de evento cuyo envío falló, para permitir reintento. */
  releaseEvent(eventId: string, fingerprint: string): void;
  claimDailyReport(dayBogota: string, now: Date): boolean;
  releaseDailyReport(dayBogota: string): void;
  close(): void;
}
