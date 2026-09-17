import { computePoissonV1 } from '../../poisson/domain/model';
import type { HistoricalMatch, PoissonModelOutput } from '../../poisson/domain/concepts';
import type { Fixture } from '../../scanning/domain/concepts';

export type ModelSnapshotType =
  'PREANALYSIS' | 'MARKET_DECISION' | 'REVALIDATION' | 'FINAL_REVALIDATION';

export interface ModelAnalysis {
  fixture: Fixture;
  snapshotAt: Date;
  snapshotType: ModelSnapshotType;
  model: PoissonModelOutput;
  decision: 'PREANALYSIS';
  reason?: 'INSUFFICIENT_DATA';
}

export interface ModelAnalysisOutput {
  analyses: ModelAnalysis[];
  insufficientData: number;
}

/** Ejecuta Poisson para fixtures elegibles sin consultar ni requerir cuotas. */
export function runModelAnalysis(
  fixtures: readonly Fixture[],
  historicalMatchesForFixture: (fixture: Fixture) => readonly HistoricalMatch[],
  snapshotAt: Date,
  snapshotType: ModelSnapshotType = 'PREANALYSIS',
): ModelAnalysisOutput {
  const analyses: ModelAnalysis[] = [];
  let insufficientData = 0;
  for (const fixture of fixtures) {
    const result = computePoissonV1({
      fixtureId: fixture.id,
      league: fixture.league,
      home: fixture.homeTeam,
      away: fixture.awayTeam,
      snapshotAt,
      historicalMatches: historicalMatchesForFixture(fixture),
    });
    if (result.status !== 'OK') {
      insufficientData += 1;
      continue;
    }
    analyses.push({
      fixture,
      snapshotAt,
      snapshotType,
      model: result.output,
      decision: 'PREANALYSIS',
    });
  }
  return { analyses, insufficientData };
}
