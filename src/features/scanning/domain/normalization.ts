/**
 * Normalizacion de nombres de equipos para matching entre proveedores.
 * Determinista y pura: sin red, sin reloj.
 */

const DIACRITICS = /[\u0300-\u036f]/g;

/** Normaliza un nombre de equipo: minusculas, sin acentos, sin puntuacion extra. */
export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens genericos que aportan poco para distinguir equipos. */
const NOISE_TOKENS = new Set(['fc', 'cf', 'afc', 'sc', 'club', 'deportivo', 'cd', 'ac', 'as']);

/** Tokens que identifican equipos filiales: nunca colapsar con el primer equipo. */
const RESERVE_TOKENS = new Set([
  'u16',
  'u17',
  'u18',
  'u19',
  'u20',
  'u21',
  'u23',
  'ii',
  'reserve',
  'reserves',
]);

/** Tokens agresivos de un nombre: minusculas, sin acentos, sin genericos. */
export function teamTokens(name: string): string[] {
  return normalizeTeamName(name)
    .split(' ')
    .filter((token) => token.length > 0 && !NOISE_TOKENS.has(token));
}

/** Variante agresiva: quita tokens genericos (FC, CF, AFC...) tras normalizar. */
export function aggressiveTeamKey(name: string): string {
  return teamTokens(name).join(' ');
}

/** True si el token identifica equipo filial o juvenil. */
function isReserveToken(token: string): boolean {
  return RESERVE_TOKENS.has(token) || token === 'b';
}

/** True si el nombre tiene marcador de equipo filial o juvenil (U19, II, Reserve, B). */
export function isReserveTeam(name: string): boolean {
  return teamTokens(name).some(isReserveToken);
}

/** Dos tokens compatibles: iguales, plural ('s' final) o prefijo (>=5 chars). Ojo: no tokens reservas. */
function tokensCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  if (short.length < 5) return false;
  if (RESERVE_TOKENS.has(short) || RESERVE_TOKENS.has(long)) return false;
  const stem = short.endsWith('s') ? short.slice(0, -1) : short;
  return long.startsWith(stem);
}

/**
 * Compatibilidad entre un key corto y uno largo: cada token del corto debe
 * casarse con un token distinto del largo. Solo se usa cuando el largo NO es
 * equipo filial (proteccion fail-closed contra colapsar reservas).
 */
export function tokenSubsetCompatible(shortKey: string, longKey: string): boolean {
  const shortTokens = shortKey.split(' ');
  const longTokens = longKey.split(' ');
  if (longTokens.some(isReserveToken)) {
    return false;
  }
  const used = new Set<number>();
  for (const token of shortTokens) {
    const idx = longTokens.findIndex(
      (longToken, i) => !used.has(i) && tokensCompatible(token, longToken),
    );
    if (idx === -1) return false;
    used.add(idx);
  }
  return true;
}
