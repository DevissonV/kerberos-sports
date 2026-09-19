import type { ManualLedgerEntry } from '../../manual-ledger/domain/manualLedger';
import { formatFixtureIdentity } from './fixtureIdentity';

function cop(value: number): string {
  return `${Math.round(value).toLocaleString('es-CO')} COP`;
}

function selectionLabel(selection: string | undefined): string {
  if (selection === 'OVER_2_5') return 'MÁS DE 2.5 GOLES';
  if (selection === 'UNDER_2_5') return 'MENOS DE 2.5 GOLES';
  return selection ?? '—';
}

function identityLines(entry: ManualLedgerEntry): string[] {
  return formatFixtureIdentity({
    homeTeam: entry.homeTeam ?? '',
    awayTeam: entry.awayTeam ?? '',
    league: entry.competition ?? '',
    kickoffAt: entry.kickoffAt,
  });
}

export interface ManualExecutedMessageOptions {
  market?: string;
  competition?: string;
}

/** Confirmación de la ejecución REAL registrada por el operador (envío único deduped). */
export function formatManualExecutedMessage(entry: ManualLedgerEntry): string {
  return [
    '👤 APUESTA EJECUTADA',
    '',
    ...identityLines(entry),
    '',
    `🎯 Mercado: ${selectionLabel(entry.selection)}`,
    `💰 Cuota ejecutada: ${entry.executedOdds?.toFixed(2) ?? '—'}`,
    `💵 Stake: ${entry.executedStakeCop === undefined ? '—' : cop(entry.executedStakeCop)}`,
    `🏦 Casa: ${entry.bookmaker ?? '—'}`,
    '',
    '⏳ Esperando resultado',
  ].join('\n');
}

/** Settlement real: PnL solo si la apuesta se ejecutó de verdad; VOID muestra devolución. */
export function formatManualSettlementMessage(entry: ManualLedgerEntry): string {
  const status =
    entry.result === 'WIN'
      ? '✅ GANADA'
      : entry.result === 'LOSS'
        ? '❌ PERDIDA'
        : '↩️ ANULADA/DEVUELTA';
  const showPnL = entry.status === 'SETTLED' && entry.executedStakeCop !== undefined;
  return [
    '🏁 RESULTADO FINAL',
    `${status}`,
    '',
    ...identityLines(entry),
    '',
    `🎯 Mercado: ${selectionLabel(entry.selection)}`,
    `💰 Cuota ejecutada: ${entry.executedOdds === undefined ? '—' : entry.executedOdds.toFixed(2)}`,
    `💵 Stake: ${entry.executedStakeCop === undefined ? '—' : cop(entry.executedStakeCop)}`,
    ...(showPnL && entry.netPnlCop !== undefined
      ? [`📈 PnL: ${entry.netPnlCop >= 0 ? '+' : ''}${cop(entry.netPnlCop)}`]
      : []),
    '',
    '👤 EJECUCIÓN MANUAL',
  ].join('\n');
}
