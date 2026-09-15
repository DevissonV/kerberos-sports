/**
 * Soporte de cuotas manuales (BetPlay / RushBet / fallback). Entrada mínima vía
 * JSON: sin UI, sin formulario. Objetivo: comparar 1xBet automático vs manual.
 */

import type { OverUnderSelection } from '../domain/concepts';
import type { BookmakerQuote } from '../domain/concepts';

/** Formato de entrada manual (JSON). */
export interface ManualQuoteInput {
  fixtureId: string;
  bookmaker: string;
  selection: OverUnderSelection;
  decimalOdds: number;
  /** ISO 8601 UTC. Si se omite, se exige al validar (no usar reloj invisible). */
  capturedAt?: string;
}

/** Cuota manual validada: referencia el fixtureId del proveedor de fixtures. */
export type ManualQuote = BookmakerQuote & { fixtureId: string };

/**
 * Convierte entradas manuales a ManualQuote del dominio. Lanza si el JSON es
 * inválido: los errores de entrada manual NO se silencian.
 */
export function parseManualQuotes(json: string): ManualQuote[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('las manual quotes deben ser un array JSON');
  }
  return parsed.map((entry, index) => {
    const quote = assertManualQuote(entry, index);
    return {
      fixtureId: quote.fixtureId,
      bookmaker: quote.bookmaker,
      selection: quote.selection,
      decimalOdds: quote.decimalOdds,
      capturedAt: new Date(quote.capturedAt),
    };
  });
}

function assertManualQuote(entry: unknown, index: number): Required<ManualQuoteInput> {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`manual quote[${index}]: debe ser un objeto`);
  }
  const record = entry as Record<string, unknown>;
  const fixtureId = record['fixtureId'];
  const bookmaker = record['bookmaker'];
  const selection = record['selection'];
  const decimalOdds = record['decimalOdds'];
  const capturedAt = record['capturedAt'];

  if (typeof fixtureId !== 'string' || fixtureId.length === 0) {
    throw new Error(`manual quote[${index}]: fixtureId requerido`);
  }
  if (typeof bookmaker !== 'string' || bookmaker.length === 0) {
    throw new Error(`manual quote[${index}]: bookmaker requerido`);
  }
  if (selection !== 'OVER_2_5' && selection !== 'UNDER_2_5') {
    throw new Error(`manual quote[${index}]: selection debe ser OVER_2_5 o UNDER_2_5`);
  }
  if (typeof decimalOdds !== 'number' || !Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error(`manual quote[${index}]: decimalOdds debe ser un número > 1`);
  }
  if (typeof capturedAt !== 'string' || Number.isNaN(Date.parse(capturedAt))) {
    throw new Error(`manual quote[${index}]: capturedAt debe ser ISO 8601`);
  }
  return {
    fixtureId,
    bookmaker,
    selection,
    decimalOdds,
    capturedAt,
  };
}
