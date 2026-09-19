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
    expect(message).toContain('Detectados: 6');
    expect(message).toContain('✅ Revisión completada');
    expect(message).toContain('⚠️ Límite de consultas alcanzado temporalmente');
    expect(message).not.toContain('BUDGET_GUARD');
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
    expect(message).toContain('Detectados: 5');
    expect(message).not.toContain('NO_BET');
    expect(message).not.toContain('Oportunidades QUANT');
  });

  it('muestra el próximo T-6 dentro del heartbeat único', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T08:30:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      nextT6: {
        home: 'Arsenal',
        away: 'Chelsea',
        league: 'Premier League',
        country: 'England',
        kickoffAt: new Date('2026-09-15T16:30:00Z'),
        decisionAt: new Date('2026-09-15T10:30:00Z'),
      },
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('⏭ PRÓXIMA EVALUACIÓN');
    expect(message).toContain('Arsenal vs Chelsea');
    expect(message).toContain('🏆 Premier League');
    expect(message).toContain('⏳ Evaluación de mercado a las: 15 Sep 2026 · 5:30 a. m.');
    expect(message).toContain('📅 15 Sep 2026 · 🕐 11:30 a. m.');
    expect(message).not.toContain('NEXT_T6');
    expect(message).not.toContain('fixtureId');
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
    expect(message).toContain('Detectados: 7');
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
          league: 'Premier League',
          country: 'England',
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
          league: 'Premier League',
          country: 'England',
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
        },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('⚽ Málaga vs Villarreal');
    expect(message).not.toContain('─────────────');
    expect(message).toContain('📅 17 Sep 2026 · 🕐 2:30 p. m.');
    expect(message).toContain('🧠 PREANÁLISIS LISTO');
    const warningMatches = message.match(/Todavía no hay apuestas aprobadas\./g) ?? [];
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
          league: 'Premier League',
          country: 'England',
          kickoffAt: new Date('2026-09-18T18:00:00Z'),
        },
        {
          home: 'Málaga',
          away: 'Villarreal',
          selection: 'MENOS DE 2.5 GOLES',
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          probability: 0.586,
          league: 'Premier League',
          country: 'England',
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
        },
      ],
      counters: BASE_COUNTERS,
    });
    const maligaIndex = message.indexOf('Málaga vs Villarreal');
    const groningenIndex = message.indexOf('Groningen vs PEC Zwolle');
    expect(maligaIndex).toBeGreaterThan(-1);
    expect(groningenIndex).toBeGreaterThan(maligaIndex);
    expect(message).toContain('⚽ Málaga vs Villarreal');
    expect(message).toContain('⚽ Groningen vs PEC Zwolle');
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
          league: 'Premier League',
          probability: 0.6,
          kickoffAt: sameKickoff,
        },
        {
          home: 'Alavés',
          away: 'Elche',
          selection: 'MENOS DE 2.5 GOLES',
          shortHint: 'Máximo 2 goles',
          marketEmoji: '🔵',
          league: 'Premier League',
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
          league: 'Premier League',
          country: 'England',
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
          noOdds: true,
        },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('💰 SIN CUOTAS · pendiente de cuotas válidas');
    expect(message).not.toContain('PREANÁLISIS LISTO');
  });

  it('presenta descartes de hoy en bloques humanos y conserva el conteo', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-17T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 3 }],
      todayRejected: 3,
      todayRejectionExamples: [
        { home: 'Real Betis', away: 'Getafe', reason: 'MATCH_STARTED' },
        { home: 'Málaga', away: 'Villarreal', reason: 'PREMATCH_WINDOW_CLOSED' },
        { home: 'Bucaramanga', away: 'Medellín', reason: 'OBSERVATION_ONLY' },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('ℹ️ FUERA DE SEGUIMIENTO HOY');
    expect(message).toContain('⚽ Real Betis vs Getafe');
    expect(message).toContain('  ⏱️ Partido ya iniciado');
    expect(message).toContain('⚽ Málaga vs Villarreal');
    expect(message).toContain('  ⏱️ Ventana prepartido cerrada');
    expect(message).toContain('⚽ Bucaramanga vs Medellín');
    expect(message).toContain('  👀 Liga todavía no habilitada para modelado');
    expect(message).not.toContain('MATCH_STARTED');
    expect(message).not.toContain('OBSERVATION_ONLY');
  });

  it('limita ejemplos y conserva los descartes adicionales', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-17T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 8 }],
      todayRejected: 8,
      todayRejectionExamples: Array.from({ length: 8 }, (_, index) => ({
        home: `Home ${index}`,
        away: `Away ${index}`,
        reason: 'INSUFFICIENT_HISTORY',
      })),
      counters: BASE_COUNTERS,
    });
    expect((message.match(/📊 Historial insuficiente/g) ?? []).length).toBe(3);
    expect(message).toContain('• +5 descartes adicionales');
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
    expect(message).toContain('Detectados: 11');
    expect(message).toContain('Modelados: 2');
    expect(message).toContain('🎯 Apuestas autorizadas: 0');
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
    expect(message).toContain('⚠️ Todavía no hay apuestas aprobadas.');
  });

  it('no repite seguimientos cerrados en el heartbeat', () => {
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
          league: 'Premier League',
          country: 'England',
          kickoffAt: new Date('2026-09-17T19:30:00Z'),
          reason: 'Partido iniciado / ventana prepartido cerrada',
        },
      ],
    });
    expect(message).toContain('🏁 SEGUIMIENTO CERRADO');
    expect(message).not.toContain('⏱️ Seguimiento cerrado');
    expect(message).toContain('Partido iniciado / ventana prepartido cerrada');
  });

  it('oculta contadores en cero y muestra los que tienen valor', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      bets: 0,
      noBets: 2,
      oddsUnavailable: 1,
      insufficientData: 1,
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('⚪ EVALUADOS — NO APOSTAR');
    expect(message).toContain('💰 Sin cuotas: 1');
    expect(message).toContain('📊 Datos insuficientes: 1');
    expect(message).not.toContain('NO_BET:');
  });

  it('prioriza hoy, usa America/Bogota y conserva la probabilidad recibida', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-18T12:00:00Z'),
      openBets: 0,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 2 }],
      radar: [
        {
          home: 'Mañana',
          away: 'Visitante',
          selection: 'MÁS DE 2.5 GOLES',
          league: 'Premier League',
          probability: 0.591,
          kickoffAt: new Date('2026-09-19T12:00:00Z'),
        },
        {
          home: 'Hoy',
          away: 'Local',
          selection: 'MENOS DE 2.5 GOLES',
          league: 'Premier League',
          probability: 0.546,
          kickoffAt: new Date('2026-09-18T18:00:00Z'),
        },
      ],
      counters: BASE_COUNTERS,
    });
    expect(message.indexOf('Hoy vs Local')).toBeLessThan(message.indexOf('Mañana vs Visitante'));
    expect(message).toContain('📅 18 Sep 2026 · 🕐 1:00 p. m.');
    expect(message).toContain('🧠 Probabilidad Kerberos: 54.6%');
  });

  it('destaca una apuesta aprobada sin recalcular sus datos', () => {
    const message = formatRefinementHeartbeat({
      now: new Date('2026-09-15T12:00:00Z'),
      openBets: 1,
      bets: 1,
      approvedBets: [
        {
          home: 'Bayern München',
          away: 'Union Berlin',
          selection: 'OVER_2_5',
          league: 'Bundesliga',
          modelProbability: 0.624,
          offeredOdds: 1.91,
          minimumAcceptableOdds: 1.72,
          edge: 0.062,
          expectedValue: 0.184,
          riskGate: 'APROBADO',
          stakeCop: 10_000,
        },
      ],
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      counters: BASE_COUNTERS,
    });
    expect(message).toContain('🎯 LISTA PARA EJECUCIÓN');
    expect(message).toContain('🧠 Probabilidad Kerberos: 62.4%');
    expect(message).toContain('💰 Cuota actual: 1.91');
    expect(message).toContain('🎯 Cuota mínima: 1.72');
    expect(message).toContain('📈 Edge: +6.2 pp');
    expect(message).toContain('💵 EV: +18.4%');
    expect(message).toContain('🛡️ Risk Gate: APROBADO');
    expect(message).toContain('💰 Stake autorizado: 10.000 COP');
    expect(message).not.toContain('Todavía no hay apuestas aprobadas');
  });
});
