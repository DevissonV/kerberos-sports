import type { OverUnderSelection } from '../../scanning/domain/concepts';

/** Traducción estable del mercado para mensajes destinados al operador. */
export interface MarketLanguage {
  title: string;
  explanation: string;
  winningExamples: string;
  losingExamples: string;
  /** Pista corta para bloques compactos (p. ej. radar de Telegram). */
  shortHint: string;
  /** Emoji identificador del lado del mercado en bloques compactos. */
  emoji: string;
}

const MARKET_LANGUAGE: Record<OverUnderSelection, MarketLanguage> = {
  OVER_2_5: {
    title: 'MÁS DE 2.5 GOLES',
    explanation: 'Entre los dos equipos deben marcar 3 goles o más.',
    winningExamples: '2-1, 1-2, 3-0, 2-2, 3-1',
    losingExamples: '0-0, 1-0, 0-1, 1-1, 2-0',
    shortHint: 'Necesitamos 3+ goles',
    emoji: '🟢',
  },
  UNDER_2_5: {
    title: 'MENOS DE 2.5 GOLES',
    explanation: 'Entre los dos equipos deben marcar 2 goles o menos.',
    winningExamples: '0-0, 1-0, 0-1, 1-1, 2-0, 0-2',
    losingExamples: '2-1, 1-2, 3-0, 2-2',
    shortHint: 'Máximo 2 goles',
    emoji: '🔵',
  },
};

export function marketLanguage(selection: OverUnderSelection): MarketLanguage {
  return MARKET_LANGUAGE[selection];
}
