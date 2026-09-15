import { SqliteRefinementStore } from './sqliteRefinementStore';

describe('SqliteRefinementStore', () => {
  it('reclama un snapshot una sola vez y acumula contadores', () => {
    const store = new SqliteRefinementStore(':memory:');
    const at = new Date('2026-09-15T12:00:00Z');
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'fixture-1', at)).toBe(true);
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'fixture-1', at)).toBe(false);
    expect(store.increment('2026-09-15', { ticks: 1, fullOddsScans: 1 })).toMatchObject({
      ticks: 1,
      fullOddsScans: 1,
    });
    expect(store.dailyCounters('2026-09-15').ticks).toBe(1);
    store.close();
  });

  it('reclama el heartbeat de un tick solo una vez', () => {
    const store = new SqliteRefinementStore(':memory:');
    expect(store.claimHeartbeat('2026-09-15T12:00')).toBe(true);
    expect(store.claimHeartbeat('2026-09-15T12:00')).toBe(false);
    store.close();
  });
});
