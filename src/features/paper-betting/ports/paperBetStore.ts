import type { PaperBet, PaperBetStatus } from '../domain/concepts';

/** Token de inyección Nest para el puerto (las interfaces TS no existen en runtime). */
export const PAPER_BET_STORE = Symbol('PaperBetStore');

/** Clave de idempotencia: ninguna estrategia debe insertar la misma apuesta dos veces. */
export interface PaperBetKey {
  cohortId: string;
  fixtureId: number;
  market: string;
  selection: string;
  modelVersion: string;
}

/**
 * Puerto de persistencia local del ciclo PAPER (adaptador SQLite local, I/O síncrono).
 * El dominio no sabe nada de SQLite ni de SQL.
 */
export interface PaperBetStore {
  /**
   * Persiste una apuesta ANTES del kickoff. Rechaza (DuplicatePaperBetError)
   * si ya existe una con la misma clave de idempotencia.
   */
  save(bet: PaperBet): void;
  findById(id: string): PaperBet | null;
  /** Busca por clave de idempotencia; null si no existe aún. */
  findByIdempotencyKey(key: PaperBetKey): PaperBet | null;
  /** Apuestas filtradas por estado. */
  listByStatus(status: PaperBetStatus): PaperBet[];
  /**
   * Resuelve una apuesta OPEN. Persiste settledAt/result/closingOdds/pnl.
   * Lanza AlreadySettledError (dominio) si ya estaba resuelta.
   */
  settle(
    id: string,
    outcome: 'WON' | 'LOST' | 'VOID',
    opts?: { closingOdds?: number; result?: string },
  ): PaperBet;
}

/** La misma (cohortId, fixtureId, market, selection, modelVersion) ya existe: rechazada. */
export class DuplicatePaperBetError extends Error {
  readonly key: PaperBetKey;
  constructor(key: PaperBetKey) {
    super(
      `PaperBet duplicada para cohort=${key.cohortId} fixture=${key.fixtureId} market=${key.market} selection=${key.selection} model=${key.modelVersion}`,
    );
    this.name = 'DuplicatePaperBetError';
    this.key = key;
  }
}
