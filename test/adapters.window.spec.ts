import {
  ApiFootballFixturesAdapter,
  FIXTURE_CACHE_TTL_MS,
} from '../src/features/scanning/adapters/apiFootballFixtures';

function fixtureEntry(
  id: number,
  kickoff: string,
  teams: [string, string],
  status = 'NS',
): Record<string, unknown> {
  return {
    fixture: { id, date: kickoff, status: { short: status } },
    league: { id: 39, name: 'Premier League', country: 'England' },
    teams: { home: { name: teams[0] }, away: { name: teams[1] } },
  };
}

describe('upcomingFixtures ventana por dia', () => {
  it('filtra antes del límite, ordena por kickoff y conserva la Premier League', async () => {
    const responses: Record<string, unknown>[] = [
      {
        response: [
          fixtureEntry(1, '2026-09-15T10:00:00Z', ['X', 'Y'], 'FT'),
          fixtureEntry(2, '2026-09-15T17:00:00Z', ['Alpha', 'Beta'], 'NS'),
          fixtureEntry(3, '2026-09-15T18:00:00Z', ['C', 'D'], '1H'),
        ],
      },
      {
        response: Array.from({ length: 25 }, (_, i) =>
          fixtureEntry(100 + i, '2026-09-16T17:00:00Z', [`H${i}`, `A${i}`], 'NS'),
        ),
      },
    ];
    let call = 0;
    const fetchImpl = (): Promise<{ ok: boolean; json: () => Promise<unknown> }> => {
      const response = {
        ok: true,
        json: (): Promise<unknown> => Promise.resolve(responses[call++]),
      };
      return Promise.resolve(response);
    };
    const adapter = new ApiFootballFixturesAdapter(
      'https://x',
      'k',
      fetchImpl as unknown as typeof fetch,
      2,
    );
    const fixtures = await adapter.upcomingFixtures(20);
    expect(fixtures.map((f) => f.id)).toEqual([
      '2',
      ...Array.from({ length: 19 }, (_, i) => String(100 + i)),
    ]);
  });

  it('no pierde la Premier League que aparece después del fixture 20 global', async () => {
    const response = Array.from({ length: 20 }, (_, i) => ({
      ...fixtureEntry(i + 1, `2026-09-15T${String(10 + i).padStart(2, '0')}:00:00Z`, [
        `Other ${i}`,
        `Away ${i}`,
      ]),
      league: { id: 40, name: 'Premier League', country: 'England' },
    }));
    response.push({
      ...fixtureEntry(99, '2026-09-15T23:00:00Z', ['Arsenal', 'Chelsea']),
      league: { id: 39, name: 'Premier League', country: 'England' },
    });
    const adapter = new ApiFootballFixturesAdapter(
      'https://x',
      'k',
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ response }) }),
      1,
    );

    await expect(adapter.upcomingFixtures(20)).resolves.toMatchObject([
      expect.objectContaining({ id: '99', leagueId: 39 }),
    ]);
  });

  it('acepta league.id 39 y rechaza país incorrecto aunque el nombre coincida', async () => {
    const response = [
      fixtureEntry(1, '2026-09-15T12:00:00Z', ['Valid', 'Match']),
      {
        ...fixtureEntry(2, '2026-09-15T13:00:00Z', ['Wrong', 'Country']),
        league: { id: 39, name: 'Premier League', country: 'Spain' },
      },
      {
        ...fixtureEntry(3, '2026-09-15T14:00:00Z', ['Wrong', 'League']),
        league: { id: 40, name: 'Premier League', country: 'England' },
      },
    ];
    const adapter = new ApiFootballFixturesAdapter(
      'https://x',
      'k',
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ response }) }),
      1,
    );
    await expect(adapter.upcomingFixtures(20)).resolves.toMatchObject([
      expect.objectContaining({ id: '1', leagueId: 39, country: 'England' }),
    ]);
  });

  it('universo V1: conserva OBSERVATION_ONLY (Colombia, LaLiga) y descarta ligas fuera del universo', async () => {
    const response = [
      fixtureEntry(1, '2026-09-15T18:00:00Z', ['Arsenal', 'Chelsea']),
      {
        ...fixtureEntry(2, '2026-09-15T19:00:00Z', ['Millonarios', 'Nacional']),
        league: { id: 239, name: 'Primera A', country: 'Colombia' },
      },
      {
        ...fixtureEntry(3, '2026-09-15T20:00:00Z', ['Real Madrid', 'Sevilla FC']),
        league: { id: 140, name: 'La Liga', country: 'Spain' },
      },
      {
        ...fixtureEntry(4, '2026-09-15T21:00:00Z', ['England U21', 'France U21']),
        league: { id: 38, name: 'UEFA U21 Championship', country: 'Europe' },
      },
    ];
    const adapter = new ApiFootballFixturesAdapter(
      'https://x',
      'k',
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ response }) }),
      1,
    );
    const fixtures = await adapter.upcomingFixtures(20);
    expect(fixtures.map((f) => f.id)).toEqual(['1', '2', '3']);
    expect(fixtures.find((f) => f.id === '2')?.leagueId).toBe(239);
  });

  it('usa cache durable mientras el TTL de seis horas siga vigente', async () => {
    let now = new Date('2026-09-15T00:00:00Z');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          response: [fixtureEntry(1, '2026-09-15T12:00:00Z', ['Alpha', 'Beta'])],
        }),
    });
    const adapter = new ApiFootballFixturesAdapter(
      'https://x',
      'k',
      fetchImpl,
      1,
      ':memory:',
      () => now,
    );
    await adapter.upcomingFixtures(20);
    expect(adapter.requestCount()).toBe(1);

    now = new Date(now.getTime() + 30 * 60_000);
    await adapter.upcomingFixtures(20);
    expect(adapter.requestCount()).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(adapter.cacheHit()).toBe(true);
    expect(FIXTURE_CACHE_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('refresca cuando la cache expira', async () => {
    let now = new Date('2026-09-15T00:00:00Z');
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          response: [fixtureEntry(1, '2026-09-15T12:00:00Z', ['Alpha', 'Beta'])],
        }),
    });
    const adapter = new ApiFootballFixturesAdapter(
      'https://x',
      'k',
      fetchImpl,
      1,
      ':memory:',
      () => now,
    );
    await adapter.upcomingFixtures(20);
    now = new Date(now.getTime() + FIXTURE_CACHE_TTL_MS + 1);
    await adapter.upcomingFixtures(20);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
