import { formatSettlementMessage } from './settlementMessage';
import { formatDailyPredictionReport } from './dailyPredictionReport';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import type { Prediction } from '../../prediction-ledger/domain/prediction';
import { formatKickoffBogota } from './formatKickoff';

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
  result: '3-0',
  pnl: 10_000,
};

function prediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    predictionId: 'p1',
    fixtureId: 'f1',
    league: 'Eredivisie',
    homeTeam: 'Groningen',
    awayTeam: 'PEC Zwolle',
    kickoffAt: new Date('2026-09-18T18:00:00Z'),
    createdAt: new Date('2026-09-17T12:00:00Z'),
    snapshotAt: new Date('2026-09-17T12:00:00Z'),
    market: 'OVER_UNDER_2_5',
    selection: 'UNDER_2_5',
    modelProbability: 0.342,
    modelVersion: 'poisson-v1',
    strategyVersion: 'KSS-V1-C01',
    predictionStage: 'PREANALYSIS',
    result: 'MISS',
    betAuthorized: false,
    betExecuted: false,
    isPrimary: true,
    finalScoreHome: 3,
    finalScoreAway: 0,
    totalGoals: 3,
    ...overrides,
  };
}

describe('identidad de fixture en mensajes de ejecución', () => {
  it('settlement incluye torneo, fecha y hora Bogotá', () => {
    const message = formatSettlementMessage(bet, 510_000);
    expect(message).toContain('🏆 Premier League');
    expect(message).toContain('📅 20 Sep 2026 · 🕐 10:00 a. m.');
    expect(message).not.toContain('fixtureId');
  });

  it('settlement no muta los timestamps originales', () => {
    const before = bet.kickoff.getTime();
    formatSettlementMessage(bet, 510_000);
    expect(bet.kickoff.getTime()).toBe(before);
    expect(formatKickoffBogota(bet.kickoff)).toBe('20 Sep 2026 · 10:00 a. m.');
  });
});

describe('resumen nocturno', () => {
  it('muestra HIT/MISS con identidad de fixture sin recalcular nada', () => {
    const report = formatDailyPredictionReport([prediction()], '2026-09-18');
    expect(report).toContain('❌ PREDICCIÓN FALLADA');
    expect(report).toContain('⚽ Groningen vs PEC Zwolle');
    expect(report).toContain('🏆 Eredivisie');
    expect(report).toContain('📅 18 Sep 2026 · 🕐 1:00 p. m.');
    expect(report).toContain('🎯 Predicción: MENOS DE 2.5 GOLES');
    expect(report).toContain('🧠 Probabilidad Kerberos: 34.2%');
    expect(report).toContain('🏁 Final: 3-0');
  });

  it('muestra acertadas con el resultado exacto del ledger', () => {
    const report = formatDailyPredictionReport(
      [prediction({ result: 'HIT', selection: 'OVER_2_5', modelProbability: 0.658 })],
      '2026-09-18',
    );
    expect(report).toContain('✅ PREDICCIÓN ACERTADA');
    expect(report).toContain('🎯 Predicción: MÁS DE 2.5 GOLES');
    expect(report).toContain('🧠 Probabilidad Kerberos: 65.8%');
  });

  it('separa apuestas reales del rendimiento del modelo', () => {
    const report = formatDailyPredictionReport(
      [prediction(), prediction({ betAuthorized: true, betExecuted: true })],
      '2026-09-18',
    );
    expect(report).toContain('💰 APUESTAS REALES');
    expect(report).toContain('Ejecutadas: 1');
    expect(report).toContain('🧠 RENDIMIENTO DEL MODELO');
    expect(report).not.toContain('prediction = apuesta');
  });

  it('sin apuestas ejecutadas no inventa stakes ni PnL', () => {
    const report = formatDailyPredictionReport([prediction()], '2026-09-18');
    expect(report).toContain('Sin apuestas ejecutadas');
    expect(report).not.toContain('PnL real: $');
  });
});
