import type { LunaOutput } from '../domain/contracts';

export interface LunaShadowRecord {
  cohortId: string;
  fixtureId: string;
  snapshotAt: Date;
  snapshotHash: string;
  snapshotVersion: string;
  promptVersion: string;
  modelVersion: string;
  pOver: number;
  pUnder: number;
  confidence: LunaOutput['confidence'];
  decision: LunaOutput['decision'];
  reasons: string[];
  riskFlags: string[];
  createdAt: Date;
}

export interface LunaShadowStore {
  findByCacheKey(key: string): LunaShadowRecord | null;
  save(record: LunaShadowRecord): void;
}
