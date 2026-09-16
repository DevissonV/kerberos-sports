import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ManualLedgerService } from '../application/manualLedgerService';
import { AlreadyManualSettledError } from '../ports/manualLedgerStore';
import { SqliteManualLedgerStore } from './sqliteManualLedgerStore';

const NOW = new Date('2026-09-16T12:00:00.000Z');

function createService(): { store: SqliteManualLedgerStore; service: ManualLedgerService } {
  const store = new SqliteManualLedgerStore(':memory:');
  return { store, service: new ManualLedgerService(store) };
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
    ...overrides,
  });
}

describe('SqliteManualLedgerStore', () => {
  it('crea una ejecución manual y descuenta únicamente el saldo real', () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      const entry = execute(service);
      expect(entry.status).toBe('EXECUTED_MANUALLY');
      expect(entry.bankrollBeforeCop).toBe(100_000);
      expect(entry.bankrollAfterCop).toBe(90_000);
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
    }
  });

  it('la misma executionId es idempotente y no descuenta dos veces', () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      const first = execute(service);
      const repeated = execute(service, {
        recommendationId: 'rec-other',
        executedStakeCop: 50_000,
      });
      expect(repeated).toEqual(first);
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
    }
  });

  it('RECOMMENDED no afecta el bankroll real y puede pasar a ejecución manual', () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      expect(service.recommend('rec-1', NOW).status).toBe('RECOMMENDED');
      expect(service.realBankrollCop()).toBe(100_000);
      expect(execute(service).status).toBe('EXECUTED_MANUALLY');
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
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
    (result, grossReturnCop, netPnlCop, bankrollCop) => {
      const { store, service } = createService();
      try {
        service.initializeRealBankroll(100_000);
        execute(service);
        const settled = service.settle({ executionId: 'exec-1', result, now: NOW });
        expect(settled.status).toBe('SETTLED');
        expect(settled.grossReturnCop).toBe(grossReturnCop);
        expect(settled.netPnlCop).toBe(netPnlCop);
        expect(service.realBankrollCop()).toBe(bankrollCop);
      } finally {
        store.close();
      }
    },
  );

  it('impide doble settlement', () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      execute(service);
      service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW });
      expect(() => service.settle({ executionId: 'exec-1', result: 'WIN', now: NOW })).toThrow(
        AlreadyManualSettledError,
      );
      expect(service.realBankrollCop()).toBe(90_000);
    } finally {
      store.close();
    }
  });

  it('calcula CLV cuando hay cuota de cierre y null cuando no la hay', () => {
    const { store, service } = createService();
    try {
      service.initializeRealBankroll(100_000);
      execute(service);
      expect(
        service.settle({ executionId: 'exec-1', result: 'LOSS', closingOdds: 2, now: NOW }).clv,
      ).toBeCloseTo(0.25);
    } finally {
      store.close();
    }

    const another = createService();
    try {
      another.service.initializeRealBankroll(100_000);
      execute(another.service);
      expect(
        another.service.settle({ executionId: 'exec-1', result: 'LOSS', now: NOW }).clv,
      ).toBeNull();
    } finally {
      another.store.close();
    }
  });

  it('conserva ejecución y saldo al reabrir SQLite', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kss-manual-ledger-'));
    const path = join(directory, 'nested', 'ledger.sqlite');
    const first = new SqliteManualLedgerStore(path);
    const service = new ManualLedgerService(first);
    service.initializeRealBankroll(100_000);
    execute(service);
    first.close();

    const reopened = new SqliteManualLedgerStore(path);
    try {
      expect(reopened.findByExecutionId('exec-1')?.status).toBe('EXECUTED_MANUALLY');
      expect(reopened.realBankrollCop()).toBe(90_000);
    } finally {
      reopened.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
