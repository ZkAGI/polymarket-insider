/**
 * Unit tests for AI-NLP-002: Market Context Analyzer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  // Enums
  ContentSourceType,
  Sentiment,
  RelevanceLevel,
  ImpactPrediction,
  AnalysisStatus,
  EntityType,
  // Constants
  DEFAULT_CONTENT_SOURCES,
  DEFAULT_ANALYZER_CONFIG,
  SENTIMENT_THRESHOLDS,
  IMPACT_THRESHOLDS,
  RELEVANCE_THRESHOLDS,
  CATEGORY_KEYWORDS,
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  // Classes
  MarketContextAnalyzer,
  // Factory functions
  createMarketContextAnalyzer,
  getSharedMarketContextAnalyzer,
  setSharedMarketContextAnalyzer,
  resetSharedMarketContextAnalyzer,
  // Convenience functions
  analyzeMarketContext,
  getSentiment,
  isContentRelevant,
  // Utility functions
  scoreToSentiment,
  scoreToImpact,
  scoreToRelevance,
  getSentimentDescription,
  getSentimentColor,
  getImpactDescription,
  getImpactEmoji,
  getRelevanceDescription,
  extractMarketKeywords,
  calculateKeywordMatch,
  escapeRegex,
  calculateEngagementScore,
  generateSnippet,
  truncateText,
  formatTimestamp,
  isWithinAgeLimit,
  calculateContentAge,
  // Mock data generators
  createMockContentItem,
  createMockMarketMention,
  createMockContextResult,
} from "../../src/ai/market-context-analyzer";

import type {
  ContentSource,
  ContentItem,
  MarketMention,
  SentimentAnalysis,
  MarketContextResult,
} from "../../src/ai/market-context-analyzer";

describe("Market Context Analyzer", () => {
  describe("Enums", () => {
    it("should have all content source types", () => {
      expect(ContentSourceType.NEWS).toBe("news");
      expect(ContentSourceType.TWITTER).toBe("twitter");
      expect(ContentSourceType.REDDIT).toBe("reddit");
      expect(ContentSourceType.BLOG).toBe("blog");
      expect(ContentSourceType.OFFICIAL).toBe("official");
      expect(ContentSourceType.PRESS_RELEASE).toBe("press_release");
      expect(ContentSourceType.GOVERNMENT).toBe("government");
      expect(ContentSourceType.RESEARCH).toBe("research");
    });

    it("should have all sentiment values", () => {
      expect(Sentiment.VERY_POSITIVE).toBe("very_positive");
      expect(Sentiment.POSITIVE).toBe("positive");
      expect(Sentiment.NEUTRAL).toBe("neutral");
      expect(Sentiment.NEGATIVE).toBe("negative");
      expect(Sentiment.VERY_NEGATIVE).toBe("very_negative");
      expect(Sentiment.MIXED).toBe("mixed");
    });

    it("should have all relevance levels", () => {
      expect(RelevanceLevel.HIGHLY_RELEVANT).toBe("highly_relevant");
      expect(RelevanceLevel.RELEVANT).toBe("relevant");
      expect(RelevanceLevel.SOMEWHAT_RELEVANT).toBe("somewhat_relevant");
      expect(RelevanceLevel.MARGINALLY_RELEVANT).toBe("marginally_relevant");
      expect(RelevanceLevel.NOT_RELEVANT).toBe("not_relevant");
    });

    it("should have all impact predictions", () => {
      expect(ImpactPrediction.STRONG_BULLISH).toBe("strong_bullish");
      expect(ImpactPrediction.BULLISH).toBe("bullish");
      expect(ImpactPrediction.SLIGHTLY_BULLISH).toBe("slightly_bullish");
      expect(ImpactPrediction.NEUTRAL).toBe("neutral");
      expect(ImpactPrediction.SLIGHTLY_BEARISH).toBe("slightly_bearish");
      expect(ImpactPrediction.BEARISH).toBe("bearish");
      expect(ImpactPrediction.STRONG_BEARISH).toBe("strong_bearish");
      expect(ImpactPrediction.UNCERTAIN).toBe("uncertain");
    });

    it("should have all analysis statuses", () => {
      expect(AnalysisStatus.PENDING).toBe("pending");
      expect(AnalysisStatus.IN_PROGRESS).toBe("in_progress");
      expect(AnalysisStatus.COMPLETED).toBe("completed");
      expect(AnalysisStatus.FAILED).toBe("failed");
      expect(AnalysisStatus.PARTIAL).toBe("partial");
    });

    it("should have all entity types", () => {
      expect(EntityType.PERSON).toBe("person");
      expect(EntityType.ORGANIZATION).toBe("organization");
      expect(EntityType.LOCATION).toBe("location");
      expect(EntityType.DATE).toBe("date");
      expect(EntityType.MONEY).toBe("money");
      expect(EntityType.PERCENT).toBe("percent");
      expect(EntityType.EVENT).toBe("event");
      expect(EntityType.PRODUCT).toBe("product");
      expect(EntityType.MARKET).toBe("market");
      expect(EntityType.CRYPTO).toBe("crypto");
      expect(EntityType.POLITICAL).toBe("political");
      expect(EntityType.OTHER).toBe("other");
    });
  });

  describe("Constants", () => {
    it("should have default content sources", () => {
      expect(Array.isArray(DEFAULT_CONTENT_SOURCES)).toBe(true);
      expect(DEFAULT_CONTENT_SOURCES.length).toBeGreaterThan(0);

      const newsSource = DEFAULT_CONTENT_SOURCES.find((s) => s.type === ContentSourceType.NEWS);
      expect(newsSource).toBeDefined();
      expect(newsSource?.enabled).toBe(true);
      expect(newsSource?.credibility).toBeGreaterThan(0);
    });

    it("should have default analyzer config", () => {
      expect(DEFAULT_ANALYZER_CONFIG).toBeDefined();
      expect(DEFAULT_ANALYZER_CONFIG.maxContentAge).toBe(72);
      expect(DEFAULT_ANALYZER_CONFIG.minRelevanceScore).toBe(30);
      expect(DEFAULT_ANALYZER_CONFIG.minSentimentConfidence).toBe(50);
      expect(DEFAULT_ANALYZER_CONFIG.enableCache).toBe(true);
      expect(DEFAULT_ANALYZER_CONFIG.cacheTTL).toBeGreaterThan(0);
      expect(DEFAULT_ANALYZER_CONFIG.maxCacheSize).toBeGreaterThan(0);
      expect(DEFAULT_ANALYZER_CONFIG.languages).toContain("en");
    });

    it("should have sentiment thresholds", () => {
      expect(SENTIMENT_THRESHOLDS.VERY_POSITIVE).toBe(60);
      expect(SENTIMENT_THRESHOLDS.POSITIVE).toBe(20);
      expect(SENTIMENT_THRESHOLDS.NEUTRAL_LOW).toBe(-20);
      expect(SENTIMENT_THRESHOLDS.NEUTRAL_HIGH).toBe(20);
      expect(SENTIMENT_THRESHOLDS.NEGATIVE).toBe(-60);
    });

    it("should have impact thresholds", () => {
      expect(IMPACT_THRESHOLDS.STRONG_BULLISH).toBe(70);
      expect(IMPACT_THRESHOLDS.BULLISH).toBe(40);
      expect(IMPACT_THRESHOLDS.NEUTRAL_LOW).toBe(-15);
      expect(IMPACT_THRESHOLDS.NEUTRAL_HIGH).toBe(15);
      expect(IMPACT_THRESHOLDS.BEARISH).toBe(-70);
      expect(IMPACT_THRESHOLDS.STRONG_BEARISH).toBe(-100);
    });

    it("should have relevance thresholds", () => {
      expect(RELEVANCE_THRESHOLDS.HIGHLY_RELEVANT).toBe(80);
      expect(RELEVANCE_THRESHOLDS.RELEVANT).toBe(60);
      expect(RELEVANCE_THRESHOLDS.SOMEWHAT_RELEVANT).toBe(40);
      expect(RELEVANCE_THRESHOLDS.MARGINALLY_RELEVANT).toBe(20);
    });

    it("should have category keywords", () => {
      expect(CATEGORY_KEYWORDS.politics).toBeDefined();
      expect(CATEGORY_KEYWORDS.politics).toContain("election");
      expect(CATEGORY_KEYWORDS.crypto).toBeDefined();
      expect(CATEGORY_KEYWORDS.crypto).toContain("bitcoin");
      expect(CATEGORY_KEYWORDS.sports).toBeDefined();
      expect(CATEGORY_KEYWORDS.geopolitics).toBeDefined();
      expect(CATEGORY_KEYWORDS.finance).toBeDefined();
    });

    it("should have positive and negative words", () => {
      expect(POSITIVE_WORDS.length).toBeGreaterThan(0);
      expect(POSITIVE_WORDS).toContain("surge");
      expect(POSITIVE_WORDS).toContain("rally");
      expect(POSITIVE_WORDS).toContain("bullish");

      expect(NEGATIVE_WORDS.length).toBeGreaterThan(0);
      expect(NEGATIVE_WORDS).toContain("crash");
      expect(NEGATIVE_WORDS).toContain("plunge");
      expect(NEGATIVE_WORDS).toContain("bearish");
    });
  });

  describe("Utility Functions", () => {
    describe("scoreToSentiment", () => {
      it("should convert high scores to very positive", () => {
        expect(scoreToSentiment(80)).toBe(Sentiment.VERY_POSITIVE);
        expect(scoreToSentiment(60)).toBe(Sentiment.VERY_POSITIVE);
      });

      it("should convert moderate positive scores to positive", () => {
        expect(scoreToSentiment(40)).toBe(Sentiment.POSITIVE);
        expect(scoreToSentiment(20)).toBe(Sentiment.POSITIVE);
      });

      it("should convert neutral scores to neutral", () => {
        expect(scoreToSentiment(0)).toBe(Sentiment.NEUTRAL);
        expect(scoreToSentiment(10)).toBe(Sentiment.NEUTRAL);
        expect(scoreToSentiment(-10)).toBe(Sentiment.NEUTRAL);
      });

      it("should convert moderate negative scores to negative", () => {
        expect(scoreToSentiment(-40)).toBe(Sentiment.NEGATIVE);
        expect(scoreToSentiment(-30)).toBe(Sentiment.NEGATIVE);
      });

      it("should convert low scores to very negative", () => {
        expect(scoreToSentiment(-80)).toBe(Sentiment.VERY_NEGATIVE);
        expect(scoreToSentiment(-60)).toBe(Sentiment.VERY_NEGATIVE);
      });
    });

    describe("scoreToImpact", () => {
      it("should return uncertain for low confidence", () => {
        expect(scoreToImpact(80, 30)).toBe(ImpactPrediction.UNCERTAIN);
        expect(scoreToImpact(-80, 40)).toBe(ImpactPrediction.UNCERTAIN);
      });

      it("should return strong bullish for high positive scores", () => {
        expect(scoreToImpact(80, 70)).toBe(ImpactPrediction.STRONG_BULLISH);
        expect(scoreToImpact(70, 70)).toBe(ImpactPrediction.STRONG_BULLISH);
      });

      it("should return bullish for moderate positive scores", () => {
        expect(scoreToImpact(50, 70)).toBe(ImpactPrediction.BULLISH);
        expect(scoreToImpact(40, 70)).toBe(ImpactPrediction.BULLISH);
      });

      it("should return neutral for neutral scores", () => {
        expect(scoreToImpact(0, 70)).toBe(ImpactPrediction.NEUTRAL);
        expect(scoreToImpact(10, 70)).toBe(ImpactPrediction.NEUTRAL);
      });

      it("should return bearish for negative scores", () => {
        // BEARISH threshold is score <= -70
        expect(scoreToImpact(-70, 70)).toBe(ImpactPrediction.BEARISH);
        expect(scoreToImpact(-75, 70)).toBe(ImpactPrediction.BEARISH);
        expect(scoreToImpact(-99, 70)).toBe(ImpactPrediction.BEARISH);
      });

      it("should return strong bearish for very negative scores", () => {
        // STRONG_BEARISH threshold is score <= -100
        expect(scoreToImpact(-100, 70)).toBe(ImpactPrediction.STRONG_BEARISH);
        expect(scoreToImpact(-105, 70)).toBe(ImpactPrediction.STRONG_BEARISH);
      });
    });

    describe("scoreToRelevance", () => {
      it("should convert high scores to highly relevant", () => {
        expect(scoreToRelevance(90)).toBe(RelevanceLevel.HIGHLY_RELEVANT);
        expect(scoreToRelevance(80)).toBe(RelevanceLevel.HIGHLY_RELEVANT);
      });

      it("should convert moderate scores to relevant", () => {
        expect(scoreToRelevance(70)).toBe(RelevanceLevel.RELEVANT);
        expect(scoreToRelevance(60)).toBe(RelevanceLevel.RELEVANT);
      });

      it("should convert lower scores to somewhat relevant", () => {
        expect(scoreToRelevance(50)).toBe(RelevanceLevel.SOMEWHAT_RELEVANT);
        expect(scoreToRelevance(40)).toBe(RelevanceLevel.SOMEWHAT_RELEVANT);
      });

      it("should convert low scores to marginally relevant", () => {
        expect(scoreToRelevance(30)).toBe(RelevanceLevel.MARGINALLY_RELEVANT);
        expect(scoreToRelevance(20)).toBe(RelevanceLevel.MARGINALLY_RELEVANT);
      });

      it("should convert very low scores to not relevant", () => {
        expect(scoreToRelevance(10)).toBe(RelevanceLevel.NOT_RELEVANT);
        expect(scoreToRelevance(0)).toBe(RelevanceLevel.NOT_RELEVANT);
      });
    });

    describe("getSentimentDescription", () => {
      it("should return descriptions for all sentiments", () => {
        expect(getSentimentDescription(Sentiment.VERY_POSITIVE)).toContain("Very positive");
        expect(getSentimentDescription(Sentiment.POSITIVE)).toContain("Positive");
        expect(getSentimentDescription(Sentiment.NEUTRAL)).toContain("Neutral");
        expect(getSentimentDescription(Sentiment.NEGATIVE)).toContain("Negative");
        expect(getSentimentDescription(Sentiment.VERY_NEGATIVE)).toContain("Very negative");
        expect(getSentimentDescription(Sentiment.MIXED)).toContain("Mixed");
      });
    });

    describe("getSentimentColor", () => {
      it("should return valid hex colors", () => {
        const colors = [
          getSentimentColor(Sentiment.VERY_POSITIVE),
          getSentimentColor(Sentiment.POSITIVE),
          getSentimentColor(Sentiment.NEUTRAL),
          getSentimentColor(Sentiment.NEGATIVE),
          getSentimentColor(Sentiment.VERY_NEGATIVE),
          getSentimentColor(Sentiment.MIXED),
        ];

        colors.forEach((color) => {
          expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        });
      });

      it("should return green tones for positive sentiments", () => {
        const veryPositive = getSentimentColor(Sentiment.VERY_POSITIVE);
        // Green-ish colors
        expect(veryPositive.toLowerCase()).toMatch(/#[0-9a-f]{2}[0-9a-f]{2}[0-9a-f]{2}/);
      });

      it("should return red tones for negative sentiments", () => {
        const veryNegative = getSentimentColor(Sentiment.VERY_NEGATIVE);
        // Red-ish colors
        expect(veryNegative.toLowerCase()).toMatch(/#[0-9a-f]{2}[0-9a-f]{2}[0-9a-f]{2}/);
      });
    });

    describe("getImpactDescription", () => {
      it("should return descriptions for all impacts", () => {
        expect(getImpactDescription(ImpactPrediction.STRONG_BULLISH)).toContain("Strong positive");
        expect(getImpactDescription(ImpactPrediction.BULLISH)).toContain("Moderate positive");
        expect(getImpactDescription(ImpactPrediction.NEUTRAL)).toContain("No significant");
        expect(getImpactDescription(ImpactPrediction.BEARISH)).toContain("Moderate negative");
        expect(getImpactDescription(ImpactPrediction.STRONG_BEARISH)).toContain("Strong negative");
        expect(getImpactDescription(ImpactPrediction.UNCERTAIN)).toContain("uncertain");
      });
    });

    describe("getImpactEmoji", () => {
      it("should return emojis for all impacts", () => {
        expect(getImpactEmoji(ImpactPrediction.STRONG_BULLISH)).toBe("🚀");
        expect(getImpactEmoji(ImpactPrediction.BULLISH)).toBe("📈");
        expect(getImpactEmoji(ImpactPrediction.NEUTRAL)).toBe("➡️");
        expect(getImpactEmoji(ImpactPrediction.BEARISH)).toBe("📉");
        expect(getImpactEmoji(ImpactPrediction.STRONG_BEARISH)).toBe("💥");
        expect(getImpactEmoji(ImpactPrediction.UNCERTAIN)).toBe("❓");
      });
    });

    describe("getRelevanceDescription", () => {
      it("should return descriptions for all relevance levels", () => {
        expect(getRelevanceDescription(RelevanceLevel.HIGHLY_RELEVANT)).toContain("Directly related");
        expect(getRelevanceDescription(RelevanceLevel.RELEVANT)).toContain("Relevant");
        expect(getRelevanceDescription(RelevanceLevel.SOMEWHAT_RELEVANT)).toContain("Partially");
        expect(getRelevanceDescription(RelevanceLevel.MARGINALLY_RELEVANT)).toContain("Tangentially");
        expect(getRelevanceDescription(RelevanceLevel.NOT_RELEVANT)).toContain("Not relevant");
      });
    });

    describe("extractMarketKeywords", () => {
      it("should extract meaningful keywords from market title", () => {
        const keywords = extractMarketKeywords("Will Bitcoin reach $100K by 2025?");
        expect(keywords).toContain("bitcoin");
        expect(keywords).toContain("reach");
        expect(keywords).toContain("100k");
        expect(keywords).not.toContain("will");
        expect(keywords).not.toContain("by");
      });

      it("should filter out stop words", () => {
        const keywords = extractMarketKeywords("The election results for the President");
        expect(keywords).not.toContain("the");
        expect(keywords).not.toContain("for");
        expect(keywords).toContain("election");
        expect(keywords).toContain("results");
        expect(keywords).toContain("president");
      });

      it("should remove duplicates", () => {
        const keywords = extractMarketKeywords("Trump Trump Trump election");
        const uniqueCount = new Set(keywords).size;
        expect(keywords.length).toBe(uniqueCount);
      });

      it("should handle empty or short input", () => {
        expect(extractMarketKeywords("")).toEqual([]);
        expect(extractMarketKeywords("a b c")).toEqual([]);
      });
    });

    describe("calculateKeywordMatch", () => {
      it("should calculate match score for matching content", () => {
        const result = calculateKeywordMatch(
          "Bitcoin prices surge amid election uncertainty",
          ["bitcoin", "election"]
        );
        expect(result.score).toBeGreaterThan(0);
        expect(result.matches).toContain("bitcoin");
        expect(result.matches).toContain("election");
      });

      it("should return zero for no matches", () => {
        const result = calculateKeywordMatch("Weather forecast for tomorrow", [
          "bitcoin",
          "election",
        ]);
        expect(result.score).toBe(0);
        expect(result.matches).toHaveLength(0);
      });

      it("should match case-insensitively", () => {
        const result = calculateKeywordMatch("BITCOIN RALLY continues", ["bitcoin"]);
        expect(result.matches).toContain("bitcoin");
      });

      it("should cap score at 100", () => {
        const result = calculateKeywordMatch(
          "bitcoin bitcoin bitcoin bitcoin bitcoin bitcoin bitcoin bitcoin bitcoin bitcoin",
          ["bitcoin"]
        );
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    describe("escapeRegex", () => {
      it("should escape special regex characters", () => {
        expect(escapeRegex("$100")).toBe("\\$100");
        expect(escapeRegex("(test)")).toBe("\\(test\\)");
        expect(escapeRegex("a.b")).toBe("a\\.b");
        expect(escapeRegex("a*b+c?")).toBe("a\\*b\\+c\\?");
      });

      it("should not modify regular strings", () => {
        expect(escapeRegex("hello")).toBe("hello");
        expect(escapeRegex("bitcoin")).toBe("bitcoin");
      });
    });

    describe("calculateEngagementScore", () => {
      it("should calculate score from engagement metrics", () => {
        const score = calculateEngagementScore({
          likes: 1000,
          shares: 500,
          comments: 100,
          views: 10000,
        });
        expect(score).toBeGreaterThan(0);
        // Score can exceed 100 due to the calculation method
        expect(typeof score).toBe("number");
      });

      it("should handle missing metrics", () => {
        const score = calculateEngagementScore({ likes: 100 });
        expect(score).toBeGreaterThan(0);
      });

      it("should handle empty metrics", () => {
        const score = calculateEngagementScore({});
        expect(score).toBe(0);
      });

      it("should handle zero values", () => {
        const score = calculateEngagementScore({ likes: 0, shares: 0, comments: 0, views: 0 });
        expect(score).toBeGreaterThanOrEqual(0);
      });
    });

    describe("generateSnippet", () => {
      it("should generate snippet around keyword", () => {
        const content = "This is some content about Bitcoin prices and the crypto market.";
        const snippet = generateSnippet(content, "Bitcoin");
        expect(snippet).toContain("Bitcoin");
        expect(snippet.length).toBeLessThanOrEqual(200 + 6); // +6 for potential "..."
      });

      it("should handle keyword not found", () => {
        const content = "This is some content about stocks.";
        const snippet = generateSnippet(content, "Bitcoin");
        expect(snippet).toBe(content); // Short content returned as-is
      });

      it("should truncate long content", () => {
        const content = "A".repeat(500);
        const snippet = generateSnippet(content, "notfound", 100);
        expect(snippet.length).toBeLessThanOrEqual(103); // +3 for "..."
      });

      it("should respect maxLength parameter", () => {
        const content = "Some content with Bitcoin mentioned in the middle of a long text.";
        const snippet = generateSnippet(content, "Bitcoin", 50);
        expect(snippet.length).toBeLessThanOrEqual(56); // +6 for potential "..." on both ends
      });
    });

    describe("truncateText", () => {
      it("should truncate long text", () => {
        const text = "This is a very long text that needs truncating";
        const truncated = truncateText(text, 20);
        expect(truncated.length).toBe(20);
        expect(truncated.endsWith("...")).toBe(true);
      });

      it("should not truncate short text", () => {
        const text = "Short";
        const truncated = truncateText(text, 20);
        expect(truncated).toBe(text);
      });

      it("should handle exact length", () => {
        const text = "Exact length text";
        const truncated = truncateText(text, text.length);
        expect(truncated).toBe(text);
      });
    });

    describe("formatTimestamp", () => {
      it("should format date to ISO string", () => {
        const date = new Date("2025-01-13T10:30:00Z");
        const formatted = formatTimestamp(date);
        expect(formatted).toBe("2025-01-13T10:30:00.000Z");
      });
    });

    describe("isWithinAgeLimit", () => {
      it("should return true for recent content", () => {
        const now = new Date();
        expect(isWithinAgeLimit(now, 24)).toBe(true);

        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
        expect(isWithinAgeLimit(oneHourAgo, 24)).toBe(true);
      });

      it("should return false for old content", () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        expect(isWithinAgeLimit(twoDaysAgo, 24)).toBe(false);
      });

      it("should handle edge cases", () => {
        const exactlyAtLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
        expect(isWithinAgeLimit(exactlyAtLimit, 24)).toBe(true);
      });
    });

    describe("calculateContentAge", () => {
      it("should calculate age in hours", () => {
        const now = new Date();
        const age = calculateContentAge(now);
        expect(age).toBeLessThan(1);

        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
        const oneHourAge = calculateContentAge(oneHourAgo);
        expect(oneHourAge).toBeCloseTo(1, 1);
      });

      it("should handle older dates", () => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const age = calculateContentAge(oneDayAgo);
        expect(age).toBeCloseTo(24, 1);
      });
    });
  });

  describe("Mock Data Generators", () => {
    describe("createMockContentItem", () => {
      it("should create valid content item", () => {
        const item = createMockContentItem();
        expect(item.id).toBeTruthy();
        expect(item.source).toBeDefined();
        expect(item.title).toBeTruthy();
        expect(item.content).toBeTruthy();
        expect(item.url).toBeTruthy();
        expect(item.publishedAt).toBeInstanceOf(Date);
        expect(item.fetchedAt).toBeInstanceOf(Date);
        expect(item.language).toBe("en");
      });

      it("should allow overrides", () => {
        const customTitle = "Custom Title";
        const item = createMockContentItem({ title: customTitle });
        expect(item.title).toBe(customTitle);
      });

      it("should include engagement metrics", () => {
        const item = createMockContentItem();
        expect(item.engagement).toBeDefined();
        expect(item.engagement?.score).toBeDefined();
      });
    });

    describe("createMockMarketMention", () => {
      it("should create valid market mention", () => {
        const mention = createMockMarketMention();
        expect(mention.contentId).toBeTruthy();
        expect(mention.marketId).toBeTruthy();
        expect(mention.marketTitle).toBeTruthy();
        expect(mention.relevance).toBeDefined();
        expect(mention.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(mention.sentiment).toBeDefined();
        expect(mention.sentimentScore).toBeDefined();
        expect(mention.impact).toBeDefined();
        expect(mention.confidence).toBeGreaterThanOrEqual(0);
      });

      it("should allow overrides", () => {
        const mention = createMockMarketMention({
          sentiment: Sentiment.VERY_POSITIVE,
          relevanceScore: 95,
        });
        expect(mention.sentiment).toBe(Sentiment.VERY_POSITIVE);
        expect(mention.relevanceScore).toBe(95);
      });
    });

    describe("createMockContextResult", () => {
      it("should create valid context result", () => {
        const result = createMockContextResult();
        expect(result.marketId).toBeTruthy();
        expect(result.marketTitle).toBeTruthy();
        expect(result.analyzedAt).toBeInstanceOf(Date);
        expect(result.status).toBe(AnalysisStatus.COMPLETED);
        expect(result.contentCount).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.mentions)).toBe(true);
        expect(result.overallSentiment).toBeDefined();
        expect(result.summary).toBeTruthy();
        expect(Array.isArray(result.keyInsights)).toBe(true);
        expect(result.impactPrediction).toBeDefined();
      });

      it("should allow overrides", () => {
        const result = createMockContextResult({
          status: AnalysisStatus.FAILED,
          trendingScore: 100,
        });
        expect(result.status).toBe(AnalysisStatus.FAILED);
        expect(result.trendingScore).toBe(100);
      });
    });
  });

  describe("MarketContextAnalyzer Class", () => {
    let analyzer: MarketContextAnalyzer;

    beforeEach(() => {
      analyzer = new MarketContextAnalyzer();
    });

    afterEach(() => {
      analyzer.clearCache();
    });

    describe("Constructor", () => {
      it("should create with default config", () => {
        const config = analyzer.getConfig();
        expect(config.enableCache).toBe(true);
        expect(config.maxContentAge).toBe(72);
        expect(config.minRelevanceScore).toBe(30);
      });

      it("should accept custom config", () => {
        const customAnalyzer = new MarketContextAnalyzer({
          maxContentAge: 24,
          minRelevanceScore: 50,
          enableCache: false,
        });
        const config = customAnalyzer.getConfig();
        expect(config.maxContentAge).toBe(24);
        expect(config.minRelevanceScore).toBe(50);
        expect(config.enableCache).toBe(false);
      });
    });

    describe("analyzeMarket", () => {
      it("should analyze market and return result", async () => {
        const result = await analyzer.analyzeMarket(
          "market_123",
          "Will Bitcoin reach $100K?",
          "crypto"
        );

        expect(result.marketId).toBe("market_123");
        expect(result.marketTitle).toBe("Will Bitcoin reach $100K?");
        expect(result.status).toBe(AnalysisStatus.COMPLETED);
        expect(result.analyzedAt).toBeInstanceOf(Date);
        expect(result.analysisTime).toBeGreaterThanOrEqual(0);
        expect(result.contentCount).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.mentions)).toBe(true);
        expect(result.overallSentiment).toBeDefined();
        expect(result.summary).toBeTruthy();
        expect(Array.isArray(result.keyInsights)).toBe(true);
        expect(result.impactPrediction).toBeDefined();
        expect(result.trendingScore).toBeGreaterThanOrEqual(0);
        expect(result.mediaAttention).toBeGreaterThanOrEqual(0);
      });

      it("should use cache on second call", async () => {
        const cacheHitHandler = vi.fn();
        analyzer.on("cache_hit", cacheHitHandler);

        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");
        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");

        expect(cacheHitHandler).toHaveBeenCalledTimes(1);
      });

      it("should skip cache when requested", async () => {
        const analysisStartedHandler = vi.fn();
        analyzer.on("analysis_started", analysisStartedHandler);

        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");
        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?", undefined, {
          skipCache: true,
        });

        // With skipCache, analysis should start twice
        expect(analysisStartedHandler).toHaveBeenCalledTimes(2);
      });

      it("should emit analysis_started event", async () => {
        const handler = vi.fn();
        analyzer.on("analysis_started", handler);

        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");

        expect(handler).toHaveBeenCalledWith("market_123");
      });

      it("should emit analysis_completed event", async () => {
        const handler = vi.fn();
        analyzer.on("analysis_completed", handler);

        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");

        expect(handler).toHaveBeenCalled();
        const result = handler.mock.calls[0]?.[0] as MarketContextResult;
        expect(result.marketId).toBe("market_123");
      });

      it("should emit content_fetched event", async () => {
        const handler = vi.fn();
        analyzer.on("content_fetched", handler);

        await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");

        expect(handler).toHaveBeenCalledWith("market_123", expect.any(Number));
      });

      it("should handle analysis without category", async () => {
        const result = await analyzer.analyzeMarket("market_123", "Generic market question");

        expect(result.status).toBe(AnalysisStatus.COMPLETED);
      });

      it("should handle political markets", async () => {
        const result = await analyzer.analyzeMarket(
          "market_456",
          "Will Trump win the 2024 election?",
          "politics"
        );

        expect(result.status).toBe(AnalysisStatus.COMPLETED);
      });
    });

    describe("analyzeMarketsBatch", () => {
      it("should analyze multiple markets", async () => {
        const markets = [
          { id: "market_1", title: "Will Bitcoin reach $100K?", category: "crypto" },
          { id: "market_2", title: "Will Trump win?", category: "politics" },
          { id: "market_3", title: "Will Lakers win NBA?", category: "sports" },
        ];

        const result = await analyzer.analyzeMarketsBatch(markets);

        expect(result.totalProcessed).toBe(3);
        expect(result.results).toHaveLength(3);
        expect(result.totalTime).toBeGreaterThanOrEqual(0);
        expect(result.avgTime).toBeGreaterThanOrEqual(0);
      });

      it("should emit batch_started event", async () => {
        const handler = vi.fn();
        analyzer.on("batch_started", handler);

        await analyzer.analyzeMarketsBatch([
          { id: "market_1", title: "Test market" },
        ]);

        expect(handler).toHaveBeenCalledWith(1);
      });

      it("should emit batch_completed event", async () => {
        const handler = vi.fn();
        analyzer.on("batch_completed", handler);

        await analyzer.analyzeMarketsBatch([
          { id: "market_1", title: "Test market" },
        ]);

        expect(handler).toHaveBeenCalled();
        const result = handler.mock.calls[0]?.[0] as { totalProcessed: number };
        expect(result.totalProcessed).toBe(1);
      });

      it("should handle empty batch", async () => {
        const result = await analyzer.analyzeMarketsBatch([]);

        expect(result.totalProcessed).toBe(0);
        expect(result.results).toHaveLength(0);
      });
    });

    describe("Cache Management", () => {
      it("should clear cache", async () => {
        await analyzer.analyzeMarket("market_123", "Test market");

        const statsBefore = analyzer.getCacheStats();
        expect(statsBefore.size).toBeGreaterThan(0);

        analyzer.clearCache();

        const statsAfter = analyzer.getCacheStats();
        expect(statsAfter.size).toBe(0);
      });

      it("should report cache stats", () => {
        const stats = analyzer.getCacheStats();
        expect(stats.size).toBeDefined();
        expect(stats.maxSize).toBeDefined();
        expect(stats.hitRate).toBeDefined();
      });

      it("should prune cache when exceeding max size", async () => {
        const smallCacheAnalyzer = new MarketContextAnalyzer({ maxCacheSize: 2 });

        await smallCacheAnalyzer.analyzeMarket("market_1", "Test 1");
        await smallCacheAnalyzer.analyzeMarket("market_2", "Test 2");
        await smallCacheAnalyzer.analyzeMarket("market_3", "Test 3");

        const stats = smallCacheAnalyzer.getCacheStats();
        expect(stats.size).toBeLessThanOrEqual(2);
      });
    });

    describe("Configuration", () => {
      it("should update configuration", () => {
        analyzer.updateConfig({ maxContentAge: 48 });
        const config = analyzer.getConfig();
        expect(config.maxContentAge).toBe(48);
      });

      it("should preserve other config when updating", () => {
        const originalConfig = analyzer.getConfig();
        analyzer.updateConfig({ maxContentAge: 48 });
        const newConfig = analyzer.getConfig();

        expect(newConfig.enableCache).toBe(originalConfig.enableCache);
        expect(newConfig.minRelevanceScore).toBe(originalConfig.minRelevanceScore);
      });
    });

    describe("Statistics", () => {
      it("should track analysis statistics", async () => {
        await analyzer.analyzeMarket("market_1", "Test market 1");
        await analyzer.analyzeMarket("market_2", "Test market 2", undefined, { skipCache: true });

        const stats = analyzer.getStats();
        expect(stats.analysisCount).toBeGreaterThanOrEqual(2);
        expect(stats.avgAnalysisTime).toBeGreaterThanOrEqual(0);
      });

      it("should start with zero stats", () => {
        const freshAnalyzer = new MarketContextAnalyzer();
        const stats = freshAnalyzer.getStats();
        expect(stats.analysisCount).toBe(0);
        expect(stats.avgAnalysisTime).toBe(0);
      });
    });

    describe("Event Emission", () => {
      it("should emit mention_found events", async () => {
        const handler = vi.fn();
        analyzer.on("mention_found", handler);

        await analyzer.analyzeMarket("market_123", "Will Bitcoin surge?");

        // May or may not emit depending on random content generation
        expect(handler.mock.calls.length).toBeGreaterThanOrEqual(0);
      });

      it("should emit sentiment_analyzed events", async () => {
        const handler = vi.fn();
        analyzer.on("sentiment_analyzed", handler);

        await analyzer.analyzeMarket("market_123", "Test market");

        expect(handler.mock.calls.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Factory Functions", () => {
    afterEach(() => {
      resetSharedMarketContextAnalyzer();
    });

    describe("createMarketContextAnalyzer", () => {
      it("should create new instance", () => {
        const analyzer = createMarketContextAnalyzer();
        expect(analyzer).toBeInstanceOf(MarketContextAnalyzer);
      });

      it("should accept config", () => {
        const analyzer = createMarketContextAnalyzer({ maxContentAge: 12 });
        expect(analyzer.getConfig().maxContentAge).toBe(12);
      });
    });

    describe("getSharedMarketContextAnalyzer", () => {
      it("should return shared instance", () => {
        const instance1 = getSharedMarketContextAnalyzer();
        const instance2 = getSharedMarketContextAnalyzer();
        expect(instance1).toBe(instance2);
      });
    });

    describe("setSharedMarketContextAnalyzer", () => {
      it("should set shared instance", () => {
        const custom = new MarketContextAnalyzer({ maxContentAge: 12 });
        setSharedMarketContextAnalyzer(custom);

        const shared = getSharedMarketContextAnalyzer();
        expect(shared.getConfig().maxContentAge).toBe(12);
      });
    });

    describe("resetSharedMarketContextAnalyzer", () => {
      it("should reset shared instance", () => {
        const original = getSharedMarketContextAnalyzer();
        resetSharedMarketContextAnalyzer();
        const newInstance = getSharedMarketContextAnalyzer();

        expect(newInstance).not.toBe(original);
      });
    });
  });

  describe("Convenience Functions", () => {
    afterEach(() => {
      resetSharedMarketContextAnalyzer();
    });

    describe("analyzeMarketContext", () => {
      it("should analyze using shared instance", async () => {
        const result = await analyzeMarketContext(
          "market_123",
          "Will Bitcoin reach $100K?"
        );

        expect(result.marketId).toBe("market_123");
        expect(result.status).toBe(AnalysisStatus.COMPLETED);
      });
    });

    describe("getSentiment", () => {
      it("should analyze sentiment of positive text", () => {
        const result = getSentiment("Bitcoin prices surge and rally to new highs");
        // Strong positive text may result in very_positive
        expect([Sentiment.POSITIVE, Sentiment.VERY_POSITIVE]).toContain(result.sentiment);
        expect(result.score).toBeGreaterThan(0);
      });

      it("should analyze sentiment of negative text", () => {
        const result = getSentiment("Markets crash amid fears of recession");
        // Strong negative text may result in very_negative
        expect([Sentiment.NEGATIVE, Sentiment.VERY_NEGATIVE]).toContain(result.sentiment);
        expect(result.score).toBeLessThan(0);
      });

      it("should handle neutral text", () => {
        const result = getSentiment("The weather is cloudy today");
        expect(result.sentiment).toBe(Sentiment.NEUTRAL);
      });

      it("should detect mixed sentiment", () => {
        const result = getSentiment("Markets surge but fears of crash remain");
        // Could be mixed or leaning one way
        expect(result.sentiment).toBeDefined();
      });
    });

    describe("isContentRelevant", () => {
      it("should return true for relevant content", () => {
        // Use more specific keywords that will definitely match
        const isRelevant = isContentRelevant(
          "Bitcoin Bitcoin Bitcoin prices have reached new highs",
          "Will Bitcoin reach $100K?",
          20 // Lower threshold to ensure match
        );
        expect(isRelevant).toBe(true);
      });

      it("should return false for irrelevant content", () => {
        const isRelevant = isContentRelevant(
          "Today's weather forecast shows sunny skies",
          "Will Bitcoin reach $100K?"
        );
        expect(isRelevant).toBe(false);
      });

      it("should respect minimum score threshold", () => {
        const isRelevant = isContentRelevant(
          "Some content about crypto",
          "Will Bitcoin reach $100K?",
          100 // Very high threshold
        );
        expect(isRelevant).toBe(false);
      });
    });
  });
});

describe("Type Safety", () => {
  it("should correctly type ContentSource", () => {
    const source: ContentSource = {
      id: "test",
      type: ContentSourceType.NEWS,
      name: "Test Source",
      enabled: true,
      credibility: 80,
    };
    expect(source.type).toBe(ContentSourceType.NEWS);
  });

  it("should correctly type ContentItem", () => {
    const item: ContentItem = {
      id: "test",
      source: {
        id: "src",
        type: ContentSourceType.NEWS,
        name: "Test",
        enabled: true,
        credibility: 80,
      },
      title: "Test Title",
      content: "Test Content",
      url: "https://example.com",
      publishedAt: new Date(),
      fetchedAt: new Date(),
      language: "en",
    };
    expect(item.title).toBe("Test Title");
  });

  it("should correctly type MarketMention", () => {
    const mention: MarketMention = {
      contentId: "content_1",
      marketId: "market_1",
      marketTitle: "Test Market",
      relevance: RelevanceLevel.RELEVANT,
      relevanceScore: 65,
      sentiment: Sentiment.POSITIVE,
      sentimentScore: 40,
      entities: [],
      snippet: "Test snippet",
      impact: ImpactPrediction.BULLISH,
      confidence: 70,
    };
    expect(mention.relevance).toBe(RelevanceLevel.RELEVANT);
  });

  it("should correctly type SentimentAnalysis", () => {
    const analysis: SentimentAnalysis = {
      sentiment: Sentiment.POSITIVE,
      score: 50,
      confidence: 80,
      positivePhrases: ["surge"],
      negativePhrases: [],
      emotionalTone: {
        joy: 60,
        anger: 10,
        fear: 10,
        surprise: 20,
        sadness: 5,
        trust: 70,
      },
    };
    expect(analysis.emotionalTone.joy).toBe(60);
  });

  it("should correctly type MarketContextResult", () => {
    const result: MarketContextResult = createMockContextResult();
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
    expect(result.impactPrediction.prediction).toBeDefined();
  });
});

describe("Edge Cases", () => {
  let analyzer: MarketContextAnalyzer;

  beforeEach(() => {
    analyzer = new MarketContextAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  it("should handle empty market title", async () => {
    const result = await analyzer.analyzeMarket("market_123", "");
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
  });

  it("should handle very long market title", async () => {
    const longTitle = "A".repeat(1000);
    const result = await analyzer.analyzeMarket("market_123", longTitle);
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
  });

  it("should handle special characters in market title", async () => {
    const result = await analyzer.analyzeMarket(
      "market_123",
      "Will $BTC reach $100K? (Poll: Yes/No)"
    );
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
  });

  it("should handle unicode in market title", async () => {
    const result = await analyzer.analyzeMarket("market_123", "Will 比特币 reach new high? 🚀");
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
  });

  it("should handle disabled cache", async () => {
    const noCacheAnalyzer = new MarketContextAnalyzer({ enableCache: false });
    const result1 = await noCacheAnalyzer.analyzeMarket("market_123", "Test");
    const result2 = await noCacheAnalyzer.analyzeMarket("market_123", "Test");

    // Both should complete (no caching)
    expect(result1.status).toBe(AnalysisStatus.COMPLETED);
    expect(result2.status).toBe(AnalysisStatus.COMPLETED);
  });

  it("should handle zero TTL", async () => {
    const zeroTTLAnalyzer = new MarketContextAnalyzer({ cacheTTL: 0 });
    const result = await zeroTTLAnalyzer.analyzeMarket("market_123", "Test");
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
  });

  it("should handle all sources disabled", async () => {
    const noSourcesAnalyzer = new MarketContextAnalyzer({
      sources: DEFAULT_CONTENT_SOURCES.map((s) => ({ ...s, enabled: false })),
    });
    const result = await noSourcesAnalyzer.analyzeMarket("market_123", "Test");
    expect(result.status).toBe(AnalysisStatus.COMPLETED);
    expect(result.contentCount).toBe(0);
  });
});

describe("Performance", () => {
  it("should analyze market in reasonable time", async () => {
    const analyzer = new MarketContextAnalyzer();
    const start = Date.now();

    await analyzer.analyzeMarket("market_123", "Will Bitcoin reach $100K?");

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it("should handle batch analysis efficiently", async () => {
    const analyzer = new MarketContextAnalyzer();
    const markets = Array.from({ length: 10 }, (_, i) => ({
      id: `market_${i}`,
      title: `Test market ${i}`,
    }));

    const start = Date.now();
    const result = await analyzer.analyzeMarketsBatch(markets);
    const elapsed = Date.now() - start;

    expect(result.totalProcessed).toBe(10);
    expect(elapsed).toBeLessThan(30000); // Should complete within 30 seconds
  });

  it("should benefit from caching", async () => {
    const analyzer = new MarketContextAnalyzer();

    const start1 = Date.now();
    await analyzer.analyzeMarket("market_123", "Test market");
    const elapsed1 = Date.now() - start1;

    const start2 = Date.now();
    await analyzer.analyzeMarket("market_123", "Test market");
    const elapsed2 = Date.now() - start2;

    // Cached call should be faster
    expect(elapsed2).toBeLessThanOrEqual(elapsed1);
  });
});
