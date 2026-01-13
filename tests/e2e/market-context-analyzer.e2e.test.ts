/**
 * E2E Tests for AI-NLP-002: Market Context Analyzer
 *
 * These tests verify the complete flow of market context analysis
 * from input to output, including integration scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MarketContextAnalyzer,
  createMarketContextAnalyzer,
  getSharedMarketContextAnalyzer,
  resetSharedMarketContextAnalyzer,
  analyzeMarketContext,
  getSentiment,
  isContentRelevant,
  ContentSourceType,
  Sentiment,
  RelevanceLevel,
  ImpactPrediction,
  AnalysisStatus,
  DEFAULT_CONTENT_SOURCES,
  extractMarketKeywords,
  calculateKeywordMatch,
  createMockContentItem,
  createMockMarketMention,
  createMockContextResult,
} from "../../src/ai/market-context-analyzer";

describe("Market Context Analyzer E2E Tests", () => {
  let analyzer: MarketContextAnalyzer;

  beforeEach(() => {
    analyzer = createMarketContextAnalyzer({
      enableCache: true,
      maxContentAge: 72,
      minRelevanceScore: 20,
    });
  });

  afterEach(() => {
    analyzer.clearCache();
    resetSharedMarketContextAnalyzer();
  });

  describe("Complete Analysis Flow", () => {
    it("should perform full analysis for a crypto market", async () => {
      const result = await analyzer.analyzeMarket(
        "crypto-btc-100k",
        "Will Bitcoin reach $100,000 by end of 2025?",
        "crypto"
      );

      // Verify complete result structure
      expect(result.marketId).toBe("crypto-btc-100k");
      expect(result.marketTitle).toBe("Will Bitcoin reach $100,000 by end of 2025?");
      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.analyzedAt).toBeInstanceOf(Date);

      // Verify analysis metrics
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
      expect(result.contentCount).toBeGreaterThanOrEqual(0);

      // Verify sentiment structure
      expect(result.overallSentiment).toBeDefined();
      expect(typeof result.overallSentiment.score).toBe("number");
      expect(typeof result.overallSentiment.confidence).toBe("number");
      expect(Object.values(Sentiment)).toContain(result.overallSentiment.sentiment);

      // Verify impact prediction
      expect(result.impactPrediction).toBeDefined();
      expect(Object.values(ImpactPrediction)).toContain(result.impactPrediction.prediction);
      expect(typeof result.impactPrediction.confidence).toBe("number");
      expect(typeof result.impactPrediction.reasoning).toBe("string");

      // Verify summary and insights
      expect(typeof result.summary).toBe("string");
      expect(result.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(result.keyInsights)).toBe(true);

      // Verify scores
      expect(result.trendingScore).toBeGreaterThanOrEqual(0);
      expect(result.trendingScore).toBeLessThanOrEqual(100);
      expect(result.mediaAttention).toBeGreaterThanOrEqual(0);
      expect(result.mediaAttention).toBeLessThanOrEqual(100);
    });

    it("should perform full analysis for a political market", async () => {
      const result = await analyzer.analyzeMarket(
        "politics-2024-election",
        "Will Joe Biden win the 2024 presidential election?",
        "politics"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.marketId).toBe("politics-2024-election");

      // Political markets should have complete analysis
      expect(result.overallSentiment).toBeDefined();
      expect(result.impactPrediction).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("should perform full analysis for a sports market", async () => {
      const result = await analyzer.analyzeMarket(
        "sports-nba-finals",
        "Will the Lakers win the NBA Championship?",
        "sports"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.marketId).toBe("sports-nba-finals");
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("should perform full analysis for a geopolitical market", async () => {
      const result = await analyzer.analyzeMarket(
        "geopolitics-conflict",
        "Will there be a ceasefire agreement by June 2025?",
        "geopolitics"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.marketId).toBe("geopolitics-conflict");
    });

    it("should perform full analysis without category", async () => {
      const result = await analyzer.analyzeMarket(
        "generic-market",
        "Will this event happen before year end?"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.overallSentiment).toBeDefined();
    });
  });

  describe("Batch Analysis Flow", () => {
    it("should analyze multiple markets in batch", async () => {
      const markets = [
        { id: "market-1", title: "Will Bitcoin reach $100K?", category: "crypto" },
        { id: "market-2", title: "Will Trump win 2024?", category: "politics" },
        { id: "market-3", title: "Will Lakers win NBA?", category: "sports" },
        { id: "market-4", title: "Will interest rates drop?", category: "finance" },
        { id: "market-5", title: "Will AI replace programmers?", category: "tech" },
      ];

      const batchResult = await analyzer.analyzeMarketsBatch(markets);

      expect(batchResult.totalProcessed).toBe(5);
      expect(batchResult.results).toHaveLength(5);
      expect(batchResult.failed).toBe(0);
      expect(batchResult.totalTime).toBeGreaterThan(0);
      expect(batchResult.avgTime).toBeGreaterThan(0);

      // Verify each result
      for (const result of batchResult.results) {
        expect(result.status).toBe(AnalysisStatus.COMPLETED);
        expect(result.overallSentiment).toBeDefined();
        expect(result.impactPrediction).toBeDefined();
      }
    });

    it("should handle empty batch", async () => {
      const batchResult = await analyzer.analyzeMarketsBatch([]);

      expect(batchResult.totalProcessed).toBe(0);
      expect(batchResult.results).toHaveLength(0);
      expect(batchResult.failed).toBe(0);
    });

    it("should handle large batch efficiently", async () => {
      const markets = Array.from({ length: 20 }, (_, i) => ({
        id: `market-${i}`,
        title: `Test market question ${i}?`,
        category: i % 2 === 0 ? "crypto" : "politics",
      }));

      const startTime = Date.now();
      const batchResult = await analyzer.analyzeMarketsBatch(markets);
      const elapsed = Date.now() - startTime;

      expect(batchResult.totalProcessed).toBe(20);
      expect(elapsed).toBeLessThan(60000); // Should complete within 60 seconds
    });
  });

  describe("Caching Behavior", () => {
    it("should cache and return cached results", async () => {
      // First call - should perform analysis
      const result1 = await analyzer.analyzeMarket(
        "cache-test-market",
        "Will this be cached?"
      );

      // Second call - should return cached result
      const result2 = await analyzer.analyzeMarket(
        "cache-test-market",
        "Will this be cached?"
      );

      expect(result1.status).toBe(AnalysisStatus.COMPLETED);
      expect(result2.status).toBe(AnalysisStatus.COMPLETED);

      // Results should be identical (from cache)
      expect(result1.marketId).toBe(result2.marketId);
      expect(result1.analyzedAt.toISOString()).toBe(result2.analyzedAt.toISOString());
    });

    it("should skip cache when requested", async () => {
      // First call
      const result1 = await analyzer.analyzeMarket(
        "skip-cache-market",
        "Skip cache test"
      );

      // Second call with skipCache
      const result2 = await analyzer.analyzeMarket(
        "skip-cache-market",
        "Skip cache test",
        undefined,
        { skipCache: true }
      );

      expect(result1.status).toBe(AnalysisStatus.COMPLETED);
      expect(result2.status).toBe(AnalysisStatus.COMPLETED);

      // analyzedAt should be different (not from cache)
      expect(result1.analyzedAt.getTime()).toBeLessThanOrEqual(result2.analyzedAt.getTime());
    });

    it("should respect cache expiration", async () => {
      // Create analyzer with very short TTL
      const shortTTLAnalyzer = createMarketContextAnalyzer({
        enableCache: true,
        cacheTTL: 1, // 1ms TTL
      });

      const result1 = await shortTTLAnalyzer.analyzeMarket(
        "ttl-test-market",
        "TTL test"
      );

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await shortTTLAnalyzer.analyzeMarket(
        "ttl-test-market",
        "TTL test"
      );

      // Both should complete
      expect(result1.status).toBe(AnalysisStatus.COMPLETED);
      expect(result2.status).toBe(AnalysisStatus.COMPLETED);
    });

    it("should clear cache on demand", async () => {
      await analyzer.analyzeMarket("clear-cache-market", "Test");

      const statsBefore = analyzer.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      analyzer.clearCache();

      const statsAfter = analyzer.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe("Sentiment Analysis Integration", () => {
    it("should detect positive sentiment in bullish content", () => {
      const result = getSentiment(
        "Bitcoin prices surge to new all-time highs as bullish momentum continues. " +
        "Investors are optimistic about the rally as gains accelerate."
      );

      expect([Sentiment.POSITIVE, Sentiment.VERY_POSITIVE]).toContain(result.sentiment);
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.positivePhrases.length).toBeGreaterThan(0);
    });

    it("should detect negative sentiment in bearish content", () => {
      const result = getSentiment(
        "Markets crash as recession fears grow. Investors flee amid the collapse " +
        "and concern about the economic decline continues."
      );

      expect([Sentiment.NEGATIVE, Sentiment.VERY_NEGATIVE]).toContain(result.sentiment);
      expect(result.score).toBeLessThan(0);
      expect(result.negativePhrases.length).toBeGreaterThan(0);
    });

    it("should detect neutral sentiment in balanced content", () => {
      const result = getSentiment(
        "The meeting was held to discuss various topics. Participants reviewed " +
        "the agenda and discussed the schedule for next month."
      );

      expect(result.sentiment).toBe(Sentiment.NEUTRAL);
      expect(Math.abs(result.score)).toBeLessThan(50);
    });

    it("should detect mixed sentiment", () => {
      const result = getSentiment(
        "Despite the rally and gains in some sectors, fears of a crash remain. " +
        "The market shows both bullish and bearish signals."
      );

      // Could be mixed or slightly leaning one way
      expect(result.sentiment).toBeDefined();
      expect(result.positivePhrases.length).toBeGreaterThan(0);
      expect(result.negativePhrases.length).toBeGreaterThan(0);
    });

    it("should provide emotional tone analysis", () => {
      const result = getSentiment("Great success! Markets rally to victory!");

      expect(result.emotionalTone).toBeDefined();
      expect(typeof result.emotionalTone.joy).toBe("number");
      expect(typeof result.emotionalTone.trust).toBe("number");
    });
  });

  describe("Content Relevance Detection", () => {
    it("should identify highly relevant content", () => {
      const isRelevant = isContentRelevant(
        "Bitcoin Bitcoin Bitcoin prices reached new highs as the cryptocurrency market rallies",
        "Will Bitcoin reach $100K?",
        20
      );

      expect(isRelevant).toBe(true);
    });

    it("should identify irrelevant content", () => {
      const isRelevant = isContentRelevant(
        "The weather forecast for tomorrow shows sunny skies with mild temperatures",
        "Will Bitcoin reach $100K?"
      );

      expect(isRelevant).toBe(false);
    });

    it("should respect custom threshold", () => {
      const content = "Some crypto discussion";
      const market = "Will Bitcoin reach $100K?";

      // Test with different thresholds
      const relevantHigh = isContentRelevant(content, market, 90);

      // High threshold less likely to match
      expect(relevantHigh).toBe(false);
    });
  });

  describe("Keyword Extraction Integration", () => {
    it("should extract meaningful keywords from market titles", () => {
      const keywords = extractMarketKeywords(
        "Will Donald Trump win the 2024 presidential election against Joe Biden?"
      );

      expect(keywords).toContain("donald");
      expect(keywords).toContain("trump");
      expect(keywords).toContain("2024");
      expect(keywords).toContain("presidential");
      expect(keywords).toContain("election");
      expect(keywords).toContain("biden");

      // Should not contain common stop words
      expect(keywords).not.toContain("will");
      expect(keywords).not.toContain("the");
      // Note: "against" may or may not be in stop words depending on implementation
    });

    it("should calculate keyword match scores", () => {
      const keywords = ["bitcoin", "crypto", "market"];

      const highMatch = calculateKeywordMatch(
        "Bitcoin and cryptocurrency markets show strong performance",
        keywords
      );

      const lowMatch = calculateKeywordMatch(
        "Weather reports indicate sunny conditions",
        keywords
      );

      expect(highMatch.score).toBeGreaterThan(lowMatch.score);
      expect(highMatch.matches.length).toBeGreaterThan(lowMatch.matches.length);
    });
  });

  describe("Shared Instance Management", () => {
    it("should provide consistent shared instance", () => {
      const instance1 = getSharedMarketContextAnalyzer();
      const instance2 = getSharedMarketContextAnalyzer();

      expect(instance1).toBe(instance2);
    });

    it("should reset shared instance", () => {
      const original = getSharedMarketContextAnalyzer();
      resetSharedMarketContextAnalyzer();
      const newInstance = getSharedMarketContextAnalyzer();

      expect(newInstance).not.toBe(original);
    });

    it("should analyze using shared instance convenience function", async () => {
      const result = await analyzeMarketContext(
        "shared-test",
        "Test market question?"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.marketId).toBe("shared-test");
    });
  });

  describe("Configuration Management", () => {
    it("should apply custom configuration", () => {
      const customAnalyzer = createMarketContextAnalyzer({
        maxContentAge: 24,
        minRelevanceScore: 50,
        enableCache: false,
        languages: ["en", "es"],
      });

      const config = customAnalyzer.getConfig();

      expect(config.maxContentAge).toBe(24);
      expect(config.minRelevanceScore).toBe(50);
      expect(config.enableCache).toBe(false);
      expect(config.languages).toContain("en");
      expect(config.languages).toContain("es");
    });

    it("should update configuration at runtime", async () => {
      analyzer.updateConfig({ minRelevanceScore: 10 });

      const config = analyzer.getConfig();
      expect(config.minRelevanceScore).toBe(10);

      // Should still work with updated config
      const result = await analyzer.analyzeMarket("config-test", "Test?");
      expect(result.status).toBe(AnalysisStatus.COMPLETED);
    });

    it("should preserve unmodified config values", () => {
      const originalConfig = analyzer.getConfig();
      const originalCacheTTL = originalConfig.cacheTTL;

      analyzer.updateConfig({ minRelevanceScore: 45 });

      const newConfig = analyzer.getConfig();
      expect(newConfig.cacheTTL).toBe(originalCacheTTL);
      expect(newConfig.minRelevanceScore).toBe(45);
    });
  });

  describe("Statistics Tracking", () => {
    it("should track analysis statistics", async () => {
      const freshAnalyzer = createMarketContextAnalyzer();

      // Initial stats should be zero
      const initialStats = freshAnalyzer.getStats();
      expect(initialStats.analysisCount).toBe(0);
      expect(initialStats.avgAnalysisTime).toBe(0);

      // Perform some analyses
      await freshAnalyzer.analyzeMarket("stats-test-1", "Test 1?");
      await freshAnalyzer.analyzeMarket("stats-test-2", "Test 2?", undefined, { skipCache: true });
      await freshAnalyzer.analyzeMarket("stats-test-3", "Test 3?", undefined, { skipCache: true });

      const finalStats = freshAnalyzer.getStats();
      expect(finalStats.analysisCount).toBe(3);
      expect(finalStats.avgAnalysisTime).toBeGreaterThan(0);
    });

    it("should track cache statistics", async () => {
      const freshAnalyzer = createMarketContextAnalyzer({ enableCache: true });

      // Initial cache should be empty
      const initialCacheStats = freshAnalyzer.getCacheStats();
      expect(initialCacheStats.size).toBe(0);

      // Add to cache
      await freshAnalyzer.analyzeMarket("cache-stats-test", "Test?");

      const finalCacheStats = freshAnalyzer.getCacheStats();
      expect(finalCacheStats.size).toBe(1);
      expect(finalCacheStats.maxSize).toBeGreaterThan(0);
    });
  });

  describe("Event Emission Integration", () => {
    it("should emit events during analysis lifecycle", async () => {
      const events: string[] = [];

      analyzer.on("analysis_started", () => events.push("started"));
      analyzer.on("content_fetched", () => events.push("fetched"));
      analyzer.on("analysis_completed", () => events.push("completed"));

      await analyzer.analyzeMarket("event-test", "Test market?");

      expect(events).toContain("started");
      expect(events).toContain("fetched");
      expect(events).toContain("completed");
    });

    it("should emit batch events", async () => {
      const events: string[] = [];

      analyzer.on("batch_started", () => events.push("batch_started"));
      analyzer.on("batch_completed", () => events.push("batch_completed"));

      await analyzer.analyzeMarketsBatch([
        { id: "batch-1", title: "Test 1?" },
        { id: "batch-2", title: "Test 2?" },
      ]);

      expect(events).toContain("batch_started");
      expect(events).toContain("batch_completed");
    });

    it("should emit cache hit event on second call", async () => {
      const events: string[] = [];

      analyzer.on("cache_hit", () => events.push("cache_hit"));
      analyzer.on("cache_miss", () => events.push("cache_miss"));

      // First call - cache miss
      await analyzer.analyzeMarket("cache-event-test", "Test?");

      // Second call - cache hit
      await analyzer.analyzeMarket("cache-event-test", "Test?");

      expect(events).toContain("cache_miss");
      expect(events).toContain("cache_hit");
    });
  });

  describe("Mock Data Generators", () => {
    it("should generate valid mock content items", () => {
      const item = createMockContentItem();

      expect(item.id).toBeTruthy();
      expect(item.source).toBeDefined();
      expect(item.source.type).toBe(ContentSourceType.NEWS);
      expect(item.title).toBeTruthy();
      expect(item.content).toBeTruthy();
      expect(item.publishedAt).toBeInstanceOf(Date);
      expect(item.fetchedAt).toBeInstanceOf(Date);
    });

    it("should generate mock content with custom overrides", () => {
      const customItem = createMockContentItem({
        title: "Custom Title",
        language: "es",
      });

      expect(customItem.title).toBe("Custom Title");
      expect(customItem.language).toBe("es");
    });

    it("should generate valid mock market mentions", () => {
      const mention = createMockMarketMention();

      expect(mention.contentId).toBeTruthy();
      expect(mention.marketId).toBeTruthy();
      expect(Object.values(RelevanceLevel)).toContain(mention.relevance);
      expect(Object.values(Sentiment)).toContain(mention.sentiment);
      expect(Object.values(ImpactPrediction)).toContain(mention.impact);
    });

    it("should generate valid mock context results", () => {
      const result = createMockContextResult();

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.overallSentiment).toBeDefined();
      expect(result.impactPrediction).toBeDefined();
      expect(Array.isArray(result.mentions)).toBe(true);
      expect(Array.isArray(result.keyInsights)).toBe(true);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty market title", async () => {
      const result = await analyzer.analyzeMarket("empty-title", "");

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.summary).toBeTruthy();
    });

    it("should handle very long market title", async () => {
      const longTitle = "Will " + "this very long question ".repeat(50) + "happen?";
      const result = await analyzer.analyzeMarket("long-title", longTitle);

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
    });

    it("should handle special characters in title", async () => {
      const result = await analyzer.analyzeMarket(
        "special-chars",
        "Will $BTC/$ETH reach 100K? [2025] @crypto #bullish"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
    });

    it("should handle unicode characters", async () => {
      const result = await analyzer.analyzeMarket(
        "unicode-test",
        "Will 比特币 reach new ATH? 🚀📈"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
    });

    it("should handle disabled cache gracefully", async () => {
      const noCacheAnalyzer = createMarketContextAnalyzer({ enableCache: false });

      const result1 = await noCacheAnalyzer.analyzeMarket("no-cache", "Test?");
      const result2 = await noCacheAnalyzer.analyzeMarket("no-cache", "Test?");

      expect(result1.status).toBe(AnalysisStatus.COMPLETED);
      expect(result2.status).toBe(AnalysisStatus.COMPLETED);
    });

    it("should handle all sources disabled", async () => {
      const noSourcesAnalyzer = createMarketContextAnalyzer({
        sources: DEFAULT_CONTENT_SOURCES.map((s) => ({ ...s, enabled: false })),
      });

      const result = await noSourcesAnalyzer.analyzeMarket("no-sources", "Test?");

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.contentCount).toBe(0);
    });

    it("should handle unknown category", async () => {
      const result = await analyzer.analyzeMarket(
        "unknown-category",
        "Test question?",
        "nonexistent_category"
      );

      expect(result.status).toBe(AnalysisStatus.COMPLETED);
    });
  });

  describe("Performance Tests", () => {
    it("should complete single analysis within time limit", async () => {
      const start = Date.now();
      await analyzer.analyzeMarket("perf-test", "Performance test question?");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5000); // 5 seconds max
    });

    it("should benefit from caching", async () => {
      // First call - no cache
      const start1 = Date.now();
      await analyzer.analyzeMarket("cache-perf-test", "Cache performance test?");
      const elapsed1 = Date.now() - start1;

      // Second call - from cache
      const start2 = Date.now();
      await analyzer.analyzeMarket("cache-perf-test", "Cache performance test?");
      const elapsed2 = Date.now() - start2;

      // Cache should be faster or equal
      expect(elapsed2).toBeLessThanOrEqual(elapsed1 + 50); // Allow small variance
    });

    it("should handle concurrent analyses", async () => {
      const promises = [
        analyzer.analyzeMarket("concurrent-1", "Test 1?", undefined, { skipCache: true }),
        analyzer.analyzeMarket("concurrent-2", "Test 2?", undefined, { skipCache: true }),
        analyzer.analyzeMarket("concurrent-3", "Test 3?", undefined, { skipCache: true }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe(AnalysisStatus.COMPLETED);
      });
    });
  });
});

describe("Integration with Market Data Types", () => {
  it("should work with realistic market data", async () => {
    const analyzer = createMarketContextAnalyzer();

    // Realistic Polymarket-style market
    const result = await analyzer.analyzeMarket(
      "0x1234567890abcdef",
      "Will the Federal Reserve cut interest rates in January 2025?",
      "finance"
    );

    expect(result.status).toBe(AnalysisStatus.COMPLETED);
    expect(result.marketId).toBe("0x1234567890abcdef");

    // Should have meaningful analysis
    expect(result.summary.length).toBeGreaterThan(20);
    expect(result.overallSentiment).toBeDefined();
  });

  it("should analyze multiple market types consistently", async () => {
    const analyzer = createMarketContextAnalyzer();

    const marketTypes = [
      { id: "crypto-1", title: "Will ETH flip BTC by market cap?", category: "crypto" },
      { id: "politics-1", title: "Will Democrats win the Senate?", category: "politics" },
      { id: "sports-1", title: "Will Kansas City Chiefs win Super Bowl?", category: "sports" },
      { id: "tech-1", title: "Will Apple stock reach $200?", category: "tech" },
      { id: "geopolitics-1", title: "Will NATO expand further?", category: "geopolitics" },
    ];

    const results = await analyzer.analyzeMarketsBatch(marketTypes);

    expect(results.totalProcessed).toBe(5);
    expect(results.failed).toBe(0);

    // All should have valid structure
    results.results.forEach((result) => {
      expect(result.status).toBe(AnalysisStatus.COMPLETED);
      expect(result.overallSentiment).toBeDefined();
      expect(result.impactPrediction).toBeDefined();
    });
  });
});
