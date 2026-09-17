import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { QuantFixtureAnalysis } from '../application/quantPipeline';
import type { ModelAnalysisStore, StoredModelAnalysis } from '../ports/modelAnalysisStore';
import type { ModelAnalysis } from '../domain/modelAnalysis';

export class SqliteModelAnalysisStore implements ModelAnalysisStore {
  private readonly db: Db;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS model_analyses (
        cohortId TEXT NOT NULL, fixtureId TEXT NOT NULL, snapshotType TEXT NOT NULL,
        snapshotAt TEXT NOT NULL, league TEXT NOT NULL, homeTeam TEXT NOT NULL,
        awayTeam TEXT NOT NULL, kickoff TEXT NOT NULL, homeLambda REAL NOT NULL,
        awayLambda REAL NOT NULL, expectedGoals REAL NOT NULL, probabilityOver25 REAL NOT NULL,
        probabilityUnder25 REAL NOT NULL, modelSelection TEXT, marketOdds REAL,
        fairMarketProbability REAL, edge REAL, ev REAL, decision TEXT NOT NULL,
        reason TEXT, PRIMARY KEY (cohortId, fixtureId, snapshotType)
      );
    `);
  }

  saveModelAnalysis(analysis: ModelAnalysis): void {
    this.db
      .prepare(
        `
      INSERT INTO model_analyses
        (cohortId, fixtureId, snapshotType, snapshotAt, league, homeTeam, awayTeam, kickoff,
         homeLambda, awayLambda, expectedGoals, probabilityOver25, probabilityUnder25,
         modelSelection, decision, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cohortId, fixtureId, snapshotType) DO UPDATE SET
        snapshotAt=excluded.snapshotAt, homeLambda=excluded.homeLambda, awayLambda=excluded.awayLambda,
        expectedGoals=excluded.expectedGoals, probabilityOver25=excluded.probabilityOver25,
        probabilityUnder25=excluded.probabilityUnder25, modelSelection=excluded.modelSelection,
        decision=excluded.decision, reason=excluded.reason
    `,
      )
      .run(
        'KSS-V1-C01',
        analysis.fixture.id,
        analysis.snapshotType,
        (analysis.snapshotAt ?? analysis.model.snapshotAt).toISOString(),
        analysis.fixture.league,
        analysis.fixture.homeTeam,
        analysis.fixture.awayTeam,
        analysis.fixture.kickoffAt.toISOString(),
        analysis.model.lambdaHome,
        analysis.model.lambdaAway,
        analysis.model.lambdaTotal,
        analysis.model.pOver,
        analysis.model.pUnder,
        null,
        analysis.decision,
        analysis.reason ?? null,
      );
  }

  saveMarketAnalysis(analysis: QuantFixtureAnalysis): void {
    const side = analysis.side;
    this.db
      .prepare(
        `
      INSERT INTO model_analyses
        (cohortId, fixtureId, snapshotType, snapshotAt, league, homeTeam, awayTeam, kickoff,
         homeLambda, awayLambda, expectedGoals, probabilityOver25, probabilityUnder25,
         modelSelection, marketOdds, fairMarketProbability, edge, ev, decision, reason)
      VALUES (?, ?, 'MARKET_DECISION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cohortId, fixtureId, snapshotType) DO UPDATE SET
        snapshotAt=excluded.snapshotAt, marketOdds=excluded.marketOdds,
        fairMarketProbability=excluded.fairMarketProbability, edge=excluded.edge,
        ev=excluded.ev, decision=excluded.decision, reason=excluded.reason
    `,
      )
      .run(
        'KSS-V1-C01',
        analysis.fixture.id,
        (analysis.snapshotAt ?? analysis.model.snapshotAt).toISOString(),
        analysis.fixture.league,
        analysis.fixture.homeTeam,
        analysis.fixture.awayTeam,
        analysis.fixture.kickoffAt.toISOString(),
        analysis.model.lambdaHome,
        analysis.model.lambdaAway,
        analysis.model.lambdaTotal,
        analysis.model.pOver,
        analysis.model.pUnder,
        side?.selection ?? null,
        side?.offeredOdds ?? null,
        side?.fairMarketProbability ?? null,
        side?.edge ?? null,
        side?.expectedValue ?? null,
        analysis.decision,
        analysis.reason ?? null,
      );
  }

  findLatest(
    fixtureId: string,
    snapshotType?: ModelAnalysis['snapshotType'],
  ): StoredModelAnalysis | null {
    const row = this.db
      .prepare(
        `SELECT * FROM model_analyses WHERE cohortId='KSS-V1-C01' AND fixtureId=? ${snapshotType === undefined ? '' : 'AND snapshotType=?'} ORDER BY snapshotAt DESC LIMIT 1`,
      )
      .get(...(snapshotType === undefined ? [fixtureId] : [fixtureId, snapshotType])) as
      Record<string, unknown> | undefined;
    if (row === undefined) return null;
    return {
      fixture: {
        id: String(row.fixtureId),
        sport: 'FOOTBALL',
        league: String(row.league),
        homeTeam: String(row.homeTeam),
        awayTeam: String(row.awayTeam),
        kickoffAt: new Date(String(row.kickoff)),
        status: 'NS',
      },
      snapshotAt: new Date(String(row.snapshotAt)),
      snapshotType: String(row.snapshotType) as StoredModelAnalysis['snapshotType'],
      model: {
        modelVersion: 'poisson-v1',
        snapshotAt: new Date(String(row.snapshotAt)),
        fixtureId: String(row.fixtureId),
        league: String(row.league),
        home: String(row.homeTeam),
        away: String(row.awayTeam),
        leagueHomeGoalsMean: 0,
        leagueAwayGoalsMean: 0,
        homeRoleMatches: 0,
        awayRoleMatches: 0,
        lambdaHome: Number(row.homeLambda),
        lambdaAway: Number(row.awayLambda),
        lambdaTotal: Number(row.expectedGoals),
        pOver: Number(row.probabilityOver25),
        pUnder: Number(row.probabilityUnder25),
        dataQuality: [],
      },
    };
  }

  close(): void {
    this.db.close();
  }
}
