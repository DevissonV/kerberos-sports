// Tests numéricos de métricas paper-betting (casos F y G obligatorios).
import type { ResolvedBet } from './metrics';
import { calculateClosingLineValue, calculateMetrics } from './metrics';

// Dataset fijo (caso F):
// b1: stake 10 @ 2.0, WON  -> +10
// b2: stake 10 @ 2.0, LOST -> -10
// b3: stake 10 @ 4.0, WON  -> +30
// b4: stake 10 @ 2.0, VOID -> excluida de todas las metricas
// b5: stake 10 @ 2.0, LOST -> -10
const bets: ResolvedBet[] = [
  { id: 'b1', modelProbability: 0.55, stake: 10, odds: 2.0, result: 'WON', closingOdds: 1.8 },
  { id: 'b2', modelProbability: 0.4, stake: 10, odds: 2.0, result: 'LOST', closingOdds: 2.1 },
  { id: 'b3', modelProbability: 0.3, stake: 10, odds: 4.0, result: 'WON', closingOdds: 3.0 },
  { id: 'b4', modelProbability: 0.5, stake: 10, odds: 2.0, result: 'VOID' },
  { id: 'b5', modelProbability: 0.45, stake: 10, odds: 2.0, result: 'LOST', closingOdds: 4.0 },
];

describe('calculateMetrics (dataset fijo)', () => {
  const m = calculateMetrics(bets);

  it('conteos: 5 total, 2 wins, 2 losses, 1 void', () => {
    expect(m.totalBets).toBe(5);
    expect(m.wins).toBe(2);
    expect(m.losses).toBe(2);
    expect(m.voids).toBe(1);
  });

  it('hit rate = 2/4 = 0.5', () => {
    expect(m.hitRate).toBeCloseTo(0.5, 12);
  });

  it('PnL: gross profit 40, gross loss 20, net +20', () => {
    expect(m.grossProfit).toBeCloseTo(40, 12);
    expect(m.grossLoss).toBeCloseTo(20, 12);
    expect(m.netPnL).toBeCloseTo(20, 12);
  });

  it('ROI/yield = 20 / 40 = 0.5', () => {
    expect(m.roi).toBeCloseTo(0.5, 12);
    expect(m.yield).toBeCloseTo(0.5, 12);
  });

  it('Brier: ((p1-1)^2 + (p2-0)^2 + (p3-1)^2 + (p5-0)^2) / 4', () => {
    const expected = (0.45 ** 2 + 0.4 ** 2 + 0.7 ** 2 + 0.45 ** 2) / 4;
    expect(m.brierScore).toBeCloseTo(expected, 12);
  });

  it('log loss es positiva y acotada', () => {
    expect(m.logLoss).toBeGreaterThan(0);
    expect(m.logLoss).toBeLessThan(2);
  });

  it('max drawdown = 10 (pico +30, descripcion del valle posterior +20)', () => {
    // curva: +10, 0, +30, +20. peak 30, valle posterior 20 => dd = 10.
    expect(m.bankrollCurve).toEqual([0, 10, 0, 30, 20]);
    expect(m.maxDrawdown).toBeCloseTo(10, 12);
  });

  it('bets sin closingOdds NO cuentan como 0 en CLV', () => {
    expect(m.clvSampleSize).toBe(4); // b1..b3,b5 con cierre; b4 VOID no setear nunca
    expect(
      calculateMetrics([
        ...bets,
        {
          id: 'b6',
          modelProbability: 0.5,
          stake: 5,
          odds: 2.0,
          result: 'WON',
        },
      ]).clvSampleSize,
    ).toBe(4);
  });
});

describe('CLV (caso G: positivo y negativo)', () => {
  it('apostar mejor cuota que el cierre => CLV positivo', () => {
    // odds 2.0 vs cierre 1.9: 2.0/1.9 - 1 = +5.26% (se tomó mejor precio que el cierre)
    expect(
      calculateClosingLineValue({
        id: 'x',
        modelProbability: 0.5,
        stake: 10,
        odds: 2.0,
        result: 'WON',
        closingOdds: 1.9,
      }),
    ).toBeCloseTo(2.0 / 1.9 - 1, 12);
  });

  it('cierre mejor que la cuota tomada => CLV negativo', () => {
    // odds 1.8 vs cierre 2.0: 1.8/2.0 - 1 = -10%
    expect(
      calculateClosingLineValue({
        id: 'y',
        modelProbability: 0.5,
        stake: 10,
        odds: 1.8,
        result: 'LOST',
        closingOdds: 2.0,
      }),
    ).toBeCloseTo(-0.1, 12);
  });
});
