import { formatRefinementHeartbeat } from './refinementHeartbeat';

describe('formatRefinementHeartbeat', () => {
  it('incluye el estado operativo del tick y errores resumidos', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      premierLeagueFixtures: 2,
      decisionWindowFixtures: 1,
      openBets: 0,
      error: 'BUDGET_GUARD',
      counters: {
        ticks: 1,
        precheckOnly: 0,
        eligibleFixtures: 2,
        decisionSnapshotsCaptured: 1,
        fullOddsScans: 1,
        oddsPapiRequests: 2,
        quantCandidates: 0,
        paperBetsCreated: 0,
        lunaCalls: 0,
        settlements: 0,
        errors: 0,
      },
    });
    expect(message).toContain('Refinamiento');
    expect(message).toContain('PL próximas: 2');
    expect(message).toContain('ERROR: BUDGET_GUARD');
  });
});
