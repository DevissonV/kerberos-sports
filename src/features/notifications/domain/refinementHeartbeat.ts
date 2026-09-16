import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';

export interface RefinementHeartbeatLeague {
  leagueId: number;
  status: LeagueStatus;
  fixturesDetected: number;
}

export interface RefinementHeartbeatInput {
  now: Date;
  /** Desglose por liga del universo V1 (orden fijo), sin IDs técnicos en el mensaje. */
  byLeague: readonly RefinementHeartbeatLeague[];
  counters: RefinementCounters;
  openBets: number;
  fixturesModelled?: number;
  bets?: number;
  noBets?: number;
  insufficientData?: number;
  oddsUnavailable?: number;
  error?: string;
}

export function formatRefinementHeartbeat(input: RefinementHeartbeatInput): string {
  const hasError = input.error !== undefined || input.counters.errors > 0;
  const totalDetected = input.byLeague.reduce((sum, league) => sum + league.fixturesDetected, 0);

  const lines = [
    '⚽ KERBEROS SPORTS',
    '',
    hasError ? '⚠️ Revisión completada con una incidencia' : '✅ Revisión completada',
    '',
    `Partidos detectados: ${totalDetected}`,
    `Analizados: ${input.fixturesModelled ?? 0}`,
    `BET: ${input.bets ?? 0}`,
    `NO_BET: ${input.noBets ?? 0}`,
    `Sin odds: ${input.oddsUnavailable ?? 0}`,
    `Datos insuficientes: ${input.insufficientData ?? 0}`,
    hasError ? '⚠️ Revisión con incidencia' : '🟢 Sistema funcionando',
  ];
  if (input.error !== undefined) lines.push('', `Detalle: ${input.error.slice(0, 180)}`);
  return lines.join('\n');
}
