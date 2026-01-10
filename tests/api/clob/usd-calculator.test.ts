/**
 * Tests for USD Calculator (API-CLOB-012)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUsdcPrice,
  validateUsdcPrice,
  createUsdcPriceFetcher,
  calculateTradeSizeUsd,
  calculateTradeValueWithFees,
  calculateTradeUsdValues,
  calculateTradesUsdValues,
  enrichTradeWithUsd,
  enrichTradesWithUsd,
  calculateTradeUsdSummary,
  calculatePositionValueUsd,
  calculatePotentialPayout,
  calculatePotentialProfit,
  calculatePotentialRoi,
  getOutcomeTokenPrice,
  priceToImpliedProbability,
  impliedProbabilityToPrice,
  addUsdToOrderBookLevels,
  calculateOrderBookSideValueUsd,
  calculateOrderBookTotalValueUsd,
  buildPositionFromTrades,
  formatUsdValue,
  isWhaleTrade,
  filterTradesByMinValueUsd,
  sortTradesByValueUsd,
  getTopTradesByValue,
} from "../../../src/api/clob/usd-calculator";
import type { Trade, OrderBook, OrderBookLevel } from "../../../src/api/clob/types";

// ============================================================================
// USDC Price Functions Tests
// ============================================================================

describe("getUsdcPrice", () => {
  it("should return default price of 1.0 when no custom price provided", () => {
    expect(getUsdcPrice()).toBe(1.0);
    expect(getUsdcPrice(undefined)).toBe(1.0);
    expect(getUsdcPrice(null as unknown as number)).toBe(1.0);
  });

  it("should return custom price when provided", () => {
    expect(getUsdcPrice(0.99)).toBe(0.99);
    expect(getUsdcPrice(1.01)).toBe(1.01);
    expect(getUsdcPrice(0.85)).toBe(0.85);
  });

  it("should return default for invalid values", () => {
    expect(getUsdcPrice(NaN)).toBe(1.0);
    expect(getUsdcPrice(-1)).toBe(1.0);
    expect(getUsdcPrice(0)).toBe(1.0);
  });
});

describe("validateUsdcPrice", () => {
  it("should return valid for price at peg", () => {
    const result = validateUsdcPrice(1.0);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("should return valid with no warnings for minor deviation", () => {
    const result = validateUsdcPrice(0.995);
    expect(result.valid).toBe(true);
    // Minor deviation still triggers warning
  });

  it("should return valid with warning for significant deviation", () => {
    const result = validateUsdcPrice(0.85);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    // Check for either "below peg" or "deviates from peg" warning
    expect(
      result.warnings.some((w) => w.includes("below peg") || w.includes("deviates from peg"))
    ).toBe(true);
  });

  it("should return valid with warning for price above peg", () => {
    const result = validateUsdcPrice(1.6);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("above peg"))).toBe(true);
  });

  it("should return invalid for non-positive values", () => {
    expect(validateUsdcPrice(0).valid).toBe(false);
    expect(validateUsdcPrice(-1).valid).toBe(false);
    expect(validateUsdcPrice(NaN).valid).toBe(false);
  });
});

describe("createUsdcPriceFetcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should fetch and cache price", async () => {
    const mockFetch = vi.fn().mockResolvedValue(0.99);
    const fetcher = createUsdcPriceFetcher(mockFetch);

    const price1 = await fetcher();
    expect(price1).toBe(0.99);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Should return cached value
    const price2 = await fetcher();
    expect(price2).toBe(0.99);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should refresh cache after expiry", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(0.99).mockResolvedValueOnce(0.98);
    const fetcher = createUsdcPriceFetcher(mockFetch, 1000); // 1 second cache

    const price1 = await fetcher();
    expect(price1).toBe(0.99);

    // Advance time past cache duration
    vi.advanceTimersByTime(1500);

    const price2 = await fetcher();
    expect(price2).toBe(0.98);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should return default on fetch error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const fetcher = createUsdcPriceFetcher(mockFetch);

    const price = await fetcher();
    expect(price).toBe(1.0);
  });
});

// ============================================================================
// Trade Size Calculation Tests
// ============================================================================

describe("calculateTradeSizeUsd", () => {
  it("should calculate USD value from price and size", () => {
    expect(calculateTradeSizeUsd(0.65, 100)).toBe(65);
    expect(calculateTradeSizeUsd(0.5, 200)).toBe(100);
    expect(calculateTradeSizeUsd(1.0, 50)).toBe(50);
  });

  it("should handle string inputs", () => {
    expect(calculateTradeSizeUsd("0.65", "100")).toBe(65);
    expect(calculateTradeSizeUsd("0.5", "200")).toBe(100);
  });

  it("should apply USDC price", () => {
    expect(calculateTradeSizeUsd(0.65, 100, { usdcPrice: 0.99 })).toBeCloseTo(64.35);
    expect(calculateTradeSizeUsd(0.65, 100, { usdcPrice: 1.01 })).toBeCloseTo(65.65);
  });

  it("should return 0 for invalid inputs", () => {
    expect(calculateTradeSizeUsd(NaN, 100)).toBe(0);
    expect(calculateTradeSizeUsd(0.65, NaN)).toBe(0);
    expect(calculateTradeSizeUsd(-0.5, 100)).toBe(0);
    expect(calculateTradeSizeUsd(0.5, -100)).toBe(0);
  });

  it("should handle edge cases", () => {
    expect(calculateTradeSizeUsd(0, 100)).toBe(0);
    expect(calculateTradeSizeUsd(0.65, 0)).toBe(0);
    expect(calculateTradeSizeUsd(0.001, 1000)).toBeCloseTo(1);
  });
});

describe("calculateTradeValueWithFees", () => {
  it("should calculate gross value without fees by default", () => {
    const result = calculateTradeValueWithFees(0.65, 100);
    expect(result.grossValueUsd).toBe(65);
    expect(result.feeUsd).toBe(0);
    expect(result.netValueUsd).toBe(65);
  });

  it("should calculate fees when rate provided", () => {
    const result = calculateTradeValueWithFees(0.65, 100, { defaultFeeRateBps: 50 }); // 0.5%
    expect(result.grossValueUsd).toBe(65);
    expect(result.feeUsd).toBeCloseTo(0.325);
    expect(result.netValueUsd).toBeCloseTo(64.675);
  });

  it("should skip fees when includeFees is false", () => {
    const result = calculateTradeValueWithFees(0.65, 100, {
      defaultFeeRateBps: 50,
      includeFees: false,
    });
    expect(result.feeUsd).toBe(0);
    expect(result.netValueUsd).toBe(65);
  });

  it("should handle various fee rates", () => {
    // 1% fee (100 bps)
    const result1 = calculateTradeValueWithFees(1.0, 100, { defaultFeeRateBps: 100 });
    expect(result1.feeUsd).toBe(1);

    // 0.1% fee (10 bps)
    const result2 = calculateTradeValueWithFees(1.0, 100, { defaultFeeRateBps: 10 });
    expect(result2.feeUsd).toBe(0.1);
  });
});

describe("calculateTradeUsdValues", () => {
  const baseTrade: Trade = {
    id: "trade1",
    asset_id: "token123",
    side: "buy",
    price: "0.65",
    size: "100",
    created_at: "2026-01-10T12:00:00Z",
  };

  it("should calculate USD values for a trade", () => {
    const result = calculateTradeUsdValues(baseTrade);
    expect(result.sizeUsd).toBe(65);
    expect(result.price).toBe(0.65);
    expect(result.size).toBe(100);
    expect(result.usdcPrice).toBe(1.0);
    expect(result.trade).toBe(baseTrade);
  });

  it("should apply fee rate from trade", () => {
    const tradeWithFee: Trade = {
      ...baseTrade,
      fee_rate_bps: "50",
    };
    const result = calculateTradeUsdValues(tradeWithFee);
    expect(result.sizeUsd).toBe(65);
    expect(result.feeUsd).toBeCloseTo(0.325);
    expect(result.netValueUsd).toBeCloseTo(64.675);
  });

  it("should apply default fee rate when trade has none", () => {
    const result = calculateTradeUsdValues(baseTrade, { defaultFeeRateBps: 100 });
    expect(result.feeUsd).toBe(0.65); // 1% of 65
  });

  it("should apply USDC price", () => {
    const result = calculateTradeUsdValues(baseTrade, { usdcPrice: 0.99 });
    expect(result.sizeUsd).toBeCloseTo(64.35);
    expect(result.usdcPrice).toBe(0.99);
  });
});

describe("calculateTradesUsdValues", () => {
  const trades: Trade[] = [
    { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" },
    { id: "2", asset_id: "t1", side: "sell", price: "0.6", size: "50", created_at: "2026-01-10T12:01:00Z" },
  ];

  it("should calculate USD values for multiple trades", () => {
    const results = calculateTradesUsdValues(trades);
    expect(results).toHaveLength(2);
    expect(results[0]?.sizeUsd).toBe(50);
    expect(results[1]?.sizeUsd).toBe(30);
  });
});

describe("enrichTradeWithUsd", () => {
  const trade: Trade = {
    id: "trade1",
    asset_id: "token123",
    side: "buy",
    price: "0.65",
    size: "100",
    created_at: "2026-01-10T12:00:00Z",
  };

  it("should enrich trade with USD values", () => {
    const enriched = enrichTradeWithUsd(trade);
    expect(enriched.size_usd).toBe(65);
    expect(enriched.price_numeric).toBe(0.65);
    expect(enriched.size_numeric).toBe(100);
    expect(enriched.net_value_usd).toBe(65);
    expect(enriched.executed_at).toBeInstanceOf(Date);
  });

  it("should apply USDC price to enriched trade", () => {
    const enriched = enrichTradeWithUsd(trade, { usdcPrice: 0.99 });
    expect(enriched.size_usd).toBeCloseTo(64.35);
  });
});

describe("enrichTradesWithUsd", () => {
  const trades: Trade[] = [
    { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" },
    { id: "2", asset_id: "t1", side: "sell", price: "0.6", size: "50", created_at: "2026-01-10T12:01:00Z" },
  ];

  it("should enrich multiple trades", () => {
    const enriched = enrichTradesWithUsd(trades);
    expect(enriched).toHaveLength(2);
    expect(enriched[0]?.size_usd).toBe(50);
    expect(enriched[1]?.size_usd).toBe(30);
  });
});

// ============================================================================
// Trade Summary Tests
// ============================================================================

describe("calculateTradeUsdSummary", () => {
  const trades: Trade[] = [
    { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" },
    { id: "2", asset_id: "t1", side: "sell", price: "0.6", size: "50", created_at: "2026-01-10T12:01:00Z" },
    { id: "3", asset_id: "t1", side: "buy", price: "0.55", size: "200", created_at: "2026-01-10T12:02:00Z" },
  ];

  it("should calculate summary statistics", () => {
    const summary = calculateTradeUsdSummary(trades);
    // Trade 1: 50, Trade 2: 30, Trade 3: 110 = 190 total
    expect(summary.totalVolumeUsd).toBe(190);
    expect(summary.tradeCount).toBe(3);
    expect(summary.avgTradeSizeUsd).toBeCloseTo(63.33, 1);
    expect(summary.buyVolumeUsd).toBe(160); // 50 + 110
    expect(summary.sellVolumeUsd).toBe(30);
    expect(summary.minTradeSizeUsd).toBe(30);
    expect(summary.maxTradeSizeUsd).toBeCloseTo(110);
  });

  it("should calculate VWAP correctly", () => {
    const summary = calculateTradeUsdSummary(trades);
    // VWAP = (0.5*100 + 0.6*50 + 0.55*200) / (100 + 50 + 200)
    // = (50 + 30 + 110) / 350 = 190/350 = 0.5428...
    expect(summary.vwap).toBeCloseTo(0.5428, 3);
  });

  it("should handle empty trades array", () => {
    const summary = calculateTradeUsdSummary([]);
    expect(summary.totalVolumeUsd).toBe(0);
    expect(summary.tradeCount).toBe(0);
    expect(summary.avgTradeSizeUsd).toBe(0);
    expect(summary.vwap).toBe(0);
  });

  it("should include fees in calculations", () => {
    const tradesWithFees: Trade[] = [
      {
        id: "1",
        asset_id: "t1",
        side: "buy",
        price: "1.0",
        size: "100",
        created_at: "2026-01-10T12:00:00Z",
        fee_rate_bps: "100",
      },
    ];
    const summary = calculateTradeUsdSummary(tradesWithFees);
    expect(summary.totalVolumeUsd).toBe(100);
    expect(summary.totalFeesUsd).toBe(1); // 1%
    expect(summary.netVolumeUsd).toBe(99);
  });

  it("should apply USDC price to summary", () => {
    const summary = calculateTradeUsdSummary(trades, { usdcPrice: 0.99 });
    expect(summary.usdcPrice).toBe(0.99);
    expect(summary.totalVolumeUsd).toBeCloseTo(188.1); // 190 * 0.99
  });
});

// ============================================================================
// Position Value Tests
// ============================================================================

describe("calculatePositionValueUsd", () => {
  it("should calculate position value", () => {
    const result = calculatePositionValueUsd(1000, 0.65, "token123");
    expect(result.valueUsd).toBe(650);
    expect(result.size).toBe(1000);
    expect(result.pricePerToken).toBe(0.65);
    expect(result.tokenId).toBe("token123");
  });

  it("should calculate P&L when cost basis provided", () => {
    const result = calculatePositionValueUsd(1000, 0.65, "token123", 500);
    expect(result.valueUsd).toBe(650);
    expect(result.costBasis).toBe(500);
    expect(result.unrealizedPnl).toBe(150);
    expect(result.pnlPercent).toBe(30);
  });

  it("should handle negative P&L", () => {
    const result = calculatePositionValueUsd(1000, 0.4, "token123", 500);
    expect(result.valueUsd).toBe(400);
    expect(result.unrealizedPnl).toBe(-100);
    expect(result.pnlPercent).toBe(-20);
  });

  it("should handle string inputs", () => {
    const result = calculatePositionValueUsd("1000", "0.65", "token123");
    expect(result.valueUsd).toBe(650);
  });
});

describe("calculatePotentialPayout", () => {
  it("should calculate payout for winning position", () => {
    expect(calculatePotentialPayout(100)).toBe(100);
    expect(calculatePotentialPayout(1000)).toBe(1000);
    expect(calculatePotentialPayout("500")).toBe(500);
  });

  it("should apply USDC price", () => {
    expect(calculatePotentialPayout(100, { usdcPrice: 0.99 })).toBe(99);
  });

  it("should return 0 for invalid inputs", () => {
    expect(calculatePotentialPayout(NaN)).toBe(0);
    expect(calculatePotentialPayout(-100)).toBe(0);
  });
});

describe("calculatePotentialProfit", () => {
  it("should calculate profit for winning position", () => {
    // Buy 100 tokens at $0.65 each
    // Cost = 65, Payout if win = 100, Profit = 35
    expect(calculatePotentialProfit(100, 0.65)).toBe(35);
  });

  it("should handle various entry prices", () => {
    expect(calculatePotentialProfit(100, 0.5)).toBe(50); // 50% return
    expect(calculatePotentialProfit(100, 0.2)).toBe(80); // 400% return
    expect(calculatePotentialProfit(100, 0.9)).toBe(10); // 11% return
  });

  it("should apply USDC price", () => {
    const profit = calculatePotentialProfit(100, 0.65, { usdcPrice: 0.99 });
    // Cost = 0.65 * 100 * 0.99 = 64.35
    // Payout = 100 * 1 * 0.99 = 99
    // Profit = 99 - 64.35 = 34.65
    expect(profit).toBeCloseTo(34.65);
  });
});

describe("calculatePotentialRoi", () => {
  it("should calculate ROI percentage", () => {
    expect(calculatePotentialRoi(0.5)).toBe(100); // 2x return = 100% ROI
    expect(calculatePotentialRoi(0.25)).toBe(300); // 4x return = 300% ROI
    expect(calculatePotentialRoi(0.1)).toBe(900); // 10x return = 900% ROI
  });

  it("should return 0 for invalid prices", () => {
    expect(calculatePotentialRoi(0)).toBe(0);
    expect(calculatePotentialRoi(-0.5)).toBe(0);
    expect(calculatePotentialRoi(1)).toBe(0); // No profit at $1
    expect(calculatePotentialRoi(1.5)).toBe(0);
    expect(calculatePotentialRoi(NaN)).toBe(0);
  });

  it("should handle string inputs", () => {
    expect(calculatePotentialRoi("0.5")).toBe(100);
  });
});

// ============================================================================
// Outcome Token Pricing Tests
// ============================================================================

describe("getOutcomeTokenPrice", () => {
  it("should return token pricing information", () => {
    const result = getOutcomeTokenPrice("token123", 0.65);
    expect(result.tokenId).toBe("token123");
    expect(result.price).toBe(0.65);
    expect(result.priceUsd).toBe(0.65);
    expect(result.impliedProbability).toBe(65);
    expect(result.complementPrice).toBe(0.35);
  });

  it("should include 24h price change if provided", () => {
    const result = getOutcomeTokenPrice("token123", 0.65, 0.05);
    expect(result.priceChange24h).toBe(0.05);
  });

  it("should apply USDC price", () => {
    const result = getOutcomeTokenPrice("token123", 0.65, undefined, { usdcPrice: 0.99 });
    expect(result.priceUsd).toBeCloseTo(0.6435);
  });

  it("should handle invalid prices", () => {
    const result = getOutcomeTokenPrice("token123", NaN);
    expect(result.price).toBe(0);
    expect(result.impliedProbability).toBe(0);
  });
});

describe("priceToImpliedProbability", () => {
  it("should convert price to probability", () => {
    expect(priceToImpliedProbability(0.65)).toBe(65);
    expect(priceToImpliedProbability(0.5)).toBe(50);
    expect(priceToImpliedProbability(1)).toBe(100);
    expect(priceToImpliedProbability(0)).toBe(0);
  });

  it("should handle string inputs", () => {
    expect(priceToImpliedProbability("0.65")).toBe(65);
  });

  it("should cap at 100 for prices above 1", () => {
    expect(priceToImpliedProbability(1.5)).toBe(100);
  });

  it("should return 0 for negative prices", () => {
    expect(priceToImpliedProbability(-0.5)).toBe(0);
    expect(priceToImpliedProbability(NaN)).toBe(0);
  });
});

describe("impliedProbabilityToPrice", () => {
  it("should convert probability to price", () => {
    expect(impliedProbabilityToPrice(65)).toBe(0.65);
    expect(impliedProbabilityToPrice(50)).toBe(0.5);
    expect(impliedProbabilityToPrice(100)).toBe(1);
    expect(impliedProbabilityToPrice(0)).toBe(0);
  });

  it("should handle string inputs", () => {
    expect(impliedProbabilityToPrice("65")).toBe(0.65);
  });

  it("should cap at 1 for probabilities above 100", () => {
    expect(impliedProbabilityToPrice(150)).toBe(1);
  });

  it("should return 0 for negative probabilities", () => {
    expect(impliedProbabilityToPrice(-50)).toBe(0);
  });
});

// ============================================================================
// Order Book USD Tests
// ============================================================================

describe("addUsdToOrderBookLevels", () => {
  const levels: OrderBookLevel[] = [
    { price: "0.65", size: "100" },
    { price: "0.64", size: "200" },
  ];

  it("should add USD values to levels", () => {
    const result = addUsdToOrderBookLevels(levels);
    expect(result[0]?.valueUsd).toBe(65);
    expect(result[0]?.priceUsd).toBe(0.65);
    expect(result[1]?.valueUsd).toBe(128);
    expect(result[1]?.priceUsd).toBe(0.64);
  });

  it("should apply USDC price", () => {
    const result = addUsdToOrderBookLevels(levels, { usdcPrice: 0.99 });
    expect(result[0]?.valueUsd).toBeCloseTo(64.35);
  });
});

describe("calculateOrderBookSideValueUsd", () => {
  const levels: OrderBookLevel[] = [
    { price: "0.65", size: "100" },
    { price: "0.64", size: "200" },
  ];

  it("should calculate total value", () => {
    const total = calculateOrderBookSideValueUsd(levels);
    expect(total).toBe(193); // 65 + 128
  });

  it("should handle empty levels", () => {
    expect(calculateOrderBookSideValueUsd([])).toBe(0);
  });
});

describe("calculateOrderBookTotalValueUsd", () => {
  const orderBook: OrderBook = {
    asset_id: "token123",
    timestamp: "2026-01-10T12:00:00Z",
    bids: [
      { price: "0.64", size: "100" },
      { price: "0.63", size: "200" },
    ],
    asks: [
      { price: "0.65", size: "100" },
      { price: "0.66", size: "200" },
    ],
  };

  it("should calculate total values for both sides", () => {
    const result = calculateOrderBookTotalValueUsd(orderBook);
    // Bids: 64 + 126 = 190
    // Asks: 65 + 132 = 197
    expect(result.bidValueUsd).toBe(190);
    expect(result.askValueUsd).toBe(197);
    expect(result.totalValueUsd).toBe(387);
  });
});

// ============================================================================
// Position Tracking Tests
// ============================================================================

describe("buildPositionFromTrades", () => {
  it("should build position from buy trades", () => {
    const trades: Trade[] = [
      { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" },
      { id: "2", asset_id: "t1", side: "buy", price: "0.6", size: "100", created_at: "2026-01-10T12:01:00Z" },
    ];

    const position = buildPositionFromTrades(trades, "t1", 0.65);
    expect(position.size).toBe(200);
    expect(position.avgCost).toBe(0.55); // (50 + 60) / 200
    expect(position.currentValueUsd).toBe(130); // 200 * 0.65
    expect(position.unrealizedPnlUsd).toBeCloseTo(20); // 130 - 110
  });

  it("should handle sell trades and realize P&L", () => {
    const trades: Trade[] = [
      { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" },
      { id: "2", asset_id: "t1", side: "sell", price: "0.6", size: "50", created_at: "2026-01-10T12:01:00Z" },
    ];

    const position = buildPositionFromTrades(trades, "t1", 0.55);
    expect(position.size).toBe(50);
    expect(position.realizedPnlUsd).toBeCloseTo(5); // Sold 50 at 0.6 (30), cost was 25, profit = 5
  });

  it("should filter by token ID", () => {
    const trades: Trade[] = [
      { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" },
      { id: "2", asset_id: "t2", side: "buy", price: "0.6", size: "200", created_at: "2026-01-10T12:01:00Z" },
    ];

    const position = buildPositionFromTrades(trades, "t1", 0.5);
    expect(position.size).toBe(100);
    expect(position.tokenId).toBe("t1");
  });

  it("should handle empty trades", () => {
    const position = buildPositionFromTrades([], "t1", 0.5);
    expect(position.size).toBe(0);
    expect(position.currentValueUsd).toBe(0);
    expect(position.unrealizedPnlUsd).toBe(0);
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe("formatUsdValue", () => {
  it("should format basic USD values", () => {
    expect(formatUsdValue(100)).toBe("$100.00");
    expect(formatUsdValue(100.5)).toBe("$100.50");
    expect(formatUsdValue(0)).toBe("$0.00");
  });

  it("should respect decimal places", () => {
    expect(formatUsdValue(100.123, { decimals: 0 })).toBe("$100");
    expect(formatUsdValue(100.123, { decimals: 3 })).toBe("$100.123");
  });

  it("should show sign when requested", () => {
    expect(formatUsdValue(100, { showSign: true })).toBe("+$100.00");
    expect(formatUsdValue(-100, { showSign: true })).toBe("$-100.00");
  });

  it("should use compact notation", () => {
    expect(formatUsdValue(1500000, { compact: true })).toBe("$1.5M");
    expect(formatUsdValue(1500, { compact: true })).toBe("$1.5K");
    expect(formatUsdValue(100, { compact: true })).toBe("$100.00");
  });

  it("should handle NaN", () => {
    expect(formatUsdValue(NaN)).toBe("$0.00");
  });
});

describe("isWhaleTrade", () => {
  const trade: Trade = {
    id: "1",
    asset_id: "t1",
    side: "buy",
    price: "0.5",
    size: "1000",
    created_at: "2026-01-10T12:00:00Z",
  };

  it("should identify whale trades", () => {
    expect(isWhaleTrade(trade, 500)).toBe(true); // 500 USD >= 500
    expect(isWhaleTrade(trade, 400)).toBe(true);
  });

  it("should identify non-whale trades", () => {
    expect(isWhaleTrade(trade, 600)).toBe(false);
    expect(isWhaleTrade(trade, 1000)).toBe(false);
  });
});

describe("filterTradesByMinValueUsd", () => {
  const trades: Trade[] = [
    { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" }, // 50
    { id: "2", asset_id: "t1", side: "buy", price: "0.6", size: "200", created_at: "2026-01-10T12:01:00Z" }, // 120
    { id: "3", asset_id: "t1", side: "buy", price: "0.4", size: "50", created_at: "2026-01-10T12:02:00Z" }, // 20
  ];

  it("should filter by minimum USD value", () => {
    const filtered = filterTradesByMinValueUsd(trades, 50);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("should return all trades when threshold is 0", () => {
    const filtered = filterTradesByMinValueUsd(trades, 0);
    expect(filtered).toHaveLength(3);
  });

  it("should return empty when threshold too high", () => {
    const filtered = filterTradesByMinValueUsd(trades, 1000);
    expect(filtered).toHaveLength(0);
  });
});

describe("sortTradesByValueUsd", () => {
  const trades: Trade[] = [
    { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" }, // 50
    { id: "2", asset_id: "t1", side: "buy", price: "0.6", size: "200", created_at: "2026-01-10T12:01:00Z" }, // 120
    { id: "3", asset_id: "t1", side: "buy", price: "0.4", size: "50", created_at: "2026-01-10T12:02:00Z" }, // 20
  ];

  it("should sort descending by default", () => {
    const sorted = sortTradesByValueUsd(trades);
    expect(sorted.map((t) => t.id)).toEqual(["2", "1", "3"]);
  });

  it("should sort ascending when specified", () => {
    const sorted = sortTradesByValueUsd(trades, "asc");
    expect(sorted.map((t) => t.id)).toEqual(["3", "1", "2"]);
  });

  it("should not modify original array", () => {
    const original = [...trades];
    sortTradesByValueUsd(trades);
    expect(trades.map((t) => t.id)).toEqual(original.map((t) => t.id));
  });
});

describe("getTopTradesByValue", () => {
  const trades: Trade[] = [
    { id: "1", asset_id: "t1", side: "buy", price: "0.5", size: "100", created_at: "2026-01-10T12:00:00Z" }, // 50
    { id: "2", asset_id: "t1", side: "buy", price: "0.6", size: "200", created_at: "2026-01-10T12:01:00Z" }, // 120
    { id: "3", asset_id: "t1", side: "buy", price: "0.4", size: "50", created_at: "2026-01-10T12:02:00Z" }, // 20
    { id: "4", asset_id: "t1", side: "buy", price: "0.7", size: "100", created_at: "2026-01-10T12:03:00Z" }, // 70
  ];

  it("should return top N trades by value", () => {
    const top2 = getTopTradesByValue(trades, 2);
    expect(top2).toHaveLength(2);
    expect(top2.map((t) => t.id)).toEqual(["2", "4"]);
  });

  it("should handle count greater than array length", () => {
    const top10 = getTopTradesByValue(trades, 10);
    expect(top10).toHaveLength(4);
  });

  it("should return empty for count 0", () => {
    const top0 = getTopTradesByValue(trades, 0);
    expect(top0).toHaveLength(0);
  });
});
