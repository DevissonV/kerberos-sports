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

/** Entrada de una tabla exacta entre un proveedor y la identidad canónica local. */
export interface ExactTeamAlias {
  sourceName: string;
  canonicalName: string;
}

/**
 * Resuelve exclusivamente una clave textual exacta. Si un origen fue cargado dos veces con
 * identidades distintas, la resolución es ambigua y falla cerrada.
 */
export function resolveExactAlias(
  aliases: readonly ExactTeamAlias[],
  sourceName: string,
): string | undefined {
  const candidates = new Set(
    aliases.filter((entry) => entry.sourceName === sourceName).map((entry) => entry.canonicalName),
  );
  return candidates.size === 1 ? [...candidates][0] : undefined;
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
 * Crosswalks locales versionados para datasets multiliga. Los valores son identidades canónicas
 * locales; no hay normalización ni fuzzy matching. Una tabla local no acredita por sí sola la
 * identidad en API-Football/OddsPapi: esa evidencia se exige antes de promover una liga.
 */
const DATASET_TEAM_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'la-liga': {
    Alaves: 'Alaves',
    'Ath Bilbao': 'Athletic Club',
    'Ath Madrid': 'Atletico Madrid',
    Barcelona: 'Barcelona',
    Betis: 'Real Betis',
    Celta: 'Celta Vigo',
    Elche: 'Elche',
    Espanol: 'Espanyol',
    Getafe: 'Getafe',
    Girona: 'Girona',
    'La Coruna': 'Deportivo La Coruna',
    'Las Palmas': 'Las Palmas',
    Leganes: 'Leganes',
    Levante: 'Levante',
    Malaga: 'Malaga',
    Mallorca: 'Mallorca',
    Osasuna: 'Osasuna',
    Oviedo: 'Oviedo',
    'Real Madrid': 'Real Madrid',
    Santander: 'Racing Santander',
    Sevilla: 'Sevilla',
    Sociedad: 'Real Sociedad',
    Valencia: 'Valencia',
    Valladolid: 'Valladolid',
    Vallecano: 'Rayo Vallecano',
    Villarreal: 'Villarreal',
  },
  'serie-a': {
    Atalanta: 'Atalanta',
    Bologna: 'Bologna',
    Cagliari: 'Cagliari',
    Como: 'Como',
    Cremonese: 'Cremonese',
    Empoli: 'Empoli',
    Fiorentina: 'Fiorentina',
    Frosinone: 'Frosinone',
    Genoa: 'Genoa',
    Inter: 'Inter',
    Juventus: 'Juventus',
    Lazio: 'Lazio',
    Lecce: 'Lecce',
    Milan: 'AC Milan',
    Monza: 'Monza',
    Napoli: 'Napoli',
    Parma: 'Parma',
    Pisa: 'Pisa',
    Roma: 'AS Roma',
    Sassuolo: 'Sassuolo',
    Torino: 'Torino',
    Udinese: 'Udinese',
    Venezia: 'Venezia',
    Verona: 'Verona',
  },
  bundesliga: {
    Augsburg: 'Augsburg',
    'Bayern Munich': 'Bayern Munich',
    Bochum: 'Bochum',
    Dortmund: 'Borussia Dortmund',
    'Ein Frankfurt': 'Eintracht Frankfurt',
    Elversberg: 'Elversberg',
    'FC Koln': 'FC Koln',
    Freiburg: 'Freiburg',
    Hamburg: 'Hamburger SV',
    Heidenheim: 'Heidenheim',
    Hoffenheim: 'Hoffenheim',
    'Holstein Kiel': 'Holstein Kiel',
    Leverkusen: 'Bayer Leverkusen',
    "M'gladbach": 'Borussia Monchengladbach',
    Mainz: 'Mainz 05',
    Paderborn: 'Paderborn',
    'RB Leipzig': 'RB Leipzig',
    'Schalke 04': 'Schalke 04',
    'St Pauli': 'FC St. Pauli',
    Stuttgart: 'Stuttgart',
    'Union Berlin': 'Union Berlin',
    'Werder Bremen': 'Werder Bremen',
    Wolfsburg: 'Wolfsburg',
  },
  'ligue-1': {
    Angers: 'Angers',
    Auxerre: 'Auxerre',
    Brest: 'Brest',
    'Le Havre': 'Le Havre',
    'Le Mans': 'Le Mans',
    Lens: 'Lens',
    Lille: 'Lille',
    Lorient: 'Lorient',
    Lyon: 'Lyon',
    Marseille: 'Marseille',
    Metz: 'Metz',
    Monaco: 'Monaco',
    Montpellier: 'Montpellier',
    Nantes: 'Nantes',
    Nice: 'Nice',
    'Paris FC': 'Paris FC',
    'Paris SG': 'Paris Saint Germain',
    Reims: 'Reims',
    Rennes: 'Rennes',
    'St Etienne': 'Saint Etienne',
    Strasbourg: 'Strasbourg',
    Toulouse: 'Toulouse',
    Troyes: 'Troyes',
  },
  eredivisie: {
    'AZ Alkmaar': 'AZ Alkmaar',
    Ajax: 'Ajax',
    'Almere City': 'Almere City FC',
    Cambuur: 'Cambuur',
    'Den Haag': 'ADO Den Haag',
    Excelsior: 'Excelsior',
    Feyenoord: 'Feyenoord',
    'For Sittard': 'Fortuna Sittard',
    'Go Ahead Eagles': 'GO Ahead Eagles',
    Groningen: 'Groningen',
    Heerenveen: 'Heerenveen',
    Heracles: 'Heracles',
    'NAC Breda': 'NAC Breda',
    Nijmegen: 'NEC Nijmegen',
    'PSV Eindhoven': 'PSV',
    'Sparta Rotterdam': 'Sparta Rotterdam',
    Telstar: 'Telstar',
    Twente: 'Twente',
    Utrecht: 'Utrecht',
    Volendam: 'FC Volendam',
    Waalwijk: 'RKC Waalwijk',
    'Willem II': 'Willem II',
    Zwolle: 'PEC Zwolle',
  },
  'primeira-liga': {
    AVS: 'AVS',
    'Academico Viseu': 'Academico Viseu',
    Alverca: 'Alverca',
    Arouca: 'Arouca',
    Benfica: 'Benfica',
    Boavista: 'Boavista',
    'Casa Pia': 'Casa Pia',
    Estoril: 'Estoril',
    Estrela: 'Estrela',
    Famalicao: 'Famalicao',
    Farense: 'Farense',
    'Gil Vicente': 'GIL Vicente',
    Guimaraes: 'Vitória SC',
    Maritimo: 'Maritimo',
    Moreirense: 'Moreirense',
    Nacional: 'Nacional',
    Porto: 'FC Porto',
    'Rio Ave': 'Rio Ave',
    'Santa Clara': 'Santa Clara',
    'Sp Braga': 'SC Braga',
    'Sp Lisbon': 'Sporting CP',
    Tondela: 'Tondela',
  },
  'belgian-pro-league': {
    Anderlecht: 'Anderlecht',
    Antwerp: 'Antwerp',
    'Beerschot VA': 'Beerschot VA',
    Beveren: 'Beveren',
    'Cercle Brugge': 'Cercle Brugge',
    Charleroi: 'Charleroi',
    'Club Brugge': 'Club Brugge KV',
    Dender: 'Dender',
    Genk: 'Genk',
    Gent: 'Gent',
    Kortrijk: 'Kortrijk',
    'Lommel SK': 'Lommel SK',
    Mechelen: 'KV Mechelen',
    'Oud-Heverlee Leuven': 'OH Leuven',
    'RAAL La Louviere': 'RAAL La Louviere',
    'St Truiden': 'St. Truiden',
    'St. Gilloise': 'Union St. Gilloise',
    Standard: 'Standard Liege',
    Waregem: 'Waregem',
    Westerlo: 'KVC Westerlo',
  },
};

/**
 * Resuelve el nombre canónico (API-Football) para un nombre exacto de
 * football-data.co.uk. `undefined` si el nombre no está en la tabla de aliases: nunca se
 * intenta un match aproximado.
 */
export function resolveCanonicalTeamName(footballDataName: string): string | undefined {
  return FOOTBALL_DATA_NAME_INDEX.get(footballDataName);
}

/** Resuelve solo aliases explícitos del dataset indicado; desconocido => `undefined`. */
export function resolveCanonicalTeamNameForDataset(
  dataset: string,
  footballDataName: string,
): string | undefined {
  if (dataset === 'premier-league') return resolveCanonicalTeamName(footballDataName);
  return DATASET_TEAM_ALIASES[dataset]?.[footballDataName];
}

/** Número de aliases explícitos de football-data.co.uk cargados para un dataset. */
export function datasetAliasCount(dataset: string): number {
  return Object.keys(DATASET_TEAM_ALIASES[dataset] ?? {}).length;
}
