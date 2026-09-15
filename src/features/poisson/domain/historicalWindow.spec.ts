import type { HistoricalMatch } from './concepts';
import { filterHistoricalWindow, isCausal, windowStart } from './historicalWindow';

const match = (date: string): HistoricalMatch => ({
  date: new Date(date),
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  homeGoals: 1,
  awayGoals: 1,
  result: 'D',
});

describe('historicalWindow', () => {
  it('windowStart resta exactamente 24 meses en UTC', () => {
    expect(windowStart(new Date('2026-09-15T00:00:00.000Z'))).toEqual(
      new Date('2024-09-15T00:00:00.000Z'),
    );
  });

  it('isCausal rechaza partidos en o despues del snapshot', () => {
    const snapshotAt = new Date('2026-09-15T00:00:00.000Z');
    expect(isCausal(new Date('2026-09-14T23:59:59.000Z'), snapshotAt)).toBe(true);
    expect(isCausal(new Date('2026-09-15T00:00:00.000Z'), snapshotAt)).toBe(false);
    expect(isCausal(new Date('2026-09-16T00:00:00.000Z'), snapshotAt)).toBe(false);
  });

  it('filterHistoricalWindow excluye partidos futuros (regla causal)', () => {
    const snapshotAt = new Date('2026-09-15T00:00:00.000Z');
    const matches = [
      match('2026-09-14T00:00:00.000Z'),
      match('2026-09-15T00:00:00.000Z'),
      match('2026-09-20T00:00:00.000Z'),
    ];
    const result = filterHistoricalWindow(matches, snapshotAt);
    expect(result).toHaveLength(1);
    expect(result[0]?.date).toEqual(new Date('2026-09-14T00:00:00.000Z'));
  });

  it('filterHistoricalWindow excluye partidos anteriores a la ventana de 24 meses', () => {
    const snapshotAt = new Date('2026-09-15T00:00:00.000Z');
    const matches = [
      match('2024-09-14T00:00:00.000Z'), // fuera: antes de la ventana
      match('2024-09-15T00:00:00.000Z'), // dentro: límite inclusivo
      match('2025-01-01T00:00:00.000Z'), // dentro
    ];
    const result = filterHistoricalWindow(matches, snapshotAt);
    expect(result).toHaveLength(2);
  });
});
