import { formatSettlementMessage } from './settlementMessage';
import type { PaperBet } from '../../paper-betting/domain/concepts';

const bet: PaperBet = {
  id: '1',
  cohortId: 'KSS-V1-C01',
  fixtureId: 1,
  league: 'Premier League',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  kickoff: new Date('2026-09-20T15:00:00Z'),
  snapshotAt: new Date('2026-09-20T09:00:00Z'),
  market: 'OVER_UNDER_2_5',
  selection: 'OVER_2_5',
  modelVersion: 'poisson-v1',
  modelProbability: 0.6,
  fairMarketProbability: 0.5,
  edge: 0.1,
  expectedValue: 0.2,
  bookmaker: 'Pinnacle',
  placedOdds: 2,
  minimumAcceptableOdds: 1.9,
  lambdaHome: 1.4,
  lambdaAway: 1.1,
  lambdaTotal: 2.5,
  stake: 10_000,
  bankrollBefore: 500_000,
  status: 'WON',
  createdAt: new Date('2026-09-20T09:00:00Z'),
  result: '2-1',
  pnl: 10_000,
  closingOdds: 1.9,
};

it('presenta settlement legible con importes y CLV', () => {
  const message = formatSettlementMessage(bet, 510_000);
  expect(message).toContain('✅ GANADA');
  expect(message).toContain('MÁS DE 2.5 GOLES');
  expect(message).toContain('Stake real: 10.000 COP');
  expect(message).toContain('Retorno: 20.000 COP');
  expect(message).toContain('Bankroll después: 510.000 COP');
  expect(message).toContain('CLV: +5.3%');
});
