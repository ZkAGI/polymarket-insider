/**
 * Tests for DET-NICHE-008: Wallet Niche Market Concentration Analyzer
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MarketCategory } from "../../src/api/gamma/types";
import {
  ConcentrationLevel,
  SpecialistType,
  ConcentrationSuspicion,
  DEFAULT_HIGH_VALUE_CATEGORIES,
  WalletConcentrationAnalyzer,
  createWalletConcentrationAnalyzer,
  getSharedWalletConcentrationAnalyzer,
  setSharedWalletConcentrationAnalyzer,
  resetSharedWalletConcentrationAnalyzer,
  addTradesForConcentration,
  analyzeWalletConcentration,
  batchAnalyzeWalletConcentration,
  isWalletSpecialist,
  hasHighWalletConcentration,
  getCategorySpecialists,
  getSuspiciousWallets,
  getWalletConcentrationScore,
  getConcentrationAnalysisSummary,
  TradeForConcentration,
} from "../../src/detection/wallet-concentration";

// ============================================================================
// Test Helpers
// ============================================================================

function createTrade(
  _walletAddress: string,
  category: MarketCategory,
  options: Partial<{
    tradeId: string;
    marketId: string;
    size: number;
    timestamp: Date;
    marketQuestion: string;
  }> = {}
): TradeForConcentration {
  return {
    tradeId: options.tradeId ?? `trade-${Math.random().toString(36).slice(2)}`,
    marketId: options.marketId ?? `market-${Math.random().toString(36).slice(2)}`,
    category,
    size: options.size ?? 100,
    timestamp: options.timestamp ?? new Date(),
    marketQuestion: options.marketQuestion,
  };
}

function createTradesForWallet(
  walletAddress: string,
  distribution: Array<{ category: MarketCategory; count: number; size?: number }>
): TradeForConcentration[] {
  const trades: TradeForConcentration[] = [];
  for (const { category, count, size } of distribution) {
    for (let i = 0; i < count; i++) {
      trades.push(
        createTrade(walletAddress, category, {
          size: size ?? 100,
          marketId: `${category}-market-${i}`,
        })
      );
    }
  }
  return trades;
}

// ============================================================================
// Unit Tests
// ============================================================================

describe("WalletConcentrationAnalyzer", () => {
  let analyzer: WalletConcentrationAnalyzer;

  beforeEach(() => {
    analyzer = new WalletConcentrationAnalyzer();
  });

  afterEach(() => {
    analyzer.clear();
  });

  describe("Constructor and Configuration", () => {
    it("should create instance with default configuration", () => {
      const instance = new WalletConcentrationAnalyzer();
      expect(instance).toBeInstanceOf(WalletConcentrationAnalyzer);
    });

    it("should accept custom configuration", () => {
      const customConfig = {
        cacheTtlMs: 60000,
        maxCacheSize: 1000,
        defaultMinTrades: 10,
        defaultTimeWindowDays: 30,
        defaultSpecialistThreshold: 60,
        highValueCategories: [MarketCategory.POLITICS, MarketCategory.LEGAL],
      };
      const instance = new WalletConcentrationAnalyzer(customConfig);
      expect(instance).toBeInstanceOf(WalletConcentrationAnalyzer);
    });
  });

  describe("Trade Management", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    it("should add trades for a wallet", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 5 },
      ]);

      analyzer.addTrades(walletAddress, trades);
      const storedTrades = analyzer.getTrades(walletAddress);

      expect(storedTrades).toHaveLength(5);
    });

    it("should avoid duplicate trades", () => {
      const trade = createTrade(walletAddress, MarketCategory.POLITICS, {
        tradeId: "unique-trade-1",
      });

      analyzer.addTrades(walletAddress, [trade]);
      analyzer.addTrades(walletAddress, [trade]); // Add same trade again

      const storedTrades = analyzer.getTrades(walletAddress);
      expect(storedTrades).toHaveLength(1);
    });

    it("should normalize wallet addresses to lowercase", () => {
      const mixedCaseAddress = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
      const trades = createTradesForWallet(mixedCaseAddress, [
        { category: MarketCategory.CRYPTO, count: 3 },
      ]);

      analyzer.addTrades(mixedCaseAddress, trades);

      // Should be able to retrieve with lowercase
      const lowerCaseAddress = mixedCaseAddress.toLowerCase();
      const storedTrades = analyzer.getTrades(lowerCaseAddress);
      expect(storedTrades).toHaveLength(3);
    });

    it("should clear trades for a wallet", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 10 },
      ]);

      analyzer.addTrades(walletAddress, trades);
      analyzer.clearTrades(walletAddress);

      const storedTrades = analyzer.getTrades(walletAddress);
      expect(storedTrades).toHaveLength(0);
    });

    it("should return empty array for unknown wallet", () => {
      const trades = analyzer.getTrades("0xunknown");
      expect(trades).toEqual([]);
    });
  });

  describe("Concentration Analysis", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    it("should return empty result for insufficient trades", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 2 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.totalTrades).toBe(0);
      expect(result.concentrationLevel).toBe(ConcentrationLevel.DIVERSIFIED);
      expect(result.isSpecialist).toBe(false);
    });

    it("should detect extreme concentration", () => {
      // 90% in one category
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 90 },
        { category: MarketCategory.CRYPTO, count: 10 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.concentrationLevel).toBe(ConcentrationLevel.EXTREME);
      expect(result.primaryCategory).toBe(MarketCategory.POLITICS);
      expect(result.isSpecialist).toBe(true);
      expect(result.specialistType).toBe(SpecialistType.POLITICAL_SPECIALIST);
    });

    it("should detect high concentration", () => {
      // 70% in one category
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.CRYPTO, count: 70 },
        { category: MarketCategory.TECH, count: 30 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.concentrationLevel).toBe(ConcentrationLevel.HIGH);
      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
      expect(result.isSpecialist).toBe(true);
    });

    it("should detect moderate concentration", () => {
      // 50% in one category
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 50 },
        { category: MarketCategory.ENTERTAINMENT, count: 30 },
        { category: MarketCategory.CRYPTO, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.concentrationLevel).toBe(ConcentrationLevel.MODERATE);
      expect(result.primaryCategory).toBe(MarketCategory.SPORTS);
      expect(result.isSpecialist).toBe(true);
    });

    it("should detect low concentration", () => {
      // 30% in one category
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.TECH, count: 30 },
        { category: MarketCategory.BUSINESS, count: 25 },
        { category: MarketCategory.CRYPTO, count: 25 },
        { category: MarketCategory.POLITICS, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.concentrationLevel).toBe(ConcentrationLevel.LOW);
      expect(result.isSpecialist).toBe(false);
    });

    it("should detect diversified trading", () => {
      // Even distribution across many categories
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 10 },
        { category: MarketCategory.CRYPTO, count: 10 },
        { category: MarketCategory.SPORTS, count: 10 },
        { category: MarketCategory.TECH, count: 10 },
        { category: MarketCategory.BUSINESS, count: 10 },
        { category: MarketCategory.ENTERTAINMENT, count: 10 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.concentrationLevel).toBe(ConcentrationLevel.DIVERSIFIED);
      expect(result.specialistType).toBe(SpecialistType.GENERALIST);
      expect(result.isSpecialist).toBe(false);
    });

    it("should calculate Herfindahl-Hirschman Index correctly", () => {
      // 50% / 50% split should give HHI of 0.5
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 50 },
        { category: MarketCategory.CRYPTO, count: 50 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      // HHI = 0.5^2 + 0.5^2 = 0.25 + 0.25 = 0.5
      expect(result.herfindahlIndex).toBeCloseTo(0.5, 2);
    });

    it("should calculate HHI for monopoly correctly", () => {
      // 100% in one category should give HHI of 1.0
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 100 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.herfindahlIndex).toBe(1);
    });

    it("should identify primary and secondary categories", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.LEGAL, count: 60 },
        { category: MarketCategory.POLITICS, count: 30 },
        { category: MarketCategory.BUSINESS, count: 10 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.primaryCategory).toBe(MarketCategory.LEGAL);
      expect(result.secondaryCategory).toBe(MarketCategory.POLITICS);
    });

    it("should track category statistics correctly", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 20, size: 1000 },
        { category: MarketCategory.CRYPTO, count: 10, size: 500 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      const politicsStats = result.categoryBreakdown.find(
        (s) => s.category === MarketCategory.POLITICS
      );
      const cryptoStats = result.categoryBreakdown.find(
        (s) => s.category === MarketCategory.CRYPTO
      );

      expect(politicsStats?.tradeCount).toBe(20);
      expect(politicsStats?.tradePercentage).toBeCloseTo(66.67, 1);
      expect(politicsStats?.totalVolume).toBe(20000);

      expect(cryptoStats?.tradeCount).toBe(10);
      expect(cryptoStats?.totalVolume).toBe(5000);
    });

    it("should count unique markets per category", () => {
      const trades: TradeForConcentration[] = [
        createTrade(walletAddress, MarketCategory.POLITICS, { marketId: "market-1" }),
        createTrade(walletAddress, MarketCategory.POLITICS, { marketId: "market-1" }), // Same market
        createTrade(walletAddress, MarketCategory.POLITICS, { marketId: "market-2" }),
        createTrade(walletAddress, MarketCategory.POLITICS, { marketId: "market-3" }),
        createTrade(walletAddress, MarketCategory.CRYPTO, { marketId: "market-4" }),
      ];

      const result = analyzer.analyze(walletAddress, trades);

      const politicsStats = result.categoryBreakdown.find(
        (s) => s.category === MarketCategory.POLITICS
      );

      expect(politicsStats?.uniqueMarkets).toBe(3);
      expect(result.uniqueMarkets).toBe(4);
    });

    it("should filter trades by time window", () => {
      const now = new Date();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      const trades: TradeForConcentration[] = [
        createTrade(walletAddress, MarketCategory.POLITICS, { timestamp: now }),
        createTrade(walletAddress, MarketCategory.POLITICS, { timestamp: now }),
        createTrade(walletAddress, MarketCategory.POLITICS, { timestamp: now }),
        createTrade(walletAddress, MarketCategory.POLITICS, { timestamp: now }),
        createTrade(walletAddress, MarketCategory.POLITICS, { timestamp: now }),
        createTrade(walletAddress, MarketCategory.CRYPTO, { timestamp: oldDate }), // Old trade
      ];

      const result = analyzer.analyze(walletAddress, trades, { timeWindowDays: 90 });

      // Should only count 5 recent trades, not the old one
      expect(result.totalTrades).toBe(5);
    });
  });

  describe("Specialist Detection", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    it("should identify political specialist", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 80 },
        { category: MarketCategory.OTHER, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.POLITICAL_SPECIALIST);
    });

    it("should identify crypto specialist", () => {
      // Need 80%+ to be single specialist (since 70/30 triggers multi-specialist with 30% >= 35%)
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.CRYPTO, count: 85 },
        { category: MarketCategory.TECH, count: 15 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.CRYPTO_SPECIALIST);
    });

    it("should identify sports specialist", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 85 },
        { category: MarketCategory.ENTERTAINMENT, count: 15 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.SPORTS_SPECIALIST);
    });

    it("should identify legal specialist", () => {
      // Need 80%+ in primary with low secondary to avoid multi-specialist
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.LEGAL, count: 80 },
        { category: MarketCategory.POLITICS, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.LEGAL_SPECIALIST);
    });

    it("should identify health specialist", () => {
      // Need 80%+ in primary with low secondary to avoid multi-specialist
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.HEALTH, count: 80 },
        { category: MarketCategory.SCIENCE, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.HEALTH_SPECIALIST);
    });

    it("should identify multi-specialist", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 55 },
        { category: MarketCategory.LEGAL, count: 35 },
        { category: MarketCategory.OTHER, count: 10 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.MULTI_SPECIALIST);
    });

    it("should identify generalist", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 20 },
        { category: MarketCategory.CRYPTO, count: 20 },
        { category: MarketCategory.SPORTS, count: 20 },
        { category: MarketCategory.TECH, count: 20 },
        { category: MarketCategory.OTHER, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.specialistType).toBe(SpecialistType.GENERALIST);
    });

    it("should use custom specialist threshold", () => {
      // Use a spread where neither category triggers multi-specialist
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 45 },
        { category: MarketCategory.CRYPTO, count: 20 },
        { category: MarketCategory.SPORTS, count: 20 },
        { category: MarketCategory.OTHER, count: 15 },
      ]);

      // With default threshold (50), should be generalist (45% < 50%)
      const result1 = analyzer.analyze(walletAddress, trades);
      expect(result1.specialistType).toBe(SpecialistType.GENERALIST);

      // With lower threshold (40), should be specialist (45% >= 40%)
      const result2 = analyzer.analyze(walletAddress, trades, {
        specialistThreshold: 40,
        bypassCache: true,
      });
      expect(result2.isSpecialist).toBe(true);
    });
  });

  describe("Suspicion Level", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    it("should assign critical suspicion for extreme concentration in high-value category", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 95 },
        { category: MarketCategory.OTHER, count: 5 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.suspicionLevel).toBe(ConcentrationSuspicion.CRITICAL);
    });

    it("should assign high suspicion for high concentration in legal category", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.LEGAL, count: 70 },
        { category: MarketCategory.POLITICS, count: 30 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect([ConcentrationSuspicion.HIGH, ConcentrationSuspicion.CRITICAL]).toContain(
        result.suspicionLevel
      );
    });

    it("should assign lower suspicion for sports concentration", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 90 },
        { category: MarketCategory.ENTERTAINMENT, count: 10 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      // Sports has low suspicion weight, so should be lower than political
      expect([ConcentrationSuspicion.LOW, ConcentrationSuspicion.MEDIUM]).toContain(
        result.suspicionLevel
      );
    });

    it("should assign minimal suspicion for diversified trading", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 20 },
        { category: MarketCategory.ENTERTAINMENT, count: 20 },
        { category: MarketCategory.WEATHER, count: 20 },
        { category: MarketCategory.CULTURE, count: 20 },
        { category: MarketCategory.OTHER, count: 20 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect([ConcentrationSuspicion.MINIMAL, ConcentrationSuspicion.LOW]).toContain(
        result.suspicionLevel
      );
    });
  });

  describe("Flag Reasons", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    it("should generate flag reasons for extreme concentration", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 90 },
        { category: MarketCategory.OTHER, count: 10 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(result.flagReasons.length).toBeGreaterThan(0);
      expect(result.flagReasons.some((r) => r.includes("Extreme concentration"))).toBe(
        true
      );
    });

    it("should flag high-value category focus", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.LEGAL, count: 60 },
        { category: MarketCategory.BUSINESS, count: 40 },
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      expect(
        result.flagReasons.some((r) => r.includes("high-value category"))
      ).toBe(true);
    });

    it("should flag volume concentration", () => {
      // Create scenario where volume is concentrated but trade count is not
      // So that primary category is OTHER (by trade count) but volume is concentrated in SPORTS
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 10, size: 10000 }, // 10% trades, ~99% volume
        { category: MarketCategory.OTHER, count: 90, size: 10 },      // 90% trades, ~1% volume
      ]);

      const result = analyzer.analyze(walletAddress, trades);

      // Primary category by trade count is OTHER (90 trades)
      // But SPORTS has volume percentage = 100000 / 100900 = ~99.1%
      // The primary category (OTHER) has volume percentage < 1%
      // Since the primary category doesn't have high volume %, we need to check
      // that the flag is based on primary category's volume percentage
      // In this case, OTHER is the primary with low volume, so it won't flag

      // Let's flip it - make SPORTS the primary by trade count too
      const trades2 = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 80, size: 1000 },  // 80% trades, 80000 volume
        { category: MarketCategory.OTHER, count: 20, size: 50 },     // 20% trades, 1000 volume
      ]);

      const result2 = analyzer.analyze(walletAddress, trades2, { bypassCache: true });

      // SPORTS volume percentage = 80000 / 81000 = ~98.8%
      // This should trigger volume concentration flag
      expect(
        result2.flagReasons.some((r) => r.includes("Volume concentration"))
      ).toBe(true);
    });
  });

  describe("Caching", () => {
    const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

    it("should cache analysis results", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 50 },
        { category: MarketCategory.CRYPTO, count: 50 },
      ]);

      analyzer.addTrades(walletAddress, trades);

      // First analysis - should not be from cache
      const result1 = analyzer.analyze(walletAddress);
      expect(result1.fromCache).toBe(false);

      // Second analysis - should be from cache
      const result2 = analyzer.analyze(walletAddress);
      expect(result2.fromCache).toBe(true);
    });

    it("should bypass cache when requested", () => {
      const trades = createTradesForWallet(walletAddress, [
        { category: MarketCategory.SPORTS, count: 100 },
      ]);

      analyzer.addTrades(walletAddress, trades);

      // First analysis
      const result1 = analyzer.analyze(walletAddress);
      expect(result1.fromCache).toBe(false);

      // Bypass cache
      const result2 = analyzer.analyze(walletAddress, undefined, { bypassCache: true });
      expect(result2.fromCache).toBe(false);
    });

    it("should invalidate cache when trades are added", () => {
      const trades1 = createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 50 },
      ]);

      analyzer.addTrades(walletAddress, trades1);
      const result1 = analyzer.analyze(walletAddress);
      expect(result1.fromCache).toBe(false);

      // Add more trades - should invalidate cache
      const trades2 = createTradesForWallet(walletAddress, [
        { category: MarketCategory.CRYPTO, count: 50 },
      ]);
      analyzer.addTrades(walletAddress, trades2);

      const result2 = analyzer.analyze(walletAddress);
      expect(result2.fromCache).toBe(false);
    });
  });

  describe("Query Methods", () => {
    const wallet1 = "0x1111111111111111111111111111111111111111";
    const wallet2 = "0x2222222222222222222222222222222222222222";
    const wallet3 = "0x3333333333333333333333333333333333333333";

    beforeEach(() => {
      // Wallet 1: Political specialist
      analyzer.addTrades(
        wallet1,
        createTradesForWallet(wallet1, [
          { category: MarketCategory.POLITICS, count: 80 },
          { category: MarketCategory.OTHER, count: 20 },
        ])
      );

      // Wallet 2: Crypto specialist
      analyzer.addTrades(
        wallet2,
        createTradesForWallet(wallet2, [
          { category: MarketCategory.CRYPTO, count: 70 },
          { category: MarketCategory.TECH, count: 30 },
        ])
      );

      // Wallet 3: Diversified
      analyzer.addTrades(
        wallet3,
        createTradesForWallet(wallet3, [
          { category: MarketCategory.SPORTS, count: 20 },
          { category: MarketCategory.ENTERTAINMENT, count: 20 },
          { category: MarketCategory.CRYPTO, count: 20 },
          { category: MarketCategory.TECH, count: 20 },
          { category: MarketCategory.OTHER, count: 20 },
        ])
      );
    });

    it("should check if wallet is specialist in category", () => {
      expect(analyzer.isSpecialistInCategory(wallet1, MarketCategory.POLITICS)).toBe(
        true
      );
      expect(analyzer.isSpecialistInCategory(wallet1, MarketCategory.CRYPTO)).toBe(
        false
      );
      expect(analyzer.isSpecialistInCategory(wallet2, MarketCategory.CRYPTO)).toBe(
        true
      );
      expect(analyzer.isSpecialistInCategory(wallet3, MarketCategory.SPORTS)).toBe(
        false
      );
    });

    it("should check if wallet has high concentration", () => {
      expect(analyzer.hasHighConcentration(wallet1, 70)).toBe(true);
      expect(analyzer.hasHighConcentration(wallet1, 90)).toBe(false);
      expect(analyzer.hasHighConcentration(wallet3, 30)).toBe(false);
    });

    it("should get specialists in category", () => {
      const politicalSpecialists = analyzer.getSpecialistsInCategory(
        MarketCategory.POLITICS
      );
      const cryptoSpecialists = analyzer.getSpecialistsInCategory(MarketCategory.CRYPTO);

      expect(politicalSpecialists).toContain(wallet1.toLowerCase());
      expect(cryptoSpecialists).toContain(wallet2.toLowerCase());
      expect(cryptoSpecialists).not.toContain(wallet3.toLowerCase());
    });

    it("should get flagged wallets by suspicion level", () => {
      const flagged = analyzer.getFlaggedWallets(ConcentrationSuspicion.MEDIUM);

      // Political specialist should be flagged (high-value category)
      expect(flagged).toContain(wallet1.toLowerCase());
    });

    it("should get concentration score", () => {
      const score1 = analyzer.getConcentrationScore(wallet1);
      const score3 = analyzer.getConcentrationScore(wallet3);

      expect(score1).toBeGreaterThan(score3);
      expect(score1).toBeGreaterThan(50);
      expect(score3).toBeLessThan(50);
    });
  });

  describe("Batch Analysis", () => {
    it("should analyze multiple wallets in batch", () => {
      const wallets: string[] = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
      ];

      // Add trades for each
      const wallet0 = wallets[0] as string;
      const wallet1 = wallets[1] as string;
      const wallet2 = wallets[2] as string;

      analyzer.addTrades(
        wallet0,
        createTradesForWallet(wallet0, [
          { category: MarketCategory.POLITICS, count: 80 },
          { category: MarketCategory.OTHER, count: 20 },
        ])
      );
      analyzer.addTrades(
        wallet1,
        createTradesForWallet(wallet1, [
          { category: MarketCategory.CRYPTO, count: 60 },
          { category: MarketCategory.TECH, count: 40 },
        ])
      );
      analyzer.addTrades(
        wallet2,
        createTradesForWallet(wallet2, [
          { category: MarketCategory.SPORTS, count: 100 },
        ])
      );

      const batchResult = analyzer.analyzeBatch(wallets);

      expect(batchResult.totalProcessed).toBe(3);
      expect(batchResult.successCount).toBe(3);
      expect(batchResult.errorCount).toBe(0);
      expect(batchResult.results.size).toBe(3);
      expect(batchResult.specialistsFound).toHaveLength(3); // All are specialists
    });

    it("should track processing time", () => {
      const wallets: string[] = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
      ];

      wallets.forEach((w) => {
        analyzer.addTrades(
          w,
          createTradesForWallet(w, [{ category: MarketCategory.POLITICS, count: 10 }])
        );
      });

      const batchResult = analyzer.analyzeBatch(wallets);

      expect(batchResult.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle errors gracefully", () => {
      const wallets: string[] = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222", // No trades
      ];

      const wallet0 = wallets[0] as string;
      analyzer.addTrades(
        wallet0,
        createTradesForWallet(wallet0, [
          { category: MarketCategory.POLITICS, count: 10 },
        ])
      );

      const batchResult = analyzer.analyzeBatch(wallets);

      // Both should succeed (empty trades returns empty result)
      expect(batchResult.successCount).toBe(2);
    });
  });

  describe("Summary Statistics", () => {
    beforeEach(() => {
      const wallet1 = "0x1111111111111111111111111111111111111111";
      const wallet2 = "0x2222222222222222222222222222222222222222";
      const wallet3 = "0x3333333333333333333333333333333333333333";

      analyzer.addTrades(
        wallet1,
        createTradesForWallet(wallet1, [
          { category: MarketCategory.POLITICS, count: 80 },
          { category: MarketCategory.OTHER, count: 20 },
        ])
      );
      analyzer.addTrades(
        wallet2,
        createTradesForWallet(wallet2, [
          { category: MarketCategory.POLITICS, count: 80 },
          { category: MarketCategory.LEGAL, count: 20 },
        ])
      );
      analyzer.addTrades(
        wallet3,
        createTradesForWallet(wallet3, [
          { category: MarketCategory.SPORTS, count: 90 },
          { category: MarketCategory.ENTERTAINMENT, count: 10 },
        ])
      );

      // Trigger analysis for all
      analyzer.analyze(wallet1);
      analyzer.analyze(wallet2);
      analyzer.analyze(wallet3);
    });

    it("should return summary statistics", () => {
      const summary = analyzer.getSummary();

      expect(summary.totalWalletsAnalyzed).toBe(3);
      expect(summary.specialistsCount).toBe(3);
      expect(summary.averageConcentrationScore).toBeGreaterThan(0);
    });

    it("should track specialist type breakdown", () => {
      const summary = analyzer.getSummary();

      expect(summary.specialistTypeBreakdown.get(SpecialistType.POLITICAL_SPECIALIST)).toBe(
        2
      );
      expect(summary.specialistTypeBreakdown.get(SpecialistType.SPORTS_SPECIALIST)).toBe(
        1
      );
    });

    it("should track concentration level breakdown", () => {
      const summary = analyzer.getSummary();

      const extremeCount = summary.concentrationLevelBreakdown.get(
        ConcentrationLevel.EXTREME
      ) ?? 0;
      const highCount = summary.concentrationLevelBreakdown.get(
        ConcentrationLevel.HIGH
      ) ?? 0;

      expect(extremeCount + highCount).toBeGreaterThan(0);
    });

    it("should track top primary categories", () => {
      const summary = analyzer.getSummary();

      expect(summary.topPrimaryCategories.length).toBeGreaterThan(0);
      const topCategory = summary.topPrimaryCategories[0];
      expect(topCategory).toBeDefined();
      expect(topCategory!.category).toBe(MarketCategory.POLITICS);
      expect(topCategory!.count).toBe(2);
    });

    it("should track cache statistics", () => {
      const summary = analyzer.getSummary();

      expect(summary.cacheStats.size).toBeGreaterThan(0);
      expect(summary.cacheStats.hitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Clear", () => {
    it("should clear all data", () => {
      const wallet = "0x1234567890abcdef1234567890abcdef12345678";
      analyzer.addTrades(
        wallet,
        createTradesForWallet(wallet, [
          { category: MarketCategory.POLITICS, count: 50 },
        ])
      );
      analyzer.analyze(wallet);

      analyzer.clear();

      expect(analyzer.getTrades(wallet)).toHaveLength(0);
      const summary = analyzer.getSummary();
      expect(summary.totalWalletsAnalyzed).toBe(0);
    });
  });
});

// ============================================================================
// Shared Instance Tests
// ============================================================================

describe("Shared Instance Management", () => {
  afterEach(() => {
    resetSharedWalletConcentrationAnalyzer();
  });

  it("should create shared instance via factory function", () => {
    const instance = createWalletConcentrationAnalyzer();
    expect(instance).toBeInstanceOf(WalletConcentrationAnalyzer);
  });

  it("should return same shared instance", () => {
    const instance1 = getSharedWalletConcentrationAnalyzer();
    const instance2 = getSharedWalletConcentrationAnalyzer();
    expect(instance1).toBe(instance2);
  });

  it("should allow setting shared instance", () => {
    const custom = new WalletConcentrationAnalyzer({ defaultMinTrades: 10 });
    setSharedWalletConcentrationAnalyzer(custom);
    expect(getSharedWalletConcentrationAnalyzer()).toBe(custom);
  });

  it("should reset shared instance", () => {
    const instance1 = getSharedWalletConcentrationAnalyzer();
    resetSharedWalletConcentrationAnalyzer();
    const instance2 = getSharedWalletConcentrationAnalyzer();
    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe("Convenience Functions", () => {
  const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

  afterEach(() => {
    resetSharedWalletConcentrationAnalyzer();
  });

  it("addTradesForConcentration should add trades to shared instance", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.POLITICS, count: 10 },
    ]);

    addTradesForConcentration(walletAddress, trades);

    const stored = getSharedWalletConcentrationAnalyzer().getTrades(walletAddress);
    expect(stored).toHaveLength(10);
  });

  it("analyzeWalletConcentration should analyze using shared instance", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.POLITICS, count: 80 },
      { category: MarketCategory.OTHER, count: 20 },
    ]);

    const result = analyzeWalletConcentration(walletAddress, trades);

    expect(result.walletAddress).toBe(walletAddress.toLowerCase());
    expect(result.isSpecialist).toBe(true);
  });

  it("batchAnalyzeWalletConcentration should batch analyze", () => {
    const wallets = [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ];

    wallets.forEach((w) => {
      addTradesForConcentration(
        w,
        createTradesForWallet(w, [{ category: MarketCategory.POLITICS, count: 50 }])
      );
    });

    const result = batchAnalyzeWalletConcentration(wallets);

    expect(result.totalProcessed).toBe(2);
    expect(result.successCount).toBe(2);
  });

  it("isWalletSpecialist should check specialist status", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.LEGAL, count: 70 },
      { category: MarketCategory.OTHER, count: 30 },
    ]);

    addTradesForConcentration(walletAddress, trades);

    expect(isWalletSpecialist(walletAddress, MarketCategory.LEGAL)).toBe(true);
    expect(isWalletSpecialist(walletAddress, MarketCategory.POLITICS)).toBe(false);
  });

  it("hasHighWalletConcentration should check concentration", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.POLITICS, count: 60 },
      { category: MarketCategory.OTHER, count: 40 },
    ]);

    addTradesForConcentration(walletAddress, trades);

    expect(hasHighWalletConcentration(walletAddress, 50)).toBe(true);
    expect(hasHighWalletConcentration(walletAddress, 70)).toBe(false);
  });

  it("getCategorySpecialists should find specialists", () => {
    const wallet1 = "0x1111111111111111111111111111111111111111";
    const wallet2 = "0x2222222222222222222222222222222222222222";

    addTradesForConcentration(
      wallet1,
      createTradesForWallet(wallet1, [
        { category: MarketCategory.POLITICS, count: 80 },
        { category: MarketCategory.OTHER, count: 20 },
      ])
    );
    addTradesForConcentration(
      wallet2,
      createTradesForWallet(wallet2, [
        { category: MarketCategory.CRYPTO, count: 80 },
        { category: MarketCategory.OTHER, count: 20 },
      ])
    );

    const politicalSpecialists = getCategorySpecialists(MarketCategory.POLITICS);

    expect(politicalSpecialists).toContain(wallet1.toLowerCase());
    expect(politicalSpecialists).not.toContain(wallet2.toLowerCase());
  });

  it("getSuspiciousWallets should find flagged wallets", () => {
    const wallet1 = "0x1111111111111111111111111111111111111111";

    addTradesForConcentration(
      wallet1,
      createTradesForWallet(wallet1, [
        { category: MarketCategory.POLITICS, count: 95 },
        { category: MarketCategory.OTHER, count: 5 },
      ])
    );

    const suspicious = getSuspiciousWallets(ConcentrationSuspicion.HIGH);

    expect(suspicious).toContain(wallet1.toLowerCase());
  });

  it("getWalletConcentrationScore should return score", () => {
    addTradesForConcentration(
      walletAddress,
      createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 80 },
        { category: MarketCategory.OTHER, count: 20 },
      ])
    );

    const score = getWalletConcentrationScore(walletAddress);

    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("getConcentrationAnalysisSummary should return summary", () => {
    addTradesForConcentration(
      walletAddress,
      createTradesForWallet(walletAddress, [
        { category: MarketCategory.POLITICS, count: 80 },
        { category: MarketCategory.OTHER, count: 20 },
      ])
    );

    // Trigger analysis
    analyzeWalletConcentration(walletAddress);

    const summary = getConcentrationAnalysisSummary();

    expect(summary.totalWalletsAnalyzed).toBe(1);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("Constants", () => {
  it("should export default high value categories", () => {
    expect(DEFAULT_HIGH_VALUE_CATEGORIES).toContain(MarketCategory.POLITICS);
    expect(DEFAULT_HIGH_VALUE_CATEGORIES).toContain(MarketCategory.LEGAL);
    expect(DEFAULT_HIGH_VALUE_CATEGORIES).toContain(MarketCategory.HEALTH);
    expect(DEFAULT_HIGH_VALUE_CATEGORIES).toContain(MarketCategory.GEOPOLITICS);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  let analyzer: WalletConcentrationAnalyzer;
  const walletAddress = "0x1234567890abcdef1234567890abcdef12345678";

  beforeEach(() => {
    analyzer = new WalletConcentrationAnalyzer();
  });

  afterEach(() => {
    analyzer.clear();
  });

  it("should handle empty trades array", () => {
    const result = analyzer.analyze(walletAddress, []);
    expect(result.totalTrades).toBe(0);
    expect(result.concentrationLevel).toBe(ConcentrationLevel.DIVERSIFIED);
  });

  it("should handle single trade", () => {
    const trades = [createTrade(walletAddress, MarketCategory.POLITICS)];
    const result = analyzer.analyze(walletAddress, trades, { minTrades: 1 });

    expect(result.totalTrades).toBe(1);
    expect(result.concentrationLevel).toBe(ConcentrationLevel.EXTREME);
  });

  it("should handle all trades in OTHER category", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.OTHER, count: 100 },
    ]);

    const result = analyzer.analyze(walletAddress, trades);

    expect(result.primaryCategory).toBe(MarketCategory.OTHER);
    expect(result.specialistType).toBe(SpecialistType.GENERALIST);
  });

  it("should handle zero-volume trades", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.POLITICS, count: 10, size: 0 },
    ]);

    const result = analyzer.analyze(walletAddress, trades);

    expect(result.totalVolume).toBe(0);
    const politicsBreakdown = result.categoryBreakdown[0];
    expect(politicsBreakdown).toBeDefined();
    expect(politicsBreakdown!.avgTradeSize).toBe(0);
  });

  it("should handle very large numbers", () => {
    const trades = createTradesForWallet(walletAddress, [
      { category: MarketCategory.POLITICS, count: 10, size: 1e12 },
    ]);

    const result = analyzer.analyze(walletAddress, trades);

    expect(result.totalVolume).toBe(10e12);
  });

  it("should handle wallet address with mixed case", () => {
    const mixedCase = "0xAbCdEf1234567890123456789012345678901234";
    const trades = createTradesForWallet(mixedCase, [
      { category: MarketCategory.POLITICS, count: 10 },
    ]);

    analyzer.addTrades(mixedCase, trades);

    // Should find trades with lowercase address
    const result = analyzer.analyze(mixedCase.toLowerCase());
    expect(result.totalTrades).toBe(10);
  });
});

// ============================================================================
// Type Exports Tests
// ============================================================================

describe("Type Exports", () => {
  it("should have correct enum values for ConcentrationLevel", () => {
    expect(ConcentrationLevel.EXTREME).toBe("EXTREME");
    expect(ConcentrationLevel.HIGH).toBe("HIGH");
    expect(ConcentrationLevel.MODERATE).toBe("MODERATE");
    expect(ConcentrationLevel.LOW).toBe("LOW");
    expect(ConcentrationLevel.DIVERSIFIED).toBe("DIVERSIFIED");
  });

  it("should have correct enum values for SpecialistType", () => {
    expect(SpecialistType.POLITICAL_SPECIALIST).toBe("POLITICAL_SPECIALIST");
    expect(SpecialistType.CRYPTO_SPECIALIST).toBe("CRYPTO_SPECIALIST");
    expect(SpecialistType.SPORTS_SPECIALIST).toBe("SPORTS_SPECIALIST");
    expect(SpecialistType.GENERALIST).toBe("GENERALIST");
    expect(SpecialistType.MULTI_SPECIALIST).toBe("MULTI_SPECIALIST");
  });

  it("should have correct enum values for ConcentrationSuspicion", () => {
    expect(ConcentrationSuspicion.CRITICAL).toBe("CRITICAL");
    expect(ConcentrationSuspicion.HIGH).toBe("HIGH");
    expect(ConcentrationSuspicion.MEDIUM).toBe("MEDIUM");
    expect(ConcentrationSuspicion.LOW).toBe("LOW");
    expect(ConcentrationSuspicion.MINIMAL).toBe("MINIMAL");
  });
});
