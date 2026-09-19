import type { RealBetsDailyStats } from '../../manual-ledger/domain/realBetsStats';

export const REAL_BETS_SUMMARY = Symbol('RealBetsSummary');

/** Acceso de solo lectura a las estadísticas de dinero REAL para el resumen nocturno. */
export interface RealBetsSummary {
  daily(dayBogota: string): RealBetsDailyStats;
}
