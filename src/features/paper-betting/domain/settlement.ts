import type { PaperBet, PaperBetOutcome } from './concepts';
import type { FixtureResult } from '../../scanning/ports/resultsProvider';

export interface SettlementDecision {
  outcome: PaperBetOutcome;
  result: string;
  finalHomeGoals?: number;
  finalAwayGoals?: number;
}

const FINAL_VOID_STATUSES = new Set(['CANC', 'ABD']);
const PENDING_STATUSES = new Set([
  'PST',
  'NS',
  'TBD',
  'SUSP',
  'INT',
  'LIVE',
  '1H',
  'HT',
  '2H',
  'ET',
  'P',
]);

/** Decide solo con FT y goles enteros; cualquier estado ambiguo queda abierto. */
export function resolveSettlement(bet: PaperBet, result: FixtureResult): SettlementDecision | null {
  const status = result.status.trim().toUpperCase();
  if (FINAL_VOID_STATUSES.has(status)) return { outcome: 'VOID', result: status };
  if (PENDING_STATUSES.has(status) || status !== 'FT') return null;

  const home = result.fulltimeHome;
  const away = result.fulltimeAway;
  if (home === null || away === null || !Number.isInteger(home) || !Number.isInteger(away)) {
    return null;
  }
  const total = home + away;
  if (bet.market !== 'OVER_UNDER_2_5') return null;
  if (bet.selection === 'OVER_2_5') {
    return {
      outcome: total >= 3 ? 'WON' : 'LOST',
      result: `${home}-${away}`,
      finalHomeGoals: home,
      finalAwayGoals: away,
    };
  }
  if (bet.selection === 'UNDER_2_5') {
    return {
      outcome: total <= 2 ? 'WON' : 'LOST',
      result: `${home}-${away}`,
      finalHomeGoals: home,
      finalAwayGoals: away,
    };
  }
  return null;
}
