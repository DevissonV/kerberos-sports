/** Puerto de cuotas Over/Under 2.5 (implementado por OddsPapi). */

import type { OddsEvent } from '../domain/matching';
import type { OddsPair } from '../domain/concepts';

/** Token de inyección Nest para el puerto (las interfaces TS no existen en runtime). */
export const ODDS_PROVIDER = Symbol('OddsProvider');

export interface OddsProvider {
  /** Eventos próximos con odds disponibles (para matching). */
  upcomingOddsEvents(): Promise<OddsEvent[]>;
  /** Pares over/under 2.5 por evento, priorizando 1xBet sin excluir otros books. */
  overUnderPairs(events: readonly OddsEvent[]): Promise<OddsPair[]>;
}

export class OddsProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OddsProviderError';
  }
}
