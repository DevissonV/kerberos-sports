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

/**
 * Estados del claim T-6 (#13): PENDING (liberado, retry en el próximo tick),
 * PROCESSING (en curso, con lease) y COMPLETED (decisión registrada, idempotente).
 * Filas legacy (sin columna status) migran a COMPLETED: la semántica antigua era
 * "claimed para siempre" y no se re-deciden retroactivamente.
 */
export const DECISION_CLAIM_LEASE_MS = 30 * 60 * 1000;

export class SqliteRefinementStore implements RefinementStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS refinement_heartbeats (
        tickId TEXT PRIMARY KEY, sentAt TEXT NOT NULL
      );
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
    this.migrateDecisionSnapshots();
  }

  private migrateDecisionSnapshots(): void {
    const columns = this.db.prepare('PRAGMA table_info(decision_snapshots)').all() as {
      name: string;
    }[];
    const known = new Set(columns.map((column) => column.name));
    if (!known.has('status')) {
      this.db.exec(
        "ALTER TABLE decision_snapshots ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED'",
      );
    }
    if (!known.has('claimedAt')) {
      this.db.exec('ALTER TABLE decision_snapshots ADD COLUMN claimedAt TEXT');
    }
  }

  claimHeartbeat(tickId: string): boolean {
    const result = this.db
      .prepare('INSERT OR IGNORE INTO refinement_heartbeats (tickId, sentAt) VALUES (?, ?)')
      .run(tickId, new Date().toISOString());
    return result.changes === 1;
  }

  /**
   * Claim T-6 recuperable: true si la decisión pasa a estar EN PROCESO por esta
   * corrida. Un COMPLETED nunca se vuelve a reclamar (idempotencia); un PROCESSING
   * cuyo lease expiró (crash previo) sí se puede reclamar de nuevo; las liberadas
   * (PENDING) se reclaman en el primer tick siguiente.
   */
  claimDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO decision_snapshots
         (cohortId, fixtureId, decisionAt, capturedAt, status, claimedAt)
         VALUES (?, ?, ?, ?, 'PROCESSING', ?)`,
      )
      .run(
        cohortId,
        fixtureId,
        decisionAt.toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );
    if (result.changes === 1) return true;
    const row = this.db
      .prepare(
        'SELECT status, claimedAt FROM decision_snapshots WHERE cohortId = ? AND fixtureId = ? AND decisionAt = ?',
      )
      .get(cohortId, fixtureId, decisionAt.toISOString()) as
      { status: string; claimedAt: string | null } | undefined;
    if (row?.status !== 'PENDING' && row?.status !== 'PROCESSING') return false;
    if (row.status === 'PROCESSING' && !leaseExpired(row.claimedAt)) return false;
    const claimed = this.db
      .prepare(
        `UPDATE decision_snapshots SET status = 'PROCESSING', claimedAt = ?
         WHERE cohortId = ? AND fixtureId = ? AND decisionAt = ?
           AND (status = 'PENDING' OR status = 'PROCESSING')
           AND (claimedAt IS NULL OR status = 'PENDING' OR claimedAt <= ?)`,
      )
      .run(
        new Date().toISOString(),
        cohortId,
        fixtureId,
        decisionAt.toISOString(),
        new Date(new Date().getTime() - DECISION_CLAIM_LEASE_MS).toISOString(),
      );
    return claimed.changes === 1;
  }

  /** Confirma la decisión persistida: el claim queda idempotente (nunca se re-intenta). */
  completeDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): void {
    this.db
      .prepare(
        `UPDATE decision_snapshots SET status = 'COMPLETED'
         WHERE cohortId = ? AND fixtureId = ? AND decisionAt = ?`,
      )
      .run(cohortId, fixtureId, decisionAt.toISOString());
  }

  /** Libera un claim interrumpido para que el próximo tick reintente (#14). */
  failDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): void {
    this.db
      .prepare(
        `UPDATE decision_snapshots SET status = 'PENDING'
         WHERE cohortId = ? AND fixtureId = ? AND decisionAt = ? AND status = 'PROCESSING'`,
      )
      .run(cohortId, fixtureId, decisionAt.toISOString());
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

function leaseExpired(claimedAt: string | null): boolean {
  if (claimedAt === null) return true;
  const claimed = new Date(claimedAt);
  if (Number.isNaN(claimed.getTime())) return true;
  return new Date().getTime() - claimed.getTime() >= DECISION_CLAIM_LEASE_MS;
}
