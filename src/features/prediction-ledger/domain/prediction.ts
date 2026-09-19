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

export interface AttributionRow {
  selection: PredictionSelection;
  modelProbability: number;
  result: PredictionResult;
  finalScoreHome?: number;
  finalScoreAway?: number;
}

/** Evidencia causal de una snapshot del modelo (probabilidades crudas O/U del fixture). */
export interface ModelSnapshotEvidence {
  probabilityOver: number;
  probabilityUnder: number;
}

export type AttributionFix =
  | { type: 'KEEP' }
  /**
   * La fila fue persistida con el lado de mercado (por cuota/edge) y la probabilidad del
   * lado menor; se reconstruye la predicción del modelo con su lado de mayor probabilidad.
   */
  | {
      type: 'REBUILD';
      selection: PredictionSelection;
      modelProbability: number;
      /** Recalculado solo si el marcador final está disponible; si no, se conserva. */
      result?: PredictionResult;
    }
  /** Sin evidencia para reconstruir y probability < 0.50: se excluye de métricas. */
  | { type: 'UNKNOWN' };

const PROB_BAND = 1e-3;

function sameProbability(left: number, right: number): boolean {
  return Math.abs(left - right) <= PROB_BAND;
}

/**
 * Diagnóstico de atribución de una fila del ledger contra la evidencia cruda del modelo
 * para el mismo fixture. No recalcula probabilidades: solo reasigna selection/
 * modelProbability al lado de mayor probabilidad y recalcula el resultado H/M si el
 * marcador final ya está persistido. Puro y determinista.
 */
export function diagnoseAttribution(
  row: AttributionRow,
  evidence: ModelSnapshotEvidence | undefined,
): AttributionFix {
  const correctSelection: PredictionSelection =
    evidence === undefined || evidence.probabilityOver >= evidence.probabilityUnder
      ? 'OVER_2_5'
      : 'UNDER_2_5';
  if (evidence === undefined) {
    // Sin evidencia de reconstruction, un lado atribuido con modelo < 0.50 es
    // incompatible con "selection = lado de mayor probabilidad": UNKNOWN (excluida).
    if (row.modelProbability < 0.5) return { type: 'UNKNOWN' };
    return { type: 'KEEP' };
  }
  const correctProbability = Math.max(evidence.probabilityOver, evidence.probabilityUnder);
  const pOverInRange = sameProbability(row.modelProbability, evidence.probabilityOver);
  const pUnderInRange = sameProbability(row.modelProbability, evidence.probabilityUnder);
  if (
    row.selection === correctSelection &&
    sameProbability(row.modelProbability, correctProbability)
  ) {
    return { type: 'KEEP' };
  }
  // La probabilidad almacenada pertenece a alguna probability cruda del fixture: la fila
  // corresponde a un snapshot real del modelo atribuido al lado equivocado.
  if (pOverInRange || pUnderInRange) {
    const hasFinalScore = row.finalScoreHome !== undefined && row.finalScoreAway !== undefined;
    let result: PredictionResult = 'UNKNOWN';
    if (hasFinalScore) {
      result = computeResultForSelection(correctSelection, {
        home: row.finalScoreHome!,
        away: row.finalScoreAway!,
      });
    } else if (row.result === 'PENDING') {
      result = 'PENDING';
    }
    return {
      type: 'REBUILD',
      selection: correctSelection,
      modelProbability: correctProbability,
      result,
    };
  }
  // Probabilidad que no corresponde a ninguna snapshot conocida: fail-closed.
  return { type: 'KEEP' };
}

/** Resultado del lado elegido según el marcador final (misma regla de `settlePrediction`). */
export function computeResultForSelection(
  selection: PredictionSelection,
  score: { home: number; away: number },
): 'HIT' | 'MISS' {
  const total = score.home + score.away;
  const hit = selection === 'OVER_2_5' ? total >= 3 : total <= 2;
  return hit ? 'HIT' : 'MISS';
}
