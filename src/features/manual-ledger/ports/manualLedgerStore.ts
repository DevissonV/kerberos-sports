import type {
  ManualBetResult,
  ManualLedgerEntry,
  ManualLedgerEntrySource,
} from '../domain/manualLedger';

export const MANUAL_LEDGER_STORE = Symbol('ManualLedgerStore');

export interface ManualFixtureIdentity {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffAt: Date;
  selection: string;
}

export interface ExecuteManualBetInput {
  recommendationId: string;
  executionId: string;
  bookmaker: string;
  executedOdds: number;
  executedStakeCop: number;
  executedAt: Date;
  createdAt: Date;
  /** Identidad completa del fixture: el registro real es incompleto sin ella. */
  identity: ManualFixtureIdentity;
  /** Origen del registro; el servicio lo decide (Kerberos vs externo). */
  entrySource?: ManualLedgerEntrySource;
}

export interface SettleManualBetInput {
  executionId: string;
  result: ManualBetResult;
  closingOdds?: number;
  settledAt: Date;
}

export interface ManualLedgerStore {
  initializeRealBankroll(initialBankrollCop: number): number;
  realBankrollCop(): number;
  saveRecommendation(recommendationId: string, createdAt: Date): ManualLedgerEntry;
  execute(input: ExecuteManualBetInput): ManualLedgerEntry;
  settle(input: SettleManualBetInput): ManualLedgerEntry;
  findByRecommendationId(recommendationId: string): ManualLedgerEntry | null;
  findByExecutionId(executionId: string): ManualLedgerEntry | null;
  listEntries(): ManualLedgerEntry[];
  /** Ejecutadas/no liquidadas sin notificación: para el envío único de Telegram. */
  markTelegramNotified(executionId: string, notifiedAt: Date, event?: 'EXECUTED' | 'SETTLED'): void;
}

export class DuplicateManualExecutionError extends Error {
  constructor(readonly id: string) {
    super(`La ejecución manual ya existe: ${id}`);
    this.name = 'DuplicateManualExecutionError';
  }
}

export class AlreadyManualSettledError extends Error {
  constructor(readonly executionId: string) {
    super(`La ejecución manual ya fue liquidada: ${executionId}`);
    this.name = 'AlreadyManualSettledError';
  }
}
