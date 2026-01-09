/**
 * Polymarket Gamma API - Markets Module
 *
 * Functions for fetching and managing market data from the Gamma API.
 */

import { GammaClient, gammaClient, GammaApiException } from "./client";
import { GammaMarket, GammaMarketsResponse, MarketOutcome, MarketOutcomesResult } from "./types";

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

/**
 * Options for fetching a single market by slug
 */
export interface GetMarketBySlugOptions {
  /**
   * Custom Gamma client to use instead of default singleton.
   */
  client?: GammaClient;
}

/**
 * Extract slug from a Polymarket URL.
 *
 * Handles URLs in the format:
 * - https://polymarket.com/event/slug-name
 * - https://polymarket.com/event/slug-name?query=params
 * - polymarket.com/event/slug-name
 * - /event/slug-name
 * - slug-name (returned as-is)
 *
 * @param urlOrSlug - A Polymarket URL or raw slug
 * @returns The extracted slug, or null if invalid
 */
export function parseSlugFromUrl(urlOrSlug: string): string | null {
  if (!urlOrSlug || urlOrSlug.trim() === "") {
    return null;
  }

  const trimmed = urlOrSlug.trim();

  // First, check if this looks like a URL (has protocol or domain-like pattern)
  const looksLikeUrl =
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("www.") ||
    trimmed.includes("polymarket.com");

  if (looksLikeUrl) {
    // Try to parse as URL
    try {
      const urlToParse = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      const url = new URL(urlToParse);
      const pathname = url.pathname;

      // Look for /event/<slug> pattern
      const eventMatch = pathname.match(/\/event\/([^/?#]+)/);
      if (eventMatch?.[1]) {
        return eventMatch[1];
      }

      // If the URL has a path but no /event/, take the last path segment
      const pathSegments = pathname.split("/").filter(Boolean);
      if (pathSegments.length > 0) {
        return pathSegments[pathSegments.length - 1] ?? null;
      }

      // No valid path found
      return null;
    } catch {
      // URL parsing failed, fall through to slug handling
    }
  }

  // Handle /event/slug format
  const eventMatch = trimmed.match(/^\/?event\/([^/?#]+)/);
  if (eventMatch?.[1]) {
    return eventMatch[1];
  }

  // Handle slug with leading slash
  if (trimmed.startsWith("/")) {
    const withoutSlash = trimmed.slice(1);
    // Don't allow slugs with more slashes (likely a path)
    if (withoutSlash.includes("/")) {
      return null;
    }
    return withoutSlash || null;
  }

  // If it contains slashes but isn't a URL or /event/ pattern, it's invalid
  if (trimmed.includes("/")) {
    return null;
  }

  // Treat as raw slug
  return trimmed;
}

/**
 * Fetch a specific market by its URL slug.
 *
 * This function queries the markets endpoint with a slug filter
 * to find the matching market.
 *
 * @param slug - The market slug (or full Polymarket URL)
 * @param options - Optional configuration for the request
 * @returns Promise resolving to the market, or null if not found
 *
 * @example
 * ```typescript
 * // Fetch by slug directly
 * const market = await getMarketBySlug("will-bitcoin-reach-100k");
 * if (market) {
 *   console.log(`Market: ${market.question}`);
 * }
 *
 * // Fetch by URL
 * const market2 = await getMarketBySlug("https://polymarket.com/event/will-biden-win");
 *
 * // Handle not found
 * const market3 = await getMarketBySlug("non-existent-slug");
 * if (!market3) {
 *   console.log("Market not found");
 * }
 * ```
 */
export async function getMarketBySlug(
  slug: string,
  options: GetMarketBySlugOptions = {}
): Promise<GammaMarket | null> {
  // Parse slug from URL if needed
  const parsedSlug = parseSlugFromUrl(slug);

  if (!parsedSlug) {
    return null;
  }

  const client = options.client ?? gammaClient;

  // Query the markets endpoint with slug filter
  const queryString = `slug=${encodeURIComponent(parsedSlug)}`;
  const endpoint = `/markets?${queryString}`;

  try {
    const response = await client.get<GammaMarket[] | GammaMarketsResponse>(endpoint);

    // Handle both response formats
    let markets: GammaMarket[];
    if (Array.isArray(response)) {
      markets = response;
    } else {
      markets = response.data;
    }

    // Return the first matching market, or null if none found
    if (markets.length === 0) {
      return null;
    }

    // Find exact match (case-insensitive)
    const exactMatch = markets.find(
      (market) => market.slug.toLowerCase() === parsedSlug.toLowerCase()
    );

    return exactMatch ?? markets[0] ?? null;
  } catch (error) {
    // Return null for 404 (not found), re-throw other errors
    if (error instanceof GammaApiException && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Options for fetching market outcomes
 */
export interface GetMarketOutcomesOptions {
  /**
   * Custom Gamma client to use instead of default singleton.
   */
  client?: GammaClient;
}

/**
 * Convert a raw Gamma outcome to an enhanced MarketOutcome with probability
 */
function toMarketOutcome(outcome: GammaMarket["outcomes"][number]): MarketOutcome {
  return {
    id: outcome.id,
    name: outcome.name,
    price: outcome.price,
    probability: outcome.price * 100,
    clobTokenId: outcome.clobTokenId,
  };
}

/**
 * Get all possible outcomes and their current probabilities for a market.
 *
 * This function fetches a market by ID and extracts the outcome data,
 * calculating probability percentages from the prices.
 *
 * @param marketId - The unique identifier of the market
 * @param options - Optional configuration for the request
 * @returns Promise resolving to market outcomes result, or null if market not found
 *
 * @example
 * ```typescript
 * // Fetch outcomes for a specific market
 * const result = await getMarketOutcomes("0x1234...");
 * if (result) {
 *   console.log(`Market: ${result.question}`);
 *   console.log(`Total probability: ${result.totalProbability.toFixed(2)}%`);
 *
 *   for (const outcome of result.outcomes) {
 *     console.log(`${outcome.name}: ${outcome.probability.toFixed(2)}%`);
 *   }
 *
 *   // Verify probabilities sum to ~100%
 *   if (Math.abs(result.totalProbability - 100) > 1) {
 *     console.warn("Probabilities don't sum to 100%!");
 *   }
 * }
 * ```
 */
export async function getMarketOutcomes(
  marketId: string,
  options: GetMarketOutcomesOptions = {}
): Promise<MarketOutcomesResult | null> {
  // Fetch the market first
  const market = await getMarketById(marketId, { client: options.client });

  if (!market) {
    return null;
  }

  // Convert raw outcomes to enhanced MarketOutcome objects
  const outcomes = market.outcomes.map(toMarketOutcome);

  // Calculate total probability (should be close to 100%)
  const totalProbability = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);

  return {
    marketId: market.id,
    question: market.question,
    active: market.active,
    closed: market.closed,
    outcomes,
    totalProbability,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Get outcomes for a market by its slug.
 *
 * Convenience function that combines slug lookup with outcome fetching.
 *
 * @param slug - The market slug or Polymarket URL
 * @param options - Optional configuration for the request
 * @returns Promise resolving to market outcomes result, or null if market not found
 *
 * @example
 * ```typescript
 * const result = await getMarketOutcomesBySlug("will-bitcoin-reach-100k");
 * if (result) {
 *   for (const outcome of result.outcomes) {
 *     console.log(`${outcome.name}: ${outcome.probability.toFixed(2)}%`);
 *   }
 * }
 * ```
 */
export async function getMarketOutcomesBySlug(
  slug: string,
  options: GetMarketOutcomesOptions = {}
): Promise<MarketOutcomesResult | null> {
  const market = await getMarketBySlug(slug, { client: options.client });

  if (!market) {
    return null;
  }

  // Re-use the same logic as getMarketOutcomes
  const outcomes = market.outcomes.map(toMarketOutcome);
  const totalProbability = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);

  return {
    marketId: market.id,
    question: market.question,
    active: market.active,
    closed: market.closed,
    outcomes,
    totalProbability,
    fetchedAt: new Date().toISOString(),
  };
}
