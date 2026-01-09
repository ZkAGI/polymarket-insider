/**
 * Type definitions for Polymarket Gamma API responses
 */

/**
 * Market outcome with price/probability data
 */
export interface GammaOutcome {
  id: string;
  name: string;
  price: number;
  clobTokenId?: string;
}

/**
 * Enhanced outcome data with probability and additional calculated fields
 */
export interface MarketOutcome {
  /** Unique identifier for this outcome */
  id: string;

  /** Human-readable name (e.g., "Yes", "No", "Donald Trump") */
  name: string;

  /** Current price/probability as a decimal between 0 and 1 */
  price: number;

  /** Current probability as a percentage (0-100) */
  probability: number;

  /** CLOB token ID for trading, if available */
  clobTokenId?: string;
}

/**
 * Result from fetching market outcomes
 */
export interface MarketOutcomesResult {
  /** Market ID */
  marketId: string;

  /** Market question */
  question: string;

  /** Whether the market is active */
  active: boolean;

  /** Whether the market is closed */
  closed: boolean;

  /** All outcomes with probabilities */
  outcomes: MarketOutcome[];

  /** Sum of all outcome probabilities (should be close to 100) */
  totalProbability: number;

  /** Timestamp of when this data was fetched */
  fetchedAt: string;
}

/**
 * Market data returned from Gamma API
 */
export interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  description: string;
  category: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  outcomes: GammaOutcome[];
  volume: number;
  volumeNum?: number;
  liquidity?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  resolutionSource?: string;
  resolvedBy?: string;
  image?: string;
  icon?: string;
}

/**
 * Paginated response wrapper for markets list
 */
export interface GammaMarketsResponse {
  data: GammaMarket[];
  count?: number;
  limit?: number;
  offset?: number;
}

/**
 * API error response
 */
export interface GammaApiError {
  message: string;
  code?: string;
  statusCode: number;
}

/**
 * Client configuration options
 */
export interface GammaClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Request options for API calls
 */
export interface GammaRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * Supported time intervals for historical data
 */
export type TimeInterval = "1h" | "4h" | "1d" | "1w" | "1m";

/**
 * Time range for volume history queries
 */
export interface TimeRange {
  /** Start date/time (ISO string or Date) */
  startDate: string | Date;

  /** End date/time (ISO string or Date) */
  endDate: string | Date;
}

/**
 * A single data point in volume history time series
 */
export interface VolumeDataPoint {
  /** Timestamp for this data point (ISO string) */
  timestamp: string;

  /** Trading volume in this period (in USD/USDC) */
  volume: number;

  /** Number of trades in this period */
  tradeCount?: number;

  /** Cumulative volume up to this point (if available) */
  cumulativeVolume?: number;
}

/**
 * Result from fetching market volume history
 */
export interface VolumeHistoryResult {
  /** Market ID */
  marketId: string;

  /** Market question for reference */
  question: string;

  /** Start of the time range */
  startDate: string;

  /** End of the time range */
  endDate: string;

  /** Time interval used for aggregation */
  interval: TimeInterval;

  /** Array of volume data points */
  dataPoints: VolumeDataPoint[];

  /** Total volume over the entire time range */
  totalVolume: number;

  /** Total number of trades over the entire time range */
  totalTrades?: number;

  /** Timestamp of when this data was fetched */
  fetchedAt: string;
}
