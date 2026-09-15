/**
 * Protocolo congelado de la cohorte KSS-V1-C01 (ver `resources/temp/KSS-PROTOCOL-01.md`).
 * Único filtro de universo aceptado: liga inglesa Premier League por id + país, NUNCA por
 * nombre de liga (hay decenas de ligas llamadas "Premier League" en otros países). Puro y
 * determinista: sin red, sin reloj.
 */

import type { Fixture } from './concepts';
import { isReserveTeam } from './normalization';

export const PROTOCOL_COHORT_ID = 'KSS-V1-C01';
export const PROTOCOL_LEAGUE_ID = 39;
export const PROTOCOL_COUNTRY = 'England';
export const PROTOCOL_MARKET = 'OVER_UNDER_2_5';
export const PRIMARY_BOOKMAKER = 'pinnacle';
export const FALLBACK_BOOKMAKER = 'bet365';

/**
 * Defensa adicional por nombre de competición/equipo (cup, continental, friendly, youth,
 * reserve/B, women, simulados). `leagueId`+`country` ya deberían bastar para aislar la
 * Premier League inglesa masculina adulta, pero el protocolo exige exclusión explícita:
 * fail-closed también si el proveedor etiqueta mal una competición bajo el mismo id.
 */
const EXCLUDED_COMPETITION_NAME_TOKENS = [
  'cup',
  'trophy',
  'shield',
  'friendlies',
  'friendly',
  'uefa',
  'champions league',
  'europa league',
  'conference league',
  'u17',
  'u18',
  'u19',
  'u20',
  'u21',
  'u23',
  'youth',
  'academy',
  'women',
  'ladies',
  'srl',
  'simulated',
  'esoccer',
  'e-soccer',
];

export type ProtocolExclusionReason =
  'WRONG_LEAGUE_ID' | 'WRONG_COUNTRY' | 'EXCLUDED_COMPETITION_TYPE' | 'RESERVE_OR_YOUTH_TEAM';

/**
 * Evalúa si un fixture pertenece a la cohorte congelada. Devuelve `null` si es elegible,
 * o el motivo de exclusión. Fail-closed: `leagueId`/`country` ausentes o indefinidos nunca
 * son elegibles.
 */
export function evaluateProtocolEligibility(
  fixture: Pick<Fixture, 'leagueId' | 'country' | 'league' | 'homeTeam' | 'awayTeam'>,
): ProtocolExclusionReason | null {
  if (fixture.leagueId !== PROTOCOL_LEAGUE_ID) return 'WRONG_LEAGUE_ID';
  if (fixture.country !== PROTOCOL_COUNTRY) return 'WRONG_COUNTRY';
  return evaluateCompetitionSafety(fixture);
}

/** Defensa reutilizable para las cohortes multiliga; no decide identidad de liga. */
export function evaluateCompetitionSafety(
  fixture: Pick<Fixture, 'league' | 'homeTeam' | 'awayTeam'>,
): ProtocolExclusionReason | null {
  const leagueName = fixture.league.toLowerCase();
  if (EXCLUDED_COMPETITION_NAME_TOKENS.some((token) => leagueName.includes(token))) {
    return 'EXCLUDED_COMPETITION_TYPE';
  }
  if (isReserveTeam(fixture.homeTeam) || isReserveTeam(fixture.awayTeam)) {
    return 'RESERVE_OR_YOUTH_TEAM';
  }
  return null;
}
