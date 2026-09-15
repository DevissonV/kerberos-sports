import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import type { LunaShadowRecord } from '../ports/lunaShadowStore';
import type { LunaShadowStore } from '../ports/lunaShadowStore';

const TABLE = `CREATE TABLE IF NOT EXISTS luna_shadow_evaluations (
  cohortId TEXT NOT NULL, fixtureId TEXT NOT NULL, snapshotAt TEXT NOT NULL,
  snapshotHash TEXT NOT NULL, snapshotVersion TEXT NOT NULL, promptVersion TEXT NOT NULL,
  modelVersion TEXT NOT NULL, pOver REAL NOT NULL, pUnder REAL NOT NULL,
  confidence TEXT NOT NULL, decision TEXT NOT NULL, reasons TEXT NOT NULL,
  riskFlags TEXT NOT NULL, createdAt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'SUCCESS',
  inputTokens INTEGER, outputTokens INTEGER, totalTokens INTEGER,
  UNIQUE (fixtureId, snapshotVersion, snapshotHash, promptVersion, modelVersion)
)`;

/** Persistencia local e inmutable de evaluaciones shadow; no participa en PaperBet. */
export class SqliteLunaShadowStore implements LunaShadowStore {
  private readonly db: Db;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(TABLE);
    for (const statement of [
      "ALTER TABLE luna_shadow_evaluations ADD COLUMN status TEXT NOT NULL DEFAULT 'SUCCESS'",
      'ALTER TABLE luna_shadow_evaluations ADD COLUMN inputTokens INTEGER',
      'ALTER TABLE luna_shadow_evaluations ADD COLUMN outputTokens INTEGER',
      'ALTER TABLE luna_shadow_evaluations ADD COLUMN totalTokens INTEGER',
    ]) {
      try {
        this.db.exec(statement);
      } catch {
        // La columna ya existe en bases locales creadas por esta versión.
      }
    }
  }

  close(): void {
    this.db.close();
  }

  findByCacheKey(key: string): LunaShadowRecord | null {
    const parts = key.split(':');
    if (parts.length !== 5) return null;
    const fixtureId = parts[0]!;
    const snapshotVersion = parts[1]!;
    const snapshotHash = parts[2]!;
    const promptVersion = parts[3]!;
    const modelVersion = parts[4]!;
    const row = this.db
      .prepare(
        'SELECT * FROM luna_shadow_evaluations WHERE fixtureId = ? AND snapshotVersion = ? AND snapshotHash = ? AND promptVersion = ? AND modelVersion = ?',
      )
      .get(fixtureId, snapshotVersion, snapshotHash, promptVersion, modelVersion);
    return row === undefined ? null : deserialize(row);
  }

  save(record: LunaShadowRecord): void {
    this.db
      .prepare(
        `INSERT INTO luna_shadow_evaluations
      (cohortId, fixtureId, snapshotAt, snapshotHash, snapshotVersion, promptVersion, modelVersion,
       pOver, pUnder, confidence, decision, reasons, riskFlags, createdAt, status,
       inputTokens, outputTokens, totalTokens)
      VALUES (:cohortId, :fixtureId, :snapshotAt, :snapshotHash, :snapshotVersion, :promptVersion,
       :modelVersion, :pOver, :pUnder, :confidence, :decision, :reasons, :riskFlags, :createdAt,
       :status, :inputTokens, :outputTokens, :totalTokens)`,
      )
      .run({
        ...record,
        snapshotAt: record.snapshotAt.toISOString(),
        reasons: JSON.stringify(record.reasons),
        riskFlags: JSON.stringify(record.riskFlags),
        createdAt: record.createdAt.toISOString(),
      });
  }
}

function deserialize(row: Record<string, unknown>): LunaShadowRecord {
  return {
    cohortId: String(row.cohortId),
    fixtureId: String(row.fixtureId),
    snapshotAt: new Date(String(row.snapshotAt)),
    snapshotHash: String(row.snapshotHash),
    snapshotVersion: String(row.snapshotVersion),
    promptVersion: String(row.promptVersion),
    modelVersion: String(row.modelVersion),
    pOver: Number(row.pOver),
    pUnder: Number(row.pUnder),
    confidence: row.confidence as LunaShadowRecord['confidence'],
    decision: row.decision as LunaShadowRecord['decision'],
    reasons: JSON.parse(String(row.reasons)) as string[],
    riskFlags: JSON.parse(String(row.riskFlags)) as string[],
    createdAt: new Date(String(row.createdAt)),
    status: row.status as LunaShadowRecord['status'],
    inputTokens: row.inputTokens === null ? undefined : Number(row.inputTokens),
    outputTokens: row.outputTokens === null ? undefined : Number(row.outputTokens),
    totalTokens: row.totalTokens === null ? undefined : Number(row.totalTokens),
  };
}
