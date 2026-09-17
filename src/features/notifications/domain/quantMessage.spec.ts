import { formatQuantPaperMessage } from './quantMessage';
import type { PaperPickMessageInput } from './quantMessage';

function makePick(overrides: Partial<PaperPickMessageInput> = {}): PaperPickMessageInput {
  return {
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    selection: 'OVER_2_5',
    bookmaker: 'pinnacle',
    offeredOdds: 2.05,
    modelProbability: 0.613,
    fairMarketProbability: 0.573,
    edge: 0.04,
    expectedValue: 0.3,
    minimumAcceptableOdds: 1.68,
    stake: 10,
    ...overrides,
  };
}

describe('formatQuantPaperMessage', () => {
  it('formato corto con solo datos PAPER para un pick OVER', () => {
    const message = formatQuantPaperMessage(makePick());
    expect(message).toBe(
      [
        '⚽ KERBEROS SPORTS — PAPER',
        '',
        '🏟 Arsenal vs Chelsea',
        '🏆 Premier League',
        '',
        'Mercado:',
        'TOTAL DE GOLES',
        '',
        'Pick:',
        'MÁS DE 2.5 GOLES',
        '',
        '👉 En palabras simples:',
        'Entre los dos equipos deben marcar 3 goles o más.',
        '',
        '✅ Cumple: 2-1, 1-2, 3-0, 2-2, 3-1',
        '❌ No cumple: 0-0, 1-0, 0-1, 1-1, 2-0',
        '',
        'Casa:',
        'pinnacle',
        '',
        'Cuota:',
        '2.05',
        '',
        'QUANT:',
        '61.3%',
        '',
        'Mercado fair:',
        '57.3%',
        '',
        'Edge:',
        '+4.0 pp',
        '',
        'EV:',
        '+30.0%',
        '',
        'Cuota mínima:',
        '1.68',
        '',
        'Stake:',
        '10.00',
        '',
        'Modelo:',
        'poisson-v1',
        '',
        'Cohorte:',
        'KSS-V1-C01',
        '',
        '🧪 PAPER ONLY',
      ].join('\n'),
    );
  });

  it('el pick UNDER se traduce a lenguaje humano', () => {
    const message = formatQuantPaperMessage(makePick({ selection: 'UNDER_2_5' }));
    expect(message).toContain('Pick:\nMENOS DE 2.5 GOLES');
    expect(message).toContain('Entre los dos equipos deben marcar 2 goles o menos.');
    expect(message).not.toMatch(/\bUNDER\b|\bOVER\b/);
  });
});
