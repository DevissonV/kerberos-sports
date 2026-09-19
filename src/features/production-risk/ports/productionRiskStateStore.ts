import type { ProductionRiskState } from '../domain/productionRiskGate';

export const PRODUCTION_RISK_STATE_STORE = Symbol('ProductionRiskStateStore');

export interface ManualBetRecord {
  id: string;
  /**
   * Día operativo (formato YYYY-MM-DD, convención UTC) al que se atribuye la
   * exposición. La frontera diaria del riesgo es UTC; los reportes de usuario
   * usan America/Bogota (convención documentada en KSS-AUTHORIZATION-FLOW.md).
   */
  day: string;
  stakeCop: number;
  /** Evidencia de que el operador confirmó la ejecución fuera de Kerberos. */
  operatorApprovalId: string;
  /** Selección autorizada (para validar la ejecución manual en REAL_MANUAL). */
  selection?: string;
}

export type ManualRiskBetStatus = 'RESERVED' | 'OPEN' | 'SETTLED';

/** Registro de apuesta en el estado de riesgo (reserva, apuesta abierta o resuelta). */
export interface ManualRiskBet {
  id: string;
  day: string;
  stakeCop: number;
  selection?: string;
  status: ManualRiskBetStatus;
}

/**
 * Estado durable de apuestas del Risk Gate; no ejecuta apuestas.
 * Una reserva RESERVED consume slot/exposición hasta que se ejecuta o resuelve.
 */
export interface ProductionRiskStateStore {
  getDailyState(day: string): ProductionRiskState;
  /** Reserva durable para una recomendación APPROVED (false si ya existía). */
  reserveBet(record: ManualBetRecord): boolean;
  /** Registra/abre una apuesta confirmada manualmente (convierte reserva en OPEN). */
  recordManualBet(record: ManualBetRecord): void;
  findManualBet(id: string): ManualRiskBet | null;
  settleManualBet(id: string, pnlCop: number): void;
}
