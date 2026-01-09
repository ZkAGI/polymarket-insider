/**
 * Order book functions for Polymarket CLOB API
 *
 * Provides functions for fetching and parsing order book data
 * from the Polymarket CLOB (Central Limit Order Book) API.
 */

import { ClobClient, clobClient, ClobApiException } from "./client";
import { OrderBook, OrderBookLevel } from "./types";

/**
 * Options for fetching order book data
 */
export interface GetOrderBookOptions {
  /** Custom CLOB client to use (defaults to singleton) */
  client?: ClobClient;
}

/**
 * Raw order book response from the CLOB API
 * The API may return bids/asks in various formats
 */
interface RawOrderBookResponse {
  /** Market/asset ID */
  market?: string;
  asset_id?: string;
  token_id?: string;

  /** Bids (buy orders) - can be array of arrays or array of objects */
  bids?: Array<[string, string] | { price: string; size: string }>;

  /** Asks (sell orders) - can be array of arrays or array of objects */
  asks?: Array<[string, string] | { price: string; size: string }>;

  /** Timestamp */
  timestamp?: string | number;

  /** Hash of order book state */
  hash?: string;
}

/**
 * Parse a raw order book level into a typed OrderBookLevel
 *
 * The API may return levels as:
 * - Arrays: [price, size]
 * - Objects: { price, size }
 *
 * @param level - Raw level data from API
 * @returns Parsed OrderBookLevel
 */
function parseOrderBookLevel(level: [string, string] | { price: string; size: string }): OrderBookLevel {
  if (Array.isArray(level)) {
    const [price, size] = level;
    return {
      price: price ?? "0",
      size: size ?? "0",
    };
  }
  return {
    price: level.price ?? "0",
    size: level.size ?? "0",
  };
}

/**
 * Sort bids by price descending (highest first)
 */
function sortBidsDescending(levels: OrderBookLevel[]): OrderBookLevel[] {
  return [...levels].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
}

/**
 * Sort asks by price ascending (lowest first)
 */
function sortAsksAscending(levels: OrderBookLevel[]): OrderBookLevel[] {
  return [...levels].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
}

/**
 * Calculate the spread between best bid and best ask
 *
 * @param bestBid - Best bid price
 * @param bestAsk - Best ask price
 * @returns Spread as string, or undefined if either price is missing
 */
function calculateSpread(bestBid: string | undefined, bestAsk: string | undefined): string | undefined {
  if (!bestBid || !bestAsk) {
    return undefined;
  }
  const bid = parseFloat(bestBid);
  const ask = parseFloat(bestAsk);
  if (isNaN(bid) || isNaN(ask)) {
    return undefined;
  }
  return (ask - bid).toFixed(4);
}

/**
 * Fetch the order book for a specific market/token
 *
 * Retrieves the current buy (bid) and sell (ask) orders for a market,
 * sorted by price level. Bids are sorted descending (best price first),
 * asks are sorted ascending (best price first).
 *
 * @param tokenId - The token ID (asset ID) of the market to fetch
 * @param options - Additional options
 * @returns The order book with bids and asks, or null if not found
 * @throws ClobApiException on API errors (except 404)
 *
 * @example
 * ```typescript
 * const orderBook = await getOrderBook("12345678901234567890");
 * if (orderBook) {
 *   console.log(`Best bid: ${orderBook.best_bid}`);
 *   console.log(`Best ask: ${orderBook.best_ask}`);
 *   console.log(`Spread: ${orderBook.spread}`);
 * }
 * ```
 */
export async function getOrderBook(
  tokenId: string,
  options: GetOrderBookOptions = {}
): Promise<OrderBook | null> {
  // Validate tokenId
  if (!tokenId || !tokenId.trim()) {
    return null;
  }

  const trimmedTokenId = tokenId.trim();
  const client = options.client ?? clobClient;

  try {
    // The CLOB API endpoint for order books is /book
    // Query parameter is token_id
    const response = await client.get<RawOrderBookResponse>(
      `/book?token_id=${encodeURIComponent(trimmedTokenId)}`
    );

    // Parse bids and asks
    const bids: OrderBookLevel[] = (response.bids ?? []).map(parseOrderBookLevel);
    const asks: OrderBookLevel[] = (response.asks ?? []).map(parseOrderBookLevel);

    // Sort bids descending (highest price first) and asks ascending (lowest price first)
    const sortedBids = sortBidsDescending(bids);
    const sortedAsks = sortAsksAscending(asks);

    // Get best bid and ask
    const bestBid = sortedBids.length > 0 ? sortedBids[0]?.price : undefined;
    const bestAsk = sortedAsks.length > 0 ? sortedAsks[0]?.price : undefined;

    // Calculate spread
    const spread = calculateSpread(bestBid, bestAsk);

    // Determine asset ID from response
    const assetId = response.asset_id ?? response.token_id ?? response.market ?? trimmedTokenId;

    // Parse timestamp
    let timestamp: string;
    if (response.timestamp) {
      if (typeof response.timestamp === "number") {
        // Unix timestamp (seconds or milliseconds)
        const ts = response.timestamp > 1e12 ? response.timestamp : response.timestamp * 1000;
        timestamp = new Date(ts).toISOString();
      } else {
        timestamp = response.timestamp;
      }
    } else {
      timestamp = new Date().toISOString();
    }

    return {
      asset_id: assetId,
      timestamp,
      bids: sortedBids,
      asks: sortedAsks,
      best_bid: bestBid,
      best_ask: bestAsk,
      spread,
      hash: response.hash,
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
 * Fetch order books for multiple tokens in parallel
 *
 * @param tokenIds - Array of token IDs to fetch
 * @param options - Additional options
 * @returns Map of token ID to order book (null for not found)
 *
 * @example
 * ```typescript
 * const orderBooks = await getOrderBooks(["token1", "token2"]);
 * for (const [tokenId, orderBook] of orderBooks) {
 *   if (orderBook) {
 *     console.log(`${tokenId}: spread = ${orderBook.spread}`);
 *   }
 * }
 * ```
 */
export async function getOrderBooks(
  tokenIds: string[],
  options: GetOrderBookOptions = {}
): Promise<Map<string, OrderBook | null>> {
  const results = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const orderBook = await getOrderBook(tokenId, options);
      return [tokenId, orderBook] as const;
    })
  );

  return new Map(results);
}

/**
 * Calculate total liquidity at a given price level or better
 *
 * @param levels - Order book levels (bids or asks)
 * @param priceThreshold - Price threshold
 * @param side - "bid" for bids (price >= threshold), "ask" for asks (price <= threshold)
 * @returns Total size available at or better than the threshold
 */
export function calculateLiquidityAtPrice(
  levels: OrderBookLevel[],
  priceThreshold: number,
  side: "bid" | "ask"
): number {
  return levels.reduce((total, level) => {
    const price = parseFloat(level.price);
    const size = parseFloat(level.size);

    if (isNaN(price) || isNaN(size)) {
      return total;
    }

    // For bids, we want prices >= threshold (willing to pay at least threshold)
    // For asks, we want prices <= threshold (willing to sell at or below threshold)
    const meetsThreshold = side === "bid" ? price >= priceThreshold : price <= priceThreshold;

    return meetsThreshold ? total + size : total;
  }, 0);
}

/**
 * Calculate the mid price between best bid and best ask
 *
 * @param orderBook - The order book
 * @returns Mid price, or undefined if no bids/asks
 */
export function getMidPrice(orderBook: OrderBook): number | undefined {
  if (!orderBook.best_bid || !orderBook.best_ask) {
    return undefined;
  }

  const bid = parseFloat(orderBook.best_bid);
  const ask = parseFloat(orderBook.best_ask);

  if (isNaN(bid) || isNaN(ask)) {
    return undefined;
  }

  return (bid + ask) / 2;
}

/**
 * Calculate the bid-ask spread as a percentage
 *
 * @param orderBook - The order book
 * @returns Spread percentage, or undefined if no bids/asks
 */
export function getSpreadPercentage(orderBook: OrderBook): number | undefined {
  const midPrice = getMidPrice(orderBook);
  if (midPrice === undefined || midPrice === 0 || !orderBook.spread) {
    return undefined;
  }

  const spread = parseFloat(orderBook.spread);
  if (isNaN(spread)) {
    return undefined;
  }

  return (spread / midPrice) * 100;
}

/**
 * Get the total bid volume in the order book
 *
 * @param orderBook - The order book
 * @returns Total bid volume
 */
export function getTotalBidVolume(orderBook: OrderBook): number {
  return orderBook.bids.reduce((total, level) => {
    const size = parseFloat(level.size);
    return total + (isNaN(size) ? 0 : size);
  }, 0);
}

/**
 * Get the total ask volume in the order book
 *
 * @param orderBook - The order book
 * @returns Total ask volume
 */
export function getTotalAskVolume(orderBook: OrderBook): number {
  return orderBook.asks.reduce((total, level) => {
    const size = parseFloat(level.size);
    return total + (isNaN(size) ? 0 : size);
  }, 0);
}

/**
 * Get the volume imbalance ratio (bid volume / ask volume)
 *
 * A ratio > 1 indicates more buying pressure
 * A ratio < 1 indicates more selling pressure
 *
 * @param orderBook - The order book
 * @returns Imbalance ratio, or undefined if no asks
 */
export function getVolumeImbalance(orderBook: OrderBook): number | undefined {
  const bidVolume = getTotalBidVolume(orderBook);
  const askVolume = getTotalAskVolume(orderBook);

  if (askVolume === 0) {
    return undefined;
  }

  return bidVolume / askVolume;
}
