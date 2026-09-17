import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';
import { formatKickoffBogota } from './formatKickoff';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';
import { humanizeTechnicalStatus } from './technicalStatus';

export interface RefinementHeartbeatLeague {
  leagueId: number;
  status: LeagueStatus;
  fixturesDetected: number;
  modelled?: number;
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
  experimental?: boolean;
}

export interface RefinementHeartbeatClosedEntry {
  home: string;
  away: string;
  selection: string;
  probability: number;
  kickoffAt: Date;
  reason: string;
}

/** Datos ya decididos por el backend para resaltar una apuesta PAPER autorizada. */
export interface RefinementHeartbeatApprovedBet {
  home: string;
  away: string;
  selection: string;
  modelProbability?: number;
  offeredOdds?: number;
  minimumAcceptableOdds?: number;
  edge?: number;
  expectedValue?: number;
  riskGate?: string;
  stakeCop?: number;
}

export interface RefinementHeartbeatNoBetEntry {
  home: string;
  away: string;
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
  approvedBets?: readonly RefinementHeartbeatApprovedBet[];
  noBetEntries?: readonly RefinementHeartbeatNoBetEntry[];
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
  nextT6Fixture?: string;
  nextT6At?: Date;
}

const RADAR_NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣'];

/** Orden secundario determinista para kickoffs idénticos: equipos en orden alfabético. */
function radarSortKey(entry: RefinementHeartbeatRadarEntry): string {
  return `${entry.home}${entry.away}`;
}

function formatRadarEntry(entry: RefinementHeartbeatRadarEntry, index: number): string[] {
  const status =
    entry.experimental === true
      ? '🧪 Experimental interliga · Todavía no apostar'
      : entry.noOdds === true
        ? '👀 Preanálisis · Esperando cuotas'
        : '👀 Preanálisis · Seguimiento activo';
  return [
    `${RADAR_NUMBER_EMOJI[index] ?? `${index + 1}.`} ${entry.home} vs ${entry.away}`,
    ...(entry.kickoffAt === undefined ? [] : [`📅 ${formatKickoffBogota(entry.kickoffAt)}`]),
    `${entry.marketEmoji ?? ''} ${entry.selection}`.trim(),
    `🧠 Probabilidad Kerberos: ${(entry.probability * 100).toFixed(1)}%`,
    entry.noOdds === true ? status : '👀 Seguimiento activo',
    ...(entry.experimental === true ? ['⚠️ Modelo interliga no habilitado para apostar.'] : []),
    ...(entry.shortHint === undefined ? [] : [`💡 ${entry.shortHint}`]),
  ];
}

function humanNoBetReason(reason: string): string {
  switch (reason) {
    case 'EV':
    case 'RISK':
      return 'valor esperado insuficiente';
    case 'ODDS_RANGE':
    case 'ODDS_TOO_LOW':
      return 'cuota fuera del rango permitido';
    case 'EXPIRED':
      return 'ventana prepartido cerrada';
    default:
      return 'datos insuficientes';
  }
}

function humanSelection(selection: string): string {
  if (selection === 'OVER_2_5') return 'MÁS DE 2.5 GOLES';
  if (selection === 'UNDER_2_5') return 'MENOS DE 2.5 GOLES';
  return selection;
}

function formatCop(value: number): string {
  return `${Math.round(value).toLocaleString('es-CO')} COP`;
}

function formatApprovedBet(entry: RefinementHeartbeatApprovedBet): string[] {
  const lines = [`${entry.home} vs ${entry.away}`, humanSelection(entry.selection)];
  if (entry.modelProbability !== undefined)
    lines.push(`🧠 Kerberos: ${(entry.modelProbability * 100).toFixed(1)}%`);
  if (entry.offeredOdds !== undefined)
    lines.push(`💰 Cuota actual: ${entry.offeredOdds.toFixed(2)}`);
  if (entry.minimumAcceptableOdds !== undefined)
    lines.push(`🎯 Cuota mínima: ${entry.minimumAcceptableOdds.toFixed(2)}`);
  if (entry.edge !== undefined)
    lines.push(`📈 Edge: ${entry.edge >= 0 ? '+' : ''}${(entry.edge * 100).toFixed(1)} pp`);
  if (entry.expectedValue !== undefined)
    lines.push(
      `💵 EV: ${entry.expectedValue >= 0 ? '+' : ''}${(entry.expectedValue * 100).toFixed(1)}%`,
    );
  if (entry.riskGate !== undefined) lines.push(`🛡️ Risk Gate: ${entry.riskGate}`);
  if (entry.stakeCop !== undefined) lines.push(`💰 Stake autorizado: ${formatCop(entry.stakeCop)}`);
  lines.push('', '👤 Ejecución manual');
  return lines;
}

export function formatRefinementHeartbeat(input: RefinementHeartbeatInput): string {
  const totalDetected = input.byLeague.reduce((sum, league) => sum + league.fixturesDetected, 0);
  const approvedBets = input.approvedBets ?? [];
  const noBetEntries = input.noBetEntries ?? [];

  const lines = [
    '⚽ KERBEROS SPORTS',
    '',
    '✅ Revisión completada',
    '',
    '📊 ESTADO',
    `${totalDetected} partidos detectados`,
    `${input.preAnalysisCount ?? 0} en preanálisis`,
    `🎯 ${input.bets ?? 0} apuestas aprobadas`,
    ...(input.nextT6Fixture === undefined || input.nextT6At === undefined
      ? []
      : [
          '',
          '⏭ PRÓXIMA EVALUACIÓN',
          input.nextT6Fixture,
          `🕐 ${formatKickoffBogota(input.nextT6At)}`,
          '📌 En ese momento Kerberos revisará cuotas y valor de mercado.',
        ]),
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
      renderSection('🔥 PARTIDOS A SEGUIR', today, 0);
      if ((input.todayPreanalysis ?? 0) > today.length)
        lines.push(
          '',
          `📌 Hay ${(input.todayPreanalysis ?? 0) - today.length} partidos adicionales de hoy en seguimiento.`,
        );
    }
    if (upcoming.length > 0) {
      renderSection('🔥 PARTIDOS A SEGUIR', upcoming, today.length);
    }
  }

  if (input.todayRejected !== undefined && input.todayRejected > 0) {
    lines.push('', 'ℹ️ FUERA DE SEGUIMIENTO HOY');
    if (input.todayRejectionExamples !== undefined) {
      lines.push(
        ...input.todayRejectionExamples.slice(0, 3).flatMap((entry) => {
          const status = humanizeTechnicalStatus(entry.reason);
          return [`• ${entry.home} vs ${entry.away}`, `  ${status.label}`];
        }),
      );
      if (input.todayRejected > 3)
        lines.push(`• +${input.todayRejected - 3} descartes adicionales`);
    }
  }

  if (input.bets !== undefined && input.bets > 0) {
    lines.push('', '🎯 LISTA PARA EJECUCIÓN', ...approvedBets.flatMap(formatApprovedBet));
  }
  if (input.noBets !== undefined && input.noBets > 0) {
    lines.push('', '⚪ EVALUADOS — NO APOSTAR');
    lines.push(
      ...noBetEntries
        .slice(0, 3)
        .flatMap((entry) => [
          `• ${entry.home} vs ${entry.away}`,
          `  Motivo: ${humanNoBetReason(entry.reason)}`,
          '',
        ]),
    );
  }
  if (input.oddsUnavailable !== undefined && input.oddsUnavailable > 0)
    lines.push('', `💰 Sin cuotas: ${input.oddsUnavailable}`);
  if (input.insufficientData !== undefined && input.insufficientData > 0)
    lines.push('', `📊 Datos insuficientes: ${input.insufficientData}`);

  if ((input.bets ?? 0) === 0) lines.push('', '⚠️ Todavía no hay apuestas aprobadas.');

  if (input.budgetBlocked !== undefined && input.budgetBlocked > 0) {
    lines.push('', '⚠️ INCIDENCIAS', `Análisis parcial: límite temporal de consultas`);
  }
  if (input.error !== undefined) {
    const status = humanizeTechnicalStatus(input.error);
    lines.push('', '⚠️ INCIDENCIAS', status.label);
    if (status.explanation !== undefined) lines.push(status.explanation);
  }
  return lines.join('\n');
}
