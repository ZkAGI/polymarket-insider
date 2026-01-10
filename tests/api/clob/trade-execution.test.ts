/**
 * Tests for Trade Execution Parser (API-CLOB-011)
 *
 * Tests parsing, normalization, and enrichment of trade execution data
 * from the Polymarket CLOB API.
 */

import { describe, it, expect } from "vitest";
import {
  // Main parsing functions
  parseTradeExecution,
  tradeToExecution,
  parseTradeExecutions,
  tradesToExecutions,
  // Timestamp normalization
  parseTimestampToMs,
  normalizeTimestamp,
  isTimestampInRange,
  // Fee extraction and calculation
  extractFeeRateBps,
  calculateFeeFromRate,
  extractFeeUsd,
  calculateTotalFees,
  // Value extraction
  extractSizeUsd,
  extractPrice,
  extractSize,
  // Direction parsing
  parseTradeDirection,
  // Status parsing
  determineExecutionStatus,
  // Utility functions
  sortExecutionsByTime,
  filterExecutionsByTimeRange,
  filterExecutionsByMinSize,
  groupExecutionsByAsset,
  groupExecutionsBySide,
  calculateExecutionVWAP,
  isEnrichedTradeExecution,
} from "../../../src/api/clob/trade-execution";
import type {
  RawTradeExecutionResponse,
  EnrichedTradeExecution,
} from "../../../src/api/clob/trade-execution";
import type { Trade } from "../../../src/api/clob/types";

// ============================================================================
// Test Fixtures
// ============================================================================

function createRawTradeExecution(
  overrides: Partial<RawTradeExecutionResponse> = {}
): RawTradeExecutionResponse {
  return {
    id: "trade123",
    asset_id: "token456",
    taker_address: "0x1234567890abcdef1234567890abcdef12345678",
    maker_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    side: "buy",
    price: "0.65",
    size: "100",
    transaction_hash: "0xabc123",
    created_at: "2026-01-10T12:00:00Z",
    fee_rate_bps: "50",
    match_id: "match789",
    ...overrides,
  };
}

function createTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "trade123",
    asset_id: "token456",
    taker_address: "0x1234567890abcdef1234567890abcdef12345678",
    maker_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    side: "buy",
    price: "0.65",
    size: "100",
    transaction_hash: "0xabc123",
    created_at: "2026-01-10T12:00:00Z",
    fee_rate_bps: "50",
    match_id: "match789",
    ...overrides,
  };
}

// ============================================================================
// Timestamp Normalization Tests
// ============================================================================

describe("Timestamp Normalization", () => {
  describe("parseTimestampToMs", () => {
    it("should parse ISO 8601 timestamp", () => {
      const ms = parseTimestampToMs("2026-01-10T12:00:00Z");
      expect(ms).toBe(new Date("2026-01-10T12:00:00Z").getTime());
    });

    it("should parse Unix timestamp in seconds", () => {
      const unixSeconds = 1767960000;
      const ms = parseTimestampToMs(unixSeconds);
      expect(ms).toBe(unixSeconds * 1000);
    });

    it("should parse Unix timestamp in milliseconds", () => {
      const unixMs = 1767960000000;
      const ms = parseTimestampToMs(unixMs);
      expect(ms).toBe(unixMs);
    });

    it("should parse numeric string as Unix seconds", () => {
      const ms = parseTimestampToMs("1767960000");
      expect(ms).toBe(1767960000 * 1000);
    });

    it("should parse numeric string as Unix milliseconds", () => {
      const ms = parseTimestampToMs("1767960000000");
      expect(ms).toBe(1767960000000);
    });

    it("should handle Date object", () => {
      const date = new Date("2026-01-10T12:00:00Z");
      const ms = parseTimestampToMs(date);
      expect(ms).toBe(date.getTime());
    });

    it("should return current time for undefined", () => {
      const before = Date.now();
      const ms = parseTimestampToMs(undefined);
      const after = Date.now();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });

    it("should return current time for null", () => {
      const before = Date.now();
      const ms = parseTimestampToMs(null);
      const after = Date.now();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });

    it("should return current time for invalid timestamp", () => {
      const before = Date.now();
      const ms = parseTimestampToMs("invalid-date");
      const after = Date.now();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });

    it("should return current time for NaN", () => {
      const before = Date.now();
      const ms = parseTimestampToMs(NaN);
      const after = Date.now();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });
  });

  describe("normalizeTimestamp", () => {
    it("should return all timestamp formats", () => {
      const result = normalizeTimestamp("2026-01-10T12:00:00Z");

      expect(result.iso).toBe("2026-01-10T12:00:00.000Z");
      expect(result.date).toBeInstanceOf(Date);
      expect(result.unix).toBe(Math.floor(new Date("2026-01-10T12:00:00Z").getTime() / 1000));
      expect(result.unixMs).toBe(new Date("2026-01-10T12:00:00Z").getTime());
      expect(typeof result.formatted).toBe("string");
      expect(typeof result.relative).toBe("string");
    });

    it("should handle Unix timestamp", () => {
      const result = normalizeTimestamp(1767960000);
      expect(result.unix).toBe(1767960000);
    });

    it("should provide human-readable formatted string", () => {
      const result = normalizeTimestamp("2026-01-10T12:00:00Z");
      expect(result.formatted).toContain("2026");
      expect(result.formatted).toContain("Jan");
    });
  });

  describe("isTimestampInRange", () => {
    const timestamp = "2026-01-10T12:00:00Z";

    it("should return true when timestamp is in range", () => {
      const result = isTimestampInRange(
        timestamp,
        "2026-01-10T00:00:00Z",
        "2026-01-11T00:00:00Z"
      );
      expect(result).toBe(true);
    });

    it("should return false when timestamp is before range", () => {
      const result = isTimestampInRange(
        timestamp,
        "2026-01-11T00:00:00Z",
        "2026-01-12T00:00:00Z"
      );
      expect(result).toBe(false);
    });

    it("should return false when timestamp is after range", () => {
      const result = isTimestampInRange(
        timestamp,
        "2026-01-09T00:00:00Z",
        "2026-01-10T00:00:00Z"
      );
      expect(result).toBe(false);
    });

    it("should include start time (inclusive)", () => {
      const result = isTimestampInRange(
        timestamp,
        "2026-01-10T12:00:00Z",
        "2026-01-11T00:00:00Z"
      );
      expect(result).toBe(true);
    });

    it("should exclude end time (exclusive)", () => {
      const result = isTimestampInRange(
        timestamp,
        "2026-01-10T00:00:00Z",
        "2026-01-10T12:00:00Z"
      );
      expect(result).toBe(false);
    });

    it("should handle null start time", () => {
      const result = isTimestampInRange(timestamp, null, "2026-01-11T00:00:00Z");
      expect(result).toBe(true);
    });

    it("should handle null end time", () => {
      const result = isTimestampInRange(timestamp, "2026-01-10T00:00:00Z", null);
      expect(result).toBe(true);
    });

    it("should handle both null", () => {
      const result = isTimestampInRange(timestamp, null, null);
      expect(result).toBe(true);
    });
  });
});

// ============================================================================
// Fee Extraction and Calculation Tests
// ============================================================================

describe("Fee Extraction and Calculation", () => {
  describe("extractFeeRateBps", () => {
    it("should extract fee rate from string", () => {
      const raw = createRawTradeExecution({ fee_rate_bps: "50" });
      expect(extractFeeRateBps(raw)).toBe(50);
    });

    it("should extract fee rate from number", () => {
      const raw = createRawTradeExecution({ fee_rate_bps: 75 });
      expect(extractFeeRateBps(raw)).toBe(75);
    });

    it("should return 0 for undefined fee rate", () => {
      const raw = createRawTradeExecution({ fee_rate_bps: undefined });
      expect(extractFeeRateBps(raw)).toBe(0);
    });

    it("should return 0 for negative fee rate", () => {
      const raw = createRawTradeExecution({ fee_rate_bps: "-10" });
      expect(extractFeeRateBps(raw)).toBe(0);
    });

    it("should clamp fee rate to 10000 maximum", () => {
      const raw = createRawTradeExecution({ fee_rate_bps: "15000" });
      expect(extractFeeRateBps(raw)).toBe(10000);
    });

    it("should return 0 for invalid string", () => {
      const raw = createRawTradeExecution({ fee_rate_bps: "invalid" as unknown as string });
      expect(extractFeeRateBps(raw)).toBe(0);
    });
  });

  describe("calculateFeeFromRate", () => {
    it("should calculate fee correctly", () => {
      // 50 bps = 0.5%
      expect(calculateFeeFromRate(100, 50)).toBe(0.5);
    });

    it("should return 0 for zero size", () => {
      expect(calculateFeeFromRate(0, 50)).toBe(0);
    });

    it("should return 0 for zero fee rate", () => {
      expect(calculateFeeFromRate(100, 0)).toBe(0);
    });

    it("should return 0 for negative size", () => {
      expect(calculateFeeFromRate(-100, 50)).toBe(0);
    });

    it("should calculate 100% fee for 10000 bps", () => {
      expect(calculateFeeFromRate(100, 10000)).toBe(100);
    });
  });

  describe("extractFeeUsd", () => {
    it("should extract from fee_usd field", () => {
      const raw = createRawTradeExecution({ fee_usd: "1.50" });
      expect(extractFeeUsd(raw, 100)).toBe(1.5);
    });

    it("should extract from fee_amount field", () => {
      const raw = createRawTradeExecution({ fee_usd: undefined, fee_amount: 2.5 });
      expect(extractFeeUsd(raw, 100)).toBe(2.5);
    });

    it("should extract from fee field", () => {
      const raw = createRawTradeExecution({ fee_usd: undefined, fee_amount: undefined, fee: "3" });
      expect(extractFeeUsd(raw, 100)).toBe(3);
    });

    it("should extract from trading_fee field", () => {
      const raw = createRawTradeExecution({
        fee_usd: undefined,
        fee_amount: undefined,
        fee: undefined,
        trading_fee: 4,
      });
      expect(extractFeeUsd(raw, 100)).toBe(4);
    });

    it("should calculate from fee rate if no direct fee", () => {
      const raw = createRawTradeExecution({
        fee_usd: undefined,
        fee_amount: undefined,
        fee: undefined,
        trading_fee: undefined,
        fee_rate_bps: "100", // 1%
      });
      expect(extractFeeUsd(raw, 100)).toBe(1);
    });

    it("should use default fee rate if provided", () => {
      const raw = createRawTradeExecution({
        fee_usd: undefined,
        fee_rate_bps: undefined,
      });
      expect(extractFeeUsd(raw, 100, { defaultFeeRateBps: 200 })).toBe(2);
    });

    it("should return 0 if no fee info", () => {
      const raw = createRawTradeExecution({
        fee_usd: undefined,
        fee_rate_bps: undefined,
      });
      expect(extractFeeUsd(raw, 100)).toBe(0);
    });
  });

  describe("calculateTotalFees", () => {
    it("should sum fees from executions", () => {
      const executions = [
        { fee_usd: 1 } as EnrichedTradeExecution,
        { fee_usd: 2 } as EnrichedTradeExecution,
        { fee_usd: 3 } as EnrichedTradeExecution,
      ];
      expect(calculateTotalFees(executions)).toBe(6);
    });

    it("should handle undefined fees", () => {
      const executions = [
        { fee_usd: 1 } as EnrichedTradeExecution,
        { fee_usd: undefined } as unknown as EnrichedTradeExecution,
        { fee_usd: 3 } as EnrichedTradeExecution,
      ];
      expect(calculateTotalFees(executions)).toBe(4);
    });

    it("should return 0 for empty array", () => {
      expect(calculateTotalFees([])).toBe(0);
    });
  });
});

// ============================================================================
// Value Extraction Tests
// ============================================================================

describe("Value Extraction", () => {
  describe("extractSizeUsd", () => {
    it("should extract from size_usd field", () => {
      const raw = createRawTradeExecution({ size_usd: "65" });
      expect(extractSizeUsd(raw)).toBe(65);
    });

    it("should extract from value_usd field", () => {
      const raw = createRawTradeExecution({ size_usd: undefined, value_usd: 70 });
      expect(extractSizeUsd(raw)).toBe(70);
    });

    it("should extract from usd_amount field", () => {
      const raw = createRawTradeExecution({ size_usd: undefined, usd_amount: "80" });
      expect(extractSizeUsd(raw)).toBe(80);
    });

    it("should extract from notional field", () => {
      const raw = createRawTradeExecution({ size_usd: undefined, notional: 90 });
      expect(extractSizeUsd(raw)).toBe(90);
    });

    it("should calculate from price and size", () => {
      const raw = createRawTradeExecution({
        size_usd: undefined,
        price: "0.5",
        size: "200",
      });
      expect(extractSizeUsd(raw)).toBe(100);
    });

    it("should apply USDC price multiplier", () => {
      const raw = createRawTradeExecution({
        size_usd: undefined,
        price: "0.5",
        size: "200",
      });
      expect(extractSizeUsd(raw, { usdcPrice: 1.01 })).toBeCloseTo(101);
    });

    it("should return 0 if no valid value", () => {
      const raw = createRawTradeExecution({
        size_usd: undefined,
        price: undefined,
        size: undefined,
      });
      expect(extractSizeUsd(raw)).toBe(0);
    });
  });

  describe("extractPrice", () => {
    it("should extract from price field", () => {
      const raw = createRawTradeExecution({ price: "0.65" });
      expect(extractPrice(raw)).toBe(0.65);
    });

    it("should extract from execution_price field", () => {
      const raw = createRawTradeExecution({ price: undefined, execution_price: 0.75 });
      expect(extractPrice(raw)).toBe(0.75);
    });

    it("should return 0 for undefined", () => {
      const raw = createRawTradeExecution({ price: undefined });
      expect(extractPrice(raw)).toBe(0);
    });

    it("should return 0 for negative price", () => {
      const raw = createRawTradeExecution({ price: "-0.5" });
      expect(extractPrice(raw)).toBe(0);
    });
  });

  describe("extractSize", () => {
    it("should extract from size field", () => {
      const raw = createRawTradeExecution({ size: "100" });
      expect(extractSize(raw)).toBe(100);
    });

    it("should extract from amount field", () => {
      const raw = createRawTradeExecution({ size: undefined, amount: 200 });
      expect(extractSize(raw)).toBe(200);
    });

    it("should extract from quantity field", () => {
      const raw = createRawTradeExecution({ size: undefined, quantity: "300" });
      expect(extractSize(raw)).toBe(300);
    });

    it("should return 0 for undefined", () => {
      const raw = createRawTradeExecution({ size: undefined });
      expect(extractSize(raw)).toBe(0);
    });

    it("should return 0 for negative size", () => {
      const raw = createRawTradeExecution({ size: "-100" });
      expect(extractSize(raw)).toBe(0);
    });
  });
});

// ============================================================================
// Trade Direction Parsing Tests
// ============================================================================

describe("parseTradeDirection", () => {
  it("should return 'buy' for buy-related strings", () => {
    expect(parseTradeDirection("buy")).toBe("buy");
    expect(parseTradeDirection("BUY")).toBe("buy");
    expect(parseTradeDirection("Buy")).toBe("buy");
    expect(parseTradeDirection("b")).toBe("buy");
    expect(parseTradeDirection("bid")).toBe("buy");
    expect(parseTradeDirection("long")).toBe("buy");
  });

  it("should return 'sell' for sell-related strings", () => {
    expect(parseTradeDirection("sell")).toBe("sell");
    expect(parseTradeDirection("SELL")).toBe("sell");
    expect(parseTradeDirection("Sell")).toBe("sell");
    expect(parseTradeDirection("s")).toBe("sell");
    expect(parseTradeDirection("ask")).toBe("sell");
    expect(parseTradeDirection("short")).toBe("sell");
    expect(parseTradeDirection("offer")).toBe("sell");
  });

  it("should return 'buy' for undefined", () => {
    expect(parseTradeDirection(undefined)).toBe("buy");
    expect(parseTradeDirection(null)).toBe("buy");
  });

  it("should return 'buy' for empty string", () => {
    expect(parseTradeDirection("")).toBe("buy");
    expect(parseTradeDirection("  ")).toBe("buy");
  });
});

// ============================================================================
// Execution Status Tests
// ============================================================================

describe("determineExecutionStatus", () => {
  it("should return 'filled' for filled status", () => {
    expect(determineExecutionStatus({ status: "filled" })).toBe("filled");
    expect(determineExecutionStatus({ status: "complete" })).toBe("filled");
    expect(determineExecutionStatus({ status: "executed" })).toBe("filled");
    expect(determineExecutionStatus({ status: "FILLED" })).toBe("filled");
  });

  it("should return 'partial' for partial status", () => {
    expect(determineExecutionStatus({ status: "partial" })).toBe("partial");
    expect(determineExecutionStatus({ status: "partially_filled" })).toBe("partial");
  });

  it("should return 'pending' for pending status", () => {
    expect(determineExecutionStatus({ status: "pending" })).toBe("pending");
    expect(determineExecutionStatus({ status: "open" })).toBe("pending");
  });

  it("should return 'cancelled' for cancelled status", () => {
    expect(determineExecutionStatus({ status: "cancelled" })).toBe("cancelled");
    expect(determineExecutionStatus({ status: "canceled" })).toBe("cancelled");
    expect(determineExecutionStatus({ status: "rejected" })).toBe("cancelled");
  });

  it("should check is_partial flag", () => {
    expect(determineExecutionStatus({ is_partial: true })).toBe("partial");
  });

  it("should check is_fill flag", () => {
    expect(determineExecutionStatus({ is_fill: true })).toBe("filled");
  });

  it("should infer filled from transaction hash", () => {
    expect(determineExecutionStatus({ transaction_hash: "0xabc" })).toBe("filled");
    expect(determineExecutionStatus({ tx_hash: "0xdef" })).toBe("filled");
    expect(determineExecutionStatus({ hash: "0x123" })).toBe("filled");
  });

  it("should return 'unknown' for no indicators", () => {
    expect(determineExecutionStatus({})).toBe("unknown");
  });
});

// ============================================================================
// Main Parsing Functions Tests
// ============================================================================

describe("parseTradeExecution", () => {
  it("should parse raw trade into enriched execution", () => {
    const raw = createRawTradeExecution();
    const result = parseTradeExecution(raw);

    expect(result.id).toBe("trade123");
    expect(result.asset_id).toBe("token456");
    expect(result.side).toBe("buy");
    expect(result.price).toBe("0.65");
    expect(result.size).toBe("100");
    expect(result.price_numeric).toBe(0.65);
    expect(result.size_numeric).toBe(100);
    expect(result.size_usd).toBe(65); // 0.65 * 100
    expect(result.fee_rate_bps_numeric).toBe(50);
    expect(result.executed_at).toBeInstanceOf(Date);
    expect(result.execution_status).toBe("filled"); // has transaction_hash
  });

  it("should calculate net value correctly", () => {
    const raw = createRawTradeExecution({
      price: "0.5",
      size: "100",
      fee_rate_bps: "100", // 1%
    });
    const result = parseTradeExecution(raw);

    expect(result.size_usd).toBe(50);
    expect(result.fee_usd).toBe(0.5);
    expect(result.net_value_usd).toBe(49.5);
  });

  it("should handle alternative field names", () => {
    const raw: RawTradeExecutionResponse = {
      trade_id: "alt123",
      token_id: "altToken",
      taker: "0x1111111111111111111111111111111111111111",
      maker: "0x2222222222222222222222222222222222222222",
      execution_price: "0.7",
      amount: "50",
      tx_hash: "0xaltHash",
      timestamp: "2026-01-10T15:00:00Z",
    };

    const result = parseTradeExecution(raw);

    expect(result.id).toBe("alt123");
    expect(result.asset_id).toBe("altToken");
    expect(result.taker_address).toBe("0x1111111111111111111111111111111111111111");
    expect(result.maker_address).toBe("0x2222222222222222222222222222222222222222");
    expect(result.price_numeric).toBe(0.7);
    expect(result.size_numeric).toBe(50);
    expect(result.transaction_hash).toBe("0xaltHash");
  });

  it("should include market metadata", () => {
    const raw = createRawTradeExecution({
      outcome_name: "Yes",
      market_question: "Will it happen?",
    });
    const result = parseTradeExecution(raw);

    expect(result.outcome_name).toBe("Yes");
    expect(result.market_question).toBe("Will it happen?");
  });

  it("should handle partial fills", () => {
    const raw = createRawTradeExecution({ is_partial: true });
    const result = parseTradeExecution(raw);

    expect(result.is_partial_fill).toBe(true);
    expect(result.execution_status).toBe("partial");
  });

  it("should include order ID", () => {
    const raw = createRawTradeExecution({ order_id: "order123" });
    const result = parseTradeExecution(raw);

    expect(result.order_id).toBe("order123");
  });
});

describe("tradeToExecution", () => {
  it("should convert Trade to EnrichedTradeExecution", () => {
    const trade = createTrade();
    const result = tradeToExecution(trade);

    expect(result.id).toBe(trade.id);
    expect(result.asset_id).toBe(trade.asset_id);
    expect(result.side).toBe(trade.side);
    expect(result.price).toBe(trade.price);
    expect(result.size).toBe(trade.size);
    expect(result.size_usd).toBe(65); // 0.65 * 100
    expect(result.executed_at).toBeInstanceOf(Date);
  });

  it("should apply fee calculation options", () => {
    const trade = createTrade({ fee_rate_bps: undefined });
    const result = tradeToExecution(trade, { defaultFeeRateBps: 50 });

    expect(result.fee_usd).toBeCloseTo(0.325); // 65 * 0.005
  });
});

describe("parseTradeExecutions", () => {
  it("should parse multiple trades", () => {
    const rawTrades = [
      createRawTradeExecution({ id: "1", price: "0.5", size: "100", side: "buy" }),
      createRawTradeExecution({ id: "2", price: "0.6", size: "50", side: "sell" }),
      createRawTradeExecution({ id: "3", price: "0.7", size: "75", side: "buy" }),
    ];

    const result = parseTradeExecutions(rawTrades);

    expect(result.successCount).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(result.executions).toHaveLength(3);
  });

  it("should calculate summary statistics", () => {
    const rawTrades = [
      createRawTradeExecution({ id: "1", price: "0.5", size: "100", side: "buy" }),
      createRawTradeExecution({ id: "2", price: "0.5", size: "100", side: "sell" }),
    ];

    const result = parseTradeExecutions(rawTrades);

    expect(result.summary.totalVolume).toBe(200);
    expect(result.summary.totalVolumeUsd).toBe(100); // 0.5 * 100 + 0.5 * 100
    expect(result.summary.avgPrice).toBe(0.5);
    expect(result.summary.buyCount).toBe(1);
    expect(result.summary.sellCount).toBe(1);
  });

  it("should track earliest and latest executions", () => {
    const rawTrades = [
      createRawTradeExecution({ id: "1", created_at: "2026-01-10T10:00:00Z" }),
      createRawTradeExecution({ id: "2", created_at: "2026-01-10T12:00:00Z" }),
      createRawTradeExecution({ id: "3", created_at: "2026-01-10T08:00:00Z" }),
    ];

    const result = parseTradeExecutions(rawTrades);

    expect(result.summary.earliestExecution?.toISOString()).toBe("2026-01-10T08:00:00.000Z");
    expect(result.summary.latestExecution?.toISOString()).toBe("2026-01-10T12:00:00.000Z");
  });

  it("should handle empty array", () => {
    const result = parseTradeExecutions([]);

    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.executions).toHaveLength(0);
    expect(result.summary.totalVolume).toBe(0);
  });
});

describe("tradesToExecutions", () => {
  it("should convert Trade array to executions", () => {
    const trades = [
      createTrade({ id: "1" }),
      createTrade({ id: "2" }),
    ];

    const result = tradesToExecutions(trades);

    expect(result.successCount).toBe(2);
    expect(result.executions[0]!.id).toBe("1");
    expect(result.executions[1]!.id).toBe("2");
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe("sortExecutionsByTime", () => {
  it("should sort by time descending by default", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ created_at: "2026-01-10T10:00:00Z" })),
      parseTradeExecution(createRawTradeExecution({ created_at: "2026-01-10T12:00:00Z" })),
      parseTradeExecution(createRawTradeExecution({ created_at: "2026-01-10T08:00:00Z" })),
    ];

    const sorted = sortExecutionsByTime(executions);

    expect(sorted[0]!.executed_at.toISOString()).toBe("2026-01-10T12:00:00.000Z");
    expect(sorted[1]!.executed_at.toISOString()).toBe("2026-01-10T10:00:00.000Z");
    expect(sorted[2]!.executed_at.toISOString()).toBe("2026-01-10T08:00:00.000Z");
  });

  it("should sort by time ascending when specified", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ created_at: "2026-01-10T10:00:00Z" })),
      parseTradeExecution(createRawTradeExecution({ created_at: "2026-01-10T12:00:00Z" })),
      parseTradeExecution(createRawTradeExecution({ created_at: "2026-01-10T08:00:00Z" })),
    ];

    const sorted = sortExecutionsByTime(executions, "asc");

    expect(sorted[0]!.executed_at.toISOString()).toBe("2026-01-10T08:00:00.000Z");
    expect(sorted[1]!.executed_at.toISOString()).toBe("2026-01-10T10:00:00.000Z");
    expect(sorted[2]!.executed_at.toISOString()).toBe("2026-01-10T12:00:00.000Z");
  });

  it("should not modify original array", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ id: "1", created_at: "2026-01-10T10:00:00Z" })),
      parseTradeExecution(createRawTradeExecution({ id: "2", created_at: "2026-01-10T12:00:00Z" })),
    ];

    sortExecutionsByTime(executions);

    expect(executions[0]!.id).toBe("1");
    expect(executions[1]!.id).toBe("2");
  });
});

describe("filterExecutionsByTimeRange", () => {
  const executions = [
    parseTradeExecution(createRawTradeExecution({ id: "1", created_at: "2026-01-10T08:00:00Z" })),
    parseTradeExecution(createRawTradeExecution({ id: "2", created_at: "2026-01-10T10:00:00Z" })),
    parseTradeExecution(createRawTradeExecution({ id: "3", created_at: "2026-01-10T12:00:00Z" })),
  ];

  it("should filter executions within time range", () => {
    const filtered = filterExecutionsByTimeRange(
      executions,
      "2026-01-10T09:00:00Z",
      "2026-01-10T11:00:00Z"
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("2");
  });

  it("should return all executions for null range", () => {
    const filtered = filterExecutionsByTimeRange(executions, null, null);
    expect(filtered).toHaveLength(3);
  });

  it("should handle only start time", () => {
    const filtered = filterExecutionsByTimeRange(executions, "2026-01-10T10:00:00Z", null);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.id).toBe("2");
    expect(filtered[1]!.id).toBe("3");
  });

  it("should handle only end time", () => {
    const filtered = filterExecutionsByTimeRange(executions, null, "2026-01-10T10:00:00Z");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("1");
  });
});

describe("filterExecutionsByMinSize", () => {
  const executions = [
    parseTradeExecution(createRawTradeExecution({ id: "1", price: "0.5", size: "50" })),
    parseTradeExecution(createRawTradeExecution({ id: "2", price: "0.5", size: "100" })),
    parseTradeExecution(createRawTradeExecution({ id: "3", price: "0.5", size: "200" })),
  ];

  it("should filter by minimum USD size", () => {
    // size_usd = price * size = 0.5 * size
    const filtered = filterExecutionsByMinSize(executions, 75); // >= $75

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("3"); // 0.5 * 200 = $100
  });

  it("should include all for zero minimum", () => {
    const filtered = filterExecutionsByMinSize(executions, 0);
    expect(filtered).toHaveLength(3);
  });
});

describe("groupExecutionsByAsset", () => {
  it("should group executions by asset ID", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ id: "1", asset_id: "tokenA" })),
      parseTradeExecution(createRawTradeExecution({ id: "2", asset_id: "tokenB" })),
      parseTradeExecution(createRawTradeExecution({ id: "3", asset_id: "tokenA" })),
    ];

    const groups = groupExecutionsByAsset(executions);

    expect(groups.get("tokenA")).toHaveLength(2);
    expect(groups.get("tokenB")).toHaveLength(1);
  });

  it("should return empty map for empty array", () => {
    const groups = groupExecutionsByAsset([]);
    expect(groups.size).toBe(0);
  });
});

describe("groupExecutionsBySide", () => {
  it("should group executions by side", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ id: "1", side: "buy" })),
      parseTradeExecution(createRawTradeExecution({ id: "2", side: "sell" })),
      parseTradeExecution(createRawTradeExecution({ id: "3", side: "buy" })),
    ];

    const { buy, sell } = groupExecutionsBySide(executions);

    expect(buy).toHaveLength(2);
    expect(sell).toHaveLength(1);
  });
});

describe("calculateExecutionVWAP", () => {
  it("should calculate VWAP correctly", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ price: "0.5", size: "100" })),
      parseTradeExecution(createRawTradeExecution({ price: "0.6", size: "200" })),
    ];

    // VWAP = (0.5 * 100 + 0.6 * 200) / (100 + 200) = 170 / 300 = 0.5667
    const vwap = calculateExecutionVWAP(executions);
    expect(vwap).toBeCloseTo(0.5667, 3);
  });

  it("should return 0 for empty array", () => {
    expect(calculateExecutionVWAP([])).toBe(0);
  });

  it("should return 0 for executions with zero volume", () => {
    const executions = [
      parseTradeExecution(createRawTradeExecution({ price: "0.5", size: "0" })),
    ];
    expect(calculateExecutionVWAP(executions)).toBe(0);
  });
});

describe("isEnrichedTradeExecution", () => {
  it("should return true for valid EnrichedTradeExecution", () => {
    const execution = parseTradeExecution(createRawTradeExecution());
    expect(isEnrichedTradeExecution(execution)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isEnrichedTradeExecution(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isEnrichedTradeExecution(undefined)).toBe(false);
  });

  it("should return false for plain object missing fields", () => {
    expect(isEnrichedTradeExecution({ id: "123" })).toBe(false);
  });

  it("should return false for primitive", () => {
    expect(isEnrichedTradeExecution("string")).toBe(false);
    expect(isEnrichedTradeExecution(123)).toBe(false);
  });
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe("Edge Cases", () => {
  describe("parseTradeExecution with minimal data", () => {
    it("should handle empty object", () => {
      const result = parseTradeExecution({});

      expect(result.id).toBe("");
      expect(result.asset_id).toBe("");
      expect(result.price_numeric).toBe(0);
      expect(result.size_numeric).toBe(0);
      expect(result.size_usd).toBe(0);
      expect(result.executed_at).toBeInstanceOf(Date);
    });

    it("should handle only ID", () => {
      const result = parseTradeExecution({ id: "only-id" });
      expect(result.id).toBe("only-id");
    });
  });

  describe("parseTradeExecution with invalid data", () => {
    it("should handle NaN price", () => {
      const result = parseTradeExecution({ price: "not-a-number" });
      expect(result.price_numeric).toBe(0);
    });

    it("should handle NaN size", () => {
      const result = parseTradeExecution({ size: "not-a-number" });
      expect(result.size_numeric).toBe(0);
    });

    it("should handle negative values as zero", () => {
      const result = parseTradeExecution({ price: "-0.5", size: "-100" });
      expect(result.price_numeric).toBe(0);
      expect(result.size_numeric).toBe(0);
    });
  });

  describe("Timestamp edge cases", () => {
    it("should handle very old timestamps", () => {
      const result = normalizeTimestamp("2000-01-01T00:00:00Z");
      expect(result.date.getFullYear()).toBe(2000);
    });

    it("should handle future timestamps", () => {
      const result = normalizeTimestamp("2030-12-31T23:59:59Z");
      expect(result.date.getUTCFullYear()).toBe(2030);
      expect(result.relative).toBe("in the future");
    });

    it("should handle timestamp at epoch", () => {
      const result = normalizeTimestamp(0);
      expect(result.date.getUTCFullYear()).toBe(1970);
    });
  });

  describe("Large data sets", () => {
    it("should handle parsing many trades", () => {
      const rawTrades = Array.from({ length: 1000 }, (_, i) =>
        createRawTradeExecution({
          id: `trade-${i}`,
          price: (0.5 + (i % 10) * 0.01).toString(),
          size: (100 + i).toString(),
        })
      );

      const result = parseTradeExecutions(rawTrades);

      expect(result.successCount).toBe(1000);
      expect(result.errorCount).toBe(0);
      expect(result.summary.totalVolume).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
  it("should handle complete trade execution workflow", () => {
    // Create raw trades
    const rawTrades = [
      createRawTradeExecution({
        id: "trade1",
        price: "0.65",
        size: "100",
        side: "buy",
        created_at: "2026-01-10T10:00:00Z",
        fee_rate_bps: "50",
      }),
      createRawTradeExecution({
        id: "trade2",
        price: "0.68",
        size: "150",
        side: "sell",
        created_at: "2026-01-10T12:00:00Z",
        fee_rate_bps: "50",
      }),
      createRawTradeExecution({
        id: "trade3",
        price: "0.70",
        size: "75",
        side: "buy",
        created_at: "2026-01-10T14:00:00Z",
        fee_rate_bps: "50",
      }),
    ];

    // Parse all trades
    const result = parseTradeExecutions(rawTrades);
    expect(result.successCount).toBe(3);

    // Sort by time
    const sorted = sortExecutionsByTime(result.executions, "asc");
    expect(sorted[0]!.id).toBe("trade1");
    expect(sorted[2]!.id).toBe("trade3");

    // Filter by time range
    const filtered = filterExecutionsByTimeRange(
      result.executions,
      "2026-01-10T11:00:00Z",
      "2026-01-10T15:00:00Z"
    );
    expect(filtered).toHaveLength(2);

    // Group by side
    const { buy, sell } = groupExecutionsBySide(result.executions);
    expect(buy).toHaveLength(2);
    expect(sell).toHaveLength(1);

    // Calculate VWAP
    const vwap = calculateExecutionVWAP(result.executions);
    expect(vwap).toBeGreaterThan(0);
    expect(vwap).toBeLessThan(1);

    // Calculate total fees
    const totalFees = calculateTotalFees(result.executions);
    expect(totalFees).toBeGreaterThan(0);
  });

  it("should convert trades and back", () => {
    const originalTrade = createTrade();
    const execution = tradeToExecution(originalTrade);

    // Verify fields match
    expect(execution.id).toBe(originalTrade.id);
    expect(execution.asset_id).toBe(originalTrade.asset_id);
    expect(execution.side).toBe(originalTrade.side);
    expect(execution.price).toBe(originalTrade.price);
    expect(execution.size).toBe(originalTrade.size);

    // Verify enriched fields exist
    expect(execution.size_usd).toBeGreaterThan(0);
    expect(execution.net_value_usd).toBeDefined();
    expect(execution.executed_at).toBeInstanceOf(Date);
  });
});
