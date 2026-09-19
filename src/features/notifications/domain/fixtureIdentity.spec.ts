import { competitionLabel, formatFixtureIdentity } from './fixtureIdentity';

describe('formatFixtureIdentity', () => {
  it('produce la cabecera universal: equipos, torneo, fecha y hora Bogotá', () => {
    const identity = formatFixtureIdentity({
      homeTeam: 'Groningen',
      awayTeam: 'PEC Zwolle',
      league: 'Eredivisie',
      leagueId: 88,
      country: 'Netherlands',
      kickoffAt: new Date('2026-09-18T18:00:00Z'),
    });
    expect(identity).toEqual([
      '⚽ Groningen vs PEC Zwolle',
      '🏆 Eredivisie',
      '📅 18 Sep 2026 · 🕐 1:00 p. m.',
    ]);
  });

  it('resuelve por leagueId+country del universo y cae al nombre crudo si no está', () => {
    expect(competitionLabel('Premier League', 39, 'England')).toBe('Premier League');
    expect(competitionLabel('Eredivisie', 88, 'Netherlands')).toBe('Eredivisie');
    expect(competitionLabel('Liga Desconocida', 9999, 'Nowhere')).toBe('Liga Desconocida');
  });

  it('sin kickoff omite la línea de fecha/hora (nunca inventa datos)', () => {
    const identity = formatFixtureIdentity({
      homeTeam: 'A',
      awayTeam: 'B',
      league: 'Serie A',
      leagueId: 135,
      country: 'Italy',
    });
    expect(identity).toEqual(['⚽ A vs B', '🏆 Serie A']);
  });

  it('nunca muestra IDs técnicos de liga', () => {
    const lines = formatFixtureIdentity({
      homeTeam: 'A',
      awayTeam: 'B',
      league: 'Bundesliga',
      leagueId: 78,
      country: 'Germany',
    }).join('\n');
    expect(lines).not.toContain('78');
  });
});
