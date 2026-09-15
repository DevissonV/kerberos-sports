/** Puerto de fixtures/resultados (implementado por API-Football). */

import type { Fixture } from '../domain/concepts';

/** Token de inyección Nest para el puerto (las interfaces TS no existen en runtime). */
export const FIXTURES_PROVIDER = Symbol('FixturesProvider');

export interface FixturesProvider {
  /** Fixtures próximos (pre-match) dentro de la ventana de escaneo. 1 request idealmente. */
  upcomingFixtures(limit: number): Promise<Fixture[]>;
}

export class FixturesProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixturesProviderError';
  }
}
