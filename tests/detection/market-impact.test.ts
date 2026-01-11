/**
 * Tests for Market Impact Calculator (DET-VOL-009)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MarketImpactCalculator,
  createMarketImpactCalculator,
  getSharedMarketImpactCalculator,
  resetSharedMarketImpactCalculator,
  calculateMarketImpact,
  batchCalculateMarketImpact,
  hasExcessiveImpact,
  getTradeImpactSeverity,
  getRecentHighImpactEvents,
  getMarketImpactSummary,
  ImpactSeverity,
  ImpactAnomalyType,
  TradeDirection,
  LiquidityLevel,
  DEFAULT_IMPACT_SEVERITY_THRESHOLDS,
  DEFAULT_EXCESSIVE_THRESHOLDS,
} from "../../src/detection/market-impact";

import type {
  ImpactTradeData,
  MarketLiquidityData,
  HighImpactEvent,
} from "../../src/detection/market-impact";

describe("MarketImpactCalculator", () => {
  let calculator: MarketImpactCalculator;

  beforeEach(() => {
    calculator = createMarketImpactCalculator();
  });

  afterEach(() => {
    calculator.clearAll();
    calculator.removeAllListeners();
    resetSharedMarketImpactCalculator();
  });

  describe("calculateImpact", () => {
    it("should calculate basic impact correctly", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-1",
        marketId: "market-1",
        walletAddress: "0x1234567890abcdef",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.52, // 2% move = 200 bps
      };

      const result = calculator.calculateImpact(trade);

      expect(result.actualImpact).toBeCloseTo(0.02, 10);
      expect(result.absoluteImpact).toBeCloseTo(0.02, 10);
      expect(result.impactBps).toBe(200);
      expect(result.trade).toBe(trade);
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should calculate slippage when expectedPrice is provided", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-2",
        marketId: "market-1",
        walletAddress: "0x1234567890abcdef",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.52,
        expectedPrice: 0.51,
      };

      const result = calculator.calculateImpact(trade);

      expect(result.slippage).toBeCloseTo(0.01, 10); // 0.52 - 0.51
      expect(result.slippageBps).toBe(100);
    });

    it("should return zero slippage when no expectedPrice", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-3",
        marketId: "market-1",
        walletAddress: "0x1234567890abcdef",
        direction: TradeDirection.SELL,
        sizeUsd: 5000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.48,
      };

      const result = calculator.calculateImpact(trade);

      expect(result.slippage).toBe(0);
      expect(result.slippageBps).toBe(0);
    });

    it("should correctly classify severity levels", () => {
      const baseTrade: Omit<ImpactTradeData, "tradeId" | "priceAfter"> = {
        marketId: "market-1",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 1000,
        timestamp: Date.now(),
        priceBefore: 0.5,
      };

      // Negligible: < 50 bps (0.5%)
      const negligible = calculator.calculateImpact({
        ...baseTrade,
        tradeId: "t1",
        priceAfter: 0.502, // 20 bps
      });
      expect(negligible.severity).toBe(ImpactSeverity.NEGLIGIBLE);

      // Low: 50-99 bps
      const low = calculator.calculateImpact({
        ...baseTrade,
        tradeId: "t2",
        priceAfter: 0.507, // 70 bps
      });
      expect(low.severity).toBe(ImpactSeverity.LOW);

      // Medium: 100-199 bps
      const medium = calculator.calculateImpact({
        ...baseTrade,
        tradeId: "t3",
        priceAfter: 0.515, // 150 bps
      });
      expect(medium.severity).toBe(ImpactSeverity.MEDIUM);

      // High: 200-499 bps
      const high = calculator.calculateImpact({
        ...baseTrade,
        tradeId: "t4",
        priceAfter: 0.53, // 300 bps
      });
      expect(high.severity).toBe(ImpactSeverity.HIGH);

      // Extreme: >= 500 bps
      const extreme = calculator.calculateImpact({
        ...baseTrade,
        tradeId: "t5",
        priceAfter: 0.56, // 600 bps
      });
      expect(extreme.severity).toBe(ImpactSeverity.EXTREME);
    });

    it("should calculate expected impact using liquidity data", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-liq",
        marketId: "market-liq",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000, // 10% of depth
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55, // 5% move
      };

      const liquidity: MarketLiquidityData = {
        marketId: "market-liq",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 500000,
        timestamp: Date.now(),
      };

      const result = calculator.calculateImpact(trade, { liquidity });

      expect(result.expectedImpact).toBeGreaterThan(0);
      expect(result.impactRatio).toBeGreaterThan(0);
      expect(result.context.hasLiquidityData).toBe(true);
      expect(result.context.sizePercentOfDepth).toBe(10); // 10000/100000 * 100
      expect(result.context.sizePercentOfDailyVolume).toBe(2); // 10000/500000 * 100
    });

    it("should detect excessive impact", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-excessive",
        marketId: "market-excessive",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 1000, // Small trade
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.6, // 10% move - excessive for small trade
      };

      const liquidity: MarketLiquidityData = {
        marketId: "market-excessive",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 500000,
        timestamp: Date.now(),
      };

      const result = calculator.calculateImpact(trade, { liquidity });

      expect(result.impactBps).toBe(1000);
      expect(result.isExcessive).toBe(true);
      expect(result.anomalyType).toBe(ImpactAnomalyType.EXCESSIVE_IMPACT);
      expect(result.isAnomaly).toBe(true);
    });

    it("should detect muted impact", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-muted",
        marketId: "market-muted",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 50000, // Large trade (50% of depth)
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.505, // Only 50 bps move - muted
      };

      const liquidity: MarketLiquidityData = {
        marketId: "market-muted",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 200000,
        timestamp: Date.now(),
      };

      const result = calculator.calculateImpact(trade, { liquidity });

      // Expected impact should be much higher for 50% of depth
      // But actual is only 50 bps, so muted
      expect(result.anomalyType).toBe(ImpactAnomalyType.MUTED_IMPACT);
    });

    it("should handle negative impact (sells)", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-sell",
        marketId: "market-sell",
        walletAddress: "0xtest",
        direction: TradeDirection.SELL,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.48, // Price dropped
      };

      const result = calculator.calculateImpact(trade);

      expect(result.actualImpact).toBeCloseTo(-0.02, 10);
      expect(result.absoluteImpact).toBeCloseTo(0.02, 10);
      expect(result.impactBps).toBe(200);
    });

    it("should classify liquidity levels correctly", () => {
      const trade: ImpactTradeData = {
        tradeId: "trade-liq-level",
        marketId: "market-test",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 1000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.51,
      };

      // Very low liquidity
      const veryLow = calculator.calculateImpact(trade, {
        liquidity: {
          marketId: "market-test",
          totalDepth: 5000,
          bidDepth: 2500,
          askDepth: 2500,
          bestBid: 0.49,
          bestAsk: 0.51,
          spreadBps: 200,
          avgDailyVolume: 100000,
          timestamp: Date.now(),
        },
      });
      expect(veryLow.context.liquidityLevel).toBe(LiquidityLevel.VERY_LOW);

      // Very high liquidity
      const veryHigh = calculator.calculateImpact(trade, {
        liquidity: {
          marketId: "market-test",
          totalDepth: 2000000,
          bidDepth: 1000000,
          askDepth: 1000000,
          bestBid: 0.49,
          bestAsk: 0.51,
          spreadBps: 200,
          avgDailyVolume: 1000000,
          timestamp: Date.now(),
        },
      });
      expect(veryHigh.context.liquidityLevel).toBe(LiquidityLevel.VERY_HIGH);
    });
  });

  describe("batchCalculateImpact", () => {
    it("should process multiple trades", () => {
      const trades: ImpactTradeData[] = [
        {
          tradeId: "batch-1",
          marketId: "market-1",
          walletAddress: "0xtest1",
          direction: TradeDirection.BUY,
          sizeUsd: 5000,
          timestamp: Date.now() - 1000,
          priceBefore: 0.5,
          priceAfter: 0.52,
        },
        {
          tradeId: "batch-2",
          marketId: "market-1",
          walletAddress: "0xtest2",
          direction: TradeDirection.SELL,
          sizeUsd: 3000,
          timestamp: Date.now(),
          priceBefore: 0.52,
          priceAfter: 0.51,
        },
      ];

      const result = calculator.batchCalculateImpact(trades);

      expect(result.results.size).toBe(2);
      expect(result.summary.totalAnalyzed).toBe(2);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should aggregate statistics correctly", () => {
      const trades: ImpactTradeData[] = [
        {
          tradeId: "agg-1",
          marketId: "market-1",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 1000,
          timestamp: Date.now() - 2000,
          priceBefore: 0.5,
          priceAfter: 0.505, // 50 bps - LOW
        },
        {
          tradeId: "agg-2",
          marketId: "market-1",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 1000,
          timestamp: Date.now() - 1000,
          priceBefore: 0.505,
          priceAfter: 0.52, // 150 bps - MEDIUM
        },
        {
          tradeId: "agg-3",
          marketId: "market-1",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 1000,
          timestamp: Date.now(),
          priceBefore: 0.52,
          priceAfter: 0.55, // 300 bps - HIGH
        },
      ];

      const result = calculator.batchCalculateImpact(trades);

      expect(result.summary.bySeverity[ImpactSeverity.LOW]).toBe(1);
      expect(result.summary.bySeverity[ImpactSeverity.MEDIUM]).toBe(1);
      expect(result.summary.bySeverity[ImpactSeverity.HIGH]).toBe(1);
      expect(result.summary.averageImpactBps).toBeCloseTo(
        (50 + 150 + 300) / 3,
        0
      );
    });
  });

  describe("updateLiquidityData", () => {
    it("should cache liquidity data for a market", () => {
      const liquidity: MarketLiquidityData = {
        marketId: "market-cache",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 500000,
        timestamp: Date.now(),
      };

      calculator.updateLiquidityData(liquidity);
      const cached = calculator.getLiquidityData("market-cache");

      expect(cached).toEqual(liquidity);
    });

    it("should use cached liquidity when not provided in options", () => {
      const liquidity: MarketLiquidityData = {
        marketId: "market-cached-use",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 500000,
        timestamp: Date.now(),
      };

      calculator.updateLiquidityData(liquidity);

      const trade: ImpactTradeData = {
        tradeId: "trade-cached",
        marketId: "market-cached-use",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.52,
      };

      const result = calculator.calculateImpact(trade);

      expect(result.context.hasLiquidityData).toBe(true);
      expect(result.context.sizePercentOfDepth).toBe(10);
    });
  });

  describe("event emission", () => {
    it("should emit highImpact event for significant trades", () => {
      const eventHandler = vi.fn();
      calculator.on("highImpact", eventHandler);

      const trade: ImpactTradeData = {
        tradeId: "trade-event",
        marketId: "market-event",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55, // 500 bps - EXTREME
      };

      calculator.calculateImpact(trade);

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0]?.[0] as HighImpactEvent;
      expect(event).toBeDefined();
      expect(event.trade.tradeId).toBe("trade-event");
      expect(event.severity).toBe(ImpactSeverity.EXTREME);
    });

    it("should emit excessiveImpact event for excessive trades", () => {
      const eventHandler = vi.fn();
      calculator.on("excessiveImpact", eventHandler);

      const trade: ImpactTradeData = {
        tradeId: "trade-excessive-event",
        marketId: "market-excessive-event",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 500, // Tiny trade
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.6, // 1000 bps move - excessive
      };

      const liquidity: MarketLiquidityData = {
        marketId: "market-excessive-event",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 500000,
        timestamp: Date.now(),
      };

      calculator.calculateImpact(trade, { liquidity });

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should respect alert cooldown", () => {
      const eventHandler = vi.fn();
      calculator.on("highImpact", eventHandler);

      const baseTrade: Omit<ImpactTradeData, "tradeId" | "timestamp"> = {
        marketId: "market-cooldown",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        priceBefore: 0.5,
        priceAfter: 0.55, // EXTREME
      };

      // First trade should emit
      calculator.calculateImpact({
        ...baseTrade,
        tradeId: "cooldown-1",
        timestamp: Date.now(),
      });
      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Second trade within cooldown should not emit
      calculator.calculateImpact({
        ...baseTrade,
        tradeId: "cooldown-2",
        timestamp: Date.now() + 1000, // 1 second later
      });
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it("should allow bypassing cooldown", () => {
      const eventHandler = vi.fn();
      calculator.on("highImpact", eventHandler);

      const baseTrade: Omit<ImpactTradeData, "tradeId" | "timestamp"> = {
        marketId: "market-bypass",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        priceBefore: 0.5,
        priceAfter: 0.55,
      };

      calculator.calculateImpact({
        ...baseTrade,
        tradeId: "bypass-1",
        timestamp: Date.now(),
      });

      calculator.calculateImpact(
        {
          ...baseTrade,
          tradeId: "bypass-2",
          timestamp: Date.now() + 1000,
        },
        { bypassCooldown: true }
      );

      expect(eventHandler).toHaveBeenCalledTimes(2);
    });

    it("should not emit events when disabled", () => {
      const silentCalculator = createMarketImpactCalculator({
        enableEvents: false,
      });
      const eventHandler = vi.fn();
      silentCalculator.on("highImpact", eventHandler);

      const trade: ImpactTradeData = {
        tradeId: "silent-trade",
        marketId: "market-silent",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55,
      };

      silentCalculator.calculateImpact(trade);

      expect(eventHandler).not.toHaveBeenCalled();
      silentCalculator.clearAll();
    });
  });

  describe("getRecentEvents", () => {
    it("should return recent high impact events", () => {
      const trade: ImpactTradeData = {
        tradeId: "recent-event",
        marketId: "market-recent",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55, // EXTREME
      };

      calculator.calculateImpact(trade);
      const events = calculator.getRecentEvents();

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.trade.tradeId).toBe("recent-event");
    });

    it("should respect limit parameter", () => {
      // Create multiple high impact trades
      for (let i = 0; i < 5; i++) {
        calculator.calculateImpact(
          {
            tradeId: `limit-${i}`,
            marketId: `market-limit-${i}`, // Different markets to avoid cooldown
            walletAddress: "0xtest",
            direction: TradeDirection.BUY,
            sizeUsd: 10000,
            timestamp: Date.now() + i,
            priceBefore: 0.5,
            priceAfter: 0.55,
          },
          { bypassCooldown: true }
        );
      }

      const events = calculator.getRecentEvents(3);
      expect(events.length).toBe(3);
    });
  });

  describe("getMarketEvents and getWalletEvents", () => {
    it("should filter events by market", () => {
      calculator.calculateImpact(
        {
          tradeId: "market-filter-1",
          marketId: "target-market",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now(),
          priceBefore: 0.5,
          priceAfter: 0.55,
        },
        { bypassCooldown: true }
      );

      calculator.calculateImpact(
        {
          tradeId: "market-filter-2",
          marketId: "other-market",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now() + 1,
          priceBefore: 0.5,
          priceAfter: 0.55,
        },
        { bypassCooldown: true }
      );

      const targetEvents = calculator.getMarketEvents("target-market");
      expect(targetEvents.length).toBe(1);
      expect(targetEvents[0]?.trade.marketId).toBe("target-market");
    });

    it("should filter events by wallet", () => {
      calculator.calculateImpact(
        {
          tradeId: "wallet-filter-1",
          marketId: "market-w1",
          walletAddress: "0xTARGET",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now(),
          priceBefore: 0.5,
          priceAfter: 0.55,
        },
        { bypassCooldown: true }
      );

      calculator.calculateImpact(
        {
          tradeId: "wallet-filter-2",
          marketId: "market-w2",
          walletAddress: "0xother",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now() + 1,
          priceBefore: 0.5,
          priceAfter: 0.55,
        },
        { bypassCooldown: true }
      );

      const targetEvents = calculator.getWalletEvents("0xtarget"); // Case insensitive
      expect(targetEvents.length).toBe(1);
    });
  });

  describe("getSummary", () => {
    it("should provide comprehensive summary", () => {
      calculator.calculateImpact(
        {
          tradeId: "summary-1",
          marketId: "market-summary",
          walletAddress: "0xsummary",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now(),
          priceBefore: 0.5,
          priceAfter: 0.55,
        },
        { bypassCooldown: true }
      );

      const summary = calculator.getSummary();

      expect(summary.totalMarkets).toBeGreaterThan(0);
      expect(summary.totalWallets).toBeGreaterThan(0);
      expect(summary.totalHighImpactEvents).toBeGreaterThan(0);
      expect(summary.bySeverity).toBeDefined();
      expect(summary.byAnomalyType).toBeDefined();
      expect(summary.recentEvents.length).toBeGreaterThan(0);
    });
  });

  describe("getStats and getThresholds", () => {
    it("should return current statistics", () => {
      const stats = calculator.getStats();

      expect(stats.trackedMarkets).toBeGreaterThanOrEqual(0);
      expect(stats.trackedWallets).toBeGreaterThanOrEqual(0);
      expect(stats.alertCooldownMs).toBe(60000);
    });

    it("should return threshold configuration", () => {
      const thresholds = calculator.getThresholds();

      expect(thresholds).toEqual(DEFAULT_IMPACT_SEVERITY_THRESHOLDS);
    });

    it("should return excessive thresholds", () => {
      const thresholds = calculator.getExcessiveThresholds();

      expect(thresholds).toEqual(DEFAULT_EXCESSIVE_THRESHOLDS);
    });
  });

  describe("clear methods", () => {
    it("should clear market state", () => {
      const trade: ImpactTradeData = {
        tradeId: "clear-market",
        marketId: "market-to-clear",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55,
      };

      calculator.calculateImpact(trade);
      expect(calculator.getStats().trackedMarkets).toBeGreaterThan(0);

      calculator.clearMarket("market-to-clear");
      expect(calculator.getLiquidityData("market-to-clear")).toBeNull();
    });

    it("should clear wallet state", () => {
      const trade: ImpactTradeData = {
        tradeId: "clear-wallet",
        marketId: "market-cw",
        walletAddress: "0xWalletToClear",
        direction: TradeDirection.BUY,
        sizeUsd: 10000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55,
      };

      calculator.calculateImpact(trade);
      expect(calculator.getStats().trackedWallets).toBeGreaterThan(0);

      const cleared = calculator.clearWallet("0xwallettoclear"); // Case insensitive
      expect(cleared).toBe(true);
    });

    it("should clear all state", () => {
      calculator.calculateImpact(
        {
          tradeId: "clear-all",
          marketId: "market-ca",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now(),
          priceBefore: 0.5,
          priceAfter: 0.55,
        },
        { bypassCooldown: true }
      );

      calculator.clearAll();

      const stats = calculator.getStats();
      expect(stats.trackedMarkets).toBe(0);
      expect(stats.trackedWallets).toBe(0);
      expect(stats.totalHighImpactEvents).toBe(0);
      expect(stats.recentEventsCount).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should allow custom severity thresholds", () => {
      const customCalc = createMarketImpactCalculator({
        severityThresholds: {
          lowThresholdBps: 100, // More sensitive
          mediumThresholdBps: 150,
          highThresholdBps: 250,
          extremeThresholdBps: 400,
        },
      });

      // 80 bps would normally be LOW, but with custom thresholds it's NEGLIGIBLE
      const result = customCalc.calculateImpact({
        tradeId: "custom-thresh",
        marketId: "market-custom",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 1000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.508, // 80 bps
      });

      expect(result.severity).toBe(ImpactSeverity.NEGLIGIBLE);

      customCalc.clearAll();
    });

    it("should allow custom impact model coefficient", () => {
      const customCalc = createMarketImpactCalculator({
        impactModelCoefficient: 20, // More sensitive model
      });

      const liquidity: MarketLiquidityData = {
        marketId: "market-model",
        totalDepth: 100000,
        bidDepth: 50000,
        askDepth: 50000,
        bestBid: 0.49,
        bestAsk: 0.51,
        spreadBps: 200,
        avgDailyVolume: 500000,
        timestamp: Date.now(),
      };

      const result = customCalc.calculateImpact(
        {
          tradeId: "model-coef",
          marketId: "market-model",
          walletAddress: "0xtest",
          direction: TradeDirection.BUY,
          sizeUsd: 10000,
          timestamp: Date.now(),
          priceBefore: 0.5,
          priceAfter: 0.52,
        },
        { liquidity }
      );

      // Expected impact should be higher with coefficient 20 vs default 10
      expect(result.expectedImpact).toBeGreaterThan(0);

      customCalc.clearAll();
    });
  });
});

describe("Convenience Functions", () => {
  afterEach(() => {
    resetSharedMarketImpactCalculator();
  });

  it("calculateMarketImpact should work with shared instance", () => {
    const trade: ImpactTradeData = {
      tradeId: "conv-1",
      marketId: "market-conv",
      walletAddress: "0xconv",
      direction: TradeDirection.BUY,
      sizeUsd: 5000,
      timestamp: Date.now(),
      priceBefore: 0.5,
      priceAfter: 0.52,
    };

    const result = calculateMarketImpact(trade);

    expect(result.impactBps).toBe(200);
    expect(result.severity).toBe(ImpactSeverity.HIGH);
  });

  it("batchCalculateMarketImpact should process batch", () => {
    const trades: ImpactTradeData[] = [
      {
        tradeId: "batch-conv-1",
        marketId: "market-bc",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 5000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.51,
      },
      {
        tradeId: "batch-conv-2",
        marketId: "market-bc",
        walletAddress: "0xtest",
        direction: TradeDirection.BUY,
        sizeUsd: 5000,
        timestamp: Date.now() + 1000,
        priceBefore: 0.51,
        priceAfter: 0.52,
      },
    ];

    const result = batchCalculateMarketImpact(trades);

    expect(result.results.size).toBe(2);
    expect(result.summary.totalAnalyzed).toBe(2);
  });

  it("hasExcessiveImpact should return boolean", () => {
    const trade: ImpactTradeData = {
      tradeId: "excessive-conv",
      marketId: "market-exc-conv",
      walletAddress: "0xtest",
      direction: TradeDirection.BUY,
      sizeUsd: 100, // Tiny trade
      timestamp: Date.now(),
      priceBefore: 0.5,
      priceAfter: 0.6, // Huge move
    };

    const liquidity: MarketLiquidityData = {
      marketId: "market-exc-conv",
      totalDepth: 100000,
      bidDepth: 50000,
      askDepth: 50000,
      bestBid: 0.49,
      bestAsk: 0.51,
      spreadBps: 200,
      avgDailyVolume: 500000,
      timestamp: Date.now(),
    };

    const isExcessive = hasExcessiveImpact(trade, { liquidity });

    expect(typeof isExcessive).toBe("boolean");
    expect(isExcessive).toBe(true);
  });

  it("getTradeImpactSeverity should return severity", () => {
    const trade: ImpactTradeData = {
      tradeId: "severity-conv",
      marketId: "market-sev-conv",
      walletAddress: "0xtest",
      direction: TradeDirection.BUY,
      sizeUsd: 5000,
      timestamp: Date.now(),
      priceBefore: 0.5,
      priceAfter: 0.515, // 150 bps
    };

    const severity = getTradeImpactSeverity(trade);

    expect(severity).toBe(ImpactSeverity.MEDIUM);
  });

  it("getRecentHighImpactEvents should return array", () => {
    // Create a high impact trade first
    calculateMarketImpact({
      tradeId: "recent-conv",
      marketId: "market-recent-conv",
      walletAddress: "0xtest",
      direction: TradeDirection.BUY,
      sizeUsd: 10000,
      timestamp: Date.now(),
      priceBefore: 0.5,
      priceAfter: 0.55,
    });

    const events = getRecentHighImpactEvents();

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("getMarketImpactSummary should return summary", () => {
    const summary = getMarketImpactSummary();

    expect(summary.totalMarkets).toBeGreaterThanOrEqual(0);
    expect(summary.bySeverity).toBeDefined();
    expect(summary.byAnomalyType).toBeDefined();
  });

  it("getSharedMarketImpactCalculator should return singleton", () => {
    const calc1 = getSharedMarketImpactCalculator();
    const calc2 = getSharedMarketImpactCalculator();

    expect(calc1).toBe(calc2);
  });
});
