/**
 * Orquestador Nest del pipeline de escaneo: inyecta los puertos de fixtures y
 * odds y delega el cálculo determinista a `runScan` (dominio/aplicación pura,
 * sin decoradores). Este es el único punto donde Nest "sabe" cómo obtener los
 * datos; `runScan` sigue siendo testeable sin Nest.
 */

import { Inject, Injectable } from '@nestjs/common';
import { FIXTURES_PROVIDER } from '../ports/fixturesProvider';
import type { FixturesProvider } from '../ports/fixturesProvider';
import { ODDS_PROVIDER } from '../ports/oddsProvider';
import type { OddsProvider } from '../ports/oddsProvider';
import { runScan } from './scanPipeline';
import type { ScanOutput } from './scanPipeline';

@Injectable()
export class ScanningService {
  constructor(
    @Inject(FIXTURES_PROVIDER) private readonly fixturesProvider: FixturesProvider,
    @Inject(ODDS_PROVIDER) private readonly oddsProvider: OddsProvider,
  ) {}

  /** Ejecuta el pipeline completo (fixtures -> odds -> matching -> de-vig). */
  async scan(limit: number): Promise<ScanOutput> {
    return runScan({
      fetchFixtures: () => this.fixturesProvider.upcomingFixtures(limit),
      fetchOddsEvents: () => this.oddsProvider.upcomingOddsEvents(),
      fetchOddsPairs: (events) => this.oddsProvider.overUnderPairs(events),
      limit,
      now: new Date(),
    });
  }
}
