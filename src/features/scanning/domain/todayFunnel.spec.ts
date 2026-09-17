import { classifyTodayFixtures } from './todayFunnel';
import type { Fixture } from './concepts';

const fixture = (id: string, kickoffAt: string, leagueId = 39): Fixture => ({
  id,
  sport: 'FOOTBALL',
  league: leagueId === 39 ? 'Premier League' : 'Liga BetPlay',
  leagueId,
  country: leagueId === 39 ? 'England' : 'Colombia',
  homeTeam: 'Home',
  awayTeam: 'Away',
  kickoffAt: new Date(kickoffAt),
  status: 'NS',
});

describe('today funnel', () => {
  it('cuenta un partido iniciado y conserva una razón explícita', () => {
    const result = classifyTodayFixtures(
      [fixture('started', '2026-09-17T18:00:00Z')],
      new Date('2026-09-17T19:00:00Z'),
    );
    expect(result.raw).toBe(1);
    expect(result.modelable).toBe(0);
    expect(result.started).toBe(1);
    expect(result.rejectionBreakdown.MATCH_STARTED).toBe(1);
    expect(result.rejected).toBe(result.raw);
  });

  it('clasifica la frontera local de Bogotá, no la fecha UTC', () => {
    const result = classifyTodayFixtures(
      [fixture('local-today', '2026-09-18T02:00:00Z')],
      new Date('2026-09-18T04:00:00Z'),
    );
    expect(result.raw).toBe(1);
    expect(result.rejectionBreakdown.MATCH_STARTED).toBe(1);
  });

  it('no permite que una observación cuente como modelable', () => {
    const result = classifyTodayFixtures(
      [fixture('observation', '2026-09-17T20:00:00Z', 239)],
      new Date('2026-09-17T15:00:00Z'),
    );
    expect(result.modelable).toBe(0);
    expect(result.rejectionBreakdown.OBSERVATION_ONLY).toBe(1);
  });
});
