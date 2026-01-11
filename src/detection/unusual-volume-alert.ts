/**
 * Unusual Volume Alert Generator (DET-VOL-010)
 *
 * Generate alerts when volume anomalies are detected.
 *
 * Features:
 * - Define volume alert conditions based on various detectors
 * - Create alerts with volume context (current vs baseline, anomaly type)
 * - Set severity by anomaly size (z-score, percentage deviation)
 * - Include comparison data (baseline, percentage change)
 * - Integrate with volume spike detector, trade size analyzer, market impact calculator
 * - Event emission for generated alerts
 * - Batch processing for multiple markets
 * - Configurable alert conditions and thresholds
 */

import { EventEmitter } from "events";
import {
  VolumeSpikeType,
  SpikeSeverity,
  SpikeDirection,
  type VolumeSpikeDetector,
  type VolumeSpikeEvent,
  type SpikeDetectionResult,
} from "./volume-spike";
import {
  TradeSizeCategory,
  TradeSizeSeverity,
  type TradeSizeAnalyzer,
  type LargeTradeEvent,
} from "./trade-size";
import {
  ImpactSeverity,
  ImpactAnomalyType,
  type MarketImpactCalculator,
  type HighImpactEvent,
} from "./market-impact";
import {
  BurstSeverity,
  BurstPatternType,
  type ConsecutiveLargeTradeDetector,
  type BurstEvent,
} from "./consecutive-large-trades";
import {
  RollingVolumeTracker,
  RollingWindow,
  getSharedRollingVolumeTracker,
} from "./rolling-volume";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of unusual volume alert
 */
export enum UnusualVolumeAlertType {
  /** Volume spike detected */
  VOLUME_SPIKE = "VOLUME_SPIKE",
  /** Sustained high volume */
  SUSTAINED_HIGH_VOLUME = "SUSTAINED_HIGH_VOLUME",
  /** Large individual trade */
  LARGE_TRADE = "LARGE_TRADE",
  /** Whale-sized trade */
  WHALE_TRADE = "WHALE_TRADE",
  /** Consecutive large trades (burst) */
  TRADE_BURST = "TRADE_BURST",
  /** High market impact trade */
  HIGH_IMPACT = "HIGH_IMPACT",
  /** Excessive market impact */
  EXCESSIVE_IMPACT = "EXCESSIVE_IMPACT",
  /** Coordinated volume activity */
  COORDINATED_VOLUME = "COORDINATED_VOLUME",
  /** Off-hours volume anomaly */
  OFF_HOURS_ANOMALY = "OFF_HOURS_ANOMALY",
  /** Pre-event volume surge */
  PRE_EVENT_SURGE = "PRE_EVENT_SURGE",
  /** General volume anomaly */
  GENERAL_ANOMALY = "GENERAL_ANOMALY",
}

/**
 * Alert severity levels
 */
export enum VolumeAlertSeverity {
  /** Low severity - minor deviation */
  LOW = "LOW",
  /** Medium severity - notable deviation */
  MEDIUM = "MEDIUM",
  /** High severity - significant deviation */
  HIGH = "HIGH",
  /** Critical severity - extreme deviation */
  CRITICAL = "CRITICAL",
}

/**
 * Alert status
 */
export enum VolumeAlertStatus {
  /** Alert is new/unread */
  NEW = "NEW",
  /** Alert has been read */
  READ = "READ",
  /** Alert has been acknowledged */
  ACKNOWLEDGED = "ACKNOWLEDGED",
  /** Alert has been dismissed */
  DISMISSED = "DISMISSED",
  /** Alert has been resolved */
  RESOLVED = "RESOLVED",
}

/**
 * Volume comparison data
 */
export interface VolumeComparisonData {
  /** Current volume value */
  currentVolume: number;

  /** Baseline (average) volume */
  baselineVolume: number;

  /** Standard deviation of baseline */
  baselineStdDev: number;

  /** Z-score of current volume vs baseline */
  zScore: number | null;

  /** Percentage of baseline (1.0 = 100%) */
  percentageOfBaseline: number | null;

  /** Percentage change from baseline */
  percentageChange: number | null;

  /** Time window for comparison */
  comparisonWindow: RollingWindow;

  /** Whether baseline is reliable */
  isBaselineReliable: boolean;
}

/**
 * Context data for volume alert
 */
export interface VolumeAlertContext {
  /** Market identifier */
  marketId: string;

  /** Volume comparison data */
  volumeComparison: VolumeComparisonData;

  /** Spike type if applicable */
  spikeType: VolumeSpikeType | null;

  /** Spike direction if applicable */
  spikeDirection: SpikeDirection | null;

  /** Duration of the anomaly in minutes */
  durationMinutes: number;

  /** Trade information if triggered by trade */
  tradeInfo: {
    tradeId: string | null;
    walletAddress: string | null;
    tradeSizeUsd: number | null;
    tradeSizeCategory: TradeSizeCategory | null;
    isOutlier: boolean;
  } | null;

  /** Impact information if triggered by impact */
  impactInfo: {
    impactBps: number | null;
    impactRatio: number | null;
    anomalyType: ImpactAnomalyType | null;
  } | null;

  /** Burst information if triggered by trade burst */
  burstInfo: {
    tradeCount: number;
    totalVolume: number;
    patternType: BurstPatternType | null;
  } | null;

  /** Number of similar alerts in last hour */
  recentAlertCount: number;

  /** Whether this is a recurring anomaly */
  isRecurring: boolean;

  /** Additional context notes */
  notes: string[];
}

/**
 * Unusual volume alert structure
 */
export interface UnusualVolumeAlert {
  /** Unique alert identifier */
  id: string;

  /** Alert type classification */
  type: UnusualVolumeAlertType;

  /** Alert severity */
  severity: VolumeAlertSeverity;

  /** Market identifier */
  marketId: string;

  /** Alert title */
  title: string;

  /** Detailed alert message */
  message: string;

  /** Alert context data */
  context: VolumeAlertContext;

  /** Alert tags for filtering */
  tags: string[];

  /** Alert status */
  status: VolumeAlertStatus;

  /** When the alert was created */
  createdAt: Date;

  /** When the alert expires */
  expiresAt: Date | null;

  /** Source detector that triggered this alert */
  sourceDetector: string;

  /** Source event ID from the detector */
  sourceEventId: string | null;
}

/**
 * Alert condition definition
 */
export interface VolumeAlertCondition {
  /** Condition identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Condition description */
  description: string;

  /** Whether this condition is enabled */
  enabled: boolean;

  /** Alert type to generate */
  alertType: UnusualVolumeAlertType;

  /** Minimum z-score to trigger */
  minZScore?: number;

  /** Minimum percentage of baseline to trigger */
  minPercentageOfBaseline?: number;

  /** Minimum percentage change to trigger */
  minPercentageChange?: number;

  /** Minimum trade size in USD to trigger */
  minTradeSizeUsd?: number;

  /** Minimum impact in basis points to trigger */
  minImpactBps?: number;

  /** Override severity for this condition */
  overrideSeverity?: VolumeAlertSeverity;

  /** Tags to add to alerts from this condition */
  tags?: string[];

  /** Custom predicate function */
  predicate?: (context: VolumeAlertContext) => boolean;
}

/**
 * Options for generating alerts
 */
export interface GenerateVolumeAlertOptions {
  /** Current timestamp override */
  timestamp?: number;

  /** Market ID for single market generation */
  marketId?: string;

  /** Alert expiration time in milliseconds */
  expirationMs?: number;

  /** Override alert severity */
  overrideSeverity?: VolumeAlertSeverity;

  /** Additional tags to add */
  additionalTags?: string[];

  /** Bypass cooldown check */
  bypassCooldown?: boolean;
}

/**
 * Result of processing a spike event
 */
export interface ProcessSpikeResult {
  /** Generated alert (if any) */
  alert: UnusualVolumeAlert | null;

  /** Whether conditions were met */
  conditionsMet: boolean;

  /** Matched condition IDs */
  matchedConditions: string[];
}

/**
 * Result of processing a large trade event
 */
export interface ProcessLargeTradeResult {
  /** Generated alert (if any) */
  alert: UnusualVolumeAlert | null;

  /** Whether conditions were met */
  conditionsMet: boolean;

  /** Matched condition IDs */
  matchedConditions: string[];
}

/**
 * Result of processing a high impact event
 */
export interface ProcessHighImpactResult {
  /** Generated alert (if any) */
  alert: UnusualVolumeAlert | null;

  /** Whether conditions were met */
  conditionsMet: boolean;

  /** Matched condition IDs */
  matchedConditions: string[];
}

/**
 * Result of processing a burst event
 */
export interface ProcessBurstResult {
  /** Generated alert (if any) */
  alert: UnusualVolumeAlert | null;

  /** Whether conditions were met */
  conditionsMet: boolean;

  /** Matched condition IDs */
  matchedConditions: string[];
}

/**
 * Batch alert generation result
 */
export interface BatchVolumeAlertResult {
  /** Generated alerts by market ID */
  alerts: Map<string, UnusualVolumeAlert[]>;

  /** Markets that didn't trigger any alerts */
  noAlerts: string[];

  /** Failed markets with error messages */
  errors: Map<string, string>;

  /** Total markets processed */
  totalProcessed: number;

  /** Total alerts generated */
  totalAlerts: number;

  /** Alerts by type */
  byType: Record<UnusualVolumeAlertType, number>;

  /** Alerts by severity */
  bySeverity: Record<VolumeAlertSeverity, number>;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Alert summary statistics
 */
export interface VolumeAlertSummary {
  /** Total alerts */
  totalAlerts: number;

  /** Alerts by type */
  byType: Record<UnusualVolumeAlertType, number>;

  /** Alerts by severity */
  bySeverity: Record<VolumeAlertSeverity, number>;

  /** Alerts by status */
  byStatus: Record<VolumeAlertStatus, number>;

  /** Recent alerts */
  recentAlerts: UnusualVolumeAlert[];

  /** Markets with most alerts */
  topAlertMarkets: Array<{
    marketId: string;
    alertCount: number;
    highestSeverity: VolumeAlertSeverity;
  }>;

  /** Average z-score for alerted volumes */
  averageZScore: number | null;

  /** Most common alert type */
  mostCommonType: UnusualVolumeAlertType | null;

  /** Highest severity seen */
  highestSeverity: VolumeAlertSeverity | null;
}

/**
 * Alert listener callback type
 */
export type VolumeAlertListener = (alert: UnusualVolumeAlert) => void | Promise<void>;

/**
 * Configuration for UnusualVolumeAlertGenerator
 */
export interface UnusualVolumeAlertGeneratorConfig {
  /** Volume spike detector */
  spikeDetector?: VolumeSpikeDetector;

  /** Trade size analyzer */
  tradeSizeAnalyzer?: TradeSizeAnalyzer;

  /** Market impact calculator */
  impactCalculator?: MarketImpactCalculator;

  /** Consecutive large trade detector */
  burstDetector?: ConsecutiveLargeTradeDetector;

  /** Rolling volume tracker */
  volumeTracker?: RollingVolumeTracker;

  /** Custom alert conditions (merged with defaults) */
  customConditions?: VolumeAlertCondition[];

  /** Replace default conditions entirely */
  replaceDefaultConditions?: boolean;

  /** Enable event emission (default: true) */
  enableEvents?: boolean;

  /** Default alert expiration in milliseconds (default: 24 hours) */
  defaultExpirationMs?: number;

  /** Cooldown between alerts for same market in milliseconds (default: 60 seconds) */
  cooldownMs?: number;

  /** Maximum alerts to store (default: 500) */
  maxStoredAlerts?: number;

  /** Primary comparison window (default: 5 minutes) */
  primaryWindow?: RollingWindow;
}

// ============================================================================
// Constants
// ============================================================================

/** Default alert expiration: 24 hours */
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Default cooldown period */
const DEFAULT_COOLDOWN_MS = 60 * 1000;

/** Default maximum stored alerts */
const DEFAULT_MAX_STORED_ALERTS = 500;

/** Recent alert window for frequency tracking (1 hour) */
const RECENT_ALERT_WINDOW_MS = 60 * 60 * 1000;

/** Severity ordering for comparisons */
const SEVERITY_ORDER: Record<VolumeAlertSeverity, number> = {
  [VolumeAlertSeverity.LOW]: 1,
  [VolumeAlertSeverity.MEDIUM]: 2,
  [VolumeAlertSeverity.HIGH]: 3,
  [VolumeAlertSeverity.CRITICAL]: 4,
};

/** Default alert conditions */
export const DEFAULT_VOLUME_ALERT_CONDITIONS: VolumeAlertCondition[] = [
  {
    id: "critical_volume_spike",
    name: "Critical Volume Spike",
    description: "Volume spike with critical severity (z-score >= 4.0 or 500%+ of baseline)",
    enabled: true,
    alertType: UnusualVolumeAlertType.VOLUME_SPIKE,
    minZScore: 4.0,
    overrideSeverity: VolumeAlertSeverity.CRITICAL,
    tags: ["critical", "volume_spike"],
  },
  {
    id: "high_volume_spike",
    name: "High Volume Spike",
    description: "Volume spike with high severity (z-score >= 3.0 or 300%+ of baseline)",
    enabled: true,
    alertType: UnusualVolumeAlertType.VOLUME_SPIKE,
    minZScore: 3.0,
    overrideSeverity: VolumeAlertSeverity.HIGH,
    tags: ["high", "volume_spike"],
  },
  {
    id: "sustained_high_volume",
    name: "Sustained High Volume",
    description: "Sustained volume spike lasting 5+ minutes",
    enabled: true,
    alertType: UnusualVolumeAlertType.SUSTAINED_HIGH_VOLUME,
    minZScore: 2.5,
    predicate: (ctx) => ctx.durationMinutes >= 5 && ctx.spikeType === VolumeSpikeType.SUSTAINED,
    tags: ["sustained", "volume_spike"],
  },
  {
    id: "whale_trade",
    name: "Whale Trade Detected",
    description: "Whale-sized trade detected (typically top 0.1% by size)",
    enabled: true,
    alertType: UnusualVolumeAlertType.WHALE_TRADE,
    minTradeSizeUsd: 50000,
    predicate: (ctx) => ctx.tradeInfo?.tradeSizeCategory === TradeSizeCategory.WHALE,
    overrideSeverity: VolumeAlertSeverity.HIGH,
    tags: ["whale", "large_trade"],
  },
  {
    id: "large_trade",
    name: "Large Trade Detected",
    description: "Significantly large trade detected",
    enabled: true,
    alertType: UnusualVolumeAlertType.LARGE_TRADE,
    minTradeSizeUsd: 10000,
    predicate: (ctx) =>
      ctx.tradeInfo?.tradeSizeCategory === TradeSizeCategory.LARGE ||
      ctx.tradeInfo?.tradeSizeCategory === TradeSizeCategory.VERY_LARGE,
    tags: ["large_trade"],
  },
  {
    id: "trade_burst",
    name: "Trade Burst Detected",
    description: "Series of large trades in quick succession",
    enabled: true,
    alertType: UnusualVolumeAlertType.TRADE_BURST,
    predicate: (ctx) => ctx.burstInfo !== null && ctx.burstInfo.tradeCount >= 3,
    tags: ["burst", "consecutive_trades"],
  },
  {
    id: "coordinated_burst",
    name: "Coordinated Trade Burst",
    description: "Coordinated burst pattern from multiple wallets",
    enabled: true,
    alertType: UnusualVolumeAlertType.COORDINATED_VOLUME,
    predicate: (ctx) =>
      ctx.burstInfo !== null &&
      (ctx.burstInfo.patternType === BurstPatternType.COORDINATED_BURST ||
       ctx.burstInfo.patternType === BurstPatternType.COMBINED_BURST),
    overrideSeverity: VolumeAlertSeverity.HIGH,
    tags: ["coordinated", "burst"],
  },
  {
    id: "excessive_impact",
    name: "Excessive Market Impact",
    description: "Trade with excessive market impact (2x+ expected)",
    enabled: true,
    alertType: UnusualVolumeAlertType.EXCESSIVE_IMPACT,
    predicate: (ctx) =>
      ctx.impactInfo !== null &&
      ctx.impactInfo.impactRatio !== null &&
      ctx.impactInfo.impactRatio >= 2.0,
    overrideSeverity: VolumeAlertSeverity.HIGH,
    tags: ["excessive_impact", "market_impact"],
  },
  {
    id: "high_impact",
    name: "High Market Impact",
    description: "Trade with high market impact (200+ bps)",
    enabled: true,
    alertType: UnusualVolumeAlertType.HIGH_IMPACT,
    minImpactBps: 200,
    predicate: (ctx) =>
      ctx.impactInfo !== null &&
      ctx.impactInfo.impactBps !== null &&
      ctx.impactInfo.impactBps >= 200,
    tags: ["high_impact", "market_impact"],
  },
  {
    id: "front_running_suspected",
    name: "Potential Front-Running",
    description: "Trade pattern suggests potential front-running",
    enabled: true,
    alertType: UnusualVolumeAlertType.GENERAL_ANOMALY,
    predicate: (ctx) =>
      ctx.impactInfo !== null &&
      ctx.impactInfo.anomalyType === ImpactAnomalyType.FRONT_RUNNING,
    overrideSeverity: VolumeAlertSeverity.CRITICAL,
    tags: ["front_running", "manipulation_suspected"],
  },
  {
    id: "medium_volume_spike",
    name: "Medium Volume Spike",
    description: "Volume spike with medium severity (z-score >= 2.5 or 200%+ of baseline)",
    enabled: true,
    alertType: UnusualVolumeAlertType.VOLUME_SPIKE,
    minZScore: 2.5,
    minPercentageOfBaseline: 2.0,
    overrideSeverity: VolumeAlertSeverity.MEDIUM,
    tags: ["medium", "volume_spike"],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `uva_${timestamp}_${random}`;
}

/**
 * Map spike severity to alert severity
 */
function mapSpikeSeverity(spikeSeverity: SpikeSeverity): VolumeAlertSeverity {
  switch (spikeSeverity) {
    case SpikeSeverity.CRITICAL:
      return VolumeAlertSeverity.CRITICAL;
    case SpikeSeverity.HIGH:
      return VolumeAlertSeverity.HIGH;
    case SpikeSeverity.MEDIUM:
      return VolumeAlertSeverity.MEDIUM;
    case SpikeSeverity.LOW:
    default:
      return VolumeAlertSeverity.LOW;
  }
}

/**
 * Map trade size severity to alert severity
 */
function mapTradeSizeSeverity(tradeSeverity: TradeSizeSeverity): VolumeAlertSeverity {
  switch (tradeSeverity) {
    case TradeSizeSeverity.CRITICAL:
      return VolumeAlertSeverity.CRITICAL;
    case TradeSizeSeverity.HIGH:
      return VolumeAlertSeverity.HIGH;
    case TradeSizeSeverity.MEDIUM:
      return VolumeAlertSeverity.MEDIUM;
    case TradeSizeSeverity.LOW:
    default:
      return VolumeAlertSeverity.LOW;
  }
}

/**
 * Map impact severity to alert severity
 */
function mapImpactSeverity(impactSeverity: ImpactSeverity): VolumeAlertSeverity {
  switch (impactSeverity) {
    case ImpactSeverity.EXTREME:
      return VolumeAlertSeverity.CRITICAL;
    case ImpactSeverity.HIGH:
      return VolumeAlertSeverity.HIGH;
    case ImpactSeverity.MEDIUM:
      return VolumeAlertSeverity.MEDIUM;
    case ImpactSeverity.LOW:
    case ImpactSeverity.NEGLIGIBLE:
    default:
      return VolumeAlertSeverity.LOW;
  }
}

/**
 * Map burst severity to alert severity
 */
function mapBurstSeverity(burstSeverity: BurstSeverity): VolumeAlertSeverity {
  switch (burstSeverity) {
    case BurstSeverity.CRITICAL:
      return VolumeAlertSeverity.CRITICAL;
    case BurstSeverity.HIGH:
      return VolumeAlertSeverity.HIGH;
    case BurstSeverity.MEDIUM:
      return VolumeAlertSeverity.MEDIUM;
    case BurstSeverity.LOW:
    default:
      return VolumeAlertSeverity.LOW;
  }
}

/**
 * Get higher of two severities
 */
function getHigherSeverity(
  s1: VolumeAlertSeverity | null,
  s2: VolumeAlertSeverity | null
): VolumeAlertSeverity | null {
  if (s1 === null) return s2;
  if (s2 === null) return s1;
  return SEVERITY_ORDER[s1] >= SEVERITY_ORDER[s2] ? s1 : s2;
}

// ============================================================================
// UnusualVolumeAlertGenerator Class
// ============================================================================

/**
 * Event types emitted by UnusualVolumeAlertGenerator
 */
export interface UnusualVolumeAlertGeneratorEvents {
  alertGenerated: (alert: UnusualVolumeAlert) => void;
  criticalAlert: (alert: UnusualVolumeAlert) => void;
  highAlert: (alert: UnusualVolumeAlert) => void;
}

/**
 * Generator for unusual volume alerts
 */
export class UnusualVolumeAlertGenerator extends EventEmitter {
  private readonly volumeTracker: RollingVolumeTracker;
  private readonly conditions: VolumeAlertCondition[];
  private readonly enableEvents: boolean;
  private readonly defaultExpirationMs: number;
  private readonly cooldownMs: number;
  private readonly maxStoredAlerts: number;
  private readonly primaryWindow: RollingWindow;

  // Alert storage
  private readonly storedAlerts: Map<string, UnusualVolumeAlert> = new Map();

  // Listeners
  private readonly alertListeners: Set<VolumeAlertListener> = new Set();

  // Cooldown tracking per market
  private readonly lastAlertTimes: Map<string, number> = new Map();

  // Alert counter for unique IDs
  private alertCounter = 0;

  constructor(config?: UnusualVolumeAlertGeneratorConfig) {
    super();

    this.volumeTracker = config?.volumeTracker ?? getSharedRollingVolumeTracker();

    // Build conditions list
    if (config?.replaceDefaultConditions && config?.customConditions) {
      this.conditions = [...config.customConditions];
    } else {
      this.conditions = [
        ...DEFAULT_VOLUME_ALERT_CONDITIONS,
        ...(config?.customConditions ?? []),
      ];
    }

    this.enableEvents = config?.enableEvents ?? true;
    this.defaultExpirationMs = config?.defaultExpirationMs ?? DEFAULT_EXPIRATION_MS;
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.maxStoredAlerts = config?.maxStoredAlerts ?? DEFAULT_MAX_STORED_ALERTS;
    this.primaryWindow = config?.primaryWindow ?? RollingWindow.FIVE_MINUTES;
  }

  /**
   * Process a volume spike event and generate alerts if conditions are met
   */
  processSpikeEvent(
    event: VolumeSpikeEvent,
    options?: GenerateVolumeAlertOptions
  ): ProcessSpikeResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Build volume comparison data
    const volumeComparison: VolumeComparisonData = {
      currentVolume: event.currentVolume,
      baselineVolume: event.baselineVolume,
      baselineStdDev: event.baselineStdDev,
      zScore: event.zScore,
      percentageOfBaseline: event.percentageOfBaseline,
      percentageChange:
        event.baselineVolume > 0
          ? ((event.currentVolume - event.baselineVolume) / event.baselineVolume) * 100
          : null,
      comparisonWindow: event.window,
      isBaselineReliable: event.context.dataReliability > 0.3,
    };

    // Build context
    const context: VolumeAlertContext = {
      marketId: event.marketId,
      volumeComparison,
      spikeType: event.spikeType,
      spikeDirection: event.direction,
      durationMinutes: event.durationMinutes,
      tradeInfo: null,
      impactInfo: null,
      burstInfo: null,
      recentAlertCount: this.getRecentAlertCount(event.marketId, now),
      isRecurring: event.context.isRecurring,
      notes: [],
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(event.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: VolumeAlertSeverity | null = null;
    let alertType: UnusualVolumeAlertType = UnusualVolumeAlertType.VOLUME_SPIKE;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isVolumeConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ?? condition.overrideSeverity ?? mapSpikeSeverity(event.severity);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? VolumeAlertSeverity.LOW,
      event.marketId,
      context,
      "VolumeSpikeDetector",
      event.eventId,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(event.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a large trade event and generate alerts if conditions are met
   */
  processLargeTradeEvent(
    event: LargeTradeEvent,
    options?: GenerateVolumeAlertOptions
  ): ProcessLargeTradeResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Get volume comparison data from tracker
    const averages = this.volumeTracker.getRollingAverages(event.trade.marketId, {
      windows: [this.primaryWindow],
      asOf: now,
    });

    const windowResult = averages?.windowResults[this.primaryWindow];

    const volumeComparison: VolumeComparisonData = {
      currentVolume: event.trade.sizeUsd,
      baselineVolume: windowResult?.averageVolumePerMinute ?? 0,
      baselineStdDev: windowResult?.standardDeviation ?? 0,
      zScore: windowResult?.standardDeviation && windowResult.standardDeviation > 0
        ? (event.trade.sizeUsd - (windowResult.averageVolumePerMinute ?? 0)) / windowResult.standardDeviation
        : null,
      percentageOfBaseline:
        windowResult?.averageVolumePerMinute && windowResult.averageVolumePerMinute > 0
          ? event.trade.sizeUsd / windowResult.averageVolumePerMinute
          : null,
      percentageChange:
        windowResult?.averageVolumePerMinute && windowResult.averageVolumePerMinute > 0
          ? ((event.trade.sizeUsd - windowResult.averageVolumePerMinute) / windowResult.averageVolumePerMinute) * 100
          : null,
      comparisonWindow: this.primaryWindow,
      isBaselineReliable: windowResult?.isReliable ?? false,
    };

    // Build context
    const context: VolumeAlertContext = {
      marketId: event.trade.marketId,
      volumeComparison,
      spikeType: null,
      spikeDirection: null,
      durationMinutes: 0,
      tradeInfo: {
        tradeId: event.trade.tradeId,
        walletAddress: event.trade.walletAddress ?? null,
        tradeSizeUsd: event.trade.sizeUsd,
        tradeSizeCategory: event.category,
        isOutlier: false,
      },
      impactInfo: null,
      burstInfo: null,
      recentAlertCount: this.getRecentAlertCount(event.trade.marketId, now),
      isRecurring: false,
      notes: [],
    };

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(event.trade.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: VolumeAlertSeverity | null = null;
    let alertType: UnusualVolumeAlertType = UnusualVolumeAlertType.LARGE_TRADE;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isTradeConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ?? condition.overrideSeverity ?? mapTradeSizeSeverity(event.severity);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? VolumeAlertSeverity.LOW,
      event.trade.marketId,
      context,
      "TradeSizeAnalyzer",
      event.eventId,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(event.trade.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a high impact event and generate alerts if conditions are met
   */
  processHighImpactEvent(
    event: HighImpactEvent,
    options?: GenerateVolumeAlertOptions
  ): ProcessHighImpactResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Get volume comparison data from tracker
    const averages = this.volumeTracker.getRollingAverages(event.trade.marketId, {
      windows: [this.primaryWindow],
      asOf: now,
    });

    const windowResult = averages?.windowResults[this.primaryWindow];

    const volumeComparison: VolumeComparisonData = {
      currentVolume: event.trade.sizeUsd,
      baselineVolume: windowResult?.averageVolumePerMinute ?? 0,
      baselineStdDev: windowResult?.standardDeviation ?? 0,
      zScore: null,
      percentageOfBaseline: null,
      percentageChange: null,
      comparisonWindow: this.primaryWindow,
      isBaselineReliable: windowResult?.isReliable ?? false,
    };

    // Build context
    const context: VolumeAlertContext = {
      marketId: event.trade.marketId,
      volumeComparison,
      spikeType: null,
      spikeDirection: null,
      durationMinutes: 0,
      tradeInfo: {
        tradeId: event.trade.tradeId,
        walletAddress: event.trade.walletAddress,
        tradeSizeUsd: event.trade.sizeUsd,
        tradeSizeCategory: null,
        isOutlier: false,
      },
      impactInfo: {
        impactBps: event.impactResult.impactBps,
        impactRatio: event.impactResult.impactRatio,
        anomalyType: event.anomalyType,
      },
      burstInfo: null,
      recentAlertCount: this.getRecentAlertCount(event.trade.marketId, now),
      isRecurring: false,
      notes: [],
    };

    // Add notes based on anomaly
    if (event.anomalyType === ImpactAnomalyType.FRONT_RUNNING) {
      context.notes.push("Potential front-running detected");
    }
    if (event.impactResult.isExcessive) {
      context.notes.push(`Excessive impact: ${event.impactResult.impactRatio.toFixed(2)}x expected`);
    }

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(event.trade.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: VolumeAlertSeverity | null = null;
    let alertType: UnusualVolumeAlertType = UnusualVolumeAlertType.HIGH_IMPACT;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isImpactConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ?? condition.overrideSeverity ?? mapImpactSeverity(event.severity);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? VolumeAlertSeverity.LOW,
      event.trade.marketId,
      context,
      "MarketImpactCalculator",
      event.eventId,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(event.trade.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Process a burst event and generate alerts if conditions are met
   */
  processBurstEvent(
    event: BurstEvent,
    options?: GenerateVolumeAlertOptions
  ): ProcessBurstResult {
    const now = options?.timestamp ?? Date.now();
    const matchedConditions: string[] = [];

    // Get volume comparison data from tracker
    const averages = this.volumeTracker.getRollingAverages(event.marketId, {
      windows: [this.primaryWindow],
      asOf: now,
    });

    const windowResult = averages?.windowResults[this.primaryWindow];

    const volumeComparison: VolumeComparisonData = {
      currentVolume: event.totalVolumeUsd,
      baselineVolume: windowResult?.averageVolumePerMinute ?? 0,
      baselineStdDev: windowResult?.standardDeviation ?? 0,
      zScore: null,
      percentageOfBaseline:
        windowResult?.averageVolumePerMinute && windowResult.averageVolumePerMinute > 0
          ? event.totalVolumeUsd / windowResult.averageVolumePerMinute
          : null,
      percentageChange: null,
      comparisonWindow: this.primaryWindow,
      isBaselineReliable: windowResult?.isReliable ?? false,
    };

    // Build context
    const context: VolumeAlertContext = {
      marketId: event.marketId,
      volumeComparison,
      spikeType: null,
      spikeDirection: null,
      durationMinutes: event.durationMs / (60 * 1000),
      tradeInfo: null,
      impactInfo: null,
      burstInfo: {
        tradeCount: event.consecutiveCount,
        totalVolume: event.totalVolumeUsd,
        patternType: event.patternType,
      },
      recentAlertCount: this.getRecentAlertCount(event.marketId, now),
      isRecurring: false,
      notes: [],
    };

    // Add notes based on pattern
    if (event.patternType === BurstPatternType.COORDINATED_BURST ||
        event.patternType === BurstPatternType.COMBINED_BURST) {
      context.notes.push("Coordinated burst from multiple wallets - potential coordinated activity");
    }

    // Check cooldown
    if (!options?.bypassCooldown && !this.checkCooldown(event.marketId, now)) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Evaluate conditions
    let highestSeverity: VolumeAlertSeverity | null = null;
    let alertType: UnusualVolumeAlertType = UnusualVolumeAlertType.TRADE_BURST;

    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (!this.isBurstConditionRelevant(condition)) continue;

      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition.id);

        const conditionSeverity =
          options?.overrideSeverity ?? condition.overrideSeverity ?? mapBurstSeverity(event.severity);

        highestSeverity = getHigherSeverity(highestSeverity, conditionSeverity);
        alertType = condition.alertType;
      }
    }

    if (matchedConditions.length === 0) {
      return { alert: null, conditionsMet: false, matchedConditions: [] };
    }

    // Create alert
    const alert = this.createAlert(
      alertType,
      highestSeverity ?? VolumeAlertSeverity.LOW,
      event.marketId,
      context,
      "ConsecutiveLargeTradeDetector",
      event.eventId,
      options
    );

    // Store and emit
    this.storeAlert(alert);
    this.updateCooldown(event.marketId, now);
    this.notifyListeners(alert);

    return { alert, conditionsMet: true, matchedConditions };
  }

  /**
   * Generate alerts for a spike detection result
   */
  generateFromSpikeResult(
    result: SpikeDetectionResult,
    options?: GenerateVolumeAlertOptions
  ): UnusualVolumeAlert | null {
    if (!result.isSpike || !result.spikeEvent) {
      return null;
    }

    const processResult = this.processSpikeEvent(result.spikeEvent, options);
    return processResult.alert;
  }

  /**
   * Get alerts for a specific market
   */
  getAlertsForMarket(marketId: string): UnusualVolumeAlert[] {
    const alerts: UnusualVolumeAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.marketId === marketId) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all stored alerts
   */
  getAllAlerts(): UnusualVolumeAlert[] {
    return Array.from(this.storedAlerts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: UnusualVolumeAlertType): UnusualVolumeAlert[] {
    const alerts: UnusualVolumeAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.type === type) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: VolumeAlertSeverity): UnusualVolumeAlert[] {
    const alerts: UnusualVolumeAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.severity === severity) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): UnusualVolumeAlert[] {
    return this.getAllAlerts().slice(0, limit);
  }

  /**
   * Get alert by ID
   */
  getAlertById(id: string): UnusualVolumeAlert | null {
    return this.storedAlerts.get(id) ?? null;
  }

  /**
   * Update alert status
   */
  updateAlertStatus(id: string, status: VolumeAlertStatus): boolean {
    const alert = this.storedAlerts.get(id);
    if (!alert) {
      return false;
    }

    alert.status = status;
    return true;
  }

  /**
   * Delete an alert
   */
  deleteAlert(id: string): boolean {
    return this.storedAlerts.delete(id);
  }

  /**
   * Clear all stored alerts
   */
  clearAlerts(): void {
    this.storedAlerts.clear();
    this.lastAlertTimes.clear();
  }

  /**
   * Clear expired alerts
   */
  clearExpiredAlerts(): number {
    const now = Date.now();
    let clearedCount = 0;

    for (const [id, alert] of this.storedAlerts.entries()) {
      if (alert.expiresAt && alert.expiresAt.getTime() < now) {
        this.storedAlerts.delete(id);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Get alert summary statistics
   */
  getSummary(): VolumeAlertSummary {
    const alerts = Array.from(this.storedAlerts.values());
    const now = Date.now();

    const byType: Record<UnusualVolumeAlertType, number> = {
      [UnusualVolumeAlertType.VOLUME_SPIKE]: 0,
      [UnusualVolumeAlertType.SUSTAINED_HIGH_VOLUME]: 0,
      [UnusualVolumeAlertType.LARGE_TRADE]: 0,
      [UnusualVolumeAlertType.WHALE_TRADE]: 0,
      [UnusualVolumeAlertType.TRADE_BURST]: 0,
      [UnusualVolumeAlertType.HIGH_IMPACT]: 0,
      [UnusualVolumeAlertType.EXCESSIVE_IMPACT]: 0,
      [UnusualVolumeAlertType.COORDINATED_VOLUME]: 0,
      [UnusualVolumeAlertType.OFF_HOURS_ANOMALY]: 0,
      [UnusualVolumeAlertType.PRE_EVENT_SURGE]: 0,
      [UnusualVolumeAlertType.GENERAL_ANOMALY]: 0,
    };

    const bySeverity: Record<VolumeAlertSeverity, number> = {
      [VolumeAlertSeverity.LOW]: 0,
      [VolumeAlertSeverity.MEDIUM]: 0,
      [VolumeAlertSeverity.HIGH]: 0,
      [VolumeAlertSeverity.CRITICAL]: 0,
    };

    const byStatus: Record<VolumeAlertStatus, number> = {
      [VolumeAlertStatus.NEW]: 0,
      [VolumeAlertStatus.READ]: 0,
      [VolumeAlertStatus.ACKNOWLEDGED]: 0,
      [VolumeAlertStatus.DISMISSED]: 0,
      [VolumeAlertStatus.RESOLVED]: 0,
    };

    let totalZScore = 0;
    let zScoreCount = 0;
    let highestSeverityOrder = 0;
    let highestSeverity: VolumeAlertSeverity | null = null;

    // Market alert counts
    const marketAlertCounts = new Map<
      string,
      { count: number; highestSeverity: VolumeAlertSeverity }
    >();

    for (const alert of alerts) {
      byType[alert.type]++;
      bySeverity[alert.severity]++;
      byStatus[alert.status]++;

      if (alert.context.volumeComparison.zScore !== null) {
        totalZScore += alert.context.volumeComparison.zScore;
        zScoreCount++;
      }

      const severityOrder = SEVERITY_ORDER[alert.severity];
      if (severityOrder > highestSeverityOrder) {
        highestSeverityOrder = severityOrder;
        highestSeverity = alert.severity;
      }

      // Track market alerts
      const existing = marketAlertCounts.get(alert.marketId);
      if (existing) {
        existing.count++;
        if (SEVERITY_ORDER[alert.severity] > SEVERITY_ORDER[existing.highestSeverity]) {
          existing.highestSeverity = alert.severity;
        }
      } else {
        marketAlertCounts.set(alert.marketId, {
          count: 1,
          highestSeverity: alert.severity,
        });
      }
    }

    // Find most common type
    let mostCommonType: UnusualVolumeAlertType | null = null;
    let maxTypeCount = 0;
    for (const [type, count] of Object.entries(byType)) {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        mostCommonType = type as UnusualVolumeAlertType;
      }
    }

    // Get top alert markets
    const topAlertMarkets = Array.from(marketAlertCounts.entries())
      .map(([marketId, data]) => ({
        marketId,
        alertCount: data.count,
        highestSeverity: data.highestSeverity,
      }))
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, 10);

    // Get recent alerts
    const recentAlerts = alerts
      .filter((a) => now - a.createdAt.getTime() < RECENT_ALERT_WINDOW_MS)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

    return {
      totalAlerts: alerts.length,
      byType,
      bySeverity,
      byStatus,
      recentAlerts,
      topAlertMarkets,
      averageZScore: zScoreCount > 0 ? totalZScore / zScoreCount : null,
      mostCommonType,
      highestSeverity,
    };
  }

  /**
   * Add an alert listener
   */
  addAlertListener(listener: VolumeAlertListener): void {
    this.alertListeners.add(listener);
  }

  /**
   * Remove an alert listener
   */
  removeAlertListener(listener: VolumeAlertListener): void {
    this.alertListeners.delete(listener);
  }

  /**
   * Get the number of stored alerts
   */
  getAlertCount(): number {
    return this.storedAlerts.size;
  }

  /**
   * Get all conditions
   */
  getConditions(): VolumeAlertCondition[] {
    return [...this.conditions];
  }

  /**
   * Get enabled conditions
   */
  getEnabledConditions(): VolumeAlertCondition[] {
    return this.conditions.filter((c) => c.enabled);
  }

  /**
   * Enable a condition by ID
   */
  enableCondition(id: string): boolean {
    const condition = this.conditions.find((c) => c.id === id);
    if (condition) {
      condition.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a condition by ID
   */
  disableCondition(id: string): boolean {
    const condition = this.conditions.find((c) => c.id === id);
    if (condition) {
      condition.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStats(): {
    storedAlerts: number;
    enabledConditions: number;
    totalConditions: number;
    cooldownMs: number;
    primaryWindow: RollingWindow;
  } {
    return {
      storedAlerts: this.storedAlerts.size,
      enabledConditions: this.conditions.filter((c) => c.enabled).length,
      totalConditions: this.conditions.length,
      cooldownMs: this.cooldownMs,
      primaryWindow: this.primaryWindow,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private evaluateCondition(
    condition: VolumeAlertCondition,
    context: VolumeAlertContext
  ): boolean {
    const { volumeComparison } = context;

    // Check z-score threshold
    if (
      condition.minZScore !== undefined &&
      volumeComparison.zScore !== null &&
      Math.abs(volumeComparison.zScore) < condition.minZScore
    ) {
      return false;
    }

    // Check percentage of baseline threshold
    if (
      condition.minPercentageOfBaseline !== undefined &&
      volumeComparison.percentageOfBaseline !== null &&
      volumeComparison.percentageOfBaseline < condition.minPercentageOfBaseline
    ) {
      return false;
    }

    // Check percentage change threshold
    if (
      condition.minPercentageChange !== undefined &&
      volumeComparison.percentageChange !== null &&
      Math.abs(volumeComparison.percentageChange) < condition.minPercentageChange
    ) {
      return false;
    }

    // Check trade size threshold
    if (
      condition.minTradeSizeUsd !== undefined &&
      context.tradeInfo?.tradeSizeUsd !== null &&
      context.tradeInfo?.tradeSizeUsd !== undefined &&
      context.tradeInfo.tradeSizeUsd < condition.minTradeSizeUsd
    ) {
      return false;
    }

    // Check impact threshold
    if (
      condition.minImpactBps !== undefined &&
      context.impactInfo?.impactBps !== null &&
      context.impactInfo?.impactBps !== undefined &&
      context.impactInfo.impactBps < condition.minImpactBps
    ) {
      return false;
    }

    // Check custom predicate
    if (condition.predicate && !condition.predicate(context)) {
      return false;
    }

    return true;
  }

  private isVolumeConditionRelevant(condition: VolumeAlertCondition): boolean {
    return (
      condition.alertType === UnusualVolumeAlertType.VOLUME_SPIKE ||
      condition.alertType === UnusualVolumeAlertType.SUSTAINED_HIGH_VOLUME ||
      condition.alertType === UnusualVolumeAlertType.GENERAL_ANOMALY
    );
  }

  private isTradeConditionRelevant(condition: VolumeAlertCondition): boolean {
    return (
      condition.alertType === UnusualVolumeAlertType.LARGE_TRADE ||
      condition.alertType === UnusualVolumeAlertType.WHALE_TRADE ||
      condition.alertType === UnusualVolumeAlertType.GENERAL_ANOMALY
    );
  }

  private isImpactConditionRelevant(condition: VolumeAlertCondition): boolean {
    return (
      condition.alertType === UnusualVolumeAlertType.HIGH_IMPACT ||
      condition.alertType === UnusualVolumeAlertType.EXCESSIVE_IMPACT ||
      condition.alertType === UnusualVolumeAlertType.GENERAL_ANOMALY
    );
  }

  private isBurstConditionRelevant(condition: VolumeAlertCondition): boolean {
    return (
      condition.alertType === UnusualVolumeAlertType.TRADE_BURST ||
      condition.alertType === UnusualVolumeAlertType.COORDINATED_VOLUME ||
      condition.alertType === UnusualVolumeAlertType.GENERAL_ANOMALY
    );
  }

  private checkCooldown(marketId: string, now: number): boolean {
    const lastAlertTime = this.lastAlertTimes.get(marketId);
    if (lastAlertTime === undefined) {
      return true;
    }
    return now - lastAlertTime >= this.cooldownMs;
  }

  private updateCooldown(marketId: string, now: number): void {
    this.lastAlertTimes.set(marketId, now);
  }

  private getRecentAlertCount(marketId: string, now: number): number {
    let count = 0;
    for (const alert of this.storedAlerts.values()) {
      if (
        alert.marketId === marketId &&
        now - alert.createdAt.getTime() < RECENT_ALERT_WINDOW_MS
      ) {
        count++;
      }
    }
    return count;
  }

  private createAlert(
    type: UnusualVolumeAlertType,
    severity: VolumeAlertSeverity,
    marketId: string,
    context: VolumeAlertContext,
    sourceDetector: string,
    sourceEventId: string | null,
    options?: GenerateVolumeAlertOptions
  ): UnusualVolumeAlert {
    this.alertCounter++;
    const id = generateAlertId();

    const title = this.generateTitle(type, severity, context);
    const message = this.generateMessage(type, context);

    const tags = this.generateTags(type, severity, context);
    if (options?.additionalTags) {
      tags.push(...options.additionalTags);
    }

    const expirationMs = options?.expirationMs ?? this.defaultExpirationMs;
    const expiresAt = new Date(Date.now() + expirationMs);

    return {
      id,
      type,
      severity,
      marketId,
      title,
      message,
      context,
      tags,
      status: VolumeAlertStatus.NEW,
      createdAt: new Date(),
      expiresAt,
      sourceDetector,
      sourceEventId,
    };
  }

  private generateTitle(
    type: UnusualVolumeAlertType,
    severity: VolumeAlertSeverity,
    context: VolumeAlertContext
  ): string {
    const severityPrefix = this.getSeverityPrefix(severity);
    const { volumeComparison } = context;

    switch (type) {
      case UnusualVolumeAlertType.VOLUME_SPIKE:
        if (volumeComparison.zScore !== null) {
          return `${severityPrefix}Volume Spike (${volumeComparison.zScore.toFixed(1)}σ)`;
        }
        if (volumeComparison.percentageOfBaseline !== null) {
          return `${severityPrefix}Volume Spike (${(volumeComparison.percentageOfBaseline * 100).toFixed(0)}% of baseline)`;
        }
        return `${severityPrefix}Volume Spike Detected`;

      case UnusualVolumeAlertType.SUSTAINED_HIGH_VOLUME:
        return `${severityPrefix}Sustained High Volume (${context.durationMinutes.toFixed(0)} min)`;

      case UnusualVolumeAlertType.LARGE_TRADE:
        if (context.tradeInfo?.tradeSizeUsd) {
          return `${severityPrefix}Large Trade ($${context.tradeInfo.tradeSizeUsd.toLocaleString()})`;
        }
        return `${severityPrefix}Large Trade Detected`;

      case UnusualVolumeAlertType.WHALE_TRADE:
        if (context.tradeInfo?.tradeSizeUsd) {
          return `${severityPrefix}Whale Trade ($${context.tradeInfo.tradeSizeUsd.toLocaleString()})`;
        }
        return `${severityPrefix}Whale Trade Detected`;

      case UnusualVolumeAlertType.TRADE_BURST:
        if (context.burstInfo) {
          return `${severityPrefix}Trade Burst (${context.burstInfo.tradeCount} trades)`;
        }
        return `${severityPrefix}Trade Burst Detected`;

      case UnusualVolumeAlertType.HIGH_IMPACT:
        if (context.impactInfo?.impactBps) {
          return `${severityPrefix}High Market Impact (${context.impactInfo.impactBps} bps)`;
        }
        return `${severityPrefix}High Market Impact`;

      case UnusualVolumeAlertType.EXCESSIVE_IMPACT:
        if (context.impactInfo?.impactRatio) {
          return `${severityPrefix}Excessive Impact (${context.impactInfo.impactRatio.toFixed(1)}x expected)`;
        }
        return `${severityPrefix}Excessive Market Impact`;

      case UnusualVolumeAlertType.COORDINATED_VOLUME:
        return `${severityPrefix}Coordinated Volume Activity`;

      case UnusualVolumeAlertType.OFF_HOURS_ANOMALY:
        return `${severityPrefix}Off-Hours Volume Anomaly`;

      case UnusualVolumeAlertType.PRE_EVENT_SURGE:
        return `${severityPrefix}Pre-Event Volume Surge`;

      case UnusualVolumeAlertType.GENERAL_ANOMALY:
      default:
        return `${severityPrefix}Volume Anomaly Detected`;
    }
  }

  private generateMessage(
    type: UnusualVolumeAlertType,
    context: VolumeAlertContext
  ): string {
    const parts: string[] = [];
    const { volumeComparison } = context;

    parts.push(`Market: ${context.marketId}`);

    // Volume comparison
    if (volumeComparison.zScore !== null) {
      parts.push(`Z-Score: ${volumeComparison.zScore.toFixed(2)} standard deviations from mean`);
    }
    if (volumeComparison.percentageOfBaseline !== null) {
      parts.push(`Volume: ${(volumeComparison.percentageOfBaseline * 100).toFixed(0)}% of baseline`);
    }
    if (volumeComparison.percentageChange !== null) {
      const changeDirection = volumeComparison.percentageChange >= 0 ? "+" : "";
      parts.push(`Change: ${changeDirection}${volumeComparison.percentageChange.toFixed(1)}%`);
    }

    parts.push(`Current Volume: $${volumeComparison.currentVolume.toLocaleString()}`);
    parts.push(`Baseline Volume: $${volumeComparison.baselineVolume.toLocaleString()}`);

    // Add type-specific details
    switch (type) {
      case UnusualVolumeAlertType.SUSTAINED_HIGH_VOLUME:
        parts.push(`Duration: ${context.durationMinutes.toFixed(1)} minutes`);
        break;

      case UnusualVolumeAlertType.LARGE_TRADE:
      case UnusualVolumeAlertType.WHALE_TRADE:
        if (context.tradeInfo) {
          parts.push(`Trade Size: $${context.tradeInfo.tradeSizeUsd?.toLocaleString() ?? "N/A"}`);
          if (context.tradeInfo.walletAddress) {
            parts.push(`Wallet: ${context.tradeInfo.walletAddress}`);
          }
          if (context.tradeInfo.tradeSizeCategory) {
            parts.push(`Category: ${context.tradeInfo.tradeSizeCategory}`);
          }
        }
        break;

      case UnusualVolumeAlertType.TRADE_BURST:
        if (context.burstInfo) {
          parts.push(`Trade Count: ${context.burstInfo.tradeCount}`);
          parts.push(`Total Volume: $${context.burstInfo.totalVolume.toLocaleString()}`);
          if (context.burstInfo.patternType) {
            parts.push(`Pattern: ${context.burstInfo.patternType}`);
          }
        }
        break;

      case UnusualVolumeAlertType.HIGH_IMPACT:
      case UnusualVolumeAlertType.EXCESSIVE_IMPACT:
        if (context.impactInfo) {
          parts.push(`Impact: ${context.impactInfo.impactBps ?? 0} basis points`);
          if (context.impactInfo.impactRatio !== null) {
            parts.push(`Impact Ratio: ${context.impactInfo.impactRatio.toFixed(2)}x expected`);
          }
          if (context.impactInfo.anomalyType) {
            parts.push(`Anomaly Type: ${context.impactInfo.anomalyType}`);
          }
        }
        break;
    }

    // Add notes
    if (context.notes.length > 0) {
      parts.push("");
      parts.push("Notes:");
      for (const note of context.notes.slice(0, 5)) {
        parts.push(`  - ${note}`);
      }
    }

    // Add recurring indicator
    if (context.isRecurring) {
      parts.push("");
      parts.push(`This is a recurring anomaly (${context.recentAlertCount} alerts in last hour)`);
    }

    return parts.join("\n");
  }

  private generateTags(
    type: UnusualVolumeAlertType,
    severity: VolumeAlertSeverity,
    context: VolumeAlertContext
  ): string[] {
    const tags: string[] = [
      type.toLowerCase(),
      severity.toLowerCase(),
    ];

    if (context.spikeType) {
      tags.push(context.spikeType.toLowerCase());
    }

    if (context.spikeDirection) {
      tags.push(context.spikeDirection.toLowerCase());
    }

    if (context.isRecurring) {
      tags.push("recurring");
    }

    if (context.tradeInfo?.isOutlier) {
      tags.push("outlier");
    }

    if (context.impactInfo?.anomalyType) {
      tags.push(context.impactInfo.anomalyType.toLowerCase());
    }

    if (context.burstInfo?.patternType) {
      tags.push(context.burstInfo.patternType.toLowerCase());
    }

    return tags;
  }

  private getSeverityPrefix(severity: VolumeAlertSeverity): string {
    switch (severity) {
      case VolumeAlertSeverity.CRITICAL:
        return "[CRITICAL] ";
      case VolumeAlertSeverity.HIGH:
        return "[HIGH] ";
      case VolumeAlertSeverity.MEDIUM:
        return "[MEDIUM] ";
      case VolumeAlertSeverity.LOW:
      default:
        return "";
    }
  }

  private storeAlert(alert: UnusualVolumeAlert): void {
    // Enforce max stored alerts
    if (this.storedAlerts.size >= this.maxStoredAlerts) {
      // Remove oldest alert
      const oldestId = this.storedAlerts.keys().next().value;
      if (oldestId) {
        this.storedAlerts.delete(oldestId);
      }
    }

    this.storedAlerts.set(alert.id, alert);
  }

  private async notifyListeners(alert: UnusualVolumeAlert): Promise<void> {
    // Emit events
    if (this.enableEvents) {
      this.emit("alertGenerated", alert);

      if (alert.severity === VolumeAlertSeverity.CRITICAL) {
        this.emit("criticalAlert", alert);
      } else if (alert.severity === VolumeAlertSeverity.HIGH) {
        this.emit("highAlert", alert);
      }
    }

    // Notify custom listeners
    for (const listener of this.alertListeners) {
      try {
        await listener(alert);
      } catch {
        // Silently ignore listener errors
      }
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedGenerator: UnusualVolumeAlertGenerator | null = null;

/**
 * Create a new UnusualVolumeAlertGenerator instance
 */
export function createUnusualVolumeAlertGenerator(
  config?: UnusualVolumeAlertGeneratorConfig
): UnusualVolumeAlertGenerator {
  return new UnusualVolumeAlertGenerator(config);
}

/**
 * Get the shared UnusualVolumeAlertGenerator instance
 */
export function getSharedUnusualVolumeAlertGenerator(): UnusualVolumeAlertGenerator {
  if (!sharedGenerator) {
    sharedGenerator = new UnusualVolumeAlertGenerator();
  }
  return sharedGenerator;
}

/**
 * Set the shared UnusualVolumeAlertGenerator instance
 */
export function setSharedUnusualVolumeAlertGenerator(
  generator: UnusualVolumeAlertGenerator
): void {
  sharedGenerator = generator;
}

/**
 * Reset the shared UnusualVolumeAlertGenerator instance
 */
export function resetSharedUnusualVolumeAlertGenerator(): void {
  if (sharedGenerator) {
    sharedGenerator.clearAlerts();
    sharedGenerator.removeAllListeners();
  }
  sharedGenerator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate alert from spike event (convenience function)
 */
export function generateVolumeAlertFromSpike(
  event: VolumeSpikeEvent,
  options?: GenerateVolumeAlertOptions & { generator?: UnusualVolumeAlertGenerator }
): UnusualVolumeAlert | null {
  const generator = options?.generator ?? getSharedUnusualVolumeAlertGenerator();
  const result = generator.processSpikeEvent(event, options);
  return result.alert;
}

/**
 * Generate alert from large trade event (convenience function)
 */
export function generateVolumeAlertFromLargeTrade(
  event: LargeTradeEvent,
  options?: GenerateVolumeAlertOptions & { generator?: UnusualVolumeAlertGenerator }
): UnusualVolumeAlert | null {
  const generator = options?.generator ?? getSharedUnusualVolumeAlertGenerator();
  const result = generator.processLargeTradeEvent(event, options);
  return result.alert;
}

/**
 * Generate alert from high impact event (convenience function)
 */
export function generateVolumeAlertFromHighImpact(
  event: HighImpactEvent,
  options?: GenerateVolumeAlertOptions & { generator?: UnusualVolumeAlertGenerator }
): UnusualVolumeAlert | null {
  const generator = options?.generator ?? getSharedUnusualVolumeAlertGenerator();
  const result = generator.processHighImpactEvent(event, options);
  return result.alert;
}

/**
 * Generate alert from burst event (convenience function)
 */
export function generateVolumeAlertFromBurst(
  event: BurstEvent,
  options?: GenerateVolumeAlertOptions & { generator?: UnusualVolumeAlertGenerator }
): UnusualVolumeAlert | null {
  const generator = options?.generator ?? getSharedUnusualVolumeAlertGenerator();
  const result = generator.processBurstEvent(event, options);
  return result.alert;
}

/**
 * Get all volume alerts (convenience function)
 */
export function getUnusualVolumeAlerts(
  options?: { generator?: UnusualVolumeAlertGenerator }
): UnusualVolumeAlert[] {
  const generator = options?.generator ?? getSharedUnusualVolumeAlertGenerator();
  return generator.getAllAlerts();
}

/**
 * Get volume alert summary (convenience function)
 */
export function getUnusualVolumeAlertSummary(
  options?: { generator?: UnusualVolumeAlertGenerator }
): VolumeAlertSummary {
  const generator = options?.generator ?? getSharedUnusualVolumeAlertGenerator();
  return generator.getSummary();
}
