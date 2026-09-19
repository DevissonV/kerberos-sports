import type { RefinementCounters } from '../../quant/ports/refinementStore';
import type { LeagueStatus } from '../../scanning/domain/leagueUniverse';
import { formatKickoffTimeBogota } from './formatKickoff';
import { formatFixtureIdentity, formatFixtureMeta } from './fixtureIdentity';
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
  /** Emoji del lado del mercado; solo presentación, lo aporta el backend. */
  marketEmoji?: string;
}

/** Separador visual entre bloques de partidos (look & feel compartido). */
export const FIXTURE_SEPARATOR = '─────────────';

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
  /** SIEMPRE COP real del Risk Gate; nunca se reporta el stake PAPER como COP. */
  stakeCop?: number;
}

/**
 * Señal PAPER (H5): NO pasa el Risk Gate real. Su stake es una unidad de
 * simulación (bankroll PAPER), jamás se muestra como COP autorizado.
 */
export interface RefinementHeartbeatPaperBet extends CompetitionIdentity {
  home: string;
  away: string;
  kickoffAt?: Date;
  selection: string;
  probability: number;
  /** Stake en unidades del bankroll PAPER (simulación, no COP). */
  stakeUnits: number;
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
  /** Señales PAPER del tick: visibles, pero NUNCA con lenguaje de autorización. */
  paperSignals?: readonly RefinementHeartbeatPaperBet[];
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

function formatRadarEntry(entry: RefinementHeartbeatRadarEntry, index?: number): string[] {
  const status =
    entry.experimental === true
      ? '👀 Preanálisis · 🧪 Experimental interliga · Todavía no apostar'
      : entry.noOdds === true
        ? '💰 SIN CUOTAS · pendiente de cuotas válidas'
        : '👀 Preanálisis · Seguimiento activo';
  return [
    ...(index === undefined ? [] : [`${index + 1}️⃣ ${entry.home} vs ${entry.away}`]),
    ...(index === undefined
      ? formatFixtureIdentity({
          homeTeam: entry.home,
          awayTeam: entry.away,
          league: entry.league,
          leagueId: entry.leagueId,
          country: entry.country,
          kickoffAt: entry.kickoffAt,
        })
      : formatFixtureMeta({
          league: entry.league,
          leagueId: entry.leagueId,
          country: entry.country,
          kickoffAt: entry.kickoffAt,
        })),
    '',
    `${entry.marketEmoji ?? ''} ${entry.selection} · ${(entry.probability * 100).toFixed(1)}%`.trim(),
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
    '🚨 APUESTA AUTORIZADA',
    '',
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
  lines.push(`🛡️ Risk Gate: ${entry.riskGate ?? 'APROBADO'}`, '', '👤 EJECUCIÓN MANUAL');
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
    '',
    `${entry.marketEmoji ?? ''} ${humanSelection(entry.selection)} · ${percent(entry.probability)}`.trim(),
    entry.reason,
  ];
}

/**
 * Señal PAPER: NO autorizada para ejecución. El stake se muestra en unidades de
 * simulación, nunca como COP ni como "stake autorizado".
 */
function formatPaperSignal(entry: RefinementHeartbeatPaperBet): string[] {
  return [
    '📄 SEÑAL PAPER',
    ...formatFixtureIdentity({
      homeTeam: entry.home,
      awayTeam: entry.away,
      league: entry.league,
      leagueId: entry.leagueId,
      country: entry.country,
      kickoffAt: entry.kickoffAt,
    }),
    '',
    `${humanSelection(entry.selection)} · ${(entry.probability * 100).toFixed(1)}%`,
    `🧮 Stake simulación: ${entry.stakeUnits.toFixed(2)} unidades (PAPER, no COP)`,
    '🔒 NO AUTORIZADA: pendiente del Risk Gate real.',
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
      `🔎 Evaluación de mercado: 🕐 ${formatKickoffTimeBogota(nextT6.decisionAt)}`,
      '📌 Kerberos revisará cuotas y valor de mercado.',
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
          if (index > 0) lines.push(FIXTURE_SEPARATOR, '');
          lines.push(...formatRadarEntry(entry, index));
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
    lines.push('', '🎯 LISTA PARA EJECUCIÓN');
    approvedBets.forEach((entry, index) => {
      if (index > 0) lines.push(FIXTURE_SEPARATOR, '');
      lines.push(...formatApprovedBet(entry));
    });
  }
  if (input.noBets !== undefined && input.noBets > 0) {
    lines.push('', '⚪ EVALUADOS — NO APOSTAR');
    noBetEntries.slice(0, 3).forEach((entry, index) => {
      if (index > 0) lines.push(FIXTURE_SEPARATOR, '');
      lines.push(
        '⚪ NO APOSTAR',
        ...formatFixtureIdentity({
          homeTeam: entry.home,
          awayTeam: entry.away,
          league: entry.league,
          leagueId: entry.leagueId,
          country: entry.country,
          kickoffAt: entry.kickoffAt,
        }),
        `📌 Motivo: ${humanNoBetReason(entry.reason)}`,
      );
    });
  }
  const paperEntries = input.paperSignals ?? [];
  if (paperEntries.length > 0) {
    lines.push('', '📄 APUESTAS PAPER · SIN AUTORIZACIÓN REAL');
    paperEntries.slice(0, 5).forEach((entry, index) => {
      if (index > 0) lines.push(FIXTURE_SEPARATOR, '');
      lines.push(...formatPaperSignal(entry));
    });
    if (paperEntries.length > 5) lines.push(`• +${paperEntries.length - 5} señales adicionales`);
  }
  const closedFollowups = input.closedFollowups ?? [];
  if (closedFollowups.length > 0) {
    lines.push('', '🏁 SEGUIMIENTO CERRADO');
    closedFollowups.slice(0, 3).forEach((entry, index) => {
      if (index > 0) lines.push(FIXTURE_SEPARATOR, '');
      lines.push(...formatClosedFollowup(entry));
    });
  }
  if (input.oddsUnavailable !== undefined && input.oddsUnavailable > 0)
    lines.push('', `💰 Sin cuotas: ${input.oddsUnavailable}`);
  if (input.insufficientData !== undefined && input.insufficientData > 0)
    lines.push('', `📊 Datos insuficientes: ${input.insufficientData}`);

  if ((input.bets ?? 0) === 0)
    lines.push('', '⚠️ Todavía no hay apuestas con autorización del Risk Gate.');

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
