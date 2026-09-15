import type { HistoricalMatch } from './concepts';
import { computeLeagueBaselines, LEAGUE_MIN_MATCHES } from './leagueBaselines';

const match = (homeGoals: number, awayGoals: number): HistoricalMatch => ({
  date: new Date('2025-01-01T00:00:00.000Z'),
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  homeGoals,
  awayGoals,
  result: homeGoals === awayGoals ? 'D' : homeGoals > awayGoals ? 'H' : 'A',
});

describe('computeLeagueBaselines', () => {
  it('LEAGUE_NOT_ENABLED si hay menos de 200 partidos en la ventana', () => {
    const matches = Array.from({ length: LEAGUE_MIN_MATCHES - 1 }, () => match(1, 1));
    expect(computeLeagueBaselines(matches)).toBe('LEAGUE_NOT_ENABLED');
  });

  it('calcula medias con exactamente 200 partidos (mínimo aceptado)', () => {
    const matches = Array.from({ length: LEAGUE_MIN_MATCHES }, () => match(2, 1));
    const result = computeLeagueBaselines(matches);
    expect(result).not.toBe('LEAGUE_NOT_ENABLED');
    if (result === 'LEAGUE_NOT_ENABLED') return;
    expect(result.leagueMatches).toBe(LEAGUE_MIN_MATCHES);
    expect(result.leagueHomeGoalsMean).toBeCloseTo(2);
    expect(result.leagueAwayGoalsMean).toBeCloseTo(1);
  });
});
