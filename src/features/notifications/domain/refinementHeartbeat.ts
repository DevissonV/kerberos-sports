import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';
import { formatKickoffBogota } from './formatKickoff';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';

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

export interface RefinementHeartbeatClosedEntry {
  home: string;
  away: string;
  selection: string;
  probability: number;
  kickoffAt: Date;
  reason: string;
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
  closedFollowups?: readonly RefinementHeartbeatClosedEntry[];
  bets?: number;
  noBets?: number;
  insufficientData?: number;
  oddsUnavailable?: number;
  todayRawFixtures?: number;
  todayModelEnabled?: number;
  todayModelable?: number;
  todayHistoryReady?: number;
  todayAliasReady?: number;
  todayWithinModelHorizon?: number;
  todayPreanalysis?: number;
  todayStarted?: number;
  todayExpired?: number;
  todayRejected?: number;
  todayRejectionExamples?: readonly { home: string; away: string; reason: string }[];
  upcomingPreanalysis?: number;
  radarTodayShown?: number;
  radarUpcomingShown?: number;
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
    `Hoy detectados: ${input.todayRawFixtures ?? 0}`,
    `Hoy modelables: ${input.todayModelable ?? input.todayModelEnabled ?? 0}`,
    `Hoy preanalizados: ${input.todayPreanalysis ?? 0}`,
    `Próximos preanalizados: ${input.upcomingPreanalysis ?? 0}`,
    ...(input.todayRejected === undefined ? [] : [`No modelables hoy: ${input.todayRejected}`]),
    ...(input.todayRejectionExamples === undefined || input.todayRejectionExamples.length === 0
      ? []
      : [
          ...input.todayRejectionExamples
            .slice(0, 3)
            .map((entry) => `• ${entry.home} vs ${entry.away} — ${entry.reason}`),
          ...(input.todayRejected !== undefined && input.todayRejected > 3
            ? [`• +${input.todayRejected - 3} descartes adicionales`]
            : []),
        ]),
    `NO_BET: ${input.noBets ?? 0}`,
    `Sin odds: ${input.oddsUnavailable ?? 0}`,
    `Datos insuficientes: ${input.insufficientData ?? 0}`,
  ];

  const radar = input.radar !== undefined && input.radar.length > 0 ? input.radar : [];
  if (radar.length > 0) {
    const todayDate = calendarDateInBogota(input.now);
    const today = radar.filter(
      (entry) =>
        entry.kickoffAt !== undefined && calendarDateInBogota(entry.kickoffAt) === todayDate,
    );
    const upcoming = radar
      .filter((entry) => !today.includes(entry))
      .sort((a, b) => {
        const kickoffDiff = (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0);
        return kickoffDiff !== 0 ? kickoffDiff : radarSortKey(a).localeCompare(radarSortKey(b));
      });
    const renderSection = (
      title: string,
      entries: RefinementHeartbeatRadarEntry[],
      offset: number,
    ) => {
      lines.push('', title, '');
      entries.forEach((entry, index) => {
        if (index > 0) lines.push('─────────────', '');
        lines.push(...formatRadarEntry(entry, offset + index));
      });
    };
    if (today.length > 0) {
      renderSection('🔥 PARTIDOS DE HOY', today, 0);
      if ((input.todayPreanalysis ?? 0) > today.length)
        lines.push(
          '',
          `📌 Hay ${(input.todayPreanalysis ?? 0) - today.length} partidos adicionales de hoy en seguimiento.`,
        );
    }
    if (upcoming.length > 0) {
      renderSection(
        today.length > 0 ? '📆 PRÓXIMOS' : '🔥 PARTIDOS A SEGUIR',
        upcoming,
        today.length,
      );
    }
  }

  const closed = input.closedFollowups ?? [];
  if (closed.length > 0) {
    lines.push('', '⏱️ Seguimiento cerrado', '');
    for (const entry of closed.slice(0, 3)) {
      lines.push(
        `${entry.home} vs ${entry.away}`,
        entry.selection,
        `Preanálisis previo: ${(entry.probability * 100).toFixed(1)}%`,
        `Motivo: ${entry.reason}`,
        '',
      );
    }
    if (closed.length > 3) lines.push(`+${closed.length - 3} cierres adicionales`);
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
