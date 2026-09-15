import {
  KICKOFF_TOLERANCE_MINUTES,
  matchFixturesWithOdds,
} from '../src/features/scanning/domain/matching';
import type { OddsEvent } from '../src/features/scanning/domain/matching';
import type { Fixture } from '../src/features/scanning/domain/concepts';

function fixture(
  id: string,
  home: string,
  away: string,
  kickoff: string,
  league = 'Superettan',
): Fixture {
  return {
    id,
    sport: 'FOOTBALL',
    league,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: new Date(kickoff),
    status: 'NS',
  };
}

function oddsEvent(
  id: string,
  home: string,
  away: string,
  kickoff: string,
  league?: string,
): OddsEvent {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: new Date(kickoff),
    league,
    tournamentId: 1,
  };
}

describe('matching entre proveedores', () => {
  it('equipo con sufijo posesivo/alias casa por subset de tokens', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'IK brage', 'Sandviken', '2026-09-15T17:00:00Z')],
      [oddsEvent('o1', 'IK Brage', 'Sandvikens IF', '2026-09-15T17:00:00Z', 'Superettan')],
    );
    expect(results[0]?.status).toBe('MATCHED');
    expect(results[0]?.fixture?.id).toBe('f1');
  });

  it('casa con nombres normalizados aunque difieran sufijos FC', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-15T17:00:00Z')],
      [oddsEvent('o1', 'Arsenal FC', 'Chelsea', '2026-09-15T17:00:00Z')],
    );
    expect(results[0]?.status).toBe('MATCHED');
  });

  it('casa dentro de la tolerancia de kickoff', () => {
    const kickoffA = new Date('2026-09-15T17:00:00Z');
    const kickoffB = new Date(kickoffA.getTime() + KICKOFF_TOLERANCE_MINUTES * 55_000);
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Arsenal', 'Chelsea FC', kickoffA.toISOString())],
      [oddsEvent('o1', 'Arsenal FC', 'Chelsea', kickoffB.toISOString())],
    );
    expect(results[0]?.status).toBe('MATCHED');
  });

  it('liga distinta no bloquea el match cuando el candidato es unico', () => {
    const results = matchFixturesWithOdds(
      [
        fixture(
          'f1',
          'Beitar Jerusalem',
          'Maccabi Petah Tikva',
          '2026-09-15T17:00:00Z',
          "Ligat Ha'al",
        ),
      ],
      [
        oddsEvent(
          'o1',
          'Beitar Jerusalem FC',
          'Maccabi Petah Tikva FC',
          '2026-09-15T17:00:00Z',
          'Premier League',
        ),
      ],
    );
    expect(results[0]?.status).toBe('MATCHED');
  });

  it('casa cuando la liga falta en uno de los proveedores', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-15T17:00:00Z', undefined)],
      [oddsEvent('o1', 'Arsenal FC', 'Chelsea', '2026-09-15T17:00:00Z', undefined)],
    );
    expect(results[0]?.status).toBe('MATCHED');
  });

  it('la liga desempata entre varios candidatos compatibles', () => {
    const results = matchFixturesWithOdds(
      [
        fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-15T17:00:00Z', 'Otra Liga'),
        fixture('f2', 'Arsenal FC', 'Chelsea FC', '2026-09-15T17:00:00Z', 'Premier League'),
      ],
      [oddsEvent('o1', 'Arsenal FC', 'Chelsea', '2026-09-15T17:00:00Z', 'Premier League')],
    );
    expect(results[0]?.status).toBe('MATCHED');
    expect(results[0]?.fixture?.id).toBe('f2');
  });

  it('no colapsa filiales U19/Reserve con el primer equipo', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Gillingham FC', 'Aldershot', '2026-09-15T17:00:00Z')],
      [oddsEvent('o1', 'Gillingham FC Reserve', 'Aldershot', '2026-09-15T17:00:00Z')],
    );
    expect(results[0]?.status).toBe('UNMATCHED');
    expect(results[0]?.reason).toContain('NAME');
  });

  it('UNMATCHED por KICKOFF cuando los equipos coinciden y el horario no', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Arsenal', 'Chelsea', '2026-09-15T17:00:00Z')],
      [oddsEvent('o1', 'Arsenal', 'Chelsea', '2026-09-15T19:00:00Z')],
    );
    expect(results[0]?.status).toBe('UNMATCHED');
    expect(results[0]?.reason).toContain('KICKOFF');
  });

  it('rechaza (UNMATCHED) con equipos distintos', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-15T17:00:00Z')],
      [oddsEvent('o1', 'Bayern', 'Dortmund', '2026-09-15T17:00:00Z')],
    );
    expect(results[0]?.status).toBe('UNMATCHED');
  });

  it('AMBIGUOUS con dos fixtures indistinguibles', () => {
    const results = matchFixturesWithOdds(
      [
        fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-15T17:00:00Z'),
        fixture('f2', 'Arsenal FC', 'Chelsea FC', '2026-09-15T17:00:00Z'),
      ],
      [oddsEvent('o1', 'Arsenal', 'Chelsea', '2026-09-15T17:00:00Z')],
    );
    expect(results[0]?.status).toBe('AMBIGUOUS');
  });

  it('AMBIGUOUS cuando local/visitante aparecen invertidos', () => {
    const results = matchFixturesWithOdds(
      [fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-15T17:00:00Z')],
      [oddsEvent('o1', 'Chelsea FC', 'Arsenal', '2026-09-15T17:00:00Z')],
    );
    expect(results[0]?.status).toBe('AMBIGUOUS');
  });
});
