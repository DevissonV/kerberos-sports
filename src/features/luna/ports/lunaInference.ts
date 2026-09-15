import type { LunaInput, LunaOutput } from '../domain/contracts';
import type { LunaEvaluationStatus } from '../domain/contracts';

export const LUNA_INFERENCE = Symbol('LunaInference');

export interface LunaInferenceResult {
  output: LunaOutput | string;
  status: LunaEvaluationStatus;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface LunaInference {
  infer(
    input: LunaInput,
    promptVersion: string,
  ): Promise<LunaOutput | string | LunaInferenceResult>;
}
