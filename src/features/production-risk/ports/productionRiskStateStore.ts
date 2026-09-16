import type { ProductionRiskState } from '../domain/productionRiskGate';

export const PRODUCTION_RISK_STATE_STORE = Symbol('ProductionRiskStateStore');

export interface ManualBetRecord {
  id: string;
  /** Día operativo UTC al que pertenece el registro, en formato YYYY-MM-DD. */
  day: string;
  stakeCop: number;
  /** Evidencia de que el operador confirmó la ejecución fuera de Kerberos. */
  operatorApprovalId: string;
}

/** Estado durable de apuestas confirmadas manualmente; no ejecuta apuestas. */
export interface ProductionRiskStateStore {
  getDailyState(day: string): ProductionRiskState;
  recordManualBet(record: ManualBetRecord): void;
  settleManualBet(id: string, pnlCop: number): void;
}
