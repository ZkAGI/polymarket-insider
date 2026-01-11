/**
 * Fresh Wallet Threshold Configuration (DET-FRESH-002)
 *
 * Configurable thresholds for what constitutes a "fresh wallet" in detection.
 *
 * Features:
 * - Age-based thresholds (days since first transaction)
 * - Transaction count thresholds (minimum transactions for established wallet)
 * - Per-market-category thresholds (different rules for politics, sports, etc.)
 * - Environment variable configuration support
 * - Validation and merging of configurations
 */

import { MarketCategory } from "../api/gamma/types";
import { AgeCategory, DEFAULT_AGE_THRESHOLDS, type AgeCategoryThresholds } from "./wallet-age";

// ============================================================================
// Types
// ============================================================================

/**
 * Threshold configuration for determining fresh wallets
 */
export interface FreshWalletThreshold {
  /** Maximum wallet age in days to be considered "fresh" (default: 30) */
  maxAgeDays: number;

  /** Minimum number of transactions for wallet to NOT be fresh (default: 5) */
  minTransactionCount: number;

  /** Minimum number of Polymarket trades for wallet to NOT be fresh (default: 3) */
  minPolymarketTrades: number;

  /** Whether to consider wallets with zero trading history as fresh (default: true) */
  treatNoHistoryAsFresh: boolean;
}

/**
 * Alert severity levels for fresh wallet detection
 */
export enum FreshWalletAlertSeverity {
  /** Informational - wallet is somewhat new */
  LOW = "LOW",
  /** Warning - wallet shows fresh characteristics */
  MEDIUM = "MEDIUM",
  /** Critical - very fresh wallet with suspicious patterns */
  HIGH = "HIGH",
  /** Urgent - brand new wallet with large trades */
  CRITICAL = "CRITICAL",
}

/**
 * Threshold configuration for different alert severity levels
 */
export interface SeverityThresholds {
  /** Thresholds for LOW severity (oldest/most established) */
  low: FreshWalletThreshold;
  /** Thresholds for MEDIUM severity */
  medium: FreshWalletThreshold;
  /** Thresholds for HIGH severity */
  high: FreshWalletThreshold;
  /** Thresholds for CRITICAL severity (newest/freshest) */
  critical: FreshWalletThreshold;
}

/**
 * Per-category threshold overrides
 */
export interface CategoryThresholds {
  /** Thresholds for political markets (often higher scrutiny) */
  [MarketCategory.POLITICS]?: Partial<FreshWalletThreshold>;
  /** Thresholds for crypto markets */
  [MarketCategory.CRYPTO]?: Partial<FreshWalletThreshold>;
  /** Thresholds for sports markets */
  [MarketCategory.SPORTS]?: Partial<FreshWalletThreshold>;
  /** Thresholds for tech markets */
  [MarketCategory.TECH]?: Partial<FreshWalletThreshold>;
  /** Thresholds for business markets */
  [MarketCategory.BUSINESS]?: Partial<FreshWalletThreshold>;
  /** Thresholds for science markets */
  [MarketCategory.SCIENCE]?: Partial<FreshWalletThreshold>;
  /** Thresholds for entertainment markets */
  [MarketCategory.ENTERTAINMENT]?: Partial<FreshWalletThreshold>;
  /** Thresholds for weather markets */
  [MarketCategory.WEATHER]?: Partial<FreshWalletThreshold>;
  /** Thresholds for geopolitics markets */
  [MarketCategory.GEOPOLITICS]?: Partial<FreshWalletThreshold>;
  /** Thresholds for legal markets */
  [MarketCategory.LEGAL]?: Partial<FreshWalletThreshold>;
  /** Thresholds for health markets */
  [MarketCategory.HEALTH]?: Partial<FreshWalletThreshold>;
  /** Thresholds for economy markets */
  [MarketCategory.ECONOMY]?: Partial<FreshWalletThreshold>;
  /** Thresholds for culture markets */
  [MarketCategory.CULTURE]?: Partial<FreshWalletThreshold>;
  /** Thresholds for other markets */
  [MarketCategory.OTHER]?: Partial<FreshWalletThreshold>;
}

/**
 * Complete fresh wallet configuration
 */
export interface FreshWalletConfig {
  /** Whether fresh wallet detection is enabled */
  enabled: boolean;

  /** Default thresholds applied when no category-specific override exists */
  defaultThresholds: FreshWalletThreshold;

  /** Severity-based thresholds for alert classification */
  severityThresholds: SeverityThresholds;

  /** Per-category threshold overrides */
  categoryThresholds: CategoryThresholds;

  /** Age category thresholds for classification */
  ageCategoryThresholds: AgeCategoryThresholds;

  /** Trade size thresholds for additional scrutiny (in USD) */
  tradeSizeThresholds: {
    /** Minimum trade size to trigger fresh wallet check (default: 100) */
    minTradeSize: number;
    /** Large trade threshold for elevated scrutiny (default: 1000) */
    largeTradeSize: number;
    /** Whale trade threshold for maximum scrutiny (default: 10000) */
    whaleTradeSize: number;
  };

  /** Time-based modifiers */
  timeModifiers: {
    /** Whether to increase scrutiny near market close (default: true) */
    increaseNearClose: boolean;
    /** Hours before market close to increase scrutiny (default: 24) */
    closeWindowHours: number;
    /** Multiplier for thresholds near close (default: 0.5, meaning stricter) */
    closeMultiplier: number;
  };
}

/**
 * Input for creating or updating configuration
 */
export type FreshWalletConfigInput = Partial<{
  enabled: boolean;
  defaultThresholds: Partial<FreshWalletThreshold>;
  severityThresholds: Partial<{
    low: Partial<FreshWalletThreshold>;
    medium: Partial<FreshWalletThreshold>;
    high: Partial<FreshWalletThreshold>;
    critical: Partial<FreshWalletThreshold>;
  }>;
  categoryThresholds: CategoryThresholds;
  ageCategoryThresholds: Partial<AgeCategoryThresholds>;
  tradeSizeThresholds: Partial<FreshWalletConfig["tradeSizeThresholds"]>;
  timeModifiers: Partial<FreshWalletConfig["timeModifiers"]>;
}>;

/**
 * Result of threshold evaluation
 */
export interface ThresholdEvaluationResult {
  /** Whether the wallet is considered fresh */
  isFresh: boolean;

  /** Alert severity level */
  severity: FreshWalletAlertSeverity;

  /** Age category of the wallet */
  ageCategory: AgeCategory;

  /** Which threshold criteria triggered the fresh classification */
  triggeredBy: {
    age: boolean;
    transactionCount: boolean;
    polymarketTrades: boolean;
    noHistory: boolean;
  };

  /** The thresholds that were used for evaluation */
  appliedThresholds: FreshWalletThreshold;

  /** Details about the evaluation */
  details: {
    walletAgeDays: number | null;
    transactionCount: number;
    polymarketTradeCount: number;
    marketCategory: MarketCategory | null;
  };
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default fresh wallet threshold
 */
export const DEFAULT_FRESH_WALLET_THRESHOLD: FreshWalletThreshold = {
  maxAgeDays: 30,
  minTransactionCount: 5,
  minPolymarketTrades: 3,
  treatNoHistoryAsFresh: true,
};

/**
 * Default severity thresholds
 */
export const DEFAULT_SEVERITY_THRESHOLDS: SeverityThresholds = {
  low: {
    maxAgeDays: 90,
    minTransactionCount: 10,
    minPolymarketTrades: 5,
    treatNoHistoryAsFresh: true,
  },
  medium: {
    maxAgeDays: 30,
    minTransactionCount: 5,
    minPolymarketTrades: 3,
    treatNoHistoryAsFresh: true,
  },
  high: {
    maxAgeDays: 7,
    minTransactionCount: 3,
    minPolymarketTrades: 1,
    treatNoHistoryAsFresh: true,
  },
  critical: {
    maxAgeDays: 1,
    minTransactionCount: 1,
    minPolymarketTrades: 0,
    treatNoHistoryAsFresh: true,
  },
};

/**
 * Default category-specific overrides
 * Politics and geopolitics get stricter thresholds due to higher manipulation risk
 */
export const DEFAULT_CATEGORY_THRESHOLDS: CategoryThresholds = {
  [MarketCategory.POLITICS]: {
    maxAgeDays: 60, // Stricter for politics
    minTransactionCount: 10,
    minPolymarketTrades: 5,
  },
  [MarketCategory.GEOPOLITICS]: {
    maxAgeDays: 60,
    minTransactionCount: 10,
    minPolymarketTrades: 5,
  },
  [MarketCategory.CRYPTO]: {
    maxAgeDays: 14, // Crypto users often have fresh wallets legitimately
    minTransactionCount: 3,
    minPolymarketTrades: 2,
  },
  [MarketCategory.SPORTS]: {
    maxAgeDays: 30,
    minTransactionCount: 5,
    minPolymarketTrades: 3,
  },
};

/**
 * Default trade size thresholds
 */
export const DEFAULT_TRADE_SIZE_THRESHOLDS: FreshWalletConfig["tradeSizeThresholds"] = {
  minTradeSize: 100,
  largeTradeSize: 1000,
  whaleTradeSize: 10000,
};

/**
 * Default time modifiers
 */
export const DEFAULT_TIME_MODIFIERS: FreshWalletConfig["timeModifiers"] = {
  increaseNearClose: true,
  closeWindowHours: 24,
  closeMultiplier: 0.5,
};

/**
 * Complete default configuration
 */
export const DEFAULT_FRESH_WALLET_CONFIG: FreshWalletConfig = {
  enabled: true,
  defaultThresholds: DEFAULT_FRESH_WALLET_THRESHOLD,
  severityThresholds: DEFAULT_SEVERITY_THRESHOLDS,
  categoryThresholds: DEFAULT_CATEGORY_THRESHOLDS,
  ageCategoryThresholds: DEFAULT_AGE_THRESHOLDS,
  tradeSizeThresholds: DEFAULT_TRADE_SIZE_THRESHOLDS,
  timeModifiers: DEFAULT_TIME_MODIFIERS,
};

// ============================================================================
// Environment Variable Configuration
// ============================================================================

/**
 * Environment variable names for fresh wallet configuration
 */
export const ENV_VARS = {
  ENABLED: "FRESH_WALLET_DETECTION_ENABLED",
  MAX_AGE_DAYS: "FRESH_WALLET_MAX_AGE_DAYS",
  MIN_TX_COUNT: "FRESH_WALLET_MIN_TX_COUNT",
  MIN_PM_TRADES: "FRESH_WALLET_MIN_PM_TRADES",
  TREAT_NO_HISTORY_AS_FRESH: "FRESH_WALLET_TREAT_NO_HISTORY_AS_FRESH",
  MIN_TRADE_SIZE: "FRESH_WALLET_MIN_TRADE_SIZE",
  LARGE_TRADE_SIZE: "FRESH_WALLET_LARGE_TRADE_SIZE",
  WHALE_TRADE_SIZE: "FRESH_WALLET_WHALE_TRADE_SIZE",
  INCREASE_NEAR_CLOSE: "FRESH_WALLET_INCREASE_NEAR_CLOSE",
  CLOSE_WINDOW_HOURS: "FRESH_WALLET_CLOSE_WINDOW_HOURS",
  CLOSE_MULTIPLIER: "FRESH_WALLET_CLOSE_MULTIPLIER",
} as const;

/**
 * Load configuration from environment variables
 * Environment variables override defaults but can be further overridden by explicit config
 */
export function loadConfigFromEnv(): FreshWalletConfigInput {
  const config: FreshWalletConfigInput = {};

  // Enabled flag
  const enabledStr = process.env[ENV_VARS.ENABLED];
  if (enabledStr !== undefined) {
    config.enabled = enabledStr.toLowerCase() === "true" || enabledStr === "1";
  }

  // Default thresholds
  const defaultThresholds: Partial<FreshWalletThreshold> = {};

  const maxAgeDays = parseEnvNumber(ENV_VARS.MAX_AGE_DAYS);
  if (maxAgeDays !== undefined) {
    defaultThresholds.maxAgeDays = maxAgeDays;
  }

  const minTxCount = parseEnvNumber(ENV_VARS.MIN_TX_COUNT);
  if (minTxCount !== undefined) {
    defaultThresholds.minTransactionCount = minTxCount;
  }

  const minPmTrades = parseEnvNumber(ENV_VARS.MIN_PM_TRADES);
  if (minPmTrades !== undefined) {
    defaultThresholds.minPolymarketTrades = minPmTrades;
  }

  const treatNoHistoryStr = process.env[ENV_VARS.TREAT_NO_HISTORY_AS_FRESH];
  if (treatNoHistoryStr !== undefined) {
    defaultThresholds.treatNoHistoryAsFresh =
      treatNoHistoryStr.toLowerCase() === "true" || treatNoHistoryStr === "1";
  }

  if (Object.keys(defaultThresholds).length > 0) {
    config.defaultThresholds = defaultThresholds;
  }

  // Trade size thresholds
  const tradeSizeThresholds: Partial<FreshWalletConfig["tradeSizeThresholds"]> = {};

  const minTradeSize = parseEnvNumber(ENV_VARS.MIN_TRADE_SIZE);
  if (minTradeSize !== undefined) {
    tradeSizeThresholds.minTradeSize = minTradeSize;
  }

  const largeTradeSize = parseEnvNumber(ENV_VARS.LARGE_TRADE_SIZE);
  if (largeTradeSize !== undefined) {
    tradeSizeThresholds.largeTradeSize = largeTradeSize;
  }

  const whaleTradeSize = parseEnvNumber(ENV_VARS.WHALE_TRADE_SIZE);
  if (whaleTradeSize !== undefined) {
    tradeSizeThresholds.whaleTradeSize = whaleTradeSize;
  }

  if (Object.keys(tradeSizeThresholds).length > 0) {
    config.tradeSizeThresholds = tradeSizeThresholds;
  }

  // Time modifiers
  const timeModifiers: Partial<FreshWalletConfig["timeModifiers"]> = {};

  const increaseNearCloseStr = process.env[ENV_VARS.INCREASE_NEAR_CLOSE];
  if (increaseNearCloseStr !== undefined) {
    timeModifiers.increaseNearClose =
      increaseNearCloseStr.toLowerCase() === "true" || increaseNearCloseStr === "1";
  }

  const closeWindowHours = parseEnvNumber(ENV_VARS.CLOSE_WINDOW_HOURS);
  if (closeWindowHours !== undefined) {
    timeModifiers.closeWindowHours = closeWindowHours;
  }

  const closeMultiplier = parseEnvNumber(ENV_VARS.CLOSE_MULTIPLIER, true);
  if (closeMultiplier !== undefined) {
    timeModifiers.closeMultiplier = closeMultiplier;
  }

  if (Object.keys(timeModifiers).length > 0) {
    config.timeModifiers = timeModifiers;
  }

  return config;
}

// ============================================================================
// FreshWalletConfigManager Class
// ============================================================================

/**
 * Manager for fresh wallet threshold configuration
 */
export class FreshWalletConfigManager {
  private config: FreshWalletConfig;

  constructor(initialConfig?: FreshWalletConfigInput) {
    // Start with defaults
    this.config = { ...DEFAULT_FRESH_WALLET_CONFIG };

    // Apply environment variable overrides
    const envConfig = loadConfigFromEnv();
    this.mergeConfig(envConfig);

    // Apply explicit configuration overrides
    if (initialConfig) {
      this.mergeConfig(initialConfig);
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): FreshWalletConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with partial updates
   */
  updateConfig(updates: FreshWalletConfigInput): void {
    this.mergeConfig(updates);
  }

  /**
   * Get thresholds for a specific market category
   * Merges default thresholds with category-specific overrides
   */
  getThresholdsForCategory(category: MarketCategory | null): FreshWalletThreshold {
    const base = { ...this.config.defaultThresholds };

    if (category && this.config.categoryThresholds[category]) {
      return {
        ...base,
        ...this.config.categoryThresholds[category],
      };
    }

    return base;
  }

  /**
   * Get thresholds adjusted for time-based modifiers
   */
  getAdjustedThresholds(
    category: MarketCategory | null,
    hoursUntilClose: number | null
  ): FreshWalletThreshold {
    const thresholds = this.getThresholdsForCategory(category);

    // Apply near-close multiplier if applicable
    if (
      this.config.timeModifiers.increaseNearClose &&
      hoursUntilClose !== null &&
      hoursUntilClose <= this.config.timeModifiers.closeWindowHours
    ) {
      return {
        ...thresholds,
        maxAgeDays: Math.floor(thresholds.maxAgeDays * this.config.timeModifiers.closeMultiplier),
        minTransactionCount: Math.ceil(
          thresholds.minTransactionCount / this.config.timeModifiers.closeMultiplier
        ),
        minPolymarketTrades: Math.ceil(
          thresholds.minPolymarketTrades / this.config.timeModifiers.closeMultiplier
        ),
      };
    }

    return thresholds;
  }

  /**
   * Evaluate wallet freshness against thresholds
   */
  evaluateWallet(params: {
    walletAgeDays: number | null;
    transactionCount: number;
    polymarketTradeCount: number;
    category: MarketCategory | null;
    hoursUntilClose?: number | null;
  }): ThresholdEvaluationResult {
    const {
      walletAgeDays,
      transactionCount,
      polymarketTradeCount,
      category,
      hoursUntilClose = null,
    } = params;

    const thresholds = this.getAdjustedThresholds(category, hoursUntilClose);

    // Evaluate each criterion
    const noHistory =
      walletAgeDays === null && thresholds.treatNoHistoryAsFresh;
    const ageTrigger =
      walletAgeDays !== null && walletAgeDays <= thresholds.maxAgeDays;
    const txCountTrigger = transactionCount < thresholds.minTransactionCount;
    const pmTradesTrigger = polymarketTradeCount < thresholds.minPolymarketTrades;

    const isFresh = noHistory || ageTrigger || txCountTrigger || pmTradesTrigger;

    // Determine severity
    const severity = this.determineSeverity(walletAgeDays, transactionCount, polymarketTradeCount);

    // Determine age category
    const ageCategory = this.classifyAge(walletAgeDays);

    return {
      isFresh,
      severity,
      ageCategory,
      triggeredBy: {
        age: ageTrigger,
        transactionCount: txCountTrigger,
        polymarketTrades: pmTradesTrigger,
        noHistory,
      },
      appliedThresholds: thresholds,
      details: {
        walletAgeDays,
        transactionCount,
        polymarketTradeCount,
        marketCategory: category,
      },
    };
  }

  /**
   * Check if detection is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable detection
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Get trade size thresholds
   */
  getTradeSizeThresholds(): FreshWalletConfig["tradeSizeThresholds"] {
    return { ...this.config.tradeSizeThresholds };
  }

  /**
   * Get time modifiers
   */
  getTimeModifiers(): FreshWalletConfig["timeModifiers"] {
    return { ...this.config.timeModifiers };
  }

  /**
   * Get severity thresholds
   */
  getSeverityThresholds(): SeverityThresholds {
    return {
      low: { ...this.config.severityThresholds.low },
      medium: { ...this.config.severityThresholds.medium },
      high: { ...this.config.severityThresholds.high },
      critical: { ...this.config.severityThresholds.critical },
    };
  }

  /**
   * Get age category thresholds
   */
  getAgeCategoryThresholds(): AgeCategoryThresholds {
    return { ...this.config.ageCategoryThresholds };
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_FRESH_WALLET_CONFIG };
  }

  /**
   * Export configuration as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  fromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json) as FreshWalletConfigInput;
      this.reset();
      this.mergeConfig(parsed);
    } catch (error) {
      throw new Error(`Invalid configuration JSON: ${error}`);
    }
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate default thresholds
    if (this.config.defaultThresholds.maxAgeDays < 0) {
      errors.push("maxAgeDays must be non-negative");
    }
    if (this.config.defaultThresholds.minTransactionCount < 0) {
      errors.push("minTransactionCount must be non-negative");
    }
    if (this.config.defaultThresholds.minPolymarketTrades < 0) {
      errors.push("minPolymarketTrades must be non-negative");
    }

    // Validate trade size thresholds
    if (this.config.tradeSizeThresholds.minTradeSize < 0) {
      errors.push("minTradeSize must be non-negative");
    }
    if (
      this.config.tradeSizeThresholds.largeTradeSize <=
      this.config.tradeSizeThresholds.minTradeSize
    ) {
      errors.push("largeTradeSize must be greater than minTradeSize");
    }
    if (
      this.config.tradeSizeThresholds.whaleTradeSize <=
      this.config.tradeSizeThresholds.largeTradeSize
    ) {
      errors.push("whaleTradeSize must be greater than largeTradeSize");
    }

    // Validate time modifiers
    if (this.config.timeModifiers.closeWindowHours < 0) {
      errors.push("closeWindowHours must be non-negative");
    }
    if (
      this.config.timeModifiers.closeMultiplier <= 0 ||
      this.config.timeModifiers.closeMultiplier > 1
    ) {
      errors.push("closeMultiplier must be between 0 and 1");
    }

    // Validate severity thresholds are in order
    if (
      this.config.severityThresholds.critical.maxAgeDays >=
      this.config.severityThresholds.high.maxAgeDays
    ) {
      errors.push("critical maxAgeDays should be less than high maxAgeDays");
    }
    if (
      this.config.severityThresholds.high.maxAgeDays >=
      this.config.severityThresholds.medium.maxAgeDays
    ) {
      errors.push("high maxAgeDays should be less than medium maxAgeDays");
    }
    if (
      this.config.severityThresholds.medium.maxAgeDays >=
      this.config.severityThresholds.low.maxAgeDays
    ) {
      errors.push("medium maxAgeDays should be less than low maxAgeDays");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Merge partial configuration into current config
   */
  private mergeConfig(updates: FreshWalletConfigInput): void {
    if (updates.enabled !== undefined) {
      this.config.enabled = updates.enabled;
    }

    if (updates.defaultThresholds) {
      this.config.defaultThresholds = {
        ...this.config.defaultThresholds,
        ...updates.defaultThresholds,
      };
    }

    if (updates.severityThresholds) {
      if (updates.severityThresholds.low) {
        this.config.severityThresholds.low = {
          ...this.config.severityThresholds.low,
          ...updates.severityThresholds.low,
        };
      }
      if (updates.severityThresholds.medium) {
        this.config.severityThresholds.medium = {
          ...this.config.severityThresholds.medium,
          ...updates.severityThresholds.medium,
        };
      }
      if (updates.severityThresholds.high) {
        this.config.severityThresholds.high = {
          ...this.config.severityThresholds.high,
          ...updates.severityThresholds.high,
        };
      }
      if (updates.severityThresholds.critical) {
        this.config.severityThresholds.critical = {
          ...this.config.severityThresholds.critical,
          ...updates.severityThresholds.critical,
        };
      }
    }

    if (updates.categoryThresholds) {
      this.config.categoryThresholds = {
        ...this.config.categoryThresholds,
        ...updates.categoryThresholds,
      };
    }

    if (updates.ageCategoryThresholds) {
      this.config.ageCategoryThresholds = {
        ...this.config.ageCategoryThresholds,
        ...updates.ageCategoryThresholds,
      };
    }

    if (updates.tradeSizeThresholds) {
      this.config.tradeSizeThresholds = {
        ...this.config.tradeSizeThresholds,
        ...updates.tradeSizeThresholds,
      };
    }

    if (updates.timeModifiers) {
      this.config.timeModifiers = {
        ...this.config.timeModifiers,
        ...updates.timeModifiers,
      };
    }
  }

  /**
   * Determine alert severity based on wallet characteristics
   */
  private determineSeverity(
    walletAgeDays: number | null,
    transactionCount: number,
    polymarketTradeCount: number
  ): FreshWalletAlertSeverity {
    const { critical, high, medium } = this.config.severityThresholds;

    // New wallet (no history) is always critical
    if (walletAgeDays === null) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    // Check critical thresholds
    if (
      walletAgeDays <= critical.maxAgeDays &&
      transactionCount < critical.minTransactionCount &&
      polymarketTradeCount <= critical.minPolymarketTrades
    ) {
      return FreshWalletAlertSeverity.CRITICAL;
    }

    // Check high thresholds
    if (
      walletAgeDays <= high.maxAgeDays &&
      transactionCount < high.minTransactionCount
    ) {
      return FreshWalletAlertSeverity.HIGH;
    }

    // Check medium thresholds
    if (
      walletAgeDays <= medium.maxAgeDays &&
      transactionCount < medium.minTransactionCount
    ) {
      return FreshWalletAlertSeverity.MEDIUM;
    }

    // Default to low
    return FreshWalletAlertSeverity.LOW;
  }

  /**
   * Classify wallet age into category
   */
  private classifyAge(ageInDays: number | null): AgeCategory {
    if (ageInDays === null) {
      return AgeCategory.NEW;
    }

    const thresholds = this.config.ageCategoryThresholds;

    if (ageInDays <= thresholds.veryFresh) {
      return AgeCategory.VERY_FRESH;
    }
    if (ageInDays <= thresholds.fresh) {
      return AgeCategory.FRESH;
    }
    if (ageInDays <= thresholds.recent) {
      return AgeCategory.RECENT;
    }
    if (ageInDays <= thresholds.established) {
      return AgeCategory.ESTABLISHED;
    }
    return AgeCategory.MATURE;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedConfigManager: FreshWalletConfigManager | null = null;

/**
 * Create a new FreshWalletConfigManager instance
 */
export function createFreshWalletConfigManager(
  config?: FreshWalletConfigInput
): FreshWalletConfigManager {
  return new FreshWalletConfigManager(config);
}

/**
 * Get the shared FreshWalletConfigManager instance
 */
export function getSharedFreshWalletConfigManager(): FreshWalletConfigManager {
  if (!sharedConfigManager) {
    sharedConfigManager = new FreshWalletConfigManager();
  }
  return sharedConfigManager;
}

/**
 * Set the shared FreshWalletConfigManager instance
 */
export function setSharedFreshWalletConfigManager(manager: FreshWalletConfigManager): void {
  sharedConfigManager = manager;
}

/**
 * Reset the shared FreshWalletConfigManager instance
 */
export function resetSharedFreshWalletConfigManager(): void {
  sharedConfigManager = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get thresholds for a specific category (convenience function)
 */
export function getThresholdsForCategory(
  category: MarketCategory | null,
  manager?: FreshWalletConfigManager
): FreshWalletThreshold {
  const mgr = manager ?? getSharedFreshWalletConfigManager();
  return mgr.getThresholdsForCategory(category);
}

/**
 * Evaluate wallet freshness (convenience function)
 */
export function evaluateWalletFreshness(
  params: {
    walletAgeDays: number | null;
    transactionCount: number;
    polymarketTradeCount: number;
    category: MarketCategory | null;
    hoursUntilClose?: number | null;
  },
  manager?: FreshWalletConfigManager
): ThresholdEvaluationResult {
  const mgr = manager ?? getSharedFreshWalletConfigManager();
  return mgr.evaluateWallet(params);
}

/**
 * Check if fresh wallet detection is enabled (convenience function)
 */
export function isFreshWalletDetectionEnabled(
  manager?: FreshWalletConfigManager
): boolean {
  const mgr = manager ?? getSharedFreshWalletConfigManager();
  return mgr.isEnabled();
}

/**
 * Get current configuration (convenience function)
 */
export function getFreshWalletConfig(
  manager?: FreshWalletConfigManager
): FreshWalletConfig {
  const mgr = manager ?? getSharedFreshWalletConfigManager();
  return mgr.getConfig();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse environment variable as number
 */
function parseEnvNumber(key: string, allowFloat = false): number | undefined {
  const value = process.env[key];
  if (value === undefined) {
    return undefined;
  }

  const parsed = allowFloat ? parseFloat(value) : parseInt(value, 10);
  if (isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}
