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
  /**
   * Claim T-6 recuperable (PENDING/PROCESSING/COMPLETED con lease). true = esta
   * corrida puede procesar la decisión; false = ya completada o en curso por otra.
   */
  claimDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): boolean;
  /** Confirma la decisión registrada (idempotente). */
  completeDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): void;
  /** Libera un claim interrumpido para que el próximo tick reintente. */
  failDecisionSnapshot(cohortId: string, fixtureId: string, decisionAt: Date): void;
  dailyCounters(day: string): RefinementCounters;
  increment(day: string, delta: Partial<RefinementCounters>): RefinementCounters;
}
