export const REFINEMENT_STORE = Symbol('RefinementStore');

export interface RefinementCounters {
  ticks: number;
  precheckOnly: number;
  eligibleFixtures: number;
  decisionSnapshotsCaptured: number;
  fullOddsScans: number;
  oddsPapiRequests: number;
  quantCandidates: number;
  paperBetsCreated: number;
  lunaCalls: number;
  settlements: number;
  errors: number;
}

export interface RefinementStore {
  claimHeartbeat(tickId: string): boolean;
  claimDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): boolean;
  dailyCounters(day: string): RefinementCounters;
  increment(day: string, delta: Partial<RefinementCounters>): RefinementCounters;
}
