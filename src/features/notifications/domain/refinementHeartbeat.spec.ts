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
    expect(message).toContain('Partidos detectados: 6');
    expect(message).toContain('⚠️ Revisión con incidencia');
    expect(message).toContain('Detalle: BUDGET_GUARD');
    expect(message).not.toContain('snapshot');
    expect(message).not.toContain('full scan');
  });

  it('mantiene únicamente los contadores operativos', () => {
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
    expect(message).toContain('Partidos detectados: 5');
    expect(message).toContain('NO_BET: 0');
    expect(message).not.toContain('Oportunidades QUANT');
  });

  it('cuenta partidos aunque pertenezcan a ligas en observación', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [
        { leagueId: 94, status: 'OBSERVATION_ONLY', fixturesDetected: 3 },
        { leagueId: 144, status: 'OBSERVATION_ONLY', fixturesDetected: 4 },
      ],
      counters: {
        ticks: 1,
        precheckOnly: 0,
        eligibleFixtures: 0,
        decisionSnapshotsCaptured: 0,
        fullOddsScans: 0,
        oddsPapiRequests: 0,
        quantCandidates: 0,
        paperBetsCreated: 0,
        lunaCalls: 0,
        settlements: 0,
        errors: 0,
      },
    });
    expect(message).toContain('Partidos detectados: 7');
  });

  it('muestra el radar en lenguaje humano sin enums técnicos', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      radar: [
        {
          home: 'Málaga',
          away: 'Villarreal',
          selection: 'MENOS DE 2.5 GOLES',
          explanation: 'Entre los dos equipos deben marcar 2 goles o menos.',
          probability: 0.586,
        },
      ],
      counters: {
        ticks: 1,
        precheckOnly: 1,
        eligibleFixtures: 1,
        decisionSnapshotsCaptured: 0,
        fullOddsScans: 0,
        oddsPapiRequests: 0,
        quantCandidates: 0,
        paperBetsCreated: 0,
        lunaCalls: 0,
        settlements: 0,
        errors: 0,
      },
    });
    expect(message).toContain('MENOS DE 2.5 GOLES');
    expect(message).toContain('Entre los dos equipos deben marcar 2 goles o menos.');
    expect(message).not.toMatch(/\bUNDER\b|\bOVER\b/);
  });
});
