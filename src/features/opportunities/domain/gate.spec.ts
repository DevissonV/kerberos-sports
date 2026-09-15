// Tests numéricos del gate de selección (patch: caso D y E obligatorios).
import type { CandidateOpportunity } from './gate';
import { selectOpportunities } from './gate';

const candidate = (fixtureId: string, edge: number, odds = 1.9): CandidateOpportunity => ({
  fixtureId,
  selection: 'OVER_2_5',
  decimalOdds: odds,
  modelProbability: 0.5 + edge,
  fairMarketProbability: 0.5,
  edge,
  expectedValue: edge,
});

const baseConfig = {
  bankroll: 1000,
  minEdge: 0.05,
  minOdds: 1.5,
  maxOdds: 3.0,
  maxBetsPerDay: 10,
  maxDailyExposure: 100,
  stakeMode: 'FIXED' as const,
  stakeAmount: 10,
};

describe('selection gate', () => {
  it('caso D: 20 candidatos, MAX_BETS_PER_DAY = 10, solo 3 pasan MIN_EDGE -> resultado 3', () => {
    const candidates: CandidateOpportunity[] = [];
    for (let i = 0; i < 3; i++) candidates.push(candidate(`pass-${i}`, 0.08));
    for (let i = 0; i < 17; i++) candidates.push(candidate(`fail-${i}`, 0.02));

    const result = selectOpportunities(candidates, baseConfig);
    expect(result.accepted).toHaveLength(3);
    expect(result.totalStaked).toBe(30);
  });

  it('candidatos invalidos se rechazan con razon', () => {
    const result = selectOpportunities(
      [
        { ...candidate('bad', 0.1), decimalOdds: 1.0 },
        { ...candidate('nan', 0.1), edge: NaN },
      ],
      baseConfig,
    );
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  it('ordena por edge DESC y respeta maxBetsPerDay como TECHO (no se fuerza)', () => {
    const candidates: CandidateOpportunity[] = [];
    for (let i = 0; i < 5; i++) candidates.push(candidate(`c-${i}`, 0.1 - i * 0.01));
    const config = { ...baseConfig, maxBetsPerDay: 2 };
    const result = selectOpportunities(candidates, config);
    expect(result.accepted.map((a) => a.fixtureId)).toEqual(['c-0', 'c-1']);
  });

  it('caso E: la exposition acumulada nunca supera MAX_DAILY_EXPOSURE', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => candidate(`c-${i}`, 0.08));
    const config = { ...baseConfig, maxDailyExposure: 45, stakeAmount: 10 };
    const result = selectOpportunities(candidates, config);
    expect(result.totalStaked).toBe(45);
    expect(result.accepted).toHaveLength(5); // la 5ta entra recortada a 5 para no exceder
    expect(result.accepted.at(-1)?.stake).toBe(5);
    expect(result.accepted.every((a) => a.cappedBy !== undefined)).toBe(true);
  });

  it('filtra odds fuera de rango', () => {
    const result = selectOpportunities(
      [candidate('low', 0.1, 1.2), candidate('high', 0.1, 4.5), candidate('ok', 0.1, 2.0)],
      baseConfig,
    );
    expect(result.accepted.map((a) => a.fixtureId)).toEqual(['ok']);
    expect(result.rejected.map((r) => r.candidate.fixtureId)).toEqual(['low', 'high']);
  });
});
