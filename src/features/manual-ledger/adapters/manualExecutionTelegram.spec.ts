import { ManualLedgerService } from '../application/manualLedgerService';
import { SqliteManualLedgerStore } from './sqliteManualLedgerStore';
import { SqliteProductionRiskStateStore } from '../../production-risk/adapters/sqliteProductionRiskStateStore';
import type { NotificationPort } from '../../notifications/ports/notificationPort';
import { realBetsDailyStats } from '../domain/realBetsStats';

const NOW = new Date('2026-09-16T12:00:00.000Z');
const IDENTITY = {
  homeTeam: 'Groningen',
  awayTeam: 'PEC Zwolle',
  competition: 'Eredivisie',
  kickoffAt: new Date('2026-09-19T18:00:00.000Z'),
  selection: 'OVER_2_5',
};

describe('ManualLedgerService con notificación Telegram', () => {
  function createNotifiable() {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    const sends: string[] = [];
    const notifications: NotificationPort = {
      send: (message) => {
        sends.push(message);
        return Promise.resolve();
      },
    };
    return {
      store,
      riskStore,
      sends,
      service: new ManualLedgerService(store, riskStore, notifications),
    };
  }

  function executeInput(recommendationId = 'rec-1ab23c') {
    return {
      recommendationId,
      executionId: 'exec-1',
      bookmaker: 'BetPlay',
      executedOdds: 1.85,
      executedStakeCop: 10_000,
      executedAt: NOW,
      now: NOW,
      identity: IDENTITY,
    };
  }

  it('notifica la ejecución una única vez (dedupe durable)', async () => {
    const { store, service, sends, riskStore } = createNotifiable();
    try {
      service.initializeRealBankroll(100_000);
      await service.execute(executeInput());
      expect(sends).toHaveLength(1);
      expect(sends[0]).toContain('👤 APUESTA EJECUTADA');
      expect(sends[0]).toContain('⚽ Groningen vs PEC Zwolle');
      expect(sends[0]).toContain('🏦 Casa: BetPlay');
      expect(sends[0]).toContain('⏳ Esperando resultado');
      await service.execute(executeInput());
      expect(sends).toHaveLength(1);
      expect(store.listEntries().at(-1)?.telegramNotifiedAt).toBeDefined();
    } finally {
      store.close();
      riskStore.close();
    }
  });

  it('notifica el settlement una sola vez con PnL real', async () => {
    const { store, service, sends, riskStore } = createNotifiable();
    try {
      service.initializeRealBankroll(100_000);
      await service.execute(executeInput());
      await service.settle({ executionId: 'exec-1', result: 'WIN', now: NOW });
      expect(sends).toHaveLength(2);
      expect(sends[1]).toContain('🏁 RESULTADO FINAL');
      expect(sends[1]).toContain('📈 PnL: +8.500 COP');
      await expect(
        service.settle({ executionId: 'exec-1', result: 'WIN', now: NOW }),
      ).rejects.toThrow();
      expect(sends).toHaveLength(2);
    } finally {
      store.close();
      riskStore.close();
    }
  });
});

describe('estadísticas reales del día (ROI, bankroll)', () => {
  it('liquida WIN+LOSS y calcula ROI real diario sin tocar predicciones', async () => {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    const service = new ManualLedgerService(store, riskStore);
    const identity = IDENTITY;
    try {
      service.initializeRealBankroll(200_000);
      await service.execute({
        recommendationId: 'a-1abcde',
        executionId: 'x-1',
        bookmaker: 'BetPlay',
        executedOdds: 2,
        executedStakeCop: 10_000,
        executedAt: NOW,
        now: NOW,
        identity,
      });
      await service.execute({
        recommendationId: 'b-2fghijk',
        executionId: 'x-2',
        bookmaker: 'Pinnacle',
        executedOdds: 2,
        executedStakeCop: 10_000,
        executedAt: NOW,
        now: NOW,
        identity,
      });
      await service.settle({ executionId: 'x-1', result: 'WIN', now: NOW });
      await service.settle({ executionId: 'x-2', result: 'LOSS', now: NOW });
      const stats = realBetsDailyStats(store.listEntries(), '2026-09-16');
      expect(stats.executed).toBe(2);
      expect(stats.won).toBe(1);
      expect(stats.lost).toBe(1);
      expect(stats.totalStakeCop).toBe(20_000);
      expect(stats.grossReturnCop).toBe(20_000);
      expect(stats.netPnlCop).toBe(0);
      expect(stats.roi).toBe(0);
      expect(stats.bankrollBeforeCop).toBe(200_000);
      expect(stats.bankrollAfterCop).toBe(200_000);
      expect(stats.pending).toBe(0);
    } finally {
      store.close();
      riskStore.close();
    }
  });

  it('sin apuestas reales devuelve contadores en cero', () => {
    const store = new SqliteManualLedgerStore(':memory:');
    const riskStore = new SqliteProductionRiskStateStore(':memory:');
    const neverStored = new ManualLedgerService(store, riskStore);
    void neverStored;
    const stats = realBetsDailyStats(store.listEntries(), '2026-09-16');
    expect(stats.executed).toBe(0);
    expect(stats.roi).toBeNull();
    store.close();
    riskStore.close();
  });
});
