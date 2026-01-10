/**
 * USD Calculator for Polymarket CLOB API (API-CLOB-012)
 *
 * Provides functions for calculating trade sizes and position values in USD.
 * Handles USDC pricing, outcome token valuation, and position calculations.
 *
 * Note: Polymarket uses USDC as its base currency, which is typically pegged 1:1 to USD.
 * This module provides functionality to handle cases where USDC may depeg.
 */

import { Trade, OrderBookLevel, OrderBook } from "./types";
import { EnrichedTradeExecution, parseTradeExecution, extractPrice, extractSize } from "./trade-execution";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for USD calculations
 */
export interface UsdCalculatorConfig {
  /** USDC price in USD (default: 1.0) */
  usdcPrice?: number;

  /** Default fee rate in basis points (default: 0) */
  defaultFeeRateBps?: number;

  /** Whether to apply fees to calculations (default: true) */
  includeFees?: boolean;
}

/**
 * Result of a position value calculation
 */
export interface PositionValueResult {
  /** Total position value in USD */
  valueUsd: number;

  /** Position size (number of outcome tokens) */
  size: number;

  /** Current price per token */
  pricePerToken: number;

  /** Token/asset ID */
  tokenId: string;

  /** Cost basis if available */
  costBasis?: number;

  /** Unrealized profit/loss */
  unrealizedPnl?: number;

  /** Profit/loss percentage */
  pnlPercent?: number;
}

/**
 * Trade with calculated USD values
 */
export interface TradeWithUsdValues {
  /** Original trade data */
  trade: Trade;

  /** Trade size in USD */
  sizeUsd: number;

  /** Fee amount in USD */
  feeUsd: number;

  /** Net value after fees (positive for buys, negative for sells when considering cost) */
  netValueUsd: number;

  /** Price used for calculation */
  price: number;

  /** Size used for calculation */
  size: number;

  /** USDC price used */
  usdcPrice: number;
}

/**
 * Order book level with USD values
 */
export interface OrderBookLevelUsd extends OrderBookLevel {
  /** Total value at this price level in USD */
  valueUsd: number;

  /** Value per token at this level */
  priceUsd: number;
}

/**
 * Summary of USD values for multiple trades
 */
export interface TradeUsdSummary {
  /** Total volume in USD */
  totalVolumeUsd: number;

  /** Total fees in USD */
  totalFeesUsd: number;

  /** Net volume after fees */
  netVolumeUsd: number;

  /** Average trade size in USD */
  avgTradeSizeUsd: number;

  /** Total buy volume in USD */
  buyVolumeUsd: number;

  /** Total sell volume in USD */
  sellVolumeUsd: number;

  /** Number of trades processed */
  tradeCount: number;

  /** Minimum trade size in USD */
  minTradeSizeUsd: number;

  /** Maximum trade size in USD */
  maxTradeSizeUsd: number;

  /** Volume-weighted average price (VWAP) */
  vwap: number;

  /** USDC price used for calculations */
  usdcPrice: number;
}

/**
 * Outcome token pricing information
 */
export interface OutcomeTokenPrice {
  /** Token ID */
  tokenId: string;

  /** Current price (0-1 for binary markets) */
  price: number;

  /** Price in USD (price * USDC price) */
  priceUsd: number;

  /** Implied probability (price * 100) */
  impliedProbability: number;

  /** 24h price change (if available) */
  priceChange24h?: number;

  /** Complement price (1 - price for binary markets) */
  complementPrice?: number;
}

/**
 * Position with cost basis tracking
 */
export interface Position {
  /** Token/asset ID */
  tokenId: string;

  /** Current position size */
  size: number;

  /** Average cost per token */
  avgCost: number;

  /** Total cost basis */
  costBasis: number;

  /** Current market price */
  currentPrice: number;

  /** Current value in USD */
  currentValueUsd: number;

  /** Unrealized P&L in USD */
  unrealizedPnlUsd: number;

  /** Unrealized P&L percentage */
  unrealizedPnlPercent: number;

  /** Realized P&L in USD (from closed positions) */
  realizedPnlUsd: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default USDC price (1 USDC = 1 USD) */
const DEFAULT_USDC_PRICE = 1.0;

/** Minimum valid USDC price (safety check for extreme depeg) */
const MIN_USDC_PRICE = 0.5;

/** Maximum valid USDC price (safety check for premium) */
const MAX_USDC_PRICE = 1.5;

/** Default fee rate in basis points */
const DEFAULT_FEE_RATE_BPS = 0;

// ============================================================================
// USDC Price Functions
// ============================================================================

/**
 * Get current USDC price in USD
 *
 * In most cases, USDC is pegged 1:1 to USD. This function allows for
 * custom USDC prices in case of depeg events.
 *
 * @param customPrice - Optional custom USDC price
 * @returns USDC price in USD
 *
 * @example
 * ```typescript
 * const price = getUsdcPrice(); // Returns 1.0
 * const depeggedPrice = getUsdcPrice(0.98); // Returns 0.98
 * ```
 */
export function getUsdcPrice(customPrice?: number): number {
  if (customPrice === undefined || customPrice === null) {
    return DEFAULT_USDC_PRICE;
  }

  // Validate price is within reasonable bounds
  if (isNaN(customPrice) || customPrice <= 0) {
    return DEFAULT_USDC_PRICE;
  }

  // Clamp to reasonable range (but still use the value for calculations)
  return customPrice;
}

/**
 * Validate that a USDC price is within expected bounds
 *
 * @param price - USDC price to validate
 * @returns Object with validity status and any warnings
 *
 * @example
 * ```typescript
 * const result = validateUsdcPrice(0.99);
 * // { valid: true, warnings: [] }
 *
 * const depegResult = validateUsdcPrice(0.85);
 * // { valid: true, warnings: ["USDC price significantly below peg (0.85)"] }
 * ```
 */
export function validateUsdcPrice(price: number): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (isNaN(price) || price <= 0) {
    return { valid: false, warnings: ["Invalid USDC price: must be a positive number"] };
  }

  if (price < MIN_USDC_PRICE) {
    warnings.push(`USDC price significantly below peg (${price})`);
  }

  if (price > MAX_USDC_PRICE) {
    warnings.push(`USDC price significantly above peg (${price})`);
  }

  if (price !== 1.0 && price >= 0.99 && price <= 1.01) {
    // Minor deviation, no warning needed
  } else if (price !== 1.0) {
    if (price < 0.99 || price > 1.01) {
      warnings.push(`USDC price deviates from peg: ${price}`);
    }
  }

  return { valid: true, warnings };
}

/**
 * Create a USDC price fetcher with caching
 *
 * @param fetchPrice - Function to fetch current USDC price
 * @param cacheDurationMs - How long to cache the price (default: 5 minutes)
 * @returns Function that returns cached USDC price
 */
export function createUsdcPriceFetcher(
  fetchPrice: () => Promise<number>,
  cacheDurationMs: number = 5 * 60 * 1000
): () => Promise<number> {
  let cachedPrice: number | null = null;
  let cacheExpiry: number = 0;

  return async (): Promise<number> => {
    const now = Date.now();

    if (cachedPrice !== null && now < cacheExpiry) {
      return cachedPrice;
    }

    try {
      cachedPrice = await fetchPrice();
      cacheExpiry = now + cacheDurationMs;
      return cachedPrice;
    } catch {
      // Return default price on error
      return DEFAULT_USDC_PRICE;
    }
  };
}

// ============================================================================
// Trade Size Calculation
// ============================================================================

/**
 * Calculate trade size in USD
 *
 * For Polymarket:
 * - Price is typically 0-1 for binary outcome tokens
 * - Size is the number of outcome tokens
 * - Value = price * size * USDC_price
 *
 * @param price - Trade price (0-1 for binary markets)
 * @param size - Trade size (number of tokens)
 * @param config - Optional configuration
 * @returns Trade size in USD
 *
 * @example
 * ```typescript
 * // Buy 100 tokens at $0.65 each
 * const usdValue = calculateTradeSizeUsd(0.65, 100);
 * console.log(usdValue); // 65
 *
 * // With USDC at $0.99
 * const depeggedValue = calculateTradeSizeUsd(0.65, 100, { usdcPrice: 0.99 });
 * console.log(depeggedValue); // 64.35
 * ```
 */
export function calculateTradeSizeUsd(
  price: number | string,
  size: number | string,
  config: UsdCalculatorConfig = {}
): number {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;

  // Parse inputs
  const priceNum = typeof price === "string" ? parseFloat(price) : price;
  const sizeNum = typeof size === "string" ? parseFloat(size) : size;

  // Validate inputs
  if (isNaN(priceNum) || isNaN(sizeNum)) {
    return 0;
  }

  if (priceNum < 0 || sizeNum < 0) {
    return 0;
  }

  // Calculate USD value
  const rawValue = priceNum * sizeNum;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  return rawValue * effectiveUsdcPrice;
}

/**
 * Calculate trade value with fees
 *
 * @param price - Trade price
 * @param size - Trade size
 * @param config - Configuration including fee rate
 * @returns Object with gross value, fee, and net value
 *
 * @example
 * ```typescript
 * const result = calculateTradeValueWithFees(0.65, 100, { defaultFeeRateBps: 50 });
 * console.log(result);
 * // { grossValueUsd: 65, feeUsd: 0.325, netValueUsd: 64.675 }
 * ```
 */
export function calculateTradeValueWithFees(
  price: number | string,
  size: number | string,
  config: UsdCalculatorConfig = {}
): { grossValueUsd: number; feeUsd: number; netValueUsd: number } {
  const { defaultFeeRateBps = DEFAULT_FEE_RATE_BPS, includeFees = true } = config;

  const grossValueUsd = calculateTradeSizeUsd(price, size, config);

  if (!includeFees || defaultFeeRateBps <= 0) {
    return { grossValueUsd, feeUsd: 0, netValueUsd: grossValueUsd };
  }

  const feeUsd = (grossValueUsd * defaultFeeRateBps) / 10000;
  const netValueUsd = grossValueUsd - feeUsd;

  return { grossValueUsd, feeUsd, netValueUsd };
}

/**
 * Calculate USD values for a trade
 *
 * @param trade - Trade object
 * @param config - Configuration options
 * @returns Trade with calculated USD values
 *
 * @example
 * ```typescript
 * const trade: Trade = {
 *   id: "trade1",
 *   asset_id: "token123",
 *   side: "buy",
 *   price: "0.65",
 *   size: "100",
 *   created_at: "2026-01-10T12:00:00Z"
 * };
 *
 * const withUsd = calculateTradeUsdValues(trade);
 * console.log(withUsd.sizeUsd); // 65
 * ```
 */
export function calculateTradeUsdValues(
  trade: Trade,
  config: UsdCalculatorConfig = {}
): TradeWithUsdValues {
  const { usdcPrice = DEFAULT_USDC_PRICE, defaultFeeRateBps = DEFAULT_FEE_RATE_BPS } = config;

  const price = extractPrice({ price: trade.price });
  const size = extractSize({ size: trade.size });
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  const sizeUsd = calculateTradeSizeUsd(price, size, config);

  // Calculate fee
  let feeUsd = 0;
  if (trade.fee_rate_bps) {
    const feeRateBps = parseFloat(trade.fee_rate_bps);
    if (!isNaN(feeRateBps) && feeRateBps > 0) {
      feeUsd = (sizeUsd * feeRateBps) / 10000;
    }
  } else if (defaultFeeRateBps > 0) {
    feeUsd = (sizeUsd * defaultFeeRateBps) / 10000;
  }

  const netValueUsd = sizeUsd - feeUsd;

  return {
    trade,
    sizeUsd,
    feeUsd,
    netValueUsd,
    price,
    size,
    usdcPrice: effectiveUsdcPrice,
  };
}

/**
 * Calculate USD values for multiple trades
 *
 * @param trades - Array of trades
 * @param config - Configuration options
 * @returns Array of trades with USD values
 */
export function calculateTradesUsdValues(
  trades: Trade[],
  config: UsdCalculatorConfig = {}
): TradeWithUsdValues[] {
  return trades.map((trade) => calculateTradeUsdValues(trade, config));
}

/**
 * Enrich a trade with USD values (converts to EnrichedTradeExecution)
 *
 * @param trade - Trade object
 * @param config - Configuration options
 * @returns Enriched trade execution with USD values
 */
export function enrichTradeWithUsd(
  trade: Trade,
  config: UsdCalculatorConfig = {}
): EnrichedTradeExecution {
  const { usdcPrice = DEFAULT_USDC_PRICE, defaultFeeRateBps = DEFAULT_FEE_RATE_BPS } = config;

  return parseTradeExecution(
    {
      id: trade.id,
      asset_id: trade.asset_id,
      taker_address: trade.taker_address,
      maker_address: trade.maker_address,
      side: trade.side,
      price: trade.price,
      size: trade.size,
      transaction_hash: trade.transaction_hash,
      created_at: trade.created_at,
      fee_rate_bps: trade.fee_rate_bps,
      match_id: trade.match_id,
      bucket_index: trade.bucket_index,
    },
    { usdcPrice, defaultFeeRateBps }
  );
}

/**
 * Enrich multiple trades with USD values
 *
 * @param trades - Array of trades
 * @param config - Configuration options
 * @returns Array of enriched trade executions
 */
export function enrichTradesWithUsd(
  trades: Trade[],
  config: UsdCalculatorConfig = {}
): EnrichedTradeExecution[] {
  return trades.map((trade) => enrichTradeWithUsd(trade, config));
}

// ============================================================================
// Trade Summary Calculations
// ============================================================================

/**
 * Calculate summary statistics for trades in USD
 *
 * @param trades - Array of trades or trades with USD values
 * @param config - Configuration options
 * @returns Summary statistics
 *
 * @example
 * ```typescript
 * const summary = calculateTradeUsdSummary(trades);
 * console.log(summary.totalVolumeUsd);    // Total volume
 * console.log(summary.avgTradeSizeUsd);   // Average trade size
 * console.log(summary.vwap);              // Volume-weighted average price
 * ```
 */
export function calculateTradeUsdSummary(
  trades: Trade[] | TradeWithUsdValues[],
  config: UsdCalculatorConfig = {}
): TradeUsdSummary {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  if (trades.length === 0) {
    return {
      totalVolumeUsd: 0,
      totalFeesUsd: 0,
      netVolumeUsd: 0,
      avgTradeSizeUsd: 0,
      buyVolumeUsd: 0,
      sellVolumeUsd: 0,
      tradeCount: 0,
      minTradeSizeUsd: 0,
      maxTradeSizeUsd: 0,
      vwap: 0,
      usdcPrice: effectiveUsdcPrice,
    };
  }

  let totalVolumeUsd = 0;
  let totalFeesUsd = 0;
  let buyVolumeUsd = 0;
  let sellVolumeUsd = 0;
  let minTradeSizeUsd = Infinity;
  let maxTradeSizeUsd = 0;
  let totalPriceTimesSize = 0;
  let totalSize = 0;

  for (const item of trades) {
    // Check if it's already a TradeWithUsdValues
    const isEnriched = "sizeUsd" in item;
    let sizeUsd: number;
    let feeUsd: number;
    let trade: Trade;
    let price: number;
    let size: number;

    if (isEnriched) {
      const enriched = item as TradeWithUsdValues;
      sizeUsd = enriched.sizeUsd;
      feeUsd = enriched.feeUsd;
      trade = enriched.trade;
      price = enriched.price;
      size = enriched.size;
    } else {
      trade = item as Trade;
      const withUsd = calculateTradeUsdValues(trade, config);
      sizeUsd = withUsd.sizeUsd;
      feeUsd = withUsd.feeUsd;
      price = withUsd.price;
      size = withUsd.size;
    }

    totalVolumeUsd += sizeUsd;
    totalFeesUsd += feeUsd;

    if (trade.side === "buy") {
      buyVolumeUsd += sizeUsd;
    } else {
      sellVolumeUsd += sizeUsd;
    }

    if (sizeUsd < minTradeSizeUsd) {
      minTradeSizeUsd = sizeUsd;
    }
    if (sizeUsd > maxTradeSizeUsd) {
      maxTradeSizeUsd = sizeUsd;
    }

    // For VWAP calculation
    if (price > 0 && size > 0) {
      totalPriceTimesSize += price * size;
      totalSize += size;
    }
  }

  const netVolumeUsd = totalVolumeUsd - totalFeesUsd;
  const avgTradeSizeUsd = trades.length > 0 ? totalVolumeUsd / trades.length : 0;
  const vwap = totalSize > 0 ? totalPriceTimesSize / totalSize : 0;

  return {
    totalVolumeUsd,
    totalFeesUsd,
    netVolumeUsd,
    avgTradeSizeUsd,
    buyVolumeUsd,
    sellVolumeUsd,
    tradeCount: trades.length,
    minTradeSizeUsd: minTradeSizeUsd === Infinity ? 0 : minTradeSizeUsd,
    maxTradeSizeUsd,
    vwap,
    usdcPrice: effectiveUsdcPrice,
  };
}

// ============================================================================
// Position Value Calculations
// ============================================================================

/**
 * Calculate position value in USD
 *
 * @param size - Position size (number of outcome tokens)
 * @param currentPrice - Current market price (0-1)
 * @param tokenId - Token/asset ID
 * @param costBasis - Optional cost basis for P&L calculation
 * @param config - Configuration options
 * @returns Position value result
 *
 * @example
 * ```typescript
 * // Calculate value of 1000 tokens at $0.65
 * const result = calculatePositionValueUsd(1000, 0.65, "token123");
 * console.log(result.valueUsd); // 650
 *
 * // With cost basis for P&L
 * const withPnl = calculatePositionValueUsd(1000, 0.65, "token123", 500);
 * console.log(withPnl.unrealizedPnl); // 150
 * console.log(withPnl.pnlPercent);    // 30
 * ```
 */
export function calculatePositionValueUsd(
  size: number | string,
  currentPrice: number | string,
  tokenId: string,
  costBasis?: number,
  config: UsdCalculatorConfig = {}
): PositionValueResult {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  const sizeNum = typeof size === "string" ? parseFloat(size) : size;
  const priceNum = typeof currentPrice === "string" ? parseFloat(currentPrice) : currentPrice;

  const valueUsd = calculateTradeSizeUsd(priceNum, sizeNum, config);
  const pricePerToken = priceNum * effectiveUsdcPrice;

  const result: PositionValueResult = {
    valueUsd,
    size: sizeNum,
    pricePerToken,
    tokenId,
  };

  // Calculate P&L if cost basis is provided
  if (costBasis !== undefined && costBasis > 0) {
    result.costBasis = costBasis;
    result.unrealizedPnl = valueUsd - costBasis;
    result.pnlPercent = ((valueUsd - costBasis) / costBasis) * 100;
  }

  return result;
}

/**
 * Calculate the potential payout for an outcome position
 *
 * For binary markets, if the outcome wins, the token is worth $1.
 * Potential payout = size * 1 * USDC_price
 *
 * @param size - Position size
 * @param config - Configuration options
 * @returns Potential payout in USD if the outcome wins
 */
export function calculatePotentialPayout(
  size: number | string,
  config: UsdCalculatorConfig = {}
): number {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  const sizeNum = typeof size === "string" ? parseFloat(size) : size;

  if (isNaN(sizeNum) || sizeNum < 0) {
    return 0;
  }

  // In binary markets, winning tokens are worth $1 each
  return sizeNum * 1.0 * effectiveUsdcPrice;
}

/**
 * Calculate potential profit for a position
 *
 * @param size - Position size
 * @param entryPrice - Entry price (0-1)
 * @param config - Configuration options
 * @returns Potential profit if outcome wins
 */
export function calculatePotentialProfit(
  size: number | string,
  entryPrice: number | string,
  config: UsdCalculatorConfig = {}
): number {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  const sizeNum = typeof size === "string" ? parseFloat(size) : size;
  const priceNum = typeof entryPrice === "string" ? parseFloat(entryPrice) : entryPrice;

  if (isNaN(sizeNum) || isNaN(priceNum) || sizeNum < 0 || priceNum < 0) {
    return 0;
  }

  // Cost to enter position
  const cost = priceNum * sizeNum * effectiveUsdcPrice;

  // Payout if outcome wins (token worth $1)
  const payout = sizeNum * 1.0 * effectiveUsdcPrice;

  return payout - cost;
}

/**
 * Calculate ROI percentage for a position if it wins
 *
 * @param entryPrice - Entry price (0-1)
 * @returns ROI percentage
 */
export function calculatePotentialRoi(entryPrice: number | string): number {
  const priceNum = typeof entryPrice === "string" ? parseFloat(entryPrice) : entryPrice;

  if (isNaN(priceNum) || priceNum <= 0 || priceNum >= 1) {
    return 0;
  }

  // If you buy at price P, and it wins, you get $1
  // ROI = (1 - P) / P * 100
  return ((1 - priceNum) / priceNum) * 100;
}

// ============================================================================
// Outcome Token Pricing
// ============================================================================

/**
 * Get outcome token pricing information
 *
 * @param tokenId - Token ID
 * @param price - Current price (0-1)
 * @param priceChange24h - Optional 24h price change
 * @param config - Configuration options
 * @returns Outcome token price information
 */
export function getOutcomeTokenPrice(
  tokenId: string,
  price: number | string,
  priceChange24h?: number,
  config: UsdCalculatorConfig = {}
): OutcomeTokenPrice {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  const priceNum = typeof price === "string" ? parseFloat(price) : price;
  const validPrice = isNaN(priceNum) || priceNum < 0 ? 0 : priceNum;

  return {
    tokenId,
    price: validPrice,
    priceUsd: validPrice * effectiveUsdcPrice,
    impliedProbability: validPrice * 100,
    priceChange24h,
    complementPrice: validPrice <= 1 ? 1 - validPrice : undefined,
  };
}

/**
 * Calculate the implied probability from a token price
 *
 * @param price - Token price (0-1)
 * @returns Implied probability as percentage (0-100)
 */
export function priceToImpliedProbability(price: number | string): number {
  const priceNum = typeof price === "string" ? parseFloat(price) : price;

  if (isNaN(priceNum) || priceNum < 0) {
    return 0;
  }

  if (priceNum > 1) {
    return 100;
  }

  return priceNum * 100;
}

/**
 * Calculate token price from implied probability
 *
 * @param probability - Implied probability (0-100)
 * @returns Token price (0-1)
 */
export function impliedProbabilityToPrice(probability: number | string): number {
  const probNum = typeof probability === "string" ? parseFloat(probability) : probability;

  if (isNaN(probNum) || probNum < 0) {
    return 0;
  }

  if (probNum > 100) {
    return 1;
  }

  return probNum / 100;
}

// ============================================================================
// Order Book USD Calculations
// ============================================================================

/**
 * Add USD values to order book levels
 *
 * @param levels - Array of order book levels
 * @param config - Configuration options
 * @returns Order book levels with USD values
 */
export function addUsdToOrderBookLevels(
  levels: OrderBookLevel[],
  config: UsdCalculatorConfig = {}
): OrderBookLevelUsd[] {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  return levels.map((level) => {
    const price = parseFloat(level.price);
    const size = parseFloat(level.size);
    const valueUsd = calculateTradeSizeUsd(price, size, config);

    return {
      ...level,
      valueUsd,
      priceUsd: price * effectiveUsdcPrice,
    };
  });
}

/**
 * Calculate total USD value in order book side
 *
 * @param levels - Array of order book levels
 * @param config - Configuration options
 * @returns Total value in USD
 */
export function calculateOrderBookSideValueUsd(
  levels: OrderBookLevel[],
  config: UsdCalculatorConfig = {}
): number {
  return levels.reduce((total, level) => {
    const price = parseFloat(level.price);
    const size = parseFloat(level.size);
    return total + calculateTradeSizeUsd(price, size, config);
  }, 0);
}

/**
 * Calculate total USD values for both sides of an order book
 *
 * @param orderBook - Order book object
 * @param config - Configuration options
 * @returns Object with bid and ask total values in USD
 */
export function calculateOrderBookTotalValueUsd(
  orderBook: OrderBook,
  config: UsdCalculatorConfig = {}
): { bidValueUsd: number; askValueUsd: number; totalValueUsd: number } {
  const bidValueUsd = calculateOrderBookSideValueUsd(orderBook.bids, config);
  const askValueUsd = calculateOrderBookSideValueUsd(orderBook.asks, config);

  return {
    bidValueUsd,
    askValueUsd,
    totalValueUsd: bidValueUsd + askValueUsd,
  };
}

// ============================================================================
// Position Tracking
// ============================================================================

/**
 * Build a position from trades
 *
 * @param trades - Array of trades
 * @param tokenId - Token ID to filter trades for
 * @param currentPrice - Current market price
 * @param config - Configuration options
 * @returns Calculated position
 */
export function buildPositionFromTrades(
  trades: Trade[],
  tokenId: string,
  currentPrice: number,
  config: UsdCalculatorConfig = {}
): Position {
  const { usdcPrice = DEFAULT_USDC_PRICE } = config;
  const effectiveUsdcPrice = getUsdcPrice(usdcPrice);

  // Filter trades for this token
  const tokenTrades = trades.filter((t) => t.asset_id === tokenId);

  let size = 0;
  let totalCost = 0;
  let realizedPnl = 0;

  for (const trade of tokenTrades) {
    const tradePrice = parseFloat(trade.price);
    const tradeSize = parseFloat(trade.size);

    if (isNaN(tradePrice) || isNaN(tradeSize)) {
      continue;
    }

    if (trade.side === "buy") {
      // Buying increases position
      totalCost += tradePrice * tradeSize;
      size += tradeSize;
    } else {
      // Selling decreases position and may realize P&L
      if (size > 0) {
        const avgCost = totalCost / size;
        const sellValue = tradePrice * tradeSize;
        const costOfSold = avgCost * tradeSize;
        realizedPnl += sellValue - costOfSold;

        // Reduce position
        const proportionSold = tradeSize / size;
        totalCost -= totalCost * proportionSold;
        size -= tradeSize;
      }
    }
  }

  // Calculate current position value
  const currentValueUsd = calculateTradeSizeUsd(currentPrice, size, config);
  const avgCost = size > 0 ? totalCost / size : 0;
  const costBasis = totalCost * effectiveUsdcPrice;
  const unrealizedPnlUsd = currentValueUsd - costBasis;
  const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnlUsd / costBasis) * 100 : 0;

  return {
    tokenId,
    size,
    avgCost,
    costBasis,
    currentPrice,
    currentValueUsd,
    unrealizedPnlUsd,
    unrealizedPnlPercent,
    realizedPnlUsd: realizedPnl * effectiveUsdcPrice,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format USD value for display
 *
 * @param value - USD value
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatUsdValue(
  value: number,
  options: { decimals?: number; showSign?: boolean; compact?: boolean } = {}
): string {
  const { decimals = 2, showSign = false, compact = false } = options;

  if (isNaN(value)) {
    return "$0.00";
  }

  let formatted: string;

  if (compact && Math.abs(value) >= 1000000) {
    formatted = `$${(value / 1000000).toFixed(1)}M`;
  } else if (compact && Math.abs(value) >= 1000) {
    formatted = `$${(value / 1000).toFixed(1)}K`;
  } else {
    formatted = `$${value.toFixed(decimals)}`;
  }

  if (showSign && value > 0) {
    formatted = "+" + formatted;
  }

  return formatted;
}

/**
 * Check if a trade qualifies as a "whale" trade based on USD value
 *
 * @param trade - Trade to check
 * @param whaleThreshold - Minimum USD value to be considered a whale trade
 * @param config - Configuration options
 * @returns True if trade value exceeds threshold
 */
export function isWhaleTrade(
  trade: Trade,
  whaleThreshold: number,
  config: UsdCalculatorConfig = {}
): boolean {
  const { sizeUsd } = calculateTradeUsdValues(trade, config);
  return sizeUsd >= whaleThreshold;
}

/**
 * Filter trades by minimum USD value
 *
 * @param trades - Array of trades
 * @param minValueUsd - Minimum USD value
 * @param config - Configuration options
 * @returns Filtered trades
 */
export function filterTradesByMinValueUsd(
  trades: Trade[],
  minValueUsd: number,
  config: UsdCalculatorConfig = {}
): Trade[] {
  return trades.filter((trade) => {
    const { sizeUsd } = calculateTradeUsdValues(trade, config);
    return sizeUsd >= minValueUsd;
  });
}

/**
 * Sort trades by USD value
 *
 * @param trades - Array of trades
 * @param order - Sort order ("asc" or "desc")
 * @param config - Configuration options
 * @returns Sorted trades
 */
export function sortTradesByValueUsd(
  trades: Trade[],
  order: "asc" | "desc" = "desc",
  config: UsdCalculatorConfig = {}
): Trade[] {
  const tradesWithValue = trades.map((trade) => ({
    trade,
    valueUsd: calculateTradeUsdValues(trade, config).sizeUsd,
  }));

  tradesWithValue.sort((a, b) => {
    return order === "asc" ? a.valueUsd - b.valueUsd : b.valueUsd - a.valueUsd;
  });

  return tradesWithValue.map((t) => t.trade);
}

/**
 * Get top trades by USD value
 *
 * @param trades - Array of trades
 * @param count - Number of top trades to return
 * @param config - Configuration options
 * @returns Top N trades by USD value
 */
export function getTopTradesByValue(
  trades: Trade[],
  count: number,
  config: UsdCalculatorConfig = {}
): Trade[] {
  return sortTradesByValueUsd(trades, "desc", config).slice(0, count);
}
