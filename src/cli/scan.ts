/**
 * Comando de escaneo QUANT end-to-end (npm run scan). Pipeline PAPER ONLY:
 * fixtures -> odds O/U 2.5 -> matching -> snapshot T-6h -> Poisson V1 -> de-vig ->
 * edge -> EV -> gate -> PaperBet SQLite -> Telegram. Solo hace requests reales
 * si las API keys están en .env; si no, guía sin fallar la suite de tests.
 * Requiere el histórico local (resources/data/premier-league) para el modelo.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { QuantModule } from '../features/quant/quant.module';
import { QuantScanService } from '../features/quant/application/quantScanService';
import { RefinementService } from '../features/quant/application/refinementService';
import { renderQuantRun } from '../features/quant/application/quantReport';
import { config, hasNetworkKeys } from '../shared/config/configuration';
import { logger } from '../shared/logging/logger';

const SCAN_FIXTURE_LIMIT = 20;

async function main(): Promise<void> {
  if (!hasNetworkKeys(config)) {
    logger.warn('Sin API keys completas: smoke test de red omitido', {
      API_FOOTBALL_KEY: config.apiFootballKey === undefined ? 'FALTA' : 'presente',
      ODDSPAPI_KEY: config.oddsPapiKey === undefined ? 'FALTANTE' : 'presente',
      hinted: 'copiar .env.example -> .env y completar claves; los tests no requieren red',
    });
    return;
  }
  if (config.telegramBotToken === undefined || config.telegramChatId === undefined) {
    // Nota informativa: el scan corre y persiste, pero sin Telegram.
    logger.warn('Telegram no configurado: las PaperBets nuevas no se notifican', {});
  }

  const app = await NestFactory.createApplicationContext(QuantModule, { logger: false });
  try {
    const quantScan = app.get(QuantScanService);
    if (config.refinementMode) {
      const refinement = app.get(RefinementService);
      const summary = await refinement.runTick(config);
      process.stdout.write(
        `${JSON.stringify({
          PRECHECK_ONLY: summary.precheckOnly,
          PL_FIXTURES: summary.premierLeagueFixtures,
          DECISION_WINDOW_FIXTURES: summary.decisionWindowFixtures,
          FULL_ODDS_SCANS: summary.fullOddsScans,
          ODDSPAPI_REQUESTS: summary.oddsPapiRequests,
          QUANT_CANDIDATES: summary.quantCandidates,
          PAPER_BETS: summary.paperBetsCreated,
          LUNA_CALLS: summary.lunaCalls,
          SETTLEMENTS: summary.settlements,
          TELEGRAM_HEARTBEAT_SENT: summary.heartbeatSent,
          BUDGET_GUARD: summary.budgetGuard,
          ERROR: summary.error,
        })}\n`,
      );
      return;
    }
    const summary = await quantScan.runScan(SCAN_FIXTURE_LIMIT);
    for (const entry of summary.scan.logs) {
      if (entry.level === 'WARN') logger.warn(entry.message);
      else logger.info(entry.message);
    }
    process.stdout.write(`${renderQuantRun(summary)}\n`);
  } catch (error) {
    logger.error('scan fallo', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
