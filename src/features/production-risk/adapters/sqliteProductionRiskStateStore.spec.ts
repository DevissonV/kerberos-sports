import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteProductionRiskStateStore } from './sqliteProductionRiskStateStore';

describe('SqliteProductionRiskStateStore', () => {
  it('no registra una recomendación sin aprobación manual del operador', () => {
    const store = new SqliteProductionRiskStateStore(':memory:');
    try {
      expect(() =>
        store.recordManualBet({
          id: 'suggestion-only',
          day: '2026-09-16',
          stakeCop: 10_000,
          operatorApprovalId: '',
        }),
      ).toThrow(/operatorApprovalId/);
      expect(store.getDailyState('2026-09-16').betsToday).toBe(0);
    } finally {
      store.close();
    }
  });

  it('conserva el estado diario de riesgo al reiniciar', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kss-production-risk-'));
    const path = join(directory, 'risk.db');
    const first = new SqliteProductionRiskStateStore(path);
    first.recordManualBet({
      id: 'manual-1',
      day: '2026-09-16',
      stakeCop: 10_000,
      operatorApprovalId: 'approval-1',
    });
    first.settleManualBet('manual-1', -10_000);
    first.close();

    const reopened = new SqliteProductionRiskStateStore(path);
    try {
      expect(reopened.getDailyState('2026-09-16')).toEqual({
        betsToday: 1,
        dailyExposureCop: 10_000,
        dailyLossCop: 10_000,
        openBets: 0,
      });
    } finally {
      reopened.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
