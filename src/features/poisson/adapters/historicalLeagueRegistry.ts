/** Registro local de históricos: nunca hace requests durante el runtime. */
import { loadHistoricalMatchesForDataset } from './localCsvHistoricalMatches';
import type { HistoricalMatch } from '../domain/concepts';
import { findLeagueDefinition } from '../../scanning/domain/leagueUniverse';

export function historicalMatchesForLeague(leagueId: number, country: string): HistoricalMatch[] {
  const definition = findLeagueDefinition({ leagueId, country });
  if (definition?.historicalDataset === null || definition?.historicalDataset === undefined)
    return [];
  return loadHistoricalMatchesForDataset(definition.historicalDataset);
}
