import type { HistoricalMatch } from './concepts';
import { LEAGUE_MIN_MATCHES } from './leagueBaselines';
import { computePoissonV1 } from './model';

const SNAPSHOT_AT = new Date('2026-09-15T00:00:00.000Z');

/** Genera partidos de relleno entre dos equipos neutrales para llenar el mínimo de liga. */
function fillerMatches(count: number, homeGoals: number, awayGoals: number): HistoricalMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.UTC(2025, 0, 1 + i)),
    homeTeam: 'FillerHome',
    awayTeam: 'FillerAway',
    homeGoals,
    awayGoals,
    result: homeGoals === awayGoals ? 'D' : homeGoals > awayGoals ? 'H' : 'A',
  }));
}

function homeMatchesFor(
  team: string,
  count: number,
  homeGoals: number,
  awayGoals: number,
): HistoricalMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.UTC(2025, 6, 1 + i)),
    homeTeam: team,
    awayTeam: 'SomeOpponent',
    homeGoals,
    awayGoals,
    result: 'H',
  }));
}

function awayMatchesFor(
  team: string,
  count: number,
  homeGoals: number,
  awayGoals: number,
): HistoricalMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.UTC(2025, 6, 1 + i)),
    homeTeam: 'SomeOpponent',
    awayTeam: team,
    homeGoals,
    awayGoals,
    result: 'H',
  }));
}

describe('computePoissonV1', () => {
  it('LEAGUE_NOT_ENABLED si la liga no llega a 200 partidos en la ventana', () => {
    const result = computePoissonV1({
      fixtureId: 'f1',
      league: 'Premier League',
      home: 'Arsenal',
      away: 'Chelsea',
      snapshotAt: SNAPSHOT_AT,
      historicalMatches: fillerMatches(LEAGUE_MIN_MATCHES - 1, 1, 1),
    });
    expect(result.status).toBe('LEAGUE_NOT_ENABLED');
  });

  it('n=0 (equipo ascendido sin historial): usa la media de liga directamente (shrinkage total)', () => {
    const historicalMatches = fillerMatches(LEAGUE_MIN_MATCHES, 1, 1); // liga: home=1, away=1
    const result = computePoissonV1({
      fixtureId: 'f2',
      league: 'Premier League',
      home: 'Coventry',
      away: 'Hull City',
      snapshotAt: SNAPSHOT_AT,
      historicalMatches,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.output.homeRoleMatches).toBe(0);
    expect(result.output.awayRoleMatches).toBe(0);
    expect(result.output.dataQuality).toEqual(
      expect.arrayContaining(['HOME_NO_ROLE_HISTORY', 'AWAY_NO_ROLE_HISTORY']),
    );
    // ambos equipos en la media de liga -> lambdas = medias de liga
    expect(result.output.lambdaHome).toBeCloseTo(1);
    expect(result.output.lambdaAway).toBeCloseTo(1);
  });

  it('0 < n < 8: shrinkage fuerte hacia la liga, flag de historial insuficiente', () => {
    const historicalMatches = [
      ...fillerMatches(LEAGUE_MIN_MATCHES, 1.5, 1.2),
      ...homeMatchesFor('Ipswich', 3, 3, 0), // solo 3 partidos de local, ataque muy alto
    ];
    const result = computePoissonV1({
      fixtureId: 'f3',
      league: 'Premier League',
      home: 'Ipswich',
      away: 'Chelsea',
      snapshotAt: SNAPSHOT_AT,
      historicalMatches,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.output.homeRoleMatches).toBe(3);
    expect(result.output.dataQuality).toContain('HOME_INSUFFICIENT_ROLE_HISTORY');
  });

  it('n >= 8: usa historial + shrinkage moderado, sin flags de insuficiencia', () => {
    const historicalMatches = [
      ...fillerMatches(LEAGUE_MIN_MATCHES, 1.5, 1.2),
      ...homeMatchesFor('Arsenal', 20, 2, 1),
      ...awayMatchesFor('Chelsea', 20, 1, 1),
    ];
    const result = computePoissonV1({
      fixtureId: 'f4',
      league: 'Premier League',
      home: 'Arsenal',
      away: 'Chelsea',
      snapshotAt: SNAPSHOT_AT,
      historicalMatches,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.output.homeRoleMatches).toBe(20);
    expect(result.output.awayRoleMatches).toBe(20);
    expect(result.output.dataQuality).toHaveLength(0);
    expect(Math.abs(result.output.pOver + result.output.pUnder - 1)).toBeLessThan(1e-9);
    for (const value of [
      result.output.lambdaHome,
      result.output.lambdaAway,
      result.output.lambdaTotal,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('excluye partidos futuros/en el snapshot del cálculo (regla causal)', () => {
    const historicalMatches = [
      ...fillerMatches(LEAGUE_MIN_MATCHES, 1.5, 1.2),
      {
        date: SNAPSHOT_AT, // exactamente en el snapshot: debe excluirse
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        homeGoals: 9,
        awayGoals: 9,
        result: 'D' as const,
      },
    ];
    const result = computePoissonV1({
      fixtureId: 'f5',
      league: 'Premier League',
      home: 'Arsenal',
      away: 'Chelsea',
      snapshotAt: SNAPSHOT_AT,
      historicalMatches,
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.output.homeRoleMatches).toBe(0);
  });
});
