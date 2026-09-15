/**
 * Aliases explícitos y versionados de equipo (ver `resources/temp/KSS-HISTORY-GATE-01B.md`
 * sección 3). NUNCA fuzzy matching: solo mapeo determinista string exacto → string exacto,
 * limitado a los equipos que aparecen en el histórico usado por Poisson V1 (temporadas
 * 2024/25, 2025/26 y 2026/27 de Premier League).
 *
 * `canonicalName` = nombre preferido de API-Football (fuente que ya ancla la identidad de
 * equipo en el pipeline de scanning). Los 20 clubs de la temporada 2026/27 están verificados
 * contra API-Football en KSS-HISTORY-GATE-01B. Los 5 equipos adicionales que solo aparecen en
 * temporadas anteriores (descendidos antes de 2026/27: Burnley, Leicester, Southampton, West
 * Ham, Wolves) siguen el mismo patrón de nomenclatura observado en esa verificación (fd usa el
 * nombre corto/coloquial, API-Football usa el nombre oficial completo), pero no fueron
 * re-verificados con una consulta en vivo a API-Football: no se gasta presupuesto de requests
 * adicional para 5 equipos que ya no compiten en la cohorte vigente (`RUNTIME_HISTORICAL_REQUESTS=0`).
 */

export interface TeamAliasEntry {
  canonicalTeamId: string;
  canonicalName: string;
  /** Nombre exacto tal como aparece en las columnas HomeTeam/AwayTeam de football-data.co.uk. */
  footballDataName: string;
}

export const TEAM_ALIASES: readonly TeamAliasEntry[] = [
  { canonicalTeamId: 'arsenal', canonicalName: 'Arsenal', footballDataName: 'Arsenal' },
  { canonicalTeamId: 'aston-villa', canonicalName: 'Aston Villa', footballDataName: 'Aston Villa' },
  { canonicalTeamId: 'bournemouth', canonicalName: 'Bournemouth', footballDataName: 'Bournemouth' },
  { canonicalTeamId: 'brentford', canonicalName: 'Brentford', footballDataName: 'Brentford' },
  { canonicalTeamId: 'brighton', canonicalName: 'Brighton', footballDataName: 'Brighton' },
  { canonicalTeamId: 'burnley', canonicalName: 'Burnley', footballDataName: 'Burnley' },
  { canonicalTeamId: 'chelsea', canonicalName: 'Chelsea', footballDataName: 'Chelsea' },
  { canonicalTeamId: 'coventry', canonicalName: 'Coventry', footballDataName: 'Coventry' },
  {
    canonicalTeamId: 'crystal-palace',
    canonicalName: 'Crystal Palace',
    footballDataName: 'Crystal Palace',
  },
  { canonicalTeamId: 'everton', canonicalName: 'Everton', footballDataName: 'Everton' },
  { canonicalTeamId: 'fulham', canonicalName: 'Fulham', footballDataName: 'Fulham' },
  { canonicalTeamId: 'hull-city', canonicalName: 'Hull City', footballDataName: 'Hull' },
  { canonicalTeamId: 'ipswich', canonicalName: 'Ipswich', footballDataName: 'Ipswich' },
  { canonicalTeamId: 'leeds', canonicalName: 'Leeds', footballDataName: 'Leeds' },
  { canonicalTeamId: 'leicester', canonicalName: 'Leicester City', footballDataName: 'Leicester' },
  { canonicalTeamId: 'liverpool', canonicalName: 'Liverpool', footballDataName: 'Liverpool' },
  { canonicalTeamId: 'man-city', canonicalName: 'Manchester City', footballDataName: 'Man City' },
  {
    canonicalTeamId: 'man-utd',
    canonicalName: 'Manchester United',
    footballDataName: 'Man United',
  },
  { canonicalTeamId: 'newcastle', canonicalName: 'Newcastle', footballDataName: 'Newcastle' },
  {
    canonicalTeamId: 'nottm-forest',
    canonicalName: 'Nottingham Forest',
    footballDataName: "Nott'm Forest",
  },
  { canonicalTeamId: 'southampton', canonicalName: 'Southampton', footballDataName: 'Southampton' },
  { canonicalTeamId: 'sunderland', canonicalName: 'Sunderland', footballDataName: 'Sunderland' },
  { canonicalTeamId: 'tottenham', canonicalName: 'Tottenham', footballDataName: 'Tottenham' },
  { canonicalTeamId: 'west-ham', canonicalName: 'West Ham United', footballDataName: 'West Ham' },
  {
    canonicalTeamId: 'wolves',
    canonicalName: 'Wolverhampton Wanderers',
    footballDataName: 'Wolves',
  },
] as const;

const FOOTBALL_DATA_NAME_INDEX = new Map<string, string>(
  TEAM_ALIASES.map((entry) => [entry.footballDataName, entry.canonicalName]),
);

/**
 * Resuelve el nombre canónico (API-Football) para un nombre exacto de
 * football-data.co.uk. `undefined` si el nombre no está en la tabla de aliases: nunca se
 * intenta un match aproximado.
 */
export function resolveCanonicalTeamName(footballDataName: string): string | undefined {
  return FOOTBALL_DATA_NAME_INDEX.get(footballDataName);
}
