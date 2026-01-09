/**
 * Type definitions for Polymarket CLOB (Central Limit Order Book) API
 *
 * The CLOB API provides access to order books, trades, and trading operations
 * on the Polymarket exchange.
 */

/**
 * Client configuration options for the CLOB API
 */
export interface ClobClientConfig {
  /** Base URL for the CLOB API */
  baseUrl?: string;

  /** API key for authenticated endpoints (optional for public endpoints) */
  apiKey?: string;

  /** API secret for signing requests (required for authenticated endpoints) */
  apiSecret?: string;

  /** API passphrase for additional authentication */
  apiPassphrase?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Number of retry attempts for failed requests */
  retries?: number;
}

/**
 * Request options for CLOB API calls
 */
export interface ClobRequestOptions {
  /** HTTP method */
  method?: "GET" | "POST" | "PUT" | "DELETE";

  /** Custom headers to include in the request */
  headers?: Record<string, string>;

  /** Request body for POST/PUT requests */
  body?: unknown;

  /** Request timeout override */
  timeout?: number;

  /** Whether this endpoint requires authentication */
  requiresAuth?: boolean;
}

/**
 * API error response from CLOB API
 */
export interface ClobApiError {
  /** Error message */
  message: string;

  /** Error code (if provided by API) */
  code?: string;

  /** HTTP status code */
  statusCode: number;
}

/**
 * Order side in the order book
 */
export type OrderSide = "BUY" | "SELL";

/**
 * Order type
 */
export type OrderType = "GTC" | "GTD" | "FOK" | "IOC";

/**
 * Order status
 */
export type OrderStatus = "live" | "matched" | "cancelled" | "expired";

/**
 * Trade/Order direction
 */
export type TradeDirection = "buy" | "sell";

/**
 * A single order in the order book
 */
export interface Order {
  /** Order ID */
  id: string;

  /** Market/asset ID */
  asset_id: string;

  /** Maker address (wallet that created the order) */
  maker_address: string;

  /** Order side (BUY or SELL) */
  side: OrderSide;

  /** Price per share (0-1 for binary markets) */
  price: string;

  /** Original order size */
  original_size: string;

  /** Remaining size to be filled */
  size_matched: string;

  /** Order type */
  order_type?: OrderType;

  /** Order status */
  status: OrderStatus;

  /** Expiration timestamp (for GTD orders) */
  expiration?: string;

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Order book level with aggregated price/size
 */
export interface OrderBookLevel {
  /** Price at this level */
  price: string;

  /** Total size at this price level */
  size: string;
}

/**
 * Full order book for a market
 */
export interface OrderBook {
  /** Market/asset ID */
  asset_id: string;

  /** Timestamp of the order book snapshot */
  timestamp: string;

  /** Buy orders (bids) sorted by price descending */
  bids: OrderBookLevel[];

  /** Sell orders (asks) sorted by price ascending */
  asks: OrderBookLevel[];

  /** Best bid price */
  best_bid?: string;

  /** Best ask price */
  best_ask?: string;

  /** Spread between best bid and ask */
  spread?: string;

  /** Hash of the order book state */
  hash?: string;
}

/**
 * A single executed trade
 */
export interface Trade {
  /** Trade ID */
  id: string;

  /** Market/asset ID */
  asset_id: string;

  /** Taker address (wallet that executed against the order) */
  taker_address?: string;

  /** Maker address (wallet that had the resting order) */
  maker_address?: string;

  /** Trade side from taker's perspective */
  side: TradeDirection;

  /** Execution price */
  price: string;

  /** Trade size */
  size: string;

  /** Transaction hash on Polygon */
  transaction_hash?: string;

  /** Execution timestamp */
  created_at: string;

  /** Fee amount */
  fee_rate_bps?: string;

  /** Match ID linking maker and taker */
  match_id?: string;

  /** Bucket index for time-series data */
  bucket_index?: number;
}

/**
 * Trade execution details with USD values
 */
export interface TradeExecution extends Trade {
  /** Trade size in USD equivalent */
  size_usd: number;

  /** Fee amount in USD */
  fee_usd?: number;

  /** Outcome name for this trade */
  outcome_name?: string;

  /** Market question */
  market_question?: string;
}

/**
 * Filter options for querying trades
 */
export interface TradeFilter {
  /** Start timestamp (ISO string or Unix timestamp) */
  startTs?: string | number;

  /** End timestamp (ISO string or Unix timestamp) */
  endTs?: string | number;

  /** Minimum trade size */
  minSize?: number;

  /** Maximum trade size */
  maxSize?: number;

  /** Filter by maker address */
  maker?: string;

  /** Filter by taker address */
  taker?: string;

  /** Filter by trade side */
  side?: TradeDirection;

  /** Maximum number of trades to return */
  limit?: number;

  /** Pagination cursor */
  cursor?: string;
}

/**
 * Paginated response for trades
 */
export interface TradesResponse {
  /** Array of trades */
  trades: Trade[];

  /** Next cursor for pagination */
  next_cursor?: string;

  /** Total count (if available) */
  count?: number;
}

/**
 * Authentication credentials structure
 */
export interface ClobCredentials {
  /** API key */
  apiKey: string;

  /** API secret for signing */
  apiSecret: string;

  /** API passphrase (optional) */
  apiPassphrase?: string;
}

/**
 * Signed request headers for authenticated endpoints
 */
export interface SignedHeaders {
  /** API key header */
  "POLY-API-KEY": string;

  /** Signature header */
  "POLY-SIGNATURE": string;

  /** Timestamp header */
  "POLY-TIMESTAMP": string;

  /** Passphrase header (optional) */
  "POLY-PASSPHRASE"?: string;
}

/**
 * Market info from CLOB API
 */
export interface ClobMarket {
  /** Token ID for YES outcome */
  token_id: string;

  /** Condition ID */
  condition_id: string;

  /** Question text */
  question: string;

  /** Market end date */
  end_date_iso?: string;

  /** Game start time (for sports markets) */
  game_start_time?: string;

  /** Whether the market is active */
  active: boolean;

  /** Whether the market is closed */
  closed: boolean;

  /** Market description */
  description?: string;

  /** Icon URL */
  icon?: string;

  /** Tags/categories */
  tags?: string[];
}

/**
 * Tick size information for a market
 */
export interface TickSize {
  /** Token ID */
  token_id: string;

  /** Minimum tick size for this market */
  tick_size: string;
}

/**
 * Order book depth summary
 */
export interface OrderBookDepth {
  /** Asset ID */
  asset_id: string;

  /** Aggregated depth data by price level */
  depth: {
    /** Price level */
    price: string;

    /** Cumulative bid size at or above this price */
    bid_depth: string;

    /** Cumulative ask size at or below this price */
    ask_depth: string;
  }[];

  /** Total bid volume */
  total_bid_volume: string;

  /** Total ask volume */
  total_ask_volume: string;

  /** Timestamp */
  timestamp: string;
}
