import { formatRefinementHeartbeat } from './refinementHeartbeat';

const BASE_COUNTERS = {
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
};

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
        ...BASE_COUNTERS,
        eligibleFixtures: 2,
        decisionSnapshotsCaptured: 1,
        fullOddsScans: 1,
        oddsPapiRequests: 2,
      },
    });
    expect(message).toContain('⚽ KERBEROS SPORTS');
    expect(message).toContain('🔎 6 partidos detectados · 👀 0 en preanálisis');
    expect(message).toContain('⚠️ Revisión con incidencia');
    expect(message).toContain('Detalle: BUDGET_GUARD');
    expect(message).not.toContain('snapshot');
    expect(message).not.toContain('full scan');
  });

  it('mantiene únicamente los contadores operativos', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 1,
      byLeague: [
        { leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 0 },
        { leagueId: 140, status: 'OBSERVATION_ONLY', fixturesDetected: 3 },
        { leagueId: 135, status: 'OBSERVATION_ONLY', fixturesDetected: 2 },
      ],
      counters: {
        ...BASE_COUNTERS,
        fullOddsScans: 1,
        oddsPapiRequests: 2,
        quantCandidates: 1,
        paperBetsCreated: 1,
        lunaCalls: 1,
      },
    });
    expect(message).toContain('🔎 5 partidos detectados · 👀 0 en preanálisis');
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
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('🔎 7 partidos detectados · 👀 0 en preanálisis');
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
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          probability: 0.586,
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
        },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('MENOS DE 2.5 GOLES');
    expect(message).toContain('💡 Máximo 2 goles');
    expect(message).not.toMatch(/\bUNDER\b|\bOVER\b/);
  });

  it('formatea un solo partido en un único bloque con separador y advertencia final', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      preAnalysisCount: 1,
      radar: [
        {
          home: 'Málaga',
          away: 'Villarreal',
          selection: 'MENOS DE 2.5 GOLES',
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          probability: 0.586,
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
        },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('1️⃣ Málaga vs Villarreal');
    expect(message).not.toContain('─────────────');
    expect(message).toContain('📅 17 Sep · 2:30 p. m.');
    expect(message).toContain('👀 Preanálisis · Seguimiento activo');
    const warningMatches = message.match(/Todavía no son apuestas aprobadas\./g) ?? [];
    expect(warningMatches).toHaveLength(1);
    expect(message).not.toContain('NO APOSTAR TODAVÍA');
  });

  it('ordena varios partidos por kickoff ascendente y separa cada bloque', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 2 }],
      preAnalysisCount: 2,
      radar: [
        {
          home: 'Groningen',
          away: 'PEC Zwolle',
          selection: 'MÁS DE 2.5 GOLES',
          shortHint: 'Necesitamos 3+ goles',
          marketEmoji: '🟢',
          probability: 0.658,
          kickoffAt: new Date('2026-09-18T18:00:00Z'),
        },
        {
          home: 'Málaga',
          away: 'Villarreal',
          selection: 'MENOS DE 2.5 GOLES',
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          probability: 0.586,
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
        },
      ],
      counters: BASE_COUNTERS,
    });
    const maligaIndex = message.indexOf('Málaga vs Villarreal');
    const groningenIndex = message.indexOf('Groningen vs PEC Zwolle');
    expect(maligaIndex).toBeGreaterThan(-1);
    expect(groningenIndex).toBeGreaterThan(maligaIndex);
    expect(message).toContain('1️⃣ Málaga vs Villarreal');
    expect(message).toContain('2️⃣ Groningen vs PEC Zwolle');
    expect(message).toContain('─────────────');
  });

  it('usa orden alfabético estable cuando el kickoff es idéntico', () => {
    const sameKickoff = new Date('2026-09-17T19:30:00Z');
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 2 }],
      preAnalysisCount: 2,
      radar: [
        {
          home: 'Villarreal',
          away: 'Getafe',
          selection: 'MÁS DE 2.5 GOLES',
          shortHint: 'Necesitamos 3+ goles',
          marketEmoji: '🟢',
          probability: 0.6,
          kickoffAt: sameKickoff,
        },
        {
          home: 'Alavés',
          away: 'Elche',
          selection: 'MENOS DE 2.5 GOLES',
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          probability: 0.55,
          kickoffAt: sameKickoff,
        },
      ],
      counters: BASE_COUNTERS,
    });
    const alavesIndex = message.indexOf('Alavés vs Elche');
    const villarrealIndex = message.indexOf('Villarreal vs Getafe');
    expect(alavesIndex).toBeGreaterThan(-1);
    expect(villarrealIndex).toBeGreaterThan(alavesIndex);
  });

  it('muestra Esperando cuotas solo cuando el dato real lo indica', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      preAnalysisCount: 1,
      radar: [
        {
          home: 'Málaga',
          away: 'Villarreal',
          selection: 'MENOS DE 2.5 GOLES',
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          probability: 0.586,
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
          noOdds: true,
        },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('👀 Preanálisis · Esperando cuotas');
    expect(message).not.toContain('Seguimiento activo');
  });

  it('muestra el resumen superior con el conteo real de detectados y preanálisis', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 11 }],
      preAnalysisCount: 2,
      bets: 0,
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('🔎 11 partidos detectados · 👀 2 en preanálisis');
    expect(message).toContain('🎯 0 apuestas aprobadas');
  });

  it('no muestra advertencia final ni sección de radar cuando no hay partidos en preanálisis', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 0 }],
      counters: BASE_COUNTERS,
    });
    expect(message).not.toContain('PARTIDOS A SEGUIR');
    expect(message).not.toContain('Todavía no son apuestas aprobadas');
    expect(message).toContain('🟢 Sistema funcionando');
  });

  it('muestra el cierre de un preanálisis previo sin convertirlo en apuesta', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-17T21:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      counters: BASE_COUNTERS,
      closedFollowups: [
        {
          home: 'Málaga',
          away: 'Villarreal',
          selection: 'MENOS DE 2.5 GOLES',
          probability: 0.586,
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
          reason: 'Partido iniciado / ventana prepartido cerrada',
        },
      ],
    });
    expect(message).toContain('⏱️ Seguimiento cerrado');
    expect(message).toContain('Preanálisis previo: 58.6%');
    expect(message).toContain('Partido iniciado / ventana prepartido cerrada');
    expect(message).not.toContain('apuesta aprobada');
  });
});
