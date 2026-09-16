/** Dominio del registro de apuestas que un operador ya ejecutó por su cuenta. */
export type ManualLedgerStatus = 'RECOMMENDED' | 'EXECUTED_MANUALLY' | 'SETTLED';
export type ManualBetResult = 'WIN' | 'LOSS' | 'PUSH' | 'VOID';

export interface ManualLedgerEntry {
  recommendationId: string;
  executionId?: string;
  status: ManualLedgerStatus;
  bookmaker?: string;
  executedOdds?: number;
  executedStakeCop?: number;
  executedAt?: Date;
  result?: ManualBetResult;
  grossReturnCop?: number;
  netPnlCop?: number;
  bankrollBeforeCop?: number;
  bankrollAfterCop?: number;
  closingOdds?: number;
  clv: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementAmounts {
  grossReturnCop: number;
  netPnlCop: number;
}

/** Calcula un settlement sin reloj, I/O ni estado externo. */
export function calculateManualSettlement(
  result: ManualBetResult,
  stakeCop: number,
  odds: number,
): SettlementAmounts {
  assertPositiveInteger(stakeCop, 'executedStakeCop');
  assertOdds(odds, 'executedOdds');
  switch (result) {
    case 'WIN': {
      const grossReturnCop = Math.round(stakeCop * odds);
      return { grossReturnCop, netPnlCop: grossReturnCop - stakeCop };
    }
    case 'LOSS':
      return { grossReturnCop: 0, netPnlCop: -stakeCop };
    case 'PUSH':
    case 'VOID':
      return { grossReturnCop: stakeCop, netPnlCop: 0 };
  }
}

/** Convención de la tarea: cuota tomada / cuota de cierre - 1. */
export function calculateClv(executedOdds: number, closingOdds?: number): number | null {
  assertOdds(executedOdds, 'executedOdds');
  if (closingOdds === undefined) return null;
  assertOdds(closingOdds, 'closingOdds');
  return executedOdds / closingOdds - 1;
}

export function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${field} debe ser un entero positivo`);
}

export function assertOdds(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 1)
    throw new Error(`${field} debe ser una cuota decimal mayor que 1`);
}
