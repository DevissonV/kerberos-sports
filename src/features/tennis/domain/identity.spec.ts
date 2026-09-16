import {
  reconcileFixtures,
  resolveCanonicalPlayer,
  sourceQualifiedFixtureId,
  type PlayerCrosswalkRecord,
} from './identity';
import { TENNIS_SNAPSHOT_PLAN } from './snapshotPlan';

const at = new Date('2026-09-15T00:00:00Z');
const records: PlayerCrosswalkRecord[] = [
  {
    canonicalPlayerId: 'sackmann:WTA:211651',
    source: 'ODDSPAPI',
    sourcePlayerId: '133662',
    canonicalName: 'Paula Badosa',
    sourceName: 'Badosa, Paula',
    tour: 'WTA',
    validFrom: '2020-01-01T00:00:00Z',
    validTo: null,
  },
];

describe('crosswalk de tenis', () => {
  it('resuelve un ID de proveedor estable de forma exacta', () => {
    expect(
      resolveCanonicalPlayer(
        records,
        { source: 'ODDSPAPI', sourcePlayerId: '133662', tour: 'WTA' },
        at,
      ),
    ).toEqual({ status: 'RESOLVED', canonicalPlayerId: 'sackmann:WTA:211651' });
  });
  it('admite aliases sólo cuando fueron cargados como IDs exactos offline', () => {
    const aliases: PlayerCrosswalkRecord[] = [
      ...records,
      {
        ...records[0]!,
        source: 'LIVE_TENNIS',
        sourcePlayerId: '9001',
        sourceName: 'Paula Badosa Gibert',
      },
    ];
    expect(
      resolveCanonicalPlayer(
        aliases,
        { source: 'LIVE_TENNIS', sourcePlayerId: '9001', tour: 'WTA' },
        at,
      ).status,
    ).toBe('RESOLVED');
  });
  it('falla cerrado ante una colisión de IDs', () => {
    expect(
      resolveCanonicalPlayer(
        [...records, { ...records[0]!, canonicalPlayerId: 'sackmann:WTA:999999' }],
        { source: 'ODDSPAPI', sourcePlayerId: '133662', tour: 'WTA' },
        at,
      ),
    ).toEqual({ status: 'UNRESOLVED', reason: 'COLLISION' });
  });
});

describe('identidad de fixture y snapshots', () => {
  it('conserva el namespace y reconcilia sólo por IDs canónicos', () => {
    expect(sourceQualifiedFixtureId({ provider: 'ODDSPAPI', eventId: 'id120' })).toBe(
      'ODDSPAPI:id120',
    );
    expect(
      reconcileFixtures(
        {
          identity: { provider: 'ODDSPAPI', eventId: 'id120' },
          tour: 'WTA',
          scheduledAt: at,
          playerOneCanonicalId: 'a',
          playerTwoCanonicalId: 'b',
        },
        {
          identity: { provider: 'LIVE_TENNIS', eventId: '42' },
          tour: 'WTA',
          scheduledAt: new Date(at.getTime() + 60_000),
          playerOneCanonicalId: 'b',
          playerTwoCanonicalId: 'a',
        },
      ),
    ).toBe(true);
  });
  it('mantiene T-12 como snapshot primario y el resto en sombra', () => {
    expect(TENNIS_SNAPSHOT_PLAN).toEqual({
      primary: 'T-12',
      shadow: ['T-24', 'T-6', 'T-3', 'T-1'],
    });
  });
});
