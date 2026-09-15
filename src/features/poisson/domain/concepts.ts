/**
 * Modelo de dominio de Poisson V1 (`KSS-V1-C01`, ver `resources/temp/KSS-PROTOCOL-01.md` sección 5).
 * Puro y determinista: sin red, sin reloj invisible, sin persistencia.
 */

/** Partido histórico ya resuelto a nombres canónicos de equipo (ver `teamAliases.ts`). */
export interface HistoricalMatch {
  /** Fecha del partido, normalizada a medianoche UTC. */
  date: Date;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: 'H' | 'A' | 'D';
}

export type DataQualityFlag =
  | 'HOME_NO_ROLE_HISTORY'
  | 'AWAY_NO_ROLE_HISTORY'
  | 'HOME_INSUFFICIENT_ROLE_HISTORY'
  | 'AWAY_INSUFFICIENT_ROLE_HISTORY';

export const POISSON_MODEL_VERSION = 'poisson-v1';

export interface PoissonModelOutput {
  modelVersion: typeof POISSON_MODEL_VERSION;
  snapshotAt: Date;
  fixtureId: string;
  league: string;
  home: string;
  away: string;
  leagueHomeGoalsMean: number;
  leagueAwayGoalsMean: number;
  homeRoleMatches: number;
  awayRoleMatches: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaTotal: number;
  pOver: number;
  pUnder: number;
  dataQuality: DataQualityFlag[];
}

/**
 * Único caso de exclusión definido por el protocolo: liga sin mínimo de partidos en la
 * ventana (sección 1/5). Nunca se inventa una probabilidad ante un insumo obligatorio faltante.
 */
export type PoissonModelResult =
  { status: 'OK'; output: PoissonModelOutput } | { status: 'LEAGUE_NOT_ENABLED' };
