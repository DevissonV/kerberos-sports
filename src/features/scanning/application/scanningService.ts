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
import {
  isModelEnabled,
  resolveLeagueStatus,
  summarizeFixturesByLeague,
} from '../domain/leagueUniverse';
import type { LeagueFixtureCount } from '../domain/leagueUniverse';
import type { Fixture } from '../domain/concepts';

export interface PrecheckFixture {
  fixture: Fixture;
  decisionAt: Date;
  needsSnapshot: boolean;
}

export interface PrecheckOutput {
  rawFixtures: number;
  /** Fixtures que pertenecen a una liga soportada por el universo observable. */
  supportedLeagueFixtures?: number;
  /** Fixtures con modelo habilitado (hoy: Premier League, cohorte KSS-V1-C01). */
  fixtures: PrecheckFixture[];
  /** Alias de `fixtures.length`: conteo con modelo habilitado. */
  eligibleFixtures: number;
  /** Fixtures OBSERVATION_ONLY detectados (visibles, nunca Poisson/QUANT/PaperBet). */
  observationFixtures: number;
  /** Solo fixtures con modelo habilitado en ventana T-6h: los únicos que disparan odds/QUANT. */
  decisionWindowFixtures: PrecheckFixture[];
  /** Desglose por liga del universo V1, en orden fijo. */
  byLeague: LeagueFixtureCount[];
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
    // Model gate: solo fixtures MODEL_ENABLED continúan hacia odds/QUANT. Fixtures
    // OBSERVATION_ONLY se cuentan (discovery) pero nunca se agregan a `fixtures`/
    // `decisionWindowFixtures`, así que nunca disparan `runScanForFixtures` (OddsPapi).
    const fixtures = raw
      .filter((fixture) => isModelEnabled(fixture))
      .map((fixture) => ({
        fixture,
        decisionAt: decisionAtFromKickoff(fixture.kickoffAt),
        needsSnapshot:
          evaluateDecisionWindow(fixture.kickoffAt, now) === 'ELIGIBLE_AT_DECISION_WINDOW',
      }));
    const observationFixtures = raw.filter(
      (fixture) => resolveLeagueStatus(fixture) === 'OBSERVATION_ONLY',
    ).length;
    return {
      rawFixtures: raw.length,
      supportedLeagueFixtures: raw.filter((fixture) => resolveLeagueStatus(fixture) !== 'EXCLUDED')
        .length,
      fixtures,
      eligibleFixtures: fixtures.length,
      observationFixtures,
      decisionWindowFixtures: fixtures.filter((entry) => entry.needsSnapshot),
      byLeague: summarizeFixturesByLeague(raw),
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

  fixtureCacheHit(): boolean {
    const provider = this.fixturesProvider as FixturesProvider & { cacheHit?: () => boolean };
    return provider.cacheHit?.() ?? false;
  }

  fixtureCacheAgeMinutes(): number {
    const provider = this.fixturesProvider as FixturesProvider & {
      cacheAgeMinutes?: () => number;
    };
    return provider.cacheAgeMinutes?.() ?? 0;
  }
}
