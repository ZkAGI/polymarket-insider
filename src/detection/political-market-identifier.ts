/**
 * Political Market Identifier (DET-NICHE-004)
 *
 * Identify markets related to political decisions and events.
 *
 * Features:
 * - Define comprehensive political keyword taxonomy
 * - Identify election and policy markets
 * - Tag political markets with granular classifications
 * - Track political categories (elections, policy, appointments, etc.)
 * - Support for multi-jurisdiction political tagging
 * - Integrate with market category classifier
 */

import {
  MarketCategoryClassifier,
  getSharedMarketCategoryClassifier,
  type MarketClassificationResult,
} from "./market-category-classifier";
import { MarketCategory } from "../api/gamma/types";

// ============================================================================
// Enums and Types
// ============================================================================

/**
 * Political event category classification
 */
export enum PoliticalEventCategory {
  /** Presidential, parliamentary, gubernatorial elections */
  ELECTION = "ELECTION",
  /** Primary elections, caucuses */
  PRIMARY = "PRIMARY",
  /** Votes on policy issues, ballot measures */
  REFERENDUM = "REFERENDUM",
  /** Legislative policy decisions */
  LEGISLATION = "LEGISLATION",
  /** Executive orders, presidential actions */
  EXECUTIVE_ACTION = "EXECUTIVE_ACTION",
  /** Cabinet, judicial, agency appointments */
  APPOINTMENT = "APPOINTMENT",
  /** Impeachment, censure proceedings */
  IMPEACHMENT = "IMPEACHMENT",
  /** Political scandals, investigations */
  SCANDAL = "SCANDAL",
  /** Party conventions, leadership elections */
  PARTY_LEADERSHIP = "PARTY_LEADERSHIP",
  /** Campaign events, debates */
  CAMPAIGN = "CAMPAIGN",
  /** Political polling, approval ratings */
  POLLING = "POLLING",
  /** Regulatory decisions by agencies */
  REGULATORY = "REGULATORY",
  /** International political events */
  INTERNATIONAL_POLITICS = "INTERNATIONAL_POLITICS",
  /** General political category */
  GENERAL = "GENERAL",
}

/**
 * Political jurisdiction classification
 */
export enum PoliticalJurisdiction {
  /** United States federal level */
  US_FEDERAL = "US_FEDERAL",
  /** US state level */
  US_STATE = "US_STATE",
  /** US local/municipal level */
  US_LOCAL = "US_LOCAL",
  /** United Kingdom */
  UK = "UK",
  /** European Union institutions */
  EU = "EU",
  /** Individual EU member states */
  EU_MEMBER_STATE = "EU_MEMBER_STATE",
  /** Canada */
  CANADA = "CANADA",
  /** Australia */
  AUSTRALIA = "AUSTRALIA",
  /** China */
  CHINA = "CHINA",
  /** Russia */
  RUSSIA = "RUSSIA",
  /** India */
  INDIA = "INDIA",
  /** Japan */
  JAPAN = "JAPAN",
  /** Brazil */
  BRAZIL = "BRAZIL",
  /** Mexico */
  MEXICO = "MEXICO",
  /** Middle East */
  MIDDLE_EAST = "MIDDLE_EAST",
  /** Other international */
  OTHER_INTERNATIONAL = "OTHER_INTERNATIONAL",
  /** Multi-jurisdictional */
  MULTI_JURISDICTIONAL = "MULTI_JURISDICTIONAL",
}

/**
 * Political party affiliation
 */
export enum PoliticalParty {
  // US Parties
  DEMOCRATIC = "DEMOCRATIC",
  REPUBLICAN = "REPUBLICAN",
  INDEPENDENT_US = "INDEPENDENT_US",
  LIBERTARIAN = "LIBERTARIAN",
  GREEN_US = "GREEN_US",

  // UK Parties
  CONSERVATIVE_UK = "CONSERVATIVE_UK",
  LABOUR_UK = "LABOUR_UK",
  LIBERAL_DEMOCRAT = "LIBERAL_DEMOCRAT",
  SNP = "SNP",

  // Other major parties
  CDU_CSU = "CDU_CSU",
  SPD = "SPD",
  MACRON_COALITION = "MACRON_COALITION",
  NATIONAL_RALLY = "NATIONAL_RALLY",

  // Generic
  LEFT_LEANING = "LEFT_LEANING",
  RIGHT_LEANING = "RIGHT_LEANING",
  CENTRIST = "CENTRIST",
  NON_PARTISAN = "NON_PARTISAN",
  UNKNOWN = "UNKNOWN",
}

/**
 * Political office type
 */
export enum PoliticalOffice {
  // Executive
  PRESIDENT = "PRESIDENT",
  VICE_PRESIDENT = "VICE_PRESIDENT",
  PRIME_MINISTER = "PRIME_MINISTER",
  GOVERNOR = "GOVERNOR",
  MAYOR = "MAYOR",

  // Legislative
  SENATOR = "SENATOR",
  REPRESENTATIVE = "REPRESENTATIVE",
  MEMBER_OF_PARLIAMENT = "MEMBER_OF_PARLIAMENT",
  STATE_LEGISLATOR = "STATE_LEGISLATOR",

  // Judicial
  SUPREME_COURT_JUSTICE = "SUPREME_COURT_JUSTICE",
  FEDERAL_JUDGE = "FEDERAL_JUDGE",
  ATTORNEY_GENERAL = "ATTORNEY_GENERAL",

  // Cabinet/Executive
  CABINET_SECRETARY = "CABINET_SECRETARY",
  AGENCY_HEAD = "AGENCY_HEAD",

  // Party
  PARTY_LEADER = "PARTY_LEADER",
  SPEAKER = "SPEAKER",

  // Other
  OTHER = "OTHER",
}

/**
 * Confidence level for political identification
 */
export enum PoliticalConfidence {
  /** Very high confidence - explicit political content */
  VERY_HIGH = "VERY_HIGH",
  /** High confidence - strong political signals */
  HIGH = "HIGH",
  /** Medium confidence - moderate political signals */
  MEDIUM = "MEDIUM",
  /** Low confidence - weak political signals */
  LOW = "LOW",
}

/**
 * A single political tag
 */
export interface PoliticalTag {
  /** Type of tag */
  type: "category" | "jurisdiction" | "party" | "office";
  /** The specific tag value */
  value:
    | PoliticalEventCategory
    | PoliticalJurisdiction
    | PoliticalParty
    | PoliticalOffice;
  /** Confidence in this tag assignment */
  confidence: PoliticalConfidence;
  /** Confidence score (0-100) */
  confidenceScore: number;
  /** Keywords that triggered this tag */
  triggerKeywords: string[];
}

/**
 * Result of identifying a political market
 */
export interface PoliticalMarketResult {
  /** Market ID */
  marketId: string;
  /** Market question for reference */
  question: string;
  /** Whether this market is politically relevant */
  isPolitical: boolean;
  /** Overall political relevance score (0-100) */
  relevanceScore: number;
  /** Primary political category */
  primaryCategory: PoliticalEventCategory | null;
  /** All assigned category tags */
  categoryTags: PoliticalTag[];
  /** Primary jurisdiction */
  primaryJurisdiction: PoliticalJurisdiction | null;
  /** All assigned jurisdiction tags */
  jurisdictionTags: PoliticalTag[];
  /** Primary party (if identifiable) */
  primaryParty: PoliticalParty | null;
  /** All assigned party tags */
  partyTags: PoliticalTag[];
  /** Office type (if applicable) */
  officeType: PoliticalOffice | null;
  /** All assigned office tags */
  officeTags: PoliticalTag[];
  /** All tags combined */
  allTags: PoliticalTag[];
  /** Whether this is an election market */
  isElectionMarket: boolean;
  /** Whether this is a policy market */
  isPolicyMarket: boolean;
  /** Politicians or political figures mentioned */
  mentionedFigures: string[];
  /** Timestamp of identification */
  identifiedAt: Date;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Market data for political identification
 */
export interface MarketForPoliticalIdentification {
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
 * Keyword pattern for political identification
 */
export interface PoliticalKeyword {
  /** The keyword or phrase to match */
  keyword: string;
  /** Weight for scoring */
  weight: number;
  /** Tags this keyword triggers */
  triggers: {
    categories?: PoliticalEventCategory[];
    jurisdictions?: PoliticalJurisdiction[];
    parties?: PoliticalParty[];
    offices?: PoliticalOffice[];
  };
  /** Whether this is an exact word boundary match */
  exactMatch?: boolean;
  /** Additional context required for this keyword */
  requiredContext?: string[];
  /** Keywords that exclude this match */
  excludeIfPresent?: string[];
  /** Named political figures associated with this keyword */
  politicalFigures?: string[];
}

/**
 * A known political figure for tracking
 */
export interface PoliticalFigure {
  /** Name of the figure */
  name: string;
  /** Alternative names/spellings */
  aliases: string[];
  /** Current office (if any) */
  currentOffice?: PoliticalOffice;
  /** Party affiliation */
  party: PoliticalParty;
  /** Primary jurisdiction */
  jurisdiction: PoliticalJurisdiction;
  /** Whether they're currently active */
  isActive: boolean;
}

/**
 * Options for identification
 */
export interface IdentifyPoliticalOptions {
  /** Minimum relevance score to be considered political */
  minRelevanceScore?: number;
  /** Whether to detect political figures */
  detectFigures?: boolean;
  /** Bypass cache */
  bypassCache?: boolean;
  /** Include party identification */
  identifyParties?: boolean;
  /** Include office identification */
  identifyOffices?: boolean;
}

/**
 * Batch identification result
 */
export interface BatchPoliticalIdentificationResult {
  /** Successful identification results by market ID */
  results: Map<string, PoliticalMarketResult>;
  /** Failed market IDs with error messages */
  errors: Map<string, string>;
  /** Total markets processed */
  totalProcessed: number;
  /** Number of political markets */
  politicalCount: number;
  /** Number of election markets */
  electionCount: number;
  /** Number of policy markets */
  policyCount: number;
  /** Category distribution */
  categoryDistribution: Map<PoliticalEventCategory, number>;
  /** Jurisdiction distribution */
  jurisdictionDistribution: Map<PoliticalJurisdiction, number>;
  /** Party distribution */
  partyDistribution: Map<PoliticalParty, number>;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics for the identifier
 */
export interface PoliticalIdentifierSummary {
  /** Total markets identified */
  totalIdentified: number;
  /** Number of political markets */
  politicalMarketsCount: number;
  /** Percentage of markets that are political */
  politicalPercentage: number;
  /** Election markets count */
  electionMarketsCount: number;
  /** Policy markets count */
  policyMarketsCount: number;
  /** Category breakdown */
  categoryBreakdown: Map<PoliticalEventCategory, number>;
  /** Jurisdiction breakdown */
  jurisdictionBreakdown: Map<PoliticalJurisdiction, number>;
  /** Party breakdown */
  partyBreakdown: Map<PoliticalParty, number>;
  /** Average relevance score for political markets */
  averageRelevanceScore: number;
  /** Cache hit rate */
  cacheHitRate: number;
}

/**
 * Configuration for the political identifier
 */
export interface PoliticalMarketIdentifierConfig {
  /** Cache TTL in milliseconds (default: 12 hours) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 10000) */
  maxCacheSize?: number;
  /** Minimum score to consider political (default: 15) */
  minPoliticalScore?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom keywords (extends defaults) */
  additionalKeywords?: PoliticalKeyword[];
  /** Custom political figures */
  additionalFigures?: PoliticalFigure[];
  /** Reference to market classifier (optional) */
  classifier?: MarketCategoryClassifier;
}

// ============================================================================
// Constants - Political Keywords
// ============================================================================

/**
 * Default cache TTL: 12 hours
 */
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Default minimum score to be considered political
 */
const DEFAULT_MIN_POLITICAL_SCORE = 15;

/**
 * Default maximum cache size
 */
const DEFAULT_MAX_CACHE_SIZE = 10000;

/**
 * Default political keywords organized by category
 */
export const DEFAULT_POLITICAL_KEYWORDS: PoliticalKeyword[] = [
  // ==== Election Keywords ====
  {
    keyword: "election",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.ELECTION] },
  },
  {
    keyword: "electoral",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.ELECTION] },
  },
  {
    keyword: "electoral college",
    weight: 15,
    triggers: {
      categories: [PoliticalEventCategory.ELECTION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "vote",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.ELECTION] },
    excludeIfPresent: ["vote of confidence", "shareholder vote"],
  },
  {
    keyword: "ballot",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.ELECTION] },
  },
  {
    keyword: "recount",
    weight: 14,
    triggers: { categories: [PoliticalEventCategory.ELECTION] },
  },
  {
    keyword: "swing state",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.ELECTION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "battleground state",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.ELECTION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "general election",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.ELECTION] },
  },

  // ==== Primary/Caucus Keywords ====
  {
    keyword: "primary",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.PRIMARY] },
    requiredContext: [
      "election",
      "vote",
      "candidate",
      "democrat",
      "republican",
    ],
  },
  {
    keyword: "caucus",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.PRIMARY] },
  },
  {
    keyword: "iowa caucus",
    weight: 15,
    triggers: {
      categories: [PoliticalEventCategory.PRIMARY],
      jurisdictions: [PoliticalJurisdiction.US_STATE],
    },
  },
  {
    keyword: "new hampshire primary",
    weight: 15,
    triggers: {
      categories: [PoliticalEventCategory.PRIMARY],
      jurisdictions: [PoliticalJurisdiction.US_STATE],
    },
  },
  {
    keyword: "super tuesday",
    weight: 15,
    triggers: {
      categories: [PoliticalEventCategory.PRIMARY],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "nominee",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.PRIMARY] },
  },
  {
    keyword: "nomination",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.PRIMARY] },
  },

  // ==== Referendum Keywords ====
  {
    keyword: "referendum",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.REFERENDUM] },
  },
  {
    keyword: "ballot measure",
    weight: 14,
    triggers: { categories: [PoliticalEventCategory.REFERENDUM] },
  },
  {
    keyword: "proposition",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.REFERENDUM] },
    requiredContext: ["vote", "ballot", "california", "state"],
  },
  {
    keyword: "plebiscite",
    weight: 14,
    triggers: { categories: [PoliticalEventCategory.REFERENDUM] },
  },
  {
    keyword: "initiative",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.REFERENDUM] },
    requiredContext: ["vote", "ballot", "state"],
  },

  // ==== Legislation Keywords ====
  {
    keyword: "legislation",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.LEGISLATION] },
  },
  {
    keyword: "bill",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.LEGISLATION] },
    requiredContext: ["congress", "senate", "house", "pass", "vote", "law"],
    excludeIfPresent: ["dollar", "invoice", "$"],
  },
  {
    keyword: "law",
    weight: 6,
    triggers: { categories: [PoliticalEventCategory.LEGISLATION] },
    requiredContext: ["pass", "congress", "senate", "legislation"],
  },
  {
    keyword: "act",
    weight: 6,
    triggers: { categories: [PoliticalEventCategory.LEGISLATION] },
    requiredContext: ["congress", "senate", "legislation", "bipartisan"],
  },
  {
    keyword: "congressional vote",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.LEGISLATION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "filibuster",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.LEGISLATION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "cloture",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.LEGISLATION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "veto",
    weight: 12,
    triggers: {
      categories: [
        PoliticalEventCategory.LEGISLATION,
        PoliticalEventCategory.EXECUTIVE_ACTION,
      ],
    },
  },
  {
    keyword: "debt ceiling",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.LEGISLATION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "government shutdown",
    weight: 15,
    triggers: {
      categories: [PoliticalEventCategory.LEGISLATION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "continuing resolution",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.LEGISLATION],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "appropriations",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.LEGISLATION] },
  },
  {
    keyword: "budget",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.LEGISLATION] },
    requiredContext: ["congress", "senate", "federal", "state", "government"],
  },

  // ==== Executive Action Keywords ====
  {
    keyword: "executive order",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.EXECUTIVE_ACTION] },
  },
  {
    keyword: "presidential action",
    weight: 14,
    triggers: { categories: [PoliticalEventCategory.EXECUTIVE_ACTION] },
  },
  {
    keyword: "executive action",
    weight: 14,
    triggers: { categories: [PoliticalEventCategory.EXECUTIVE_ACTION] },
  },
  {
    keyword: "pardon",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.EXECUTIVE_ACTION],
      offices: [PoliticalOffice.PRESIDENT, PoliticalOffice.GOVERNOR],
    },
  },
  {
    keyword: "commutation",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.EXECUTIVE_ACTION] },
  },

  // ==== Appointment Keywords ====
  {
    keyword: "appointment",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.APPOINTMENT] },
    requiredContext: [
      "cabinet",
      "judge",
      "court",
      "secretary",
      "director",
      "nominee",
    ],
  },
  {
    keyword: "confirmation",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.APPOINTMENT] },
    requiredContext: ["senate", "nominee", "cabinet", "judge"],
  },
  {
    keyword: "nomination",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.APPOINTMENT] },
  },
  {
    keyword: "cabinet pick",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.APPOINTMENT],
      offices: [PoliticalOffice.CABINET_SECRETARY],
    },
  },
  {
    keyword: "supreme court nomination",
    weight: 15,
    triggers: {
      categories: [PoliticalEventCategory.APPOINTMENT],
      offices: [PoliticalOffice.SUPREME_COURT_JUSTICE],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "scotus",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.APPOINTMENT],
      offices: [PoliticalOffice.SUPREME_COURT_JUSTICE],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "federal judge",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.APPOINTMENT],
      offices: [PoliticalOffice.FEDERAL_JUDGE],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },

  // ==== Impeachment Keywords ====
  {
    keyword: "impeach",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.IMPEACHMENT] },
  },
  {
    keyword: "impeachment",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.IMPEACHMENT] },
  },
  {
    keyword: "articles of impeachment",
    weight: 15,
    triggers: { categories: [PoliticalEventCategory.IMPEACHMENT] },
  },
  {
    keyword: "censure",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.IMPEACHMENT] },
  },
  {
    keyword: "expulsion",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.IMPEACHMENT] },
    requiredContext: ["congress", "senate", "house", "member"],
  },

  // ==== Scandal/Investigation Keywords ====
  {
    keyword: "scandal",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.SCANDAL] },
    requiredContext: ["political", "congressman", "senator", "president"],
  },
  {
    keyword: "investigation",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.SCANDAL] },
    requiredContext: ["congressional", "senate", "house", "ethics", "special counsel"],
  },
  {
    keyword: "special counsel",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.SCANDAL],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "ethics violation",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.SCANDAL] },
  },
  {
    keyword: "corruption",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.SCANDAL] },
    requiredContext: ["politician", "official", "government", "political"],
  },

  // ==== Party Leadership Keywords ====
  {
    keyword: "party leader",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      offices: [PoliticalOffice.PARTY_LEADER],
    },
  },
  {
    keyword: "convention",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.PARTY_LEADERSHIP] },
    requiredContext: ["republican", "democrat", "party", "dnc", "rnc"],
  },
  {
    keyword: "dnc",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      parties: [PoliticalParty.DEMOCRATIC],
    },
  },
  {
    keyword: "democratic national committee",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      parties: [PoliticalParty.DEMOCRATIC],
    },
  },
  {
    keyword: "rnc",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      parties: [PoliticalParty.REPUBLICAN],
    },
  },
  {
    keyword: "republican national committee",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      parties: [PoliticalParty.REPUBLICAN],
    },
  },
  {
    keyword: "speaker of the house",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      offices: [PoliticalOffice.SPEAKER],
    },
  },
  {
    keyword: "house speaker",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      offices: [PoliticalOffice.SPEAKER],
    },
  },
  {
    keyword: "majority leader",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      offices: [PoliticalOffice.PARTY_LEADER],
    },
  },
  {
    keyword: "minority leader",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.PARTY_LEADERSHIP],
      offices: [PoliticalOffice.PARTY_LEADER],
    },
  },

  // ==== Campaign Keywords ====
  {
    keyword: "campaign",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.CAMPAIGN] },
    requiredContext: [
      "election",
      "candidate",
      "presidential",
      "congressional",
      "political",
    ],
  },
  {
    keyword: "debate",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.CAMPAIGN] },
    requiredContext: ["presidential", "candidate", "election", "primary"],
  },
  {
    keyword: "presidential debate",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.CAMPAIGN],
      offices: [PoliticalOffice.PRESIDENT],
    },
  },
  {
    keyword: "campaign fundraising",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.CAMPAIGN] },
  },
  {
    keyword: "super pac",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.CAMPAIGN],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "running mate",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.CAMPAIGN],
      offices: [PoliticalOffice.VICE_PRESIDENT],
    },
  },
  {
    keyword: "vice president pick",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.CAMPAIGN],
      offices: [PoliticalOffice.VICE_PRESIDENT],
    },
  },

  // ==== Polling Keywords ====
  {
    keyword: "poll",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.POLLING] },
    requiredContext: ["election", "candidate", "approval", "voter"],
  },
  {
    keyword: "polling",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.POLLING] },
  },
  {
    keyword: "approval rating",
    weight: 12,
    triggers: { categories: [PoliticalEventCategory.POLLING] },
  },
  {
    keyword: "favorability",
    weight: 10,
    triggers: { categories: [PoliticalEventCategory.POLLING] },
  },

  // ==== Regulatory Keywords ====
  {
    keyword: "regulation",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.REGULATORY] },
    requiredContext: ["fcc", "sec", "epa", "fda", "ftc", "federal", "agency"],
  },
  {
    keyword: "regulatory",
    weight: 8,
    triggers: { categories: [PoliticalEventCategory.REGULATORY] },
    requiredContext: ["agency", "commission", "federal"],
  },
  {
    keyword: "fcc",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.REGULATORY],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "sec",
    weight: 10,
    triggers: {
      categories: [PoliticalEventCategory.REGULATORY],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    excludeIfPresent: ["cybersecurity"],
  },
  {
    keyword: "epa",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.REGULATORY],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },
  {
    keyword: "ftc",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.REGULATORY],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
  },

  // ==== US Political Figures/Offices ====
  {
    keyword: "president",
    weight: 10,
    triggers: { offices: [PoliticalOffice.PRESIDENT] },
    excludeIfPresent: ["company president", "ceo", "university president"],
  },
  {
    keyword: "biden",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      parties: [PoliticalParty.DEMOCRATIC],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    politicalFigures: ["Joe Biden"],
  },
  {
    keyword: "joe biden",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      parties: [PoliticalParty.DEMOCRATIC],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    politicalFigures: ["Joe Biden"],
  },
  {
    keyword: "trump",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      parties: [PoliticalParty.REPUBLICAN],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    politicalFigures: ["Donald Trump"],
  },
  {
    keyword: "donald trump",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      parties: [PoliticalParty.REPUBLICAN],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    politicalFigures: ["Donald Trump"],
  },
  {
    keyword: "harris",
    weight: 12,
    triggers: {
      offices: [PoliticalOffice.VICE_PRESIDENT],
      parties: [PoliticalParty.DEMOCRATIC],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    politicalFigures: ["Kamala Harris"],
    requiredContext: ["kamala", "vice president", "vp", "president", "election"],
  },
  {
    keyword: "kamala harris",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.VICE_PRESIDENT],
      parties: [PoliticalParty.DEMOCRATIC],
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
    },
    politicalFigures: ["Kamala Harris"],
  },
  {
    keyword: "congress",
    weight: 10,
    triggers: {
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
      offices: [PoliticalOffice.REPRESENTATIVE, PoliticalOffice.SENATOR],
    },
  },
  {
    keyword: "senate",
    weight: 10,
    triggers: {
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
      offices: [PoliticalOffice.SENATOR],
    },
  },
  {
    keyword: "house of representatives",
    weight: 12,
    triggers: {
      jurisdictions: [PoliticalJurisdiction.US_FEDERAL],
      offices: [PoliticalOffice.REPRESENTATIVE],
    },
  },
  {
    keyword: "senator",
    weight: 10,
    triggers: { offices: [PoliticalOffice.SENATOR] },
  },
  {
    keyword: "congressman",
    weight: 10,
    triggers: { offices: [PoliticalOffice.REPRESENTATIVE] },
  },
  {
    keyword: "congresswoman",
    weight: 10,
    triggers: { offices: [PoliticalOffice.REPRESENTATIVE] },
  },
  {
    keyword: "representative",
    weight: 8,
    triggers: { offices: [PoliticalOffice.REPRESENTATIVE] },
    requiredContext: ["congress", "house", "district"],
  },
  {
    keyword: "governor",
    weight: 10,
    triggers: {
      offices: [PoliticalOffice.GOVERNOR],
      jurisdictions: [PoliticalJurisdiction.US_STATE],
    },
  },
  {
    keyword: "gubernatorial",
    weight: 12,
    triggers: {
      categories: [PoliticalEventCategory.ELECTION],
      offices: [PoliticalOffice.GOVERNOR],
    },
  },
  {
    keyword: "mayor",
    weight: 10,
    triggers: {
      offices: [PoliticalOffice.MAYOR],
      jurisdictions: [PoliticalJurisdiction.US_LOCAL],
    },
  },

  // ==== US Parties ====
  {
    keyword: "democrat",
    weight: 10,
    triggers: { parties: [PoliticalParty.DEMOCRATIC] },
  },
  {
    keyword: "democratic party",
    weight: 12,
    triggers: { parties: [PoliticalParty.DEMOCRATIC] },
  },
  {
    keyword: "republican",
    weight: 10,
    triggers: { parties: [PoliticalParty.REPUBLICAN] },
  },
  {
    keyword: "republican party",
    weight: 12,
    triggers: { parties: [PoliticalParty.REPUBLICAN] },
  },
  {
    keyword: "gop",
    weight: 12,
    triggers: { parties: [PoliticalParty.REPUBLICAN] },
  },
  {
    keyword: "libertarian",
    weight: 10,
    triggers: { parties: [PoliticalParty.LIBERTARIAN] },
    requiredContext: ["party", "candidate", "election"],
  },
  {
    keyword: "independent",
    weight: 6,
    triggers: { parties: [PoliticalParty.INDEPENDENT_US] },
    requiredContext: ["candidate", "election", "senate", "run"],
  },

  // ==== UK Political Keywords ====
  {
    keyword: "prime minister",
    weight: 12,
    triggers: { offices: [PoliticalOffice.PRIME_MINISTER] },
  },
  {
    keyword: "parliament",
    weight: 10,
    triggers: {
      offices: [PoliticalOffice.MEMBER_OF_PARLIAMENT],
      jurisdictions: [PoliticalJurisdiction.UK],
    },
  },
  {
    keyword: "tory",
    weight: 12,
    triggers: {
      parties: [PoliticalParty.CONSERVATIVE_UK],
      jurisdictions: [PoliticalJurisdiction.UK],
    },
  },
  {
    keyword: "conservative party",
    weight: 12,
    triggers: {
      parties: [PoliticalParty.CONSERVATIVE_UK],
      jurisdictions: [PoliticalJurisdiction.UK],
    },
    requiredContext: ["uk", "british", "britain", "parliament"],
  },
  {
    keyword: "labour party",
    weight: 12,
    triggers: {
      parties: [PoliticalParty.LABOUR_UK],
      jurisdictions: [PoliticalJurisdiction.UK],
    },
  },
  {
    keyword: "labour",
    weight: 8,
    triggers: { parties: [PoliticalParty.LABOUR_UK] },
    requiredContext: ["uk", "british", "parliament", "party"],
  },
  {
    keyword: "keir starmer",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      parties: [PoliticalParty.LABOUR_UK],
      jurisdictions: [PoliticalJurisdiction.UK],
    },
    politicalFigures: ["Keir Starmer"],
  },
  {
    keyword: "rishi sunak",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      parties: [PoliticalParty.CONSERVATIVE_UK],
      jurisdictions: [PoliticalJurisdiction.UK],
    },
    politicalFigures: ["Rishi Sunak"],
  },
  {
    keyword: "house of commons",
    weight: 12,
    triggers: {
      jurisdictions: [PoliticalJurisdiction.UK],
      offices: [PoliticalOffice.MEMBER_OF_PARLIAMENT],
    },
  },
  {
    keyword: "house of lords",
    weight: 10,
    triggers: { jurisdictions: [PoliticalJurisdiction.UK] },
  },
  {
    keyword: "westminster",
    weight: 10,
    triggers: { jurisdictions: [PoliticalJurisdiction.UK] },
    requiredContext: ["politics", "parliament", "election"],
  },
  {
    keyword: "brexit",
    weight: 14,
    triggers: {
      categories: [
        PoliticalEventCategory.REFERENDUM,
        PoliticalEventCategory.LEGISLATION,
      ],
      jurisdictions: [PoliticalJurisdiction.UK, PoliticalJurisdiction.EU],
    },
  },

  // ==== EU Political Keywords ====
  {
    keyword: "european parliament",
    weight: 12,
    triggers: { jurisdictions: [PoliticalJurisdiction.EU] },
  },
  {
    keyword: "european commission",
    weight: 12,
    triggers: { jurisdictions: [PoliticalJurisdiction.EU] },
  },
  {
    keyword: "eu election",
    weight: 14,
    triggers: {
      categories: [PoliticalEventCategory.ELECTION],
      jurisdictions: [PoliticalJurisdiction.EU],
    },
  },
  {
    keyword: "ursula von der leyen",
    weight: 14,
    triggers: { jurisdictions: [PoliticalJurisdiction.EU] },
    politicalFigures: ["Ursula von der Leyen"],
  },

  // ==== French Political Keywords ====
  {
    keyword: "macron",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE],
    },
    politicalFigures: ["Emmanuel Macron"],
  },
  {
    keyword: "emmanuel macron",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      parties: [PoliticalParty.MACRON_COALITION],
      jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE],
    },
    politicalFigures: ["Emmanuel Macron"],
  },
  {
    keyword: "marine le pen",
    weight: 14,
    triggers: {
      parties: [PoliticalParty.NATIONAL_RALLY],
      jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE],
    },
    politicalFigures: ["Marine Le Pen"],
  },
  {
    keyword: "national rally",
    weight: 12,
    triggers: {
      parties: [PoliticalParty.NATIONAL_RALLY],
      jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE],
    },
  },

  // ==== German Political Keywords ====
  {
    keyword: "bundestag",
    weight: 12,
    triggers: { jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE] },
  },
  {
    keyword: "bundesrat",
    weight: 10,
    triggers: { jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE] },
  },
  {
    keyword: "chancellor",
    weight: 10,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE],
    },
    requiredContext: ["germany", "german", "berlin"],
  },
  {
    keyword: "olaf scholz",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      parties: [PoliticalParty.SPD],
      jurisdictions: [PoliticalJurisdiction.EU_MEMBER_STATE],
    },
    politicalFigures: ["Olaf Scholz"],
  },

  // ==== International Political Keywords ====
  {
    keyword: "modi",
    weight: 12,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      jurisdictions: [PoliticalJurisdiction.INDIA],
    },
    politicalFigures: ["Narendra Modi"],
  },
  {
    keyword: "narendra modi",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      jurisdictions: [PoliticalJurisdiction.INDIA],
    },
    politicalFigures: ["Narendra Modi"],
  },
  {
    keyword: "xi jinping",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      jurisdictions: [PoliticalJurisdiction.CHINA],
    },
    politicalFigures: ["Xi Jinping"],
  },
  {
    keyword: "putin",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      jurisdictions: [PoliticalJurisdiction.RUSSIA],
    },
    politicalFigures: ["Vladimir Putin"],
  },
  {
    keyword: "vladimir putin",
    weight: 15,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      jurisdictions: [PoliticalJurisdiction.RUSSIA],
    },
    politicalFigures: ["Vladimir Putin"],
  },
  {
    keyword: "netanyahu",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      jurisdictions: [PoliticalJurisdiction.MIDDLE_EAST],
    },
    politicalFigures: ["Benjamin Netanyahu"],
  },
  {
    keyword: "zelensky",
    weight: 14,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      jurisdictions: [PoliticalJurisdiction.OTHER_INTERNATIONAL],
    },
    politicalFigures: ["Volodymyr Zelensky"],
  },
  {
    keyword: "trudeau",
    weight: 12,
    triggers: {
      offices: [PoliticalOffice.PRIME_MINISTER],
      jurisdictions: [PoliticalJurisdiction.CANADA],
    },
    politicalFigures: ["Justin Trudeau"],
  },
  {
    keyword: "lula",
    weight: 12,
    triggers: {
      offices: [PoliticalOffice.PRESIDENT],
      jurisdictions: [PoliticalJurisdiction.BRAZIL],
    },
    politicalFigures: ["Luiz Inácio Lula da Silva"],
  },
];

/**
 * Default known political figures
 */
export const DEFAULT_POLITICAL_FIGURES: PoliticalFigure[] = [
  // US
  {
    name: "Joe Biden",
    aliases: ["Biden", "Joseph Biden"],
    currentOffice: PoliticalOffice.PRESIDENT,
    party: PoliticalParty.DEMOCRATIC,
    jurisdiction: PoliticalJurisdiction.US_FEDERAL,
    isActive: true,
  },
  {
    name: "Donald Trump",
    aliases: ["Trump", "DJT"],
    party: PoliticalParty.REPUBLICAN,
    jurisdiction: PoliticalJurisdiction.US_FEDERAL,
    isActive: true,
  },
  {
    name: "Kamala Harris",
    aliases: ["Harris"],
    currentOffice: PoliticalOffice.VICE_PRESIDENT,
    party: PoliticalParty.DEMOCRATIC,
    jurisdiction: PoliticalJurisdiction.US_FEDERAL,
    isActive: true,
  },
  // UK
  {
    name: "Keir Starmer",
    aliases: ["Starmer"],
    currentOffice: PoliticalOffice.PRIME_MINISTER,
    party: PoliticalParty.LABOUR_UK,
    jurisdiction: PoliticalJurisdiction.UK,
    isActive: true,
  },
  {
    name: "Rishi Sunak",
    aliases: ["Sunak"],
    party: PoliticalParty.CONSERVATIVE_UK,
    jurisdiction: PoliticalJurisdiction.UK,
    isActive: true,
  },
  // France
  {
    name: "Emmanuel Macron",
    aliases: ["Macron"],
    currentOffice: PoliticalOffice.PRESIDENT,
    party: PoliticalParty.MACRON_COALITION,
    jurisdiction: PoliticalJurisdiction.EU_MEMBER_STATE,
    isActive: true,
  },
  {
    name: "Marine Le Pen",
    aliases: ["Le Pen"],
    party: PoliticalParty.NATIONAL_RALLY,
    jurisdiction: PoliticalJurisdiction.EU_MEMBER_STATE,
    isActive: true,
  },
  // Germany
  {
    name: "Olaf Scholz",
    aliases: ["Scholz"],
    currentOffice: PoliticalOffice.PRIME_MINISTER,
    party: PoliticalParty.SPD,
    jurisdiction: PoliticalJurisdiction.EU_MEMBER_STATE,
    isActive: true,
  },
  // Other
  {
    name: "Vladimir Putin",
    aliases: ["Putin"],
    currentOffice: PoliticalOffice.PRESIDENT,
    party: PoliticalParty.UNKNOWN,
    jurisdiction: PoliticalJurisdiction.RUSSIA,
    isActive: true,
  },
  {
    name: "Xi Jinping",
    aliases: ["Xi"],
    currentOffice: PoliticalOffice.PRESIDENT,
    party: PoliticalParty.UNKNOWN,
    jurisdiction: PoliticalJurisdiction.CHINA,
    isActive: true,
  },
  {
    name: "Narendra Modi",
    aliases: ["Modi"],
    currentOffice: PoliticalOffice.PRIME_MINISTER,
    party: PoliticalParty.UNKNOWN,
    jurisdiction: PoliticalJurisdiction.INDIA,
    isActive: true,
  },
  {
    name: "Benjamin Netanyahu",
    aliases: ["Netanyahu", "Bibi"],
    currentOffice: PoliticalOffice.PRIME_MINISTER,
    party: PoliticalParty.RIGHT_LEANING,
    jurisdiction: PoliticalJurisdiction.MIDDLE_EAST,
    isActive: true,
  },
  {
    name: "Justin Trudeau",
    aliases: ["Trudeau"],
    currentOffice: PoliticalOffice.PRIME_MINISTER,
    party: PoliticalParty.LEFT_LEANING,
    jurisdiction: PoliticalJurisdiction.CANADA,
    isActive: true,
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
  pattern: PoliticalKeyword
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
function getConfidenceLevel(score: number): PoliticalConfidence {
  if (score >= 90) return PoliticalConfidence.VERY_HIGH;
  if (score >= 70) return PoliticalConfidence.HIGH;
  if (score >= 50) return PoliticalConfidence.MEDIUM;
  return PoliticalConfidence.LOW;
}

/**
 * Get election-related categories
 */
function isElectionCategory(category: PoliticalEventCategory): boolean {
  return [
    PoliticalEventCategory.ELECTION,
    PoliticalEventCategory.PRIMARY,
    PoliticalEventCategory.CAMPAIGN,
  ].includes(category);
}

/**
 * Get policy-related categories
 */
function isPolicyCategory(category: PoliticalEventCategory): boolean {
  return [
    PoliticalEventCategory.LEGISLATION,
    PoliticalEventCategory.EXECUTIVE_ACTION,
    PoliticalEventCategory.REGULATORY,
    PoliticalEventCategory.REFERENDUM,
  ].includes(category);
}

// ============================================================================
// Political Market Identifier Class
// ============================================================================

/**
 * Cache entry for identification results
 */
interface CacheEntry {
  result: PoliticalMarketResult;
  expiresAt: number;
}

/**
 * Political Market Identifier
 *
 * Identifies markets related to political decisions and events with
 * detailed classification by category, jurisdiction, party, and office.
 */
export class PoliticalMarketIdentifier {
  private readonly config: Required<PoliticalMarketIdentifierConfig>;
  private readonly keywords: PoliticalKeyword[];
  private readonly figures: PoliticalFigure[];
  private readonly cache: Map<string, CacheEntry> = new Map();
  private identificationCount = 0;
  private cacheHits = 0;
  private classifier: MarketCategoryClassifier;

  constructor(config: PoliticalMarketIdentifierConfig = {}) {
    this.config = {
      cacheTtlMs: config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxCacheSize: config.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE,
      minPoliticalScore: config.minPoliticalScore ?? DEFAULT_MIN_POLITICAL_SCORE,
      debug: config.debug ?? false,
      additionalKeywords: config.additionalKeywords ?? [],
      additionalFigures: config.additionalFigures ?? [],
      classifier: config.classifier ?? getSharedMarketCategoryClassifier(),
    };

    // Combine default and additional keywords
    this.keywords = [
      ...DEFAULT_POLITICAL_KEYWORDS,
      ...this.config.additionalKeywords,
    ];

    // Combine default and additional figures
    this.figures = [
      ...DEFAULT_POLITICAL_FIGURES,
      ...this.config.additionalFigures,
    ];

    this.classifier = this.config.classifier;
  }

  /**
   * Identify if a market is political
   */
  identifyMarket(
    market: MarketForPoliticalIdentification,
    options: IdentifyPoliticalOptions = {}
  ): PoliticalMarketResult {
    const {
      minRelevanceScore = this.config.minPoliticalScore,
      detectFigures = true,
      bypassCache = false,
      identifyParties = true,
      identifyOffices = true,
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

    // Get market classification if not provided
    let classificationResult = market.classificationResult;
    if (!classificationResult) {
      classificationResult = this.classifier.classifyMarket({
        id: market.id,
        question: market.question,
        description: market.description,
        slug: market.slug,
        tags: market.tags,
      });
    }

    // Calculate political relevance
    let relevanceScore = 0;
    const categoryTags: PoliticalTag[] = [];
    const jurisdictionTags: PoliticalTag[] = [];
    const partyTags: PoliticalTag[] = [];
    const officeTags: PoliticalTag[] = [];
    const mentionedFigures: string[] = [];

    // Track matched keywords by type for deduplication
    const matchedCategories = new Map<PoliticalEventCategory, { score: number; keywords: string[] }>();
    const matchedJurisdictions = new Map<PoliticalJurisdiction, { score: number; keywords: string[] }>();
    const matchedParties = new Map<PoliticalParty, { score: number; keywords: string[] }>();
    const matchedOffices = new Map<PoliticalOffice, { score: number; keywords: string[] }>();

    // Match keywords
    for (const keyword of this.keywords) {
      if (matchKeyword(fullText, normalizedText, keyword)) {
        relevanceScore += keyword.weight;

        // Track category triggers
        if (keyword.triggers.categories) {
          for (const category of keyword.triggers.categories) {
            const existing = matchedCategories.get(category);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedCategories.set(category, {
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

        // Track party triggers
        if (identifyParties && keyword.triggers.parties) {
          for (const party of keyword.triggers.parties) {
            const existing = matchedParties.get(party);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedParties.set(party, {
                score: keyword.weight,
                keywords: [keyword.keyword],
              });
            }
          }
        }

        // Track office triggers
        if (identifyOffices && keyword.triggers.offices) {
          for (const office of keyword.triggers.offices) {
            const existing = matchedOffices.get(office);
            if (existing) {
              existing.score += keyword.weight;
              existing.keywords.push(keyword.keyword);
            } else {
              matchedOffices.set(office, {
                score: keyword.weight,
                keywords: [keyword.keyword],
              });
            }
          }
        }

        // Track political figures
        if (detectFigures && keyword.politicalFigures) {
          for (const figure of keyword.politicalFigures) {
            if (!mentionedFigures.includes(figure)) {
              mentionedFigures.push(figure);
            }
          }
        }
      }
    }

    // Additional figure detection by name matching
    if (detectFigures) {
      for (const figure of this.figures) {
        const names = [figure.name, ...figure.aliases];
        for (const name of names) {
          if (normalizedText.includes(name.toLowerCase())) {
            if (!mentionedFigures.includes(figure.name)) {
              mentionedFigures.push(figure.name);
              relevanceScore += 10;

              // Add party info
              if (identifyParties && figure.party !== PoliticalParty.UNKNOWN) {
                const existing = matchedParties.get(figure.party);
                if (existing) {
                  existing.score += 10;
                  existing.keywords.push(name);
                } else {
                  matchedParties.set(figure.party, {
                    score: 10,
                    keywords: [name],
                  });
                }
              }

              // Add jurisdiction info
              const existingJur = matchedJurisdictions.get(figure.jurisdiction);
              if (existingJur) {
                existingJur.score += 10;
                existingJur.keywords.push(name);
              } else {
                matchedJurisdictions.set(figure.jurisdiction, {
                  score: 10,
                  keywords: [name],
                });
              }

              // Add office info
              if (identifyOffices && figure.currentOffice) {
                const existingOff = matchedOffices.get(figure.currentOffice);
                if (existingOff) {
                  existingOff.score += 10;
                  existingOff.keywords.push(name);
                } else {
                  matchedOffices.set(figure.currentOffice, {
                    score: 10,
                    keywords: [name],
                  });
                }
              }
            }
            break;
          }
        }
      }
    }

    // Boost score if market is classified as politics
    if (
      classificationResult.primaryCategory === MarketCategory.POLITICS ||
      classificationResult.secondaryCategories.includes(MarketCategory.POLITICS)
    ) {
      relevanceScore += 20;
    }

    // Normalize relevance score to 0-100
    relevanceScore = Math.min(100, relevanceScore);

    // Convert matched data to tags
    for (const [category, data] of matchedCategories.entries()) {
      const normalizedScore = Math.min(100, Math.round((data.score / 50) * 100));
      categoryTags.push({
        type: "category",
        value: category,
        confidence: getConfidenceLevel(normalizedScore),
        confidenceScore: normalizedScore,
        triggerKeywords: data.keywords,
      });
    }

    for (const [jurisdiction, data] of matchedJurisdictions.entries()) {
      const normalizedScore = Math.min(100, Math.round((data.score / 50) * 100));
      jurisdictionTags.push({
        type: "jurisdiction",
        value: jurisdiction,
        confidence: getConfidenceLevel(normalizedScore),
        confidenceScore: normalizedScore,
        triggerKeywords: data.keywords,
      });
    }

    for (const [party, data] of matchedParties.entries()) {
      const normalizedScore = Math.min(100, Math.round((data.score / 50) * 100));
      partyTags.push({
        type: "party",
        value: party,
        confidence: getConfidenceLevel(normalizedScore),
        confidenceScore: normalizedScore,
        triggerKeywords: data.keywords,
      });
    }

    for (const [office, data] of matchedOffices.entries()) {
      const normalizedScore = Math.min(100, Math.round((data.score / 50) * 100));
      officeTags.push({
        type: "office",
        value: office,
        confidence: getConfidenceLevel(normalizedScore),
        confidenceScore: normalizedScore,
        triggerKeywords: data.keywords,
      });
    }

    // Sort tags by confidence score
    categoryTags.sort((a, b) => b.confidenceScore - a.confidenceScore);
    jurisdictionTags.sort((a, b) => b.confidenceScore - a.confidenceScore);
    partyTags.sort((a, b) => b.confidenceScore - a.confidenceScore);
    officeTags.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Determine primary values
    const firstCategoryTag = categoryTags[0];
    const firstJurisdictionTag = jurisdictionTags[0];
    const firstPartyTag = partyTags[0];
    const firstOfficeTag = officeTags[0];

    const primaryCategory = firstCategoryTag ? firstCategoryTag.value as PoliticalEventCategory : null;
    const primaryJurisdiction = firstJurisdictionTag ? firstJurisdictionTag.value as PoliticalJurisdiction : null;
    const primaryParty = firstPartyTag ? firstPartyTag.value as PoliticalParty : null;
    const primaryOffice = firstOfficeTag ? firstOfficeTag.value as PoliticalOffice : null;

    // Determine election and policy status
    const isElectionMarket = categoryTags.some((tag) =>
      isElectionCategory(tag.value as PoliticalEventCategory)
    );
    const isPolicyMarket = categoryTags.some((tag) =>
      isPolicyCategory(tag.value as PoliticalEventCategory)
    );

    // Combine all tags
    const allTags: PoliticalTag[] = [
      ...categoryTags,
      ...jurisdictionTags,
      ...partyTags,
      ...officeTags,
    ];

    const result: PoliticalMarketResult = {
      marketId: market.id,
      question: market.question,
      isPolitical: relevanceScore >= minRelevanceScore,
      relevanceScore,
      primaryCategory,
      categoryTags,
      primaryJurisdiction,
      jurisdictionTags,
      primaryParty,
      partyTags,
      officeType: primaryOffice,
      officeTags,
      allTags,
      isElectionMarket,
      isPolicyMarket,
      mentionedFigures,
      identifiedAt: new Date(),
      fromCache: false,
    };

    // Add to cache
    this.addToCache(cacheKey, result);
    this.identificationCount++;

    if (this.config.debug) {
      console.log(
        `[PoliticalMarketIdentifier] Identified ${market.id}: isPolitical=${result.isPolitical}, score=${relevanceScore}`
      );
    }

    return result;
  }

  /**
   * Identify multiple markets in batch
   */
  identifyMarkets(
    markets: MarketForPoliticalIdentification[],
    options: IdentifyPoliticalOptions = {}
  ): BatchPoliticalIdentificationResult {
    const startTime = Date.now();
    const results = new Map<string, PoliticalMarketResult>();
    const errors = new Map<string, string>();
    const categoryDistribution = new Map<PoliticalEventCategory, number>();
    const jurisdictionDistribution = new Map<PoliticalJurisdiction, number>();
    const partyDistribution = new Map<PoliticalParty, number>();
    let politicalCount = 0;
    let electionCount = 0;
    let policyCount = 0;

    for (const market of markets) {
      try {
        const result = this.identifyMarket(market, options);
        results.set(market.id, result);

        if (result.isPolitical) {
          politicalCount++;

          if (result.isElectionMarket) {
            electionCount++;
          }
          if (result.isPolicyMarket) {
            policyCount++;
          }

          // Update category distribution
          if (result.primaryCategory) {
            const count = categoryDistribution.get(result.primaryCategory) ?? 0;
            categoryDistribution.set(result.primaryCategory, count + 1);
          }

          // Update jurisdiction distribution
          if (result.primaryJurisdiction) {
            const count = jurisdictionDistribution.get(result.primaryJurisdiction) ?? 0;
            jurisdictionDistribution.set(result.primaryJurisdiction, count + 1);
          }

          // Update party distribution
          if (result.primaryParty) {
            const count = partyDistribution.get(result.primaryParty) ?? 0;
            partyDistribution.set(result.primaryParty, count + 1);
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
      politicalCount,
      electionCount,
      policyCount,
      categoryDistribution,
      jurisdictionDistribution,
      partyDistribution,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a market is political
   */
  isPoliticalMarket(
    market: MarketForPoliticalIdentification,
    options?: IdentifyPoliticalOptions
  ): boolean {
    const result = this.identifyMarket(market, options);
    return result.isPolitical;
  }

  /**
   * Check if a market is an election market
   */
  isElectionMarket(
    market: MarketForPoliticalIdentification,
    options?: IdentifyPoliticalOptions
  ): boolean {
    const result = this.identifyMarket(market, options);
    return result.isElectionMarket;
  }

  /**
   * Check if a market is a policy market
   */
  isPolicyMarket(
    market: MarketForPoliticalIdentification,
    options?: IdentifyPoliticalOptions
  ): boolean {
    const result = this.identifyMarket(market, options);
    return result.isPolicyMarket;
  }

  /**
   * Get political markets from a batch
   */
  getPoliticalMarkets(
    markets: MarketForPoliticalIdentification[],
    options?: IdentifyPoliticalOptions
  ): MarketForPoliticalIdentification[] {
    return markets.filter((m) => this.isPoliticalMarket(m, options));
  }

  /**
   * Get election markets from a batch
   */
  getElectionMarkets(
    markets: MarketForPoliticalIdentification[],
    options?: IdentifyPoliticalOptions
  ): MarketForPoliticalIdentification[] {
    return markets.filter((m) => this.isElectionMarket(m, options));
  }

  /**
   * Get policy markets from a batch
   */
  getPolicyMarkets(
    markets: MarketForPoliticalIdentification[],
    options?: IdentifyPoliticalOptions
  ): MarketForPoliticalIdentification[] {
    return markets.filter((m) => this.isPolicyMarket(m, options));
  }

  /**
   * Get markets by political category
   */
  getMarketsByCategory(
    markets: MarketForPoliticalIdentification[],
    category: PoliticalEventCategory,
    options?: IdentifyPoliticalOptions
  ): MarketForPoliticalIdentification[] {
    return markets.filter((m) => {
      const result = this.identifyMarket(m, options);
      return (
        result.isPolitical &&
        result.categoryTags.some((t) => t.value === category)
      );
    });
  }

  /**
   * Get markets by jurisdiction
   */
  getMarketsByJurisdiction(
    markets: MarketForPoliticalIdentification[],
    jurisdiction: PoliticalJurisdiction,
    options?: IdentifyPoliticalOptions
  ): MarketForPoliticalIdentification[] {
    return markets.filter((m) => {
      const result = this.identifyMarket(m, options);
      return (
        result.isPolitical &&
        result.jurisdictionTags.some((t) => t.value === jurisdiction)
      );
    });
  }

  /**
   * Get markets by party
   */
  getMarketsByParty(
    markets: MarketForPoliticalIdentification[],
    party: PoliticalParty,
    options?: IdentifyPoliticalOptions
  ): MarketForPoliticalIdentification[] {
    return markets.filter((m) => {
      const result = this.identifyMarket(m, options);
      return (
        result.isPolitical &&
        result.partyTags.some((t) => t.value === party)
      );
    });
  }

  /**
   * Get identification from cache
   */
  private getFromCache(key: string): PoliticalMarketResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.result, fromCache: true };
  }

  /**
   * Add identification to cache
   */
  private addToCache(key: string, result: PoliticalMarketResult): void {
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
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.config.debug) {
      console.log("[PoliticalMarketIdentifier] Cache cleared");
    }
  }

  /**
   * Get all keywords
   */
  getKeywords(): PoliticalKeyword[] {
    return [...this.keywords];
  }

  /**
   * Get all political figures
   */
  getFigures(): PoliticalFigure[] {
    return [...this.figures];
  }

  /**
   * Get summary statistics
   */
  getSummary(): PoliticalIdentifierSummary {
    const categoryBreakdown = new Map<PoliticalEventCategory, number>();
    const jurisdictionBreakdown = new Map<PoliticalJurisdiction, number>();
    const partyBreakdown = new Map<PoliticalParty, number>();
    let totalRelevanceScore = 0;
    let politicalCount = 0;
    let electionCount = 0;
    let policyCount = 0;

    for (const entry of this.cache.values()) {
      if (Date.now() <= entry.expiresAt) {
        const result = entry.result;

        if (result.isPolitical) {
          politicalCount++;
          totalRelevanceScore += result.relevanceScore;

          if (result.isElectionMarket) {
            electionCount++;
          }
          if (result.isPolicyMarket) {
            policyCount++;
          }

          // Category breakdown
          if (result.primaryCategory) {
            const count = categoryBreakdown.get(result.primaryCategory) ?? 0;
            categoryBreakdown.set(result.primaryCategory, count + 1);
          }

          // Jurisdiction breakdown
          if (result.primaryJurisdiction) {
            const count = jurisdictionBreakdown.get(result.primaryJurisdiction) ?? 0;
            jurisdictionBreakdown.set(result.primaryJurisdiction, count + 1);
          }

          // Party breakdown
          if (result.primaryParty) {
            const count = partyBreakdown.get(result.primaryParty) ?? 0;
            partyBreakdown.set(result.primaryParty, count + 1);
          }
        }
      }
    }

    const totalIdentified = this.cache.size;

    return {
      totalIdentified,
      politicalMarketsCount: politicalCount,
      politicalPercentage:
        totalIdentified > 0
          ? Math.round((politicalCount / totalIdentified) * 1000) / 10
          : 0,
      electionMarketsCount: electionCount,
      policyMarketsCount: policyCount,
      categoryBreakdown,
      jurisdictionBreakdown,
      partyBreakdown,
      averageRelevanceScore:
        politicalCount > 0
          ? Math.round((totalRelevanceScore / politicalCount) * 10) / 10
          : 0,
      cacheHitRate:
        this.identificationCount > 0
          ? Math.round((this.cacheHits / this.identificationCount) * 1000) / 10
          : 0,
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

let sharedInstance: PoliticalMarketIdentifier | null = null;

/**
 * Create a new PoliticalMarketIdentifier instance
 */
export function createPoliticalMarketIdentifier(
  config?: PoliticalMarketIdentifierConfig
): PoliticalMarketIdentifier {
  return new PoliticalMarketIdentifier(config);
}

/**
 * Get the shared PoliticalMarketIdentifier instance
 */
export function getSharedPoliticalMarketIdentifier(): PoliticalMarketIdentifier {
  if (!sharedInstance) {
    sharedInstance = new PoliticalMarketIdentifier();
  }
  return sharedInstance;
}

/**
 * Set the shared PoliticalMarketIdentifier instance
 */
export function setSharedPoliticalMarketIdentifier(
  identifier: PoliticalMarketIdentifier
): void {
  sharedInstance = identifier;
}

/**
 * Reset the shared PoliticalMarketIdentifier instance
 */
export function resetSharedPoliticalMarketIdentifier(): void {
  if (sharedInstance) {
    sharedInstance.clearCache();
  }
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Identify a single market using the shared instance
 */
export function identifyPoliticalMarket(
  market: MarketForPoliticalIdentification,
  options?: IdentifyPoliticalOptions
): PoliticalMarketResult {
  return getSharedPoliticalMarketIdentifier().identifyMarket(market, options);
}

/**
 * Identify multiple markets using the shared instance
 */
export function identifyPoliticalMarkets(
  markets: MarketForPoliticalIdentification[],
  options?: IdentifyPoliticalOptions
): BatchPoliticalIdentificationResult {
  return getSharedPoliticalMarketIdentifier().identifyMarkets(markets, options);
}

/**
 * Check if a market is political using the shared instance
 */
export function isPoliticalMarket(
  market: MarketForPoliticalIdentification,
  options?: IdentifyPoliticalOptions
): boolean {
  return getSharedPoliticalMarketIdentifier().isPoliticalMarket(market, options);
}

/**
 * Check if a market is an election market using the shared instance
 */
export function isElectionMarket(
  market: MarketForPoliticalIdentification,
  options?: IdentifyPoliticalOptions
): boolean {
  return getSharedPoliticalMarketIdentifier().isElectionMarket(market, options);
}

/**
 * Check if a market is a policy market using the shared instance
 */
export function isPolicyMarket(
  market: MarketForPoliticalIdentification,
  options?: IdentifyPoliticalOptions
): boolean {
  return getSharedPoliticalMarketIdentifier().isPolicyMarket(market, options);
}

/**
 * Get political markets from a batch using the shared instance
 */
export function getPoliticalMarkets(
  markets: MarketForPoliticalIdentification[],
  options?: IdentifyPoliticalOptions
): MarketForPoliticalIdentification[] {
  return getSharedPoliticalMarketIdentifier().getPoliticalMarkets(markets, options);
}

/**
 * Get election markets from a batch using the shared instance
 */
export function getElectionMarkets(
  markets: MarketForPoliticalIdentification[],
  options?: IdentifyPoliticalOptions
): MarketForPoliticalIdentification[] {
  return getSharedPoliticalMarketIdentifier().getElectionMarkets(markets, options);
}

/**
 * Get policy markets from a batch using the shared instance
 */
export function getPolicyMarkets(
  markets: MarketForPoliticalIdentification[],
  options?: IdentifyPoliticalOptions
): MarketForPoliticalIdentification[] {
  return getSharedPoliticalMarketIdentifier().getPolicyMarkets(markets, options);
}

/**
 * Get political identifier summary using the shared instance
 */
export function getPoliticalIdentifierSummary(): PoliticalIdentifierSummary {
  return getSharedPoliticalMarketIdentifier().getSummary();
}
