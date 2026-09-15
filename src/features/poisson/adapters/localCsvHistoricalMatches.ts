/**
 * Adapter de lectura del histórico local (`resources/data/premier-league/*.csv`). Único
 * consumidor y única implementación: no se modela como puerto (regla pragmática de
 * `AGENTS.md`). El parseo en sí (`csvParser.ts`) es puro; este archivo solo hace I/O de
 * filesystem, cero requests de red.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HistoricalMatch } from '../domain/concepts';
import { parseFootballDataCsv } from '../domain/csvParser';

const HISTORICAL_CSV_FILES = ['2425-E0.csv', '2526-E0.csv', '2627-E0.csv'];

/** Carga y combina los CSVs versionados de Premier League en un único set de partidos. */
export function loadLocalHistoricalMatches(
  dataDir: string = join(process.cwd(), 'resources', 'data', 'premier-league'),
): HistoricalMatch[] {
  return HISTORICAL_CSV_FILES.flatMap((fileName) => {
    const content = readFileSync(join(dataDir, fileName), 'utf-8');
    return parseFootballDataCsv(content);
  });
}
