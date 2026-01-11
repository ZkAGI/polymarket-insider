/**
 * Fresh Wallet Alert Generator (DET-FRESH-010)
 *
 * Generate alerts when fresh wallet criteria are met.
 *
 * Features:
 * - Define alert conditions based on confidence scoring
 * - Create alerts with context (wallet info, severity, findings)
 * - Set alert severity based on confidence score
 * - Store and emit alerts
 * - Batch processing for multiple wallets
 * - Configurable thresholds and conditions
 */

import { isAddress, getAddress } from "viem";

import {
  FreshWalletConfidenceScorer,
  ConfidenceLevel,
  getSharedFreshWalletConfidenceScorer,
  type FreshWalletConfidenceResult,
  type ConfidenceScorerOptions,
} from "./fresh-wallet-confidence";

import { FreshWalletAlertSeverity } from "./fresh-wallet-config";

// ============================================================================
// Types
// ============================================================================

/**
 * Alert type for fresh wallet alerts
 */
export enum FreshWalletAlertType {
  /** Fresh wallet making first trade */
  FIRST_TRADE = "FIRST_TRADE",
  /** Fresh wallet making large trade */
  LARGE_TRADE = "LARGE_TRADE",
  /** Fresh wallet with suspicious funding pattern */
  SUSPICIOUS_FUNDING = "SUSPICIOUS_FUNDING",
  /** Fresh wallet part of coordinated cluster */
  COORDINATED_ACTIVITY = "COORDINATED_ACTIVITY",
  /** Dormant wallet reactivated */
  WALLET_REACTIVATION = "WALLET_REACTIVATION",
  /** General fresh wallet alert based on confidence */
  GENERAL = "GENERAL",
  /** Multiple risk factors combined */
  COMBINED_RISK = "COMBINED_RISK",
}

/**
 * Alert status
 */
export enum AlertStatus {
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
 * Context data for a fresh wallet alert
 */
export interface FreshWalletAlertContext {
  /** Wallet age in days (if available) */
  walletAgeDays: number | null;

  /** Number of Polymarket trades */
  polymarketTradeCount: number | null;

  /** Whether this is the first trade */
  isFirstTrade: boolean;

  /** First trade size in USD (if available) */
  firstTradeSizeUsd: number | null;

  /** Whether first trade is an outlier */
  isFirstTradeOutlier: boolean;

  /** Funding pattern type */
  fundingPatternType: string | null;

  /** Minutes between funding and first trade */
  fundingToTradeMinutes: number | null;

  /** Whether wallet is part of a cluster */
  isInCluster: boolean;

  /** Coordination score (0-100) */
  coordinationScore: number | null;

  /** Number of clusters wallet belongs to */
  clusterCount: number | null;

  /** Whether wallet was recently reactivated */
  wasReactivated: boolean;

  /** Days of dormancy before reactivation */
  dormancyDays: number | null;

  /** Confidence score (0-100) */
  confidenceScore: number;

  /** Confidence level classification */
  confidenceLevel: ConfidenceLevel;

  /** Top contributing signals */
  topSignals: string[];

  /** Key findings summary */
  summary: string[];

  /** Market ID (if applicable) */
  marketId?: string;

  /** Trade ID (if applicable) */
  tradeId?: string;
}

/**
 * Fresh wallet alert structure
 */
export interface FreshWalletAlert {
  /** Unique alert ID */
  id: string;

  /** Alert type classification */
  type: FreshWalletAlertType;

  /** Alert severity level */
  severity: FreshWalletAlertSeverity;

  /** Wallet address (checksummed) */
  walletAddress: string;

  /** Alert title */
  title: string;

  /** Detailed alert message */
  message: string;

  /** Alert context data */
  context: FreshWalletAlertContext;

  /** Alert tags for filtering */
  tags: string[];

  /** Alert status */
  status: AlertStatus;

  /** When the alert was created */
  createdAt: Date;

  /** When the alert expires (optional) */
  expiresAt: Date | null;

  /** Associated market ID (optional) */
  marketId: string | null;

  /** Underlying confidence result */
  confidenceResult: FreshWalletConfidenceResult;
}

/**
 * Alert condition definition
 */
export interface AlertCondition {
  /** Condition identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Condition description */
  description: string;

  /** Whether this condition is enabled */
  enabled: boolean;

  /** Minimum confidence score to trigger */
  minConfidenceScore?: number;

  /** Confidence levels that trigger */
  confidenceLevels?: ConfidenceLevel[];

  /** Minimum severity to trigger */
  minSeverity?: FreshWalletAlertSeverity;

  /** Custom predicate function */
  predicate?: (result: FreshWalletConfidenceResult) => boolean;

  /** Alert type to generate */
  alertType: FreshWalletAlertType;

  /** Override severity for this condition */
  overrideSeverity?: FreshWalletAlertSeverity;

  /** Tags to add to alerts from this condition */
  tags?: string[];
}

/**
 * Options for generating alerts
 */
export interface GenerateAlertOptions extends ConfidenceScorerOptions {
  /** Market ID to associate with alert */
  marketId?: string;

  /** Trade ID to associate with alert */
  tradeId?: string;

  /** Alert expiration time in milliseconds */
  expirationMs?: number;

  /** Override alert severity */
  overrideSeverity?: FreshWalletAlertSeverity;

  /** Additional tags to add */
  additionalTags?: string[];

  /** Skip conditions that don't match */
  onlyMatchingConditions?: boolean;

  /** Pre-computed confidence result (to avoid re-computation) */
  preComputedResult?: FreshWalletConfidenceResult;
}

/**
 * Batch alert generation result
 */
export interface BatchAlertResult {
  /** Generated alerts by wallet address */
  alerts: Map<string, FreshWalletAlert[]>;

  /** Wallets that didn't trigger any alerts */
  noAlerts: string[];

  /** Failed addresses with error messages */
  errors: Map<string, string>;

  /** Total wallets processed */
  totalProcessed: number;

  /** Total alerts generated */
  totalAlerts: number;

  /** Alerts by type */
  byType: Record<FreshWalletAlertType, number>;

  /** Alerts by severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Alert summary statistics
 */
export interface AlertSummary {
  /** Total alerts */
  total: number;

  /** Alerts by type */
  byType: Record<FreshWalletAlertType, number>;

  /** Alerts by severity */
  bySeverity: Record<FreshWalletAlertSeverity, number>;

  /** Alerts by status */
  byStatus: Record<AlertStatus, number>;

  /** Average confidence score of alerted wallets */
  averageConfidenceScore: number;

  /** Most common alert type */
  mostCommonType: FreshWalletAlertType | null;

  /** Highest severity alert */
  highestSeverity: FreshWalletAlertSeverity | null;
}

/**
 * Alert listener callback type
 */
export type AlertListener = (alert: FreshWalletAlert) => void | Promise<void>;

/**
 * Configuration for FreshWalletAlertGenerator
 */
export interface FreshWalletAlertGeneratorConfig {
  /** Custom confidence scorer */
  confidenceScorer?: FreshWalletConfidenceScorer;

  /** Minimum confidence score to generate any alert (default: 40) */
  minAlertThreshold?: number;

  /** Default alert expiration in milliseconds (default: 24 hours) */
  defaultExpirationMs?: number;

  /** Custom alert conditions (merged with defaults) */
  customConditions?: AlertCondition[];

  /** Whether to replace default conditions (default: false) */
  replaceDefaultConditions?: boolean;

  /** Maximum alerts to store (default: 1000) */
  maxStoredAlerts?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default minimum alert threshold */
const DEFAULT_MIN_ALERT_THRESHOLD = 40;

/** Default alert expiration: 24 hours */
const DEFAULT_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/** Default maximum stored alerts */
const DEFAULT_MAX_STORED_ALERTS = 1000;

/** Severity ordering for comparisons */
const SEVERITY_ORDER: Record<FreshWalletAlertSeverity, number> = {
  [FreshWalletAlertSeverity.LOW]: 1,
  [FreshWalletAlertSeverity.MEDIUM]: 2,
  [FreshWalletAlertSeverity.HIGH]: 3,
  [FreshWalletAlertSeverity.CRITICAL]: 4,
};

/** Default alert conditions */
export const DEFAULT_ALERT_CONDITIONS: AlertCondition[] = [
  {
    id: "first_trade_high_confidence",
    name: "First Trade with High Confidence",
    description: "First Polymarket trade from a wallet with high suspicion score",
    enabled: true,
    minConfidenceScore: 60,
    alertType: FreshWalletAlertType.FIRST_TRADE,
    predicate: (result) => {
      const zeroHistory = result.underlyingResults.zeroHistory;
      return zeroHistory?.status === "FIRST_TRADE";
    },
    tags: ["first_trade", "high_confidence"],
  },
  {
    id: "large_first_trade",
    name: "Large First Trade",
    description: "First trade from wallet is unusually large",
    enabled: true,
    minConfidenceScore: 50,
    alertType: FreshWalletAlertType.LARGE_TRADE,
    predicate: (result) => {
      const firstTrade = result.underlyingResults.firstTradeSize;
      return firstTrade?.isOutlier === true || (firstTrade?.flagReasons?.length ?? 0) > 0;
    },
    overrideSeverity: FreshWalletAlertSeverity.HIGH,
    tags: ["large_trade", "outlier"],
  },
  {
    id: "suspicious_funding",
    name: "Suspicious Funding Pattern",
    description: "Wallet has suspicious funding pattern",
    enabled: true,
    minConfidenceScore: 60,
    alertType: FreshWalletAlertType.SUSPICIOUS_FUNDING,
    predicate: (result) => {
      const funding = result.underlyingResults.fundingPattern;
      return funding?.patternType === "SUSPICIOUS";
    },
    overrideSeverity: FreshWalletAlertSeverity.HIGH,
    tags: ["suspicious_funding", "funding_pattern"],
  },
  {
    id: "flash_trading",
    name: "Flash Trading",
    description: "Trading immediately after funding (within 5 minutes)",
    enabled: true,
    minConfidenceScore: 50,
    alertType: FreshWalletAlertType.SUSPICIOUS_FUNDING,
    predicate: (result) => {
      const funding = result.underlyingResults.fundingPattern;
      return funding?.timingCategory === "FLASH";
    },
    tags: ["flash_trading", "immediate_trade"],
  },
  {
    id: "coordinated_cluster",
    name: "Coordinated Cluster Activity",
    description: "Wallet is part of a high-confidence coordinated cluster",
    enabled: true,
    minConfidenceScore: 55,
    alertType: FreshWalletAlertType.COORDINATED_ACTIVITY,
    predicate: (result) => {
      const clustering = result.underlyingResults.clustering;
      return (
        clustering !== null &&
        clustering.clusterCount > 0 &&
        clustering.coordinationScore >= 60
      );
    },
    overrideSeverity: FreshWalletAlertSeverity.HIGH,
    tags: ["coordinated", "cluster"],
  },
  {
    id: "wallet_reactivation",
    name: "Wallet Reactivation",
    description: "Dormant wallet suddenly reactivated",
    enabled: true,
    minConfidenceScore: 50,
    alertType: FreshWalletAlertType.WALLET_REACTIVATION,
    predicate: (result) => {
      const reactivation = result.underlyingResults.reactivation;
      return reactivation?.isReactivated === true;
    },
    tags: ["reactivation", "dormant_wallet"],
  },
  {
    id: "suspicious_reactivation",
    name: "Suspicious Reactivation",
    description: "Wallet reactivated with suspicious activity pattern",
    enabled: true,
    minConfidenceScore: 60,
    alertType: FreshWalletAlertType.WALLET_REACTIVATION,
    predicate: (result) => {
      const reactivation = result.underlyingResults.reactivation;
      return reactivation?.isSuspicious === true;
    },
    overrideSeverity: FreshWalletAlertSeverity.HIGH,
    tags: ["suspicious_reactivation", "dormant_wallet"],
  },
  {
    id: "very_high_confidence",
    name: "Very High Suspicion",
    description: "Wallet has very high overall suspicion score",
    enabled: true,
    confidenceLevels: [ConfidenceLevel.VERY_HIGH],
    alertType: FreshWalletAlertType.GENERAL,
    overrideSeverity: FreshWalletAlertSeverity.CRITICAL,
    tags: ["very_high_confidence", "critical"],
  },
  {
    id: "high_confidence",
    name: "High Suspicion",
    description: "Wallet has high overall suspicion score",
    enabled: true,
    confidenceLevels: [ConfidenceLevel.HIGH],
    alertType: FreshWalletAlertType.GENERAL,
    tags: ["high_confidence"],
  },
  {
    id: "combined_risk_factors",
    name: "Combined Risk Factors",
    description: "Multiple risk factors detected",
    enabled: true,
    minConfidenceScore: 65,
    alertType: FreshWalletAlertType.COMBINED_RISK,
    predicate: (result) => {
      let riskFactorCount = 0;

      // Count active risk factors
      if (result.underlyingResults.walletAge?.isFresh) riskFactorCount++;
      if (result.underlyingResults.zeroHistory?.hasZeroHistory) riskFactorCount++;
      if (result.underlyingResults.firstTradeSize?.isOutlier) riskFactorCount++;
      if (result.underlyingResults.fundingPattern?.patternType === "SUSPICIOUS") riskFactorCount++;
      if (
        result.underlyingResults.clustering?.clusterCount &&
        result.underlyingResults.clustering.clusterCount > 0
      )
        riskFactorCount++;
      if (result.underlyingResults.reactivation?.isSuspicious) riskFactorCount++;

      return riskFactorCount >= 3;
    },
    overrideSeverity: FreshWalletAlertSeverity.CRITICAL,
    tags: ["combined_risk", "multiple_factors"],
  },
];

// ============================================================================
// FreshWalletAlertGenerator Class
// ============================================================================

/**
 * Generator for fresh wallet alerts based on confidence scoring
 */
export class FreshWalletAlertGenerator {
  private readonly confidenceScorer: FreshWalletConfidenceScorer;
  private readonly minAlertThreshold: number;
  private readonly defaultExpirationMs: number;
  private readonly conditions: AlertCondition[];
  private readonly maxStoredAlerts: number;
  private readonly storedAlerts: Map<string, FreshWalletAlert>;
  private readonly listeners: Set<AlertListener>;
  private alertCounter: number;

  constructor(config?: FreshWalletAlertGeneratorConfig) {
    this.confidenceScorer =
      config?.confidenceScorer ?? getSharedFreshWalletConfidenceScorer();
    this.minAlertThreshold = config?.minAlertThreshold ?? DEFAULT_MIN_ALERT_THRESHOLD;
    this.defaultExpirationMs = config?.defaultExpirationMs ?? DEFAULT_EXPIRATION_MS;
    this.maxStoredAlerts = config?.maxStoredAlerts ?? DEFAULT_MAX_STORED_ALERTS;

    // Build conditions list
    if (config?.replaceDefaultConditions && config?.customConditions) {
      this.conditions = [...config.customConditions];
    } else {
      this.conditions = [
        ...DEFAULT_ALERT_CONDITIONS,
        ...(config?.customConditions ?? []),
      ];
    }

    this.storedAlerts = new Map();
    this.listeners = new Set();
    this.alertCounter = 0;
  }

  /**
   * Generate alerts for a wallet based on confidence analysis
   */
  async generateAlerts(
    address: string,
    options: GenerateAlertOptions = {}
  ): Promise<FreshWalletAlert[]> {
    // Validate address
    if (!address || !isAddress(address)) {
      throw new Error(`Invalid wallet address: ${address}`);
    }

    const normalizedAddress = getAddress(address);

    // Get confidence result (use pre-computed if provided)
    const confidenceResult =
      options.preComputedResult ??
      (await this.confidenceScorer.scoreWallet(normalizedAddress, options));

    // Check minimum threshold
    if (confidenceResult.confidenceScore < this.minAlertThreshold) {
      return [];
    }

    const alerts: FreshWalletAlert[] = [];
    const matchedConditionIds = new Set<string>();

    // Evaluate each condition
    for (const condition of this.conditions) {
      if (!condition.enabled) continue;

      const matches = this.evaluateCondition(condition, confidenceResult);
      if (matches && !matchedConditionIds.has(condition.id)) {
        matchedConditionIds.add(condition.id);

        const alert = this.createAlert(
          normalizedAddress,
          condition,
          confidenceResult,
          options
        );

        alerts.push(alert);
        this.storeAlert(alert);
        await this.notifyListeners(alert);
      }
    }

    return alerts;
  }

  /**
   * Generate alerts for multiple wallets
   */
  async generateAlertsForWallets(
    addresses: string[],
    options: GenerateAlertOptions = {}
  ): Promise<BatchAlertResult> {
    const startTime = Date.now();
    const alerts = new Map<string, FreshWalletAlert[]>();
    const noAlerts: string[] = [];
    const errors = new Map<string, string>();

    const byType: Record<FreshWalletAlertType, number> = {
      [FreshWalletAlertType.FIRST_TRADE]: 0,
      [FreshWalletAlertType.LARGE_TRADE]: 0,
      [FreshWalletAlertType.SUSPICIOUS_FUNDING]: 0,
      [FreshWalletAlertType.COORDINATED_ACTIVITY]: 0,
      [FreshWalletAlertType.WALLET_REACTIVATION]: 0,
      [FreshWalletAlertType.GENERAL]: 0,
      [FreshWalletAlertType.COMBINED_RISK]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    let totalAlerts = 0;

    for (const address of addresses) {
      try {
        const walletAlerts = await this.generateAlerts(address, options);
        const normalizedAddress = isAddress(address) ? getAddress(address) : address;

        if (walletAlerts.length > 0) {
          alerts.set(normalizedAddress, walletAlerts);
          totalAlerts += walletAlerts.length;

          for (const alert of walletAlerts) {
            byType[alert.type]++;
            bySeverity[alert.severity]++;
          }
        } else {
          noAlerts.push(normalizedAddress);
        }
      } catch (error) {
        const normalizedAddress = isAddress(address) ? getAddress(address) : address;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.set(normalizedAddress, errorMessage);
      }
    }

    return {
      alerts,
      noAlerts,
      errors,
      totalProcessed: addresses.length,
      totalAlerts,
      byType,
      bySeverity,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a wallet should trigger alerts
   */
  async shouldAlert(
    address: string,
    options?: ConfidenceScorerOptions
  ): Promise<boolean> {
    if (!address || !isAddress(address)) {
      return false;
    }

    const normalizedAddress = getAddress(address);
    const confidenceResult = await this.confidenceScorer.scoreWallet(
      normalizedAddress,
      options
    );

    if (confidenceResult.confidenceScore < this.minAlertThreshold) {
      return false;
    }

    // Check if any condition matches
    for (const condition of this.conditions) {
      if (!condition.enabled) continue;
      if (this.evaluateCondition(condition, confidenceResult)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get stored alerts for a wallet
   */
  getAlertsForWallet(address: string): FreshWalletAlert[] {
    if (!isAddress(address)) {
      return [];
    }

    const normalizedAddress = getAddress(address);
    const alerts: FreshWalletAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.walletAddress === normalizedAddress) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all stored alerts
   */
  getAllAlerts(): FreshWalletAlert[] {
    return Array.from(this.storedAlerts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: FreshWalletAlertType): FreshWalletAlert[] {
    const alerts: FreshWalletAlert[] = [];

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
  getAlertsBySeverity(severity: FreshWalletAlertSeverity): FreshWalletAlert[] {
    const alerts: FreshWalletAlert[] = [];

    for (const alert of this.storedAlerts.values()) {
      if (alert.severity === severity) {
        alerts.push(alert);
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get alert by ID
   */
  getAlertById(id: string): FreshWalletAlert | null {
    return this.storedAlerts.get(id) ?? null;
  }

  /**
   * Update alert status
   */
  updateAlertStatus(id: string, status: AlertStatus): boolean {
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
  getAlertSummary(): AlertSummary {
    const alerts = Array.from(this.storedAlerts.values());

    const byType: Record<FreshWalletAlertType, number> = {
      [FreshWalletAlertType.FIRST_TRADE]: 0,
      [FreshWalletAlertType.LARGE_TRADE]: 0,
      [FreshWalletAlertType.SUSPICIOUS_FUNDING]: 0,
      [FreshWalletAlertType.COORDINATED_ACTIVITY]: 0,
      [FreshWalletAlertType.WALLET_REACTIVATION]: 0,
      [FreshWalletAlertType.GENERAL]: 0,
      [FreshWalletAlertType.COMBINED_RISK]: 0,
    };

    const bySeverity: Record<FreshWalletAlertSeverity, number> = {
      [FreshWalletAlertSeverity.LOW]: 0,
      [FreshWalletAlertSeverity.MEDIUM]: 0,
      [FreshWalletAlertSeverity.HIGH]: 0,
      [FreshWalletAlertSeverity.CRITICAL]: 0,
    };

    const byStatus: Record<AlertStatus, number> = {
      [AlertStatus.NEW]: 0,
      [AlertStatus.READ]: 0,
      [AlertStatus.ACKNOWLEDGED]: 0,
      [AlertStatus.DISMISSED]: 0,
      [AlertStatus.RESOLVED]: 0,
    };

    let totalConfidenceScore = 0;
    let highestSeverityOrder = 0;
    let highestSeverity: FreshWalletAlertSeverity | null = null;

    for (const alert of alerts) {
      byType[alert.type]++;
      bySeverity[alert.severity]++;
      byStatus[alert.status]++;
      totalConfidenceScore += alert.context.confidenceScore;

      const severityOrder = SEVERITY_ORDER[alert.severity];
      if (severityOrder > highestSeverityOrder) {
        highestSeverityOrder = severityOrder;
        highestSeverity = alert.severity;
      }
    }

    // Find most common type
    let mostCommonType: FreshWalletAlertType | null = null;
    let maxTypeCount = 0;
    for (const [type, count] of Object.entries(byType)) {
      if (count > maxTypeCount) {
        maxTypeCount = count;
        mostCommonType = type as FreshWalletAlertType;
      }
    }

    return {
      total: alerts.length,
      byType,
      bySeverity,
      byStatus,
      averageConfidenceScore:
        alerts.length > 0
          ? Math.round((totalConfidenceScore / alerts.length) * 100) / 100
          : 0,
      mostCommonType,
      highestSeverity,
    };
  }

  /**
   * Add an alert listener
   */
  addListener(listener: AlertListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove an alert listener
   */
  removeListener(listener: AlertListener): void {
    this.listeners.delete(listener);
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
  getConditions(): AlertCondition[] {
    return [...this.conditions];
  }

  /**
   * Get enabled conditions
   */
  getEnabledConditions(): AlertCondition[] {
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
   * Get minimum alert threshold
   */
  getMinAlertThreshold(): number {
    return this.minAlertThreshold;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private evaluateCondition(
    condition: AlertCondition,
    result: FreshWalletConfidenceResult
  ): boolean {
    // Check minimum confidence score
    if (
      condition.minConfidenceScore !== undefined &&
      result.confidenceScore < condition.minConfidenceScore
    ) {
      return false;
    }

    // Check confidence levels
    if (
      condition.confidenceLevels &&
      condition.confidenceLevels.length > 0 &&
      !condition.confidenceLevels.includes(result.confidenceLevel)
    ) {
      return false;
    }

    // Check minimum severity
    if (condition.minSeverity !== undefined) {
      const resultSeverityOrder = SEVERITY_ORDER[result.severity];
      const minSeverityOrder = SEVERITY_ORDER[condition.minSeverity];
      if (resultSeverityOrder < minSeverityOrder) {
        return false;
      }
    }

    // Check custom predicate
    if (condition.predicate && !condition.predicate(result)) {
      return false;
    }

    return true;
  }

  private createAlert(
    address: string,
    condition: AlertCondition,
    result: FreshWalletConfidenceResult,
    options: GenerateAlertOptions
  ): FreshWalletAlert {
    const id = this.generateAlertId();
    const severity = options.overrideSeverity ?? condition.overrideSeverity ?? result.severity;
    const context = this.buildAlertContext(result, options);
    const title = this.generateAlertTitle(condition, result, context);
    const message = this.generateAlertMessage(condition, result, context);

    const tags = [
      ...(condition.tags ?? []),
      ...(options.additionalTags ?? []),
      severity.toLowerCase(),
      result.confidenceLevel.toLowerCase(),
    ];

    const expirationMs = options.expirationMs ?? this.defaultExpirationMs;
    const expiresAt = new Date(Date.now() + expirationMs);

    return {
      id,
      type: condition.alertType,
      severity,
      walletAddress: address,
      title,
      message,
      context,
      tags,
      status: AlertStatus.NEW,
      createdAt: new Date(),
      expiresAt,
      marketId: options.marketId ?? null,
      confidenceResult: result,
    };
  }

  private buildAlertContext(
    result: FreshWalletConfidenceResult,
    options: GenerateAlertOptions
  ): FreshWalletAlertContext {
    const { underlyingResults } = result;

    // Calculate funding to trade minutes from seconds
    const fundingToTradeMinutes = underlyingResults.fundingPattern?.fundingToTradeIntervalSeconds !== null
      ? Math.round((underlyingResults.fundingPattern?.fundingToTradeIntervalSeconds ?? 0) / 60)
      : null;

    return {
      walletAgeDays: underlyingResults.walletAge?.ageInDays ?? null,
      polymarketTradeCount: underlyingResults.zeroHistory?.polymarketTradeCount ?? null,
      isFirstTrade: underlyingResults.zeroHistory?.status === "FIRST_TRADE",
      firstTradeSizeUsd: underlyingResults.firstTradeSize?.firstTrade?.sizeUsd ?? null,
      isFirstTradeOutlier: underlyingResults.firstTradeSize?.isOutlier ?? false,
      fundingPatternType: underlyingResults.fundingPattern?.patternType ?? null,
      fundingToTradeMinutes,
      isInCluster:
        (underlyingResults.clustering?.clusterCount ?? 0) > 0,
      coordinationScore: underlyingResults.clustering?.coordinationScore ?? null,
      clusterCount: underlyingResults.clustering?.clusterCount ?? null,
      wasReactivated: underlyingResults.reactivation?.isReactivated ?? false,
      dormancyDays:
        underlyingResults.reactivation?.reactivationEvent?.dormancyDays ?? null,
      confidenceScore: result.confidenceScore,
      confidenceLevel: result.confidenceLevel,
      topSignals: result.topSignals.map((s) => s.name),
      summary: result.summary,
      marketId: options.marketId,
      tradeId: options.tradeId,
    };
  }

  private generateAlertTitle(
    condition: AlertCondition,
    result: FreshWalletConfidenceResult,
    context: FreshWalletAlertContext
  ): string {
    const severityPrefix = this.getSeverityPrefix(result.severity);

    switch (condition.alertType) {
      case FreshWalletAlertType.FIRST_TRADE:
        return `${severityPrefix}Fresh Wallet First Trade Detected`;
      case FreshWalletAlertType.LARGE_TRADE:
        return `${severityPrefix}Large First Trade from Fresh Wallet`;
      case FreshWalletAlertType.SUSPICIOUS_FUNDING:
        return `${severityPrefix}Suspicious Funding Pattern Detected`;
      case FreshWalletAlertType.COORDINATED_ACTIVITY:
        return `${severityPrefix}Coordinated Wallet Activity Detected`;
      case FreshWalletAlertType.WALLET_REACTIVATION:
        return `${severityPrefix}Dormant Wallet Reactivated`;
      case FreshWalletAlertType.COMBINED_RISK:
        return `${severityPrefix}Multiple Risk Factors Detected`;
      case FreshWalletAlertType.GENERAL:
      default:
        return `${severityPrefix}Fresh Wallet Alert (Score: ${context.confidenceScore})`;
    }
  }

  private generateAlertMessage(
    condition: AlertCondition,
    result: FreshWalletConfidenceResult,
    context: FreshWalletAlertContext
  ): string {
    const parts: string[] = [];

    parts.push(`Wallet ${result.address} has triggered a fresh wallet alert.`);
    parts.push(`Confidence Score: ${context.confidenceScore}/100 (${context.confidenceLevel})`);

    // Add specific details based on alert type
    switch (condition.alertType) {
      case FreshWalletAlertType.FIRST_TRADE:
        if (context.walletAgeDays !== null) {
          parts.push(`Wallet age: ${context.walletAgeDays} days`);
        }
        parts.push("This is the wallet's first Polymarket trade.");
        break;

      case FreshWalletAlertType.LARGE_TRADE:
        if (context.firstTradeSizeUsd !== null) {
          parts.push(`First trade size: $${context.firstTradeSizeUsd.toFixed(2)}`);
        }
        parts.push("First trade size is flagged as an outlier.");
        break;

      case FreshWalletAlertType.SUSPICIOUS_FUNDING:
        if (context.fundingPatternType) {
          parts.push(`Funding pattern: ${context.fundingPatternType}`);
        }
        if (context.fundingToTradeMinutes !== null) {
          parts.push(`Time from funding to trade: ${context.fundingToTradeMinutes} minutes`);
        }
        break;

      case FreshWalletAlertType.COORDINATED_ACTIVITY:
        if (context.clusterCount !== null) {
          parts.push(`Part of ${context.clusterCount} coordinated cluster(s)`);
        }
        if (context.coordinationScore !== null) {
          parts.push(`Coordination score: ${context.coordinationScore}`);
        }
        break;

      case FreshWalletAlertType.WALLET_REACTIVATION:
        if (context.dormancyDays !== null) {
          parts.push(`Dormant for ${context.dormancyDays} days before reactivation`);
        }
        break;

      case FreshWalletAlertType.COMBINED_RISK:
        parts.push("Multiple risk factors detected:");
        for (const summary of context.summary.slice(0, 5)) {
          parts.push(`  - ${summary}`);
        }
        break;
    }

    // Add top signals
    if (context.topSignals.length > 0) {
      parts.push(`Top signals: ${context.topSignals.slice(0, 3).join(", ")}`);
    }

    return parts.join("\n");
  }

  private getSeverityPrefix(severity: FreshWalletAlertSeverity): string {
    switch (severity) {
      case FreshWalletAlertSeverity.CRITICAL:
        return "[CRITICAL] ";
      case FreshWalletAlertSeverity.HIGH:
        return "[HIGH] ";
      case FreshWalletAlertSeverity.MEDIUM:
        return "[MEDIUM] ";
      case FreshWalletAlertSeverity.LOW:
      default:
        return "";
    }
  }

  private generateAlertId(): string {
    this.alertCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.alertCounter.toString(36).padStart(4, "0");
    const random = Math.random().toString(36).substring(2, 8);
    return `fwa_${timestamp}_${counter}_${random}`;
  }

  private storeAlert(alert: FreshWalletAlert): void {
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

  private async notifyListeners(alert: FreshWalletAlert): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(alert);
      } catch {
        // Silently ignore listener errors to not disrupt alert generation
      }
    }
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedGenerator: FreshWalletAlertGenerator | null = null;

/**
 * Create a new FreshWalletAlertGenerator instance
 */
export function createFreshWalletAlertGenerator(
  config?: FreshWalletAlertGeneratorConfig
): FreshWalletAlertGenerator {
  return new FreshWalletAlertGenerator(config);
}

/**
 * Get the shared FreshWalletAlertGenerator instance
 */
export function getSharedFreshWalletAlertGenerator(): FreshWalletAlertGenerator {
  if (!sharedGenerator) {
    sharedGenerator = new FreshWalletAlertGenerator();
  }
  return sharedGenerator;
}

/**
 * Set the shared FreshWalletAlertGenerator instance
 */
export function setSharedFreshWalletAlertGenerator(
  generator: FreshWalletAlertGenerator
): void {
  sharedGenerator = generator;
}

/**
 * Reset the shared FreshWalletAlertGenerator instance
 */
export function resetSharedFreshWalletAlertGenerator(): void {
  sharedGenerator = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate alerts for a wallet (convenience function)
 */
export async function generateFreshWalletAlerts(
  address: string,
  options?: GenerateAlertOptions & { generator?: FreshWalletAlertGenerator }
): Promise<FreshWalletAlert[]> {
  const generator = options?.generator ?? getSharedFreshWalletAlertGenerator();
  return generator.generateAlerts(address, options);
}

/**
 * Generate alerts for multiple wallets (convenience function)
 */
export async function batchGenerateFreshWalletAlerts(
  addresses: string[],
  options?: GenerateAlertOptions & { generator?: FreshWalletAlertGenerator }
): Promise<BatchAlertResult> {
  const generator = options?.generator ?? getSharedFreshWalletAlertGenerator();
  return generator.generateAlertsForWallets(addresses, options);
}

/**
 * Check if a wallet should trigger alerts (convenience function)
 */
export async function shouldTriggerFreshWalletAlert(
  address: string,
  options?: ConfidenceScorerOptions & { generator?: FreshWalletAlertGenerator }
): Promise<boolean> {
  const generator = options?.generator ?? getSharedFreshWalletAlertGenerator();
  return generator.shouldAlert(address, options);
}

/**
 * Get stored alerts for a wallet (convenience function)
 */
export function getFreshWalletAlerts(
  address: string,
  generator?: FreshWalletAlertGenerator
): FreshWalletAlert[] {
  const gen = generator ?? getSharedFreshWalletAlertGenerator();
  return gen.getAlertsForWallet(address);
}

/**
 * Get alert summary (convenience function)
 */
export function getFreshWalletAlertSummary(
  generator?: FreshWalletAlertGenerator
): AlertSummary {
  const gen = generator ?? getSharedFreshWalletAlertGenerator();
  return gen.getAlertSummary();
}
