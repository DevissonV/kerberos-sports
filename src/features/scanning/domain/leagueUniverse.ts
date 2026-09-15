/**
 * Universo de ligas de Kerberos: desacopla "ligas que se pueden DESCUBRIR/OBSERVAR" de
 * "ligas con modelo validado que pueden generar PaperBet". Solo la cohorte KSS-V1-C01
 * (Premier League inglesa) está `MODEL_ENABLED`; el resto del universo V1 queda
 * `OBSERVATION_ONLY` (fixtures/odds visibles, nunca Poisson/QUANT/PaperBet). Whitelist por
 * `leagueId`+`country` (nunca por nombre): cualquier liga fuera de esta lista (copas,
 * selecciones, youth/reserve, women's, friendlies, SRL) queda `EXCLUDED` por omisión,
 * fail-closed. Puro y determinista: sin red, sin reloj.
 */

import {
  PROTOCOL_COHORT_ID,
  PROTOCOL_LEAGUE_ID,
  PROTOCOL_COUNTRY,
  evaluateCompetitionSafety,
} from './protocol';
import { POISSON_MODEL_VERSION } from '../../poisson/domain/concepts';
import type { Fixture } from './concepts';

export type LeagueStatus = 'DISCOVERED' | 'OBSERVATION_ONLY' | 'MODEL_ENABLED' | 'EXCLUDED';

export interface LeagueDefinition {
  leagueId: number;
  country: string;
  canonicalName: string;
  status: LeagueStatus;
  cohortId: string | null;
  modelVersion: string | null;
  /** Dataset versionado local; `null` mantiene la liga fuera de modelo. */
  historicalDataset: string | null;
}

/** Universo V1: 1 liga con modelo validado + 6 ligas en observación pura. */
export const LEAGUE_UNIVERSE: readonly LeagueDefinition[] = [
  {
    leagueId: PROTOCOL_LEAGUE_ID,
    country: PROTOCOL_COUNTRY,
    canonicalName: 'Premier League',
    status: 'MODEL_ENABLED',
    cohortId: PROTOCOL_COHORT_ID,
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'premier-league',
  },
  {
    leagueId: 239,
    country: 'Colombia',
    canonicalName: 'Liga BetPlay',
    status: 'OBSERVATION_ONLY',
    cohortId: null,
    modelVersion: null,
    historicalDataset: null,
  },
  {
    leagueId: 140,
    country: 'Spain',
    canonicalName: 'LaLiga',
    status: 'OBSERVATION_ONLY',
    cohortId: 'KSS-V1-C03-ESP',
    modelVersion: null,
    historicalDataset: 'la-liga',
  },
  {
    leagueId: 135,
    country: 'Italy',
    canonicalName: 'Serie A',
    status: 'OBSERVATION_ONLY',
    cohortId: 'KSS-V1-C04-ITA',
    modelVersion: null,
    historicalDataset: 'serie-a',
  },
  {
    leagueId: 78,
    country: 'Germany',
    canonicalName: 'Bundesliga',
    status: 'OBSERVATION_ONLY',
    cohortId: 'KSS-V1-C05-GER',
    modelVersion: null,
    historicalDataset: 'bundesliga',
  },
  {
    leagueId: 61,
    country: 'France',
    canonicalName: 'Ligue 1',
    status: 'OBSERVATION_ONLY',
    cohortId: 'KSS-V1-C06-FRA',
    modelVersion: null,
    historicalDataset: 'ligue-1',
  },
  {
    leagueId: 88,
    country: 'Netherlands',
    canonicalName: 'Eredivisie',
    status: 'OBSERVATION_ONLY',
    cohortId: 'KSS-V1-C07-NED',
    modelVersion: null,
    historicalDataset: 'eredivisie',
  },
];

type LeagueLookupFixture = Pick<Fixture, 'leagueId' | 'country'>;

export function findLeagueDefinition(fixture: LeagueLookupFixture): LeagueDefinition | undefined {
  if (fixture.leagueId === undefined || fixture.country === undefined) return undefined;
  return LEAGUE_UNIVERSE.find(
    (league) => league.leagueId === fixture.leagueId && league.country === fixture.country,
  );
}

/** Fail-closed: liga desconocida, sin `leagueId`/`country`, o fuera del universo => `EXCLUDED`. */
export function resolveLeagueStatus(fixture: LeagueLookupFixture): LeagueStatus {
  return findLeagueDefinition(fixture)?.status ?? 'EXCLUDED';
}

/** `true` si el fixture pertenece a una liga del universo V1 (observación o modelo). */
export function isObservable(fixture: LeagueLookupFixture): boolean {
  const status = resolveLeagueStatus(fixture);
  return status === 'OBSERVATION_ONLY' || status === 'MODEL_ENABLED';
}

/**
 * Gate de modelo: `true` solo si la liga está `MODEL_ENABLED` en el universo Y el fixture
 * también pasa las exclusiones de defensa en profundidad de `protocol.ts` (cup/youth/reserve
 * por nombre, aunque comparta `leagueId`+`country`). Fail-closed en ambas capas.
 */
export function isModelEnabled(
  fixture: Pick<Fixture, 'leagueId' | 'country' | 'league' | 'homeTeam' | 'awayTeam'>,
): boolean {
  if (resolveLeagueStatus(fixture) !== 'MODEL_ENABLED') return false;
  return evaluateCompetitionSafety(fixture) === null;
}

export interface LeagueFixtureCount {
  leagueId: number;
  canonicalName: string;
  status: LeagueStatus;
  fixturesDetected: number;
}

/** Agrupa fixtures ya observables por liga, en el orden fijo de `LEAGUE_UNIVERSE`. */
export function summarizeFixturesByLeague(
  fixtures: readonly LeagueLookupFixture[],
): LeagueFixtureCount[] {
  return LEAGUE_UNIVERSE.map((league) => ({
    leagueId: league.leagueId,
    canonicalName: league.canonicalName,
    status: league.status,
    fixturesDetected: fixtures.filter(
      (fixture) => fixture.leagueId === league.leagueId && fixture.country === league.country,
    ).length,
  }));
}
