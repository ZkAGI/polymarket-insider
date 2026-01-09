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

/**
 * Wallet trade role - whether the wallet was the maker or taker in a trade
 */
export type WalletTradeRole = "maker" | "taker" | "both";

/**
 * Options for fetching trades by wallet address
 */
export interface GetTradesByWalletOptions {
  /** Maximum number of trades to return (default: 100) */
  limit?: number;

  /** Pagination cursor for fetching next page of results */
  cursor?: string;

  /** Filter by role in the trade - maker, taker, or both (default: "both") */
  role?: WalletTradeRole;

  /** Filter by specific token/market ID */
  tokenId?: string;

  /** Filter trades after this timestamp (ISO string or Date) */
  startTime?: string | Date;

  /** Filter trades before this timestamp (ISO string or Date) */
  endTime?: string | Date;

  /** Custom CLOB client to use (defaults to singleton) */
  client?: ClobClient;
}

/**
 * Result from fetching trades by wallet
 */
export interface GetTradesByWalletResult {
  /** Array of trades involving the wallet, sorted by timestamp descending */
  trades: Trade[];

  /** Number of trades returned in this page */
  count: number;

  /** Wallet address that was queried */
  walletAddress: string;

  /** Role filter that was applied */
  role: WalletTradeRole;

  /** Token ID filter (if applied) */
  tokenId?: string;

  /** Pagination cursor for next page (if more results exist) */
  nextCursor?: string;

  /** Whether there are more results available */
  hasMore: boolean;

  /** Timestamp when the data was fetched */
  fetchedAt: string;
}

/**
 * Wallet activity summary
 */
export interface WalletActivitySummary {
  /** Wallet address */
  walletAddress: string;

  /** Total number of trades */
  totalTrades: number;

  /** Number of trades as maker */
  tradesAsMaker: number;

  /** Number of trades as taker */
  tradesAsTaker: number;

  /** Total volume traded (sum of all trade sizes) */
  totalVolume: number;

  /** Volume traded as maker */
  volumeAsMaker: number;

  /** Volume traded as taker */
  volumeAsTaker: number;

  /** Number of buy trades */
  buyTrades: number;

  /** Number of sell trades */
  sellTrades: number;

  /** Unique markets/tokens traded */
  uniqueTokens: Set<string>;

  /** First trade timestamp (if available) */
  firstTradeAt?: string;

  /** Last trade timestamp (if available) */
  lastTradeAt?: string;
}

/**
 * Validate an Ethereum wallet address format
 *
 * @param address - Address to validate
 * @returns True if address appears to be valid Ethereum address format
 */
export function isValidWalletAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  const trimmed = address.trim();

  // Basic Ethereum address format: 0x followed by 40 hex characters
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(trimmed);
}

/**
 * Normalize a wallet address (lowercase, trimmed)
 *
 * @param address - Address to normalize
 * @returns Normalized address
 */
export function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Fetch all trades made by a specific wallet address
 *
 * Retrieves trades where the wallet was either the maker or taker (or both),
 * sorted by timestamp in descending order (most recent first).
 *
 * @param walletAddress - The wallet address to fetch trades for
 * @param options - Additional options (limit, cursor, role, tokenId, etc.)
 * @returns The trades result with array of trades, or null if wallet address is invalid
 * @throws ClobApiException on API errors (except 404)
 *
 * @example
 * ```typescript
 * // Fetch all trades for a wallet (both maker and taker roles)
 * const result = await getTradesByWallet("0x1234...abcd");
 * if (result) {
 *   console.log(`Found ${result.count} trades`);
 *   for (const trade of result.trades) {
 *     console.log(`${trade.side} ${trade.size} @ ${trade.price}`);
 *   }
 * }
 *
 * // Fetch only trades where wallet was the taker
 * const takerTrades = await getTradesByWallet("0x1234...abcd", { role: "taker" });
 *
 * // Paginate through results
 * let cursor: string | undefined;
 * do {
 *   const page = await getTradesByWallet("0x1234...abcd", { cursor });
 *   if (page) {
 *     console.log(`Page: ${page.trades.length} trades`);
 *     cursor = page.nextCursor;
 *   }
 * } while (cursor);
 * ```
 */
export async function getTradesByWallet(
  walletAddress: string,
  options: GetTradesByWalletOptions = {}
): Promise<GetTradesByWalletResult | null> {
  // Validate wallet address
  if (!walletAddress || !walletAddress.trim()) {
    return null;
  }

  const trimmedAddress = walletAddress.trim();

  // Validate address format
  if (!isValidWalletAddress(trimmedAddress)) {
    return null;
  }

  const normalizedAddress = normalizeWalletAddress(trimmedAddress);
  const { limit = 100, cursor, role = "both", tokenId, startTime, endTime, client = clobClient } = options;

  // Clamp limit to reasonable bounds
  const clampedLimit = Math.max(1, Math.min(limit, 1000));

  try {
    // Build query parameters
    const params = new URLSearchParams();

    // The CLOB API may support different parameter names for wallet filtering
    // We'll try the most common approaches
    if (role === "maker") {
      params.set("maker", normalizedAddress);
    } else if (role === "taker") {
      params.set("taker", normalizedAddress);
    } else {
      // For "both", we need to query both or use a general user/wallet parameter
      // Some APIs support a "user" or "address" parameter for this
      params.set("user", normalizedAddress);
    }

    params.set("limit", clampedLimit.toString());

    if (cursor) {
      params.set("cursor", cursor);
    }

    if (tokenId) {
      params.set("token_id", tokenId);
    }

    // Handle time filters
    if (startTime) {
      const startTs = startTime instanceof Date ? startTime.toISOString() : startTime;
      params.set("start_ts", startTs);
    }

    if (endTime) {
      const endTs = endTime instanceof Date ? endTime.toISOString() : endTime;
      params.set("end_ts", endTs);
    }

    // The CLOB API endpoint for trades is /trades
    const response = await client.get<RawTradesResponse | RawTradeResponse[]>(
      `/trades?${params.toString()}`
    );

    // Handle different response formats
    let rawTrades: RawTradeResponse[];
    let nextCursor: string | undefined;

    if (Array.isArray(response)) {
      // Direct array of trades
      rawTrades = response;
    } else if (response.trades) {
      // Object with trades array
      rawTrades = response.trades;
      nextCursor = response.next_cursor;
    } else if (response.data) {
      // Object with data array
      rawTrades = response.data;
      nextCursor = response.next_cursor;
    } else {
      // No trades found
      rawTrades = [];
    }

    // Parse trades
    let trades = rawTrades.map((raw) => parseTrade(raw, tokenId ?? ""));

    // Client-side filtering for role if API doesn't support combined filtering
    // This ensures we only return trades matching the requested role
    if (role === "maker") {
      trades = trades.filter(
        (trade) =>
          trade.maker_address &&
          normalizeWalletAddress(trade.maker_address) === normalizedAddress
      );
    } else if (role === "taker") {
      trades = trades.filter(
        (trade) =>
          trade.taker_address &&
          normalizeWalletAddress(trade.taker_address) === normalizedAddress
      );
    } else {
      // role === "both" - keep trades where wallet is either maker or taker
      trades = trades.filter(
        (trade) =>
          (trade.maker_address &&
            normalizeWalletAddress(trade.maker_address) === normalizedAddress) ||
          (trade.taker_address &&
            normalizeWalletAddress(trade.taker_address) === normalizedAddress)
      );
    }

    // Sort by timestamp descending
    const sortedTrades = sortTradesByTimestampDesc(trades);

    // Apply limit after sorting (in case we got more from client-side filtering)
    const limitedTrades = sortedTrades.slice(0, clampedLimit);

    // Determine if there are more results
    const hasMore = nextCursor !== undefined || limitedTrades.length === clampedLimit;

    return {
      trades: limitedTrades,
      count: limitedTrades.length,
      walletAddress: normalizedAddress,
      role,
      tokenId,
      nextCursor,
      hasMore,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Return null for 404 (wallet not found or no trades)
    if (error instanceof ClobApiException && error.statusCode === 404) {
      return {
        trades: [],
        count: 0,
        walletAddress: normalizedAddress,
        role,
        tokenId,
        hasMore: false,
        fetchedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}

/**
 * Fetch all trades for a wallet with automatic pagination
 *
 * This function automatically handles pagination to fetch all trades
 * for a wallet. Use with caution for wallets with many trades.
 *
 * @param walletAddress - The wallet address to fetch trades for
 * @param options - Additional options (role, tokenId, maxTrades, etc.)
 * @returns Array of all trades, or null if wallet address is invalid
 * @throws ClobApiException on API errors
 *
 * @example
 * ```typescript
 * // Fetch all trades for a wallet (up to 10000 by default)
 * const trades = await getAllTradesByWallet("0x1234...abcd");
 * if (trades) {
 *   console.log(`Found ${trades.length} total trades`);
 * }
 *
 * // Limit maximum trades fetched
 * const trades = await getAllTradesByWallet("0x1234...abcd", { maxTrades: 500 });
 * ```
 */
export async function getAllTradesByWallet(
  walletAddress: string,
  options: GetTradesByWalletOptions & { maxTrades?: number } = {}
): Promise<Trade[] | null> {
  const { maxTrades = 10000, ...fetchOptions } = options;

  // Validate wallet address first
  if (!walletAddress || !walletAddress.trim() || !isValidWalletAddress(walletAddress.trim())) {
    return null;
  }

  const allTrades: Trade[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = Math.ceil(maxTrades / 100); // Safety limit on pages

  do {
    const result = await getTradesByWallet(walletAddress, {
      ...fetchOptions,
      cursor,
      limit: Math.min(100, maxTrades - allTrades.length),
    });

    if (!result) {
      return allTrades.length > 0 ? allTrades : null;
    }

    allTrades.push(...result.trades);
    cursor = result.nextCursor;
    pageCount++;

    // Safety limits
    if (allTrades.length >= maxTrades) {
      break;
    }

    if (pageCount >= maxPages) {
      break;
    }
  } while (cursor);

  return allTrades;
}

/**
 * Get activity summary for a wallet based on their trades
 *
 * @param trades - Array of trades involving the wallet
 * @param walletAddress - The wallet address to summarize
 * @returns Activity summary for the wallet
 *
 * @example
 * ```typescript
 * const result = await getTradesByWallet("0x1234...abcd");
 * if (result) {
 *   const summary = getWalletActivitySummary(result.trades, result.walletAddress);
 *   console.log(`Total volume: ${summary.totalVolume}`);
 *   console.log(`Trades as maker: ${summary.tradesAsMaker}`);
 *   console.log(`Trades as taker: ${summary.tradesAsTaker}`);
 * }
 * ```
 */
export function getWalletActivitySummary(trades: Trade[], walletAddress: string): WalletActivitySummary {
  const normalizedAddress = normalizeWalletAddress(walletAddress);

  let tradesAsMaker = 0;
  let tradesAsTaker = 0;
  let volumeAsMaker = 0;
  let volumeAsTaker = 0;
  let buyTrades = 0;
  let sellTrades = 0;
  let totalVolume = 0;
  const uniqueTokens = new Set<string>();
  let firstTradeAt: string | undefined;
  let lastTradeAt: string | undefined;

  for (const trade of trades) {
    const size = parseFloat(trade.size);
    const sizeValue = isNaN(size) ? 0 : size;

    // Track unique tokens
    if (trade.asset_id) {
      uniqueTokens.add(trade.asset_id);
    }

    // Track timestamps
    if (trade.created_at) {
      if (!firstTradeAt || trade.created_at < firstTradeAt) {
        firstTradeAt = trade.created_at;
      }
      if (!lastTradeAt || trade.created_at > lastTradeAt) {
        lastTradeAt = trade.created_at;
      }
    }

    // Determine role in this trade
    const isMaker =
      trade.maker_address && normalizeWalletAddress(trade.maker_address) === normalizedAddress;
    const isTaker =
      trade.taker_address && normalizeWalletAddress(trade.taker_address) === normalizedAddress;

    if (isMaker) {
      tradesAsMaker++;
      volumeAsMaker += sizeValue;
    }

    if (isTaker) {
      tradesAsTaker++;
      volumeAsTaker += sizeValue;
    }

    // Track buy/sell counts
    if (trade.side === "buy") {
      buyTrades++;
    } else {
      sellTrades++;
    }

    totalVolume += sizeValue;
  }

  return {
    walletAddress: normalizedAddress,
    totalTrades: trades.length,
    tradesAsMaker,
    tradesAsTaker,
    totalVolume,
    volumeAsMaker,
    volumeAsTaker,
    buyTrades,
    sellTrades,
    uniqueTokens,
    firstTradeAt,
    lastTradeAt,
  };
}

/**
 * Check if a wallet has any trading history
 *
 * @param walletAddress - The wallet address to check
 * @param options - Additional options (client, tokenId)
 * @returns True if the wallet has at least one trade, false otherwise
 *
 * @example
 * ```typescript
 * const hasTraded = await hasWalletTraded("0x1234...abcd");
 * if (!hasTraded) {
 *   console.log("This is a fresh wallet with no trading history");
 * }
 * ```
 */
export async function hasWalletTraded(
  walletAddress: string,
  options: Pick<GetTradesByWalletOptions, "client" | "tokenId"> = {}
): Promise<boolean> {
  const result = await getTradesByWallet(walletAddress, {
    ...options,
    limit: 1,
  });

  return result !== null && result.count > 0;
}

/**
 * Get the first trade for a wallet (oldest trade)
 *
 * @param walletAddress - The wallet address to check
 * @param options - Additional options (client, tokenId)
 * @returns The first trade, or null if no trades found
 *
 * @example
 * ```typescript
 * const firstTrade = await getFirstWalletTrade("0x1234...abcd");
 * if (firstTrade) {
 *   console.log(`First trade on: ${firstTrade.created_at}`);
 * }
 * ```
 */
export async function getFirstWalletTrade(
  walletAddress: string,
  options: Pick<GetTradesByWalletOptions, "client" | "tokenId"> = {}
): Promise<Trade | null> {
  // Fetch all trades and find the oldest
  // Note: A more efficient implementation would use API sorting if available
  const allTrades = await getAllTradesByWallet(walletAddress, {
    ...options,
    maxTrades: 10000,
  });

  if (!allTrades || allTrades.length === 0) {
    return null;
  }

  // Find the oldest trade (trades are sorted desc, so last one is oldest)
  return allTrades[allTrades.length - 1] ?? null;
}

/**
 * Get trades between two wallets
 *
 * Finds trades where one wallet was the maker and the other was the taker.
 *
 * @param walletA - First wallet address
 * @param walletB - Second wallet address
 * @param options - Additional options (limit, client)
 * @returns Array of trades between the two wallets
 *
 * @example
 * ```typescript
 * const trades = await getTradesBetweenWallets("0x1234...", "0x5678...");
 * console.log(`Found ${trades.length} trades between the wallets`);
 * ```
 */
export async function getTradesBetweenWallets(
  walletA: string,
  walletB: string,
  options: Pick<GetTradesByWalletOptions, "client" | "limit"> = {}
): Promise<Trade[]> {
  // Validate addresses
  if (!isValidWalletAddress(walletA) || !isValidWalletAddress(walletB)) {
    return [];
  }

  const normalizedA = normalizeWalletAddress(walletA);
  const normalizedB = normalizeWalletAddress(walletB);

  // If same wallet, return empty
  if (normalizedA === normalizedB) {
    return [];
  }

  // Fetch trades for wallet A
  const tradesA = await getAllTradesByWallet(walletA, {
    client: options.client,
    maxTrades: options.limit ?? 1000,
  });

  if (!tradesA) {
    return [];
  }

  // Filter to only trades where the counterparty is wallet B
  return tradesA.filter((trade) => {
    const maker = trade.maker_address ? normalizeWalletAddress(trade.maker_address) : "";
    const taker = trade.taker_address ? normalizeWalletAddress(trade.taker_address) : "";

    // Trade between A and B if:
    // - A is maker and B is taker, OR
    // - A is taker and B is maker
    return (
      (maker === normalizedA && taker === normalizedB) ||
      (maker === normalizedB && taker === normalizedA)
    );
  });
}
