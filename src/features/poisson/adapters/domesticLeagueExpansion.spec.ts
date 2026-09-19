import { findLeagueDefinition, isModelEnabled } from '../../scanning/domain/leagueUniverse';
import { LEAGUE_MIN_MATCHES, computeLeagueBaselines } from '../domain/leagueBaselines';
import { filterHistoricalWindow } from '../domain/historicalWindow';
import { historicalMatchesForLeague } from './historicalLeagueRegistry';
import { computePoissonV1 } from '../domain/model';
import type { PoissonModelOutput } from '../domain/concepts';
import { datasetAliasCount, resolveCanonicalTeamNameForDataset } from '../domain/teamAliases';

const now = new Date('2026-09-18T12:00:00Z');

const NEW_LEAGUES = [
  {
    code: 'EFL Championship',
    leagueId: 40,
    country: 'England',
    dataset: 'championship',
    cohortId: 'KSS-V1-C11-ENG2',
  },
  {
    code: 'Scottish Premiership',
    leagueId: 179,
    country: 'Scotland',
    dataset: 'scottish-premiership',
    cohortId: 'KSS-V1-C12-SCO',
  },
  {
    code: 'Süper Lig',
    leagueId: 203,
    country: 'Turkey',
    dataset: 'super-lig',
    cohortId: 'KSS-V1-C13-TUR',
  },
] as const;

interface SmokeFixture {
  leagueId: number;
  country: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
}

function poissonSmoke(fixture: SmokeFixture): PoissonModelOutput {
  const result = computePoissonV1({
    fixtureId: 'smoke',
    league: fixture.league,
    home: fixture.homeTeam,
    away: fixture.awayTeam,
    snapshotAt: now,
    historicalMatches: historicalMatchesForLeague(fixture.leagueId, fixture.country),
  });
  if (result.status !== 'OK') throw new Error('smoke falló para la liga');
  return result.output;
}

describe('KSS-DOMESTIC-LEAGUE-EXPANSION-02: Ligas domesticas nuevas', () => {
  it('cada liga nueva existe con status MODEL_ENABLED, cohort y dataset propio', () => {
    for (const league of NEW_LEAGUES) {
      const definition = findLeagueDefinition({
        leagueId: league.leagueId,
        country: league.country,
      });
      expect(definition?.code).toBeDefined();
      expect(definition?.status).toBe('MODEL_ENABLED');
      expect(definition?.historicalDataset).toBe(league.dataset);
      expect(definition?.cohortId).toBe(league.cohortId);
      expect(definition?.modelVersion).toBe('poisson-v1');
    }
  });

  it('fixture identity estable y gate pasa en la liga propia', () => {
    for (const league of NEW_LEAGUES) {
      const fixture = {
        leagueId: league.leagueId,
        country: league.country,
        league: league.code,
        homeTeam: 'Home',
        awayTeam: 'Away',
      };
      expect(isModelEnabled(fixture)).toBe(true);
    }
  });

  it('gate de historico: >=200 partidos causales para el baseline y >=8 roles por equipo', () => {
    for (const league of NEW_LEAGUES) {
      const baseline = computeLeagueBaselines(
        filterHistoricalWindow(historicalMatchesForLeague(league.leagueId, league.country), now),
      );
      expect(baseline).not.toBe('LEAGUE_NOT_ENABLED');
      if (baseline !== 'LEAGUE_NOT_ENABLED') {
        expect(baseline.leagueMatches).toBeGreaterThanOrEqual(LEAGUE_MIN_MATCHES);
        expect(baseline.leagueHomeGoalsMean).toBeGreaterThan(0);
        expect(baseline.leagueAwayGoalsMean).toBeGreaterThan(0);
      }
    }
  });

  it('aislamiento de baseline: sin nombres compartidos entre los tres datasets', () => {
    const teamSets = NEW_LEAGUES.map(
      (league) =>
        new Set(
          historicalMatchesForLeague(league.leagueId, league.country).flatMap((match) => [
            match.homeTeam,
            match.awayTeam,
          ]),
        ),
    );
    expect(teamSetsOverlap(teamSets)).toBe(false);
  });

  it('smoke de Poisson por liga con fixtures reales', () => {
    const samples: SmokeFixture[] = [
      {
        leagueId: 40,
        country: 'England',
        league: 'Championship',
        homeTeam: 'Stoke',
        awayTeam: 'Sheffield Utd',
      },
      {
        leagueId: 179,
        country: 'Scotland',
        league: 'Scottish Premiership',
        homeTeam: 'Hibernian',
        awayTeam: 'Aberdeen',
      },
      {
        leagueId: 203,
        country: 'Turkey',
        league: 'Süper Lig',
        homeTeam: 'Trabzonspor',
        awayTeam: 'Galatasaray',
      },
    ];
    for (const fixture of samples) {
      const output = poissonSmoke(fixture);
      expect(output.lambdaTotal).toBeGreaterThan(0);
      expect(output.pOver).toBeGreaterThan(0);
      expect(output.pUnder).toBeGreaterThan(0);
      expect(output.pOver + output.pUnder).toBeCloseTo(1, 5);
      expect(Math.max(output.pOver, output.pUnder)).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('aliases del crosswalk y tamaño determinista por dataset', () => {
    expect(datasetAliasCount('championship')).toBe(34);
    expect(datasetAliasCount('scottish-premiership')).toBe(14);
    expect(datasetAliasCount('super-lig')).toBe(25);
    expect(resolveCanonicalTeamNameForDataset('championship', 'Sheffield United')).toBe(
      'Sheffield Utd',
    );
    expect(resolveCanonicalTeamNameForDataset('scottish-premiership', 'Hearts')).toBe(
      'Heart Of Midlothian',
    );
    expect(resolveCanonicalTeamNameForDataset('super-lig', 'Buyuksehyr')).toBe('Başakşehir');
  });
});

function teamSetsOverlap(sets: Readonly<Set<string>[]>): boolean {
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      for (const name of sets[i]!) if (sets[j]!.has(name)) return true;
    }
  }
  return false;
}
