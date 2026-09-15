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
    fixtureId INTEGER NOT NULL,
    league TEXT NOT NULL,
    homeTeam TEXT NOT NULL,
    awayTeam TEXT NOT NULL,
    kickoff TEXT NOT NULL,
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
    stake REAL NOT NULL,
    bankrollBefore REAL NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    settledAt TEXT,
    closingOdds REAL,
    result TEXT,
    pnl REAL,
    UNIQUE (fixtureId, market, selection, modelVersion)
  )
`;

const COLUMNS =
  'id, fixtureId, league, homeTeam, awayTeam, kickoff, market, selection, modelVersion, ' +
  'modelProbability, fairMarketProbability, edge, expectedValue, bookmaker, placedOdds, ' +
  'minimumAcceptableOdds, stake, bankrollBefore, status, createdAt, settledAt, closingOdds, ' +
  'result, pnl';

/**
 * Se instancia vía factory provider en `paper-betting.module.ts` (no vía
 * `useClass`), por lo que no necesita `@Injectable()`: Nest no gestiona su
 * construcción.
 */
export class SqlitePaperBetStore implements PaperBetStore {
  private readonly db: Db;
  private readonly insert: ReturnType<Db['prepare']>;
  private readonly updateSettlement: ReturnType<Db['prepare']>;

  /** `path` puede ser `:memory:` (tests) o un fichero .sqlite local. */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(CREATE_TABLE);
    this.insert = this.db.prepare(
      `INSERT INTO paper_bets (${COLUMNS}) VALUES ` +
        '(:id, :fixtureId, :league, :homeTeam, :awayTeam, :kickoff, :market, :selection, ' +
        ':modelVersion, :modelProbability, :fairMarketProbability, :edge, :expectedValue, ' +
        ':bookmaker, :placedOdds, :minimumAcceptableOdds, :stake, :bankrollBefore, :status, ' +
        ':createdAt, :settledAt, :closingOdds, :result, :pnl)',
    );
    this.updateSettlement = this.db.prepare(
      `UPDATE paper_bets SET status = :status, settledAt = :settledAt,
         closingOdds = :closingOdds, result = :result, pnl = :pnl
       WHERE id = :id`,
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
        `SELECT ${COLUMNS} FROM paper_bets WHERE fixtureId = ? AND market = ?
           AND selection = ? AND modelVersion = ?`,
      )
      .get(key.fixtureId, key.market, key.selection, key.modelVersion);
    return row === undefined ? null : deserialize(row);
  }

  listByStatus(status: PaperBetStatus): PaperBet[] {
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM paper_bets WHERE status = ? ORDER BY createdAt`)
      .all(status);
    return rows.map((row) => deserialize(row as Record<string, unknown>));
  }

  settle(
    id: string,
    outcome: 'WON' | 'LOST' | 'VOID',
    opts?: { closingOdds?: number; result?: string },
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
      pnl: calculatePnl(outcome, current.stake, current.placedOdds),
    };
    this.updateSettlement.run({
      id: settled.id,
      status: settled.status,
      settledAt: settled.settledAt?.toISOString() ?? null,
      closingOdds: settled.closingOdds ?? null,
      result: settled.result ?? null,
      pnl: settled.pnl ?? null,
    });
    return settled;
  }
}

function isUniqueViolation(cause: unknown): boolean {
  // NOTE: en algunos entornos de test el error de node:sqlite no es instanceof
  // Error; se identifica por mensaje, no por tipo.
  const message = (cause as Error | undefined)?.message;
  return typeof message === 'string' && message.includes('UNIQUE constraint failed');
}

function serialize(bet: PaperBet): Record<string, string | number | null> {
  return {
    id: bet.id,
    fixtureId: bet.fixtureId,
    league: bet.league,
    homeTeam: bet.homeTeam,
    awayTeam: bet.awayTeam,
    kickoff: bet.kickoff.toISOString(),
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
    stake: bet.stake,
    bankrollBefore: bet.bankrollBefore,
    status: bet.status,
    createdAt: bet.createdAt.toISOString(),
    settledAt: bet.settledAt?.toISOString() ?? null,
    closingOdds: bet.closingOdds ?? null,
    result: bet.result ?? null,
    pnl: bet.pnl ?? null,
  };
}

function deserialize(row: Record<string, unknown>): PaperBet {
  return {
    id: row['id'] as string,
    fixtureId: row['fixtureId'] as number,
    league: row['league'] as string,
    homeTeam: row['homeTeam'] as string,
    awayTeam: row['awayTeam'] as string,
    kickoff: new Date(row['kickoff'] as string),
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
    stake: row['stake'] as number,
    bankrollBefore: row['bankrollBefore'] as number,
    status: row['status'] as PaperBet['status'],
    createdAt: new Date(row['createdAt'] as string),
    settledAt: row['settledAt'] === null ? undefined : new Date(row['settledAt'] as string),
    closingOdds: row['closingOdds'] === null ? undefined : (row['closingOdds'] as number),
    result: row['result'] === null ? undefined : (row['result'] as string),
    pnl: row['pnl'] === null ? undefined : (row['pnl'] as number),
  };
}
