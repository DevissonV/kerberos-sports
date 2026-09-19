/** Regresiones KSS-RISK-ODDS-INTEGRITY-02 (requisitos A–L de la tarea). */

import {
  extractOddsPairs,
  OddsPapiAdapter,
  type OddsPapiFixturePayload,
} from '../src/features/scanning/adapters/oddsPapiOdds';
import { SqliteRefinementStore } from '../src/features/quant/adapters/sqliteRefinementStore';
import { SqliteProductionRiskStateStore } from '../src/features/production-risk/adapters/sqliteProductionRiskStateStore';
import { ProductionRiskService } from '../src/features/production-risk/application/productionRiskService';
import {
  DEFAULT_PRODUCTION_RISK_CONFIG,
  type ProductionRiskDecision,
} from '../src/features/production-risk/domain/productionRiskGate';
import {
  productionRiskConfigForExecution,
  withRealLimits,
} from '../src/features/production-risk/application/productionRiskConfig';
import { ManualLedgerService } from '../src/features/manual-ledger/application/manualLedgerService';
import { SqliteManualLedgerStore } from '../src/features/manual-ledger/adapters/sqliteManualLedgerStore';
import { classifyPaperBetAuthorization } from '../src/features/quant/application/paperBetAuthorization';
import { formatRefinementHeartbeat } from '../src/features/notifications/domain/refinementHeartbeat';
import type { PaperBet } from '../src/features/paper-betting/domain/concepts';
import type { ProductionRiskStateStore } from '../src/features/production-risk/ports/productionRiskStateStore';
import type { OddsEvent } from '../src/features/scanning/domain/matching';
import { validateOddsPairIntegrity } from '../src/features/scanning/domain/oddsIntegrity';
import type { OddsPair } from '../src/features/scanning/domain/concepts';
import type { AppConfig } from '../src/shared/config/configuration';

const NOW = new Date('2026-09-16T14:00:00.000Z');
const NOW_ISO = '2026-09-16T14:00:00.000Z';

interface SidesJson {
  price: number;
  changedAt?: string;
}

/* ---------- helpers ---------- */

function payload(
  fixtureId: string,
  bookmaker: string,
  markets: Record<string, Partial<Record<'over' | 'under', SidesJson>>>,
): OddsPapiFixturePayload {
  return {
    fixtureId,
    startTime: '2026-09-16T20:00:00.000Z',
    participant1Name: 'Arsenal',
    participant2Name: 'Chelsea',
    bookmakerOdds: {
      [bookmaker]: {
        markets: Object.fromEntries(
          Object.entries(markets).map(([marketKey, sides]) => {
            const outcomes: Record<string, unknown> = {};
            if (sides.over !== undefined) {
              outcomes['ov'] = {
                players: {
                  '0': {
                    active: true,
                    bookmakerOutcomeId: '2.5/over',
                    price: sides.over.price,
                    ...(sides.over.changedAt === undefined
                      ? {}
                      : { changedAt: sides.over.changedAt }),
                  },
                },
              };
            }
            if (sides.under !== undefined) {
              outcomes['un'] = {
                players: {
                  '0': {
                    active: true,
                    bookmakerOutcomeId: '2.5/under',
                    price: sides.under.price,
                    ...(sides.under.changedAt === undefined
                      ? {}
                      : { changedAt: sides.under.changedAt }),
                  },
                },
              };
            }
            return [marketKey, { outcomes }];
          }),
        ),
      },
    },
  } as unknown as OddsPapiFixturePayload;
}

function paperBet(overrides: Partial<PaperBet> = {}): PaperBet {
  return {
    id: 'bet-1',
    cohortId: 'KSS-V1-C01',
    fixtureId: 39,
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: new Date('2026-09-16T20:00:00.000Z'),
    snapshotAt: NOW,
    market: 'OVER_UNDER_2_5',
    selection: 'OVER_2_5',
    modelVersion: 'poisson-v1',
    modelProbability: 0.6,
    fairMarketProbability: 0.5,
    edge: 0.1,
    expectedValue: 0.2,
    bookmaker: 'Pinnacle',
    placedOdds: 2,
    minimumAcceptableOdds: 1.9,
    lambdaHome: 1.4,
    lambdaAway: 1.1,
    lambdaTotal: 2.5,
    stake: 10,
    bankrollBefore: 1000,
    status: 'OPEN',
    createdAt: NOW,
    ...overrides,
  };
}

function pair(over: number, under: number, changedAt?: string): OddsPair {
  const quote = (selection: 'OVER_2_5' | 'UNDER_2_5', decimalOdds: number) => ({
    bookmaker: 'pinnacle',
    selection,
    decimalOdds,
    marketId: '1010',
    observedAt: NOW,
    ...(changedAt === undefined ? {} : { changedAt: new Date(changedAt) }),
    capturedAt: NOW,
  });
  return {
    fixtureId: '9001',
    bookmaker: 'pinnacle',
    line: 2.5,
    over: quote('OVER_2_5', over),
    under: quote('UNDER_2_5', under),
  };
}

function riskStoreStub(
  overrides: Partial<ProductionRiskStateStore> = {},
): ProductionRiskStateStore {
  return {
    getDailyState: () => ({ betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 }),
    recordManualBet: jest.fn(),
    reserveBet: jest.fn(),
    findManualBet: jest.fn(() => null),
    settleManualBet: jest.fn(),
    ...overrides,
  };
}

function counters(paperBetsCreated = 1) {
  return {
    ticks: 1,
    precheckOnly: 0,
    eligibleFixtures: 1,
    decisionSnapshotsCaptured: 0,
    fullOddsScans: 0,
    oddsPapiRequests: 0,
    quantCandidates: paperBetsCreated,
    paperBetsCreated,
    lunaCalls: 0,
    settlements: 0,
    errors: 0,
  };
}

/* ---------- A) PaperBet OPEN != authorized bet ---------- */

describe('A: una PaperBet OPEN jamás equivale a una apuesta autorizada', () => {
  it('con el Risk Gate bloqueado, la PaperBet es SOLO señal PAPER', () => {
    const blocked = new ProductionRiskService(
      { ...DEFAULT_PRODUCTION_RISK_CONFIG, manualPause: true },
      riskStoreStub(),
    );
    const { authorized, paperOnly } = classifyPaperBetAuthorization([paperBet()], (bet) =>
      blocked.applyToRecommendationWithReservation(
        { status: 'BET', suggestedStakeCop: 10_000, selection: 'OVER_2_5' },
        '2026-09-16',
        bet.id,
      ),
    );
    expect(authorized).toHaveLength(0);
    expect(paperOnly).toHaveLength(1);
  });

  it('el heartbeat presenta la PaperBet como señal sin lenguaje de autorización', () => {
    const message = formatRefinementHeartbeat({
      now: NOW,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 1 }],
      openBets: 0,
      counters: counters(1),
      bets: 0,
      paperSignals: [
        {
          home: 'Arsenal',
          away: 'Chelsea',
          league: 'Premier League',
          selection: 'OVER_2_5',
          probability: 0.6,
          stakeUnits: 10,
        },
      ],
    });
    expect(message).toContain('SEÑAL PAPER');
    expect(message).toContain('NO AUTORIZADA');
    expect(message).not.toContain('APUESTA AUTORIZADA');
    expect(message).not.toContain('Stake autorizado');
    expect(message).not.toContain('LISTA PARA EJECUCIÓN');
    // Crucial: el stake PAPER nunca se muestra como COP.
    expect(message).toContain('PAPER, no COP');
  });
});

/* ---------- B) el conteo autorizado exige aprobación real del Risk Gate ---------- */

describe('B: "Apuestas autorizadas" solo incrementa con aprobación real', () => {
  it('solo la decisión APPROVED del gate entra en authorized', () => {
    const state = { betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 };
    const gate = new ProductionRiskService(DEFAULT_PRODUCTION_RISK_CONFIG, storeFor(state));
    const blockedDecision: ProductionRiskDecision = {
      status: 'BLOCKED',
      reason: 'MANUAL_PAUSE',
      stakeCop: 0,
      tier: 'BASE',
      manualExecutionRequired: true,
    };
    const result = classifyPaperBetAuthorization(
      [paperBet({ id: 'ok' }), paperBet({ id: 'blocked' })],
      (bet) =>
        bet.id === 'blocked'
          ? { status: 'NO_BET' as const, suggestedStakeCop: null, riskDecision: blockedDecision }
          : gate.applyToRecommendationWithReservation(
              { status: 'BET' as const, suggestedStakeCop: 10_000, selection: 'OVER_2_5' },
              '2026-09-16',
              bet.id,
            ),
    );
    expect(result.authorized).toHaveLength(1);
    expect(result.authorized[0]?.bet.id).toBe('ok');
    const message = formatRefinementHeartbeat({
      now: NOW,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 0 }],
      openBets: 0,
      counters: counters(2),
      bets: result.authorized.length,
      noBetEntries: [],
    });
    expect(message).toContain('🎯 Apuestas autorizadas: 1');
  });
});

function productionRiskValues(): AppConfig['productionRisk'] {
  return {
    baseStakeCop: 10_000,
    elevatedStakeCop: 15_000,
    highStakeCop: 20_000,
    maxStakeCop: 20_000,
    maxBetsPerDay: 3,
    maxDailyExposureCop: 30_000,
    maxDailyLossCop: 30_000,
    maxOpenBets: 2,
    killSwitch: false,
    manualPause: false,
    enableElevated: false,
    enableHigh: false,
    activeTier: 'BASE',
  };
}

function storeFor(state: Record<string, number>): ProductionRiskStateStore {
  return {
    getDailyState: () => state as never,
    recordManualBet: jest.fn(),
    reserveBet: jest.fn(),
    findManualBet: jest.fn(() => null),
    settleManualBet: jest.fn(),
  };
}

/* ---------- C) stake PAPER nunca se muestra como COP autorizado ---------- */

describe('C: el stake PAPER no se presenta como COP autorizado', () => {
  it('el stake autorizado COP proviene del riskDecision, no de la PaperBet', () => {
    const state = { betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 };
    const gate = new ProductionRiskService(DEFAULT_PRODUCTION_RISK_CONFIG, storeFor(state));
    const { authorized } = classifyPaperBetAuthorization([paperBet()], (bet) => {
      if (bet.id !== 'bet-1') return null;
      return gate.applyToRecommendationWithReservation(
        { status: 'BET', suggestedStakeCop: 999_999 },
        '2026-09-16',
        bet.id,
      );
    });
    // El COP autorizado es el del Risk Gate (10.000); el stake PAPER era 10 unidades.
    expect(authorized[0]?.riskDecision.stakeCop).toBe(10_000);
    const message = formatRefinementHeartbeat({
      now: NOW,
      byLeague: [{ leagueId: 39, status: 'MODEL_ENABLED', fixturesDetected: 0 }],
      openBets: 0,
      counters: counters(1),
      bets: 1,
      approvedBets: [
        {
          home: 'Arsenal',
          away: 'Chelsea',
          league: 'Premier League',
          selection: 'OVER_2_5',
          riskGate: 'APROBADO',
          stakeCop: authorized[0]?.riskDecision.stakeCop,
        },
      ],
    });
    expect(message).toContain('💰 Stake autorizado: 10.000 COP');
  });
});

/* ---------- D) límites REAL_* realmente aplicados ---------- */

describe('D: los límites REAL_* alimentan el gate en REAL_MANUAL', () => {
  it('maxStakeCop, exposición, pérdida y apuestas abiertas quedan acotados por REAL_*', () => {
    const config = withRealLimits(
      { ...DEFAULT_PRODUCTION_RISK_CONFIG, elevatedStakeCop: 20_000, highStakeCop: 20_000 },
      {
        realMaxStakeCop: 12_000,
        realMaxDailyExposureCop: 15_000,
        realMaxDailyLossCop: 15_000,
        realMaxOpenBets: 1,
      },
    );
    expect(config.maxStakeCop).toBe(12_000);
    expect(config.maxDailyExposureCop).toBe(15_000);
    expect(config.maxDailyLossCop).toBe(15_000);
    expect(config.maxOpenBets).toBe(1);

    // El stake del tier activo no puede superar REAL_MAX_STAKE_COP (clamping).
    const clamped = withRealLimits(
      {
        ...DEFAULT_PRODUCTION_RISK_CONFIG,
        baseStakeCop: 20_000,
        elevatedStakeCop: 20_000,
        highStakeCop: 20_000,
      },
      { realMaxStakeCop: 12_000 },
    );
    expect(clamped.baseStakeCop).toBe(12_000);
    expect(clamped.elevatedStakeCop).toBe(12_000);
    expect(clamped.highStakeCop).toBe(12_000);
  });

  it('productionRiskConfigForExecution aplica REAL_* SOLO en REAL_MANUAL', () => {
    const productionRisk: AppConfig['productionRisk'] = {
      baseStakeCop: 10_000,
      elevatedStakeCop: 15_000,
      highStakeCop: 20_000,
      maxStakeCop: 20_000,
      maxBetsPerDay: 3,
      maxDailyExposureCop: 30_000,
      maxDailyLossCop: 30_000,
      maxOpenBets: 2,
      killSwitch: false,
      manualPause: false,
      enableElevated: false,
      enableHigh: false,
      activeTier: 'BASE',
    };
    const real = { realMaxStakeCop: 5_000, realMaxOpenBets: 1 };
    const paperMode = productionRiskConfigForExecution(productionRisk, 'PAPER', real);
    expect(paperMode.maxStakeCop).toBe(20_000);
    const realMode = productionRiskConfigForExecution(productionRisk, 'REAL_MANUAL', real);
    expect(realMode.maxStakeCop).toBe(5_000);
    expect(realMode.maxOpenBets).toBe(1);
  });

  it('el gate BLOQUEA cuando REAL_MAX_DAILY_EXPOSURE ya se consumió', () => {
    const config = productionRiskConfigForExecution(productionRiskValues(), 'REAL_MANUAL', {
      realMaxDailyExposureCop: 12_000,
    });
    const state = { betsToday: 0, dailyExposureCop: 10_500, dailyLossCop: 0, openBets: 1 };
    const decision = new ProductionRiskService(config, storeFor(state)).applyToRecommendation(
      { status: 'BET', suggestedStakeCop: 10_000 },
      '2026-09-16',
    );
    expect(decision).toMatchObject({
      status: 'NO_BET',
      riskDecision: { reason: 'MAX_DAILY_EXPOSURE' },
    });
  });
});

/* ---------- E) apertura cross-day ---------- */

describe('E: OPEN de ayer sigue contando hoy como openBet', () => {
  it('el límite MAX_OPEN_BETS cubre apuestas NO settled de días anteriores', () => {
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    try {
      riskStore.recordManualBet({
        id: 'rec-yesterday',
        day: '2026-09-18',
        stakeCop: 10_000,
        operatorApprovalId: 'op-1',
      });
      expect(riskStore.getDailyState('2026-09-18')).toMatchObject({ openBets: 1 });
      const today = riskStore.getDailyState('2026-09-19');
      expect(today.openBets).toBe(1);
      expect(today.betsToday).toBe(0);
      expect(today.dailyExposureCop).toBe(0);
      // Una reserva pendiente también consume cupo.
      riskStore.reserveBet({
        id: 'rec-today',
        day: '2026-09-19',
        stakeCop: 10_000,
        operatorApprovalId: 'op-2',
      });
      expect(riskStore.getDailyState('2026-09-19').openBets).toBe(2);
    } finally {
      riskStore.close();
    }
  });
});

/* ---------- F) reconciliación ledger/risk ---------- */

describe('F: reconciliación ledger ⇄ risk idempotente', () => {
  function executedEntry(store: SqliteManualLedgerStore): void {
    store.execute({
      recommendationId: 'rec-x',
      executionId: 'exec-x',
      bookmaker: 'Pinnacle',
      executedOdds: 2,
      executedStakeCop: 10_000,
      executedAt: NOW,
      createdAt: NOW,
      identity: {
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        competition: 'Premier League',
        kickoffAt: new Date('2026-09-16T19:30:00Z'),
        selection: 'OVER_2_5',
      },
    });
  }

  it('ledger EXECUTED sin registro de riesgo: reconcile lo repara', () => {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    try {
      store.initializeRealBankroll(100_000);
      executedEntry(store);
      expect(riskStore.findManualBet('rec-x')).toBeNull();
      const service = new ManualLedgerService(store, riskStore);
      expect(service.reconcile().reconciled).toBe(1);
      expect(riskStore.getDailyState('2026-09-16')).toMatchObject({
        betsToday: 1,
        dailyExposureCop: 10_000,
        openBets: 1,
      });
      // Idempotente.
      expect(service.reconcile().reconciled).toBe(1);
      expect(riskStore.getDailyState('2026-09-16')).toMatchObject({
        betsToday: 1,
        dailyExposureCop: 10_000,
      });
    } finally {
      riskStore.close();
      store.close();
    }
  });

  it('ledger SETTLED con risk aún OPEN: reconcile resuelve SIN re-aplicar dinero', () => {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    try {
      store.initializeRealBankroll(100_000);
      executedEntry(store);
      store.settle({ executionId: 'exec-x', result: 'WIN', settledAt: NOW });
      riskStore.recordManualBet({
        id: 'rec-x',
        day: '2026-09-16',
        stakeCop: 10_000,
        operatorApprovalId: 'exec-x',
      });
      const service = new ManualLedgerService(store, riskStore);
      service.reconcile();
      // El dinero se aplicó UNA sola vez en el ledger.
      expect(service.realBankrollCop()).toBe(110_000);
      expect(riskStore.findManualBet('rec-x')?.status).toBe('SETTLED');
      const state = riskStore.getDailyState('2026-09-16');
      expect(state.openBets).toBe(0);
      expect(state.dailyLossCop).toBe(0);
      service.reconcile();
      expect(service.realBankrollCop()).toBe(110_000);
    } finally {
      riskStore.close();
      store.close();
    }
  });

  it('reintento de settle sobre SETTLED repara el estado de riesgo y conserva el error', async () => {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    const service = new ManualLedgerService(store, riskStore);
    try {
      store.initializeRealBankroll(100_000);
      await service.execute({
        recommendationId: 'rec-x',
        executionId: 'exec-x',
        bookmaker: 'Pinnacle',
        executedOdds: 2,
        executedStakeCop: 10_000,
        executedAt: NOW,
        now: NOW,
        identity: {
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          competition: 'Premier League',
          kickoffAt: new Date('2026-09-16T19:30:00Z'),
          selection: 'OVER_2_5',
        },
      });
      await service.settle({ executionId: 'exec-x', result: 'WIN', now: NOW });
      await expect(
        service.settle({ executionId: 'exec-x', result: 'WIN', now: NOW }),
      ).rejects.toThrow();
      expect(service.realBankrollCop()).toBe(110_000);
      expect(riskStore.findManualBet('rec-x')?.status).toBe('SETTLED');
    } finally {
      riskStore.close();
      store.close();
    }
  });
});

/* ---------- G) OVER fulltime + UNDER firsthalf ---------- */

describe('G: el par nunca mezcla mercados del proveedor', () => {
  it('OVER en market A + UNDER en market B: no hay par', () => {
    const payloadMixed = payload('9001', 'pinnacle', {
      '1H-1010': { over: { price: 1.9 } },
      'FT-1010': { under: { price: 1.9 } },
    });
    expect(extractOddsPairs(payloadMixed, NOW)).toHaveLength(0);
  });

  it('OVER y UNDER del mismo market: sí forman par (regresión del caso correcto)', () => {
    const payloadSame = payload('9001', 'pinnacle', {
      '1010': {
        over: { price: 1.9, changedAt: NOW_ISO },
        under: { price: 1.95, changedAt: NOW_ISO },
      },
    });
    const pairs = extractOddsPairs(payloadSame, NOW);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.over.marketId).toBe('1010');
    expect(pairs[0]?.under.marketId).toBe('1010');
    expect(pairs[0]?.line).toBe(2.5);
  });
});

/* ---------- H) cuotas futuras / stale ---------- */

describe('H: timestamps futuros y pares imposibles se rechazan', () => {
  it('changedAt posterior al instante de decisión rechaza la cuota', () => {
    const payloadFuture = payload('9001', 'pinnacle', {
      '1010': {
        over: { price: 1.9, changedAt: '2026-09-16T15:00:00.000Z' },
        under: { price: 1.95, changedAt: '2026-09-16T15:00:00.000Z' },
      },
    });
    expect(extractOddsPairs(payloadFuture, NOW)).toHaveLength(0);
  });

  it('changedAt legítimo se preserva y observedAt es el instante de observación (H1)', () => {
    const changedAt = '2026-09-16T13:00:00.000Z';
    const payloadValid = payload('9001', 'pinnacle', {
      '1010': { over: { price: 1.9, changedAt }, under: { price: 1.95, changedAt } },
    });
    const pairs = extractOddsPairs(payloadValid, NOW);
    expect(pairs[0]?.under.changedAt?.toISOString()).toBe(changedAt);
    expect(pairs[0]?.under.observedAt.toISOString()).toBe(NOW_ISO);
    // El startTime del fixture JAMÁS se usa como timestamp de captura de cuotas.
    expect(pairs[0]?.under.observedAt.toISOString()).not.toBe('2026-09-16T20:00:00.000Z');
  });

  it('validateOddsPairIntegrity rechaza overround imposible', () => {
    expect(validateOddsPairIntegrity(pair(3, 3, NOW_ISO), NOW)).toBe('IMPOSSIBLE_OVERROUND');
    expect(validateOddsPairIntegrity(pair(1.98, 1.95, NOW_ISO), NOW)).toBeNull();
  });
});

/* ---------- I) fallback para el fixture solicitado (M2) ---------- */

describe('I: un fixture ajeno con Pinnacle NO bloquea el fallback Bet365', () => {
  function event(id: string, tournamentId: number): OddsEvent {
    return {
      id,
      homeTeam: 'Home',
      awayTeam: 'Away',
      kickoffAt: new Date('2026-09-16T20:00:00Z'),
      tournamentId,
    };
  }

  function fixtureWithCompletePair(
    fixtureId: string,
    bookmaker: string,
    over: number,
    under: number,
  ) {
    return {
      fixtureId,
      startTime: '2026-09-16T20:00:00.000Z',
      participant1Name: 'Home',
      participant2Name: 'Away',
      bookmakerOdds: {
        [bookmaker]: {
          markets: {
            '1010': {
              outcomes: {
                ov: {
                  players: {
                    '0': {
                      active: true,
                      bookmakerOutcomeId: '2.5/over',
                      price: over,
                      changedAt: NOW_ISO,
                    },
                  },
                },
                un: {
                  players: {
                    '0': {
                      active: true,
                      bookmakerOutcomeId: '2.5/under',
                      price: under,
                      changedAt: NOW_ISO,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  it('Bet365 se consulta para el fixture SOLICITADO sin par, aunque otro ajeno tenga Pinnacle', async () => {
    const fetchImpl = jest.fn((url: string) => {
      const bookmaker = new URL(url).searchParams.get('bookmaker') ?? '';
      if (bookmaker === 'pinnacle') {
        // Solo el fixture AJENO (no solicitado) tiene par completo de Pinnacle.
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([fixtureWithCompletePair('foreign', 'pinnacle', 1.9, 1.9)]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([fixtureWithCompletePair('evt1', 'bet365', 2.1, 1.75)]),
      });
    });
    const adapter = new OddsPapiAdapter('https://x', 'k', fetchImpl as unknown as typeof fetch);
    const pairs = await adapter.overUnderPairs([event('evt1', 1)]);
    // El fixture solicitado termina con su par Bet365 (M2 corregido).
    const requested = pairs.find((candidate) => candidate.fixtureId === 'evt1');
    expect(requested?.bookmaker).toBe('bet365');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      fetchImpl.mock.calls.map((call) => new URL(String(call[0])).searchParams.get('bookmaker')),
    ).toEqual(['pinnacle', 'bet365']);
  });
});

/* ---------- J/K: claim T-6 recuperable ---------- */

describe('J/K: el claim T-6 ya no es irreversible', () => {
  it('J: un claim interrumpido (fail) es reintentable en el próximo tick', () => {
    const store = new SqliteRefinementStore(':memory:');
    const at = new Date('2026-09-16T14:00:00.000Z');
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'f1', at)).toBe(true);
    store.failDecisionSnapshot('KSS-V1-C01', 'f1', at);
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'f1', at)).toBe(true);
    store.close();
  });

  it('K: un claim COMPLETED es idempotente (no se re-procesa)', () => {
    const store = new SqliteRefinementStore(':memory:');
    const at = new Date('2026-09-16T14:00:00.000Z');
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'f1', at)).toBe(true);
    store.completeDecisionSnapshot('KSS-V1-C01', 'f1', at);
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'f1', at)).toBe(false);
    store.close();
  });

  it('lease: un PROCESSING reciente sigue bloqueado (no duplica la decisión)', () => {
    const store = new SqliteRefinementStore(':memory:');
    const at = new Date('2026-09-16T14:00:00.000Z');
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'f1', at)).toBe(true);
    expect(store.claimDecisionSnapshot('KSS-V1-C01', 'f1', at)).toBe(false);
    store.close();
  });
});

/* ---------- L: registro manual no puede exceder el stake autorizado ---------- */

describe('L: la ejecución manual está limitada por el stake autorizado', () => {
  function authorizedService(stakeCop: number, selection: string = 'OVER_2_5') {
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    riskStore.reserveBet({
      id: 'rec-k',
      day: '2026-09-16',
      stakeCop,
      operatorApprovalId: 'risk-gate',
      selection,
    });
    const store = new SqliteManualLedgerStore(':memory:');
    store.initializeRealBankroll(1_000_000);
    return { service: new ManualLedgerService(store, riskStore), store, riskStore };
  }

  it('rechaza un stake mayor al autorizado por el Risk Gate', async () => {
    const { service, store, riskStore } = authorizedService(10_000);
    try {
      await expect(
        service.execute({
          recommendationId: 'rec-k',
          executionId: 'exec-k',
          bookmaker: 'Pinnacle',
          executedOdds: 1.9,
          executedStakeCop: 20_000,
          executedAt: NOW,
          now: NOW,
          identity: {
            homeTeam: 'Arsenal',
            awayTeam: 'Chelsea',
            competition: 'Premier League',
            kickoffAt: new Date('2026-09-16T19:30:00Z'),
            selection: 'OVER_2_5',
          },
        }),
      ).rejects.toThrow(/supera el stake autorizado/);
      expect(service.realBankrollCop()).toBe(1_000_000);
    } finally {
      riskStore.close();
      store.close();
    }
  });

  it('rechaza una selección distinta a la autorizada', async () => {
    const { service, store, riskStore } = authorizedService(10_000);
    try {
      await expect(
        service.execute({
          recommendationId: 'rec-k',
          executionId: 'exec-k',
          bookmaker: 'Pinnacle',
          executedOdds: 1.9,
          executedStakeCop: 10_000,
          executedAt: NOW,
          now: NOW,
          identity: {
            homeTeam: 'Arsenal',
            awayTeam: 'Chelsea',
            competition: 'Premier League',
            kickoffAt: new Date('2026-09-16T19:30:00Z'),
            selection: 'UNDER_2_5',
          },
        }),
      ).rejects.toThrow(/no coincide con la autorizada/);
      expect(service.realBankrollCop()).toBe(1_000_000);
    } finally {
      riskStore.close();
      store.close();
    }
  });

  it('apuesta externa se etiqueta EXTERNAL_MANUAL_ENTRY sin bloqueo del Risk Gate', async () => {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    const service = new ManualLedgerService(store, riskStore);
    try {
      store.initializeRealBankroll(100_000);
      const entry = await service.execute({
        recommendationId: 'external-ref-001',
        executionId: 'ext-1',
        bookmaker: 'BetPlay',
        executedOdds: 1.95,
        executedStakeCop: 5_000,
        executedAt: NOW,
        now: NOW,
        identity: {
          homeTeam: 'Millonarios',
          awayTeam: 'Nacional',
          competition: 'Liga BetPlay',
          kickoffAt: new Date('2026-09-16T22:00:00Z'),
          selection: 'OVER_2_5',
        },
      });
      expect(entry.entrySource).toBe('EXTERNAL_MANUAL_ENTRY');
      expect(entry.status).toBe('EXECUTED_MANUALLY');
      expect(service.realBankrollCop()).toBe(95_000);
    } finally {
      riskStore.close();
      store.close();
    }
  });
});
