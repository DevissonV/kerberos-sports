import { DuplicatePaperBetError } from '../ports/paperBetStore';
import { AlreadySettledError, type PaperBet } from '../domain/concepts';
import { SqlitePaperBetStore } from './sqlitePaperBetStore';

function makeBet(overrides: Partial<PaperBet> = {}): PaperBet {
  return {
    id: 'b1',
    fixtureId: 123,
    league: 'Liga Nacional',
    homeTeam: 'Comunicaciones',
    awayTeam: 'Antigua GFC',
    kickoff: new Date('2026-09-20T22:00:00Z'),
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

    const existing = store.findByIdempotencyKey({
      fixtureId: 123,
      market: 'MATCH_WINNER',
      selection: 'HOME',
      modelVersion: 'poisson-v1',
    });
    expect(existing?.id).toBe('b1');
    expect(existing?.stake).toBe(10);

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
});
