import { OddsPapiAdapter } from '../src/features/scanning/adapters/oddsPapiOdds';
import type { OddsEvent } from '../src/features/scanning/domain/matching';

function outcomes(pair: { over?: number; under?: number }): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (pair.over !== undefined) {
    result['1010'] = {
      players: {
        '0': {
          active: true,
          bookmakerOutcomeId: '2.5/over',
          price: pair.over,
          changedAt: '2026-09-17T10:00:00.000Z',
        },
      },
    };
  }
  if (pair.under !== undefined) {
    result['1011'] = {
      players: {
        '0': {
          active: true,
          bookmakerOutcomeId: '2.5/under',
          price: pair.under,
          changedAt: '2026-09-17T10:00:00.000Z',
        },
      },
    };
  }
  return result;
}

function payloadFor(
  fixtureId: string,
  bookmaker: string,
  pair: { over?: number; under?: number },
): Record<string, unknown> {
  return {
    fixtureId,
    bookmakerOdds: { [bookmaker]: { markets: { '1010': { outcomes: outcomes(pair) } } } },
  };
}

function event(id: string, tournamentId: number): OddsEvent {
  return {
    id,
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoffAt: new Date('2026-09-18T19:00:00Z'),
    tournamentId,
  };
}

function jsonResponse(body: unknown): { ok: true; json: () => Promise<unknown> } {
  return { ok: true, json: () => Promise.resolve(body) };
}

describe('OddsPapiAdapter.overUnderPairs (Pinnacle preferido, Bet365 fallback)', () => {
  it('usa solo Pinnacle si el par está completo (sin request de fallback)', async () => {
    const fetchImpl = jest.fn((url: string) => {
      const bookmaker = new URL(url).searchParams.get('bookmaker');
      expect(bookmaker).toBe('pinnacle');
      return Promise.resolve(
        jsonResponse([payloadFor('evt1', 'pinnacle', { over: 1.9, under: 1.9 })]),
      );
    });
    const adapter = new OddsPapiAdapter('https://x', 'k', fetchImpl as unknown as typeof fetch);

    const pairs = await adapter.overUnderPairs([event('evt1', 1)]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.bookmaker).toBe('pinnacle');
  });

  it('consulta Bet365 SOLO para el fixture sin par Pinnacle completo, sin mezclar bookmakers', async () => {
    const fetchImpl = jest.fn((url: string) => {
      const bookmaker = new URL(url).searchParams.get('bookmaker');
      if (bookmaker === 'pinnacle') {
        return Promise.resolve(
          jsonResponse([
            payloadFor('evt1', 'pinnacle', { over: 1.9, under: 1.9 }),
            payloadFor('evt2', 'pinnacle', { over: 2.0 }), // falta under: par incompleto
          ]),
        );
      }
      if (bookmaker === 'bet365') {
        return Promise.resolve(
          jsonResponse([payloadFor('evt2', 'bet365', { over: 2.1, under: 1.75 })]),
        );
      }
      throw new Error(`bookmaker inesperado: ${String(bookmaker)}`);
    });
    const adapter = new OddsPapiAdapter('https://x', 'k', fetchImpl as unknown as typeof fetch);

    const pairs = await adapter.overUnderPairs([event('evt1', 1), event('evt2', 2)]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(pairs).toHaveLength(2);
    const byFixture = new Map(pairs.map((pair) => [pair.fixtureId, pair]));
    expect(byFixture.get('evt1')?.bookmaker).toBe('pinnacle');
    expect(byFixture.get('evt2')?.bookmaker).toBe('bet365');
    // Nunca mezclar: el par de evt2 completo viene de un único bookmaker (bet365).
    expect(byFixture.get('evt2')?.over.bookmaker).toBe('bet365');
    expect(byFixture.get('evt2')?.under.bookmaker).toBe('bet365');
  }, 10_000);

  it('si Bet365 falla, el scan continua solo con los pares de Pinnacle', async () => {
    const fetchImpl = jest.fn((url: string) => {
      const bookmaker = new URL(url).searchParams.get('bookmaker');
      if (bookmaker === 'pinnacle') {
        return Promise.resolve(jsonResponse([payloadFor('evt1', 'pinnacle', { over: 2.0 })]));
      }
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    });
    const adapter = new OddsPapiAdapter('https://x', 'k', fetchImpl as unknown as typeof fetch);

    const pairs = await adapter.overUnderPairs([event('evt1', 1)]);

    expect(pairs).toHaveLength(0);
  }, 10_000);
});
