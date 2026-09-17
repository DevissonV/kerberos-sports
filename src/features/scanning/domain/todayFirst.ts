/** Clasificación y selección determinista del radar en America/Bogota. */

export const RADAR_LIMIT = 3;
export const RADAR_TIME_ZONE = 'America/Bogota';

export interface TodayFirstEntry {
  kickoffAt: Date;
  fixtureId: string;
}

export function calendarDateInBogota(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RADAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function compareKickoff<T extends TodayFirstEntry>(a: T, b: T): number {
  return a.kickoffAt.getTime() - b.kickoffAt.getTime() || a.fixtureId.localeCompare(b.fixtureId);
}

/** Orden de consumo: TODAY primero, después UPCOMING; no cambia el tamaño del lote. */
export function prioritizeTodayFirst<T extends TodayFirstEntry>(
  entries: readonly T[],
  now: Date,
): T[] {
  const todayDate = calendarDateInBogota(now);
  return [...entries].sort((a, b) => {
    const aToday = calendarDateInBogota(a.kickoffAt) === todayDate;
    const bToday = calendarDateInBogota(b.kickoffAt) === todayDate;
    return Number(bToday) - Number(aToday) || compareKickoff(a, b);
  });
}

export function selectTodayFirst<T extends TodayFirstEntry>(
  entries: readonly T[],
  now: Date,
  limit = RADAR_LIMIT,
): { today: T[]; upcoming: T[]; todayTotal: number; upcomingTotal: number } {
  const todayDate = calendarDateInBogota(now);
  const ordered = [...entries].sort(compareKickoff);
  const today = ordered.filter((entry) => calendarDateInBogota(entry.kickoffAt) === todayDate);
  const upcoming = ordered.filter((entry) => calendarDateInBogota(entry.kickoffAt) > todayDate);
  const safeLimit = Math.max(0, limit);
  return {
    today: today.slice(0, safeLimit),
    upcoming: upcoming.slice(0, Math.max(0, safeLimit - Math.min(today.length, safeLimit))),
    todayTotal: today.length,
    upcomingTotal: upcoming.length,
  };
}
