/**
 * Parser de histórico football-data.co.uk (`Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR`). Puro:
 * recibe el contenido crudo del CSV como string, sin tocar el filesystem. Ignora filas
 * incompletas y filas con equipos fuera de la tabla de aliases (sin fuzzy matching).
 *
 * Convención causal C1: el CSV solo aporta fecha (sin hora de finalización ni de
 * publicación); la medianoche UTC NO implica que el resultado estuviera disponible a
 * esa hora. La frontera temporal la aplica `filterHistoricalWindow` con la política
 * conservadora del mismo día (ver `historicalWindow.ts`).
 */

import type { HistoricalMatch } from './concepts';
import { resolveCanonicalTeamName } from './teamAliases';

const REQUIRED_COLUMNS = ['Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR'] as const;

/** `dd/mm/yyyy` -> medianoche UTC de esa fecha. `undefined` si el formato no calza. */
function parseFootballDataDate(raw: string): Date | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseResult(raw: string): 'H' | 'A' | 'D' | undefined {
  const value = raw.trim();
  return value === 'H' || value === 'A' || value === 'D' ? value : undefined;
}

function parseGoals(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Divide una línea CSV simple (sin comillas embebidas, formato ya recortado a 6 columnas). */
function splitCsvLine(line: string): string[] {
  return line.split(',');
}

/**
 * Parsea el contenido completo de un CSV de football-data.co.uk (ya recortado a las columnas
 * requeridas). Filas incompletas, con fecha inválida o con equipo fuera de la tabla de
 * aliases se descartan silenciosamente: no son errores del parser, son datos fuera de alcance
 * de la cohorte (p. ej. abandono de temporada, encabezado repetido).
 */
export function parseFootballDataCsv(
  csvContent: string,
  resolveTeam: (name: string) => string | undefined = resolveCanonicalTeamName,
): HistoricalMatch[] {
  const withoutBom = csvContent.charCodeAt(0) === 0xfeff ? csvContent.slice(1) : csvContent;
  const lines = withoutBom
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]!);
  const columnIndex = new Map(header.map((name, index) => [name, index]));
  const hasAllColumns = REQUIRED_COLUMNS.every((column) => columnIndex.has(column));
  if (!hasAllColumns) return [];

  const matches: HistoricalMatch[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const dateRaw = cells[columnIndex.get('Date')!];
    const homeRaw = cells[columnIndex.get('HomeTeam')!];
    const awayRaw = cells[columnIndex.get('AwayTeam')!];
    const homeGoalsRaw = cells[columnIndex.get('FTHG')!];
    const awayGoalsRaw = cells[columnIndex.get('FTAG')!];
    const resultRaw = cells[columnIndex.get('FTR')!];
    if (
      dateRaw === undefined ||
      homeRaw === undefined ||
      awayRaw === undefined ||
      homeGoalsRaw === undefined ||
      awayGoalsRaw === undefined ||
      resultRaw === undefined
    ) {
      continue;
    }

    const date = parseFootballDataDate(dateRaw);
    const homeGoals = parseGoals(homeGoalsRaw);
    const awayGoals = parseGoals(awayGoalsRaw);
    const result = parseResult(resultRaw);
    const homeTeam = resolveTeam(homeRaw.trim());
    const awayTeam = resolveTeam(awayRaw.trim());

    if (
      date === undefined ||
      homeGoals === undefined ||
      awayGoals === undefined ||
      result === undefined ||
      homeTeam === undefined ||
      awayTeam === undefined
    ) {
      continue;
    }

    matches.push({ date, homeTeam, awayTeam, homeGoals, awayGoals, result });
  }
  return matches;
}
