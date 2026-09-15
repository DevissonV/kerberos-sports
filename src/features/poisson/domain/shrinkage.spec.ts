import { shrinkStat, SHRINKAGE_M } from './shrinkage';

describe('shrinkStat', () => {
  it('n=0 colapsa exactamente a la media de liga (fallback total)', () => {
    expect(shrinkStat(0, 0, 1.5)).toBe(1.5);
  });

  it('0 < n < 8 aplica shrinkage fuerte hacia la liga', () => {
    // equipo con n=2, promedio 3 goles/partido (sum=6), liga=1.5
    const result = shrinkStat(2, 6, 1.5);
    // (6 + 8*1.5) / (2+8) = 18/10 = 1.8, mucho más cerca de la liga (1.5) que del equipo (3)
    expect(result).toBeCloseTo(1.8);
    expect(result).toBeLessThan(3);
    expect(result).toBeGreaterThan(1.5);
  });

  it('n >= 8 sigue aplicando shrinkage pero con menor efecto relativo', () => {
    // equipo con n=30, promedio 2 goles/partido (sum=60), liga=1.5
    const result = shrinkStat(30, 60, 1.5);
    // (60 + 8*1.5) / (30+8) = 72/38 ≈ 1.8947
    expect(result).toBeCloseTo(72 / 38);
  });

  it('usa m=8 por defecto', () => {
    expect(shrinkStat(10, 20, 1.0)).toBe(shrinkStat(10, 20, 1.0, SHRINKAGE_M));
  });
});
