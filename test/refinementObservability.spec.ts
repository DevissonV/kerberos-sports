jest.mock('@nestjs/common', () => ({
  Inject: () => () => undefined,
  Injectable: () => (target: unknown) => target,
  Optional: () => () => undefined,
}));

import {
  RefinementService,
  renderRefinementTick,
} from '../src/features/quant/application/refinementService';
import { SqliteRefinementStore } from '../src/features/quant/adapters/sqliteRefinementStore';
import type { RefinementStore } from '../src/features/quant/ports/refinementStore';

const NOW = new Date('2026-09-15T16:30:12.000Z');

function makeDeps(overrides: Record<string, unknown> = {}) {
  const store = new SqliteRefinementStore(':memory:');
  const notifications = { send: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined) };
  let oddsRequests = 0;
  const scanning = {
    oddsPapiRequests: () => oddsRequests,
    apiFootballRequests: () => 0,
    precheck: () =>
      Promise.resolve({
        rawFixtures: 0,
        eligibleFixtures: 0,
        observationFixtures: 0,
        fixtures: [],
        decisionWindowFixtures: [],
        byLeague: [],
      }),
  };
  const settlement = {
    apiFootballRequests: () => 0,
    settleOpenBets: () => Promise.resolve({ settled: 0, telegramSent: 0 }),
  };
  const bets = { listByStatus: () => [] };
  const quant = {
    runScanForFixtures: () => {
      oddsRequests += 3;
      return Promise.resolve({
        paperBetsCreated: 2,
        telegramSent: 2,
        result: { poissonModeled: 1, quantCandidates: 1 },
        luna: { selected: 1, apiCalls: 1, cacheHits: 0 },
      });
    },
  };
  const merge = (base: object, override: unknown): object =>
    typeof override === 'object' && override !== null ? { ...base, ...override } : base;
  return {
    service: new RefinementService(
      merge(scanning, overrides.scanning) as never,
      merge(quant, overrides.quant) as never,
      merge(settlement, overrides.settlement) as never,
      merge(bets, overrides.bets) as never,
      (overrides.refinementStore as RefinementStore | undefined) ?? store,
      merge(notifications, overrides.notifications) as never,
    ),
    store,
    notifications,
  };
}

describe('observabilidad de REFINEMENT_MODE', () => {
  let stdout: jest.SpyInstance;

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => stdout.mockRestore());

  it('emite todos los campos en un tick vacío y conserva ceros reales', async () => {
    const { service } = makeDeps();
    const summary = await service.runTick(
      { refinementMode: true, maxOddsPapiFullScansPerDay: 2 },
      NOW,
    );
    const calls = stdout.mock.calls as unknown[][];
    const output = String(calls[0]?.[0]);
    expect(summary.status).toBe('OK');
    expect(output).toContain('[KSS_REFINEMENT_TICK]');
    for (const field of [
      'rawFixtures=0',
      'eligibleFixtures=0',
      'observationFixtures=0',
      'decisionWindowFixtures=0',
      'DISCOVERED_FIXTURES=0',
      'OBSERVATION_FIXTURES=0',
      'MODEL_ENABLED_FIXTURES=0',
      'fullOddsScans=0',
      'oddsPapiRequests=0',
      'poissonModeled=0',
      'quantCandidates=0',
      'paperBetsCreated=0',
      'lunaCalls=0',
      'settlements=0',
      'telegramHeartbeatSent=true',
      'status=OK',
    ])
      expect(output).toContain(field);
    expect(output).not.toMatch(
      /API_FOOTBALL_KEY|ODDSPAPI_KEY|TELEGRAM_BOT_TOKEN|OPENAI_COMPATIBLE_API_KEY/,
    );
  });

  it('mide full scan, OddsPapi, Luna y PaperBet del tick', async () => {
    const { service } = makeDeps({
      scanning: {
        precheck: () =>
          Promise.resolve({
            rawFixtures: 2,
            eligibleFixtures: 1,
            observationFixtures: 1,
            fixtures: [],
            decisionWindowFixtures: [
              {
                fixture: { id: 'f1' },
                decisionAt: NOW,
                needsSnapshot: true,
              },
            ],
            byLeague: [
              {
                leagueId: 39,
                canonicalName: 'Premier League',
                status: 'MODEL_ENABLED',
                fixturesDetected: 1,
              },
              {
                leagueId: 239,
                canonicalName: 'Liga BetPlay',
                status: 'OBSERVATION_ONLY',
                fixturesDetected: 1,
              },
            ],
          }),
      },
    });
    const summary = await service.runTick(
      { refinementMode: true, maxOddsPapiFullScansPerDay: 2 },
      NOW,
    );
    expect(summary).toMatchObject({
      rawFixtures: 2,
      eligibleFixtures: 1,
      observationFixtures: 1,
      decisionWindowFixtures: 1,
      fullOddsScans: 1,
      oddsPapiRequests: 3,
      poissonModeled: 1,
      quantCandidates: 1,
      paperBetsCreated: 2,
      lunaSelected: 1,
      lunaCalls: 1,
    });
    const modelEnabledLeague = summary.byLeague.find((entry) => entry.status === 'MODEL_ENABLED');
    const observationLeague = summary.byLeague.find((entry) => entry.status === 'OBSERVATION_ONLY');
    expect(modelEnabledLeague).toMatchObject({
      league: 'Premier League',
      fixturesDetected: 1,
      modelEligible: 1,
      oddsRequested: 3,
      quantCandidates: 1,
      paperBets: 2,
    });
    expect(observationLeague).toMatchObject({
      league: 'Liga BetPlay',
      fixturesDetected: 1,
      modelEligible: 0,
      oddsRequested: 0,
      quantCandidates: 0,
      paperBets: 0,
    });
  });

  it('permite refinamiento T-6 aunque el presupuesto de full scans esté agotado', async () => {
    const { service, store, notifications } = makeDeps({
      scanning: {
        precheck: () =>
          Promise.resolve({
            rawFixtures: 12,
            supportedLeagueFixtures: 12,
            eligibleFixtures: 12,
            observationFixtures: 0,
            fixtures: [],
            decisionWindowFixtures: Array.from({ length: 12 }, (_, index) => ({
              fixture: {
                id: `f${index}`,
                leagueId: 39,
                kickoffAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000),
              },
              decisionAt: NOW,
              needsSnapshot: true,
            })),
            byLeague: [
              {
                leagueId: 39,
                canonicalName: 'Premier League',
                status: 'MODEL_ENABLED',
                fixturesDetected: 12,
              },
            ],
          }),
      },
    });
    store.increment('2026-09-15', { fullOddsScans: 2 });

    const summary = await service.runTick(
      { refinementMode: true, maxOddsPapiFullScansPerDay: 2 },
      NOW,
    );

    expect(summary).toMatchObject({
      budgetGuardType: 'INTERNAL_DAILY_FULL_ODDS_SCANS',
      budgetProvider: 'OddsPapi',
      budgetLimit: 2,
      budgetCurrentUsage: 2,
      budgetRemaining: 0,
      budgetBlocked: 0,
      fullOddsScans: 0,
      marketAnalysisAttempted: 12,
      marketAnalysisCompleted: 12,
      paperBetsCreated: 2,
    });
    expect(notifications.send).toHaveBeenCalled();
  });

  it('es fail-open si Telegram falla y no duplica heartbeat en el mismo tick', async () => {
    const send = jest.fn<Promise<void>, [string]>().mockRejectedValue(new Error('Telegram caído'));
    const { service } = makeDeps({ notifications: { send } });
    const first = await service.runTick(
      { refinementMode: true, maxOddsPapiFullScansPerDay: 2 },
      NOW,
    );
    const second = await service.runTick(
      { refinementMode: true, maxOddsPapiFullScansPerDay: 2 },
      NOW,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(first.telegramHeartbeatSent).toBe(false);
    expect(first.status).toBe('PARTIAL');
    expect(second.telegramHeartbeatSent).toBe(false);
  });

  it('expone settlements y mensajes de settlement medidos por el servicio', async () => {
    const { service } = makeDeps({
      settlement: {
        settleOpenBets: () => Promise.resolve({ settled: 2, telegramSent: 1 }),
      },
    });
    const summary = await service.runTick(
      { refinementMode: true, maxOddsPapiFullScansPerDay: 2 },
      NOW,
    );
    expect(summary.settlements).toBe(2);
    expect(summary.telegramSettlementMessages).toBe(1);
  });

  it('renderiza settlement y mensajes Telegram sin incluir secretos', () => {
    const output = renderRefinementTick({
      timestamp: NOW.toISOString(),
      cohort: 'KSS-V1-C01',
      refinementMode: true,
      tickId: 'x',
      precheckOnly: false,
      rawFixtures: 1,
      eligibleFixtures: 1,
      observationFixtures: 0,
      decisionWindowFixtures: 1,
      byLeague: [
        {
          leagueId: 39,
          league: 'Premier League',
          status: 'MODEL_ENABLED',
          fixturesDetected: 1,
          modelEligible: 1,
          oddsRequested: 2,
          quantCandidates: 1,
          paperBets: 1,
        },
      ],
      fullOddsScans: 1,
      oddsPapiRequests: 2,
      apiFootballRequests: 1,
      fixtureCacheHit: true,
      fixtureCacheAgeMinutes: 30,
      poissonModeled: 1,
      quantCandidates: 1,
      paperBetsCreated: 1,
      lunaSelected: 1,
      lunaCalls: 1,
      lunaCacheHits: 0,
      openPaperBets: 1,
      settlements: 1,
      telegramHeartbeatSent: true,
      telegramBetMessages: 1,
      telegramSettlementMessages: 1,
      errors: 0,
      status: 'OK',
    });
    expect(output).toContain('telegramSettlementMessages=1');
    expect(output).not.toContain('super-secret-token');
  });
});
