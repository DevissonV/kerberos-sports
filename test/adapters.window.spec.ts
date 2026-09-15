import { ApiFootballFixturesAdapter } from '../src/features/scanning/adapters/apiFootballFixtures';

function fixtureEntry(
  id: number,
  kickoff: string,
  teams: [string, string],
  status = 'NS',
): Record<string, unknown> {
  return {
    fixture: { id, date: kickoff, status: { short: status } },
    league: { name: 'Liga' },
    teams: { home: { name: teams[0] }, away: { name: teams[1] } },
  };
}

describe('upcomingFixtures ventana por dia', () => {
  it('solo devuelve fixtures "Not Started" y corta hasta `limit` por dia', async () => {
    const responses: Record<string, unknown>[] = [
      {
        response: [
          fixtureEntry(1, '2026-09-15T10:00:00Z', ['X', 'Y'], 'FT'),
          fixtureEntry(2, '2026-09-15T17:00:00Z', ['A', 'B'], 'NS'),
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
      ...Array.from({ length: 20 }, (_, i) => String(100 + i)),
    ]);
  });
});
