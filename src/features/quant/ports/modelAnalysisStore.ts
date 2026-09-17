import type { ModelAnalysis } from '../domain/modelAnalysis';
import type { QuantFixtureAnalysis } from '../application/quantPipeline';

export const MODEL_ANALYSIS_STORE = Symbol('ModelAnalysisStore');

export interface StoredModelAnalysis {
  model: ModelAnalysis['model'];
  fixture: ModelAnalysis['fixture'];
  snapshotAt: Date;
  snapshotType: ModelAnalysis['snapshotType'];
  decision?: 'PREANALYSIS' | 'BET' | 'NO_BET' | 'NO_ODDS' | 'INSUFFICIENT_DATA';
  reason?: string;
}

export interface TerminalMarketDecision {
  fixture: ModelAnalysis['fixture'];
  snapshotAt: Date;
  model: ModelAnalysis['model'];
  decision: 'NO_ODDS' | 'INSUFFICIENT_DATA' | 'EXPIRED' | 'BUDGET_BLOCKED';
  reason: string;
}

export interface ModelAnalysisStore {
  saveModelAnalysis(analysis: ModelAnalysis): void;
  saveMarketAnalysis(analysis: QuantFixtureAnalysis): void;
  saveTerminalMarketDecision(decision: TerminalMarketDecision): void;
  findLatest(
    fixtureId: string,
    snapshotType?: ModelAnalysis['snapshotType'],
  ): StoredModelAnalysis | null;
  listLatest(snapshotType?: ModelAnalysis['snapshotType']): readonly StoredModelAnalysis[];
}
