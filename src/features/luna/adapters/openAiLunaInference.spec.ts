import { OpenAiLunaInference } from './openAiLunaInference';
import { buildLunaSnapshot } from '../domain/snapshot';

const input = buildLunaSnapshot(
  {
    id: 'fixture-1',
    sport: 'FOOTBALL',
    league: 'Premier League',
    leagueId: 39,
    country: 'England',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoffAt: new Date('2026-09-20T19:00:00Z'),
    status: 'NS',
  },
  new Date('2026-09-20T14:00:00Z'),
);

const validOutput = JSON.stringify({
  modelVersion: 'GPT-5.6 Luna',
  fixtureId: 'fixture-1',
  market: 'OVER_UNDER_2_5',
  pOver: 0.45,
  pUnder: 0.55,
  confidence: 'low',
  decision: 'INSUFFICIENT_DATA',
  reasons: ['No hay contexto'],
  riskFlags: [],
  snapshotAt: input.snapshotAt,
});

function response(body: Record<string, unknown>, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe('OpenAiLunaInference', () => {
  it('sin API key no llama al proveedor', async () => {
    const fetcher = jest.fn();
    const result = await new OpenAiLunaInference(
      '',
      'gpt-5.6-luna',
      'https://example.test/v1',
      fetcher,
    ).infer(input, 'luna-sports-brain-v1');
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('envía el modelo, snapshot ciego y structured output', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      response({
        output_text: validOutput,
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      }),
    );
    const result = await new OpenAiLunaInference(
      'secret',
      'gpt-5.6-luna',
      'https://example.test/v1',
      fetcher,
    ).infer(input, 'luna-sports-brain-v1');
    const call = fetcher.mock.calls[0] as [string, RequestInit];
    const request = JSON.parse(typeof call[1].body === 'string' ? call[1].body : '') as Record<
      string,
      unknown
    >;
    const serialized = String(request.input).toLowerCase();
    expect(call[0]).toBe('https://example.test/v1/responses');
    expect(request.model).toBe('gpt-5.6-luna');
    expect(request.store).toBe(false);
    expect(serialized).not.toMatch(/odds|bookmaker|quant|poisson|lambda|edge|ev/);
    expect(result.status).toBe('SUCCESS');
    expect(result.inputTokens).toBe(10);
  });

  it('convierte errores del proveedor en fail-open', async () => {
    const result = await new OpenAiLunaInference(
      'secret',
      'gpt-5.6-luna',
      'https://example.test/v1',
      () => Promise.resolve(response({}, false)),
    ).infer(input, 'luna-sports-brain-v1');
    expect(result.status).toBe('PROVIDER_ERROR');
  });

  it('clasifica timeout sin propagarlo al pipeline', async () => {
    const timeoutError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const result = await new OpenAiLunaInference(
      'secret',
      'gpt-5.6-luna',
      'https://example.test/v1',
      () => Promise.reject(timeoutError),
    ).infer(input, 'luna-sports-brain-v1');
    expect(result.status).toBe('TIMEOUT');
  });
});
