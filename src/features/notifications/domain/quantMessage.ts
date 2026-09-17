/**
 * Formatter puro del mensaje Telegram para PaperBets QUANT (cohorte KSS-V1-C01).
 * Solo candidatos con PaperBet creada; nunca candidatos rechazados. DTO neutral:
 * el dominio no conoce Telegram.
 */

import type { OverUnderSelection } from '../../scanning/domain/concepts';
import { marketLanguage } from './marketLanguage';

export interface PaperPickMessageInput {
  league?: string;
  homeTeam: string;
  awayTeam: string;
  selection: OverUnderSelection;
  bookmaker: string;
  offeredOdds: number;
  modelProbability: number;
  fairMarketProbability: number;
  edge: number;
  expectedValue: number;
  minimumAcceptableOdds: number;
  stake: number;
}

function percent1(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedX1(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

function signedPercent1(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatQuantPaperMessage(pick: PaperPickMessageInput): string {
  const market = marketLanguage(pick.selection);
  return [
    '⚽ KERBEROS SPORTS — PAPER',
    '',
    `🏟 ${pick.homeTeam} vs ${pick.awayTeam}`,
    `🏆 ${pick.league ?? 'Premier League'}`,
    '',
    'Mercado:',
    'TOTAL DE GOLES',
    '',
    'Pick:',
    market.title,
    '',
    '👉 En palabras simples:',
    market.explanation,
    '',
    `✅ Cumple: ${market.winningExamples}`,
    `❌ No cumple: ${market.losingExamples}`,
    '',
    'Casa:',
    pick.bookmaker,
    '',
    'Cuota:',
    pick.offeredOdds.toFixed(2),
    '',
    'QUANT:',
    percent1(pick.modelProbability),
    '',
    'Mercado fair:',
    percent1(pick.fairMarketProbability),
    '',
    'Edge:',
    signedX1(pick.edge),
    '',
    'EV:',
    signedPercent1(pick.expectedValue),
    '',
    'Cuota mínima:',
    pick.minimumAcceptableOdds.toFixed(2),
    '',
    'Stake:',
    pick.stake.toFixed(2),
    '',
    'Modelo:',
    'poisson-v1',
    '',
    'Cohorte:',
    'KSS-V1-C01',
    '',
    '🧪 PAPER ONLY',
  ].join('\n');
}
