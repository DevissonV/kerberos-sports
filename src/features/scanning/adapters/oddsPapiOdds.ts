/**
 * Adapter HTTP para OddsPapi (oddspapi.io v4).
 * - /v4/fixtures?sportId=10&from&to  -> eventos próximos con nombres (1 request).
 * - /v4/odds-by-tournaments         -> cuotas batch por torneo (1 request por corrida).
 * NO asumimos nombres de markets: detectamos la línea 2.5 por el patrón real del
 * proveedor ("bookmakerOutcomeId": "2.5/over" | "2.5/under") y validamos todo.
 */

import type { BookmakerQuote, OddsPair } from '../domain/concepts';
import type { OddsEvent } from '../domain/matching';
import type { OddsProvider } from '../ports/oddsProvider';
import { OddsProviderError } from '../ports/oddsProvider';

/** sportId de Soccer en OddsPapi (docs oficiales). */
const SOCCER_SPORT_ID = 10;
/**
 * Bookmaker usado en cuotas batch: la API exige exactamente uno por request.
 * 1xbet expone outcome ids numericos internos (sin patron "2.5/over|under");
 * pinnacle usa el formato legible que detecta `detectOverUnder25`.
 */
const ODDS_BOOKMAKER = 'pinnacle';
/** Maximo de torneos por request de cuotas (la API rechaza mas de 5 con HTTP 400). */
const TOURNAMENT_BATCH_SIZE = 5;
/** Cooldown documentado del endpoint odds-by-tournaments. */
/** Cooldown global entre requests de OddsPapi (docs: endpoints limitados ~1s). */
const REQUEST_COOLDOWN_MS = 1100;

/** Subconjunto del JSON real de OddsPapi (v4/fixtures y v4/odds-by-tournaments). */
export interface OddsPapiFixturePayload {
  fixtureId: string;
  tournamentId?: number;
  participant1Name?: string;
  participant2Name?: string;
  startTime: string;
  tournamentName?: string;
  bookmakerOdds?: Record<
    string,
    {
      markets?: Record<
        string,
        {
          outcomes?: Record<
            string,
            {
              players?: Record<
                string,
                {
                  active?: boolean;
                  bookmakerOutcomeId?: string;
                  price?: number;
                  changedAt?: string;
                }
              >;
            }
          >;
        }
      >;
    }
  >;
}

function assertArray(payload: unknown): OddsPapiFixturePayload[] {
  if (!Array.isArray(payload)) {
    throw new OddsProviderError('respuesta de OddsPapi sin array de fixtures');
  }
  return payload as OddsPapiFixturePayload[];
}

/** Extrae eventos normalizados de /v4/fixtures o /v4/odds-by-tournaments. */
export function parseOddsEvents(payload: unknown): OddsEvent[] {
  return assertArray(payload)
    .filter(
      (entry) =>
        typeof entry.participant1Name === 'string' && typeof entry.participant2Name === 'string',
    )
    .map((entry) => ({
      id: entry.fixtureId,
      homeTeam: entry.participant1Name as string,
      awayTeam: entry.participant2Name as string,
      kickoffAt: new Date(entry.startTime),
      league: entry.tournamentName,
      tournamentId: entry.tournamentId,
    }));
}

interface RawOutcome {
  active?: boolean;
  bookmakerOutcomeId?: string;
  price?: number;
  changedAt?: string;
}

function forEachOutcome(
  fixture: OddsPapiFixturePayload,
  visit: (bookmaker: string, outcome: RawOutcome) => void,
): void {
  for (const [bookmaker, book] of Object.entries(fixture.bookmakerOdds ?? {})) {
    for (const market of Object.values(book.markets ?? {})) {
      for (const outcome of Object.values(market.outcomes ?? {})) {
        for (const player of Object.values(outcome.players ?? {})) {
          visit(bookmaker, player);
        }
      }
    }
  }
}

/**
 * Detecta si el outcome es Over/Under con línea 2.5 según los formatos reales
 * observados en OddsPapi: bookmakerOutcomeId "2.5/over", "2.5/under" (y variantes
 * "over/2.5"). Devuelve la selección o null si no es O/U 2.5.
 */
export function detectOverUnder25(outcomeId: string | undefined): 'OVER_2_5' | 'UNDER_2_5' | null {
  if (outcomeId === undefined) return null;
  const normalized = outcomeId.toLowerCase().replace(/\s/g, '');
  if (normalized === '2.5/over' || normalized === 'over/2.5') return 'OVER_2_5';
  if (normalized === '2.5/under' || normalized === 'under/2.5') return 'UNDER_2_5';
  return null;
}

/**
 * Extrae pares over/under 2.5 de un fixture. Prioriza el bookmaker consultado
 * (pinnacle); si no está, usa el primer bookmaker con par completo.
 * Books sin par completo se descartan.
 */
export function extractOddsPairs(fixture: OddsPapiFixturePayload): OddsPair[] {
  const quotesByBook = new Map<string, { over?: BookmakerQuote; under?: BookmakerQuote }>();

  forEachOutcome(fixture, (bookmaker, outcome) => {
    if (outcome.active === false) return;
    const selection = detectOverUnder25(outcome.bookmakerOutcomeId);
    if (selection === null) return;
    if (typeof outcome.price !== 'number' || !Number.isFinite(outcome.price) || outcome.price <= 1)
      return;

    const entry = quotesByBook.get(bookmaker) ?? {};
    const quote: BookmakerQuote = {
      bookmaker,
      selection,
      decimalOdds: outcome.price,
      capturedAt: new Date(outcome.changedAt ?? fixture.startTime),
    };
    if (selection === 'OVER_2_5') entry.over = quote;
    else entry.under = quote;
    quotesByBook.set(bookmaker, entry);
  });

  const pairs: OddsPair[] = [];
  for (const [bookmaker, entry] of quotesByBook) {
    if (entry.over !== undefined && entry.under !== undefined) {
      pairs.push({ fixtureId: fixture.fixtureId, bookmaker, over: entry.over, under: entry.under });
    }
  }
  // Pinnacle primero: es el bookmaker consultado en batch.
  pairs.sort((a, b) => {
    const aPref = a.bookmaker.toLowerCase() === ODDS_BOOKMAKER ? 0 : 1;
    const bPref = b.bookmaker.toLowerCase() === ODDS_BOOKMAKER ? 0 : 1;
    return aPref - bPref;
  });
  return pairs;
}

export class OddsPapiAdapter implements OddsProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private lastRequestAt = 0;

  private async getJson(path: string, query: Record<string, string>): Promise<unknown> {
    // Rate limit global de la API: pacing de 1100ms entre requests.
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (this.lastRequestAt > 0 && elapsed < REQUEST_COOLDOWN_MS) {
      await sleep(REQUEST_COOLDOWN_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    url.searchParams.set('apiKey', this.apiKey);

    const response = await this.fetchImpl(url.toString());
    if (!response.ok) {
      throw new OddsProviderError(`OddsPapi respondio HTTP ${response.status} en ${path}`);
    }
    return response.json();
  }

  async upcomingOddsEvents(): Promise<OddsEvent[]> {
    const now = new Date();
    const to = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const payload = await this.getJson('/v4/fixtures', {
      sportId: String(SOCCER_SPORT_ID),
      from: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      to: to.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      statusId: '0',
      hasOdds: 'true',
    });
    return parseOddsEvents(payload);
  }

  async overUnderPairs(events: readonly OddsEvent[]): Promise<OddsPair[]> {
    if (events.length === 0) return [];
    const tournamentIds = [
      ...new Set(
        events
          .map((event) => event.tournamentId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    if (tournamentIds.length === 0) return [];

    // La API exige exactamente un bookmaker por request; el pacing global hace el cooldown.
    const tournamentBatches: number[][] = [];
    for (let i = 0; i < tournamentIds.length; i += TOURNAMENT_BATCH_SIZE) {
      tournamentBatches.push(tournamentIds.slice(i, i + TOURNAMENT_BATCH_SIZE));
    }
    const pairs: OddsPair[] = [];
    for (const batch of tournamentBatches) {
      const payload = await this.getJson('/v4/odds-by-tournaments', {
        tournamentIds: batch.join(','),
        bookmaker: ODDS_BOOKMAKER,
        oddsFormat: 'decimal',
      });
      const fixtures = assertArray(payload);
      pairs.push(...fixtures.flatMap((fixture) => extractOddsPairs(fixture)));
    }
    return pairs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
