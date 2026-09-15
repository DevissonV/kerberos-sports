import type { MarketKind, Sport } from './concepts';

export const SPORT: Sport = 'FOOTBALL';

// Alcance congelado del MVP: goles totales Over/Under 2.5
// (verifica resources/temp/KSS-T02-* para el historial de decisión).
export const CANDIDATE_MARKET_KIND: MarketKind = 'OVER_UNDER';
export const TOTAL_LINE = 2.5;

export type TotalSelection = 'OVER_2_5' | 'UNDER_2_5';
