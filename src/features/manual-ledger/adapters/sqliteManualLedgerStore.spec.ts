import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ManualLedgerService } from '../application/manualLedgerService';
import { AlreadyManualSettledError } from '../ports/manualLedgerStore';
import { SqliteManualLedgerStore } from './sqliteManualLedgerStore';
import { SqliteProductionRiskStateStore } from '../../production-risk/adapters/sqliteProductionRiskStateStore';

const NOW = new Date('2026-09-16T12:00:00.000Z');

const IDENTITY = {
  homeTeam: 'Groningen',
  awayTeam: 'PEC Zwolle',
  competition: 'Eredivisie',
  kickoffAt: new Date('2026-09-20T18:00:00.000Z'),
  selection: 'OVER_2_5',
};

function createService(): {
  store: SqliteManualLedgerStore;
  riskStore: SqliteProductionRiskStateStore;
  service: ManualLedgerService;
} {
  const store = new SqliteManualLedgerStore(':memory:');
  const riskStore = new SqliteProductionRiskStateStore(':memory:');
  return { store, riskStore, service: new ManualLedgerService(store, riskStore) };
}

function execute(
  service: ManualLedgerService,
  overrides: Partial<{
    recommendationId: string;
    executionId: string;
    bookmaker: string;
    executedOdds: number;
    executedStakeCop: number;
  }> = {},
) {
  return service.execute({
    recommendationId: 'rec-1',
    executionId: 'exec-1',
    bookmaker: 'Pinnacle',
    executedOdds: 2.5,
    executedStakeCop: 10_000,
    executedAt: NOW,
    now: NOW,
    identity: IDENTITY,
    ...overrides,
  });
}

describe('SqliteManualLedgerStore', () => {
  it('crea una ejecución manual con identidad de fixture y descuenta únicamente el saldo real', async () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      const entry = await execute(service);
      expect(entry.status).toBe('EXECUTED_MANUALLY');
      expect(entry.executionMode).toBe('REAL_MANUAL');
      expect(entry.homeTeam).toBe('Groningen');
      expect(entry.awayTeam).toBe('PEC Zwolle');
      expect(entry.competition).toBe('Eredivisie');
      expect(entry.selection).toBe('OVER_2_5');
      expect(entry.bankrollBeforeCop).toBe(100_000);
      expect(entry.bankrollAfterCop).toBe(90_000);
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
    }
  });

  it('la misma executionId es idempotente y no descuenta dos veces', async () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      const first = await execute(service);
      const repeated = await execute(service, {
        recommendationId: 'rec-other',
        executedStakeCop: 50_000,
      });
      expect(repeated).toEqual(first);
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
    }
  });

  it('sincroniza EXECUTED_MANUALLY y SETTLED con el estado de riesgo', async () => {
    const { store, riskStore, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      await execute(service);
      await execute(service);
      expect(riskStore.getDailyState('2026-09-16')).toEqual({
        betsToday: 1,
        dailyExposureCop: 10_000,
        dailyLossCop: 0,
        openBets: 1,
      });
      await service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW });
      expect(riskStore.getDailyState('2026-09-16')).toEqual({
        betsToday: 1,
        dailyExposureCop: 10_000,
        dailyLossCop: 10_000,
        openBets: 0,
      });
    } finally {
      riskStore.close();
      store.close();
    }
  });

  it('RECOMMENDED no afecta el bankroll real y puede pasar a ejecución manual con reserva de riesgo', async () => {
    const { store, riskStore, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      expect(service.recommend('rec-1', NOW).status).toBe('RECOMMENDED');
      expect(service.realBankrollCop()).toBe(100_000);
      // El Risk Gate debe haber reservado antes (#6) para que una ejecución
      // Kerberos-AUTHORIZED sea posible: fail-closed sin reserva.
      expect(
        riskStore.reserveBet({
          id: 'rec-1',
          day: '2026-09-16',
          stakeCop: 10_000,
          operatorApprovalId: 'risk-gate-test',
          selection: 'OVER_2_5',
        }),
      ).toBe(true);
      expect((await execute(service)).status).toBe('EXECUTED_MANUALLY');
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      riskStore.close();
      store.close();
    }
  });

  it.each([
    ['WIN', 25_000, 15_000, 115_000],
    ['LOSS', 0, -10_000, 90_000],
    ['PUSH', 10_000, 0, 100_000],
    ['VOID', 10_000, 0, 100_000],
  ] as const)(
    'liquida %s de forma determinista',
    async (result, grossReturnCop, netPnlCop, bankrollCop) => {
      const { store, service } = createService();
      try {
        service.initializeRealBankroll(100_000);
        await execute(service);
        const settled = await service.settle({ executionId: 'exec-1', result, now: NOW });
        expect(settled.status).toBe('SETTLED');
        expect(settled.grossReturnCop).toBe(grossReturnCop);
        expect(settled.netPnlCop).toBe(netPnlCop);
        expect(service.realBankrollCop()).toBe(bankrollCop);
      } finally {
        store.close();
      }
    },
  );

  it('impide doble settlement', async () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      await execute(service);
      await service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW });
      await expect(
        service.settle({ executionId: 'exec-1', result: 'WIN', now: NOW }),
      ).rejects.toThrow(AlreadyManualSettledError);
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
    }
  });

  it('calcula CLV cuando hay cuota de cierre y null cuando no la hay', async () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      await execute(service);
      expect(
        (await service.settle({ executionId: 'exec-1', result: 'LOSS', closingOdds: 2, now: NOW }))
          .clv,
      ).toBeCloseTo(0.25);
    } finally {
      store.close();
    }

    const another = createService();
    try {
      another.service.initializeRealBankroll(100_000);
      await execute(another.service);
      expect(
        (await another.service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW })).clv,
      ).toBeNull();
    } finally {
      another.store.close();
    }
  });

  it('conserva ejecución y saldo al reabrir SQLite', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'kss-manual-ledger-'));
    const path = join(directory, 'nested', 'ledger.sqlite');
    const first = new SqliteManualLedgerStore(path);
    const firstRisk = new SqliteProductionRiskStateStore(':memory:');
    const service = new ManualLedgerService(first, firstRisk);
    service.initializeRealBankroll(100_000);
    await execute(service);
    first.close();

    const reopened = new SqliteManualLedgerStore(path);
    try {
      expect(reopened.findByExecutionId('exec-1')?.status).toBe('EXECUTED_MANUALLY');
      expect(reopened.realBankrollCop()).toBe(90_000);
    } finally {
      reopened.close();
      firstRisk.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
