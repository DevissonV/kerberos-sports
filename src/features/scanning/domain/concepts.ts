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

/** Línea del total O/U de la cohorte KSS-V1-C01. */
export const ODDS_LINE_2_5 = 2.5 as const;

/**
 * Cuota decimal de una selección concreta, observada por un bookmaker.
 *
 * H1 (KSS-ASTRA-ADVERSARIAL-REVIEW-01): la identidad del mercado es explícita
 * (`marketId` del proveedor) para que un par NUNCA mezcle mercados/periodos
 * distintos (p. ej. Over fulltime con Under firsthalf). La frescura se registra
 * con el instante en que KERBEROS observó la cuota (`observedAt`) y, cuando el
 * provider la entrega, con su metadata `changedAt`: jamás se sustituye por el
 * `startTime` del fixture.
 */
export interface BookmakerQuote {
  bookmaker: string;
  selection: OverUnderSelection;
  decimalOdds: number;
  /** Identificador del market del proveedor: OVER y UNDER comparten el mismo. */
  marketId: string;
  /** Instante en que Kerberos recibió/observó la cuota (UTC). */
  observedAt: Date;
  /** `changedAt` del proveedor si la entrega; se rechaza si es futura a decisión. */
  changedAt?: Date;
  /** Alias de compatibilidad: igual a `observedAt` en los adapters vigentes. */
  capturedAt: Date;
}

/** Par over/under de un mismo bookmaker, mismo market y misma observación. */
export interface OddsPair {
  fixtureId: string;
  bookmaker: string;
  /** Línea total del par: siempre 2.5 en esta cohorte. */
  line: typeof ODDS_LINE_2_5;
  over: BookmakerQuote;
  under: BookmakerQuote;
}
