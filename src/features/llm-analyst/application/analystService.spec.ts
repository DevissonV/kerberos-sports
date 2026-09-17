import { AnalystService, selectAnalystShortlist } from './analystService';
import type { AnalystProvider } from '../ports/analystProvider';
import type { AnalystRecord, AnalystStore } from '../ports/analystStore';
import type { QuantFixtureAnalysis } from '../../quant/application/quantPipeline';

const fixture = (id: string, kickoff = '2026-09-20T18:00:00.000Z') => ({
  id,
  sport: 'FOOTBALL' as const,
  league: 'Premier League',
  homeTeam: `Home ${id}`,
  awayTeam: `Away ${id}`,
  kickoffAt: new Date(kickoff),
  status: 'NS',
});

function analysis(id: string, probability: number): QuantFixtureAnalysis {
  return {
    fixture: fixture(id),
    pair: {} as QuantFixtureAnalysis['pair'],
    model: {
      modelVersion: 'poisson-v1',
      snapshotAt: new Date('2026-09-20T12:00:00.000Z'),
      fixtureId: id,
      league: 'Premier League',
      home: `Home ${id}`,
      away: `Away ${id}`,
      leagueHomeGoalsMean: 1.4,
      leagueAwayGoalsMean: 1.2,
      dataQuality: [],
      lambdaHome: 1.4,
      lambdaAway: 1.2,
      lambdaTotal: 2.6,
      pOver: probability,
      pUnder: 1 - probability,
      homeRoleMatches: 10,
      awayRoleMatches: 10,
    },
    decision: 'NO_BET',
  };
}

const validOutput = (id: string) => ({
  fixtureId: id,
  contextScore: 70,
  priority: 'HIGH' as const,
  alerts: ['alerta'],
  supportingFactors: ['factor'],
  contradictingFactors: [],
  suggestedMarketsToInvestigate: ['BTTS'],
  summary: 'Contexto disponible',
  confidenceInContext: 'MEDIUM' as const,
});

function setup(
  response: ReturnType<AnalystProvider['infer']> extends Promise<infer T> ? T : never,
) {
  const infer = jest.fn().mockResolvedValue(response);
  const provider: AnalystProvider = { infer };
  const records = new Map<string, AnalystRecord>();
  const store: AnalystStore = {
    findByCacheKey: jest.fn((key) => records.get(key) ?? null),
    save: jest.fn((record) =>
      records.set(
        [
          record.fixtureId,
          record.snapshotAt.toISOString(),
          record.inputHash,
          record.promptVersion,
        ].join(':'),
        record,
      ),
    ),
  };
  return { service: new AnalystService(provider, store), infer, store };
}

describe('AnalystService', () => {
  it('valida salida, limita presupuesto y mantiene contexto separado', async () => {
    const { service, infer } = setup({
      output: JSON.stringify(validOutput('a')),
      status: 'SUCCESS',
      provider: 'test',
      model: 'cheap',
    });
    const result = await service.analyze(
      [analysis('a', 0.9), analysis('b', 0.51)],
      new Date('2026-09-20T12:00:00Z'),
      { enabled: true, maxAnalyses: 1 },
    );
    expect(result.selected).toBe(1);
    expect(result.skipped).toBe(1);
    expect(infer).toHaveBeenCalledTimes(1);
    const record = result.records[0];
    expect(record?.output?.contextScore).toBe(70);
    expect(record?.output).not.toHaveProperty('stake');
  });

  it('cierra ante JSON inválido, timeout/proveedor y flag desactivada', async () => {
    const invalid = setup({ output: '{bad', status: 'SUCCESS', provider: 'test', model: 'cheap' });
    expect(
      (
        await invalid.service.analyze([analysis('a', 0.7)], new Date(), {
          enabled: true,
          maxAnalyses: 5,
        })
      ).failures,
    ).toBe(1);
    const unavailable = setup({ output: '', status: 'TIMEOUT', provider: 'test', model: 'cheap' });
    expect(
      (
        await unavailable.service.analyze([analysis('a', 0.7)], new Date(), {
          enabled: true,
          maxAnalyses: 5,
        })
      ).failures,
    ).toBe(1);
    const disabled = setup({
      output: JSON.stringify(validOutput('a')),
      status: 'SUCCESS',
      provider: 'test',
      model: 'cheap',
    });
    const result = await disabled.service.analyze([analysis('a', 0.7)], new Date(), {
      enabled: false,
      maxAnalyses: 5,
    });
    expect(result.skipped).toBe(1);
    expect(disabled.infer).not.toHaveBeenCalled();
  });

  it('usa caché de forma idempotente', async () => {
    const { service, infer } = setup({
      output: JSON.stringify(validOutput('a')),
      status: 'SUCCESS',
      provider: 'test',
      model: 'cheap',
    });
    const now = new Date('2026-09-20T12:00:00Z');
    await service.analyze([analysis('a', 0.7)], now, { enabled: true, maxAnalyses: 5 });
    const second = await service.analyze([analysis('a', 0.7)], now, {
      enabled: true,
      maxAnalyses: 5,
    });
    expect(infer).toHaveBeenCalledTimes(1);
    expect(second.cacheHits).toBe(1);
  });
});

describe('selectAnalystShortlist', () => {
  it('ordena por señal y desempata por fixtureId', () => {
    expect(
      selectAnalystShortlist([analysis('b', 0.9), analysis('a', 0.9)], 2).map((x) => x.fixture.id),
    ).toEqual(['a', 'b']);
  });
});
