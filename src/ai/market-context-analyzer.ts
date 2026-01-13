/**
 * AI-NLP-002: Market Context Analyzer
 *
 * Analyzes market context from news/social media to provide insights
 * about external factors that may influence market activity.
 */

import { EventEmitter } from "events";

// ============================================================================
// Enums
// ============================================================================

/**
 * Types of news/content sources
 */
export enum ContentSourceType {
  /** News articles from traditional media */
  NEWS = "news",
  /** Twitter/X posts */
  TWITTER = "twitter",
  /** Reddit posts/comments */
  REDDIT = "reddit",
  /** Blog posts */
  BLOG = "blog",
  /** Official announcements */
  OFFICIAL = "official",
  /** Press releases */
  PRESS_RELEASE = "press_release",
  /** Government publications */
  GOVERNMENT = "government",
  /** Research/academic papers */
  RESEARCH = "research",
}

/**
 * Sentiment analysis result
 */
export enum Sentiment {
  VERY_POSITIVE = "very_positive",
  POSITIVE = "positive",
  NEUTRAL = "neutral",
  NEGATIVE = "negative",
  VERY_NEGATIVE = "very_negative",
  MIXED = "mixed",
}

/**
 * Relevance level of content to market
 */
export enum RelevanceLevel {
  HIGHLY_RELEVANT = "highly_relevant",
  RELEVANT = "relevant",
  SOMEWHAT_RELEVANT = "somewhat_relevant",
  MARGINALLY_RELEVANT = "marginally_relevant",
  NOT_RELEVANT = "not_relevant",
}

/**
 * Impact prediction for market
 */
export enum ImpactPrediction {
  /** Strong positive impact expected */
  STRONG_BULLISH = "strong_bullish",
  /** Moderate positive impact expected */
  BULLISH = "bullish",
  /** Minor positive impact expected */
  SLIGHTLY_BULLISH = "slightly_bullish",
  /** No significant impact expected */
  NEUTRAL = "neutral",
  /** Minor negative impact expected */
  SLIGHTLY_BEARISH = "slightly_bearish",
  /** Moderate negative impact expected */
  BEARISH = "bearish",
  /** Strong negative impact expected */
  STRONG_BEARISH = "strong_bearish",
  /** Uncertain impact */
  UNCERTAIN = "uncertain",
}

/**
 * Context analysis status
 */
export enum AnalysisStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  PARTIAL = "partial",
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Content source configuration
 */
export interface ContentSource {
  /** Unique identifier */
  id: string;
  /** Source type */
  type: ContentSourceType;
  /** Source name (e.g., "Reuters", "Twitter") */
  name: string;
  /** Source URL or API endpoint */
  url?: string;
  /** Whether the source is enabled */
  enabled: boolean;
  /** Credibility score (0-100) */
  credibility: number;
  /** Rate limit (requests per minute) */
  rateLimit?: number;
}

/**
 * A piece of content (news article, social post, etc.)
 */
export interface ContentItem {
  /** Unique identifier */
  id: string;
  /** Source information */
  source: ContentSource;
  /** Title or headline */
  title: string;
  /** Full content or summary */
  content: string;
  /** URL to the original content */
  url: string;
  /** Author name or handle */
  author?: string;
  /** Publication timestamp */
  publishedAt: Date;
  /** When content was fetched */
  fetchedAt: Date;
  /** Language code (e.g., "en", "es") */
  language: string;
  /** Engagement metrics (likes, shares, etc.) */
  engagement?: ContentEngagement;
  /** Image URLs */
  images?: string[];
  /** Tags/keywords from source */
  tags?: string[];
}

/**
 * Content engagement metrics
 */
export interface ContentEngagement {
  /** Number of likes/upvotes */
  likes?: number;
  /** Number of shares/retweets */
  shares?: number;
  /** Number of comments */
  comments?: number;
  /** Number of views */
  views?: number;
  /** Overall engagement score (calculated) */
  score: number;
}

/**
 * Entity extracted from content
 */
export interface ExtractedEntity {
  /** Entity text as found */
  text: string;
  /** Normalized/canonical form */
  normalized: string;
  /** Entity type (person, org, location, etc.) */
  type: EntityType;
  /** Confidence in extraction (0-100) */
  confidence: number;
  /** Position in content */
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Entity types for extraction
 */
export enum EntityType {
  PERSON = "person",
  ORGANIZATION = "organization",
  LOCATION = "location",
  DATE = "date",
  MONEY = "money",
  PERCENT = "percent",
  EVENT = "event",
  PRODUCT = "product",
  MARKET = "market",
  CRYPTO = "crypto",
  POLITICAL = "political",
  OTHER = "other",
}

/**
 * Market mention found in content
 */
export interface MarketMention {
  /** The content item containing the mention */
  contentId: string;
  /** Market ID being referenced */
  marketId: string;
  /** Market title/question */
  marketTitle: string;
  /** Relevance of the mention */
  relevance: RelevanceLevel;
  /** Relevance score (0-100) */
  relevanceScore: number;
  /** Sentiment towards the market outcome */
  sentiment: Sentiment;
  /** Sentiment score (-100 to 100) */
  sentimentScore: number;
  /** Extracted entities related to the mention */
  entities: ExtractedEntity[];
  /** Snippet of content around the mention */
  snippet: string;
  /** Impact prediction */
  impact: ImpactPrediction;
  /** Confidence in analysis (0-100) */
  confidence: number;
}

/**
 * Sentiment analysis result for a piece of content
 */
export interface SentimentAnalysis {
  /** Overall sentiment */
  sentiment: Sentiment;
  /** Sentiment score (-100 to 100) */
  score: number;
  /** Confidence in sentiment (0-100) */
  confidence: number;
  /** Positive phrases detected */
  positivePhrases: string[];
  /** Negative phrases detected */
  negativePhrases: string[];
  /** Emotional tone indicators */
  emotionalTone: {
    joy: number;
    anger: number;
    fear: number;
    surprise: number;
    sadness: number;
    trust: number;
  };
}

/**
 * Correlation between content and market activity
 */
export interface ActivityCorrelation {
  /** Content item ID */
  contentId: string;
  /** Market ID */
  marketId: string;
  /** Correlation strength (-1 to 1) */
  correlation: number;
  /** Lag in hours between content and activity */
  lagHours: number;
  /** Volume change percentage */
  volumeChange: number;
  /** Price/probability change */
  priceChange: number;
  /** Confidence in correlation (0-100) */
  confidence: number;
  /** Whether correlation is statistically significant */
  significant: boolean;
}

/**
 * Full market context analysis result
 */
export interface MarketContextResult {
  /** Market ID analyzed */
  marketId: string;
  /** Market title/question */
  marketTitle: string;
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Analysis status */
  status: AnalysisStatus;
  /** Time taken for analysis (ms) */
  analysisTime: number;
  /** Content items analyzed */
  contentCount: number;
  /** Market mentions found */
  mentions: MarketMention[];
  /** Overall sentiment summary */
  overallSentiment: {
    sentiment: Sentiment;
    score: number;
    confidence: number;
  };
  /** Key entities related to market */
  keyEntities: ExtractedEntity[];
  /** Activity correlations found */
  correlations: ActivityCorrelation[];
  /** Context summary (natural language) */
  summary: string;
  /** Key insights extracted */
  keyInsights: string[];
  /** Impact prediction */
  impactPrediction: {
    prediction: ImpactPrediction;
    confidence: number;
    reasoning: string;
  };
  /** Trending indicators */
  trendingScore: number;
  /** Media attention score (0-100) */
  mediaAttention: number;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  /** Individual market results */
  results: MarketContextResult[];
  /** Total markets processed */
  totalProcessed: number;
  /** Markets that failed */
  failed: number;
  /** Total analysis time (ms) */
  totalTime: number;
  /** Average analysis time per market (ms) */
  avgTime: number;
}

/**
 * Market context analyzer configuration
 */
export interface MarketContextAnalyzerConfig {
  /** Enabled content sources */
  sources?: ContentSource[];
  /** Maximum content age to consider (hours) */
  maxContentAge?: number;
  /** Minimum relevance score threshold */
  minRelevanceScore?: number;
  /** Minimum sentiment confidence threshold */
  minSentimentConfidence?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL (ms) */
  cacheTTL?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Language filter (only analyze content in these languages) */
  languages?: string[];
  /** Enable correlation analysis */
  enableCorrelation?: boolean;
  /** Correlation lookback period (hours) */
  correlationLookback?: number;
}

/**
 * Market context analyzer events
 */
export interface MarketContextAnalyzerEvents {
  analysis_started: (marketId: string) => void;
  analysis_completed: (result: MarketContextResult) => void;
  content_fetched: (marketId: string, count: number) => void;
  mention_found: (mention: MarketMention) => void;
  sentiment_analyzed: (contentId: string, sentiment: SentimentAnalysis) => void;
  correlation_found: (correlation: ActivityCorrelation) => void;
  batch_started: (count: number) => void;
  batch_completed: (result: BatchAnalysisResult) => void;
  error: (marketId: string, error: Error) => void;
  cache_hit: (marketId: string) => void;
  cache_miss: (marketId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default content sources
 */
export const DEFAULT_CONTENT_SOURCES: ContentSource[] = [
  {
    id: "news-api",
    type: ContentSourceType.NEWS,
    name: "News API",
    enabled: true,
    credibility: 80,
    rateLimit: 100,
  },
  {
    id: "twitter-api",
    type: ContentSourceType.TWITTER,
    name: "Twitter/X",
    enabled: true,
    credibility: 60,
    rateLimit: 300,
  },
  {
    id: "reddit-api",
    type: ContentSourceType.REDDIT,
    name: "Reddit",
    enabled: true,
    credibility: 55,
    rateLimit: 60,
  },
  {
    id: "official-polymarket",
    type: ContentSourceType.OFFICIAL,
    name: "Polymarket Official",
    enabled: true,
    credibility: 95,
    rateLimit: 30,
  },
];

/**
 * Default analyzer configuration
 */
export const DEFAULT_ANALYZER_CONFIG: Required<MarketContextAnalyzerConfig> = {
  sources: DEFAULT_CONTENT_SOURCES,
  maxContentAge: 72, // 3 days
  minRelevanceScore: 30,
  minSentimentConfidence: 50,
  enableCache: true,
  cacheTTL: 15 * 60 * 1000, // 15 minutes
  maxCacheSize: 500,
  languages: ["en"],
  enableCorrelation: true,
  correlationLookback: 24, // 1 day
};

/**
 * Sentiment score thresholds
 */
export const SENTIMENT_THRESHOLDS = {
  VERY_POSITIVE: 60,
  POSITIVE: 20,
  NEUTRAL_LOW: -20,
  NEUTRAL_HIGH: 20,
  NEGATIVE: -60,
  VERY_NEGATIVE: -100,
};

/**
 * Impact prediction thresholds
 */
export const IMPACT_THRESHOLDS = {
  STRONG_BULLISH: 70,
  BULLISH: 40,
  SLIGHTLY_BULLISH: 15,
  NEUTRAL_LOW: -15,
  NEUTRAL_HIGH: 15,
  SLIGHTLY_BEARISH: -40,
  BEARISH: -70,
  STRONG_BEARISH: -100,
};

/**
 * Relevance score thresholds
 */
export const RELEVANCE_THRESHOLDS = {
  HIGHLY_RELEVANT: 80,
  RELEVANT: 60,
  SOMEWHAT_RELEVANT: 40,
  MARGINALLY_RELEVANT: 20,
};

/**
 * Keywords for different market categories
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politics: [
    "election",
    "vote",
    "president",
    "congress",
    "senate",
    "governor",
    "poll",
    "campaign",
    "democrat",
    "republican",
    "primary",
    "ballot",
    "candidate",
    "nominee",
    "party",
    "legislation",
    "bill",
    "law",
    "policy",
  ],
  crypto: [
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "crypto",
    "blockchain",
    "token",
    "defi",
    "nft",
    "web3",
    "wallet",
    "exchange",
    "binance",
    "coinbase",
    "altcoin",
    "mining",
    "halving",
  ],
  sports: [
    "game",
    "match",
    "championship",
    "tournament",
    "league",
    "season",
    "playoffs",
    "finals",
    "team",
    "player",
    "coach",
    "score",
    "win",
    "lose",
    "nba",
    "nfl",
    "mlb",
    "soccer",
  ],
  geopolitics: [
    "war",
    "conflict",
    "treaty",
    "sanction",
    "diplomacy",
    "military",
    "alliance",
    "nato",
    "un",
    "foreign",
    "international",
    "summit",
    "negotiation",
    "ceasefire",
    "invasion",
  ],
  finance: [
    "stock",
    "market",
    "fed",
    "interest",
    "rate",
    "inflation",
    "gdp",
    "economy",
    "recession",
    "bull",
    "bear",
    "rally",
    "crash",
    "earnings",
    "dividend",
  ],
};

/**
 * Positive sentiment words
 */
export const POSITIVE_WORDS = [
  "surge",
  "soar",
  "rally",
  "gain",
  "rise",
  "boost",
  "jump",
  "climb",
  "advance",
  "improve",
  "success",
  "win",
  "victory",
  "breakthrough",
  "optimistic",
  "confident",
  "strong",
  "positive",
  "bullish",
  "growth",
  "increase",
  "expand",
  "lead",
  "ahead",
  "popular",
  "support",
  "approve",
  "favor",
  "promising",
  "excellent",
];

/**
 * Negative sentiment words
 */
export const NEGATIVE_WORDS = [
  "crash",
  "plunge",
  "drop",
  "fall",
  "decline",
  "sink",
  "tumble",
  "slump",
  "collapse",
  "fail",
  "loss",
  "defeat",
  "worry",
  "concern",
  "fear",
  "risk",
  "threat",
  "crisis",
  "bearish",
  "weak",
  "decrease",
  "shrink",
  "lag",
  "behind",
  "unpopular",
  "oppose",
  "reject",
  "negative",
  "problem",
  "scandal",
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert sentiment score to Sentiment enum
 */
export function scoreToSentiment(score: number): Sentiment {
  if (score >= SENTIMENT_THRESHOLDS.VERY_POSITIVE) return Sentiment.VERY_POSITIVE;
  if (score >= SENTIMENT_THRESHOLDS.POSITIVE) return Sentiment.POSITIVE;
  if (score >= SENTIMENT_THRESHOLDS.NEUTRAL_LOW && score <= SENTIMENT_THRESHOLDS.NEUTRAL_HIGH)
    return Sentiment.NEUTRAL;
  if (score <= SENTIMENT_THRESHOLDS.NEGATIVE) return Sentiment.VERY_NEGATIVE;
  if (score < SENTIMENT_THRESHOLDS.NEUTRAL_LOW) return Sentiment.NEGATIVE;
  return Sentiment.NEUTRAL;
}

/**
 * Convert score to impact prediction
 */
export function scoreToImpact(score: number, confidence: number): ImpactPrediction {
  if (confidence < 50) return ImpactPrediction.UNCERTAIN;
  if (score >= IMPACT_THRESHOLDS.STRONG_BULLISH) return ImpactPrediction.STRONG_BULLISH;
  if (score >= IMPACT_THRESHOLDS.BULLISH) return ImpactPrediction.BULLISH;
  if (score >= IMPACT_THRESHOLDS.SLIGHTLY_BULLISH) return ImpactPrediction.SLIGHTLY_BULLISH;
  if (score >= IMPACT_THRESHOLDS.NEUTRAL_LOW && score <= IMPACT_THRESHOLDS.NEUTRAL_HIGH)
    return ImpactPrediction.NEUTRAL;
  if (score <= IMPACT_THRESHOLDS.STRONG_BEARISH) return ImpactPrediction.STRONG_BEARISH;
  if (score <= IMPACT_THRESHOLDS.BEARISH) return ImpactPrediction.BEARISH;
  if (score <= IMPACT_THRESHOLDS.SLIGHTLY_BEARISH) return ImpactPrediction.SLIGHTLY_BEARISH;
  return ImpactPrediction.NEUTRAL;
}

/**
 * Convert score to relevance level
 */
export function scoreToRelevance(score: number): RelevanceLevel {
  if (score >= RELEVANCE_THRESHOLDS.HIGHLY_RELEVANT) return RelevanceLevel.HIGHLY_RELEVANT;
  if (score >= RELEVANCE_THRESHOLDS.RELEVANT) return RelevanceLevel.RELEVANT;
  if (score >= RELEVANCE_THRESHOLDS.SOMEWHAT_RELEVANT) return RelevanceLevel.SOMEWHAT_RELEVANT;
  if (score >= RELEVANCE_THRESHOLDS.MARGINALLY_RELEVANT) return RelevanceLevel.MARGINALLY_RELEVANT;
  return RelevanceLevel.NOT_RELEVANT;
}

/**
 * Get description for sentiment
 */
export function getSentimentDescription(sentiment: Sentiment): string {
  const descriptions: Record<Sentiment, string> = {
    [Sentiment.VERY_POSITIVE]: "Very positive sentiment with strong optimism",
    [Sentiment.POSITIVE]: "Positive sentiment indicating favorable outlook",
    [Sentiment.NEUTRAL]: "Neutral sentiment with balanced views",
    [Sentiment.NEGATIVE]: "Negative sentiment indicating concerns",
    [Sentiment.VERY_NEGATIVE]: "Very negative sentiment with significant pessimism",
    [Sentiment.MIXED]: "Mixed sentiment with both positive and negative aspects",
  };
  return descriptions[sentiment];
}

/**
 * Get color for sentiment display
 */
export function getSentimentColor(sentiment: Sentiment): string {
  const colors: Record<Sentiment, string> = {
    [Sentiment.VERY_POSITIVE]: "#22c55e", // green-500
    [Sentiment.POSITIVE]: "#86efac", // green-300
    [Sentiment.NEUTRAL]: "#9ca3af", // gray-400
    [Sentiment.NEGATIVE]: "#fca5a5", // red-300
    [Sentiment.VERY_NEGATIVE]: "#ef4444", // red-500
    [Sentiment.MIXED]: "#fbbf24", // amber-400
  };
  return colors[sentiment];
}

/**
 * Get description for impact prediction
 */
export function getImpactDescription(impact: ImpactPrediction): string {
  const descriptions: Record<ImpactPrediction, string> = {
    [ImpactPrediction.STRONG_BULLISH]: "Strong positive impact expected on market probability",
    [ImpactPrediction.BULLISH]: "Moderate positive impact expected",
    [ImpactPrediction.SLIGHTLY_BULLISH]: "Minor positive impact possible",
    [ImpactPrediction.NEUTRAL]: "No significant impact expected",
    [ImpactPrediction.SLIGHTLY_BEARISH]: "Minor negative impact possible",
    [ImpactPrediction.BEARISH]: "Moderate negative impact expected",
    [ImpactPrediction.STRONG_BEARISH]: "Strong negative impact expected on market probability",
    [ImpactPrediction.UNCERTAIN]: "Impact uncertain due to conflicting signals",
  };
  return descriptions[impact];
}

/**
 * Get emoji for impact prediction
 */
export function getImpactEmoji(impact: ImpactPrediction): string {
  const emojis: Record<ImpactPrediction, string> = {
    [ImpactPrediction.STRONG_BULLISH]: "🚀",
    [ImpactPrediction.BULLISH]: "📈",
    [ImpactPrediction.SLIGHTLY_BULLISH]: "↗️",
    [ImpactPrediction.NEUTRAL]: "➡️",
    [ImpactPrediction.SLIGHTLY_BEARISH]: "↘️",
    [ImpactPrediction.BEARISH]: "📉",
    [ImpactPrediction.STRONG_BEARISH]: "💥",
    [ImpactPrediction.UNCERTAIN]: "❓",
  };
  return emojis[impact];
}

/**
 * Get description for relevance level
 */
export function getRelevanceDescription(relevance: RelevanceLevel): string {
  const descriptions: Record<RelevanceLevel, string> = {
    [RelevanceLevel.HIGHLY_RELEVANT]: "Directly related to market outcome",
    [RelevanceLevel.RELEVANT]: "Relevant to market subject",
    [RelevanceLevel.SOMEWHAT_RELEVANT]: "Partially related to market",
    [RelevanceLevel.MARGINALLY_RELEVANT]: "Tangentially related",
    [RelevanceLevel.NOT_RELEVANT]: "Not relevant to market",
  };
  return descriptions[relevance];
}

/**
 * Extract keywords from market title
 */
export function extractMarketKeywords(marketTitle: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "if",
    "then",
    "else",
    "when",
    "where",
    "why",
    "how",
    "what",
    "which",
    "who",
    "whom",
  ]);

  const words = marketTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)];
}

/**
 * Calculate keyword match score
 */
export function calculateKeywordMatch(
  content: string,
  keywords: string[]
): { score: number; matches: string[] } {
  const contentLower = content.toLowerCase();
  const matches: string[] = [];
  let score = 0;

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
    const matchCount = (contentLower.match(regex) || []).length;
    if (matchCount > 0) {
      matches.push(keyword);
      // Diminishing returns for multiple matches of same keyword
      score += Math.min(matchCount * 10, 30);
    }
  }

  // Normalize score (0-100)
  return {
    score: Math.min(score, 100),
    matches,
  };
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calculate engagement score from metrics
 */
export function calculateEngagementScore(engagement: Partial<ContentEngagement>): number {
  const weights = {
    views: 0.1,
    likes: 0.3,
    shares: 0.4,
    comments: 0.2,
  };

  let score = 0;
  let totalWeight = 0;

  if (engagement.views !== undefined) {
    score += Math.log10(Math.max(engagement.views, 1)) * 10 * weights.views;
    totalWeight += weights.views;
  }
  if (engagement.likes !== undefined) {
    score += Math.log10(Math.max(engagement.likes, 1)) * 10 * weights.likes;
    totalWeight += weights.likes;
  }
  if (engagement.shares !== undefined) {
    score += Math.log10(Math.max(engagement.shares, 1)) * 10 * weights.shares;
    totalWeight += weights.shares;
  }
  if (engagement.comments !== undefined) {
    score += Math.log10(Math.max(engagement.comments, 1)) * 10 * weights.comments;
    totalWeight += weights.comments;
  }

  return totalWeight > 0 ? (score / totalWeight) * 10 : 0;
}

/**
 * Generate content snippet around keyword
 */
export function generateSnippet(content: string, keyword: string, maxLength: number = 200): string {
  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerContent.indexOf(lowerKeyword);

  if (index === -1) {
    return content.substring(0, maxLength) + (content.length > maxLength ? "..." : "");
  }

  const halfLength = Math.floor(maxLength / 2);
  let start = Math.max(0, index - halfLength);
  let end = Math.min(content.length, index + keyword.length + halfLength);

  // Adjust to word boundaries
  while (start > 0 && content[start - 1] !== " ") start--;
  while (end < content.length && content[end] !== " ") end++;

  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  return prefix + content.substring(start, end).trim() + suffix;
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Check if content is within age limit
 */
export function isWithinAgeLimit(publishedAt: Date, maxAgeHours: number): boolean {
  const ageMs = Date.now() - publishedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours <= maxAgeHours;
}

/**
 * Calculate content age in hours
 */
export function calculateContentAge(publishedAt: Date): number {
  const ageMs = Date.now() - publishedAt.getTime();
  return ageMs / (1000 * 60 * 60);
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Market Context Analyzer
 *
 * Analyzes market context from news and social media to provide insights
 * about external factors that may influence market activity.
 */
export class MarketContextAnalyzer extends EventEmitter {
  private config: Required<MarketContextAnalyzerConfig>;
  private cache: Map<string, { result: MarketContextResult; timestamp: number }>;
  private analysisCount: number;
  private totalAnalysisTime: number;

  constructor(config: MarketContextAnalyzerConfig = {}) {
    super();
    this.config = { ...DEFAULT_ANALYZER_CONFIG, ...config };
    this.cache = new Map();
    this.analysisCount = 0;
    this.totalAnalysisTime = 0;
  }

  /**
   * Analyze market context
   */
  async analyzeMarket(
    marketId: string,
    marketTitle: string,
    marketCategory?: string,
    options?: { skipCache?: boolean }
  ): Promise<MarketContextResult> {
    const startTime = Date.now();
    const cacheKey = `${marketId}:${marketTitle}`;

    // Check cache
    if (this.config.enableCache && !options?.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
        this.emit("cache_hit", marketId);
        return cached.result;
      }
      this.emit("cache_miss", marketId);
    }

    this.emit("analysis_started", marketId);

    try {
      // Extract keywords from market title
      const keywords = extractMarketKeywords(marketTitle);

      // Add category-specific keywords
      if (marketCategory) {
        const categoryKws = CATEGORY_KEYWORDS[marketCategory.toLowerCase()];
        if (categoryKws) {
          keywords.push(...categoryKws.slice(0, 5));
        }
      }

      // Fetch content (simulated - in production would call actual APIs)
      const content = await this.fetchContent(keywords, marketCategory);
      this.emit("content_fetched", marketId, content.length);

      // Analyze mentions
      const mentions: MarketMention[] = [];
      for (const item of content) {
        const mention = await this.analyzeMention(item, marketId, marketTitle, keywords);
        if (mention && mention.relevanceScore >= this.config.minRelevanceScore) {
          mentions.push(mention);
          this.emit("mention_found", mention);
        }
      }

      // Calculate overall sentiment
      const overallSentiment = this.calculateOverallSentiment(mentions);

      // Extract key entities
      const keyEntities = this.extractKeyEntities(mentions);

      // Calculate correlations (if enabled)
      const correlations: ActivityCorrelation[] = [];
      if (this.config.enableCorrelation) {
        for (const mention of mentions.slice(0, 10)) {
          const correlation = this.analyzeCorrelation(mention, marketId);
          if (correlation.significant) {
            correlations.push(correlation);
            this.emit("correlation_found", correlation);
          }
        }
      }

      // Generate summary
      const summary = this.generateSummary(marketTitle, mentions, overallSentiment, keyEntities);

      // Extract key insights
      const keyInsights = this.extractKeyInsights(mentions, overallSentiment, correlations);

      // Calculate impact prediction
      const impactPrediction = this.predictImpact(overallSentiment, correlations, mentions);

      // Calculate media attention and trending score
      const mediaAttention = this.calculateMediaAttention(content, mentions);
      const trendingScore = this.calculateTrendingScore(content, mentions);

      const analysisTime = Date.now() - startTime;
      this.analysisCount++;
      this.totalAnalysisTime += analysisTime;

      const result: MarketContextResult = {
        marketId,
        marketTitle,
        analyzedAt: new Date(),
        status: AnalysisStatus.COMPLETED,
        analysisTime,
        contentCount: content.length,
        mentions,
        overallSentiment,
        keyEntities,
        correlations,
        summary,
        keyInsights,
        impactPrediction,
        trendingScore,
        mediaAttention,
      };

      // Cache result
      if (this.config.enableCache) {
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        this.pruneCache();
      }

      this.emit("analysis_completed", result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", marketId, err);

      return {
        marketId,
        marketTitle,
        analyzedAt: new Date(),
        status: AnalysisStatus.FAILED,
        analysisTime: Date.now() - startTime,
        contentCount: 0,
        mentions: [],
        overallSentiment: { sentiment: Sentiment.NEUTRAL, score: 0, confidence: 0 },
        keyEntities: [],
        correlations: [],
        summary: `Analysis failed: ${err.message}`,
        keyInsights: [],
        impactPrediction: {
          prediction: ImpactPrediction.UNCERTAIN,
          confidence: 0,
          reasoning: "Analysis failed",
        },
        trendingScore: 0,
        mediaAttention: 0,
      };
    }
  }

  /**
   * Analyze multiple markets in batch
   */
  async analyzeMarketsBatch(
    markets: Array<{ id: string; title: string; category?: string }>
  ): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    this.emit("batch_started", markets.length);

    const results: MarketContextResult[] = [];
    let failed = 0;

    for (const market of markets) {
      try {
        const result = await this.analyzeMarket(market.id, market.title, market.category);
        results.push(result);
        if (result.status === AnalysisStatus.FAILED) {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    const totalTime = Date.now() - startTime;
    const batchResult: BatchAnalysisResult = {
      results,
      totalProcessed: markets.length,
      failed,
      totalTime,
      avgTime: totalTime / markets.length,
    };

    this.emit("batch_completed", batchResult);
    return batchResult;
  }

  /**
   * Fetch content from sources (simulated)
   */
  private async fetchContent(
    keywords: string[],
    category?: string
  ): Promise<ContentItem[]> {
    // In production, this would call actual APIs
    // For now, generate mock content based on keywords
    const content: ContentItem[] = [];
    const enabledSources = this.config.sources.filter((s) => s.enabled);

    for (const source of enabledSources) {
      const count = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < count; i++) {
        content.push(this.generateMockContent(source, keywords, category));
      }
    }

    // Filter by age
    return content.filter((item) => isWithinAgeLimit(item.publishedAt, this.config.maxContentAge));
  }

  /**
   * Generate mock content (for testing)
   */
  private generateMockContent(
    source: ContentSource,
    keywords: string[],
    category?: string
  ): ContentItem {
    const now = Date.now();
    const ageHours = Math.random() * this.config.maxContentAge;
    const publishedAt = new Date(now - ageHours * 60 * 60 * 1000);

    const keyword = keywords[Math.floor(Math.random() * keywords.length)] || "market";
    const sentiment = Math.random() > 0.5 ? "positive" : "negative";
    const sentimentWords = sentiment === "positive" ? POSITIVE_WORDS : NEGATIVE_WORDS;
    const sentimentWord = sentimentWords[Math.floor(Math.random() * sentimentWords.length)];

    const titles = [
      `Breaking: ${keyword} ${sentimentWord} amid market movements`,
      `Analysis: What ${keyword} means for prediction markets`,
      `${keyword} update: Experts ${sentimentWord} about outcome`,
      `Market watch: ${keyword} shows ${sentiment} signals`,
      `Report: ${keyword} ${sentimentWord} to new levels`,
    ];

    const contents = [
      `The latest developments in ${keyword} have analysts ${sentiment === "positive" ? "optimistic" : "concerned"}. Sources indicate ${sentimentWord} momentum in recent activity.`,
      `Breaking news: ${keyword} shows ${sentiment} trends as market participants react to new information. Experts suggest this could ${sentimentWord} probability estimates.`,
      `Analysis of ${keyword} reveals ${sentiment} sentiment among traders. The market has seen ${sentimentWord} activity in the past 24 hours.`,
    ];

    const titleIndex = Math.floor(Math.random() * titles.length);
    const contentIndex = Math.floor(Math.random() * contents.length);

    return {
      id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source,
      title: titles[titleIndex] ?? `News about ${keyword}`,
      content: contents[contentIndex] ?? `Content about ${keyword}`,
      url: `https://example.com/${source.type}/${Date.now()}`,
      author: `@analyst_${Math.floor(Math.random() * 1000)}`,
      publishedAt,
      fetchedAt: new Date(),
      language: "en",
      engagement: {
        likes: Math.floor(Math.random() * 1000),
        shares: Math.floor(Math.random() * 500),
        comments: Math.floor(Math.random() * 200),
        views: Math.floor(Math.random() * 10000),
        score: Math.random() * 100,
      },
      tags: [keyword, category || "general", sentiment],
    };
  }

  /**
   * Analyze a content item for market mention
   */
  private async analyzeMention(
    item: ContentItem,
    marketId: string,
    marketTitle: string,
    keywords: string[]
  ): Promise<MarketMention | null> {
    const combinedText = `${item.title} ${item.content}`;

    // Calculate relevance
    const { score: relevanceScore, matches } = calculateKeywordMatch(combinedText, keywords);
    if (relevanceScore < this.config.minRelevanceScore / 2) {
      return null;
    }

    // Analyze sentiment
    const sentimentAnalysis = this.analyzeSentiment(combinedText);
    this.emit("sentiment_analyzed", item.id, sentimentAnalysis);

    // Extract entities
    const entities = this.extractEntities(combinedText);

    // Calculate final relevance with entity boost
    const entityBoost = entities.filter((e) => e.confidence > 70).length * 5;
    const finalRelevanceScore = Math.min(relevanceScore + entityBoost, 100);

    // Generate snippet
    const primaryKeyword = matches[0] ?? keywords[0] ?? marketTitle.split(" ")[0] ?? "market";
    const snippet = generateSnippet(item.content, primaryKeyword);

    // Calculate impact
    const impactScore = this.calculateImpactScore(sentimentAnalysis, item.engagement, finalRelevanceScore);
    const impact = scoreToImpact(impactScore, sentimentAnalysis.confidence);

    // Calculate confidence
    const confidence = this.calculateMentionConfidence(
      finalRelevanceScore,
      sentimentAnalysis.confidence,
      item.source.credibility
    );

    return {
      contentId: item.id,
      marketId,
      marketTitle,
      relevance: scoreToRelevance(finalRelevanceScore),
      relevanceScore: finalRelevanceScore,
      sentiment: sentimentAnalysis.sentiment,
      sentimentScore: sentimentAnalysis.score,
      entities,
      snippet,
      impact,
      confidence,
    };
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string): SentimentAnalysis {
    const textLower = text.toLowerCase();

    // Count positive and negative words
    let positiveCount = 0;
    let negativeCount = 0;
    const positivePhrases: string[] = [];
    const negativePhrases: string[] = [];

    for (const word of POSITIVE_WORDS) {
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
      const matches = textLower.match(regex);
      if (matches) {
        positiveCount += matches.length;
        positivePhrases.push(word);
      }
    }

    for (const word of NEGATIVE_WORDS) {
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
      const matches = textLower.match(regex);
      if (matches) {
        negativeCount += matches.length;
        negativePhrases.push(word);
      }
    }

    // Calculate score (-100 to 100)
    const total = positiveCount + negativeCount;
    let score = 0;
    if (total > 0) {
      score = ((positiveCount - negativeCount) / total) * 100;
    }

    // Determine sentiment
    let sentiment: Sentiment;
    if (positiveCount > 0 && negativeCount > 0 && Math.abs(positiveCount - negativeCount) <= 2) {
      sentiment = Sentiment.MIXED;
    } else {
      sentiment = scoreToSentiment(score);
    }

    // Calculate confidence based on word matches
    const confidence = Math.min(total * 15, 95);

    // Simulated emotional tone (in production, use proper NLP)
    const emotionalTone = {
      joy: sentiment === Sentiment.VERY_POSITIVE ? 80 : sentiment === Sentiment.POSITIVE ? 60 : 30,
      anger:
        sentiment === Sentiment.VERY_NEGATIVE ? 70 : sentiment === Sentiment.NEGATIVE ? 50 : 20,
      fear: negativePhrases.includes("fear") || negativePhrases.includes("crisis") ? 60 : 30,
      surprise: Math.random() * 40 + 10,
      sadness: sentiment === Sentiment.VERY_NEGATIVE ? 60 : 20,
      trust:
        sentiment === Sentiment.VERY_POSITIVE
          ? 70
          : sentiment === Sentiment.POSITIVE
            ? 50
            : sentiment === Sentiment.NEUTRAL
              ? 40
              : 20,
    };

    return {
      sentiment,
      score,
      confidence,
      positivePhrases: [...new Set(positivePhrases)],
      negativePhrases: [...new Set(negativePhrases)],
      emotionalTone,
    };
  }

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Simple pattern-based extraction (in production, use NER)
    const patterns: Array<{ type: EntityType; regex: RegExp }> = [
      { type: EntityType.PERSON, regex: /(?:President|Senator|CEO|Chairman)\s+([A-Z][a-z]+ [A-Z][a-z]+)/g },
      { type: EntityType.ORGANIZATION, regex: /(?:the\s+)?([A-Z][a-zA-Z]+ (?:Corp|Inc|Ltd|Company|Foundation|Commission|Agency))/g },
      { type: EntityType.MONEY, regex: /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion))?/gi },
      { type: EntityType.PERCENT, regex: /\d+(?:\.\d+)?%/g },
      { type: EntityType.DATE, regex: /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?/gi },
      { type: EntityType.CRYPTO, regex: /\b(?:Bitcoin|Ethereum|BTC|ETH|Solana|SOL|Cardano|ADA)\b/gi },
      { type: EntityType.POLITICAL, regex: /\b(?:Democrat|Republican|Congress|Senate|House|White House|GOP)\b/gi },
    ];

    for (const { type, regex } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          normalized: match[1] || match[0],
          type,
          confidence: 70 + Math.random() * 25,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    return entities;
  }

  /**
   * Calculate impact score
   */
  private calculateImpactScore(
    sentiment: SentimentAnalysis,
    engagement: ContentEngagement | undefined,
    relevance: number
  ): number {
    let score = sentiment.score;

    // Boost by engagement
    if (engagement) {
      const engagementBoost = (engagement.score / 100) * 20;
      score += sentiment.score > 0 ? engagementBoost : -engagementBoost;
    }

    // Scale by relevance
    score *= relevance / 100;

    return Math.max(-100, Math.min(100, score));
  }

  /**
   * Calculate mention confidence
   */
  private calculateMentionConfidence(
    relevance: number,
    sentimentConfidence: number,
    sourceCredibility: number
  ): number {
    return (relevance * 0.4 + sentimentConfidence * 0.3 + sourceCredibility * 0.3);
  }

  /**
   * Analyze correlation between content and market activity
   */
  private analyzeCorrelation(mention: MarketMention, marketId: string): ActivityCorrelation {
    // Simulated correlation analysis
    // In production, would analyze actual market activity data
    const correlation = (Math.random() - 0.5) * 2; // -1 to 1
    const lagHours = Math.floor(Math.random() * this.config.correlationLookback);
    const volumeChange = (Math.random() - 0.3) * 100;
    const priceChange = (Math.random() - 0.5) * 20;
    const confidence = mention.confidence * Math.random();
    const significant = Math.abs(correlation) > 0.3 && confidence > 50;

    return {
      contentId: mention.contentId,
      marketId,
      correlation,
      lagHours,
      volumeChange,
      priceChange,
      confidence,
      significant,
    };
  }

  /**
   * Calculate overall sentiment from mentions
   */
  private calculateOverallSentiment(mentions: MarketMention[]): {
    sentiment: Sentiment;
    score: number;
    confidence: number;
  } {
    if (mentions.length === 0) {
      return { sentiment: Sentiment.NEUTRAL, score: 0, confidence: 0 };
    }

    // Weight by relevance and confidence
    let weightedSum = 0;
    let totalWeight = 0;
    let confidenceSum = 0;

    for (const mention of mentions) {
      const weight = (mention.relevanceScore / 100) * (mention.confidence / 100);
      weightedSum += mention.sentimentScore * weight;
      totalWeight += weight;
      confidenceSum += mention.confidence;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const confidence = confidenceSum / mentions.length;

    return {
      sentiment: scoreToSentiment(score),
      score,
      confidence,
    };
  }

  /**
   * Extract key entities from mentions
   */
  private extractKeyEntities(mentions: MarketMention[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();

    for (const mention of mentions) {
      for (const entity of mention.entities) {
        const key = entity.normalized.toLowerCase();
        if (!entityMap.has(key) || entityMap.get(key)!.confidence < entity.confidence) {
          entityMap.set(key, entity);
        }
      }
    }

    // Sort by confidence and return top entities
    return Array.from(entityMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Generate context summary
   */
  private generateSummary(
    marketTitle: string,
    mentions: MarketMention[],
    sentiment: { sentiment: Sentiment; score: number; confidence: number },
    keyEntities: ExtractedEntity[]
  ): string {
    if (mentions.length === 0) {
      return `No relevant news or social media content found for "${truncateText(marketTitle, 50)}".`;
    }

    const sentimentDesc = getSentimentDescription(sentiment.sentiment).toLowerCase();
    const entityList = keyEntities
      .slice(0, 3)
      .map((e) => e.normalized)
      .join(", ");

    const sources = [...new Set(mentions.map((m) => m.contentId.split("_")[0]))].length;

    let summary = `Analysis of ${mentions.length} content items from ${sources} sources shows ${sentimentDesc} for "${truncateText(marketTitle, 40)}".`;

    if (keyEntities.length > 0) {
      summary += ` Key entities mentioned include: ${entityList}.`;
    }

    const highRelevance = mentions.filter((m) => m.relevance === RelevanceLevel.HIGHLY_RELEVANT);
    if (highRelevance.length > 0) {
      summary += ` Found ${highRelevance.length} highly relevant mention${highRelevance.length > 1 ? "s" : ""}.`;
    }

    return summary;
  }

  /**
   * Extract key insights from analysis
   */
  private extractKeyInsights(
    mentions: MarketMention[],
    sentiment: { sentiment: Sentiment; score: number; confidence: number },
    correlations: ActivityCorrelation[]
  ): string[] {
    const insights: string[] = [];

    // Sentiment insight
    if (sentiment.confidence > 60) {
      insights.push(
        `Media sentiment is ${sentiment.sentiment.replace("_", " ")} with ${Math.round(sentiment.confidence)}% confidence`
      );
    }

    // High relevance insight
    const highRelevance = mentions.filter((m) => m.relevance === RelevanceLevel.HIGHLY_RELEVANT);
    if (highRelevance.length > 0) {
      insights.push(
        `${highRelevance.length} highly relevant news item${highRelevance.length > 1 ? "s" : ""} found`
      );
    }

    // Strong impact insight
    const strongImpact = mentions.filter(
      (m) =>
        m.impact === ImpactPrediction.STRONG_BULLISH || m.impact === ImpactPrediction.STRONG_BEARISH
    );
    if (strongImpact.length > 0) {
      const firstImpact = strongImpact[0];
      if (firstImpact) {
        const direction =
          firstImpact.impact === ImpactPrediction.STRONG_BULLISH ? "bullish" : "bearish";
        insights.push(`${strongImpact.length} content item${strongImpact.length > 1 ? "s" : ""} suggest${strongImpact.length === 1 ? "s" : ""} strong ${direction} impact`);
      }
    }

    // Correlation insight
    const significantCorrelations = correlations.filter((c) => c.significant);
    if (significantCorrelations.length > 0) {
      insights.push(
        `${significantCorrelations.length} significant correlation${significantCorrelations.length > 1 ? "s" : ""} found between news and market activity`
      );
    }

    // Entity insight
    const uniqueEntities = new Set(mentions.flatMap((m) => m.entities.map((e) => e.type)));
    if (uniqueEntities.has(EntityType.PERSON)) {
      insights.push("Notable individuals mentioned in coverage");
    }
    if (uniqueEntities.has(EntityType.ORGANIZATION)) {
      insights.push("Organizations/institutions referenced");
    }

    // Source diversity insight
    const sourceTypes = new Set(mentions.map((m) => m.contentId.split("_")[0]));
    if (sourceTypes.size >= 3) {
      insights.push("Coverage from multiple source types indicates broad interest");
    }

    return insights.slice(0, 5);
  }

  /**
   * Predict market impact
   */
  private predictImpact(
    sentiment: { sentiment: Sentiment; score: number; confidence: number },
    correlations: ActivityCorrelation[],
    mentions: MarketMention[]
  ): { prediction: ImpactPrediction; confidence: number; reasoning: string } {
    if (mentions.length === 0) {
      return {
        prediction: ImpactPrediction.UNCERTAIN,
        confidence: 0,
        reasoning: "Insufficient data for impact prediction",
      };
    }

    // Calculate weighted impact score
    let impactScore = sentiment.score * 0.5;

    // Factor in correlation signals
    if (correlations.length > 0) {
      const avgCorrelation =
        correlations.reduce((sum, c) => sum + c.correlation, 0) / correlations.length;
      impactScore += avgCorrelation * 30;
    }

    // Factor in mention impacts
    const avgMentionImpact =
      mentions.reduce((sum, m) => {
        const impactMap: Record<ImpactPrediction, number> = {
          [ImpactPrediction.STRONG_BULLISH]: 80,
          [ImpactPrediction.BULLISH]: 50,
          [ImpactPrediction.SLIGHTLY_BULLISH]: 20,
          [ImpactPrediction.NEUTRAL]: 0,
          [ImpactPrediction.SLIGHTLY_BEARISH]: -20,
          [ImpactPrediction.BEARISH]: -50,
          [ImpactPrediction.STRONG_BEARISH]: -80,
          [ImpactPrediction.UNCERTAIN]: 0,
        };
        return sum + impactMap[m.impact];
      }, 0) / mentions.length;
    impactScore += avgMentionImpact * 0.3;

    // Calculate confidence
    const confidence = Math.min(
      (sentiment.confidence + mentions.reduce((sum, m) => sum + m.confidence, 0) / mentions.length) / 2,
      95
    );

    const prediction = scoreToImpact(impactScore, confidence);

    // Generate reasoning
    let reasoning = `Based on ${mentions.length} content items with ${sentiment.sentiment.replace("_", " ")} sentiment`;
    if (correlations.length > 0) {
      reasoning += ` and ${correlations.length} market correlation${correlations.length > 1 ? "s" : ""}`;
    }
    reasoning += `. ${getImpactDescription(prediction)}`;

    return { prediction, confidence, reasoning };
  }

  /**
   * Calculate media attention score
   */
  private calculateMediaAttention(content: ContentItem[], mentions: MarketMention[]): number {
    if (content.length === 0) return 0;

    // Factor in content count
    const countScore = Math.min(content.length * 5, 40);

    // Factor in engagement
    const totalEngagement = content.reduce(
      (sum, item) => sum + (item.engagement?.score || 0),
      0
    );
    const avgEngagement = totalEngagement / content.length;
    const engagementScore = Math.min(avgEngagement, 30);

    // Factor in source credibility
    const avgCredibility =
      content.reduce((sum, item) => sum + item.source.credibility, 0) / content.length;
    const credibilityScore = avgCredibility * 0.2;

    // Factor in relevance
    const relevanceScore =
      (mentions.reduce((sum, m) => sum + m.relevanceScore, 0) / Math.max(mentions.length, 1)) * 0.1;

    return Math.min(countScore + engagementScore + credibilityScore + relevanceScore, 100);
  }

  /**
   * Calculate trending score
   */
  private calculateTrendingScore(content: ContentItem[], mentions: MarketMention[]): number {
    if (content.length === 0) return 0;

    // Recent content weight
    const recentContent = content.filter(
      (item) => calculateContentAge(item.publishedAt) <= 24
    );
    const recencyScore = (recentContent.length / content.length) * 40;

    // Engagement velocity
    const totalEngagement = content.reduce(
      (sum, item) => sum + (item.engagement?.score || 0),
      0
    );
    const engagementScore = Math.min(totalEngagement / content.length, 30);

    // High-impact mentions
    const highImpact = mentions.filter(
      (m) =>
        m.impact === ImpactPrediction.STRONG_BULLISH ||
        m.impact === ImpactPrediction.STRONG_BEARISH ||
        m.impact === ImpactPrediction.BULLISH ||
        m.impact === ImpactPrediction.BEARISH
    );
    const impactScore = Math.min(highImpact.length * 10, 30);

    return Math.min(recencyScore + engagementScore + impactScore, 100);
  }

  /**
   * Prune cache to max size
   */
  private pruneCache(): void {
    if (this.cache.size <= this.config.maxCacheSize) return;

    // Remove oldest entries
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  /**
   * Get analysis statistics
   */
  getStats(): { analysisCount: number; avgAnalysisTime: number } {
    return {
      analysisCount: this.analysisCount,
      avgAnalysisTime: this.analysisCount > 0 ? this.totalAnalysisTime / this.analysisCount : 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MarketContextAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<MarketContextAnalyzerConfig> {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let sharedInstance: MarketContextAnalyzer | null = null;

/**
 * Create a new MarketContextAnalyzer instance
 */
export function createMarketContextAnalyzer(
  config?: MarketContextAnalyzerConfig
): MarketContextAnalyzer {
  return new MarketContextAnalyzer(config);
}

/**
 * Get shared MarketContextAnalyzer instance
 */
export function getSharedMarketContextAnalyzer(): MarketContextAnalyzer {
  if (!sharedInstance) {
    sharedInstance = new MarketContextAnalyzer();
  }
  return sharedInstance;
}

/**
 * Set shared MarketContextAnalyzer instance
 */
export function setSharedMarketContextAnalyzer(instance: MarketContextAnalyzer): void {
  sharedInstance = instance;
}

/**
 * Reset shared MarketContextAnalyzer instance
 */
export function resetSharedMarketContextAnalyzer(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze market context using shared instance
 */
export async function analyzeMarketContext(
  marketId: string,
  marketTitle: string,
  marketCategory?: string
): Promise<MarketContextResult> {
  const analyzer = getSharedMarketContextAnalyzer();
  return analyzer.analyzeMarket(marketId, marketTitle, marketCategory);
}

/**
 * Get sentiment for text
 */
export function getSentiment(text: string): SentimentAnalysis {
  const analyzer = new MarketContextAnalyzer();
  return (analyzer as any).analyzeSentiment(text);
}

/**
 * Check if content is relevant to market
 */
export function isContentRelevant(
  content: string,
  marketTitle: string,
  minScore: number = 30
): boolean {
  const keywords = extractMarketKeywords(marketTitle);
  const { score } = calculateKeywordMatch(content, keywords);
  return score >= minScore;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Create mock content item
 */
export function createMockContentItem(overrides?: Partial<ContentItem>): ContentItem {
  const now = new Date();
  const source: ContentSource = {
    id: "mock-source",
    type: ContentSourceType.NEWS,
    name: "Mock News",
    enabled: true,
    credibility: 75,
  };

  return {
    id: `mock_content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    source,
    title: "Mock Content Title",
    content: "This is mock content for testing purposes. Markets show positive trends.",
    url: "https://example.com/mock",
    author: "@mock_author",
    publishedAt: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000),
    fetchedAt: now,
    language: "en",
    engagement: {
      likes: Math.floor(Math.random() * 500),
      shares: Math.floor(Math.random() * 200),
      comments: Math.floor(Math.random() * 100),
      views: Math.floor(Math.random() * 5000),
      score: Math.random() * 100,
    },
    tags: ["mock", "test"],
    ...overrides,
  };
}

/**
 * Create mock market mention
 */
export function createMockMarketMention(overrides?: Partial<MarketMention>): MarketMention {
  return {
    contentId: `mock_content_${Date.now()}`,
    marketId: "mock_market_123",
    marketTitle: "Will mock event happen?",
    relevance: RelevanceLevel.RELEVANT,
    relevanceScore: 65,
    sentiment: Sentiment.POSITIVE,
    sentimentScore: 35,
    entities: [],
    snippet: "...relevant content about the market...",
    impact: ImpactPrediction.SLIGHTLY_BULLISH,
    confidence: 70,
    ...overrides,
  };
}

/**
 * Create mock market context result
 */
export function createMockContextResult(overrides?: Partial<MarketContextResult>): MarketContextResult {
  return {
    marketId: "mock_market_123",
    marketTitle: "Will mock event happen?",
    analyzedAt: new Date(),
    status: AnalysisStatus.COMPLETED,
    analysisTime: 150,
    contentCount: 10,
    mentions: [createMockMarketMention()],
    overallSentiment: {
      sentiment: Sentiment.POSITIVE,
      score: 30,
      confidence: 65,
    },
    keyEntities: [],
    correlations: [],
    summary: "Analysis shows positive sentiment for the market.",
    keyInsights: ["Media sentiment is positive with 65% confidence"],
    impactPrediction: {
      prediction: ImpactPrediction.SLIGHTLY_BULLISH,
      confidence: 60,
      reasoning: "Based on positive media coverage",
    },
    trendingScore: 45,
    mediaAttention: 55,
    ...overrides,
  };
}
