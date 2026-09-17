jest.mock('@nestjs/common', () => ({
  Inject: () => () => undefined,
  Injectable: () => (target: unknown) => target,
}));

import { ScanningService } from './scanningService';
import { decisionAtFromKickoff } from '../domain/decisionWindow';
import type { Fixture } from '../domain/concepts';

const KICKOFF = '2026-09-18T19:00:00Z';
const NOW_AT_DECISION_WINDOW = decisionAtFromKickoff(new Date(KICKOFF));

function fixture(id: string, leagueId: number, country: string, league: string): Fixture {
  return {
    id,
    sport: 'FOOTBALL',
    league,
    leagueId,
    country,
    homeTeam: `Home${id}`,
    awayTeam: `Away${id}`,
    kickoffAt: new Date(KICKOFF),
    status: 'NS',
  };
}

function makeService(fixtures: Fixture[]): ScanningService {
  const fixturesProvider = { upcomingFixtures: () => Promise.resolve(fixtures) };
  const oddsProvider = {
    upcomingOddsEvents: () => Promise.resolve([]),
    overUnderPairs: () => Promise.resolve([]),
  };
  return new ScanningService(fixturesProvider, oddsProvider);
}

describe('ScanningService.precheck: universo multiliga (KSS-LEAGUE-UNIVERSE-01)', () => {
  it('separa MODEL_ENABLED de Colombia OBSERVATION_ONLY y excluye lo desconocido', async () => {
    const fixtures = [
      fixture('1', 39, 'England', 'Premier League'),
      fixture('2', 239, 'Colombia', 'Primera A'),
      fixture('3', 140, 'Spain', 'La Liga'),
      fixture('4', 2, 'World', 'FA Cup'),
    ];
    const service = makeService(fixtures);
    const output = await service.precheck(20, NOW_AT_DECISION_WINDOW);

    expect(output.rawFixtures).toBe(4);
    expect(output.eligibleFixtures).toBe(2);
    expect(output.fixtures).toHaveLength(2);
    expect(output.fixtures[0]?.fixture.id).toBe('1');
    expect(output.observationFixtures).toBe(1);

    const byStatus = Object.fromEntries(
      output.byLeague.map((entry) => [entry.canonicalName, entry]),
    );
    expect(byStatus['Premier League']).toMatchObject({
      status: 'MODEL_ENABLED',
      fixturesDetected: 1,
    });
    expect(byStatus['Liga BetPlay']).toMatchObject({
      status: 'OBSERVATION_ONLY',
      fixturesDetected: 1,
    });
    expect(byStatus['LaLiga']).toMatchObject({ status: 'MODEL_ENABLED', fixturesDetected: 1 });
  });

  it('liga productiva entra a la ventana cuando cumple la identidad de liga', async () => {
    const fixtures = [fixture('1', 140, 'Spain', 'LaLiga')];
    const service = makeService(fixtures);
    const output = await service.precheck(20, NOW_AT_DECISION_WINDOW);
    expect(output.decisionWindowFixtures).toHaveLength(1);
    expect(output.eligibleFixtures).toBe(1);
    expect(output.observationFixtures).toBe(0);
  });

  it('MODEL_ENABLED (Premier League) si puede llegar a decisionWindowFixtures', async () => {
    const fixtures = [fixture('1', 39, 'England', 'Premier League')];
    const service = makeService(fixtures);
    const output = await service.precheck(20, NOW_AT_DECISION_WINDOW);
    expect(output.decisionWindowFixtures).toHaveLength(1);
  });

  it('incluye en preanálisis un fixture T-24 sin llevarlo todavía al mercado', async () => {
    const future = fixture('future', 39, 'England', 'Premier League');
    future.kickoffAt = new Date(NOW_AT_DECISION_WINDOW.getTime() + 18 * 60 * 60 * 1000);
    const output = await makeService([future]).precheck(20, NOW_AT_DECISION_WINDOW);
    expect(output.preAnalysisFixtures).toHaveLength(1);
    expect(output.decisionWindowFixtures).toHaveLength(0);
  });
});
