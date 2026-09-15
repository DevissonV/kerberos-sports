/**
 * Adapter local de persistencia de PaperBets sobre SQLite (`node:sqlite`,
 * stdlib de Node, sin dependencias). El dominio no sabe nada de SQLite:
 * este adapter serializa fechas a ISO y mapea errores del store.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import {
  AlreadySettledError,
  assertPlacedBeforeKickoff,
  calculatePnl,
  type PaperBet,
  type PaperBetStatus,
} from '../domain/concepts';
import {
  DuplicatePaperBetError,
  type PaperBetKey,
  type PaperBetStore,
} from '../ports/paperBetStore';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS paper_bets (
    id TEXT PRIMARY KEY,
    cohortId TEXT NOT NULL,
    fixtureId INTEGER NOT NULL,
    league TEXT NOT NULL,
    homeTeam TEXT NOT NULL,
    awayTeam TEXT NOT NULL,
    kickoff TEXT NOT NULL,
    snapshotAt TEXT NOT NULL,
    market TEXT NOT NULL,
    selection TEXT NOT NULL,
    modelVersion TEXT NOT NULL,
    modelProbability REAL NOT NULL,
    fairMarketProbability REAL NOT NULL,
    edge REAL NOT NULL,
    expectedValue REAL NOT NULL,
    bookmaker TEXT NOT NULL,
    placedOdds REAL NOT NULL,
    minimumAcceptableOdds REAL NOT NULL,
    lambdaHome REAL NOT NULL,
    lambdaAway REAL NOT NULL,
    lambdaTotal REAL NOT NULL,
    stake REAL NOT NULL,
    bankrollBefore REAL NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    settledAt TEXT,
    closingOdds REAL,
    result TEXT,
    finalHomeGoals INTEGER,
    finalAwayGoals INTEGER,
    pnl REAL,
    notificationSentAt TEXT,
    UNIQUE (cohortId, fixtureId, market, selection, modelVersion)
  )
`;

const COLUMNS =
  'id, cohortId, fixtureId, league, homeTeam, awayTeam, kickoff, snapshotAt, market, selection, ' +
  'modelVersion, modelProbability, fairMarketProbability, edge, expectedValue, bookmaker, ' +
  'placedOdds, minimumAcceptableOdds, lambdaHome, lambdaAway, lambdaTotal, stake, bankrollBefore, ' +
  'status, createdAt, settledAt, closingOdds, result, finalHomeGoals, finalAwayGoals, pnl, ' +
  'notificationSentAt';

/**
 * Se instancia vía factory provider en `paper-betting.module.ts` (no vía
 * `useClass`), por lo que no necesita `@Injectable()`: Nest no gestiona su
 * construcción.
 */
export class SqlitePaperBetStore implements PaperBetStore {
  private readonly db: Db;
  private readonly insert: ReturnType<Db['prepare']>;
  private readonly updateSettlement: ReturnType<Db['prepare']>;
  private readonly markNotified: ReturnType<Db['prepare']>;

  /** `path` puede ser `:memory:` (tests) o un fichero .sqlite local. */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    migrateLegacySchema(this.db);
    this.db.exec(CREATE_TABLE);
    this.insert = this.db.prepare(
      `INSERT INTO paper_bets (${COLUMNS}) VALUES ` +
        '(:id, :cohortId, :fixtureId, :league, :homeTeam, :awayTeam, :kickoff, :snapshotAt, ' +
        ':market, :selection, :modelVersion, :modelProbability, :fairMarketProbability, :edge, ' +
        ':expectedValue, :bookmaker, :placedOdds, :minimumAcceptableOdds, :lambdaHome, :lambdaAway, ' +
        ':lambdaTotal, :stake, :bankrollBefore, :status, :createdAt, :settledAt, :closingOdds, ' +
        ':result, :finalHomeGoals, :finalAwayGoals, :pnl, :notificationSentAt)',
    );
    this.updateSettlement = this.db.prepare(
      `UPDATE paper_bets SET status = :status, settledAt = :settledAt,
         closingOdds = :closingOdds, result = :result, finalHomeGoals = :finalHomeGoals,
         finalAwayGoals = :finalAwayGoals, pnl = :pnl, notificationSentAt = NULL
       WHERE id = :id`,
    );
    this.markNotified = this.db.prepare(
      'UPDATE paper_bets SET notificationSentAt = :notificationSentAt WHERE id = :id AND status != :open',
    );
  }

  close(): void {
    this.db.close();
  }

  save(bet: PaperBet): void {
    assertPlacedBeforeKickoff(bet.kickoff, bet.createdAt);
    try {
      this.insert.run(serialize(bet));
    } catch (cause) {
      if (isUniqueViolation(cause)) {
        throw new DuplicatePaperBetError({
          cohortId: bet.cohortId,
          fixtureId: bet.fixtureId,
          market: bet.market,
          selection: bet.selection,
          modelVersion: bet.modelVersion,
        });
      }
      throw cause;
    }
  }

  findById(id: string): PaperBet | null {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM paper_bets WHERE id = ?`).get(id);
    return row === undefined ? null : deserialize(row);
  }

  findByIdempotencyKey(key: PaperBetKey): PaperBet | null {
    const row = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM paper_bets WHERE cohortId = ? AND fixtureId = ? AND market = ?
           AND selection = ? AND modelVersion = ?`,
      )
      .get(key.cohortId, key.fixtureId, key.market, key.selection, key.modelVersion);
    return row === undefined ? null : deserialize(row);
  }

  listByStatus(status: PaperBetStatus): PaperBet[] {
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM paper_bets WHERE status = ? ORDER BY createdAt`)
      .all(status);
    return rows.map((row) => deserialize(row as Record<string, unknown>));
  }

  listSettlementPendingNotification(): PaperBet[] {
    const rows = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM paper_bets
         WHERE status IN ('WON', 'LOST', 'VOID') AND notificationSentAt IS NULL
         ORDER BY settledAt`,
      )
      .all();
    return rows.map((row) => deserialize(row as Record<string, unknown>));
  }

  settle(
    id: string,
    outcome: 'WON' | 'LOST' | 'VOID',
    opts?: {
      closingOdds?: number;
      result?: string;
      finalHomeGoals?: number;
      finalAwayGoals?: number;
    },
  ): PaperBet {
    const current = this.findById(id);
    if (current === null) throw new Error(`settle: PaperBet ${id} no existe`);
    if (current.status !== 'OPEN') throw new AlreadySettledError(id);
    const settled: PaperBet = {
      ...current,
      status: outcome,
      settledAt: new Date(),
      closingOdds: opts?.closingOdds,
      result: opts?.result,
      finalHomeGoals: opts?.finalHomeGoals,
      finalAwayGoals: opts?.finalAwayGoals,
      pnl: calculatePnl(outcome, current.stake, current.placedOdds),
    };
    this.updateSettlement.run({
      id: settled.id,
      status: settled.status,
      settledAt: settled.settledAt?.toISOString() ?? null,
      closingOdds: settled.closingOdds ?? null,
      result: settled.result ?? null,
      finalHomeGoals: settled.finalHomeGoals ?? null,
      finalAwayGoals: settled.finalAwayGoals ?? null,
      pnl: settled.pnl ?? null,
    });
    return settled;
  }

  markSettlementNotified(id: string): PaperBet {
    const current = this.findById(id);
    if (current === null) throw new Error(`markSettlementNotified: PaperBet ${id} no existe`);
    if (current.status === 'OPEN')
      throw new Error(`markSettlementNotified: PaperBet ${id} sigue OPEN`);
    if (current.notificationSentAt !== undefined) return current;
    this.markNotified.run({ id, notificationSentAt: new Date().toISOString(), open: 'OPEN' });
    return this.findById(id) ?? current;
  }
}

function isUniqueViolation(cause: unknown): boolean {
  // NOTE: en algunos entornos de test el error de node:sqlite no es instanceof
  // Error; se identifica por mensaje, no por tipo.
  const message = (cause as Error | undefined)?.message;
  return typeof message === 'string' && message.includes('UNIQUE constraint failed');
}

/**
 * Migra una tabla `paper_bets` del esquema antiguo (sin cohortId/snapshotAt/lambdas) al
 * vigente. Los datos PAPER previos se conservan; las columnas nuevas quedan con valores
 * neutros para esas filas. Idempotente: no-op si la tabla ya tiene el esquema actual.
 */
function migrateLegacySchema(db: Db): void {
  const tableInfo = db.prepare('PRAGMA table_info(paper_bets)').all() as { name: string }[];
  if (tableInfo.length === 0) return;
  const has = (name: string): boolean => tableInfo.some((column) => column.name === name);
  const statements = [
    has('cohortId') ? null : `ALTER TABLE paper_bets ADD COLUMN cohortId TEXT NOT NULL DEFAULT ''`,
    has('snapshotAt')
      ? null
      : "ALTER TABLE paper_bets ADD COLUMN snapshotAt TEXT NOT NULL DEFAULT ''",
    has('lambdaHome')
      ? null
      : 'ALTER TABLE paper_bets ADD COLUMN lambdaHome REAL NOT NULL DEFAULT 0',
    has('lambdaAway')
      ? null
      : 'ALTER TABLE paper_bets ADD COLUMN lambdaAway REAL NOT NULL DEFAULT 0',
    has('lambdaTotal')
      ? null
      : 'ALTER TABLE paper_bets ADD COLUMN lambdaTotal REAL NOT NULL DEFAULT 0',
    has('notificationSentAt') ? null : 'ALTER TABLE paper_bets ADD COLUMN notificationSentAt TEXT',
    has('finalHomeGoals') ? null : 'ALTER TABLE paper_bets ADD COLUMN finalHomeGoals INTEGER',
    has('finalAwayGoals') ? null : 'ALTER TABLE paper_bets ADD COLUMN finalAwayGoals INTEGER',
  ];
  for (const statement of statements) {
    if (statement !== null) db.exec(statement);
  }
}

function serialize(bet: PaperBet): Record<string, string | number | null> {
  return {
    id: bet.id,
    cohortId: bet.cohortId,
    fixtureId: bet.fixtureId,
    league: bet.league,
    homeTeam: bet.homeTeam,
    awayTeam: bet.awayTeam,
    kickoff: bet.kickoff.toISOString(),
    snapshotAt: bet.snapshotAt.toISOString(),
    market: bet.market,
    selection: bet.selection,
    modelVersion: bet.modelVersion,
    modelProbability: bet.modelProbability,
    fairMarketProbability: bet.fairMarketProbability,
    edge: bet.edge,
    expectedValue: bet.expectedValue,
    bookmaker: bet.bookmaker,
    placedOdds: bet.placedOdds,
    minimumAcceptableOdds: bet.minimumAcceptableOdds,
    lambdaHome: bet.lambdaHome,
    lambdaAway: bet.lambdaAway,
    lambdaTotal: bet.lambdaTotal,
    stake: bet.stake,
    bankrollBefore: bet.bankrollBefore,
    status: bet.status,
    createdAt: bet.createdAt.toISOString(),
    settledAt: bet.settledAt?.toISOString() ?? null,
    closingOdds: bet.closingOdds ?? null,
    result: bet.result ?? null,
    finalHomeGoals: bet.finalHomeGoals ?? null,
    finalAwayGoals: bet.finalAwayGoals ?? null,
    pnl: bet.pnl ?? null,
    notificationSentAt: bet.notificationSentAt?.toISOString() ?? null,
  };
}

function deserialize(row: Record<string, unknown>): PaperBet {
  return {
    id: row['id'] as string,
    cohortId: row['cohortId'] as string,
    fixtureId: row['fixtureId'] as number,
    league: row['league'] as string,
    homeTeam: row['homeTeam'] as string,
    awayTeam: row['awayTeam'] as string,
    kickoff: new Date(row['kickoff'] as string),
    snapshotAt: new Date(row['snapshotAt'] as string),
    market: row['market'] as string,
    selection: row['selection'] as string,
    modelVersion: row['modelVersion'] as string,
    modelProbability: row['modelProbability'] as number,
    fairMarketProbability: row['fairMarketProbability'] as number,
    edge: row['edge'] as number,
    expectedValue: row['expectedValue'] as number,
    bookmaker: row['bookmaker'] as string,
    placedOdds: row['placedOdds'] as number,
    minimumAcceptableOdds: row['minimumAcceptableOdds'] as number,
    lambdaHome: row['lambdaHome'] as number,
    lambdaAway: row['lambdaAway'] as number,
    lambdaTotal: row['lambdaTotal'] as number,
    stake: row['stake'] as number,
    bankrollBefore: row['bankrollBefore'] as number,
    status: row['status'] as PaperBet['status'],
    createdAt: new Date(row['createdAt'] as string),
    settledAt: row['settledAt'] === null ? undefined : new Date(row['settledAt'] as string),
    closingOdds: row['closingOdds'] === null ? undefined : (row['closingOdds'] as number),
    result: row['result'] === null ? undefined : (row['result'] as string),
    finalHomeGoals: row['finalHomeGoals'] === null ? undefined : (row['finalHomeGoals'] as number),
    finalAwayGoals: row['finalAwayGoals'] === null ? undefined : (row['finalAwayGoals'] as number),
    pnl: row['pnl'] === null ? undefined : (row['pnl'] as number),
    notificationSentAt:
      row['notificationSentAt'] === null || row['notificationSentAt'] === undefined
        ? undefined
        : new Date(row['notificationSentAt'] as string),
  };
}
