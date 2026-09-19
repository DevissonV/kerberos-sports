import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import {
  diagnoseAttribution,
  predictionIdOf,
  primaryPriority,
  type Prediction,
} from '../domain/prediction';
import type { PredictionStore } from '../ports/predictionStore';

const COLUMNS = `predictionId, fixtureId, league, homeTeam, awayTeam, kickoffAt, createdAt,
  snapshotAt, market, selection, modelProbability, expectedGoals, modelVersion, strategyVersion,
  predictionStage, oddsAtPrediction, fairMarketProbability, edge, ev, finalScoreHome,
  finalScoreAway, totalGoals, result, settledAt, betAuthorized, betExecuted, isPrimary`;

export class SqlitePredictionStore implements PredictionStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS predictions (
        predictionId TEXT PRIMARY KEY, fixtureId TEXT NOT NULL, league TEXT NOT NULL,
        homeTeam TEXT NOT NULL, awayTeam TEXT NOT NULL, kickoffAt TEXT NOT NULL,
        createdAt TEXT NOT NULL, snapshotAt TEXT NOT NULL, market TEXT NOT NULL,
        selection TEXT NOT NULL, modelProbability REAL NOT NULL, expectedGoals REAL,
        modelVersion TEXT NOT NULL, strategyVersion TEXT NOT NULL, predictionStage TEXT NOT NULL,
        oddsAtPrediction REAL, fairMarketProbability REAL, edge REAL, ev REAL,
        finalScoreHome INTEGER, finalScoreAway INTEGER, totalGoals INTEGER,
        result TEXT NOT NULL DEFAULT 'PENDING', settledAt TEXT,
        betAuthorized INTEGER NOT NULL, betExecuted INTEGER NOT NULL, isPrimary INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS predictions_pending_primary
        ON predictions(result, isPrimary, kickoffAt);
      CREATE TABLE IF NOT EXISTS notification_events (
        eventId TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, sentAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_prediction_reports (
        dayBogota TEXT PRIMARY KEY, sentAt TEXT NOT NULL
      );
    `);
    this.recoverExistingAnalyses();
    this.backfillLegacyAttribution();
  }

  save(input: Omit<Prediction, 'predictionId' | 'isPrimary' | 'result'>): Prediction {
    const predictionId = predictionIdOf(input);
    const existing = this.find(predictionId);
    if (existing !== null) return existing;
    const currentPrimary = this.primaryFor(input.fixtureId, input.market, input.modelVersion);
    const shouldReplace =
      currentPrimary === null ||
      (input.snapshotAt < input.kickoffAt &&
        primaryPriority(input.predictionStage) > primaryPriority(currentPrimary.predictionStage));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (shouldReplace) {
        this.db
          .prepare(
            'UPDATE predictions SET isPrimary=0 WHERE fixtureId=? AND market=? AND modelVersion=?',
          )
          .run(input.fixtureId, input.market, input.modelVersion);
      }
      this.db
        .prepare(
          `INSERT OR IGNORE INTO predictions (${COLUMNS}) VALUES
          (:predictionId,:fixtureId,:league,:homeTeam,:awayTeam,:kickoffAt,:createdAt,:snapshotAt,
           :market,:selection,:modelProbability,:expectedGoals,:modelVersion,:strategyVersion,
           :predictionStage,:oddsAtPrediction,:fairMarketProbability,:edge,:ev,NULL,NULL,NULL,
           'PENDING',NULL,:betAuthorized,:betExecuted,:isPrimary)`,
        )
        .run({
          ...serializeOptional(input),
          predictionId,
          kickoffAt: input.kickoffAt.toISOString(),
          createdAt: input.createdAt.toISOString(),
          snapshotAt: input.snapshotAt.toISOString(),
          betAuthorized: input.betAuthorized ? 1 : 0,
          betExecuted: input.betExecuted ? 1 : 0,
          isPrimary: shouldReplace ? 1 : 0,
        });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.find(predictionId) as Prediction;
  }

  list(): readonly Prediction[] {
    return (
      this.db.prepare(`SELECT ${COLUMNS} FROM predictions ORDER BY snapshotAt`).all() as Record<
        string,
        unknown
      >[]
    ).map(deserialize);
  }

  listPendingPrimary(before: Date): readonly Prediction[] {
    return (
      this.db
        .prepare(
          `SELECT ${COLUMNS} FROM predictions WHERE isPrimary=1 AND result='PENDING' AND kickoffAt < ? ORDER BY kickoffAt`,
        )
        .all(before.toISOString()) as Record<string, unknown>[]
    ).map(deserialize);
  }

  settle(prediction: Prediction): Prediction {
    this.db
      .prepare(
        `UPDATE predictions SET finalScoreHome=?, finalScoreAway=?, totalGoals=?, result=?, settledAt=? WHERE predictionId=? AND result='PENDING'`,
      )
      .run(
        prediction.finalScoreHome ?? null,
        prediction.finalScoreAway ?? null,
        prediction.totalGoals ?? null,
        prediction.result,
        prediction.settledAt?.toISOString() ?? null,
        prediction.predictionId,
      );
    return this.find(prediction.predictionId) as Prediction;
  }

  void(predictionId: string, settledAt: Date): Prediction {
    this.db
      .prepare(
        `UPDATE predictions SET result='VOID', settledAt=? WHERE predictionId=? AND result='PENDING'`,
      )
      .run(settledAt.toISOString(), predictionId);
    return this.find(predictionId) as Prediction;
  }

  claimEvent(eventId: string, fingerprint: string, now: Date): boolean {
    const result = this.db
      .prepare('INSERT OR IGNORE INTO notification_events VALUES (?, ?, ?)')
      .run(eventId, fingerprint, now.toISOString());
    return result.changes === 1;
  }

  claimDailyReport(dayBogota: string, now: Date): boolean {
    const result = this.db
      .prepare('INSERT OR IGNORE INTO daily_prediction_reports VALUES (?, ?)')
      .run(dayBogota, now.toISOString());
    return result.changes === 1;
  }

  releaseDailyReport(dayBogota: string): void {
    this.db.prepare('DELETE FROM daily_prediction_reports WHERE dayBogota=?').run(dayBogota);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Backfill idempotente de atribución: filas persistidas por código antiguo pueden
   * tener `selection` = lado de mercado (por cuota/edge) con la probabilidad del lado
   * MENOR (p. ej. UNDER_2_5 @34.2% cuando el modelo daba OVER 65.8%). Se reconstruyen
   * desde las snapshots crudas de `model_analyses` del mismo archivo; si no hay
   * evidencia y probability < 0.50 se marca UNKNOWN (excluida de métricas). Nunca
   * inventa datos ni recalcula probabilidades.
   */
  backfillLegacyAttribution(): { corrected: number; unknown: number } {
    // Última snapshot cruda del modelo por fixture (más reciente antes del kickoff si
    // hay varias; la última en la tabla es la de decisión T-6). La tabla puede no
    // existir aún (bases nuevas): entonces no hay evidencia causal local y solo las
    // filas con probability < 0.50 se marcan UNKNOWN.
    const hasModelAnalyses =
      this.db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='model_analyses'")
        .get() !== undefined;
    const evidenceByFixture = new Map<string, { over: number; under: number }>();
    if (hasModelAnalyses) {
      for (const row of this.db
        .prepare('SELECT * FROM model_analyses ORDER BY snapshotAt')
        .all() as Record<string, unknown>[]) {
        evidenceByFixture.set(String(row['fixtureId']), {
          over: Number(row['probabilityOver25']),
          under: Number(row['probabilityUnder25']),
        });
      }
    }
    let corrected = 0;
    let unknown = 0;
    for (const pred of this.list()) {
      const evidence = evidenceByFixture.get(pred.fixtureId);
      const fix = diagnoseAttribution(
        {
          selection: pred.selection,
          modelProbability: pred.modelProbability,
          result: pred.result,
          finalScoreHome: pred.finalScoreHome,
          finalScoreAway: pred.finalScoreAway,
        },
        evidence === undefined
          ? undefined
          : { probabilityOver: evidence.over, probabilityUnder: evidence.under },
      );
      if (fix.type === 'KEEP') continue;
      if (fix.type === 'UNKNOWN') {
        this.db
          .prepare(`UPDATE predictions SET result='UNKNOWN' WHERE predictionId=?`)
          .run(pred.predictionId);
        unknown += 1;
        continue;
      }
      // REBUILD: mismos valores recalculados; histórico de settledAt se conserva.
      const totalGoals =
        pred.finalScoreHome !== undefined && pred.finalScoreAway !== undefined
          ? pred.finalScoreHome + pred.finalScoreAway
          : null;
      this.db
        .prepare(
          'UPDATE predictions SET selection=?, modelProbability=?, result=?, totalGoals=? WHERE predictionId=?',
        )
        .run(
          fix.selection,
          fix.modelProbability,
          fix.result ?? 'PENDING',
          totalGoals,
          pred.predictionId,
        );
      corrected += 1;
    }
    return { corrected, unknown };
  }

  private find(id: string): Prediction | null {
    const row = this.db
      .prepare(`SELECT ${COLUMNS} FROM predictions WHERE predictionId=?`)
      .get(id) as Record<string, unknown> | undefined;
    return row === undefined ? null : deserialize(row);
  }

  private primaryFor(fixtureId: string, market: string, modelVersion: string): Prediction | null {
    const row = this.db
      .prepare(
        `SELECT ${COLUMNS} FROM predictions WHERE fixtureId=? AND market=? AND modelVersion=? AND isPrimary=1 LIMIT 1`,
      )
      .get(fixtureId, market, modelVersion) as Record<string, unknown> | undefined;
    return row === undefined ? null : deserialize(row);
  }

  /** Recupera únicamente evidencia real ya persistida; nunca fabrica partidos históricos. */
  private recoverExistingAnalyses(): void {
    const exists = this.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='model_analyses'")
      .get();
    if (exists === undefined) return;
    const rows = this.db
      .prepare('SELECT * FROM model_analyses ORDER BY snapshotAt')
      .all() as Record<string, unknown>[];
    for (const row of rows) {
      // La predicción del modelo es su probabilidad mayor; `modelSelection` en
      // snapshots antiguos podía representar el lado elegido por edge/cuota.
      const selection: Prediction['selection'] =
        Number(row.probabilityOver25) >= Number(row.probabilityUnder25) ? 'OVER_2_5' : 'UNDER_2_5';
      const decision = String(row.decision);
      const stage =
        String(row.snapshotType) === 'PREANALYSIS'
          ? 'PREANALYSIS'
          : decision === 'BET'
            ? 'BET'
            : decision === 'NO_BET' || decision === 'NO_ODDS'
              ? 'NO_BET'
              : 'MARKET_ANALYSIS';
      this.save({
        fixtureId: String(row.fixtureId),
        league: String(row.league),
        homeTeam: String(row.homeTeam),
        awayTeam: String(row.awayTeam),
        kickoffAt: new Date(String(row.kickoff)),
        createdAt: new Date(String(row.snapshotAt)),
        snapshotAt: new Date(String(row.snapshotAt)),
        market: 'OVER_UNDER_2_5',
        selection,
        modelProbability:
          selection === 'OVER_2_5' ? Number(row.probabilityOver25) : Number(row.probabilityUnder25),
        expectedGoals: Number(row.expectedGoals),
        modelVersion: 'poisson-v1',
        strategyVersion: String(row.cohortId),
        predictionStage: stage,
        oddsAtPrediction: nullableNumber(row.marketOdds),
        fairMarketProbability: nullableNumber(row.fairMarketProbability),
        edge: nullableNumber(row.edge),
        ev: nullableNumber(row.ev),
        betAuthorized: decision === 'BET',
        betExecuted: false,
      });
    }
  }
}

function serializeOptional(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value ?? null]));
}
function nullableNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
function deserialize(row: Record<string, unknown>): Prediction {
  const optionalNumber = (key: string) => (row[key] === null ? undefined : Number(row[key]));
  return {
    predictionId: String(row.predictionId),
    fixtureId: String(row.fixtureId),
    league: String(row.league),
    homeTeam: String(row.homeTeam),
    awayTeam: String(row.awayTeam),
    kickoffAt: new Date(String(row.kickoffAt)),
    createdAt: new Date(String(row.createdAt)),
    snapshotAt: new Date(String(row.snapshotAt)),
    market: 'OVER_UNDER_2_5',
    selection: String(row.selection) as Prediction['selection'],
    modelProbability: Number(row.modelProbability),
    expectedGoals: optionalNumber('expectedGoals'),
    modelVersion: String(row.modelVersion),
    strategyVersion: String(row.strategyVersion),
    predictionStage: String(row.predictionStage) as Prediction['predictionStage'],
    oddsAtPrediction: optionalNumber('oddsAtPrediction'),
    fairMarketProbability: optionalNumber('fairMarketProbability'),
    edge: optionalNumber('edge'),
    ev: optionalNumber('ev'),
    finalScoreHome: optionalNumber('finalScoreHome'),
    finalScoreAway: optionalNumber('finalScoreAway'),
    totalGoals: optionalNumber('totalGoals'),
    result: String(row.result) as Prediction['result'],
    settledAt: typeof row.settledAt === 'string' ? new Date(row.settledAt) : undefined,
    betAuthorized: Number(row.betAuthorized) === 1,
    betExecuted: Number(row.betExecuted) === 1,
    isPrimary: Number(row.isPrimary) === 1,
  };
}
