/**
 * Puerto mínimo de resultados para settlement PAPER.
 */

import type { Fixture } from '../domain/concepts';

/** Token de inyección Nest para el puerto (las interfaces TS no existen en runtime). */
export const RESULTS_PROVIDER = Symbol('ResultsProvider');

export interface FixtureResult {
  fixtureId: Fixture['id'];
  status: string;
  /** Goles en tiempo reglamentario (null si el fixture no ha finalizado o fue cancelado). */
  fulltimeHome: number | null;
  fulltimeAway: number | null;
  /** Hora final solo si el proveedor la entrega; nunca se infiere con el reloj local. */
  finishedAt: Date | null;
}

export interface ResultsProvider {
  result(fixtureId: Fixture['id']): Promise<FixtureResult | null>;
}

export class ResultsProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResultsProviderError';
  }
}
