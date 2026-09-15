// Métricas deterministas sobre bets resueltas.
// WIN = 1, LOSS = 0, VOID = excluida de todas las métricas.

/** Bets resueltas y no nulas: base de métricas (VOID excluida). */
export interface ResolvedBet {
  id: string;
  /** Probabilidad asignada por el modelo al momento de registrar la apuesta. */
  modelProbability: number;
  stake: number;
  odds: number;
  result: 'WON' | 'LOST' | 'VOID';
  /** Cuota de cierre del mercado (opcional). Sin closing odds la bet se excluye de CLV. */
  closingOdds?: number;
}

export interface MetricsReport {
  totalBets: number;
  wins: number;
  losses: number;
  voids: number;
  /** wins / (wins + losses); si no hay bets resueltas: 0. */
  hitRate: number;
  /** Suma de stakes de bets ganadas. */
  grossProfit: number;
  /** Suma de stakes de bets perdidas. */
  grossLoss: number;
  /** grossProfit - grossLoss. */
  netPnL: number;
  /** ROI sobre el total staked de bets resueltas: netPnL / totalStaked. */
  roi: number;
  /** yield: netPnL / totalStaked (sinónimo de ROI en apuestas). */
  yield: number;
  /** Mayor caída pico-a-valle de la curva acumulada de PnL (unidades monetarias, ≥ 0). */
  maxDrawdown: number;
  /** Curva acumulada de PnL en orden de llegada; el punto 0 es el estado inicial. */
  bankrollCurve: number[];
  /** Media de (p - y)^2 sobre bets no nulas; 0 si vacío. */
  brierScore: number;
  /** Media de -(y ln p + (1-y) ln(1-p)); 0 si vacío. */
  logLoss: number;
  /** Beat-close en probabilidad implícita (ver documentación de calculateClosingLineValue). */
  clv: number;
  /** Cantidad de bets usadas en CLV. */
  clvSampleSize: number;
}

/**
 * Definición única de CLV (beat-close), basada en probabilidad implícita:
 *   impliedP = 1/odds ; impliedC = 1/closingOdds
 *   CLV = impliedC / impliedP - 1 = placedOdds / closingOdds - 1
 * POSITIVO: la probabilidad implícita de cierre (1/closingOdds) era MAYOR que
 * la de la cuota apostada (1/placedOdds), es decir se tomó un mejor precio que
 * el cierre (placedOdds > closingOdds). NEGATIVO: se aceptó peor precio que el cierre.
 * Si no hay closingOdds (o no es finita > 1): la bet se EXCLUYE del cálculo
 * (media solo sobre bets con cierre válido); nunca se trata como 0.
 */
export function calculateClosingLineValue(bet: ResolvedBet): number | undefined {
  if (bet.closingOdds === undefined || !Number.isFinite(bet.closingOdds) || bet.closingOdds <= 1) {
    return undefined;
  }
  return bet.odds / bet.closingOdds - 1;
}

export function calculateMetrics(bets: readonly ResolvedBet[]): MetricsReport {
  const settled = bets.filter((b) => b.result === 'WON' || b.result === 'LOST');
  const won = settled.filter((b) => b.result === 'WON');
  const lost = settled.filter((b) => b.result === 'LOST');
  const voids = bets.length - settled.length;

  const grossProfit = won.reduce((acc, b) => acc + b.stake * (b.odds - 1), 0);
  const grossLoss = lost.reduce((acc, b) => acc + b.stake, 0);
  const totalStaked = settled.reduce((acc, b) => acc + b.stake, 0);
  const netPnL = grossProfit - grossLoss;

  const hitRate = settled.length === 0 ? 0 : won.length / settled.length;
  const roi = totalStaked === 0 ? 0 : netPnL / totalStaked;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const bankrollCurve = [0];
  for (const bet of settled) {
    cumulative += bet.result === 'WON' ? bet.stake * (bet.odds - 1) : -bet.stake;
    bankrollCurve.push(cumulative);
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }

  const brierSum = settled.reduce((acc, b) => {
    const y = b.result === 'WON' ? 1 : 0;
    const p = Math.min(Math.max(b.modelProbability, 0), 1);
    return acc + (p - y) * (p - y);
  }, 0);
  const brierScore = settled.length === 0 ? 0 : brierSum / settled.length;

  const logLossSum = settled.reduce((acc, b) => {
    const y = b.result === 'WON' ? 1 : 0;
    const p = Math.min(Math.max(b.modelProbability, 1e-12), 1 - 1e-12);
    return acc + -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }, 0);
  const logLoss = settled.length === 0 ? 0 : logLossSum / settled.length;

  const clvValues: number[] = [];
  for (const bet of settled) {
    const clv = calculateClosingLineValue(bet);
    if (clv !== undefined) clvValues.push(clv);
  }
  const clv = clvValues.length === 0 ? 0 : clvValues.reduce((a, b) => a + b, 0) / clvValues.length;

  return {
    totalBets: bets.length,
    wins: won.length,
    losses: lost.length,
    voids,
    hitRate,
    grossProfit,
    grossLoss,
    netPnL,
    roi,
    yield: roi,
    maxDrawdown,
    bankrollCurve,
    brierScore,
    logLoss,
    clv,
    clvSampleSize: clvValues.length,
  };
}
