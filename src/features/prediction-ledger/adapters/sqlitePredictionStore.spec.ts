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

  it('backfill idempotente: reconstruye OVER 65.8% con final 3-0 a HIT', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save({
      ...input('NO_BET'),
      selection: 'UNDER_2_5',
      modelProbability: 0.3415813291594956,
    });
    // Fila legada ya disputada con marcador final, sin recalcular en settlement posterior.
    (
      store as unknown as { db: { prepare: (s: string) => { run: (...args: unknown[]) => void } } }
    ).db
      .prepare(
        "UPDATE predictions SET result='MISS', finalScoreHome=3, finalScoreAway=0, totalGoals=3",
      )
      .run();
    // Evidencia cruda causal del modelo para el mismo fixture.
    (store as unknown as { db: { exec: (s: string) => void } }).db.exec(`
      CREATE TABLE IF NOT EXISTS model_analyses (
        cohortId TEXT NOT NULL, fixtureId TEXT NOT NULL, snapshotType TEXT NOT NULL,
        snapshotAt TEXT NOT NULL, league TEXT NOT NULL, homeTeam TEXT NOT NULL,
        awayTeam TEXT NOT NULL, kickoff TEXT NOT NULL, homeLambda REAL NOT NULL,
        awayLambda REAL NOT NULL, expectedGoals REAL NOT NULL, probabilityOver25 REAL NOT NULL,
        probabilityUnder25 REAL NOT NULL, modelSelection TEXT, marketOdds REAL,
        fairMarketProbability REAL, edge REAL, ev REAL, decision TEXT NOT NULL,
        modelMode TEXT NOT NULL DEFAULT 'DOMESTIC',
        PRIMARY KEY (cohortId, fixtureId, snapshotType)
      );
      INSERT INTO model_analyses (cohortId, fixtureId, snapshotType, snapshotAt, league, homeTeam,
        awayTeam, kickoff, homeLambda, awayLambda, expectedGoals, probabilityOver25,
        probabilityUnder25, modelSelection, marketOdds, fairMarketProbability, edge, ev, decision)
      VALUES ('C7','42','PREANALYSIS','2026-09-18T12:05:00.000Z','Eredivisie','Groningen',
        'PEC Zwolle','2026-09-18T20:00:00.000Z',1.9,1.2,3.1,0.6584186708405044,0.3415813291594956,
        'OVER_2_5',NULL,NULL,NULL,NULL,'PREANALYSIS');
    `);
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 1, unknown: 0 });
    const fixed = store.list()[0];
    expect(fixed).toMatchObject({ selection: 'OVER_2_5', result: 'HIT', isPrimary: true });
    expect(fixed?.modelProbability).toBeCloseTo(0.6584186708405044);
    expect(fixed?.finalScoreHome).toBe(3);
    // Idempotencia: segunda pasada no cambia nada.
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 0 });
    expect(store.list()).toHaveLength(1);
  });

  it('backfill marca UNKNOWN cuando no hay evidencia y probability < 0.50', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save({ ...input('NO_BET'), selection: 'UNDER_2_5', modelProbability: 0.342 });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 1 });
    expect(store.list()[0]?.result).toBe('UNKNOWN');
    expect(store.list()[0]?.selection).toBe('UNDER_2_5');
  });
});
