/**
 * Comando de escaneo (npm run scan). Es el smoke test MANUAL de red: solo hace
 * requests reales si ambas API keys están en .env; si no, guía sin fallar la
 * suite de tests. Un request principal por proveedor por corrida.
 */

import { existsSync, readFileSync } from 'node:fs';
import { config, hasNetworkKeys } from '../shared/config/configuration';
import { logger } from '../shared/logging/logger';
import { ApiFootballFixturesAdapter } from '../features/scanning/adapters/apiFootballFixtures';
import { OddsPapiAdapter } from '../features/scanning/adapters/oddsPapiOdds';
import { parseManualQuotes } from '../features/scanning/application/manualQuotes';
import { runScan } from '../features/scanning/application/scanPipeline';
import { renderScanReport } from '../features/scanning/application/scanReport';

const SCAN_FIXTURE_LIMIT = 20;
const MANUAL_QUOTES_PATH = 'manual-quotes.json';

function loadManualQuotes(): Map<string, string[]> {
  const byFixture = new Map<string, string[]>();
  if (!existsSync(MANUAL_QUOTES_PATH)) return byFixture;
  const quotes = parseManualQuotes(readFileSync(MANUAL_QUOTES_PATH, 'utf8'));
  for (const quote of quotes) {
    const lines = byFixture.get(`${quote.fixtureId}`) ?? [];
    lines.push(
      `MANUAL QUOTE ${quote.bookmaker} ${quote.selection} ${quote.decimalOdds.toFixed(2)}`,
    );
    byFixture.set(quote.fixtureId, lines);
  }
  return byFixture;
}

async function main(): Promise<void> {
  if (!hasNetworkKeys(config)) {
    logger.warn('Sin API keys completas: smoke test de red omitido', {
      API_FOOTBALL_KEY: config.apiFootballKey === undefined ? 'FALTA' : 'presente',
      ODDSPAPI_KEY: config.oddsPapiKey === undefined ? 'FALTANTE' : 'presente',
      hint: 'copiar .env.example -> .env y completar claves; los tests unitarios no requieren red',
    });
    return;
  }

  const fixturesAdapter = new ApiFootballFixturesAdapter(
    config.apiFootballBaseUrl,
    config.apiFootballKey as string,
  );
  const oddsAdapter = new OddsPapiAdapter(config.oddsPapiBaseUrl, config.oddsPapiKey as string);

  try {
    const { report, logs } = await runScan({
      fetchFixtures: () => fixturesAdapter.upcomingFixtures(SCAN_FIXTURE_LIMIT),
      fetchOddsEvents: () => oddsAdapter.upcomingOddsEvents(),
      fetchOddsPairs: (events) => oddsAdapter.overUnderPairs(events),
      limit: SCAN_FIXTURE_LIMIT,
    });
    for (const entry of logs) {
      if (entry.level === 'WARN') logger.warn(entry.message);
      else logger.info(entry.message);
    }
    const manualQuotesByFixture = loadManualQuotes();
    let output = `${renderScanReport(report)}\n`;
    for (const candidate of report.candidates) {
      const lines = manualQuotesByFixture.get(candidate.fixture.id);
      if (lines !== undefined) {
        output += `\n${lines.join('\n')}\n`;
      }
    }
    process.stdout.write(output);
  } catch (error) {
    logger.error('scan fallo', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

void main();
