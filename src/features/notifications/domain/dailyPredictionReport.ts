import type { Prediction } from '../../prediction-ledger/domain/prediction';
import {
  calculatePredictionMetrics,
  metricsByProbabilityBucket,
  sampleSizeLabel,
} from '../../prediction-ledger/domain/metrics';
import { calendarDateInBogota } from '../../scanning/domain/todayFirst';
import { formatKickoffBogota } from './formatKickoff';

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;

export function formatDailyPredictionReport(
  predictions: readonly Prediction[],
  dayBogota: string,
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
  const authorized = dayPredictions.filter((prediction) => prediction.betAuthorized).length;
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
        `${prediction.result === 'HIT' ? '✅' : '❌'} ${prediction.homeTeam} vs ${prediction.awayTeam}`,
        `${prediction.league} · 🗓️ ${formatKickoffBogota(prediction.kickoffAt)}`,
        prediction.selection === 'OVER_2_5' ? 'MÁS DE 2.5' : 'MENOS DE 2.5',
        `Kerberos: ${percent(prediction.modelProbability)}`,
        `Final: ${prediction.finalScoreHome}-${prediction.finalScoreAway}`,
      );
  }
  if (pending > 0)
    lines.push('', `⏳ Pendientes de resultado: ${pending}`, 'Se resolverán posteriormente.');
  lines.push(
    '',
    '─────────────',
    '',
    '💰 APUESTAS',
    `Autorizadas: ${authorized}`,
    `Ejecutadas: ${executed}`,
    '',
    '─────────────',
    '',
    '📈 HISTÓRICO ACUMULADO',
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
