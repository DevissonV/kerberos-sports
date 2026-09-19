import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqlitePredictionStore } from './sqlitePredictionStore';
import { calculatePredictionMetrics } from '../domain/metrics';

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

/** INSERT directo de una fila cruda en model_analyses (constructor de la prueba). */
function insertModelAnalysisRow(
  store: SqlitePredictionStore,
  row: {
    fixtureId: string;
    snapshotAt: string;
    kickoff: string;
    home?: string;
    away?: string;
    pOver?: number;
    pUnder?: number;
    modelMode?: string;
    snapshotType?: string;
  },
): void {
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
      probabilityUnder25, modelSelection, marketOdds, fairMarketProbability, edge, ev, decision,
      modelMode)
    VALUES ('C7', '${row.fixtureId}', '${row.snapshotType ?? 'PREANALYSIS'}', '${row.snapshotAt}',
      'Eredivisie', '${row.home ?? 'Groningen'}', '${row.away ?? 'PEC Zwolle'}', '${row.kickoff}',
      1.9, 1.2, 3.1, ${row.pOver ?? 0.658}, ${row.pUnder ?? 0.342}, 'OVER_2_5',
      NULL, NULL, NULL, NULL, 'PREANALYSIS', '${row.modelMode ?? 'DOMESTIC'}');
  `);
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

  it('B: una predicción post-kickoff jamás se vuelve PRIMARY y queda excluida de métricas', () => {
    const store = new SqlitePredictionStore(':memory:');
    // Caja primera SIN primaria previa: aún así post-kickoff no puede ser primaria
    // (ni con snapshotAt == kickoffAt ni con snapshotAt > kickoffAt).
    const post = store.save({
      ...input(),
      snapshotAt: new Date('2026-09-18T20:00:00Z'),
    });
    expect(post.isPrimary).toBe(false);
    expect(post.excludedFromPerformanceMetrics).toBe(true);
    const later = store.save({
      ...input('NO_BET'),
      snapshotAt: new Date('2026-09-18T21:00:00Z'),
    });
    expect(later.isPrimary).toBe(false);
    expect(later.excludedFromPerformanceMetrics).toBe(true);
    // Y no predice métricas domésticas aunque el marcador la dejaría en HIT.
    expect(calculatePredictionMetrics(store.list()).settledPredictions).toBe(0);
  });

  it('B: un análisis post-kickoff NO desplaza la primaria causal existente', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save(input());
    store.save({
      ...input('NO_BET'),
      snapshotAt: new Date('2026-09-18T21:30:00Z'), // 1.5 h post-kickoff
      modelProbability: 0.61,
    });
    expect(store.list().filter((entry) => entry.isPrimary)).toHaveLength(1);
    expect(store.list().find((entry) => entry.isPrimary)?.predictionStage).toBe('PREANALYSIS');
  });

  it('E: recovery de análisis europeos post-kickoff los deja no-primary y fuera de métricas', () => {
    // Comportamiento genérico (sin hardcodear nombres): snapshots del modelo
    // CROSS_LEAGUE_EXPERIMENTAL tomadas ~17 h DESPUÉS del kickoff, igual que las dos
    // filas reportadas por KSS-ASTRA-ADVERSARIAL-REVIEW-01 (Juventus–NEC Nijmegen,
    // Real Sociedad–Bournemouth con snapshot ~17 h post-kickoff).
    const path = join(mkdtempSync(join(tmpdir(), 'kss-predictions-')), 'ledger.sqlite');
    {
      const raw = new DatabaseSync(path);
      raw.exec(`
        CREATE TABLE model_analyses (
          cohortId TEXT NOT NULL, fixtureId TEXT NOT NULL, snapshotType TEXT NOT NULL,
          snapshotAt TEXT NOT NULL, league TEXT NOT NULL, homeTeam TEXT NOT NULL,
          awayTeam TEXT NOT NULL, kickoff TEXT NOT NULL, homeLambda REAL NOT NULL,
          awayLambda REAL NOT NULL, expectedGoals REAL NOT NULL, probabilityOver25 REAL NOT NULL,
          probabilityUnder25 REAL NOT NULL, modelSelection TEXT, marketOdds REAL,
          fairMarketProbability REAL, edge REAL, ev REAL, decision TEXT NOT NULL,
          modelMode TEXT NOT NULL DEFAULT 'DOMESTIC',
          PRIMARY KEY (cohortId, fixtureId, snapshotType)
        );
        INSERT INTO model_analyses (cohortId, fixtureId, snapshotType, snapshotAt, league,
          homeTeam, awayTeam, kickoff, homeLambda, awayLambda, expectedGoals, probabilityOver25,
          probabilityUnder25, modelSelection, decision, modelMode)
        VALUES
          ('C7','1636278','PREANALYSIS','2026-09-18T12:05:00.000Z','UEFA Europa League',
           'Juventus','NEC Nijmegen','2026-09-17T19:00:00.000Z',1.4,1.1,2.5,0.60,0.40,
           'OVER_2_5','PREANALYSIS','CROSS_LEAGUE_EXPERIMENTAL'),
          ('C7','1636321','PREANALYSIS','2026-09-18T12:05:00.000Z','UEFA Europa League',
           'Real Sociedad','Bournemouth','2026-09-17T19:00:00.000Z',1.3,1.2,2.5,0.55,0.45,
           'OVER_2_5','PREANALYSIS','CROSS_LEAGUE_EXPERIMENTAL');
      `);
      raw.close();
    }
    const store = new SqlitePredictionStore(path);
    const recovered = store.list();
    expect(recovered).toHaveLength(2);
    for (const prediction of recovered) {
      expect(prediction.snapshotAt.getTime()).toBeGreaterThan(prediction.kickoffAt.getTime());
      // Post-kickoff: no primaria, no contribuye a métricas, per procedencia conservada.
      expect(prediction.isPrimary).toBe(false);
      expect(prediction.excludedFromPerformanceMetrics).toBe(true);
      expect(prediction.modelMode).toBe('CROSS_LEAGUE_EXPERIMENTAL');
      expect(prediction.fixtureId).toEqual(expect.any(String));
      expect(prediction.homeTeam).toBeTruthy();
    }
    expect(recovered.map((entry) => entry.homeTeam)).toEqual(
      expect.arrayContaining(['Juventus', 'Real Sociedad']),
    );
    // DOMESTIC_METRICS_INCLUDED=false incluso si alguien intentara liquidarlas a HIT.
    expect(
      calculatePredictionMetrics(
        recovered.map((entry) => ({ ...entry, result: 'HIT' as const, totalGoals: 3 })),
      ).settledPredictions,
    ).toBe(0);
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
    insertModelAnalysisRow(store, {
      fixtureId: '42',
      snapshotAt: '2026-09-18T12:05:00.000Z',
      kickoff: '2026-09-18T20:00:00.000Z',
      pOver: 0.6584186708405044,
      pUnder: 0.3415813291594956,
    });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 1, unknown: 0 });
    const fixed = store.list()[0];
    expect(fixed).toMatchObject({ selection: 'OVER_2_5', result: 'HIT', isPrimary: true });
    expect(fixed?.modelProbability).toBeCloseTo(0.6584186708405044);
    expect(fixed?.finalScoreHome).toBe(3);
    // Idempotencia: segunda pasada no cambia nada.
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 0 });
    expect(store.list()).toHaveLength(1);
  });

  it('G: backfill preserva la atribución correcta (OVER 65.8% queda OVER 65.8%)', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save({ ...input('NO_BET'), selection: 'OVER_2_5', modelProbability: 0.65841867 });
    insertModelAnalysisRow(store, {
      fixtureId: '42',
      snapshotAt: '2026-09-18T12:05:00.000Z',
      kickoff: '2026-09-18T20:00:00.000Z',
      pOver: 0.6584186708405044,
      pUnder: 0.3415813291594956,
    });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 0 });
    expect(store.list()[0]).toMatchObject({ selection: 'OVER_2_5', isPrimary: true });
  });

  it('C: backfill rechaza evidencia POSTERIOR a la predicción (reproducción C2 de Astra)', () => {
    const store = new SqlitePredictionStore(':memory:');
    // Predicción UNDER 0.4000 del día 17 (Astra: pOver 0.5995 / pUnder 0.4005 el día 20).
    store.save({
      ...input('NO_BET'),
      selection: 'OVER_2_5',
      modelProbability: 0.5995,
      snapshotAt: new Date('2026-09-17T18:00:00Z'),
      createdAt: new Date('2026-09-17T18:00:00Z'),
    });
    (
      store as unknown as { db: { prepare: (s: string) => { run: (...args: unknown[]) => void } } }
    ).db
      .prepare("UPDATE predictions SET result='MISS', finalScoreHome=1, finalScoreAway=1")
      .run();
    // Evidencia del día 20: POSTERIOR a la predicción y al kickoff del día 18.
    insertModelAnalysisRow(store, {
      fixtureId: '42',
      snapshotAt: '2026-09-20T12:05:00.000Z',
      kickoff: '2026-09-18T20:00:00.000Z',
      pOver: 0.5995,
      pUnder: 0.4005,
    });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 0 });
    const row = store.list()[0];
    // La probabilidad posterior NO corrigió la predicción anterior (sin fabricar
    // atribución); el lado se preserva tal como llega con evidencia no causal (KEEP).
    expect(row).toMatchObject({ modelProbability: 0.5995 });
  });

  it('C: backfill no usa evidencia de otro fixture identity ni posterior al snapshot', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save({
      ...input('NO_BET'),
      snapshotAt: new Date('2026-09-17T18:00:00Z'),
      createdAt: new Date('2026-09-17T18:00:00Z'),
    });
    // Evidencia causal del fixture vecino (equipos inverted): una probabilidad distancia
    // 0.0005 de la del fixture objetivo NO puede reasignarse accidentalmente.
    insertModelAnalysisRow(store, {
      fixtureId: '999',
      snapshotAt: '2026-09-17T12:05:00.000Z',
      kickoff: '2026-09-18T20:00:00.000Z',
      home: 'NEC Nijmegen',
      away: 'Juventus',
      pOver: 0.5995,
      pUnder: 0.4005,
    });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 0 });
    expect(store.list()[0]).toMatchObject({
      fixtureId: '42',
      selection: 'OVER_2_5',
      modelProbability: 0.658,
      isPrimary: true,
    });
  });

  it('D: backfill usa evidencia causal (<= snapshot y < kickoff) del mismo fixture', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save({
      ...input('NO_BET'),
      selection: 'UNDER_2_5',
      modelProbability: 0.3415813291594956,
      snapshotAt: new Date('2026-09-17T18:00:00Z'),
      createdAt: new Date('2026-09-17T18:00:00Z'),
    });
    insertModelAnalysisRow(store, {
      fixtureId: '42',
      snapshotAt: '2026-09-17T12:05:00.000Z',
      kickoff: '2026-09-18T20:00:00.000Z',
      pOver: 0.6584186708405044,
      pUnder: 0.3415813291594956,
    });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 1, unknown: 0 });
    expect(store.list()[0]).toMatchObject({
      selection: 'OVER_2_5',
      modelProbability: 0.6584186708405044,
    });
  });

  it('backfill marca UNKNOWN cuando no hay evidencia causal y probability < 0.50', () => {
    const store = new SqlitePredictionStore(':memory:');
    store.save({ ...input('NO_BET'), selection: 'UNDER_2_5', modelProbability: 0.342 });
    expect(store.backfillLegacyAttribution()).toEqual({ corrected: 0, unknown: 1 });
    expect(store.list()[0]?.result).toBe('UNKNOWN');
    expect(store.list()[0]?.selection).toBe('UNDER_2_5');
  });
});
