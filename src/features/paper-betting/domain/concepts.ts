export type PaperBetStatus = 'OPEN' | 'WON' | 'LOST' | 'VOID';

/** Resultado formalizado del settlement (VOID = marcado anulada, excluida de métricas). */
export type PaperBetOutcome = 'WON' | 'LOST' | 'VOID';

/**
 * Registro completo de una apuesta PAPER persistida.
 * Se graba SIEMPRE antes del kickoff: createdAt < kickoff demuestra que el
 * ciclo estaba congelado antes del partido.
 */
export interface PaperBet {
  id: string;
  /** Cohorte del protocolo congelado (p. ej. KSS-V1-C01). Parte de la identidad durable. */
  cohortId: string;
  fixtureId: number;
  league: string;
  homeTeam: string;
  awayTeam: string;
  /** Inicio del partido (timestamp). */
  kickoff: Date;
  /** Instante de decisión T-6h congelado del snapshot (UTC). */
  snapshotAt: Date;
  /** Mercado (p. ej. MATCH_WINNER). */
  market: string;
  /** Selección apostada (p. ej. HOME, DRAW, AWAY). */
  selection: string;
  /** Versión del modelo que generó la probabilidad (clave de idempotencia). */
  modelVersion: string;
  modelProbability: number;
  /** Probabilidad de mercado sin margen (de-vig). */
  fairMarketProbability: number;
  /** modelProbability - fairMarketProbability. */
  edge: number;
  /** Valor esperado por unidad de stake. */
  expectedValue: number;
  bookmaker: string;
  placedOdds: number;
  /** Cuota mínima aceptada al congelar la apuesta. */
  minimumAcceptableOdds: number;
  /** Goles esperados del modelo Poisson (diagnóstico; odds nunca son feature). */
  lambdaHome: number;
  lambdaAway: number;
  lambdaTotal: number;
  stake: number;
  /** Snapshot del bankroll justo antes de registrar la apuesta. */
  bankrollBefore: number;
  status: PaperBetStatus;
  createdAt: Date;
  settledAt?: Date;
  closingOdds?: number;
  /** Resultado del partido (texto crudo del proveedor, opcional). */
  result?: string;
  finalHomeGoals?: number;
  finalAwayGoals?: number;
  /** PnL realizado: WON -> stake*(odds-1); LOST -> -stake; VOID -> 0. */
  pnl?: number;
  /** Marca durable para no duplicar Telegram después de una segunda corrida. */
  notificationSentAt?: Date;
}

export class PreKickoffViolationError extends Error {
  constructor(createdAt: Date, kickoff: Date) {
    super(
      `PaperBet debe crearse antes del kickoff: createdAt=${createdAt.toISOString()} >= kickoff=${kickoff.toISOString()}`,
    );
    this.name = 'PreKickoffViolationError';
  }
}

/**
 * Regla crítica del ciclo PAPER: la apuesta se congeló ANTES del partido.
 * Determinista: `now` entra como parámetro (sin reloj invisible).
 * Lanza PreKickoffViolationError si now >= kickoff.
 */
export function assertPlacedBeforeKickoff(kickoff: Date, now: Date): void {
  if (now.getTime() >= kickoff.getTime()) {
    throw new PreKickoffViolationError(now, kickoff);
  }
}

export class AlreadySettledError extends Error {
  constructor(betId: string) {
    super(`PaperBet ${betId} ya está resuelta y no admite settlement adicional`);
    this.name = 'AlreadySettledError';
  }
}

/**
 * PnL realizado dado el outcome (determinista, unidad monetaria):
 *   WON  -> stake * (placedOdds - 1)
 *   LOST -> -stake
 *   VOID -> 0 (stake "devuelto": apueste simulado anulado)
 */
export function calculatePnl(outcome: PaperBetOutcome, stake: number, placedOdds: number): number {
  switch (outcome) {
    case 'WON':
      return stake * (placedOdds - 1);
    case 'LOST':
      return -stake;
    case 'VOID':
      return 0;
  }
}
