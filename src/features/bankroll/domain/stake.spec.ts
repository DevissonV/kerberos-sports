// Tests numéricos de stake FIXED/PERCENT.
import { calculateStake } from './stake';

describe('stake', () => {
  it('FIXED respeta el monto', () => {
    expect(calculateStake(1000, { mode: 'FIXED', amount: 25 }).stake).toBe(25);
  });

  it('PERCENT 1% de 1000 = 10 (decimal 0.01)', () => {
    const quote = calculateStake(1000, { mode: 'PERCENT', amount: 0.01 });
    expect(quote.stake).toBeCloseTo(10, 12);
    expect(quote.cappedBy).toBe('NONE');
  });

  it('jamas supera bankroll', () => {
    const quote = calculateStake(10, { mode: 'FIXED', amount: 500 });
    expect(quote.stake).toBe(10);
    expect(quote.cappedBy).toBe('BANKROLL');
  });

  it('jamas excede la exposition diaria restante', () => {
    const quote = calculateStake(1000, { mode: 'FIXED', amount: 100 }, 50, 40);
    expect(quote.stake).toBe(10);
    expect(quote.cappedBy).toBe('DAILY_EXPOSURE');
  });

  it('exposition diaria agotada => stake 0', () => {
    const quote = calculateStake(1000, { mode: 'FIXED', amount: 10 }, 50, 50);
    expect(quote.stake).toBe(0);
  });

  it('stake nunca negativo y percent > 1 se rechaza', () => {
    expect(calculateStake(1000, { mode: 'PERCENT', amount: 0 }, 0, 0).stake).toBe(0);
    expect(() => calculateStake(1000, { mode: 'PERCENT', amount: 5 })).toThrow();
    expect(() => calculateStake(1000, { mode: 'FIXED', amount: -1 })).toThrow();
  });
});
