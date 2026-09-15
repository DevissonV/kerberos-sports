import { formatRefinementHeartbeat } from './refinementHeartbeat';

describe('formatRefinementHeartbeat', () => {
  it('usa un formato humano para un tick con error', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      byLeague: [
        { leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 2 },
        { leagueId: 239, status: 'OBSERVATION_ONLY', fixturesDetected: 4 },
      ],
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
    expect(message).toContain('⚽ KERBEROS SPORTS');
    expect(message).toContain('🇬🇧 Premier League: 2');
    expect(message).toContain('🇨🇴 Liga BetPlay: 4');
    expect(message).toContain('🔴 Estado: Error');
    expect(message).toContain('Detalle: BUDGET_GUARD');
    expect(message).not.toContain('snapshot');
    expect(message).not.toContain('full scan');
  });

  it('agrupa por liga, no muestra IDs técnicos y separa modelo/observación', () => {
    const base = {
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 1,
      byLeague: [
        { leagueId: 39, status: 'MODEL_ENABLED' as const, fixturesDetected: 0 },
        { leagueId: 140, status: 'OBSERVATION_ONLY' as const, fixturesDetected: 3 },
        { leagueId: 135, status: 'OBSERVATION_ONLY' as const, fixturesDetected: 2 },
      ],
      counters: {
        ticks: 1,
        precheckOnly: 0,
        eligibleFixtures: 0,
        decisionSnapshotsCaptured: 0,
        fullOddsScans: 1,
        oddsPapiRequests: 2,
        quantCandidates: 1,
        paperBetsCreated: 1,
        lunaCalls: 1,
        settlements: 0,
        errors: 0,
      },
    };
    const message = formatRefinementHeartbeat(base);
    expect(message).toContain('🇬🇧 Premier League: 0');
    expect(message).toContain('🇪🇸 LaLiga: 3');
    expect(message).toContain('🇮🇹 Serie A: 2');
    expect(message).toContain('👀 En observación:');
    expect(message).toContain('5 partidos');
    expect(message).toContain('🎯 Oportunidades QUANT: 1');
    expect(message).toContain('🧪 Paper Bets nuevas: 1');
    expect(message).toContain('🌙 Luna utilizada: Sí');
    expect(message).not.toMatch(/leagueId|39|140|135/);
  });
});
