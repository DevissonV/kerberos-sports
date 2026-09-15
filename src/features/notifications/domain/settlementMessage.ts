import type { PaperBet } from '../../paper-betting/domain/concepts';

const LABELS = { OVER_2_5: 'OVER 2.5', UNDER_2_5: 'UNDER 2.5' } as const;

export function formatSettlementMessage(bet: PaperBet, bankroll: number): string {
  const status = bet.status === 'WON' ? '✅ WON' : bet.status === 'LOST' ? '❌ LOST' : '↩️ VOID';
  const pnl = bet.pnl ?? 0;
  return [
    '⚽ KERBEROS SPORTS — RESULTADO',
    '',
    `🏟 ${bet.homeTeam} vs ${bet.awayTeam}`,
    '',
    'Pick:',
    `${LABELS[bet.selection as keyof typeof LABELS] ?? bet.selection} @ ${bet.placedOdds.toFixed(2)}`,
    '',
    'Resultado:',
    bet.result && /^\d+-\d+$/.test(bet.result) ? bet.result : '—',
    '',
    'Estado:',
    status,
    '',
    'PnL:',
    `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
    '',
    'Bankroll:',
    bankroll.toFixed(2),
    '',
    'Cohorte:',
    bet.cohortId,
    '',
    '🧪 PAPER ONLY',
  ].join('\n');
}
