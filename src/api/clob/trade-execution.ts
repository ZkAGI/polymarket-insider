/**
 * Trade Execution Parser for Polymarket CLOB API (API-CLOB-011)
 *
 * Provides functions for parsing, normalizing, and enriching trade execution data
 * from the Polymarket CLOB API. Handles various API response formats and
 * calculates USD values for trades.
 */

import { Trade, TradeExecution, TradeDirection } from "./types";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Raw trade execution response from the API
 * Handles various field naming conventions
 */
export interface RawTradeExecutionResponse {
  /** Trade ID variants */
  id?: string;
  trade_id?: string;
  execution_id?: string;

  /** Market/asset ID variants */
  market?: string;
  asset_id?: string;
  token_id?: string;

  /** Taker address variants */
  taker?: string;
  taker_address?: string;

  /** Maker address variants */
  maker?: string;
  maker_address?: string;

  /** Trade side */
  side?: string;

  /** Price variants */
  price?: string | number;
  execution_price?: string | number;

  /** Size variants */
  size?: string | number;
  amount?: string | number;
  quantity?: string | number;

  /** USD value variants */
  size_usd?: string | number;
  value_usd?: string | number;
  usd_amount?: string | number;
  notional?: string | number;

  /** Fee variants */
  fee?: string | number;
  fee_usd?: string | number;
  fee_amount?: string | number;
  fee_rate_bps?: string | number;
  trading_fee?: string | number;

  /** Transaction hash variants */
  transaction_hash?: string;
  tx_hash?: string;
  hash?: string;

  /** Timestamp variants */
  timestamp?: string | number;
  created_at?: string | number;
  executed_at?: string | number;
  execution_time?: string | number;

  /** Match ID */
  match_id?: string;

  /** Bucket index */
  bucket_index?: number;

  /** Market metadata (may be included in enriched responses) */
  outcome_name?: string;
  outcome?: string;
  market_question?: string;
  question?: string;
  market_title?: string;

  /** Additional execution details */
  order_id?: string;
  status?: string;
  type?: string;
  is_fill?: boolean;
  is_partial?: boolean;
}

/**
 * Extended trade execution with computed fields
 */
export interface EnrichedTradeExecution extends TradeExecution {
  /** Computed net value (size_usd - fee_usd) */
  net_value_usd: number;

  /** Price as a number for calculations */
  price_numeric: number;

  /** Size as a number for calculations */
  size_numeric: number;

  /** Fee rate in basis points (numeric) */
  fee_rate_bps_numeric: number;

  /** Whether the execution was a partial fill */
  is_partial_fill: boolean;

  /** Original order ID if available */
  order_id?: string;

  /** Execution status */
  execution_status: ExecutionStatus;

  /** Normalized timestamp as Date object */
  executed_at: Date;

  /** Unix timestamp in milliseconds */
  executed_at_ms: number;
}

/**
 * Execution status
 */
export type ExecutionStatus = "filled" | "partial" | "pending" | "cancelled" | "unknown";

/**
 * Fee calculation options
 */
export interface FeeCalculationOptions {
  /** Default fee rate in basis points if not provided (default: 0) */
  defaultFeeRateBps?: number;

  /** Whether to use USDC price for value calculation (default: 1.0) */
  usdcPrice?: number;
}

/**
 * Timestamp normalization result
 */
export interface NormalizedTimestamp {
  /** ISO 8601 formatted string */
  iso: string;

  /** Date object */
  date: Date;

  /** Unix timestamp in seconds */
  unix: number;

  /** Unix timestamp in milliseconds */
  unixMs: number;

  /** Human-readable format */
  formatted: string;

  /** Relative time description (e.g., "5 minutes ago") */
  relative: string;
}

/**
 * Batch parsing result
 */
export interface ParseTradeExecutionsResult {
  /** Successfully parsed executions */
  executions: EnrichedTradeExecution[];

  /** Number of successfully parsed trades */
  successCount: number;

  /** Number of failed parses */
  errorCount: number;

  /** Errors encountered during parsing */
  errors: Array<{ index: number; error: string; raw?: unknown }>;

  /** Summary statistics */
  summary: {
    totalVolume: number;
    totalVolumeUsd: number;
    totalFees: number;
    avgPrice: number;
    buyCount: number;
    sellCount: number;
    earliestExecution?: Date;
    latestExecution?: Date;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default fee rate in basis points (0 = no fee) */
const DEFAULT_FEE_RATE_BPS = 0;

/** Default USDC price (1 USDC = 1 USD) */
const DEFAULT_USDC_PRICE = 1.0;

/** Milliseconds threshold for detecting Unix seconds vs milliseconds */
const UNIX_MS_THRESHOLD = 1e12;

// ============================================================================
// Timestamp Normalization
// ============================================================================

/**
 * Parse a timestamp from various formats into milliseconds
 *
 * Handles:
 * - ISO 8601 strings
 * - Unix timestamps in seconds
 * - Unix timestamps in milliseconds
 * - Date objects
 * - Numeric strings
 *
 * @param timestamp - Raw timestamp value
 * @returns Unix timestamp in milliseconds, or current time if invalid
 */
export function parseTimestampToMs(timestamp?: string | number | Date | null): number {
  if (timestamp === null || timestamp === undefined) {
    return Date.now();
  }

  // Already a Date object
  if (timestamp instanceof Date) {
    const ms = timestamp.getTime();
    return isNaN(ms) ? Date.now() : ms;
  }

  // String timestamp
  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();

    // Check if it's a numeric string
    if (/^\d+$/.test(trimmed)) {
      const numeric = parseInt(trimmed, 10);
      // Detect seconds vs milliseconds based on magnitude
      return numeric > UNIX_MS_THRESHOLD ? numeric : numeric * 1000;
    }

    // Try parsing as ISO date string
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // Unable to parse
    return Date.now();
  }

  // Numeric timestamp
  if (typeof timestamp === "number") {
    if (isNaN(timestamp)) {
      return Date.now();
    }
    // Detect seconds vs milliseconds based on magnitude
    return timestamp > UNIX_MS_THRESHOLD ? timestamp : timestamp * 1000;
  }

  return Date.now();
}

/**
 * Normalize a timestamp into multiple useful formats
 *
 * @param timestamp - Raw timestamp value
 * @returns Normalized timestamp object with multiple formats
 *
 * @example
 * ```typescript
 * const normalized = normalizeTimestamp("2026-01-10T12:00:00Z");
 * console.log(normalized.iso);      // "2026-01-10T12:00:00.000Z"
 * console.log(normalized.unix);     // 1767960000
 * console.log(normalized.relative); // "5 minutes ago"
 * ```
 */
export function normalizeTimestamp(timestamp?: string | number | Date | null): NormalizedTimestamp {
  const ms = parseTimestampToMs(timestamp);
  const date = new Date(ms);

  return {
    iso: date.toISOString(),
    date,
    unix: Math.floor(ms / 1000),
    unixMs: ms,
    formatted: formatTimestamp(date),
    relative: getRelativeTime(date),
  };
}

/**
 * Format a timestamp for display
 *
 * @param date - Date to format
 * @returns Formatted string
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Get relative time description
 *
 * @param date - Date to describe
 * @returns Relative time string (e.g., "5 minutes ago")
 */
function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();

  // Handle future dates
  if (diffMs < 0) {
    return "in the future";
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return seconds <= 1 ? "just now" : `${seconds} seconds ago`;
  }
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (days < 30) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(months / 12);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/**
 * Check if a timestamp is within a time range
 *
 * @param timestamp - Timestamp to check
 * @param startTime - Start of range (inclusive)
 * @param endTime - End of range (exclusive)
 * @returns True if timestamp is within range
 */
export function isTimestampInRange(
  timestamp: string | number | Date,
  startTime?: string | number | Date | null,
  endTime?: string | number | Date | null
): boolean {
  const ms = parseTimestampToMs(timestamp);
  const startMs = startTime ? parseTimestampToMs(startTime) : -Infinity;
  const endMs = endTime ? parseTimestampToMs(endTime) : Infinity;

  return ms >= startMs && ms < endMs;
}

// ============================================================================
// Fee Extraction and Calculation
// ============================================================================

/**
 * Extract fee rate in basis points from raw data
 *
 * @param raw - Raw trade execution response
 * @returns Fee rate in basis points (0-10000)
 */
export function extractFeeRateBps(raw: RawTradeExecutionResponse): number {
  const feeRate = raw.fee_rate_bps;

  if (feeRate === undefined || feeRate === null) {
    return DEFAULT_FEE_RATE_BPS;
  }

  const parsed = typeof feeRate === "string" ? parseFloat(feeRate) : feeRate;
  if (isNaN(parsed) || parsed < 0) {
    return DEFAULT_FEE_RATE_BPS;
  }

  // Ensure within valid range (0 to 10000 basis points = 0% to 100%)
  return Math.min(Math.max(parsed, 0), 10000);
}

/**
 * Calculate fee amount from fee rate and trade value
 *
 * @param sizeUsd - Trade size in USD
 * @param feeRateBps - Fee rate in basis points
 * @returns Fee amount in USD
 */
export function calculateFeeFromRate(sizeUsd: number, feeRateBps: number): number {
  if (sizeUsd <= 0 || feeRateBps <= 0) {
    return 0;
  }

  return (sizeUsd * feeRateBps) / 10000;
}

/**
 * Extract fee in USD from raw data
 *
 * Attempts to extract fee from multiple possible field names,
 * falling back to calculation from fee rate if needed.
 *
 * @param raw - Raw trade execution response
 * @param sizeUsd - Trade size in USD (for fallback calculation)
 * @param options - Fee calculation options
 * @returns Fee amount in USD
 */
export function extractFeeUsd(
  raw: RawTradeExecutionResponse,
  sizeUsd: number,
  options: FeeCalculationOptions = {}
): number {
  const { defaultFeeRateBps = DEFAULT_FEE_RATE_BPS } = options;

  // Try direct fee_usd field
  if (raw.fee_usd !== undefined && raw.fee_usd !== null) {
    const fee = typeof raw.fee_usd === "string" ? parseFloat(raw.fee_usd) : raw.fee_usd;
    if (!isNaN(fee) && fee >= 0) {
      return fee;
    }
  }

  // Try fee_amount field
  if (raw.fee_amount !== undefined && raw.fee_amount !== null) {
    const fee = typeof raw.fee_amount === "string" ? parseFloat(raw.fee_amount) : raw.fee_amount;
    if (!isNaN(fee) && fee >= 0) {
      return fee;
    }
  }

  // Try generic fee field
  if (raw.fee !== undefined && raw.fee !== null) {
    const fee = typeof raw.fee === "string" ? parseFloat(raw.fee) : raw.fee;
    if (!isNaN(fee) && fee >= 0) {
      return fee;
    }
  }

  // Try trading_fee field
  if (raw.trading_fee !== undefined && raw.trading_fee !== null) {
    const fee = typeof raw.trading_fee === "string" ? parseFloat(raw.trading_fee) : raw.trading_fee;
    if (!isNaN(fee) && fee >= 0) {
      return fee;
    }
  }

  // Calculate from fee rate if available
  const feeRateBps = extractFeeRateBps(raw);
  if (feeRateBps > 0) {
    return calculateFeeFromRate(sizeUsd, feeRateBps);
  }

  // Use default fee rate if provided
  if (defaultFeeRateBps > 0) {
    return calculateFeeFromRate(sizeUsd, defaultFeeRateBps);
  }

  return 0;
}

/**
 * Calculate total fees for a set of executions
 *
 * @param executions - Array of trade executions
 * @returns Total fees in USD
 */
export function calculateTotalFees(executions: Array<TradeExecution | EnrichedTradeExecution>): number {
  return executions.reduce((total, exec) => {
    return total + (exec.fee_usd ?? 0);
  }, 0);
}

// ============================================================================
// Value Calculation
// ============================================================================

/**
 * Extract size in USD from raw data
 *
 * @param raw - Raw trade execution response
 * @param options - Calculation options
 * @returns Size in USD
 */
export function extractSizeUsd(
  raw: RawTradeExecutionResponse,
  options: FeeCalculationOptions = {}
): number {
  const { usdcPrice = DEFAULT_USDC_PRICE } = options;

  // Try direct USD value fields
  if (raw.size_usd !== undefined && raw.size_usd !== null) {
    const value = typeof raw.size_usd === "string" ? parseFloat(raw.size_usd) : raw.size_usd;
    if (!isNaN(value) && value >= 0) {
      return value;
    }
  }

  if (raw.value_usd !== undefined && raw.value_usd !== null) {
    const value = typeof raw.value_usd === "string" ? parseFloat(raw.value_usd) : raw.value_usd;
    if (!isNaN(value) && value >= 0) {
      return value;
    }
  }

  if (raw.usd_amount !== undefined && raw.usd_amount !== null) {
    const value = typeof raw.usd_amount === "string" ? parseFloat(raw.usd_amount) : raw.usd_amount;
    if (!isNaN(value) && value >= 0) {
      return value;
    }
  }

  if (raw.notional !== undefined && raw.notional !== null) {
    const value = typeof raw.notional === "string" ? parseFloat(raw.notional) : raw.notional;
    if (!isNaN(value) && value >= 0) {
      return value;
    }
  }

  // Calculate from price and size
  const price = extractPrice(raw);
  const size = extractSize(raw);

  if (price > 0 && size > 0) {
    return price * size * usdcPrice;
  }

  return 0;
}

/**
 * Extract price from raw data
 *
 * @param raw - Raw trade execution response
 * @returns Price as number (0-1 for binary markets)
 */
export function extractPrice(raw: RawTradeExecutionResponse): number {
  const priceValue = raw.price ?? raw.execution_price;

  if (priceValue === undefined || priceValue === null) {
    return 0;
  }

  const parsed = typeof priceValue === "string" ? parseFloat(priceValue) : priceValue;
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Extract size from raw data
 *
 * @param raw - Raw trade execution response
 * @returns Size as number
 */
export function extractSize(raw: RawTradeExecutionResponse): number {
  const sizeValue = raw.size ?? raw.amount ?? raw.quantity;

  if (sizeValue === undefined || sizeValue === null) {
    return 0;
  }

  const parsed = typeof sizeValue === "string" ? parseFloat(sizeValue) : sizeValue;
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// ============================================================================
// Trade Direction Parsing
// ============================================================================

/**
 * Parse trade direction from raw string
 *
 * @param side - Raw side value
 * @returns Normalized TradeDirection
 */
export function parseTradeDirection(side?: string | null): TradeDirection {
  if (!side) {
    return "buy";
  }

  const normalized = side.toLowerCase().trim();

  if (
    normalized === "sell" ||
    normalized === "s" ||
    normalized === "ask" ||
    normalized === "short" ||
    normalized === "offer"
  ) {
    return "sell";
  }

  return "buy";
}

// ============================================================================
// Execution Status Parsing
// ============================================================================

/**
 * Determine execution status from raw data
 *
 * @param raw - Raw trade execution response
 * @returns ExecutionStatus
 */
export function determineExecutionStatus(raw: RawTradeExecutionResponse): ExecutionStatus {
  // Check explicit status field
  if (raw.status) {
    const status = raw.status.toLowerCase().trim();

    if (status === "filled" || status === "complete" || status === "executed") {
      return "filled";
    }
    if (status === "partial" || status === "partially_filled") {
      return "partial";
    }
    if (status === "pending" || status === "open") {
      return "pending";
    }
    if (status === "cancelled" || status === "canceled" || status === "rejected") {
      return "cancelled";
    }
  }

  // Check boolean flags
  if (raw.is_partial === true) {
    return "partial";
  }
  if (raw.is_fill === true) {
    return "filled";
  }

  // If we have a transaction hash, it's likely filled
  if (raw.transaction_hash || raw.tx_hash || raw.hash) {
    return "filled";
  }

  // Default to unknown
  return "unknown";
}

// ============================================================================
// Main Parsing Functions
// ============================================================================

/**
 * Parse a raw API response into an EnrichedTradeExecution
 *
 * Handles various API response formats and normalizes the data into
 * a consistent structure with computed fields.
 *
 * @param raw - Raw trade execution data from API
 * @param options - Parsing options
 * @returns Enriched trade execution object
 *
 * @example
 * ```typescript
 * const raw = {
 *   id: "trade123",
 *   price: "0.65",
 *   size: "100",
 *   side: "buy",
 *   created_at: "2026-01-10T12:00:00Z",
 *   fee_rate_bps: "50",
 * };
 *
 * const execution = parseTradeExecution(raw);
 * console.log(execution.size_usd);     // 65
 * console.log(execution.fee_usd);      // 0.325 (50 bps = 0.5%)
 * console.log(execution.net_value_usd); // 64.675
 * ```
 */
export function parseTradeExecution(
  raw: RawTradeExecutionResponse,
  options: FeeCalculationOptions = {}
): EnrichedTradeExecution {
  // Extract basic fields
  const id = raw.id ?? raw.trade_id ?? raw.execution_id ?? "";
  const assetId = raw.asset_id ?? raw.token_id ?? raw.market ?? "";
  const takerAddress = raw.taker_address ?? raw.taker;
  const makerAddress = raw.maker_address ?? raw.maker;
  const transactionHash = raw.transaction_hash ?? raw.tx_hash ?? raw.hash;
  const matchId = raw.match_id;
  const bucketIndex = raw.bucket_index;
  const orderId = raw.order_id;

  // Parse direction
  const side = parseTradeDirection(raw.side);

  // Extract numeric values
  const priceNumeric = extractPrice(raw);
  const sizeNumeric = extractSize(raw);
  const sizeUsd = extractSizeUsd(raw, options);
  const feeRateBps = extractFeeRateBps(raw);
  const feeUsd = extractFeeUsd(raw, sizeUsd, options);
  const netValueUsd = sizeUsd - feeUsd;

  // Parse timestamp
  const timestamp = raw.created_at ?? raw.timestamp ?? raw.executed_at ?? raw.execution_time;
  const normalizedTime = normalizeTimestamp(timestamp);

  // Determine status
  const executionStatus = determineExecutionStatus(raw);
  const isPartialFill = executionStatus === "partial" || raw.is_partial === true;

  // Extract market metadata
  const outcomeName = raw.outcome_name ?? raw.outcome;
  const marketQuestion = raw.market_question ?? raw.question ?? raw.market_title;

  return {
    // Base Trade fields
    id,
    asset_id: assetId,
    taker_address: takerAddress,
    maker_address: makerAddress,
    side,
    price: priceNumeric.toString(),
    size: sizeNumeric.toString(),
    transaction_hash: transactionHash,
    created_at: normalizedTime.iso,
    fee_rate_bps: feeRateBps > 0 ? feeRateBps.toString() : undefined,
    match_id: matchId,
    bucket_index: bucketIndex,

    // TradeExecution fields
    size_usd: sizeUsd,
    fee_usd: feeUsd > 0 ? feeUsd : undefined,
    outcome_name: outcomeName,
    market_question: marketQuestion,

    // EnrichedTradeExecution fields
    net_value_usd: netValueUsd,
    price_numeric: priceNumeric,
    size_numeric: sizeNumeric,
    fee_rate_bps_numeric: feeRateBps,
    is_partial_fill: isPartialFill,
    order_id: orderId,
    execution_status: executionStatus,
    executed_at: normalizedTime.date,
    executed_at_ms: normalizedTime.unixMs,
  };
}

/**
 * Parse a Trade object into an EnrichedTradeExecution
 *
 * Converts a basic Trade into an enriched execution with computed fields.
 *
 * @param trade - Trade object
 * @param options - Parsing options
 * @returns Enriched trade execution object
 *
 * @example
 * ```typescript
 * const trade: Trade = {
 *   id: "trade123",
 *   asset_id: "token456",
 *   side: "buy",
 *   price: "0.65",
 *   size: "100",
 *   created_at: "2026-01-10T12:00:00Z",
 * };
 *
 * const execution = tradeToExecution(trade);
 * console.log(execution.size_usd); // 65
 * ```
 */
export function tradeToExecution(
  trade: Trade,
  options: FeeCalculationOptions = {}
): EnrichedTradeExecution {
  // Convert Trade to RawTradeExecutionResponse format
  const raw: RawTradeExecutionResponse = {
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
  };

  return parseTradeExecution(raw, options);
}

/**
 * Parse multiple raw trade executions with error handling
 *
 * Processes an array of raw trade data, collecting errors for any
 * that fail to parse correctly.
 *
 * @param rawTrades - Array of raw trade execution data
 * @param options - Parsing options
 * @returns Parse result with executions, errors, and summary statistics
 *
 * @example
 * ```typescript
 * const rawTrades = [
 *   { id: "1", price: "0.5", size: "100", side: "buy" },
 *   { id: "2", price: "0.6", size: "50", side: "sell" },
 * ];
 *
 * const result = parseTradeExecutions(rawTrades);
 * console.log(result.successCount);     // 2
 * console.log(result.summary.totalVolumeUsd); // 80
 * ```
 */
export function parseTradeExecutions(
  rawTrades: RawTradeExecutionResponse[],
  options: FeeCalculationOptions = {}
): ParseTradeExecutionsResult {
  const executions: EnrichedTradeExecution[] = [];
  const errors: Array<{ index: number; error: string; raw?: unknown }> = [];

  let totalVolume = 0;
  let totalVolumeUsd = 0;
  let totalFees = 0;
  let totalPrice = 0;
  let validPriceCount = 0;
  let buyCount = 0;
  let sellCount = 0;
  let earliestExecution: Date | undefined;
  let latestExecution: Date | undefined;

  for (let i = 0; i < rawTrades.length; i++) {
    const raw = rawTrades[i]!;

    try {
      const execution = parseTradeExecution(raw, options);
      executions.push(execution);

      // Update statistics
      totalVolume += execution.size_numeric;
      totalVolumeUsd += execution.size_usd;
      totalFees += execution.fee_usd ?? 0;

      if (execution.price_numeric > 0) {
        totalPrice += execution.price_numeric;
        validPriceCount++;
      }

      if (execution.side === "buy") {
        buyCount++;
      } else {
        sellCount++;
      }

      if (!earliestExecution || execution.executed_at < earliestExecution) {
        earliestExecution = execution.executed_at;
      }
      if (!latestExecution || execution.executed_at > latestExecution) {
        latestExecution = execution.executed_at;
      }
    } catch (error) {
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : "Unknown parsing error",
        raw,
      });
    }
  }

  return {
    executions,
    successCount: executions.length,
    errorCount: errors.length,
    errors,
    summary: {
      totalVolume,
      totalVolumeUsd,
      totalFees,
      avgPrice: validPriceCount > 0 ? totalPrice / validPriceCount : 0,
      buyCount,
      sellCount,
      earliestExecution,
      latestExecution,
    },
  };
}

/**
 * Convert multiple Trade objects to EnrichedTradeExecutions
 *
 * @param trades - Array of Trade objects
 * @param options - Parsing options
 * @returns Parse result with executions and summary
 */
export function tradesToExecutions(
  trades: Trade[],
  options: FeeCalculationOptions = {}
): ParseTradeExecutionsResult {
  const rawTrades: RawTradeExecutionResponse[] = trades.map((trade) => ({
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
  }));

  return parseTradeExecutions(rawTrades, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sort executions by timestamp
 *
 * @param executions - Array of executions to sort
 * @param order - Sort order ("asc" or "desc")
 * @returns Sorted array (new array, original unchanged)
 */
export function sortExecutionsByTime(
  executions: EnrichedTradeExecution[],
  order: "asc" | "desc" = "desc"
): EnrichedTradeExecution[] {
  return [...executions].sort((a, b) => {
    const diff = a.executed_at_ms - b.executed_at_ms;
    return order === "asc" ? diff : -diff;
  });
}

/**
 * Filter executions by time range
 *
 * @param executions - Array of executions to filter
 * @param startTime - Start of time range (inclusive)
 * @param endTime - End of time range (exclusive)
 * @returns Filtered array
 */
export function filterExecutionsByTimeRange(
  executions: EnrichedTradeExecution[],
  startTime?: Date | string | number | null,
  endTime?: Date | string | number | null
): EnrichedTradeExecution[] {
  if (!startTime && !endTime) {
    return executions;
  }

  const startMs = startTime ? parseTimestampToMs(startTime) : -Infinity;
  const endMs = endTime ? parseTimestampToMs(endTime) : Infinity;

  return executions.filter((exec) => {
    return exec.executed_at_ms >= startMs && exec.executed_at_ms < endMs;
  });
}

/**
 * Filter executions by minimum size in USD
 *
 * @param executions - Array of executions to filter
 * @param minSizeUsd - Minimum size in USD
 * @returns Filtered array
 */
export function filterExecutionsByMinSize(
  executions: EnrichedTradeExecution[],
  minSizeUsd: number
): EnrichedTradeExecution[] {
  return executions.filter((exec) => exec.size_usd >= minSizeUsd);
}

/**
 * Group executions by asset ID
 *
 * @param executions - Array of executions to group
 * @returns Map of asset ID to executions
 */
export function groupExecutionsByAsset(
  executions: EnrichedTradeExecution[]
): Map<string, EnrichedTradeExecution[]> {
  const groups = new Map<string, EnrichedTradeExecution[]>();

  for (const exec of executions) {
    const assetId = exec.asset_id;
    const group = groups.get(assetId) ?? [];
    group.push(exec);
    groups.set(assetId, group);
  }

  return groups;
}

/**
 * Group executions by trade side
 *
 * @param executions - Array of executions to group
 * @returns Object with buy and sell arrays
 */
export function groupExecutionsBySide(
  executions: EnrichedTradeExecution[]
): { buy: EnrichedTradeExecution[]; sell: EnrichedTradeExecution[] } {
  const buy: EnrichedTradeExecution[] = [];
  const sell: EnrichedTradeExecution[] = [];

  for (const exec of executions) {
    if (exec.side === "buy") {
      buy.push(exec);
    } else {
      sell.push(exec);
    }
  }

  return { buy, sell };
}

/**
 * Calculate VWAP (Volume Weighted Average Price) for executions
 *
 * @param executions - Array of executions
 * @returns VWAP or 0 if no valid executions
 */
export function calculateExecutionVWAP(executions: EnrichedTradeExecution[]): number {
  let totalValue = 0;
  let totalVolume = 0;

  for (const exec of executions) {
    if (exec.price_numeric > 0 && exec.size_numeric > 0) {
      totalValue += exec.price_numeric * exec.size_numeric;
      totalVolume += exec.size_numeric;
    }
  }

  return totalVolume > 0 ? totalValue / totalVolume : 0;
}

/**
 * Check if an object is a valid EnrichedTradeExecution
 *
 * @param obj - Object to check
 * @returns True if object has required EnrichedTradeExecution fields
 */
export function isEnrichedTradeExecution(obj: unknown): obj is EnrichedTradeExecution {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const exec = obj as Record<string, unknown>;

  return (
    typeof exec.id === "string" &&
    typeof exec.size_usd === "number" &&
    typeof exec.net_value_usd === "number" &&
    typeof exec.price_numeric === "number" &&
    typeof exec.size_numeric === "number" &&
    exec.executed_at instanceof Date
  );
}
