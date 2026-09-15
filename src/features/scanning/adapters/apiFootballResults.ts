import type { FixtureResult, ResultsProvider } from '../ports/resultsProvider';
import { ResultsProviderError } from '../ports/resultsProvider';

interface ApiFootballResultPayload {
  response: Array<{
    fixture: {
      id: number;
      status: { short: string };
      finishedAt?: string | null;
    };
    goals: { home: number | null; away: number | null };
    score?: { fulltime?: { home: number | null; away: number | null } };
  }>;
}

function assertResponseShape(payload: unknown): ApiFootballResultPayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as ApiFootballResultPayload).response)
  ) {
    throw new ResultsProviderError('respuesta de API-Football sin array "response"');
  }
  return payload as ApiFootballResultPayload;
}

function validGoal(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

export function parseFixtureResult(payload: unknown, fixtureId: string): FixtureResult | null {
  const body = assertResponseShape(payload);
  const entry = body.response.find((candidate) => String(candidate.fixture.id) === fixtureId);
  if (entry === undefined) return null;

  const fulltime = entry.score?.fulltime;
  const finishedAt = entry.fixture.finishedAt;
  return {
    fixtureId,
    status: entry.fixture.status.short,
    fulltimeHome: validGoal(fulltime?.home ?? entry.goals.home),
    fulltimeAway: validGoal(fulltime?.away ?? entry.goals.away),
    finishedAt:
      typeof finishedAt === 'string' && !Number.isNaN(Date.parse(finishedAt))
        ? new Date(finishedAt)
        : null,
  };
}

/** Adapter API-Football: solo expone el marcador fulltime, nunca extra time ni penales. */
export class ApiFootballResultsAdapter implements ResultsProvider {
  private requests = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async result(fixtureId: string): Promise<FixtureResult | null> {
    this.requests += 1;
    const response = await this.fetchImpl(`${this.baseUrl}/fixtures?id=${fixtureId}`, {
      headers: { 'x-apisports-key': this.apiKey },
    });
    if (!response.ok) {
      throw new ResultsProviderError(`API-Football respondio HTTP ${response.status}`);
    }
    return parseFixtureResult(await response.json(), fixtureId);
  }

  requestCount(): number {
    return this.requests;
  }
}
