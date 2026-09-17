import type { Fixture } from './concepts';
import { isModelEnabled, resolveLeagueStatus } from './leagueUniverse';
import { calendarDateInBogota } from './todayFirst';

export const MODEL_HORIZON_HOURS = 24;

export type TodayExclusionReason =
  | 'MATCH_STARTED'
  | 'PREMATCH_WINDOW_CLOSED'
  | 'OUTSIDE_MODEL_HORIZON'
  | 'INSUFFICIENT_HISTORY'
  | 'ALIAS_FAILURE'
  | 'OBSERVATION_ONLY'
  | 'UNSUPPORTED_LEAGUE'
  | 'NO_LONGER_ELIGIBLE'
  | 'OTHER';

export interface TodayFunnel {
  raw: number;
  modelEnabled: number;
  historyReady: number;
  aliasReady: number;
  withinModelHorizon: number;
  modelled: number;
  preanalysis: number;
  marketWindow: number;
  marketAnalyzed: number;
  started: number;
  expired: number;
  rejected: number;
  modelable: number;
  rejectionBreakdown: Record<TodayExclusionReason, number>;
  rejectionExamples: readonly { home: string; away: string; reason: TodayExclusionReason }[];
}

const EMPTY_REASONS: Record<TodayExclusionReason, number> = {
  MATCH_STARTED: 0,
  PREMATCH_WINDOW_CLOSED: 0,
  OUTSIDE_MODEL_HORIZON: 0,
  INSUFFICIENT_HISTORY: 0,
  ALIAS_FAILURE: 0,
  OBSERVATION_ONLY: 0,
  UNSUPPORTED_LEAGUE: 0,
  NO_LONGER_ELIGIBLE: 0,
  OTHER: 0,
};

export function classifyTodayFixtures(
  fixtures: readonly Fixture[],
  now: Date,
  modelledFixtureIds: ReadonlySet<string> = new Set(),
): TodayFunnel {
  const today = fixtures.filter(
    (fixture) => calendarDateInBogota(fixture.kickoffAt) === calendarDateInBogota(now),
  );
  const reasons = { ...EMPTY_REASONS };
  const horizonEnd = now.getTime() + MODEL_HORIZON_HOURS * 60 * 60 * 1000;
  let modelEnabled = 0;
  let withinModelHorizon = 0;
  let historyReady = 0;
  let aliasReady = 0;
  let marketWindow = 0;
  const rejectionExamples: { home: string; away: string; reason: TodayExclusionReason }[] = [];

  const record = (fixture: Fixture, reason: TodayExclusionReason): void => {
    reasons[reason] += 1;
    if (rejectionExamples.length < 3)
      rejectionExamples.push({ home: fixture.homeTeam, away: fixture.awayTeam, reason });
  };

  for (const fixture of today) {
    const leagueStatus = resolveLeagueStatus(fixture);
    if (leagueStatus === 'EXCLUDED') {
      record(fixture, 'UNSUPPORTED_LEAGUE');
      continue;
    }
    if (leagueStatus === 'OBSERVATION_ONLY') {
      record(fixture, 'OBSERVATION_ONLY');
      continue;
    }
    if (!isModelEnabled(fixture)) {
      record(fixture, 'NO_LONGER_ELIGIBLE');
      continue;
    }
    modelEnabled += 1;
    if (fixture.kickoffAt.getTime() <= now.getTime()) {
      record(fixture, 'MATCH_STARTED');
      continue;
    }
    if (fixture.kickoffAt.getTime() > horizonEnd) {
      record(fixture, 'OUTSIDE_MODEL_HORIZON');
      continue;
    }
    withinModelHorizon += 1;
    historyReady += 1;
    aliasReady += 1;
    if (modelledFixtureIds.has(fixture.id)) marketWindow += 1;
    else record(fixture, 'INSUFFICIENT_HISTORY');
  }

  const modelled = today.filter((fixture) => modelledFixtureIds.has(fixture.id)).length;
  const rejected = Object.values(reasons).reduce((sum, count) => sum + count, 0);
  return {
    raw: today.length,
    modelEnabled,
    historyReady,
    aliasReady,
    withinModelHorizon,
    modelled,
    preanalysis: modelled,
    marketWindow,
    marketAnalyzed: 0,
    started: reasons.MATCH_STARTED,
    expired: reasons.PREMATCH_WINDOW_CLOSED,
    rejected,
    modelable: today.length - rejected,
    rejectionBreakdown: reasons,
    rejectionExamples,
  };
}
