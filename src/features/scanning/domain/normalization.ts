/**
 * Normalización de nombres de equipos para matching entre proveedores.
 * Determinista y pura: sin red, sin reloj.
 */

const DIACRITICS = /[\u0300-\u036f]/g;

/** Normaliza un nombre de equipo: minúsculas, sin acentos, sin puntuación extra. */
export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens genéricos que aportan poco para distinguir equipos. */
const NOISE_TOKENS = new Set(['fc', 'cf', 'afc', 'sc', 'club', 'deportivo', 'cd', 'ac', 'as']);

/** Variante agresiva: quita tokens genéricos (FC, CF, AFC...) tras normalizar. */
export function aggressiveTeamKey(name: string): string {
  const tokens = normalizeTeamName(name)
    .split(' ')
    .filter((token) => token.length > 0 && !NOISE_TOKENS.has(token));
  return tokens.join(' ');
}
