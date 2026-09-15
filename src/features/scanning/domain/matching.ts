/**
 * Matching entre fixtures (API-Football) y eventos de odds (OddsPapi).
 * Estrategia: equipos normalizados + kickoff con tolerancia + liga cuando existe.
 * Si no hay confianza, el evento se rechaza: NUNCA se inventan asociaciones.
 */

import type { Fixture } from './concepts';
import { aggressiveTeamKey, normalizeTeamName } from './normalization';

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
 * - MATCHED: par de equipos (normalizado) coincide Y kickoff dentro de tolerancia Y liga compatible.
 * - AMBIGUOUS: varios fixtures cumplen (no se puede decidir) o el par coincide
 *   cruzado (home/away invertidos): señal de datos poco confiables.
 * - UNMATCHED: ningún fixture cumple.
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
        kickoffDeltaMinutes(fixture.kickoffAt, oddsEvent.kickoffAt) <= KICKOFF_TOLERANCE_MINUTES &&
        sameLeague(fixture.league, oddsEvent.league)
      );
    });

    if (exactMatches.length === 1) {
      return { status: 'MATCHED', fixture: exactMatches[0], oddsEvent };
    }
    if (exactMatches.length > 1) {
      return {
        status: 'AMBIGUOUS',
        oddsEvent,
        reason: `${exactMatches.length} fixtures candidatos para un solo evento`,
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

    return {
      status: 'UNMATCHED',
      oddsEvent,
      reason: 'sin fixture con equipos normalizados + kickoff compatible',
    };
  });
}
