/**
 * Trade functions for Polymarket CLOB API
 *
 * Provides functions for fetching and parsing trade data
 * from the Polymarket CLOB (Central Limit Order Book) API.
 */

import { ClobClient, clobClient, ClobApiException } from "./client";
import { Trade, TradeDirection } from "./types";

/**
 * Options for fetching recent trades
 */
export interface GetRecentTradesOptions {
  /** Maximum number of trades to return (default: 100) */
  limit?: number;

  /** Custom CLOB client to use (defaults to singleton) */
  client?: ClobClient;
}

/**
 * Result from fetching recent trades
 */
export interface GetRecentTradesResult {
  /** Array of trades sorted by timestamp descending */
  trades: Trade[];

  /** Number of trades returned */
  count: number;

  /** Token ID for which trades were fetched */
  tokenId: string;

  /** Timestamp when the data was fetched */
  fetchedAt: string;
}

/**
 * Raw trade response from the CLOB API
 * The API may return trades in various formats
 */
interface RawTradeResponse {
  /** Trade ID */
  id?: string;
  trade_id?: string;

  /** Market/asset ID */
  market?: string;
  asset_id?: string;
  token_id?: string;

  /** Taker address */
  taker?: string;
  taker_address?: string;

  /** Maker address */
  maker?: string;
  maker_address?: string;

  /** Trade side */
  side?: string;

  /** Execution price */
  price?: string;

  /** Trade size */
  size?: string;
  amount?: string;

  /** Transaction hash */
  transaction_hash?: string;
  tx_hash?: string;

  /** Timestamp */
  timestamp?: string | number;
  created_at?: string | number;

  /** Fee rate */
  fee_rate_bps?: string;
  fee?: string;

  /** Match ID */
  match_id?: string;

  /** Bucket index for time-series */
  bucket_index?: number;
}

/**
 * Raw trades response from the API
 * Can be an array or an object with trades array
 */
interface RawTradesResponse {
  trades?: RawTradeResponse[];
  data?: RawTradeResponse[];
  next_cursor?: string;
  count?: number;
}

/**
 * Parse a raw trade side string into TradeDirection
 *
 * @param side - Raw side string from API
 * @returns Normalized TradeDirection
 */
function parseTradeDirection(side?: string): TradeDirection {
  if (!side) {
    return "buy";
  }
  const normalizedSide = side.toLowerCase().trim();
  if (normalizedSide === "sell" || normalizedSide === "s" || normalizedSide === "ask") {
    return "sell";
  }
  return "buy";
}

/**
 * Parse timestamp into ISO string
 *
 * @param timestamp - Raw timestamp (ISO string, Unix seconds, or Unix milliseconds)
 * @returns ISO timestamp string
 */
function parseTimestamp(timestamp?: string | number): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  if (typeof timestamp === "string") {
    // If already ISO format, return as-is
    if (timestamp.includes("T") || timestamp.includes("-")) {
      return timestamp;
    }
    // Try parsing as number
    const parsed = parseInt(timestamp, 10);
    if (!isNaN(parsed)) {
      // Unix timestamp - convert based on magnitude
      const ts = parsed > 1e12 ? parsed : parsed * 1000;
      return new Date(ts).toISOString();
    }
    return timestamp;
  }

  // Numeric timestamp - convert based on magnitude
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(ts).toISOString();
}

/**
 * Parse a raw trade response into a typed Trade
 *
 * @param raw - Raw trade data from API
 * @param tokenId - Token ID (fallback if not in response)
 * @returns Parsed Trade object
 */
function parseTrade(raw: RawTradeResponse, tokenId: string): Trade {
  const id = raw.id ?? raw.trade_id ?? "";
  const assetId = raw.asset_id ?? raw.token_id ?? raw.market ?? tokenId;
  const takerAddress = raw.taker_address ?? raw.taker;
  const makerAddress = raw.maker_address ?? raw.maker;
  const side = parseTradeDirection(raw.side);
  const price = raw.price ?? "0";
  const size = raw.size ?? raw.amount ?? "0";
  const transactionHash = raw.transaction_hash ?? raw.tx_hash;
  const createdAt = parseTimestamp(raw.created_at ?? raw.timestamp);
  const feeRateBps = raw.fee_rate_bps ?? raw.fee;
  const matchId = raw.match_id;
  const bucketIndex = raw.bucket_index;

  return {
    id,
    asset_id: assetId,
    taker_address: takerAddress,
    maker_address: makerAddress,
    side,
    price,
    size,
    transaction_hash: transactionHash,
    created_at: createdAt,
    fee_rate_bps: feeRateBps,
    match_id: matchId,
    bucket_index: bucketIndex,
  };
}

/**
 * Sort trades by timestamp descending (most recent first)
 *
 * @param trades - Array of trades to sort
 * @returns Sorted trades array
 */
function sortTradesByTimestampDesc(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });
}

/**
 * Fetch recent trades for a specific market/token
 *
 * Retrieves the most recent trades for a market, sorted by timestamp
 * in descending order (most recent first).
 *
 * @param tokenId - The token ID (asset ID) of the market to fetch trades for
 * @param options - Additional options (limit, client)
 * @returns The trades result with array of trades, or null if market not found
 * @throws ClobApiException on API errors (except 404)
 *
 * @example
 * ```typescript
 * // Fetch last 100 trades (default)
 * const result = await getRecentTrades("12345678901234567890");
 * if (result) {
 *   console.log(`Found ${result.count} trades`);
 *   for (const trade of result.trades) {
 *     console.log(`${trade.side} ${trade.size} @ ${trade.price}`);
 *   }
 * }
 *
 * // Fetch last 10 trades
 * const result = await getRecentTrades("12345678901234567890", { limit: 10 });
 * ```
 */
export async function getRecentTrades(
  tokenId: string,
  options: GetRecentTradesOptions = {}
): Promise<GetRecentTradesResult | null> {
  // Validate tokenId
  if (!tokenId || !tokenId.trim()) {
    return null;
  }

  const trimmedTokenId = tokenId.trim();
  const { limit = 100, client = clobClient } = options;

  // Clamp limit to reasonable bounds
  const clampedLimit = Math.max(1, Math.min(limit, 1000));

  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.set("token_id", trimmedTokenId);
    params.set("limit", clampedLimit.toString());

    // The CLOB API endpoint for trades is /trades
    const response = await client.get<RawTradesResponse | RawTradeResponse[]>(
      `/trades?${params.toString()}`
    );

    // Handle different response formats
    let rawTrades: RawTradeResponse[];

    if (Array.isArray(response)) {
      // Direct array of trades
      rawTrades = response;
    } else if (response.trades) {
      // Object with trades array
      rawTrades = response.trades;
    } else if (response.data) {
      // Object with data array
      rawTrades = response.data;
    } else {
      // No trades found
      rawTrades = [];
    }

    // Parse trades
    const trades = rawTrades.map((raw) => parseTrade(raw, trimmedTokenId));

    // Sort by timestamp descending
    const sortedTrades = sortTradesByTimestampDesc(trades);

    // Apply limit after sorting (in case API returned more)
    const limitedTrades = sortedTrades.slice(0, clampedLimit);

    return {
      trades: limitedTrades,
      count: limitedTrades.length,
      tokenId: trimmedTokenId,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Return null for 404 (market not found)
    if (error instanceof ClobApiException && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch recent trades for multiple tokens in parallel
 *
 * @param tokenIds - Array of token IDs to fetch trades for
 * @param options - Additional options (limit, client)
 * @returns Map of token ID to trades result (null for not found)
 *
 * @example
 * ```typescript
 * const tradesMap = await getRecentTradesForTokens(["token1", "token2"]);
 * for (const [tokenId, result] of tradesMap) {
 *   if (result) {
 *     console.log(`${tokenId}: ${result.count} trades`);
 *   }
 * }
 * ```
 */
export async function getRecentTradesForTokens(
  tokenIds: string[],
  options: GetRecentTradesOptions = {}
): Promise<Map<string, GetRecentTradesResult | null>> {
  const results = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const result = await getRecentTrades(tokenId, options);
      return [tokenId, result] as const;
    })
  );

  return new Map(results);
}

/**
 * Calculate the total volume from an array of trades
 *
 * @param trades - Array of trades
 * @returns Total volume as a number
 */
export function calculateTotalVolume(trades: Trade[]): number {
  return trades.reduce((total, trade) => {
    const size = parseFloat(trade.size);
    return total + (isNaN(size) ? 0 : size);
  }, 0);
}

/**
 * Calculate the volume-weighted average price (VWAP) from trades
 *
 * @param trades - Array of trades
 * @returns VWAP or undefined if no valid trades
 */
export function calculateVWAP(trades: Trade[]): number | undefined {
  let totalValue = 0;
  let totalVolume = 0;

  for (const trade of trades) {
    const price = parseFloat(trade.price);
    const size = parseFloat(trade.size);

    if (!isNaN(price) && !isNaN(size) && size > 0) {
      totalValue += price * size;
      totalVolume += size;
    }
  }

  if (totalVolume === 0) {
    return undefined;
  }

  return totalValue / totalVolume;
}

/**
 * Get the price range (min and max) from trades
 *
 * @param trades - Array of trades
 * @returns Object with min and max prices, or undefined if no valid trades
 */
export function getPriceRange(trades: Trade[]): { min: number; max: number } | undefined {
  let min = Infinity;
  let max = -Infinity;
  let hasValidPrice = false;

  for (const trade of trades) {
    const price = parseFloat(trade.price);
    if (!isNaN(price)) {
      hasValidPrice = true;
      if (price < min) min = price;
      if (price > max) max = price;
    }
  }

  if (!hasValidPrice) {
    return undefined;
  }

  return { min, max };
}

/**
 * Get trade counts by side (buy/sell)
 *
 * @param trades - Array of trades
 * @returns Object with buy and sell counts
 */
export function getTradeCounts(trades: Trade[]): { buy: number; sell: number } {
  let buy = 0;
  let sell = 0;

  for (const trade of trades) {
    if (trade.side === "buy") {
      buy++;
    } else {
      sell++;
    }
  }

  return { buy, sell };
}

/**
 * Get volume by side (buy/sell)
 *
 * @param trades - Array of trades
 * @returns Object with buy and sell volumes
 */
export function getVolumesBySide(trades: Trade[]): { buy: number; sell: number } {
  let buy = 0;
  let sell = 0;

  for (const trade of trades) {
    const size = parseFloat(trade.size);
    if (!isNaN(size)) {
      if (trade.side === "buy") {
        buy += size;
      } else {
        sell += size;
      }
    }
  }

  return { buy, sell };
}

/**
 * Filter trades by time range
 *
 * @param trades - Array of trades to filter
 * @param startTime - Start time (inclusive)
 * @param endTime - End time (exclusive)
 * @returns Filtered array of trades
 */
export function filterTradesByTimeRange(
  trades: Trade[],
  startTime: Date | string,
  endTime: Date | string
): Trade[] {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  return trades.filter((trade) => {
    const tradeTime = new Date(trade.created_at).getTime();
    return tradeTime >= start && tradeTime < end;
  });
}

/**
 * Filter trades by minimum size
 *
 * @param trades - Array of trades to filter
 * @param minSize - Minimum size threshold
 * @returns Filtered array of trades
 */
export function filterTradesByMinSize(trades: Trade[], minSize: number): Trade[] {
  return trades.filter((trade) => {
    const size = parseFloat(trade.size);
    return !isNaN(size) && size >= minSize;
  });
}

/**
 * Get unique wallet addresses from trades
 *
 * @param trades - Array of trades
 * @returns Object with sets of taker and maker addresses
 */
export function getUniqueWallets(trades: Trade[]): {
  takers: Set<string>;
  makers: Set<string>;
  all: Set<string>;
} {
  const takers = new Set<string>();
  const makers = new Set<string>();
  const all = new Set<string>();

  for (const trade of trades) {
    if (trade.taker_address) {
      takers.add(trade.taker_address);
      all.add(trade.taker_address);
    }
    if (trade.maker_address) {
      makers.add(trade.maker_address);
      all.add(trade.maker_address);
    }
  }

  return { takers, makers, all };
}
