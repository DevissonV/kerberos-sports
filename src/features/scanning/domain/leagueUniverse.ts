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
export type LeagueCode =
  | 'PREMIER_LEAGUE'
  | 'EFL_CHAMPIONSHIP'
  | 'SCOTTISH_PREMIERSHIP'
  | 'SUPER_LIG'
  | 'MLS'
  | 'LALIGA'
  | 'LIGA_BETPLAY'
  | 'SERIE_A'
  | 'BUNDESLIGA'
  | 'LIGUE_1'
  | 'EREDIVISIE'
  | 'PRIMEIRA_LIGA'
  | 'BELGIAN_PRO_LEAGUE'
  | 'EUROPA_LEAGUE';

export interface LeagueDefinition {
  code: LeagueCode;
  leagueId: number;
  country: string;
  canonicalName: string;
  status: LeagueStatus;
  cohortId: string | null;
  modelVersion: string | null;
  /** Dataset versionado local; `null` mantiene la liga fuera de modelo. */
  historicalDataset: string | null;
  /** Etiqueta humana para canales de operación; los contadores siempre se calculan en runtime. */
  heartbeatLabel: string;
}

/** Universo V1: ligas con histórico/alias/smoke validados y una liga en observación. */
export const LEAGUE_UNIVERSE: readonly LeagueDefinition[] = [
  {
    code: 'EUROPA_LEAGUE',
    leagueId: 3,
    country: 'World',
    canonicalName: 'UEFA Europa League',
    status: 'OBSERVATION_ONLY',
    cohortId: null,
    modelVersion: null,
    historicalDataset: null,
    heartbeatLabel: '🏆 Europa League',
  },
  {
    code: 'PREMIER_LEAGUE',
    leagueId: PROTOCOL_LEAGUE_ID,
    country: PROTOCOL_COUNTRY,
    canonicalName: 'Premier League',
    status: 'MODEL_ENABLED',
    cohortId: PROTOCOL_COHORT_ID,
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'premier-league',
    heartbeatLabel: '🇬🇧 Premier League',
  },
  {
    code: 'LIGA_BETPLAY',
    leagueId: 239,
    country: 'Colombia',
    canonicalName: 'Liga BetPlay',
    status: 'OBSERVATION_ONLY',
    cohortId: null,
    modelVersion: null,
    historicalDataset: null,
    heartbeatLabel: '🇨🇴 Liga BetPlay',
  },
  {
    code: 'LALIGA',
    leagueId: 140,
    country: 'Spain',
    canonicalName: 'LaLiga',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C03-ESP',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'la-liga',
    heartbeatLabel: '🇪🇸 LaLiga',
  },
  {
    code: 'SERIE_A',
    leagueId: 135,
    country: 'Italy',
    canonicalName: 'Serie A',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C04-ITA',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'serie-a',
    heartbeatLabel: '🇮🇹 Serie A',
  },
  {
    code: 'BUNDESLIGA',
    leagueId: 78,
    country: 'Germany',
    canonicalName: 'Bundesliga',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C05-GER',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'bundesliga',
    heartbeatLabel: '🇩🇪 Bundesliga',
  },
  {
    code: 'LIGUE_1',
    leagueId: 61,
    country: 'France',
    canonicalName: 'Ligue 1',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C06-FRA',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'ligue-1',
    heartbeatLabel: '🇫🇷 Ligue 1',
  },
  {
    code: 'EREDIVISIE',
    leagueId: 88,
    country: 'Netherlands',
    canonicalName: 'Eredivisie',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C07-NED',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'eredivisie',
    heartbeatLabel: '🇳🇱 Eredivisie',
  },
  {
    code: 'PRIMEIRA_LIGA',
    leagueId: 94,
    country: 'Portugal',
    canonicalName: 'Primeira Liga',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C08-POR',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'primeira-liga',
    heartbeatLabel: '🇵🇹 Primeira Liga',
  },
  {
    code: 'BELGIAN_PRO_LEAGUE',
    leagueId: 144,
    country: 'Belgium',
    canonicalName: 'Belgian Pro League',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C09-BEL',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'belgian-pro-league',
    heartbeatLabel: '🇧🇪 Pro League',
  },
  {
    code: 'MLS',
    leagueId: 253,
    country: 'USA',
    canonicalName: 'Major League Soccer',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C10-USA',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'mls',
    heartbeatLabel: '🇺🇸 MLS',
  },
  {
    code: 'EFL_CHAMPIONSHIP',
    leagueId: 40,
    country: 'England',
    canonicalName: 'EFL Championship',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C11-ENG2',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'championship',
    heartbeatLabel: '🇬🇧 Championship',
  },
  {
    code: 'SCOTTISH_PREMIERSHIP',
    leagueId: 179,
    country: 'Scotland',
    canonicalName: 'Scottish Premiership',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C12-SCO',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'scottish-premiership',
    heartbeatLabel: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Premiership',
  },
  {
    code: 'SUPER_LIG',
    leagueId: 203,
    country: 'Turkey',
    canonicalName: 'Süper Lig',
    status: 'MODEL_ENABLED',
    cohortId: 'KSS-V1-C13-TUR',
    modelVersion: POISSON_MODEL_VERSION,
    historicalDataset: 'super-lig',
    heartbeatLabel: '🇹🇷 Süper Lig',
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
