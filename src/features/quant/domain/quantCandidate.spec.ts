import type { OddsPair } from '../../scanning/domain/concepts';
import type { PoissonModelOutput } from '../../poisson/domain/concepts';
import { evaluateQuantPair } from './quantCandidate';

function makeModel(pOver: number): PoissonModelOutput {
  return {
    modelVersion: 'poisson-v1',
    snapshotAt: new Date('2026-09-20T16:00:00Z'),
    fixtureId: '9001',
    league: 'Premier League',
    home: 'Arsenal',
    away: 'Chelsea',
    leagueHomeGoalsMean: 1.6,
    leagueAwayGoalsMean: 1.3,
    homeRoleMatches: 12,
    awayRoleMatches: 12,
    lambdaHome: 1.5,
    lambdaAway: 1.1,
    lambdaTotal: 2.6,
    pOver,
    pUnder: 1 - pOver,
    dataQuality: [],
  };
}

function makePair(
  overOdds: number,
  underOdds: number,
  bookmaker = 'pinnacle',
  over: number = overOdds,
  under: number = underOdds,
): OddsPair {
  const capturedAt = new Date('2026-09-20T16:00:00Z');
  return {
    fixtureId: '9001',
    bookmaker,
    line: 2.5,
    over: {
      bookmaker,
      selection: 'OVER_2_5',
      decimalOdds: over,
      marketId: '1010',
      observedAt: capturedAt,
      capturedAt,
    },
    under: {
      bookmaker,
      selection: 'UNDER_2_5',
      decimalOdds: under,
      marketId: '1010',
      observedAt: capturedAt,
      capturedAt,
    },
  };
}

describe('evaluateQuantPair', () => {
  it('evalua el lado OVER con edge y EV positivos y lo selecciona', () => {
    // Fair over ~ 0.55 -> modelo 0.62: edge ~ +7pp, EV positivo a 1.75.
    const result = evaluateQuantPair(makeModel(0.62), makePair(1.75, 2.18));
    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED') {
      expect(result.side.selection).toBe('OVER_2_5');
      expect(result.side.edge).toBeCloseTo(0.0653, 4);
      expect(result.side.expectedValue).toBeCloseTo(0.62 * 1.75 - 1, 4);
      expect(result.side.minimumAcceptableOdds).toBeCloseTo(1.03 / 0.62, 4);
      expect(result.side.offeredOdds).toBe(1.75);
      expect(result.side.bookmaker).toBe('pinnacle');
    }
  });

  it('evalua el lado UNDER cuando el modelo favorece el under', () => {
    const result = evaluateQuantPair(makeModel(0.25), makePair(2.15, 1.74));
    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED') {
      expect(result.side.selection).toBe('UNDER_2_5');
    }
  });

  it('de-vig: fairProbability del lado seleccionado es consistente con el par', () => {
    const result = evaluateQuantPair(makeModel(0.62), makePair(1.8, 2.05));
    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED') {
      const pair = makePair(1.8, 2.05);
      const rawOver = 1 / pair.over.decimalOdds;
      const rawUnder = 1 / pair.under.decimalOdds;
      const fairOver = rawOver / (rawOver + rawUnder);
      // El modelo favorece el over: edgeUnder = -edgeOver < 0, se selecciona OVER.
      expect(result.side.selection).toBe('OVER_2_5');
      expect(result.side.fairMarketProbability).toBeCloseTo(fairOver, 6);
    }
  });

  it('gate MIN_EDGE: edge por debajo del umbral rechaza (EDGE)', () => {
    // edge exactamente 0.0395 < 0.04
    const result = evaluateQuantPair(makeModel(0.556), makePair(1.75, 2.18));
    expect(result).toMatchObject({ status: 'REJECTED', reason: 'EDGE' });
  });

  it('gate MIN_EV: edge suficiente pero EV insuficiente rechaza (EV)', () => {
    // fairOver ~ 0.6667: edge +3.3pp > minEdge 0.01, pero EV = 0.7*1.4-1 = -0.02 < 0.03.
    const result = evaluateQuantPair(makeModel(0.7), makePair(1.4, 2.8), {
      minEdge: 0.01,
      minEv: 0.03,
      minOdds: 1.2,
      maxOdds: 2.9,
    });
    expect(result).toMatchObject({ status: 'REJECTED', reason: 'EV' });
  });

  it('gate ODDS_RANGE: cuota fuera de [1.70, 2.20] rechaza', () => {
    const below = evaluateQuantPair(makeModel(0.62), makePair(1.65, 2.3), {
      minEdge: 0.01,
      minEv: 0.01,
      minOdds: 1.7,
      maxOdds: 2.2,
    });
    expect(below).toMatchObject({ status: 'REJECTED', reason: 'ODDS_RANGE' });
    const above = evaluateQuantPair(makeModel(0.47), makePair(2.3, 1.66), {
      minEdge: 0.01,
      minEv: 0.01,
      minOdds: 1.5,
      maxOdds: 2.2,
    });
    expect(above).toMatchObject({ status: 'REJECTED', reason: 'ODDS_RANGE' });
  });

  it('fail-closed: bookmaker distinto de primary/fallback rechaza (NO_BOOKMAKER)', () => {
    const result = evaluateQuantPair(makeModel(0.62), makePair(1.75, 2.18, '1xbet'));
    expect(result).toEqual({ status: 'REJECTED', reason: 'NO_BOOKMAKER' });
  });

  it('fail-closed: probabilidades del modelo no finitas lanzan error, nunca apostados', () => {
    expect(() => evaluateQuantPair(makeModel(Number.NaN), makePair(1.75, 2.18))).toThrow();
  });

  it('ambos lados evaluados: se devuelve el de mejor edge (under con edge positivo)', () => {
    // edgeOver = 0.2 - 0.5128 < 0; edgeUnder = 0.8 - 0.4872 > 0 -> se selecciona UNDER.
    const result = evaluateQuantPair(makeModel(0.2), makePair(1.9, 2.0));
    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED') {
      expect(result.side.selection).toBe('UNDER_2_5');
      expect(result.side.edge).toBeCloseTo(0.3128, 4);
    }
  });
});
