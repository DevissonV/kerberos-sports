import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import {
  assertPositiveInteger,
  calculateClv,
  calculateManualSettlement,
  type ManualLedgerEntry,
} from '../domain/manualLedger';
import {
  AlreadyManualSettledError,
  DuplicateManualExecutionError,
  type ExecuteManualBetInput,
  type ManualLedgerStore,
  type SettleManualBetInput,
} from '../ports/manualLedgerStore';

const MIGRATION_ID = 'KS-03-MANUAL-LEDGER-01';
/**
 * El esquema original usaba nombres de columna camelCase; las columnas nuevas siguen la
 * misma convención y se añaden con ALTER idempotente para no romper ledgers existentes.
 */
const COLUMNS = `recommendationId, executionId, status, bookmaker, executedOdds, executedStakeCop,
  executedAt, result, grossReturnCop, netPnlCop, bankrollBeforeCop, bankrollAfterCop, closingOdds,
  clv, createdAt, updatedAt, homeTeam, awayTeam, competition, kickoffAt, selection, executionMode,
  settledAt, telegramNotifiedAt, settledNotifiedAt, entrySource`;

/** Adaptador SQLite local del ledger real, deliberadamente separado de PaperBetStore. */
export class SqliteManualLedgerStore implements ManualLedgerStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  initializeRealBankroll(initialBankrollCop: number): number {
    assertPositiveInteger(initialBankrollCop, 'initialBankrollCop');
    this.db
      .prepare('INSERT OR IGNORE INTO manual_ledger_bankroll (id, amountCop) VALUES (1, ?)')
      .run(initialBankrollCop);
    return this.realBankrollCop();
  }

  realBankrollCop(): number {
    const row = this.db
      .prepare('SELECT amountCop FROM manual_ledger_bankroll WHERE id = 1')
      .get() as { amountCop: number } | undefined;
    if (row === undefined) throw new Error('El bankroll real no ha sido inicializado');
    return row.amountCop;
  }

  saveRecommendation(recommendationId: string, createdAt: Date): ManualLedgerEntry {
    const existing = this.findByRecommendationId(recommendationId);
    if (existing !== null) return existing;
    this.db
      .prepare(
        `INSERT INTO manual_ledger_entries (recommendationId, executionId, status, createdAt, updatedAt)
       VALUES (:recommendationId, NULL, 'RECOMMENDED', :createdAt, :updatedAt)`,
      )
      .run({
        recommendationId,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      });
    return this.findByRecommendationId(recommendationId) as ManualLedgerEntry;
  }

  execute(input: ExecuteManualBetInput): ManualLedgerEntry {
    validateExecution(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const byExecution = this.findByExecutionId(input.executionId);
      if (byExecution !== null) {
        this.db.exec('COMMIT');
        return byExecution;
      }
      const existing = this.findByRecommendationId(input.recommendationId);
      if (existing !== null && existing.status !== 'RECOMMENDED') {
        throw new DuplicateManualExecutionError(input.recommendationId);
      }
      const bankrollBeforeCop = this.realBankrollCop();
      if (input.executedStakeCop > bankrollBeforeCop)
        throw new Error('Saldo real insuficiente para la ejecución manual');
      const bankrollAfterCop = bankrollBeforeCop - input.executedStakeCop;
      if (existing === null) {
        this.db
          .prepare(
            `INSERT INTO manual_ledger_entries (${COLUMNS}) VALUES
           (:recommendationId, :executionId, 'EXECUTED_MANUALLY', :bookmaker, :executedOdds,
            :executedStakeCop, :executedAt, NULL, NULL, NULL, :bankrollBeforeCop, :bankrollAfterCop,
            NULL, NULL, :createdAt, :updatedAt, :homeTeam, :awayTeam, :competition, :kickoffAt,
            :selection, 'REAL_MANUAL', NULL, NULL, NULL, :entrySource)`,
          )
          .run({
            recommendationId: input.recommendationId,
            executionId: input.executionId,
            bookmaker: input.bookmaker,
            executedOdds: input.executedOdds,
            executedStakeCop: input.executedStakeCop,
            executedAt: input.executedAt.toISOString(),
            bankrollBeforeCop,
            bankrollAfterCop,
            createdAt: input.createdAt.toISOString(),
            updatedAt: input.createdAt.toISOString(),
            homeTeam: input.identity.homeTeam,
            awayTeam: input.identity.awayTeam,
            competition: input.identity.competition,
            kickoffAt: input.identity.kickoffAt.toISOString(),
            selection: input.identity.selection,
            entrySource: input.entrySource ?? 'EXTERNAL_MANUAL_ENTRY',
          });
      } else {
        this.db
          .prepare(
            `UPDATE manual_ledger_entries SET executionId = :executionId, status = 'EXECUTED_MANUALLY',
          bookmaker = :bookmaker, executedOdds = :executedOdds, executedStakeCop = :executedStakeCop,
           executedAt = :executedAt, bankrollBeforeCop = :bankrollBeforeCop,
           bankrollAfterCop = :bankrollAfterCop, updatedAt = :updatedAt,
           homeTeam = :homeTeam, awayTeam = :awayTeam, competition = :competition,
           kickoffAt = :kickoffAt, selection = :selection, executionMode = 'REAL_MANUAL',
           entrySource = :entrySource
           WHERE recommendationId = :recommendationId`,
          )
          .run({
            recommendationId: input.recommendationId,
            executionId: input.executionId,
            bookmaker: input.bookmaker,
            executedOdds: input.executedOdds,
            executedStakeCop: input.executedStakeCop,
            executedAt: input.executedAt.toISOString(),
            bankrollBeforeCop,
            bankrollAfterCop,
            updatedAt: input.createdAt.toISOString(),
            homeTeam: input.identity.homeTeam,
            awayTeam: input.identity.awayTeam,
            competition: input.identity.competition,
            kickoffAt: input.identity.kickoffAt.toISOString(),
            selection: input.identity.selection,
            entrySource: input.entrySource ?? 'EXTERNAL_MANUAL_ENTRY',
          });
      }
      this.db
        .prepare('UPDATE manual_ledger_bankroll SET amountCop = ? WHERE id = 1')
        .run(bankrollAfterCop);
      this.db.exec('COMMIT');
      return this.findByExecutionId(input.executionId) as ManualLedgerEntry;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  settle(input: SettleManualBetInput): ManualLedgerEntry {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.findByExecutionId(input.executionId);
      if (current === null) throw new Error(`La ejecución manual no existe: ${input.executionId}`);
      if (current.status === 'SETTLED') throw new AlreadyManualSettledError(input.executionId);
      if (
        current.status !== 'EXECUTED_MANUALLY' ||
        current.executedOdds === undefined ||
        current.executedStakeCop === undefined
      ) {
        throw new Error(`La ejecución manual no está lista para liquidar: ${input.executionId}`);
      }
      const amounts = calculateManualSettlement(
        input.result,
        current.executedStakeCop,
        current.executedOdds,
      );
      const bankrollAfterCop = this.realBankrollCop() + amounts.grossReturnCop;
      const closingOdds = input.closingOdds ?? null;
      const clv = calculateClv(current.executedOdds, input.closingOdds);
      this.db
        .prepare(
          `UPDATE manual_ledger_entries SET status = 'SETTLED', result = :result,
         grossReturnCop = :grossReturnCop, netPnlCop = :netPnlCop, bankrollAfterCop = :bankrollAfterCop,
         closingOdds = :closingOdds, clv = :clv, updatedAt = :updatedAt, settledAt = :settledAt
         WHERE executionId = :executionId`,
        )
        .run({
          ...amounts,
          executionId: input.executionId,
          result: input.result,
          bankrollAfterCop,
          closingOdds,
          clv,
          updatedAt: input.settledAt.toISOString(),
          settledAt: input.settledAt.toISOString(),
        });
      this.db
        .prepare('UPDATE manual_ledger_bankroll SET amountCop = ? WHERE id = 1')
        .run(bankrollAfterCop);
      this.db.exec('COMMIT');
      return this.findByExecutionId(input.executionId) as ManualLedgerEntry;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  findByRecommendationId(recommendationId: string): ManualLedgerEntry | null {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM manual_ledger_entries WHERE recommendationId = ?`)
      .get(recommendationId);
    return row === undefined ? null : deserialize(row);
  }

  findByExecutionId(executionId: string): ManualLedgerEntry | null {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM manual_ledger_entries WHERE executionId = ?`)
      .get(executionId);
    return row === undefined ? null : deserialize(row);
  }

  listEntries(): ManualLedgerEntry[] {
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM manual_ledger_entries ORDER BY createdAt ASC`)
      .all() as unknown[];
    return rows.map((row) => deserialize(row as Record<string, unknown>));
  }

  /** Idempotente: la segunda marca no reenvía el mensaje del mismo evento. */
  markTelegramNotified(
    executionId: string,
    notifiedAt: Date,
    event: 'EXECUTED' | 'SETTLED' = 'EXECUTED',
  ): void {
    const column = event === 'EXECUTED' ? 'telegramNotifiedAt' : 'settledNotifiedAt';
    this.db
      .prepare(`UPDATE manual_ledger_entries SET ${column} = ? WHERE executionId = ?`)
      .run(notifiedAt.toISOString(), executionId);
  }

  private migrate(): void {
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS manual_ledger_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS manual_ledger_bankroll (id INTEGER PRIMARY KEY CHECK (id = 1), amountCop INTEGER NOT NULL CHECK (amountCop >= 0));
      CREATE TABLE IF NOT EXISTS manual_ledger_entries (
        recommendationId TEXT PRIMARY KEY, executionId TEXT UNIQUE, status TEXT NOT NULL CHECK (status IN ('RECOMMENDED', 'EXECUTED_MANUALLY', 'SETTLED')),
        bookmaker TEXT, executedOdds REAL, executedStakeCop INTEGER, executedAt TEXT, result TEXT CHECK (result IN ('WIN', 'LOSS', 'PUSH', 'VOID')),
        grossReturnCop INTEGER, netPnlCop INTEGER, bankrollBeforeCop INTEGER, bankrollAfterCop INTEGER,
        closingOdds REAL, clv REAL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );`);
    this.db
      .prepare('INSERT OR IGNORE INTO manual_ledger_migrations (id, appliedAt) VALUES (?, ?)')
      .run(MIGRATION_ID, new Date().toISOString());
    // Migración aditiva para ledgers existentes: identidad de fixture + settledAt + dedupe Telegram.
    const existing = this.db.prepare('PRAGMA table_info(manual_ledger_entries)').all() as {
      name: string;
    }[];
    const known = new Set(existing.map((column) => column.name));
    const additive: [name: string, declaration: string][] = [
      ['homeTeam', 'homeTeam TEXT'],
      ['awayTeam', 'awayTeam TEXT'],
      ['competition', 'competition TEXT'],
      ['kickoffAt', 'kickoffAt TEXT'],
      ['selection', 'selection TEXT'],
      ['executionMode', 'executionMode TEXT'],
      ['settledAt', 'settledAt TEXT'],
      ['telegramNotifiedAt', 'telegramNotifiedAt TEXT'],
      ['settledNotifiedAt', 'settledNotifiedAt TEXT'],
      ['entrySource', 'entrySource TEXT'],
    ];
    for (const [name, declaration] of additive) {
      if (!known.has(name))
        this.db.exec(`ALTER TABLE manual_ledger_entries ADD COLUMN ${declaration};`);
    }
  }
}

function validateExecution(input: ExecuteManualBetInput): void {
  if (!input.recommendationId || !input.executionId || !input.bookmaker.trim())
    throw new Error('recommendationId, executionId y bookmaker son obligatorios');
  assertPositiveInteger(input.executedStakeCop, 'executedStakeCop');
  if (!Number.isFinite(input.executedOdds) || input.executedOdds <= 1)
    throw new Error('executedOdds debe ser mayor que 1');
  const { identity } = input;
  if (
    !identity.homeTeam.trim() ||
    !identity.awayTeam.trim() ||
    !identity.competition.trim() ||
    !identity.selection.trim() ||
    !(identity.kickoffAt instanceof Date) ||
    Number.isNaN(identity.kickoffAt.getTime()) ||
    identity.kickoffAt.getTime() <= input.executedAt.getTime()
  ) {
    throw new Error(
      'La identidad del fixture es obligatoria para registrar una ejecución real (equipos, competición, kickoff, selección)',
    );
  }
}

function deserialize(row: Record<string, unknown>): ManualLedgerEntry {
  const optionalDate = (key: string): Date | undefined =>
    row[key] === null || row[key] === undefined ? undefined : new Date(row[key] as string);
  const optionalNumber = (key: string): number | undefined =>
    row[key] === null || row[key] === undefined ? undefined : (row[key] as number);
  const optionalText = (key: string): string | undefined =>
    row[key] === null || row[key] === undefined ? undefined : (row[key] as string);
  return {
    recommendationId: row.recommendationId as string,
    executionId: row.executionId === null ? undefined : (row.executionId as string),
    status: row.status as ManualLedgerEntry['status'],
    homeTeam: optionalText('homeTeam'),
    awayTeam: optionalText('awayTeam'),
    competition: optionalText('competition'),
    kickoffAt: optionalDate('kickoffAt'),
    selection: optionalText('selection'),
    executionMode: row.executionMode === null ? undefined : (row.executionMode as 'REAL_MANUAL'),
    entrySource:
      row.entrySource === null || row.entrySource === undefined
        ? undefined
        : (row.entrySource as ManualLedgerEntry['entrySource']),
    bookmaker: optionalText('bookmaker'),
    executedOdds: optionalNumber('executedOdds'),
    executedStakeCop: optionalNumber('executedStakeCop'),
    executedAt: optionalDate('executedAt'),
    result: row.result === null ? undefined : (row.result as ManualLedgerEntry['result']),
    grossReturnCop: optionalNumber('grossReturnCop'),
    netPnlCop: optionalNumber('netPnlCop'),
    bankrollBeforeCop: optionalNumber('bankrollBeforeCop'),
    bankrollAfterCop: optionalNumber('bankrollAfterCop'),
    closingOdds: optionalNumber('closingOdds'),
    clv: row.clv === null ? null : (row.clv as number),
    settledAt: optionalDate('settledAt'),
    telegramNotifiedAt: optionalDate('telegramNotifiedAt'),
    settledNotifiedAt: optionalDate('settledNotifiedAt'),
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
  };
}
