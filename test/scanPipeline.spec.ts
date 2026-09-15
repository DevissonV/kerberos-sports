import { decisionAtFromKickoff } from '../src/features/scanning/domain/decisionWindow';
import { runScan } from '../src/features/scanning/application/scanPipeline';
import type { Fixture, OddsPair } from '../src/features/scanning/domain/concepts';
import type { OddsEvent } from '../src/features/scanning/domain/matching';

const PL_LEAGUE_ID = 39;
const PL_COUNTRY = 'England';

function fixture(
  id: string,
  home: string,
  away: string,
  kickoff: string,
  overrides: Partial<Fixture> = {},
): Fixture {
  return {
    id,
    sport: 'FOOTBALL',
    league: 'Premier League',
    leagueId: PL_LEAGUE_ID,
    country: PL_COUNTRY,
    homeTeam: home,
    awayTeam: away,
    kickoffAt: new Date(kickoff),
    status: 'NS',
    ...overrides,
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

/** Kickoff fijo y `now` justo en la ventana de decisión T-6h (protocolo KSS-V1-C01). */
const KICKOFF = '2026-09-18T19:00:00Z';
const NOW_AT_DECISION_WINDOW = decisionAtFromKickoff(new Date(KICKOFF));

describe('scan pipeline con adapters fake', () => {
  it('produce candidatos normalizados con fair probabilities y decision NO_BET_PIPELINE_ONLY', async () => {
    const fetchFixtures = (): Promise<Fixture[]> =>
      Promise.resolve([
        fixture('f1', 'Arsenal', 'Chelsea FC', KICKOFF),
        fixture('f2', 'Real Madrid', 'Sevilla FC', '2026-09-18T21:30:00Z', {
          league: 'Primera A',
          leagueId: 239,
          country: 'Colombia',
        }),
      ]);
    const fetchOddsEvents = (): Promise<OddsEvent[]> =>
      Promise.resolve([
        oddsEvent('o1', 'Arsenal FC', 'Chelsea', KICKOFF),
        oddsEvent('o2', 'Bayern', 'Dortmund', '2026-09-19T18:00:00Z'),
      ]);
    const fetchOddsPairs = (events: readonly OddsEvent[]): Promise<OddsPair[]> =>
      Promise.resolve(
        events.map((event) =>
          event.id === 'o1' ? pair('o1', '1xbet', 1.95, 1.87) : pair('o2', 'pinnacle', 1.8, 2.0),
        ),
      );

    const { report } = await runScan({
      fetchFixtures,
      fetchOddsEvents,
      fetchOddsPairs,
      limit: 20,
      now: NOW_AT_DECISION_WINDOW,
    });

    expect(report.fixturesFetched).toBe(2);
    expect(report.fixturesEligible).toBe(1);
    expect(report.excludedByProtocol).toBe(1);
    expect(report.fixturesMatched).toBe(1);
    expect(report.temporalEligible).toBe(1);
    expect(report.candidatesNormalized).toBe(1);

    const candidate = report.candidates[0];
    expect(candidate?.pair.bookmaker).toBe('1xbet');
    expect(candidate?.model).toBe('NOT_YET_AVAILABLE');
    expect(candidate?.edge).toBe(0);
    expect(candidate?.decision).toBe('NO_BET_PIPELINE_ONLY');
    expect(candidate?.decisionAt.toISOString()).toBe(NOW_AT_DECISION_WINDOW.toISOString());
    expect(candidate?.snapshotAt.toISOString()).toBe(NOW_AT_DECISION_WINDOW.toISOString());
    expect(
      (candidate?.fairOverProbability ?? 0) + (candidate?.fairUnderProbability ?? 0),
    ).toBeCloseTo(1, 12);
  });

  it('registra UNMATCHED/AMBIGUOUS en logs sin romper el pipeline', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () => Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', KICKOFF)]),
      fetchOddsEvents: () =>
        Promise.resolve([
          oddsEvent('o1', 'Bayern', 'Dortmund', '2026-09-19T18:00:00Z', 78),
          oddsEvent('o2', 'Chelsea', 'Arsenal FC', KICKOFF),
        ]),
      fetchOddsPairs: () => Promise.resolve([]),
      limit: 20,
      now: NOW_AT_DECISION_WINDOW,
    });

    expect(report.candidatesNormalized).toBe(0);
    expect(logs.some((entry) => entry.message.includes('UNMATCHED'))).toBe(true);
    expect(logs.some((entry) => entry.message.includes('AMBIGUOUS'))).toBe(true);
  });

  it('candidato casado sin odds O/U 2.5 en la ventana de decisión se registra como NO_ODDS_AT_SNAPSHOT', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () => Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', KICKOFF)]),
      fetchOddsEvents: () => Promise.resolve([oddsEvent('o1', 'Arsenal FC', 'Chelsea', KICKOFF)]),
      fetchOddsPairs: () => Promise.resolve([]),
      limit: 20,
      now: NOW_AT_DECISION_WINDOW,
    });

    expect(report.fixturesMatched).toBe(1);
    expect(report.temporalEligible).toBe(1);
    expect(report.candidatesNormalized).toBe(0);
    expect(logs.some((entry) => entry.message.includes('NO_ODDS_AT_SNAPSHOT'))).toBe(true);
  });

  it('excluye por protocolo un equipo reserva (II) incluso con leagueId/país correctos', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () => Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC II', KICKOFF)]),
      fetchOddsEvents: () => Promise.resolve([]),
      fetchOddsPairs: () => Promise.resolve([]),
      limit: 20,
      now: NOW_AT_DECISION_WINDOW,
    });

    expect(report.fixturesEligible).toBe(0);
    expect(report.excludedByProtocol).toBe(1);
    expect(logs.some((entry) => entry.message.includes('NOT_MODEL_ENABLED'))).toBe(true);
  });

  it('rechaza una oportunidad fuera de la ventana de decisión T-6h (TOO_EARLY)', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () => Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', KICKOFF)]),
      fetchOddsEvents: () => Promise.resolve([oddsEvent('o1', 'Arsenal FC', 'Chelsea', KICKOFF)]),
      fetchOddsPairs: () => Promise.resolve([pair('o1', 'pinnacle', 1.95, 1.87)]),
      limit: 20,
      now: new Date('2026-09-15T00:00:00Z'),
    });

    expect(report.temporalEligible).toBe(0);
    expect(report.temporalExcluded.tooEarly).toBe(1);
    expect(report.candidatesNormalized).toBe(0);
    expect(logs.some((entry) => entry.message.includes('TOO_EARLY'))).toBe(true);
  });

  it('rechaza una oportunidad con el partido ya iniciado (STARTED)', async () => {
    const { report, logs } = await runScan({
      fetchFixtures: () => Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', KICKOFF)]),
      fetchOddsEvents: () => Promise.resolve([oddsEvent('o1', 'Arsenal FC', 'Chelsea', KICKOFF)]),
      fetchOddsPairs: () => Promise.resolve([pair('o1', 'pinnacle', 1.95, 1.87)]),
      limit: 20,
      now: new Date('2026-09-18T19:30:00Z'),
    });

    expect(report.temporalEligible).toBe(0);
    expect(report.temporalExcluded.started).toBe(1);
    expect(report.candidatesNormalized).toBe(0);
    expect(logs.some((entry) => entry.message.includes('STARTED'))).toBe(true);
  });

  it('rechaza una oportunidad cuya ventana T-6h ya pasó pero el partido no ha iniciado (MISSED_WINDOW)', async () => {
    const { report } = await runScan({
      fetchFixtures: () => Promise.resolve([fixture('f1', 'Arsenal', 'Chelsea FC', KICKOFF)]),
      fetchOddsEvents: () => Promise.resolve([oddsEvent('o1', 'Arsenal FC', 'Chelsea', KICKOFF)]),
      fetchOddsPairs: () => Promise.resolve([pair('o1', 'pinnacle', 1.95, 1.87)]),
      limit: 20,
      now: new Date('2026-09-18T16:00:00Z'),
    });

    expect(report.temporalEligible).toBe(0);
    expect(report.temporalExcluded.missedWindow).toBe(1);
    expect(report.candidatesNormalized).toBe(0);
  });
});
