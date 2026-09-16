import {
  LEAGUE_UNIVERSE,
  isModelEnabled,
  isObservable,
  resolveLeagueStatus,
  summarizeFixturesByLeague,
} from './leagueUniverse';
import type { Fixture } from './concepts';

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: '1',
    sport: 'FOOTBALL',
    league: 'Premier League',
    leagueId: 39,
    country: 'England',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoffAt: new Date('2026-09-18T19:00:00Z'),
    status: 'NS',
    ...overrides,
  };
}

describe('universo de ligas KSS-LEAGUE-UNIVERSE-01', () => {
  it('Premier League y MLS son ligas habilitadas con modelos', () => {
    const premierLeague = LEAGUE_UNIVERSE.find((league) => league.leagueId === 39);
    expect(premierLeague?.status).toBe('MODEL_ENABLED');
    expect(premierLeague?.cohortId).toBe('KSS-V1-C01');
    const mls = LEAGUE_UNIVERSE.find((league) => league.leagueId === 253);
    expect(mls?.status).toBe('MODEL_ENABLED');
    expect(mls?.cohortId).toBe('KSS-V1-C10-USA');
    const modelEnabled = LEAGUE_UNIVERSE.filter((league) => league.status === 'MODEL_ENABLED');
    expect(modelEnabled).toHaveLength(2);
  });

  it('el resto del universo V1 es OBSERVATION_ONLY', () => {
    const observationOnly = LEAGUE_UNIVERSE.filter(
      (league) => league.status === 'OBSERVATION_ONLY',
    );
    expect(observationOnly).toHaveLength(8);
  });

  it('Colombia y LaLiga permanecen OBSERVATION_ONLY', () => {
    expect(resolveLeagueStatus(fixture({ leagueId: 239, country: 'Colombia' }))).toBe(
      'OBSERVATION_ONLY',
    );
    expect(resolveLeagueStatus(fixture({ leagueId: 140, country: 'Spain' }))).toBe(
      'OBSERVATION_ONLY',
    );
  });

  it('Portugal y Bélgica conservan cohortes propias y fallan cerradas mientras observan', () => {
    const portugal = LEAGUE_UNIVERSE.find((league) => league.leagueId === 94);
    const belgium = LEAGUE_UNIVERSE.find((league) => league.leagueId === 144);
    expect(portugal).toMatchObject({
      country: 'Portugal',
      cohortId: 'KSS-V1-C08-POR',
      historicalDataset: 'primeira-liga',
      status: 'OBSERVATION_ONLY',
    });
    expect(belgium).toMatchObject({
      country: 'Belgium',
      cohortId: 'KSS-V1-C09-BEL',
      historicalDataset: 'belgian-pro-league',
      status: 'OBSERVATION_ONLY',
    });
    expect(isModelEnabled(fixture({ leagueId: 94, country: 'Portugal' }))).toBe(false);
    expect(isModelEnabled(fixture({ leagueId: 144, country: 'Belgium' }))).toBe(false);
  });

  it('liga fuera del universo (copa, youth, seleccion) es EXCLUDED, fail-closed', () => {
    expect(resolveLeagueStatus(fixture({ leagueId: 2, country: 'World' }))).toBe('EXCLUDED');
    expect(resolveLeagueStatus(fixture({ leagueId: undefined, country: undefined }))).toBe(
      'EXCLUDED',
    );
  });

  it('isObservable es true para MODEL_ENABLED y OBSERVATION_ONLY, false para EXCLUDED', () => {
    expect(isObservable(fixture({ leagueId: 39, country: 'England' }))).toBe(true);
    expect(isObservable(fixture({ leagueId: 140, country: 'Spain' }))).toBe(true);
    expect(isObservable(fixture({ leagueId: 2, country: 'World' }))).toBe(false);
  });

  it('isModelEnabled: Premier y defensa de protocolo (reserva/cup)', () => {
    expect(isModelEnabled(fixture())).toBe(true);
    expect(isModelEnabled(fixture({ leagueId: 140, country: 'Spain', league: 'LaLiga' }))).toBe(
      false,
    );
    expect(isModelEnabled(fixture({ awayTeam: 'Chelsea II' }))).toBe(false);
    expect(isModelEnabled(fixture({ league: 'FA Cup' }))).toBe(false);
  });

  it('summarizeFixturesByLeague agrupa en el orden fijo del universo', () => {
    const fixtures = [
      fixture({ id: '1', leagueId: 39, country: 'England' }),
      fixture({ id: '2', leagueId: 239, country: 'Colombia' }),
      fixture({ id: '3', leagueId: 239, country: 'Colombia' }),
      fixture({ id: '4', leagueId: 999, country: 'Nowhere' }),
    ];
    const summary = summarizeFixturesByLeague(fixtures);
    expect(summary.map((entry) => entry.canonicalName)).toEqual([
      'Premier League',
      'Liga BetPlay',
      'LaLiga',
      'Serie A',
      'Bundesliga',
      'Ligue 1',
      'Eredivisie',
      'Primeira Liga',
      'Belgian Pro League',
      'Major League Soccer',
    ]);
    expect(summary[0]).toMatchObject({ status: 'MODEL_ENABLED', fixturesDetected: 1 });
    expect(summary[1]).toMatchObject({ status: 'OBSERVATION_ONLY', fixturesDetected: 2 });
    expect(summary[2]?.fixturesDetected).toBe(0);
    const total = summary.reduce((sum, entry) => sum + entry.fixturesDetected, 0);
    expect(total).toBe(3);
  });
});
