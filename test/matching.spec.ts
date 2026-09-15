import type { Fixture } from '../src/features/scanning/domain/concepts';
import {
  KICKOFF_TOLERANCE_MINUTES,
  matchFixturesWithOdds,
} from '../src/features/scanning/domain/matching';
import type { OddsEvent } from '../src/features/scanning/domain/matching';

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'f1',
    sport: 'FOOTBALL',
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea FC',
    kickoffAt: new Date('2026-09-18T19:00:00Z'),
    status: 'NS',
    ...overrides,
  };
}

function oddsEvent(overrides: Partial<OddsEvent> = {}): OddsEvent {
  return {
    id: 'odds-1',
    homeTeam: 'Arsenal FC',
    awayTeam: 'Chelsea',
    kickoffAt: new Date('2026-09-18T19:00:00Z'),
    league: 'Premier League',
    tournamentId: 17,
    ...overrides,
  };
}

describe('matching fixtures <-> odds events', () => {
  it('casa con nombres normalizados aunque difieran sufijos FC', () => {
    const results = matchFixturesWithOdds([fixture()], [oddsEvent()]);
    expect(results[0]?.status).toBe('MATCHED');
    expect(results[0]?.fixture?.id).toBe('f1');
  });

  it('casa dentro de la tolerancia de kickoff', () => {
    const results = matchFixturesWithOdds(
      [fixture()],
      [oddsEvent({ kickoffAt: new Date('2026-09-18T19:20:00Z') })],
    );
    expect(results[0]?.status).toBe('MATCHED');
  });

  it('rechaza (UNMATCHED) si el kickoff excede la tolerancia', () => {
    const delta = KICKOFF_TOLERANCE_MINUTES + 60;
    const results = matchFixturesWithOdds(
      [fixture()],
      [oddsEvent({ kickoffAt: new Date('2026-09-18T21:00:00Z') })],
    );
    expect(delta).toBeGreaterThan(KICKOFF_TOLERANCE_MINUTES);
    expect(results[0]?.status).toBe('UNMATCHED');
  });

  it('rechaza (UNMATCHED) con equipos distintos', () => {
    const results = matchFixturesWithOdds(
      [fixture()],
      [oddsEvent({ homeTeam: 'Liverpool', awayTeam: 'Everton' })],
    );
    expect(results[0]?.status).toBe('UNMATCHED');
  });

  it('rechaza (AMBIGUOUS) con dos fixtures indistinguibles', () => {
    const results = matchFixturesWithOdds([fixture(), fixture({ id: 'f2' })], [oddsEvent()]);
    expect(results[0]?.status).toBe('AMBIGUOUS');
  });

  it('marca AMBIGUOUS cuando local/visitante aparecen invertidos', () => {
    const results = matchFixturesWithOdds(
      [fixture()],
      [oddsEvent({ homeTeam: 'Chelsea', awayTeam: 'Arsenal FC' })],
    );
    expect(results[0]?.status).toBe('AMBIGUOUS');
  });

  it('no casa si la liga difiere explicitamente', () => {
    const results = matchFixturesWithOdds([fixture()], [oddsEvent({ league: 'FA Cup' })]);
    expect(results[0]?.status).toBe('UNMATCHED');
  });

  it('casa cuando la liga falta en uno de los proveedores', () => {
    const results = matchFixturesWithOdds([fixture()], [oddsEvent({ league: undefined })]);
    expect(results[0]?.status).toBe('MATCHED');
  });
});
