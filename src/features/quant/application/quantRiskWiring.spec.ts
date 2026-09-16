import type { PaperBet } from '../../paper-betting/domain/concepts';
import { ProductionRiskService } from '../../production-risk/application/productionRiskService';
import {
  DEFAULT_PRODUCTION_RISK_CONFIG,
  type ProductionRiskState,
} from '../../production-risk/domain/productionRiskGate';
import type { ProductionRiskStateStore } from '../../production-risk/ports/productionRiskStateStore';
import { formatQuantPaperMessageFor } from './quantRiskMessage';

const NOW = new Date('2026-09-16T12:00:00.000Z');

function bet(): PaperBet {
  return {
    id: 'rec-1',
    cohortId: 'KSS-V1-C01',
    fixtureId: 39,
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    kickoff: new Date('2026-09-16T20:00:00.000Z'),
    snapshotAt: NOW,
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
    stake: 999_999,
    bankrollBefore: 100_000,
    status: 'OPEN',
    createdAt: NOW,
  };
}

function riskService(
  state: ProductionRiskState,
  config = DEFAULT_PRODUCTION_RISK_CONFIG,
): ProductionRiskService {
  const store: ProductionRiskStateStore = {
    getDailyState: () => state,
    recordManualBet: () => undefined,
    settleManualBet: () => undefined,
  };
  return new ProductionRiskService(config, store);
}

describe('cableado QUANT → recomendación → riesgo → Telegram', () => {
  it('emite únicamente una BET aprobada con stake final de riesgo y EV', () => {
    const message = formatQuantPaperMessageFor(
      bet(),
      NOW,
      riskService({ betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 }),
    );
    expect(message).toContain('Stake sugerido: COP 10000');
    expect(message).toContain('EV: +20.0%');
    expect(message).toContain('EJECUCIÓN: MANUAL');
  });

  it.each([
    ['manualPause', { manualPause: true }],
    ['killSwitch', { killSwitch: true }],
  ] as const)('no emite Telegram accionable con %s', (_name, flags) => {
    expect(
      formatQuantPaperMessageFor(
        bet(),
        NOW,
        riskService(
          { betsToday: 0, dailyExposureCop: 0, dailyLossCop: 0, openBets: 0 },
          { ...DEFAULT_PRODUCTION_RISK_CONFIG, ...flags },
        ),
      ),
    ).toBeNull();
  });

  it('no emite Telegram cuando se agotó la exposición diaria', () => {
    expect(
      formatQuantPaperMessageFor(
        bet(),
        NOW,
        riskService({ betsToday: 1, dailyExposureCop: 25_000, dailyLossCop: 0, openBets: 1 }),
      ),
    ).toBeNull();
  });
});
