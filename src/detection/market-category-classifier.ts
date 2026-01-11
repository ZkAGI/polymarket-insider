/**
 * Market Category Classifier (DET-NICHE-001)
 *
 * Classify markets into categories (political, geopolitical, etc.) based on
 * their titles, descriptions, and other metadata.
 *
 * Features:
 * - Define comprehensive category taxonomy with keywords and patterns
 * - Parse market titles and descriptions for classification signals
 * - Apply rule-based classification with keyword matching
 * - Support for weighted scoring when multiple categories match
 * - Store and cache category assignments
 * - Handle multi-category markets with primary/secondary assignments
 */

import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Confidence level for a classification decision
 */
export enum ClassificationConfidence {
  /** Very high confidence (90%+) - multiple strong signals */
  VERY_HIGH = "VERY_HIGH",
  /** High confidence (75-90%) - clear category signals */
  HIGH = "HIGH",
  /** Medium confidence (50-75%) - some signals present */
  MEDIUM = "MEDIUM",
  /** Low confidence (25-50%) - weak signals */
  LOW = "LOW",
  /** Very low confidence (<25%) - minimal signals */
  VERY_LOW = "VERY_LOW",
}

/**
 * Represents a keyword pattern for classification
 */
export interface KeywordPattern {
  /** The keyword or phrase to match */
  keyword: string;
  /** Weight for this keyword (higher = stronger signal) */
  weight: number;
  /** Whether this is an exact match or partial match */
  exactMatch?: boolean;
  /** Whether the match is case-sensitive */
  caseSensitive?: boolean;
  /** Additional context words that must also be present */
  requiredContext?: string[];
  /** Words that if present should exclude this match */
  excludeIfPresent?: string[];
}

/**
 * Category pattern configuration
 */
export interface CategoryPatterns {
  /** The category this pattern set applies to */
  category: MarketCategory;
  /** Primary keywords with high weight */
  primaryKeywords: KeywordPattern[];
  /** Secondary keywords with moderate weight */
  secondaryKeywords: KeywordPattern[];
  /** Regex patterns for complex matching */
  regexPatterns?: RegExp[];
  /** Minimum score required to assign this category */
  minScoreThreshold: number;
  /** Base priority when scores are tied */
  basePriority: number;
}

/**
 * Result of classifying a single category
 */
export interface CategoryScore {
  /** The category evaluated */
  category: MarketCategory;
  /** Raw score from keyword matches */
  rawScore: number;
  /** Normalized score (0-100) */
  normalizedScore: number;
  /** Number of keyword matches */
  matchCount: number;
  /** Matched keywords for debugging */
  matchedKeywords: string[];
  /** Whether this met the minimum threshold */
  meetsThreshold: boolean;
}

/**
 * Market data for classification
 */
export interface MarketForClassification {
  /** Market ID */
  id: string;
  /** Market question/title */
  question: string;
  /** Market description */
  description?: string;
  /** Existing category from API (if any) */
  existingCategory?: string;
  /** Market slug (URL-friendly identifier) */
  slug?: string;
  /** Tags associated with the market */
  tags?: string[];
}

/**
 * Result of market classification
 */
export interface MarketClassificationResult {
  /** Market ID */
  marketId: string;
  /** Market question for reference */
  question: string;
  /** Primary assigned category */
  primaryCategory: MarketCategory;
  /** Confidence in the primary classification */
  confidence: ClassificationConfidence;
  /** Confidence score as percentage (0-100) */
  confidenceScore: number;
  /** Secondary categories if applicable */
  secondaryCategories: MarketCategory[];
  /** Scores for all categories evaluated */
  categoryScores: CategoryScore[];
  /** Whether this market has insider information potential */
  hasInsiderPotential: boolean;
  /** Insider potential score (0-100) */
  insiderPotentialScore: number;
  /** Timestamp of classification */
  classifiedAt: Date;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Options for classification
 */
export interface ClassifyMarketOptions {
  /** Include secondary category assignments */
  includeSecondary?: boolean;
  /** Maximum number of secondary categories */
  maxSecondaryCategories?: number;
  /** Minimum score for secondary category inclusion */
  secondaryMinScore?: number;
  /** Override existing category */
  overrideExisting?: boolean;
  /** Bypass cache */
  bypassCache?: boolean;
}

/**
 * Batch classification result
 */
export interface BatchClassificationResult {
  /** Successful classifications by market ID */
  results: Map<string, MarketClassificationResult>;
  /** Failed market IDs with error messages */
  errors: Map<string, string>;
  /** Total markets processed */
  totalProcessed: number;
  /** Number of successful classifications */
  successCount: number;
  /** Number of failed classifications */
  errorCount: number;
  /** Category distribution */
  categoryDistribution: Map<MarketCategory, number>;
  /** Average confidence score */
  averageConfidence: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for classification
 */
export interface ClassificationSummary {
  /** Total markets classified */
  totalClassified: number;
  /** Classification count by category */
  categoryBreakdown: Map<MarketCategory, number>;
  /** Classification count by confidence level */
  confidenceBreakdown: Map<ClassificationConfidence, number>;
  /** Average confidence score */
  averageConfidenceScore: number;
  /** Markets with high insider potential */
  highInsiderPotentialCount: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Classifications per minute (performance metric) */
  classificationsPerMinute: number;
}

/**
 * Configuration for the classifier
 */
export interface MarketCategoryClassifierConfig {
  /** Cache TTL in milliseconds (default: 24 hours) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 10000) */
  maxCacheSize?: number;
  /** Default minimum score threshold */
  defaultMinScoreThreshold?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom category patterns (overrides defaults) */
  customPatterns?: CategoryPatterns[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cache TTL: 24 hours
 */
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Default maximum cache size
 */
const DEFAULT_MAX_CACHE_SIZE = 10000;

/**
 * Default minimum score threshold for category assignment
 */
const DEFAULT_MIN_SCORE_THRESHOLD = 10;

/**
 * High insider potential score threshold
 */
const HIGH_INSIDER_POTENTIAL_THRESHOLD = 60;

/**
 * Categories with high insider information potential
 */
export const HIGH_INSIDER_CATEGORIES: MarketCategory[] = [
  MarketCategory.POLITICS,
  MarketCategory.GEOPOLITICS,
  MarketCategory.LEGAL,
  MarketCategory.ECONOMY,
];

/**
 * Default keyword patterns for each category
 */
export const DEFAULT_CATEGORY_PATTERNS: CategoryPatterns[] = [
  // POLITICS
  {
    category: MarketCategory.POLITICS,
    primaryKeywords: [
      { keyword: "election", weight: 10 },
      { keyword: "president", weight: 10 },
      { keyword: "congress", weight: 9 },
      { keyword: "senate", weight: 9 },
      { keyword: "democrat", weight: 8 },
      { keyword: "republican", weight: 8 },
      { keyword: "biden", weight: 10 },
      { keyword: "trump", weight: 10 },
      { keyword: "vote", weight: 7 },
      { keyword: "poll", weight: 6 },
      { keyword: "primary", weight: 7 },
      { keyword: "nominee", weight: 8 },
      { keyword: "governor", weight: 8 },
      { keyword: "mayor", weight: 7 },
      { keyword: "campaign", weight: 6 },
      { keyword: "ballot", weight: 8 },
      { keyword: "electoral", weight: 9 },
      { keyword: "impeach", weight: 9 },
      { keyword: "legislation", weight: 7 },
      { keyword: "parliament", weight: 8 },
      { keyword: "prime minister", weight: 9 },
      { keyword: "cabinet", weight: 6 },
      { keyword: "speaker of the house", weight: 9 },
      { keyword: "midterm", weight: 8 },
      { keyword: "swing state", weight: 8 },
      { keyword: "caucus", weight: 7 },
      { keyword: "political party", weight: 7 },
    ],
    secondaryKeywords: [
      { keyword: "policy", weight: 4 },
      { keyword: "government", weight: 4 },
      { keyword: "politician", weight: 5 },
      { keyword: "lawmaker", weight: 5 },
      { keyword: "constituency", weight: 4 },
      { keyword: "voter", weight: 4 },
      { keyword: "candidate", weight: 5 },
      { keyword: "party", weight: 3 },
      { keyword: "liberal", weight: 4 },
      { keyword: "conservative", weight: 4 },
    ],
    minScoreThreshold: 10,
    basePriority: 10,
  },

  // GEOPOLITICS
  {
    category: MarketCategory.GEOPOLITICS,
    primaryKeywords: [
      { keyword: "war", weight: 10 },
      { keyword: "invasion", weight: 10 },
      { keyword: "ukraine", weight: 9 },
      { keyword: "russia", weight: 8 },
      { keyword: "china", weight: 7 },
      { keyword: "taiwan", weight: 9 },
      { keyword: "nato", weight: 9 },
      { keyword: "military", weight: 7 },
      { keyword: "sanction", weight: 8 },
      { keyword: "treaty", weight: 8 },
      { keyword: "diplomat", weight: 7 },
      { keyword: "nuclear", weight: 9 },
      { keyword: "missile", weight: 8 },
      { keyword: "conflict", weight: 7 },
      { keyword: "territory", weight: 6 },
      { keyword: "occupation", weight: 8 },
      { keyword: "ceasefire", weight: 9 },
      { keyword: "peace talks", weight: 8 },
      { keyword: "un security council", weight: 9 },
      { keyword: "israel", weight: 7 },
      { keyword: "gaza", weight: 8 },
      { keyword: "iran", weight: 7 },
      { keyword: "north korea", weight: 8 },
      { keyword: "south korea", weight: 6 },
      { keyword: "middle east", weight: 7 },
      { keyword: "european union", weight: 6 },
      { keyword: "border", weight: 5 },
      { keyword: "sovereignty", weight: 7 },
    ],
    secondaryKeywords: [
      { keyword: "international", weight: 4 },
      { keyword: "foreign", weight: 4 },
      { keyword: "alliance", weight: 5 },
      { keyword: "summit", weight: 4 },
      { keyword: "negotiation", weight: 4 },
      { keyword: "embargo", weight: 5 },
      { keyword: "refugee", weight: 5 },
      { keyword: "humanitarian", weight: 4 },
    ],
    minScoreThreshold: 10,
    basePriority: 9,
  },

  // CRYPTO
  {
    category: MarketCategory.CRYPTO,
    primaryKeywords: [
      { keyword: "bitcoin", weight: 10 },
      { keyword: "btc", weight: 10 },
      { keyword: "ethereum", weight: 10 },
      { keyword: "eth", weight: 10 },
      { keyword: "crypto", weight: 9 },
      { keyword: "cryptocurrency", weight: 9 },
      { keyword: "blockchain", weight: 8 },
      { keyword: "defi", weight: 9 },
      { keyword: "nft", weight: 8 },
      { keyword: "token", weight: 6 },
      { keyword: "solana", weight: 8 },
      { keyword: "cardano", weight: 8 },
      { keyword: "binance", weight: 8 },
      { keyword: "coinbase", weight: 8 },
      { keyword: "altcoin", weight: 8 },
      { keyword: "stablecoin", weight: 8 },
      { keyword: "usdc", weight: 7 },
      { keyword: "usdt", weight: 7 },
      { keyword: "mining", weight: 5, requiredContext: ["bitcoin", "crypto", "block"] },
      { keyword: "halving", weight: 9 },
      { keyword: "satoshi", weight: 8 },
      { keyword: "wallet", weight: 4, requiredContext: ["crypto", "bitcoin", "ethereum"] },
      { keyword: "dex", weight: 8 },
      { keyword: "uniswap", weight: 8 },
      { keyword: "airdrop", weight: 7 },
      { keyword: "polygon", weight: 7, requiredContext: ["crypto", "matic", "blockchain"] },
      { keyword: "matic", weight: 8 },
      { keyword: "layer 2", weight: 7 },
      { keyword: "l2", weight: 6, requiredContext: ["crypto", "ethereum", "blockchain"] },
      { keyword: "dogecoin", weight: 8 },
      { keyword: "doge", weight: 7 },
      { keyword: "xrp", weight: 8 },
      { keyword: "ripple", weight: 8 },
    ],
    secondaryKeywords: [
      { keyword: "decentralized", weight: 5 },
      { keyword: "smart contract", weight: 6 },
      { keyword: "gas fee", weight: 6 },
      { keyword: "protocol", weight: 3 },
      { keyword: "web3", weight: 6 },
      { keyword: "metaverse", weight: 5 },
    ],
    minScoreThreshold: 10,
    basePriority: 7,
  },

  // SPORTS
  {
    category: MarketCategory.SPORTS,
    primaryKeywords: [
      { keyword: "nfl", weight: 10 },
      { keyword: "nba", weight: 10 },
      { keyword: "mlb", weight: 10 },
      { keyword: "nhl", weight: 10 },
      { keyword: "super bowl", weight: 10 },
      { keyword: "world series", weight: 10 },
      { keyword: "world cup", weight: 10 },
      { keyword: "olympics", weight: 10 },
      { keyword: "championship", weight: 8 },
      { keyword: "playoff", weight: 8 },
      { keyword: "finals", weight: 7 },
      { keyword: "mvp", weight: 8 },
      { keyword: "touchdown", weight: 9 },
      { keyword: "home run", weight: 9 },
      { keyword: "slam dunk", weight: 8 },
      { keyword: "goal", weight: 5, requiredContext: ["soccer", "football", "hockey"] },
      { keyword: "premier league", weight: 10 },
      { keyword: "la liga", weight: 10 },
      { keyword: "bundesliga", weight: 10 },
      { keyword: "serie a", weight: 10 },
      { keyword: "champions league", weight: 10 },
      { keyword: "tennis", weight: 8 },
      { keyword: "wimbledon", weight: 10 },
      { keyword: "us open", weight: 9 },
      { keyword: "pga", weight: 9 },
      { keyword: "masters", weight: 7, requiredContext: ["golf", "pga", "tournament"] },
      { keyword: "formula 1", weight: 10 },
      { keyword: "f1", weight: 10 },
      { keyword: "mma", weight: 9 },
      { keyword: "ufc", weight: 10 },
      { keyword: "boxing", weight: 9 },
      { keyword: "esports", weight: 8 },
      { keyword: "player", weight: 4 },
      { keyword: "team", weight: 3 },
      { keyword: "coach", weight: 5 },
      { keyword: "draft", weight: 6, requiredContext: ["nfl", "nba", "player"] },
    ],
    secondaryKeywords: [
      { keyword: "season", weight: 3 },
      { keyword: "match", weight: 3 },
      { keyword: "game", weight: 2 },
      { keyword: "score", weight: 2 },
      { keyword: "win", weight: 2 },
      { keyword: "league", weight: 3 },
      { keyword: "tournament", weight: 4 },
      { keyword: "cup", weight: 3 },
    ],
    minScoreThreshold: 10,
    basePriority: 5,
  },

  // TECH
  {
    category: MarketCategory.TECH,
    primaryKeywords: [
      { keyword: "apple", weight: 8 },
      { keyword: "google", weight: 8 },
      { keyword: "microsoft", weight: 8 },
      { keyword: "amazon", weight: 7 },
      { keyword: "meta", weight: 7 },
      { keyword: "facebook", weight: 7 },
      { keyword: "twitter", weight: 7 },
      { keyword: "elon musk", weight: 8 },
      { keyword: "ai", weight: 8 },
      { keyword: "artificial intelligence", weight: 9 },
      { keyword: "machine learning", weight: 8 },
      { keyword: "chatgpt", weight: 9 },
      { keyword: "openai", weight: 9 },
      { keyword: "gpt", weight: 8 },
      { keyword: "iphone", weight: 8 },
      { keyword: "android", weight: 7 },
      { keyword: "tesla", weight: 8 },
      { keyword: "spacex", weight: 8 },
      { keyword: "starlink", weight: 8 },
      { keyword: "nvidia", weight: 8 },
      { keyword: "chip", weight: 5, requiredContext: ["semiconductor", "processor", "nvidia"] },
      { keyword: "semiconductor", weight: 8 },
      { keyword: "software", weight: 5 },
      { keyword: "startup", weight: 6 },
      { keyword: "ipo", weight: 7 },
      { keyword: "tech stock", weight: 8 },
      { keyword: "silicon valley", weight: 7 },
      { keyword: "cybersecurity", weight: 7 },
      { keyword: "data breach", weight: 8 },
      { keyword: "hack", weight: 6 },
      { keyword: "5g", weight: 7 },
      { keyword: "quantum computing", weight: 8 },
      { keyword: "robotics", weight: 7 },
      { keyword: "autonomous", weight: 6 },
      { keyword: "self-driving", weight: 8 },
    ],
    secondaryKeywords: [
      { keyword: "tech", weight: 4 },
      { keyword: "technology", weight: 4 },
      { keyword: "app", weight: 3 },
      { keyword: "digital", weight: 3 },
      { keyword: "innovation", weight: 3 },
      { keyword: "platform", weight: 3 },
      { keyword: "cloud", weight: 4 },
      { keyword: "computing", weight: 4 },
    ],
    minScoreThreshold: 10,
    basePriority: 6,
  },

  // BUSINESS
  {
    category: MarketCategory.BUSINESS,
    primaryKeywords: [
      { keyword: "stock", weight: 8 },
      { keyword: "earnings", weight: 9 },
      { keyword: "quarterly report", weight: 9 },
      { keyword: "revenue", weight: 7 },
      { keyword: "profit", weight: 7 },
      { keyword: "merger", weight: 9 },
      { keyword: "acquisition", weight: 9 },
      { keyword: "bankruptcy", weight: 9 },
      { keyword: "ceo", weight: 7 },
      { keyword: "layoff", weight: 8 },
      { keyword: "ipo", weight: 8 },
      { keyword: "nasdaq", weight: 8 },
      { keyword: "s&p 500", weight: 8 },
      { keyword: "dow jones", weight: 8 },
      { keyword: "wall street", weight: 8 },
      { keyword: "hedge fund", weight: 8 },
      { keyword: "venture capital", weight: 7 },
      { keyword: "valuation", weight: 7 },
      { keyword: "market cap", weight: 8 },
      { keyword: "dividend", weight: 7 },
      { keyword: "shareholder", weight: 7 },
      { keyword: "sec", weight: 8 },
      { keyword: "quarterly", weight: 6 },
      { keyword: "fiscal", weight: 6 },
      { keyword: "annual report", weight: 7 },
    ],
    secondaryKeywords: [
      { keyword: "company", weight: 3 },
      { keyword: "business", weight: 3 },
      { keyword: "corporation", weight: 4 },
      { keyword: "industry", weight: 3 },
      { keyword: "market", weight: 2 },
      { keyword: "investor", weight: 4 },
      { keyword: "trading", weight: 3 },
      { keyword: "shares", weight: 4 },
    ],
    minScoreThreshold: 10,
    basePriority: 6,
  },

  // ECONOMY
  {
    category: MarketCategory.ECONOMY,
    primaryKeywords: [
      { keyword: "inflation", weight: 10 },
      { keyword: "gdp", weight: 10 },
      { keyword: "interest rate", weight: 10 },
      { keyword: "federal reserve", weight: 10 },
      { keyword: "fed", weight: 9 },
      { keyword: "unemployment", weight: 9 },
      { keyword: "recession", weight: 10 },
      { keyword: "jobs report", weight: 9 },
      { keyword: "cpi", weight: 10 },
      { keyword: "consumer price index", weight: 10 },
      { keyword: "ppi", weight: 9 },
      { keyword: "treasury", weight: 8 },
      { keyword: "yield", weight: 6, requiredContext: ["bond", "treasury", "rate"] },
      { keyword: "bond", weight: 6 },
      { keyword: "monetary policy", weight: 9 },
      { keyword: "fiscal policy", weight: 8 },
      { keyword: "economic growth", weight: 8 },
      { keyword: "trade deficit", weight: 8 },
      { keyword: "tariff", weight: 8 },
      { keyword: "central bank", weight: 9 },
      { keyword: "ecb", weight: 9 },
      { keyword: "boe", weight: 8 },
      { keyword: "rate hike", weight: 9 },
      { keyword: "rate cut", weight: 9 },
      { keyword: "quantitative easing", weight: 9 },
      { keyword: "qe", weight: 8 },
      { keyword: "stimulus", weight: 7 },
      { keyword: "fomc", weight: 10 },
      { keyword: "payroll", weight: 7 },
      { keyword: "labor market", weight: 8 },
    ],
    secondaryKeywords: [
      { keyword: "economy", weight: 4 },
      { keyword: "economic", weight: 4 },
      { keyword: "financial", weight: 3 },
      { keyword: "growth", weight: 3 },
      { keyword: "price", weight: 2 },
      { keyword: "cost", weight: 2 },
      { keyword: "spending", weight: 3 },
      { keyword: "debt", weight: 4 },
    ],
    minScoreThreshold: 10,
    basePriority: 9,
  },

  // LEGAL
  {
    category: MarketCategory.LEGAL,
    primaryKeywords: [
      { keyword: "supreme court", weight: 10 },
      { keyword: "lawsuit", weight: 9 },
      { keyword: "indictment", weight: 10 },
      { keyword: "trial", weight: 8 },
      { keyword: "verdict", weight: 9 },
      { keyword: "conviction", weight: 9 },
      { keyword: "acquittal", weight: 9 },
      { keyword: "guilty", weight: 8 },
      { keyword: "not guilty", weight: 8 },
      { keyword: "sentence", weight: 7, requiredContext: ["court", "trial", "prison", "jail"] },
      { keyword: "judge", weight: 7 },
      { keyword: "jury", weight: 8 },
      { keyword: "prosecutor", weight: 8 },
      { keyword: "attorney general", weight: 9 },
      { keyword: "doj", weight: 9 },
      { keyword: "fbi", weight: 8 },
      { keyword: "court ruling", weight: 9 },
      { keyword: "appeal", weight: 7 },
      { keyword: "settlement", weight: 7 },
      { keyword: "class action", weight: 8 },
      { keyword: "antitrust", weight: 9 },
      { keyword: "regulation", weight: 6 },
      { keyword: "sec investigation", weight: 9 },
      { keyword: "criminal charges", weight: 9 },
      { keyword: "plea deal", weight: 9 },
      { keyword: "extradition", weight: 8 },
      { keyword: "subpoena", weight: 8 },
      { keyword: "testimony", weight: 7 },
    ],
    secondaryKeywords: [
      { keyword: "legal", weight: 4 },
      { keyword: "law", weight: 3 },
      { keyword: "court", weight: 4 },
      { keyword: "case", weight: 2 },
      { keyword: "ruling", weight: 4 },
      { keyword: "justice", weight: 3 },
      { keyword: "defendant", weight: 5 },
      { keyword: "plaintiff", weight: 5 },
    ],
    minScoreThreshold: 10,
    basePriority: 9,
  },

  // ENTERTAINMENT
  {
    category: MarketCategory.ENTERTAINMENT,
    primaryKeywords: [
      { keyword: "oscar", weight: 10 },
      { keyword: "academy awards", weight: 10 },
      { keyword: "grammy", weight: 10 },
      { keyword: "emmy", weight: 10 },
      { keyword: "golden globe", weight: 10 },
      { keyword: "box office", weight: 9 },
      { keyword: "movie", weight: 6 },
      { keyword: "film", weight: 5 },
      { keyword: "netflix", weight: 7 },
      { keyword: "disney", weight: 7 },
      { keyword: "marvel", weight: 8 },
      { keyword: "dc", weight: 6 },
      { keyword: "celebrity", weight: 7 },
      { keyword: "album", weight: 6 },
      { keyword: "billboard", weight: 8 },
      { keyword: "concert", weight: 6 },
      { keyword: "tour", weight: 4, requiredContext: ["concert", "music", "band", "artist"] },
      { keyword: "streaming", weight: 5 },
      { keyword: "tv show", weight: 6 },
      { keyword: "reality tv", weight: 7 },
      { keyword: "bachelor", weight: 7 },
      { keyword: "kardashian", weight: 8 },
      { keyword: "taylor swift", weight: 9 },
      { keyword: "beyonce", weight: 9 },
      { keyword: "drake", weight: 8 },
      { keyword: "kanye", weight: 8 },
      { keyword: "award show", weight: 8 },
      { keyword: "nomination", weight: 5, requiredContext: ["oscar", "grammy", "emmy", "award"] },
    ],
    secondaryKeywords: [
      { keyword: "entertainment", weight: 4 },
      { keyword: "star", weight: 2 },
      { keyword: "actor", weight: 4 },
      { keyword: "actress", weight: 4 },
      { keyword: "singer", weight: 4 },
      { keyword: "artist", weight: 2 },
      { keyword: "performance", weight: 3 },
      { keyword: "show", weight: 2 },
    ],
    minScoreThreshold: 10,
    basePriority: 4,
  },

  // SCIENCE
  {
    category: MarketCategory.SCIENCE,
    primaryKeywords: [
      { keyword: "nasa", weight: 10 },
      { keyword: "space", weight: 7 },
      { keyword: "mars", weight: 8 },
      { keyword: "moon landing", weight: 9 },
      { keyword: "artemis", weight: 9 },
      { keyword: "asteroid", weight: 8 },
      { keyword: "rocket launch", weight: 8 },
      { keyword: "scientific study", weight: 8 },
      { keyword: "research", weight: 5 },
      { keyword: "climate change", weight: 9 },
      { keyword: "global warming", weight: 9 },
      { keyword: "emissions", weight: 7 },
      { keyword: "nobel prize", weight: 10 },
      { keyword: "breakthrough", weight: 6 },
      { keyword: "discovery", weight: 5 },
      { keyword: "experiment", weight: 5 },
      { keyword: "physicist", weight: 7 },
      { keyword: "cern", weight: 9 },
      { keyword: "particle physics", weight: 9 },
      { keyword: "vaccine", weight: 8 },
      { keyword: "clinical trial", weight: 9 },
      { keyword: "genome", weight: 8 },
      { keyword: "dna", weight: 7 },
      { keyword: "crispr", weight: 9 },
      { keyword: "telescope", weight: 7 },
      { keyword: "james webb", weight: 9 },
      { keyword: "exoplanet", weight: 8 },
      { keyword: "alien life", weight: 9 },
    ],
    secondaryKeywords: [
      { keyword: "science", weight: 4 },
      { keyword: "scientific", weight: 4 },
      { keyword: "scientist", weight: 4 },
      { keyword: "laboratory", weight: 5 },
      { keyword: "study", weight: 2 },
      { keyword: "evidence", weight: 2 },
      { keyword: "theory", weight: 3 },
      { keyword: "data", weight: 2 },
    ],
    minScoreThreshold: 10,
    basePriority: 5,
  },

  // HEALTH
  {
    category: MarketCategory.HEALTH,
    primaryKeywords: [
      { keyword: "fda approval", weight: 10 },
      { keyword: "drug approval", weight: 10 },
      { keyword: "covid", weight: 9 },
      { keyword: "pandemic", weight: 9 },
      { keyword: "vaccine", weight: 8 },
      { keyword: "pfizer", weight: 8 },
      { keyword: "moderna", weight: 8 },
      { keyword: "who", weight: 7 },
      { keyword: "world health organization", weight: 8 },
      { keyword: "cdc", weight: 8 },
      { keyword: "nih", weight: 8 },
      { keyword: "outbreak", weight: 8 },
      { keyword: "disease", weight: 7 },
      { keyword: "virus", weight: 7 },
      { keyword: "hospital", weight: 5 },
      { keyword: "healthcare", weight: 6 },
      { keyword: "opioid", weight: 8 },
      { keyword: "overdose", weight: 7 },
      { keyword: "mental health", weight: 7 },
      { keyword: "cancer treatment", weight: 8 },
      { keyword: "clinical trial", weight: 8 },
      { keyword: "pharmaceutical", weight: 7 },
      { keyword: "biotech", weight: 7 },
      { keyword: "medical device", weight: 7 },
      { keyword: "health insurance", weight: 6 },
      { keyword: "medicare", weight: 7 },
      { keyword: "medicaid", weight: 7 },
      { keyword: "affordable care act", weight: 8 },
      { keyword: "obamacare", weight: 8 },
    ],
    secondaryKeywords: [
      { keyword: "health", weight: 3 },
      { keyword: "medical", weight: 4 },
      { keyword: "medicine", weight: 4 },
      { keyword: "treatment", weight: 3 },
      { keyword: "patient", weight: 3 },
      { keyword: "doctor", weight: 3 },
      { keyword: "symptom", weight: 3 },
      { keyword: "diagnosis", weight: 4 },
    ],
    minScoreThreshold: 10,
    basePriority: 7,
  },

  // WEATHER
  {
    category: MarketCategory.WEATHER,
    primaryKeywords: [
      { keyword: "hurricane", weight: 10 },
      { keyword: "tornado", weight: 10 },
      { keyword: "earthquake", weight: 10 },
      { keyword: "tsunami", weight: 10 },
      { keyword: "flood", weight: 9 },
      { keyword: "wildfire", weight: 9 },
      { keyword: "drought", weight: 8 },
      { keyword: "blizzard", weight: 9 },
      { keyword: "snowstorm", weight: 8 },
      { keyword: "heatwave", weight: 8 },
      { keyword: "heat wave", weight: 8 },
      { keyword: "cold snap", weight: 7 },
      { keyword: "noaa", weight: 9 },
      { keyword: "national weather service", weight: 9 },
      { keyword: "tropical storm", weight: 9 },
      { keyword: "category 5", weight: 10 },
      { keyword: "landfall", weight: 8 },
      { keyword: "storm surge", weight: 8 },
      { keyword: "el nino", weight: 8 },
      { keyword: "la nina", weight: 8 },
      { keyword: "temperature record", weight: 8 },
      { keyword: "weather forecast", weight: 7 },
      { keyword: "precipitation", weight: 6 },
      { keyword: "rainfall", weight: 6 },
      { keyword: "snowfall", weight: 6 },
    ],
    secondaryKeywords: [
      { keyword: "weather", weight: 4 },
      { keyword: "climate", weight: 4 },
      { keyword: "storm", weight: 4 },
      { keyword: "temperature", weight: 3 },
      { keyword: "wind", weight: 2 },
      { keyword: "rain", weight: 2 },
      { keyword: "snow", weight: 2 },
      { keyword: "sunny", weight: 2 },
    ],
    minScoreThreshold: 10,
    basePriority: 4,
  },

  // CULTURE
  {
    category: MarketCategory.CULTURE,
    primaryKeywords: [
      { keyword: "social media", weight: 7 },
      { keyword: "viral", weight: 6 },
      { keyword: "trend", weight: 5 },
      { keyword: "meme", weight: 7 },
      { keyword: "influencer", weight: 7 },
      { keyword: "tiktok", weight: 8 },
      { keyword: "instagram", weight: 7 },
      { keyword: "youtube", weight: 6 },
      { keyword: "twitter", weight: 6 },
      { keyword: "reddit", weight: 6 },
      { keyword: "scandal", weight: 7 },
      { keyword: "controversy", weight: 6 },
      { keyword: "cancel", weight: 6 },
      { keyword: "protest", weight: 7 },
      { keyword: "movement", weight: 5 },
      { keyword: "activism", weight: 6 },
      { keyword: "hashtag", weight: 5 },
      { keyword: "trending", weight: 5 },
      { keyword: "fashion", weight: 6 },
      { keyword: "lifestyle", weight: 5 },
      { keyword: "wedding", weight: 5 },
      { keyword: "divorce", weight: 6 },
      { keyword: "royal family", weight: 8 },
      { keyword: "meghan markle", weight: 8 },
      { keyword: "prince harry", weight: 8 },
    ],
    secondaryKeywords: [
      { keyword: "culture", weight: 3 },
      { keyword: "social", weight: 2 },
      { keyword: "public", weight: 2 },
      { keyword: "popular", weight: 2 },
      { keyword: "famous", weight: 3 },
      { keyword: "news", weight: 1 },
      { keyword: "story", weight: 1 },
      { keyword: "event", weight: 1 },
    ],
    minScoreThreshold: 10,
    basePriority: 3,
  },

  // OTHER (catch-all with low priority)
  {
    category: MarketCategory.OTHER,
    primaryKeywords: [],
    secondaryKeywords: [],
    minScoreThreshold: 0,
    basePriority: 0,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize text for keyword matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Check if a keyword matches in the text
 */
function matchKeyword(
  text: string,
  normalizedText: string,
  pattern: KeywordPattern
): boolean {
  const keywordLower = pattern.keyword.toLowerCase();
  const searchText = pattern.caseSensitive ? text : normalizedText;
  const searchKeyword = pattern.caseSensitive ? pattern.keyword : keywordLower;

  // Check for exclusion words
  if (pattern.excludeIfPresent) {
    for (const exclude of pattern.excludeIfPresent) {
      if (normalizedText.includes(exclude.toLowerCase())) {
        return false;
      }
    }
  }

  // Check for required context
  if (pattern.requiredContext && pattern.requiredContext.length > 0) {
    const hasContext = pattern.requiredContext.some((ctx) =>
      normalizedText.includes(ctx.toLowerCase())
    );
    if (!hasContext) {
      return false;
    }
  }

  // Perform the match
  if (pattern.exactMatch) {
    // Word boundary match
    const regex = new RegExp(`\\b${escapeRegex(searchKeyword)}\\b`, "i");
    return regex.test(searchText);
  } else {
    return searchText.includes(searchKeyword);
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calculate score for a category
 */
function calculateCategoryScore(
  text: string,
  patterns: CategoryPatterns
): CategoryScore {
  const normalizedText = normalizeText(text);
  let rawScore = 0;
  let matchCount = 0;
  const matchedKeywords: string[] = [];

  // Score primary keywords
  for (const pattern of patterns.primaryKeywords) {
    if (matchKeyword(text, normalizedText, pattern)) {
      rawScore += pattern.weight;
      matchCount++;
      matchedKeywords.push(pattern.keyword);
    }
  }

  // Score secondary keywords
  for (const pattern of patterns.secondaryKeywords) {
    if (matchKeyword(text, normalizedText, pattern)) {
      rawScore += pattern.weight;
      matchCount++;
      matchedKeywords.push(pattern.keyword);
    }
  }

  // Score regex patterns if any
  if (patterns.regexPatterns) {
    for (const regex of patterns.regexPatterns) {
      if (regex.test(text) || regex.test(normalizedText)) {
        rawScore += 5;
        matchCount++;
        matchedKeywords.push(`regex:${regex.source.substring(0, 20)}`);
      }
    }
  }

  // Normalize score to 0-100 scale
  // Use a logarithmic scale to prevent very high scores
  const maxExpectedScore = 100;
  const normalizedScore = Math.min(
    100,
    Math.round((rawScore / maxExpectedScore) * 100)
  );

  return {
    category: patterns.category,
    rawScore,
    normalizedScore,
    matchCount,
    matchedKeywords,
    meetsThreshold: rawScore >= patterns.minScoreThreshold,
  };
}

/**
 * Calculate insider potential score
 */
function calculateInsiderPotentialScore(
  primaryCategory: MarketCategory,
  categoryScores: CategoryScore[]
): number {
  let score = 0;

  // Base score for high-insider categories
  if (HIGH_INSIDER_CATEGORIES.includes(primaryCategory)) {
    score += 40;
  }

  // Check for specific high-value keywords
  const allMatchedKeywords = categoryScores.flatMap((cs) => cs.matchedKeywords);

  const highValueKeywords = [
    "election",
    "indictment",
    "verdict",
    "fda approval",
    "fed",
    "fomc",
    "earnings",
    "merger",
    "acquisition",
    "treaty",
    "ceasefire",
    "sanction",
    "regulation",
    "interest rate",
    "gdp",
    "cpi",
  ];

  for (const keyword of highValueKeywords) {
    if (
      allMatchedKeywords.some((mk) =>
        mk.toLowerCase().includes(keyword.toLowerCase())
      )
    ) {
      score += 10;
    }
  }

  // Check for category overlap (multi-category markets may have more info value)
  const categoriesMeetingThreshold = categoryScores.filter(
    (cs) => cs.meetsThreshold
  ).length;
  if (categoriesMeetingThreshold > 1) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Determine confidence level from score
 */
function getConfidenceLevel(score: number): ClassificationConfidence {
  if (score >= 90) return ClassificationConfidence.VERY_HIGH;
  if (score >= 75) return ClassificationConfidence.HIGH;
  if (score >= 50) return ClassificationConfidence.MEDIUM;
  if (score >= 25) return ClassificationConfidence.LOW;
  return ClassificationConfidence.VERY_LOW;
}

// ============================================================================
// Classifier Class
// ============================================================================

/**
 * Cache entry for classification results
 */
interface CacheEntry {
  result: MarketClassificationResult;
  expiresAt: number;
}

/**
 * Market Category Classifier
 *
 * Classifies markets into categories based on their text content.
 */
export class MarketCategoryClassifier {
  private readonly config: Required<MarketCategoryClassifierConfig>;
  private readonly patterns: CategoryPatterns[];
  private readonly cache: Map<string, CacheEntry> = new Map();
  private classificationCount = 0;
  private cacheHits = 0;
  private startTime: number;

  constructor(config: MarketCategoryClassifierConfig = {}) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      defaultMinScoreThreshold:
        config.defaultMinScoreThreshold ?? DEFAULT_MIN_SCORE_THRESHOLD,
      debug: config.debug ?? false,
      customPatterns: config.customPatterns ?? [],
    };

    // Use custom patterns if provided, otherwise use defaults
    this.patterns =
      this.config.customPatterns.length > 0
        ? this.config.customPatterns
        : DEFAULT_CATEGORY_PATTERNS;

    this.startTime = Date.now();
  }

  /**
   * Classify a single market
   */
  classifyMarket(
    market: MarketForClassification,
    options: ClassifyMarketOptions = {}
  ): MarketClassificationResult {
    const {
      includeSecondary = true,
      maxSecondaryCategories = 2,
      secondaryMinScore = 30,
      overrideExisting = true,
      bypassCache = false,
    } = options;

    // Check cache first
    const cacheKey = market.id;
    if (!bypassCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
    }

    // Use existing category if available and not overriding
    if (
      !overrideExisting &&
      market.existingCategory &&
      market.existingCategory !== "other"
    ) {
      const existingCat = market.existingCategory.toLowerCase() as MarketCategory;
      if (Object.values(MarketCategory).includes(existingCat)) {
        const result: MarketClassificationResult = {
          marketId: market.id,
          question: market.question,
          primaryCategory: existingCat,
          confidence: ClassificationConfidence.HIGH,
          confidenceScore: 80,
          secondaryCategories: [],
          categoryScores: [],
          hasInsiderPotential: HIGH_INSIDER_CATEGORIES.includes(existingCat),
          insiderPotentialScore: HIGH_INSIDER_CATEGORIES.includes(existingCat)
            ? 50
            : 20,
          classifiedAt: new Date(),
          fromCache: false,
        };
        this.addToCache(cacheKey, result);
        this.classificationCount++;
        return result;
      }
    }

    // Build the text to analyze
    const textParts = [market.question];
    if (market.description) {
      textParts.push(market.description);
    }
    if (market.slug) {
      textParts.push(market.slug.replace(/-/g, " "));
    }
    if (market.tags) {
      textParts.push(market.tags.join(" "));
    }
    const fullText = textParts.join(" ");

    // Score all categories
    const categoryScores: CategoryScore[] = [];
    for (const pattern of this.patterns) {
      const score = calculateCategoryScore(fullText, pattern);
      categoryScores.push(score);
    }

    // Sort by normalized score and base priority
    categoryScores.sort((a, b) => {
      const patternA = this.patterns.find((p) => p.category === a.category);
      const patternB = this.patterns.find((p) => p.category === b.category);
      const priorityA = patternA?.basePriority ?? 0;
      const priorityB = patternB?.basePriority ?? 0;

      // First by score, then by priority
      if (b.normalizedScore !== a.normalizedScore) {
        return b.normalizedScore - a.normalizedScore;
      }
      return priorityB - priorityA;
    });

    // Determine primary category
    let primaryCategory = MarketCategory.OTHER;
    let confidenceScore = 0;
    const meetingThreshold = categoryScores.filter((cs) => cs.meetsThreshold);

    const topMeetingThreshold = meetingThreshold[0];
    const topCategoryScore = categoryScores[0];

    if (topMeetingThreshold) {
      primaryCategory = topMeetingThreshold.category;
      confidenceScore = topMeetingThreshold.normalizedScore;
    } else if (topCategoryScore && topCategoryScore.matchCount > 0) {
      // If no category meets threshold but we have some matches, use the best one
      primaryCategory = topCategoryScore.category;
      confidenceScore = Math.min(40, topCategoryScore.normalizedScore);
    }

    // Determine secondary categories
    const secondaryCategories: MarketCategory[] = [];
    if (includeSecondary && meetingThreshold.length > 1) {
      for (let i = 1; i < meetingThreshold.length; i++) {
        if (secondaryCategories.length >= maxSecondaryCategories) break;
        const thresholdEntry = meetingThreshold[i];
        if (thresholdEntry && thresholdEntry.normalizedScore >= secondaryMinScore) {
          secondaryCategories.push(thresholdEntry.category);
        }
      }
    }

    // Calculate insider potential
    const insiderPotentialScore = calculateInsiderPotentialScore(
      primaryCategory,
      categoryScores
    );

    const result: MarketClassificationResult = {
      marketId: market.id,
      question: market.question,
      primaryCategory,
      confidence: getConfidenceLevel(confidenceScore),
      confidenceScore,
      secondaryCategories,
      categoryScores,
      hasInsiderPotential: insiderPotentialScore >= HIGH_INSIDER_POTENTIAL_THRESHOLD,
      insiderPotentialScore,
      classifiedAt: new Date(),
      fromCache: false,
    };

    // Add to cache
    this.addToCache(cacheKey, result);
    this.classificationCount++;

    if (this.config.debug) {
      console.log(
        `[MarketCategoryClassifier] Classified ${market.id}: ${primaryCategory} (${confidenceScore}%)`
      );
    }

    return result;
  }

  /**
   * Classify multiple markets in batch
   */
  classifyMarkets(
    markets: MarketForClassification[],
    options: ClassifyMarketOptions = {}
  ): BatchClassificationResult {
    const startTime = Date.now();
    const results = new Map<string, MarketClassificationResult>();
    const errors = new Map<string, string>();
    const categoryDistribution = new Map<MarketCategory, number>();
    let totalConfidence = 0;

    for (const market of markets) {
      try {
        const result = this.classifyMarket(market, options);
        results.set(market.id, result);
        totalConfidence += result.confidenceScore;

        // Update category distribution
        const count = categoryDistribution.get(result.primaryCategory) ?? 0;
        categoryDistribution.set(result.primaryCategory, count + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.set(market.id, message);
      }
    }

    const successCount = results.size;
    const errorCount = errors.size;
    const averageConfidence =
      successCount > 0 ? totalConfidence / successCount : 0;

    return {
      results,
      errors,
      totalProcessed: markets.length,
      successCount,
      errorCount,
      categoryDistribution,
      averageConfidence: Math.round(averageConfidence * 10) / 10,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get classification from cache
   */
  private getFromCache(key: string): MarketClassificationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.result, fromCache: true };
  }

  /**
   * Add classification to cache
   */
  private addToCache(key: string, result: MarketClassificationResult): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Check if a market is in a specific category
   */
  isMarketInCategory(
    market: MarketForClassification,
    category: MarketCategory,
    options: ClassifyMarketOptions = {}
  ): boolean {
    const result = this.classifyMarket(market, options);
    return (
      result.primaryCategory === category ||
      result.secondaryCategories.includes(category)
    );
  }

  /**
   * Get markets by category from a batch
   */
  getMarketsByCategory(
    markets: MarketForClassification[],
    category: MarketCategory,
    options: ClassifyMarketOptions = {}
  ): MarketForClassification[] {
    return markets.filter((m) => this.isMarketInCategory(m, category, options));
  }

  /**
   * Get markets with high insider potential
   */
  getHighInsiderPotentialMarkets(
    markets: MarketForClassification[],
    options: ClassifyMarketOptions = {}
  ): MarketClassificationResult[] {
    const results: MarketClassificationResult[] = [];
    for (const market of markets) {
      const result = this.classifyMarket(market, options);
      if (result.hasInsiderPotential) {
        results.push(result);
      }
    }
    return results.sort(
      (a, b) => b.insiderPotentialScore - a.insiderPotentialScore
    );
  }

  /**
   * Clear the classification cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.config.debug) {
      console.log("[MarketCategoryClassifier] Cache cleared");
    }
  }

  /**
   * Get classification summary
   */
  getSummary(): ClassificationSummary {
    const categoryBreakdown = new Map<MarketCategory, number>();
    const confidenceBreakdown = new Map<ClassificationConfidence, number>();
    let totalConfidenceScore = 0;
    let highInsiderCount = 0;

    for (const entry of this.cache.values()) {
      if (Date.now() <= entry.expiresAt) {
        const result = entry.result;

        // Category breakdown
        const catCount = categoryBreakdown.get(result.primaryCategory) ?? 0;
        categoryBreakdown.set(result.primaryCategory, catCount + 1);

        // Confidence breakdown
        const confCount = confidenceBreakdown.get(result.confidence) ?? 0;
        confidenceBreakdown.set(result.confidence, confCount + 1);

        totalConfidenceScore += result.confidenceScore;

        if (result.hasInsiderPotential) {
          highInsiderCount++;
        }
      }
    }

    const totalClassified = this.cache.size;
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;

    return {
      totalClassified,
      categoryBreakdown,
      confidenceBreakdown,
      averageConfidenceScore:
        totalClassified > 0
          ? Math.round((totalConfidenceScore / totalClassified) * 10) / 10
          : 0,
      highInsiderPotentialCount: highInsiderCount,
      cacheHitRate:
        this.classificationCount > 0
          ? Math.round((this.cacheHits / this.classificationCount) * 1000) / 10
          : 0,
      classificationsPerMinute:
        elapsedMinutes > 0
          ? Math.round((this.classificationCount / elapsedMinutes) * 10) / 10
          : 0,
    };
  }

  /**
   * Get all category patterns
   */
  getPatterns(): CategoryPatterns[] {
    return [...this.patterns];
  }

  /**
   * Get pattern for a specific category
   */
  getPatternForCategory(category: MarketCategory): CategoryPatterns | null {
    return this.patterns.find((p) => p.category === category) ?? null;
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let sharedInstance: MarketCategoryClassifier | null = null;

/**
 * Create a new MarketCategoryClassifier instance
 */
export function createMarketCategoryClassifier(
  config?: MarketCategoryClassifierConfig
): MarketCategoryClassifier {
  return new MarketCategoryClassifier(config);
}

/**
 * Get the shared MarketCategoryClassifier instance
 */
export function getSharedMarketCategoryClassifier(): MarketCategoryClassifier {
  if (!sharedInstance) {
    sharedInstance = new MarketCategoryClassifier();
  }
  return sharedInstance;
}

/**
 * Set the shared MarketCategoryClassifier instance
 */
export function setSharedMarketCategoryClassifier(
  classifier: MarketCategoryClassifier
): void {
  sharedInstance = classifier;
}

/**
 * Reset the shared MarketCategoryClassifier instance
 */
export function resetSharedMarketCategoryClassifier(): void {
  if (sharedInstance) {
    sharedInstance.clearCache();
  }
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Classify a single market using the shared instance
 */
export function classifyMarket(
  market: MarketForClassification,
  options?: ClassifyMarketOptions
): MarketClassificationResult {
  return getSharedMarketCategoryClassifier().classifyMarket(market, options);
}

/**
 * Classify multiple markets using the shared instance
 */
export function classifyMarkets(
  markets: MarketForClassification[],
  options?: ClassifyMarketOptions
): BatchClassificationResult {
  return getSharedMarketCategoryClassifier().classifyMarkets(markets, options);
}

/**
 * Check if a market is in a specific category using the shared instance
 */
export function isMarketInCategory(
  market: MarketForClassification,
  category: MarketCategory,
  options?: ClassifyMarketOptions
): boolean {
  return getSharedMarketCategoryClassifier().isMarketInCategory(
    market,
    category,
    options
  );
}

/**
 * Get markets by category using the shared instance
 */
export function getMarketsByCategory(
  markets: MarketForClassification[],
  category: MarketCategory,
  options?: ClassifyMarketOptions
): MarketForClassification[] {
  return getSharedMarketCategoryClassifier().getMarketsByCategory(
    markets,
    category,
    options
  );
}

/**
 * Get markets with high insider potential using the shared instance
 */
export function getHighInsiderPotentialMarkets(
  markets: MarketForClassification[],
  options?: ClassifyMarketOptions
): MarketClassificationResult[] {
  return getSharedMarketCategoryClassifier().getHighInsiderPotentialMarkets(
    markets,
    options
  );
}

/**
 * Get classification summary using the shared instance
 */
export function getClassificationSummary(): ClassificationSummary {
  return getSharedMarketCategoryClassifier().getSummary();
}
