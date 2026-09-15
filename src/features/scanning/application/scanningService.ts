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
import { decisionAtFromKickoff, evaluateDecisionWindow } from '../domain/decisionWindow';
import { evaluateProtocolEligibility } from '../domain/protocol';
import type { Fixture } from '../domain/concepts';

export interface PrecheckFixture {
  fixture: Fixture;
  decisionAt: Date;
  needsSnapshot: boolean;
}

export interface PrecheckOutput {
  rawFixtures: number;
  fixtures: PrecheckFixture[];
  eligibleFixtures: number;
  decisionWindowFixtures: PrecheckFixture[];
}

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

  async precheck(limit: number, now = new Date()): Promise<PrecheckOutput> {
    const raw = await this.fixturesProvider.upcomingFixtures(limit);
    const fixtures = raw
      .filter((fixture) => evaluateProtocolEligibility(fixture) === null)
      .map((fixture) => ({
        fixture,
        decisionAt: decisionAtFromKickoff(fixture.kickoffAt),
        needsSnapshot:
          evaluateDecisionWindow(fixture.kickoffAt, now) === 'ELIGIBLE_AT_DECISION_WINDOW',
      }));
    return {
      rawFixtures: raw.length,
      fixtures,
      eligibleFixtures: fixtures.length,
      decisionWindowFixtures: fixtures.filter((entry) => entry.needsSnapshot),
    };
  }

  async scanFixtures(fixtures: readonly Fixture[], now = new Date()): Promise<ScanOutput> {
    return runScan({
      fetchFixtures: () => Promise.resolve([...fixtures]),
      fetchOddsEvents: () => this.oddsProvider.upcomingOddsEvents(),
      fetchOddsPairs: (events) => this.oddsProvider.overUnderPairs(events),
      limit: fixtures.length,
      now,
    });
  }

  oddsPapiRequests(): number {
    const provider = this.oddsProvider as OddsProvider & { requestCount?: () => number };
    return provider.requestCount?.() ?? 0;
  }

  apiFootballRequests(): number {
    const provider = this.fixturesProvider as FixturesProvider & { requestCount?: () => number };
    return provider.requestCount?.() ?? 0;
  }
}
