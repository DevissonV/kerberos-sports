import type { ScanCandidate } from '../../scanning/application/scanPipeline';
import { PROTOCOL_COHORT_ID } from '../../scanning/domain/protocol';
import {
  LUNA_MODEL_VERSION,
  LUNA_PROMPT_VERSION,
  MAX_LLM_REVIEWS_PER_RUN,
  parseLunaOutput,
  type LunaOutput,
} from '../domain/contracts';
import { buildLunaSnapshot, lunaSnapshotHash } from '../domain/snapshot';
import type { LunaInference } from '../ports/lunaInference';
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
): Promise<{ parsed: LunaOutput | null; invalid: boolean }> {
  let invalid = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const value = await infer.infer(input, LUNA_PROMPT_VERSION);
      const parsed = parseSafely(value, input);
      if (parsed !== null) return { parsed, invalid };
      invalid = true;
    } catch {
      // Un timeout transitorio también puede consumir el único retry.
    }
  }
  return { parsed: null, invalid };
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
