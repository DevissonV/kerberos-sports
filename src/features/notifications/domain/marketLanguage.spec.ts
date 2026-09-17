import { marketLanguage } from './marketLanguage';

describe('marketLanguage', () => {
  it.each([
    ['UNDER_2_5' as const, 'MENOS DE 2.5 GOLES', '2 goles o menos'],
    ['OVER_2_5' as const, 'MÁS DE 2.5 GOLES', '3 goles o más'],
  ])('%s usa lenguaje humano', (selection, title, explanation) => {
    const market = marketLanguage(selection);
    expect(market.title).toBe(title);
    expect(market.explanation).toContain(explanation);
    expect(`${market.title} ${market.explanation}`).not.toMatch(/\bUNDER\b|\bOVER\b/);
  });
});
