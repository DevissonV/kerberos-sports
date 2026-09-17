import { auditEuropaFixture, computeEuropaExperimentalModel } from './europaCoverage';
import type { HistoricalMatch } from '../../poisson/domain/concepts';
import type { Fixture } from './concepts';

const SNAPSHOT = new Date('2026-09-17T12:00:00.000Z');

function history(home: string, away: string): HistoricalMatch[] {
  return Array.from({ length: 210 }, (_, index) => ({
    date: new Date(Date.UTC(2025, 0, 1 + index)),
    homeTeam: index % 10 === 0 ? home : `Home ${index}`,
    awayTeam: index % 10 === 1 ? away : `Away ${index}`,
    homeGoals: 1,
    awayGoals: 1,
    result: 'D' as const,
  }));
}

const fixture: Fixture = {
  id: 'uel-1',
  sport: 'FOOTBALL',
  league: 'UEFA Europa League',
  leagueId: 3,
  country: 'World',
  homeTeam: 'Home Club',
  awayTeam: 'Away Club',
  kickoffAt: new Date('2026-09-17T19:00:00.000Z'),
  status: 'NS',
};

describe('Europa League coverage gate', () => {
  it('classifies both supported teams and produces experimental probabilities', () => {
    const coverage = auditEuropaFixture(
      fixture,
      [
        { league: 'Domestic A', matches: history('Home Club', 'Other A') },
        { league: 'Domestic B', matches: history('Other B', 'Away Club') },
      ],
      SNAPSHOT,
    );
    expect(coverage.supportClass).toBe('BOTH_SIDES_SUPPORTED');
    expect(coverage.modelStatus).toBe('EXPERIMENTAL_ONLY');
    const model = computeEuropaExperimentalModel(coverage, SNAPSHOT);
    expect(model?.pOver).toBeGreaterThanOrEqual(0);
    expect(model?.pOver).toBeLessThanOrEqual(1);
    expect((model?.pOver ?? 0) + (model?.pUnder ?? 0)).toBeCloseTo(1, 10);
  });

  it.each([
    [
      'one side',
      [{ league: 'Domestic A', matches: history('Home Club', 'Other A') }],
      'ONE_SIDE_SUPPORTED',
    ],
    ['no sides', [], 'NO_SUPPORTED_HISTORY'],
  ] as const)('classifies %s without inventing a baseline', (_label, sources, expected) => {
    const coverage = auditEuropaFixture(fixture, sources, SNAPSHOT);
    expect(coverage.supportClass).toBe(expected);
    expect(computeEuropaExperimentalModel(coverage, SNAPSHOT)).toBeNull();
  });
});
