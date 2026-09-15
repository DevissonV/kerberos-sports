import type { RefinementCounters } from '../../quant/ports/refinementStore';

export interface RefinementHeartbeatInput {
  now: Date;
  premierLeagueFixtures: number;
  decisionWindowFixtures: number;
  counters: RefinementCounters;
  openBets: number;
  error?: string;
}

export function formatRefinementHeartbeat(input: RefinementHeartbeatInput): string {
  const mainMessage = getMainMessage(input);
  const hasError = input.error !== undefined || input.counters.errors > 0;
  const lines = [
    '⚽ KERBEROS SPORTS',
    '',
    hasError ? '⚠️ Revisión completada con una incidencia' : '✅ Revisión completada correctamente',
    '',
    mainMessage,
    '',
    '📅 Próxima revisión: en 30 minutos',
    '',
    'Resumen:',
    `• Partidos PL detectados: ${input.premierLeagueFixtures}`,
    `• En ventana de análisis: ${input.decisionWindowFixtures}`,
    `• Oportunidades analizadas: ${input.counters.fullOddsScans}`,
    `• Paper Bets nuevas: ${input.counters.paperBetsCreated}`,
    `• Paper Bets abiertas: ${input.openBets}`,
    `• Luna utilizada: ${input.counters.lunaCalls > 0 ? 'Sí' : 'No'}`,
    `• OddsPapi consumidas: ${input.counters.oddsPapiRequests}`,
    '',
    '🧪 Modo: PAPER',
    hasError ? '🔴 Estado: Error' : '🟢 Estado: Sistema funcionando normalmente',
  ];
  if (input.error !== undefined) lines.push('', `Detalle: ${input.error.slice(0, 180)}`);
  return lines.join('\n');
}

function getMainMessage(input: RefinementHeartbeatInput): string {
  if (input.error !== undefined || input.counters.errors > 0)
    return 'La revisión tuvo una incidencia y continuará en el próximo ciclo.';
  if (input.premierLeagueFixtures === 0)
    return 'No hay partidos de Premier League dentro de la ventana de análisis en este momento.';
  if (input.counters.quantCandidates === 0)
    return `Kerberos analizó ${input.counters.fullOddsScans} partido(s), pero ninguno cumple los criterios mínimos de edge/EV.`;
  return `Kerberos encontró ${input.counters.quantCandidates} posible(s) oportunidad(es) y continúa la evaluación.`;
}
