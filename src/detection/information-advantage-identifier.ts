/**
 * Information-Advantage Market Identifier (DET-NICHE-002)
 *
 * Identify markets where insider information would be most valuable.
 * This module scores markets based on their potential for information asymmetry,
 * which is crucial for detecting potential insider trading patterns.
 *
 * Features:
 * - Define high-value categories where insider info has most value
 * - Score markets by information asymmetry potential
 * - Rank markets by insider value
 * - Update rankings periodically based on market activity
 * - Integration with MarketCategoryClassifier
 */

import { MarketCategory } from "../api/gamma/types";
import {
  MarketCategoryClassifier,
  MarketClassificationResult,
  MarketForClassification,
  getSharedMarketCategoryClassifier,
} from "./market-category-classifier";

// ============================================================================
// Types
// ============================================================================

/**
 * Types of information advantage that could exist in a market
 */
export enum InformationAdvantageType {
  /** Access to government/regulatory decision-making */
  REGULATORY_ACCESS = "REGULATORY_ACCESS",
  /** Inside knowledge of corporate actions */
  CORPORATE_INSIDER = "CORPORATE_INSIDER",
  /** Early access to economic data */
  ECONOMIC_DATA_ACCESS = "ECONOMIC_DATA_ACCESS",
  /** Knowledge of pending legal decisions */
  LEGAL_INSIDER = "LEGAL_INSIDER",
  /** Access to geopolitical intelligence */
  GEOPOLITICAL_INTEL = "GEOPOLITICAL_INTEL",
  /** Knowledge of scientific/medical results */
  RESEARCH_ACCESS = "RESEARCH_ACCESS",
  /** Sports-related inside information */
  SPORTS_INSIDER = "SPORTS_INSIDER",
  /** Tech industry insider knowledge */
  TECH_INSIDER = "TECH_INSIDER",
  /** Entertainment industry insider knowledge */
  ENTERTAINMENT_INSIDER = "ENTERTAINMENT_INSIDER",
  /** General information advantage */
  GENERAL = "GENERAL",
}

/**
 * Tier of information advantage value
 */
export enum InformationAdvantageTier {
  /** Extremely high value - critical decisions with major impact */
  CRITICAL = "CRITICAL",
  /** Very high value - significant decisions with substantial impact */
  VERY_HIGH = "VERY_HIGH",
  /** High value - important decisions with notable impact */
  HIGH = "HIGH",
  /** Medium value - moderate information advantage potential */
  MEDIUM = "MEDIUM",
  /** Low value - limited information advantage potential */
  LOW = "LOW",
  /** Minimal value - very limited information advantage potential */
  MINIMAL = "MINIMAL",
}

/**
 * Keywords indicating high information asymmetry potential
 */
export interface HighValueKeywordPattern {
  /** The keyword or phrase */
  keyword: string;
  /** Weight/importance of this keyword */
  weight: number;
  /** Type of information advantage this indicates */
  advantageType: InformationAdvantageType;
  /** Additional context keywords that increase the score */
  contextMultipliers?: string[];
}

/**
 * Category-specific information advantage configuration
 */
export interface CategoryAdvantageConfig {
  /** The market category */
  category: MarketCategory;
  /** Base information advantage score for this category (0-100) */
  baseScore: number;
  /** Types of information advantage common in this category */
  advantageTypes: InformationAdvantageType[];
  /** High-value keywords specific to this category */
  highValueKeywords: HighValueKeywordPattern[];
  /** Description of why this category has insider potential */
  rationale: string;
}

/**
 * Factors that increase information asymmetry potential
 */
export interface AsymmetryFactor {
  /** Name of the factor */
  name: string;
  /** Score contribution (0-100) */
  score: number;
  /** Whether this factor was detected */
  detected: boolean;
  /** Evidence for detection */
  evidence?: string;
}

/**
 * Result of analyzing a market for information advantage potential
 */
export interface InformationAdvantageResult {
  /** Market ID */
  marketId: string;
  /** Market question for reference */
  question: string;
  /** Overall information advantage score (0-100) */
  score: number;
  /** Tier based on score */
  tier: InformationAdvantageTier;
  /** Primary category of the market */
  category: MarketCategory;
  /** Types of information advantages that could apply */
  advantageTypes: InformationAdvantageType[];
  /** Individual factors contributing to the score */
  factors: AsymmetryFactor[];
  /** Matched high-value keywords */
  matchedKeywords: string[];
  /** Timestamp of analysis */
  analyzedAt: Date;
  /** Whether this came from cache */
  fromCache: boolean;
  /** Detailed rationale for the score */
  rationale: string;
  /** Ranking position among analyzed markets (set during ranking) */
  rank?: number;
}

/**
 * Options for analyzing markets
 */
export interface AnalyzeMarketOptions {
  /** Skip cache lookup */
  bypassCache?: boolean;
  /** Include detailed factor breakdown */
  includeFactors?: boolean;
  /** Classification result if already available */
  classificationResult?: MarketClassificationResult;
}

/**
 * Result of batch analysis
 */
export interface BatchAnalysisResult {
  /** Results by market ID */
  results: Map<string, InformationAdvantageResult>;
  /** Failed analyses */
  errors: Map<string, string>;
  /** Total markets processed */
  totalProcessed: number;
  /** Number of high-value markets (tier HIGH or above) */
  highValueCount: number;
  /** Distribution by tier */
  tierDistribution: Map<InformationAdvantageTier, number>;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Market ranking entry
 */
export interface MarketRanking {
  /** Market ID */
  marketId: string;
  /** Market question */
  question: string;
  /** Information advantage score */
  score: number;
  /** Tier */
  tier: InformationAdvantageTier;
  /** Category */
  category: MarketCategory;
  /** Advantage types */
  advantageTypes: InformationAdvantageType[];
  /** Rank position (1 = highest value) */
  rank: number;
  /** Last updated */
  updatedAt: Date;
}

/**
 * Summary of identifier state
 */
export interface IdentifierSummary {
  /** Total markets analyzed */
  totalAnalyzed: number;
  /** Markets in cache */
  cacheSize: number;
  /** Cache hit rate percentage */
  cacheHitRate: number;
  /** Distribution by tier */
  tierBreakdown: Map<InformationAdvantageTier, number>;
  /** Distribution by advantage type */
  advantageTypeBreakdown: Map<InformationAdvantageType, number>;
  /** Top ranked markets */
  topRankedMarkets: MarketRanking[];
  /** Average score */
  averageScore: number;
}

/**
 * Configuration for the identifier
 */
export interface InformationAdvantageIdentifierConfig {
  /** Cache TTL in ms (default: 1 hour) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 5000) */
  maxCacheSize?: number;
  /** Custom category configurations */
  customCategoryConfigs?: CategoryAdvantageConfig[];
  /** Minimum score to be considered "high value" */
  highValueThreshold?: number;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_MAX_CACHE_SIZE = 5000;
const DEFAULT_HIGH_VALUE_THRESHOLD = 60;

/**
 * Tier thresholds
 */
const TIER_THRESHOLDS = {
  CRITICAL: 90,
  VERY_HIGH: 75,
  HIGH: 60,
  MEDIUM: 40,
  LOW: 20,
  MINIMAL: 0,
};

/**
 * Default category advantage configurations
 */
export const DEFAULT_CATEGORY_CONFIGS: CategoryAdvantageConfig[] = [
  // POLITICS - Very high insider potential
  {
    category: MarketCategory.POLITICS,
    baseScore: 75,
    advantageTypes: [
      InformationAdvantageType.REGULATORY_ACCESS,
      InformationAdvantageType.CORPORATE_INSIDER,
    ],
    highValueKeywords: [
      {
        keyword: "election result",
        weight: 25,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "primary",
        weight: 20,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "nomination",
        weight: 20,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "cabinet",
        weight: 18,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "resign",
        weight: 22,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "announce",
        weight: 15,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
        contextMultipliers: ["candidate", "policy", "decision"],
      },
      {
        keyword: "endorsement",
        weight: 18,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "veto",
        weight: 20,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "executive order",
        weight: 22,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
    ],
    rationale:
      "Political decisions are made by small groups with early access to outcomes",
  },

  // GEOPOLITICS - Highest insider potential
  {
    category: MarketCategory.GEOPOLITICS,
    baseScore: 85,
    advantageTypes: [
      InformationAdvantageType.GEOPOLITICAL_INTEL,
      InformationAdvantageType.REGULATORY_ACCESS,
    ],
    highValueKeywords: [
      {
        keyword: "ceasefire",
        weight: 30,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "treaty",
        weight: 28,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "invasion",
        weight: 25,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "nuclear",
        weight: 25,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "sanction",
        weight: 22,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "summit",
        weight: 20,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "negotiation",
        weight: 18,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "military operation",
        weight: 28,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
      {
        keyword: "diplomatic",
        weight: 15,
        advantageType: InformationAdvantageType.GEOPOLITICAL_INTEL,
      },
    ],
    rationale:
      "Geopolitical events involve classified information known to officials",
  },

  // LEGAL - Very high insider potential
  {
    category: MarketCategory.LEGAL,
    baseScore: 80,
    advantageTypes: [
      InformationAdvantageType.LEGAL_INSIDER,
      InformationAdvantageType.REGULATORY_ACCESS,
    ],
    highValueKeywords: [
      {
        keyword: "verdict",
        weight: 30,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "indictment",
        weight: 28,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "plea deal",
        weight: 25,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "conviction",
        weight: 25,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "acquittal",
        weight: 25,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "supreme court",
        weight: 22,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "ruling",
        weight: 18,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "settlement",
        weight: 20,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
      {
        keyword: "sentence",
        weight: 18,
        advantageType: InformationAdvantageType.LEGAL_INSIDER,
      },
    ],
    rationale:
      "Legal outcomes are known to court insiders before public announcement",
  },

  // ECONOMY - High insider potential
  {
    category: MarketCategory.ECONOMY,
    baseScore: 70,
    advantageTypes: [
      InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      InformationAdvantageType.REGULATORY_ACCESS,
    ],
    highValueKeywords: [
      {
        keyword: "rate decision",
        weight: 30,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "fomc",
        weight: 28,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "federal reserve",
        weight: 25,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "rate hike",
        weight: 25,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "rate cut",
        weight: 25,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "jobs report",
        weight: 22,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "cpi",
        weight: 22,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "gdp",
        weight: 20,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
      {
        keyword: "recession",
        weight: 18,
        advantageType: InformationAdvantageType.ECONOMIC_DATA_ACCESS,
      },
    ],
    rationale:
      "Economic data is collected and compiled by small groups before release",
  },

  // BUSINESS - Moderate-high insider potential
  {
    category: MarketCategory.BUSINESS,
    baseScore: 55,
    advantageTypes: [
      InformationAdvantageType.CORPORATE_INSIDER,
      InformationAdvantageType.ECONOMIC_DATA_ACCESS,
    ],
    highValueKeywords: [
      {
        keyword: "earnings",
        weight: 25,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
      {
        keyword: "merger",
        weight: 28,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
      {
        keyword: "acquisition",
        weight: 28,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
      {
        keyword: "bankruptcy",
        weight: 25,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
      {
        keyword: "ipo",
        weight: 22,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
      {
        keyword: "layoff",
        weight: 20,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
      {
        keyword: "ceo",
        weight: 18,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
        contextMultipliers: ["resign", "fired", "step down", "replace"],
      },
      {
        keyword: "quarterly",
        weight: 15,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
    ],
    rationale: "Corporate decisions are known internally before announcement",
  },

  // TECH - Moderate insider potential
  {
    category: MarketCategory.TECH,
    baseScore: 45,
    advantageTypes: [
      InformationAdvantageType.TECH_INSIDER,
      InformationAdvantageType.CORPORATE_INSIDER,
    ],
    highValueKeywords: [
      {
        keyword: "launch",
        weight: 20,
        advantageType: InformationAdvantageType.TECH_INSIDER,
        contextMultipliers: ["product", "feature", "device"],
      },
      {
        keyword: "release",
        weight: 18,
        advantageType: InformationAdvantageType.TECH_INSIDER,
      },
      {
        keyword: "announce",
        weight: 15,
        advantageType: InformationAdvantageType.TECH_INSIDER,
      },
      {
        keyword: "breakthrough",
        weight: 20,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "ai",
        weight: 15,
        advantageType: InformationAdvantageType.TECH_INSIDER,
        contextMultipliers: ["release", "model", "launch"],
      },
      {
        keyword: "partnership",
        weight: 18,
        advantageType: InformationAdvantageType.CORPORATE_INSIDER,
      },
    ],
    rationale: "Tech product decisions and timelines known to employees",
  },

  // HEALTH - High insider potential for regulatory decisions
  {
    category: MarketCategory.HEALTH,
    baseScore: 65,
    advantageTypes: [
      InformationAdvantageType.REGULATORY_ACCESS,
      InformationAdvantageType.RESEARCH_ACCESS,
    ],
    highValueKeywords: [
      {
        keyword: "fda approval",
        weight: 30,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "drug approval",
        weight: 28,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "clinical trial",
        weight: 25,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "phase 3",
        weight: 22,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "vaccine",
        weight: 20,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
        contextMultipliers: ["approval", "authorized", "approved"],
      },
      {
        keyword: "emergency use",
        weight: 22,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "pandemic",
        weight: 15,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
    ],
    rationale: "FDA and clinical trial results known before public release",
  },

  // SCIENCE - Moderate insider potential
  {
    category: MarketCategory.SCIENCE,
    baseScore: 40,
    advantageTypes: [InformationAdvantageType.RESEARCH_ACCESS],
    highValueKeywords: [
      {
        keyword: "discovery",
        weight: 20,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "nasa",
        weight: 18,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "space launch",
        weight: 15,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "nobel",
        weight: 22,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "experiment",
        weight: 12,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
    ],
    rationale: "Scientific results known to researchers before publication",
  },

  // SPORTS - Lower insider potential (but still exists)
  {
    category: MarketCategory.SPORTS,
    baseScore: 25,
    advantageTypes: [InformationAdvantageType.SPORTS_INSIDER],
    highValueKeywords: [
      {
        keyword: "injury",
        weight: 20,
        advantageType: InformationAdvantageType.SPORTS_INSIDER,
      },
      {
        keyword: "trade",
        weight: 18,
        advantageType: InformationAdvantageType.SPORTS_INSIDER,
      },
      {
        keyword: "contract",
        weight: 15,
        advantageType: InformationAdvantageType.SPORTS_INSIDER,
      },
      {
        keyword: "draft pick",
        weight: 18,
        advantageType: InformationAdvantageType.SPORTS_INSIDER,
      },
      {
        keyword: "retire",
        weight: 18,
        advantageType: InformationAdvantageType.SPORTS_INSIDER,
      },
      {
        keyword: "coaching",
        weight: 12,
        advantageType: InformationAdvantageType.SPORTS_INSIDER,
        contextMultipliers: ["fired", "hire", "change"],
      },
    ],
    rationale: "Team decisions and player status known to insiders",
  },

  // ENTERTAINMENT - Lower insider potential
  {
    category: MarketCategory.ENTERTAINMENT,
    baseScore: 20,
    advantageTypes: [InformationAdvantageType.ENTERTAINMENT_INSIDER],
    highValueKeywords: [
      {
        keyword: "award",
        weight: 18,
        advantageType: InformationAdvantageType.ENTERTAINMENT_INSIDER,
      },
      {
        keyword: "winner",
        weight: 15,
        advantageType: InformationAdvantageType.ENTERTAINMENT_INSIDER,
      },
      {
        keyword: "nomination",
        weight: 12,
        advantageType: InformationAdvantageType.ENTERTAINMENT_INSIDER,
      },
      {
        keyword: "box office",
        weight: 10,
        advantageType: InformationAdvantageType.ENTERTAINMENT_INSIDER,
      },
    ],
    rationale: "Award decisions and box office data known early by some",
  },

  // CRYPTO - Moderate insider potential
  {
    category: MarketCategory.CRYPTO,
    baseScore: 35,
    advantageTypes: [
      InformationAdvantageType.REGULATORY_ACCESS,
      InformationAdvantageType.TECH_INSIDER,
    ],
    highValueKeywords: [
      {
        keyword: "sec",
        weight: 22,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "etf",
        weight: 22,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
        contextMultipliers: ["approval", "bitcoin", "ethereum"],
      },
      {
        keyword: "regulation",
        weight: 18,
        advantageType: InformationAdvantageType.REGULATORY_ACCESS,
      },
      {
        keyword: "halving",
        weight: 10,
        advantageType: InformationAdvantageType.TECH_INSIDER,
      },
      {
        keyword: "upgrade",
        weight: 12,
        advantageType: InformationAdvantageType.TECH_INSIDER,
      },
    ],
    rationale: "Regulatory decisions affecting crypto known before announcement",
  },

  // WEATHER - Low insider potential
  {
    category: MarketCategory.WEATHER,
    baseScore: 15,
    advantageTypes: [InformationAdvantageType.RESEARCH_ACCESS],
    highValueKeywords: [
      {
        keyword: "forecast",
        weight: 10,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
      {
        keyword: "record",
        weight: 8,
        advantageType: InformationAdvantageType.RESEARCH_ACCESS,
      },
    ],
    rationale: "Weather predictions are widely available and uncertain",
  },

  // CULTURE - Low insider potential
  {
    category: MarketCategory.CULTURE,
    baseScore: 15,
    advantageTypes: [InformationAdvantageType.GENERAL],
    highValueKeywords: [
      {
        keyword: "announcement",
        weight: 10,
        advantageType: InformationAdvantageType.GENERAL,
      },
    ],
    rationale: "Cultural events generally have limited insider information",
  },

  // OTHER - Minimal insider potential
  {
    category: MarketCategory.OTHER,
    baseScore: 10,
    advantageTypes: [InformationAdvantageType.GENERAL],
    highValueKeywords: [],
    rationale: "Unknown category with uncertain insider potential",
  },
];

/**
 * Additional high-value keyword patterns that apply across categories
 */
export const CROSS_CATEGORY_HIGH_VALUE_KEYWORDS: HighValueKeywordPattern[] = [
  {
    keyword: "decide",
    weight: 12,
    advantageType: InformationAdvantageType.GENERAL,
    contextMultipliers: ["will", "when", "whether"],
  },
  {
    keyword: "deadline",
    weight: 15,
    advantageType: InformationAdvantageType.GENERAL,
  },
  {
    keyword: "before",
    weight: 8,
    advantageType: InformationAdvantageType.GENERAL,
    contextMultipliers: ["announce", "decision", "release"],
  },
  {
    keyword: "by",
    weight: 8,
    advantageType: InformationAdvantageType.GENERAL,
    contextMultipliers: ["date", "year", "month", "end of"],
  },
  {
    keyword: "exclusive",
    weight: 15,
    advantageType: InformationAdvantageType.GENERAL,
  },
  {
    keyword: "confidential",
    weight: 18,
    advantageType: InformationAdvantageType.GENERAL,
  },
  {
    keyword: "leaked",
    weight: 20,
    advantageType: InformationAdvantageType.GENERAL,
  },
];

/**
 * Factors that increase information asymmetry
 */
const ASYMMETRY_FACTORS = [
  {
    name: "Binary Outcome",
    description: "Markets with yes/no outcomes are easier to exploit",
    weight: 10,
    patterns: ["yes", "no", "will", "won't", "whether"],
  },
  {
    name: "Near-Term Resolution",
    description: "Markets resolving soon have higher time-sensitive value",
    weight: 15,
    patterns: ["today", "tomorrow", "this week", "by end of", "within"],
  },
  {
    name: "Single Decision Maker",
    description: "Outcomes decided by one person/entity are more predictable",
    weight: 20,
    patterns: [
      "president",
      "ceo",
      "judge",
      "chairman",
      "director",
      "commissioner",
    ],
  },
  {
    name: "Government Involvement",
    description: "Government decisions often known internally before release",
    weight: 15,
    patterns: [
      "government",
      "federal",
      "state",
      "agency",
      "department",
      "congress",
      "senate",
    ],
  },
  {
    name: "Regulatory Decision",
    description: "Regulatory outcomes known to insiders",
    weight: 18,
    patterns: [
      "approve",
      "approval",
      "authorize",
      "permit",
      "license",
      "regulate",
    ],
  },
  {
    name: "Corporate Action",
    description: "Corporate decisions known before public announcement",
    weight: 15,
    patterns: ["announce", "release", "report", "disclose", "reveal"],
  },
  {
    name: "Private Negotiation",
    description: "Negotiations known to participants before conclusion",
    weight: 18,
    patterns: ["negotiate", "deal", "agreement", "settlement", "contract"],
  },
  {
    name: "Classified Information",
    description: "Involves potentially classified or restricted information",
    weight: 22,
    patterns: ["classified", "secret", "intelligence", "security", "military"],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize text for matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Check if keyword matches in text
 */
function matchesKeyword(
  normalizedText: string,
  pattern: HighValueKeywordPattern
): boolean {
  const keywordLower = pattern.keyword.toLowerCase();
  if (!normalizedText.includes(keywordLower)) {
    return false;
  }

  // Match found - context multipliers are optional and handled in calculateContextBonus
  return true;
}

/**
 * Calculate context bonus for a keyword match
 */
function calculateContextBonus(
  normalizedText: string,
  pattern: HighValueKeywordPattern
): number {
  if (!pattern.contextMultipliers || pattern.contextMultipliers.length === 0) {
    return 0;
  }

  let bonus = 0;
  for (const ctx of pattern.contextMultipliers) {
    if (normalizedText.includes(ctx.toLowerCase())) {
      bonus += pattern.weight * 0.25; // 25% bonus per context match
    }
  }
  return Math.min(bonus, pattern.weight * 0.5); // Cap at 50% bonus
}

/**
 * Get tier from score
 */
function getTierFromScore(score: number): InformationAdvantageTier {
  if (score >= TIER_THRESHOLDS.CRITICAL) return InformationAdvantageTier.CRITICAL;
  if (score >= TIER_THRESHOLDS.VERY_HIGH) return InformationAdvantageTier.VERY_HIGH;
  if (score >= TIER_THRESHOLDS.HIGH) return InformationAdvantageTier.HIGH;
  if (score >= TIER_THRESHOLDS.MEDIUM) return InformationAdvantageTier.MEDIUM;
  if (score >= TIER_THRESHOLDS.LOW) return InformationAdvantageTier.LOW;
  return InformationAdvantageTier.MINIMAL;
}

/**
 * Generate rationale for the score
 */
function generateRationale(
  category: MarketCategory,
  categoryConfig: CategoryAdvantageConfig | undefined,
  score: number,
  factors: AsymmetryFactor[],
  matchedKeywords: string[]
): string {
  const parts: string[] = [];

  if (categoryConfig) {
    parts.push(`Category "${category}" ${categoryConfig.rationale}.`);
  }

  const detectedFactors = factors.filter((f) => f.detected);
  if (detectedFactors.length > 0) {
    const factorNames = detectedFactors.map((f) => f.name).join(", ");
    parts.push(`Detected factors: ${factorNames}.`);
  }

  if (matchedKeywords.length > 0) {
    const keywordList = matchedKeywords.slice(0, 5).join(", ");
    const more = matchedKeywords.length > 5 ? ` (+${matchedKeywords.length - 5} more)` : "";
    parts.push(`High-value keywords: ${keywordList}${more}.`);
  }

  const tier = getTierFromScore(score);
  parts.push(`Overall assessment: ${tier} information advantage potential (score: ${score}).`);

  return parts.join(" ");
}

// ============================================================================
// Cache Entry
// ============================================================================

interface CacheEntry {
  result: InformationAdvantageResult;
  expiresAt: number;
}

// ============================================================================
// Identifier Class
// ============================================================================

/**
 * Information Advantage Identifier
 *
 * Identifies markets where insider information would be most valuable.
 */
export class InformationAdvantageIdentifier {
  private readonly config: Required<InformationAdvantageIdentifierConfig>;
  private readonly categoryConfigs: Map<MarketCategory, CategoryAdvantageConfig>;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly rankings: Map<string, MarketRanking> = new Map();
  private readonly classifier: MarketCategoryClassifier;
  private analysisCount = 0;
  private cacheHits = 0;

  constructor(
    config: InformationAdvantageIdentifierConfig = {},
    classifier?: MarketCategoryClassifier
  ) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      customCategoryConfigs: config.customCategoryConfigs ?? [],
      highValueThreshold: config.highValueThreshold ?? DEFAULT_HIGH_VALUE_THRESHOLD,
      debug: config.debug ?? false,
    };

    // Build category config map
    this.categoryConfigs = new Map();
    const configs =
      this.config.customCategoryConfigs.length > 0
        ? this.config.customCategoryConfigs
        : DEFAULT_CATEGORY_CONFIGS;

    for (const cfg of configs) {
      this.categoryConfigs.set(cfg.category, cfg);
    }

    this.classifier = classifier ?? getSharedMarketCategoryClassifier();
  }

  /**
   * Analyze a market for information advantage potential
   */
  analyzeMarket(
    market: MarketForClassification,
    options: AnalyzeMarketOptions = {}
  ): InformationAdvantageResult {
    const { bypassCache = false, includeFactors = true, classificationResult } = options;

    // Check cache
    if (!bypassCache) {
      const cached = this.getFromCache(market.id);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
    }

    // Get classification
    const classification =
      classificationResult ?? this.classifier.classifyMarket(market);
    const category = classification.primaryCategory;

    // Build text for analysis
    const textParts = [market.question];
    if (market.description) textParts.push(market.description);
    if (market.slug) textParts.push(market.slug.replace(/-/g, " "));
    if (market.tags) textParts.push(market.tags.join(" "));
    const fullText = textParts.join(" ");
    const normalizedText = normalizeText(fullText);

    // Get category config
    const categoryConfig = this.categoryConfigs.get(category);
    let score = categoryConfig?.baseScore ?? 10;
    const advantageTypes = new Set<InformationAdvantageType>(
      categoryConfig?.advantageTypes ?? [InformationAdvantageType.GENERAL]
    );
    const matchedKeywords: string[] = [];
    const factors: AsymmetryFactor[] = [];

    // Score category-specific high-value keywords
    if (categoryConfig) {
      for (const pattern of categoryConfig.highValueKeywords) {
        if (matchesKeyword(normalizedText, pattern)) {
          score += pattern.weight;
          score += calculateContextBonus(normalizedText, pattern);
          matchedKeywords.push(pattern.keyword);
          advantageTypes.add(pattern.advantageType);
        }
      }
    }

    // Score cross-category high-value keywords
    for (const pattern of CROSS_CATEGORY_HIGH_VALUE_KEYWORDS) {
      if (matchesKeyword(normalizedText, pattern)) {
        score += pattern.weight;
        score += calculateContextBonus(normalizedText, pattern);
        matchedKeywords.push(pattern.keyword);
        advantageTypes.add(pattern.advantageType);
      }
    }

    // Score asymmetry factors
    if (includeFactors) {
      for (const factorDef of ASYMMETRY_FACTORS) {
        let detected = false;
        let evidence: string | undefined;

        for (const pattern of factorDef.patterns) {
          if (normalizedText.includes(pattern.toLowerCase())) {
            detected = true;
            evidence = pattern;
            break;
          }
        }

        const factor: AsymmetryFactor = {
          name: factorDef.name,
          score: detected ? factorDef.weight : 0,
          detected,
          evidence,
        };

        factors.push(factor);

        if (detected) {
          score += factorDef.weight;
        }
      }
    }

    // Add bonus from classification's insider potential
    if (classification.hasInsiderPotential) {
      score += classification.insiderPotentialScore * 0.2;
    }

    // Cap score at 100
    score = Math.min(100, Math.round(score));

    const result: InformationAdvantageResult = {
      marketId: market.id,
      question: market.question,
      score,
      tier: getTierFromScore(score),
      category,
      advantageTypes: Array.from(advantageTypes),
      factors,
      matchedKeywords,
      analyzedAt: new Date(),
      fromCache: false,
      rationale: generateRationale(category, categoryConfig, score, factors, matchedKeywords),
    };

    // Add to cache
    this.addToCache(market.id, result);
    this.analysisCount++;

    // Update rankings
    this.updateRanking(result);

    if (this.config.debug) {
      console.log(
        `[InformationAdvantageIdentifier] Analyzed ${market.id}: score=${score}, tier=${result.tier}`
      );
    }

    return result;
  }

  /**
   * Analyze multiple markets
   */
  analyzeMarkets(
    markets: MarketForClassification[],
    options: AnalyzeMarketOptions = {}
  ): BatchAnalysisResult {
    const startTime = Date.now();
    const results = new Map<string, InformationAdvantageResult>();
    const errors = new Map<string, string>();
    const tierDistribution = new Map<InformationAdvantageTier, number>();
    let highValueCount = 0;

    for (const market of markets) {
      try {
        const result = this.analyzeMarket(market, options);
        results.set(market.id, result);

        // Update tier distribution
        const count = tierDistribution.get(result.tier) ?? 0;
        tierDistribution.set(result.tier, count + 1);

        // Count high-value markets
        if (result.score >= this.config.highValueThreshold) {
          highValueCount++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.set(market.id, message);
      }
    }

    return {
      results,
      errors,
      totalProcessed: markets.length,
      highValueCount,
      tierDistribution,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get from cache
   */
  private getFromCache(marketId: string): InformationAdvantageResult | null {
    const entry = this.cache.get(marketId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(marketId);
      return null;
    }

    return { ...entry.result, fromCache: true };
  }

  /**
   * Add to cache
   */
  private addToCache(marketId: string, result: InformationAdvantageResult): void {
    // Evict if full
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(marketId, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
  }

  /**
   * Update market ranking
   */
  private updateRanking(result: InformationAdvantageResult): void {
    this.rankings.set(result.marketId, {
      marketId: result.marketId,
      question: result.question,
      score: result.score,
      tier: result.tier,
      category: result.category,
      advantageTypes: result.advantageTypes,
      rank: 0, // Will be recalculated
      updatedAt: result.analyzedAt,
    });
  }

  /**
   * Get ranked markets by information advantage score
   */
  getRankedMarkets(limit: number = 100): MarketRanking[] {
    const rankings = Array.from(this.rankings.values());
    rankings.sort((a, b) => b.score - a.score);

    // Assign ranks
    let rank = 1;
    for (const ranking of rankings) {
      ranking.rank = rank++;
    }

    return rankings.slice(0, limit);
  }

  /**
   * Get high-value markets (above threshold)
   */
  getHighValueMarkets(
    markets: MarketForClassification[],
    options: AnalyzeMarketOptions = {}
  ): InformationAdvantageResult[] {
    const results: InformationAdvantageResult[] = [];

    for (const market of markets) {
      const result = this.analyzeMarket(market, options);
      if (result.score >= this.config.highValueThreshold) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Check if a market is high-value
   */
  isHighValueMarket(
    market: MarketForClassification,
    options: AnalyzeMarketOptions = {}
  ): boolean {
    const result = this.analyzeMarket(market, options);
    return result.score >= this.config.highValueThreshold;
  }

  /**
   * Get markets by tier
   */
  getMarketsByTier(
    markets: MarketForClassification[],
    tier: InformationAdvantageTier,
    options: AnalyzeMarketOptions = {}
  ): InformationAdvantageResult[] {
    const results: InformationAdvantageResult[] = [];

    for (const market of markets) {
      const result = this.analyzeMarket(market, options);
      if (result.tier === tier) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get markets by advantage type
   */
  getMarketsByAdvantageType(
    markets: MarketForClassification[],
    advantageType: InformationAdvantageType,
    options: AnalyzeMarketOptions = {}
  ): InformationAdvantageResult[] {
    const results: InformationAdvantageResult[] = [];

    for (const market of markets) {
      const result = this.analyzeMarket(market, options);
      if (result.advantageTypes.includes(advantageType)) {
        results.push(result);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get category config
   */
  getCategoryConfig(category: MarketCategory): CategoryAdvantageConfig | undefined {
    return this.categoryConfigs.get(category);
  }

  /**
   * Get all category configs
   */
  getAllCategoryConfigs(): CategoryAdvantageConfig[] {
    return Array.from(this.categoryConfigs.values());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.config.debug) {
      console.log("[InformationAdvantageIdentifier] Cache cleared");
    }
  }

  /**
   * Clear rankings
   */
  clearRankings(): void {
    this.rankings.clear();
    if (this.config.debug) {
      console.log("[InformationAdvantageIdentifier] Rankings cleared");
    }
  }

  /**
   * Get summary statistics
   */
  getSummary(): IdentifierSummary {
    const tierBreakdown = new Map<InformationAdvantageTier, number>();
    const advantageTypeBreakdown = new Map<InformationAdvantageType, number>();
    let totalScore = 0;
    let count = 0;

    for (const entry of this.cache.values()) {
      if (Date.now() <= entry.expiresAt) {
        const result = entry.result;
        count++;
        totalScore += result.score;

        // Tier breakdown
        const tierCount = tierBreakdown.get(result.tier) ?? 0;
        tierBreakdown.set(result.tier, tierCount + 1);

        // Advantage type breakdown
        for (const advType of result.advantageTypes) {
          const typeCount = advantageTypeBreakdown.get(advType) ?? 0;
          advantageTypeBreakdown.set(advType, typeCount + 1);
        }
      }
    }

    return {
      totalAnalyzed: this.analysisCount,
      cacheSize: this.cache.size,
      cacheHitRate:
        this.analysisCount > 0
          ? Math.round((this.cacheHits / this.analysisCount) * 1000) / 10
          : 0,
      tierBreakdown,
      advantageTypeBreakdown,
      topRankedMarkets: this.getRankedMarkets(10),
      averageScore: count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0,
    };
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get rankings count
   */
  getRankingsCount(): number {
    return this.rankings.size;
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let sharedInstance: InformationAdvantageIdentifier | null = null;

/**
 * Create a new InformationAdvantageIdentifier instance
 */
export function createInformationAdvantageIdentifier(
  config?: InformationAdvantageIdentifierConfig,
  classifier?: MarketCategoryClassifier
): InformationAdvantageIdentifier {
  return new InformationAdvantageIdentifier(config, classifier);
}

/**
 * Get the shared InformationAdvantageIdentifier instance
 */
export function getSharedInformationAdvantageIdentifier(): InformationAdvantageIdentifier {
  if (!sharedInstance) {
    sharedInstance = new InformationAdvantageIdentifier();
  }
  return sharedInstance;
}

/**
 * Set the shared InformationAdvantageIdentifier instance
 */
export function setSharedInformationAdvantageIdentifier(
  identifier: InformationAdvantageIdentifier
): void {
  sharedInstance = identifier;
}

/**
 * Reset the shared InformationAdvantageIdentifier instance
 */
export function resetSharedInformationAdvantageIdentifier(): void {
  if (sharedInstance) {
    sharedInstance.clearCache();
    sharedInstance.clearRankings();
  }
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Analyze a market for information advantage using shared instance
 */
export function analyzeMarketInformationAdvantage(
  market: MarketForClassification,
  options?: AnalyzeMarketOptions
): InformationAdvantageResult {
  return getSharedInformationAdvantageIdentifier().analyzeMarket(market, options);
}

/**
 * Analyze multiple markets using shared instance
 */
export function analyzeMarketsInformationAdvantage(
  markets: MarketForClassification[],
  options?: AnalyzeMarketOptions
): BatchAnalysisResult {
  return getSharedInformationAdvantageIdentifier().analyzeMarkets(markets, options);
}

/**
 * Get high-value markets using shared instance
 */
export function getHighValueMarketsForInsiderPotential(
  markets: MarketForClassification[],
  options?: AnalyzeMarketOptions
): InformationAdvantageResult[] {
  return getSharedInformationAdvantageIdentifier().getHighValueMarkets(markets, options);
}

/**
 * Check if a market is high-value using shared instance
 */
export function isHighValueMarketForInsider(
  market: MarketForClassification,
  options?: AnalyzeMarketOptions
): boolean {
  return getSharedInformationAdvantageIdentifier().isHighValueMarket(market, options);
}

/**
 * Get ranked markets using shared instance
 */
export function getRankedMarketsForInsiderValue(
  limit?: number
): MarketRanking[] {
  return getSharedInformationAdvantageIdentifier().getRankedMarkets(limit);
}

/**
 * Get information advantage summary using shared instance
 */
export function getInformationAdvantageSummary(): IdentifierSummary {
  return getSharedInformationAdvantageIdentifier().getSummary();
}
