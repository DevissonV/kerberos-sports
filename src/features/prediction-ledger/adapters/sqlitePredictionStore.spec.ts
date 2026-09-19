import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqlitePredictionStore } from './sqlitePredictionStore';

function input(stage: 'PREANALYSIS' | 'NO_BET' = 'PREANALYSIS', probability = 0.658) {
  return {
    fixtureId: '42',
    league: 'Eredivisie',
    homeTeam: 'Groningen',
    awayTeam: 'PEC Zwolle',
    kickoffAt: new Date('2026-09-18T20:00:00Z'),
    createdAt: new Date('2026-09-18T10:00:00Z'),
    snapshotAt:
      stage === 'PREANALYSIS' ? new Date('2026-09-18T10:00:00Z') : new Date('2026-09-18T14:00:00Z'),
    market: 'OVER_UNDER_2_5' as const,
    selection: 'OVER_2_5' as const,
    modelProbability: probability,
    expectedGoals: 3.1,
    modelVersion: 'poisson-v1',
    strategyVersion: 'KSS-V1-C01',
    predictionStage: stage,
    betAuthorized: false,
    betExecuted: false,
  };
}

describe('SqlitePredictionStore', () => {
  it('persiste, deduplica ticks y mantiene una PRIMARY_PREDICTION causal', () => {
    const store = new SqlitePredictionStore(':memory:');
    expect(store.save(input()).isPrimary).toBe(true);
    expect(
      store.save({ ...input(), snapshotAt: new Date('2026-09-18T10:30:00Z') }).predictionId,
    ).toBe(store.list()[0]?.predictionId);
    expect(store.list()).toHaveLength(1);
    expect(store.save(input('NO_BET')).isPrimary).toBe(true);
    expect(store.list()).toHaveLength(2);
    expect(store.list().filter((entry) => entry.isPrimary)).toHaveLength(1);
    expect(store.list().find((entry) => entry.isPrimary)?.predictionStage).toBe('NO_BET');
  });

  it('conserva dedupe de eventos, reportes y predictions tras restart', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'kss-predictions-')), 'ledger.sqlite');
    const first = new SqlitePredictionStore(path);
    first.save(input());
    expect(first.claimEvent('event:1', 'fp', new Date())).toBe(true);
    expect(first.claimDailyReport('2026-09-18', new Date())).toBe(true);
    first.close();
    const restarted = new SqlitePredictionStore(path);
    expect(restarted.list()).toHaveLength(1);
    expect(restarted.claimEvent('event:1', 'fp', new Date())).toBe(false);
    expect(restarted.claimDailyReport('2026-09-18', new Date())).toBe(false);
  });
});
