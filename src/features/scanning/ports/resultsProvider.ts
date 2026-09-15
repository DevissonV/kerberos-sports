/**
 * Puerto mínimo de resultados (settlement), aún SIN adapter ni registro en `scanning.module.ts`.
 * API-Football expone `goals`/`score.fulltime` en tiempo reglamentario para fixtures `FT`
 * (verificado con la API real, ver `resources/temp/KSS-DATA-GATE-01-handoff.md`), pero
 * `ApiFootballFixturesAdapter` no los consume todavía. Se deja el contrato aquí para no
 * bloquear la siguiente tarea de settlement; implementar el adapter es trabajo separado
 * (fuera de alcance de KSS-PIPELINE-PROTOCOL-01: "NO implementar settlement completo").
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
