import type { RefinementCounters } from '../../quant/ports/refinementStore';
import { LEAGUE_UNIVERSE, type LeagueStatus } from '../../scanning/domain/leagueUniverse';

function leagueLabel(leagueId: number): string {
  return (
    LEAGUE_UNIVERSE.find((league) => league.leagueId === leagueId)?.heartbeatLabel ??
    `Liga ${leagueId}`
  );
}

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
  const modelEnabled = input.byLeague.filter((league) => league.status === 'MODEL_ENABLED');
  const observation = input.byLeague.filter((league) => league.status === 'OBSERVATION_ONLY');
  const totalDetected = input.byLeague.reduce((sum, league) => sum + league.fixturesDetected, 0);
  const observationTotal = observation.reduce((sum, league) => sum + league.fixturesDetected, 0);

  const lines = [
    '⚽ KERBEROS SPORTS',
    '',
    hasError ? '⚠️ Revisión completada con una incidencia' : '✅ Revisión completada',
    '',
    `Partidos detectados: ${totalDetected}`,
    `Partidos con modelo: ${input.byLeague.filter((league) => league.status === 'MODEL_ENABLED').reduce((sum, league) => sum + league.fixturesDetected, 0)}`,
    `Analizados: ${input.fixturesModelled ?? 0}`,
    `BET: ${input.bets ?? 0}`,
    `NO BET: ${input.noBets ?? 0}`,
    `Sin odds: ${input.oddsUnavailable ?? 0}`,
    `Datos insuficientes: ${input.insufficientData ?? 0}`,
    '',
    ...input.byLeague.map(
      (league) => `${leagueLabel(league.leagueId)}: ${league.fixturesDetected}`,
    ),
    '',
    '📊 Con modelo habilitado:',
    ...modelEnabled.map((league) => `${leagueLabel(league.leagueId)}: ${league.fixturesDetected}`),
    '',
    '👀 En observación:',
    `${observationTotal} partidos`,
    '',
    `🎯 Oportunidades QUANT: ${input.counters.quantCandidates}`,
    `🧪 Paper Bets nuevas: ${input.counters.paperBetsCreated}`,
    `🌙 Luna utilizada: ${input.counters.lunaCalls > 0 ? 'Sí' : 'No'}`,
    '',
    hasError ? '🔴 Estado: Error' : '🟢 Sistema funcionando normalmente',
    '🧪 Modo PAPER',
  ];
  if (input.error !== undefined) lines.push('', `Detalle: ${input.error.slice(0, 180)}`);
  return lines.join('\n');
}
