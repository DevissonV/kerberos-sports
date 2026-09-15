import { devigTwoWay } from '../src/features/opportunities/domain/marketMath';
import { parseManualQuotes } from '../src/features/scanning/application/manualQuotes';

describe('de-vig two-way', () => {
  it('normaliza el par y suma 1', () => {
    const fair = devigTwoWay(1.95, 1.87);
    const rawOver = 1 / 1.95;
    const rawUnder = 1 / 1.87;
    expect(fair.pOverFair).toBeCloseTo(rawOver / (rawOver + rawUnder), 12);
    expect(fair.pOverFair + fair.pUnderFair).toBeCloseTo(1, 12);
    expect(fair.fairOverOdds).toBeCloseTo(1 / fair.pOverFair, 12);
  });

  it('par sin vig devuelve probabilidades simetricas', () => {
    const fair = devigTwoWay(2, 2);
    expect(fair.pOverFair).toBeCloseTo(0.5, 12);
    expect(fair.pUnderFair).toBeCloseTo(0.5, 12);
  });

  it('rechaza cuotas invalidas', () => {
    expect(() => devigTwoWay(1, 2)).toThrow();
    expect(() => devigTwoWay(2, Number.NaN)).toThrow();
  });
});

describe('manual quotes (BetPlay / RushBet fallback)', () => {
  it('parsea un array JSON valido a BookmakerQuote', () => {
    const quotes = parseManualQuotes(
      JSON.stringify([
        {
          fixtureId: '1001',
          bookmaker: 'BetPlay',
          selection: 'OVER_2_5',
          decimalOdds: 1.72,
          capturedAt: '2026-09-17T12:00:00Z',
        },
      ]),
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      bookmaker: 'BetPlay',
      selection: 'OVER_2_5',
      decimalOdds: 1.72,
    });
    expect(quotes[0]?.capturedAt.toISOString()).toBe('2026-09-17T12:00:00.000Z');
  });

  it('rechaza entradas invalidas con error explicito', () => {
    expect(() => parseManualQuotes('{"no": "array"}')).toThrow(/array/);
    expect(() =>
      parseManualQuotes(
        JSON.stringify([
          {
            fixtureId: '1',
            bookmaker: 'BetPlay',
            selection: 'OVER_3_5',
            decimalOdds: 2,
            capturedAt: '2026-09-17T12:00:00Z',
          },
        ]),
      ),
    ).toThrow(/selection/);
    expect(() =>
      parseManualQuotes(
        JSON.stringify([
          {
            fixtureId: '1',
            bookmaker: 'BetPlay',
            selection: 'OVER_2_5',
            decimalOdds: 1,
            capturedAt: '2026-09-17T12:00:00Z',
          },
        ]),
      ),
    ).toThrow(/decimalOdds/);
    expect(() =>
      parseManualQuotes(
        JSON.stringify([
          { fixtureId: '1', bookmaker: 'BetPlay', selection: 'OVER_2_5', decimalOdds: 2 },
        ]),
      ),
    ).toThrow(/capturedAt/);
  });
});
