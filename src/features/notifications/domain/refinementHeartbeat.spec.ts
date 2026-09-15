import { formatRefinementHeartbeat } from './refinementHeartbeat';

describe('formatRefinementHeartbeat', () => {
  it('usa un formato humano para un tick con error', () => {
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
    expect(message).toContain('⚽ KERBEROS SPORTS');
    expect(message).toContain('• Partidos PL detectados: 2');
    expect(message).toContain('🔴 Estado: Error');
    expect(message).toContain('Detalle: BUDGET_GUARD');
    expect(message).not.toContain('snapshot');
    expect(message).not.toContain('full scan');
  });

  it('explica un tick vacío y un tick con oportunidades', () => {
    const base = {
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 1,
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
    expect(
      formatRefinementHeartbeat({ ...base, premierLeagueFixtures: 0, decisionWindowFixtures: 0 }),
    ).toContain(
      'No hay partidos de Premier League dentro de la ventana de análisis en este momento.',
    );
    expect(
      formatRefinementHeartbeat({
        ...base,
        premierLeagueFixtures: 2,
        decisionWindowFixtures: 1,
        counters: { ...base.counters, quantCandidates: 0 },
      }),
    ).toContain(
      'Kerberos analizó 1 partido(s), pero ninguno cumple los criterios mínimos de edge/EV.',
    );
    expect(
      formatRefinementHeartbeat({ ...base, premierLeagueFixtures: 2, decisionWindowFixtures: 1 }),
    ).toContain('Kerberos encontró 1 posible(s) oportunidad(es) y continúa la evaluación.');
  });
});
