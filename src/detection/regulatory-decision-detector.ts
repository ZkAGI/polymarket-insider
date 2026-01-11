/**
 * Regulatory Decision Market Detector (DET-NICHE-005)
 *
 * Detect markets about regulatory decisions by government agencies.
 *
 * Features:
 * - Define comprehensive regulatory keyword taxonomy
 * - Identify agency-related markets (SEC, FDA, FCC, EPA, etc.)
 * - Track regulatory deadlines and decision timelines
 * - Flag regulatory markets with appropriate severity levels
 * - Support for multi-jurisdiction regulatory tracking
 * - Integrate with market category classifier
 */

import {
  MarketCategoryClassifier,
  getSharedMarketCategoryClassifier,
  type MarketClassificationResult,
} from "./market-category-classifier";

// ============================================================================
// Enums and Types
// ============================================================================

/**
 * Regulatory agency classification
 */
export enum RegulatoryAgency {
  // US Federal Agencies
  /** Securities and Exchange Commission */
  SEC = "SEC",
  /** Federal Drug Administration */
  FDA = "FDA",
  /** Federal Communications Commission */
  FCC = "FCC",
  /** Environmental Protection Agency */
  EPA = "EPA",
  /** Federal Trade Commission */
  FTC = "FTC",
  /** Federal Reserve */
  FEDERAL_RESERVE = "FEDERAL_RESERVE",
  /** Department of Justice */
  DOJ = "DOJ",
  /** Consumer Financial Protection Bureau */
  CFPB = "CFPB",
  /** Commodity Futures Trading Commission */
  CFTC = "CFTC",
  /** Federal Aviation Administration */
  FAA = "FAA",
  /** National Highway Traffic Safety Administration */
  NHTSA = "NHTSA",
  /** Office of Foreign Assets Control */
  OFAC = "OFAC",
  /** Department of Treasury */
  TREASURY = "TREASURY",
  /** Internal Revenue Service */
  IRS = "IRS",
  /** Federal Energy Regulatory Commission */
  FERC = "FERC",
  /** Nuclear Regulatory Commission */
  NRC = "NRC",
  /** Centers for Medicare & Medicaid Services */
  CMS = "CMS",
  /** Patent and Trademark Office */
  USPTO = "USPTO",

  // International/EU Agencies
  /** European Central Bank */
  ECB = "ECB",
  /** European Commission */
  EU_COMMISSION = "EU_COMMISSION",
  /** European Medicines Agency */
  EMA = "EMA",
  /** Bank of England */
  BOE = "BOE",
  /** Financial Conduct Authority (UK) */
  FCA = "FCA",
  /** Competition and Markets Authority (UK) */
  CMA = "CMA",
  /** Bundesbank (Germany) */
  BUNDESBANK = "BUNDESBANK",
  /** People's Bank of China */
  PBOC = "PBOC",
  /** Bank of Japan */
  BOJ = "BOJ",
  /** Reserve Bank of India */
  RBI = "RBI",

  // Generic
  OTHER = "OTHER",
}

/**
 * Regulatory decision type classification
 */
export enum RegulatoryDecisionType {
  /** Drug or product approval */
  APPROVAL = "APPROVAL",
  /** Denial of application */
  DENIAL = "DENIAL",
  /** Enforcement action */
  ENFORCEMENT = "ENFORCEMENT",
  /** Fine or penalty */
  FINE = "FINE",
  /** Investigation launch or result */
  INVESTIGATION = "INVESTIGATION",
  /** Merger/acquisition approval */
  MERGER_APPROVAL = "MERGER_APPROVAL",
  /** Policy rule change */
  RULE_CHANGE = "RULE_CHANGE",
  /** Interest rate decision */
  RATE_DECISION = "RATE_DECISION",
  /** License granting */
  LICENSE = "LICENSE",
  /** Ban or prohibition */
  BAN = "BAN",
  /** Settlement agreement */
  SETTLEMENT = "SETTLEMENT",
  /** Emergency authorization */
  EMERGENCY_AUTH = "EMERGENCY_AUTH",
  /** Guidance or clarification */
  GUIDANCE = "GUIDANCE",
  /** Public comment period */
  PUBLIC_COMMENT = "PUBLIC_COMMENT",
  /** Hearing or review */
  HEARING = "HEARING",
  /** Compliance requirement */
  COMPLIANCE = "COMPLIANCE",
  /** General regulatory */
  GENERAL = "GENERAL",
}

/**
 * Regulatory sector classification
 */
export enum RegulatorySector {
  /** Financial services, banking, securities */
  FINANCE = "FINANCE",
  /** Healthcare, pharmaceuticals, medical devices */
  HEALTHCARE = "HEALTHCARE",
  /** Technology, telecommunications */
  TECHNOLOGY = "TECHNOLOGY",
  /** Energy, utilities */
  ENERGY = "ENERGY",
  /** Environment, climate */
  ENVIRONMENT = "ENVIRONMENT",
  /** Automotive, transportation */
  TRANSPORTATION = "TRANSPORTATION",
  /** Consumer protection */
  CONSUMER = "CONSUMER",
  /** Cryptocurrency, blockchain */
  CRYPTO = "CRYPTO",
  /** Antitrust, competition */
  ANTITRUST = "ANTITRUST",
  /** Trade, tariffs */
  TRADE = "TRADE",
  /** Immigration */
  IMMIGRATION = "IMMIGRATION",
  /** Defense, national security */
  DEFENSE = "DEFENSE",
  /** Agriculture, food safety */
  AGRICULTURE = "AGRICULTURE",
  /** Media, entertainment */
  MEDIA = "MEDIA",
  /** General/other */
  OTHER = "OTHER",
}

/**
 * Regulatory jurisdiction
 */
export enum RegulatoryJurisdiction {
  /** United States Federal */
  US_FEDERAL = "US_FEDERAL",
  /** US State level */
  US_STATE = "US_STATE",
  /** European Union */
  EU = "EU",
  /** United Kingdom */
  UK = "UK",
  /** China */
  CHINA = "CHINA",
  /** Japan */
  JAPAN = "JAPAN",
  /** Germany */
  GERMANY = "GERMANY",
  /** France */
  FRANCE = "FRANCE",
  /** India */
  INDIA = "INDIA",
  /** Canada */
  CANADA = "CANADA",
  /** Australia */
  AUSTRALIA = "AUSTRALIA",
  /** Switzerland */
  SWITZERLAND = "SWITZERLAND",
  /** International/Multi-jurisdiction */
  INTERNATIONAL = "INTERNATIONAL",
  /** Other */
  OTHER = "OTHER",
}

/**
 * Confidence level for regulatory identification
 */
export enum RegulatoryConfidence {
  /** Very high confidence - explicit agency mention */
  VERY_HIGH = "VERY_HIGH",
  /** High confidence - strong regulatory signals */
  HIGH = "HIGH",
  /** Medium confidence - moderate signals */
  MEDIUM = "MEDIUM",
  /** Low confidence - weak signals */
  LOW = "LOW",
}

/**
 * Insider advantage level for regulatory markets
 */
export enum InsiderAdvantageLevel {
  /** Very high - decision known by few before public */
  VERY_HIGH = "VERY_HIGH",
  /** High - significant info asymmetry possible */
  HIGH = "HIGH",
  /** Medium - some insider advantage possible */
  MEDIUM = "MEDIUM",
  /** Low - generally public information */
  LOW = "LOW",
}

/**
 * A single regulatory tag
 */
export interface RegulatoryTag {
  /** Type of tag */
  type: "agency" | "decision_type" | "sector" | "jurisdiction";
  /** The specific tag value */
  value:
    | RegulatoryAgency
    | RegulatoryDecisionType
    | RegulatorySector
    | RegulatoryJurisdiction;
  /** Confidence in this tag assignment */
  confidence: RegulatoryConfidence;
  /** Confidence score (0-100) */
  confidenceScore: number;
  /** Keywords that triggered this tag */
  triggerKeywords: string[];
}

/**
 * Regulatory deadline information
 */
export interface RegulatoryDeadline {
  /** Description of the deadline */
  description: string;
  /** Expected deadline date (if known) */
  expectedDate: Date | null;
  /** Type of deadline (decision, comment period, etc.) */
  deadlineType: RegulatoryDecisionType;
  /** Agency responsible */
  agency: RegulatoryAgency | null;
  /** Whether deadline was extracted from market text */
  extractedFromText: boolean;
}

/**
 * Result of detecting a regulatory market
 */
export interface RegulatoryMarketResult {
  /** Market ID */
  marketId: string;
  /** Market question for reference */
  question: string;
  /** Whether this market is regulatory-related */
  isRegulatory: boolean;
  /** Overall regulatory relevance score (0-100) */
  relevanceScore: number;
  /** Primary agency (if identifiable) */
  primaryAgency: RegulatoryAgency | null;
  /** All assigned agency tags */
  agencyTags: RegulatoryTag[];
  /** Primary decision type */
  primaryDecisionType: RegulatoryDecisionType | null;
  /** All assigned decision type tags */
  decisionTypeTags: RegulatoryTag[];
  /** Primary sector */
  primarySector: RegulatorySector | null;
  /** All assigned sector tags */
  sectorTags: RegulatoryTag[];
  /** Primary jurisdiction */
  primaryJurisdiction: RegulatoryJurisdiction | null;
  /** All assigned jurisdiction tags */
  jurisdictionTags: RegulatoryTag[];
  /** All tags combined */
  allTags: RegulatoryTag[];
  /** Identified regulatory deadlines */
  deadlines: RegulatoryDeadline[];
  /** Insider advantage level */
  insiderAdvantageLevel: InsiderAdvantageLevel;
  /** Insider advantage score (0-100) */
  insiderAdvantageScore: number;
  /** Companies or entities mentioned */
  mentionedEntities: string[];
  /** Timestamp of detection */
  detectedAt: Date;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Market data for regulatory detection
 */
export interface MarketForRegulatoryDetection {
  /** Market ID */
  id: string;
  /** Market question/title */
  question: string;
  /** Market description */
  description?: string;
  /** Market slug */
  slug?: string;
  /** Tags from the market */
  tags?: string[];
  /** End date of the market */
  endDate?: Date;
  /** Pre-existing classification result (optional) */
  classificationResult?: MarketClassificationResult;
}

/**
 * Keyword pattern for regulatory detection
 */
export interface RegulatoryKeyword {
  /** The keyword or phrase to match */
  keyword: string;
  /** Weight for scoring */
  weight: number;
  /** Tags this keyword triggers */
  triggers: {
    agencies?: RegulatoryAgency[];
    decisionTypes?: RegulatoryDecisionType[];
    sectors?: RegulatorySector[];
    jurisdictions?: RegulatoryJurisdiction[];
  };
  /** Whether this is an exact word boundary match */
  exactMatch?: boolean;
  /** Additional context required for this keyword */
  requiredContext?: string[];
  /** Keywords that exclude this match */
  excludeIfPresent?: string[];
  /** Insider advantage weight (adds to insider score) */
  insiderWeight?: number;
  /** Entity names associated with this keyword */
  entities?: string[];
}

/**
 * Options for detection
 */
export interface DetectRegulatoryOptions {
  /** Minimum relevance score to be considered regulatory */
  minRelevanceScore?: number;
  /** Whether to detect entities */
  detectEntities?: boolean;
  /** Whether to extract deadlines */
  extractDeadlines?: boolean;
  /** Bypass cache */
  bypassCache?: boolean;
}

/**
 * Batch detection result
 */
export interface BatchRegulatoryDetectionResult {
  /** Successful detection results by market ID */
  results: Map<string, RegulatoryMarketResult>;
  /** Failed market IDs with error messages */
  errors: Map<string, string>;
  /** Total markets processed */
  totalProcessed: number;
  /** Number of regulatory markets */
  regulatoryCount: number;
  /** Number of high insider advantage markets */
  highInsiderAdvantageCount: number;
  /** Agency distribution */
  agencyDistribution: Map<RegulatoryAgency, number>;
  /** Decision type distribution */
  decisionTypeDistribution: Map<RegulatoryDecisionType, number>;
  /** Sector distribution */
  sectorDistribution: Map<RegulatorySector, number>;
  /** Jurisdiction distribution */
  jurisdictionDistribution: Map<RegulatoryJurisdiction, number>;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for the detector
 */
export interface RegulatoryDetectorSummary {
  /** Total markets detected */
  totalDetected: number;
  /** Number of regulatory markets */
  regulatoryMarketsCount: number;
  /** Percentage of markets that are regulatory */
  regulatoryPercentage: number;
  /** High insider advantage markets count */
  highInsiderAdvantageCount: number;
  /** Agency breakdown */
  agencyBreakdown: Map<RegulatoryAgency, number>;
  /** Decision type breakdown */
  decisionTypeBreakdown: Map<RegulatoryDecisionType, number>;
  /** Sector breakdown */
  sectorBreakdown: Map<RegulatorySector, number>;
  /** Jurisdiction breakdown */
  jurisdictionBreakdown: Map<RegulatoryJurisdiction, number>;
  /** Average relevance score for regulatory markets */
  averageRelevanceScore: number;
  /** Average insider advantage score */
  averageInsiderAdvantageScore: number;
  /** Cache hit rate */
  cacheHitRate: number;
}

/**
 * Configuration for the regulatory detector
 */
export interface RegulatoryDecisionDetectorConfig {
  /** Cache TTL in milliseconds (default: 12 hours) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 10000) */
  maxCacheSize?: number;
  /** Minimum score to consider regulatory (default: 15) */
  minRegulatoryScore?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom keywords (extends defaults) */
  additionalKeywords?: RegulatoryKeyword[];
  /** Reference to market classifier (optional) */
  classifier?: MarketCategoryClassifier;
}

// ============================================================================
// Constants - Regulatory Keywords
// ============================================================================

/**
 * Default cache TTL: 12 hours
 */
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Default minimum score to be considered regulatory
 */
const DEFAULT_MIN_REGULATORY_SCORE = 15;

/**
 * Default maximum cache size
 */
const DEFAULT_MAX_CACHE_SIZE = 10000;

/**
 * Default regulatory keywords organized by category
 */
export const DEFAULT_REGULATORY_KEYWORDS: RegulatoryKeyword[] = [
  // ==== SEC - Securities and Exchange Commission ====
  {
    keyword: "sec",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 15,
  },
  {
    keyword: "securities and exchange commission",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 18,
  },
  {
    keyword: "sec approval",
    weight: 20,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.FINANCE],
    },
    insiderWeight: 20,
  },
  {
    keyword: "etf approval",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.CRYPTO, RegulatorySector.FINANCE],
    },
    insiderWeight: 20,
  },
  {
    keyword: "bitcoin etf",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.CRYPTO],
    },
    insiderWeight: 18,
    entities: ["BlackRock", "Fidelity", "VanEck", "Grayscale", "ARK"],
  },
  {
    keyword: "ethereum etf",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.CRYPTO],
    },
    insiderWeight: 18,
  },
  {
    keyword: "spot etf",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
    },
    insiderWeight: 16,
  },
  {
    keyword: "sec lawsuit",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
    },
    insiderWeight: 15,
  },
  {
    keyword: "sec investigation",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.INVESTIGATION],
    },
    insiderWeight: 18,
  },
  {
    keyword: "sec fine",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      decisionTypes: [RegulatoryDecisionType.FINE],
    },
    insiderWeight: 16,
  },
  {
    keyword: "gensler",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 10,
    entities: ["Gary Gensler"],
  },
  {
    keyword: "gary gensler",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 12,
    entities: ["Gary Gensler"],
  },

  // ==== FDA - Food and Drug Administration ====
  {
    keyword: "fda",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      sectors: [RegulatorySector.HEALTHCARE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 18,
  },
  {
    keyword: "food and drug administration",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      sectors: [RegulatorySector.HEALTHCARE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 18,
  },
  {
    keyword: "fda approval",
    weight: 22,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 25,
  },
  {
    keyword: "drug approval",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 20,
  },
  {
    keyword: "pdufa",
    weight: 20,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 22,
  },
  {
    keyword: "pdufa date",
    weight: 22,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 25,
  },
  {
    keyword: "new drug application",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 20,
  },
  {
    keyword: "nda",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    requiredContext: ["fda", "drug", "approval", "pharmaceutical"],
    insiderWeight: 16,
  },
  {
    keyword: "biologics license",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.LICENSE],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 20,
  },
  {
    keyword: "bla",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.LICENSE],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    requiredContext: ["fda", "approval", "biologics"],
    insiderWeight: 16,
  },
  {
    keyword: "emergency use authorization",
    weight: 20,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.EMERGENCY_AUTH],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 22,
  },
  {
    keyword: "eua",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.EMERGENCY_AUTH],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    requiredContext: ["fda", "authorization", "emergency", "vaccine"],
    insiderWeight: 18,
  },
  {
    keyword: "complete response letter",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.DENIAL],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    insiderWeight: 20,
  },
  {
    keyword: "advisory committee",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FDA],
      decisionTypes: [RegulatoryDecisionType.HEARING],
      sectors: [RegulatorySector.HEALTHCARE],
    },
    requiredContext: ["fda", "drug", "vote"],
    insiderWeight: 16,
  },

  // ==== FCC - Federal Communications Commission ====
  {
    keyword: "fcc",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.FCC],
      sectors: [RegulatorySector.TECHNOLOGY, RegulatorySector.MEDIA],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 14,
  },
  {
    keyword: "federal communications commission",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FCC],
      sectors: [RegulatorySector.TECHNOLOGY, RegulatorySector.MEDIA],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 14,
  },
  {
    keyword: "net neutrality",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.FCC],
      decisionTypes: [RegulatoryDecisionType.RULE_CHANGE],
      sectors: [RegulatorySector.TECHNOLOGY],
    },
    insiderWeight: 14,
  },
  {
    keyword: "spectrum auction",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.FCC],
      decisionTypes: [RegulatoryDecisionType.LICENSE],
      sectors: [RegulatorySector.TECHNOLOGY],
    },
    insiderWeight: 14,
  },

  // ==== EPA - Environmental Protection Agency ====
  {
    keyword: "epa",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.EPA],
      sectors: [RegulatorySector.ENVIRONMENT],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 12,
  },
  {
    keyword: "environmental protection agency",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.EPA],
      sectors: [RegulatorySector.ENVIRONMENT],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 12,
  },
  {
    keyword: "emissions standard",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.EPA],
      decisionTypes: [RegulatoryDecisionType.RULE_CHANGE],
      sectors: [RegulatorySector.ENVIRONMENT],
    },
    insiderWeight: 12,
  },
  {
    keyword: "clean air act",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.EPA],
      sectors: [RegulatorySector.ENVIRONMENT],
    },
    insiderWeight: 10,
  },
  {
    keyword: "clean water act",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.EPA],
      sectors: [RegulatorySector.ENVIRONMENT],
    },
    insiderWeight: 10,
  },

  // ==== FTC - Federal Trade Commission ====
  {
    keyword: "ftc",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.FTC],
      sectors: [RegulatorySector.ANTITRUST, RegulatorySector.CONSUMER],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 16,
  },
  {
    keyword: "federal trade commission",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FTC],
      sectors: [RegulatorySector.ANTITRUST, RegulatorySector.CONSUMER],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 16,
  },
  {
    keyword: "ftc lawsuit",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FTC],
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
    },
    insiderWeight: 16,
  },
  {
    keyword: "antitrust",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FTC, RegulatoryAgency.DOJ],
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
      sectors: [RegulatorySector.ANTITRUST],
    },
    insiderWeight: 14,
  },
  {
    keyword: "lina khan",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.FTC],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 10,
    entities: ["Lina Khan"],
  },

  // ==== Federal Reserve ====
  {
    keyword: "federal reserve",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 16,
  },
  {
    keyword: "fed",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      sectors: [RegulatorySector.FINANCE],
    },
    requiredContext: [
      "rate",
      "interest",
      "hike",
      "cut",
      "monetary",
      "fomc",
      "powell",
    ],
    insiderWeight: 14,
  },
  {
    keyword: "fomc",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      decisionTypes: [RegulatoryDecisionType.RATE_DECISION],
      sectors: [RegulatorySector.FINANCE],
    },
    insiderWeight: 16,
  },
  {
    keyword: "rate hike",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      decisionTypes: [RegulatoryDecisionType.RATE_DECISION],
      sectors: [RegulatorySector.FINANCE],
    },
    insiderWeight: 12,
  },
  {
    keyword: "rate cut",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      decisionTypes: [RegulatoryDecisionType.RATE_DECISION],
      sectors: [RegulatorySector.FINANCE],
    },
    insiderWeight: 12,
  },
  {
    keyword: "interest rate",
    weight: 12,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.RATE_DECISION],
      sectors: [RegulatorySector.FINANCE],
    },
    requiredContext: ["fed", "fomc", "federal reserve", "central bank"],
    insiderWeight: 10,
  },
  {
    keyword: "jerome powell",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 12,
    entities: ["Jerome Powell"],
  },
  {
    keyword: "powell",
    weight: 10,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
    },
    requiredContext: ["fed", "rate", "monetary", "federal reserve"],
    insiderWeight: 10,
    entities: ["Jerome Powell"],
  },

  // ==== DOJ - Department of Justice ====
  {
    keyword: "doj",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.DOJ],
      sectors: [RegulatorySector.ANTITRUST],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 16,
  },
  {
    keyword: "department of justice",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.DOJ],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 16,
  },
  {
    keyword: "doj lawsuit",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.DOJ],
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
    },
    insiderWeight: 16,
  },
  {
    keyword: "antitrust lawsuit",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.DOJ, RegulatoryAgency.FTC],
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
      sectors: [RegulatorySector.ANTITRUST],
    },
    insiderWeight: 16,
  },

  // ==== CFTC - Commodity Futures Trading Commission ====
  {
    keyword: "cftc",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.CFTC],
      sectors: [RegulatorySector.FINANCE, RegulatorySector.CRYPTO],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 16,
  },
  {
    keyword: "commodity futures trading commission",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.CFTC],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 16,
  },

  // ==== Crypto Regulatory Keywords ====
  {
    keyword: "crypto regulation",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.SEC, RegulatoryAgency.CFTC],
      sectors: [RegulatorySector.CRYPTO],
    },
    insiderWeight: 14,
  },
  {
    keyword: "cryptocurrency regulation",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.SEC, RegulatoryAgency.CFTC],
      sectors: [RegulatorySector.CRYPTO],
    },
    insiderWeight: 14,
  },
  {
    keyword: "stablecoin regulation",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.SEC, RegulatoryAgency.CFTC],
      sectors: [RegulatorySector.CRYPTO],
    },
    insiderWeight: 14,
  },
  {
    keyword: "cbdc",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.FEDERAL_RESERVE],
      sectors: [RegulatorySector.CRYPTO, RegulatorySector.FINANCE],
    },
    insiderWeight: 10,
  },
  {
    keyword: "digital currency",
    weight: 10,
    triggers: {
      sectors: [RegulatorySector.CRYPTO],
    },
    requiredContext: ["regulation", "regulatory", "fed", "central bank"],
    insiderWeight: 8,
  },

  // ==== Merger and Acquisition Keywords ====
  {
    keyword: "merger approval",
    weight: 18,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.MERGER_APPROVAL],
      sectors: [RegulatorySector.ANTITRUST],
    },
    insiderWeight: 18,
  },
  {
    keyword: "acquisition approval",
    weight: 18,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.MERGER_APPROVAL],
      sectors: [RegulatorySector.ANTITRUST],
    },
    insiderWeight: 18,
  },
  {
    keyword: "block merger",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FTC, RegulatoryAgency.DOJ],
      decisionTypes: [RegulatoryDecisionType.DENIAL],
      sectors: [RegulatorySector.ANTITRUST],
    },
    insiderWeight: 18,
  },
  {
    keyword: "merger blocked",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FTC, RegulatoryAgency.DOJ],
      decisionTypes: [RegulatoryDecisionType.DENIAL],
      sectors: [RegulatorySector.ANTITRUST],
    },
    insiderWeight: 18,
  },
  {
    keyword: "regulatory approval",
    weight: 14,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
    },
    insiderWeight: 14,
  },

  // ==== General Regulatory Keywords ====
  {
    keyword: "approve",
    weight: 8,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.APPROVAL],
    },
    requiredContext: [
      "regulatory",
      "fda",
      "sec",
      "fcc",
      "epa",
      "ftc",
      "agency",
      "commission",
    ],
    insiderWeight: 8,
  },
  {
    keyword: "deny",
    weight: 8,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.DENIAL],
    },
    requiredContext: [
      "regulatory",
      "fda",
      "sec",
      "fcc",
      "epa",
      "ftc",
      "agency",
      "commission",
    ],
    insiderWeight: 8,
  },
  {
    keyword: "ban",
    weight: 10,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.BAN],
    },
    requiredContext: ["regulatory", "government", "agency", "federal"],
    insiderWeight: 10,
  },
  {
    keyword: "fine",
    weight: 8,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.FINE],
    },
    requiredContext: [
      "regulatory",
      "sec",
      "ftc",
      "doj",
      "agency",
      "commission",
      "penalty",
    ],
    insiderWeight: 10,
  },
  {
    keyword: "settlement",
    weight: 10,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.SETTLEMENT],
    },
    requiredContext: ["regulatory", "sec", "ftc", "doj", "agency"],
    insiderWeight: 12,
  },
  {
    keyword: "investigation",
    weight: 8,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.INVESTIGATION],
    },
    requiredContext: ["regulatory", "sec", "ftc", "doj", "fda", "agency"],
    insiderWeight: 14,
  },
  {
    keyword: "enforcement action",
    weight: 14,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
    },
    insiderWeight: 14,
  },
  {
    keyword: "consent decree",
    weight: 14,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.SETTLEMENT],
    },
    insiderWeight: 14,
  },
  {
    keyword: "regulatory deadline",
    weight: 14,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.GENERAL],
    },
    insiderWeight: 14,
  },
  {
    keyword: "comment period",
    weight: 12,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.PUBLIC_COMMENT],
    },
    insiderWeight: 10,
  },
  {
    keyword: "public comment",
    weight: 12,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.PUBLIC_COMMENT],
    },
    insiderWeight: 10,
  },
  {
    keyword: "rule making",
    weight: 12,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.RULE_CHANGE],
    },
    insiderWeight: 10,
  },
  {
    keyword: "rulemaking",
    weight: 12,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.RULE_CHANGE],
    },
    insiderWeight: 10,
  },
  {
    keyword: "guidance",
    weight: 8,
    triggers: {
      decisionTypes: [RegulatoryDecisionType.GUIDANCE],
    },
    requiredContext: ["regulatory", "sec", "fda", "agency", "commission"],
    insiderWeight: 8,
  },

  // ==== European Regulatory ====
  {
    keyword: "ecb",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.ECB],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    exactMatch: true,
    insiderWeight: 14,
  },
  {
    keyword: "european central bank",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.ECB],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 14,
  },
  {
    keyword: "christine lagarde",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.ECB],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 12,
    entities: ["Christine Lagarde"],
  },
  {
    keyword: "lagarde",
    weight: 10,
    triggers: {
      agencies: [RegulatoryAgency.ECB],
    },
    requiredContext: ["ecb", "european", "rate", "monetary"],
    insiderWeight: 10,
    entities: ["Christine Lagarde"],
  },
  {
    keyword: "european commission",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.EU_COMMISSION],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 14,
  },
  {
    keyword: "eu commission",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.EU_COMMISSION],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 14,
  },
  {
    keyword: "ema",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.EMA],
      sectors: [RegulatorySector.HEALTHCARE],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    exactMatch: true,
    insiderWeight: 16,
  },
  {
    keyword: "european medicines agency",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.EMA],
      sectors: [RegulatorySector.HEALTHCARE],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 16,
  },
  {
    keyword: "gdpr",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.EU_COMMISSION],
      sectors: [RegulatorySector.TECHNOLOGY],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 10,
  },
  {
    keyword: "digital markets act",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.EU_COMMISSION],
      sectors: [RegulatorySector.TECHNOLOGY],
      jurisdictions: [RegulatoryJurisdiction.EU],
    },
    insiderWeight: 12,
  },
  {
    keyword: "dma",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.EU_COMMISSION],
      sectors: [RegulatorySector.TECHNOLOGY],
    },
    requiredContext: ["eu", "european", "digital", "gatekeeper"],
    insiderWeight: 10,
  },

  // ==== UK Regulatory ====
  {
    keyword: "bank of england",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.BOE],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.UK],
    },
    insiderWeight: 14,
  },
  {
    keyword: "boe",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.BOE],
      sectors: [RegulatorySector.FINANCE],
    },
    requiredContext: ["rate", "interest", "monetary", "uk", "britain"],
    insiderWeight: 12,
  },
  {
    keyword: "fca",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.FCA],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.UK],
    },
    exactMatch: true,
    insiderWeight: 14,
  },
  {
    keyword: "financial conduct authority",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FCA],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.UK],
    },
    insiderWeight: 14,
  },
  {
    keyword: "cma",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.CMA],
      sectors: [RegulatorySector.ANTITRUST],
      jurisdictions: [RegulatoryJurisdiction.UK],
    },
    exactMatch: true,
    requiredContext: ["uk", "britain", "merger", "competition", "antitrust"],
    insiderWeight: 14,
  },
  {
    keyword: "competition and markets authority",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.CMA],
      sectors: [RegulatorySector.ANTITRUST],
      jurisdictions: [RegulatoryJurisdiction.UK],
    },
    insiderWeight: 14,
  },

  // ==== Other International ====
  {
    keyword: "pboc",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.PBOC],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.CHINA],
    },
    exactMatch: true,
    insiderWeight: 12,
  },
  {
    keyword: "people's bank of china",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.PBOC],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.CHINA],
    },
    insiderWeight: 12,
  },
  {
    keyword: "bank of japan",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.BOJ],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.JAPAN],
    },
    insiderWeight: 12,
  },
  {
    keyword: "boj",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.BOJ],
      sectors: [RegulatorySector.FINANCE],
    },
    requiredContext: ["rate", "monetary", "japan", "yen"],
    insiderWeight: 10,
  },
  {
    keyword: "rbi",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.RBI],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.INDIA],
    },
    exactMatch: true,
    insiderWeight: 10,
  },
  {
    keyword: "reserve bank of india",
    weight: 16,
    triggers: {
      agencies: [RegulatoryAgency.RBI],
      sectors: [RegulatorySector.FINANCE],
      jurisdictions: [RegulatoryJurisdiction.INDIA],
    },
    insiderWeight: 10,
  },

  // ==== Transportation ====
  {
    keyword: "faa",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.FAA],
      sectors: [RegulatorySector.TRANSPORTATION],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 14,
  },
  {
    keyword: "federal aviation administration",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FAA],
      sectors: [RegulatorySector.TRANSPORTATION],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 14,
  },
  {
    keyword: "nhtsa",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.NHTSA],
      sectors: [RegulatorySector.TRANSPORTATION],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 12,
  },
  {
    keyword: "vehicle recall",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.NHTSA],
      decisionTypes: [RegulatoryDecisionType.ENFORCEMENT],
      sectors: [RegulatorySector.TRANSPORTATION],
    },
    insiderWeight: 12,
  },
  {
    keyword: "grounding",
    weight: 12,
    triggers: {
      agencies: [RegulatoryAgency.FAA],
      decisionTypes: [RegulatoryDecisionType.BAN],
      sectors: [RegulatorySector.TRANSPORTATION],
    },
    requiredContext: ["faa", "aircraft", "plane", "boeing", "airbus"],
    insiderWeight: 14,
  },

  // ==== Energy ====
  {
    keyword: "ferc",
    weight: 15,
    triggers: {
      agencies: [RegulatoryAgency.FERC],
      sectors: [RegulatorySector.ENERGY],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    exactMatch: true,
    insiderWeight: 12,
  },
  {
    keyword: "federal energy regulatory commission",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.FERC],
      sectors: [RegulatorySector.ENERGY],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 12,
  },
  {
    keyword: "nrc",
    weight: 14,
    triggers: {
      agencies: [RegulatoryAgency.NRC],
      sectors: [RegulatorySector.ENERGY],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    requiredContext: ["nuclear", "reactor", "plant", "license"],
    insiderWeight: 14,
  },
  {
    keyword: "nuclear regulatory commission",
    weight: 18,
    triggers: {
      agencies: [RegulatoryAgency.NRC],
      sectors: [RegulatorySector.ENERGY],
      jurisdictions: [RegulatoryJurisdiction.US_FEDERAL],
    },
    insiderWeight: 14,
  },

  // ==== High-Value Entity Names ====
  {
    keyword: "blackrock",
    weight: 10,
    triggers: {
      sectors: [RegulatorySector.FINANCE],
    },
    requiredContext: ["etf", "sec", "approval", "regulatory"],
    insiderWeight: 12,
    entities: ["BlackRock"],
  },
  {
    keyword: "grayscale",
    weight: 10,
    triggers: {
      sectors: [RegulatorySector.CRYPTO],
    },
    requiredContext: ["etf", "sec", "bitcoin", "regulatory"],
    insiderWeight: 12,
    entities: ["Grayscale"],
  },
  {
    keyword: "coinbase",
    weight: 10,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      sectors: [RegulatorySector.CRYPTO],
    },
    requiredContext: ["sec", "lawsuit", "regulatory", "enforcement"],
    insiderWeight: 14,
    entities: ["Coinbase"],
  },
  {
    keyword: "binance",
    weight: 10,
    triggers: {
      agencies: [RegulatoryAgency.SEC, RegulatoryAgency.CFTC],
      sectors: [RegulatorySector.CRYPTO],
    },
    requiredContext: ["sec", "cftc", "lawsuit", "regulatory", "enforcement"],
    insiderWeight: 14,
    entities: ["Binance"],
  },
  {
    keyword: "ripple",
    weight: 10,
    triggers: {
      agencies: [RegulatoryAgency.SEC],
      sectors: [RegulatorySector.CRYPTO],
    },
    requiredContext: ["sec", "lawsuit", "xrp", "regulatory"],
    insiderWeight: 14,
    entities: ["Ripple"],
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
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a keyword matches in the text
 */
function matchKeyword(
  text: string,
  normalizedText: string,
  pattern: RegulatoryKeyword
): boolean {
  const keywordLower = pattern.keyword.toLowerCase();

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
    const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, "i");
    return regex.test(text);
  } else {
    return normalizedText.includes(keywordLower);
  }
}

/**
 * Determine confidence level from score
 */
function getConfidenceLevel(score: number): RegulatoryConfidence {
  if (score >= 90) return RegulatoryConfidence.VERY_HIGH;
  if (score >= 70) return RegulatoryConfidence.HIGH;
  if (score >= 50) return RegulatoryConfidence.MEDIUM;
  return RegulatoryConfidence.LOW;
}

/**
 * Determine insider advantage level from score
 */
function getInsiderAdvantageLevel(score: number): InsiderAdvantageLevel {
  if (score >= 80) return InsiderAdvantageLevel.VERY_HIGH;
  if (score >= 60) return InsiderAdvantageLevel.HIGH;
  if (score >= 40) return InsiderAdvantageLevel.MEDIUM;
  return InsiderAdvantageLevel.LOW;
}

/**
 * Try to extract deadline dates from text
 */
function extractDeadlines(
  text: string,
  decisionTypes: RegulatoryDecisionType[],
  agency: RegulatoryAgency | null
): RegulatoryDeadline[] {
  const deadlines: RegulatoryDeadline[] = [];
  const normalizedText = normalizeText(text);

  // Common deadline patterns
  const deadlinePatterns = [
    /(?:deadline|decision|ruling|vote|approval|announcement)(?:\s+(?:is|on|by|expected|scheduled))?\s*(?:for\s+)?(\w+\s+\d{1,2},?\s+\d{4})/gi,
    /(\w+\s+\d{1,2},?\s+\d{4})(?:\s+deadline|\s+decision|\s+ruling|\s+vote)/gi,
    /(?:by|on|before)\s+(\w+\s+\d{1,2},?\s+\d{4})/gi,
    /pdufa\s+date:?\s*(\w+\s+\d{1,2},?\s+\d{4})/gi,
    /(?:q[1-4]\s+\d{4})/gi,
  ];

  for (const pattern of deadlinePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const dateStr = match[1] || match[0];
      let expectedDate: Date | null = null;

      try {
        // Try to parse the date
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          expectedDate = parsed;
        }
      } catch {
        // If parsing fails, leave as null
      }

      // Determine deadline type
      let deadlineType: RegulatoryDecisionType = RegulatoryDecisionType.GENERAL;
      const firstDecisionType = decisionTypes[0];
      if (firstDecisionType !== undefined) {
        deadlineType = firstDecisionType;
      } else if (normalizedText.includes("pdufa")) {
        deadlineType = RegulatoryDecisionType.APPROVAL;
      } else if (
        normalizedText.includes("comment") ||
        normalizedText.includes("public")
      ) {
        deadlineType = RegulatoryDecisionType.PUBLIC_COMMENT;
      }

      deadlines.push({
        description: `Regulatory deadline: ${dateStr}`,
        expectedDate,
        deadlineType,
        agency,
        extractedFromText: true,
      });
    }
  }

  return deadlines;
}

// ============================================================================
// Regulatory Decision Detector Class
// ============================================================================

/**
 * Cache entry for detection results
 */
interface CacheEntry {
  result: RegulatoryMarketResult;
  expiresAt: number;
}

/**
 * Regulatory Decision Detector
 *
 * Detects markets about regulatory decisions by government agencies
 * with detailed classification by agency, decision type, sector, and jurisdiction.
 */
export class RegulatoryDecisionDetector {
  private readonly config: Required<RegulatoryDecisionDetectorConfig>;
  private readonly keywords: RegulatoryKeyword[];
  private readonly cache: Map<string, CacheEntry> = new Map();
  private detectionCount = 0;
  private cacheHits = 0;

  constructor(config: RegulatoryDecisionDetectorConfig = {}) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      minRegulatoryScore:
        config.minRegulatoryScore ?? DEFAULT_MIN_REGULATORY_SCORE,
      debug: config.debug ?? false,
      additionalKeywords: config.additionalKeywords ?? [],
      classifier: config.classifier ?? getSharedMarketCategoryClassifier(),
    };

    // Combine default and additional keywords
    this.keywords = [
      ...DEFAULT_REGULATORY_KEYWORDS,
      ...this.config.additionalKeywords,
    ];
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(key: string): RegulatoryMarketResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.result, fromCache: true };
  }

  /**
   * Add to cache with TTL
   */
  private addToCache(key: string, result: RegulatoryMarketResult): void {
    // Evict oldest entries if at max size
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
   * Detect if a market is about regulatory decisions
   */
  detectMarket(
    market: MarketForRegulatoryDetection,
    options: DetectRegulatoryOptions = {}
  ): RegulatoryMarketResult {
    const {
      minRelevanceScore = this.config.minRegulatoryScore,
      detectEntities = true,
      extractDeadlines: shouldExtractDeadlines = true,
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

    this.detectionCount++;

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
    const normalizedText = normalizeText(fullText);

    // Calculate regulatory relevance
    let relevanceScore = 0;
    let insiderAdvantageScore = 0;
    const agencyTags: RegulatoryTag[] = [];
    const decisionTypeTags: RegulatoryTag[] = [];
    const sectorTags: RegulatoryTag[] = [];
    const jurisdictionTags: RegulatoryTag[] = [];
    const mentionedEntities: string[] = [];

    // Track matched items by type for deduplication
    const matchedAgencies = new Map<
      RegulatoryAgency,
      { score: number; keywords: string[] }
    >();
    const matchedDecisionTypes = new Map<
      RegulatoryDecisionType,
      { score: number; keywords: string[] }
    >();
    const matchedSectors = new Map<
      RegulatorySector,
      { score: number; keywords: string[] }
    >();
    const matchedJurisdictions = new Map<
      RegulatoryJurisdiction,
      { score: number; keywords: string[] }
    >();

    // Match keywords
    for (const keyword of this.keywords) {
      if (matchKeyword(fullText, normalizedText, keyword)) {
        relevanceScore += keyword.weight;
        insiderAdvantageScore += keyword.insiderWeight ?? 0;

        // Track agency triggers
        if (keyword.triggers.agencies) {
          for (const agency of keyword.triggers.agencies) {
            const existing = matchedAgencies.get(agency);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedAgencies.set(agency, {
                score: keyword.weight,
                keywords: [keyword.keyword],
              });
            }
          }
        }

        // Track decision type triggers
        if (keyword.triggers.decisionTypes) {
          for (const decisionType of keyword.triggers.decisionTypes) {
            const existing = matchedDecisionTypes.get(decisionType);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedDecisionTypes.set(decisionType, {
                score: keyword.weight,
                keywords: [keyword.keyword],
              });
            }
          }
        }

        // Track sector triggers
        if (keyword.triggers.sectors) {
          for (const sector of keyword.triggers.sectors) {
            const existing = matchedSectors.get(sector);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedSectors.set(sector, {
                score: keyword.weight,
                keywords: [keyword.keyword],
              });
            }
          }
        }

        // Track jurisdiction triggers
        if (keyword.triggers.jurisdictions) {
          for (const jurisdiction of keyword.triggers.jurisdictions) {
            const existing = matchedJurisdictions.get(jurisdiction);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedJurisdictions.set(jurisdiction, {
                score: keyword.weight,
                keywords: [keyword.keyword],
              });
            }
          }
        }

        // Track entities
        if (detectEntities && keyword.entities) {
          for (const entity of keyword.entities) {
            if (!mentionedEntities.includes(entity)) {
              mentionedEntities.push(entity);
            }
          }
        }
      }
    }

    // Cap scores at 100
    relevanceScore = Math.min(100, relevanceScore);
    insiderAdvantageScore = Math.min(100, insiderAdvantageScore);

    // Build agency tags
    for (const [agency, data] of matchedAgencies) {
      agencyTags.push({
        type: "agency",
        value: agency,
        confidence: getConfidenceLevel(data.score),
        confidenceScore: Math.min(100, data.score),
        triggerKeywords: data.keywords,
      });
    }

    // Build decision type tags
    for (const [decisionType, data] of matchedDecisionTypes) {
      decisionTypeTags.push({
        type: "decision_type",
        value: decisionType,
        confidence: getConfidenceLevel(data.score),
        confidenceScore: Math.min(100, data.score),
        triggerKeywords: data.keywords,
      });
    }

    // Build sector tags
    for (const [sector, data] of matchedSectors) {
      sectorTags.push({
        type: "sector",
        value: sector,
        confidence: getConfidenceLevel(data.score),
        confidenceScore: Math.min(100, data.score),
        triggerKeywords: data.keywords,
      });
    }

    // Build jurisdiction tags
    for (const [jurisdiction, data] of matchedJurisdictions) {
      jurisdictionTags.push({
        type: "jurisdiction",
        value: jurisdiction,
        confidence: getConfidenceLevel(data.score),
        confidenceScore: Math.min(100, data.score),
        triggerKeywords: data.keywords,
      });
    }

    // Sort tags by confidence score
    agencyTags.sort((a, b) => b.confidenceScore - a.confidenceScore);
    decisionTypeTags.sort((a, b) => b.confidenceScore - a.confidenceScore);
    sectorTags.sort((a, b) => b.confidenceScore - a.confidenceScore);
    jurisdictionTags.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Determine primary values
    const firstAgencyTag = agencyTags[0];
    const primaryAgency = firstAgencyTag
      ? (firstAgencyTag.value as RegulatoryAgency)
      : null;
    const firstDecisionTypeTag = decisionTypeTags[0];
    const primaryDecisionType = firstDecisionTypeTag
      ? (firstDecisionTypeTag.value as RegulatoryDecisionType)
      : null;
    const firstSectorTag = sectorTags[0];
    const primarySector = firstSectorTag
      ? (firstSectorTag.value as RegulatorySector)
      : null;
    const firstJurisdictionTag = jurisdictionTags[0];
    const primaryJurisdiction = firstJurisdictionTag
      ? (firstJurisdictionTag.value as RegulatoryJurisdiction)
      : null;

    // Combine all tags
    const allTags: RegulatoryTag[] = [
      ...agencyTags,
      ...decisionTypeTags,
      ...sectorTags,
      ...jurisdictionTags,
    ];

    // Extract deadlines if requested
    let deadlines: RegulatoryDeadline[] = [];
    if (shouldExtractDeadlines) {
      const decisionTypes = decisionTypeTags.map(
        (t) => t.value as RegulatoryDecisionType
      );
      deadlines = extractDeadlines(fullText, decisionTypes, primaryAgency);
    }

    // Determine if market is regulatory
    const isRegulatory = relevanceScore >= minRelevanceScore;

    const result: RegulatoryMarketResult = {
      marketId: market.id,
      question: market.question,
      isRegulatory,
      relevanceScore,
      primaryAgency,
      agencyTags,
      primaryDecisionType,
      decisionTypeTags,
      primarySector,
      sectorTags,
      primaryJurisdiction,
      jurisdictionTags,
      allTags,
      deadlines,
      insiderAdvantageLevel: getInsiderAdvantageLevel(insiderAdvantageScore),
      insiderAdvantageScore,
      mentionedEntities,
      detectedAt: new Date(),
      fromCache: false,
    };

    // Cache the result
    this.addToCache(cacheKey, result);

    return result;
  }

  /**
   * Detect multiple markets in batch
   */
  detectMarkets(
    markets: MarketForRegulatoryDetection[],
    options: DetectRegulatoryOptions = {}
  ): BatchRegulatoryDetectionResult {
    const startTime = Date.now();
    const results = new Map<string, RegulatoryMarketResult>();
    const errors = new Map<string, string>();

    // Track distributions
    const agencyDistribution = new Map<RegulatoryAgency, number>();
    const decisionTypeDistribution = new Map<RegulatoryDecisionType, number>();
    const sectorDistribution = new Map<RegulatorySector, number>();
    const jurisdictionDistribution = new Map<RegulatoryJurisdiction, number>();

    let regulatoryCount = 0;
    let highInsiderAdvantageCount = 0;

    for (const market of markets) {
      try {
        const result = this.detectMarket(market, options);
        results.set(market.id, result);

        if (result.isRegulatory) {
          regulatoryCount++;

          if (result.primaryAgency) {
            agencyDistribution.set(
              result.primaryAgency,
              (agencyDistribution.get(result.primaryAgency) || 0) + 1
            );
          }

          if (result.primaryDecisionType) {
            decisionTypeDistribution.set(
              result.primaryDecisionType,
              (decisionTypeDistribution.get(result.primaryDecisionType) || 0) +
                1
            );
          }

          if (result.primarySector) {
            sectorDistribution.set(
              result.primarySector,
              (sectorDistribution.get(result.primarySector) || 0) + 1
            );
          }

          if (result.primaryJurisdiction) {
            jurisdictionDistribution.set(
              result.primaryJurisdiction,
              (jurisdictionDistribution.get(result.primaryJurisdiction) || 0) +
                1
            );
          }

          if (
            result.insiderAdvantageLevel === InsiderAdvantageLevel.HIGH ||
            result.insiderAdvantageLevel === InsiderAdvantageLevel.VERY_HIGH
          ) {
            highInsiderAdvantageCount++;
          }
        }
      } catch (error) {
        errors.set(
          market.id,
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    }

    return {
      results,
      errors,
      totalProcessed: markets.length,
      regulatoryCount,
      highInsiderAdvantageCount,
      agencyDistribution,
      decisionTypeDistribution,
      sectorDistribution,
      jurisdictionDistribution,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a market is regulatory-related
   */
  isRegulatoryMarket(
    market: MarketForRegulatoryDetection,
    options: DetectRegulatoryOptions = {}
  ): boolean {
    return this.detectMarket(market, options).isRegulatory;
  }

  /**
   * Get regulatory markets from a batch
   */
  getRegulatoryMarkets(
    markets: MarketForRegulatoryDetection[],
    options: DetectRegulatoryOptions = {}
  ): RegulatoryMarketResult[] {
    const batchResult = this.detectMarkets(markets, options);
    return Array.from(batchResult.results.values()).filter(
      (r) => r.isRegulatory
    );
  }

  /**
   * Get markets by agency
   */
  getMarketsByAgency(
    markets: MarketForRegulatoryDetection[],
    agency: RegulatoryAgency,
    options: DetectRegulatoryOptions = {}
  ): RegulatoryMarketResult[] {
    const batchResult = this.detectMarkets(markets, options);
    return Array.from(batchResult.results.values()).filter(
      (r) => r.primaryAgency === agency || r.agencyTags.some((t) => t.value === agency)
    );
  }

  /**
   * Get markets by decision type
   */
  getMarketsByDecisionType(
    markets: MarketForRegulatoryDetection[],
    decisionType: RegulatoryDecisionType,
    options: DetectRegulatoryOptions = {}
  ): RegulatoryMarketResult[] {
    const batchResult = this.detectMarkets(markets, options);
    return Array.from(batchResult.results.values()).filter(
      (r) =>
        r.primaryDecisionType === decisionType ||
        r.decisionTypeTags.some((t) => t.value === decisionType)
    );
  }

  /**
   * Get markets by sector
   */
  getMarketsBySector(
    markets: MarketForRegulatoryDetection[],
    sector: RegulatorySector,
    options: DetectRegulatoryOptions = {}
  ): RegulatoryMarketResult[] {
    const batchResult = this.detectMarkets(markets, options);
    return Array.from(batchResult.results.values()).filter(
      (r) => r.primarySector === sector || r.sectorTags.some((t) => t.value === sector)
    );
  }

  /**
   * Get markets with high insider advantage potential
   */
  getHighInsiderAdvantageMarkets(
    markets: MarketForRegulatoryDetection[],
    options: DetectRegulatoryOptions = {}
  ): RegulatoryMarketResult[] {
    const batchResult = this.detectMarkets(markets, options);
    return Array.from(batchResult.results.values()).filter(
      (r) =>
        r.insiderAdvantageLevel === InsiderAdvantageLevel.HIGH ||
        r.insiderAdvantageLevel === InsiderAdvantageLevel.VERY_HIGH
    );
  }

  /**
   * Get summary statistics
   */
  getSummary(): RegulatoryDetectorSummary {
    const regulatoryResults: RegulatoryMarketResult[] = [];
    const agencyBreakdown = new Map<RegulatoryAgency, number>();
    const decisionTypeBreakdown = new Map<RegulatoryDecisionType, number>();
    const sectorBreakdown = new Map<RegulatorySector, number>();
    const jurisdictionBreakdown = new Map<RegulatoryJurisdiction, number>();
    let totalRelevanceScore = 0;
    let totalInsiderScore = 0;
    let highInsiderCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.result.isRegulatory) {
        regulatoryResults.push(entry.result);
        totalRelevanceScore += entry.result.relevanceScore;
        totalInsiderScore += entry.result.insiderAdvantageScore;

        if (entry.result.primaryAgency) {
          agencyBreakdown.set(
            entry.result.primaryAgency,
            (agencyBreakdown.get(entry.result.primaryAgency) || 0) + 1
          );
        }

        if (entry.result.primaryDecisionType) {
          decisionTypeBreakdown.set(
            entry.result.primaryDecisionType,
            (decisionTypeBreakdown.get(entry.result.primaryDecisionType) || 0) +
              1
          );
        }

        if (entry.result.primarySector) {
          sectorBreakdown.set(
            entry.result.primarySector,
            (sectorBreakdown.get(entry.result.primarySector) || 0) + 1
          );
        }

        if (entry.result.primaryJurisdiction) {
          jurisdictionBreakdown.set(
            entry.result.primaryJurisdiction,
            (jurisdictionBreakdown.get(entry.result.primaryJurisdiction) || 0) +
              1
          );
        }

        if (
          entry.result.insiderAdvantageLevel === InsiderAdvantageLevel.HIGH ||
          entry.result.insiderAdvantageLevel === InsiderAdvantageLevel.VERY_HIGH
        ) {
          highInsiderCount++;
        }
      }
    }

    const regulatoryCount = regulatoryResults.length;

    return {
      totalDetected: this.detectionCount,
      regulatoryMarketsCount: regulatoryCount,
      regulatoryPercentage:
        this.detectionCount > 0
          ? (regulatoryCount / this.detectionCount) * 100
          : 0,
      highInsiderAdvantageCount: highInsiderCount,
      agencyBreakdown,
      decisionTypeBreakdown,
      sectorBreakdown,
      jurisdictionBreakdown,
      averageRelevanceScore:
        regulatoryCount > 0 ? totalRelevanceScore / regulatoryCount : 0,
      averageInsiderAdvantageScore:
        regulatoryCount > 0 ? totalInsiderScore / regulatoryCount : 0,
      cacheHitRate:
        this.detectionCount > 0
          ? (this.cacheHits / this.detectionCount) * 100
          : 0,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the keywords in use
   */
  getKeywords(): RegulatoryKeyword[] {
    return [...this.keywords];
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.detectionCount = 0;
    this.cacheHits = 0;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let sharedDetector: RegulatoryDecisionDetector | null = null;

/**
 * Create a new RegulatoryDecisionDetector instance
 */
export function createRegulatoryDecisionDetector(
  config?: RegulatoryDecisionDetectorConfig
): RegulatoryDecisionDetector {
  return new RegulatoryDecisionDetector(config);
}

/**
 * Get the shared RegulatoryDecisionDetector instance
 */
export function getSharedRegulatoryDecisionDetector(): RegulatoryDecisionDetector {
  if (!sharedDetector) {
    sharedDetector = new RegulatoryDecisionDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared RegulatoryDecisionDetector instance
 */
export function setSharedRegulatoryDecisionDetector(
  detector: RegulatoryDecisionDetector
): void {
  sharedDetector = detector;
}

/**
 * Reset the shared RegulatoryDecisionDetector instance
 */
export function resetSharedRegulatoryDecisionDetector(): void {
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Detect if a single market is about regulatory decisions
 */
export function detectRegulatoryMarket(
  market: MarketForRegulatoryDetection,
  options?: DetectRegulatoryOptions
): RegulatoryMarketResult {
  return getSharedRegulatoryDecisionDetector().detectMarket(market, options);
}

/**
 * Detect regulatory markets in batch
 */
export function detectRegulatoryMarkets(
  markets: MarketForRegulatoryDetection[],
  options?: DetectRegulatoryOptions
): BatchRegulatoryDetectionResult {
  return getSharedRegulatoryDecisionDetector().detectMarkets(markets, options);
}

/**
 * Check if a market is regulatory-related
 */
export function isRegulatoryMarket(
  market: MarketForRegulatoryDetection,
  options?: DetectRegulatoryOptions
): boolean {
  return getSharedRegulatoryDecisionDetector().isRegulatoryMarket(
    market,
    options
  );
}

/**
 * Get regulatory markets from a batch
 */
export function getRegulatoryMarkets(
  markets: MarketForRegulatoryDetection[],
  options?: DetectRegulatoryOptions
): RegulatoryMarketResult[] {
  return getSharedRegulatoryDecisionDetector().getRegulatoryMarkets(
    markets,
    options
  );
}

/**
 * Get markets by agency
 */
export function getRegulatoryMarketsByAgency(
  markets: MarketForRegulatoryDetection[],
  agency: RegulatoryAgency,
  options?: DetectRegulatoryOptions
): RegulatoryMarketResult[] {
  return getSharedRegulatoryDecisionDetector().getMarketsByAgency(
    markets,
    agency,
    options
  );
}

/**
 * Get markets by decision type
 */
export function getRegulatoryMarketsByDecisionType(
  markets: MarketForRegulatoryDetection[],
  decisionType: RegulatoryDecisionType,
  options?: DetectRegulatoryOptions
): RegulatoryMarketResult[] {
  return getSharedRegulatoryDecisionDetector().getMarketsByDecisionType(
    markets,
    decisionType,
    options
  );
}

/**
 * Get markets by sector
 */
export function getRegulatoryMarketsBySector(
  markets: MarketForRegulatoryDetection[],
  sector: RegulatorySector,
  options?: DetectRegulatoryOptions
): RegulatoryMarketResult[] {
  return getSharedRegulatoryDecisionDetector().getMarketsBySector(
    markets,
    sector,
    options
  );
}

/**
 * Get markets with high insider advantage
 */
export function getHighInsiderAdvantageRegulatoryMarkets(
  markets: MarketForRegulatoryDetection[],
  options?: DetectRegulatoryOptions
): RegulatoryMarketResult[] {
  return getSharedRegulatoryDecisionDetector().getHighInsiderAdvantageMarkets(
    markets,
    options
  );
}

/**
 * Get summary statistics
 */
export function getRegulatoryDetectorSummary(): RegulatoryDetectorSummary {
  return getSharedRegulatoryDecisionDetector().getSummary();
}
