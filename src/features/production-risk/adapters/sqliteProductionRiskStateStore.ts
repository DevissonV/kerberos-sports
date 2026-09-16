import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import type { ProductionRiskState } from '../domain/productionRiskGate';
import type { ManualBetRecord, ProductionRiskStateStore } from '../ports/productionRiskStateStore';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS production_risk_manual_bets (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    stakeCop INTEGER NOT NULL CHECK (stakeCop > 0),
    operatorApprovalId TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'SETTLED')),
    pnlCop INTEGER
  )
`;

interface StateRow {
  betsToday: number;
  dailyExposureCop: number;
  dailyLossCop: number;
  openBets: number;
}

/** SQLite local para estado de control; nunca contacta una casa de apuestas. */
export class SqliteProductionRiskStateStore implements ProductionRiskStateStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(CREATE_TABLE);
  }

  close(): void {
    this.db.close();
  }

  getDailyState(day: string): ProductionRiskState {
    assertDay(day);
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS betsToday,
                COALESCE(SUM(stakeCop), 0) AS dailyExposureCop,
                COALESCE(SUM(CASE WHEN pnlCop < 0 THEN -pnlCop ELSE 0 END), 0) AS dailyLossCop,
                COALESCE(SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END), 0) AS openBets
         FROM production_risk_manual_bets
         WHERE day = ?`,
      )
      .get(day);
    return stateFromRow(row);
  }

  recordManualBet(record: ManualBetRecord): void {
    assertDay(record.day);
    assertPositiveInteger(record.stakeCop, 'stakeCop');
    if (record.id.length === 0 || record.operatorApprovalId.length === 0) {
      throw new Error('id y operatorApprovalId son obligatorios');
    }
    this.db
      .prepare(
        `INSERT INTO production_risk_manual_bets
         (id, day, stakeCop, operatorApprovalId, status, pnlCop)
         VALUES (?, ?, ?, ?, 'OPEN', NULL)`,
      )
      .run(record.id, record.day, record.stakeCop, record.operatorApprovalId);
  }

  settleManualBet(id: string, pnlCop: number): void {
    if (!Number.isSafeInteger(pnlCop)) throw new Error('pnlCop debe ser un entero seguro');
    const result = this.db
      .prepare(
        `UPDATE production_risk_manual_bets SET status = 'SETTLED', pnlCop = ?
         WHERE id = ? AND status = 'OPEN'`,
      )
      .run(pnlCop, id);
    if (result.changes !== 1) throw new Error(`No se puede resolver la apuesta manual ${id}`);
  }
}

function assertDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Día operativo inválido: ${day}`);
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo seguro`);
  }
}

function stateFromRow(row: Record<string, unknown> | undefined): StateRow {
  if (row === undefined) throw new Error('SQLite no devolvió estado de riesgo');
  return {
    betsToday: integerColumn(row, 'betsToday'),
    dailyExposureCop: integerColumn(row, 'dailyExposureCop'),
    dailyLossCop: integerColumn(row, 'dailyLossCop'),
    openBets: integerColumn(row, 'openBets'),
  };
}

function integerColumn(row: Record<string, unknown>, name: string): number {
  const value = row[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Estado SQLite inválido en ${name}`);
  }
  return value;
}
