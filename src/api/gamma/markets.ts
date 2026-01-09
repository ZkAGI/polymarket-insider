/**
 * Polymarket Gamma API - Markets Module
 *
 * Functions for fetching and managing market data from the Gamma API.
 */

import { GammaClient, gammaClient, GammaApiException } from "./client";
import { GammaMarket, GammaMarketsResponse } from "./types";

/**
 * Options for fetching active markets
 */
export interface GetActiveMarketsOptions {
  /**
   * Maximum number of markets to fetch per request.
   * Default: 100
   */
  limit?: number;

  /**
   * Offset for pagination.
   * Default: 0
   */
  offset?: number;

  /**
   * Filter by category (e.g., "politics", "sports", "crypto").
   */
  category?: string;

  /**
   * Sort field (e.g., "volume", "createdAt", "endDate").
   */
  sortBy?: string;

  /**
   * Sort direction: "asc" or "desc".
   * Default: "desc"
   */
  order?: "asc" | "desc";

  /**
   * Custom Gamma client to use instead of default singleton.
   */
  client?: GammaClient;
}

/**
 * Result from fetching active markets
 */
export interface GetActiveMarketsResult {
  /**
   * Array of active markets
   */
  markets: GammaMarket[];

  /**
   * Total count of active markets (if available)
   */
  count?: number;

  /**
   * Limit used in the request
   */
  limit: number;

  /**
   * Offset used in the request
   */
  offset: number;

  /**
   * Whether there are more markets to fetch
   */
  hasMore: boolean;
}

/**
 * Build query string from options
 */
function buildQueryString(options: GetActiveMarketsOptions): string {
  const params = new URLSearchParams();

  // Always filter for active markets
  params.set("active", "true");
  params.set("closed", "false");

  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  if (options.category) {
    params.set("category", options.category);
  }

  if (options.sortBy) {
    params.set("order", options.sortBy);
  }

  if (options.order) {
    params.set("ascending", options.order === "asc" ? "true" : "false");
  }

  return params.toString();
}

/**
 * Fetch all currently active prediction markets from Polymarket.
 *
 * Active markets are those that:
 * - Have `active: true`
 * - Have `closed: false`
 *
 * @param options - Optional configuration for the request
 * @returns Promise resolving to active markets result
 *
 * @example
 * ```typescript
 * // Fetch first 100 active markets
 * const result = await getActiveMarkets();
 * console.log(`Found ${result.markets.length} active markets`);
 *
 * // Fetch with pagination
 * const page2 = await getActiveMarkets({ offset: 100, limit: 100 });
 *
 * // Fetch politics markets only
 * const politics = await getActiveMarkets({ category: "politics" });
 * ```
 */
export async function getActiveMarkets(
  options: GetActiveMarketsOptions = {}
): Promise<GetActiveMarketsResult> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const client = options.client ?? gammaClient;

  const queryString = buildQueryString({ ...options, limit, offset });
  const endpoint = `/markets?${queryString}`;

  // The Gamma API may return either an array or a paginated response object
  const response = await client.get<GammaMarket[] | GammaMarketsResponse>(endpoint);

  // Handle both response formats
  let markets: GammaMarket[];
  let count: number | undefined;

  if (Array.isArray(response)) {
    markets = response;
    count = undefined;
  } else {
    markets = response.data;
    count = response.count;
  }

  // Filter to ensure we only return active, non-closed markets
  // (in case the API filtering doesn't work as expected)
  const activeMarkets = markets.filter((market) => market.active && !market.closed);

  return {
    markets: activeMarkets,
    count,
    limit,
    offset,
    hasMore: activeMarkets.length === limit,
  };
}

/**
 * Fetch all active markets with automatic pagination.
 *
 * This function will make multiple API requests to fetch all available
 * active markets. Use with caution as this may make many API calls.
 *
 * @param options - Optional configuration (limit is used as page size)
 * @returns Promise resolving to all active markets
 *
 * @example
 * ```typescript
 * const allMarkets = await getAllActiveMarkets();
 * console.log(`Total active markets: ${allMarkets.length}`);
 * ```
 */
export async function getAllActiveMarkets(
  options: Omit<GetActiveMarketsOptions, "offset"> = {}
): Promise<GammaMarket[]> {
  const pageSize = options.limit ?? 100;
  const allMarkets: GammaMarket[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await getActiveMarkets({
      ...options,
      limit: pageSize,
      offset,
    });

    allMarkets.push(...result.markets);
    hasMore = result.hasMore;
    offset += pageSize;

    // Safety limit to prevent infinite loops
    if (offset > 10000) {
      break;
    }
  }

  return allMarkets;
}

/**
 * Options for fetching a single market by ID
 */
export interface GetMarketByIdOptions {
  /**
   * Custom Gamma client to use instead of default singleton.
   */
  client?: GammaClient;
}

/**
 * Fetch a specific market by its unique ID.
 *
 * @param marketId - The unique identifier of the market to fetch
 * @param options - Optional configuration for the request
 * @returns Promise resolving to the market, or null if not found
 *
 * @example
 * ```typescript
 * // Fetch a specific market
 * const market = await getMarketById("0x1234...");
 * if (market) {
 *   console.log(`Market: ${market.question}`);
 * } else {
 *   console.log("Market not found");
 * }
 * ```
 */
export async function getMarketById(
  marketId: string,
  options: GetMarketByIdOptions = {}
): Promise<GammaMarket | null> {
  if (!marketId || marketId.trim() === "") {
    return null;
  }

  const client = options.client ?? gammaClient;
  const endpoint = `/markets/${encodeURIComponent(marketId)}`;

  try {
    const market = await client.get<GammaMarket>(endpoint);
    return market;
  } catch (error) {
    // Return null for 404 (not found), re-throw other errors
    if (error instanceof GammaApiException && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}
