import {
  calculatePnl,
  assertPlacedBeforeKickoff,
  PreKickoffViolationError,
  type PaperBet,
} from './concepts';

describe('paper-betting domain', () => {
  const kickoff = new Date('2026-09-20T22:00:00Z');
  const snapshotAt = new Date('2026-09-20T16:00:00Z');

  it('calculatePnl correcto: WON = stake*(odds-1), LOST = -stake, VOID = 0', () => {
    expect(calculatePnl('WON', 10, 2.5)).toBeCloseTo(15);
    expect(calculatePnl('LOST', 10, 2.5)).toBeCloseTo(-10);
    expect(calculatePnl('VOID', 10, 2.5)).toBeCloseTo(0);
  });

  it('apuesta ANTES del kickoff aceptada', () => {
    expect(() =>
      assertPlacedBeforeKickoff(kickoff, new Date('2026-09-20T21:59:59Z')),
    ).not.toThrow();
  });

  it('apuesta EN o DESPUES del kickoff rechazada', () => {
    expect(() => assertPlacedBeforeKickoff(kickoff, kickoff)).toThrow(PreKickoffViolationError);
    expect(() => assertPlacedBeforeKickoff(kickoff, new Date('2026-09-20T22:00:01Z'))).toThrow(
      PreKickoffViolationError,
    );
  });

  it('PaperBet soporta el snapshot completo pre-kickoff', () => {
    const bet: PaperBet = {
      id: 'b1',
      cohortId: 'KSS-V1-C01',
      fixtureId: 1,
      league: 'Liga Nacional',
      homeTeam: 'Comunicaciones',
      awayTeam: 'Antigua GFC',
      kickoff,
      snapshotAt,
      market: 'MATCH_WINNER',
      selection: 'HOME',
      modelVersion: 'poisson-v1',
      modelProbability: 0.6,
      fairMarketProbability: 0.48,
      edge: 0.12,
      expectedValue: 0.07,
      bookmaker: 'local-book',
      placedOdds: 2.1,
      minimumAcceptableOdds: 1.9,
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      lambdaTotal: 2.5,
      stake: 10,
      bankrollBefore: 1000,
      status: 'OPEN',
      createdAt: new Date('2026-09-20T21:00:00Z'),
      settledAt: undefined,
      closingOdds: undefined,
      result: undefined,
      pnl: undefined,
    };
    expect(bet.status).toBe('OPEN');
    expect(bet.pnl).toBeUndefined();
  });
});
