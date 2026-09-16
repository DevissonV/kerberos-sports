import {
  loadHistoricalMatchesForDataset,
  loadLocalHistoricalMatches,
} from './localCsvHistoricalMatches';
import { filterHistoricalWindow } from '../domain/historicalWindow';
import { computeLeagueBaselines } from '../domain/leagueBaselines';
import { computePoissonV1 } from '../domain/model';

describe('loadLocalHistoricalMatches', () => {
  it('carga y combina los 3 CSVs versionados de resources/data/premier-league', () => {
    const matches = loadLocalHistoricalMatches();
    // 380 (2024/25) + 380 (2025/26) + 40 (2026/27, parcial) = 800
    expect(matches.length).toBe(800);
    for (const match of matches) {
      expect(match.date instanceof Date).toBe(true);
      expect(Number.isNaN(match.date.getTime())).toBe(false);
      expect(match.homeGoals).toBeGreaterThanOrEqual(0);
      expect(match.awayGoals).toBeGreaterThanOrEqual(0);
    }
  });
});

describe.each([
  ['la-liga', 'Barcelona', 'Real Madrid'],
  ['serie-a', 'Inter', 'Juventus'],
  ['bundesliga', 'Bayern Munich', 'Borussia Dortmund'],
  ['ligue-1', 'Paris Saint Germain', 'Marseille'],
  ['eredivisie', 'Ajax', 'PSV'],
  ['primeira-liga', 'Benfica', 'Sporting CP'],
  ['belgian-pro-league', 'Anderlecht', 'Club Brugge KV'],
] as const)('histórico local %s', (dataset, home, away) => {
  const snapshotAt = new Date('2026-09-15T12:00:00Z');

  it('mantiene filas completas, ventana causal y sin leakage futuro', () => {
    const matches = loadHistoricalMatchesForDataset(dataset);
    const inWindow = filterHistoricalWindow(matches, snapshotAt);
    expect(matches.length).toBeGreaterThanOrEqual(200);
    expect(inWindow.length).toBeGreaterThanOrEqual(200);
    expect(inWindow.every((match) => match.date < snapshotAt)).toBe(true);
    expect(
      new Set(
        matches.map((match) => `${match.date.toISOString()}-${match.homeTeam}-${match.awayTeam}`),
      ).size,
    ).toBe(matches.length);
  });

  it('calcula media independiente y smoke Poisson válido', () => {
    const matches = loadHistoricalMatchesForDataset(dataset);
    const baselines = computeLeagueBaselines(filterHistoricalWindow(matches, snapshotAt));
    expect(baselines).not.toBe('LEAGUE_NOT_ENABLED');
    const result = computePoissonV1({
      fixtureId: `${dataset}-smoke`,
      league: dataset,
      home,
      away,
      snapshotAt,
      historicalMatches: matches,
    });
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.output.leagueHomeGoalsMean).toBeGreaterThan(0);
      expect(result.output.leagueAwayGoalsMean).toBeGreaterThan(0);
      expect(Number.isFinite(result.output.leagueHomeGoalsMean)).toBe(true);
      expect(Number.isFinite(result.output.leagueAwayGoalsMean)).toBe(true);
      expect(result.output.lambdaHome).toBeGreaterThan(0);
      expect(result.output.lambdaAway).toBeGreaterThan(0);
      expect(result.output.lambdaTotal).toBeGreaterThan(0);
      expect(result.output.pUnder).toBeGreaterThanOrEqual(0);
      expect(result.output.pUnder).toBeLessThanOrEqual(1);
      expect(result.output.pOver).toBeGreaterThanOrEqual(0);
      expect(result.output.pOver).toBeLessThanOrEqual(1);
      expect(result.output.pUnder + result.output.pOver).toBeCloseTo(1, 12);
    }
  });
});

it('LaLiga y Serie A usan baselines propios, no los de Premier League', () => {
  const snapshotAt = new Date('2026-09-15T12:00:00Z');
  const premier = computeLeagueBaselines(
    filterHistoricalWindow(loadLocalHistoricalMatches(), snapshotAt),
  );
  const laLiga = computeLeagueBaselines(
    filterHistoricalWindow(loadHistoricalMatchesForDataset('la-liga'), snapshotAt),
  );
  const serieA = computeLeagueBaselines(
    filterHistoricalWindow(loadHistoricalMatchesForDataset('serie-a'), snapshotAt),
  );
  expect(premier).not.toBe('LEAGUE_NOT_ENABLED');
  expect(laLiga).not.toBe('LEAGUE_NOT_ENABLED');
  expect(serieA).not.toBe('LEAGUE_NOT_ENABLED');
  if (
    premier === 'LEAGUE_NOT_ENABLED' ||
    laLiga === 'LEAGUE_NOT_ENABLED' ||
    serieA === 'LEAGUE_NOT_ENABLED'
  )
    return;
  expect([laLiga.leagueHomeGoalsMean, laLiga.leagueAwayGoalsMean]).not.toEqual([
    premier.leagueHomeGoalsMean,
    premier.leagueAwayGoalsMean,
  ]);
  expect([serieA.leagueHomeGoalsMean, serieA.leagueAwayGoalsMean]).not.toEqual([
    premier.leagueHomeGoalsMean,
    premier.leagueAwayGoalsMean,
  ]);
});
