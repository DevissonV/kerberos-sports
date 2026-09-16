import type { TennisTour } from '../domain/identity';

export type LiveTennisOutcome =
  'completed' | 'retired' | 'walkover' | 'default' | 'abandoned' | 'unresolved' | null;

export interface LiveTennisMatch {
  id: string;
  tour: TennisTour;
  playerOneId: string;
  playerOneName: string;
  playerTwoId: string;
  playerTwoName: string;
  scheduledAt: Date;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  surface: 'hard' | 'clay' | 'grass' | null;
  round: string | null;
  winner: 1 | 2 | null;
  outcome: LiveTennisOutcome;
  withdrew: 1 | 2 | null;
}

type LiveTennisPayload = {
  id?: unknown;
  tour?: unknown;
  players?: { p1?: { id?: unknown; name?: unknown }; p2?: { id?: unknown; name?: unknown } };
  scheduled_time?: unknown;
  status?: unknown;
  surface?: unknown;
  round?: unknown;
  winner?: unknown;
  outcome?: unknown;
  withdrew?: unknown;
};

const statuses = new Set(['upcoming', 'live', 'completed', 'cancelled']);
const outcomes = new Set([
  'completed',
  'retired',
  'walkover',
  'default',
  'abandoned',
  'unresolved',
]);

/** Parser estricto: un dato esencial ausente no se convierte en fixture elegible. */
export function parseLiveTennisMatch(payload: unknown): LiveTennisMatch {
  const value = payload as LiveTennisPayload;
  const scheduledAt = new Date(String(value.scheduled_time));
  const tour = typeof value.tour === 'string' ? value.tour.toUpperCase() : '';
  if (
    !value ||
    (tour !== 'ATP' && tour !== 'WTA') ||
    (typeof value.id !== 'number' && typeof value.id !== 'string') ||
    !value.players ||
    (typeof value.players.p1?.id !== 'number' && typeof value.players.p1?.id !== 'string') ||
    (typeof value.players.p2?.id !== 'number' && typeof value.players.p2?.id !== 'string') ||
    typeof value.players.p1.name !== 'string' ||
    typeof value.players.p2.name !== 'string' ||
    Number.isNaN(scheduledAt.getTime()) ||
    typeof value.status !== 'string' ||
    !statuses.has(value.status)
  ) {
    throw new Error('payload Live Tennis inválido para fixture TENNIS');
  }
  const surface = value.surface ?? null;
  const outcome = value.outcome ?? null;
  if (
    surface !== null &&
    (typeof surface !== 'string' || !['hard', 'clay', 'grass'].includes(surface))
  )
    throw new Error('surface Live Tennis inválida');
  if (outcome !== null && (typeof outcome !== 'string' || !outcomes.has(outcome)))
    throw new Error('outcome Live Tennis inválido');
  if (
    value.winner !== null &&
    value.winner !== undefined &&
    value.winner !== 1 &&
    value.winner !== 2
  )
    throw new Error('winner Live Tennis inválido');
  return {
    id: String(value.id),
    tour,
    playerOneId: String(value.players.p1.id),
    playerOneName: value.players.p1.name,
    playerTwoId: String(value.players.p2.id),
    playerTwoName: value.players.p2.name,
    scheduledAt,
    status: value.status as LiveTennisMatch['status'],
    surface: surface as LiveTennisMatch['surface'],
    round: typeof value.round === 'string' ? value.round : null,
    winner: value.winner ?? null,
    outcome: outcome as LiveTennisOutcome,
    withdrew: (value.withdrew ?? null) as LiveTennisMatch['withdrew'],
  };
}

/** Adapter aislado: no se registra todavía en Nest ni habilita tenis. */
export class LiveTennisApiAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async upcomingSingles(tour: TennisTour): Promise<LiveTennisMatch[]> {
    const url = new URL('/fixtures', this.baseUrl);
    url.searchParams.set('tour', tour.toLowerCase());
    url.searchParams.set('draw', 'singles');
    const response = await this.fetchImpl(url, { headers: { 'X-API-Key': this.apiKey } });
    if (!response.ok) throw new Error(`Live Tennis respondió HTTP ${response.status}`);
    const payload = (await response.json()) as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new Error('respuesta Live Tennis sin data[]');
    return payload.data.map(parseLiveTennisMatch);
  }
}
