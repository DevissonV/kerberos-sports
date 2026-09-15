/** Salida legible del scanner en stdout. */

import { PRIMARY_BOOKMAKER, PROTOCOL_COHORT_ID } from '../domain/protocol';
import type { ScanReport } from './scanPipeline';

function formatPercent(value: number): string {
  return value.toFixed(4);
}

export function renderScanReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push('KERBEROS SPORTS SCAN');
  lines.push('');
  lines.push(`COHORT: ${PROTOCOL_COHORT_ID}`);
  lines.push(`RAW_FIXTURES: ${report.fixturesFetched}`);
  lines.push(`PREMIER_LEAGUE_FIXTURES: ${report.fixturesEligible}`);
  lines.push(`EXCLUDED_BY_PROTOCOL: ${report.excludedByProtocol}`);
  lines.push(`MATCHED: ${report.fixturesMatched}`);
  lines.push(`O_U_2_5_CANDIDATES: ${report.candidatesNormalized}`);
  lines.push(`TEMPORAL_ELIGIBLE: ${report.temporalEligible}`);
  lines.push(
    `TEMPORAL_EXCLUDED: TOO_EARLY=${report.temporalExcluded.tooEarly} MISSED_WINDOW=${report.temporalExcluded.missedWindow} STARTED=${report.temporalExcluded.started}`,
  );
  lines.push(
    `PINNACLE: ${report.candidates.filter((c) => c.pair.bookmaker === PRIMARY_BOOKMAKER).length}`,
  );
  lines.push(
    `BET365_FALLBACK: ${report.candidates.filter((c) => c.pair.bookmaker !== PRIMARY_BOOKMAKER).length}`,
  );

  for (const candidate of report.candidates) {
    const { fixture, pair } = candidate;
    lines.push('');
    lines.push('MATCH:');
    lines.push(`${fixture.homeTeam} vs ${fixture.awayTeam}`);
    lines.push('');
    lines.push('BOOKMAKER:');
    lines.push(pair.bookmaker);
    lines.push('');
    lines.push('MARKET:');
    lines.push('OVER/UNDER 2.5');
    lines.push('');
    lines.push('OVER:');
    lines.push(pair.over.decimalOdds.toFixed(2));
    lines.push('');
    lines.push('UNDER:');
    lines.push(pair.under.decimalOdds.toFixed(2));
    lines.push('');
    lines.push('FAIR OVER PROBABILITY:');
    lines.push(formatPercent(candidate.fairOverProbability));
    lines.push('');
    lines.push('FAIR UNDER PROBABILITY:');
    lines.push(formatPercent(candidate.fairUnderProbability));
    lines.push('');
    lines.push('MODEL:');
    lines.push(candidate.model);
    lines.push('');
    lines.push('DECISION:');
    lines.push(candidate.decision);
  }
  return lines.join('\n');
}
