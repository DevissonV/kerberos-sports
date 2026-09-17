import { SqliteModelAnalysisStore } from './sqliteModelAnalysisStore';
import { runModelAnalysis } from '../domain/modelAnalysis';
import type { Fixture } from '../../scanning/domain/concepts';
import type { HistoricalMatch } from '../../poisson/domain/concepts';

const fixture: Fixture = {
  id: '1',
  sport: 'FOOTBALL',
  league: 'Premier League',
  leagueId: 39,
  country: 'England',
  homeTeam: 'A',
  awayTeam: 'B',
  kickoffAt: new Date('2026-09-21T12:00:00Z'),
  status: 'NS',
};
const history: HistoricalMatch[] = Array.from({ length: 220 }, (_, i) => ({
  date: new Date(new Date('2026-09-19T00:00:00Z').getTime() - i * 86400000),
  homeTeam: 'A',
  awayTeam: 'B',
  homeGoals: 1,
  awayGoals: 1,
  result: 'D',
}));

describe('SqliteModelAnalysisStore', () => {
  it('persiste un snapshot PREANALYSIS de forma idempotente', () => {
    const store = new SqliteModelAnalysisStore(':memory:');
    const analysis = runModelAnalysis([fixture], () => history, new Date('2026-09-20T12:00:00Z'))
      .analyses[0]!;
    store.saveModelAnalysis(analysis);
    store.saveModelAnalysis(analysis);
    expect(store.findLatest('1', 'PREANALYSIS')?.model.fixtureId).toBe('1');
    expect(store.listLatest('PREANALYSIS')).toHaveLength(1);
    store.close();
  });
});
