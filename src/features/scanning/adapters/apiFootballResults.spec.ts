import { parseFixtureResult } from './apiFootballResults';

describe('parseFixtureResult', () => {
  it('usa únicamente el marcador fulltime y no extra time/penales', () => {
    const result = parseFixtureResult(
      {
        response: [
          {
            fixture: { id: 39, status: { short: 'FT' } },
            goals: { home: 2, away: 2 },
            score: { fulltime: { home: 1, away: 0 } },
          },
        ],
      },
      '39',
    );
    expect(result).toEqual({
      fixtureId: '39',
      status: 'FT',
      fulltimeHome: 1,
      fulltimeAway: 0,
      finishedAt: null,
    });
  });

  it('devuelve null si el proveedor no contiene el fixture consultado', () => {
    expect(parseFixtureResult({ response: [] }, '99')).toBeNull();
  });

  it('acepta finishedAt solo cuando API-Football lo entrega', () => {
    const result = parseFixtureResult(
      {
        response: [
          {
            fixture: {
              id: 39,
              status: { short: 'FT' },
              finishedAt: '2026-09-20T21:00:00Z',
            },
            goals: { home: 0, away: 0 },
          },
        ],
      },
      '39',
    );
    expect(result?.finishedAt?.toISOString()).toBe('2026-09-20T21:00:00.000Z');
  });
});
