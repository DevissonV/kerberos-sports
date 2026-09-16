import type { ManualBetResult, ManualLedgerEntry } from '../domain/manualLedger';
import type { ManualLedgerStore } from '../ports/manualLedgerStore';

export class ManualLedgerService {
  constructor(private readonly store: ManualLedgerStore) {}

  initializeRealBankroll(initialBankrollCop: number): number {
    return this.store.initializeRealBankroll(initialBankrollCop);
  }
  realBankrollCop(): number {
    return this.store.realBankrollCop();
  }
  recommend(recommendationId: string, now: Date): ManualLedgerEntry {
    return this.store.saveRecommendation(recommendationId, now);
  }
  execute(input: {
    recommendationId: string;
    executionId: string;
    bookmaker: string;
    executedOdds: number;
    executedStakeCop: number;
    executedAt: Date;
    now: Date;
  }): ManualLedgerEntry {
    const { now, ...execution } = input;
    return this.store.execute({ ...execution, createdAt: now });
  }
  settle(input: {
    executionId: string;
    result: ManualBetResult;
    closingOdds?: number;
    now: Date;
  }): ManualLedgerEntry {
    const { now, ...settlement } = input;
    return this.store.settle({ ...settlement, settledAt: now });
  }
}
