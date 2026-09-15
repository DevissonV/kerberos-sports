// Tests numéricos de la matemática de mercado (de-vig, edge, EV, cuota mínima).
import {
  calculateEdge,
  calculateExpectedValuePerUnit,
  calculateMinimumAcceptableOdds,
  devigTwoWay,
} from './marketMath';

describe('de-vig two-way (Over/Under 2.5)', () => {
  it('cuotas 1.90 / 1.90 producen probabilidades fair que suman 1', () => {
    const fair = devigTwoWay(1.9, 1.9);
    expect(fair.pOverFair).toBeCloseTo(0.5, 12);
    expect(fair.pUnderFair).toBeCloseTo(0.5, 12);
    expect(fair.pOverFair + fair.pUnderFair).toBeCloseTo(1, 12);
    expect(fair.fairOverOdds).toBeCloseTo(2.0, 12);
    expect(fair.fairUnderOdds).toBeCloseTo(2.0, 12);
  });

  it('asimétrico 1.85 / 2.05 reparte el vig en proporción al subyacente', () => {
    const fair = devigTwoWay(1.85, 2.05);
    const totalRawImplicado = 1 / 1.85 + 1 / 2.05; // ~1.0305 => vig ~3%
    expect(fair.pOverFair).toBeCloseTo(1 / 1.85 / totalRawImplicado, 12);
    expect(fair.pUnderFair).toBeCloseTo(1 - fair.pOverFair, 12);
  });

  it('rechaza cuotas <= 1, no finitas y probabilidades fuera de [0,1]', () => {
    expect(() => devigTwoWay(1, 2)).toThrow();
    expect(() => devigTwoWay(Infinity, 2)).toThrow();
    expect(() => calculateEdge(-0.1, 0.5)).toThrow();
    expect(() => calculateEdge(NaN, 0.5)).toThrow();
    expect(() => calculateExpectedValuePerUnit(0.5, 0)).toThrow();
  });
});

describe('edge y EV', () => {
  it('p_model = 0.60, p_market = 0.52 -> edge = 0.08', () => {
    expect(calculateEdge(0.6, 0.52)).toBeCloseTo(0.08, 12);
  });

  it('EV con p = 0.60, odds 1.90: 0.60*0.90 - 0.40 = 0.14', () => {
    expect(calculateExpectedValuePerUnit(0.6, 1.9)).toBeCloseTo(0.14, 12);
  });
});

describe('cuota minima aceptable', () => {
  it('p = 0.60, minEdge = 0.08 -> odds = 1/0.52 ≈ 1.923', () => {
    expect(calculateMinimumAcceptableOdds(0.6, 0.08)).toBeCloseTo(1 / 0.52, 12);
  });

  it('si p <= minEdge, requiere una cantidad infinita (imposible)', () => {
    expect(calculateMinimumAcceptableOdds(0.05, 0.08)).toBe(Number.POSITIVE_INFINITY);
  });
});
