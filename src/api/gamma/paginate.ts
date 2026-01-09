/**
 * Polymarket Gamma API - Pagination Utilities
 *
 * Generic pagination handler for fetching large datasets from the Gamma API.
 * Supports both offset-based and cursor-based pagination patterns.
 */

import { GammaClient, gammaClient } from "./client";

/**
 * Configuration for paginated API requests.
 */
export interface PaginationConfig<T> {
  /**
   * Function to fetch a single page of data.
   * Should return the page data along with pagination metadata.
   */
  fetchPage: (params: PageFetchParams) => Promise<PageResult<T>>;

  /**
   * Number of items to fetch per page.
   * Default: 100
   */
  pageSize?: number;

  /**
   * Maximum total items to fetch across all pages.
   * Set to Infinity for no limit.
   * Default: Infinity
   */
  maxItems?: number;

  /**
   * Maximum number of pages to fetch.
   * Safety limit to prevent runaway pagination.
   * Default: 100
   */
  maxPages?: number;

  /**
   * Initial offset/cursor to start from.
   * Default: 0 (for offset-based) or undefined (for cursor-based)
   */
  startOffset?: number;

  /**
   * Initial cursor to start from (for cursor-based pagination).
   */
  startCursor?: string;

  /**
   * Delay between page fetches in milliseconds (to avoid rate limiting).
   * Default: 0 (no delay)
   */
  delayBetweenPages?: number;

  /**
   * Callback function called after each page is fetched.
   * Useful for progress reporting.
   */
  onPageFetched?: (page: PageResult<T>, pageNumber: number) => void;

  /**
   * Custom Gamma client to use.
   */
  client?: GammaClient;
}

/**
 * Parameters passed to the page fetch function.
 */
export interface PageFetchParams {
  /**
   * Current offset for offset-based pagination.
   */
  offset: number;

  /**
   * Page size limit for this request.
   */
  limit: number;

  /**
   * Cursor for cursor-based pagination (if applicable).
   */
  cursor?: string;

  /**
   * The Gamma API client to use.
   */
  client: GammaClient;
}

/**
 * Result from fetching a single page.
 */
export interface PageResult<T> {
  /**
   * Items fetched in this page.
   */
  items: T[];

  /**
   * Total count of items available (if known).
   */
  totalCount?: number;

  /**
   * Whether there are more items to fetch.
   * If undefined, hasMore is inferred from items.length === limit.
   */
  hasMore?: boolean;

  /**
   * Next cursor for cursor-based pagination.
   */
  nextCursor?: string;
}

/**
 * Result from paginated fetching.
 */
export interface PaginatedResult<T> {
  /**
   * All items fetched across all pages.
   */
  items: T[];

  /**
   * Number of pages fetched.
   */
  pagesFetched: number;

  /**
   * Total count of items if known from API.
   */
  totalCount?: number;

  /**
   * Whether pagination stopped due to reaching a limit.
   */
  truncated: boolean;

  /**
   * Reason for truncation if applicable.
   */
  truncationReason?: "maxItems" | "maxPages" | "noMoreItems";

  /**
   * Last offset/cursor position (useful for resuming).
   */
  lastOffset: number;

  /**
   * Last cursor (for cursor-based pagination resumption).
   */
  lastCursor?: string;
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Paginate through an API endpoint, automatically fetching all pages.
 *
 * This is a generic utility that handles both offset-based and cursor-based
 * pagination patterns. It provides safety limits, progress callbacks, and
 * configurable page sizes.
 *
 * @param config - Pagination configuration
 * @returns Promise resolving to all items across all pages
 *
 * @example
 * ```typescript
 * // Simple offset-based pagination
 * const result = await paginate({
 *   fetchPage: async ({ offset, limit, client }) => {
 *     const response = await client.get(`/markets?offset=${offset}&limit=${limit}`);
 *     const items = Array.isArray(response) ? response : response.data;
 *     return {
 *       items,
 *       hasMore: items.length === limit,
 *     };
 *   },
 *   pageSize: 100,
 *   maxItems: 500,
 * });
 *
 * console.log(`Fetched ${result.items.length} items in ${result.pagesFetched} pages`);
 *
 * // With progress callback
 * const result2 = await paginate({
 *   fetchPage: async ({ offset, limit, client }) => {
 *     // ... fetch logic
 *   },
 *   onPageFetched: (page, pageNumber) => {
 *     console.log(`Page ${pageNumber}: ${page.items.length} items`);
 *   },
 * });
 *
 * // Cursor-based pagination
 * const result3 = await paginate({
 *   fetchPage: async ({ cursor, limit, client }) => {
 *     const url = cursor
 *       ? `/items?cursor=${cursor}&limit=${limit}`
 *       : `/items?limit=${limit}`;
 *     const response = await client.get(url);
 *     return {
 *       items: response.items,
 *       nextCursor: response.nextCursor,
 *       hasMore: !!response.nextCursor,
 *     };
 *   },
 * });
 *
 * // Resume pagination from a previous position
 * const result4 = await paginate({
 *   fetchPage: async ({ offset, limit, client }) => {
 *     // ... fetch logic
 *   },
 *   startOffset: result.lastOffset,
 * });
 * ```
 */
export async function paginate<T>(config: PaginationConfig<T>): Promise<PaginatedResult<T>> {
  const pageSize = config.pageSize ?? 100;
  const maxItems = config.maxItems ?? Infinity;
  const maxPages = config.maxPages ?? 100;
  const delayBetweenPages = config.delayBetweenPages ?? 0;
  const client = config.client ?? gammaClient;

  const allItems: T[] = [];
  let currentOffset = config.startOffset ?? 0;
  let currentCursor = config.startCursor;
  let pagesFetched = 0;
  let totalCount: number | undefined;
  let truncated = false;
  let truncationReason: PaginatedResult<T>["truncationReason"];

  while (true) {
    // Check page limit
    if (pagesFetched >= maxPages) {
      truncated = true;
      truncationReason = "maxPages";
      break;
    }

    // Calculate how many items we still need
    const remainingItems = maxItems - allItems.length;
    if (remainingItems <= 0) {
      truncated = true;
      truncationReason = "maxItems";
      break;
    }

    // Adjust page size if we're near the limit
    const effectiveLimit = Math.min(pageSize, remainingItems);

    // Fetch the page
    const pageResult = await config.fetchPage({
      offset: currentOffset,
      limit: effectiveLimit,
      cursor: currentCursor,
      client,
    });

    // Add items to our collection
    allItems.push(...pageResult.items);
    pagesFetched++;

    // Update total count if available
    if (pageResult.totalCount !== undefined) {
      totalCount = pageResult.totalCount;
    }

    // Call the progress callback
    if (config.onPageFetched) {
      config.onPageFetched(pageResult, pagesFetched);
    }

    // Determine if there are more items
    const hasMore =
      pageResult.hasMore !== undefined
        ? pageResult.hasMore
        : pageResult.items.length === effectiveLimit;

    if (!hasMore) {
      truncationReason = "noMoreItems";
      break;
    }

    // Update pagination state for next iteration
    currentOffset += pageResult.items.length;
    currentCursor = pageResult.nextCursor;

    // Add delay if configured (to avoid rate limiting)
    if (delayBetweenPages > 0 && hasMore) {
      await sleep(delayBetweenPages);
    }
  }

  return {
    items: allItems,
    pagesFetched,
    totalCount,
    truncated,
    truncationReason,
    lastOffset: currentOffset,
    lastCursor: currentCursor,
  };
}

/**
 * Configuration for the simplified paginateEndpoint function.
 */
export interface PaginateEndpointConfig<T, R> {
  /**
   * Base endpoint URL (without pagination parameters).
   * Example: "/markets" or "/markets?active=true"
   */
  endpoint: string;

  /**
   * Function to extract items from the API response.
   * Should handle both array and paginated response formats.
   */
  extractItems: (response: R) => T[];

  /**
   * Function to extract total count from the API response (optional).
   */
  extractTotalCount?: (response: R) => number | undefined;

  /**
   * Number of items to fetch per page.
   * Default: 100
   */
  pageSize?: number;

  /**
   * Maximum total items to fetch across all pages.
   * Default: Infinity
   */
  maxItems?: number;

  /**
   * Maximum number of pages to fetch.
   * Default: 100
   */
  maxPages?: number;

  /**
   * Delay between page fetches in milliseconds.
   * Default: 0
   */
  delayBetweenPages?: number;

  /**
   * Custom Gamma client to use.
   */
  client?: GammaClient;

  /**
   * Progress callback called after each page.
   */
  onPageFetched?: (items: T[], pageNumber: number) => void;
}

/**
 * Paginate through an API endpoint using standard offset/limit query parameters.
 *
 * This is a convenience function that wraps the generic paginate() function
 * for the common case of offset-based pagination with standard query parameters.
 *
 * @param config - Endpoint pagination configuration
 * @returns Promise resolving to all items across all pages
 *
 * @example
 * ```typescript
 * import { paginateEndpoint } from "./paginate";
 * import { GammaMarket, GammaMarketsResponse } from "./types";
 *
 * // Fetch all active markets
 * const result = await paginateEndpoint<GammaMarket, GammaMarket[] | GammaMarketsResponse>({
 *   endpoint: "/markets?active=true&closed=false",
 *   extractItems: (response) =>
 *     Array.isArray(response) ? response : response.data,
 *   extractTotalCount: (response) =>
 *     Array.isArray(response) ? undefined : response.count,
 *   pageSize: 100,
 *   maxItems: 1000,
 * });
 *
 * console.log(`Fetched ${result.items.length} markets in ${result.pagesFetched} pages`);
 * ```
 */
export async function paginateEndpoint<T, R = unknown>(
  config: PaginateEndpointConfig<T, R>
): Promise<PaginatedResult<T>> {
  const client = config.client ?? gammaClient;
  const baseEndpoint = config.endpoint;

  // Determine if endpoint already has query params
  const hasQueryParams = baseEndpoint.includes("?");
  const paramJoiner = hasQueryParams ? "&" : "?";

  return paginate<T>({
    fetchPage: async ({ offset, limit, client: fetchClient }) => {
      // Build the URL with pagination parameters
      const url = `${baseEndpoint}${paramJoiner}offset=${offset}&limit=${limit}`;

      // Fetch the data
      const response = await fetchClient.get<R>(url);

      // Extract items using the provided function
      const items = config.extractItems(response);

      // Extract total count if extractor provided
      const totalCount = config.extractTotalCount?.(response);

      return {
        items,
        totalCount,
        hasMore: items.length === limit,
      };
    },
    pageSize: config.pageSize,
    maxItems: config.maxItems,
    maxPages: config.maxPages,
    delayBetweenPages: config.delayBetweenPages,
    client,
    onPageFetched: config.onPageFetched
      ? (page, pageNumber) => config.onPageFetched?.(page.items, pageNumber)
      : undefined,
  });
}

/**
 * Create a reusable paginator for a specific endpoint.
 *
 * This returns a function that can be called multiple times with different
 * options to paginate through the same endpoint.
 *
 * @param baseConfig - Base configuration for the paginator
 * @returns A function that fetches paginated data
 *
 * @example
 * ```typescript
 * import { createPaginator } from "./paginate";
 * import { GammaMarket, GammaMarketsResponse } from "./types";
 *
 * // Create a paginator for markets
 * const fetchAllMarkets = createPaginator<GammaMarket, GammaMarket[] | GammaMarketsResponse>({
 *   endpoint: "/markets",
 *   extractItems: (response) =>
 *     Array.isArray(response) ? response : response.data,
 * });
 *
 * // Use it with different options
 * const allMarkets = await fetchAllMarkets({ maxItems: 500 });
 * const firstPage = await fetchAllMarkets({ maxPages: 1, pageSize: 10 });
 * ```
 */
export function createPaginator<T, R = unknown>(
  baseConfig: Omit<PaginateEndpointConfig<T, R>, "maxItems" | "maxPages" | "onPageFetched">
) {
  return (
    options: Pick<
      PaginateEndpointConfig<T, R>,
      "maxItems" | "maxPages" | "onPageFetched" | "client" | "pageSize" | "delayBetweenPages"
    > = {}
  ): Promise<PaginatedResult<T>> => {
    return paginateEndpoint<T, R>({
      ...baseConfig,
      ...options,
    });
  };
}

/**
 * Async generator for streaming paginated results.
 *
 * Instead of waiting for all pages to load, this yields items as they
 * are fetched. Useful for processing large datasets without loading
 * everything into memory.
 *
 * @param config - Pagination configuration
 * @yields Individual items as they are fetched
 *
 * @example
 * ```typescript
 * // Process items as they arrive
 * for await (const market of paginateStream({
 *   endpoint: "/markets?active=true",
 *   extractItems: (r) => Array.isArray(r) ? r : r.data,
 *   pageSize: 100,
 * })) {
 *   console.log(`Processing: ${market.question}`);
 *   // Items are yielded one at a time as pages are fetched
 * }
 *
 * // Can also collect into an array
 * const items: GammaMarket[] = [];
 * for await (const item of paginateStream(config)) {
 *   items.push(item);
 * }
 * ```
 */
export async function* paginateStream<T, R = unknown>(
  config: PaginateEndpointConfig<T, R>
): AsyncGenerator<T, void, undefined> {
  const client = config.client ?? gammaClient;
  const pageSize = config.pageSize ?? 100;
  const maxItems = config.maxItems ?? Infinity;
  const maxPages = config.maxPages ?? 100;
  const delayBetweenPages = config.delayBetweenPages ?? 0;
  const baseEndpoint = config.endpoint;

  // Determine if endpoint already has query params
  const hasQueryParams = baseEndpoint.includes("?");
  const paramJoiner = hasQueryParams ? "&" : "?";

  let currentOffset = 0;
  let pagesFetched = 0;
  let itemsYielded = 0;

  while (true) {
    // Check limits
    if (pagesFetched >= maxPages) break;
    if (itemsYielded >= maxItems) break;

    // Calculate effective limit
    const remainingItems = maxItems - itemsYielded;
    const effectiveLimit = Math.min(pageSize, remainingItems);

    // Build URL and fetch
    const url = `${baseEndpoint}${paramJoiner}offset=${currentOffset}&limit=${effectiveLimit}`;
    const response = await client.get<R>(url);
    const items = config.extractItems(response);

    pagesFetched++;

    // Call progress callback if provided
    if (config.onPageFetched) {
      config.onPageFetched(items, pagesFetched);
    }

    // Yield items one by one
    for (const item of items) {
      if (itemsYielded >= maxItems) break;
      yield item;
      itemsYielded++;
    }

    // Check if we should continue
    if (items.length < effectiveLimit) break;

    // Update offset for next page
    currentOffset += items.length;

    // Add delay if configured
    if (delayBetweenPages > 0) {
      await sleep(delayBetweenPages);
    }
  }
}

/**
 * Fetch all pages in parallel (when order doesn't matter).
 *
 * This is an optimization for when you need all items but don't care
 * about the order. It fetches multiple pages concurrently.
 *
 * Note: This requires knowing the total count upfront or making an
 * initial request to determine it. Use with caution to avoid overloading
 * the API.
 *
 * @param config - Parallel pagination configuration
 * @returns Promise resolving to all items
 *
 * @example
 * ```typescript
 * const result = await paginateParallel({
 *   endpoint: "/markets?active=true",
 *   extractItems: (r) => Array.isArray(r) ? r : r.data,
 *   extractTotalCount: (r) => Array.isArray(r) ? undefined : r.count,
 *   pageSize: 100,
 *   concurrency: 3, // Fetch 3 pages at a time
 * });
 * ```
 */
export async function paginateParallel<T, R = unknown>(
  config: PaginateEndpointConfig<T, R> & {
    /**
     * Number of pages to fetch concurrently.
     * Default: 3
     */
    concurrency?: number;

    /**
     * Total count of items (if known). If not provided, an initial
     * request will be made to determine it.
     */
    totalCount?: number;
  }
): Promise<PaginatedResult<T>> {
  const client = config.client ?? gammaClient;
  const pageSize = config.pageSize ?? 100;
  const maxItems = config.maxItems ?? Infinity;
  const maxPages = config.maxPages ?? 100;
  const concurrency = config.concurrency ?? 3;
  const baseEndpoint = config.endpoint;

  // Determine if endpoint already has query params
  const hasQueryParams = baseEndpoint.includes("?");
  const paramJoiner = hasQueryParams ? "&" : "?";

  // If total count not provided, fetch it
  let totalCount = config.totalCount;
  if (totalCount === undefined) {
    const initialUrl = `${baseEndpoint}${paramJoiner}offset=0&limit=1`;
    const initialResponse = await client.get<R>(initialUrl);
    totalCount = config.extractTotalCount?.(initialResponse);

    // If we still don't have total count, fall back to sequential pagination
    if (totalCount === undefined) {
      return paginateEndpoint(config);
    }
  }

  // Calculate number of pages needed
  const itemsToFetch = Math.min(totalCount, maxItems);
  const pagesNeeded = Math.min(Math.ceil(itemsToFetch / pageSize), maxPages);

  // Create page offsets
  const pageOffsets: number[] = [];

  for (let page = 0; page < pagesNeeded; page++) {
    const offset = page * pageSize;
    const limit = Math.min(pageSize, itemsToFetch - offset);
    if (limit <= 0) break;

    pageOffsets.push(offset);
  }

  // Fetch pages in batches based on concurrency
  const allItems: T[] = [];
  let pagesFetched = 0;

  for (let i = 0; i < pageOffsets.length; i += concurrency) {
    const batch = pageOffsets.slice(i, i + concurrency);

    const batchPromises = batch.map(async (offset) => {
      const limit = Math.min(pageSize, itemsToFetch - offset);
      const url = `${baseEndpoint}${paramJoiner}offset=${offset}&limit=${limit}`;
      const response = await client.get<R>(url);
      return { offset, items: config.extractItems(response) };
    });

    const batchResults = await Promise.all(batchPromises);

    // Sort by offset to maintain order
    batchResults.sort((a, b) => a.offset - b.offset);

    for (const result of batchResults) {
      allItems.push(...result.items);
      pagesFetched++;
      if (config.onPageFetched) {
        config.onPageFetched(result.items, pagesFetched);
      }
    }
  }

  // Trim to maxItems if we fetched too many
  const items = allItems.slice(0, maxItems);

  return {
    items,
    pagesFetched,
    totalCount,
    truncated: items.length < totalCount,
    truncationReason: items.length >= totalCount ? "noMoreItems" : "maxItems",
    lastOffset: pagesFetched * pageSize,
  };
}
