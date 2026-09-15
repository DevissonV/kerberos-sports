// Selección (gate) de oportunidades Over/Under 2.5 en modo PAPER.

import type { StakeQuote } from '../../bankroll/domain/stake';
import { calculateStake } from '../../bankroll/domain/stake';
import type { TotalSelection } from './scope';
import { assertValidProbability } from './marketMath';

export interface CandidateOpportunity {
  fixtureId: string;
  selection: TotalSelection;
  /** Cuota decimal ofertada por el mercado (ej. bookmaker objetivo). */
  decimalOdds: number;
  modelProbability: number;
  fairMarketProbability: number;
  /** Debe ser modelProbability - fairMarketProbability. */
  edge: number;
  /** Debe ser p * (odds - 1) - (1 - p). */
  expectedValue: number;
}

export interface GateConfig {
  bankroll: number;
  minEdge: number;
  minOdds: number;
  maxOdds: number;
  /** TECHO del plan, no valla obligatoria: solo se apuesta si el candidato pasa edge/risk. */
  maxBetsPerDay: number;
  maxDailyExposure: number;
  stakeMode: 'FIXED' | 'PERCENT';
  stakeAmount: number;
}

export interface AcceptedOpportunity {
  fixtureId: string;
  selection: TotalSelection;
  decimalOdds: number;
  edge: number;
  stake: number;
  /** Auditoría: por qué el stake quedó por debajo del propuesto (NONE = sin cap). */
  cappedBy: StakeQuote['cappedBy'];
}

export interface GateResult {
  accepted: AcceptedOpportunity[];
  rejected: Array<{ candidate: CandidateOpportunity; reason: string }>;
  totalStaked: number;
  usedDailyExposure: number;
}

export function selectOpportunities(
  candidates: readonly CandidateOpportunity[],
  gateConfig: GateConfig,
): GateResult {
  assertGateConfig(gateConfig);

  const rejected: GateResult['rejected'] = [];
  const valid = candidates.filter((c) => {
    const reason = staticInvalidReason(c, gateConfig);
    if (reason) {
      rejected.push({ candidate: c, reason });
      return false;
    }
    return true;
  });

  valid.sort((a, b) => b.edge - a.edge);

  const accepted: AcceptedOpportunity[] = [];
  let usedExposure = 0;

  for (const candidate of valid) {
    if (accepted.length >= gateConfig.maxBetsPerDay) break;

    const quote = calculateStake(
      gateConfig.bankroll,
      { mode: gateConfig.stakeMode, amount: gateConfig.stakeAmount },
      gateConfig.maxDailyExposure,
      usedExposure,
    );

    if (quote.stake <= 0) {
      rejected.push({ candidate, reason: 'exposure diaria agotada' });
      continue;
    }

    accepted.push({
      fixtureId: candidate.fixtureId,
      selection: candidate.selection,
      decimalOdds: candidate.decimalOdds,
      edge: candidate.edge,
      stake: quote.stake,
      cappedBy: quote.cappedBy,
    });
    usedExposure += quote.stake;
  }

  return {
    accepted,
    rejected: rejected,
    totalStaked: usedExposure,
    usedDailyExposure: usedExposure,
  };
}

function staticInvalidReason(candidate: CandidateOpportunity, cfg: GateConfig): string | undefined {
  if (
    !Number.isFinite(candidate.modelProbability) ||
    !Number.isFinite(candidate.fairMarketProbability)
  ) {
    return 'probabilidades no finitas';
  }
  if (!Number.isFinite(candidate.edge) || !Number.isFinite(candidate.expectedValue)) {
    return 'edge/EV no finitos';
  }
  if (candidate.fixtureId.length === 0) {
    return 'fixtureId vacio';
  }
  try {
    assertValidProbability(candidate.modelProbability, 'modelProbability');
    assertValidProbability(candidate.fairMarketProbability, 'fairMarketProbability');
  } catch (error) {
    return error instanceof Error ? error.message : 'probabilidad invalida';
  }
  if (!Number.isFinite(candidate.decimalOdds) || candidate.decimalOdds <= 1) {
    return 'odds invalida (<= 1 o no finita)';
  }
  if (candidate.decimalOdds < cfg.minOdds || candidate.decimalOdds > cfg.maxOdds) {
    return `odds fuera de rango [${cfg.minOdds}, ${cfg.maxOdds}]`;
  }
  if (candidate.edge < cfg.minEdge) {
    return `edge ${candidate.edge} < MIN_EDGE ${cfg.minEdge}`;
  }
  return undefined;
}

function assertGateConfig(cfg: GateConfig): void {
  if (!Number.isFinite(cfg.bankroll) || cfg.bankroll <= 0) {
    throw new Error(`bankroll invalido: ${cfg.bankroll}`);
  }
  if (!Number.isFinite(cfg.minEdge) || cfg.minEdge < 0) {
    throw new Error(`minEdge invalido: ${cfg.minEdge}`);
  }
  if (!Number.isFinite(cfg.minOdds) || !Number.isFinite(cfg.maxOdds) || cfg.minOdds > cfg.maxOdds) {
    throw new Error(`rango de odds invalido: [${cfg.minOdds}, ${cfg.maxOdds}]`);
  }
  if (!Number.isFinite(cfg.maxBetsPerDay) || cfg.maxBetsPerDay < 0) {
    throw new Error(`maxBetsPerDay invalido: ${cfg.maxBetsPerDay}`);
  }
  if (!Number.isFinite(cfg.maxDailyExposure) || cfg.maxDailyExposure < 0) {
    throw new Error(`maxDailyExposure invalido: ${cfg.maxDailyExposure}`);
  }
}
