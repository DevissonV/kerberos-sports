/**
 * Smoke test manual de Poisson V1 (`npm run poisson:smoke`). Corre el modelo sobre al menos
 * 3 fixtures/equipos válidos de Premier League usando el histórico local versionado y el
 * snapshot actual. No usa odds, no declara oportunidad (protocolo sección 12 de la tarea
 * `KSS-POISSON-01`): solo reporta lambdas y probabilidades del modelo.
 */

import { loadLocalHistoricalMatches } from '../features/poisson/adapters/localCsvHistoricalMatches';
import { computePoissonV1 } from '../features/poisson/domain/model';
import { logger } from '../shared/logging/logger';

const SMOKE_FIXTURES: { fixtureId: string; home: string; away: string }[] = [
  { fixtureId: 'smoke-1', home: 'Arsenal', away: 'Chelsea' },
  { fixtureId: 'smoke-2', home: 'Liverpool', away: 'Everton' },
  { fixtureId: 'smoke-3', home: 'Newcastle', away: 'Tottenham' },
];

function main(): void {
  const snapshotAt = new Date();
  const historicalMatches = loadLocalHistoricalMatches();

  for (const fixture of SMOKE_FIXTURES) {
    const result = computePoissonV1({
      fixtureId: fixture.fixtureId,
      league: 'Premier League',
      home: fixture.home,
      away: fixture.away,
      snapshotAt,
      historicalMatches,
    });

    if (result.status !== 'OK') {
      logger.warn('Poisson smoke: fixture excluido', {
        home: fixture.home,
        away: fixture.away,
        reason: result.status,
      });
      continue;
    }

    const { output } = result;
    logger.info('Poisson smoke', {
      HOME: output.home,
      AWAY: output.away,
      HOME_ROLE_MATCHES: output.homeRoleMatches,
      AWAY_ROLE_MATCHES: output.awayRoleMatches,
      LAMBDA_HOME: output.lambdaHome.toFixed(3),
      LAMBDA_AWAY: output.lambdaAway.toFixed(3),
      P_OVER: output.pOver.toFixed(4),
      P_UNDER: output.pUnder.toFixed(4),
      dataQuality: output.dataQuality,
    });
  }
}

main();
