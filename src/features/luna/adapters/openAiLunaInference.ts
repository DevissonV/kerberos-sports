import {
  LUNA_MODEL_VERSION,
  LUNA_PROMPT,
  LUNA_RUNTIME_MODEL,
  type LunaInput,
} from '../domain/contracts';
import type { LunaInference, LunaInferenceResult } from '../ports/lunaInference';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 8_000;

export type LunaFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Adapter runtime de Responses API. No habilita tools y no altera decisiones PAPER. */
export class OpenAiLunaInference implements LunaInference {
  constructor(
    private readonly apiKey: string,
    private readonly model = LUNA_RUNTIME_MODEL,
    private readonly baseUrl = 'https://api.openai.com/v1',
    private readonly fetcher: LunaFetch = fetch,
  ) {}

  async infer(input: LunaInput, promptVersion: string): Promise<LunaInferenceResult> {
    if (this.apiKey.trim().length === 0) {
      return {
        output: unavailableOutput(input),
        status: 'INSUFFICIENT_DATA',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const body = {
        model: this.model,
        store: false,
        instructions: `${LUNA_PROMPT}\nPrompt version: ${promptVersion}`,
        input: JSON.stringify(input),
        max_output_tokens: 300,
        text: {
          format: {
            type: 'json_schema',
            name: 'luna_evaluation',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                modelVersion: { type: 'string' },
                fixtureId: { type: 'string' },
                market: { type: 'string', enum: ['OVER_UNDER_2_5'] },
                pOver: { type: 'number', minimum: 0, maximum: 1 },
                pUnder: { type: 'number', minimum: 0, maximum: 1 },
                confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                decision: {
                  type: 'string',
                  enum: ['CONFIRM', 'DOWNGRADE', 'REJECT', 'INSUFFICIENT_DATA'],
                },
                reasons: { type: 'array', items: { type: 'string' }, maxItems: 3 },
                riskFlags: { type: 'array', items: { type: 'string' } },
                snapshotAt: { type: 'string' },
              },
              required: [
                'modelVersion',
                'fixtureId',
                'market',
                'pOver',
                'pUnder',
                'confidence',
                'decision',
                'reasons',
                'riskFlags',
                'snapshotAt',
              ],
            },
          },
        },
      };
      const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) return { output: unavailableOutput(input), status: 'PROVIDER_ERROR' };
      const payload = (await response.json()) as Record<string, unknown>;
      const outputText = extractOutputText(payload);
      const usage = usageFrom(payload.usage);
      return {
        output: outputText,
        status: 'SUCCESS',
        ...usage,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { output: unavailableOutput(input), status: 'TIMEOUT' };
      }
      return { output: unavailableOutput(input), status: 'PROVIDER_ERROR' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (!Array.isArray(payload.output)) return '';
  for (const item of payload.output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === 'string') return text;
    }
  }
  return '';
}

function usageFrom(
  value: unknown,
): Pick<LunaInferenceResult, 'inputTokens' | 'outputTokens' | 'totalTokens'> {
  if (typeof value !== 'object' || value === null) return {};
  const usage = value as Record<string, unknown>;
  const inputTokens = numberOrUndefined(usage.input_tokens);
  const outputTokens = numberOrUndefined(usage.output_tokens);
  const totalTokens = numberOrUndefined(usage.total_tokens);
  return { inputTokens, outputTokens, totalTokens };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function unavailableOutput(input: LunaInput): string {
  return JSON.stringify({
    modelVersion: LUNA_MODEL_VERSION,
    fixtureId: input.fixture.fixtureId,
    market: 'OVER_UNDER_2_5',
    pOver: 0.5,
    pUnder: 0.5,
    confidence: 'low',
    decision: 'INSUFFICIENT_DATA',
    reasons: ['Proveedor de Luna no disponible'],
    riskFlags: ['PROVIDER_UNAVAILABLE'],
    snapshotAt: input.snapshotAt,
  });
}

export { RESPONSES_URL, REQUEST_TIMEOUT_MS };
