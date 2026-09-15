/**
 * Adapter HTTP para API-Football (api-football.com, v3).
 * Traduce el JSON del proveedor al modelo interno. Consume `/fixtures?date=…`
 * por dia de una ventana corta: el plan Free no permite el parámetro `next`, ni
 * `league=`+`season=` para la temporada vigente (bloqueado fuera de 2022-2024,
 * verificado con la API real). La respuesta completa se filtra por el universo de
 * ligas observables (`domain/leagueUniverse.ts`, whitelist por leagueId+país) antes
 * de aplicar el límite: el mismo fetch diario/global sirve para todas las ligas del
 * universo, sin llamadas adicionales por liga.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type DatabaseSync as Db } from 'node:sqlite';
import type { Fixture } from '../domain/concepts';
import { isObservable } from '../domain/leagueUniverse';
import type { FixturesProvider } from '../ports/fixturesProvider';
import { FixturesProviderError } from '../ports/fixturesProvider';

export const FIXTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Subconjunto del JSON real de API-Football que consumimos. */
export interface ApiFootballFixtureResponse {
  response: Array<{
    fixture: { id: number; date: string; status: { short: string } };
    league: { id: number; name: string; country: string };
    teams: { home: { name: string }; away: { name: string } };
  }>;
}

function assertResponseShape(payload: unknown): ApiFootballFixtureResponse {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !Array.isArray((payload as ApiFootballFixtureResponse).response)
  ) {
    throw new FixturesProviderError('respuesta de API-Football sin array "response"');
  }
  return payload as ApiFootballFixtureResponse;
}

export function parseFixtures(payload: unknown): Fixture[] {
  const body = assertResponseShape(payload);
  return body.response.map((entry) => ({
    id: String(entry.fixture.id),
    sport: 'FOOTBALL',
    league: entry.league.name,
    leagueId: entry.league.id,
    country: entry.league.country,
    homeTeam: entry.teams.home.name,
    awayTeam: entry.teams.away.name,
    kickoffAt: new Date(entry.fixture.date),
    status: entry.fixture.status.short,
  }));
}

/**
 * Se instancia vía factory provider en `scanning.module.ts` (no vía `useClass`),
 * por lo que no necesita `@Injectable()`: Nest no gestiona su construcción.
 */
export class ApiFootballFixturesAdapter implements FixturesProvider {
  private readonly db: Db;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    /**
     * Dias de la ventana de busqueda. El plan Free rechaza `next`, por lo que
     * se consulta por fecha (`date=YYYY-MM-DD`) desde hoy hasta hoy + N - 1.
     */
    private readonly dateWindowDays = 2,
    cachePath = ':memory:',
    private readonly nowImpl: () => Date = () => new Date(),
  ) {
    if (cachePath !== ':memory:') mkdirSync(dirname(cachePath), { recursive: true });
    this.db = new DatabaseSync(cachePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fixture_cache (
        fixtureId TEXT PRIMARY KEY,
        leagueId INTEGER NOT NULL,
        home TEXT NOT NULL,
        away TEXT NOT NULL,
        kickoffAt TEXT NOT NULL,
        status TEXT NOT NULL,
        league TEXT NOT NULL,
        country TEXT NOT NULL,
        fetchedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      )
    `);
  }

  private requests = 0;
  private lastCacheHit = false;
  private lastCacheAgeMinutes = 0;

  async upcomingFixtures(limit: number): Promise<Fixture[]> {
    const now = this.nowImpl();
    const cached = this.readCache(now, limit);
    if (cached !== null) {
      this.lastCacheHit = true;
      this.lastCacheAgeMinutes = cached.ageMinutes;
      return cached.fixtures;
    }

    this.lastCacheHit = false;
    this.lastCacheAgeMinutes = 0;
    const days = Array.from({ length: this.dateWindowDays }, (_, i) => {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() + i);
      return day.toISOString().slice(0, 10);
    });
    const bodies = await Promise.all(
      days.map(async (day) => {
        const url = `${this.baseUrl}/fixtures?date=${day}`;
        this.requests += 1;
        const response = await this.fetchImpl(url, {
          headers: { 'x-apisports-key': this.apiKey },
        });
        if (!response.ok) {
          throw new FixturesProviderError(`API-Football respondio HTTP ${response.status}`);
        }
        return (await response.json()) as unknown;
      }),
    );
    const fetchedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + FIXTURE_CACHE_TTL_MS).toISOString();
    const fixtures = bodies
      .flatMap((body) => parseFixtures({ response: assertResponseShape(body).response }))
      .filter((fixture) => fixture.status === 'NS')
      .filter((fixture) => isObservable(fixture))
      .sort((left, right) => left.kickoffAt.getTime() - right.kickoffAt.getTime());
    this.writeCache(fixtures, fetchedAt, expiresAt);
    return fixtures.slice(0, limit);
  }

  requestCount(): number {
    return this.requests;
  }

  cacheHit(): boolean {
    return this.lastCacheHit;
  }

  cacheAgeMinutes(): number {
    return this.lastCacheAgeMinutes;
  }

  close(): void {
    this.db.close();
  }

  private readCache(now: Date, limit: number): { fixtures: Fixture[]; ageMinutes: number } | null {
    const rows = this.db
      .prepare(
        `SELECT fixtureId, leagueId, home, away, kickoffAt, status, league, country,
                fetchedAt, expiresAt
           FROM fixture_cache
          WHERE expiresAt > ? AND kickoffAt >= ?
          ORDER BY kickoffAt`,
      )
      .all(now.toISOString(), now.toISOString()) as Record<string, unknown>[];
    if (rows.length === 0) return null;
    const oldestFetchedAt = Math.min(...rows.map((row) => Date.parse(String(row['fetchedAt']))));
    return {
      fixtures: rows.slice(0, limit).map((row) => ({
        id: String(row['fixtureId']),
        sport: 'FOOTBALL',
        league: String(row['league']),
        leagueId: Number(row['leagueId']),
        country: String(row['country']),
        homeTeam: String(row['home']),
        awayTeam: String(row['away']),
        kickoffAt: new Date(String(row['kickoffAt'])),
        status: String(row['status']),
      })),
      ageMinutes: Math.max(0, Math.floor((now.getTime() - oldestFetchedAt) / 60_000)),
    };
  }

  private writeCache(fixtures: readonly Fixture[], fetchedAt: string, expiresAt: string): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO fixture_cache
        (fixtureId, leagueId, home, away, kickoffAt, status, league, country, fetchedAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const fixture of fixtures) {
      insert.run(
        fixture.id,
        fixture.leagueId as number,
        fixture.homeTeam,
        fixture.awayTeam,
        fixture.kickoffAt.toISOString(),
        fixture.status,
        fixture.league,
        fixture.country as string,
        fetchedAt,
        expiresAt,
      );
    }
  }
}
