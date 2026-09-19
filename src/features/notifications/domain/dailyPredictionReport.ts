import type { Prediction } from '../../prediction-ledger/domain/prediction';
import {
  calculatePredictionMetrics,
  metricsByProbabilityBucket,
  sampleSizeLabel,
} from '../../prediction-ledger/domain/metrics';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';
import { formatFixtureIdentity } from './fixtureIdentity';
import type { RealBetsDailyStats } from '../../manual-ledger/domain/realBetsStats';

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const signedPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const cop = (value: number): string => `${Math.round(value).toLocaleString('es-CO')} COP`;

export function formatDailyPredictionReport(
  predictions: readonly Prediction[],
  dayBogota: string,
  realBets?: RealBetsDailyStats,
): string {
  const primary = predictions.filter((prediction) => prediction.isPrimary);
  const dayPredictions = primary.filter(
    (prediction) => calendarDateInBogota(prediction.kickoffAt) === dayBogota,
  );
  const daily = calculatePredictionMetrics(dayPredictions);
  const cumulative = calculatePredictionMetrics(primary);
  const pending = dayPredictions.filter((prediction) => prediction.result === 'PENDING').length;
  const buckets = metricsByProbabilityBucket(dayPredictions).filter(
    (bucket) => bucket.settledPredictions > 0,
  );
  const resolved = dayPredictions.filter(
    (prediction) => prediction.result === 'HIT' || prediction.result === 'MISS',
  );
  const executed = dayPredictions.filter((prediction) => prediction.betExecuted).length;
  const date = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dayBogota}T12:00:00Z`));
  const lines = [
    '🌙 KERBEROS SPORTS — RESUMEN DEL DÍA',
    `📅 ${date}`,
    '',
    '📊 PREDICCIONES',
    `Analizadas: ${dayPredictions.length}`,
    `Finalizadas: ${daily.settledPredictions}`,
    `Pendientes: ${pending}`,
    '',
    `✅ Acertadas: ${daily.hits}`,
    `❌ Falladas: ${daily.misses}`,
    `🎯 Acierto: ${percent(daily.hitRate)}`,
  ];
  if (buckets.length > 0) {
    lines.push('', '─────────────', '', '🔥 POR NIVEL DE CONFIANZA');
    for (const bucket of buckets)
      lines.push(
        '',
        bucket.label,
        `${bucket.settledPredictions} predicciones`,
        `✅ ${bucket.hits} / ❌ ${bucket.misses}`,
        `Acierto: ${percent(bucket.hitRate)}`,
        `⚠️ ${bucket.sampleLabel.toLowerCase()}`,
      );
  }
  if (resolved.length > 0) {
    lines.push('', '─────────────', '', '⚽ RESULTADOS');
    for (const prediction of resolved)
      lines.push(
        '',
        `${prediction.result === 'HIT' ? '✅ PREDICCIÓN ACERTADA' : '❌ PREDICCIÓN FALLADA'}`,
        ...formatFixtureIdentity({
          homeTeam: prediction.homeTeam,
          awayTeam: prediction.awayTeam,
          league: prediction.league,
          kickoffAt: prediction.kickoffAt,
        }),
        `🎯 Predicción: ${prediction.selection === 'OVER_2_5' ? 'MÁS DE 2.5 GOLES' : 'MENOS DE 2.5 GOLES'}`,
        `🧠 Probabilidad Kerberos: ${percent(prediction.modelProbability)}`,
        `🏁 Final: ${prediction.finalScoreHome}-${prediction.finalScoreAway}`,
      );
  }
  if (pending > 0)
    lines.push('', `⏳ Pendientes de resultado: ${pending}`, 'Se resolverán posteriormente.');
  lines.push(
    '',
    '─────────────',
    '',
    '💰 APUESTAS REALES',
    ...(realBets === undefined
      ? [
          `Ejecutadas: ${executed}`,
          '(Sin apuestas ejecutadas: el modelo se evalúa solo con predicciones.)',
        ]
      : [
          `Ejecutadas: ${realBets.executed}`,
          `✅ Ganadas: ${realBets.won}`,
          `❌ Perdidas: ${realBets.lost}`,
          `↩️ Anuladas/devueltas: ${realBets.voided}`,
          `⏳ Pendientes: ${realBets.pending}`,
          '',
          `Stake total: ${cop(realBets.totalStakeCop)}`,
          `Retorno bruto: ${cop(realBets.grossReturnCop)}`,
          `PnL neto: ${cop(realBets.netPnlCop)}`,
          ...(realBets.roi === null ? [] : [`ROI diario: ${signedPercent(realBets.roi)}`]),
          ...(realBets.bankrollBeforeCop === null
            ? []
            : [`Bankroll inicial: ${cop(realBets.bankrollBeforeCop)}`]),
          ...(realBets.bankrollAfterCop === null
            ? []
            : [`Bankroll final: ${cop(realBets.bankrollAfterCop)}`]),
        ]),
    '',
    '─────────────',
    '',
    '🧠 RENDIMIENTO DEL MODELO',
    `Predicciones resueltas: ${cumulative.settledPredictions}`,
    `✅ ${cumulative.hits}`,
    `❌ ${cumulative.misses}`,
    `Hit rate: ${percent(cumulative.hitRate)}`,
    `Brier: ${cumulative.brierScore.toFixed(4)}`,
    '',
    `⚠️ ${sampleSizeLabel(cumulative.settledPredictions)} para sacar conclusiones firmes.`,
  );
  return lines.join('\n');
}
