import type { AnalystOutput } from '../domain/contracts';

export const ANALYST_STORE = Symbol('AnalystStore');

export interface AnalystRecord {
  fixtureId: string;
  snapshotAt: Date;
  modelVersion: string;
  promptVersion: string;
  inputHash: string;
  provider: string;
  model: string;
  output: AnalystOutput | null;
  status: 'SUCCESS' | 'INVALID_OUTPUT' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'SKIPPED';
  createdAt: Date;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AnalystStore {
  findByCacheKey(key: string): AnalystRecord | null;
  save(record: AnalystRecord): void;
}
