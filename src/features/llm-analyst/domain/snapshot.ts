import { createHash } from 'node:crypto';
import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';
import { analystInputSchema, ANALYST_CONTEXT_VERSION, type AnalystInput } from './contracts';

export function buildAnalystInput(analysis: QuantFixtureAnalysis): AnalystInput {
  const side = analysis.side;
  const model = analysis.model;
  return analystInputSchema.parse({
    contextVersion: ANALYST_CONTEXT_VERSION,
    fixtureId: analysis.fixture.id,
    snapshotAt: (analysis.snapshotAt ?? analysis.model.snapshotAt).toISOString(),
    fixture: {
      league: analysis.fixture.league,
      kickoffAt: analysis.fixture.kickoffAt.toISOString(),
      home: analysis.fixture.homeTeam,
      away: analysis.fixture.awayTeam,
    },
    quantitativeSignal: {
      modelProbability: side?.modelProbability ?? Math.max(model.pOver, model.pUnder),
      expectedGoals: { home: model.lambdaHome, away: model.lambdaAway, total: model.lambdaTotal },
      sampleSize: {
        // El contrato Poisson actual no expone el total de partidos de liga.
        // Se conserva como dato explícitamente no disponible, sin alterar el modelo.
        league: 0,
        homeRole: model.homeRoleMatches,
        awayRole: model.awayRoleMatches,
      },
      marketState:
        side === undefined ? null : { selection: side.selection, observedOdds: side.offeredOdds },
    },
  });
}

export function analystInputHash(input: AnalystInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
