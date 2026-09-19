jest.mock('@nestjs/common', () => ({
  Inject: () => () => undefined,
  Injectable: () => (target: unknown) => target,
}));

import { SqlitePaperBetStore } from '../../paper-betting/adapters/sqlitePaperBetStore';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import { SettlementService } from './settlementService';

function makeBet(id: string, selection: string): PaperBet {
  return {
    id,
    cohortId: 'KSS-V1-C01',
    fixtureId: Number(id.replace(/\D/g, '')) || 1,
    league: 'Premier League',
    homeTeam: `Home${id}`,
    awayTeam: `Away${id}`,
    kickoff: new Date('2026-09-20T19:00:00Z'),
    snapshotAt: new Date('2026-09-20T13:00:00Z'),
    market: 'OVER_UNDER_2_5',
    selection,
    modelVersion: 'poisson-v1',
    modelProbability: 0.5,
    fairMarketProbability: 0.5,
    edge: 0,
    expectedValue: 0,
    bookmaker: 'pinnacle',
    placedOdds: selection === 'UNDER_2_5' ? 1.8 : 2,
    minimumAcceptableOdds: 1.7,
    lambdaHome: 1,
    lambdaAway: 1,
    lambdaTotal: 2,
    stake: 10,
    bankrollBefore: 1000,
    status: 'OPEN',
    createdAt: new Date('2026-09-20T13:00:00Z'),
  };
}

describe('SettlementService', () => {
  let store: SqlitePaperBetStore;
  let sent: string[];
  let service: SettlementService;

  beforeEach(() => {
    store = new SqlitePaperBetStore(':memory:');
    sent = [];
    const scores: Record<string, { status: string; home: number | null; away: number | null }> = {
      '1': { status: 'FT', home: 2, away: 1 },
      '2': { status: 'FT', home: 1, away: 1 },
      '3': { status: 'FT', home: 1, away: 1 },
      '4': { status: 'FT', home: 2, away: 1 },
      '5': { status: 'CANC', home: null, away: null },
      '6': { status: 'PST', home: null, away: null },
      '7': { status: 'FT', home: null, away: null },
    };
    service = new SettlementService(
      store,
      {
        result: (fixtureId) => {
          const score = scores[fixtureId];
          return Promise.resolve(
            score === undefined
              ? null
              : {
                  fixtureId,
                  status: score.status,
                  fulltimeHome: score.home,
                  fulltimeAway: score.away,
                  finishedAt: null,
                },
          );
        },
      },
      {
        send: (message) => {
          sent.push(message);
          return Promise.resolve();
        },
      },
    );
    store.save(makeBet('1', 'OVER_2_5'));
    store.save(makeBet('2', 'OVER_2_5'));
    store.save(makeBet('3', 'UNDER_2_5'));
    store.save(makeBet('4', 'UNDER_2_5'));
    store.save(makeBet('5', 'OVER_2_5'));
    store.save(makeBet('6', 'OVER_2_5'));
    store.save(makeBet('7', 'OVER_2_5'));
  });

  afterEach(() => store.close());

  it('liquida outcomes, PnL, bankroll y Telegram una sola vez', async () => {
    const first = await service.settleOpenBets();
    expect(first.settled).toBe(5);
    expect(first.telegramSent).toBe(5);
    expect(store.findById('1')?.pnl).toBe(10);
    expect(store.findById('2')?.pnl).toBe(-10);
    expect(store.findById('3')?.pnl).toBeCloseTo(8);
    expect(store.findById('4')?.pnl).toBe(-10);
    expect(store.findById('5')?.status).toBe('VOID');
    expect(store.findById('6')?.status).toBe('OPEN');
    expect(store.findById('7')?.status).toBe('OPEN');
    expect(first.metrics.currentBankroll).toBeCloseTo(998);
    expect(sent).toHaveLength(5);
    expect(sent[0]).toContain('🏁 RESULTADO FINAL');

    const second = await service.settleOpenBets();
    expect(second.settled).toBe(0);
    expect(second.telegramSent).toBe(0);
    expect(sent).toHaveLength(5);
    expect(store.findById('1')?.pnl).toBe(10);
  });

  it('error del proveedor falla cerrado y conserva OPEN', async () => {
    const failing = new SettlementService(
      store,
      {
        result: () => Promise.reject(new Error('network')),
      },
      { send: () => Promise.resolve() },
    );
    const summary = await failing.settleOpenBets();
    expect(summary.providerErrors).toBe(7);
    expect(store.listByStatus('OPEN')).toHaveLength(7);
    expect(sent).toHaveLength(0);
  });
});
