export type Sport = 'FOOTBALL';

export interface Fixture {
  id: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: Date;
  competition?: string;
}

export type MarketKind = 'MATCH_WINNER' | 'OVER_UNDER' | 'BOTH_TEAMS_SCORE';

export interface Market {
  id: string;
  fixtureId: string;
  kind: MarketKind;
  candidateNote?: string;
}

export interface OddsQuote {
  id: string;
  marketId: string;
  bookmaker: string;
  capturedAt: Date;
  odds: Record<string, number>;
}

export interface Prediction {
  id: string;
  marketId: string;
  model: string;
  createdAt: Date;
  probabilities: Record<string, number>;
}

export interface PaperBet {
  id: string;
  marketId: string;
  predictionId: string;
  createdAt: Date;
  stake: number;
  selection: string;
  odds: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'VOID';
}

export interface BankrollSnapshot {
  id: string;
  capturedAt: Date;
  balance: number;
}
