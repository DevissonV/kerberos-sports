/** Salida legible del scanner en stdout. */

import type { ScanReport } from './scanPipeline';

function formatPercent(value: number): string {
  return value.toFixed(4);
}

export function renderScanReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push('KERBEROS SPORTS SCAN');
  lines.push('');
  lines.push(`Fixtures fetched: ${report.fixturesFetched}`);
  lines.push(`Fixtures matched with odds: ${report.fixturesMatched}`);
  lines.push(`Candidates normalized: ${report.candidatesNormalized}`);

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
