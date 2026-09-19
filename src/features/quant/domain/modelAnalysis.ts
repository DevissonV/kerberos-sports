import { computePoissonV1 } from '../../poisson/domain/model';
import type { HistoricalMatch, PoissonModelOutput } from '../../poisson/domain/concepts';
import { filterHistoricalWindow } from '../../poisson/domain/historicalWindow';
import { fixtureHistoryStatus } from '../../poisson/domain/roleHistory';
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
  modelMode?: 'DOMESTIC' | 'CROSS_LEAGUE_EXPERIMENTAL';
  homeDomesticLeague?: string | null;
  awayDomesticLeague?: string | null;
}

export interface ModelAnalysisOutput {
  analyses: ModelAnalysis[];
  insufficientData: number;
  /** Fixtures cuyo nombre no resolvió a identidad canónica en el histórico de SU liga. */
  aliasFailures: number;
}

/**
 * Ejecuta Poisson para fixtures elegibles sin consultar ni requerir cuotas.
 * Exige identidad canónica resuelta antes de modelar (misma puerta que la etapa
 * de mercado: un equipo sin rol histórico no puede producir un PREANALYSIS
 * causal); los equipos con historial bajo siguen modelándose vía shrinkage,
 * sin tocar los mínimos del modelo.
 */
export function runModelAnalysis(
  fixtures: readonly Fixture[],
  historicalMatchesForFixture: (fixture: Fixture) => readonly HistoricalMatch[],
  snapshotAt: Date,
  snapshotType: ModelSnapshotType = 'PREANALYSIS',
): ModelAnalysisOutput {
  const analyses: ModelAnalysis[] = [];
  let insufficientData = 0;
  let aliasFailures = 0;
  for (const fixture of fixtures) {
    const status = fixtureHistoryStatus(
      filterHistoricalWindow(historicalMatchesForFixture(fixture), snapshotAt),
      fixture.homeTeam,
      fixture.awayTeam,
    );
    if (status === 'ALIAS_FAILURE') {
      aliasFailures += 1;
      continue;
    }
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
  return { analyses, insufficientData, aliasFailures };
}
