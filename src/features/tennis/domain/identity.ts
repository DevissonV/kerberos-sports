/** Identidades deterministas para TENNIS; los nombres son sólo trazabilidad offline. */

export type TennisTour = 'ATP' | 'WTA';
export type TennisPlayerSource = 'SACKMANN' | 'LIVE_TENNIS' | 'ODDSPAPI';

export interface PlayerCrosswalkRecord {
  canonicalPlayerId: string;
  source: TennisPlayerSource;
  sourcePlayerId: string;
  canonicalName: string;
  sourceName: string;
  tour: TennisTour;
  validFrom: string;
  validTo: string | null;
}

export interface PlayerReference {
  source: TennisPlayerSource;
  sourcePlayerId: string;
  tour: TennisTour;
}

export type PlayerResolution =
  | { status: 'RESOLVED'; canonicalPlayerId: string }
  | { status: 'UNRESOLVED'; reason: 'MISSING' | 'COLLISION' | 'INACTIVE' };

/** Resuelve exclusivamente por ID de proveedor y tour; nunca por nombre. */
export function resolveCanonicalPlayer(
  records: readonly PlayerCrosswalkRecord[],
  reference: PlayerReference,
  at: Date,
): PlayerResolution {
  const active = records.filter(
    (record) =>
      record.source === reference.source &&
      record.sourcePlayerId === reference.sourcePlayerId &&
      record.tour === reference.tour &&
      record.validFrom <= at.toISOString() &&
      (record.validTo === null || record.validTo >= at.toISOString()),
  );
  if (active.length === 0) {
    const known = records.some(
      (record) =>
        record.source === reference.source &&
        record.sourcePlayerId === reference.sourcePlayerId &&
        record.tour === reference.tour,
    );
    return { status: 'UNRESOLVED', reason: known ? 'INACTIVE' : 'MISSING' };
  }
  const canonicalIds = new Set(active.map((record) => record.canonicalPlayerId));
  if (canonicalIds.size !== 1) return { status: 'UNRESOLVED', reason: 'COLLISION' };
  return { status: 'RESOLVED', canonicalPlayerId: active[0]!.canonicalPlayerId };
}

export type TennisFixtureProvider = 'LIVE_TENNIS' | 'ODDSPAPI';

export interface SourceFixtureIdentity {
  provider: TennisFixtureProvider;
  eventId: string;
}

/** La identidad primaria siempre conserva su namespace de proveedor. */
export function sourceQualifiedFixtureId(identity: SourceFixtureIdentity): string {
  if (identity.eventId.trim() === '') throw new Error('eventId de tenis vacío');
  return `${identity.provider}:${identity.eventId}`;
}

export interface ResolvedFixture {
  identity: SourceFixtureIdentity;
  scheduledAt: Date;
  tour: TennisTour;
  playerOneCanonicalId: string;
  playerTwoCanonicalId: string;
}

/** Reconciliación conservadora por IDs canónicos, tour y hora; nunca por nombre. */
export function reconcileFixtures(
  left: ResolvedFixture,
  right: ResolvedFixture,
  maximumScheduledDriftMs = 2 * 60 * 60 * 1000,
): boolean {
  if (left.identity.provider === right.identity.provider || left.tour !== right.tour) return false;
  if (Math.abs(left.scheduledAt.getTime() - right.scheduledAt.getTime()) > maximumScheduledDriftMs)
    return false;
  const sameOrder =
    left.playerOneCanonicalId === right.playerOneCanonicalId &&
    left.playerTwoCanonicalId === right.playerTwoCanonicalId;
  const reversedOrder =
    left.playerOneCanonicalId === right.playerTwoCanonicalId &&
    left.playerTwoCanonicalId === right.playerOneCanonicalId;
  return sameOrder || reversedOrder;
}
