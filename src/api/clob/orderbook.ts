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

// ============================================================================
// API-CLOB-007: Order Book Depth
// ============================================================================

/**
 * A single level in the order book depth
 */
export interface OrderBookDepthLevel {
  /** Price at this level */
  price: number;

  /** Size at this exact price level */
  size: number;

  /** Cumulative size from best price to this level */
  cumulativeSize: number;

  /** Cumulative value (price * cumulative size) */
  cumulativeValue: number;

  /** Number of orders aggregated at this price level */
  orderCount: number;

  /** Percentage of total side volume at this level */
  percentOfTotal: number;
}

/**
 * Options for fetching order book depth
 */
export interface GetOrderBookDepthOptions {
  /** Number of price levels to aggregate into (default: 20) */
  levels?: number;

  /** Price interval for aggregation (auto-calculated if not specified) */
  priceInterval?: number;

  /** Maximum depth from best price (e.g., 0.1 = 10% from best) */
  maxDepthPercent?: number;

  /** Custom CLOB client to use */
  client?: ClobClient;
}

/**
 * Summary statistics for one side of the order book
 */
export interface DepthSideSummary {
  /** Total volume on this side */
  totalVolume: number;

  /** Total value (sum of price * size) */
  totalValue: number;

  /** Weighted average price */
  weightedAvgPrice: number;

  /** Number of price levels */
  levelCount: number;

  /** Best price (highest bid or lowest ask) */
  bestPrice: number;

  /** Worst price in depth (lowest bid or highest ask) */
  worstPrice: number;

  /** Price range (worst - best) */
  priceRange: number;
}

/**
 * Complete order book depth data
 */
export interface OrderBookDepth {
  /** Token/asset ID */
  tokenId: string;

  /** Bid (buy) depth levels, sorted from best (highest) to worst (lowest) price */
  bidDepth: OrderBookDepthLevel[];

  /** Ask (sell) depth levels, sorted from best (lowest) to worst (highest) price */
  askDepth: OrderBookDepthLevel[];

  /** Summary statistics for bids */
  bidSummary: DepthSideSummary;

  /** Summary statistics for asks */
  askSummary: DepthSideSummary;

  /** Mid price (average of best bid and best ask) */
  midPrice?: number;

  /** Spread (best ask - best bid) */
  spread?: number;

  /** Spread as percentage of mid price */
  spreadPercent?: number;

  /** Bid/ask volume imbalance ratio */
  volumeImbalance?: number;

  /** Timestamp when depth was calculated */
  timestamp: string;
}

/**
 * Aggregate order book levels by price intervals
 *
 * @param levels - Raw order book levels
 * @param priceInterval - Price interval for grouping
 * @param side - "bid" or "ask" determines rounding direction
 * @returns Aggregated levels
 */
function aggregateLevelsByPrice(
  levels: OrderBookLevel[],
  priceInterval: number,
  side: "bid" | "ask"
): Map<number, { size: number; count: number }> {
  const aggregated = new Map<number, { size: number; count: number }>();

  for (const level of levels) {
    const price = parseFloat(level.price);
    const size = parseFloat(level.size);

    if (isNaN(price) || isNaN(size) || size <= 0) {
      continue;
    }

    // Round price to interval
    // For bids: round down to nearest interval (conservative)
    // For asks: round up to nearest interval (conservative)
    let roundedPrice: number;
    if (side === "bid") {
      roundedPrice = Math.floor(price / priceInterval) * priceInterval;
    } else {
      roundedPrice = Math.ceil(price / priceInterval) * priceInterval;
    }

    const existing = aggregated.get(roundedPrice);
    if (existing) {
      existing.size += size;
      existing.count += 1;
    } else {
      aggregated.set(roundedPrice, { size, count: 1 });
    }
  }

  return aggregated;
}

/**
 * Calculate depth levels with cumulative values
 *
 * @param aggregated - Aggregated price levels
 * @param side - "bid" or "ask" determines sort order
 * @param totalVolume - Total volume for percentage calculation
 * @returns Array of depth levels with cumulative data
 */
function calculateDepthLevels(
  aggregated: Map<number, { size: number; count: number }>,
  side: "bid" | "ask",
  totalVolume: number
): OrderBookDepthLevel[] {
  // Convert to array and sort
  const entries = Array.from(aggregated.entries());

  // Bids: sort descending (highest price first)
  // Asks: sort ascending (lowest price first)
  if (side === "bid") {
    entries.sort((a, b) => b[0] - a[0]);
  } else {
    entries.sort((a, b) => a[0] - b[0]);
  }

  // Calculate cumulative values
  let cumulativeSize = 0;
  let cumulativeValue = 0;

  return entries.map(([price, { size, count }]) => {
    cumulativeSize += size;
    cumulativeValue += price * size;

    return {
      price,
      size,
      cumulativeSize,
      cumulativeValue,
      orderCount: count,
      percentOfTotal: totalVolume > 0 ? (cumulativeSize / totalVolume) * 100 : 0,
    };
  });
}

/**
 * Calculate summary statistics for one side of the depth
 *
 * @param levels - Depth levels
 * @returns Summary statistics
 */
function calculateDepthSummary(levels: OrderBookDepthLevel[]): DepthSideSummary {
  if (levels.length === 0) {
    return {
      totalVolume: 0,
      totalValue: 0,
      weightedAvgPrice: 0,
      levelCount: 0,
      bestPrice: 0,
      worstPrice: 0,
      priceRange: 0,
    };
  }

  const lastLevel = levels[levels.length - 1];
  const totalVolume = lastLevel?.cumulativeSize ?? 0;
  const totalValue = lastLevel?.cumulativeValue ?? 0;

  const bestPrice = levels[0]?.price ?? 0;
  const worstPrice = lastLevel?.price ?? 0;

  return {
    totalVolume,
    totalValue,
    weightedAvgPrice: totalVolume > 0 ? totalValue / totalVolume : 0,
    levelCount: levels.length,
    bestPrice,
    worstPrice,
    priceRange: Math.abs(worstPrice - bestPrice),
  };
}

/**
 * Auto-calculate a reasonable price interval based on price range
 *
 * @param levels - Order book levels
 * @param targetLevels - Target number of depth levels
 * @returns Suggested price interval
 */
function autoCalculatePriceInterval(
  levels: OrderBookLevel[],
  targetLevels: number
): number {
  if (levels.length < 2) {
    return 0.01; // Default for sparse order books
  }

  const prices = levels
    .map((l) => parseFloat(l.price))
    .filter((p) => !isNaN(p))
    .sort((a, b) => a - b);

  if (prices.length < 2) {
    return 0.01;
  }

  const minPrice = prices[0] ?? 0;
  const maxPrice = prices[prices.length - 1] ?? 1;
  const range = maxPrice - minPrice;

  if (range === 0) {
    return 0.01;
  }

  // Calculate interval to get approximately targetLevels
  const rawInterval = range / targetLevels;

  // Round to a nice number (0.001, 0.005, 0.01, 0.05, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalized = rawInterval / magnitude;

  let niceInterval: number;
  if (normalized <= 1) {
    niceInterval = magnitude;
  } else if (normalized <= 2) {
    niceInterval = 2 * magnitude;
  } else if (normalized <= 5) {
    niceInterval = 5 * magnitude;
  } else {
    niceInterval = 10 * magnitude;
  }

  // Ensure minimum interval
  return Math.max(niceInterval, 0.0001);
}

/**
 * Filter levels by maximum depth percentage from best price
 *
 * @param levels - Order book levels
 * @param bestPrice - Best price (highest bid or lowest ask)
 * @param maxDepthPercent - Maximum depth as percentage (e.g., 0.1 = 10%)
 * @param side - "bid" or "ask"
 * @returns Filtered levels
 */
function filterByMaxDepth(
  levels: OrderBookLevel[],
  bestPrice: number,
  maxDepthPercent: number,
  _side: "bid" | "ask"
): OrderBookLevel[] {
  if (maxDepthPercent <= 0 || maxDepthPercent >= 1) {
    return levels;
  }

  return levels.filter((level) => {
    const price = parseFloat(level.price);
    if (isNaN(price) || bestPrice === 0) {
      return false;
    }

    const depthPercent = Math.abs(price - bestPrice) / bestPrice;
    return depthPercent <= maxDepthPercent;
  });
}

/**
 * Fetch order book depth with aggregated price levels and cumulative volume
 *
 * Retrieves the order book and calculates depth at various price levels,
 * including cumulative volume and value for visualization and analysis.
 *
 * @param tokenId - The token ID (asset ID) of the market
 * @param options - Options for depth calculation
 * @returns Order book depth data, or null if market not found
 * @throws ClobApiException on API errors (except 404)
 *
 * @example
 * ```typescript
 * // Get order book depth with default settings (20 levels)
 * const depth = await getOrderBookDepth("12345");
 * if (depth) {
 *   console.log(`Bid depth levels: ${depth.bidDepth.length}`);
 *   console.log(`Total bid volume: ${depth.bidSummary.totalVolume}`);
 *
 *   // Access cumulative depth at each level
 *   for (const level of depth.bidDepth) {
 *     console.log(`Price: ${level.price}, Cumulative: ${level.cumulativeSize}`);
 *   }
 * }
 *
 * // Get depth with custom settings
 * const depth = await getOrderBookDepth("12345", {
 *   levels: 50,              // More granular depth
 *   maxDepthPercent: 0.05,   // Only 5% from best price
 * });
 *
 * // Get depth with specific price interval
 * const depth = await getOrderBookDepth("12345", {
 *   priceInterval: 0.01,     // Aggregate by 1 cent intervals
 * });
 * ```
 */
export async function getOrderBookDepth(
  tokenId: string,
  options: GetOrderBookDepthOptions = {}
): Promise<OrderBookDepth | null> {
  const { levels = 20, priceInterval, maxDepthPercent, client } = options;

  // Fetch the raw order book
  const orderBook = await getOrderBook(tokenId, { client });
  if (!orderBook) {
    return null;
  }

  // Get best prices for filtering
  const bestBidPrice = orderBook.best_bid ? parseFloat(orderBook.best_bid) : 0;
  const bestAskPrice = orderBook.best_ask ? parseFloat(orderBook.best_ask) : 0;

  // Filter by max depth if specified
  let filteredBids = orderBook.bids;
  let filteredAsks = orderBook.asks;

  if (maxDepthPercent && maxDepthPercent > 0 && maxDepthPercent < 1) {
    if (bestBidPrice > 0) {
      filteredBids = filterByMaxDepth(orderBook.bids, bestBidPrice, maxDepthPercent, "bid");
    }
    if (bestAskPrice > 0) {
      filteredAsks = filterByMaxDepth(orderBook.asks, bestAskPrice, maxDepthPercent, "ask");
    }
  }

  // Calculate price interval
  const allLevels = [...filteredBids, ...filteredAsks];
  const interval = priceInterval ?? autoCalculatePriceInterval(allLevels, levels);

  // Calculate total volumes for percentage calculations
  const totalBidVolume = filteredBids.reduce((sum, l) => {
    const size = parseFloat(l.size);
    return sum + (isNaN(size) ? 0 : size);
  }, 0);

  const totalAskVolume = filteredAsks.reduce((sum, l) => {
    const size = parseFloat(l.size);
    return sum + (isNaN(size) ? 0 : size);
  }, 0);

  // Aggregate and calculate depth
  const bidAggregated = aggregateLevelsByPrice(filteredBids, interval, "bid");
  const askAggregated = aggregateLevelsByPrice(filteredAsks, interval, "ask");

  const bidDepth = calculateDepthLevels(bidAggregated, "bid", totalBidVolume);
  const askDepth = calculateDepthLevels(askAggregated, "ask", totalAskVolume);

  // Limit to requested number of levels
  const limitedBidDepth = bidDepth.slice(0, levels);
  const limitedAskDepth = askDepth.slice(0, levels);

  // Calculate summaries
  const bidSummary = calculateDepthSummary(limitedBidDepth);
  const askSummary = calculateDepthSummary(limitedAskDepth);

  // Calculate market metrics
  let midPrice: number | undefined;
  let spread: number | undefined;
  let spreadPercent: number | undefined;
  let volumeImbalance: number | undefined;

  if (bestBidPrice > 0 && bestAskPrice > 0) {
    midPrice = (bestBidPrice + bestAskPrice) / 2;
    spread = bestAskPrice - bestBidPrice;
    spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : undefined;
  }

  if (totalAskVolume > 0) {
    volumeImbalance = totalBidVolume / totalAskVolume;
  }

  return {
    tokenId,
    bidDepth: limitedBidDepth,
    askDepth: limitedAskDepth,
    bidSummary,
    askSummary,
    midPrice,
    spread,
    spreadPercent,
    volumeImbalance,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get the cumulative volume at a specific price level
 *
 * @param depth - Order book depth
 * @param price - Target price
 * @param side - "bid" or "ask"
 * @returns Cumulative volume at or better than the price, or 0 if not found
 *
 * @example
 * ```typescript
 * const depth = await getOrderBookDepth("12345");
 * if (depth) {
 *   const bidVolume = getCumulativeVolumeAtPrice(depth, 0.50, "bid");
 *   console.log(`Volume willing to buy at 0.50 or higher: ${bidVolume}`);
 * }
 * ```
 */
export function getCumulativeVolumeAtPrice(
  depth: OrderBookDepth,
  price: number,
  side: "bid" | "ask"
): number {
  const levels = side === "bid" ? depth.bidDepth : depth.askDepth;

  for (const level of levels) {
    // For bids: find first level at or below the price
    // For asks: find first level at or above the price
    if (side === "bid" && level.price <= price) {
      return level.cumulativeSize;
    }
    if (side === "ask" && level.price >= price) {
      return level.cumulativeSize;
    }
  }

  // If price is beyond all levels, return total volume
  const lastLevel = levels[levels.length - 1];
  return lastLevel?.cumulativeSize ?? 0;
}

/**
 * Get the price at which a given volume can be filled
 *
 * @param depth - Order book depth
 * @param volume - Target volume to fill
 * @param side - "bid" or "ask"
 * @returns Price at which the volume can be filled, or undefined if insufficient liquidity
 *
 * @example
 * ```typescript
 * const depth = await getOrderBookDepth("12345");
 * if (depth) {
 *   const fillPrice = getPriceForVolume(depth, 1000, "ask");
 *   if (fillPrice) {
 *     console.log(`Can buy 1000 units up to price: ${fillPrice}`);
 *   }
 * }
 * ```
 */
export function getPriceForVolume(
  depth: OrderBookDepth,
  volume: number,
  side: "bid" | "ask"
): number | undefined {
  const levels = side === "bid" ? depth.bidDepth : depth.askDepth;

  for (const level of levels) {
    if (level.cumulativeSize >= volume) {
      return level.price;
    }
  }

  return undefined;
}

/**
 * Calculate the average execution price for a given volume (market impact)
 *
 * @param depth - Order book depth
 * @param volume - Volume to execute
 * @param side - "bid" (selling) or "ask" (buying)
 * @returns Average execution price, or undefined if insufficient liquidity
 *
 * @example
 * ```typescript
 * const depth = await getOrderBookDepth("12345");
 * if (depth) {
 *   const avgPrice = calculateMarketImpact(depth, 5000, "ask");
 *   if (avgPrice && depth.midPrice) {
 *     const impact = ((avgPrice - depth.midPrice) / depth.midPrice) * 100;
 *     console.log(`Market impact for buying 5000: ${impact.toFixed(2)}%`);
 *   }
 * }
 * ```
 */
export function calculateMarketImpact(
  depth: OrderBookDepth,
  volume: number,
  side: "bid" | "ask"
): number | undefined {
  const levels = side === "bid" ? depth.bidDepth : depth.askDepth;

  if (levels.length === 0) {
    return undefined;
  }

  let remainingVolume = volume;
  let totalValue = 0;
  let previousCumulative = 0;

  for (const level of levels) {
    const levelSize = level.cumulativeSize - previousCumulative;
    const volumeAtLevel = Math.min(remainingVolume, levelSize);

    totalValue += level.price * volumeAtLevel;
    remainingVolume -= volumeAtLevel;
    previousCumulative = level.cumulativeSize;

    if (remainingVolume <= 0) {
      break;
    }
  }

  // Check if we could fill the entire volume
  if (remainingVolume > 0) {
    return undefined;
  }

  return totalValue / volume;
}

/**
 * Get depth at specific percentage levels from the mid price
 *
 * @param depth - Order book depth
 * @param percentages - Array of percentages (e.g., [0.01, 0.02, 0.05] for 1%, 2%, 5%)
 * @returns Object mapping percentage to cumulative volume on each side
 *
 * @example
 * ```typescript
 * const depth = await getOrderBookDepth("12345");
 * if (depth) {
 *   const levels = getDepthAtPercentages(depth, [0.01, 0.02, 0.05]);
 *   console.log(`1% depth - Bids: ${levels[0.01].bidVolume}, Asks: ${levels[0.01].askVolume}`);
 * }
 * ```
 */
export function getDepthAtPercentages(
  depth: OrderBookDepth,
  percentages: number[]
): Record<number, { bidVolume: number; askVolume: number; bidValue: number; askValue: number }> {
  const result: Record<number, { bidVolume: number; askVolume: number; bidValue: number; askValue: number }> = {};

  if (!depth.midPrice) {
    for (const pct of percentages) {
      result[pct] = { bidVolume: 0, askVolume: 0, bidValue: 0, askValue: 0 };
    }
    return result;
  }

  for (const pct of percentages) {
    const bidThreshold = depth.midPrice * (1 - pct);
    const askThreshold = depth.midPrice * (1 + pct);

    let bidVolume = 0;
    let bidValue = 0;
    let askVolume = 0;
    let askValue = 0;

    // Find cumulative at bid threshold
    for (const level of depth.bidDepth) {
      if (level.price >= bidThreshold) {
        bidVolume = level.cumulativeSize;
        bidValue = level.cumulativeValue;
      } else {
        break;
      }
    }

    // Find cumulative at ask threshold
    for (const level of depth.askDepth) {
      if (level.price <= askThreshold) {
        askVolume = level.cumulativeSize;
        askValue = level.cumulativeValue;
      } else {
        break;
      }
    }

    result[pct] = { bidVolume, askVolume, bidValue, askValue };
  }

  return result;
}

/**
 * Check if the order book has sufficient liquidity for a trade
 *
 * @param depth - Order book depth
 * @param volume - Required volume
 * @param side - "bid" or "ask"
 * @param maxSlippage - Maximum acceptable slippage percentage (e.g., 0.02 for 2%)
 * @returns Object indicating if trade is possible and the expected slippage
 *
 * @example
 * ```typescript
 * const depth = await getOrderBookDepth("12345");
 * if (depth) {
 *   const check = checkLiquidity(depth, 10000, "ask", 0.02);
 *   if (check.hasSufficientLiquidity) {
 *     console.log(`Trade possible with ${(check.expectedSlippage * 100).toFixed(2)}% slippage`);
 *   }
 * }
 * ```
 */
export function checkLiquidity(
  depth: OrderBookDepth,
  volume: number,
  side: "bid" | "ask",
  maxSlippage: number = 0.05
): { hasSufficientLiquidity: boolean; expectedSlippage: number; fillPrice?: number } {
  const summary = side === "bid" ? depth.bidSummary : depth.askSummary;

  // Check if total volume is sufficient
  if (summary.totalVolume < volume) {
    return {
      hasSufficientLiquidity: false,
      expectedSlippage: Infinity,
    };
  }

  // Calculate expected fill price
  const fillPrice = calculateMarketImpact(depth, volume, side);
  if (fillPrice === undefined || !depth.midPrice) {
    return {
      hasSufficientLiquidity: false,
      expectedSlippage: Infinity,
    };
  }

  // Calculate slippage from mid price
  const slippage = Math.abs(fillPrice - depth.midPrice) / depth.midPrice;

  return {
    hasSufficientLiquidity: slippage <= maxSlippage,
    expectedSlippage: slippage,
    fillPrice,
  };
}
