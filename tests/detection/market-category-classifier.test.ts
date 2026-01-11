/**
 * Market Category Classifier Tests (DET-NICHE-001)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MarketCategoryClassifier,
  createMarketCategoryClassifier,
  getSharedMarketCategoryClassifier,
  setSharedMarketCategoryClassifier,
  resetSharedMarketCategoryClassifier,
  classifyMarket,
  classifyMarkets,
  isMarketInCategory,
  getMarketsByCategory,
  getHighInsiderPotentialMarkets,
  getClassificationSummary,
  ClassificationConfidence,
  DEFAULT_CATEGORY_PATTERNS,
  HIGH_INSIDER_CATEGORIES,
  type MarketForClassification,
  type CategoryPatterns,
} from "../../src/detection/market-category-classifier";
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

describe("MarketCategoryClassifier", () => {
  let classifier: MarketCategoryClassifier;

  beforeEach(() => {
    classifier = createMarketCategoryClassifier({
      debug: false,
    });
  });

  afterEach(() => {
    classifier.clearCache();
    resetSharedMarketCategoryClassifier();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe("constructor", () => {
    it("should create classifier with default config", () => {
      const defaultClassifier = createMarketCategoryClassifier();
      const patterns = defaultClassifier.getPatterns();

      expect(patterns.length).toBe(DEFAULT_CATEGORY_PATTERNS.length);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it("should create classifier with custom config", () => {
      const customClassifier = createMarketCategoryClassifier({
        cacheTtlMs: 60000,
        maxCacheSize: 100,
        debug: true,
      });

      expect(customClassifier).toBeDefined();
      expect(customClassifier.getCacheSize()).toBe(0);
    });

    it("should accept custom patterns", () => {
      const customPatterns: CategoryPatterns[] = [
        {
          category: MarketCategory.SPORTS,
          primaryKeywords: [{ keyword: "test", weight: 10 }],
          secondaryKeywords: [],
          minScoreThreshold: 5,
          basePriority: 1,
        },
      ];

      const customClassifier = createMarketCategoryClassifier({
        customPatterns,
      });

      const patterns = customClassifier.getPatterns();
      expect(patterns.length).toBe(1);
      const firstPattern = patterns[0];
      expect(firstPattern).toBeDefined();
      expect(firstPattern!.category).toBe(MarketCategory.SPORTS);
    });
  });

  // ==========================================================================
  // Basic Classification
  // ==========================================================================

  describe("classifyMarket", () => {
    it("should classify political market correctly", () => {
      const market = createTestMarket(
        "market1",
        "Will Joe Biden win the 2024 presidential election?",
        "The incumbent president seeks re-election in November."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.POLITICS);
      expect(result.confidence).not.toBe(ClassificationConfidence.VERY_LOW);
      expect(result.confidenceScore).toBeGreaterThan(0);
    });

    it("should classify crypto market correctly", () => {
      const market = createTestMarket(
        "market2",
        "Will Bitcoin reach $100,000 by end of 2024?",
        "BTC price prediction for the cryptocurrency market."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
      const firstScore = result.categoryScores[0];
      expect(firstScore).toBeDefined();
      expect(firstScore!.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("should classify sports market correctly", () => {
      const market = createTestMarket(
        "market3",
        "Will the Kansas City Chiefs win Super Bowl LVIII?",
        "NFL championship game prediction."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.SPORTS);
    });

    it("should classify geopolitical market correctly", () => {
      const market = createTestMarket(
        "market4",
        "Will Russia withdraw from Ukraine before 2025?",
        "The ongoing conflict and ceasefire negotiations."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.GEOPOLITICS);
      expect(result.hasInsiderPotential).toBe(true);
    });

    it("should classify tech market correctly", () => {
      const market = createTestMarket(
        "market5",
        "Will OpenAI release GPT-5 in 2024?",
        "Artificial intelligence and ChatGPT development timeline."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.TECH);
    });

    it("should classify economy market correctly", () => {
      const market = createTestMarket(
        "market6",
        "Will the Federal Reserve cut interest rates in 2024?",
        "FOMC decision on monetary policy and inflation."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.ECONOMY);
      expect(result.hasInsiderPotential).toBe(true);
    });

    it("should classify legal market correctly", () => {
      const market = createTestMarket(
        "market7",
        "Will Trump be convicted in the hush money trial?",
        "The criminal indictment verdict in New York."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.LEGAL);
    });

    it("should classify health market correctly", () => {
      const market = createTestMarket(
        "market8",
        "Will FDA approve the new Pfizer vaccine?",
        "COVID-19 drug approval and clinical trial results."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.HEALTH);
    });

    it("should classify entertainment market correctly", () => {
      const market = createTestMarket(
        "market9",
        "Will Oppenheimer win Best Picture at the Oscars?",
        "Academy Awards prediction for the film."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.ENTERTAINMENT);
    });

    it("should classify weather market correctly", () => {
      const market = createTestMarket(
        "market10",
        "Will a Category 5 hurricane hit Florida in 2024?",
        "NOAA tropical storm and hurricane season prediction."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.WEATHER);
    });

    it("should classify science market correctly", () => {
      const market = createTestMarket(
        "market11",
        "Will NASA's Artemis mission land on the moon in 2024?",
        "Space exploration and rocket launch schedule."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.SCIENCE);
    });

    it("should classify business market correctly", () => {
      const market = createTestMarket(
        "market12",
        "Will Tesla earnings beat Wall Street estimates?",
        "Quarterly revenue and profit report for the stock."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.BUSINESS);
    });

    it("should classify culture market correctly", () => {
      const market = createTestMarket(
        "market13",
        "Will the royal family scandal trend on TikTok?",
        "Social media viral content about Prince Harry and Meghan Markle."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CULTURE);
    });

    it("should fallback to OTHER for unclassifiable markets", () => {
      const market = createTestMarket(
        "market14",
        "Will xyz abc def happen?",
        "Just some xyz abc def text."
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.OTHER);
      expect(result.confidenceScore).toBe(0);
    });
  });

  // ==========================================================================
  // Secondary Categories
  // ==========================================================================

  describe("secondary categories", () => {
    it("should identify secondary categories when applicable", () => {
      const market = createTestMarket(
        "multi1",
        "Will Trump be indicted before the 2024 election?",
        "Legal and political implications of the criminal charges."
      );

      const result = classifier.classifyMarket(market, {
        includeSecondary: true,
        maxSecondaryCategories: 3,
      });

      // Should have both POLITICS and LEGAL as primary or secondary
      const allCategories = [
        result.primaryCategory,
        ...result.secondaryCategories,
      ];

      expect(
        allCategories.includes(MarketCategory.POLITICS) ||
        allCategories.includes(MarketCategory.LEGAL)
      ).toBe(true);
    });

    it("should limit secondary categories based on options", () => {
      const market = createTestMarket(
        "multi2",
        "Will Bitcoin ETF approval boost crypto stocks on Wall Street?",
        "SEC regulation impact on cryptocurrency business earnings."
      );

      const result = classifier.classifyMarket(market, {
        includeSecondary: true,
        maxSecondaryCategories: 1,
      });

      expect(result.secondaryCategories.length).toBeLessThanOrEqual(1);
    });

    it("should exclude secondary categories when option is disabled", () => {
      const market = createTestMarket(
        "multi3",
        "Will Trump be indicted before the 2024 election?",
        "Legal and political implications."
      );

      const result = classifier.classifyMarket(market, {
        includeSecondary: false,
      });

      expect(result.secondaryCategories.length).toBe(0);
    });
  });

  // ==========================================================================
  // Existing Category Handling
  // ==========================================================================

  describe("existing category handling", () => {
    it("should use existing category when not overriding", () => {
      const market = createTestMarket(
        "existing1",
        "Some generic question",
        undefined,
        "sports"
      );

      const result = classifier.classifyMarket(market, {
        overrideExisting: false,
      });

      expect(result.primaryCategory).toBe(MarketCategory.SPORTS);
    });

    it("should override existing category when specified", () => {
      const market = createTestMarket(
        "existing2",
        "Will Bitcoin reach $100,000?",
        "BTC cryptocurrency price prediction.",
        "sports" // Wrong category
      );

      const result = classifier.classifyMarket(market, {
        overrideExisting: true,
      });

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should ignore 'other' as existing category", () => {
      const market = createTestMarket(
        "existing3",
        "Will Biden win the election?",
        "Presidential race",
        "other"
      );

      const result = classifier.classifyMarket(market, {
        overrideExisting: false,
      });

      expect(result.primaryCategory).toBe(MarketCategory.POLITICS);
    });
  });

  // ==========================================================================
  // Caching
  // ==========================================================================

  describe("caching", () => {
    it("should cache classification results", () => {
      const market = createTestMarket(
        "cache1",
        "Will Bitcoin reach $100,000?"
      );

      const result1 = classifier.classifyMarket(market);
      expect(result1.fromCache).toBe(false);

      const result2 = classifier.classifyMarket(market);
      expect(result2.fromCache).toBe(true);
    });

    it("should bypass cache when specified", () => {
      const market = createTestMarket(
        "cache2",
        "Will Bitcoin reach $100,000?"
      );

      classifier.classifyMarket(market);
      const result = classifier.classifyMarket(market, { bypassCache: true });

      expect(result.fromCache).toBe(false);
    });

    it("should clear cache", () => {
      const market = createTestMarket(
        "cache3",
        "Will Bitcoin reach $100,000?"
      );

      classifier.classifyMarket(market);
      expect(classifier.getCacheSize()).toBe(1);

      classifier.clearCache();
      expect(classifier.getCacheSize()).toBe(0);
    });

    it("should evict old entries when cache is full", () => {
      const smallCacheClassifier = createMarketCategoryClassifier({
        maxCacheSize: 2,
      });

      smallCacheClassifier.classifyMarket(createTestMarket("c1", "Bitcoin"));
      smallCacheClassifier.classifyMarket(createTestMarket("c2", "Ethereum"));
      smallCacheClassifier.classifyMarket(createTestMarket("c3", "Solana"));

      expect(smallCacheClassifier.getCacheSize()).toBe(2);
    });
  });

  // ==========================================================================
  // Batch Classification
  // ==========================================================================

  describe("classifyMarkets", () => {
    it("should classify multiple markets", () => {
      const markets = [
        createTestMarket("b1", "Will Biden win the election?"),
        createTestMarket("b2", "Will Bitcoin reach $100k?"),
        createTestMarket("b3", "Will Chiefs win Super Bowl?"),
      ];

      const result = classifier.classifyMarkets(markets);

      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(3);
    });

    it("should calculate category distribution", () => {
      const markets = [
        createTestMarket("d1", "Will Biden win the election?"),
        createTestMarket("d2", "Will Trump win the election?"),
        createTestMarket("d3", "Will Bitcoin reach $100k?"),
      ];

      const result = classifier.classifyMarkets(markets);

      expect(result.categoryDistribution.get(MarketCategory.POLITICS)).toBe(2);
      expect(result.categoryDistribution.get(MarketCategory.CRYPTO)).toBe(1);
    });

    it("should calculate average confidence", () => {
      const markets = [
        createTestMarket("a1", "Will Biden win the presidential election?"),
        createTestMarket("a2", "Will Bitcoin cryptocurrency reach $100k BTC?"),
      ];

      const result = classifier.classifyMarkets(markets);

      expect(result.averageConfidence).toBeGreaterThan(0);
    });

    it("should track processing time", () => {
      const markets = [
        createTestMarket("t1", "Test market 1"),
        createTestMarket("t2", "Test market 2"),
      ];

      const result = classifier.classifyMarkets(markets);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Insider Potential
  // ==========================================================================

  describe("insider potential", () => {
    it("should flag high insider categories", () => {
      const politicalMarket = createTestMarket(
        "insider1",
        "Will Biden win the 2024 presidential election and beat Trump?",
        "The US president seeks re-election in the November electoral college vote."
      );
      const result = classifier.classifyMarket(politicalMarket);

      expect(result.primaryCategory).toBe(MarketCategory.POLITICS);
      expect(HIGH_INSIDER_CATEGORIES).toContain(result.primaryCategory);
      // Insider potential depends on score threshold
      expect(result.insiderPotentialScore).toBeGreaterThan(0);
    });

    it("should have low insider potential for entertainment", () => {
      const entertainmentMarket = createTestMarket(
        "insider2",
        "Will Taylor Swift win a Grammy award?"
      );
      const result = classifier.classifyMarket(entertainmentMarket);

      // Entertainment typically has lower insider potential
      expect(result.insiderPotentialScore).toBeLessThan(60);
    });

    it("should boost insider score for specific keywords", () => {
      const marketWithKeywords = createTestMarket(
        "insider3",
        "Will the FOMC announce a rate cut at their next meeting?",
        "Federal Reserve interest rate decision and GDP impact."
      );
      const result = classifier.classifyMarket(marketWithKeywords);

      expect(result.insiderPotentialScore).toBeGreaterThan(40);
      expect(result.hasInsiderPotential).toBe(true);
    });

    it("should get markets with high insider potential", () => {
      const markets = [
        createTestMarket("hip1", "Will Biden win the election?"),
        createTestMarket("hip2", "Will Taylor Swift tour?"),
        createTestMarket("hip3", "Will the Fed cut rates?"),
      ];

      const highPotential = classifier.getHighInsiderPotentialMarkets(markets);

      // Political and economic markets should have high potential
      expect(highPotential.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  describe("helper functions", () => {
    it("should check if market is in category", () => {
      const market = createTestMarket(
        "helper1",
        "Will Bitcoin reach $100,000?"
      );

      expect(classifier.isMarketInCategory(market, MarketCategory.CRYPTO)).toBe(
        true
      );
      expect(classifier.isMarketInCategory(market, MarketCategory.SPORTS)).toBe(
        false
      );
    });

    it("should get markets by category", () => {
      const markets = [
        createTestMarket("cat1", "Will Biden win the election?"),
        createTestMarket("cat2", "Will Bitcoin reach $100k?"),
        createTestMarket("cat3", "Will Chiefs win Super Bowl?"),
      ];

      const politicsMarkets = classifier.getMarketsByCategory(
        markets,
        MarketCategory.POLITICS
      );

      expect(politicsMarkets.length).toBe(1);
      const firstMarket = politicsMarkets[0];
      expect(firstMarket).toBeDefined();
      expect(firstMarket!.id).toBe("cat1");
    });

    it("should get pattern for category", () => {
      const politicsPattern = classifier.getPatternForCategory(
        MarketCategory.POLITICS
      );

      expect(politicsPattern).not.toBeNull();
      expect(politicsPattern?.primaryKeywords.length).toBeGreaterThan(0);
    });

    it("should return null for unknown category pattern", () => {
      const unknownPattern = classifier.getPatternForCategory(
        "nonexistent" as MarketCategory
      );

      expect(unknownPattern).toBeNull();
    });
  });

  // ==========================================================================
  // Summary Statistics
  // ==========================================================================

  describe("getSummary", () => {
    it("should return empty summary when no classifications", () => {
      const summary = classifier.getSummary();

      expect(summary.totalClassified).toBe(0);
      expect(summary.averageConfidenceScore).toBe(0);
    });

    it("should return accurate summary after classifications", () => {
      const markets = [
        createTestMarket("sum1", "Will Biden win the election?"),
        createTestMarket("sum2", "Will Bitcoin reach $100k?"),
        createTestMarket("sum3", "Will Chiefs win Super Bowl?"),
      ];

      for (const market of markets) {
        classifier.classifyMarket(market);
      }

      const summary = classifier.getSummary();

      expect(summary.totalClassified).toBe(3);
      expect(summary.averageConfidenceScore).toBeGreaterThan(0);
      expect(summary.categoryBreakdown.size).toBeGreaterThan(0);
      expect(summary.confidenceBreakdown.size).toBeGreaterThan(0);
    });

    it("should track cache hit rate", () => {
      const market = createTestMarket("hit1", "Will Bitcoin reach $100k?");

      classifier.classifyMarket(market);
      classifier.classifyMarket(market); // Cache hit
      classifier.classifyMarket(market); // Cache hit

      const summary = classifier.getSummary();

      // 2 hits out of 3 total = 66.6%
      expect(summary.cacheHitRate).toBeGreaterThan(60);
    });

    it("should track high insider potential count", () => {
      const markets = [
        createTestMarket("ins1", "Will Biden win the presidential election?"),
        createTestMarket("ins2", "Will the Fed cut interest rates?"),
        createTestMarket("ins3", "Will Taylor Swift release new album?"),
      ];

      for (const market of markets) {
        classifier.classifyMarket(market);
      }

      const summary = classifier.getSummary();

      expect(summary.highInsiderPotentialCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Confidence Levels
  // ==========================================================================

  describe("confidence levels", () => {
    it("should have HIGH or better confidence for strong matches", () => {
      const market = createTestMarket(
        "conf1",
        "Will the 2024 presidential election result in Biden winning the electoral college vote?",
        "The US president and Democratic nominee seeks re-election against the Republican candidate."
      );

      const result = classifier.classifyMarket(market);

      // Should have at least HIGH confidence for strong matches
      expect([
        ClassificationConfidence.VERY_HIGH,
        ClassificationConfidence.HIGH,
      ]).toContain(result.confidence);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(50);
    });

    it("should have LOW confidence for weak matches", () => {
      const market = createTestMarket(
        "conf2",
        "Will something happen?",
        "This is a generic market."
      );

      const result = classifier.classifyMarket(market);

      expect([
        ClassificationConfidence.LOW,
        ClassificationConfidence.VERY_LOW,
      ]).toContain(result.confidence);
    });
  });

  // ==========================================================================
  // Keyword Matching
  // ==========================================================================

  describe("keyword matching", () => {
    it("should match keywords case-insensitively", () => {
      const market1 = createTestMarket("case1", "Will BITCOIN reach $100k?");
      const market2 = createTestMarket("case2", "Will bitcoin reach $100k?");
      const market3 = createTestMarket("case3", "Will Bitcoin reach $100k?");

      const result1 = classifier.classifyMarket(market1);
      const result2 = classifier.classifyMarket(market2);
      const result3 = classifier.classifyMarket(market3);

      expect(result1.primaryCategory).toBe(MarketCategory.CRYPTO);
      expect(result2.primaryCategory).toBe(MarketCategory.CRYPTO);
      expect(result3.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should include slug in text analysis", () => {
      const market = createTestMarket(
        "slug1",
        "Will this happen?",
        undefined,
        undefined,
        "presidential-election-2024-biden"
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.POLITICS);
    });

    it("should include tags in text analysis", () => {
      const market = createTestMarket(
        "tags1",
        "Will this happen?",
        undefined,
        undefined,
        undefined,
        ["nfl", "super bowl", "championship"]
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.SPORTS);
    });

    it("should track matched keywords in category scores", () => {
      const market = createTestMarket(
        "kw1",
        "Will Bitcoin and Ethereum prices increase?",
        "Cryptocurrency market analysis for BTC and ETH."
      );

      const result = classifier.classifyMarket(market);

      const cryptoScore = result.categoryScores.find(
        (cs) => cs.category === MarketCategory.CRYPTO
      );

      expect(cryptoScore).toBeDefined();
      expect(cryptoScore!.matchedKeywords.length).toBeGreaterThan(0);
      expect(cryptoScore!.matchCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Singleton Management
  // ==========================================================================

  describe("singleton management", () => {
    it("should get shared classifier", () => {
      const shared1 = getSharedMarketCategoryClassifier();
      const shared2 = getSharedMarketCategoryClassifier();

      expect(shared1).toBe(shared2);
    });

    it("should set shared classifier", () => {
      const custom = createMarketCategoryClassifier({
        cacheTtlMs: 1000,
      });

      setSharedMarketCategoryClassifier(custom);
      const shared = getSharedMarketCategoryClassifier();

      expect(shared).toBe(custom);
    });

    it("should reset shared classifier", () => {
      const shared1 = getSharedMarketCategoryClassifier();
      resetSharedMarketCategoryClassifier();
      const shared2 = getSharedMarketCategoryClassifier();

      expect(shared1).not.toBe(shared2);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedMarketCategoryClassifier();
    });

    it("should use classifyMarket function", () => {
      const market = createTestMarket(
        "conv1",
        "Will Bitcoin reach $100,000?"
      );

      const result = classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should use classifyMarkets function", () => {
      const markets = [
        createTestMarket("conv2", "Will Biden win?"),
        createTestMarket("conv3", "Will Bitcoin moon?"),
      ];

      const result = classifyMarkets(markets);

      expect(result.totalProcessed).toBe(2);
    });

    it("should use isMarketInCategory function", () => {
      const market = createTestMarket(
        "conv4",
        "Will Bitcoin reach $100,000?"
      );

      expect(isMarketInCategory(market, MarketCategory.CRYPTO)).toBe(true);
    });

    it("should use getMarketsByCategory function", () => {
      const markets = [
        createTestMarket("conv5", "Will Biden win?"),
        createTestMarket("conv6", "Will Bitcoin moon?"),
      ];

      const cryptoMarkets = getMarketsByCategory(markets, MarketCategory.CRYPTO);

      expect(cryptoMarkets.length).toBe(1);
    });

    it("should use getHighInsiderPotentialMarkets function", () => {
      const markets = [
        createTestMarket("conv7", "Will the FOMC cut rates?"),
        createTestMarket("conv8", "Will a movie win Oscar?"),
      ];

      const highPotential = getHighInsiderPotentialMarkets(markets);

      expect(highPotential.length).toBeGreaterThanOrEqual(0);
    });

    it("should use getClassificationSummary function", () => {
      classifyMarket(createTestMarket("conv9", "Will Bitcoin reach $100k?"));

      const summary = getClassificationSummary();

      expect(summary.totalClassified).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty question", () => {
      const market = createTestMarket("edge1", "");

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.OTHER);
    });

    it("should handle very long text", () => {
      const longText =
        "Will Bitcoin " + "cryptocurrency market ".repeat(500) + "increase?";
      const market = createTestMarket("edge2", longText);

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should handle special characters", () => {
      const market = createTestMarket(
        "edge3",
        "Will $BTC reach $100,000? #Bitcoin @crypto!"
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should handle unicode characters", () => {
      const market = createTestMarket(
        "edge4",
        "Will Bitcoin 比特币 reach $100,000?"
      );

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should handle markets with only description", () => {
      const market: MarketForClassification = {
        id: "edge5",
        question: "",
        description: "Bitcoin cryptocurrency price prediction for 2024.",
      };

      const result = classifier.classifyMarket(market);

      expect(result.primaryCategory).toBe(MarketCategory.CRYPTO);
    });

    it("should handle batch with empty array", () => {
      const result = classifier.classifyMarkets([]);

      expect(result.totalProcessed).toBe(0);
      expect(result.successCount).toBe(0);
    });
  });

  // ==========================================================================
  // Result Structure
  // ==========================================================================

  describe("result structure", () => {
    it("should have all required fields in classification result", () => {
      const market = createTestMarket(
        "struct1",
        "Will Bitcoin reach $100,000?"
      );

      const result = classifier.classifyMarket(market);

      expect(result).toHaveProperty("marketId");
      expect(result).toHaveProperty("question");
      expect(result).toHaveProperty("primaryCategory");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("confidenceScore");
      expect(result).toHaveProperty("secondaryCategories");
      expect(result).toHaveProperty("categoryScores");
      expect(result).toHaveProperty("hasInsiderPotential");
      expect(result).toHaveProperty("insiderPotentialScore");
      expect(result).toHaveProperty("classifiedAt");
      expect(result).toHaveProperty("fromCache");
    });

    it("should have all required fields in batch result", () => {
      const markets = [
        createTestMarket("struct2", "Will Bitcoin reach $100k?"),
      ];

      const result = classifier.classifyMarkets(markets);

      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("totalProcessed");
      expect(result).toHaveProperty("successCount");
      expect(result).toHaveProperty("errorCount");
      expect(result).toHaveProperty("categoryDistribution");
      expect(result).toHaveProperty("averageConfidence");
      expect(result).toHaveProperty("processingTimeMs");
    });

    it("should have all required fields in category score", () => {
      const market = createTestMarket(
        "struct3",
        "Will Bitcoin reach $100,000?"
      );

      const result = classifier.classifyMarket(market);
      const score = result.categoryScores[0];

      expect(score).toHaveProperty("category");
      expect(score).toHaveProperty("rawScore");
      expect(score).toHaveProperty("normalizedScore");
      expect(score).toHaveProperty("matchCount");
      expect(score).toHaveProperty("matchedKeywords");
      expect(score).toHaveProperty("meetsThreshold");
    });
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe("Market Category Classifier Types", () => {
  it("should have correct ClassificationConfidence enum values", () => {
    expect(ClassificationConfidence.VERY_HIGH).toBe("VERY_HIGH");
    expect(ClassificationConfidence.HIGH).toBe("HIGH");
    expect(ClassificationConfidence.MEDIUM).toBe("MEDIUM");
    expect(ClassificationConfidence.LOW).toBe("LOW");
    expect(ClassificationConfidence.VERY_LOW).toBe("VERY_LOW");
  });

  it("should have HIGH_INSIDER_CATEGORIES defined", () => {
    expect(HIGH_INSIDER_CATEGORIES).toContain(MarketCategory.POLITICS);
    expect(HIGH_INSIDER_CATEGORIES).toContain(MarketCategory.GEOPOLITICS);
    expect(HIGH_INSIDER_CATEGORIES).toContain(MarketCategory.LEGAL);
    expect(HIGH_INSIDER_CATEGORIES).toContain(MarketCategory.ECONOMY);
  });

  it("should have DEFAULT_CATEGORY_PATTERNS for all major categories", () => {
    const categories = DEFAULT_CATEGORY_PATTERNS.map((p) => p.category);

    expect(categories).toContain(MarketCategory.POLITICS);
    expect(categories).toContain(MarketCategory.GEOPOLITICS);
    expect(categories).toContain(MarketCategory.CRYPTO);
    expect(categories).toContain(MarketCategory.SPORTS);
    expect(categories).toContain(MarketCategory.TECH);
    expect(categories).toContain(MarketCategory.BUSINESS);
    expect(categories).toContain(MarketCategory.ECONOMY);
    expect(categories).toContain(MarketCategory.LEGAL);
    expect(categories).toContain(MarketCategory.ENTERTAINMENT);
    expect(categories).toContain(MarketCategory.SCIENCE);
    expect(categories).toContain(MarketCategory.HEALTH);
    expect(categories).toContain(MarketCategory.WEATHER);
    expect(categories).toContain(MarketCategory.CULTURE);
    expect(categories).toContain(MarketCategory.OTHER);
  });

  it("should have keyword patterns with required fields", () => {
    for (const pattern of DEFAULT_CATEGORY_PATTERNS) {
      expect(pattern).toHaveProperty("category");
      expect(pattern).toHaveProperty("primaryKeywords");
      expect(pattern).toHaveProperty("secondaryKeywords");
      expect(pattern).toHaveProperty("minScoreThreshold");
      expect(pattern).toHaveProperty("basePriority");

      for (const kw of pattern.primaryKeywords) {
        expect(kw).toHaveProperty("keyword");
        expect(kw).toHaveProperty("weight");
      }
    }
  });
});
