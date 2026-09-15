import type { HistoricalMatch } from './concepts';
import {
  aggregateAwayRoleStats,
  aggregateHomeRoleStats,
  awayRoleHistory,
  homeRoleHistory,
  ROLE_WINDOW_MATCHES,
} from './roleHistory';

const homeMatch = (dayOffset: number, homeGoals: number, awayGoals: number): HistoricalMatch => ({
  date: new Date(Date.UTC(2025, 0, 1 + dayOffset)),
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  homeGoals,
  awayGoals,
  result: 'H',
});

const awayMatch = (dayOffset: number, homeGoals: number, awayGoals: number): HistoricalMatch => ({
  date: new Date(Date.UTC(2025, 0, 1 + dayOffset)),
  homeTeam: 'Chelsea',
  awayTeam: 'Arsenal',
  homeGoals,
  awayGoals,
  result: 'H',
});

describe('roleHistory', () => {
  it('separa partidos de local y visitante sin mezclar roles', () => {
    const matches = [homeMatch(1, 2, 0), awayMatch(2, 1, 1)];
    expect(homeRoleHistory(matches, 'Arsenal')).toHaveLength(1);
    expect(awayRoleHistory(matches, 'Arsenal')).toHaveLength(1);
  });

  it('limita a los últimos 30 partidos por rol, más recientes primero', () => {
    const matches = Array.from({ length: 40 }, (_, i) => homeMatch(i, 1, 0));
    const result = homeRoleHistory(matches, 'Arsenal');
    expect(result).toHaveLength(ROLE_WINDOW_MATCHES);
    expect(result[0]?.date).toEqual(new Date(Date.UTC(2025, 0, 40)));
  });

  it('aggregateHomeRoleStats suma GF/GA sobre partidos de local', () => {
    const matches = [homeMatch(1, 2, 1), homeMatch(2, 3, 0)];
    expect(aggregateHomeRoleStats(matches)).toEqual({
      matches: 2,
      goalsForSum: 5,
      goalsAgainstSum: 1,
    });
  });

  it('aggregateAwayRoleStats suma GF/GA sobre partidos de visitante', () => {
    const matches = [awayMatch(1, 1, 2), awayMatch(2, 0, 3)];
    expect(aggregateAwayRoleStats(matches)).toEqual({
      matches: 2,
      goalsForSum: 5,
      goalsAgainstSum: 1,
    });
  });

  it('n=0 cuando el equipo no tiene partidos en la ventana', () => {
    expect(aggregateHomeRoleStats([])).toEqual({ matches: 0, goalsForSum: 0, goalsAgainstSum: 0 });
  });
});
