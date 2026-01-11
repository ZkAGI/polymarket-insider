/**
 * Niche Market Watchlist Manager (DET-NICHE-007)
 *
 * Maintain a watchlist of high-priority niche markets for insider trading detection.
 * This module provides functionality to:
 * - Create and manage watchlist data structures
 * - Add/remove markets from the watchlist
 * - Prioritize markets by insider potential
 * - Emit watchlist updates for real-time monitoring
 * - Support configurable priority scoring
 * - Integrate with existing detection modules
 *
 * The watchlist helps focus monitoring efforts on markets where insider trading
 * would be most impactful and detectable.
 */

import { EventEmitter } from "events";
import { MarketCategory } from "../api/gamma/types";
import {
  LiquidityCategory,
  MarketLiquidityScore,
} from "./market-liquidity-scorer";
import { InformationAdvantageTier } from "./information-advantage-identifier";

// ============================================================================
// Types
// ============================================================================

/**
 * Priority level for watchlist markets
 */
export enum WatchlistPriority {
  /** Critical priority - highest monitoring focus */
  CRITICAL = "CRITICAL",
  /** High priority - significant insider potential */
  HIGH = "HIGH",
  /** Medium priority - moderate insider potential */
  MEDIUM = "MEDIUM",
  /** Low priority - basic monitoring */
  LOW = "LOW",
  /** Minimal priority - background monitoring only */
  MINIMAL = "MINIMAL",
}

/**
 * Reason a market was added to the watchlist
 */
export enum WatchlistReason {
  /** Market has high information advantage potential */
  HIGH_INFORMATION_ADVANTAGE = "HIGH_INFORMATION_ADVANTAGE",
  /** Market has thin liquidity (manipulation risk) */
  THIN_LIQUIDITY = "THIN_LIQUIDITY",
  /** Market involves regulatory decisions */
  REGULATORY_DECISION = "REGULATORY_DECISION",
  /** Market involves political events */
  POLITICAL_EVENT = "POLITICAL_EVENT",
  /** Market involves geopolitical events */
  GEOPOLITICAL_EVENT = "GEOPOLITICAL_EVENT",
  /** Market has unusual trading patterns detected */
  UNUSUAL_ACTIVITY = "UNUSUAL_ACTIVITY",
  /** Manually added by user/operator */
  MANUAL_ADDITION = "MANUAL_ADDITION",
  /** Market about to expire (time-sensitive) */
  APPROACHING_EXPIRY = "APPROACHING_EXPIRY",
  /** Pre-event monitoring window */
  PRE_EVENT_MONITORING = "PRE_EVENT_MONITORING",
  /** Related to other watchlist markets */
  RELATED_MARKET = "RELATED_MARKET",
}

/**
 * Status of a watchlist entry
 */
export enum WatchlistStatus {
  /** Actively being monitored */
  ACTIVE = "ACTIVE",
  /** Temporarily paused */
  PAUSED = "PAUSED",
  /** Archived - no longer active but kept for history */
  ARCHIVED = "ARCHIVED",
  /** Pending review */
  PENDING_REVIEW = "PENDING_REVIEW",
}

/**
 * Event type for watchlist updates
 */
export enum WatchlistEventType {
  /** Market added to watchlist */
  MARKET_ADDED = "MARKET_ADDED",
  /** Market removed from watchlist */
  MARKET_REMOVED = "MARKET_REMOVED",
  /** Market priority changed */
  PRIORITY_CHANGED = "PRIORITY_CHANGED",
  /** Market status changed */
  STATUS_CHANGED = "STATUS_CHANGED",
  /** Market metadata updated */
  METADATA_UPDATED = "METADATA_UPDATED",
  /** Bulk update performed */
  BULK_UPDATE = "BULK_UPDATE",
  /** Watchlist cleared */
  WATCHLIST_CLEARED = "WATCHLIST_CLEARED",
}

/**
 * Market data for watchlist entry
 */
export interface WatchlistMarketData {
  /** Market ID */
  marketId: string;
  /** Market question/title */
  question: string;
  /** Market category */
  category: MarketCategory;
  /** Market slug (for URL) */
  slug?: string;
  /** Market end date (if known) */
  endDate?: Date;
  /** Current trading volume */
  volume24hUsd?: number;
  /** Information advantage score (0-100) */
  informationAdvantageScore?: number;
  /** Information advantage tier */
  informationAdvantageTier?: InformationAdvantageTier;
  /** Liquidity score (0-100) */
  liquidityScore?: number;
  /** Liquidity category */
  liquidityCategory?: LiquidityCategory;
  /** Whether market is thin */
  isThinMarket?: boolean;
  /** Insider advantage multiplier */
  insiderAdvantageMultiplier?: number;
  /** Tags for the market */
  tags?: string[];
}

/**
 * Watchlist entry for a market
 */
export interface WatchlistEntry {
  /** Unique entry ID */
  entryId: string;
  /** Market data */
  market: WatchlistMarketData;
  /** Current priority */
  priority: WatchlistPriority;
  /** Priority score (0-100 for ranking) */
  priorityScore: number;
  /** Current status */
  status: WatchlistStatus;
  /** Reasons for being on watchlist */
  reasons: WatchlistReason[];
  /** Notes/comments about this entry */
  notes: string[];
  /** When added to watchlist */
  addedAt: Date;
  /** When last updated */
  updatedAt: Date;
  /** When status last changed */
  statusChangedAt: Date;
  /** User/system that added this entry */
  addedBy: string;
  /** Alert count (times alerts were triggered) */
  alertCount: number;
  /** Last alert timestamp */
  lastAlertAt?: Date;
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Watchlist update event
 */
export interface WatchlistEvent {
  /** Event ID */
  eventId: string;
  /** Event type */
  type: WatchlistEventType;
  /** Market ID (if applicable) */
  marketId?: string;
  /** Entry ID (if applicable) */
  entryId?: string;
  /** Previous state (for changes) */
  previousState?: Partial<WatchlistEntry>;
  /** New state */
  newState?: Partial<WatchlistEntry>;
  /** Event timestamp */
  timestamp: Date;
  /** Event source */
  source: string;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Options for adding a market to the watchlist
 */
export interface AddToWatchlistOptions {
  /** Priority level (auto-calculated if not provided) */
  priority?: WatchlistPriority;
  /** Reasons for adding */
  reasons?: WatchlistReason[];
  /** Initial notes */
  notes?: string[];
  /** Initial status (default: ACTIVE) */
  status?: WatchlistStatus;
  /** Who/what is adding this entry */
  addedBy?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Liquidity score data */
  liquidityScore?: MarketLiquidityScore;
  /** Information advantage score */
  informationAdvantageScore?: number;
  /** Information advantage tier */
  informationAdvantageTier?: InformationAdvantageTier;
}

/**
 * Options for updating a watchlist entry
 */
export interface UpdateWatchlistOptions {
  /** New priority */
  priority?: WatchlistPriority;
  /** New status */
  status?: WatchlistStatus;
  /** Additional reasons to add */
  addReasons?: WatchlistReason[];
  /** Reasons to remove */
  removeReasons?: WatchlistReason[];
  /** Notes to add */
  addNotes?: string[];
  /** Metadata to merge */
  metadata?: Record<string, unknown>;
  /** Updated market data */
  marketData?: Partial<WatchlistMarketData>;
}

/**
 * Filter options for querying the watchlist
 */
export interface WatchlistFilterOptions {
  /** Filter by priority */
  priorities?: WatchlistPriority[];
  /** Filter by status */
  statuses?: WatchlistStatus[];
  /** Filter by reasons */
  reasons?: WatchlistReason[];
  /** Filter by category */
  categories?: MarketCategory[];
  /** Minimum priority score */
  minPriorityScore?: number;
  /** Maximum priority score */
  maxPriorityScore?: number;
  /** Added after this date */
  addedAfter?: Date;
  /** Added before this date */
  addedBefore?: Date;
  /** Search in question text */
  searchText?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field */
  sortBy?: "priorityScore" | "addedAt" | "updatedAt" | "alertCount";
  /** Sort order */
  sortOrder?: "asc" | "desc";
}

/**
 * Watchlist statistics
 */
export interface WatchlistStatistics {
  /** Total entries */
  totalEntries: number;
  /** Active entries */
  activeEntries: number;
  /** Paused entries */
  pausedEntries: number;
  /** Archived entries */
  archivedEntries: number;
  /** Entries by priority */
  byPriority: Record<WatchlistPriority, number>;
  /** Entries by category */
  byCategory: Record<string, number>;
  /** Entries by reason */
  byReason: Record<WatchlistReason, number>;
  /** Total alerts triggered */
  totalAlerts: number;
  /** Average priority score */
  averagePriorityScore: number;
  /** Markets added in last 24h */
  addedLast24h: number;
  /** Markets updated in last 24h */
  updatedLast24h: number;
}

/**
 * Watchlist summary for export
 */
export interface WatchlistSummary {
  /** Statistics */
  statistics: WatchlistStatistics;
  /** Top priority markets */
  topPriorityMarkets: WatchlistEntry[];
  /** Recently added markets */
  recentlyAdded: WatchlistEntry[];
  /** Markets with recent alerts */
  recentAlerts: WatchlistEntry[];
  /** Summary timestamp */
  generatedAt: Date;
  /** Cache info */
  cacheSize: number;
  /** Events count */
  eventCount: number;
}

/**
 * Priority weights for score calculation
 */
export interface PriorityWeights {
  /** Weight for information advantage (default: 0.35) */
  informationAdvantage: number;
  /** Weight for thin liquidity (default: 0.30) */
  liquidityRisk: number;
  /** Weight for category importance (default: 0.20) */
  categoryImportance: number;
  /** Weight for time sensitivity (default: 0.15) */
  timeSensitivity: number;
}

/**
 * Configuration for the watchlist manager
 */
export interface NicheMarketWatchlistConfig {
  /** Maximum watchlist size (default: 1000) */
  maxWatchlistSize?: number;
  /** Default priority for auto-added markets (default: MEDIUM) */
  defaultPriority?: WatchlistPriority;
  /** Auto-calculate priority from scores (default: true) */
  autoCalculatePriority?: boolean;
  /** Priority score weights */
  priorityWeights?: Partial<PriorityWeights>;
  /** Maximum events to keep in history (default: 1000) */
  maxEventHistory?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Internal fully resolved config type
 */
interface ResolvedConfig {
  maxWatchlistSize: number;
  defaultPriority: WatchlistPriority;
  autoCalculatePriority: boolean;
  priorityWeights: PriorityWeights;
  maxEventHistory: number;
  debug: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration values */
const DEFAULT_MAX_WATCHLIST_SIZE = 1000;
const DEFAULT_MAX_EVENT_HISTORY = 1000;

/** Default priority weights */
const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  informationAdvantage: 0.35,
  liquidityRisk: 0.30,
  categoryImportance: 0.20,
  timeSensitivity: 0.15,
};

/** Priority score thresholds */
const PRIORITY_THRESHOLDS: Array<{ min: number; priority: WatchlistPriority }> = [
  { min: 80, priority: WatchlistPriority.CRITICAL },
  { min: 60, priority: WatchlistPriority.HIGH },
  { min: 40, priority: WatchlistPriority.MEDIUM },
  { min: 20, priority: WatchlistPriority.LOW },
  { min: 0, priority: WatchlistPriority.MINIMAL },
];

/** Category importance scores (for priority calculation) */
const CATEGORY_IMPORTANCE: Record<MarketCategory, number> = {
  [MarketCategory.POLITICS]: 90,
  [MarketCategory.GEOPOLITICS]: 85,
  [MarketCategory.LEGAL]: 80,
  [MarketCategory.ECONOMY]: 75,
  [MarketCategory.BUSINESS]: 70,
  [MarketCategory.HEALTH]: 65,
  [MarketCategory.TECH]: 60,
  [MarketCategory.SCIENCE]: 55,
  [MarketCategory.CRYPTO]: 50,
  [MarketCategory.SPORTS]: 40,
  [MarketCategory.ENTERTAINMENT]: 35,
  [MarketCategory.WEATHER]: 30,
  [MarketCategory.CULTURE]: 25,
  [MarketCategory.OTHER]: 20,
};

/** Reason importance scores */
const REASON_IMPORTANCE: Record<WatchlistReason, number> = {
  [WatchlistReason.HIGH_INFORMATION_ADVANTAGE]: 95,
  [WatchlistReason.REGULATORY_DECISION]: 90,
  [WatchlistReason.POLITICAL_EVENT]: 85,
  [WatchlistReason.GEOPOLITICAL_EVENT]: 85,
  [WatchlistReason.THIN_LIQUIDITY]: 80,
  [WatchlistReason.UNUSUAL_ACTIVITY]: 75,
  [WatchlistReason.PRE_EVENT_MONITORING]: 70,
  [WatchlistReason.APPROACHING_EXPIRY]: 65,
  [WatchlistReason.RELATED_MARKET]: 50,
  [WatchlistReason.MANUAL_ADDITION]: 40,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique entry ID
 */
function generateEntryId(): string {
  return `wl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get priority from score
 */
function getPriorityFromScore(score: number): WatchlistPriority {
  for (const threshold of PRIORITY_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.priority;
    }
  }
  return WatchlistPriority.MINIMAL;
}

/**
 * Calculate priority score from market data
 */
function calculatePriorityScore(
  market: WatchlistMarketData,
  reasons: WatchlistReason[],
  weights: typeof DEFAULT_PRIORITY_WEIGHTS
): number {
  let score = 0;

  // Information advantage component
  if (market.informationAdvantageScore !== undefined) {
    score += market.informationAdvantageScore * weights.informationAdvantage;
  } else if (market.informationAdvantageTier) {
    const tierScores: Record<InformationAdvantageTier, number> = {
      [InformationAdvantageTier.CRITICAL]: 100,
      [InformationAdvantageTier.VERY_HIGH]: 85,
      [InformationAdvantageTier.HIGH]: 70,
      [InformationAdvantageTier.MEDIUM]: 50,
      [InformationAdvantageTier.LOW]: 30,
      [InformationAdvantageTier.MINIMAL]: 10,
    };
    score += tierScores[market.informationAdvantageTier] * weights.informationAdvantage;
  }

  // Liquidity risk component (inverted - thin = higher risk = higher score)
  if (market.liquidityScore !== undefined) {
    const liquidityRiskScore = 100 - market.liquidityScore;
    score += liquidityRiskScore * weights.liquidityRisk;
  } else if (market.isThinMarket) {
    score += 80 * weights.liquidityRisk;
  } else if (market.insiderAdvantageMultiplier !== undefined) {
    // Higher multiplier = thinner market = higher risk
    const riskScore = Math.min(100, market.insiderAdvantageMultiplier * 33);
    score += riskScore * weights.liquidityRisk;
  }

  // Category importance component
  const categoryScore = CATEGORY_IMPORTANCE[market.category] || 20;
  score += categoryScore * weights.categoryImportance;

  // Time sensitivity component (based on reasons)
  const hasTimeSensitiveReason = reasons.some((r) =>
    [
      WatchlistReason.APPROACHING_EXPIRY,
      WatchlistReason.PRE_EVENT_MONITORING,
      WatchlistReason.REGULATORY_DECISION,
    ].includes(r)
  );
  if (hasTimeSensitiveReason) {
    score += 80 * weights.timeSensitivity;
  }

  // Bonus for multiple high-importance reasons
  const highImportanceReasons = reasons.filter(
    (r) => REASON_IMPORTANCE[r] >= 75
  );
  if (highImportanceReasons.length >= 2) {
    score = Math.min(100, score * 1.1);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ============================================================================
// NicheMarketWatchlist Class
// ============================================================================

/**
 * Niche Market Watchlist Manager
 *
 * Maintains a prioritized watchlist of markets for insider trading monitoring.
 */
export class NicheMarketWatchlist extends EventEmitter {
  private entries: Map<string, WatchlistEntry> = new Map();
  private marketIdToEntryId: Map<string, string> = new Map();
  private eventHistory: WatchlistEvent[] = [];
  private config: ResolvedConfig;
  private startTime: Date;

  constructor(config: NicheMarketWatchlistConfig = {}) {
    super();
    this.config = {
      maxWatchlistSize: config.maxWatchlistSize ?? DEFAULT_MAX_WATCHLIST_SIZE,
      defaultPriority: config.defaultPriority ?? WatchlistPriority.MEDIUM,
      autoCalculatePriority: config.autoCalculatePriority ?? true,
      priorityWeights: {
        ...DEFAULT_PRIORITY_WEIGHTS,
        ...config.priorityWeights,
      },
      maxEventHistory: config.maxEventHistory ?? DEFAULT_MAX_EVENT_HISTORY,
      debug: config.debug ?? false,
    };
    this.startTime = new Date();
  }

  // ==========================================================================
  // Event Management
  // ==========================================================================

  /**
   * Record and emit an event
   */
  private recordEvent(event: Omit<WatchlistEvent, "eventId" | "timestamp">): void {
    const fullEvent: WatchlistEvent = {
      ...event,
      eventId: generateEventId(),
      timestamp: new Date(),
    };

    // Add to history
    this.eventHistory.push(fullEvent);

    // Trim history if needed
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxEventHistory);
    }

    // Emit event
    this.emit("watchlistUpdate", fullEvent);
    this.emit(event.type, fullEvent);

    if (this.config.debug) {
      console.log(
        `[NicheMarketWatchlist] Event: ${event.type} for ${event.marketId || "watchlist"}`
      );
    }
  }

  // ==========================================================================
  // Core Operations
  // ==========================================================================

  /**
   * Add a market to the watchlist
   */
  addMarket(
    market: WatchlistMarketData,
    options: AddToWatchlistOptions = {}
  ): WatchlistEntry {
    // Check if already exists
    const existingEntryId = this.marketIdToEntryId.get(market.marketId);
    if (existingEntryId) {
      throw new Error(`Market ${market.marketId} is already on the watchlist`);
    }

    // Check size limit
    if (this.entries.size >= this.config.maxWatchlistSize) {
      throw new Error(
        `Watchlist size limit (${this.config.maxWatchlistSize}) reached`
      );
    }

    // Apply liquidity score data if provided
    if (options.liquidityScore) {
      market.liquidityScore = options.liquidityScore.liquidityScore;
      market.liquidityCategory = options.liquidityScore.category;
      market.isThinMarket = options.liquidityScore.isThinMarket;
      market.insiderAdvantageMultiplier =
        options.liquidityScore.insiderAdvantageMultiplier;
    }

    // Apply information advantage data if provided
    if (options.informationAdvantageScore !== undefined) {
      market.informationAdvantageScore = options.informationAdvantageScore;
    }
    if (options.informationAdvantageTier) {
      market.informationAdvantageTier = options.informationAdvantageTier;
    }

    const reasons = options.reasons || [WatchlistReason.MANUAL_ADDITION];

    // Calculate priority if auto-calculate is enabled
    let priority = options.priority || this.config.defaultPriority;
    let priorityScore = 50;

    if (this.config.autoCalculatePriority && !options.priority) {
      priorityScore = calculatePriorityScore(
        market,
        reasons,
        this.config.priorityWeights
      );
      priority = getPriorityFromScore(priorityScore);
    } else if (options.priority) {
      // Set score based on provided priority
      const priorityScores: Record<WatchlistPriority, number> = {
        [WatchlistPriority.CRITICAL]: 90,
        [WatchlistPriority.HIGH]: 70,
        [WatchlistPriority.MEDIUM]: 50,
        [WatchlistPriority.LOW]: 30,
        [WatchlistPriority.MINIMAL]: 10,
      };
      priorityScore = priorityScores[priority];
    }

    const now = new Date();
    const entryId = generateEntryId();

    const entry: WatchlistEntry = {
      entryId,
      market,
      priority,
      priorityScore,
      status: options.status || WatchlistStatus.ACTIVE,
      reasons,
      notes: options.notes || [],
      addedAt: now,
      updatedAt: now,
      statusChangedAt: now,
      addedBy: options.addedBy || "system",
      alertCount: 0,
      metadata: options.metadata || {},
    };

    // Store entry
    this.entries.set(entryId, entry);
    this.marketIdToEntryId.set(market.marketId, entryId);

    // Record event
    this.recordEvent({
      type: WatchlistEventType.MARKET_ADDED,
      marketId: market.marketId,
      entryId,
      newState: entry,
      source: options.addedBy || "system",
    });

    if (this.config.debug) {
      console.log(
        `[NicheMarketWatchlist] Added market ${market.marketId} with priority ${priority} (score: ${priorityScore})`
      );
    }

    return entry;
  }

  /**
   * Remove a market from the watchlist
   */
  removeMarket(marketId: string, source: string = "system"): boolean {
    const entryId = this.marketIdToEntryId.get(marketId);
    if (!entryId) {
      return false;
    }

    const entry = this.entries.get(entryId);
    if (!entry) {
      return false;
    }

    // Remove from maps
    this.entries.delete(entryId);
    this.marketIdToEntryId.delete(marketId);

    // Record event
    this.recordEvent({
      type: WatchlistEventType.MARKET_REMOVED,
      marketId,
      entryId,
      previousState: entry,
      source,
    });

    if (this.config.debug) {
      console.log(`[NicheMarketWatchlist] Removed market ${marketId}`);
    }

    return true;
  }

  /**
   * Update a watchlist entry
   */
  updateEntry(
    marketId: string,
    options: UpdateWatchlistOptions,
    source: string = "system"
  ): WatchlistEntry | null {
    const entryId = this.marketIdToEntryId.get(marketId);
    if (!entryId) {
      return null;
    }

    const entry = this.entries.get(entryId);
    if (!entry) {
      return null;
    }

    const previousState = { ...entry };
    const now = new Date();

    // Update priority
    if (options.priority !== undefined) {
      entry.priority = options.priority;
      const priorityScores: Record<WatchlistPriority, number> = {
        [WatchlistPriority.CRITICAL]: 90,
        [WatchlistPriority.HIGH]: 70,
        [WatchlistPriority.MEDIUM]: 50,
        [WatchlistPriority.LOW]: 30,
        [WatchlistPriority.MINIMAL]: 10,
      };
      entry.priorityScore = priorityScores[options.priority];

      this.recordEvent({
        type: WatchlistEventType.PRIORITY_CHANGED,
        marketId,
        entryId,
        previousState: { priority: previousState.priority },
        newState: { priority: entry.priority },
        source,
      });
    }

    // Update status
    if (options.status !== undefined) {
      entry.status = options.status;
      entry.statusChangedAt = now;

      this.recordEvent({
        type: WatchlistEventType.STATUS_CHANGED,
        marketId,
        entryId,
        previousState: { status: previousState.status },
        newState: { status: entry.status },
        source,
      });
    }

    // Update reasons
    if (options.addReasons) {
      for (const reason of options.addReasons) {
        if (!entry.reasons.includes(reason)) {
          entry.reasons.push(reason);
        }
      }
    }
    if (options.removeReasons) {
      entry.reasons = entry.reasons.filter(
        (r) => !options.removeReasons!.includes(r)
      );
    }

    // Update notes
    if (options.addNotes) {
      entry.notes.push(...options.addNotes);
    }

    // Update metadata
    if (options.metadata) {
      entry.metadata = { ...entry.metadata, ...options.metadata };
    }

    // Update market data
    if (options.marketData) {
      entry.market = { ...entry.market, ...options.marketData };
    }

    entry.updatedAt = now;

    // Recalculate priority if auto-calculate enabled
    if (
      this.config.autoCalculatePriority &&
      options.priority === undefined &&
      (options.addReasons || options.marketData)
    ) {
      entry.priorityScore = calculatePriorityScore(
        entry.market,
        entry.reasons,
        this.config.priorityWeights
      );
      entry.priority = getPriorityFromScore(entry.priorityScore);
    }

    this.recordEvent({
      type: WatchlistEventType.METADATA_UPDATED,
      marketId,
      entryId,
      previousState,
      newState: entry,
      source,
    });

    return entry;
  }

  /**
   * Record an alert for a market
   */
  recordAlert(marketId: string): boolean {
    const entryId = this.marketIdToEntryId.get(marketId);
    if (!entryId) {
      return false;
    }

    const entry = this.entries.get(entryId);
    if (!entry) {
      return false;
    }

    entry.alertCount++;
    entry.lastAlertAt = new Date();
    entry.updatedAt = new Date();

    return true;
  }

  /**
   * Archive a market (keep in history but mark as archived)
   */
  archiveMarket(marketId: string, source: string = "system"): boolean {
    return (
      this.updateEntry(
        marketId,
        { status: WatchlistStatus.ARCHIVED },
        source
      ) !== null
    );
  }

  /**
   * Pause monitoring for a market
   */
  pauseMarket(marketId: string, source: string = "system"): boolean {
    return (
      this.updateEntry(
        marketId,
        { status: WatchlistStatus.PAUSED },
        source
      ) !== null
    );
  }

  /**
   * Resume monitoring for a market
   */
  resumeMarket(marketId: string, source: string = "system"): boolean {
    return (
      this.updateEntry(
        marketId,
        { status: WatchlistStatus.ACTIVE },
        source
      ) !== null
    );
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get entry by market ID
   */
  getEntry(marketId: string): WatchlistEntry | null {
    const entryId = this.marketIdToEntryId.get(marketId);
    if (!entryId) {
      return null;
    }
    return this.entries.get(entryId) || null;
  }

  /**
   * Get entry by entry ID
   */
  getEntryById(entryId: string): WatchlistEntry | null {
    return this.entries.get(entryId) || null;
  }

  /**
   * Check if market is on watchlist
   */
  hasMarket(marketId: string): boolean {
    return this.marketIdToEntryId.has(marketId);
  }

  /**
   * Get all entries matching filter criteria
   */
  getEntries(options: WatchlistFilterOptions = {}): WatchlistEntry[] {
    let results = Array.from(this.entries.values());

    // Apply filters
    if (options.priorities && options.priorities.length > 0) {
      results = results.filter((e) => options.priorities!.includes(e.priority));
    }
    if (options.statuses && options.statuses.length > 0) {
      results = results.filter((e) => options.statuses!.includes(e.status));
    }
    if (options.reasons && options.reasons.length > 0) {
      results = results.filter((e) =>
        e.reasons.some((r) => options.reasons!.includes(r))
      );
    }
    if (options.categories && options.categories.length > 0) {
      results = results.filter((e) =>
        options.categories!.includes(e.market.category)
      );
    }
    if (options.minPriorityScore !== undefined) {
      results = results.filter(
        (e) => e.priorityScore >= options.minPriorityScore!
      );
    }
    if (options.maxPriorityScore !== undefined) {
      results = results.filter(
        (e) => e.priorityScore <= options.maxPriorityScore!
      );
    }
    if (options.addedAfter) {
      results = results.filter((e) => e.addedAt >= options.addedAfter!);
    }
    if (options.addedBefore) {
      results = results.filter((e) => e.addedAt <= options.addedBefore!);
    }
    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      results = results.filter((e) =>
        e.market.question.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    const sortBy = options.sortBy || "priorityScore";
    const sortOrder = options.sortOrder || "desc";
    results.sort((a, b) => {
      let aVal: number | Date;
      let bVal: number | Date;

      switch (sortBy) {
        case "priorityScore":
          aVal = a.priorityScore;
          bVal = b.priorityScore;
          break;
        case "addedAt":
          aVal = a.addedAt.getTime();
          bVal = b.addedAt.getTime();
          break;
        case "updatedAt":
          aVal = a.updatedAt.getTime();
          bVal = b.updatedAt.getTime();
          break;
        case "alertCount":
          aVal = a.alertCount;
          bVal = b.alertCount;
          break;
        default:
          aVal = a.priorityScore;
          bVal = b.priorityScore;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      }
      return 0;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get entries by priority
   */
  getEntriesByPriority(priority: WatchlistPriority): WatchlistEntry[] {
    return this.getEntries({ priorities: [priority] });
  }

  /**
   * Get active entries only
   */
  getActiveEntries(): WatchlistEntry[] {
    return this.getEntries({ statuses: [WatchlistStatus.ACTIVE] });
  }

  /**
   * Get top N priority entries
   */
  getTopPriorityEntries(limit: number = 10): WatchlistEntry[] {
    return this.getEntries({
      statuses: [WatchlistStatus.ACTIVE],
      sortBy: "priorityScore",
      sortOrder: "desc",
      limit,
    });
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: MarketCategory): WatchlistEntry[] {
    return this.getEntries({ categories: [category] });
  }

  /**
   * Get entries by reason
   */
  getEntriesByReason(reason: WatchlistReason): WatchlistEntry[] {
    return this.getEntries({ reasons: [reason] });
  }

  /**
   * Get all market IDs on watchlist
   */
  getMarketIds(): string[] {
    return Array.from(this.marketIdToEntryId.keys());
  }

  /**
   * Get entry count
   */
  getCount(): number {
    return this.entries.size;
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Add multiple markets to watchlist
   */
  addMarkets(
    markets: Array<{
      market: WatchlistMarketData;
      options?: AddToWatchlistOptions;
    }>
  ): Array<{ market: WatchlistMarketData; entry?: WatchlistEntry; error?: string }> {
    const results: Array<{
      market: WatchlistMarketData;
      entry?: WatchlistEntry;
      error?: string;
    }> = [];

    for (const { market, options } of markets) {
      try {
        const entry = this.addMarket(market, options);
        results.push({ market, entry });
      } catch (error) {
        results.push({
          market,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    this.recordEvent({
      type: WatchlistEventType.BULK_UPDATE,
      source: "system",
      data: {
        operation: "addMarkets",
        total: markets.length,
        success: results.filter((r) => r.entry).length,
        errors: results.filter((r) => r.error).length,
      },
    });

    return results;
  }

  /**
   * Remove multiple markets from watchlist
   */
  removeMarkets(marketIds: string[], source: string = "system"): number {
    let removed = 0;
    for (const marketId of marketIds) {
      if (this.removeMarket(marketId, source)) {
        removed++;
      }
    }

    this.recordEvent({
      type: WatchlistEventType.BULK_UPDATE,
      source,
      data: {
        operation: "removeMarkets",
        total: marketIds.length,
        removed,
      },
    });

    return removed;
  }

  /**
   * Reprioritize all entries (recalculate priority scores)
   */
  reprioritizeAll(): number {
    let updated = 0;
    for (const entry of this.entries.values()) {
      const previousScore = entry.priorityScore;
      const previousPriority = entry.priority;

      entry.priorityScore = calculatePriorityScore(
        entry.market,
        entry.reasons,
        this.config.priorityWeights
      );
      entry.priority = getPriorityFromScore(entry.priorityScore);

      if (
        entry.priorityScore !== previousScore ||
        entry.priority !== previousPriority
      ) {
        entry.updatedAt = new Date();
        updated++;
      }
    }

    if (updated > 0) {
      this.recordEvent({
        type: WatchlistEventType.BULK_UPDATE,
        source: "system",
        data: {
          operation: "reprioritizeAll",
          updated,
        },
      });
    }

    return updated;
  }

  /**
   * Clear the entire watchlist
   */
  clear(source: string = "system"): number {
    const count = this.entries.size;
    this.entries.clear();
    this.marketIdToEntryId.clear();

    this.recordEvent({
      type: WatchlistEventType.WATCHLIST_CLEARED,
      source,
      data: { entriesCleared: count },
    });

    return count;
  }

  // ==========================================================================
  // Statistics & Summary
  // ==========================================================================

  /**
   * Get watchlist statistics
   */
  getStatistics(): WatchlistStatistics {
    const entries = Array.from(this.entries.values());
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const byPriority: Record<WatchlistPriority, number> = {
      [WatchlistPriority.CRITICAL]: 0,
      [WatchlistPriority.HIGH]: 0,
      [WatchlistPriority.MEDIUM]: 0,
      [WatchlistPriority.LOW]: 0,
      [WatchlistPriority.MINIMAL]: 0,
    };

    const byCategory: Record<string, number> = {};

    const byReason: Record<WatchlistReason, number> = {
      [WatchlistReason.HIGH_INFORMATION_ADVANTAGE]: 0,
      [WatchlistReason.THIN_LIQUIDITY]: 0,
      [WatchlistReason.REGULATORY_DECISION]: 0,
      [WatchlistReason.POLITICAL_EVENT]: 0,
      [WatchlistReason.GEOPOLITICAL_EVENT]: 0,
      [WatchlistReason.UNUSUAL_ACTIVITY]: 0,
      [WatchlistReason.MANUAL_ADDITION]: 0,
      [WatchlistReason.APPROACHING_EXPIRY]: 0,
      [WatchlistReason.PRE_EVENT_MONITORING]: 0,
      [WatchlistReason.RELATED_MARKET]: 0,
    };

    let activeCount = 0;
    let pausedCount = 0;
    let archivedCount = 0;
    let totalAlerts = 0;
    let totalPriorityScore = 0;
    let addedLast24h = 0;
    let updatedLast24h = 0;

    for (const entry of entries) {
      // Status counts
      switch (entry.status) {
        case WatchlistStatus.ACTIVE:
          activeCount++;
          break;
        case WatchlistStatus.PAUSED:
          pausedCount++;
          break;
        case WatchlistStatus.ARCHIVED:
          archivedCount++;
          break;
      }

      // Priority counts
      byPriority[entry.priority]++;

      // Category counts
      const cat = entry.market.category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      // Reason counts
      for (const reason of entry.reasons) {
        byReason[reason]++;
      }

      // Totals
      totalAlerts += entry.alertCount;
      totalPriorityScore += entry.priorityScore;

      // Time-based counts
      if (entry.addedAt >= last24h) {
        addedLast24h++;
      }
      if (entry.updatedAt >= last24h) {
        updatedLast24h++;
      }
    }

    return {
      totalEntries: entries.length,
      activeEntries: activeCount,
      pausedEntries: pausedCount,
      archivedEntries: archivedCount,
      byPriority,
      byCategory,
      byReason,
      totalAlerts,
      averagePriorityScore:
        entries.length > 0
          ? Math.round(totalPriorityScore / entries.length)
          : 0,
      addedLast24h,
      updatedLast24h,
    };
  }

  /**
   * Get watchlist summary
   */
  getSummary(): WatchlistSummary {
    return {
      statistics: this.getStatistics(),
      topPriorityMarkets: this.getTopPriorityEntries(10),
      recentlyAdded: this.getEntries({
        sortBy: "addedAt",
        sortOrder: "desc",
        limit: 10,
      }),
      recentAlerts: this.getEntries({
        sortBy: "alertCount",
        sortOrder: "desc",
        limit: 10,
      }).filter((e) => e.alertCount > 0),
      generatedAt: new Date(),
      cacheSize: this.entries.size,
      eventCount: this.eventHistory.length,
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): WatchlistEvent[] {
    return this.eventHistory.slice(-limit).reverse();
  }

  /**
   * Get events for a specific market
   */
  getMarketEvents(marketId: string): WatchlistEvent[] {
    return this.eventHistory.filter((e) => e.marketId === marketId);
  }

  /**
   * Get configuration
   */
  getConfig(): ResolvedConfig {
    return { ...this.config };
  }

  /**
   * Get uptime
   */
  getUptimeMs(): number {
    return Date.now() - this.startTime.getTime();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new NicheMarketWatchlist instance
 */
export function createNicheMarketWatchlist(
  config?: NicheMarketWatchlistConfig
): NicheMarketWatchlist {
  return new NicheMarketWatchlist(config);
}

// ============================================================================
// Shared Instance
// ============================================================================

let sharedWatchlist: NicheMarketWatchlist | null = null;

/**
 * Get the shared NicheMarketWatchlist instance
 */
export function getSharedNicheMarketWatchlist(): NicheMarketWatchlist {
  if (!sharedWatchlist) {
    sharedWatchlist = new NicheMarketWatchlist();
  }
  return sharedWatchlist;
}

/**
 * Set the shared NicheMarketWatchlist instance
 */
export function setSharedNicheMarketWatchlist(
  watchlist: NicheMarketWatchlist
): void {
  sharedWatchlist = watchlist;
}

/**
 * Reset the shared NicheMarketWatchlist instance
 */
export function resetSharedNicheMarketWatchlist(): void {
  if (sharedWatchlist) {
    sharedWatchlist.clear();
  }
  sharedWatchlist = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add a market to the shared watchlist
 */
export function addToWatchlist(
  market: WatchlistMarketData,
  options?: AddToWatchlistOptions
): WatchlistEntry {
  return getSharedNicheMarketWatchlist().addMarket(market, options);
}

/**
 * Remove a market from the shared watchlist
 */
export function removeFromWatchlist(marketId: string): boolean {
  return getSharedNicheMarketWatchlist().removeMarket(marketId);
}

/**
 * Check if a market is on the shared watchlist
 */
export function isOnWatchlist(marketId: string): boolean {
  return getSharedNicheMarketWatchlist().hasMarket(marketId);
}

/**
 * Get watchlist entry for a market
 */
export function getWatchlistEntry(marketId: string): WatchlistEntry | null {
  return getSharedNicheMarketWatchlist().getEntry(marketId);
}

/**
 * Get all active watchlist entries
 */
export function getActiveWatchlistEntries(): WatchlistEntry[] {
  return getSharedNicheMarketWatchlist().getActiveEntries();
}

/**
 * Get top priority watchlist entries
 */
export function getTopPriorityWatchlistEntries(
  limit?: number
): WatchlistEntry[] {
  return getSharedNicheMarketWatchlist().getTopPriorityEntries(limit);
}

/**
 * Get watchlist summary
 */
export function getWatchlistSummary(): WatchlistSummary {
  return getSharedNicheMarketWatchlist().getSummary();
}

/**
 * Get watchlist statistics
 */
export function getWatchlistStatistics(): WatchlistStatistics {
  return getSharedNicheMarketWatchlist().getStatistics();
}
