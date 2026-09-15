import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DuplicatePaperBetError } from '../ports/paperBetStore';
import type { PaperBetKey } from '../ports/paperBetStore';
import { AlreadySettledError, type PaperBet } from '../domain/concepts';
import { SqlitePaperBetStore } from './sqlitePaperBetStore';

function makeKeyFixture(fixtureId: number, selection: string): PaperBetKey {
  return {
    cohortId: 'KSS-V1-C01',
    fixtureId,
    market: 'MATCH_WINNER',
    selection,
    modelVersion: 'poisson-v1',
  };
}

function makeBet(overrides: Partial<PaperBet> = {}): PaperBet {
  return {
    id: 'b1',
    cohortId: 'KSS-V1-C01',
    fixtureId: 123,
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: new Date('2026-09-20T22:00:00Z'),
    snapshotAt: new Date('2026-09-20T16:00:00Z'),
    market: 'MATCH_WINNER',
    selection: 'HOME',
    modelVersion: 'poisson-v1',
    modelProbability: 0.6,
    fairMarketProbability: 0.48,
    edge: 0.12,
    expectedValue: 0.07,
    bookmaker: 'local-book',
    placedOdds: 2.1,
    minimumAcceptableOdds: 1.9,
    lambdaHome: 1.45,
    lambdaAway: 1.2,
    lambdaTotal: 2.65,
    stake: 10,
    bankrollBefore: 1000,
    status: 'OPEN',
    createdAt: new Date('2026-09-20T21:00:00Z'),
    ...overrides,
  };
}

describe('SqlitePaperBetStore', () => {
  let store: SqlitePaperBetStore;

  beforeEach(() => {
    store = new SqlitePaperBetStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('save/read round-trip conserva todos los campos', () => {
    const bet = makeBet();
    store.save(bet);
    expect(store.findById('b1')).toEqual(bet);
    expect(store.findById('nope')).toBeNull();
  });

  it('pre-kickoff aceptado; post-kickoff rechazado', () => {
    expect(() => store.save(makeBet())).not.toThrow();

    // createdAt en el mismo instante del kickoff: rechazado (now >= kickoff).
    const atKickoff = makeBet({
      id: 'b2',
      createdAt: new Date('2026-09-20T22:00:00Z'),
    });
    try {
      store.save(atKickoff);
      fail('debia rechazar');
    } catch (error) {
      expect((error as Error).name).toContain('PreKickoff');
    }
    expect(store.findById('b2')).toBeNull();

    // createdAt después del kickoff: rechazado.
    expect(() =>
      store.save(makeBet({ id: 'b3', createdAt: new Date('2026-09-21T00:00:00Z') })),
    ).toThrow();
  });

  it('clave de idempotencia duplicada se rechaza y no inserta segunda fila', () => {
    store.save(makeBet());
    const mutated = makeBet({ id: 'b2', stake: 25 });
    expect(() => store.save(mutated)).toThrow(DuplicatePaperBetError);

    const existing = store.findByIdempotencyKey(makeKeyFixture(123, 'HOME'));
    expect(existing?.id).toBe('b1');
    expect(existing?.stake).toBe(10);

    // Distinta cohorte (misma clave parcial) NO es duplicado.
    expect(() => store.save(makeBet({ id: 'b4', cohortId: 'KSS-V1-C02' }))).not.toThrow();

    // Distinta selección (misma clave parcial) NO es duplicado.
    expect(() => store.save(makeBet({ id: 'b3', selection: 'AWAY' }))).not.toThrow();
  });

  it('settle WON registra pnl y persiste', () => {
    store.save(makeBet());
    const settled = store.settle('b1', 'WON', {
      closingOdds: 2.0,
      result: 'Comunicaciones 2-1',
    });
    expect(settled.status).toBe('WON');
    expect(settled.pnl).toBeCloseTo(11);
    expect(settled.settledAt).toBeDefined();
    expect(settled.closingOdds).toBe(2.0);

    const persisted = store.findById('b1');
    expect(persisted?.status).toBe('WON');
    expect(persisted?.pnl).toBeCloseTo(11);
    expect(store.listByStatus('WON')).toHaveLength(1);
    expect(store.listByStatus('OPEN')).toHaveLength(0);
  });

  it('settle LOST registra pnl negativo', () => {
    store.save(makeBet());
    const settled = store.settle('b1', 'LOST');
    expect(settled.status).toBe('LOST');
    expect(settled.pnl).toBeCloseTo(-10);
    expect(settled.closingOdds).toBeUndefined();
  });

  it('settle VOID registra pnl 0', () => {
    store.save(makeBet());
    const settled = store.settle('b1', 'VOID', { result: 'postponed' });
    expect(settled.status).toBe('VOID');
    expect(settled.pnl).toBeCloseTo(0);
  });

  it('doble settlement rechazado con AlreadySettledError', () => {
    store.save(makeBet());
    store.settle('b1', 'WON');
    expect(() => store.settle('b1', 'LOST')).toThrow(AlreadySettledError);
  });

  it('migra un schema legacy (sin cohortId/snapshotAt/lambdas) sin perder datos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kss-paperbets-'));
    const dbPath = join(dir, 'legacy.db');
    const raw = new DatabaseSync(dbPath);
    raw.exec(`
      CREATE TABLE paper_bets (
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
      );
      INSERT INTO paper_bets (id, fixtureId, league, homeTeam, awayTeam, kickoff, market, selection,
        modelVersion, modelProbability, fairMarketProbability, edge, expectedValue, bookmaker,
        placedOdds, minimumAcceptableOdds, stake, bankrollBefore, status, createdAt)
      VALUES ('legacy-1', 123, 'Liga Nacional', 'Comunicaciones', 'Antigua GFC',
        '2026-09-20T22:00:00.000Z', 'MATCH_WINNER', 'HOME', 'baseline', 0.5, 0.5, 0, 0,
        'local-book', 2.0, 2.0, 10, 1000, 'OPEN', '2026-09-20T21:00:00.000Z');
    `);
    raw.close();

    const migrated = new SqlitePaperBetStore(dbPath);
    try {
      const legacy = migrated.findById('legacy-1');
      expect(legacy?.status).toBe('OPEN');
      // La clave de idempotencia de la cohorte nueva NO colisiona con el legacy.
      expect(migrated.findByIdempotencyKey(makeKeyFixture(123, 'HOME'))).toBeNull();
      const newBet = makeBet({ fixtureId: 123, selection: 'HOME' });
      newBet.id = 'new-1';
      expect(() => migrated.save(newBet)).not.toThrow();

      // La nueva fila es durable y con la cohorte correcta.
      const stored = migrated.findById('new-1');
      expect(stored).toEqual(newBet);
    } finally {
      migrated.close();
      rmSync(dbPath);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
