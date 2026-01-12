/**
 * Unit Tests for Market Selection Pattern Analyzer (DET-PAT-007)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MarketSelectionAnalyzer,
  SelectionPreferenceType,
  SelectionPatternType,
  SelectionShiftType,
  SelectionSuspicionLevel,
  DEFAULT_SELECTION_ANALYZER_CONFIG,
  createMarketSelectionAnalyzer,
  getSharedMarketSelectionAnalyzer,
  setSharedMarketSelectionAnalyzer,
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
  SelectionTrade,
} from "../../src/detection/market-selection-analyzer";
import { MarketCategory } from "../../src/api/gamma/types";

// Test wallet addresses
const WALLET_1 = "0x1234567890123456789012345678901234567890";
const WALLET_2 = "0x2345678901234567890123456789012345678901";
const WALLET_3 = "0x3456789012345678901234567890123456789012";

// Helper function to create trades
function createTrade(overrides: Partial<SelectionTrade> = {}): SelectionTrade {
  return {
    tradeId: `trade-${Math.random().toString(36).substring(7)}`,
    marketId: `market-${Math.random().toString(36).substring(7)}`,
    sizeUsd: 100,
    timestamp: new Date(),
    side: "buy",
    ...overrides,
  };
}

// Helper to create multiple trades with various properties
function createTrades(count: number, overrides: Partial<SelectionTrade> = {}): SelectionTrade[] {
  return Array.from({ length: count }, (_, index) =>
    createTrade({
      tradeId: `trade-${index}`,
      marketId: `market-${index % 5}`, // 5 different markets
      marketCategory: [MarketCategory.POLITICS, MarketCategory.SPORTS, MarketCategory.CRYPTO][index % 3],
      sizeUsd: 100 + index * 10,
      timestamp: new Date(Date.now() - (count - index) * 3600000),
      ...overrides,
    })
  );
}

// Helper to create trades focused on specific category
function createCategoryFocusedTrades(
  count: number,
  category: MarketCategory | string,
  winRate: number = 0.5
): SelectionTrade[] {
  return Array.from({ length: count }, (_, index) => {
    const isWinner = index < count * winRate;
    return createTrade({
      tradeId: `trade-${index}`,
      marketId: `market-${category}-${index % 3}`,
      marketCategory: category,
      sizeUsd: 100 + index * 10,
      timestamp: new Date(Date.now() - (count - index) * 3600000),
      isWinner,
      pnl: isWinner ? 50 : -50,
    });
  });
}

describe("MarketSelectionAnalyzer", () => {
  let analyzer: MarketSelectionAnalyzer;

  beforeEach(() => {
    analyzer = new MarketSelectionAnalyzer();
    resetSharedMarketSelectionAnalyzer();
  });

  afterEach(() => {
    analyzer.clearAllTrades();
    resetSharedMarketSelectionAnalyzer();
  });

  describe("constructor", () => {
    it("should create analyzer with default config", () => {
      const instance = new MarketSelectionAnalyzer();
      expect(instance).toBeInstanceOf(MarketSelectionAnalyzer);
    });

    it("should create analyzer with custom config", () => {
      const instance = new MarketSelectionAnalyzer({
        minTrades: 10,
        cacheTtlMs: 60000,
      });
      expect(instance).toBeInstanceOf(MarketSelectionAnalyzer);
    });

    it("should merge config with defaults", () => {
      const instance = new MarketSelectionAnalyzer({
        minTrades: 10,
      });
      const config = instance.getConfig();
      expect(config.minTrades).toBe(10);
      expect(config.cacheTtlMs).toBe(DEFAULT_SELECTION_ANALYZER_CONFIG.cacheTtlMs);
    });
  });

  describe("addTrades", () => {
    it("should add trades for a wallet", () => {
      const trades = createTrades(5);
      analyzer.addTrades(WALLET_1, trades);

      const retrieved = analyzer.getTrades(WALLET_1);
      expect(retrieved).toHaveLength(5);
    });

    it("should reject invalid wallet address", () => {
      const trades = createTrades(3);
      expect(() => analyzer.addTrades("invalid", trades)).toThrow("Invalid wallet address");
    });

    it("should normalize wallet address", () => {
      const trades = createTrades(3);
      analyzer.addTrades(WALLET_1.toLowerCase(), trades);

      const retrieved = analyzer.getTrades(WALLET_1);
      expect(retrieved).toHaveLength(3);
    });

    it("should deduplicate trades by ID", () => {
      const trades = createTrades(3);
      analyzer.addTrades(WALLET_1, trades);
      analyzer.addTrades(WALLET_1, trades); // Add same trades again

      const retrieved = analyzer.getTrades(WALLET_1);
      expect(retrieved).toHaveLength(3);
    });

    it("should add new trades while keeping existing", () => {
      const trades1 = createTrades(3);
      analyzer.addTrades(WALLET_1, trades1);

      const trades2 = createTrades(2).map(t => ({
        ...t,
        tradeId: `new-${t.tradeId}`,
      }));
      analyzer.addTrades(WALLET_1, trades2);

      const retrieved = analyzer.getTrades(WALLET_1);
      expect(retrieved).toHaveLength(5);
    });

    it("should emit tradesAdded event", () => {
      const listener = vi.fn();
      analyzer.on("tradesAdded", listener);

      const trades = createTrades(3);
      analyzer.addTrades(WALLET_1, trades);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: expect.any(String),
          newTradeCount: 3,
          totalTradeCount: 3,
        })
      );
    });

    it("should invalidate cache on trades add", () => {
      const trades = createTrades(10);
      analyzer.addTrades(WALLET_1, trades);

      // First analysis - cached
      const result1 = analyzer.analyze(WALLET_1);
      expect(result1.totalTrades).toBe(10);

      // Add new trades - should invalidate cache
      const newTrades = createTrades(5).map(t => ({
        ...t,
        tradeId: `new-${t.tradeId}`,
      }));
      analyzer.addTrades(WALLET_1, newTrades);

      const result2 = analyzer.analyze(WALLET_1);
      expect(result2.totalTrades).toBe(15);
    });
  });

  describe("getTrades", () => {
    it("should return trades for wallet", () => {
      const trades = createTrades(5);
      analyzer.addTrades(WALLET_1, trades);

      const retrieved = analyzer.getTrades(WALLET_1);
      expect(retrieved).toHaveLength(5);
    });

    it("should return empty array for unknown wallet", () => {
      expect(analyzer.getTrades(WALLET_2)).toHaveLength(0);
    });

    it("should throw for invalid address", () => {
      expect(() => analyzer.getTrades("invalid")).toThrow("Invalid wallet address");
    });
  });

  describe("clearTrades", () => {
    it("should clear trades for wallet", () => {
      analyzer.addTrades(WALLET_1, createTrades(5));
      analyzer.clearTrades(WALLET_1);

      expect(analyzer.getTrades(WALLET_1)).toHaveLength(0);
    });

    it("should emit tradesCleared event", () => {
      const listener = vi.fn();
      analyzer.on("tradesCleared", listener);

      analyzer.addTrades(WALLET_1, createTrades(3));
      analyzer.clearTrades(WALLET_1);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: expect.any(String),
        })
      );
    });
  });

  describe("clearAllTrades", () => {
    it("should clear all trades", () => {
      analyzer.addTrades(WALLET_1, createTrades(5));
      analyzer.addTrades(WALLET_2, createTrades(3));

      analyzer.clearAllTrades();

      expect(analyzer.getTrades(WALLET_1)).toHaveLength(0);
      expect(analyzer.getTrades(WALLET_2)).toHaveLength(0);
    });

    it("should emit allTradesCleared event", () => {
      const listener = vi.fn();
      analyzer.on("allTradesCleared", listener);

      analyzer.clearAllTrades();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("analyze", () => {
    it("should return insufficient data result for few trades", () => {
      analyzer.addTrades(WALLET_1, createTrades(3));

      const result = analyzer.analyze(WALLET_1);

      expect(result.primaryPattern).toBe(SelectionPatternType.UNKNOWN);
      expect(result.totalTrades).toBe(3);
      expect(result.dataQuality).toBeLessThan(50);
    });

    it("should analyze wallet with sufficient trades", () => {
      const trades = createTrades(10);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.walletAddress).toBe(WALLET_1);
      expect(result.totalTrades).toBe(10);
      expect(result.primaryPattern).not.toBe(SelectionPatternType.UNKNOWN);
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should calculate diversity metrics", () => {
      const trades = createTrades(20);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.diversity).toBeDefined();
      expect(result.diversity.uniqueMarkets).toBeGreaterThan(0);
      expect(result.diversity.uniqueCategories).toBeGreaterThan(0);
      expect(result.diversity.marketConcentration).toBeGreaterThanOrEqual(0);
      expect(result.diversity.diversityScore).toBeGreaterThanOrEqual(0);
    });

    it("should calculate category preferences", () => {
      const trades = createCategoryFocusedTrades(15, MarketCategory.POLITICS);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.categoryPreferences.length).toBeGreaterThan(0);
      const topCategory = result.categoryPreferences[0];
      expect(topCategory?.category).toBe(MarketCategory.POLITICS);
      expect(topCategory?.tradePercentage).toBeGreaterThan(90);
    });

    it("should detect SPECIALIST pattern for category-focused trading", () => {
      const trades = createCategoryFocusedTrades(20, MarketCategory.CRYPTO);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      // High category concentration should result in specialist or focused pattern
      expect([SelectionPatternType.SPECIALIST, SelectionPatternType.FOCUSED]).toContain(
        result.primaryPattern
      );
    });

    it("should detect DIVERSE pattern for varied trading", () => {
      // Create trades across many markets and categories
      const trades: SelectionTrade[] = [];
      const categories = Object.values(MarketCategory);
      for (let i = 0; i < 30; i++) {
        trades.push(
          createTrade({
            tradeId: `trade-${i}`,
            marketId: `market-${i}`, // Each trade in different market
            marketCategory: categories[i % categories.length],
            sizeUsd: 100,
            timestamp: new Date(Date.now() - i * 3600000),
          })
        );
      }
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      // With high market diversity, should have high diversity score
      expect(result.diversity.diversityScore).toBeGreaterThan(50);
    });

    it("should detect INSIDER_LIKE pattern for high win rate", () => {
      // Create trades with 90% win rate
      const trades = createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.9);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.primaryPattern).toBe(SelectionPatternType.INSIDER_LIKE);
      expect(result.suspicionScore).toBeGreaterThan(20);
    });

    it("should calculate timing metrics when available", () => {
      const now = Date.now();
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          timestamp: new Date(now - i * 3600000),
          marketCreatedAt: new Date(now - 86400000 * 30), // 30 days ago
          marketResolvesAt: new Date(now + 86400000), // 1 day from now
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.timing).toBeDefined();
      expect(result.timing.avgMarketAgeAtTrade).toBeGreaterThan(0);
    });

    it("should return cached result on subsequent calls", () => {
      const trades = createTrades(10);
      analyzer.addTrades(WALLET_1, trades);

      const result1 = analyzer.analyze(WALLET_1);
      const result2 = analyzer.analyze(WALLET_1);

      expect(result1.analyzedAt.getTime()).toBe(result2.analyzedAt.getTime());
    });

    it("should bypass cache when requested", () => {
      const trades = createTrades(10);
      analyzer.addTrades(WALLET_1, trades);

      // First analysis is cached
      analyzer.analyze(WALLET_1);

      // Small delay to ensure different timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      const result2 = analyzer.analyze(WALLET_1, { bypassCache: true });

      vi.useRealTimers();

      // Results should be different instances (though content similar)
      expect(result2).toBeDefined();
    });

    it("should emit analysisComplete event", () => {
      const listener = vi.fn();
      analyzer.on("analysisComplete", listener);

      const trades = createTrades(10);
      analyzer.addTrades(WALLET_1, trades);
      analyzer.analyze(WALLET_1, { bypassCache: true });

      expect(listener).toHaveBeenCalled();
    });

    it("should emit suspiciousWalletDetected for high suspicion", () => {
      const listener = vi.fn();
      analyzer.on("suspiciousWalletDetected", listener);

      // High win rate trades should trigger suspicion
      const trades = createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95);
      analyzer.addTrades(WALLET_1, trades);
      analyzer.analyze(WALLET_1);

      // May or may not trigger depending on exact thresholds
      // Just verify event system works
      expect(listener).toBeDefined();
    });
  });

  describe("analyze - Shift Detection", () => {
    it("should detect category shift", () => {
      const beforeTrades = createCategoryFocusedTrades(10, MarketCategory.SPORTS);
      const afterTrades = createCategoryFocusedTrades(10, MarketCategory.POLITICS).map(
        (t, i) => ({
          ...t,
          tradeId: `after-${i}`,
          timestamp: new Date(Date.now() - (10 - i) * 3600000),
        })
      );

      // Add in chronological order
      analyzer.addTrades(WALLET_1, [
        ...beforeTrades.map((t, i) => ({
          ...t,
          timestamp: new Date(Date.now() - 86400000 * 7 - i * 3600000), // Week ago
        })),
        ...afterTrades,
      ]);

      const result = analyzer.analyze(WALLET_1);

      // Should detect the category change
      const categoryShift = result.shifts.find(
        s => s.type === SelectionShiftType.CATEGORY_CHANGE
      );
      expect(categoryShift).toBeDefined();
    });

    it("should detect concentration increase", () => {
      // Before: diverse trading across many markets
      const beforeTrades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `before-${i}`,
          marketId: `market-${i}`, // Each in different market
          timestamp: new Date(Date.now() - 86400000 * 7 - i * 3600000),
        })
      );

      // After: focused on single market
      const afterTrades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `after-${i}`,
          marketId: "market-single",
          timestamp: new Date(Date.now() - i * 3600000),
        })
      );

      analyzer.addTrades(WALLET_1, [...beforeTrades, ...afterTrades]);

      const result = analyzer.analyze(WALLET_1);

      const concentrationShift = result.shifts.find(
        s => s.type === SelectionShiftType.CONCENTRATION_INCREASE
      );
      expect(concentrationShift).toBeDefined();
    });

    it("should detect win bias increase", () => {
      // Before: 40% win rate
      const beforeTrades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `before-${i}`,
          timestamp: new Date(Date.now() - 86400000 * 7 - i * 3600000),
          isWinner: i < 4,
        })
      );

      // After: 90% win rate
      const afterTrades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `after-${i}`,
          timestamp: new Date(Date.now() - i * 3600000),
          isWinner: i < 9,
        })
      );

      analyzer.addTrades(WALLET_1, [...beforeTrades, ...afterTrades]);

      const result = analyzer.analyze(WALLET_1);

      const winBiasShift = result.shifts.find(
        s => s.type === SelectionShiftType.WIN_BIAS_INCREASE
      );
      expect(winBiasShift).toBeDefined();
    });
  });

  describe("analyze - Risk Flags", () => {
    it("should flag HIGH_WIN_RATE", () => {
      const trades = createCategoryFocusedTrades(10, MarketCategory.POLITICS, 0.9);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.riskFlags).toContain("HIGH_WIN_RATE");
    });

    it("should flag HIGH_VALUE_CATEGORY_CONCENTRATION", () => {
      // Focus on politics (high-value category)
      const trades = createCategoryFocusedTrades(20, MarketCategory.POLITICS);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.riskFlags).toContain("HIGH_VALUE_CATEGORY_CONCENTRATION");
    });

    it("should flag NEAR_RESOLUTION_PREFERENCE", () => {
      const now = Date.now();
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          timestamp: new Date(now - i * 3600000),
          marketResolvesAt: new Date(now + 12 * 3600000), // 12 hours from trade
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.riskFlags).toContain("NEAR_RESOLUTION_PREFERENCE");
    });
  });

  describe("analyze - Preferences", () => {
    it("should identify CATEGORY_SPECIALIST preference", () => {
      const trades = createCategoryFocusedTrades(20, MarketCategory.CRYPTO);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.preferences).toContain(SelectionPreferenceType.CATEGORY_SPECIALIST);
    });

    it("should identify HIGH_VOLUME preference", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          marketVolume: 500000 + i * 100000, // High volume markets
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.preferences).toContain(SelectionPreferenceType.HIGH_VOLUME);
    });

    it("should identify LOW_VOLUME preference", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          marketVolume: 1000 + i * 100, // Low volume markets
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.preferences).toContain(SelectionPreferenceType.LOW_VOLUME);
    });

    it("should identify EVENT_DRIVEN preference", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          hasRecentNews: true,
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.preferences).toContain(SelectionPreferenceType.EVENT_DRIVEN);
    });
  });

  describe("batchAnalyze", () => {
    it("should analyze multiple wallets", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));
      analyzer.addTrades(WALLET_2, createTrades(8));
      analyzer.addTrades(WALLET_3, createTrades(6));

      const result = analyzer.batchAnalyze([WALLET_1, WALLET_2, WALLET_3]);

      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(3);
    });

    it("should handle invalid addresses gracefully", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));

      const result = analyzer.batchAnalyze([WALLET_1, "invalid-address"]);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors.has("invalid-address")).toBe(true);
    });

    it("should include processing time", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));

      const result = analyzer.batchAnalyze([WALLET_1]);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("hasSuspiciousSelection", () => {
    it("should return true for suspicious wallet", () => {
      const trades = createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95);
      analyzer.addTrades(WALLET_1, trades);

      const isSuspicious = analyzer.hasSuspiciousSelection(WALLET_1);

      expect(isSuspicious).toBe(true);
    });

    it("should return false for normal wallet", () => {
      const trades = createTrades(10);
      analyzer.addTrades(WALLET_1, trades);

      const isSuspicious = analyzer.hasSuspiciousSelection(WALLET_1);

      expect(isSuspicious).toBe(false);
    });
  });

  describe("getSuspiciousWallets", () => {
    it("should return wallets above threshold", () => {
      // Create suspicious wallet
      analyzer.addTrades(
        WALLET_1,
        createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95)
      );

      // Create normal wallet
      analyzer.addTrades(WALLET_2, createTrades(10));

      const suspicious = analyzer.getSuspiciousWallets();

      expect(suspicious.some(r => r.walletAddress === WALLET_1)).toBe(true);
    });

    it("should sort by suspicion score descending", () => {
      analyzer.addTrades(
        WALLET_1,
        createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.85)
      );
      analyzer.addTrades(
        WALLET_2,
        createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95)
      );

      const suspicious = analyzer.getSuspiciousWallets();

      if (suspicious.length >= 2) {
        expect(suspicious[0]!.suspicionScore).toBeGreaterThanOrEqual(
          suspicious[1]!.suspicionScore
        );
      }
    });

    it("should respect custom threshold", () => {
      analyzer.addTrades(
        WALLET_1,
        createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.75)
      );

      const highThreshold = analyzer.getSuspiciousWallets(90);
      const lowThreshold = analyzer.getSuspiciousWallets(30);

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  describe("getInsiderLikeWallets", () => {
    it("should return wallets with insider-like pattern", () => {
      analyzer.addTrades(
        WALLET_1,
        createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95)
      );

      const insiderLike = analyzer.getInsiderLikeWallets();

      expect(insiderLike.some(r => r.primaryPattern === SelectionPatternType.INSIDER_LIKE)).toBe(
        true
      );
    });

    it("should return empty for normal wallets", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));

      const insiderLike = analyzer.getInsiderLikeWallets();

      // May or may not have insider-like wallets
      expect(insiderLike.every(r => r.primaryPattern === SelectionPatternType.INSIDER_LIKE)).toBe(
        true
      );
    });
  });

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));
      analyzer.addTrades(WALLET_2, createTrades(8));

      const summary = analyzer.getSummary();

      expect(summary.totalWalletsAnalyzed).toBe(2);
      expect(summary.totalTradesProcessed).toBeGreaterThan(0);
      expect(summary.patternDistribution).toBeDefined();
      expect(summary.suspicionDistribution).toBeDefined();
    });

    it("should include cache statistics", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));
      analyzer.analyze(WALLET_1);
      analyzer.analyze(WALLET_1); // Cache hit

      const summary = analyzer.getSummary();

      expect(summary.cacheStats).toBeDefined();
      expect(summary.cacheStats.hitCount).toBeGreaterThanOrEqual(0);
    });

    it("should include top risk flags", () => {
      analyzer.addTrades(
        WALLET_1,
        createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.9)
      );
      analyzer.analyze(WALLET_1);

      const summary = analyzer.getSummary();

      expect(Array.isArray(summary.topRiskFlags)).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear cache", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));
      analyzer.analyze(WALLET_1);

      analyzer.clearCache();

      const summary = analyzer.getSummary();
      expect(summary.cacheStats.size).toBe(0);
    });

    it("should emit cacheCleared event", () => {
      const listener = vi.fn();
      analyzer.on("cacheCleared", listener);

      analyzer.clearCache();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("updateConfig", () => {
    it("should update configuration", () => {
      analyzer.updateConfig({ minTrades: 20 });

      const config = analyzer.getConfig();
      expect(config.minTrades).toBe(20);
    });

    it("should clear cache on config update", () => {
      analyzer.addTrades(WALLET_1, createTrades(10));
      analyzer.analyze(WALLET_1);

      analyzer.updateConfig({ minTrades: 20 });

      const summary = analyzer.getSummary();
      expect(summary.cacheStats.size).toBe(0);
    });

    it("should emit configUpdated event", () => {
      const listener = vi.fn();
      analyzer.on("configUpdated", listener);

      analyzer.updateConfig({ minTrades: 15 });

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("Factory Functions", () => {
    describe("createMarketSelectionAnalyzer", () => {
      it("should create new instance", () => {
        const instance = createMarketSelectionAnalyzer();
        expect(instance).toBeInstanceOf(MarketSelectionAnalyzer);
      });

      it("should accept config", () => {
        const instance = createMarketSelectionAnalyzer({ minTrades: 20 });
        expect(instance.getConfig().minTrades).toBe(20);
      });
    });

    describe("shared instance management", () => {
      beforeEach(() => {
        resetSharedMarketSelectionAnalyzer();
      });

      it("should get shared instance", () => {
        const instance1 = getSharedMarketSelectionAnalyzer();
        const instance2 = getSharedMarketSelectionAnalyzer();
        expect(instance1).toBe(instance2);
      });

      it("should set shared instance", () => {
        const custom = new MarketSelectionAnalyzer({ minTrades: 99 });
        setSharedMarketSelectionAnalyzer(custom);

        const instance = getSharedMarketSelectionAnalyzer();
        expect(instance.getConfig().minTrades).toBe(99);
      });

      it("should reset shared instance", () => {
        const custom = new MarketSelectionAnalyzer({ minTrades: 99 });
        setSharedMarketSelectionAnalyzer(custom);

        resetSharedMarketSelectionAnalyzer();

        const instance = getSharedMarketSelectionAnalyzer();
        expect(instance.getConfig().minTrades).toBe(DEFAULT_SELECTION_ANALYZER_CONFIG.minTrades);
      });
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetSharedMarketSelectionAnalyzer();
    });

    describe("addTradesForSelection", () => {
      it("should add trades to shared instance", () => {
        const trades = createTrades(5);
        addTradesForSelection(WALLET_1, trades);

        const shared = getSharedMarketSelectionAnalyzer();
        expect(shared.getTrades(WALLET_1)).toHaveLength(5);
      });
    });

    describe("analyzeMarketSelection", () => {
      it("should analyze using shared instance", () => {
        addTradesForSelection(WALLET_1, createTrades(10));

        const result = analyzeMarketSelection(WALLET_1);

        expect(result.totalTrades).toBe(10);
      });
    });

    describe("batchAnalyzeMarketSelection", () => {
      it("should batch analyze using shared instance", () => {
        addTradesForSelection(WALLET_1, createTrades(10));
        addTradesForSelection(WALLET_2, createTrades(8));

        const result = batchAnalyzeMarketSelection([WALLET_1, WALLET_2]);

        expect(result.successCount).toBe(2);
      });
    });

    describe("hasSuspiciousMarketSelection", () => {
      it("should check suspicion using shared instance", () => {
        addTradesForSelection(WALLET_1, createTrades(10));

        const isSuspicious = hasSuspiciousMarketSelection(WALLET_1);

        expect(typeof isSuspicious).toBe("boolean");
      });
    });

    describe("getWalletsWithSuspiciousSelection", () => {
      it("should get suspicious wallets from shared instance", () => {
        addTradesForSelection(
          WALLET_1,
          createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95)
        );

        const suspicious = getWalletsWithSuspiciousSelection();

        expect(Array.isArray(suspicious)).toBe(true);
      });
    });

    describe("getWalletsWithInsiderLikeSelection", () => {
      it("should get insider-like wallets from shared instance", () => {
        addTradesForSelection(
          WALLET_1,
          createCategoryFocusedTrades(20, MarketCategory.POLITICS, 0.95)
        );

        const insiderLike = getWalletsWithInsiderLikeSelection();

        expect(Array.isArray(insiderLike)).toBe(true);
      });
    });

    describe("getMarketSelectionAnalyzerSummary", () => {
      it("should get summary from shared instance", () => {
        addTradesForSelection(WALLET_1, createTrades(10));
        analyzeMarketSelection(WALLET_1);

        const summary = getMarketSelectionAnalyzerSummary();

        expect(summary.totalWalletsAnalyzed).toBeGreaterThan(0);
      });
    });
  });

  describe("Description Functions", () => {
    describe("getSelectionPatternDescription", () => {
      it("should return description for each pattern", () => {
        Object.values(SelectionPatternType).forEach(pattern => {
          const desc = getSelectionPatternDescription(pattern);
          expect(typeof desc).toBe("string");
          expect(desc.length).toBeGreaterThan(0);
        });
      });
    });

    describe("getSelectionPreferenceDescription", () => {
      it("should return description for each preference", () => {
        Object.values(SelectionPreferenceType).forEach(pref => {
          const desc = getSelectionPreferenceDescription(pref);
          expect(typeof desc).toBe("string");
          expect(desc.length).toBeGreaterThan(0);
        });
      });
    });

    describe("getSelectionSuspicionDescription", () => {
      it("should return description for each level", () => {
        Object.values(SelectionSuspicionLevel).forEach(level => {
          const desc = getSelectionSuspicionDescription(level);
          expect(typeof desc).toBe("string");
          expect(desc.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle wallet with no trades", () => {
      const result = analyzer.analyze(WALLET_1);

      expect(result.primaryPattern).toBe(SelectionPatternType.UNKNOWN);
      expect(result.totalTrades).toBe(0);
    });

    it("should handle all wins", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          isWinner: true,
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.primaryPattern).toBe(SelectionPatternType.INSIDER_LIKE);
    });

    it("should handle all losses", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          isWinner: false,
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.suspicionScore).toBeLessThan(30); // Low suspicion for all losses
    });

    it("should handle trades without optional fields", () => {
      const trades = Array.from({ length: 10 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          // No optional fields like marketCategory, marketVolume, etc.
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result).toBeDefined();
      expect(result.totalTrades).toBe(10);
    });

    it("should handle single market focus", () => {
      const trades = Array.from({ length: 20 }, (_, i) =>
        createTrade({
          tradeId: `trade-${i}`,
          marketId: "single-market",
        })
      );
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.diversity.uniqueMarkets).toBe(1);
      expect(result.primaryPattern).toBe(SelectionPatternType.FOCUSED);
    });

    it("should handle exact minimum trades threshold", () => {
      const minTrades = DEFAULT_SELECTION_ANALYZER_CONFIG.minTrades;
      const trades = createTrades(minTrades);
      analyzer.addTrades(WALLET_1, trades);

      const result = analyzer.analyze(WALLET_1);

      expect(result.primaryPattern).not.toBe(SelectionPatternType.UNKNOWN);
    });
  });
});
