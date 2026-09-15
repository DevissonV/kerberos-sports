import { randomUUID } from 'node:crypto';
import { flushQuantBets } from './flushQuantBets';
import { runQuantPipeline } from './quantPipeline';
import type { PreparedQuantBet } from './quantPipeline';
import { SqlitePaperBetStore } from '../../paper-betting/adapters/sqlitePaperBetStore';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import type { PaperBetStore } from '../../paper-betting/ports/paperBetStore';
import type { ScanCandidate } from '../../scanning/application/scanPipeline';
import type { Fixture, OddsPair } from '../../scanning/domain/concepts';
import type { HistoricalMatch } from '../../poisson/domain/concepts';
import { PROTOCOL_COHORT_ID } from '../../scanning/domain/protocol';

const KICKOFF = '2026-09-20T19:00:00Z';
const SNAPSHOT = new Date(new Date(KICKOFF).getTime() - 6 * 60 * 60 * 1000);
const NOW = new Date('2026-09-20T14:00:00Z');

/** Historico determinista: 210 partidos 1-1 -> lambdaTotal=2 exacto. */
function balancedHistory(): readonly HistoricalMatch[] {
  return Array.from({ length: 210 }, (_, i): HistoricalMatch => ({
    date: new Date(SNAPSHOT.getTime() - (8 + (i % 100)) * 24 * 60 * 60 * 1000),
    homeTeam: 'TeamA',
    awayTeam: 'TeamB',
    homeGoals: 1,
    awayGoals: 1,
    result: 'D',
  }));
}

/** Par con lado UNDER con edge positivo (fairUnder 0.59, cuota 2.0). */
function underPairFor(fixtureId: string, bookmaker = 'pinnacle'): OddsPair {
  const capturedAt = new Date('2026-09-20T14:00:00Z');
  const rawUnder = 0.5;
  const rawOver = rawUnder * ((1 - 0.41) / 0.41);
  return {
    fixtureId,
    bookmaker,
    over: { bookmaker, selection: 'OVER_2_5', decimalOdds: 1 / rawOver, capturedAt },
    under: { bookmaker, selection: 'UNDER_2_5', decimalOdds: 1 / rawUnder, capturedAt },
  };
}

function candidateFor(fixtureId: string, team: string, pairs: OddsPair[]): ScanCandidate {
  const fixture = {
    id: fixtureId,
    sport: 'FOOTBALL' as const,
    league: 'Premier League',
    leagueId: 39,
    country: 'England',
    homeTeam: `Home${team}`,
    awayTeam: `Away${team}`,
    kickoffAt: new Date(KICKOFF),
    status: 'NS',
  } satisfies Fixture;
  return {
    fixture,
    pair: pairs[0]!,
    pairs,
    fairOverProbability: 0.5,
    fairUnderProbability: 0.5,
    model: 'NOT_YET_AVAILABLE' as const,
    edge: 0,
    decision: 'NO_BET_PIPELINE_ONLY' as const,
    kickoffAt: new Date(KICKOFF),
    decisionAt: SNAPSHOT,
    snapshotAt: SNAPSHOT,
  };
}

function pipelineFor(
  store: PaperBetStore,
  fixtureId = '90011',
  openStakesSum = 0,
): PreparedQuantBet[] {
  const out = runQuantPipeline({
    candidates: [candidateFor(fixtureId, fixtureId.slice(-1), [underPairFor(fixtureId)])],
    historicalMatches: balancedHistory(),
    now: NOW,
    initialBankroll: 1000,
    openStakesSum,
    settledPnlSum: 0,
    findExistingBet: (key) => store.findByIdempotencyKey(key),
  });
  return out.prepared;
}

describe('flushQuantBets', () => {
  let store: SqlitePaperBetStore;
  let sent: string[];

  beforeEach(() => {
    store = new SqlitePaperBetStore(':memory:');
    sent = [];
  });

  afterEach(() => {
    store.close();
  });

  function flush(prepared: readonly PreparedQuantBet[]) {
    return flushQuantBets({
      prepared,
      store,
      send: (message: string) => {
        sent.push(message);
        return Promise.resolve();
      },
      messageFor: (bet: PaperBet) => `PAPER ${bet.homeTeam} vs ${bet.awayTeam} ${bet.selection}`,
      newId: () => randomUUID(),
    });
  }

  it('PaperBet nueva se persiste con los datos QUANT completos y se notifica', async () => {
    const result = await flush(pipelineFor(store));
    expect(result.paperBetsCreated).toBe(1);
    expect(result.telegramSent).toBe(1);
    expect(result.duplicatesSkipped).toBe(0);
    expect(sent).toHaveLength(1);

    const stored = store.listByStatus('OPEN');
    expect(stored).toHaveLength(1);
    const bet = stored[0]!;
    expect(bet.cohortId).toBe(PROTOCOL_COHORT_ID);
    expect(bet.fixtureId).toBe(90011);
    expect(bet.market).toBe('OVER_UNDER_2_5');
    expect(bet.selection).toBe('UNDER_2_5');
    expect(bet.modelVersion).toBe('poisson-v1');
    expect(bet.lambdaTotal).toBeCloseTo(2, 6);
    expect(bet.status).toBe('OPEN');
    expect(bet.snapshotAt.toISOString()).toBe(SNAPSHOT.toISOString());
    expect(bet.minimumAcceptableOdds).toBeCloseTo(1.03 / bet.modelProbability, 4);
  });

  it('segunda corrida con el mismo fixture: SKIP_DUPLICATE, sin Telegram', async () => {
    await flush(pipelineFor(store));
    // La segunda corrida del pipeline ya no prepara nada (creen que ya existe la bet):
    const secondRun = runQuantPipeline({
      candidates: [candidateFor('90011', '1', [underPairFor('90011')])],
      historicalMatches: balancedHistory(),
      now: NOW,
      initialBankroll: 1000,
      openStakesSum: 0,
      settledPnlSum: 0,
      findExistingBet: (key) => store.findByIdempotencyKey(key),
    });
    expect(secondRun.prepared).toHaveLength(0);
    expect(secondRun.duplicates).toHaveLength(1);
    expect(secondRun.duplicates[0]).toEqual({
      cohortId: PROTOCOL_COHORT_ID,
      fixtureId: 90011,
      market: 'OVER_UNDER_2_5',
      selection: 'UNDER_2_5',
      modelVersion: 'poisson-v1',
    });

    const secondFlush = await flush([]);
    expect(secondFlush.paperBetsCreated).toBe(0);
    expect(secondFlush.telegramSent).toBe(0);
    expect(sent).toHaveLength(1);
    expect(store.listByStatus('OPEN')).toHaveLength(1);
  });

  it('Telegram SOLO para PaperBet NUEVA; fixture distinto si envia uno mas', async () => {
    await flush(pipelineFor(store));
    expect(sent).toHaveLength(1);
    const other = pipelineFor(store, '90022', 10);
    await flush(other);
    expect(sent).toHaveLength(2);
    expect(store.listByStatus('OPEN')).toHaveLength(2);
  });
});
