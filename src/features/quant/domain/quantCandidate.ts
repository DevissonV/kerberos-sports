/**
 * Candidato QUANT y gate de la cohorte KSS-V1-C01 (ver `resources/temp/KSS-PROTOCOL-01.md`
 * secciones 5/6/7). Puro y determinista: sin red, sin reloj, sin decoradores.
 */

import type { OverUnderSelection, OddsPair } from '../../scanning/domain/concepts';
import { FALLBACK_BOOKMAKER, PRIMARY_BOOKMAKER } from '../../scanning/domain/protocol';
import {
  calculateEdge,
  calculateExpectedValuePerUnit,
  calculateMinimumOddsForExpectedValue,
  devigTwoWay,
} from '../../opportunities/domain/marketMath';
import type { PoissonModelOutput } from '../../poisson/domain/concepts';

export const MIN_EDGE = 0.04;
export const MIN_EV = 0.03;
export const MIN_ODDS = 1.7;
export const MAX_ODDS = 2.2;

/** Techos congelados de riesgo (protocolo sección 7): techo de cupo, no obligación. */
export const INITIAL_BANKROLL = 1000;
export const STAKE_PERCENT = 0.01;
export const MAX_BETS_PER_DAY = 10;
/** % del bankroll expuesto por día. */
export const MAX_DAILY_EXPOSURE_PERCENT = 0.1;

export interface QuantGateConfig {
  minEdge: number;
  minEv: number;
  minOdds: number;
  maxOdds: number;
}

/** Evaluación del gate de un lado (Over o Under 2.5) del par contra el modelo. */
export interface QuantSideEvaluation {
  selection: OverUnderSelection;
  bookmaker: string;
  offeredOdds: number;
  modelProbability: number;
  fairMarketProbability: number;
  /** Decimal interno: 0.04 = 4 puntos porcentuales. */
  edge: number;
  expectedValue: number;
  /** Cuota mínima aceptable: (1 + MIN_EV) / modelProbability. */
  minimumAcceptableOdds: number;
}

export type QuantRejectReason = 'NO_BOOKMAKER' | 'EDGE' | 'EV' | 'ODDS_RANGE';

export type QuantSideResult =
  | { status: 'REJECTED'; reason: QuantRejectReason }
  | { status: 'SELECTED'; side: QuantSideEvaluation };

/**
 * Evalúa independiente y simétricamente ambos lados del par O/U 2.5 contra el
 * modelo, y selecciona el de MEJOR edge (con edges complementarios, es el único
 * lado con edge a favor). No fuerza selección: si ningún lado pasa el gate, no
 * hay candidato y el motivo reportado es el del lado de mejor edge.
 * De-vig SOLO con Over y Under del MISMO bookmaker (por construcción de
 * `OddsPair`); nunca se mezclan Pinnacle y Bet365, ni dentro del par ni entre pares.
 */
export function evaluateQuantPair(
  model: PoissonModelOutput,
  pair: OddsPair,
  config: QuantGateConfig = {
    minEdge: MIN_EDGE,
    minEv: MIN_EV,
    minOdds: MIN_ODDS,
    maxOdds: MAX_ODDS,
  },
): QuantSideResult {
  const bookmaker = pair.bookmaker.toLowerCase();
  if (bookmaker !== PRIMARY_BOOKMAKER && bookmaker !== FALLBACK_BOOKMAKER) {
    return { status: 'REJECTED', reason: 'NO_BOOKMAKER' };
  }
  const fair = devigTwoWay(pair.over.decimalOdds, pair.under.decimalOdds);
  const over = evaluateSide(model, pair, 'OVER_2_5', pair.over.decimalOdds, fair.pOverFair);
  const under = evaluateSide(model, pair, 'UNDER_2_5', pair.under.decimalOdds, fair.pUnderFair);
  if (under.edge > over.edge) return selectOrReject(under, config);
  return selectOrReject(over, config);
}

function selectOrReject(side: QuantSideEvaluation, config: QuantGateConfig): QuantSideResult {
  if (side.edge < config.minEdge) return { status: 'REJECTED', reason: 'EDGE' };
  if (side.expectedValue < config.minEv) return { status: 'REJECTED', reason: 'EV' };
  if (side.offeredOdds < config.minOdds || side.offeredOdds > config.maxOdds) {
    return { status: 'REJECTED', reason: 'ODDS_RANGE' };
  }
  return { status: 'SELECTED', side };
}

function evaluateSide(
  model: PoissonModelOutput,
  pair: OddsPair,
  selection: OverUnderSelection,
  offeredOdds: number,
  fairMarketProbability: number,
): QuantSideEvaluation {
  const modelProbability =
    selection === 'OVER_2_5'
      ? assertModelProbability(model.pOver)
      : assertModelProbability(model.pUnder);
  const edge = calculateEdge(modelProbability, fairMarketProbability);
  const expectedValue = calculateExpectedValuePerUnit(modelProbability, offeredOdds);
  const minimumAcceptableOdds = calculateMinimumOddsForExpectedValue(modelProbability, MIN_EV);
  return {
    selection,
    bookmaker: pair.bookmaker,
    offeredOdds,
    modelProbability,
    fairMarketProbability,
    edge,
    expectedValue,
    minimumAcceptableOdds,
  };
}

function assertModelProbability(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`probabilidad del modelo invalida: ${value}`);
  }
  return value;
}
