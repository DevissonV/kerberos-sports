import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';
import { formatKickoffBogota } from './formatKickoff';
import { formatFixtureIdentity } from './fixtureIdentity';
import type { CompetitionIdentity } from './fixtureIdentity';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';
import { humanizeTechnicalStatus } from './technicalStatus';

export interface RefinementHeartbeatLeague {
  leagueId: number;
  status: LeagueStatus;
  fixturesDetected: number;
  modelled?: number;
}

export interface RefinementHeartbeatRadarEntry extends CompetitionIdentity {
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

export interface RefinementHeartbeatClosedEntry extends CompetitionIdentity {
  home: string;
  away: string;
  selection: string;
  probability: number;
  kickoffAt: Date;
  reason: string;
}

/** Datos ya decididos por el backend para resaltar una apuesta PAPER autorizada. */
export interface RefinementHeartbeatApprovedBet extends CompetitionIdentity {
  home: string;
  away: string;
  kickoffAt?: Date;
  selection: string;
  modelProbability?: number;
  offeredOdds?: number;
  minimumAcceptableOdds?: number;
  edge?: number;
  expectedValue?: number;
  riskGate?: string;
  stakeCop?: number;
}

export interface RefinementHeartbeatNoBetEntry extends CompetitionIdentity {
  home: string;
  away: string;
  kickoffAt?: Date;
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
  /** Próxima ventana de evaluación T-6, con identidad completa del fixture. */
  nextT6?: {
    home: string;
    away: string;
    kickoffAt?: Date;
    decisionAt?: Date;
  } & CompetitionIdentity;
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
  todayRejectionExamples?: readonly (Partial<CompetitionIdentity> & {
    home: string;
    away: string;
    reason: string;
    kickoffAt?: Date;
  })[];
  upcomingPreanalysis?: number;
  radarTodayShown?: number;
  radarUpcomingShown?: number;
  budgetBlocked?: number;
  budgetProvider?: string;
  budgetResetAt?: string;
  error?: string;
}

/** Orden secundario determinista para kickoffs idénticos: equipos en orden alfabético. */
function radarSortKey(entry: RefinementHeartbeatRadarEntry): string {
  return `${entry.home}${entry.away}`;
}

/** Maximum visual de opciones por página del radar: sin tocar elegibilidad del modelo. */
export const RADAR_PAGE_SIZE = 15;
/** Techo visual total del radar (entran ~2 páginas). */
export const RADAR_VISIBLE_LIMIT = 30;

function formatRadarEntry(entry: RefinementHeartbeatRadarEntry): string[] {
  const status =
    entry.experimental === true
      ? '🧪 Experimental interliga · Todavía no apostar'
      : entry.noOdds === true
        ? '💰 SIN CUOTAS · pendiente de cuotas válidas'
        : '🧠 PREANÁLISIS LISTO';
  return [
    ...formatFixtureIdentity({
      homeTeam: entry.home,
      awayTeam: entry.away,
      league: entry.league,
      leagueId: entry.leagueId,
      country: entry.country,
      kickoffAt: entry.kickoffAt,
    }),
    `${entry.marketEmoji ?? ''} ${entry.selection}`.trim(),
    `🧠 Probabilidad Kerberos: ${(entry.probability * 100).toFixed(1)}%`,
    status,
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

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatApprovedBet(entry: RefinementHeartbeatApprovedBet): string[] {
  const lines = [
    ...formatFixtureIdentity({
      homeTeam: entry.home,
      awayTeam: entry.away,
      league: entry.league,
      leagueId: entry.leagueId,
      country: entry.country,
      kickoffAt: entry.kickoffAt,
    }),
    '',
    `🎯 Mercado: ${humanSelection(entry.selection)}`,
    `🛡️ Risk Gate: ${entry.riskGate ?? 'APROBADO'}`,
  ];
  if (entry.modelProbability !== undefined)
    lines.push(`🧠 Probabilidad Kerberos: ${(entry.modelProbability * 100).toFixed(1)}%`);
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
  if (entry.stakeCop !== undefined) lines.push(`💰 Stake autorizado: ${formatCop(entry.stakeCop)}`);
  lines.push('', '👤 EJECUCIÓN MANUAL');
  return lines;
}

function formatClosedFollowup(entry: RefinementHeartbeatClosedEntry): string[] {
  return [
    ...formatFixtureIdentity({
      homeTeam: entry.home,
      awayTeam: entry.away,
      league: entry.league,
      leagueId: entry.leagueId,
      country: entry.country,
      kickoffAt: entry.kickoffAt,
    }),
    `${humanSelection(entry.selection)} · ${percent(entry.probability)}`,
    entry.reason,
  ];
}

export function formatRefinementHeartbeat(input: RefinementHeartbeatInput): string {
  const totalDetected = input.byLeague.reduce((sum, league) => sum + league.fixturesDetected, 0);
  const approvedBets = input.approvedBets ?? [];
  const noBetEntries = input.noBetEntries ?? [];

  const nextT6 = input.nextT6;
  const lines = [
    '⚽ KERBEROS SPORTS',
    '',
    '✅ Revisión completada',
    '',
    '📊 ESTADO',
    `Detectados: ${totalDetected}`,
    `Modelados: ${input.preAnalysisCount ?? 0}`,
    `🎯 Apuestas autorizadas: ${input.bets ?? 0}`,
  ];
  if (nextT6 !== undefined && nextT6.decisionAt !== undefined) {
    lines.push(
      '',
      '⏭ PRÓXIMA EVALUACIÓN',
      ...formatFixtureIdentity({
        homeTeam: nextT6.home,
        awayTeam: nextT6.away,
        league: nextT6.league,
        leagueId: nextT6.leagueId,
        country: nextT6.country,
        kickoffAt: nextT6.kickoffAt,
      }),
      `⏳ Evaluación de mercado a las: ${formatKickoffBogota(nextT6.decisionAt)}`,
      '📌 En ese momento Kerberos revisará cuotas y valor de mercado.',
    );
  }

  const radar = (input.radar ?? []).slice(0, RADAR_VISIBLE_LIMIT);
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
    const renderSection = (title: string, entries: RefinementHeartbeatRadarEntry[]) => {
      // Si hay muchas opciones, se pagina para no tragar el mensaje de Telegram.
      const pages: RefinementHeartbeatRadarEntry[][] = [];
      for (let start = 0; start < entries.length; start += RADAR_PAGE_SIZE)
        pages.push(entries.slice(start, start + RADAR_PAGE_SIZE));
      pages.forEach((page, pageIndex) => {
        const titleSuffix = pages.length > 1 ? ` (${pageIndex + 1}/${pages.length})` : '';
        lines.push('', `${title}${titleSuffix}`, '');
        page.forEach((entry, index) => {
          if (index > 0) lines.push('─────────────', '');
          lines.push(...formatRadarEntry(entry));
        });
      });
    };
    if (today.length > 0) {
      renderSection('🔥 PARTIDOS A SEGUIR', today);
      if ((input.todayPreanalysis ?? 0) > today.length)
        lines.push(
          '',
          `📌 Hay ${(input.todayPreanalysis ?? 0) - today.length} partidos adicionales de hoy en seguimiento.`,
        );
    }
    if (upcoming.length > 0) {
      renderSection('🔥 PARTIDOS A SEGUIR', upcoming);
    }
  }

  if (input.todayRejected !== undefined && input.todayRejected > 0) {
    lines.push('', 'ℹ️ FUERA DE SEGUIMIENTO HOY');
    if (input.todayRejectionExamples !== undefined) {
      lines.push(
        ...input.todayRejectionExamples.slice(0, 3).flatMap((entry) => {
          const status = humanizeTechnicalStatus(entry.reason);
          return [
            ...formatFixtureIdentity({
              homeTeam: entry.home,
              awayTeam: entry.away,
              league: entry.league ?? '',
              leagueId: entry.leagueId,
              country: entry.country,
              kickoffAt: entry.kickoffAt,
            }),
            `  ${status.label}`,
            '',
          ];
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
      ...noBetEntries.slice(0, 3).flatMap((entry) => [
        ...formatFixtureIdentity({
          homeTeam: entry.home,
          awayTeam: entry.away,
          league: entry.league,
          leagueId: entry.leagueId,
          country: entry.country,
          kickoffAt: entry.kickoffAt,
        }),
        `📌 Motivo: ${humanNoBetReason(entry.reason)}`,
        '',
      ]),
    );
  }
  const closedFollowups = input.closedFollowups ?? [];
  if (closedFollowups.length > 0) {
    lines.push('', '🏁 SEGUIMIENTO CERRADO');
    lines.push(...closedFollowups.slice(0, 3).flatMap(formatClosedFollowup));
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
