jest.mock('@nestjs/common', () => ({
  Inject: () => () => undefined,
  Injectable: () => (target: unknown) => target,
}));

import { SqlitePredictionStore } from '../adapters/sqlitePredictionStore';
import { PredictionLedgerService } from './predictionLedgerService';
import type { ResultsProvider } from '../../scanning/ports/resultsProvider';
import type { NotificationPort } from '../../notifications/ports/notificationPort';

function setup(status = 'FT', goals: [number, number] = [3, 0]) {
  const store = new SqlitePredictionStore(':memory:');
  store.save({
    fixtureId: '1',
    league: 'A',
    homeTeam: 'H',
    awayTeam: 'A',
    kickoffAt: new Date('2026-09-18T12:00:00Z'),
    createdAt: new Date('2026-09-18T06:00:00Z'),
    snapshotAt: new Date('2026-09-18T06:00:00Z'),
    market: 'OVER_UNDER_2_5',
    selection: 'OVER_2_5',
    modelProbability: 0.65,
    modelVersion: 'v1',
    strategyVersion: 's1',
    predictionStage: 'PREANALYSIS',
    betAuthorized: false,
    betExecuted: false,
  });
  const resultMock = jest.fn().mockResolvedValue({
    fixtureId: '1',
    status,
    fulltimeHome: goals[0],
    fulltimeAway: goals[1],
    finishedAt: new Date('2026-09-18T14:00:00Z'),
  });
  const results: ResultsProvider = { result: resultMock };
  const sendMock = jest.fn().mockResolvedValue(undefined);
  const notifications: NotificationPort = { send: sendMock };
  return {
    store,
    resultMock,
    sendMock,
    service: new PredictionLedgerService(store, results, notifications),
  };
}

describe('PredictionLedgerService', () => {
  it('persiste PREANALYSIS sin odds y es idempotente entre heartbeats', () => {
    const { service, store } = setup();
    const snapshotAt = new Date('2026-09-18T05:00:00Z');
    const model = {
      modelVersion: 'poisson-v1' as const,
      snapshotAt,
      fixtureId: '42',
      league: 'Premier League',
      home: 'H',
      away: 'A',
      leagueHomeGoalsMean: 1.4,
      leagueAwayGoalsMean: 1.1,
      homeRoleMatches: 20,
      awayRoleMatches: 20,
      lambdaHome: 1.5,
      lambdaAway: 1.1,
      lambdaTotal: 2.6,
      pOver: 0.58,
      pUnder: 0.42,
      dataQuality: [],
    };
    const analysis = {
      fixture: {
        id: '42',
        sport: 'FOOTBALL' as const,
        league: 'Premier League',
        leagueId: 39,
        country: 'England',
        homeTeam: 'H',
        awayTeam: 'A',
        kickoffAt: new Date('2026-09-18T20:00:00Z'),
        status: 'NS' as const,
      },
      snapshotAt,
      snapshotType: 'PREANALYSIS' as const,
      model,
      decision: 'PREANALYSIS' as const,
    };
    const first = service.recordPreanalysis(analysis);
    expect(first).toMatchObject({
      fixtureId: '42',
      predictionStage: 'PREANALYSIS',
      betAuthorized: false,
    });
    expect(first.oddsAtPrediction).toBeUndefined();
    const repeat = service.recordPreanalysis({
      ...analysis,
      snapshotAt: new Date('2026-09-18T06:00:00Z'),
    });
    expect(repeat.predictionId).toBe(first.predictionId);
    const rowsForFixture = store.list().filter((entry) => entry.fixtureId === '42');
    expect(rowsForFixture).toHaveLength(1);
  });

  it('liquida marcador final de forma idempotente', async () => {
    const { service, store, resultMock } = setup();
    await expect(service.settlePending(new Date('2026-09-18T15:00:00Z'))).resolves.toMatchObject({
      settled: 1,
    });
    await expect(service.settlePending(new Date('2026-09-18T16:00:00Z'))).resolves.toMatchObject({
      inspected: 0,
      settled: 0,
    });
    expect(resultMock).toHaveBeenCalledTimes(1);
    expect(store.list()[0]).toMatchObject({
      result: 'HIT',
      finalScoreHome: 3,
      finalScoreAway: 0,
      totalGoals: 3,
    });
  });

  it('no trata como fallo un partido pendiente', async () => {
    const { service, store } = setup('NS', [0, 0]);
    await expect(service.settlePending(new Date('2026-09-18T15:00:00Z'))).resolves.toMatchObject({
      pending: 1,
      settled: 0,
    });
    expect(store.list()[0]?.result).toBe('PENDING');
  });

  it('deduplica heartbeat material y permite un cambio', () => {
    const { service } = setup();
    const now = new Date();
    expect(service.shouldSendEvent('heartbeat', { fixtures: ['1'], probability: 658 }, now)).toBe(
      true,
    );
    expect(service.shouldSendEvent('heartbeat', { fixtures: ['1'], probability: 658 }, now)).toBe(
      false,
    );
    expect(
      service.shouldSendEvent('heartbeat', { fixtures: ['1', '2'], probability: 658 }, now),
    ).toBe(true);
  });

  it('genera una vez el reporte diario usando fecha America/Bogota', async () => {
    const { service, sendMock } = setup();
    const now = new Date('2026-09-19T03:45:00Z'); // 22:45 del 18 en Bogotá
    await expect(service.sendDailyReportIfDue(now, '22:30')).resolves.toBe(true);
    await expect(service.sendDailyReportIfDue(now, '22:30')).resolves.toBe(false);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('18 de sept'));
  });
});
