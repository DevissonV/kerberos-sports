import type { PaperBet } from '../../paper-betting/domain/concepts';
import { marketLanguage } from './marketLanguage';

function cop(value: number): string {
  return `${Math.round(value).toLocaleString('es-CO')} COP`;
}

export function formatSettlementMessage(bet: PaperBet, bankroll: number): string {
  const status =
    bet.status === 'WON' ? '✅ GANADA' : bet.status === 'LOST' ? '❌ PERDIDA' : '↩️ VOID/PUSH';
  const pnl = bet.pnl ?? 0;
  const grossReturn =
    bet.status === 'WON' ? bet.stake * bet.placedOdds : bet.status === 'VOID' ? bet.stake : 0;
  const market = marketLanguage(bet.selection as 'OVER_2_5' | 'UNDER_2_5');
  const clv = bet.closingOdds === undefined ? undefined : bet.placedOdds / bet.closingOdds - 1;
  return [
    '⚽ KERBEROS SPORTS — RESULTADO',
    '',
    `${bet.homeTeam} vs ${bet.awayTeam}`,
    '',
    status,
    '',
    `Apuesta: ${market.title}`,
    `Resultado: ${bet.result && /^\d+-\d+$/.test(bet.result) ? bet.result : '—'}`,
    `Stake real: ${cop(bet.stake)}`,
    `Cuota real ejecutada: ${bet.placedOdds.toFixed(2)}`,
    `Retorno: ${cop(grossReturn)}`,
    `PnL: ${pnl >= 0 ? '+' : ''}${cop(pnl)}`,
    `Bankroll antes: ${cop(bet.bankrollBefore)}`,
    `Bankroll después: ${cop(bankroll)}`,
    ...(clv === undefined ? [] : [`CLV: ${clv >= 0 ? '+' : ''}${(clv * 100).toFixed(1)}%`]),
    '',
    '👤 EJECUCIÓN MANUAL',
  ].join('\n');
}
