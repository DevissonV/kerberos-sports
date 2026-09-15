import { currentPaperBankroll } from './paperBankroll';

describe('currentPaperBankroll', () => {
  it('bankroll inicial sin bets ni pnl', () => {
    expect(
      currentPaperBankroll({ initialBankroll: 1000, openStakesSum: 0, settledPnlSum: 0 }),
    ).toBe(1000);
  });

  it('stakes OPEN comprometen bankroll hasta el settlement', () => {
    expect(
      currentPaperBankroll({ initialBankroll: 1000, openStakesSum: 30, settledPnlSum: 0 }),
    ).toBe(970);
  });

  it('pnl resuelto se suma (ganado y perdido net)', () => {
    expect(
      currentPaperBankroll({ initialBankroll: 1000, openStakesSum: 10, settledPnlSum: 175.5 }),
    ).toBe(1165.5);
    expect(
      currentPaperBankroll({ initialBankroll: 1000, openStakesSum: 10, settledPnlSum: -45 }),
    ).toBe(945);
  });

  it('fail-closed: entradas no finitas o negativas lanzan error', () => {
    expect(() =>
      currentPaperBankroll({ initialBankroll: Number.NaN, openStakesSum: 0, settledPnlSum: 0 }),
    ).toThrow();
    expect(() =>
      currentPaperBankroll({ initialBankroll: 1000, openStakesSum: -1, settledPnlSum: 0 }),
    ).toThrow();
    expect(() =>
      currentPaperBankroll({ initialBankroll: 1000, openStakesSum: 0, settledPnlSum: Number.NaN }),
    ).toThrow();
  });
});
