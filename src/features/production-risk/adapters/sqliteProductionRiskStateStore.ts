import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import type { ProductionRiskState } from '../domain/productionRiskGate';
import type {
  ManualBetRecord,
  ManualRiskBet,
  ProductionRiskStateStore,
} from '../ports/productionRiskStateStore';

const TABLE = 'production_risk_manual_bets';

/**
 * Esquema v2 (H4/H5/H6 — KSS-RISK-ODDS-INTEGRITY-02): añade el estado RESERVED
 * (reserva durable del Risk Gate) y la selección autorizada para validar la
 * ejecución manual. El esquema antiguo solo admitía OPEN/SETTLED.
 */
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    stakeCop INTEGER NOT NULL CHECK (stakeCop > 0),
    operatorApprovalId TEXT NOT NULL,
    selection TEXT,
    status TEXT NOT NULL CHECK (status IN ('RESERVED', 'OPEN', 'SETTLED')),
    pnlCop INTEGER
  )
`;

/** Estado de riesgo: openBets y exposición incluyen la reserva pendiente de ejecutar. */
interface StateRow {
  betsToday: number;
  dailyExposureCop: number;
  dailyLossCop: number;
  openBets: number;
}

/** sqlite local para estado de control; nunca contacta una casa de apuestas. */
export class SqliteProductionRiskStateStore implements ProductionRiskStateStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  getDailyState(day: string): ProductionRiskState {
    assertDay(day);
    const row = this.db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM ${TABLE}
            WHERE day = ? AND status IN ('OPEN', 'SETTLED')) AS betsToday,
          (SELECT COALESCE(SUM(stakeCop), 0) FROM ${TABLE}
            WHERE day = ?) AS dailyExposureCop,
          (SELECT COALESCE(SUM(CASE WHEN pnlCop < 0 THEN -pnlCop ELSE 0 END), 0)
            FROM ${TABLE} WHERE day = ?) AS dailyLossCop,
          -- Una OPEN/RESERVED del día anterior sigue consumiendo el cupo hoy
          -- (invariante cross-day: nada desaparece del límite hasta settled/void).
          (SELECT COUNT(*) FROM ${TABLE}
            WHERE status IN ('RESERVED', 'OPEN')) AS openBets`,
      )
      .get(day, day, day);
    return stateFromRow(row);
  }

  /** Reserva durable (slot de open + exposición + stake). Idempotente por id. */
  reserveBet(record: ManualBetRecord): boolean {
    assertManualBetRecord(record);
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO ${TABLE}
         (id, day, stakeCop, operatorApprovalId, selection, status, pnlCop)
         VALUES (?, ?, ?, ?, ?, 'RESERVED', NULL)`,
      )
      .run(
        record.id,
        record.day,
        record.stakeCop,
        record.operatorApprovalId,
        record.selection ?? null,
      );
    return result.changes === 1;
  }

  recordManualBet(record: ManualBetRecord): void {
    assertManualBetRecord(record);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO ${TABLE}
           (id, day, stakeCop, operatorApprovalId, selection, status, pnlCop)
           VALUES (?, ?, ?, ?, ?, 'OPEN', NULL)`,
        )
        .run(
          record.id,
          record.day,
          record.stakeCop,
          record.operatorApprovalId,
          record.selection ?? null,
        );
      // Convierte una reserva previa en apuesta abierta con el stake ejecutado.
      this.db
        .prepare(
          `UPDATE ${TABLE} SET day = :day, stakeCop = :stakeCop, status = 'OPEN'
           WHERE id = :id AND status = 'RESERVED'`,
        )
        .run({ id: record.id, day: record.day, stakeCop: record.stakeCop });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  findManualBet(id: string): ManualRiskBet | null {
    if (id.length === 0) return null;
    const row = this.db
      .prepare(`SELECT id, day, stakeCop, selection, status FROM ${TABLE} WHERE id = ?`)
      .get(id) as
      | { id: string; day: string; stakeCop: number; selection: string | null; status: string }
      | undefined;
    if (row === undefined) return null;
    return {
      id: row.id,
      day: row.day,
      stakeCop: row.stakeCop,
      selection: row.selection ?? undefined,
      status: row.status as ManualRiskBet['status'],
    };
  }

  settleManualBet(id: string, pnlCop: number): void {
    if (!Number.isSafeInteger(pnlCop)) throw new Error('pnlCop debe ser un entero seguro');
    const result = this.db
      .prepare(
        `UPDATE ${TABLE} SET status = 'SETTLED', pnlCop = ?
         WHERE id = ? AND status IN ('OPEN', 'RESERVED')`,
      )
      .run(pnlCop, id);
    if (result.changes !== 1) throw new Error(`No se puede resolver la apuesta manual ${id}`);
  }

  private migrate(): void {
    const existing = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'production_risk_manual_bets'",
      )
      .get();
    if (existing === undefined) {
      this.db.exec(CREATE_TABLE);
      return;
    }
    const columns = this.db.prepare(`PRAGMA table_info(${TABLE})`).all() as { name: string }[];
    const hasSelection = columns.some((column) => column.name === 'selection');
    if (!hasSelection) {
      // Reconstrucción preservando filas para el esquema antiguo (sin selección).
      this.db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE production_risk_manual_bets_rebuild AS SELECT * FROM ${TABLE};
        DROP TABLE ${TABLE};
        COMMIT;
      `);
      this.db.exec(CREATE_TABLE);
      this.db.exec(`
        INSERT OR IGNORE INTO ${TABLE}
          (id, day, stakeCop, operatorApprovalId, selection, status, pnlCop)
        SELECT id, day, stakeCop, operatorApprovalId, NULL, status, pnlCop
        FROM production_risk_manual_bets_rebuild;
        DROP TABLE production_risk_manual_bets_rebuild;
      `);
      return;
    }
    if (!columns.some((column) => column.name === 'pnlCop')) {
      this.db.exec(`ALTER TABLE ${TABLE} ADD COLUMN pnlCop INTEGER;`);
    }
  }
}

function assertDay(day: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Día operativo inválido: ${day}`);
}

function assertManualBetRecord(record: ManualBetRecord): void {
  assertDay(record.day);
  assertPositiveInteger(record.stakeCop, 'stakeCop');
  if (record.id.length === 0 || record.operatorApprovalId.length === 0) {
    throw new Error('id y operatorApprovalId son obligatorios');
  }
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
