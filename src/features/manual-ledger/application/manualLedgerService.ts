import type { ManualBetResult, ManualLedgerEntry } from '../domain/manualLedger';
import type { ManualLedgerStore } from '../ports/manualLedgerStore';
import type { ProductionRiskStateStore } from '../../production-risk/ports/productionRiskStateStore';

export class ManualLedgerService {
  constructor(
    private readonly store: ManualLedgerStore,
    private readonly riskStateStore: ProductionRiskStateStore,
  ) {}

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
    const entry = this.store.execute({ ...execution, createdAt: now });
    this.riskStateStore.recordManualBet({
      id: input.executionId,
      day: utcDay(input.executedAt),
      stakeCop: input.executedStakeCop,
      operatorApprovalId: input.executionId,
    });
    return entry;
  }
  settle(input: {
    executionId: string;
    result: ManualBetResult;
    closingOdds?: number;
    now: Date;
  }): ManualLedgerEntry {
    const { now, ...settlement } = input;
    const entry = this.store.settle({ ...settlement, settledAt: now });
    if (entry.netPnlCop === undefined) throw new Error('Settlement manual sin PnL');
    this.riskStateStore.settleManualBet(input.executionId, entry.netPnlCop);
    return entry;
  }
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}
