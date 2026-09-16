import { recommendationFromQuantBet } from './quantRecommendation';
import type { PaperBet } from '../../paper-betting/domain/concepts';

const createdAt = new Date('2026-09-20T14:00:00Z');

function paperBet(overrides: Partial<PaperBet> = {}): PaperBet {
  return {
    id: 'paper-bet-idempotente',
    cohortId: 'KSS-V1-C01',
    fixtureId: 9001,
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: new Date('2026-09-20T20:00:00Z'),
    snapshotAt: createdAt,
    market: 'OVER_UNDER_2_5',
    selection: 'OVER_2_5',
    modelVersion: 'poisson-v1',
    modelProbability: 0.6,
    fairMarketProbability: 0.55,
    edge: 0.05,
    expectedValue: 0.23,
    bookmaker: 'pinnacle',
    placedOdds: 2.05,
    minimumAcceptableOdds: 1.8,
    lambdaHome: 1.5,
    lambdaAway: 1.5,
    lambdaTotal: 3,
    stake: 10_000,
    bankrollBefore: 1_000_000,
    status: 'OPEN',
    createdAt,
    ...overrides,
  };
}

describe('recommendationFromQuantBet', () => {
  it('conserva los datos QUANT y usa el id durable de PaperBet como recommendationId', () => {
    const result = recommendationFromQuantBet(paperBet(), createdAt);

    expect(result).toMatchObject({
      recommendationId: 'paper-bet-idempotente',
      fixtureId: '9001',
      market: 'OVER_UNDER_2_5',
      observedOdds: 2.05,
      suggestedStakeCop: 10_000,
      executionMode: 'MANUAL',
      status: 'BET',
    });
  });
});
