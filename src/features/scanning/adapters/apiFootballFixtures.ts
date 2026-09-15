/**
 * Adapter HTTP para API-Football (api-football.com, v3).
 * Traduce el JSON del proveedor al modelo interno. Un solo request por corrida
 * (`/fixtures?next=N`): sin polling.
 */

import type { Fixture } from '../domain/concepts';
import type { FixturesProvider } from '../ports/fixturesProvider';
import { FixturesProviderError } from '../ports/fixturesProvider';

/** Subconjunto del JSON real de API-Football que consumimos. */
export interface ApiFootballFixtureResponse {
  response: Array<{
    fixture: { id: number; date: string; status: { short: string } };
    league: { name: string };
    teams: { home: { name: string }; away: { name: string } };
  }>;
}

function assertResponseShape(payload: unknown): ApiFootballFixtureResponse {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as ApiFootballFixtureResponse).response)
  ) {
    throw new FixturesProviderError('respuesta de API-Football sin array "response"');
  }
  return payload as ApiFootballFixtureResponse;
}

export function parseFixtures(payload: unknown): Fixture[] {
  const body = assertResponseShape(payload);
  return body.response.map((entry) => ({
    id: String(entry.fixture.id),
    sport: 'FOOTBALL',
    league: entry.league.name,
    homeTeam: entry.teams.home.name,
    awayTeam: entry.teams.away.name,
    kickoffAt: new Date(entry.fixture.date),
    status: entry.fixture.status.short,
  }));
}

export class ApiFootballFixturesAdapter implements FixturesProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async upcomingFixtures(limit: number): Promise<Fixture[]> {
    const url = `${this.baseUrl}/fixtures?next=${encodeURIComponent(String(limit))}`;
    const response = await this.fetchImpl(url, {
      headers: { 'x-apisports-key': this.apiKey },
    });
    if (!response.ok) {
      throw new FixturesProviderError(`API-Football respondio HTTP ${response.status}`);
    }
    return parseFixtures(await response.json());
  }
}
