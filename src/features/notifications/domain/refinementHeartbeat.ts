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
  const lines = [
    '⚽ Kerberos Sports — Refinamiento',
    '',
    `Hora: ${input.now.toISOString()}`,
    'Scan tick: OK',
    '',
    `PL próximas: ${input.premierLeagueFixtures}`,
    `Necesitan snapshot T-6h: ${input.decisionWindowFixtures}`,
    `Full scans ejecutados: ${input.counters.fullOddsScans}`,
    `Candidatos QUANT: ${input.counters.quantCandidates}`,
    `Paper Bets nuevas: ${input.counters.paperBetsCreated}`,
    `Luna calls: ${input.counters.lunaCalls}`,
    `Open bets: ${input.openBets}`,
    '',
    `OddsPapi hoy: ${input.counters.oddsPapiRequests}`,
    'Estado: PAPER / REFINEMENT',
  ];
  if (input.error !== undefined) lines.push('', `ERROR: ${input.error.slice(0, 180)}`);
  return lines.join('\n');
}
