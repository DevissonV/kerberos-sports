export type PaperBetStatus = 'OPEN' | 'WON' | 'LOST' | 'VOID';

export interface PaperBet {
  id: string;
  marketId: string;
  predictionId: string;
  createdAt: Date;
  stake: number;
  selection: string;
  odds: number;
  status: PaperBetStatus;
}
