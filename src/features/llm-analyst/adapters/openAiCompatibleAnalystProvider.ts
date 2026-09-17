import { ANALYST_PROMPT_VERSION, type AnalystInput } from '../domain/contracts';
import type { AnalystProvider, AnalystProviderResult } from '../ports/analystProvider';

const PROMPT =
  'Analiza solo el contexto entregado. Devuelve únicamente JSON con el schema. No incluyas stake, bankroll, finalBetDecision, probabilidades, edge ni EV en la salida.';
const TIMEOUT_MS = 8_000;
export class OpenAiCompatibleAnalystProvider implements AnalystProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async infer(
    input: AnalystInput,
    promptVersion = ANALYST_PROMPT_VERSION,
  ): Promise<AnalystProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions: `${PROMPT}\nPrompt version: ${promptVersion}`,
          input: JSON.stringify(input),
          max_output_tokens: 400,
          text: {
            format: {
              type: 'json_schema',
              name: 'kerberos_context',
              strict: true,
              schema: analystJsonSchema,
            },
          },
        }),
      });
      if (!response.ok)
        return {
          output: '',
          status: 'PROVIDER_ERROR',
          provider: 'openai-compatible',
          model: this.model,
        };
      const payload = (await response.json()) as Record<string, unknown>;
      return {
        output: extractOutputText(payload),
        status: 'SUCCESS',
        provider: 'openai-compatible',
        model: this.model,
        ...usageFrom(payload.usage),
      };
    } catch (error) {
      return {
        output: '',
        status:
          error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_ERROR',
        provider: 'openai-compatible',
        model: this.model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
const analystJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fixtureId: { type: 'string' },
    contextScore: { type: 'integer', minimum: 0, maximum: 100 },
    priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    alerts: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    supportingFactors: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    contradictingFactors: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    suggestedMarketsToInvestigate: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    summary: { type: 'string' },
    confidenceInContext: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
  },
  required: [
    'fixtureId',
    'contextScore',
    'priority',
    'alerts',
    'supportingFactors',
    'contradictingFactors',
    'suggestedMarketsToInvestigate',
    'summary',
    'confidenceInContext',
  ],
};
function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = payload.output;
  if (!Array.isArray(output)) return '';
  for (const item of output) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !Array.isArray((item as Record<string, unknown>).content)
    )
      continue;
    for (const part of (item as Record<string, unknown>).content as unknown[])
      if (
        typeof part === 'object' &&
        part !== null &&
        typeof (part as Record<string, unknown>).text === 'string'
      )
        return (part as Record<string, unknown>).text as string;
  }
  return '';
}
function usageFrom(
  value: unknown,
): Pick<AnalystProviderResult, 'inputTokens' | 'outputTokens' | 'totalTokens'> {
  if (typeof value !== 'object' || value === null) return {};
  const usage = value as Record<string, unknown>;
  return {
    inputTokens: number(usage.input_tokens),
    outputTokens: number(usage.output_tokens),
    totalTokens: number(usage.total_tokens),
  };
}
function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
