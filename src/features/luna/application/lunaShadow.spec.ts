import { buildLunaSnapshot, lunaSnapshotHash } from '../domain/snapshot';
import {
  LUNA_MODEL_VERSION,
  LUNA_PROMPT_VERSION,
  type LunaInput,
  type LunaOutput,
} from '../domain/contracts';
import { runLunaShadow, selectLunaShortlist, type LunaShortlistEntry } from './lunaShadow';
import type { ScanCandidate } from '../../scanning/application/scanPipeline';
import type { LunaShadowRecord, LunaShadowStore } from '../ports/lunaShadowStore';

const now = new Date('2026-09-20T14:00:00Z');

function entry(id: string, ev: number): LunaShortlistEntry {
  const fixture = {
    id,
    sport: 'FOOTBALL' as const,
    league: 'Premier League',
    leagueId: 39,
    country: 'England',
    homeTeam: `Home ${id}`,
    awayTeam: `Away ${id}`,
    kickoffAt: new Date('2026-09-20T19:00:00Z'),
    status: 'NS',
  };
  return {
    expectedValue: ev,
    candidate: {
      fixture,
      pair: undefined,
      pairs: [],
      fairOverProbability: 0.5,
      fairUnderProbability: 0.5,
      model: 'NOT_YET_AVAILABLE',
      edge: 0,
      decision: 'NO_BET_PIPELINE_ONLY',
      kickoffAt: fixture.kickoffAt,
      decisionAt: now,
      snapshotAt: now,
    } as unknown as ScanCandidate,
  };
}

class MemoryStore implements LunaShadowStore {
  records = new Map<string, LunaShadowRecord>();
  findByCacheKey(key: string): LunaShadowRecord | null {
    return this.records.get(key) ?? null;
  }
  save(record: LunaShadowRecord): void {
    this.records.set(
      [
        record.fixtureId,
        record.snapshotVersion,
        record.snapshotHash,
        record.promptVersion,
        record.modelVersion,
      ].join(':'),
      record,
    );
  }
}

describe('Luna shadow', () => {
  it('selecciona máximo cinco por EV descendente', () => {
    const selected = selectLunaShortlist(
      Array.from({ length: 7 }, (_, i) => entry(String(i), i / 10)),
    );
    expect(selected.map((item) => item.expectedValue)).toEqual([0.6, 0.5, 0.4, 0.3, 0.2]);
  });

  it('payload es ciego a odds y QUANT y snapshot es causal', () => {
    const snapshot = buildLunaSnapshot(entry('1', 0.5).candidate.fixture, now);
    const serialized = JSON.stringify(snapshot).toLowerCase();
    expect(serialized).not.toMatch(/odds|bookmaker|quant|edge|ev|lambda|fairmarket|poisson/);
    expect(snapshot.snapshotAt).toBe(now.toISOString());
    expect(snapshot.context.verifiedFacts).toEqual([]);
    expect(lunaSnapshotHash(snapshot)).toHaveLength(64);
  });

  it('valida salida, persiste INSUFFICIENT_DATA y no llama dos veces con mismo snapshot', async () => {
    const store = new MemoryStore();
    let calls = 0;
    const infer = {
      infer: (input: LunaInput): Promise<LunaOutput> => {
        calls += 1;
        return Promise.resolve({
          modelVersion: LUNA_MODEL_VERSION,
          fixtureId: input.fixture.fixtureId,
          market: 'OVER_UNDER_2_5',
          pOver: 0.5,
          pUnder: 0.5,
          confidence: 'low',
          decision: 'INSUFFICIENT_DATA',
          reasons: ['sin datos'],
          riskFlags: [],
          snapshotAt: input.snapshotAt,
        });
      },
    };
    const deps = { shortlist: [entry('1', 0.5)], infer, store, now };
    const first = await runLunaShadow(deps);
    const second = await runLunaShadow(deps);
    expect(first.records[0]?.decision).toBe('INSUFFICIENT_DATA');
    expect(first.evaluated).toBe(1);
    expect(second.cacheHits).toBe(1);
    expect(calls).toBe(1);
    expect(first.records[0]?.promptVersion).toBe(LUNA_PROMPT_VERSION);
  });

  it('fail-open para JSON inválido: persiste LUNA_INVALID_OUTPUT sin lanzar', async () => {
    const store = new MemoryStore();
    let calls = 0;
    const result = await runLunaShadow({
      shortlist: [entry('2', 0.4)],
      infer: {
        infer: () => {
          calls += 1;
          return Promise.resolve('{bad json');
        },
      },
      store,
      now,
    });
    expect(result.invalidOutputs).toBe(1);
    expect(result.records[0]?.riskFlags).toContain('LUNA_INVALID_OUTPUT');
    expect(calls).toBe(2);
  });
});
