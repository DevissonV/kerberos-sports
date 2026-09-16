/**
 * Contrato productivo de una recomendación. Es una decisión PAPER y manual:
 * este dominio no conoce casas de apuestas, red ni persistencia.
 */

import type { OverUnderSelection } from '../../scanning/domain/concepts';

export type RecommendationStatus = 'BET' | 'NO_BET';
export type NoBetReason = 'ODDS_TOO_LOW' | 'EXPIRED' | 'INSUFFICIENT_DATA';
export type ExecutionMode = 'MANUAL';

export interface Recommendation {
  recommendationId: string;
  fixtureId: string;
  league: string | null;
  market: string | null;
  selection: OverUnderSelection | null;
  observedOdds: number | null;
  minimumAcceptableOdds: number | null;
  modelProbability: number | null;
  fairMarketProbability: number | null;
  edge: number | null;
  /** Escala [0, 1], donde 1 representa la mayor convicción del modelo. */
  confidence: number | null;
  suggestedStakeCop: number | null;
  expiresAt: Date | null;
  executionMode: ExecutionMode;
  status: RecommendationStatus;
  reason: NoBetReason | null;
}

export interface RecommendationInput {
  recommendationId: string;
  fixtureId: string;
  league?: string;
  market?: string;
  selection?: OverUnderSelection;
  observedOdds?: number;
  minimumAcceptableOdds?: number;
  modelProbability?: number;
  fairMarketProbability?: number;
  edge?: number;
  confidence?: number;
  suggestedStakeCop?: number;
  expiresAt?: Date;
}

/**
 * Decide de forma fail-closed. Un NO_BET jamás conserva stake, por lo que no
 * puede convertirse accidentalmente en una instrucción ejecutable.
 */
export function evaluateRecommendation(input: RecommendationInput, now: Date): Recommendation {
  const base = normalize(input);
  if (!hasRequiredData(base)) return noBet(base, 'INSUFFICIENT_DATA');
  if (base.observedOdds < base.minimumAcceptableOdds) return noBet(base, 'ODDS_TOO_LOW');
  if (now.getTime() >= base.expiresAt.getTime()) return noBet(base, 'EXPIRED');

  return {
    ...base,
    suggestedStakeCop: base.suggestedStakeCop,
    executionMode: 'MANUAL',
    status: 'BET',
    reason: null,
  };
}

type NormalizedRecommendation = Omit<Recommendation, 'executionMode' | 'status' | 'reason'>;

function normalize(input: RecommendationInput): NormalizedRecommendation {
  return {
    recommendationId: input.recommendationId,
    fixtureId: input.fixtureId,
    league: input.league ?? null,
    market: input.market ?? null,
    selection: input.selection ?? null,
    observedOdds: input.observedOdds ?? null,
    minimumAcceptableOdds: input.minimumAcceptableOdds ?? null,
    modelProbability: input.modelProbability ?? null,
    fairMarketProbability: input.fairMarketProbability ?? null,
    edge: input.edge ?? null,
    confidence: input.confidence ?? null,
    suggestedStakeCop: input.suggestedStakeCop ?? null,
    expiresAt: input.expiresAt ?? null,
  };
}

type CompleteRecommendation = NormalizedRecommendation & {
  league: string;
  market: string;
  selection: OverUnderSelection;
  observedOdds: number;
  minimumAcceptableOdds: number;
  modelProbability: number;
  fairMarketProbability: number;
  edge: number;
  confidence: number;
  suggestedStakeCop: number;
  expiresAt: Date;
};

function hasRequiredData(value: NormalizedRecommendation): value is CompleteRecommendation {
  return (
    value.recommendationId.length > 0 &&
    value.fixtureId.length > 0 &&
    value.league !== null &&
    value.market !== null &&
    value.selection !== null &&
    isPositive(value.observedOdds) &&
    isPositive(value.minimumAcceptableOdds) &&
    isProbability(value.modelProbability) &&
    isProbability(value.fairMarketProbability) &&
    isFiniteNumber(value.edge) &&
    isProbability(value.confidence) &&
    isPositive(value.suggestedStakeCop) &&
    value.expiresAt !== null &&
    !Number.isNaN(value.expiresAt.getTime())
  );
}

function isPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function isProbability(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function noBet(base: NormalizedRecommendation, reason: NoBetReason): Recommendation {
  return {
    ...base,
    suggestedStakeCop: null,
    executionMode: 'MANUAL',
    status: 'NO_BET',
    reason,
  };
}
