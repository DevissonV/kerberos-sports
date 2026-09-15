/**
 * Pipeline QUANT end-to-end (puro): snapshots del scan -> filtro de bookmaker de la
 * cohorte -> Poisson V1 causal -> selección OVER/UNDER -> gate KSS-V1-C01 ->
 * riesgo (stake 1%, techos) -> PaperBets preparadas e idempotencia. Sin red y sin
 * reloj propio: todo entra como parámetro. La persistencia y el Telegram los aplica
 * `QuantScanService` DESPUÉS de este paso (Telegram solo para bets nuevas).
 */

import { calculateStake } from '../../bankroll/domain/stake';
import type { StakeQuote } from '../../bankroll/domain/stake';
import {
  MAX_BETS_PER_DAY,
  MAX_DAILY_EXPOSURE_PERCENT,
  MIN_EDGE,
  MIN_EV,
  MAX_ODDS,
  MIN_ODDS,
  STAKE_PERCENT,
} from '../domain/quantCandidate';
import {
  evaluateQuantPair,
  type QuantGateConfig,
  type QuantSideEvaluation,
} from '../domain/quantCandidate';
import { computePoissonV1 } from '../../poisson/domain/model';
import { POISSON_MODEL_VERSION } from '../../poisson/domain/concepts';
import type { HistoricalMatch, PoissonModelOutput } from '../../poisson/domain/concepts';
import type { OddsPair } from '../../scanning/domain/concepts';
import {
  FALLBACK_BOOKMAKER,
  PRIMARY_BOOKMAKER,
  PROTOCOL_COHORT_ID,
} from '../../scanning/domain/protocol';
import { isModelEnabled } from '../../scanning/domain/leagueUniverse';
import type { ScanCandidate } from '../../scanning/application/scanPipeline';
import type { Fixture } from '../../scanning/domain/concepts';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import type { PaperBetKey } from '../../paper-betting/ports/paperBetStore';

export const QUANT_GATE: QuantGateConfig = {
  minEdge: MIN_EDGE,
  minEv: MIN_EV,
  minOdds: MIN_ODDS,
  maxOdds: MAX_ODDS,
};

const MARKET = 'OVER_UNDER_2_5';

export interface QuantPipelineDeps {
  /** Candidatos del scan ya filtrados por protocolo y ventana temporal (T-6h). */
  candidates: readonly ScanCandidate[];
  historicalMatches: readonly HistoricalMatch[];
  /** Instante de la corrida (UTC): snapshot y createdAt de las PaperBets. */
  now: Date;
  initialBankroll: number;
  openStakesSum: number;
  settledPnlSum: number;
  /** Idempotencia: busca una PaperBet previa por identidad durable (null si no existe). */
  findExistingBet: (key: PaperBetKey) => PaperBet | null;
}

export interface PreparedQuantBet {
  bet: PaperBet;
  side: QuantSideEvaluation;
}

export interface QuantRejectedBuckets {
  /** Liga sin modelo validado (`status !== MODEL_ENABLED`): fail-closed, nunca corre Poisson. */
  LEAGUE_NOT_ENABLED: number;
  MODEL_DATA: number;
  NO_BOOKMAKER: number;
  EDGE: number;
  EV: number;
  ODDS_RANGE: number;
  RISK: number;
}

export interface QuantPipelineResult {
  /** Fixtures con modelo Poisson válido (lambdas y probabilidades O/U). */
  poissonModeled: number;
  /** Fixtures cuyo mejor lado pasa el gate (candidato QUANT). */
  quantCandidates: number;
  /** Fixtures que pasan TODO el gate y el riesgo. */
  passedGate: number;
  prepared: PreparedQuantBet[];
  duplicates: PaperBetKey[];
  rejected: QuantRejectedBuckets;
  /** Shortlist prospectiva para Luna: válida para QUANT, antes de riesgo/PaperBet. */
  shadowShortlist: readonly { candidate: ScanCandidate; expectedValue: number }[];
}

export function runQuantPipeline(deps: QuantPipelineDeps): QuantPipelineResult {
  const rejected: QuantRejectedBuckets = {
    LEAGUE_NOT_ENABLED: 0,
    MODEL_DATA: 0,
    NO_BOOKMAKER: 0,
    EDGE: 0,
    EV: 0,
    ODDS_RANGE: 0,
    RISK: 0,
  };

  // Un fixture = una decisión: si Pinnacle tiene par completo se usa ese; si no,
  // el fallback Bet365. Nunca se mezclan books dentro del par ni entre pares.
  const candidatesByFixture = new Map<string, ScanCandidate>();
  for (const candidate of deps.candidates) candidatesByFixture.set(candidate.fixture.id, candidate);

  let poissonModeled = 0;
  let quantCandidates = 0;
  let passedGate = 0;
  const bucket: QuantGateEntry[] = [];

  for (const candidate of candidatesByFixture.values()) {
    // Model gate (defensa en profundidad): aunque el candidato ya llegó filtrado por
    // `scanPipeline`, esta corrida nunca ejecuta Poisson/QUANT/PaperBet para una liga que
    // no esté MODEL_ENABLED. Fail-closed.
    if (!isModelEnabled(candidate.fixture)) {
      rejected.LEAGUE_NOT_ENABLED += 1;
      continue;
    }
    const pair = choosePair(candidate.pairs);
    if (pair === undefined) {
      rejected.NO_BOOKMAKER += 1;
      continue;
    }
    const poisson = computePoissonV1({
      fixtureId: candidate.fixture.id,
      league: candidate.fixture.league,
      home: candidate.fixture.homeTeam,
      away: candidate.fixture.awayTeam,
      snapshotAt: candidate.snapshotAt,
      historicalMatches: deps.historicalMatches,
    });
    if (poisson.status !== 'OK') {
      rejected.MODEL_DATA += 1;
      continue;
    }
    poissonModeled += 1;
    const evaluation = evaluateQuantPair(poisson.output, pair, QUANT_GATE);
    if (evaluation.status === 'REJECTED') {
      rejected[evaluation.reason] += 1;
      continue;
    }
    quantCandidates += 1;
    bucket.push({ candidate, pair, model: poisson.output, side: evaluation.side });
  }

  // Idempotencia ANTES de dimensionar stakes: si la bet ya existe no se duplica
  // y (en el servicio) no se reenvía Telegram.
  const duplicates: PaperBetKey[] = [];
  const notDuplicated = bucket.filter((entry) => {
    const key = idempotencyKeyOf(entry.side, entry.candidate.fixture);
    if (deps.findExistingBet(key) !== null) {
      duplicates.push(key);
      return false;
    }
    return true;
  });

  // Riesgo: orden por EV descendente, stake 1% del bankroll ACTUAL (que se
  // contrae por cada stake OPEN), techos congelados. Máximo = cupo, no obligación.
  const riskSorted = [...notDuplicated].sort((a, b) => b.side.expectedValue - a.side.expectedValue);
  const prepared: PreparedQuantBet[] = [];
  let usedExposure = 0;
  for (const entry of riskSorted) {
    if (prepared.length >= MAX_BETS_PER_DAY) {
      rejected.RISK += 1;
      continue;
    }
    const bankrollBefore = currentBankrollFor(deps, usedExposure);
    const maxDailyExposureUnits = bankrollBefore * MAX_DAILY_EXPOSURE_PERCENT;
    const quote = calculateStake(
      bankrollBefore,
      { mode: 'PERCENT', amount: STAKE_PERCENT },
      maxDailyExposureUnits,
      usedExposure,
    );
    if (quote.stake <= 0) {
      rejected.RISK += 1;
      continue;
    }
    usedExposure += quote.stake;
    passedGate += 1;
    prepared.push({
      side: entry.side,
      bet: buildPaperBet(entry, deps.now, quote, bankrollBefore),
    });
  }

  const shadowShortlist = bucket.map((entry) => ({
    candidate: entry.candidate,
    expectedValue: entry.side.expectedValue,
  }));
  return {
    poissonModeled,
    quantCandidates,
    passedGate,
    prepared,
    duplicates,
    rejected,
    shadowShortlist,
  };
}

interface QuantGateEntry {
  candidate: ScanCandidate;
  pair: OddsPair;
  model: PoissonModelOutput;
  side: QuantSideEvaluation;
}

/**
 * Elige el par del bookmaker de la cohorte: Pinnacle si está, si no Bet365.
 * Si el fixture tiene el primario, el fallback se ignora aunque exista, para no
 * mezclar books en la misma decisión.
 */
function choosePair(pairs: readonly OddsPair[]): OddsPair | undefined {
  const primary = pairs.find((pair) => pair.bookmaker.toLowerCase() === PRIMARY_BOOKMAKER);
  if (primary !== undefined) return primary;
  return pairs.find((pair) => pair.bookmaker.toLowerCase() === FALLBACK_BOOKMAKER);
}

function currentBankrollFor(deps: QuantPipelineDeps, newStakesSum: number): number {
  return deps.initialBankroll + deps.settledPnlSum - (deps.openStakesSum + newStakesSum);
}

export function idempotencyKeyOf(side: QuantSideEvaluation, fixture: Fixture): PaperBetKey {
  return {
    cohortId: PROTOCOL_COHORT_ID,
    fixtureId: Number(fixture.id),
    market: MARKET,
    selection: side.selection,
    modelVersion: POISSON_MODEL_VERSION,
  };
}

function buildPaperBet(
  entry: QuantGateEntry,
  now: Date,
  quote: StakeQuote,
  bankrollBefore: number,
): PaperBet {
  const { side, model, candidate, pair } = entry;
  return {
    id: '',
    cohortId: PROTOCOL_COHORT_ID,
    fixtureId: Number(candidate.fixture.id),
    league: candidate.fixture.league,
    homeTeam: candidate.fixture.homeTeam,
    awayTeam: candidate.fixture.awayTeam,
    kickoff: candidate.kickoffAt,
    snapshotAt: candidate.snapshotAt,
    market: MARKET,
    selection: side.selection,
    modelVersion: POISSON_MODEL_VERSION,
    modelProbability: side.modelProbability,
    fairMarketProbability: side.fairMarketProbability,
    edge: side.edge,
    expectedValue: side.expectedValue,
    bookmaker: pair.bookmaker,
    placedOdds: side.offeredOdds,
    minimumAcceptableOdds: side.minimumAcceptableOdds,
    lambdaHome: model.lambdaHome,
    lambdaAway: model.lambdaAway,
    lambdaTotal: model.lambdaTotal,
    stake: quote.stake,
    bankrollBefore,
    status: 'OPEN',
    createdAt: now,
  };
}
