import { DEFAULT_SPORT } from '../src/shared/config/scope';
import { CANDIDATE_MARKET_KIND, SPORT } from '../src/features/opportunities/domain/scope';
import type { Fixture, Market, OddsQuote } from '../src/features/opportunities/domain/concepts';
import type { PaperBet } from '../src/features/paper-betting/domain/concepts';

describe('domain scope', () => {
  it('solo FOOTBALL en MVP', () => {
    expect(DEFAULT_SPORT).toBe('FOOTBALL');
    expect(SPORT).toBe('FOOTBALL');
    expect(CANDIDATE_MARKET_KIND).toBe('MATCH_WINNER');
  });

  it('entidades conceptuales se construyen', () => {
    const fixture: Fixture = {
      id: 'f1',
      sport: 'FOOTBALL',
      homeTeam: 'Comunicaciones',
      awayTeam: 'Antigua GFC',
      kickoffAt: new Date('2026-09-20T22:00:00Z'),
    };
    const market: Market = { id: 'm1', fixtureId: fixture.id, kind: CANDIDATE_MARKET_KIND };
    const quote: OddsQuote = {
      id: 'q1',
      marketId: market.id,
      bookmaker: 'local-book',
      capturedAt: new Date(),
      odds: { HOME: 1.95, DRAW: 3.4, AWAY: 3.9 },
    };
    const bet: PaperBet = {
      id: 'p1',
      marketId: market.id,
      predictionId: 'pred-1',
      createdAt: new Date(),
      stake: 10,
      selection: 'HOME',
      odds: quote.odds.HOME ?? 0,
      status: 'OPEN',
    };

    expect(fixture.sport).toBe('FOOTBALL');
    expect(quote.odds.HOME).toBeGreaterThan(1);
    expect(bet.status).toBe('OPEN');
  });
});
