/**
 * Order functions for Polymarket CLOB API
 *
 * Provides functions for fetching and managing orders
 * from the Polymarket CLOB (Central Limit Order Book) API.
 *
 * Note: Most order-related endpoints require authentication.
 * Use a ClobClient configured with API credentials.
 */

import { ClobClient, clobClient, ClobApiException } from "./client";
import { Order, OrderStatus, OrderSide, OrderType } from "./types";
import { isValidWalletAddress, normalizeWalletAddress } from "./trades";

/**
 * Options for fetching open orders by wallet
 */
export interface GetOpenOrdersOptions {
  /** Maximum number of orders to return (default: 100) */
  limit?: number;

  /** Pagination cursor for fetching next page of results */
  cursor?: string;

  /** Filter by specific token/market ID */
  tokenId?: string;

  /** Filter by specific asset ID (alternative to tokenId) */
  assetId?: string;

  /** Filter by order side (BUY or SELL) */
  side?: OrderSide;

  /** Custom CLOB client to use (defaults to singleton) */
  client?: ClobClient;
}

/**
 * Result from fetching open orders
 */
export interface GetOpenOrdersResult {
  /** Array of open orders sorted by creation time descending */
  orders: Order[];

  /** Number of orders returned in this page */
  count: number;

  /** Wallet address that was queried */
  walletAddress: string;

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
 * Summary of open orders for a wallet
 */
export interface OpenOrdersSummary {
  /** Wallet address */
  walletAddress: string;

  /** Total number of open orders */
  totalOrders: number;

  /** Number of buy orders */
  buyOrders: number;

  /** Number of sell orders */
  sellOrders: number;

  /** Total value of buy orders (sum of price * size) */
  totalBuyValue: number;

  /** Total value of sell orders (sum of price * size) */
  totalSellValue: number;

  /** Total size of all open orders */
  totalSize: number;

  /** Unique markets/tokens with open orders */
  uniqueTokens: Set<string>;

  /** Order types breakdown */
  orderTypes: Map<OrderType | string, number>;

  /** Oldest order creation timestamp */
  oldestOrderAt?: string;

  /** Newest order creation timestamp */
  newestOrderAt?: string;
}

/**
 * Raw order response from the CLOB API
 * The API may return orders in various formats
 */
interface RawOrderResponse {
  /** Order ID */
  id?: string;
  order_id?: string;

  /** Market/asset ID */
  asset_id?: string;
  token_id?: string;
  market?: string;

  /** Maker address */
  maker_address?: string;
  maker?: string;
  owner?: string;

  /** Order side */
  side?: string;

  /** Price */
  price?: string;

  /** Original size */
  original_size?: string;
  size?: string;
  amount?: string;

  /** Size matched */
  size_matched?: string;
  filled_size?: string;
  filled?: string;

  /** Order type */
  order_type?: string;
  type?: string;

  /** Status */
  status?: string;
  state?: string;

  /** Expiration */
  expiration?: string;
  expires_at?: string;

  /** Timestamps */
  created_at?: string | number;
  timestamp?: string | number;
  updated_at?: string | number;
}

/**
 * Raw orders response from the API
 */
interface RawOrdersResponse {
  orders?: RawOrderResponse[];
  data?: RawOrderResponse[];
  next_cursor?: string;
  cursor?: string;
  count?: number;
  total?: number;
}

/**
 * Parse order side from string
 *
 * @param side - Raw side string
 * @returns Normalized OrderSide
 */
function parseOrderSide(side?: string): OrderSide {
  if (!side) {
    return "BUY";
  }
  const normalizedSide = side.toUpperCase().trim();
  if (normalizedSide === "SELL" || normalizedSide === "S" || normalizedSide === "ASK") {
    return "SELL";
  }
  return "BUY";
}

/**
 * Parse order type from string
 *
 * @param type - Raw type string
 * @returns Normalized OrderType or undefined
 */
function parseOrderType(type?: string): OrderType | undefined {
  if (!type) {
    return undefined;
  }
  const normalizedType = type.toUpperCase().trim();
  if (normalizedType === "GTC" || normalizedType === "GTD" || normalizedType === "FOK" || normalizedType === "IOC") {
    return normalizedType as OrderType;
  }
  return undefined;
}

/**
 * Parse order status from string
 *
 * @param status - Raw status string
 * @returns Normalized OrderStatus
 */
function parseOrderStatus(status?: string): OrderStatus {
  if (!status) {
    return "live";
  }
  const normalizedStatus = status.toLowerCase().trim();
  if (normalizedStatus === "matched" || normalizedStatus === "filled" || normalizedStatus === "complete") {
    return "matched";
  }
  if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") {
    return "cancelled";
  }
  if (normalizedStatus === "expired") {
    return "expired";
  }
  return "live";
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
 * Parse a raw order response into a typed Order
 *
 * @param raw - Raw order data from API
 * @param walletAddress - Wallet address (fallback for maker)
 * @returns Parsed Order object
 */
function parseOrder(raw: RawOrderResponse, walletAddress: string): Order {
  const id = raw.id ?? raw.order_id ?? "";
  const assetId = raw.asset_id ?? raw.token_id ?? raw.market ?? "";
  const makerAddress = raw.maker_address ?? raw.maker ?? raw.owner ?? walletAddress;
  const side = parseOrderSide(raw.side);
  const price = raw.price ?? "0";
  const originalSize = raw.original_size ?? raw.size ?? raw.amount ?? "0";
  const sizeMatched = raw.size_matched ?? raw.filled_size ?? raw.filled ?? "0";
  const orderType = parseOrderType(raw.order_type ?? raw.type);
  const status = parseOrderStatus(raw.status ?? raw.state);
  const expiration = raw.expiration ?? raw.expires_at;
  const createdAt = parseTimestamp(raw.created_at ?? raw.timestamp);
  const updatedAt = raw.updated_at ? parseTimestamp(raw.updated_at) : undefined;

  return {
    id,
    asset_id: assetId,
    maker_address: makerAddress,
    side,
    price,
    original_size: originalSize,
    size_matched: sizeMatched,
    order_type: orderType,
    status,
    expiration,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

/**
 * Sort orders by creation time descending (most recent first)
 *
 * @param orders - Array of orders to sort
 * @returns Sorted orders array
 */
function sortOrdersByCreatedAtDesc(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });
}

/**
 * Filter orders to only include open/live orders
 *
 * @param orders - Array of orders to filter
 * @returns Filtered array containing only live orders
 */
function filterOpenOrders(orders: Order[]): Order[] {
  return orders.filter((order) => order.status === "live");
}

/**
 * Fetch all open/pending orders for a wallet address
 *
 * Retrieves orders that are currently active (status = "live") for the
 * specified wallet. Requires authentication unless using a public endpoint.
 *
 * @param walletAddress - The wallet address to fetch open orders for
 * @param options - Additional options (limit, cursor, tokenId, side, client)
 * @returns The orders result with array of open orders, or null if wallet address is invalid
 * @throws ClobApiException on API errors (except 404)
 *
 * @example
 * ```typescript
 * // Fetch all open orders for a wallet
 * const result = await getOpenOrders("0x1234...abcd");
 * if (result) {
 *   console.log(`Found ${result.count} open orders`);
 *   for (const order of result.orders) {
 *     console.log(`${order.side} ${order.original_size} @ ${order.price}`);
 *   }
 * }
 *
 * // Fetch only BUY orders
 * const buyOrders = await getOpenOrders("0x1234...abcd", { side: "BUY" });
 *
 * // Fetch orders for a specific market
 * const marketOrders = await getOpenOrders("0x1234...abcd", { tokenId: "12345" });
 * ```
 */
export async function getOpenOrders(
  walletAddress: string,
  options: GetOpenOrdersOptions = {}
): Promise<GetOpenOrdersResult | null> {
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
  const { limit = 100, cursor, tokenId, assetId, side, client = clobClient } = options;

  // Clamp limit to reasonable bounds
  const clampedLimit = Math.max(1, Math.min(limit, 1000));

  try {
    // Build query parameters
    const params = new URLSearchParams();

    // Set the wallet/owner parameter
    params.set("owner", normalizedAddress);
    params.set("limit", clampedLimit.toString());

    // Only show live orders by default
    params.set("status", "live");

    if (cursor) {
      params.set("cursor", cursor);
    }

    // Token/asset ID filter
    const effectiveTokenId = tokenId ?? assetId;
    if (effectiveTokenId) {
      params.set("asset_id", effectiveTokenId);
    }

    // Side filter
    if (side) {
      params.set("side", side);
    }

    // The CLOB API endpoint for orders is /orders
    // This endpoint typically requires authentication for private data
    const response = await client.get<RawOrdersResponse | RawOrderResponse[]>(
      `/orders?${params.toString()}`,
      { requiresAuth: client.hasCredentials() }
    );

    // Handle different response formats
    let rawOrders: RawOrderResponse[];
    let nextCursor: string | undefined;

    if (Array.isArray(response)) {
      // Direct array of orders
      rawOrders = response;
    } else if (response.orders) {
      // Object with orders array
      rawOrders = response.orders;
      nextCursor = response.next_cursor ?? response.cursor;
    } else if (response.data) {
      // Object with data array
      rawOrders = response.data;
      nextCursor = response.next_cursor ?? response.cursor;
    } else {
      // No orders found
      rawOrders = [];
    }

    // Parse orders
    let orders = rawOrders.map((raw) => parseOrder(raw, normalizedAddress));

    // Client-side filtering for open orders (safety filter)
    orders = filterOpenOrders(orders);

    // Client-side side filtering (if API didn't apply it)
    if (side) {
      orders = orders.filter((order) => order.side === side);
    }

    // Sort by creation time descending
    const sortedOrders = sortOrdersByCreatedAtDesc(orders);

    // Apply limit after sorting
    const limitedOrders = sortedOrders.slice(0, clampedLimit);

    // Determine if there are more results
    const hasMore = nextCursor !== undefined || limitedOrders.length === clampedLimit;

    return {
      orders: limitedOrders,
      count: limitedOrders.length,
      walletAddress: normalizedAddress,
      tokenId: effectiveTokenId,
      nextCursor,
      hasMore,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Return empty result for 404 (wallet not found or no orders)
    if (error instanceof ClobApiException && error.statusCode === 404) {
      return {
        orders: [],
        count: 0,
        walletAddress: normalizedAddress,
        tokenId: tokenId ?? assetId,
        hasMore: false,
        fetchedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}

/**
 * Fetch all open orders for a wallet with automatic pagination
 *
 * This function automatically handles pagination to fetch all open orders
 * for a wallet. Use with caution for wallets with many orders.
 *
 * @param walletAddress - The wallet address to fetch orders for
 * @param options - Additional options (tokenId, side, maxOrders, client)
 * @returns Array of all open orders, or null if wallet address is invalid
 * @throws ClobApiException on API errors
 *
 * @example
 * ```typescript
 * // Fetch all open orders for a wallet (up to 10000 by default)
 * const orders = await getAllOpenOrders("0x1234...abcd");
 * if (orders) {
 *   console.log(`Found ${orders.length} total open orders`);
 * }
 *
 * // Limit maximum orders fetched
 * const orders = await getAllOpenOrders("0x1234...abcd", { maxOrders: 500 });
 * ```
 */
export async function getAllOpenOrders(
  walletAddress: string,
  options: GetOpenOrdersOptions & { maxOrders?: number } = {}
): Promise<Order[] | null> {
  const { maxOrders = 10000, ...fetchOptions } = options;

  // Validate wallet address first
  if (!walletAddress || !walletAddress.trim() || !isValidWalletAddress(walletAddress.trim())) {
    return null;
  }

  const allOrders: Order[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const maxPages = Math.ceil(maxOrders / 100); // Safety limit on pages

  do {
    const result = await getOpenOrders(walletAddress, {
      ...fetchOptions,
      cursor,
      limit: Math.min(100, maxOrders - allOrders.length),
    });

    if (!result) {
      return allOrders.length > 0 ? allOrders : null;
    }

    allOrders.push(...result.orders);
    cursor = result.nextCursor;
    pageCount++;

    // Safety limits
    if (allOrders.length >= maxOrders) {
      break;
    }

    if (pageCount >= maxPages) {
      break;
    }
  } while (cursor);

  return allOrders;
}

/**
 * Get open orders summary for a wallet
 *
 * Calculates aggregate statistics about a wallet's open orders.
 *
 * @param orders - Array of open orders
 * @param walletAddress - The wallet address
 * @returns Summary of open orders
 *
 * @example
 * ```typescript
 * const result = await getOpenOrders("0x1234...abcd");
 * if (result) {
 *   const summary = getOpenOrdersSummary(result.orders, result.walletAddress);
 *   console.log(`Total open orders: ${summary.totalOrders}`);
 *   console.log(`Buy orders: ${summary.buyOrders}`);
 *   console.log(`Sell orders: ${summary.sellOrders}`);
 * }
 * ```
 */
export function getOpenOrdersSummary(orders: Order[], walletAddress: string): OpenOrdersSummary {
  const normalizedAddress = normalizeWalletAddress(walletAddress);

  let buyOrders = 0;
  let sellOrders = 0;
  let totalBuyValue = 0;
  let totalSellValue = 0;
  let totalSize = 0;
  const uniqueTokens = new Set<string>();
  const orderTypes = new Map<OrderType | string, number>();
  let oldestOrderAt: string | undefined;
  let newestOrderAt: string | undefined;

  for (const order of orders) {
    const price = parseFloat(order.price);
    const size = parseFloat(order.original_size);
    const priceValue = isNaN(price) ? 0 : price;
    const sizeValue = isNaN(size) ? 0 : size;
    const orderValue = priceValue * sizeValue;

    // Track unique tokens
    if (order.asset_id) {
      uniqueTokens.add(order.asset_id);
    }

    // Track order types
    const type = order.order_type ?? "GTC";
    orderTypes.set(type, (orderTypes.get(type) ?? 0) + 1);

    // Track timestamps
    if (order.created_at) {
      if (!oldestOrderAt || order.created_at < oldestOrderAt) {
        oldestOrderAt = order.created_at;
      }
      if (!newestOrderAt || order.created_at > newestOrderAt) {
        newestOrderAt = order.created_at;
      }
    }

    // Track side-specific metrics
    if (order.side === "BUY") {
      buyOrders++;
      totalBuyValue += orderValue;
    } else {
      sellOrders++;
      totalSellValue += orderValue;
    }

    totalSize += sizeValue;
  }

  return {
    walletAddress: normalizedAddress,
    totalOrders: orders.length,
    buyOrders,
    sellOrders,
    totalBuyValue,
    totalSellValue,
    totalSize,
    uniqueTokens,
    orderTypes,
    oldestOrderAt,
    newestOrderAt,
  };
}

/**
 * Check if a wallet has any open orders
 *
 * @param walletAddress - The wallet address to check
 * @param options - Additional options (tokenId, side, client)
 * @returns True if the wallet has at least one open order, false otherwise
 *
 * @example
 * ```typescript
 * const hasOrders = await hasOpenOrders("0x1234...abcd");
 * if (hasOrders) {
 *   console.log("Wallet has open orders");
 * }
 * ```
 */
export async function hasOpenOrders(
  walletAddress: string,
  options: Pick<GetOpenOrdersOptions, "client" | "tokenId" | "side"> = {}
): Promise<boolean> {
  const result = await getOpenOrders(walletAddress, {
    ...options,
    limit: 1,
  });

  return result !== null && result.count > 0;
}

/**
 * Get open orders for a specific market/token
 *
 * Convenience function that filters orders by token ID.
 *
 * @param walletAddress - The wallet address
 * @param tokenId - The token/market ID to filter by
 * @param options - Additional options (side, limit, client)
 * @returns Array of open orders for the specified market
 *
 * @example
 * ```typescript
 * const orders = await getOpenOrdersForMarket("0x1234...", "token123");
 * if (orders) {
 *   console.log(`${orders.length} open orders for this market`);
 * }
 * ```
 */
export async function getOpenOrdersForMarket(
  walletAddress: string,
  tokenId: string,
  options: Pick<GetOpenOrdersOptions, "side" | "limit" | "client"> = {}
): Promise<Order[] | null> {
  if (!tokenId || !tokenId.trim()) {
    return null;
  }

  const result = await getOpenOrders(walletAddress, {
    ...options,
    tokenId: tokenId.trim(),
  });

  return result ? result.orders : null;
}

/**
 * Calculate the total value of open orders
 *
 * @param orders - Array of orders
 * @returns Total value (sum of price * size for all orders)
 */
export function calculateOpenOrdersValue(orders: Order[]): number {
  return orders.reduce((total, order) => {
    const price = parseFloat(order.price);
    const size = parseFloat(order.original_size);
    if (isNaN(price) || isNaN(size)) {
      return total;
    }
    return total + price * size;
  }, 0);
}

/**
 * Calculate the remaining value of open orders (unfilled portion)
 *
 * @param orders - Array of orders
 * @returns Total remaining value
 */
export function calculateRemainingOrdersValue(orders: Order[]): number {
  return orders.reduce((total, order) => {
    const price = parseFloat(order.price);
    const originalSize = parseFloat(order.original_size);
    const matchedSize = parseFloat(order.size_matched);

    if (isNaN(price) || isNaN(originalSize)) {
      return total;
    }

    const remainingSize = originalSize - (isNaN(matchedSize) ? 0 : matchedSize);
    return total + price * remainingSize;
  }, 0);
}

/**
 * Get the remaining size of an order (unfilled portion)
 *
 * @param order - The order
 * @returns Remaining size to be filled
 */
export function getOrderRemainingSize(order: Order): number {
  const originalSize = parseFloat(order.original_size);
  const matchedSize = parseFloat(order.size_matched);

  if (isNaN(originalSize)) {
    return 0;
  }

  return originalSize - (isNaN(matchedSize) ? 0 : matchedSize);
}

/**
 * Get the fill percentage of an order
 *
 * @param order - The order
 * @returns Fill percentage (0-100)
 */
export function getOrderFillPercentage(order: Order): number {
  const originalSize = parseFloat(order.original_size);
  const matchedSize = parseFloat(order.size_matched);

  if (isNaN(originalSize) || originalSize === 0) {
    return 0;
  }

  const matched = isNaN(matchedSize) ? 0 : matchedSize;
  return (matched / originalSize) * 100;
}

/**
 * Filter orders by minimum remaining size
 *
 * @param orders - Array of orders to filter
 * @param minSize - Minimum remaining size threshold
 * @returns Filtered array of orders
 */
export function filterOrdersByMinRemainingSize(orders: Order[], minSize: number): Order[] {
  return orders.filter((order) => getOrderRemainingSize(order) >= minSize);
}

/**
 * Group orders by token/asset ID
 *
 * @param orders - Array of orders
 * @returns Map of token ID to orders array
 */
export function groupOrdersByToken(orders: Order[]): Map<string, Order[]> {
  const grouped = new Map<string, Order[]>();

  for (const order of orders) {
    const tokenId = order.asset_id;
    if (!tokenId) continue;

    const existing = grouped.get(tokenId) ?? [];
    existing.push(order);
    grouped.set(tokenId, existing);
  }

  return grouped;
}

/**
 * Group orders by side (BUY/SELL)
 *
 * @param orders - Array of orders
 * @returns Object with buy and sell orders arrays
 */
export function groupOrdersBySide(orders: Order[]): { buy: Order[]; sell: Order[] } {
  const buy: Order[] = [];
  const sell: Order[] = [];

  for (const order of orders) {
    if (order.side === "BUY") {
      buy.push(order);
    } else {
      sell.push(order);
    }
  }

  return { buy, sell };
}
