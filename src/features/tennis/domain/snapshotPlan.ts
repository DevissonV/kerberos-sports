/** Plan de observación; no selecciona ni emite PaperBets. */

export type TennisSnapshotPoint = 'T-24' | 'T-12' | 'T-6' | 'T-3' | 'T-1';

export interface TennisSnapshotPlan {
  primary: TennisSnapshotPoint;
  shadow: readonly TennisSnapshotPoint[];
}

export const TENNIS_SNAPSHOT_PLAN: TennisSnapshotPlan = {
  primary: 'T-12',
  shadow: ['T-24', 'T-6', 'T-3', 'T-1'],
};
