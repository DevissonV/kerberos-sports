import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';

/** Bandera + nombre visible por liga, para el heartbeat humano (nunca IDs técnicos). */
const LEAGUE_DISPLAY: Record<number, string> = {
  39: '🇬🇧 Premier League',
  239: '🇨🇴 Liga BetPlay',
  140: '🇪🇸 LaLiga',
  135: '🇮🇹 Serie A',
  78: '🇩🇪 Bundesliga',
  61: '🇫🇷 Ligue 1',
  88: '🇳🇱 Eredivisie',
};

function leagueLabel(leagueId: number): string {
  return LEAGUE_DISPLAY[leagueId] ?? `Liga ${leagueId}`;
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
    'Partidos detectados:',
    '',
    ...input.byLeague.map(
      (league) => `${leagueLabel(league.leagueId)}: ${league.fixturesDetected}`,
    ),
    '',
    `Total: ${totalDetected}`,
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
