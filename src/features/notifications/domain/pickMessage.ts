/**
 * Formatter puro del mensaje V1 de pick (PAPER BET). DTO neutral: ni el dominio
 * ni esta funcion conocen Telegram. La decision SIEMPRE es PAPER BET.
 */

import type { OverUnderSelection } from '../../scanning/domain/concepts';
import { marketLanguage } from './marketLanguage';

/** Datos neutralos de un pick aceptado, listos para formatear. */
export interface PickNotification {
  home: string;
  away: string;
  league: string;
  bookmaker: string;
  selection: OverUnderSelection;
  decimalOdds: number;
  modelProbability: number;
  fairProbability: number;
  edge: number;
  expectedValue: number;
  minimumOdds: number;
  stake: number;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function formatPickNotification(pick: PickNotification): string {
  const market = marketLanguage(pick.selection);
  return [
    '⚽ KERBEROS SPORTS',
    '',
    'Partido:',
    `${pick.home} vs ${pick.away}`,
    '',
    'Liga:',
    pick.league,
    '',
    'Mercado:',
    'TOTAL DE GOLES',
    '',
    'Selección:',
    market.title,
    '',
    '👉 Significa:',
    market.explanation,
    '',
    'Casa:',
    pick.bookmaker,
    '',
    'Cuota:',
    pick.decimalOdds.toFixed(2),
    '',
    'Probabilidad Kerberos:',
    percent(pick.modelProbability),
    '',
    'Probabilidad fair mercado:',
    percent(pick.fairProbability),
    '',
    'Edge:',
    signedPercent(pick.edge),
    '',
    'EV:',
    signedPercent(pick.expectedValue),
    '',
    'Cuota mínima aceptable:',
    pick.minimumOdds.toFixed(2),
    '',
    'Stake:',
    pick.stake.toFixed(2),
    '',
    'Decisión:',
    'PAPER BET',
  ].join('\n');
}
