import { loadLocalHistoricalMatches } from './localCsvHistoricalMatches';

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
