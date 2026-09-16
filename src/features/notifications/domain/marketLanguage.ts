import type { OverUnderSelection } from '../../scanning/domain/concepts';

/** Traducción estable del mercado para mensajes destinados al operador. */
export interface MarketLanguage {
  title: string;
  explanation: string;
  winningExamples: string;
  losingExamples: string;
}

const MARKET_LANGUAGE: Record<OverUnderSelection, MarketLanguage> = {
  OVER_2_5: {
    title: 'MÁS DE 2.5 GOLES',
    explanation: 'Entre ambos equipos deben marcar 3 GOLES O MÁS.',
    winningExamples: '3-0, 2-1, 1-2, 2-2...',
    losingExamples: '0-0, 1-0, 0-1, 1-1, 2-0...',
  },
  UNDER_2_5: {
    title: 'MENOS DE 2.5 GOLES',
    explanation: 'Entre ambos equipos deben marcar 2 GOLES O MENOS.',
    winningExamples: '0-0, 1-0, 0-1, 1-1, 2-0...',
    losingExamples: '2-1, 1-2, 3-0, 2-2...',
  },
};

export function marketLanguage(selection: OverUnderSelection): MarketLanguage {
  return MARKET_LANGUAGE[selection];
}
