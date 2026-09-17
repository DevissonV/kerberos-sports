import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';
import { formatKickoffBogota } from './formatKickoff';

export interface RefinementHeartbeatLeague {
  leagueId: number;
  status: LeagueStatus;
  fixturesDetected: number;
}

export interface RefinementHeartbeatRadarEntry {
  home: string;
  away: string;
  selection: string;
  explanation?: string;
  shortHint?: string;
  marketEmoji?: string;
  probability: number;
  kickoffAt?: Date;
  /** true solo cuando el estado real reporta cuotas faltantes (p. ej. reason NO_BOOKMAKER). */
  noOdds?: boolean;
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
  radar?: readonly RefinementHeartbeatRadarEntry[];
  bets?: number;
  noBets?: number;
  insufficientData?: number;
  oddsUnavailable?: number;
  budgetBlocked?: number;
  budgetProvider?: string;
  budgetResetAt?: string;
  error?: string;
}

const RADAR_NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣'];

/** Orden secundario determinista para kickoffs idénticos: equipos en orden alfabético. */
function radarSortKey(entry: RefinementHeartbeatRadarEntry): string {
  return `${entry.home}${entry.away}`;
}

function formatRadarEntry(entry: RefinementHeartbeatRadarEntry, index: number): string[] {
  const status =
    entry.noOdds === true
      ? '👀 Preanálisis · Esperando cuotas'
      : '👀 Preanálisis · Seguimiento activo';
  return [
    `${RADAR_NUMBER_EMOJI[index] ?? `${index + 1}.`} ${entry.home} vs ${entry.away}`,
    ...(entry.kickoffAt === undefined ? [] : [`📅 ${formatKickoffBogota(entry.kickoffAt)}`]),
    `${entry.marketEmoji ?? ''} ${entry.selection}`.trim(),
    `🧠 Kerberos: ${(entry.probability * 100).toFixed(1)}%`,
    status,
    ...(entry.shortHint === undefined ? [] : [`💡 ${entry.shortHint}`]),
  ];
}

export function formatRefinementHeartbeat(input: RefinementHeartbeatInput): string {
  const hasError = input.error !== undefined || input.counters.errors > 0;
  const totalDetected = input.byLeague.reduce((sum, league) => sum + league.fixturesDetected, 0);

  const lines = [
    '⚽ KERBEROS SPORTS',
    '',
    hasError ? '⚠️ Revisión completada con una incidencia' : '✅ Revisión completada',
    '',
    `🔎 ${totalDetected} partidos detectados · 👀 ${input.preAnalysisCount ?? 0} en preanálisis`,
    `🎯 ${input.bets ?? 0} apuestas aprobadas`,
    '',
    `Modelados: ${input.fixturesModelled ?? 0}`,
    `Con mercado evaluado: ${input.marketAnalyzed ?? 0}`,
    `NO_BET: ${input.noBets ?? 0}`,
    `Sin odds: ${input.oddsUnavailable ?? 0}`,
    `Datos insuficientes: ${input.insufficientData ?? 0}`,
  ];

  const radar = input.radar !== undefined && input.radar.length > 0 ? input.radar.slice(0, 3) : [];
  if (radar.length > 0) {
    const ordered = [...radar].sort((a, b) => {
      const kickoffDiff = (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0);
      return kickoffDiff !== 0 ? kickoffDiff : radarSortKey(a).localeCompare(radarSortKey(b));
    });
    lines.push('', '🔥 PARTIDOS A SEGUIR', '');
    ordered.forEach((entry, index) => {
      if (index > 0) lines.push('─────────────', '');
      lines.push(...formatRadarEntry(entry, index));
      if (index < ordered.length - 1) lines.push('');
    });
  }

  lines.push('', hasError ? '⚠️ Revisión con incidencia' : '🟢 Sistema funcionando');
  if (radar.length > 0) lines.push('⚠️ Todavía no son apuestas aprobadas.');

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
