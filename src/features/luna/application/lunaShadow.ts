import type { ScanCandidate } from '../../scanning/application/scanPipeline';
import { PROTOCOL_COHORT_ID } from '../../scanning/domain/protocol';
import {
  LUNA_MODEL_VERSION,
  LUNA_PROMPT_VERSION,
  MAX_LLM_REVIEWS_PER_RUN,
  parseLunaOutput,
  type LunaEvaluationStatus,
  type LunaOutput,
} from '../domain/contracts';
import { buildLunaSnapshot, lunaSnapshotHash } from '../domain/snapshot';
import type { LunaInference, LunaInferenceResult } from '../ports/lunaInference';
import type { LunaShadowRecord, LunaShadowStore } from '../ports/lunaShadowStore';

export interface LunaShortlistEntry {
  candidate: ScanCandidate;
  expectedValue: number;
}

export interface LunaShadowDeps {
  shortlist: readonly LunaShortlistEntry[];
  infer: LunaInference;
  store: LunaShadowStore;
  now: Date;
}

export interface LunaShadowResult {
  selected: number;
  evaluated: number;
  cacheHits: number;
  invalidOutputs: number;
  insufficientData: number;
  providerErrors: number;
  timeouts: number;
  apiCalls: number;
  successes: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  records: LunaShadowRecord[];
}

export function selectLunaShortlist(entries: readonly LunaShortlistEntry[]): LunaShortlistEntry[] {
  return [...entries]
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .slice(0, MAX_LLM_REVIEWS_PER_RUN);
}

export async function runLunaShadow(deps: LunaShadowDeps): Promise<LunaShadowResult> {
  const shortlist = selectLunaShortlist(deps.shortlist);
  const result: LunaShadowResult = {
    selected: shortlist.length,
    evaluated: 0,
    cacheHits: 0,
    invalidOutputs: 0,
    insufficientData: 0,
    providerErrors: 0,
    timeouts: 0,
    apiCalls: 0,
    successes: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    records: [],
  };
  for (const entry of shortlist) {
    const snapshot = buildLunaSnapshot(entry.candidate.fixture, entry.candidate.snapshotAt);
    const hash = lunaSnapshotHash(snapshot);
    const cacheKey = lunaCacheKey(entry.candidate.fixture.id, snapshot.snapshotVersion, hash);
    const cached = deps.store.findByCacheKey(cacheKey);
    if (cached !== null) {
      result.cacheHits += 1;
      result.records.push(cached);
      continue;
    }
    const inference = await inferAndParseWithSingleRetry(deps.infer, snapshot);
    if (inference.invalid) result.invalidOutputs += 1;
    if (inference.status === 'PROVIDER_ERROR') result.providerErrors += 1;
    if (inference.status === 'TIMEOUT') result.timeouts += 1;
    if (inference.status === 'SUCCESS' && inference.parsed !== null) result.successes += 1;
    result.apiCalls += inference.apiCalls;
    result.inputTokens += inference.inputTokens;
    result.outputTokens += inference.outputTokens;
    result.totalTokens += inference.totalTokens;
    const finalOutput =
      inference.parsed ??
      (inference.invalid ? invalidOutput(snapshot) : insufficientOutput(snapshot));
    if (finalOutput.decision === 'INSUFFICIENT_DATA') result.insufficientData += 1;
    const record: LunaShadowRecord = {
      cohortId: PROTOCOL_COHORT_ID,
      fixtureId: entry.candidate.fixture.id,
      snapshotAt: entry.candidate.snapshotAt,
      snapshotHash: hash,
      snapshotVersion: snapshot.snapshotVersion,
      promptVersion: LUNA_PROMPT_VERSION,
      modelVersion: finalOutput.modelVersion,
      pOver: finalOutput.pOver,
      pUnder: finalOutput.pUnder,
      confidence: finalOutput.confidence,
      decision: finalOutput.decision,
      reasons: finalOutput.reasons,
      riskFlags: finalOutput.riskFlags,
      createdAt: deps.now,
      status: inference.invalid ? 'INVALID_OUTPUT' : inference.status,
      inputTokens: inference.inputTokens || undefined,
      outputTokens: inference.outputTokens || undefined,
      totalTokens: inference.totalTokens || undefined,
    };
    deps.store.save(record);
    result.evaluated += 1;
    result.records.push(record);
  }
  return result;
}

export function lunaCacheKey(
  fixtureId: string,
  snapshotVersion: string,
  snapshotHash: string,
): string {
  return [fixtureId, snapshotVersion, snapshotHash, LUNA_PROMPT_VERSION, LUNA_MODEL_VERSION].join(
    ':',
  );
}

async function inferAndParseWithSingleRetry(
  infer: LunaInference,
  input: Parameters<LunaInference['infer']>[0],
): Promise<{
  parsed: LunaOutput | null;
  invalid: boolean;
  status: LunaEvaluationStatus;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}> {
  let invalid = false;
  let status: LunaEvaluationStatus = 'INSUFFICIENT_DATA';
  let apiCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const value = await infer.infer(input, LUNA_PROMPT_VERSION);
      const response = isInferenceResult(value)
        ? value
        : { output: value, status: 'SUCCESS' as const };
      status = response.status;
      if (status !== 'INSUFFICIENT_DATA') apiCalls += 1;
      inputTokens += response.inputTokens ?? 0;
      outputTokens += response.outputTokens ?? 0;
      totalTokens += response.totalTokens ?? 0;
      const parsed = parseSafely(response.output, input);
      if (parsed !== null)
        return { parsed, invalid, status, apiCalls, inputTokens, outputTokens, totalTokens };
      if (status !== 'SUCCESS')
        return {
          parsed: null,
          invalid: false,
          status,
          apiCalls,
          inputTokens,
          outputTokens,
          totalTokens,
        };
      invalid = true;
    } catch {
      return {
        parsed: null,
        invalid: false,
        status: 'PROVIDER_ERROR',
        apiCalls: apiCalls + 1,
        inputTokens,
        outputTokens,
        totalTokens,
      };
    }
  }
  return { parsed: null, invalid, status, apiCalls, inputTokens, outputTokens, totalTokens };
}

function isInferenceResult(
  value: LunaOutput | string | LunaInferenceResult,
): value is LunaInferenceResult {
  return typeof value === 'object' && value !== null && 'output' in value && 'status' in value;
}

function parseSafely(
  value: LunaOutput | string,
  input: Parameters<LunaInference['infer']>[0],
): LunaOutput | null {
  try {
    const parsedJson: unknown = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    return parseLunaOutput(parsedJson, input);
  } catch {
    return null;
  }
}

function insufficientOutput(input: Parameters<LunaInference['infer']>[0]): LunaOutput {
  return {
    modelVersion: LUNA_MODEL_VERSION,
    fixtureId: input.fixture.fixtureId,
    market: 'OVER_UNDER_2_5',
    pOver: 0.5,
    pUnder: 0.5,
    confidence: 'low',
    decision: 'INSUFFICIENT_DATA',
    reasons: ['No hay contexto causal verificable disponible'],
    riskFlags: ['INSUFFICIENT_DATA'],
    snapshotAt: input.snapshotAt,
  };
}

function invalidOutput(input: Parameters<LunaInference['infer']>[0]): LunaOutput {
  return {
    ...insufficientOutput(input),
    reasons: ['LUNA_INVALID_OUTPUT'],
    riskFlags: ['LUNA_INVALID_OUTPUT'],
  };
}
