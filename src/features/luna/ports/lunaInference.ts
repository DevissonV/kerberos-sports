import type { LunaInput, LunaOutput } from '../domain/contracts';

export const LUNA_INFERENCE = Symbol('LunaInference');

export interface LunaInference {
  infer(input: LunaInput, promptVersion: string): Promise<LunaOutput | string>;
}
