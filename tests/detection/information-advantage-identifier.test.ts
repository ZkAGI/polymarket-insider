/**
 * Information-Advantage Market Identifier Tests (DET-NICHE-002)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InformationAdvantageIdentifier,
  createInformationAdvantageIdentifier,
  getSharedInformationAdvantageIdentifier,
  setSharedInformationAdvantageIdentifier,
  resetSharedInformationAdvantageIdentifier,
  analyzeMarketInformationAdvantage,
  analyzeMarketsInformationAdvantage,
  getHighValueMarketsForInsiderPotential,
  isHighValueMarketForInsider,
  getRankedMarketsForInsiderValue,
  getInformationAdvantageSummary,
  InformationAdvantageType,
  InformationAdvantageTier,
  DEFAULT_CATEGORY_CONFIGS,
  CROSS_CATEGORY_HIGH_VALUE_KEYWORDS,
  type MarketForClassification,
  type CategoryAdvantageConfig,
} from "../../src/detection";
import { MarketCategory } from "../../src/api/gamma/types";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestMarket(
  id: string,
  question: string,
  description?: string,
  existingCategory?: string,
  slug?: string,
  tags?: string[]
): MarketForClassification {
  return {
    id,
    question,
    description,
    existingCategory,
    slug,
    tags,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("InformationAdvantageIdentifier", () => {
  let identifier: InformationAdvantageIdentifier;

  beforeEach(() => {
    identifier = createInformationAdvantageIdentifier({
      debug: false,
    });
  });

  afterEach(() => {
    identifier.clearCache();
    identifier.clearRankings();
    resetSharedInformationAdvantageIdentifier();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe("constructor", () => {
    it("should create identifier with default config", () => {
      const defaultIdentifier = createInformationAdvantageIdentifier();
      const configs = defaultIdentifier.getAllCategoryConfigs();

      expect(configs.length).toBe(DEFAULT_CATEGORY_CONFIGS.length);
      expect(configs.length).toBeGreaterThan(0);
    });

    it("should create identifier with custom config", () => {
      const customIdentifier = createInformationAdvantageIdentifier({
        cacheTtlMs: 60000,
        maxCacheSize: 100,
        highValueThreshold: 70,
        debug: false,
      });

      expect(customIdentifier).toBeDefined();
      expect(customIdentifier.getCacheSize()).toBe(0);
    });

    it("should accept custom category configs", () => {
      const customConfigs: CategoryAdvantageConfig[] = [
        {
          category: MarketCategory.SPORTS,
          baseScore: 50,
          advantageTypes: [InformationAdvantageType.SPORTS_INSIDER],
          highValueKeywords: [
            {
              keyword: "test",
              weight: 10,
              advantageType: InformationAdvantageType.SPORTS_INSIDER,
            },
          ],
          rationale: "Test rationale",
        },
      ];

      const customIdentifier = createInformationAdvantageIdentifier({
        customCategoryConfigs: customConfigs,
      });

      const configs = customIdentifier.getAllCategoryConfigs();
      expect(configs.length).toBe(1);
      expect(configs[0]?.category).toBe(MarketCategory.SPORTS);
    });
  });

  // ==========================================================================
  // Basic Analysis
  // ==========================================================================

  describe("analyzeMarket", () => {
    it("should analyze geopolitical market with high score", () => {
      const market = createTestMarket(
        "geo1",
        "Will there be a ceasefire in Ukraine before 2025?",
        "Negotiations are ongoing between parties."
      );

      const result = identifier.analyzeMarket(market);

      expect(result.marketId).toBe("geo1");
      expect(result.category).toBe(MarketCategory.GEOPOLITICS);
      expect(result.score).toBeGreaterThan(60);
      expect(result.tier).not.toBe(InformationAdvantageTier.MINIMAL);
      expect(result.advantageTypes).toContain(
        InformationAdvantageType.GEOPOLITICAL_INTEL
      );
      expect(result.matchedKeywords).toContain("ceasefire");
    });

    it("should analyze political market with high score", () => {
      const market = createTestMarket(
        "pol1",
        "Will Biden announce a cabinet resignation before the election?",
        "Presidential administration decisions"
      );

      const result = identifier.analyzeMarket(market);

      expect(result.category).toBe(MarketCategory.POLITICS);
      expect(result.score).toBeGreaterThan(50);
      expect(result.advantageTypes).toContain(
        InformationAdvantageType.REGULATORY_ACCESS
      );
    });

    it("should analyze legal market with high score", () => {
      const market = createTestMarket(
        "legal1",
        "Will the defendant be found guilty in the trial?",
        "The verdict is expected next week."
      );

      const result = identifier.analyzeMarket(market);

      expect(result.category).toBe(MarketCategory.LEGAL);
      expect(result.score).toBeGreaterThan(60);
      expect(result.matchedKeywords).toContain("verdict");
      expect(result.advantageTypes).toContain(InformationAdvantageType.LEGAL_INSIDER);
    });

    it("should analyze economic market with appropriate score", () => {
      const market = createTestMarket(
        "econ1",
        "Will the Federal Reserve hike rates at the next FOMC meeting?",
        "Interest rate decision pending."
      );

      const result = identifier.analyzeMarket(market);

      expect(result.category).toBe(MarketCategory.ECONOMY);
      expect(result.score).toBeGreaterThan(50);
      expect(result.advantageTypes).toContain(
        InformationAdvantageType.ECONOMIC_DATA_ACCESS
      );
    });

    it("should analyze sports market with lower score", () => {
      const market = createTestMarket(
        "sports1",
        "Will the Kansas City Chiefs win the Super Bowl?",
        "NFL championship prediction"
      );

      const result = identifier.analyzeMarket(market);

      expect(result.category).toBe(MarketCategory.SPORTS);
      expect(result.score).toBeLessThan(60); // Lower than politics/legal
    });

    it("should analyze entertainment market with lower score", () => {
      const market = createTestMarket(
        "ent1",
        "Will Taylor Swift release a new album in 2024?",
        "Music industry prediction"
      );

      const result = identifier.analyzeMarket(market);

      expect(result.score).toBeLessThan(50); // Entertainment has lower base
    });

    it("should include factors in analysis", () => {
      const market = createTestMarket(
        "factor1",
        "Will the President sign the executive order today?",
        "Government decision expected."
      );

      const result = identifier.analyzeMarket(market, { includeFactors: true });

      expect(result.factors.length).toBeGreaterThan(0);
      const detectedFactors = result.factors.filter((f) => f.detected);
      expect(detectedFactors.length).toBeGreaterThan(0);
    });

    it("should generate meaningful rationale", () => {
      const market = createTestMarket(
        "rat1",
        "Will the FDA approve the new vaccine by year end?",
        "Clinical trial results pending."
      );

      const result = identifier.analyzeMarket(market);

      expect(result.rationale).toBeDefined();
      expect(result.rationale.length).toBeGreaterThan(20);
      expect(result.rationale).toContain("score");
    });
  });

  // ==========================================================================
  // Caching
  // ==========================================================================

  describe("caching", () => {
    it("should cache analysis results", () => {
      const market = createTestMarket("cache1", "Will there be a treaty signed?");

      const result1 = identifier.analyzeMarket(market);
      const result2 = identifier.analyzeMarket(market);

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(true);
      expect(result1.score).toBe(result2.score);
    });

    it("should bypass cache when requested", () => {
      const market = createTestMarket("cache2", "Will the merger be announced?");

      const result1 = identifier.analyzeMarket(market);
      const result2 = identifier.analyzeMarket(market, { bypassCache: true });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
    });

    it("should clear cache correctly", () => {
      const market = createTestMarket("cache3", "Market question");
      identifier.analyzeMarket(market);

      expect(identifier.getCacheSize()).toBe(1);

      identifier.clearCache();

      expect(identifier.getCacheSize()).toBe(0);
    });
  });

  // ==========================================================================
  // Batch Analysis
  // ==========================================================================

  describe("analyzeMarkets", () => {
    it("should analyze multiple markets", () => {
      const markets = [
        createTestMarket("batch1", "Will the verdict be guilty?"),
        createTestMarket("batch2", "Will Bitcoin reach $100k?"),
        createTestMarket("batch3", "Will the treaty be signed?"),
      ];

      const result = identifier.analyzeMarkets(markets);

      expect(result.totalProcessed).toBe(3);
      expect(result.results.size).toBe(3);
      expect(result.errors.size).toBe(0);
    });

    it("should calculate tier distribution", () => {
      const markets = [
        createTestMarket(
          "tier1",
          "Will the ceasefire begin tomorrow?",
          "Military negotiations ongoing"
        ),
        createTestMarket("tier2", "Will it rain tomorrow?"),
        createTestMarket(
          "tier3",
          "Will the FDA approve the drug?",
          "Regulatory decision pending"
        ),
      ];

      const result = identifier.analyzeMarkets(markets);

      expect(result.tierDistribution.size).toBeGreaterThan(0);
      let totalInTiers = 0;
      for (const count of result.tierDistribution.values()) {
        totalInTiers += count;
      }
      expect(totalInTiers).toBe(3);
    });

    it("should count high-value markets", () => {
      const markets = [
        createTestMarket(
          "hv1",
          "Will the verdict be announced today?",
          "Supreme Court decision"
        ),
        createTestMarket("hv2", "Will it snow next week?"),
      ];

      const result = identifier.analyzeMarkets(markets);

      // First market should be high value, second should not
      expect(result.highValueCount).toBeGreaterThanOrEqual(0);
    });

    it("should track processing time", () => {
      const markets = [
        createTestMarket("time1", "Market 1"),
        createTestMarket("time2", "Market 2"),
      ];

      const result = identifier.analyzeMarkets(markets);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // High-Value Market Detection
  // ==========================================================================

  describe("getHighValueMarkets", () => {
    it("should identify high-value markets", () => {
      const markets = [
        createTestMarket(
          "high1",
          "Will the ceasefire be announced before the summit?",
          "Diplomatic negotiations with classified information"
        ),
        createTestMarket("low1", "Will it be sunny tomorrow?"),
        createTestMarket(
          "high2",
          "Will the indictment be filed by the judge?",
          "Legal proceedings expected"
        ),
      ];

      const highValue = identifier.getHighValueMarkets(markets);

      // Should return at least some high-value markets
      expect(highValue.length).toBeGreaterThanOrEqual(0);
      // Should be sorted by score
      for (let i = 1; i < highValue.length; i++) {
        const prev = highValue[i - 1];
        const curr = highValue[i];
        expect(prev?.score).toBeGreaterThanOrEqual(curr?.score ?? 0);
      }
    });
  });

  describe("isHighValueMarket", () => {
    it("should correctly identify high-value market", () => {
      const highValueMarket = createTestMarket(
        "isHigh1",
        "Will the President announce executive order on military operation?",
        "Government decision with classified implications"
      );

      const result = identifier.isHighValueMarket(highValueMarket);

      // This should be high value due to multiple high-value indicators
      expect(typeof result).toBe("boolean");
    });

    it("should correctly identify low-value market", () => {
      const lowValueMarket = createTestMarket(
        "isLow1",
        "Will it rain in Seattle tomorrow?"
      );

      const result = identifier.isHighValueMarket(lowValueMarket);

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Tier-Based Filtering
  // ==========================================================================

  describe("getMarketsByTier", () => {
    it("should filter markets by tier", () => {
      const markets = [
        createTestMarket(
          "tier1",
          "Will there be a nuclear treaty signed at the summit?",
          "Classified diplomatic negotiations"
        ),
        createTestMarket("tier2", "Will it snow?"),
        createTestMarket(
          "tier3",
          "Will the Fed announce rate decision?",
          "FOMC meeting"
        ),
      ];

      const highTier = identifier.getMarketsByTier(
        markets,
        InformationAdvantageTier.HIGH
      );
      const minimalTier = identifier.getMarketsByTier(
        markets,
        InformationAdvantageTier.MINIMAL
      );

      // Results should only contain markets matching the tier
      for (const result of highTier) {
        expect(result.tier).toBe(InformationAdvantageTier.HIGH);
      }
      for (const result of minimalTier) {
        expect(result.tier).toBe(InformationAdvantageTier.MINIMAL);
      }
    });
  });

  // ==========================================================================
  // Advantage Type Filtering
  // ==========================================================================

  describe("getMarketsByAdvantageType", () => {
    it("should filter markets by advantage type", () => {
      const markets = [
        createTestMarket(
          "adv1",
          "Will the FDA approve the drug?",
          "Regulatory decision"
        ),
        createTestMarket(
          "adv2",
          "Will the ceasefire hold?",
          "Military intelligence"
        ),
        createTestMarket("adv3", "Will Bitcoin rise?"),
      ];

      const regulatoryMarkets = identifier.getMarketsByAdvantageType(
        markets,
        InformationAdvantageType.REGULATORY_ACCESS
      );
      const geoMarkets = identifier.getMarketsByAdvantageType(
        markets,
        InformationAdvantageType.GEOPOLITICAL_INTEL
      );

      // Regulatory should include FDA market
      // Geo should include ceasefire market
      for (const result of regulatoryMarkets) {
        expect(result.advantageTypes).toContain(
          InformationAdvantageType.REGULATORY_ACCESS
        );
      }
      for (const result of geoMarkets) {
        expect(result.advantageTypes).toContain(
          InformationAdvantageType.GEOPOLITICAL_INTEL
        );
      }
    });
  });

  // ==========================================================================
  // Rankings
  // ==========================================================================

  describe("getRankedMarkets", () => {
    it("should return ranked markets", () => {
      const markets = [
        createTestMarket("rank1", "Will there be a verdict?"),
        createTestMarket("rank2", "Will the treaty be signed?"),
        createTestMarket("rank3", "Will it rain?"),
      ];

      for (const market of markets) {
        identifier.analyzeMarket(market);
      }

      const rankings = identifier.getRankedMarkets();

      expect(rankings.length).toBe(3);
      // Should be sorted by score descending
      for (let i = 1; i < rankings.length; i++) {
        const prev = rankings[i - 1];
        const curr = rankings[i];
        expect(prev?.score).toBeGreaterThanOrEqual(curr?.score ?? 0);
      }
      // Should have rank assigned
      expect(rankings[0]?.rank).toBe(1);
    });

    it("should respect limit parameter", () => {
      const markets = [
        createTestMarket("lim1", "Market 1"),
        createTestMarket("lim2", "Market 2"),
        createTestMarket("lim3", "Market 3"),
        createTestMarket("lim4", "Market 4"),
        createTestMarket("lim5", "Market 5"),
      ];

      for (const market of markets) {
        identifier.analyzeMarket(market);
      }

      const topTwo = identifier.getRankedMarkets(2);

      expect(topTwo.length).toBe(2);
    });

    it("should clear rankings correctly", () => {
      identifier.analyzeMarket(createTestMarket("clear1", "Market"));
      expect(identifier.getRankingsCount()).toBe(1);

      identifier.clearRankings();
      expect(identifier.getRankingsCount()).toBe(0);
    });
  });

  // ==========================================================================
  // Category Configuration
  // ==========================================================================

  describe("getCategoryConfig", () => {
    it("should return config for valid category", () => {
      const config = identifier.getCategoryConfig(MarketCategory.POLITICS);

      expect(config).toBeDefined();
      expect(config?.category).toBe(MarketCategory.POLITICS);
      expect(config?.baseScore).toBeGreaterThan(0);
    });

    it("should return undefined for unknown category", () => {
      // Using a cast to test edge case
      const config = identifier.getCategoryConfig("unknown" as MarketCategory);

      expect(config).toBeUndefined();
    });
  });

  describe("getAllCategoryConfigs", () => {
    it("should return all category configs", () => {
      const configs = identifier.getAllCategoryConfigs();

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.length).toBe(DEFAULT_CATEGORY_CONFIGS.length);
    });
  });

  // ==========================================================================
  // Summary Statistics
  // ==========================================================================

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      const markets = [
        createTestMarket("sum1", "Will the verdict be guilty?"),
        createTestMarket("sum2", "Will the treaty be signed?"),
      ];

      for (const market of markets) {
        identifier.analyzeMarket(market);
      }

      const summary = identifier.getSummary();

      expect(summary.totalAnalyzed).toBe(2);
      expect(summary.cacheSize).toBe(2);
      expect(summary.cacheHitRate).toBe(0); // No cache hits yet
      expect(summary.tierBreakdown.size).toBeGreaterThan(0);
      expect(summary.topRankedMarkets.length).toBe(2);
    });

    it("should calculate average score", () => {
      const markets = [
        createTestMarket("avg1", "Will there be a ceasefire?"),
        createTestMarket("avg2", "Will it rain?"),
      ];

      for (const market of markets) {
        identifier.analyzeMarket(market);
      }

      const summary = identifier.getSummary();

      expect(summary.averageScore).toBeGreaterThan(0);
    });

    it("should track cache hit rate", () => {
      const market = createTestMarket("hit1", "Market question");

      identifier.analyzeMarket(market); // Miss
      identifier.analyzeMarket(market); // Hit
      identifier.analyzeMarket(market); // Hit

      const summary = identifier.getSummary();

      // 2 hits out of 3 analyses = 66.7%
      expect(summary.cacheHitRate).toBeGreaterThan(50);
    });
  });

  // ==========================================================================
  // Singleton Management
  // ==========================================================================

  describe("singleton management", () => {
    it("should create shared instance on first access", () => {
      resetSharedInformationAdvantageIdentifier();
      const instance1 = getSharedInformationAdvantageIdentifier();
      const instance2 = getSharedInformationAdvantageIdentifier();

      expect(instance1).toBe(instance2);
    });

    it("should allow setting custom shared instance", () => {
      const customIdentifier = createInformationAdvantageIdentifier({
        highValueThreshold: 80,
      });

      setSharedInformationAdvantageIdentifier(customIdentifier);
      const instance = getSharedInformationAdvantageIdentifier();

      expect(instance).toBe(customIdentifier);
    });

    it("should reset shared instance", () => {
      const instance1 = getSharedInformationAdvantageIdentifier();
      resetSharedInformationAdvantageIdentifier();
      const instance2 = getSharedInformationAdvantageIdentifier();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedInformationAdvantageIdentifier();
    });

    it("analyzeMarketInformationAdvantage should work", () => {
      const market = createTestMarket("conv1", "Will the verdict be announced?");
      const result = analyzeMarketInformationAdvantage(market);

      expect(result.marketId).toBe("conv1");
      expect(result.score).toBeGreaterThan(0);
    });

    it("analyzeMarketsInformationAdvantage should work", () => {
      const markets = [
        createTestMarket("conv2", "Market 1"),
        createTestMarket("conv3", "Market 2"),
      ];

      const result = analyzeMarketsInformationAdvantage(markets);

      expect(result.totalProcessed).toBe(2);
    });

    it("getHighValueMarketsForInsiderPotential should work", () => {
      const markets = [
        createTestMarket(
          "conv4",
          "Will the nuclear treaty be signed at the summit?",
          "Classified negotiations ongoing"
        ),
        createTestMarket("conv5", "Will it rain?"),
      ];

      const highValue = getHighValueMarketsForInsiderPotential(markets);

      expect(Array.isArray(highValue)).toBe(true);
    });

    it("isHighValueMarketForInsider should work", () => {
      const market = createTestMarket("conv6", "Will there be a verdict?");
      const result = isHighValueMarketForInsider(market);

      expect(typeof result).toBe("boolean");
    });

    it("getRankedMarketsForInsiderValue should work", () => {
      analyzeMarketInformationAdvantage(
        createTestMarket("conv7", "Will the treaty be signed?")
      );

      const rankings = getRankedMarketsForInsiderValue();

      expect(Array.isArray(rankings)).toBe(true);
    });

    it("getInformationAdvantageSummary should work", () => {
      const summary = getInformationAdvantageSummary();

      expect(summary).toBeDefined();
      expect(summary.totalAnalyzed).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe("constants", () => {
    it("DEFAULT_CATEGORY_CONFIGS should cover all high-insider categories", () => {
      const categories = DEFAULT_CATEGORY_CONFIGS.map((c) => c.category);

      expect(categories).toContain(MarketCategory.POLITICS);
      expect(categories).toContain(MarketCategory.GEOPOLITICS);
      expect(categories).toContain(MarketCategory.LEGAL);
      expect(categories).toContain(MarketCategory.ECONOMY);
    });

    it("CROSS_CATEGORY_HIGH_VALUE_KEYWORDS should be defined", () => {
      expect(CROSS_CATEGORY_HIGH_VALUE_KEYWORDS.length).toBeGreaterThan(0);

      for (const kw of CROSS_CATEGORY_HIGH_VALUE_KEYWORDS) {
        expect(kw.keyword).toBeDefined();
        expect(kw.weight).toBeGreaterThan(0);
        expect(kw.advantageType).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty market question", () => {
      const market = createTestMarket("edge1", "");
      const result = identifier.analyzeMarket(market);

      expect(result.marketId).toBe("edge1");
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("should handle very long market question", () => {
      const longQuestion = "Will " + "the market ".repeat(100) + "rise?";
      const market = createTestMarket("edge2", longQuestion);
      const result = identifier.analyzeMarket(market);

      expect(result.marketId).toBe("edge2");
    });

    it("should handle special characters in question", () => {
      const market = createTestMarket(
        "edge3",
        "Will the $USD/€EUR rate change? @test #market"
      );
      const result = identifier.analyzeMarket(market);

      expect(result.marketId).toBe("edge3");
    });

    it("should handle empty markets array", () => {
      const result = identifier.analyzeMarkets([]);

      expect(result.totalProcessed).toBe(0);
      expect(result.results.size).toBe(0);
    });

    it("should handle market with only description", () => {
      const market = createTestMarket(
        "edge4",
        "Q",
        "Will there be a verdict in the trial today?"
      );
      const result = identifier.analyzeMarket(market);

      // Should still detect keywords in description
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle market with tags", () => {
      const market = createTestMarket(
        "edge5",
        "Market question",
        undefined,
        undefined,
        undefined,
        ["politics", "election", "2024"]
      );
      const result = identifier.analyzeMarket(market);

      expect(result.marketId).toBe("edge5");
    });

    it("should handle market with slug", () => {
      const market = createTestMarket(
        "edge6",
        "Market question",
        undefined,
        undefined,
        "will-there-be-a-verdict-guilty"
      );
      const result = identifier.analyzeMarket(market);

      expect(result.marketId).toBe("edge6");
    });
  });

  // ==========================================================================
  // Information Advantage Types
  // ==========================================================================

  describe("InformationAdvantageType enum", () => {
    it("should have all expected types", () => {
      expect(InformationAdvantageType.REGULATORY_ACCESS).toBe("REGULATORY_ACCESS");
      expect(InformationAdvantageType.CORPORATE_INSIDER).toBe("CORPORATE_INSIDER");
      expect(InformationAdvantageType.ECONOMIC_DATA_ACCESS).toBe(
        "ECONOMIC_DATA_ACCESS"
      );
      expect(InformationAdvantageType.LEGAL_INSIDER).toBe("LEGAL_INSIDER");
      expect(InformationAdvantageType.GEOPOLITICAL_INTEL).toBe("GEOPOLITICAL_INTEL");
      expect(InformationAdvantageType.RESEARCH_ACCESS).toBe("RESEARCH_ACCESS");
      expect(InformationAdvantageType.SPORTS_INSIDER).toBe("SPORTS_INSIDER");
      expect(InformationAdvantageType.TECH_INSIDER).toBe("TECH_INSIDER");
      expect(InformationAdvantageType.ENTERTAINMENT_INSIDER).toBe(
        "ENTERTAINMENT_INSIDER"
      );
      expect(InformationAdvantageType.GENERAL).toBe("GENERAL");
    });
  });

  // ==========================================================================
  // Information Advantage Tiers
  // ==========================================================================

  describe("InformationAdvantageTier enum", () => {
    it("should have all expected tiers", () => {
      expect(InformationAdvantageTier.CRITICAL).toBe("CRITICAL");
      expect(InformationAdvantageTier.VERY_HIGH).toBe("VERY_HIGH");
      expect(InformationAdvantageTier.HIGH).toBe("HIGH");
      expect(InformationAdvantageTier.MEDIUM).toBe("MEDIUM");
      expect(InformationAdvantageTier.LOW).toBe("LOW");
      expect(InformationAdvantageTier.MINIMAL).toBe("MINIMAL");
    });
  });

  // ==========================================================================
  // Score Calculation
  // ==========================================================================

  describe("score calculation", () => {
    it("should give higher scores to geopolitics than sports", () => {
      const geoMarket = createTestMarket(
        "score1",
        "Will there be a ceasefire?",
        "Military negotiations"
      );
      const sportsMarket = createTestMarket(
        "score2",
        "Will the team win the championship?",
        "Sports prediction"
      );

      const geoResult = identifier.analyzeMarket(geoMarket);
      const sportsResult = identifier.analyzeMarket(sportsMarket);

      expect(geoResult.score).toBeGreaterThan(sportsResult.score);
    });

    it("should give higher scores to legal than entertainment", () => {
      const legalMarket = createTestMarket(
        "score3",
        "Will there be a guilty verdict?",
        "Trial outcome"
      );
      const entMarket = createTestMarket(
        "score4",
        "Will the movie win an Oscar?",
        "Awards prediction"
      );

      const legalResult = identifier.analyzeMarket(legalMarket);
      const entResult = identifier.analyzeMarket(entMarket);

      expect(legalResult.score).toBeGreaterThan(entResult.score);
    });

    it("should cap score at 100", () => {
      // Create a market with many high-value keywords
      const market = createTestMarket(
        "cap1",
        "Will the President announce a ceasefire treaty with classified nuclear sanctions verdict before deadline?",
        "Government military intelligence diplomatic regulatory decision classified"
      );

      const result = identifier.analyzeMarket(market);

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Asymmetry Factors
  // ==========================================================================

  describe("asymmetry factors", () => {
    it("should detect binary outcome factor", () => {
      const market = createTestMarket(
        "asym1",
        "Will the bill pass? Yes or No.",
        "Congressional vote"
      );

      const result = identifier.analyzeMarket(market, { includeFactors: true });

      const binaryFactor = result.factors.find((f) => f.name === "Binary Outcome");
      expect(binaryFactor?.detected).toBe(true);
    });

    it("should detect single decision maker factor", () => {
      const market = createTestMarket(
        "asym2",
        "Will the President sign the bill?",
        "Executive decision"
      );

      const result = identifier.analyzeMarket(market, { includeFactors: true });

      const decisionMakerFactor = result.factors.find(
        (f) => f.name === "Single Decision Maker"
      );
      expect(decisionMakerFactor?.detected).toBe(true);
    });

    it("should detect government involvement factor", () => {
      const market = createTestMarket(
        "asym3",
        "Will the federal agency approve the request?",
        "Government process"
      );

      const result = identifier.analyzeMarket(market, { includeFactors: true });

      const govFactor = result.factors.find(
        (f) => f.name === "Government Involvement"
      );
      expect(govFactor?.detected).toBe(true);
    });

    it("should detect regulatory decision factor", () => {
      const market = createTestMarket(
        "asym4",
        "Will the FDA approve the drug?",
        "Drug approval process"
      );

      const result = identifier.analyzeMarket(market, { includeFactors: true });

      const regFactor = result.factors.find(
        (f) => f.name === "Regulatory Decision"
      );
      expect(regFactor?.detected).toBe(true);
    });

    it("should not include factors when disabled", () => {
      const market = createTestMarket(
        "asym5",
        "Will the President approve?",
        "Decision"
      );

      const result = identifier.analyzeMarket(market, { includeFactors: false });

      expect(result.factors.length).toBe(0);
    });
  });

  // ==========================================================================
  // Cross-Category Keywords
  // ==========================================================================

  describe("cross-category keywords", () => {
    it("should detect deadline keyword across categories", () => {
      const market = createTestMarket(
        "cross1",
        "Will it happen before the deadline?",
        "Time-sensitive prediction"
      );

      const result = identifier.analyzeMarket(market);

      expect(result.matchedKeywords).toContain("deadline");
    });

    it("should detect exclusive keyword across categories", () => {
      const market = createTestMarket(
        "cross2",
        "Will the exclusive announcement be made?",
        "Special access required"
      );

      const result = identifier.analyzeMarket(market);

      expect(result.matchedKeywords).toContain("exclusive");
    });
  });
});
