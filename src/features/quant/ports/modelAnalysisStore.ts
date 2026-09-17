import type { ModelAnalysis } from '../domain/modelAnalysis';
import type { QuantFixtureAnalysis } from '../application/quantPipeline';

export const MODEL_ANALYSIS_STORE = Symbol('ModelAnalysisStore');

export interface StoredModelAnalysis {
  model: ModelAnalysis['model'];
  fixture: ModelAnalysis['fixture'];
  snapshotAt: Date;
  snapshotType: ModelAnalysis['snapshotType'];
}

export interface ModelAnalysisStore {
  saveModelAnalysis(analysis: ModelAnalysis): void;
  saveMarketAnalysis(analysis: QuantFixtureAnalysis): void;
  findLatest(
    fixtureId: string,
    snapshotType?: ModelAnalysis['snapshotType'],
  ): StoredModelAnalysis | null;
  listLatest(snapshotType?: ModelAnalysis['snapshotType']): readonly StoredModelAnalysis[];
}
