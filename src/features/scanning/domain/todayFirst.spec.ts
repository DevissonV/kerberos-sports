import { calendarDateInBogota, prioritizeTodayFirst, selectTodayFirst } from './todayFirst';

const entry = (fixtureId: string, kickoffAt: string) => ({
  fixtureId,
  kickoffAt: new Date(kickoffAt),
});

describe('today-first radar', () => {
  const now = new Date('2026-09-17T15:00:00Z');

  it('prioriza TODAY y solo luego rellena con UPCOMING', () => {
    const result = selectTodayFirst(
      [
        entry('future', '2026-09-18T17:00:00Z'),
        entry('today-late', '2026-09-17T23:00:00Z'),
        entry('today-early', '2026-09-17T18:00:00Z'),
      ],
      now,
      2,
    );
    expect(result.today.map((item) => item.fixtureId)).toEqual(['today-early', 'today-late']);
    expect(result.upcoming).toEqual([]);
    expect(result.todayTotal).toBe(2);
    expect(result.upcomingTotal).toBe(1);
  });

  it('rellena espacios y desempata por fixtureId', () => {
    const result = selectTodayFirst(
      [
        entry('z', '2026-09-17T19:00:00Z'),
        entry('a', '2026-09-17T19:00:00Z'),
        entry('future', '2026-09-18T17:00:00Z'),
      ],
      now,
      3,
    );
    expect(result.today.map((item) => item.fixtureId)).toEqual(['a', 'z']);
    expect(result.upcoming.map((item) => item.fixtureId)).toEqual(['future']);
  });

  it('usa America/Bogota en la frontera UTC/Bogota', () => {
    expect(calendarDateInBogota(new Date('2026-09-18T04:30:00Z'))).toBe('2026-09-17');
    expect(calendarDateInBogota(new Date('2026-09-18T05:00:00Z'))).toBe('2026-09-18');
    expect(calendarDateInBogota(new Date('2026-09-17T23:30:00Z'))).toBe('2026-09-17');
    expect(calendarDateInBogota(new Date('2026-09-18T02:00:00Z'))).toBe('2026-09-17');
  });

  it('prioriza TODAY antes de consumir un budget limitado de odds', () => {
    const ordered = prioritizeTodayFirst(
      [entry('upcoming', '2026-09-18T17:00:00Z'), entry('today', '2026-09-17T18:00:00Z')],
      now,
    );
    const budgetConsumed = ordered.slice(0, 1).map((item) => item.fixtureId);
    expect(budgetConsumed).toEqual(['today']);
    expect(ordered).toHaveLength(2);
  });
});
