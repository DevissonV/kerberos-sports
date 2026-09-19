jest.mock('@nestjs/common', () => ({
  Inject: () => () => undefined,
  Injectable: () => (target: unknown) => target,
  Optional: () => () => undefined,
}));

import {
  hoursUntilKickoff,
  logPreanalysisFixture,
  nextT6Fixture,
} from '../src/features/quant/application/refinementService';
import type { Fixture } from '../src/features/scanning/domain/concepts';

const NOW = new Date('2026-09-15T08:30:00.000Z');

function fixture(id: string, kickoffAt: string): Fixture {
  return {
    id,
    sport: 'FOOTBALL',
    league: 'Premier League',
    leagueId: 39,
    country: 'England',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoffAt: new Date(kickoffAt),
    status: 'NS',
  };
}

describe('observabilidad de fixtures', () => {
  it('registra PREANALYSIS con UTC, Bogotá, horas y T-6 false', () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logPreanalysisFixture(fixture('f1', '2026-09-15T16:30:00.000Z'), NOW);
    const output = String(write.mock.calls[0]?.[0]);
    expect(output).toContain('PREANALYSIS_FIXTURE');
    expect(output).toContain('kickoffAtUtc":"2026-09-15T16:30:00.000Z');
    expect(output).toContain('kickoffAtBogota":"15 Sep 2026 · 11:30');
    expect(output).toContain('hoursUntilKickoff":8');
    expect(output).toContain('t6Eligible":false');
    expect(output).not.toMatch(/API_FOOTBALL_KEY|ODDSPAPI_KEY|TELEGRAM_BOT_TOKEN/);
    write.mockRestore();
  });

  it('marca T-6 true exactamente al entrar en la ventana', () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const kickoff = new Date('2026-09-15T14:30:00.000Z');
    logPreanalysisFixture(
      fixture('f2', kickoff.toISOString()),
      new Date('2026-09-15T08:30:00.000Z'),
    );
    expect(String(write.mock.calls[0]?.[0])).toContain('t6Eligible":true');
    write.mockRestore();
  });

  it('calcula horas y escoge el T-6 más próximo', () => {
    expect(hoursUntilKickoff(new Date('2026-09-15T16:30:00.000Z'), NOW)).toBe(8);
    const closest = nextT6Fixture(
      [
        {
          fixture: fixture('later', '2026-09-16T16:30:00.000Z'),
          decisionAt: new Date('2026-09-16T10:30:00.000Z'),
        },
        {
          fixture: fixture('soon', '2026-09-15T14:30:00.000Z'),
          decisionAt: new Date('2026-09-15T08:30:00.000Z'),
        },
      ],
      NOW,
    );
    expect(closest).toMatchObject({
      fixture: { id: 'later' },
      fixtureLabel: 'Arsenal vs Chelsea',
      decisionAt: new Date('2026-09-16T10:30:00.000Z'),
    });
  });

  it('resuelve empates de entrada a T-6 por fixtureId', () => {
    const entries = ['zeta', 'alpha'].map((id) => ({
      fixture: fixture(id, '2026-09-16T14:30:00.000Z'),
      decisionAt: new Date('2026-09-16T08:30:00.000Z'),
    }));
    expect(nextT6Fixture(entries, NOW)?.fixture.id).toBe('alpha');
  });
});
