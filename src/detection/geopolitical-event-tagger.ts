/**
 * Geopolitical Event Market Tagger (DET-NICHE-003)
 *
 * Tag markets related to geopolitical events with detailed classification.
 *
 * Features:
 * - Define comprehensive geopolitical keyword taxonomy
 * - Parse market metadata (title, description, tags)
 * - Apply granular geopolitical tags (regions, event types, actors)
 * - Link related markets based on shared geopolitical context
 * - Track evolving geopolitical situations
 * - Support for multi-region and multi-event tagging
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
 * Geopolitical region classification
 */
export enum GeopoliticalRegion {
  /** Eastern Europe (Ukraine, Belarus, Moldova, etc.) */
  EASTERN_EUROPE = "EASTERN_EUROPE",
  /** Western Europe (EU core, UK, etc.) */
  WESTERN_EUROPE = "WESTERN_EUROPE",
  /** Middle East and North Africa */
  MENA = "MENA",
  /** East Asia (China, Japan, Korea, Taiwan) */
  EAST_ASIA = "EAST_ASIA",
  /** South Asia (India, Pakistan, etc.) */
  SOUTH_ASIA = "SOUTH_ASIA",
  /** Southeast Asia */
  SOUTHEAST_ASIA = "SOUTHEAST_ASIA",
  /** North America (US, Canada, Mexico) */
  NORTH_AMERICA = "NORTH_AMERICA",
  /** Latin America */
  LATIN_AMERICA = "LATIN_AMERICA",
  /** Sub-Saharan Africa */
  SUB_SAHARAN_AFRICA = "SUB_SAHARAN_AFRICA",
  /** Central Asia */
  CENTRAL_ASIA = "CENTRAL_ASIA",
  /** Russia and former Soviet states */
  RUSSIA_FSU = "RUSSIA_FSU",
  /** Oceania (Australia, Pacific) */
  OCEANIA = "OCEANIA",
  /** Arctic region */
  ARCTIC = "ARCTIC",
  /** Global/Multi-regional */
  GLOBAL = "GLOBAL",
}

/**
 * Types of geopolitical events
 */
export enum GeopoliticalEventType {
  /** Armed conflict or war */
  ARMED_CONFLICT = "ARMED_CONFLICT",
  /** International sanctions */
  SANCTIONS = "SANCTIONS",
  /** Diplomatic negotiations or treaties */
  DIPLOMACY = "DIPLOMACY",
  /** Military exercises or deployments */
  MILITARY_ACTIVITY = "MILITARY_ACTIVITY",
  /** Territorial disputes */
  TERRITORIAL_DISPUTE = "TERRITORIAL_DISPUTE",
  /** Nuclear or WMD related */
  NUCLEAR_WMD = "NUCLEAR_WMD",
  /** Trade war or economic conflict */
  TRADE_CONFLICT = "TRADE_CONFLICT",
  /** Cyber warfare or attacks */
  CYBER_WARFARE = "CYBER_WARFARE",
  /** Refugee or migration crisis */
  MIGRATION_CRISIS = "MIGRATION_CRISIS",
  /** Energy or resource conflict */
  ENERGY_RESOURCES = "ENERGY_RESOURCES",
  /** International organization actions */
  INTERNATIONAL_ORG = "INTERNATIONAL_ORG",
  /** Regime change or political transition */
  REGIME_CHANGE = "REGIME_CHANGE",
  /** Human rights issues */
  HUMAN_RIGHTS = "HUMAN_RIGHTS",
  /** Alliance or bloc dynamics */
  ALLIANCE_DYNAMICS = "ALLIANCE_DYNAMICS",
  /** Border incidents */
  BORDER_INCIDENT = "BORDER_INCIDENT",
  /** General geopolitical */
  GENERAL = "GENERAL",
}

/**
 * Key geopolitical actors (countries/organizations)
 */
export enum GeopoliticalActor {
  // Major Powers
  UNITED_STATES = "UNITED_STATES",
  RUSSIA = "RUSSIA",
  CHINA = "CHINA",
  EUROPEAN_UNION = "EUROPEAN_UNION",
  UNITED_KINGDOM = "UNITED_KINGDOM",

  // Regional Powers
  INDIA = "INDIA",
  JAPAN = "JAPAN",
  GERMANY = "GERMANY",
  FRANCE = "FRANCE",
  TURKEY = "TURKEY",
  IRAN = "IRAN",
  SAUDI_ARABIA = "SAUDI_ARABIA",
  ISRAEL = "ISRAEL",
  SOUTH_KOREA = "SOUTH_KOREA",
  BRAZIL = "BRAZIL",

  // Conflict Parties
  UKRAINE = "UKRAINE",
  TAIWAN = "TAIWAN",
  NORTH_KOREA = "NORTH_KOREA",
  PALESTINE = "PALESTINE",
  SYRIA = "SYRIA",

  // International Organizations
  NATO = "NATO",
  UNITED_NATIONS = "UNITED_NATIONS",
  G7 = "G7",
  G20 = "G20",
  BRICS = "BRICS",
  OPEC = "OPEC",

  // Other significant actors
  OTHER = "OTHER",
}

/**
 * Confidence level for geopolitical tag assignment
 */
export enum TagConfidence {
  /** Very high confidence - explicit mention */
  VERY_HIGH = "VERY_HIGH",
  /** High confidence - strong contextual signals */
  HIGH = "HIGH",
  /** Medium confidence - moderate signals */
  MEDIUM = "MEDIUM",
  /** Low confidence - weak or indirect signals */
  LOW = "LOW",
}

/**
 * A single geopolitical tag
 */
export interface GeopoliticalTag {
  /** Type of tag (region, event, actor) */
  type: "region" | "event_type" | "actor";
  /** The specific tag value */
  value: GeopoliticalRegion | GeopoliticalEventType | GeopoliticalActor;
  /** Confidence in this tag assignment */
  confidence: TagConfidence;
  /** Confidence score (0-100) */
  confidenceScore: number;
  /** Keywords that triggered this tag */
  triggerKeywords: string[];
}

/**
 * Result of tagging a market
 */
export interface GeopoliticalTagResult {
  /** Market ID */
  marketId: string;
  /** Market question for reference */
  question: string;
  /** Whether this market is geopolitically relevant */
  isGeopolitical: boolean;
  /** Overall geopolitical relevance score (0-100) */
  relevanceScore: number;
  /** Primary region (if applicable) */
  primaryRegion: GeopoliticalRegion | null;
  /** All assigned region tags */
  regionTags: GeopoliticalTag[];
  /** Primary event type (if applicable) */
  primaryEventType: GeopoliticalEventType | null;
  /** All assigned event type tags */
  eventTypeTags: GeopoliticalTag[];
  /** Primary actor (if applicable) */
  primaryActor: GeopoliticalActor | null;
  /** All assigned actor tags */
  actorTags: GeopoliticalTag[];
  /** All tags combined */
  allTags: GeopoliticalTag[];
  /** IDs of related markets (same geopolitical context) */
  relatedMarketIds: string[];
  /** Situation/conflict identifier for grouping */
  situationId: string | null;
  /** Timestamp of tagging */
  taggedAt: Date;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Market data for geopolitical tagging
 */
export interface MarketForGeopoliticalTagging {
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
  /** Pre-existing classification result (optional) */
  classificationResult?: MarketClassificationResult;
}

/**
 * Keyword pattern for geopolitical tagging
 */
export interface GeopoliticalKeyword {
  /** The keyword or phrase to match */
  keyword: string;
  /** Weight for scoring */
  weight: number;
  /** Tags this keyword triggers */
  triggers: {
    regions?: GeopoliticalRegion[];
    eventTypes?: GeopoliticalEventType[];
    actors?: GeopoliticalActor[];
  };
  /** Whether this is an exact word boundary match */
  exactMatch?: boolean;
  /** Additional context required for this keyword */
  requiredContext?: string[];
  /** Keywords that exclude this match */
  excludeIfPresent?: string[];
}

/**
 * A known geopolitical situation/conflict for grouping related markets
 */
export interface GeopoliticalSituation {
  /** Unique identifier for this situation */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the situation */
  description: string;
  /** Regions involved */
  regions: GeopoliticalRegion[];
  /** Actors involved */
  actors: GeopoliticalActor[];
  /** Event types associated */
  eventTypes: GeopoliticalEventType[];
  /** Keywords that identify this situation */
  identifyingKeywords: string[];
  /** Start date of the situation */
  startDate?: Date;
  /** Whether the situation is ongoing */
  isOngoing: boolean;
}

/**
 * Options for tagging
 */
export interface TagMarketOptions {
  /** Minimum relevance score to be considered geopolitical */
  minRelevanceScore?: number;
  /** Whether to find related markets */
  findRelatedMarkets?: boolean;
  /** Bypass cache */
  bypassCache?: boolean;
  /** Include situation assignment */
  assignSituation?: boolean;
}

/**
 * Batch tagging result
 */
export interface BatchTaggingResult {
  /** Successful tagging results by market ID */
  results: Map<string, GeopoliticalTagResult>;
  /** Failed market IDs with error messages */
  errors: Map<string, string>;
  /** Total markets processed */
  totalProcessed: number;
  /** Number of geopolitical markets */
  geopoliticalCount: number;
  /** Region distribution */
  regionDistribution: Map<GeopoliticalRegion, number>;
  /** Event type distribution */
  eventTypeDistribution: Map<GeopoliticalEventType, number>;
  /** Actor distribution */
  actorDistribution: Map<GeopoliticalActor, number>;
  /** Situation distribution */
  situationDistribution: Map<string, number>;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for the tagger
 */
export interface TaggerSummary {
  /** Total markets tagged */
  totalTagged: number;
  /** Number of geopolitical markets */
  geopoliticalMarketsCount: number;
  /** Percentage of markets that are geopolitical */
  geopoliticalPercentage: number;
  /** Region breakdown */
  regionBreakdown: Map<GeopoliticalRegion, number>;
  /** Event type breakdown */
  eventTypeBreakdown: Map<GeopoliticalEventType, number>;
  /** Actor breakdown */
  actorBreakdown: Map<GeopoliticalActor, number>;
  /** Average relevance score for geopolitical markets */
  averageRelevanceScore: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Active situations */
  activeSituations: number;
}

/**
 * Configuration for the geopolitical tagger
 */
export interface GeopoliticalEventTaggerConfig {
  /** Cache TTL in milliseconds (default: 12 hours) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 10000) */
  maxCacheSize?: number;
  /** Minimum score to consider geopolitical (default: 15) */
  minGeopoliticalScore?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom keywords (extends defaults) */
  additionalKeywords?: GeopoliticalKeyword[];
  /** Custom situations */
  additionalSituations?: GeopoliticalSituation[];
  /** Reference to market classifier (optional) */
  classifier?: MarketCategoryClassifier;
}

// ============================================================================
// Constants - Geopolitical Keywords
// ============================================================================

/**
 * Default cache TTL: 12 hours
 */
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Default minimum score to be considered geopolitical
 */
const DEFAULT_MIN_GEOPOLITICAL_SCORE = 15;

/**
 * Default maximum cache size
 */
const DEFAULT_MAX_CACHE_SIZE = 10000;

/**
 * Default geopolitical keywords organized by category
 */
export const DEFAULT_GEOPOLITICAL_KEYWORDS: GeopoliticalKeyword[] = [
  // ==== Conflict Keywords ====
  {
    keyword: "war",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
    excludeIfPresent: ["star wars", "console war", "browser war"],
  },
  {
    keyword: "invasion",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "military",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.MILITARY_ACTIVITY] },
  },
  {
    keyword: "conflict",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "ceasefire",
    weight: 12,
    triggers: {
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT, GeopoliticalEventType.DIPLOMACY],
    },
  },
  {
    keyword: "peace talks",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "peace deal",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "truce",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "combat",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "troops",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.MILITARY_ACTIVITY] },
  },
  {
    keyword: "soldiers",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.MILITARY_ACTIVITY] },
  },
  {
    keyword: "offensive",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
    requiredContext: ["military", "war", "ukraine", "russia", "attack"],
  },
  {
    keyword: "counteroffensive",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "airstrike",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "bombing",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "casualties",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT] },
  },

  // ==== Sanctions and Economic Warfare ====
  {
    keyword: "sanction",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.SANCTIONS] },
  },
  {
    keyword: "sanctions",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.SANCTIONS] },
  },
  {
    keyword: "embargo",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.SANCTIONS] },
  },
  {
    keyword: "tariff",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.TRADE_CONFLICT] },
  },
  {
    keyword: "trade war",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.TRADE_CONFLICT] },
  },
  {
    keyword: "economic sanctions",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.SANCTIONS] },
  },
  {
    keyword: "asset freeze",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.SANCTIONS] },
  },
  {
    keyword: "swift ban",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.SANCTIONS] },
  },

  // ==== Nuclear and WMD ====
  {
    keyword: "nuclear",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
    excludeIfPresent: ["nuclear family", "nuclear energy plant"],
  },
  {
    keyword: "atomic",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "missile",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.MILITARY_ACTIVITY, GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "icbm",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "ballistic",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD, GeopoliticalEventType.MILITARY_ACTIVITY] },
  },
  {
    keyword: "warhead",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "uranium",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "enrichment",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
    requiredContext: ["nuclear", "uranium", "iran"],
  },
  {
    keyword: "nonproliferation",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "chemical weapon",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },
  {
    keyword: "biological weapon",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.NUCLEAR_WMD] },
  },

  // ==== Territory and Borders ====
  {
    keyword: "territory",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "territorial",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "annex",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "annexation",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "occupation",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "sovereignty",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "border dispute",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.BORDER_INCIDENT] },
  },
  {
    keyword: "border clash",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.BORDER_INCIDENT] },
  },
  {
    keyword: "disputed territory",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE] },
  },
  {
    keyword: "independence",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE, GeopoliticalEventType.REGIME_CHANGE] },
    requiredContext: ["referendum", "declare", "vote", "region"],
  },

  // ==== Diplomacy ====
  {
    keyword: "diplomat",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "diplomatic",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "embassy",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "treaty",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "summit",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "bilateral",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "multilateral",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "negotiation",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "normalize relations",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },
  {
    keyword: "expel diplomat",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.DIPLOMACY] },
  },

  // ==== International Organizations ====
  {
    keyword: "nato",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.NATO],
      eventTypes: [GeopoliticalEventType.ALLIANCE_DYNAMICS],
    },
  },
  {
    keyword: "united nations",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.UNITED_NATIONS],
      eventTypes: [GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },
  {
    keyword: "un security council",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.UNITED_NATIONS],
      eventTypes: [GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },
  {
    keyword: "european union",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.EUROPEAN_UNION],
      regions: [GeopoliticalRegion.WESTERN_EUROPE],
    },
  },
  {
    keyword: "g7",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.G7],
      eventTypes: [GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },
  {
    keyword: "g20",
    weight: 8,
    triggers: {
      actors: [GeopoliticalActor.G20],
      eventTypes: [GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },
  {
    keyword: "brics",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.BRICS],
      eventTypes: [GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },
  {
    keyword: "opec",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.OPEC],
      eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES],
    },
  },

  // ==== Countries and Regions - Eastern Europe ====
  {
    keyword: "ukraine",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
    },
  },
  {
    keyword: "kyiv",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
    },
  },
  {
    keyword: "kiev",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
    },
  },
  {
    keyword: "zelensky",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
    },
  },
  {
    keyword: "donbas",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
      eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE],
    },
  },
  {
    keyword: "crimea",
    weight: 12,
    triggers: {
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
      eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE],
    },
  },
  {
    keyword: "kherson",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
    },
  },
  {
    keyword: "bakhmut",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.UKRAINE],
      regions: [GeopoliticalRegion.EASTERN_EUROPE],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },

  // ==== Russia ====
  {
    keyword: "russia",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.RUSSIA],
      regions: [GeopoliticalRegion.RUSSIA_FSU],
    },
  },
  {
    keyword: "russian",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.RUSSIA],
      regions: [GeopoliticalRegion.RUSSIA_FSU],
    },
  },
  {
    keyword: "putin",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.RUSSIA],
      regions: [GeopoliticalRegion.RUSSIA_FSU],
    },
  },
  {
    keyword: "kremlin",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.RUSSIA],
      regions: [GeopoliticalRegion.RUSSIA_FSU],
    },
  },
  {
    keyword: "moscow",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.RUSSIA],
      regions: [GeopoliticalRegion.RUSSIA_FSU],
    },
  },
  {
    keyword: "wagner",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.RUSSIA],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },

  // ==== China ====
  {
    keyword: "china",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.CHINA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "chinese",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.CHINA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "beijing",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.CHINA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "xi jinping",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.CHINA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "ccp",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.CHINA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "pla",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.CHINA],
      eventTypes: [GeopoliticalEventType.MILITARY_ACTIVITY],
    },
  },

  // ==== Taiwan ====
  {
    keyword: "taiwan",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.TAIWAN],
      regions: [GeopoliticalRegion.EAST_ASIA],
      eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE],
    },
  },
  {
    keyword: "taiwanese",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.TAIWAN],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "taipei",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.TAIWAN],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "taiwan strait",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.TAIWAN, GeopoliticalActor.CHINA],
      regions: [GeopoliticalRegion.EAST_ASIA],
      eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE],
    },
  },

  // ==== Middle East ====
  {
    keyword: "israel",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.ISRAEL],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "israeli",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.ISRAEL],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "gaza",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.PALESTINE],
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },
  {
    keyword: "hamas",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.PALESTINE],
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },
  {
    keyword: "palestine",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.PALESTINE],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "palestinian",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.PALESTINE],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "west bank",
    weight: 12,
    triggers: {
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE],
    },
  },
  {
    keyword: "netanyahu",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.ISRAEL],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "iran",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.IRAN],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "iranian",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.IRAN],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "tehran",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.IRAN],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "hezbollah",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.IRAN],
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },
  {
    keyword: "saudi",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.SAUDI_ARABIA],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "saudi arabia",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.SAUDI_ARABIA],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "syria",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.SYRIA],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "yemen",
    weight: 10,
    triggers: {
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },
  {
    keyword: "houthi",
    weight: 12,
    triggers: {
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.ARMED_CONFLICT],
    },
  },
  {
    keyword: "red sea",
    weight: 10,
    triggers: {
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.TRADE_CONFLICT],
    },
  },

  // ==== Korea ====
  {
    keyword: "north korea",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.NORTH_KOREA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "dprk",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.NORTH_KOREA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "pyongyang",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.NORTH_KOREA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "kim jong un",
    weight: 15,
    triggers: {
      actors: [GeopoliticalActor.NORTH_KOREA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "south korea",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.SOUTH_KOREA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "seoul",
    weight: 8,
    triggers: {
      actors: [GeopoliticalActor.SOUTH_KOREA],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "korean peninsula",
    weight: 12,
    triggers: {
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
  },
  {
    keyword: "dmz",
    weight: 12,
    triggers: {
      regions: [GeopoliticalRegion.EAST_ASIA],
      eventTypes: [GeopoliticalEventType.BORDER_INCIDENT],
    },
  },

  // ==== Other Major Powers ====
  {
    keyword: "united states",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.UNITED_STATES],
      regions: [GeopoliticalRegion.NORTH_AMERICA],
    },
  },
  {
    keyword: "u.s.",
    weight: 8,
    triggers: {
      actors: [GeopoliticalActor.UNITED_STATES],
      regions: [GeopoliticalRegion.NORTH_AMERICA],
    },
  },
  {
    keyword: "washington",
    weight: 6,
    triggers: {
      actors: [GeopoliticalActor.UNITED_STATES],
    },
    requiredContext: ["foreign", "policy", "summit", "diplomatic", "sanction"],
  },
  {
    keyword: "india",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.INDIA],
      regions: [GeopoliticalRegion.SOUTH_ASIA],
    },
  },
  {
    keyword: "pakistan",
    weight: 10,
    triggers: {
      regions: [GeopoliticalRegion.SOUTH_ASIA],
    },
  },
  {
    keyword: "kashmir",
    weight: 12,
    triggers: {
      regions: [GeopoliticalRegion.SOUTH_ASIA],
      eventTypes: [GeopoliticalEventType.TERRITORIAL_DISPUTE],
    },
  },
  {
    keyword: "japan",
    weight: 8,
    triggers: {
      actors: [GeopoliticalActor.JAPAN],
      regions: [GeopoliticalRegion.EAST_ASIA],
    },
    requiredContext: ["china", "north korea", "military", "defense", "us"],
  },
  {
    keyword: "turkey",
    weight: 10,
    triggers: {
      actors: [GeopoliticalActor.TURKEY],
      regions: [GeopoliticalRegion.MENA],
    },
  },
  {
    keyword: "erdogan",
    weight: 12,
    triggers: {
      actors: [GeopoliticalActor.TURKEY],
    },
  },

  // ==== Cyber and Hybrid Warfare ====
  {
    keyword: "cyberattack",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.CYBER_WARFARE] },
  },
  {
    keyword: "cyber warfare",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.CYBER_WARFARE] },
  },
  {
    keyword: "state-sponsored hack",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.CYBER_WARFARE] },
  },
  {
    keyword: "election interference",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.CYBER_WARFARE] },
  },
  {
    keyword: "disinformation",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.CYBER_WARFARE] },
  },
  {
    keyword: "propaganda",
    weight: 6,
    triggers: { eventTypes: [GeopoliticalEventType.CYBER_WARFARE] },
  },

  // ==== Energy and Resources ====
  {
    keyword: "oil price",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES] },
  },
  {
    keyword: "gas pipeline",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES] },
  },
  {
    keyword: "nord stream",
    weight: 15,
    triggers: {
      eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES],
      actors: [GeopoliticalActor.RUSSIA],
      regions: [GeopoliticalRegion.WESTERN_EUROPE],
    },
  },
  {
    keyword: "energy crisis",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES] },
  },
  {
    keyword: "oil embargo",
    weight: 15,
    triggers: {
      eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES, GeopoliticalEventType.SANCTIONS],
    },
  },
  {
    keyword: "lng",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES] },
  },
  {
    keyword: "strait of hormuz",
    weight: 15,
    triggers: {
      regions: [GeopoliticalRegion.MENA],
      eventTypes: [GeopoliticalEventType.ENERGY_RESOURCES],
    },
  },

  // ==== Migration and Refugees ====
  {
    keyword: "refugee",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.MIGRATION_CRISIS] },
  },
  {
    keyword: "migrants",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.MIGRATION_CRISIS] },
  },
  {
    keyword: "asylum",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.MIGRATION_CRISIS] },
  },
  {
    keyword: "border crisis",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.MIGRATION_CRISIS] },
  },
  {
    keyword: "humanitarian crisis",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.MIGRATION_CRISIS, GeopoliticalEventType.HUMAN_RIGHTS] },
  },

  // ==== Human Rights ====
  {
    keyword: "human rights",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.HUMAN_RIGHTS] },
  },
  {
    keyword: "war crimes",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.HUMAN_RIGHTS, GeopoliticalEventType.ARMED_CONFLICT] },
  },
  {
    keyword: "genocide",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.HUMAN_RIGHTS] },
  },
  {
    keyword: "ethnic cleansing",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.HUMAN_RIGHTS] },
  },
  {
    keyword: "icc",
    weight: 12,
    triggers: {
      eventTypes: [GeopoliticalEventType.HUMAN_RIGHTS, GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },
  {
    keyword: "international criminal court",
    weight: 12,
    triggers: {
      eventTypes: [GeopoliticalEventType.HUMAN_RIGHTS, GeopoliticalEventType.INTERNATIONAL_ORG],
    },
  },

  // ==== Regime Change ====
  {
    keyword: "coup",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.REGIME_CHANGE] },
  },
  {
    keyword: "regime change",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.REGIME_CHANGE] },
  },
  {
    keyword: "overthrow",
    weight: 12,
    triggers: { eventTypes: [GeopoliticalEventType.REGIME_CHANGE] },
  },
  {
    keyword: "revolution",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.REGIME_CHANGE] },
  },
  {
    keyword: "uprising",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.REGIME_CHANGE] },
  },
  {
    keyword: "civil war",
    weight: 15,
    triggers: { eventTypes: [GeopoliticalEventType.ARMED_CONFLICT, GeopoliticalEventType.REGIME_CHANGE] },
  },

  // ==== General Geopolitical Terms ====
  {
    keyword: "geopolitical",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.GENERAL] },
  },
  {
    keyword: "international relations",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.GENERAL] },
  },
  {
    keyword: "foreign policy",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.GENERAL] },
  },
  {
    keyword: "superpower",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.GENERAL] },
  },
  {
    keyword: "global order",
    weight: 10,
    triggers: { eventTypes: [GeopoliticalEventType.GENERAL] },
  },
  {
    keyword: "alliance",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.ALLIANCE_DYNAMICS] },
  },
  {
    keyword: "bloc",
    weight: 8,
    triggers: { eventTypes: [GeopoliticalEventType.ALLIANCE_DYNAMICS] },
    requiredContext: ["eastern", "western", "nato", "russia", "china"],
  },
];

/**
 * Known geopolitical situations for market grouping
 */
export const DEFAULT_GEOPOLITICAL_SITUATIONS: GeopoliticalSituation[] = [
  {
    id: "russia-ukraine-war",
    name: "Russia-Ukraine War",
    description: "Armed conflict between Russia and Ukraine that began in February 2022",
    regions: [GeopoliticalRegion.EASTERN_EUROPE, GeopoliticalRegion.RUSSIA_FSU],
    actors: [GeopoliticalActor.RUSSIA, GeopoliticalActor.UKRAINE, GeopoliticalActor.NATO],
    eventTypes: [
      GeopoliticalEventType.ARMED_CONFLICT,
      GeopoliticalEventType.SANCTIONS,
      GeopoliticalEventType.TERRITORIAL_DISPUTE,
    ],
    identifyingKeywords: [
      "ukraine", "russia", "putin", "zelensky", "kyiv", "kiev",
      "donbas", "crimea", "kherson", "bakhmut", "wagner",
      "russian invasion", "ukraine war",
    ],
    startDate: new Date("2022-02-24"),
    isOngoing: true,
  },
  {
    id: "israel-hamas-conflict",
    name: "Israel-Hamas Conflict",
    description: "Armed conflict between Israel and Hamas in Gaza",
    regions: [GeopoliticalRegion.MENA],
    actors: [GeopoliticalActor.ISRAEL, GeopoliticalActor.PALESTINE],
    eventTypes: [
      GeopoliticalEventType.ARMED_CONFLICT,
      GeopoliticalEventType.HUMAN_RIGHTS,
      GeopoliticalEventType.TERRITORIAL_DISPUTE,
    ],
    identifyingKeywords: [
      "israel", "gaza", "hamas", "netanyahu",
      "west bank", "palestinian", "idf", "tel aviv",
    ],
    startDate: new Date("2023-10-07"),
    isOngoing: true,
  },
  {
    id: "china-taiwan-tensions",
    name: "China-Taiwan Tensions",
    description: "Cross-strait tensions between China and Taiwan",
    regions: [GeopoliticalRegion.EAST_ASIA],
    actors: [GeopoliticalActor.CHINA, GeopoliticalActor.TAIWAN, GeopoliticalActor.UNITED_STATES],
    eventTypes: [
      GeopoliticalEventType.TERRITORIAL_DISPUTE,
      GeopoliticalEventType.MILITARY_ACTIVITY,
      GeopoliticalEventType.DIPLOMACY,
    ],
    identifyingKeywords: [
      "taiwan", "china", "taipei", "beijing",
      "taiwan strait", "one china", "reunification",
      "pla", "tsai ing-wen",
    ],
    isOngoing: true,
  },
  {
    id: "north-korea-nuclear",
    name: "North Korea Nuclear Program",
    description: "North Korea's nuclear weapons and missile program",
    regions: [GeopoliticalRegion.EAST_ASIA],
    actors: [
      GeopoliticalActor.NORTH_KOREA,
      GeopoliticalActor.SOUTH_KOREA,
      GeopoliticalActor.UNITED_STATES,
      GeopoliticalActor.JAPAN,
    ],
    eventTypes: [
      GeopoliticalEventType.NUCLEAR_WMD,
      GeopoliticalEventType.SANCTIONS,
      GeopoliticalEventType.DIPLOMACY,
    ],
    identifyingKeywords: [
      "north korea", "dprk", "pyongyang", "kim jong un",
      "korean peninsula", "dmz", "icbm", "nuclear test",
    ],
    isOngoing: true,
  },
  {
    id: "iran-nuclear-deal",
    name: "Iran Nuclear Negotiations",
    description: "Negotiations over Iran's nuclear program",
    regions: [GeopoliticalRegion.MENA],
    actors: [GeopoliticalActor.IRAN, GeopoliticalActor.UNITED_STATES, GeopoliticalActor.EUROPEAN_UNION],
    eventTypes: [
      GeopoliticalEventType.NUCLEAR_WMD,
      GeopoliticalEventType.DIPLOMACY,
      GeopoliticalEventType.SANCTIONS,
    ],
    identifyingKeywords: [
      "iran", "tehran", "jcpoa", "nuclear deal",
      "uranium enrichment", "iaea",
    ],
    isOngoing: true,
  },
  {
    id: "us-china-competition",
    name: "US-China Strategic Competition",
    description: "Great power competition between US and China",
    regions: [GeopoliticalRegion.GLOBAL, GeopoliticalRegion.EAST_ASIA],
    actors: [GeopoliticalActor.UNITED_STATES, GeopoliticalActor.CHINA],
    eventTypes: [
      GeopoliticalEventType.TRADE_CONFLICT,
      GeopoliticalEventType.CYBER_WARFARE,
      GeopoliticalEventType.ALLIANCE_DYNAMICS,
    ],
    identifyingKeywords: [
      "us-china", "sino-american", "trade war",
      "decoupling", "chip war", "semiconductor",
      "spy balloon",
    ],
    isOngoing: true,
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
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a keyword matches in text
 */
function matchKeyword(
  text: string,
  normalizedText: string,
  keyword: GeopoliticalKeyword
): boolean {
  const keywordLower = keyword.keyword.toLowerCase();

  // Check exclusion words
  if (keyword.excludeIfPresent) {
    for (const exclude of keyword.excludeIfPresent) {
      if (normalizedText.includes(exclude.toLowerCase())) {
        return false;
      }
    }
  }

  // Check required context
  if (keyword.requiredContext && keyword.requiredContext.length > 0) {
    const hasContext = keyword.requiredContext.some((ctx) =>
      normalizedText.includes(ctx.toLowerCase())
    );
    if (!hasContext) {
      return false;
    }
  }

  // Perform the match
  if (keyword.exactMatch) {
    const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, "i");
    return regex.test(text);
  }

  return normalizedText.includes(keywordLower);
}

/**
 * Get confidence level from score
 */
function getTagConfidence(score: number): TagConfidence {
  if (score >= 80) return TagConfidence.VERY_HIGH;
  if (score >= 60) return TagConfidence.HIGH;
  if (score >= 40) return TagConfidence.MEDIUM;
  return TagConfidence.LOW;
}

// ============================================================================
// Geopolitical Event Tagger Class
// ============================================================================

/**
 * Cache entry for tagging results
 */
interface CacheEntry {
  result: GeopoliticalTagResult;
  expiresAt: number;
}

/**
 * Geopolitical Event Market Tagger
 *
 * Tags markets with detailed geopolitical metadata including regions,
 * event types, actors, and links to related markets.
 */
export class GeopoliticalEventTagger {
  private readonly config: Required<GeopoliticalEventTaggerConfig>;
  private readonly keywords: GeopoliticalKeyword[];
  private readonly situations: GeopoliticalSituation[];
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly marketSituationMap: Map<string, string> = new Map();
  private readonly situationMarketsMap: Map<string, Set<string>> = new Map();
  private tagCount = 0;
  private cacheHits = 0;

  constructor(config: GeopoliticalEventTaggerConfig = {}) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      minGeopoliticalScore: config.minGeopoliticalScore ?? DEFAULT_MIN_GEOPOLITICAL_SCORE,
      debug: config.debug ?? false,
      additionalKeywords: config.additionalKeywords ?? [],
      additionalSituations: config.additionalSituations ?? [],
      classifier: config.classifier ?? getSharedMarketCategoryClassifier(),
    };

    // Combine default and additional keywords
    this.keywords = [...DEFAULT_GEOPOLITICAL_KEYWORDS, ...this.config.additionalKeywords];

    // Combine default and additional situations
    this.situations = [...DEFAULT_GEOPOLITICAL_SITUATIONS, ...this.config.additionalSituations];

    // Initialize situation maps
    for (const situation of this.situations) {
      this.situationMarketsMap.set(situation.id, new Set());
    }

    // Note: classifier is available in config for future integration with market classification
  }

  /**
   * Tag a single market with geopolitical metadata
   */
  tagMarket(
    market: MarketForGeopoliticalTagging,
    options: TagMarketOptions = {}
  ): GeopoliticalTagResult {
    const {
      minRelevanceScore = this.config.minGeopoliticalScore,
      findRelatedMarkets = true,
      bypassCache = false,
      assignSituation = true,
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

    // Build text to analyze
    const textParts = [market.question];
    if (market.description) textParts.push(market.description);
    if (market.slug) textParts.push(market.slug.replace(/-/g, " "));
    if (market.tags) textParts.push(market.tags.join(" "));

    const fullText = textParts.join(" ");
    const normalizedText = normalizeText(fullText);

    // Score and collect tags
    const regionScores = new Map<GeopoliticalRegion, { score: number; keywords: string[] }>();
    const eventTypeScores = new Map<GeopoliticalEventType, { score: number; keywords: string[] }>();
    const actorScores = new Map<GeopoliticalActor, { score: number; keywords: string[] }>();

    let totalScore = 0;

    for (const keyword of this.keywords) {
      if (matchKeyword(fullText, normalizedText, keyword)) {
        totalScore += keyword.weight;

        // Update region scores
        if (keyword.triggers.regions) {
          for (const region of keyword.triggers.regions) {
            const current = regionScores.get(region) ?? { score: 0, keywords: [] };
            current.score += keyword.weight;
            current.keywords.push(keyword.keyword);
            regionScores.set(region, current);
          }
        }

        // Update event type scores
        if (keyword.triggers.eventTypes) {
          for (const eventType of keyword.triggers.eventTypes) {
            const current = eventTypeScores.get(eventType) ?? { score: 0, keywords: [] };
            current.score += keyword.weight;
            current.keywords.push(keyword.keyword);
            eventTypeScores.set(eventType, current);
          }
        }

        // Update actor scores
        if (keyword.triggers.actors) {
          for (const actor of keyword.triggers.actors) {
            const current = actorScores.get(actor) ?? { score: 0, keywords: [] };
            current.score += keyword.weight;
            current.keywords.push(keyword.keyword);
            actorScores.set(actor, current);
          }
        }
      }
    }

    // Normalize total score to 0-100
    const relevanceScore = Math.min(100, Math.round((totalScore / 100) * 100));
    const isGeopolitical = relevanceScore >= minRelevanceScore;

    // Create region tags
    const regionTags: GeopoliticalTag[] = [];
    for (const [region, data] of regionScores) {
      const confidenceScore = Math.min(100, Math.round((data.score / 50) * 100));
      regionTags.push({
        type: "region",
        value: region,
        confidence: getTagConfidence(confidenceScore),
        confidenceScore,
        triggerKeywords: [...new Set(data.keywords)],
      });
    }
    regionTags.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Create event type tags
    const eventTypeTags: GeopoliticalTag[] = [];
    for (const [eventType, data] of eventTypeScores) {
      const confidenceScore = Math.min(100, Math.round((data.score / 50) * 100));
      eventTypeTags.push({
        type: "event_type",
        value: eventType,
        confidence: getTagConfidence(confidenceScore),
        confidenceScore,
        triggerKeywords: [...new Set(data.keywords)],
      });
    }
    eventTypeTags.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Create actor tags
    const actorTags: GeopoliticalTag[] = [];
    for (const [actor, data] of actorScores) {
      const confidenceScore = Math.min(100, Math.round((data.score / 50) * 100));
      actorTags.push({
        type: "actor",
        value: actor,
        confidence: getTagConfidence(confidenceScore),
        confidenceScore,
        triggerKeywords: [...new Set(data.keywords)],
      });
    }
    actorTags.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Determine primary values
    const primaryRegion = regionTags.length > 0 ? regionTags[0]!.value as GeopoliticalRegion : null;
    const primaryEventType = eventTypeTags.length > 0 ? eventTypeTags[0]!.value as GeopoliticalEventType : null;
    const primaryActor = actorTags.length > 0 ? actorTags[0]!.value as GeopoliticalActor : null;

    // Combine all tags
    const allTags = [...regionTags, ...eventTypeTags, ...actorTags];

    // Assign situation if applicable
    let situationId: string | null = null;
    if (assignSituation && isGeopolitical) {
      situationId = this.findMatchingSituation(normalizedText, regionTags, actorTags, eventTypeTags);
      if (situationId) {
        this.marketSituationMap.set(market.id, situationId);
        const situationMarkets = this.situationMarketsMap.get(situationId);
        if (situationMarkets) {
          situationMarkets.add(market.id);
        }
      }
    }

    // Find related markets
    const relatedMarketIds: string[] = [];
    if (findRelatedMarkets && situationId) {
      const situationMarkets = this.situationMarketsMap.get(situationId);
      if (situationMarkets) {
        for (const id of situationMarkets) {
          if (id !== market.id) {
            relatedMarketIds.push(id);
          }
        }
      }
    }

    const result: GeopoliticalTagResult = {
      marketId: market.id,
      question: market.question,
      isGeopolitical,
      relevanceScore,
      primaryRegion,
      regionTags,
      primaryEventType,
      eventTypeTags,
      primaryActor,
      actorTags,
      allTags,
      relatedMarketIds,
      situationId,
      taggedAt: new Date(),
      fromCache: false,
    };

    // Add to cache
    this.addToCache(cacheKey, result);
    this.tagCount++;

    if (this.config.debug) {
      console.log(
        `[GeopoliticalEventTagger] Tagged ${market.id}: geopolitical=${isGeopolitical}, ` +
        `score=${relevanceScore}, regions=${regionTags.length}, ` +
        `events=${eventTypeTags.length}, actors=${actorTags.length}`
      );
    }

    return result;
  }

  /**
   * Tag multiple markets in batch
   */
  tagMarkets(
    markets: MarketForGeopoliticalTagging[],
    options: TagMarketOptions = {}
  ): BatchTaggingResult {
    const startTime = Date.now();
    const results = new Map<string, GeopoliticalTagResult>();
    const errors = new Map<string, string>();
    const regionDistribution = new Map<GeopoliticalRegion, number>();
    const eventTypeDistribution = new Map<GeopoliticalEventType, number>();
    const actorDistribution = new Map<GeopoliticalActor, number>();
    const situationDistribution = new Map<string, number>();
    let geopoliticalCount = 0;

    for (const market of markets) {
      try {
        const result = this.tagMarket(market, options);
        results.set(market.id, result);

        if (result.isGeopolitical) {
          geopoliticalCount++;

          // Update distributions
          if (result.primaryRegion) {
            const count = regionDistribution.get(result.primaryRegion) ?? 0;
            regionDistribution.set(result.primaryRegion, count + 1);
          }

          if (result.primaryEventType) {
            const count = eventTypeDistribution.get(result.primaryEventType) ?? 0;
            eventTypeDistribution.set(result.primaryEventType, count + 1);
          }

          if (result.primaryActor) {
            const count = actorDistribution.get(result.primaryActor) ?? 0;
            actorDistribution.set(result.primaryActor, count + 1);
          }

          if (result.situationId) {
            const count = situationDistribution.get(result.situationId) ?? 0;
            situationDistribution.set(result.situationId, count + 1);
          }
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
      geopoliticalCount,
      regionDistribution,
      eventTypeDistribution,
      actorDistribution,
      situationDistribution,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Find matching situation for a market
   */
  private findMatchingSituation(
    normalizedText: string,
    regionTags: GeopoliticalTag[],
    actorTags: GeopoliticalTag[],
    eventTypeTags: GeopoliticalTag[]
  ): string | null {
    let bestMatch: { id: string; score: number } | null = null;

    for (const situation of this.situations) {
      let matchScore = 0;

      // Check for identifying keywords
      for (const keyword of situation.identifyingKeywords) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          matchScore += 10;
        }
      }

      // Check for region overlap
      const marketRegions = new Set(regionTags.map((t) => t.value as GeopoliticalRegion));
      for (const region of situation.regions) {
        if (marketRegions.has(region)) {
          matchScore += 5;
        }
      }

      // Check for actor overlap
      const marketActors = new Set(actorTags.map((t) => t.value as GeopoliticalActor));
      for (const actor of situation.actors) {
        if (marketActors.has(actor)) {
          matchScore += 5;
        }
      }

      // Check for event type overlap
      const marketEventTypes = new Set(eventTypeTags.map((t) => t.value as GeopoliticalEventType));
      for (const eventType of situation.eventTypes) {
        if (marketEventTypes.has(eventType)) {
          matchScore += 3;
        }
      }

      // Track best match
      if (matchScore > 0 && (!bestMatch || matchScore > bestMatch.score)) {
        bestMatch = { id: situation.id, score: matchScore };
      }
    }

    // Require a minimum match score
    return bestMatch && bestMatch.score >= 15 ? bestMatch.id : null;
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): GeopoliticalTagResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.result, fromCache: true };
  }

  /**
   * Add to cache
   */
  private addToCache(key: string, result: GeopoliticalTagResult): void {
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
   * Check if a market is geopolitical
   */
  isGeopoliticalMarket(
    market: MarketForGeopoliticalTagging,
    options: TagMarketOptions = {}
  ): boolean {
    return this.tagMarket(market, options).isGeopolitical;
  }

  /**
   * Get markets tagged with a specific region
   */
  getMarketsByRegion(
    markets: MarketForGeopoliticalTagging[],
    region: GeopoliticalRegion,
    options: TagMarketOptions = {}
  ): GeopoliticalTagResult[] {
    const results: GeopoliticalTagResult[] = [];
    for (const market of markets) {
      const result = this.tagMarket(market, options);
      if (result.regionTags.some((t) => t.value === region)) {
        results.push(result);
      }
    }
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get markets tagged with a specific event type
   */
  getMarketsByEventType(
    markets: MarketForGeopoliticalTagging[],
    eventType: GeopoliticalEventType,
    options: TagMarketOptions = {}
  ): GeopoliticalTagResult[] {
    const results: GeopoliticalTagResult[] = [];
    for (const market of markets) {
      const result = this.tagMarket(market, options);
      if (result.eventTypeTags.some((t) => t.value === eventType)) {
        results.push(result);
      }
    }
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get markets tagged with a specific actor
   */
  getMarketsByActor(
    markets: MarketForGeopoliticalTagging[],
    actor: GeopoliticalActor,
    options: TagMarketOptions = {}
  ): GeopoliticalTagResult[] {
    const results: GeopoliticalTagResult[] = [];
    for (const market of markets) {
      const result = this.tagMarket(market, options);
      if (result.actorTags.some((t) => t.value === actor)) {
        results.push(result);
      }
    }
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get markets for a specific situation
   */
  getMarketsBySituation(
    markets: MarketForGeopoliticalTagging[],
    situationId: string,
    options: TagMarketOptions = {}
  ): GeopoliticalTagResult[] {
    const results: GeopoliticalTagResult[] = [];
    for (const market of markets) {
      const result = this.tagMarket(market, options);
      if (result.situationId === situationId) {
        results.push(result);
      }
    }
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get related markets for a given market
   */
  getRelatedMarkets(marketId: string): string[] {
    const situationId = this.marketSituationMap.get(marketId);
    if (!situationId) return [];

    const situationMarkets = this.situationMarketsMap.get(situationId);
    if (!situationMarkets) return [];

    return Array.from(situationMarkets).filter((id) => id !== marketId);
  }

  /**
   * Link two markets as related
   */
  linkRelatedMarkets(marketId1: string, marketId2: string): void {
    // If either market has a situation, add the other to the same situation
    const situation1 = this.marketSituationMap.get(marketId1);
    const situation2 = this.marketSituationMap.get(marketId2);

    if (situation1) {
      this.marketSituationMap.set(marketId2, situation1);
      const markets = this.situationMarketsMap.get(situation1);
      if (markets) {
        markets.add(marketId2);
      }
    } else if (situation2) {
      this.marketSituationMap.set(marketId1, situation2);
      const markets = this.situationMarketsMap.get(situation2);
      if (markets) {
        markets.add(marketId1);
      }
    } else {
      // Create a custom situation for these markets
      const customId = `custom-${marketId1}-${marketId2}`;
      this.marketSituationMap.set(marketId1, customId);
      this.marketSituationMap.set(marketId2, customId);
      this.situationMarketsMap.set(customId, new Set([marketId1, marketId2]));
    }
  }

  /**
   * Get all known situations
   */
  getSituations(): GeopoliticalSituation[] {
    return [...this.situations];
  }

  /**
   * Get situation by ID
   */
  getSituation(situationId: string): GeopoliticalSituation | null {
    return this.situations.find((s) => s.id === situationId) ?? null;
  }

  /**
   * Get all keywords
   */
  getKeywords(): GeopoliticalKeyword[] {
    return [...this.keywords];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.config.debug) {
      console.log("[GeopoliticalEventTagger] Cache cleared");
    }
  }

  /**
   * Get tagger summary
   */
  getSummary(): TaggerSummary {
    const regionBreakdown = new Map<GeopoliticalRegion, number>();
    const eventTypeBreakdown = new Map<GeopoliticalEventType, number>();
    const actorBreakdown = new Map<GeopoliticalActor, number>();
    let geopoliticalCount = 0;
    let totalRelevanceScore = 0;

    for (const entry of this.cache.values()) {
      if (Date.now() <= entry.expiresAt) {
        const result = entry.result;

        if (result.isGeopolitical) {
          geopoliticalCount++;
          totalRelevanceScore += result.relevanceScore;

          if (result.primaryRegion) {
            const count = regionBreakdown.get(result.primaryRegion) ?? 0;
            regionBreakdown.set(result.primaryRegion, count + 1);
          }

          if (result.primaryEventType) {
            const count = eventTypeBreakdown.get(result.primaryEventType) ?? 0;
            eventTypeBreakdown.set(result.primaryEventType, count + 1);
          }

          if (result.primaryActor) {
            const count = actorBreakdown.get(result.primaryActor) ?? 0;
            actorBreakdown.set(result.primaryActor, count + 1);
          }
        }
      }
    }

    const totalTagged = this.cache.size;
    const activeSituations = Array.from(this.situationMarketsMap.values())
      .filter((markets) => markets.size > 0).length;

    return {
      totalTagged,
      geopoliticalMarketsCount: geopoliticalCount,
      geopoliticalPercentage:
        totalTagged > 0
          ? Math.round((geopoliticalCount / totalTagged) * 1000) / 10
          : 0,
      regionBreakdown,
      eventTypeBreakdown,
      actorBreakdown,
      averageRelevanceScore:
        geopoliticalCount > 0
          ? Math.round((totalRelevanceScore / geopoliticalCount) * 10) / 10
          : 0,
      cacheHitRate:
        this.tagCount > 0
          ? Math.round((this.cacheHits / this.tagCount) * 1000) / 10
          : 0,
      activeSituations,
    };
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

let sharedInstance: GeopoliticalEventTagger | null = null;

/**
 * Create a new GeopoliticalEventTagger instance
 */
export function createGeopoliticalEventTagger(
  config?: GeopoliticalEventTaggerConfig
): GeopoliticalEventTagger {
  return new GeopoliticalEventTagger(config);
}

/**
 * Get the shared GeopoliticalEventTagger instance
 */
export function getSharedGeopoliticalEventTagger(): GeopoliticalEventTagger {
  if (!sharedInstance) {
    sharedInstance = new GeopoliticalEventTagger();
  }
  return sharedInstance;
}

/**
 * Set the shared GeopoliticalEventTagger instance
 */
export function setSharedGeopoliticalEventTagger(
  tagger: GeopoliticalEventTagger
): void {
  sharedInstance = tagger;
}

/**
 * Reset the shared GeopoliticalEventTagger instance
 */
export function resetSharedGeopoliticalEventTagger(): void {
  if (sharedInstance) {
    sharedInstance.clearCache();
  }
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Tag a single market using the shared instance
 */
export function tagMarket(
  market: MarketForGeopoliticalTagging,
  options?: TagMarketOptions
): GeopoliticalTagResult {
  return getSharedGeopoliticalEventTagger().tagMarket(market, options);
}

/**
 * Tag multiple markets using the shared instance
 */
export function tagMarkets(
  markets: MarketForGeopoliticalTagging[],
  options?: TagMarketOptions
): BatchTaggingResult {
  return getSharedGeopoliticalEventTagger().tagMarkets(markets, options);
}

/**
 * Check if a market is geopolitical using the shared instance
 */
export function isGeopoliticalMarket(
  market: MarketForGeopoliticalTagging,
  options?: TagMarketOptions
): boolean {
  return getSharedGeopoliticalEventTagger().isGeopoliticalMarket(market, options);
}

/**
 * Get markets by region using the shared instance
 */
export function getGeopoliticalMarketsByRegion(
  markets: MarketForGeopoliticalTagging[],
  region: GeopoliticalRegion,
  options?: TagMarketOptions
): GeopoliticalTagResult[] {
  return getSharedGeopoliticalEventTagger().getMarketsByRegion(markets, region, options);
}

/**
 * Get markets by event type using the shared instance
 */
export function getGeopoliticalMarketsByEventType(
  markets: MarketForGeopoliticalTagging[],
  eventType: GeopoliticalEventType,
  options?: TagMarketOptions
): GeopoliticalTagResult[] {
  return getSharedGeopoliticalEventTagger().getMarketsByEventType(markets, eventType, options);
}

/**
 * Get markets by actor using the shared instance
 */
export function getGeopoliticalMarketsByActor(
  markets: MarketForGeopoliticalTagging[],
  actor: GeopoliticalActor,
  options?: TagMarketOptions
): GeopoliticalTagResult[] {
  return getSharedGeopoliticalEventTagger().getMarketsByActor(markets, actor, options);
}

/**
 * Get markets by situation using the shared instance
 */
export function getGeopoliticalMarketsBySituation(
  markets: MarketForGeopoliticalTagging[],
  situationId: string,
  options?: TagMarketOptions
): GeopoliticalTagResult[] {
  return getSharedGeopoliticalEventTagger().getMarketsBySituation(markets, situationId, options);
}

/**
 * Get related markets using the shared instance
 */
export function getRelatedGeopoliticalMarkets(marketId: string): string[] {
  return getSharedGeopoliticalEventTagger().getRelatedMarkets(marketId);
}

/**
 * Link related markets using the shared instance
 */
export function linkRelatedGeopoliticalMarkets(
  marketId1: string,
  marketId2: string
): void {
  getSharedGeopoliticalEventTagger().linkRelatedMarkets(marketId1, marketId2);
}

/**
 * Get tagger summary using the shared instance
 */
export function getGeopoliticalTaggerSummary(): TaggerSummary {
  return getSharedGeopoliticalEventTagger().getSummary();
}
