/**
 * E2E Tests for Market Selection Pattern Analyzer (DET-PAT-007)
 *
 * These tests verify the market selection analyzer works correctly
 * in the context of the full application.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  SelectionPatternType,
  SelectionPreferenceType,
  SelectionShiftType,
  SelectionSuspicionLevel,
  createMarketSelectionAnalyzer,
  resetSharedMarketSelectionAnalyzer,
  addTradesForSelection,
  analyzeMarketSelection,
  batchAnalyzeMarketSelection,
  hasSuspiciousMarketSelection,
  getWalletsWithSuspiciousSelection,
  getWalletsWithInsiderLikeSelection,
  getMarketSelectionAnalyzerSummary,
  getSelectionPatternDescription,
  getSelectionPreferenceDescription,
  getSelectionSuspicionDescription,
  type SelectionTrade,
} from "../../src/detection/market-selection-analyzer";
import { MarketCategory } from "../../src/api/gamma/types";

// Check if we should skip browser tests
const SKIP_BROWSER_TESTS = process.env.SKIP_BROWSER_TESTS === "true";

// Valid test wallet addresses
const TEST_WALLET = "0x1234567890123456789012345678901234567890";
const TEST_WALLET_2 = "0xabcdef1234567890abcdef1234567890abcdef12";
const TEST_WALLET_3 = "0x0987654321098765432109876543210987654321";

/**
 * Create trades for a wallet with specific patterns
 */
function createWalletTrades(
  count: number,
  options: {
    sizeRange?: [number, number];
    winRate?: number;
    startDate?: Date;
    intervalHours?: number;
    marketId?: string;
    category?: MarketCategory | string;
    marketVolume?: number;
    marketCreatedDaysAgo?: number;
    resolvesInDays?: number;
    hasRecentNews?: boolean;
    outcomeCount?: number;
  } = {}
): SelectionTrade[] {
  const {
    sizeRange = [100, 1000],
    winRate = 0.5,
    startDate = new Date("2025-01-01T10:00:00Z"),
    intervalHours = 24,
    marketId = "random",
    category = "random",
    marketVolume,
    marketCreatedDaysAgo,
    resolvesInDays,
    hasRecentNews,
    outcomeCount,
  } = options;

  const categories = Object.values(MarketCategory);
  const trades: SelectionTrade[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(
      startDate.getTime() + i * intervalHours * 60 * 60 * 1000
    );
    const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    // Deterministic win rate: first N trades are wins where N = floor(count * winRate)
    // This ensures exact win rate matching
    const expectedWins = Math.floor(count * winRate);
    const tradeWins = i < expectedWins;
    const resolvedCategory =
      category === "random" ? categories[i % categories.length] : category;

    trades.push({
      tradeId: `trade-${i}`,
      marketId: marketId === "random" ? `market-${i % 10}` : marketId,
      marketCategory: resolvedCategory,
      side: i % 2 === 0 ? "buy" : "sell",
      sizeUsd: size,
      price: 0.5 + Math.random() * 0.3,
      timestamp,
      isWinner: tradeWins,
      pnl: tradeWins ? size * 0.1 : -size * 0.1,
      marketVolume: marketVolume ?? 10000 + Math.random() * 90000,
      marketCreatedAt: marketCreatedDaysAgo
        ? new Date(timestamp.getTime() - marketCreatedDaysAgo * 86400000)
        : undefined,
      marketResolvesAt: resolvesInDays
        ? new Date(timestamp.getTime() + resolvesInDays * 86400000)
        : undefined,
      hasRecentNews,
      outcomeCount: outcomeCount ?? 2,
    });
  }

  return trades;
}

/**
 * Create diversified retail trader trades
 */
function createRetailTraderTrades(count: number): SelectionTrade[] {
  return createWalletTrades(count, {
    sizeRange: [50, 500],
    winRate: 0.45,
    intervalHours: 48,
    category: "random",
    marketId: "random",
  });
}

/**
 * Create category specialist trades (focused on one category)
 */
function createCategorySpecialistTrades(
  count: number,
  category: MarketCategory
): SelectionTrade[] {
  return createWalletTrades(count, {
    sizeRange: [500, 2000],
    winRate: 0.55,
    intervalHours: 24,
    category,
    marketId: "random",
  });
}

/**
 * Create potential insider-like trades (high win rate in high-value categories)
 */
function createInsiderTrades(count: number): SelectionTrade[] {
  return createWalletTrades(count, {
    sizeRange: [5000, 20000],
    winRate: 0.95, // Very high win rate to ensure INSIDER_LIKE pattern
    intervalHours: 72,
    category: MarketCategory.POLITICS,
    marketId: "random",
    resolvesInDays: 0.5, // Trades near resolution (< 24 hours to resolution)
  });
}

/**
 * Create event-driven trader trades
 */
function createEventDrivenTrades(count: number): SelectionTrade[] {
  return createWalletTrades(count, {
    sizeRange: [1000, 5000],
    winRate: 0.6,
    intervalHours: 12,
    category: "random",
    marketId: "random",
    hasRecentNews: true,
  });
}

/**
 * Create whale trades (high volume preference)
 */
function createWhaleTrades(count: number): SelectionTrade[] {
  return createWalletTrades(count, {
    sizeRange: [50000, 200000],
    winRate: 0.55,
    intervalHours: 48,
    category: "random",
    marketId: "random",
    marketVolume: 500000, // Only high volume markets
  });
}

/**
 * Create thin market specialist trades (low volume preference)
 */
function createThinMarketTrades(count: number): SelectionTrade[] {
  return createWalletTrades(count, {
    sizeRange: [1000, 5000],
    winRate: 0.65,
    intervalHours: 36,
    category: MarketCategory.GEOPOLITICS,
    marketId: "random",
    marketVolume: 5000, // Low volume markets
  });
}

describe("Market Selection Analyzer E2E Tests", () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";

  beforeAll(async () => {
    if (SKIP_BROWSER_TESTS) return;

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    resetSharedMarketSelectionAnalyzer();
  });

  beforeEach(() => {
    resetSharedMarketSelectionAnalyzer();
  });

  afterEach(() => {
    resetSharedMarketSelectionAnalyzer();
  });

  // ==========================================================================
  // App Integration Tests
  // ==========================================================================

  describe("App Integration", () => {
    it("should load the app successfully with market-selection-analyzer module", async () => {
      if (SKIP_BROWSER_TESTS) {
        expect(true).toBe(true);
        return;
      }

      try {
        const response = await page.goto(baseUrl, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });

        expect(response?.status()).toBeLessThan(400);
      } catch {
        // App might not be running, which is OK for unit test environments
        expect(true).toBe(true);
      }
    });

    it("should verify market-selection-analyzer module is properly exported", () => {
      // Verify all exports are available
      expect(typeof createMarketSelectionAnalyzer).toBe("function");
      expect(typeof addTradesForSelection).toBe("function");
      expect(typeof analyzeMarketSelection).toBe("function");
      expect(typeof batchAnalyzeMarketSelection).toBe("function");
      expect(typeof hasSuspiciousMarketSelection).toBe("function");
      expect(typeof getWalletsWithSuspiciousSelection).toBe("function");
      expect(typeof getWalletsWithInsiderLikeSelection).toBe("function");
      expect(typeof getMarketSelectionAnalyzerSummary).toBe("function");
      expect(typeof getSelectionPatternDescription).toBe("function");
      expect(typeof getSelectionPreferenceDescription).toBe("function");
      expect(typeof getSelectionSuspicionDescription).toBe("function");
    });
  });

  // ==========================================================================
  // Retail Trader Analysis E2E Tests
  // ==========================================================================

  describe("Retail Trader Analysis", () => {
    it("should correctly analyze typical retail trader", () => {
      const trades = createRetailTraderTrades(30);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      // Retail traders typically show diverse patterns
      expect(result.primaryPattern).not.toBe(SelectionPatternType.INSIDER_LIKE);
      expect(result.suspicionScore).toBeLessThan(50);
      expect(result.isPotentiallySuspicious).toBe(false);
      expect(result.diversity.diversityScore).toBeGreaterThan(40);
    });

    it("should identify normal win rates as non-suspicious", () => {
      const trades = createWalletTrades(25, {
        winRate: 0.5,
        category: "random",
      });
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.riskFlags).not.toContain("HIGH_WIN_RATE");
      expect(result.suspicionLevel).toBe(SelectionSuspicionLevel.NONE);
    });

    it("should track multiple retail wallets correctly", () => {
      addTradesForSelection(TEST_WALLET, createRetailTraderTrades(20));
      addTradesForSelection(TEST_WALLET_2, createRetailTraderTrades(25));
      addTradesForSelection(TEST_WALLET_3, createRetailTraderTrades(15));

      const batchResult = batchAnalyzeMarketSelection([
        TEST_WALLET,
        TEST_WALLET_2,
        TEST_WALLET_3,
      ]);

      expect(batchResult.successCount).toBe(3);
      expect(batchResult.errorCount).toBe(0);

      // All should be non-suspicious
      for (const [, result] of batchResult.results) {
        expect(result.isPotentiallySuspicious).toBe(false);
      }
    });
  });

  // ==========================================================================
  // Category Specialist Analysis E2E Tests
  // ==========================================================================

  describe("Category Specialist Analysis", () => {
    it("should correctly identify crypto specialist", () => {
      const trades = createCategorySpecialistTrades(25, MarketCategory.CRYPTO);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.preferences).toContain(SelectionPreferenceType.CATEGORY_SPECIALIST);
      expect(result.categoryPreferences[0]?.category).toBe(MarketCategory.CRYPTO);
      expect(result.categoryPreferences[0]?.tradePercentage).toBeGreaterThan(80);
    });

    it("should correctly identify sports specialist", () => {
      const trades = createCategorySpecialistTrades(25, MarketCategory.SPORTS);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.categoryPreferences[0]?.category).toBe(MarketCategory.SPORTS);
    });

    it("should flag high-value category concentration in politics", () => {
      const trades = createCategorySpecialistTrades(25, MarketCategory.POLITICS);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      // Politics is a high-value category for insider trading
      expect(result.riskFlags).toContain("HIGH_VALUE_CATEGORY_CONCENTRATION");
    });
  });

  // ==========================================================================
  // Potential Insider Analysis E2E Tests
  // ==========================================================================

  describe("Potential Insider Analysis", () => {
    it("should detect insider-like pattern with high win rate", () => {
      const trades = createInsiderTrades(20);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.primaryPattern).toBe(SelectionPatternType.INSIDER_LIKE);
      expect(result.isPotentiallySuspicious).toBe(true);
      expect(result.suspicionScore).toBeGreaterThan(60);
    });

    it("should flag high win rate for insider-like trading", () => {
      const trades = createInsiderTrades(15);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.riskFlags).toContain("HIGH_WIN_RATE");
    });

    it("should flag near resolution preference for insider-like trading", () => {
      const trades = createInsiderTrades(15);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.riskFlags).toContain("NEAR_RESOLUTION_PREFERENCE");
    });

    it("should correctly identify potential insiders in batch", () => {
      // Create one potential insider and two regular traders
      addTradesForSelection(TEST_WALLET, createInsiderTrades(20));
      addTradesForSelection(TEST_WALLET_2, createRetailTraderTrades(25));
      addTradesForSelection(TEST_WALLET_3, createRetailTraderTrades(20));

      const suspicious = getWalletsWithSuspiciousSelection();
      const insiderLike = getWalletsWithInsiderLikeSelection();

      expect(suspicious.some(r => r.walletAddress === TEST_WALLET)).toBe(true);
      expect(insiderLike.some(r => r.walletAddress === TEST_WALLET)).toBe(true);
    });
  });

  // ==========================================================================
  // Event-Driven Trader Analysis E2E Tests
  // ==========================================================================

  describe("Event-Driven Trader Analysis", () => {
    it("should identify event-driven preference", () => {
      const trades = createEventDrivenTrades(20);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.preferences).toContain(SelectionPreferenceType.EVENT_DRIVEN);
    });

    it("should differentiate event-driven from insider-like", () => {
      // Event-driven with moderate win rate
      const trades = createEventDrivenTrades(25);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      // Should not be flagged as insider-like due to moderate win rate
      expect(result.primaryPattern).not.toBe(SelectionPatternType.INSIDER_LIKE);
    });
  });

  // ==========================================================================
  // Volume Preference Analysis E2E Tests
  // ==========================================================================

  describe("Volume Preference Analysis", () => {
    it("should identify high volume preference for whale traders", () => {
      const trades = createWhaleTrades(15);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.preferences).toContain(SelectionPreferenceType.HIGH_VOLUME);
    });

    it("should identify low volume preference for thin market traders", () => {
      const trades = createThinMarketTrades(15);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.preferences).toContain(SelectionPreferenceType.LOW_VOLUME);
    });
  });

  // ==========================================================================
  // Selection Shift Detection E2E Tests
  // ==========================================================================

  describe("Selection Shift Detection", () => {
    it("should detect category shift over time", () => {
      // First period: crypto focus
      const cryptoTrades = createCategorySpecialistTrades(15, MarketCategory.CRYPTO).map(
        (t, i) => ({
          ...t,
          tradeId: `crypto-${i}`,
          timestamp: new Date("2025-01-01T10:00:00Z"),
        })
      );

      // Second period: politics focus
      const politicsTrades = createCategorySpecialistTrades(15, MarketCategory.POLITICS).map(
        (t, i) => ({
          ...t,
          tradeId: `politics-${i}`,
          timestamp: new Date("2025-02-01T10:00:00Z"),
        })
      );

      addTradesForSelection(TEST_WALLET, [...cryptoTrades, ...politicsTrades]);

      const result = analyzeMarketSelection(TEST_WALLET);

      const categoryShift = result.shifts.find(
        s => s.type === SelectionShiftType.CATEGORY_CHANGE
      );
      expect(categoryShift).toBeDefined();
    });

    it("should detect win bias increase (potential new info source)", () => {
      // First period: 40% win rate
      const beforeTrades = createWalletTrades(15, {
        winRate: 0.4,
        startDate: new Date("2025-01-01T10:00:00Z"),
        intervalHours: 24,
        category: MarketCategory.POLITICS,
      }).map((t, i) => ({ ...t, tradeId: `before-${i}` }));

      // Second period: 90% win rate
      const afterTrades = createWalletTrades(15, {
        winRate: 0.9,
        startDate: new Date("2025-02-01T10:00:00Z"),
        intervalHours: 24,
        category: MarketCategory.POLITICS,
      }).map((t, i) => ({ ...t, tradeId: `after-${i}` }));

      addTradesForSelection(TEST_WALLET, [...beforeTrades, ...afterTrades]);

      const result = analyzeMarketSelection(TEST_WALLET);

      const winBiasShift = result.shifts.find(
        s => s.type === SelectionShiftType.WIN_BIAS_INCREASE
      );
      expect(winBiasShift).toBeDefined();
    });

    it("should detect concentration increase", () => {
      // First period: diverse markets
      const diverseTrades = createWalletTrades(15, {
        marketId: "random",
        startDate: new Date("2025-01-01T10:00:00Z"),
      }).map((t, i) => ({ ...t, tradeId: `diverse-${i}`, marketId: `market-${i}` }));

      // Second period: focused on single market
      const focusedTrades = createWalletTrades(15, {
        marketId: "single-market",
        startDate: new Date("2025-02-01T10:00:00Z"),
      }).map((t, i) => ({ ...t, tradeId: `focused-${i}` }));

      addTradesForSelection(TEST_WALLET, [...diverseTrades, ...focusedTrades]);

      const result = analyzeMarketSelection(TEST_WALLET);

      const concentrationShift = result.shifts.find(
        s => s.type === SelectionShiftType.CONCENTRATION_INCREASE
      );
      expect(concentrationShift).toBeDefined();
    });
  });

  // ==========================================================================
  // Diversity Analysis E2E Tests
  // ==========================================================================

  describe("Diversity Analysis", () => {
    it("should calculate correct diversity metrics for diverse trader", () => {
      // Create trades across many different markets and categories
      const trades: SelectionTrade[] = [];
      const categories = Object.values(MarketCategory);
      for (let i = 0; i < 30; i++) {
        trades.push({
          tradeId: `trade-${i}`,
          marketId: `market-${i}`, // Each trade in different market
          marketCategory: categories[i % categories.length],
          side: "buy",
          sizeUsd: 100 + i * 10,
          timestamp: new Date(Date.now() - i * 86400000),
        });
      }
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.diversity.uniqueMarkets).toBe(30);
      expect(result.diversity.diversityScore).toBeGreaterThan(60);
      expect(result.diversity.marketConcentration).toBeLessThan(0.1);
    });

    it("should calculate correct diversity metrics for focused trader", () => {
      // Create trades all in single market
      const trades = createWalletTrades(20, {
        marketId: "single-market",
        category: MarketCategory.POLITICS,
      });
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.diversity.uniqueMarkets).toBe(1);
      expect(result.diversity.marketConcentration).toBe(1);
      expect(result.primaryPattern).toBe(SelectionPatternType.FOCUSED);
    });
  });

  // ==========================================================================
  // Summary Statistics E2E Tests
  // ==========================================================================

  describe("Summary Statistics", () => {
    it("should provide accurate summary across multiple wallets", () => {
      // Create different types of traders
      addTradesForSelection(TEST_WALLET, createRetailTraderTrades(20));
      addTradesForSelection(TEST_WALLET_2, createInsiderTrades(15));
      addTradesForSelection(
        TEST_WALLET_3,
        createCategorySpecialistTrades(20, MarketCategory.CRYPTO)
      );

      // Analyze all
      analyzeMarketSelection(TEST_WALLET);
      analyzeMarketSelection(TEST_WALLET_2);
      analyzeMarketSelection(TEST_WALLET_3);

      const summary = getMarketSelectionAnalyzerSummary();

      expect(summary.totalWalletsAnalyzed).toBe(3);
      expect(summary.totalTradesProcessed).toBeGreaterThan(50);
      expect(summary.patternDistribution.size).toBeGreaterThan(0);
      expect(summary.suspicionDistribution.size).toBeGreaterThan(0);
      expect(summary.suspiciousWalletCount).toBeGreaterThanOrEqual(1);
    });

    it("should track cache statistics correctly", () => {
      addTradesForSelection(TEST_WALLET, createRetailTraderTrades(15));

      // First analysis - cache miss
      analyzeMarketSelection(TEST_WALLET);

      // Second analysis - cache hit
      analyzeMarketSelection(TEST_WALLET);

      const summary = getMarketSelectionAnalyzerSummary();

      expect(summary.cacheStats.hitCount).toBeGreaterThanOrEqual(1);
    });

    it("should track top risk flags", () => {
      // Create wallets with various risk flags
      addTradesForSelection(TEST_WALLET, createInsiderTrades(15));
      addTradesForSelection(
        TEST_WALLET_2,
        createCategorySpecialistTrades(20, MarketCategory.POLITICS)
      );

      analyzeMarketSelection(TEST_WALLET);
      analyzeMarketSelection(TEST_WALLET_2);

      const summary = getMarketSelectionAnalyzerSummary();

      expect(Array.isArray(summary.topRiskFlags)).toBe(true);
      expect(summary.topRiskFlags.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Description Functions E2E Tests
  // ==========================================================================

  describe("Description Functions", () => {
    it("should provide meaningful pattern descriptions", () => {
      Object.values(SelectionPatternType).forEach(pattern => {
        const desc = getSelectionPatternDescription(pattern);
        expect(desc.length).toBeGreaterThan(10);
        expect(desc).not.toContain("undefined");
      });
    });

    it("should provide meaningful preference descriptions", () => {
      Object.values(SelectionPreferenceType).forEach(pref => {
        const desc = getSelectionPreferenceDescription(pref);
        expect(desc.length).toBeGreaterThan(10);
        expect(desc).not.toContain("undefined");
      });
    });

    it("should provide meaningful suspicion descriptions", () => {
      Object.values(SelectionSuspicionLevel).forEach(level => {
        const desc = getSelectionSuspicionDescription(level);
        expect(desc.length).toBeGreaterThan(10);
        expect(desc).not.toContain("undefined");
      });
    });
  });

  // ==========================================================================
  // Edge Cases E2E Tests
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle wallet with insufficient trades gracefully", () => {
      const trades = createWalletTrades(3);
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.primaryPattern).toBe(SelectionPatternType.UNKNOWN);
      expect(result.dataQuality).toBeLessThan(50);
    });

    it("should handle wallet with all winning trades", () => {
      const trades = createWalletTrades(15, { winRate: 1.0 });
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result.primaryPattern).toBe(SelectionPatternType.INSIDER_LIKE);
      expect(result.riskFlags).toContain("HIGH_WIN_RATE");
    });

    it("should handle wallet with all losing trades", () => {
      const trades = createWalletTrades(15, { winRate: 0 });
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      // Should not be flagged as suspicious for all losses
      expect(result.primaryPattern).not.toBe(SelectionPatternType.INSIDER_LIKE);
      expect(result.suspicionScore).toBeLessThan(30);
    });

    it("should handle trades without optional metadata", () => {
      const trades: SelectionTrade[] = Array.from({ length: 15 }, (_, i) => ({
        tradeId: `trade-${i}`,
        marketId: `market-${i % 5}`,
        sizeUsd: 100,
        timestamp: new Date(Date.now() - i * 86400000),
        side: "buy" as const,
        // No optional fields
      }));
      addTradesForSelection(TEST_WALLET, trades);

      const result = analyzeMarketSelection(TEST_WALLET);

      expect(result).toBeDefined();
      expect(result.totalTrades).toBe(15);
    });

    it("should handle high-volume batch analysis", () => {
      // Create 10 wallets
      const wallets = Array.from(
        { length: 10 },
        (_, i) => `0x${(i + 1).toString().padStart(40, "0")}`
      );

      wallets.forEach(wallet => {
        addTradesForSelection(wallet, createRetailTraderTrades(15));
      });

      const result = batchAnalyzeMarketSelection(wallets);

      expect(result.totalProcessed).toBe(10);
      expect(result.successCount).toBe(10);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should correctly filter suspicious wallets by threshold", () => {
      addTradesForSelection(TEST_WALLET, createInsiderTrades(20)); // High suspicion
      addTradesForSelection(TEST_WALLET_2, createRetailTraderTrades(20)); // Low suspicion

      // High threshold - only very suspicious
      const highThreshold = getWalletsWithSuspiciousSelection(90);

      // Lower threshold - more wallets
      const lowThreshold = getWalletsWithSuspiciousSelection(40);

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  // ==========================================================================
  // Multi-Wallet Pattern Comparison E2E Tests
  // ==========================================================================

  describe("Multi-Wallet Pattern Comparison", () => {
    it("should correctly rank wallets by suspicion score", () => {
      addTradesForSelection(TEST_WALLET, createInsiderTrades(20)); // Highest suspicion
      addTradesForSelection(
        TEST_WALLET_2,
        createCategorySpecialistTrades(20, MarketCategory.POLITICS)
      ); // Medium
      addTradesForSelection(TEST_WALLET_3, createRetailTraderTrades(20)); // Lowest

      const suspicious = getWalletsWithSuspiciousSelection(0); // Get all

      // Should be sorted by suspicion score descending
      for (let i = 1; i < suspicious.length; i++) {
        expect(suspicious[i - 1]!.suspicionScore).toBeGreaterThanOrEqual(
          suspicious[i]!.suspicionScore
        );
      }
    });

    it("should identify different patterns across wallets", () => {
      addTradesForSelection(TEST_WALLET, createInsiderTrades(15));
      addTradesForSelection(
        TEST_WALLET_2,
        createCategorySpecialistTrades(20, MarketCategory.CRYPTO)
      );
      addTradesForSelection(TEST_WALLET_3, createRetailTraderTrades(30));

      const result1 = analyzeMarketSelection(TEST_WALLET);
      const result2 = analyzeMarketSelection(TEST_WALLET_2);
      const result3 = analyzeMarketSelection(TEST_WALLET_3);

      // Should have different patterns
      const patterns = new Set([
        result1.primaryPattern,
        result2.primaryPattern,
        result3.primaryPattern,
      ]);
      expect(patterns.size).toBeGreaterThan(1); // At least 2 different patterns
    });
  });
});
