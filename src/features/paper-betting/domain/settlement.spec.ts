import type { PaperBet } from './concepts';
import { resolveSettlement } from './settlement';

function bet(selection: string): PaperBet {
  return {
    id: selection,
    cohortId: 'KSS-V1-C01',
    fixtureId: 1,
    league: 'Premier League',
    homeTeam: 'Home',
    awayTeam: 'Away',
    kickoff: new Date('2026-09-20T19:00:00Z'),
    snapshotAt: new Date('2026-09-20T13:00:00Z'),
    market: 'OVER_UNDER_2_5',
    selection,
    modelVersion: 'poisson-v1',
    modelProbability: 0.5,
    fairMarketProbability: 0.5,
    edge: 0,
    expectedValue: 0,
    bookmaker: 'pinnacle',
    placedOdds: 2,
    minimumAcceptableOdds: 1.7,
    lambdaHome: 1,
    lambdaAway: 1,
    lambdaTotal: 2,
    stake: 10,
    bankrollBefore: 1000,
    status: 'OPEN',
    createdAt: new Date('2026-09-20T13:00:00Z'),
  };
}

describe('resolveSettlement', () => {
  it.each([
    ['OVER_2_5', 2, 1, 'WON'],
    ['OVER_2_5', 1, 1, 'LOST'],
    ['UNDER_2_5', 1, 1, 'WON'],
    ['UNDER_2_5', 2, 1, 'LOST'],
  ])('%s %s-%s => %s', (selection, home, away, outcome) => {
    expect(
      resolveSettlement(bet(selection), {
        fixtureId: '1',
        status: 'FT',
        fulltimeHome: home,
        fulltimeAway: away,
        finishedAt: null,
      })?.outcome,
    ).toBe(outcome);
  });

  it.each(['CANC', 'ABD'])('%s => VOID', (status) => {
    expect(
      resolveSettlement(bet('OVER_2_5'), {
        fixtureId: '1',
        status,
        fulltimeHome: null,
        fulltimeAway: null,
        finishedAt: null,
      }),
    ).toEqual({ outcome: 'VOID', result: status });
  });

  it.each(['PST', 'SUSP', 'NS', 'LIVE'])('%s queda abierto', (status) => {
    expect(
      resolveSettlement(bet('OVER_2_5'), {
        fixtureId: '1',
        status,
        fulltimeHome: null,
        fulltimeAway: null,
        finishedAt: null,
      }),
    ).toBeNull();
  });

  it('FT sin marcador autoritativo queda abierto', () => {
    expect(
      resolveSettlement(bet('OVER_2_5'), {
        fixtureId: '1',
        status: 'FT',
        fulltimeHome: null,
        fulltimeAway: 1,
        finishedAt: null,
      }),
    ).toBeNull();
  });
});
