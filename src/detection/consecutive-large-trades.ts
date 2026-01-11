/**
 * Consecutive Large Trade Detector (DET-VOL-008)
 *
 * Detect series of large trades in quick succession for whale burst detection.
 *
 * Features:
 * - Track trade sequences per market and wallet
 * - Define configurable consecutive trade windows
 * - Flag burst patterns (multiple large trades in short time)
 * - Calculate burst intensity and severity
 * - Event emission for burst detection
 * - Support for market-specific and wallet-specific burst tracking
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of burst pattern detected
 */
export enum BurstPatternType {
  /** Single wallet making multiple large trades quickly */
  WALLET_BURST = "WALLET_BURST",
  /** Multiple wallets making large trades on same market quickly */
  MARKET_BURST = "MARKET_BURST",
  /** Coordinated bursts from related wallets */
  COORDINATED_BURST = "COORDINATED_BURST",
  /** Both wallet and market burst detected */
  COMBINED_BURST = "COMBINED_BURST",
}

/**
 * Severity level of burst activity
 */
export enum BurstSeverity {
  /** Low severity - minor burst activity */
  LOW = "LOW",
  /** Medium severity - notable burst activity */
  MEDIUM = "MEDIUM",
  /** High severity - significant burst activity */
  HIGH = "HIGH",
  /** Critical severity - extreme burst activity */
  CRITICAL = "CRITICAL",
}

/**
 * Burst state (active or ended)
 */
export enum BurstState {
  /** No active burst */
  INACTIVE = "INACTIVE",
  /** Burst is currently active */
  ACTIVE = "ACTIVE",
  /** Burst has just ended */
  ENDED = "ENDED",
}

/**
 * A single trade in a sequence
 */
export interface SequenceTrade {
  /** Unique trade identifier */
  tradeId: string;

  /** Market identifier */
  marketId: string;

  /** Wallet address */
  walletAddress: string;

  /** Trade size in USD */
  sizeUsd: number;

  /** Trade timestamp in milliseconds */
  timestamp: number;

  /** Trade side (buy/sell) */
  side?: "BUY" | "SELL";

  /** Was this flagged as a large trade */
  isLargeTrade: boolean;

  /** Z-score if available */
  zScore?: number;

  /** Percentile rank if available */
  percentileRank?: number;
}

/**
 * Burst detection result for a single check
 */
export interface BurstDetectionResult {
  /** Trade that was checked */
  trade: SequenceTrade;

  /** Whether this trade is part of a burst */
  isBurst: boolean;

  /** Current burst state */
  state: BurstState;

  /** Burst pattern type if detected */
  patternType: BurstPatternType | null;

  /** Severity if burst detected */
  severity: BurstSeverity | null;

  /** Number of consecutive large trades in current burst */
  consecutiveCount: number;

  /** Total volume in burst */
  burstVolumeUsd: number;

  /** Burst duration in milliseconds */
  burstDurationMs: number;

  /** Burst intensity (trades per minute) */
  burstIntensity: number;

  /** Average trade size in burst */
  averageTradeSize: number;

  /** Time since last large trade in milliseconds */
  timeSinceLastLargeTrade: number | null;

  /** Detection timestamp */
  detectedAt: Date;

  /** Related burst event if new burst detected */
  burstEvent: BurstEvent | null;
}

/**
 * Burst event emitted when burst pattern is detected
 */
export interface BurstEvent {
  /** Unique event identifier */
  eventId: string;

  /** Market where burst occurred */
  marketId: string;

  /** Wallet(s) involved in burst */
  walletAddresses: string[];

  /** Pattern type */
  patternType: BurstPatternType;

  /** Severity level */
  severity: BurstSeverity;

  /** Number of consecutive large trades */
  consecutiveCount: number;

  /** Total volume in burst */
  totalVolumeUsd: number;

  /** Burst start time */
  startTime: Date;

  /** Burst end time (if ended) */
  endTime: Date | null;

  /** Duration in milliseconds */
  durationMs: number;

  /** Burst intensity (trades per minute) */
  intensity: number;

  /** Average trade size */
  averageTradeSize: number;

  /** Largest trade in burst */
  largestTradeSize: number;

  /** Trade IDs in burst */
  tradeIds: string[];

  /** Detection timestamp */
  detectedAt: Date;

  /** Context information */
  context: {
    /** Is this a continuation of a previous burst */
    isContinuation: boolean;
    /** Previous burst event ID if continuation */
    previousEventId: string | null;
    /** Total bursts in last hour for this market */
    marketBurstsLastHour: number;
    /** Total bursts in last hour for primary wallet */
    walletBurstsLastHour: number;
  };
}

/**
 * Burst state tracking for a market
 */
interface MarketBurstState {
  /** Currently in burst state */
  inBurst: boolean;

  /** Burst start time */
  burstStartTime: number | null;

  /** Last large trade time */
  lastLargeTradeTime: number | null;

  /** Consecutive large trades in current burst */
  consecutiveCount: number;

  /** Total volume in current burst */
  burstVolumeUsd: number;

  /** Largest trade in current burst */
  largestTradeSize: number;

  /** Trade IDs in current burst */
  tradeIds: string[];

  /** Wallet addresses in current burst */
  walletAddresses: Set<string>;

  /** Recent burst times for frequency tracking */
  recentBurstTimes: number[];

  /** Last burst event ID */
  lastBurstEventId: string | null;
}

/**
 * Burst state tracking for a wallet
 */
interface WalletBurstState {
  /** Currently in burst state */
  inBurst: boolean;

  /** Burst start time */
  burstStartTime: number | null;

  /** Last large trade time */
  lastLargeTradeTime: number | null;

  /** Consecutive large trades in current burst */
  consecutiveCount: number;

  /** Total volume in current burst */
  burstVolumeUsd: number;

  /** Largest trade in current burst */
  largestTradeSize: number;

  /** Trade IDs in current burst */
  tradeIds: string[];

  /** Markets traded in current burst */
  marketIds: Set<string>;

  /** Recent burst times for frequency tracking */
  recentBurstTimes: number[];

  /** Last burst event ID */
  lastBurstEventId: string | null;
}

/**
 * Configuration for burst thresholds
 */
export interface BurstThresholdConfig {
  /** Minimum consecutive large trades for a burst (default: 3) */
  minConsecutiveTrades: number;

  /** Maximum time gap between trades in milliseconds (default: 5 minutes) */
  maxTradeGapMs: number;

  /** Z-score threshold for large trade (default: 2.0) */
  largeTradeZScoreThreshold: number;

  /** Percentile threshold for large trade (default: 75) */
  largeTradePercentileThreshold: number;

  /** Absolute USD threshold for large trade (default: 10000) */
  largeTradeAbsoluteThreshold: number;

  /** Intensity threshold for LOW severity (trades per minute, default: 0.5) */
  lowIntensityThreshold: number;

  /** Intensity threshold for MEDIUM severity (trades per minute, default: 1.0) */
  mediumIntensityThreshold: number;

  /** Intensity threshold for HIGH severity (trades per minute, default: 2.0) */
  highIntensityThreshold: number;

  /** Intensity threshold for CRITICAL severity (trades per minute, default: 5.0) */
  criticalIntensityThreshold: number;

  /** Volume multiplier for severity escalation (default: 3x average volume) */
  volumeSeverityMultiplier: number;
}

/**
 * Configuration for ConsecutiveLargeTradeDetector
 */
export interface ConsecutiveLargeTradeDetectorConfig {
  /** Burst threshold configuration */
  thresholds?: Partial<BurstThresholdConfig>;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Cooldown between burst alerts in milliseconds (default: 60000) */
  alertCooldownMs?: number;

  /** Recent burst window for frequency tracking in milliseconds (default: 1 hour) */
  recentBurstWindowMs?: number;

  /** Maximum recent burst events to store (default: 100) */
  maxRecentBurstEvents?: number;

  /** Track wallet-specific bursts (default: true) */
  trackWalletBursts?: boolean;

  /** Track market-specific bursts (default: true) */
  trackMarketBursts?: boolean;
}

/**
 * Options for processing a trade
 */
export interface ProcessTradeOptions {
  /** Override timestamp */
  timestamp?: number;

  /** Bypass cooldown check */
  bypassCooldown?: boolean;

  /** Pre-calculated z-score */
  zScore?: number;

  /** Pre-calculated percentile rank */
  percentileRank?: number;

  /** Force as large trade (bypass threshold check) */
  forceLargeTrade?: boolean;
}

/**
 * Batch processing result
 */
export interface BatchBurstDetectionResult {
  /** Results by trade ID */
  results: Map<string, BurstDetectionResult>;

  /** Trades that are part of bursts */
  burstTradeIds: string[];

  /** Burst events generated */
  burstEvents: BurstEvent[];

  /** Summary statistics */
  summary: {
    totalProcessed: number;
    totalInBursts: number;
    newBurstsDetected: number;
    bySeverity: Record<BurstSeverity, number>;
    byPatternType: Record<BurstPatternType, number>;
  };

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Summary statistics
 */
export interface BurstDetectorSummary {
  /** Total markets tracked */
  totalMarkets: number;

  /** Total wallets tracked */
  totalWallets: number;

  /** Markets currently in burst state */
  marketsInBurst: number;

  /** Wallets currently in burst state */
  walletsInBurst: number;

  /** Total burst events detected */
  totalBurstEvents: number;

  /** Bursts by severity */
  bySeverity: Record<BurstSeverity, number>;

  /** Bursts by pattern type */
  byPatternType: Record<BurstPatternType, number>;

  /** Recent burst events */
  recentBurstEvents: BurstEvent[];

  /** Top markets by burst frequency */
  topBurstMarkets: Array<{
    marketId: string;
    burstCount: number;
    totalVolumeUsd: number;
  }>;

  /** Top wallets by burst frequency */
  topBurstWallets: Array<{
    walletAddress: string;
    burstCount: number;
    totalVolumeUsd: number;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default burst threshold configuration */
export const DEFAULT_BURST_THRESHOLDS: BurstThresholdConfig = {
  minConsecutiveTrades: 3,
  maxTradeGapMs: 5 * 60 * 1000, // 5 minutes
  largeTradeZScoreThreshold: 2.0,
  largeTradePercentileThreshold: 75,
  largeTradeAbsoluteThreshold: 10000,
  lowIntensityThreshold: 0.5,
  mediumIntensityThreshold: 1.0,
  highIntensityThreshold: 2.0,
  criticalIntensityThreshold: 5.0,
  volumeSeverityMultiplier: 3.0,
};

/** Default cooldown period (1 minute) */
const DEFAULT_ALERT_COOLDOWN_MS = 60 * 1000;

/** Default recent burst window (1 hour) */
const DEFAULT_RECENT_BURST_WINDOW_MS = 60 * 60 * 1000;

/** Default max recent burst events */
const DEFAULT_MAX_RECENT_BURST_EVENTS = 100;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `burst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine if a trade is "large" based on thresholds
 */
function isLargeTrade(
  trade: SequenceTrade,
  thresholds: BurstThresholdConfig
): boolean {
  // If already flagged as large
  if (trade.isLargeTrade) return true;

  // Check z-score
  if (
    trade.zScore !== undefined &&
    trade.zScore >= thresholds.largeTradeZScoreThreshold
  ) {
    return true;
  }

  // Check percentile
  if (
    trade.percentileRank !== undefined &&
    trade.percentileRank >= thresholds.largeTradePercentileThreshold
  ) {
    return true;
  }

  // Check absolute threshold
  return trade.sizeUsd >= thresholds.largeTradeAbsoluteThreshold;
}

/**
 * Calculate burst intensity (trades per minute)
 */
function calculateIntensity(tradeCount: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const durationMinutes = durationMs / (60 * 1000);
  return durationMinutes > 0 ? tradeCount / durationMinutes : tradeCount;
}

/**
 * Determine severity from intensity and volume
 */
function determineSeverity(
  intensity: number,
  consecutiveCount: number,
  totalVolume: number,
  averageVolume: number,
  thresholds: BurstThresholdConfig
): BurstSeverity {
  // Check intensity-based severity
  let intensitySeverity: BurstSeverity;
  if (intensity >= thresholds.criticalIntensityThreshold) {
    intensitySeverity = BurstSeverity.CRITICAL;
  } else if (intensity >= thresholds.highIntensityThreshold) {
    intensitySeverity = BurstSeverity.HIGH;
  } else if (intensity >= thresholds.mediumIntensityThreshold) {
    intensitySeverity = BurstSeverity.MEDIUM;
  } else {
    intensitySeverity = BurstSeverity.LOW;
  }

  // Check volume-based severity escalation
  let volumeSeverity: BurstSeverity = BurstSeverity.LOW;
  if (averageVolume > 0) {
    const volumeMultiple = totalVolume / averageVolume;
    if (volumeMultiple >= thresholds.volumeSeverityMultiplier * 3) {
      volumeSeverity = BurstSeverity.CRITICAL;
    } else if (volumeMultiple >= thresholds.volumeSeverityMultiplier * 2) {
      volumeSeverity = BurstSeverity.HIGH;
    } else if (volumeMultiple >= thresholds.volumeSeverityMultiplier) {
      volumeSeverity = BurstSeverity.MEDIUM;
    }
  }

  // Check count-based severity escalation
  let countSeverity: BurstSeverity = BurstSeverity.LOW;
  if (consecutiveCount >= 10) {
    countSeverity = BurstSeverity.CRITICAL;
  } else if (consecutiveCount >= 7) {
    countSeverity = BurstSeverity.HIGH;
  } else if (consecutiveCount >= 5) {
    countSeverity = BurstSeverity.MEDIUM;
  }

  // Return highest severity
  const severityOrder = [
    BurstSeverity.LOW,
    BurstSeverity.MEDIUM,
    BurstSeverity.HIGH,
    BurstSeverity.CRITICAL,
  ];

  const maxIndex = Math.max(
    severityOrder.indexOf(intensitySeverity),
    severityOrder.indexOf(volumeSeverity),
    severityOrder.indexOf(countSeverity)
  );

  return severityOrder[maxIndex] ?? BurstSeverity.LOW;
}

/**
 * Determine burst pattern type
 */
function determinePatternType(
  walletCount: number,
  marketCount: number,
  isWalletBurst: boolean,
  isMarketBurst: boolean
): BurstPatternType {
  if (isWalletBurst && isMarketBurst) {
    return BurstPatternType.COMBINED_BURST;
  }

  if (walletCount > 1 && marketCount === 1) {
    return BurstPatternType.MARKET_BURST;
  }

  if (walletCount === 1 && marketCount >= 1) {
    return BurstPatternType.WALLET_BURST;
  }

  if (walletCount > 1 && marketCount > 1) {
    return BurstPatternType.COORDINATED_BURST;
  }

  return BurstPatternType.WALLET_BURST;
}

// ============================================================================
// ConsecutiveLargeTradeDetector Class
// ============================================================================

/**
 * Event types emitted by ConsecutiveLargeTradeDetector
 */
export interface ConsecutiveLargeTradeDetectorEvents {
  burstDetected: (event: BurstEvent) => void;
  burstEnded: (event: BurstEvent) => void;
  criticalBurst: (event: BurstEvent) => void;
}

/**
 * Detector for consecutive large trades (burst patterns)
 */
export class ConsecutiveLargeTradeDetector extends EventEmitter {
  private readonly thresholds: BurstThresholdConfig;
  private readonly enableEvents: boolean;
  private readonly alertCooldownMs: number;
  private readonly recentBurstWindowMs: number;
  private readonly maxRecentBurstEvents: number;
  private readonly trackWalletBursts: boolean;
  private readonly trackMarketBursts: boolean;

  // Market burst states
  private readonly marketStates: Map<string, MarketBurstState> = new Map();

  // Wallet burst states
  private readonly walletStates: Map<string, WalletBurstState> = new Map();

  // Recent burst events
  private readonly recentBurstEvents: BurstEvent[] = [];

  // Alert cooldown tracking
  private readonly lastAlertTime: Map<string, number> = new Map();

  // Stats tracking
  private totalBurstEventsDetected = 0;
  private burstsBySeverity: Record<BurstSeverity, number> = {
    [BurstSeverity.LOW]: 0,
    [BurstSeverity.MEDIUM]: 0,
    [BurstSeverity.HIGH]: 0,
    [BurstSeverity.CRITICAL]: 0,
  };
  private burstsByPatternType: Record<BurstPatternType, number> = {
    [BurstPatternType.WALLET_BURST]: 0,
    [BurstPatternType.MARKET_BURST]: 0,
    [BurstPatternType.COORDINATED_BURST]: 0,
    [BurstPatternType.COMBINED_BURST]: 0,
  };

  constructor(config?: ConsecutiveLargeTradeDetectorConfig) {
    super();

    this.thresholds = {
      ...DEFAULT_BURST_THRESHOLDS,
      ...config?.thresholds,
    };

    this.enableEvents = config?.enableEvents ?? true;
    this.alertCooldownMs = config?.alertCooldownMs ?? DEFAULT_ALERT_COOLDOWN_MS;
    this.recentBurstWindowMs =
      config?.recentBurstWindowMs ?? DEFAULT_RECENT_BURST_WINDOW_MS;
    this.maxRecentBurstEvents =
      config?.maxRecentBurstEvents ?? DEFAULT_MAX_RECENT_BURST_EVENTS;
    this.trackWalletBursts = config?.trackWalletBursts ?? true;
    this.trackMarketBursts = config?.trackMarketBursts ?? true;
  }

  /**
   * Process a trade and check for burst patterns
   */
  processTrade(
    trade: SequenceTrade,
    options?: ProcessTradeOptions
  ): BurstDetectionResult {
    const now = options?.timestamp ?? Date.now();

    // Apply options to trade
    const processedTrade: SequenceTrade = {
      ...trade,
      zScore: options?.zScore ?? trade.zScore,
      percentileRank: options?.percentileRank ?? trade.percentileRank,
      isLargeTrade:
        options?.forceLargeTrade ??
        trade.isLargeTrade ??
        isLargeTrade(trade, this.thresholds),
    };

    // Only process if it's a large trade
    if (
      !processedTrade.isLargeTrade &&
      !isLargeTrade(processedTrade, this.thresholds)
    ) {
      // Check if we should end any active bursts due to gap
      this.checkBurstEndings(processedTrade.marketId, processedTrade.walletAddress, processedTrade.timestamp, now);

      return this.createNoBurstResult(processedTrade, now);
    }

    // Update market state
    let marketResult: BurstDetectionResult | null = null;
    if (this.trackMarketBursts) {
      marketResult = this.processMarketTrade(processedTrade, now, options);
    }

    // Update wallet state
    let walletResult: BurstDetectionResult | null = null;
    if (this.trackWalletBursts) {
      walletResult = this.processWalletTrade(processedTrade, now, options);
    }

    // Combine results (use the most significant burst)
    return this.combineResults(
      processedTrade,
      marketResult,
      walletResult,
      now,
      options
    );
  }

  /**
   * Process multiple trades
   */
  processTrades(
    trades: SequenceTrade[],
    options?: ProcessTradeOptions
  ): BatchBurstDetectionResult {
    const startTime = Date.now();
    const results = new Map<string, BurstDetectionResult>();
    const burstTradeIds: string[] = [];
    const burstEvents: BurstEvent[] = [];

    const summary = {
      totalProcessed: trades.length,
      totalInBursts: 0,
      newBurstsDetected: 0,
      bySeverity: {
        [BurstSeverity.LOW]: 0,
        [BurstSeverity.MEDIUM]: 0,
        [BurstSeverity.HIGH]: 0,
        [BurstSeverity.CRITICAL]: 0,
      } as Record<BurstSeverity, number>,
      byPatternType: {
        [BurstPatternType.WALLET_BURST]: 0,
        [BurstPatternType.MARKET_BURST]: 0,
        [BurstPatternType.COORDINATED_BURST]: 0,
        [BurstPatternType.COMBINED_BURST]: 0,
      } as Record<BurstPatternType, number>,
    };

    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);

    for (const trade of sortedTrades) {
      const result = this.processTrade(trade, options);
      results.set(trade.tradeId, result);

      if (result.isBurst) {
        burstTradeIds.push(trade.tradeId);
        summary.totalInBursts++;

        if (result.severity) {
          summary.bySeverity[result.severity]++;
        }

        if (result.patternType) {
          summary.byPatternType[result.patternType]++;
        }

        if (result.burstEvent) {
          burstEvents.push(result.burstEvent);
          summary.newBurstsDetected++;
        }
      }
    }

    return {
      results,
      burstTradeIds,
      burstEvents,
      summary,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a market is currently in burst state
   */
  isMarketInBurst(marketId: string): boolean {
    return this.marketStates.get(marketId)?.inBurst ?? false;
  }

  /**
   * Check if a wallet is currently in burst state
   */
  isWalletInBurst(walletAddress: string): boolean {
    return this.walletStates.get(walletAddress.toLowerCase())?.inBurst ?? false;
  }

  /**
   * Get current burst state for a market
   */
  getMarketBurstState(marketId: string): {
    inBurst: boolean;
    consecutiveCount: number;
    burstVolumeUsd: number;
    burstDurationMs: number;
    intensity: number;
    walletCount: number;
  } | null {
    const state = this.marketStates.get(marketId);
    if (!state) return null;

    const now = Date.now();
    const durationMs =
      state.burstStartTime !== null ? now - state.burstStartTime : 0;
    const intensity = calculateIntensity(state.consecutiveCount, durationMs);

    return {
      inBurst: state.inBurst,
      consecutiveCount: state.consecutiveCount,
      burstVolumeUsd: state.burstVolumeUsd,
      burstDurationMs: durationMs,
      intensity,
      walletCount: state.walletAddresses.size,
    };
  }

  /**
   * Get current burst state for a wallet
   */
  getWalletBurstState(walletAddress: string): {
    inBurst: boolean;
    consecutiveCount: number;
    burstVolumeUsd: number;
    burstDurationMs: number;
    intensity: number;
    marketCount: number;
  } | null {
    const state = this.walletStates.get(walletAddress.toLowerCase());
    if (!state) return null;

    const now = Date.now();
    const durationMs =
      state.burstStartTime !== null ? now - state.burstStartTime : 0;
    const intensity = calculateIntensity(state.consecutiveCount, durationMs);

    return {
      inBurst: state.inBurst,
      consecutiveCount: state.consecutiveCount,
      burstVolumeUsd: state.burstVolumeUsd,
      burstDurationMs: durationMs,
      intensity,
      marketCount: state.marketIds.size,
    };
  }

  /**
   * Get recent burst events
   */
  getRecentBurstEvents(limit: number = 20): BurstEvent[] {
    return this.recentBurstEvents.slice(0, limit);
  }

  /**
   * Get burst events for a specific market
   */
  getMarketBurstEvents(marketId: string, limit: number = 10): BurstEvent[] {
    return this.recentBurstEvents
      .filter((e) => e.marketId === marketId)
      .slice(0, limit);
  }

  /**
   * Get burst events for a specific wallet
   */
  getWalletBurstEvents(
    walletAddress: string,
    limit: number = 10
  ): BurstEvent[] {
    const lowercaseWallet = walletAddress.toLowerCase();
    return this.recentBurstEvents
      .filter((e) =>
        e.walletAddresses.some((w) => w.toLowerCase() === lowercaseWallet)
      )
      .slice(0, limit);
  }

  /**
   * Get summary statistics
   */
  getSummary(): BurstDetectorSummary {
    const now = Date.now();

    // Count active states
    let marketsInBurst = 0;
    let walletsInBurst = 0;

    for (const state of this.marketStates.values()) {
      if (state.inBurst) marketsInBurst++;
    }

    for (const state of this.walletStates.values()) {
      if (state.inBurst) walletsInBurst++;
    }

    // Calculate top markets
    const marketBurstCounts = new Map<
      string,
      { count: number; volume: number }
    >();
    for (const event of this.recentBurstEvents) {
      if (now - event.detectedAt.getTime() < this.recentBurstWindowMs) {
        const current = marketBurstCounts.get(event.marketId) ?? {
          count: 0,
          volume: 0,
        };
        marketBurstCounts.set(event.marketId, {
          count: current.count + 1,
          volume: current.volume + event.totalVolumeUsd,
        });
      }
    }

    const topBurstMarkets = Array.from(marketBurstCounts.entries())
      .map(([marketId, data]) => ({
        marketId,
        burstCount: data.count,
        totalVolumeUsd: data.volume,
      }))
      .sort((a, b) => b.burstCount - a.burstCount)
      .slice(0, 10);

    // Calculate top wallets
    const walletBurstCounts = new Map<
      string,
      { count: number; volume: number }
    >();
    for (const event of this.recentBurstEvents) {
      if (now - event.detectedAt.getTime() < this.recentBurstWindowMs) {
        for (const wallet of event.walletAddresses) {
          const current = walletBurstCounts.get(wallet) ?? {
            count: 0,
            volume: 0,
          };
          walletBurstCounts.set(wallet, {
            count: current.count + 1,
            volume: current.volume + event.totalVolumeUsd,
          });
        }
      }
    }

    const topBurstWallets = Array.from(walletBurstCounts.entries())
      .map(([walletAddress, data]) => ({
        walletAddress,
        burstCount: data.count,
        totalVolumeUsd: data.volume,
      }))
      .sort((a, b) => b.burstCount - a.burstCount)
      .slice(0, 10);

    return {
      totalMarkets: this.marketStates.size,
      totalWallets: this.walletStates.size,
      marketsInBurst,
      walletsInBurst,
      totalBurstEvents: this.totalBurstEventsDetected,
      bySeverity: { ...this.burstsBySeverity },
      byPatternType: { ...this.burstsByPatternType },
      recentBurstEvents: this.recentBurstEvents.slice(0, 20),
      topBurstMarkets,
      topBurstWallets,
    };
  }

  /**
   * Get threshold configuration
   */
  getThresholds(): BurstThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    trackedMarkets: number;
    trackedWallets: number;
    marketsInBurst: number;
    walletsInBurst: number;
    totalBurstEvents: number;
    recentBurstEventsCount: number;
    trackWalletBursts: boolean;
    trackMarketBursts: boolean;
    alertCooldownMs: number;
  } {
    let marketsInBurst = 0;
    let walletsInBurst = 0;

    for (const state of this.marketStates.values()) {
      if (state.inBurst) marketsInBurst++;
    }

    for (const state of this.walletStates.values()) {
      if (state.inBurst) walletsInBurst++;
    }

    return {
      trackedMarkets: this.marketStates.size,
      trackedWallets: this.walletStates.size,
      marketsInBurst,
      walletsInBurst,
      totalBurstEvents: this.totalBurstEventsDetected,
      recentBurstEventsCount: this.recentBurstEvents.length,
      trackWalletBursts: this.trackWalletBursts,
      trackMarketBursts: this.trackMarketBursts,
      alertCooldownMs: this.alertCooldownMs,
    };
  }

  /**
   * Clear state for a specific market
   */
  clearMarket(marketId: string): boolean {
    return this.marketStates.delete(marketId);
  }

  /**
   * Clear state for a specific wallet
   */
  clearWallet(walletAddress: string): boolean {
    return this.walletStates.delete(walletAddress.toLowerCase());
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.marketStates.clear();
    this.walletStates.clear();
    this.recentBurstEvents.length = 0;
    this.lastAlertTime.clear();
    this.totalBurstEventsDetected = 0;
    this.burstsBySeverity = {
      [BurstSeverity.LOW]: 0,
      [BurstSeverity.MEDIUM]: 0,
      [BurstSeverity.HIGH]: 0,
      [BurstSeverity.CRITICAL]: 0,
    };
    this.burstsByPatternType = {
      [BurstPatternType.WALLET_BURST]: 0,
      [BurstPatternType.MARKET_BURST]: 0,
      [BurstPatternType.COORDINATED_BURST]: 0,
      [BurstPatternType.COMBINED_BURST]: 0,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getOrCreateMarketState(marketId: string): MarketBurstState {
    let state = this.marketStates.get(marketId);
    if (!state) {
      state = {
        inBurst: false,
        burstStartTime: null,
        lastLargeTradeTime: null,
        consecutiveCount: 0,
        burstVolumeUsd: 0,
        largestTradeSize: 0,
        tradeIds: [],
        walletAddresses: new Set(),
        recentBurstTimes: [],
        lastBurstEventId: null,
      };
      this.marketStates.set(marketId, state);
    }
    return state;
  }

  private getOrCreateWalletState(walletAddress: string): WalletBurstState {
    const key = walletAddress.toLowerCase();
    let state = this.walletStates.get(key);
    if (!state) {
      state = {
        inBurst: false,
        burstStartTime: null,
        lastLargeTradeTime: null,
        consecutiveCount: 0,
        burstVolumeUsd: 0,
        largestTradeSize: 0,
        tradeIds: [],
        marketIds: new Set(),
        recentBurstTimes: [],
        lastBurstEventId: null,
      };
      this.walletStates.set(key, state);
    }
    return state;
  }

  private processMarketTrade(
    trade: SequenceTrade,
    now: number,
    _options?: ProcessTradeOptions
  ): BurstDetectionResult {
    const state = this.getOrCreateMarketState(trade.marketId);
    // Use trade timestamp for gap detection, not current time
    const tradeTime = trade.timestamp;
    const timeSinceLastLarge =
      state.lastLargeTradeTime !== null
        ? tradeTime - state.lastLargeTradeTime
        : null;

    // Check if gap exceeded - reset sequence
    const shouldResetSequence =
      timeSinceLastLarge !== null &&
      timeSinceLastLarge > this.thresholds.maxTradeGapMs;

    if (shouldResetSequence) {
      // End previous burst if any
      if (state.inBurst) {
        this.endMarketBurst(trade.marketId, state, now);
      }
      // Reset sequence tracking
      state.consecutiveCount = 0;
      state.burstVolumeUsd = 0;
      state.largestTradeSize = 0;
      state.tradeIds = [];
      state.walletAddresses.clear();
      state.burstStartTime = null;
    }

    // Update state - always increment for large trades
    if (state.consecutiveCount === 0) {
      // First trade in new sequence
      state.burstStartTime = tradeTime;
    }

    state.consecutiveCount++;
    state.burstVolumeUsd += trade.sizeUsd;
    state.largestTradeSize = Math.max(state.largestTradeSize, trade.sizeUsd);
    state.tradeIds.push(trade.tradeId);
    state.walletAddresses.add(trade.walletAddress);
    state.lastLargeTradeTime = tradeTime;

    // Check if burst threshold met
    const isBurst =
      state.consecutiveCount >= this.thresholds.minConsecutiveTrades;

    if (isBurst && !state.inBurst) {
      state.inBurst = true;
    }

    // Calculate metrics using trade timestamp for accurate duration
    const durationMs =
      state.burstStartTime !== null ? tradeTime - state.burstStartTime : 0;
    const intensity = calculateIntensity(state.consecutiveCount, durationMs);
    const averageTradeSize =
      state.consecutiveCount > 0
        ? state.burstVolumeUsd / state.consecutiveCount
        : 0;

    const severity = isBurst
      ? determineSeverity(
          intensity,
          state.consecutiveCount,
          state.burstVolumeUsd,
          averageTradeSize,
          this.thresholds
        )
      : null;

    const patternType = isBurst
      ? determinePatternType(
          state.walletAddresses.size,
          1, // Single market
          false,
          true
        )
      : null;

    // Note: Burst events are emitted in combineResults to avoid duplicate emissions
    // when both market and wallet tracking detect bursts simultaneously.
    // Here we only track if this is a NEW burst (first time reaching threshold)
    const isNewBurst = isBurst && state.consecutiveCount === this.thresholds.minConsecutiveTrades;

    return {
      trade,
      isBurst,
      state: isBurst ? BurstState.ACTIVE : BurstState.INACTIVE,
      patternType,
      severity,
      consecutiveCount: state.consecutiveCount,
      burstVolumeUsd: state.burstVolumeUsd,
      burstDurationMs: durationMs,
      burstIntensity: intensity,
      averageTradeSize,
      timeSinceLastLargeTrade: timeSinceLastLarge,
      detectedAt: new Date(now),
      burstEvent: null, // Will be set in combineResults
      _isNewBurst: isNewBurst, // Internal flag for combineResults
    } as BurstDetectionResult & { _isNewBurst?: boolean };
  }

  private processWalletTrade(
    trade: SequenceTrade,
    now: number,
    _options?: ProcessTradeOptions
  ): BurstDetectionResult {
    const state = this.getOrCreateWalletState(trade.walletAddress);
    // Use trade timestamp for gap detection
    const tradeTime = trade.timestamp;
    const timeSinceLastLarge =
      state.lastLargeTradeTime !== null
        ? tradeTime - state.lastLargeTradeTime
        : null;

    // Check if gap exceeded - reset sequence
    const shouldResetSequence =
      timeSinceLastLarge !== null &&
      timeSinceLastLarge > this.thresholds.maxTradeGapMs;

    if (shouldResetSequence) {
      // End previous burst if any
      if (state.inBurst) {
        this.endWalletBurst(trade.walletAddress, state, now);
      }
      // Reset sequence tracking
      state.consecutiveCount = 0;
      state.burstVolumeUsd = 0;
      state.largestTradeSize = 0;
      state.tradeIds = [];
      state.marketIds.clear();
      state.burstStartTime = null;
    }

    // Update state - always increment for large trades
    if (state.consecutiveCount === 0) {
      // First trade in new sequence
      state.burstStartTime = tradeTime;
    }

    state.consecutiveCount++;
    state.burstVolumeUsd += trade.sizeUsd;
    state.largestTradeSize = Math.max(state.largestTradeSize, trade.sizeUsd);
    state.tradeIds.push(trade.tradeId);
    state.marketIds.add(trade.marketId);
    state.lastLargeTradeTime = tradeTime;

    // Check if burst threshold met
    const isBurst =
      state.consecutiveCount >= this.thresholds.minConsecutiveTrades;

    if (isBurst && !state.inBurst) {
      state.inBurst = true;
    }

    // Calculate metrics using trade timestamp
    const durationMs =
      state.burstStartTime !== null ? tradeTime - state.burstStartTime : 0;
    const intensity = calculateIntensity(state.consecutiveCount, durationMs);
    const averageTradeSize =
      state.consecutiveCount > 0
        ? state.burstVolumeUsd / state.consecutiveCount
        : 0;

    const severity = isBurst
      ? determineSeverity(
          intensity,
          state.consecutiveCount,
          state.burstVolumeUsd,
          averageTradeSize,
          this.thresholds
        )
      : null;

    const patternType = isBurst
      ? determinePatternType(
          1, // Single wallet
          state.marketIds.size,
          true,
          false
        )
      : null;

    // Note: Burst events are emitted in combineResults to avoid duplicate emissions
    // when both market and wallet tracking detect bursts simultaneously.
    // Here we only track if this is a NEW burst (first time reaching threshold)
    const isNewBurst = isBurst && state.consecutiveCount === this.thresholds.minConsecutiveTrades;

    return {
      trade,
      isBurst,
      state: isBurst ? BurstState.ACTIVE : BurstState.INACTIVE,
      patternType,
      severity,
      consecutiveCount: state.consecutiveCount,
      burstVolumeUsd: state.burstVolumeUsd,
      burstDurationMs: durationMs,
      burstIntensity: intensity,
      averageTradeSize,
      timeSinceLastLargeTrade: timeSinceLastLarge,
      detectedAt: new Date(now),
      burstEvent: null, // Will be set in combineResults
      _isNewBurst: isNewBurst, // Internal flag for combineResults
    } as BurstDetectionResult & { _isNewBurst?: boolean };
  }

  private combineResults(
    trade: SequenceTrade,
    marketResult: (BurstDetectionResult & { _isNewBurst?: boolean }) | null,
    walletResult: (BurstDetectionResult & { _isNewBurst?: boolean }) | null,
    now: number,
    options?: ProcessTradeOptions
  ): BurstDetectionResult {
    // If both have bursts, we need to determine the appropriate pattern type
    if (marketResult?.isBurst && walletResult?.isBurst) {
      const severity = this.getHigherSeverity(
        marketResult.severity,
        walletResult.severity
      );

      // Get market and wallet state to determine pattern type
      const marketState = this.marketStates.get(trade.marketId);
      const walletState = this.walletStates.get(trade.walletAddress.toLowerCase());

      const walletCountOnMarket = marketState?.walletAddresses.size ?? 1;
      const marketCountForWallet = walletState?.marketIds.size ?? 1;

      // Determine the most appropriate pattern type:
      // - COMBINED_BURST only if multiple wallets on market AND wallet on multiple markets
      // - MARKET_BURST if multiple wallets on same market but wallet only on this market
      // - WALLET_BURST if single wallet on market but wallet on multiple markets
      // - WALLET_BURST if single wallet on single market (default)
      let patternType: BurstPatternType;
      if (walletCountOnMarket > 1 && marketCountForWallet > 1) {
        patternType = BurstPatternType.COMBINED_BURST;
      } else if (walletCountOnMarket > 1) {
        patternType = BurstPatternType.MARKET_BURST;
      } else {
        // Single wallet - prefer wallet burst pattern
        patternType = BurstPatternType.WALLET_BURST;
      }

      // Create and emit burst event if this is a new burst
      const isNewBurst = marketResult._isNewBurst || walletResult._isNewBurst;
      let burstEvent: BurstEvent | null = null;

      if (isNewBurst && this.canEmitAlert(trade.marketId, options?.bypassCooldown ?? false, now)) {
        burstEvent = this.createBurstEvent(
          trade.marketId,
          marketState ? Array.from(marketState.walletAddresses) : [trade.walletAddress],
          patternType,
          severity!,
          marketState!,
          now
        );
        this.recordBurstEvent(burstEvent, marketState!);
        this.updateCooldown(trade.marketId, now);
      }

      return {
        trade,
        isBurst: true,
        state: BurstState.ACTIVE,
        patternType,
        severity,
        consecutiveCount: Math.max(
          marketResult.consecutiveCount,
          walletResult.consecutiveCount
        ),
        burstVolumeUsd: Math.max(
          marketResult.burstVolumeUsd,
          walletResult.burstVolumeUsd
        ),
        burstDurationMs: Math.max(
          marketResult.burstDurationMs,
          walletResult.burstDurationMs
        ),
        burstIntensity: Math.max(
          marketResult.burstIntensity,
          walletResult.burstIntensity
        ),
        averageTradeSize: Math.max(
          marketResult.averageTradeSize,
          walletResult.averageTradeSize
        ),
        timeSinceLastLargeTrade:
          marketResult.timeSinceLastLargeTrade ??
          walletResult.timeSinceLastLargeTrade,
        detectedAt: new Date(now),
        burstEvent,
      };
    }

    // Return whichever has a burst, or the market result if neither
    // Also handle burst event emission for single-dimension bursts
    if (marketResult?.isBurst) {
      const marketState = this.marketStates.get(trade.marketId);
      let burstEvent: BurstEvent | null = null;

      if (marketResult._isNewBurst && this.canEmitAlert(trade.marketId, options?.bypassCooldown ?? false, now)) {
        burstEvent = this.createBurstEvent(
          trade.marketId,
          marketState ? Array.from(marketState.walletAddresses) : [trade.walletAddress],
          marketResult.patternType!,
          marketResult.severity!,
          marketState!,
          now
        );
        this.recordBurstEvent(burstEvent, marketState!);
        this.updateCooldown(trade.marketId, now);
      }

      return { ...marketResult, burstEvent };
    }

    if (walletResult?.isBurst) {
      const walletState = this.walletStates.get(trade.walletAddress.toLowerCase());
      let burstEvent: BurstEvent | null = null;

      if (walletResult._isNewBurst && this.canEmitAlert(trade.walletAddress.toLowerCase(), options?.bypassCooldown ?? false, now)) {
        burstEvent = this.createWalletBurstEvent(
          trade.walletAddress,
          walletState ? Array.from(walletState.marketIds) : [trade.marketId],
          walletResult.patternType!,
          walletResult.severity!,
          walletState!,
          now
        );
        this.recordBurstEvent(burstEvent, walletState!);
        this.updateCooldown(trade.walletAddress.toLowerCase(), now);
      }

      return { ...walletResult, burstEvent };
    }

    return marketResult ?? walletResult ?? this.createNoBurstResult(trade, now);
  }

  private getHigherSeverity(
    s1: BurstSeverity | null,
    s2: BurstSeverity | null
  ): BurstSeverity | null {
    if (s1 === null) return s2;
    if (s2 === null) return s1;

    const severityOrder = [
      BurstSeverity.LOW,
      BurstSeverity.MEDIUM,
      BurstSeverity.HIGH,
      BurstSeverity.CRITICAL,
    ];

    const i1 = severityOrder.indexOf(s1);
    const i2 = severityOrder.indexOf(s2);

    return i1 >= i2 ? s1 : s2;
  }

  private createNoBurstResult(
    trade: SequenceTrade,
    now: number
  ): BurstDetectionResult {
    return {
      trade,
      isBurst: false,
      state: BurstState.INACTIVE,
      patternType: null,
      severity: null,
      consecutiveCount: 0,
      burstVolumeUsd: 0,
      burstDurationMs: 0,
      burstIntensity: 0,
      averageTradeSize: 0,
      timeSinceLastLargeTrade: null,
      detectedAt: new Date(now),
      burstEvent: null,
    };
  }

  private createBurstEvent(
    marketId: string,
    walletAddresses: string[],
    patternType: BurstPatternType,
    severity: BurstSeverity,
    state: MarketBurstState,
    now: number
  ): BurstEvent {
    const durationMs =
      state.burstStartTime !== null ? now - state.burstStartTime : 0;

    // Count recent bursts
    const marketBurstsLastHour = state.recentBurstTimes.filter(
      (t) => now - t < this.recentBurstWindowMs
    ).length;

    return {
      eventId: generateEventId(),
      marketId,
      walletAddresses,
      patternType,
      severity,
      consecutiveCount: state.consecutiveCount,
      totalVolumeUsd: state.burstVolumeUsd,
      startTime: new Date(state.burstStartTime ?? now),
      endTime: null,
      durationMs,
      intensity: calculateIntensity(state.consecutiveCount, durationMs),
      averageTradeSize:
        state.consecutiveCount > 0
          ? state.burstVolumeUsd / state.consecutiveCount
          : 0,
      largestTradeSize: state.largestTradeSize,
      tradeIds: [...state.tradeIds],
      detectedAt: new Date(now),
      context: {
        isContinuation:
          state.lastBurstEventId !== null &&
          now - (state.recentBurstTimes[state.recentBurstTimes.length - 1] ?? 0) <
            this.thresholds.maxTradeGapMs * 2,
        previousEventId: state.lastBurstEventId,
        marketBurstsLastHour,
        walletBurstsLastHour: 0, // Will be set per-wallet
      },
    };
  }

  private createWalletBurstEvent(
    walletAddress: string,
    marketIds: string[],
    patternType: BurstPatternType,
    severity: BurstSeverity,
    state: WalletBurstState,
    now: number
  ): BurstEvent {
    const durationMs =
      state.burstStartTime !== null ? now - state.burstStartTime : 0;

    // Count recent bursts
    const walletBurstsLastHour = state.recentBurstTimes.filter(
      (t) => now - t < this.recentBurstWindowMs
    ).length;

    return {
      eventId: generateEventId(),
      marketId: marketIds[0] ?? "",
      walletAddresses: [walletAddress],
      patternType,
      severity,
      consecutiveCount: state.consecutiveCount,
      totalVolumeUsd: state.burstVolumeUsd,
      startTime: new Date(state.burstStartTime ?? now),
      endTime: null,
      durationMs,
      intensity: calculateIntensity(state.consecutiveCount, durationMs),
      averageTradeSize:
        state.consecutiveCount > 0
          ? state.burstVolumeUsd / state.consecutiveCount
          : 0,
      largestTradeSize: state.largestTradeSize,
      tradeIds: [...state.tradeIds],
      detectedAt: new Date(now),
      context: {
        isContinuation:
          state.lastBurstEventId !== null &&
          now - (state.recentBurstTimes[state.recentBurstTimes.length - 1] ?? 0) <
            this.thresholds.maxTradeGapMs * 2,
        previousEventId: state.lastBurstEventId,
        marketBurstsLastHour: 0, // Not applicable for wallet bursts
        walletBurstsLastHour,
      },
    };
  }

  private recordBurstEvent(
    event: BurstEvent,
    state: MarketBurstState | WalletBurstState
  ): void {
    // Store event
    this.recentBurstEvents.unshift(event);
    if (this.recentBurstEvents.length > this.maxRecentBurstEvents) {
      this.recentBurstEvents.pop();
    }

    // Update stats
    this.totalBurstEventsDetected++;
    this.burstsBySeverity[event.severity]++;
    this.burstsByPatternType[event.patternType]++;

    // Update state
    state.lastBurstEventId = event.eventId;
    state.recentBurstTimes.push(event.detectedAt.getTime());

    // Clean old burst times
    const now = event.detectedAt.getTime();
    state.recentBurstTimes = state.recentBurstTimes.filter(
      (t) => now - t < this.recentBurstWindowMs
    );

    // Emit events
    if (this.enableEvents) {
      this.emit("burstDetected", event);

      if (event.severity === BurstSeverity.CRITICAL) {
        this.emit("criticalBurst", event);
      }
    }
  }

  private endMarketBurst(
    marketId: string,
    state: MarketBurstState,
    now: number
  ): void {
    if (!state.inBurst) return;

    const endEvent: BurstEvent = {
      eventId: generateEventId(),
      marketId,
      walletAddresses: Array.from(state.walletAddresses),
      patternType: BurstPatternType.MARKET_BURST,
      severity: BurstSeverity.LOW,
      consecutiveCount: state.consecutiveCount,
      totalVolumeUsd: state.burstVolumeUsd,
      startTime: new Date(state.burstStartTime ?? now),
      endTime: new Date(now),
      durationMs:
        state.burstStartTime !== null ? now - state.burstStartTime : 0,
      intensity: calculateIntensity(
        state.consecutiveCount,
        state.burstStartTime !== null ? now - state.burstStartTime : 0
      ),
      averageTradeSize:
        state.consecutiveCount > 0
          ? state.burstVolumeUsd / state.consecutiveCount
          : 0,
      largestTradeSize: state.largestTradeSize,
      tradeIds: [...state.tradeIds],
      detectedAt: new Date(now),
      context: {
        isContinuation: false,
        previousEventId: state.lastBurstEventId,
        marketBurstsLastHour: state.recentBurstTimes.filter(
          (t) => now - t < this.recentBurstWindowMs
        ).length,
        walletBurstsLastHour: 0,
      },
    };

    // Reset state
    state.inBurst = false;
    state.burstStartTime = null;
    state.consecutiveCount = 0;
    state.burstVolumeUsd = 0;
    state.largestTradeSize = 0;
    state.tradeIds = [];
    state.walletAddresses.clear();

    if (this.enableEvents) {
      this.emit("burstEnded", endEvent);
    }
  }

  private endWalletBurst(
    walletAddress: string,
    state: WalletBurstState,
    now: number
  ): void {
    if (!state.inBurst) return;

    const endEvent: BurstEvent = {
      eventId: generateEventId(),
      marketId: Array.from(state.marketIds)[0] ?? "",
      walletAddresses: [walletAddress],
      patternType: BurstPatternType.WALLET_BURST,
      severity: BurstSeverity.LOW,
      consecutiveCount: state.consecutiveCount,
      totalVolumeUsd: state.burstVolumeUsd,
      startTime: new Date(state.burstStartTime ?? now),
      endTime: new Date(now),
      durationMs:
        state.burstStartTime !== null ? now - state.burstStartTime : 0,
      intensity: calculateIntensity(
        state.consecutiveCount,
        state.burstStartTime !== null ? now - state.burstStartTime : 0
      ),
      averageTradeSize:
        state.consecutiveCount > 0
          ? state.burstVolumeUsd / state.consecutiveCount
          : 0,
      largestTradeSize: state.largestTradeSize,
      tradeIds: [...state.tradeIds],
      detectedAt: new Date(now),
      context: {
        isContinuation: false,
        previousEventId: state.lastBurstEventId,
        marketBurstsLastHour: 0,
        walletBurstsLastHour: state.recentBurstTimes.filter(
          (t) => now - t < this.recentBurstWindowMs
        ).length,
      },
    };

    // Reset state
    state.inBurst = false;
    state.burstStartTime = null;
    state.consecutiveCount = 0;
    state.burstVolumeUsd = 0;
    state.largestTradeSize = 0;
    state.tradeIds = [];
    state.marketIds.clear();

    if (this.enableEvents) {
      this.emit("burstEnded", endEvent);
    }
  }

  private checkBurstEndings(
    marketId: string,
    walletAddress: string,
    tradeTimestamp: number,
    now: number
  ): void {
    // Check market state - use trade timestamp to determine if gap occurred
    const marketState = this.marketStates.get(marketId);
    if (
      marketState?.inBurst &&
      marketState.lastLargeTradeTime !== null &&
      tradeTimestamp - marketState.lastLargeTradeTime > this.thresholds.maxTradeGapMs
    ) {
      this.endMarketBurst(marketId, marketState, now);
    }

    // Check wallet state - use trade timestamp to determine if gap occurred
    const walletState = this.walletStates.get(walletAddress.toLowerCase());
    if (
      walletState?.inBurst &&
      walletState.lastLargeTradeTime !== null &&
      tradeTimestamp - walletState.lastLargeTradeTime > this.thresholds.maxTradeGapMs
    ) {
      this.endWalletBurst(walletAddress, walletState, now);
    }
  }

  private canEmitAlert(
    key: string,
    bypassCooldown: boolean,
    now: number
  ): boolean {
    if (bypassCooldown) return true;

    const lastAlert = this.lastAlertTime.get(key);
    if (!lastAlert) return true;

    return now - lastAlert >= this.alertCooldownMs;
  }

  private updateCooldown(key: string, now: number): void {
    this.lastAlertTime.set(key, now);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedDetector: ConsecutiveLargeTradeDetector | null = null;

/**
 * Create a new ConsecutiveLargeTradeDetector instance
 */
export function createConsecutiveLargeTradeDetector(
  config?: ConsecutiveLargeTradeDetectorConfig
): ConsecutiveLargeTradeDetector {
  return new ConsecutiveLargeTradeDetector(config);
}

/**
 * Get the shared ConsecutiveLargeTradeDetector instance
 */
export function getSharedConsecutiveLargeTradeDetector(): ConsecutiveLargeTradeDetector {
  if (!sharedDetector) {
    sharedDetector = new ConsecutiveLargeTradeDetector();
  }
  return sharedDetector;
}

/**
 * Set the shared ConsecutiveLargeTradeDetector instance
 */
export function setSharedConsecutiveLargeTradeDetector(
  detector: ConsecutiveLargeTradeDetector
): void {
  sharedDetector = detector;
}

/**
 * Reset the shared ConsecutiveLargeTradeDetector instance
 */
export function resetSharedConsecutiveLargeTradeDetector(): void {
  if (sharedDetector) {
    sharedDetector.clearAll();
    sharedDetector.removeAllListeners();
  }
  sharedDetector = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Process a trade for burst detection (convenience function)
 */
export function processTradeForBurst(
  trade: SequenceTrade,
  options?: ProcessTradeOptions & { detector?: ConsecutiveLargeTradeDetector }
): BurstDetectionResult {
  const detector = options?.detector ?? getSharedConsecutiveLargeTradeDetector();
  return detector.processTrade(trade, options);
}

/**
 * Process multiple trades for burst detection (convenience function)
 */
export function processTradesForBurst(
  trades: SequenceTrade[],
  options?: ProcessTradeOptions & { detector?: ConsecutiveLargeTradeDetector }
): BatchBurstDetectionResult {
  const detector = options?.detector ?? getSharedConsecutiveLargeTradeDetector();
  return detector.processTrades(trades, options);
}

/**
 * Check if market is in burst state (convenience function)
 */
export function isMarketInBurstState(
  marketId: string,
  options?: { detector?: ConsecutiveLargeTradeDetector }
): boolean {
  const detector = options?.detector ?? getSharedConsecutiveLargeTradeDetector();
  return detector.isMarketInBurst(marketId);
}

/**
 * Check if wallet is in burst state (convenience function)
 */
export function isWalletInBurstState(
  walletAddress: string,
  options?: { detector?: ConsecutiveLargeTradeDetector }
): boolean {
  const detector = options?.detector ?? getSharedConsecutiveLargeTradeDetector();
  return detector.isWalletInBurst(walletAddress);
}

/**
 * Get recent burst events (convenience function)
 */
export function getRecentBurstEvents(
  limit?: number,
  options?: { detector?: ConsecutiveLargeTradeDetector }
): BurstEvent[] {
  const detector = options?.detector ?? getSharedConsecutiveLargeTradeDetector();
  return detector.getRecentBurstEvents(limit);
}

/**
 * Get burst detector summary (convenience function)
 */
export function getBurstDetectorSummary(
  options?: { detector?: ConsecutiveLargeTradeDetector }
): BurstDetectorSummary {
  const detector = options?.detector ?? getSharedConsecutiveLargeTradeDetector();
  return detector.getSummary();
}
