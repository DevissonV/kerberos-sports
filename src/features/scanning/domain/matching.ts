/**
 * Matching entre fixtures (API-Football) y eventos de odds (OddsPapi).
 * Estrategia: equipos normalizados + kickoff con tolerancia + liga cuando existe.
 * Si no hay confianza, el evento se rechaza: NUNCA se inventan asociaciones.
 */

import type { Fixture } from './concepts';
import { normalizeTeamName } from './normalization';
import { aggressiveTeamKey, isReserveTeam, tokenSubsetCompatible } from './normalization';

/** Tolerancia de kickoff en minutos (horarios de proveedores suelen diferir levemente). */
export const KICKOFF_TOLERANCE_MINUTES = 30;

export interface OddsEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  league?: string;
  /** ID numérico del torneo en el proveedor de odds (para consultas batch). */
  tournamentId?: number;
}

export type MatchStatus = 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS';

export interface MatchResult {
  status: MatchStatus;
  /** Fixture casado (solo si MATCHED). */
  fixture?: Fixture;
  /** Evento de odds implicado (siempre presente). */
  oddsEvent: OddsEvent;
  reason?: string;
}

interface PairKey {
  home: string;
  away: string;
}

function pairKey(homeTeam: string, awayTeam: string): PairKey {
  return { home: aggressiveTeamKey(homeTeam), away: aggressiveTeamKey(awayTeam) };
}

function samePair(a: PairKey, b: PairKey): boolean {
  return a.home === b.home && a.away === b.away;
}

/**
 * Coincidencia por subset de tokens (ej: "Sandviken" ~ "Sandvikens IF",
 * "Grasshoppers" ~ "Grasshopper Club Zurich"). Fail-closed: solo si ningun lado
 * es equipo filial y la coincidencia es de un solo token por lado.
 */
function pairCompatible(a: PairKey, b: PairKey): boolean {
  return (
    !isReserveTeam(a.home) &&
    !isReserveTeam(a.away) &&
    !isReserveTeam(b.home) &&
    !isReserveTeam(b.away) &&
    ((subsetPair(a.home, b.home) && subsetPair(a.away, b.away)) ||
      (subsetPair(b.home, a.home) && subsetPair(b.away, a.away)))
  );
}

function subsetPair(x: string, y: string): boolean {
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short === long || tokenSubsetCompatible(short, long);
}

function samePairSwapped(a: PairKey, b: PairKey): boolean {
  // Localía canónica: solo aceptar swap si el key agresivo de un lado es vacío
  // o si ambos lados coinciden exactamente cruzados (ruido de orden en proveedor).
  return a.home === b.away && a.away === b.home;
}

function kickoffDeltaMinutes(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 60_000;
}

function sameLeague(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return true;
  return normalizeTeamName(a) === normalizeTeamName(b);
}

/**
 * Casa cada evento de odds con a lo sumo un fixture. Reglas:
 * - MATCHED: par de equipos (exacto o subset de tokens sin filiales) Y kickoff
 *   dentro de tolerancia. La liga es desempate, NO requisito (los nombres de
 *   torneo difieren entre proveedores).
 * - AMBIGUOUS: varios fixtures cumplen (no se puede decidir) o el par coincide
 *   cruzado (home/away invertidos): senal de datos poco confiables.
 * - UNMATCHED: ningun fixture cumple; el motivo se clasifica como NAME o KICKOFF.
 */
export function matchFixturesWithOdds(
  fixtures: readonly Fixture[],
  oddsEvents: readonly OddsEvent[],
  options: { now?: Date } = {},
): MatchResult[] {
  void options;
  return oddsEvents.map((oddsEvent) => {
    const key = pairKey(oddsEvent.homeTeam, oddsEvent.awayTeam);

    const exactMatches = fixtures.filter((fixture) => {
      const fixtureKey = pairKey(fixture.homeTeam, fixture.awayTeam);
      return (
        samePair(key, fixtureKey) &&
        kickoffDeltaMinutes(fixture.kickoffAt, oddsEvent.kickoffAt) <= KICKOFF_TOLERANCE_MINUTES
      );
    });
    const compatibleMatches =
      exactMatches.length > 0
        ? exactMatches
        : fixtures.filter((fixture) => {
            const fixtureKey = pairKey(fixture.homeTeam, fixture.awayTeam);
            return (
              pairCompatible(key, fixtureKey) &&
              kickoffDeltaMinutes(fixture.kickoffAt, oddsEvent.kickoffAt) <=
                KICKOFF_TOLERANCE_MINUTES
            );
          });

    const inLeague = compatibleMatches.filter((fixture) =>
      sameLeague(fixture.league, oddsEvent.league),
    );

    if (compatibleMatches.length === 1) {
      return { status: 'MATCHED', fixture: compatibleMatches[0], oddsEvent };
    }
    if (compatibleMatches.length > 1) {
      // Liga como desempate entre varios candidatos (los nombres de torneo
      // difieren entre proveedores; nunca como requisito de match).
      if (inLeague.length === 1) {
        return { status: 'MATCHED', fixture: inLeague[0], oddsEvent };
      }
      return {
        status: 'AMBIGUOUS',
        oddsEvent,
        reason: `${compatibleMatches.length} fixtures candidatos para un solo evento`,
      };
    }

    const swapped = fixtures.filter((fixture) => {
      const fixtureKey = pairKey(fixture.homeTeam, fixture.awayTeam);
      return (
        samePairSwapped(key, fixtureKey) &&
        kickoffDeltaMinutes(fixture.kickoffAt, oddsEvent.kickoffAt) <= KICKOFF_TOLERANCE_MINUTES
      );
    });
    if (swapped.length > 0) {
      return {
        status: 'AMBIGUOUS',
        oddsEvent,
        reason: 'local/visitante invertidos entre proveedores',
      };
    }

    const namesOnly = fixtures.filter(
      (fixture) =>
        samePair(key, pairKey(fixture.homeTeam, fixture.awayTeam)) ||
        pairCompatible(key, pairKey(fixture.homeTeam, fixture.awayTeam)),
    );
    if (namesOnly.length > 0) {
      return {
        status: 'UNMATCHED',
        oddsEvent,
        reason: 'KICKOFF: equipos coinciden pero kickoff fuera de tolerancia',
      };
    }
    return { status: 'UNMATCHED', oddsEvent, reason: 'NAME: sin fixture con equipos compatibles' };
  });
}
