import { analystOutputSchema } from './contracts';

describe('Analyst structured contract', () => {
  it('acepta salida contextual válida', () => {
    expect(
      analystOutputSchema.parse({
        fixtureId: '1',
        contextScore: 50,
        priority: 'MEDIUM',
        alerts: [],
        supportingFactors: [],
        contradictingFactors: [],
        suggestedMarketsToInvestigate: [],
        summary: 'ok',
        confidenceInContext: 'LOW',
      }).fixtureId,
    ).toBe('1');
  });

  it('rechaza autoridad financiera o decisión final', () => {
    expect(() =>
      analystOutputSchema.parse({
        fixtureId: '1',
        contextScore: 50,
        priority: 'LOW',
        alerts: [],
        supportingFactors: [],
        contradictingFactors: [],
        suggestedMarketsToInvestigate: [],
        summary: 'ok',
        confidenceInContext: 'LOW',
        stake: 1000,
      }),
    ).toThrow();
  });
});
