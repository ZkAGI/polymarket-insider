/**
 * Type definitions for Market Detail Page components
 */

export interface MarketOutcomeData {
  id: string;
  name: string;
  price: number;
  probability: number;
  change24h?: number;
  clobTokenId?: string;
}

export interface MarketData {
  id: string;
  question: string;
  slug: string;
  description: string;
  category: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  outcomes: MarketOutcomeData[];
  volume: number;
  liquidity?: number;
  createdAt: Date;
  endDate: Date | null;
  updatedAt: Date;
  image?: string;
  icon?: string;
  resolutionSource?: string;
  polymarketUrl: string;
}
