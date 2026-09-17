/** Resumen legible de una corrida QUANT end-to-end (protocolo, secciones 7/12). */

import type { QuantScanSummary } from './quantScanService';
import { PROTOCOL_COHORT_ID } from '../../scanning/domain/protocol';

export const PER_RUN_LOG_MAX = 5;

export function renderQuantRun(summary: QuantScanSummary): string {
  const { scan, result } = summary;
  const report = scan.report;
  const noOdds = Math.max(
    report.temporalEligible - report.candidates.filter((c) => c.pairs.length > 0).length,
    0,
  );
  const temporalRejected =
    report.temporalExcluded.tooEarly +
    report.temporalExcluded.missedWindow +
    report.temporalExcluded.started;

  const lines: string[] = [];
  lines.push('KERBEROS SPORTS SCAN QUANT');
  lines.push('');
  lines.push(`VERDICT: ${summary.paperBetsCreated > 0 ? 'PAPER_BETS_CREATED' : 'NO_PAPER_BETS'}`);
  lines.push(`COHORT: ${PROTOCOL_COHORT_ID}`);
  lines.push('MODEL_VERSION: poisson-v1');
  lines.push('');
  lines.push('CONTADORES:');
  lines.push(`RAW_FIXTURES: ${report.fixturesFetched}`);
  lines.push(`ELIGIBLE_FIXTURES: ${report.fixturesEligible}`);
  lines.push(`MATCHED_ODDS: ${report.fixturesMatched}`);
  lines.push(`TEMPORAL_ELIGIBLE: ${report.temporalEligible}`);
  lines.push(`POISSON_MODELED: ${result.poissonModeled}`);
  lines.push(`QUANT_CANDIDATES: ${result.quantCandidates}`);
  lines.push(`PASSED_GATE: ${result.passedGate}`);
  lines.push('');
  lines.push('PAPER:');
  lines.push(`PAPER_BETS_CREATED: ${summary.paperBetsCreated}`);
  lines.push(`DUPLICATES_SKIPPED: ${summary.duplicatesSkipped}`);
  lines.push(`TELEGRAM_SENT: ${summary.telegramSent}`);
  lines.push('');
  lines.push('REJECTED:');
  lines.push(`PROTOCOL: ${report.excludedByProtocol}`);
  lines.push(`TEMPORAL: ${temporalRejected}`);
  lines.push(`NO_ODDS: ${noOdds}`);
  lines.push(`LEAGUE_NOT_ENABLED: ${result.rejected.LEAGUE_NOT_ENABLED}`);
  lines.push(`MODEL_DATA: ${result.rejected.MODEL_DATA}`);
  lines.push(`NO_BOOKMAKER: ${result.rejected.NO_BOOKMAKER}`);
  lines.push(`EDGE: ${result.rejected.EDGE}`);
  lines.push(`EV: ${result.rejected.EV}`);
  lines.push(`ODDS_RANGE: ${result.rejected.ODDS_RANGE}`);
  lines.push(`RISK: ${result.rejected.RISK}`);
  lines.push(`DUPLICATE: ${result.duplicates.length}`);
  lines.push('');
  lines.push('LUNA SHADOW:');
  lines.push(`SELECTED: ${summary.luna.selected}`);
  lines.push(`EVALUATED: ${summary.luna.evaluated}`);
  lines.push(`CACHE_HITS: ${summary.luna.cacheHits}`);
  lines.push(`INSUFFICIENT_DATA: ${summary.luna.insufficientData}`);
  lines.push(`INVALID_OUTPUTS: ${summary.luna.invalidOutputs}`);
  lines.push(`LUNA_SELECTED: ${summary.luna.selected}`);
  lines.push(`LUNA_CACHE_HITS: ${summary.luna.cacheHits}`);
  lines.push(`LUNA_API_CALLS: ${summary.luna.apiCalls}`);
  lines.push(`LUNA_SUCCESS: ${summary.luna.successes}`);
  lines.push(`LUNA_INSUFFICIENT_DATA: ${summary.luna.insufficientData}`);
  lines.push(`LUNA_ERRORS: ${summary.luna.providerErrors + summary.luna.timeouts}`);
  lines.push(`LUNA_INPUT_TOKENS: ${summary.luna.inputTokens}`);
  lines.push(`LUNA_OUTPUT_TOKENS: ${summary.luna.outputTokens}`);
  lines.push('');
  lines.push('LLM ANALYST:');
  lines.push(`LLM_SELECTED: ${summary.analyst.selected}`);
  lines.push(`LLM_EVALUATED: ${summary.analyst.evaluated}`);
  lines.push(`LLM_CACHE_HITS: ${summary.analyst.cacheHits}`);
  lines.push(`LLM_SKIPPED: ${summary.analyst.skipped}`);
  lines.push(`LLM_FAILURES: ${summary.analyst.failures}`);
  lines.push(`LLM_INPUT_TOKENS: ${summary.analyst.inputTokens}`);
  lines.push(`LLM_OUTPUT_TOKENS: ${summary.analyst.outputTokens}`);
  return lines.join('\n');
}
