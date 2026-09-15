import { runScan } from '../src/features/scanning/application/scanPipeline';
import type { Fixture, OddsPair } from '../src/features/scanning/domain/concepts';
import type { OddsEvent } from '../src/features/scanning/domain/matching';

function fixture(id: string, home: string, away: string, kickoff: string): Fixture {
  return {
    id,
    sport: 'FOOTBALL',
    league: 'Premier League',
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
  tournamentId = 17,
): OddsEvent {
  return {
    id,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: new Date(kickoff),
    league: 'Premier League',
    tournamentId,
  };
}

function pair(fixtureId: string, bookmaker: string, overOdds: number, underOdds: number): OddsPair {
  const capturedAt = new Date('2026-09-17T10:00:00Z');
  return {
    fixtureId,
    bookmaker,
    over: { bookmaker, selection: 'OVER_2_5', decimalOdds: overOdds, capturedAt },
    under: { bookmaker, selection: 'UNDER_2_5', decimalOdds: underOdds, capturedAt },
  };
}

describe('scan pipeline con adapters fake', () => {
  it('produce candidatos normalizados con fair probabilities y decision NO_BET_PIPELINE_ONLY', async () => {
    const fetchFixtures = (): Promise<Fixture[]> =>
      Promise.resolve([
        fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-18T19:00:00Z'),
        fixture('f2', 'Real Madrid', 'Sevilla FC', '2026-09-18T21:30:00Z'),
      ]);
    const fetchOddsEvents = (): Promise<OddsEvent[]> =>
      Promise.resolve([
        oddsEvent('o1', 'Arsenal FC', 'Chelsea', '2026-09-18T19:00:00Z'),
        oddsEvent('o2', 'Bayern', 'Dortmund', '2026-09-19T18:00:00Z'),
      ]);
    const fetchOddsPairs = (events: readonly OddsEvent[]): Promise<OddsPair[]> =>
      Promise.resolve(
        events.map((event) =>
          event.id === 'o1' ? pair('o1', '1xbet', 1.95, 1.87) : pair('o2', 'pinnacle', 1.8, 2.0),
        ),
      );

    const { report } = await runScan({ fetchFixtures, fetchOddsEvents, fetchOddsPairs, limit: 20 });

    expect(report.fixturesFetched).toBe(2);
    expect(report.fixturesMatched).toBe(1);
    expect(report.candidatesNormalized).toBe(1);

    const candidate = report.candidates[0];
    expect(candidate?.pair.bookmaker).toBe('1xbet');
    expect(candidate?.model).toBe('NOT_YET_AVAILABLE');
    expect(candidate?.edge).toBe(0);
    expect(candidate?.decision).toBe('NO_BET_PIPELINE_ONLY');
    expect(
      (candidate?.fairOverProbability ?? 0) + (candidate?.fairUnderProbability ?? 0),
    ).toBeCloseTo(1, 12);
  });

  it('registra UNMATCHED/AMBIGUOUS en logs sin romper el pipeline', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () =>
        Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-18T19:00:00Z')]),
      fetchOddsEvents: () =>
        Promise.resolve([
          oddsEvent('o1', 'Bayern', 'Dortmund', '2026-09-19T18:00:00Z', 78),
          oddsEvent('o2', 'Chelsea', 'Arsenal FC', '2026-09-18T19:00:00Z'),
        ]),
      fetchOddsPairs: () => Promise.resolve([]),
      limit: 20,
    });

    expect(report.candidatesNormalized).toBe(0);
    expect(logs.some((entry) => entry.message.includes('UNMATCHED'))).toBe(true);
    expect(logs.some((entry) => entry.message.includes('AMBIGUOUS'))).toBe(true);
  });

  it('candidato casado sin odds O/U 2.5 se registra y se salta', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () =>
        Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', '2026-09-18T19:00:00Z')]),
      fetchOddsEvents: () =>
        Promise.resolve([oddsEvent('o1', 'Arsenal FC', 'Chelsea', '2026-09-18T19:00:00Z')]),
      fetchOddsPairs: () => Promise.resolve([]),
      limit: 20,
    });

    expect(report.fixturesMatched).toBe(1);
    expect(report.candidatesNormalized).toBe(0);
    expect(logs.some((entry) => entry.message.includes('sin odds O/U 2.5'))).toBe(true);
  });
});
