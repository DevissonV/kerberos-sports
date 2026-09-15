/**
 * Modelo interno neutral del pipeline de datos. El dominio NO conoce el JSON de
 * API-Football ni de OddsPapi: los adapters traducen a estos tipos.
 */

export type ScanSport = 'FOOTBALL';

export interface Fixture {
  /** Identificador estable en el proveedor de fixtures (API-Football). */
  id: string;
  sport: ScanSport;
  league: string;
  /**
   * Id numérico de liga del proveedor (API-Football `league.id`). Opcional para no
   * romper construcciones de dominio ajenas al filtro de protocolo (p. ej. tests de
   * `matching.ts`, que no dependen de la cohorte); ausente = no elegible fail-closed
   * (ver `domain/protocol.ts`).
   */
  leagueId?: number;
  /** País de la liga del proveedor (API-Football `league.country`). Mismo criterio que `leagueId`. */
  country?: string;
  homeTeam: string;
  awayTeam: string;
  /** Kickoff en UTC. */
  kickoffAt: Date;
  status: string;
}

/** Selección de un mercado Over/Under 2.5. */
export type OverUnderSelection = 'OVER_2_5' | 'UNDER_2_5';

/** Cuota decimal de una selección concreta, capturada por un bookmaker. */
export interface BookmakerQuote {
  bookmaker: string;
  selection: OverUnderSelection;
  decimalOdds: number;
  /** Momento de captura de la cuota (UTC). */
  capturedAt: Date;
}

/** Par over/under de un mismo bookmaker para un fixture. */
export interface OddsPair {
  fixtureId: string;
  bookmaker: string;
  over: BookmakerQuote;
  under: BookmakerQuote;
}
