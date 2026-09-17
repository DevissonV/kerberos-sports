import type { AnalystInput, AnalystOutput } from '../domain/contracts';

export const ANALYST_PROVIDER = Symbol('AnalystProvider');

export type AnalystProviderStatus = 'SUCCESS' | 'PROVIDER_ERROR' | 'TIMEOUT';

export interface AnalystProviderResult {
  output: AnalystOutput | string;
  status: AnalystProviderStatus;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AnalystProvider {
  infer(input: AnalystInput, promptVersion: string): Promise<AnalystProviderResult>;
}
