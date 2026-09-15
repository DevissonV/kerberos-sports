import { createHash } from 'node:crypto';
import type { Fixture } from '../../scanning/domain/concepts';
import { LUNA_SNAPSHOT_VERSION, lunaInputSchema, type LunaInput } from './contracts';

/** Construye únicamente el contexto verificable que existía al tomar el snapshot. */
export function buildLunaSnapshot(fixture: Fixture, snapshotAt: Date): LunaInput {
  return lunaInputSchema.parse({
    snapshotVersion: LUNA_SNAPSHOT_VERSION,
    fixture: {
      fixtureId: fixture.id,
      league: 'Premier League',
      kickoffAt: fixture.kickoffAt.toISOString(),
      home: fixture.homeTeam,
      away: fixture.awayTeam,
    },
    // No hay proveedor causal de noticias, lesiones o alineaciones en esta versión.
    context: { verifiedFacts: [] },
    snapshotAt: snapshotAt.toISOString(),
  });
}

export function lunaSnapshotHash(snapshot: LunaInput): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
