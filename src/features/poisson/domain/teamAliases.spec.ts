import { resolveCanonicalTeamName, TEAM_ALIASES } from './teamAliases';

describe('resolveCanonicalTeamName', () => {
  it('resuelve equipos sin alias (identico en football-data.co.uk y canonical)', () => {
    expect(resolveCanonicalTeamName('Aston Villa')).toBe('Aston Villa');
    expect(resolveCanonicalTeamName('Crystal Palace')).toBe('Crystal Palace');
  });

  it('resuelve los aliases explicitos documentados en KSS-HISTORY-GATE-01B', () => {
    expect(resolveCanonicalTeamName('Hull')).toBe('Hull City');
    expect(resolveCanonicalTeamName('Man City')).toBe('Manchester City');
    expect(resolveCanonicalTeamName('Man United')).toBe('Manchester United');
    expect(resolveCanonicalTeamName("Nott'm Forest")).toBe('Nottingham Forest');
  });

  it('resuelve los equipos descendidos antes de 2026/27 presentes en el histórico', () => {
    expect(resolveCanonicalTeamName('Leicester')).toBe('Leicester City');
    expect(resolveCanonicalTeamName('West Ham')).toBe('West Ham United');
    expect(resolveCanonicalTeamName('Wolves')).toBe('Wolverhampton Wanderers');
    expect(resolveCanonicalTeamName('Burnley')).toBe('Burnley');
    expect(resolveCanonicalTeamName('Southampton')).toBe('Southampton');
  });

  it('no hace fuzzy matching: nombre no exacto no resuelve', () => {
    expect(resolveCanonicalTeamName('Man Utd')).toBeUndefined();
    expect(resolveCanonicalTeamName('arsenal')).toBeUndefined();
    expect(resolveCanonicalTeamName('Unknown FC')).toBeUndefined();
  });

  it('tiene 25 equipos únicos (temporadas 2024/25, 2025/26, 2026/27)', () => {
    expect(TEAM_ALIASES).toHaveLength(25);
    const ids = new Set(TEAM_ALIASES.map((entry) => entry.canonicalTeamId));
    expect(ids.size).toBe(25);
  });
});
