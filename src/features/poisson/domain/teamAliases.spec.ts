import {
  datasetAliasCount,
  resolveExactAlias,
  resolveCanonicalTeamName,
  resolveCanonicalTeamNameForDataset,
  TEAM_ALIASES,
} from './teamAliases';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('resolveCanonicalTeamName', () => {
  it('resuelve equipos sin alias (identico en football-data.co.uk y canonical)', () => {
    expect(resolveCanonicalTeamName('Aston Villa')).toBe('Aston Villa');
    expect(resolveCanonicalTeamName('Crystal Palace')).toBe('Crystal Palace');
  });

  it('resuelve aliases Portugal y Bélgica de forma exacta, sin fallback fuzzy', () => {
    expect(resolveCanonicalTeamNameForDataset('primeira-liga', 'Sp Lisbon')).toBe('Sporting CP');
    expect(resolveCanonicalTeamNameForDataset('primeira-liga', 'sp lisbon')).toBeUndefined();
    expect(resolveCanonicalTeamNameForDataset('belgian-pro-league', 'Club Brugge')).toBe(
      'Club Brugge KV',
    );
    expect(resolveCanonicalTeamNameForDataset('belgian-pro-league', 'ClubBrugge')).toBeUndefined();
  });

  it.each([
    ['la-liga', 'Ath Bilbao', 'Athletic Club'],
    ['serie-a', 'Milan', 'AC Milan'],
    ['bundesliga', 'Dortmund', 'Borussia Dortmund'],
    ['ligue-1', 'Paris SG', 'Paris Saint Germain'],
    ['eredivisie', 'PSV Eindhoven', 'PSV Eindhoven'],
  ])('resuelve alias manual europeo exacto para %s', (dataset, source, canonical) => {
    expect(resolveCanonicalTeamNameForDataset(dataset, source)).toBe(canonical);
    expect(resolveCanonicalTeamNameForDataset(dataset, source.toLowerCase())).toBeUndefined();
  });

  it('usa nombres canónicos verificados contra API-Football en ticks reales', () => {
    // Verificados en vivo el 2026-09-18 (auditoria de cobertura; sin fuzzy matching).
    expect(resolveCanonicalTeamNameForDataset('bundesliga', "M'gladbach")).toBe(
      'Borussia Mönchengladbach',
    );
    expect(resolveCanonicalTeamNameForDataset('bundesliga', 'FC Koln')).toBe('1. FC Köln');
    expect(resolveCanonicalTeamNameForDataset('bundesliga', 'Mainz')).toBe('FSV Mainz 05');
    expect(resolveCanonicalTeamNameForDataset('bundesliga', 'Schalke 04')).toBe('FC Schalke 04');
    expect(resolveCanonicalTeamNameForDataset('bundesliga', 'Stuttgart')).toBe('VfB Stuttgart');
    expect(resolveCanonicalTeamNameForDataset('ligue-1', 'Brest')).toBe('Stade Brestois 29');
    expect(resolveCanonicalTeamNameForDataset('ligue-1', 'Troyes')).toBe('Estac Troyes');
    expect(resolveCanonicalTeamNameForDataset('belgian-pro-league', 'Beveren')).toBe('SK Beveren');
    expect(resolveCanonicalTeamNameForDataset('belgian-pro-league', 'Waregem')).toBe(
      'Zulte Waregem',
    );
    expect(resolveCanonicalTeamNameForDataset('belgian-pro-league', 'RAAL La Louviere')).toBe(
      'RAAL La Louvière',
    );
    expect(resolveCanonicalTeamNameForDataset('mls', 'LA Galaxy')).toBe('Los Angeles Galaxy');
    expect(resolveCanonicalTeamNameForDataset('mls', 'Minnesota United')).toBe(
      'Minnesota United FC',
    );
    expect(resolveCanonicalTeamNameForDataset('mls', 'Montreal CF')).toBe('CF Montreal');
    expect(resolveCanonicalTeamNameForDataset('mls', 'Atlanta United')).toBe('Atlanta United FC');
  });

  it.each([
    ['la-liga', 26],
    ['serie-a', 24],
    ['bundesliga', 23],
    ['ligue-1', 23],
    ['eredivisie', 23],
  ])('mantiene %i aliases explícitos para %s', (dataset, expected) => {
    expect(datasetAliasCount(dataset)).toBe(expected);
  });

  it('falla cerrada ante alias sin resolver o colisión de identidad', () => {
    expect(resolveCanonicalTeamNameForDataset('la-liga', 'Athletic Bilbao')).toBeUndefined();
    expect(
      resolveExactAlias(
        [
          { sourceName: 'United', canonicalName: 'Team A' },
          { sourceName: 'United', canonicalName: 'Team B' },
        ],
        'United',
      ),
    ).toBeUndefined();
  });

  it('resuelve los aliases explicitos documentados en KSS-HISTORY-GATE-01B', () => {
    expect(resolveCanonicalTeamName('Hull')).toBe('Hull City');
    expect(resolveCanonicalTeamName('Man City')).toBe('Manchester City');
    expect(resolveCanonicalTeamName('Man United')).toBe('Manchester United');
    expect(resolveCanonicalTeamName("Nott'm Forest")).toBe('Nottingham Forest');
  });

  it('resuelve los equipos descendidos antes de 2026/27 presentes en el histórico', () => {
    expect(resolveCanonicalTeamName('Leicester')).toBe('Leicester City');
    expect(resolveCanonicalTeamName('West Ham')).toBe('West Ham United');
    expect(resolveCanonicalTeamName('Wolves')).toBe('Wolverhampton Wanderers');
    expect(resolveCanonicalTeamName('Burnley')).toBe('Burnley');
    expect(resolveCanonicalTeamName('Southampton')).toBe('Southampton');
  });

  it('no hace fuzzy matching: nombre no exacto no resuelve', () => {
    expect(resolveCanonicalTeamName('Man Utd')).toBeUndefined();
    expect(resolveCanonicalTeamName('arsenal')).toBeUndefined();
    expect(resolveCanonicalTeamName('Unknown FC')).toBeUndefined();
  });

  it('tiene 25 equipos únicos (temporadas 2024/25, 2025/26, 2026/27)', () => {
    expect(TEAM_ALIASES).toHaveLength(25);
    const ids = new Set(TEAM_ALIASES.map((entry) => entry.canonicalTeamId));
    expect(ids.size).toBe(25);
  });

  it('cubre todos los nombres de equipo presentes en cada dataset versionado', () => {
    // Regresión: cualquier nombre nuevo en un CSV exige un alias explícito; nunca
    // fuzzy. Un nombre sin resolver pierde partidos históricos silenciosamente.
    const dataRoot = join(process.cwd(), 'resources', 'data');
    const files: Record<string, readonly string[]> = {
      'la-liga': ['2425-SP1.csv', '2526-SP1.csv', '2627-SP1.csv'],
      'serie-a': ['2425-I1.csv', '2526-I1.csv', '2627-I1.csv'],
      bundesliga: ['2425-D1.csv', '2526-D1.csv', '2627-D1.csv'],
      'ligue-1': ['2425-F1.csv', '2526-F1.csv', '2627-F1.csv'],
      eredivisie: ['2425-N1.csv', '2526-N1.csv', '2627-N1.csv'],
      'primeira-liga': ['2425-P1.csv', '2526-P1.csv', '2627-P1.csv'],
      'belgian-pro-league': ['2425-B1.csv', '2526-B1.csv', '2627-B1.csv'],
      mls: ['mls_matches_2024.csv', 'mls_matches_2025.csv', 'mls_matches_2026.csv'],
      championship: ['2425-E1.csv', '2526-E1.csv', '2627-E1.csv'],
      'scottish-premiership': ['2425-SC0.csv', '2526-SC0.csv', '2627-SC0.csv'],
      'super-lig': ['2425-T1.csv', '2526-T1.csv', '2627-T1.csv'],
    };
    for (const [dataset, datasetFiles] of Object.entries(files)) {
      for (const file of datasetFiles) {
        const content = readFileSync(join(dataRoot, dataset, file), 'utf-8');
        const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const header = lines[0]!.split(',');
        const homeIdx = header.indexOf('HomeTeam');
        const awayIdx = header.indexOf('AwayTeam');
        for (const line of lines.slice(1)) {
          const cols = line.split(',');
          for (const idx of [homeIdx, awayIdx]) {
            const name = cols[idx];
            if (name === undefined || name === '') continue;
            expect(resolveCanonicalTeamNameForDataset(dataset, name)).toBeDefined();
          }
        }
      }
    }
  });
});
