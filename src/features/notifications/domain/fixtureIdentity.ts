import { LEAGUE_UNIVERSE } from '../../scanning/domain/leagueUniverse';
import { formatKickoffDateBogota, formatKickoffTimeBogota } from './formatKickoff';

export interface FixtureIdentityInput {
  homeTeam: string;
  awayTeam: string;
  /** Nombre de liga crudo del proveedor (fallback si no hay definición en el universo). */
  league: string;
  leagueId?: number;
  country?: string;
  kickoffAt?: Date;
}

/** Campos de identidad de liga que los DTOs de heartbeat llevan para la cabecera. */
export interface CompetitionIdentity {
  league: string;
  leagueId?: number;
  country?: string;
}

/**
 * Nombre humano canónico de la competición. Resuelve por leagueId+country tal como el
 * resto del dominio; si está fuera del universo, intenta por canonicalName y, como último
 * recurso, usa el nombre crudo del proveedor. Nunca muestra IDs técnicos.
 */
export function competitionLabel(league: string, leagueId?: number, country?: string): string {
  if (leagueId !== undefined && country !== undefined) {
    const byId = LEAGUE_UNIVERSE.find(
      (entry) => entry.leagueId === leagueId && entry.country === country,
    );
    if (byId !== undefined) return byId.canonicalName;
  }
  const byName = LEAGUE_UNIVERSE.find((entry) => entry.canonicalName === league);
  return byName?.canonicalName ?? league;
}

/**
 * Cabecera universal de fixture para Telegram: equipos, torneo, fecha y hora Bogotá.
 * Pura y solo de presentación: un fixture sin kickoff omite la línea de fecha/hora y
 * un fixture sin universo devuelve el nombre de liga crudo (nunca un torneo inventado).
 */
export function formatFixtureIdentity(input: FixtureIdentityInput): string[] {
  return [
    `⚽ ${input.homeTeam} vs ${input.awayTeam}`,
    `🏆 ${competitionLabel(input.league, input.leagueId, input.country)}`,
    ...(input.kickoffAt === undefined
      ? []
      : [
          `📅 ${formatKickoffDateBogota(input.kickoffAt)} · 🕐 ${formatKickoffTimeBogota(input.kickoffAt)}`,
        ]),
  ];
}
