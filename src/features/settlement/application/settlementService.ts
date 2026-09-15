import { Inject, Injectable } from '@nestjs/common';
import { currentPaperBankroll } from '../../bankroll/domain/paperBankroll';
import { INITIAL_BANKROLL } from '../../quant/domain/quantCandidate';
import { NOTIFICATION_PORT } from '../../notifications/ports/notificationPort';
import type { NotificationPort } from '../../notifications/ports/notificationPort';
import { formatSettlementMessage } from '../../notifications/domain/settlementMessage';
import {
  calculateMetrics,
  type MetricsReport,
  type ResolvedBet,
} from '../../paper-betting/domain/metrics';
import { resolveSettlement } from '../../paper-betting/domain/settlement';
import { PAPER_BET_STORE } from '../../paper-betting/ports/paperBetStore';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import type { PaperBetStore } from '../../paper-betting/ports/paperBetStore';
import { RESULTS_PROVIDER } from '../../scanning/ports/resultsProvider';
import type { ResultsProvider } from '../../scanning/ports/resultsProvider';

export interface SettlementSummary {
  inspected: number;
  settled: number;
  skipped: number;
  providerErrors: number;
  telegramSent: number;
  metrics: MetricsReport;
}

@Injectable()
export class SettlementService {
  constructor(
    @Inject(PAPER_BET_STORE) private readonly store: PaperBetStore,
    @Inject(RESULTS_PROVIDER) private readonly results: ResultsProvider,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
  ) {}

  async settleOpenBets(): Promise<SettlementSummary> {
    const open = this.store.listByStatus('OPEN');
    const pendingNotifications = this.store.listSettlementPendingNotification();
    const candidates = uniqueById([...open, ...pendingNotifications]);
    let settled = 0;
    let skipped = 0;
    let providerErrors = 0;
    let telegramSent = 0;

    for (const bet of candidates) {
      let resolved = bet;
      if (bet.status === 'OPEN') {
        let result;
        try {
          result = await this.results.result(String(bet.fixtureId));
        } catch {
          providerErrors += 1;
          skipped += 1;
          continue;
        }
        if (result === null) {
          skipped += 1;
          continue;
        }
        const decision = resolveSettlement(bet, result);
        if (decision === null) {
          skipped += 1;
          continue;
        }
        resolved = this.store.settle(bet.id, decision.outcome, {
          result: decision.result,
          finalHomeGoals: decision.finalHomeGoals,
          finalAwayGoals: decision.finalAwayGoals,
        });
        settled += 1;
      }

      if (resolved.notificationSentAt !== undefined) continue;
      const bankroll = this.currentBankroll();
      try {
        await this.notifications.send(formatSettlementMessage(resolved, bankroll));
        this.store.markSettlementNotified(resolved.id);
        telegramSent += 1;
      } catch {
        // El settlement queda durable; se reintentará sin consultar otra vez el resultado.
      }
    }

    return {
      inspected: candidates.length,
      settled,
      skipped,
      providerErrors,
      telegramSent,
      metrics: this.metrics(),
    };
  }

  apiFootballRequests(): number {
    const provider = this.results as ResultsProvider & { requestCount?: () => number };
    return provider.requestCount?.() ?? 0;
  }

  private currentBankroll(): number {
    const openStakesSum = this.store.listByStatus('OPEN').reduce((sum, bet) => sum + bet.stake, 0);
    const settledPnlSum = (['WON', 'LOST', 'VOID'] as const)
      .flatMap((status) => this.store.listByStatus(status))
      .reduce((sum, bet) => sum + (bet.pnl ?? 0), 0);
    return currentPaperBankroll({
      initialBankroll: INITIAL_BANKROLL,
      openStakesSum,
      settledPnlSum,
    });
  }

  private metrics(): MetricsReport {
    const bets = (['WON', 'LOST', 'VOID'] as const)
      .flatMap((status) => this.store.listByStatus(status))
      .map((bet): ResolvedBet => ({
        id: bet.id,
        modelProbability: bet.modelProbability,
        stake: bet.stake,
        odds: bet.placedOdds,
        result: bet.status as 'WON' | 'LOST' | 'VOID',
        closingOdds: bet.closingOdds,
      }));
    return calculateMetrics(bets, { initialBankroll: INITIAL_BANKROLL });
  }
}

function uniqueById(bets: PaperBet[]): PaperBet[] {
  const seen = new Set<string>();
  return bets.filter((bet) => {
    if (seen.has(bet.id)) return false;
    seen.add(bet.id);
    return true;
  });
}
