import { evaluateProtocolEligibility } from '../src/features/scanning/domain/protocol';
import type { Fixture } from '../src/features/scanning/domain/concepts';

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'f1',
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

describe('evaluateProtocolEligibility (cohorte KSS-V1-C01)', () => {
  it('acepta league.id=39 + country=England', () => {
    expect(evaluateProtocolEligibility(fixture())).toBeNull();
  });

  it('rechaza otra "Premier League" de otro país (mismo nombre, distinto id/país)', () => {
    expect(evaluateProtocolEligibility(fixture({ leagueId: 322, country: 'Jamaica' }))).toBe(
      'WRONG_LEAGUE_ID',
    );
    expect(evaluateProtocolEligibility(fixture({ leagueId: 39, country: 'Uganda' }))).toBe(
      'WRONG_COUNTRY',
    );
  });

  it('fail-closed cuando faltan leagueId/country', () => {
    expect(evaluateProtocolEligibility(fixture({ leagueId: undefined, country: undefined }))).toBe(
      'WRONG_LEAGUE_ID',
    );
  });

  it('rechaza copas y competiciones continentales por nombre', () => {
    expect(evaluateProtocolEligibility(fixture({ league: 'FA Cup' }))).toBe(
      'EXCLUDED_COMPETITION_TYPE',
    );
    expect(evaluateProtocolEligibility(fixture({ league: 'UEFA Champions League' }))).toBe(
      'EXCLUDED_COMPETITION_TYPE',
    );
  });

  it('rechaza equipos reserva/B/juveniles/femenino aunque leagueId/país coincidan', () => {
    expect(evaluateProtocolEligibility(fixture({ awayTeam: 'Chelsea FC II' }))).toBe(
      'RESERVE_OR_YOUTH_TEAM',
    );
    expect(evaluateProtocolEligibility(fixture({ homeTeam: 'Arsenal U21' }))).toBe(
      'RESERVE_OR_YOUTH_TEAM',
    );
  });
});
