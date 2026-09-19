import type { ManualLedgerEntry } from './manualLedger';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';

/** Estadísticas de dinero REAL del día: solo apuestas REAL_MANUAL ejecutadas y liquidadas. */
export interface RealBetsDailyStats {
  executed: number;
  won: number;
  lost: number;
  voided: number;
  pending: number;
  totalStakeCop: number;
  grossReturnCop: number;
  netPnlCop: number;
  /** ROI real ejecutado del día: netPnl / totalStake; null si no hay stake. */
  roi: number | null;
  bankrollBeforeCop: number | null;
  bankrollAfterCop: number | null;
}

/**
 * Puro y determinista: nunca mezcla PREANALYSIS con apuestas reales y siempre retorna
 * N (los contadores existen), incluso si el día no tiene registros (zeros).
 */
export function realBetsDailyStats(
  entries: readonly ManualLedgerEntry[],
  dayBogota: string,
): RealBetsDailyStats {
  const isSameDay = (myDate: Date | undefined): boolean =>
    myDate !== undefined && calendarDateInBogota(myDate) === dayBogota;
  const dateWindow = entries.filter(
    (entry) =>
      (entry.executedAt !== undefined && isSameDay(entry.executedAt)) ||
      (entry.settledAt !== undefined && isSameDay(entry.settledAt)),
  );
  const settled = dateWindow.filter(
    (entry) => entry.status === 'SETTLED' && entry.settledAt && isSameDay(entry.settledAt),
  );
  const pending = dateWindow.filter((entry) => entry.status === 'EXECUTED_MANUALLY');
  const totalStakeCop = settled.reduce((sum, entry) => sum + (entry.executedStakeCop ?? 0), 0);
  const grossReturnCop = settled.reduce((sum, entry) => sum + (entry.grossReturnCop ?? 0), 0);
  const netPnlCop = settled.reduce((sum, entry) => sum + (entry.netPnlCop ?? 0), 0);
  const bankrollBeforeCop =
    pending.length > 0 && pending[0]!.bankrollBeforeCop !== undefined
      ? (pending[0]!.bankrollBeforeCop ?? null)
      : settled.length > 0
        ? (settled[0]?.bankrollBeforeCop ?? null)
        : null;
  const bankrollAfterCop =
    settled.length > 0
      ? (settled[settled.length - 1]!.bankrollAfterCop ?? null)
      : pending.length > 0
        ? (pending[pending.length - 1]!.bankrollAfterCop ?? null)
        : null;
  return {
    executed: dateWindow.length,
    won: settled.filter((entry) => entry.result === 'WIN').length,
    lost: settled.filter((entry) => entry.result === 'LOSS').length,
    voided: settled.filter((entry) => entry.result === 'PUSH' || entry.result === 'VOID').length,
    pending: pending.length,
    totalStakeCop,
    grossReturnCop,
    netPnlCop,
    roi: totalStakeCop > 0 ? netPnlCop / totalStakeCop : null,
    bankrollBeforeCop,
    bankrollAfterCop,
  };
}
