import { historicalMatchesForLeague } from './historicalLeagueRegistry';
import { LEAGUE_MIN_MATCHES, computeLeagueBaselines } from '../domain/leagueBaselines';
import { filterHistoricalWindow } from '../domain/historicalWindow';

const now = new Date('2026-09-18T12:00:00Z');

describe('historicalLeagueRegistry: aislamiento de baseline por liga', () => {
  it('sirve el dataset propio de cada liga MODEL_ENABLED sin cruzar datasets', () => {
    const bundesliga = historicalMatchesForLeague(78, 'Germany');
    const laliga = historicalMatchesForLeague(140, 'Spain');
    expect(bundesliga.length).toBeGreaterThan(LEAGUE_MIN_MATCHES);
    expect(laliga.length).toBeGreaterThan(LEAGUE_MIN_MATCHES);
    // Ningún equipo canónico de una liga pertenece al histórico de otra (datasets de
    // fechas comparten fechas: la identidad relevante es el equipo).
    const laligaTeams = new Set(laliga.flatMap((match) => [match.homeTeam, match.awayTeam]));
    const bundesligaAliasTeams = bundesliga.flatMap((match) => [match.homeTeam, match.awayTeam]);
    const cruzes = bundesligaAliasTeams.filter((name) => laligaTeams.has(name)).length;
    expect(cruzes).toBe(0);
    expect(bundesliga.some((match) => match.homeTeam === 'FC Augsburg')).toBe(true);
  });

  it('devuelve vacío una liga en observación y fail-closed una liga fuera del universo', () => {
    expect(historicalMatchesForLeague(239, 'Colombia')).toEqual([]); // Liga BetPlay
    expect(historicalMatchesForLeague(3, 'World')).toEqual([]); // Europa League
    expect(historicalMatchesForLeague(999, 'Unknown')).toEqual([]);
  });

  it('calcula baseline SOLO con el histórico de la liga consultada', () => {
    const bundesliga = computeLeagueBaselines(
      filterHistoricalWindow(historicalMatchesForLeague(78, 'Germany'), now),
    );
    expect(bundesliga).not.toBe('LEAGUE_NOT_ENABLED');
    if (bundesliga !== 'LEAGUE_NOT_ENABLED') {
      expect(bundesliga.leagueMatches).toBeGreaterThan(LEAGUE_MIN_MATCHES);
      expect(bundesliga.leagueHomeGoalsMean).toBeGreaterThan(0);
      expect(bundesliga.leagueAwayGoalsMean).toBeGreaterThan(0);
    }
  });
});
