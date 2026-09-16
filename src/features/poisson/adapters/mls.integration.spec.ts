import { loadHistoricalMatchesForDataset } from './localCsvHistoricalMatches';
import { resolveCanonicalTeamNameForDataset } from '../domain/teamAliases';
import { findLeagueDefinition, isModelEnabled } from '../../scanning/domain/leagueUniverse';

describe('MLS MODEL_ENABLED integration', () => {
  it('MLS existe en el universo de ligas con status MODEL_ENABLED', () => {
    const mls = findLeagueDefinition({ leagueId: 253, country: 'USA' });
    expect(mls).toBeDefined();
    expect(mls?.status).toBe('MODEL_ENABLED');
    expect(mls?.cohortId).toBe('KSS-V1-C10-USA');
    expect(mls?.historicalDataset).toBe('mls');
  });

  it('se cargan >=200 partidos históricos de MLS', () => {
    const matches = loadHistoricalMatchesForDataset('mls');
    expect(matches.length).toBeGreaterThanOrEqual(200);
  });

  it('todos los equipos de MLS resuelven aliases deterministas', () => {
    const teams = [
      'Atlanta United',
      'Chicago Fire',
      'New York City FC',
      'Seattle Sounders',
      'San Diego FC',
    ];
    for (const team of teams) {
      const resolved = resolveCanonicalTeamNameForDataset('mls', team);
      expect(resolved).toBe(team);
    }
  });

  it('fixture MLS pasa isModelEnabled si cumple protocolo básico', () => {
    const fixture = {
      leagueId: 253,
      country: 'USA',
      league: 'Major League Soccer',
      homeTeam: 'Seattle Sounders',
      awayTeam: 'LA Galaxy',
    };
    expect(isModelEnabled(fixture)).toBe(true);
  });
});
