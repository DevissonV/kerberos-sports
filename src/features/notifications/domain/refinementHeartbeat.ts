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
  preAnalysisCount?: number;
  marketAnalyzed?: number;
  noOdds?: number;
  radar?: readonly { home: string; away: string; selection: string; probability: number }[];
  bets?: number;
  noBets?: number;
  insufficientData?: number;
  oddsUnavailable?: number;
  budgetBlocked?: number;
  budgetProvider?: string;
  budgetResetAt?: string;
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
    `Modelados: ${input.fixturesModelled ?? 0}`,
    `Preanálisis: ${input.preAnalysisCount ?? 0}`,
    `Con mercado evaluado: ${input.marketAnalyzed ?? 0}`,
    `BET: ${input.bets ?? 0}`,
    `NO_BET: ${input.noBets ?? 0}`,
    `Sin odds: ${input.oddsUnavailable ?? 0}`,
    `Datos insuficientes: ${input.insufficientData ?? 0}`,
    hasError ? '⚠️ Revisión con incidencia' : '🟢 Sistema funcionando',
  ];
  if (input.radar !== undefined && input.radar.length > 0) {
    lines.push('', '🔥 PARTIDOS A SEGUIR', 'Preanálisis — todavía no ejecutar.');
    for (const entry of input.radar.slice(0, 3))
      lines.push(
        `${entry.home} vs ${entry.away}`,
        `${entry.selection} — Kerberos: ${(entry.probability * 100).toFixed(1)}%`,
      );
  }
  if (input.budgetBlocked !== undefined && input.budgetBlocked > 0) {
    lines.splice(3, 0, '⚠️ Análisis parcial');
    lines.splice(7, 0, `Pendientes por límite API: ${input.budgetBlocked}`);
    if (input.budgetProvider !== undefined)
      lines.splice(8, 0, `Proveedor limitado: ${input.budgetProvider}`);
    if (input.budgetResetAt !== undefined)
      lines.splice(9, 0, `Próximo reset: ${input.budgetResetAt}`);
  }
  if (input.error !== undefined) lines.push('', `Detalle: ${input.error.slice(0, 180)}`);
  return lines.join('\n');
}
