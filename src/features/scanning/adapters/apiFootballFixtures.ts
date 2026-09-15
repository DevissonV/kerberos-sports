/**
 * Adapter HTTP para API-Football (api-football.com, v3).
 * Traduce el JSON del proveedor al modelo interno. Consume `/fixtures?date=…`
 * por dia de una ventana corta: el plan Free no permite el parámetro `next`, ni
 * `league=`+`season=` para la temporada vigente (bloqueado fuera de 2022-2024,
 * verificado con la API real). El filtro de universo por liga/país de la cohorte
 * (`leagueId===39 && country==='England'`) NO se aplica aquí: se traduce el JSON
 * crudo tal cual (incluye `leagueId`/`country`) y `domain/protocol.ts` decide
 * elegibilidad en `runScan`, para mantener el adapter como traducción pura.
 */

import type { Fixture } from '../domain/concepts';
import type { FixturesProvider } from '../ports/fixturesProvider';
import { FixturesProviderError } from '../ports/fixturesProvider';

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
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    /**
     * Dias de la ventana de busqueda. El plan Free rechaza `next`, por lo que
     * se consulta por fecha (`date=YYYY-MM-DD`) desde hoy hasta hoy + N - 1.
     */
    private readonly dateWindowDays = 2,
  ) {}

  async upcomingFixtures(limit: number): Promise<Fixture[]> {
    const days = Array.from({ length: this.dateWindowDays }, (_, i) => {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() + i);
      return day.toISOString().slice(0, 10);
    });
    const bodies = await Promise.all(
      days.map(async (day) => {
        const url = `${this.baseUrl}/fixtures?date=${day}`;
        const response = await this.fetchImpl(url, {
          headers: { 'x-apisports-key': this.apiKey },
        });
        if (!response.ok) {
          throw new FixturesProviderError(`API-Football respondio HTTP ${response.status}`);
        }
        return (await response.json()) as unknown;
      }),
    );
    // Ventana comun con OddsPapi: solo "Not Started" (futuros) y hasta `limit`
    // por dia, para no llenar el cupo con partidos ya iniciados del dia 1.
    return bodies.flatMap((body) =>
      parseFixtures({ response: assertResponseShape(body).response })
        .filter((fixture) => fixture.status === 'NS')
        .slice(0, limit),
    );
  }
}
