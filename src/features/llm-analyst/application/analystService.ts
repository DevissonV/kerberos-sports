import { analystInputHash, buildAnalystInput } from '../domain/snapshot';
import {
  ANALYST_PROMPT_VERSION,
  parseAnalystOutput,
  type AnalystOutput,
} from '../domain/contracts';
import type { AnalystProvider } from '../ports/analystProvider';
import type { AnalystRecord, AnalystStore } from '../ports/analystStore';
import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';

export interface AnalystRunOptions {
  enabled: boolean;
  maxAnalyses: number;
}
export interface AnalystRunResult {
  selected: number;
  evaluated: number;
  cacheHits: number;
  failures: number;
  skipped: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  records: AnalystRecord[];
}

export class AnalystService {
  constructor(
    private readonly provider: AnalystProvider,
    private readonly store: AnalystStore,
  ) {}

  async analyze(
    analyses: readonly QuantFixtureAnalysis[],
    now: Date,
    options: AnalystRunOptions,
  ): Promise<AnalystRunResult> {
    const shortlist = selectAnalystShortlist(analyses, options.maxAnalyses);
    const result: AnalystRunResult = {
      selected: shortlist.length,
      evaluated: 0,
      cacheHits: 0,
      failures: 0,
      skipped: options.enabled ? Math.max(0, analyses.length - shortlist.length) : analyses.length,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      records: [],
    };
    if (!options.enabled || shortlist.length === 0) return result;
    for (const analysis of shortlist) {
      const input = buildAnalystInput(analysis);
      const hash = analystInputHash(input);
      const key = [input.fixtureId, input.snapshotAt, hash, ANALYST_PROMPT_VERSION].join(':');
      const cached = this.store.findByCacheKey(key);
      if (cached !== null) {
        result.cacheHits += 1;
        result.records.push(cached);
        continue;
      }
      try {
        const response = await this.provider.infer(input, ANALYST_PROMPT_VERSION);
        result.inputTokens += response.inputTokens ?? 0;
        result.outputTokens += response.outputTokens ?? 0;
        result.totalTokens += response.totalTokens ?? 0;
        let output: AnalystOutput | null = null;
        let status: AnalystRecord['status'] = response.status;
        if (response.status === 'SUCCESS') {
          try {
            output = parseAnalystOutput(
              typeof response.output === 'string' ? JSON.parse(response.output) : response.output,
              input,
            );
            status = 'SUCCESS';
          } catch {
            status = 'INVALID_OUTPUT';
          }
        }
        if (status !== 'SUCCESS') result.failures += 1;
        const record: AnalystRecord = {
          fixtureId: input.fixtureId,
          snapshotAt: new Date(input.snapshotAt),
          modelVersion: 'poisson-v1',
          promptVersion: ANALYST_PROMPT_VERSION,
          inputHash: hash,
          provider: response.provider,
          model: response.model,
          output,
          status,
          createdAt: now,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          totalTokens: response.totalTokens,
        };
        this.store.save(record);
        result.evaluated += 1;
        result.records.push(record);
      } catch {
        result.failures += 1;
      }
    }
    return result;
  }
}

export function selectAnalystShortlist(
  analyses: readonly QuantFixtureAnalysis[],
  maxAnalyses: number,
): QuantFixtureAnalysis[] {
  return [...analyses]
    .sort((a, b) => {
      const aScore = Math.abs(
        (a.side?.modelProbability ?? Math.max(a.model.pOver, a.model.pUnder)) - 0.5,
      );
      const bScore = Math.abs(
        (b.side?.modelProbability ?? Math.max(b.model.pOver, b.model.pUnder)) - 0.5,
      );
      return bScore - aScore || a.fixture.id.localeCompare(b.fixture.id);
    })
    .slice(0, Math.max(0, maxAnalyses));
}
