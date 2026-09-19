import { runModelAnalysis } from './modelAnalysis';
import type { Fixture } from '../../scanning/domain/concepts';
import type { HistoricalMatch } from '../../poisson/domain/concepts';

const now = new Date('2026-09-20T12:00:00Z');
const fixture: Fixture = {
  id: 't24',
  sport: 'FOOTBALL',
  league: 'Premier League',
  leagueId: 39,
  country: 'England',
  homeTeam: 'TeamA',
  awayTeam: 'TeamB',
  kickoffAt: new Date('2026-09-21T12:00:00Z'),
  status: 'NS',
};
const history: HistoricalMatch[] = Array.from({ length: 220 }, (_, i) => ({
  date: new Date(new Date('2026-09-19T00:00:00Z').getTime() - i * 86400000),
  homeTeam: 'TeamA',
  awayTeam: 'TeamB',
  homeGoals: 1,
  awayGoals: 1,
  result: 'D',
}));

describe('runModelAnalysis', () => {
  it('modela T-24 sin solicitar odds y conserva probabilidades Poisson', () => {
    const output = runModelAnalysis([fixture], () => history, now);
    expect(output.insufficientData).toBe(0);
    expect(output.aliasFailures).toBe(0);
    expect(output.analyses).toHaveLength(1);
    expect(output.analyses[0]?.snapshotType).toBe('PREANALYSIS');
    expect(output.analyses[0]?.model.pOver).toBeGreaterThan(0);
    expect(output.analyses[0]?.decision).toBe('PREANALYSIS');
  });

  it('no requiere odds en ninguna parte de su contrato', () => {
    const output = runModelAnalysis([fixture], () => history, now);
    expect(output.analyses[0]).not.toHaveProperty('pair');
    expect(output.analyses[0]).not.toHaveProperty('side');
  });

  it('marca histórico insuficiente sin inventar una decisión', () => {
    const output = runModelAnalysis([fixture], () => [], now);
    // El equipo no existe en el histórico con nombre canónico: ALIAS_FAILURE.
    expect(output).toEqual({ analyses: [], insufficientData: 0, aliasFailures: 1 });
  });

  it('excluye ALIAS_FAILURE antes de modelar y lo atribuye aparte de INSUFFICIENT_DATA', () => {
    const unknownTeam: Fixture = { ...fixture, id: 'alias-fail', awayTeam: 'Equipo Sin Historial' };
    const output = runModelAnalysis([unknownTeam], () => history, now);
    expect(output.analyses).toHaveLength(0);
    expect(output.aliasFailures).toBe(1);
    expect(output.insufficientData).toBe(0);
  });

  it('modela con shrinkage un equipo presente pero con rol por debajo del mínimo', () => {
    const scarce: HistoricalMatch[] = [
      ...history.slice(0, 6),
      ...Array.from({ length: 200 }, (_, i) => ({
        ...history[i]!,
        homeTeam: 'Filler',
        awayTeam: 'Filler2',
      })),
    ];
    const output = runModelAnalysis([fixture], () => scarce, now);
    expect(output.aliasFailures).toBe(0);
    expect(output.analyses).toHaveLength(1);
    expect(output.analyses[0]?.model.dataQuality).toContain('HOME_INSUFFICIENT_ROLE_HISTORY');
  });
});
