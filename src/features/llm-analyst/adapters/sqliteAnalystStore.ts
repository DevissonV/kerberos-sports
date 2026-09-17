import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import type { AnalystRecord, AnalystStore } from '../ports/analystStore';
import { analystOutputSchema } from '../domain/contracts';

export class SqliteAnalystStore implements AnalystStore {
  private readonly db: Db;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS llm_analyst_context (
      fixtureId TEXT NOT NULL, snapshotAt TEXT NOT NULL, modelVersion TEXT NOT NULL,
      promptVersion TEXT NOT NULL, inputHash TEXT NOT NULL, provider TEXT NOT NULL,
      model TEXT NOT NULL, output TEXT, status TEXT NOT NULL, createdAt TEXT NOT NULL,
      inputTokens INTEGER, outputTokens INTEGER, totalTokens INTEGER,
      UNIQUE (fixtureId, snapshotAt, modelVersion, promptVersion, inputHash)
    )`);
  }
  close(): void {
    this.db.close();
  }
  findByCacheKey(key: string): AnalystRecord | null {
    const [fixtureId, snapshotAt, inputHash, promptVersion] = key.split(':');
    if (!fixtureId || !snapshotAt || !inputHash || !promptVersion) return null;
    const row = this.db
      .prepare(
        'SELECT * FROM llm_analyst_context WHERE fixtureId = ? AND snapshotAt = ? AND inputHash = ? AND promptVersion = ?',
      )
      .get(fixtureId, snapshotAt, inputHash, promptVersion) as Record<string, unknown> | undefined;
    return row === undefined ? null : deserialize(row);
  }
  save(record: AnalystRecord): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO llm_analyst_context
      (fixtureId, snapshotAt, modelVersion, promptVersion, inputHash, provider, model, output, status, createdAt, inputTokens, outputTokens, totalTokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.fixtureId,
        record.snapshotAt.toISOString(),
        record.modelVersion,
        record.promptVersion,
        record.inputHash,
        record.provider,
        record.model,
        record.output === null ? null : JSON.stringify(record.output),
        record.status,
        record.createdAt.toISOString(),
        record.inputTokens ?? null,
        record.outputTokens ?? null,
        record.totalTokens ?? null,
      );
  }
}
function deserialize(row: Record<string, unknown>): AnalystRecord {
  return {
    fixtureId: String(row.fixtureId),
    snapshotAt: new Date(String(row.snapshotAt)),
    modelVersion: String(row.modelVersion),
    promptVersion: String(row.promptVersion),
    inputHash: String(row.inputHash),
    provider: String(row.provider),
    model: String(row.model),
    output:
      row.output === null
        ? null
        : analystOutputSchema.parse(
            JSON.parse(typeof row.output === 'string' ? row.output : JSON.stringify(row.output)),
          ),
    status: row.status as AnalystRecord['status'],
    createdAt: new Date(String(row.createdAt)),
    inputTokens: row.inputTokens === null ? undefined : Number(row.inputTokens),
    outputTokens: row.outputTokens === null ? undefined : Number(row.outputTokens),
    totalTokens: row.totalTokens === null ? undefined : Number(row.totalTokens),
  };
}
