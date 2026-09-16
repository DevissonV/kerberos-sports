import { runQuantPipeline, idempotencyKeyOf, QUANT_GATE } from './quantPipeline';
import type { ScanCandidate } from '../../scanning/application/scanPipeline';
import type { Fixture, OddsPair } from '../../scanning/domain/concepts';
import type { HistoricalMatch } from '../../poisson/domain/concepts';
import { decisionAtFromKickoff } from '../../scanning/domain/decisionWindow';
import { PROTOCOL_COHORT_ID } from '../../scanning/domain/protocol';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import { computePoissonV1 } from '../../poisson/domain/model';
import type { QuantSideEvaluation } from '../domain/quantCandidate';

const KICKOFF = '2026-09-20T19:00:00Z';
const NOW = new Date('2026-09-20T14:00:00Z');
const SNAPSHOT = decisionAtFromKickoff(new Date(KICKOFF));

/** Liga con medias home=away=1 (muchos 1-1): lambdaHome=1, lambdaAway=1, lambdaTotal=2. */
function balancedHistory(): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  for (let i = 0; i < 210; i++) {
    matches.push(historical(rotateDate(i), 'TeamA', 'TeamB', 1, 1));
  }
  return matches;
}

/** Liga anclada 2-1 home: lambdaTotal = 2 + 1 = 3 -> pOver ~ 0.5768. */
function overHistory(): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  for (let i = 0; i < 210; i++) {
    matches.push(historical(rotateDate(i), 'TeamA', 'TeamB', 2, 1));
  }
  return matches;
}

/** Fechas rotadas dentro de la ventana causal de 24 meses respecto al snapshot. */
function rotateDate(index: number): Date {
  const base = new Date(SNAPSHOT.getTime() - (8 + (index % 100)) * 24 * 60 * 60 * 1000);
  return base;
}

function historical(
  date: Date,
  home: string,
  away: string,
  homeGoals: number,
  awayGoals: number,
): HistoricalMatch {
  const result = homeGoals === awayGoals ? 'D' : homeGoals > awayGoals ? 'H' : 'A';
  return { date, homeTeam: home, awayTeam: away, homeGoals, awayGoals, result };
}

function fixture(
  teamSuffix: string,
  home: string,
  away: string,
  overrides: Partial<Fixture> = {},
): Fixture {
  return {
    id: teamSuffix,
    sport: 'FOOTBALL',
    league: 'Premier League',
    leagueId: 39,
    country: 'England',
    homeTeam: home,
    awayTeam: away,
    kickoffAt: new Date(KICKOFF),
    status: 'NS',
    ...overrides,
  };
}

/** Par construido desde (oddsOver, fairOver) objetivos: rawUnder se deriva del de-vig. */
function pairFrom(
  fairOver: number,
  oddsOver: number,
  bookmaker = 'pinnacle',
  fixtureId = '1',
): OddsPair {
  const capturedAt = new Date('2026-09-20T14:00:00Z');
  const rawOver = 1 / oddsOver;
  const rawUnder = (rawOver * (1 - fairOver)) / fairOver;
  const oddsUnder = 1 / rawUnder;
  return {
    fixtureId,
    bookmaker,
    over: { bookmaker, selection: 'OVER_2_5', decimalOdds: oddsOver, capturedAt },
    under: { bookmaker, selection: 'UNDER_2_5', decimalOdds: oddsUnder, capturedAt },
  };
}

function candidate(
  fixtureId: string,
  home: string,
  away: string,
  pairs: OddsPair[],
  fixtureOverrides: Partial<Fixture> = {},
): ScanCandidate {
  return {
    fixture: fixture(fixtureId, home, away, fixtureOverrides),
    pair: pairs[0]!,
    pairs,
    fairOverProbability: 0.5,
    fairUnderProbability: 0.5,
    model: 'NOT_YET_AVAILABLE',
    edge: 0,
    decision: 'NO_BET_PIPELINE_ONLY',
    kickoffAt: new Date(KICKOFF),
    decisionAt: SNAPSHOT,
    snapshotAt: SNAPSHOT,
  };
}

function deps(overrides: Partial<Parameters<typeof runQuantPipeline>[0]> = {}) {
  return {
    candidates: [candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.5268, 1.998)])],
    historicalMatches: balancedHistory(),
    now: NOW,
    initialBankroll: 1000,
    openStakesSum: 0,
    settledPnlSum: 0,
    findExistingBet: () => null,
    ...overrides,
  };
}

/** { pOver, pUnder } del modelo sobre un histórico dado (para razonar los gates). */
function modelOf(history: HistoricalMatch[], home = 'Arsenal', away = 'Chelsea') {
  const result = computePoissonV1({
    fixtureId: '9001',
    league: 'Premier League',
    home,
    away,
    snapshotAt: SNAPSHOT,
    historicalMatches: history,
  });
  if (result.status !== 'OK') throw new Error('modelo debia ser OK');
  return result.output;
}

describe('runQuantPipeline', () => {
  it('moduloPoison calculado: pUnder es P(total<=2) para lambdaTotal=3', () => {
    const model = modelOf(overHistory());
    // lambdaTotal = 3 exacto (medias 2/1 y fuerzas 1)
    const pOverAtLambda3 = 1 - Math.exp(-3) * 8.5;
    expect(model.pOver).toBeCloseTo(pOverAtLambda3, 6);
    expect(model.lambdaTotal).toBeCloseTo(3, 6);
  });

  it('modelo Poisson -> candidato OVER que pasa TODOS los gates', () => {
    const result = runQuantPipeline(deps({ historicalMatches: overHistory() }));
    expect(result.poissonModeled).toBe(1);
    expect(result.quantCandidates).toBe(1);
    expect(result.passedGate).toBe(1);
    expect(result.prepared).toHaveLength(1);

    const bet = result.prepared[0]!.bet;
    expect(bet.status).toBe('OPEN');
    expect(bet.selection).toBe('OVER_2_5');
    expect(bet.market).toBe('OVER_UNDER_2_5');
    expect(bet.modelVersion).toBe('poisson-v1');
    expect(bet.cohortId).toBe(PROTOCOL_COHORT_ID);
    expect(bet.lambdaHome).toBeCloseTo(2, 6);
    expect(bet.lambdaAway).toBeCloseTo(1, 6);
    expect(bet.lambdaTotal).toBeCloseTo(3, 6);
    expect(bet.stake).toBeCloseTo(10, 4); // 1% del bankroll 1000
    expect(bet.bankrollBefore).toBeCloseTo(1000, 4);
    expect(bet.snapshotAt.toISOString()).toBe(SNAPSHOT.toISOString());
    expect(bet.kickoff.toISOString()).toBe(new Date(KICKOFF).toISOString());
    expect(bet.modelProbability).toBeCloseTo(0.5768, 3);
    expect(bet.minimumAcceptableOdds).toBeCloseTo(1.03 / bet.modelProbability, 4);

    const side = result.prepared[0]?.side as QuantSideEvaluation;
    expect(side.fairMarketProbability).toBeCloseTo(0.5268, 4);
    expect(side.edge).toBeCloseTo(0.05, 4);
  });

  it('evalua UNDER cuando el modelo y el mercado favorecen el under', () => {
    // Liga 1-1: lambdaTotal=2, pUnder ~ 0.6767. Par con under fair ~ 0.59 y cuota 2.0.
    // (fairOver = 1 - 0.59 = 0.41; oddsOver derivada del de-vig; under edge ~ +8.7pp.)
    const result = runQuantPipeline(
      deps({
        candidates: [candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.41, 2.878)])],
      }),
    );
    expect(result.poissonModeled).toBe(1);
    expect(result.prepared).toHaveLength(1);
    const bet = result.prepared[0]!.bet;
    expect(bet.selection).toBe('UNDER_2_5');
    expect(bet.placedOdds).toBeCloseTo(2.0, 3);
    expect(bet.edge).toBeGreaterThan(QUANT_GATE.minEdge);
    expect(bet.expectedValue).toBeCloseTo(
      modelOf(balancedHistory()).pUnder * bet.placedOdds - 1,
      4,
    );
  });

  it('gate MIN_EDGE: edge por debajo del umbral se rechaza (EDGE)', () => {
    const result = runQuantPipeline(
      deps({
        historicalMatches: overHistory(),
        candidates: [candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.5378, 1.9573)])],
      }),
    );
    expect(result.passedGate).toBe(0);
    expect(result.prepared).toHaveLength(0);
    expect(result.rejected.EDGE).toBe(1);
    expect(result.analyses).toMatchObject([{ decision: 'NO_BET', reason: 'EDGE' }]);
  });

  it('gate MIN_EV: edge suficiente pero EV insuficiente rechaza (EV)', () => {
    // oddsOver 1.74 en rango y edge +5pp, pero EV = p*(1.74) - 1 < 0.03.
    const result = runQuantPipeline(
      deps({
        historicalMatches: overHistory(),
        candidates: [candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.5268, 1.74)])],
      }),
    );
    expect(result.passedGate).toBe(0);
    expect(result.prepared).toHaveLength(0);
    expect(result.rejected.EV).toBe(1);
  });

  it('gate ODDS_RANGE: cuota fuera de [1.70, 2.20] se rechaza', () => {
    const result = runQuantPipeline(
      deps({
        historicalMatches: overHistory(),
        candidates: [candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.5268, 2.25)])],
      }),
    );
    expect(result.prepared).toHaveLength(0);
    expect(result.rejected.ODDS_RANGE).toBe(1);
  });

  it('fail-closed: liga sin minimo de partidos -> MODEL_DATA, nunca inventa probabilidad', () => {
    const result = runQuantPipeline(
      deps({
        historicalMatches: [historical(new Date('2026-06-01T00:00:00Z'), 'TeamA', 'TeamB', 1, 1)],
      }),
    );
    expect(result.poissonModeled).toBe(0);
    expect(result.rejected.MODEL_DATA).toBe(1);
    expect(result.prepared).toHaveLength(0);
  });

  it('fail-closed (KSS-LEAGUE-UNIVERSE-01): liga OBSERVATION_ONLY nunca ejecuta Poisson/QUANT/PaperBet', () => {
    const result = runQuantPipeline(
      deps({
        historicalMatches: overHistory(),
        candidates: [
          candidate('9001', 'Real Madrid', 'Sevilla', [pairFrom(0.5268, 1.998)], {
            league: 'Serie A',
            leagueId: 135,
            country: 'Colombia',
          }),
        ],
      }),
    );
    expect(result.poissonModeled).toBe(0);
    expect(result.quantCandidates).toBe(0);
    expect(result.rejected.LEAGUE_NOT_ENABLED).toBe(1);
    expect(result.prepared).toHaveLength(0);
  });

  it('fail-closed: par sin bookmaker de la cohorte se rechaza (NO_BOOKMAKER)', () => {
    const result = runQuantPipeline(
      deps({
        candidates: [candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.5268, 1.998, '1xbet')])],
      }),
    );
    expect(result.poissonModeled).toBe(0);
    expect(result.rejected.NO_BOOKMAKER).toBe(1);
    expect(result.prepared).toHaveLength(0);
  });

  it('idempotencia: PaperBet existente (por identidad durable) no se vuelve a preparar', () => {
    const existing: PaperBet = {
      id: 'b-ya-esta',
      cohortId: PROTOCOL_COHORT_ID,
      fixtureId: 9001,
      league: 'Premier League',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      kickoff: new Date(KICKOFF),
      snapshotAt: SNAPSHOT,
      market: 'OVER_UNDER_2_5',
      selection: 'OVER_2_5',
      modelVersion: 'poisson-v1',
      modelProbability: 0.5768,
      fairMarketProbability: 0.5268,
      edge: 0.05,
      expectedValue: 0.1,
      bookmaker: 'pinnacle',
      placedOdds: 1.998,
      minimumAcceptableOdds: 1.786,
      lambdaHome: 2,
      lambdaAway: 1,
      lambdaTotal: 3,
      stake: 10,
      bankrollBefore: 1000,
      status: 'OPEN',
      createdAt: NOW,
    };
    const result = runQuantPipeline(
      deps({
        historicalMatches: overHistory(),
        findExistingBet: (key) =>
          key.cohortId === PROTOCOL_COHORT_ID &&
          key.fixtureId === 9001 &&
          key.selection === 'OVER_2_5'
            ? existing
            : null,
      }),
    );
    expect(result.duplicates).toHaveLength(1);
    expect(result.prepared).toHaveLength(0);
  });

  it('riesgo: dos candidatos nuevos generan stakes decrecientes (1% del bankroll actual)', () => {
    const history = balancedHistory();
    const candidates = [
      candidate('9001', 'Arsenal', 'Chelsea', [pairFrom(0.41, 2.878)]),
      candidate('9002', 'Liverpool', 'Everton', [pairFrom(0.41, 2.878)]),
    ];
    const result = runQuantPipeline(deps({ candidates, historicalMatches: history }));
    expect(result.passedGate).toBe(2);
    expect(result.prepared).toHaveLength(2);
    const preparedBets = result.prepared.map((prepared) => prepared.bet);
    const [first, second] = preparedBets;
    expect(first?.stake ?? 0).toBeCloseTo(10, 4);
    expect(second?.bankrollBefore ?? 0).toBeCloseTo(990, 4);
    expect(second?.stake ?? 0).toBeCloseTo(9.9, 3);
  });

  it('techo MAX_BETS_PER_DAY: 11 candidatos -> 10 bets y 1 rechazo RISK', () => {
    const history = balancedHistory();
    const teamsFor = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const candidates = teamsFor.map((team, index) =>
      candidate(`9001${index}`, `Home${team}`, `Away${team}`, [pairFrom(0.41, 2.878)]),
    );
    const result = runQuantPipeline(deps({ candidates, historicalMatches: history }));
    expect(result.passedGate).toBe(10);
    expect(result.prepared).toHaveLength(10);
    expect(result.rejected.RISK).toBe(1);
  });

  it('mismo fixture con pares Pinnacle y Bet365: la decision usa solo Pinnacle', () => {
    const history = overHistory();
    const bet365Pair = pairFrom(0.5268, 1.998, 'bet365', '9001');
    const result = runQuantPipeline(
      deps({
        historicalMatches: history,
        candidates: [
          candidate('9001', 'Arsenal', 'Chelsea', [
            bet365Pair,
            pairFrom(0.5268, 1.9573, 'pinnacle', '9001'),
          ]),
        ],
      }),
    );
    expect(result.prepared).toHaveLength(1);
    expect(result.prepared[0]?.bet.bookmaker).toBe('pinnacle');
    expect(result.prepared[0]?.bet.placedOdds).toBe(1.9573);
  });

  it('idempotencyKeyOf genera la identidad durable completa de la cohorte', () => {
    const key = idempotencyKeyOf(
      { selection: 'OVER_2_5' } as unknown as QuantSideEvaluation,
      { id: '123' } as unknown as Fixture,
    );
    expect(key).toEqual({
      cohortId: PROTOCOL_COHORT_ID,
      fixtureId: 123,
      market: 'OVER_UNDER_2_5',
      selection: 'OVER_2_5',
      modelVersion: 'poisson-v1',
    });
  });

  it('gate congelado KSS-V1-C01 activado por defecto', () => {
    expect(QUANT_GATE).toEqual({ minEdge: 0.04, minEv: 0.03, minOdds: 1.7, maxOdds: 2.2 });
  });
});
