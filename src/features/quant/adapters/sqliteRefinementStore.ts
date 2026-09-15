import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import type { RefinementCounters, RefinementStore } from '../ports/refinementStore';

const ZERO: RefinementCounters = {
  ticks: 0,
  precheckOnly: 0,
  eligibleFixtures: 0,
  decisionSnapshotsCaptured: 0,
  fullOddsScans: 0,
  oddsPapiRequests: 0,
  quantCandidates: 0,
  paperBetsCreated: 0,
  lunaCalls: 0,
  settlements: 0,
  errors: 0,
};

export class SqliteRefinementStore implements RefinementStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decision_snapshots (
        cohortId TEXT NOT NULL, fixtureId TEXT NOT NULL, decisionAt TEXT NOT NULL,
        capturedAt TEXT NOT NULL, PRIMARY KEY (cohortId, fixtureId, decisionAt)
      );
      CREATE TABLE IF NOT EXISTS refinement_daily_counters (
        day TEXT PRIMARY KEY, ticks INTEGER NOT NULL DEFAULT 0,
        precheckOnly INTEGER NOT NULL DEFAULT 0, eligibleFixtures INTEGER NOT NULL DEFAULT 0,
        decisionSnapshotsCaptured INTEGER NOT NULL DEFAULT 0, fullOddsScans INTEGER NOT NULL DEFAULT 0,
        oddsPapiRequests INTEGER NOT NULL DEFAULT 0, quantCandidates INTEGER NOT NULL DEFAULT 0,
        paperBetsCreated INTEGER NOT NULL DEFAULT 0, lunaCalls INTEGER NOT NULL DEFAULT 0,
        settlements INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  claimDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO decision_snapshots (cohortId, fixtureId, decisionAt, capturedAt)
       VALUES (?, ?, ?, ?)`,
      )
      .run(cohortId, fixtureId, decisionAt.toISOString(), new Date().toISOString());
    return result.changes === 1;
  }

  dailyCounters(day: string): RefinementCounters {
    const row = this.db.prepare('SELECT * FROM refinement_daily_counters WHERE day = ?').get(day);
    if (row === undefined) return { ...ZERO };
    return mapCounters(row);
  }

  increment(day: string, delta: Partial<RefinementCounters>): RefinementCounters {
    const current = this.dailyCounters(day);
    const next = { ...current };
    for (const key of Object.keys(ZERO) as (keyof RefinementCounters)[]) {
      next[key] += delta[key] ?? 0;
    }
    this.db
      .prepare(
        `
      INSERT INTO refinement_daily_counters (day, ${Object.keys(ZERO).join(', ')})
      VALUES (?, ${Object.keys(ZERO)
        .map(() => '?')
        .join(', ')})
      ON CONFLICT(day) DO UPDATE SET ${Object.keys(ZERO)
        .map((key) => `${key} = excluded.${key}`)
        .join(', ')}
    `,
      )
      .run(day, ...Object.values(next));
    return next;
  }

  close(): void {
    this.db.close();
  }
}

function mapCounters(row: Record<string, unknown>): RefinementCounters {
  return Object.fromEntries(
    Object.keys(ZERO).map((key) => [key, Number(row[key] ?? 0)]),
  ) as unknown as RefinementCounters;
}
