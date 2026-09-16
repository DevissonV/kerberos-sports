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
import { resolveCanonicalTeamNameForDataset } from '../domain/teamAliases';

const HISTORICAL_CSV_FILES = ['2425-E0.csv', '2526-E0.csv', '2627-E0.csv'];
const MULTI_LEAGUE_CSV_FILES = ['2425-SP1.csv', '2526-SP1.csv', '2627-SP1.csv'] as const;
const DATASET_FILES: Readonly<Record<string, readonly string[]>> = {
  'premier-league': HISTORICAL_CSV_FILES,
  'la-liga': MULTI_LEAGUE_CSV_FILES,
  'serie-a': ['2425-I1.csv', '2526-I1.csv', '2627-I1.csv'],
  bundesliga: ['2425-D1.csv', '2526-D1.csv', '2627-D1.csv'],
  'ligue-1': ['2425-F1.csv', '2526-F1.csv', '2627-F1.csv'],
  eredivisie: ['2425-N1.csv', '2526-N1.csv', '2627-N1.csv'],
  'primeira-liga': ['2425-P1.csv', '2526-P1.csv', '2627-P1.csv'],
  'belgian-pro-league': ['2425-B1.csv', '2526-B1.csv', '2627-B1.csv'],
  mls: ['mls_matches_2024.csv', 'mls_matches_2025.csv', 'mls_matches_2026.csv'],
};

/** Carga y combina los CSVs versionados de Premier League en un único set de partidos. */
export function loadLocalHistoricalMatches(
  dataDir: string = join(process.cwd(), 'resources', 'data', 'premier-league'),
): HistoricalMatch[] {
  return HISTORICAL_CSV_FILES.flatMap((fileName) => {
    const content = readFileSync(join(dataDir, fileName), 'utf-8');
    return parseFootballDataCsv(content);
  });
}

/**
 * Carga un único dataset de liga. Los nombres del CSV se preservan de forma exacta:
 * API-Football debe resolverlos explícitamente antes de llamar al modelo; sin fuzzy matching.
 */
export function loadHistoricalMatchesForDataset(
  dataset: string,
  dataRoot = join(process.cwd(), 'resources', 'data'),
): HistoricalMatch[] {
  const files = DATASET_FILES[dataset];
  if (files === undefined) return [];
  return files.flatMap((fileName) =>
    parseFootballDataCsv(readFileSync(join(dataRoot, dataset, fileName), 'utf-8'), (name) =>
      resolveCanonicalTeamNameForDataset(dataset, name),
    ),
  );
}
