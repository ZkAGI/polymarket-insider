/**
 * Signal Weight Configurator (DET-SCORE-002)
 *
 * Configure weights for different detection signals used in composite
 * suspicion score calculation.
 *
 * Features:
 * - Define weight configuration schema
 * - Allow per-signal weights
 * - Validate weight sum
 * - Store in settings (persistence)
 * - Presets for different scenarios
 * - Change history tracking
 * - Event emission for config changes
 */

import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";

import {
  SignalSource,
  CompositeSignalCategory,
  COMPOSITE_DEFAULT_SIGNAL_WEIGHTS,
  DEFAULT_CATEGORY_WEIGHTS,
  SIGNAL_CATEGORY_MAP,
  SUSPICION_THRESHOLDS,
} from "./composite-suspicion-scorer";

// ============================================================================
// Types and Enums
// ============================================================================

/**
 * Weight validation mode
 */
export enum WeightValidationMode {
  /** Weights must sum exactly to 1.0 */
  STRICT = "STRICT",
  /** Weights are normalized to sum to 1.0 */
  NORMALIZE = "NORMALIZE",
  /** No validation - weights used as-is */
  NONE = "NONE",
}

/**
 * Weight preset identifier
 */
export enum WeightPreset {
  /** Default balanced weights */
  DEFAULT = "DEFAULT",
  /** Emphasis on network-based signals (coordination, sybil) */
  NETWORK_FOCUSED = "NETWORK_FOCUSED",
  /** Emphasis on performance signals (win rate, P&L, accuracy) */
  PERFORMANCE_FOCUSED = "PERFORMANCE_FOCUSED",
  /** Emphasis on behavioral signals (timing, sizing, selection) */
  BEHAVIOR_FOCUSED = "BEHAVIOR_FOCUSED",
  /** Conservative - equal weights for all signals */
  CONSERVATIVE = "CONSERVATIVE",
  /** Aggressive - higher weights on strongest indicators */
  AGGRESSIVE = "AGGRESSIVE",
  /** Fresh wallet detection focus */
  FRESH_WALLET_FOCUSED = "FRESH_WALLET_FOCUSED",
  /** Insider detection focus */
  INSIDER_DETECTION = "INSIDER_DETECTION",
  /** Custom - user-defined */
  CUSTOM = "CUSTOM",
}

/**
 * Weight change type
 */
export enum WeightChangeType {
  /** Signal weight changed */
  SIGNAL_WEIGHT = "SIGNAL_WEIGHT",
  /** Category weight changed */
  CATEGORY_WEIGHT = "CATEGORY_WEIGHT",
  /** Preset applied */
  PRESET_APPLIED = "PRESET_APPLIED",
  /** All weights reset */
  RESET = "RESET",
  /** Threshold changed */
  THRESHOLD = "THRESHOLD",
  /** Bulk update */
  BULK_UPDATE = "BULK_UPDATE",
}

/**
 * Signal weight entry
 */
export interface SignalWeight {
  /** Signal source identifier */
  source: SignalSource;
  /** Weight value (0-1) */
  weight: number;
  /** Whether this signal is enabled */
  enabled: boolean;
  /** Optional min weight allowed */
  minWeight?: number;
  /** Optional max weight allowed */
  maxWeight?: number;
  /** Human-readable description */
  description: string;
}

/**
 * Category weight entry
 */
export interface CategoryWeight {
  /** Category identifier */
  category: CompositeSignalCategory;
  /** Weight value (0-1) */
  weight: number;
  /** Whether this category is enabled */
  enabled: boolean;
  /** Human-readable description */
  description: string;
}

/**
 * Full weight configuration
 */
export interface WeightConfiguration {
  /** Configuration version (for migrations) */
  version: string;
  /** Configuration name/label */
  name: string;
  /** Optional description */
  description?: string;
  /** Active preset */
  preset: WeightPreset;
  /** Validation mode */
  validationMode: WeightValidationMode;
  /** Signal weights */
  signalWeights: Record<SignalSource, SignalWeight>;
  /** Category weights */
  categoryWeights: Record<CompositeSignalCategory, CategoryWeight>;
  /** Suspicion thresholds */
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Flag threshold */
  flagThreshold: number;
  /** Insider threshold */
  insiderThreshold: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** Modified by (optional identifier) */
  modifiedBy?: string;
}

/**
 * Weight change record
 */
export interface WeightChangeRecord {
  /** Change ID */
  id: string;
  /** Type of change */
  type: WeightChangeType;
  /** Timestamp */
  timestamp: Date;
  /** Previous value (serialized) */
  previousValue: string;
  /** New value (serialized) */
  newValue: string;
  /** Change description */
  description: string;
  /** Optional user/system identifier */
  changedBy?: string;
}

/**
 * Weight validation result
 */
export interface WeightValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of warnings (non-blocking) */
  warnings: string[];
  /** Sum of signal weights */
  signalWeightSum: number;
  /** Sum of category weights */
  categoryWeightSum: number;
  /** Normalized weights (if applicable) */
  normalizedWeights?: {
    signalWeights: Record<SignalSource, number>;
    categoryWeights: Record<CompositeSignalCategory, number>;
  };
}

/**
 * Weight impact analysis
 */
export interface WeightImpactAnalysis {
  /** Signal that would have most impact */
  mostImpactfulSignals: Array<{ source: SignalSource; effectiveWeight: number }>;
  /** Categories by impact */
  categoryImpact: Array<{ category: CompositeSignalCategory; totalWeight: number }>;
  /** Signals with zero effective weight */
  disabledSignals: SignalSource[];
  /** Balance assessment */
  balance: {
    /** Standard deviation of weights */
    signalWeightStdDev: number;
    /** Max/min ratio */
    signalWeightRatio: number;
    /** Assessment: balanced, skewed, extreme */
    assessment: "balanced" | "skewed" | "extreme";
  };
}

/**
 * Signal weight configurator options
 */
export interface SignalWeightConfiguratorOptions {
  /** Initial preset to load */
  initialPreset?: WeightPreset;
  /** Validation mode */
  validationMode?: WeightValidationMode;
  /** Auto-save changes */
  autoSave?: boolean;
  /** Settings file path (for persistence) */
  settingsPath?: string;
  /** Maximum history entries to keep */
  maxHistoryEntries?: number;
}

/**
 * Configurator summary
 */
export interface ConfiguratorSummary {
  /** Current preset */
  currentPreset: WeightPreset;
  /** Active signals count */
  activeSignals: number;
  /** Total signals count */
  totalSignals: number;
  /** Active categories count */
  activeCategories: number;
  /** Total categories count */
  totalCategories: number;
  /** Validation mode */
  validationMode: WeightValidationMode;
  /** Last modified */
  lastModified: Date;
  /** History entries count */
  historyCount: number;
  /** Configuration name */
  configName: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Current configuration version
 */
export const CONFIG_VERSION = "1.0.0";

/**
 * Signal descriptions
 */
export const SIGNAL_DESCRIPTIONS: Record<SignalSource, string> = {
  [SignalSource.FRESH_WALLET]: "Wallet age and activity history analysis",
  [SignalSource.WIN_RATE]: "Historical win/loss ratio tracking",
  [SignalSource.PROFIT_LOSS]: "Realized and unrealized profit/loss",
  [SignalSource.TIMING_PATTERN]: "Trade timing patterns and anomalies",
  [SignalSource.POSITION_SIZING]: "Position sizing behavior analysis",
  [SignalSource.MARKET_SELECTION]: "Market preference and selection patterns",
  [SignalSource.COORDINATION]: "Coordinated trading detection",
  [SignalSource.SYBIL]: "Sybil attack and multi-wallet pattern detection",
  [SignalSource.ACCURACY]: "Historical prediction accuracy scoring",
  [SignalSource.TRADING_PATTERN]: "Overall trading pattern classification",
};

/**
 * Category descriptions
 */
export const CATEGORY_DESCRIPTIONS: Record<CompositeSignalCategory, string> = {
  [CompositeSignalCategory.WALLET_PROFILE]: "Wallet characteristics and history",
  [CompositeSignalCategory.PERFORMANCE]: "Trading performance metrics",
  [CompositeSignalCategory.BEHAVIOR]: "Behavioral patterns and preferences",
  [CompositeSignalCategory.NETWORK]: "Network and coordination patterns",
};

/**
 * Weight presets
 */
export const WEIGHT_PRESETS: Record<
  WeightPreset,
  {
    signalWeights: Record<SignalSource, number>;
    categoryWeights: Record<CompositeSignalCategory, number>;
    description: string;
  }
> = {
  [WeightPreset.DEFAULT]: {
    signalWeights: { ...COMPOSITE_DEFAULT_SIGNAL_WEIGHTS },
    categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
    description: "Balanced default weights for general use",
  },
  [WeightPreset.NETWORK_FOCUSED]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.05,
      [SignalSource.WIN_RATE]: 0.08,
      [SignalSource.PROFIT_LOSS]: 0.08,
      [SignalSource.TIMING_PATTERN]: 0.07,
      [SignalSource.POSITION_SIZING]: 0.05,
      [SignalSource.MARKET_SELECTION]: 0.07,
      [SignalSource.COORDINATION]: 0.22,
      [SignalSource.SYBIL]: 0.20,
      [SignalSource.ACCURACY]: 0.08,
      [SignalSource.TRADING_PATTERN]: 0.10,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.10,
      [CompositeSignalCategory.PERFORMANCE]: 0.25,
      [CompositeSignalCategory.BEHAVIOR]: 0.20,
      [CompositeSignalCategory.NETWORK]: 0.45,
    },
    description: "Emphasis on coordination and sybil detection",
  },
  [WeightPreset.PERFORMANCE_FOCUSED]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.05,
      [SignalSource.WIN_RATE]: 0.20,
      [SignalSource.PROFIT_LOSS]: 0.20,
      [SignalSource.TIMING_PATTERN]: 0.08,
      [SignalSource.POSITION_SIZING]: 0.05,
      [SignalSource.MARKET_SELECTION]: 0.07,
      [SignalSource.COORDINATION]: 0.08,
      [SignalSource.SYBIL]: 0.07,
      [SignalSource.ACCURACY]: 0.15,
      [SignalSource.TRADING_PATTERN]: 0.05,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.10,
      [CompositeSignalCategory.PERFORMANCE]: 0.50,
      [CompositeSignalCategory.BEHAVIOR]: 0.20,
      [CompositeSignalCategory.NETWORK]: 0.20,
    },
    description: "Emphasis on win rate, P&L, and accuracy",
  },
  [WeightPreset.BEHAVIOR_FOCUSED]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.05,
      [SignalSource.WIN_RATE]: 0.08,
      [SignalSource.PROFIT_LOSS]: 0.08,
      [SignalSource.TIMING_PATTERN]: 0.18,
      [SignalSource.POSITION_SIZING]: 0.15,
      [SignalSource.MARKET_SELECTION]: 0.18,
      [SignalSource.COORDINATION]: 0.08,
      [SignalSource.SYBIL]: 0.07,
      [SignalSource.ACCURACY]: 0.08,
      [SignalSource.TRADING_PATTERN]: 0.05,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.10,
      [CompositeSignalCategory.PERFORMANCE]: 0.20,
      [CompositeSignalCategory.BEHAVIOR]: 0.50,
      [CompositeSignalCategory.NETWORK]: 0.20,
    },
    description: "Emphasis on timing, sizing, and selection patterns",
  },
  [WeightPreset.CONSERVATIVE]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.10,
      [SignalSource.WIN_RATE]: 0.10,
      [SignalSource.PROFIT_LOSS]: 0.10,
      [SignalSource.TIMING_PATTERN]: 0.10,
      [SignalSource.POSITION_SIZING]: 0.10,
      [SignalSource.MARKET_SELECTION]: 0.10,
      [SignalSource.COORDINATION]: 0.10,
      [SignalSource.SYBIL]: 0.10,
      [SignalSource.ACCURACY]: 0.10,
      [SignalSource.TRADING_PATTERN]: 0.10,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.25,
      [CompositeSignalCategory.PERFORMANCE]: 0.25,
      [CompositeSignalCategory.BEHAVIOR]: 0.25,
      [CompositeSignalCategory.NETWORK]: 0.25,
    },
    description: "Equal weights for all signals and categories",
  },
  [WeightPreset.AGGRESSIVE]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.05,
      [SignalSource.WIN_RATE]: 0.15,
      [SignalSource.PROFIT_LOSS]: 0.10,
      [SignalSource.TIMING_PATTERN]: 0.08,
      [SignalSource.POSITION_SIZING]: 0.05,
      [SignalSource.MARKET_SELECTION]: 0.07,
      [SignalSource.COORDINATION]: 0.20,
      [SignalSource.SYBIL]: 0.15,
      [SignalSource.ACCURACY]: 0.10,
      [SignalSource.TRADING_PATTERN]: 0.05,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.10,
      [CompositeSignalCategory.PERFORMANCE]: 0.35,
      [CompositeSignalCategory.BEHAVIOR]: 0.20,
      [CompositeSignalCategory.NETWORK]: 0.35,
    },
    description: "Higher weights on strongest insider indicators",
  },
  [WeightPreset.FRESH_WALLET_FOCUSED]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.25,
      [SignalSource.WIN_RATE]: 0.08,
      [SignalSource.PROFIT_LOSS]: 0.08,
      [SignalSource.TIMING_PATTERN]: 0.10,
      [SignalSource.POSITION_SIZING]: 0.08,
      [SignalSource.MARKET_SELECTION]: 0.08,
      [SignalSource.COORDINATION]: 0.10,
      [SignalSource.SYBIL]: 0.10,
      [SignalSource.ACCURACY]: 0.08,
      [SignalSource.TRADING_PATTERN]: 0.05,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.40,
      [CompositeSignalCategory.PERFORMANCE]: 0.20,
      [CompositeSignalCategory.BEHAVIOR]: 0.20,
      [CompositeSignalCategory.NETWORK]: 0.20,
    },
    description: "Focus on fresh wallet detection",
  },
  [WeightPreset.INSIDER_DETECTION]: {
    signalWeights: {
      [SignalSource.FRESH_WALLET]: 0.08,
      [SignalSource.WIN_RATE]: 0.15,
      [SignalSource.PROFIT_LOSS]: 0.12,
      [SignalSource.TIMING_PATTERN]: 0.12,
      [SignalSource.POSITION_SIZING]: 0.08,
      [SignalSource.MARKET_SELECTION]: 0.10,
      [SignalSource.COORDINATION]: 0.12,
      [SignalSource.SYBIL]: 0.08,
      [SignalSource.ACCURACY]: 0.10,
      [SignalSource.TRADING_PATTERN]: 0.05,
    },
    categoryWeights: {
      [CompositeSignalCategory.WALLET_PROFILE]: 0.15,
      [CompositeSignalCategory.PERFORMANCE]: 0.35,
      [CompositeSignalCategory.BEHAVIOR]: 0.25,
      [CompositeSignalCategory.NETWORK]: 0.25,
    },
    description: "Optimized for insider trading detection",
  },
  [WeightPreset.CUSTOM]: {
    signalWeights: { ...COMPOSITE_DEFAULT_SIGNAL_WEIGHTS },
    categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
    description: "Custom user-defined weights",
  },
};

/**
 * Default configurator options
 */
export const DEFAULT_CONFIGURATOR_OPTIONS: Required<SignalWeightConfiguratorOptions> = {
  initialPreset: WeightPreset.DEFAULT,
  validationMode: WeightValidationMode.NORMALIZE,
  autoSave: false,
  settingsPath: "",
  maxHistoryEntries: 100,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// Signal Weight Configurator Class
// ============================================================================

/**
 * Main signal weight configurator class
 */
export class SignalWeightConfigurator extends EventEmitter {
  private config: WeightConfiguration;
  private readonly history: WeightChangeRecord[] = [];
  private readonly options: Required<SignalWeightConfiguratorOptions>;

  constructor(options: SignalWeightConfiguratorOptions = {}) {
    super();
    this.options = { ...DEFAULT_CONFIGURATOR_OPTIONS, ...options };

    // Initialize with default configuration
    this.config = this.createDefaultConfig(this.options.initialPreset);

    // Try to load saved configuration if path provided
    if (this.options.settingsPath) {
      this.loadFromFile();
    }
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(preset: WeightPreset = WeightPreset.DEFAULT): WeightConfiguration {
    const presetData = WEIGHT_PRESETS[preset];

    const signalWeights: Record<SignalSource, SignalWeight> = {} as Record<
      SignalSource,
      SignalWeight
    >;
    for (const source of Object.values(SignalSource)) {
      signalWeights[source] = {
        source,
        weight: presetData.signalWeights[source],
        enabled: true,
        description: SIGNAL_DESCRIPTIONS[source],
      };
    }

    const categoryWeights: Record<CompositeSignalCategory, CategoryWeight> = {} as Record<
      CompositeSignalCategory,
      CategoryWeight
    >;
    for (const category of Object.values(CompositeSignalCategory)) {
      categoryWeights[category] = {
        category,
        weight: presetData.categoryWeights[category],
        enabled: true,
        description: CATEGORY_DESCRIPTIONS[category],
      };
    }

    return {
      version: CONFIG_VERSION,
      name: `Config - ${preset}`,
      description: presetData.description,
      preset,
      validationMode: this.options.validationMode,
      signalWeights,
      categoryWeights,
      thresholds: { ...SUSPICION_THRESHOLDS },
      flagThreshold: 50,
      insiderThreshold: 70,
      lastModified: new Date(),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): WeightConfiguration {
    return deepClone(this.config);
  }

  /**
   * Get current preset
   */
  getCurrentPreset(): WeightPreset {
    return this.config.preset;
  }

  /**
   * Get signal weight
   */
  getSignalWeight(source: SignalSource): SignalWeight {
    return deepClone(this.config.signalWeights[source]);
  }

  /**
   * Get all signal weights
   */
  getAllSignalWeights(): Record<SignalSource, SignalWeight> {
    return deepClone(this.config.signalWeights);
  }

  /**
   * Get category weight
   */
  getCategoryWeight(category: CompositeSignalCategory): CategoryWeight {
    return deepClone(this.config.categoryWeights[category]);
  }

  /**
   * Get all category weights
   */
  getAllCategoryWeights(): Record<CompositeSignalCategory, CategoryWeight> {
    return deepClone(this.config.categoryWeights);
  }

  /**
   * Get effective weights for use in composite scorer
   */
  getEffectiveWeights(): {
    signalWeights: Partial<Record<SignalSource, number>>;
    categoryWeights: Partial<Record<CompositeSignalCategory, number>>;
  } {
    const signalWeights: Partial<Record<SignalSource, number>> = {};
    const categoryWeights: Partial<Record<CompositeSignalCategory, number>> = {};

    // Get enabled signal weights
    for (const [source, sw] of Object.entries(this.config.signalWeights)) {
      if (sw.enabled) {
        signalWeights[source as SignalSource] = sw.weight;
      }
    }

    // Get enabled category weights
    for (const [category, cw] of Object.entries(this.config.categoryWeights)) {
      if (cw.enabled) {
        categoryWeights[category as CompositeSignalCategory] = cw.weight;
      }
    }

    // Normalize if needed
    if (this.config.validationMode === WeightValidationMode.NORMALIZE) {
      const signalSum = Object.values(signalWeights).reduce((a, b) => a + (b ?? 0), 0);
      const categorySum = Object.values(categoryWeights).reduce((a, b) => a + (b ?? 0), 0);

      if (signalSum > 0) {
        for (const source of Object.keys(signalWeights) as SignalSource[]) {
          signalWeights[source] = (signalWeights[source] ?? 0) / signalSum;
        }
      }

      if (categorySum > 0) {
        for (const category of Object.keys(categoryWeights) as CompositeSignalCategory[]) {
          categoryWeights[category] = (categoryWeights[category] ?? 0) / categorySum;
        }
      }
    }

    return { signalWeights, categoryWeights };
  }

  /**
   * Set signal weight
   */
  setSignalWeight(
    source: SignalSource,
    weight: number,
    changedBy?: string
  ): WeightValidationResult {
    if (weight < 0 || weight > 1) {
      return {
        isValid: false,
        errors: [`Weight must be between 0 and 1, got ${weight}`],
        warnings: [],
        signalWeightSum: 0,
        categoryWeightSum: 0,
      };
    }

    const sw = this.config.signalWeights[source];
    if (sw.minWeight !== undefined && weight < sw.minWeight) {
      return {
        isValid: false,
        errors: [`Weight ${weight} is below minimum ${sw.minWeight} for ${source}`],
        warnings: [],
        signalWeightSum: 0,
        categoryWeightSum: 0,
      };
    }
    if (sw.maxWeight !== undefined && weight > sw.maxWeight) {
      return {
        isValid: false,
        errors: [`Weight ${weight} is above maximum ${sw.maxWeight} for ${source}`],
        warnings: [],
        signalWeightSum: 0,
        categoryWeightSum: 0,
      };
    }

    const previousValue = sw.weight;
    sw.weight = weight;
    this.config.preset = WeightPreset.CUSTOM;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.SIGNAL_WEIGHT,
      previousValue: JSON.stringify({ source, weight: previousValue }),
      newValue: JSON.stringify({ source, weight }),
      description: `Changed ${source} weight from ${previousValue} to ${weight}`,
      changedBy,
    });

    // Validate
    const validation = this.validate();

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("weight-changed", {
      type: "signal",
      source,
      previousValue,
      newValue: weight,
    });

    return validation;
  }

  /**
   * Set category weight
   */
  setCategoryWeight(
    category: CompositeSignalCategory,
    weight: number,
    changedBy?: string
  ): WeightValidationResult {
    if (weight < 0 || weight > 1) {
      return {
        isValid: false,
        errors: [`Weight must be between 0 and 1, got ${weight}`],
        warnings: [],
        signalWeightSum: 0,
        categoryWeightSum: 0,
      };
    }

    const cw = this.config.categoryWeights[category];
    const previousValue = cw.weight;
    cw.weight = weight;
    this.config.preset = WeightPreset.CUSTOM;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.CATEGORY_WEIGHT,
      previousValue: JSON.stringify({ category, weight: previousValue }),
      newValue: JSON.stringify({ category, weight }),
      description: `Changed ${category} weight from ${previousValue} to ${weight}`,
      changedBy,
    });

    // Validate
    const validation = this.validate();

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("weight-changed", {
      type: "category",
      category,
      previousValue,
      newValue: weight,
    });

    return validation;
  }

  /**
   * Bulk set signal weights
   */
  setSignalWeights(
    weights: Partial<Record<SignalSource, number>>,
    changedBy?: string
  ): WeightValidationResult {
    const previousWeights: Record<string, number> = {};

    for (const [source, weight] of Object.entries(weights)) {
      if (weight !== undefined) {
        const sw = this.config.signalWeights[source as SignalSource];
        if (sw) {
          previousWeights[source] = sw.weight;
          sw.weight = weight;
        }
      }
    }

    this.config.preset = WeightPreset.CUSTOM;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.BULK_UPDATE,
      previousValue: JSON.stringify(previousWeights),
      newValue: JSON.stringify(weights),
      description: `Bulk updated ${Object.keys(weights).length} signal weights`,
      changedBy,
    });

    // Validate
    const validation = this.validate();

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("weights-bulk-changed", { type: "signals", weights });

    return validation;
  }

  /**
   * Bulk set category weights
   */
  setCategoryWeights(
    weights: Partial<Record<CompositeSignalCategory, number>>,
    changedBy?: string
  ): WeightValidationResult {
    const previousWeights: Record<string, number> = {};

    for (const [category, weight] of Object.entries(weights)) {
      if (weight !== undefined) {
        const cw = this.config.categoryWeights[category as CompositeSignalCategory];
        if (cw) {
          previousWeights[category] = cw.weight;
          cw.weight = weight;
        }
      }
    }

    this.config.preset = WeightPreset.CUSTOM;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.BULK_UPDATE,
      previousValue: JSON.stringify(previousWeights),
      newValue: JSON.stringify(weights),
      description: `Bulk updated ${Object.keys(weights).length} category weights`,
      changedBy,
    });

    // Validate
    const validation = this.validate();

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("weights-bulk-changed", { type: "categories", weights });

    return validation;
  }

  /**
   * Enable/disable a signal
   */
  setSignalEnabled(source: SignalSource, enabled: boolean, changedBy?: string): void {
    const sw = this.config.signalWeights[source];
    const previousValue = sw.enabled;
    sw.enabled = enabled;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.SIGNAL_WEIGHT,
      previousValue: JSON.stringify({ source, enabled: previousValue }),
      newValue: JSON.stringify({ source, enabled }),
      description: `${enabled ? "Enabled" : "Disabled"} signal ${source}`,
      changedBy,
    });

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("signal-toggled", { source, enabled });
  }

  /**
   * Enable/disable a category
   */
  setCategoryEnabled(category: CompositeSignalCategory, enabled: boolean, changedBy?: string): void {
    const cw = this.config.categoryWeights[category];
    const previousValue = cw.enabled;
    cw.enabled = enabled;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.CATEGORY_WEIGHT,
      previousValue: JSON.stringify({ category, enabled: previousValue }),
      newValue: JSON.stringify({ category, enabled }),
      description: `${enabled ? "Enabled" : "Disabled"} category ${category}`,
      changedBy,
    });

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("category-toggled", { category, enabled });
  }

  /**
   * Apply a preset
   */
  applyPreset(preset: WeightPreset, changedBy?: string): WeightValidationResult {
    const presetData = WEIGHT_PRESETS[preset];
    if (!presetData) {
      return {
        isValid: false,
        errors: [`Unknown preset: ${preset}`],
        warnings: [],
        signalWeightSum: 0,
        categoryWeightSum: 0,
      };
    }

    const previousPreset = this.config.preset;

    // Apply signal weights
    for (const [source, weight] of Object.entries(presetData.signalWeights)) {
      this.config.signalWeights[source as SignalSource].weight = weight;
    }

    // Apply category weights
    for (const [category, weight] of Object.entries(presetData.categoryWeights)) {
      this.config.categoryWeights[category as CompositeSignalCategory].weight = weight;
    }

    this.config.preset = preset;
    this.config.description = presetData.description;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.PRESET_APPLIED,
      previousValue: previousPreset,
      newValue: preset,
      description: `Applied preset: ${preset}`,
      changedBy,
    });

    // Validate
    const validation = this.validate();

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("preset-applied", { preset, previousPreset });

    return validation;
  }

  /**
   * Set threshold values
   */
  setThresholds(
    thresholds: Partial<{ low: number; medium: number; high: number; critical: number }>,
    changedBy?: string
  ): WeightValidationResult {
    const previousThresholds = { ...this.config.thresholds };

    // Validate thresholds are in order
    const newThresholds = { ...this.config.thresholds, ...thresholds };
    if (
      newThresholds.low >= newThresholds.medium ||
      newThresholds.medium >= newThresholds.high ||
      newThresholds.high >= newThresholds.critical
    ) {
      return {
        isValid: false,
        errors: ["Thresholds must be in ascending order: low < medium < high < critical"],
        warnings: [],
        signalWeightSum: this.calculateSignalWeightSum(),
        categoryWeightSum: this.calculateCategoryWeightSum(),
      };
    }

    this.config.thresholds = newThresholds;
    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.THRESHOLD,
      previousValue: JSON.stringify(previousThresholds),
      newValue: JSON.stringify(newThresholds),
      description: `Updated thresholds`,
      changedBy,
    });

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("thresholds-changed", { previousThresholds, newThresholds });

    return this.validate();
  }

  /**
   * Set flag and insider thresholds
   */
  setFlagThresholds(
    thresholds: { flagThreshold?: number; insiderThreshold?: number },
    changedBy?: string
  ): void {
    const previous = {
      flagThreshold: this.config.flagThreshold,
      insiderThreshold: this.config.insiderThreshold,
    };

    if (thresholds.flagThreshold !== undefined) {
      this.config.flagThreshold = thresholds.flagThreshold;
    }
    if (thresholds.insiderThreshold !== undefined) {
      this.config.insiderThreshold = thresholds.insiderThreshold;
    }

    this.config.lastModified = new Date();

    // Record change
    this.recordChange({
      type: WeightChangeType.THRESHOLD,
      previousValue: JSON.stringify(previous),
      newValue: JSON.stringify({
        flagThreshold: this.config.flagThreshold,
        insiderThreshold: this.config.insiderThreshold,
      }),
      description: `Updated flag/insider thresholds`,
      changedBy,
    });

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("flag-thresholds-changed", {
      previous,
      current: {
        flagThreshold: this.config.flagThreshold,
        insiderThreshold: this.config.insiderThreshold,
      },
    });
  }

  /**
   * Reset to defaults
   */
  reset(changedBy?: string): WeightValidationResult {
    const previousConfig = deepClone(this.config);

    this.config = this.createDefaultConfig(WeightPreset.DEFAULT);

    // Record change
    this.recordChange({
      type: WeightChangeType.RESET,
      previousValue: JSON.stringify(previousConfig),
      newValue: JSON.stringify(this.config),
      description: "Reset to default configuration",
      changedBy,
    });

    // Auto-save if enabled
    if (this.options.autoSave && this.options.settingsPath) {
      this.saveToFile();
    }

    // Emit event
    this.emit("config-reset");

    return this.validate();
  }

  /**
   * Validate current configuration
   */
  validate(): WeightValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Calculate sums
    const signalWeightSum = this.calculateSignalWeightSum();
    const categoryWeightSum = this.calculateCategoryWeightSum();

    // Validate based on mode
    if (this.config.validationMode === WeightValidationMode.STRICT) {
      const tolerance = 0.001;
      if (Math.abs(signalWeightSum - 1) > tolerance) {
        errors.push(
          `Signal weights must sum to 1.0, got ${signalWeightSum.toFixed(4)}`
        );
      }
      if (Math.abs(categoryWeightSum - 1) > tolerance) {
        errors.push(
          `Category weights must sum to 1.0, got ${categoryWeightSum.toFixed(4)}`
        );
      }
    } else if (this.config.validationMode === WeightValidationMode.NORMALIZE) {
      if (signalWeightSum === 0) {
        errors.push("At least one signal weight must be non-zero for normalization");
      }
      if (categoryWeightSum === 0) {
        errors.push("At least one category weight must be non-zero for normalization");
      }
    }

    // Check for disabled signals
    const disabledSignals = Object.values(this.config.signalWeights).filter(
      (sw) => !sw.enabled
    );
    if (disabledSignals.length > 0) {
      warnings.push(
        `${disabledSignals.length} signal(s) are disabled: ${disabledSignals
          .map((sw) => sw.source)
          .join(", ")}`
      );
    }

    // Check for zero weights
    const zeroWeightSignals = Object.values(this.config.signalWeights).filter(
      (sw) => sw.enabled && sw.weight === 0
    );
    if (zeroWeightSignals.length > 0) {
      warnings.push(
        `${zeroWeightSignals.length} enabled signal(s) have zero weight: ${zeroWeightSignals
          .map((sw) => sw.source)
          .join(", ")}`
      );
    }

    // Check threshold order
    const { low, medium, high, critical } = this.config.thresholds;
    if (low >= medium || medium >= high || high >= critical) {
      errors.push("Thresholds must be in ascending order: low < medium < high < critical");
    }

    // Calculate normalized weights for return
    let normalizedWeights:
      | {
          signalWeights: Record<SignalSource, number>;
          categoryWeights: Record<CompositeSignalCategory, number>;
        }
      | undefined;

    if (
      this.config.validationMode === WeightValidationMode.NORMALIZE &&
      signalWeightSum > 0 &&
      categoryWeightSum > 0
    ) {
      const normalizedSignalWeights: Record<SignalSource, number> = {} as Record<
        SignalSource,
        number
      >;
      const normalizedCategoryWeights: Record<CompositeSignalCategory, number> = {} as Record<
        CompositeSignalCategory,
        number
      >;

      for (const [source, sw] of Object.entries(this.config.signalWeights)) {
        normalizedSignalWeights[source as SignalSource] = sw.enabled
          ? sw.weight / signalWeightSum
          : 0;
      }

      for (const [category, cw] of Object.entries(this.config.categoryWeights)) {
        normalizedCategoryWeights[category as CompositeSignalCategory] = cw.enabled
          ? cw.weight / categoryWeightSum
          : 0;
      }

      normalizedWeights = {
        signalWeights: normalizedSignalWeights,
        categoryWeights: normalizedCategoryWeights,
      };
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      signalWeightSum,
      categoryWeightSum,
      normalizedWeights,
    };
  }

  /**
   * Calculate signal weight sum (enabled signals only)
   */
  private calculateSignalWeightSum(): number {
    return Object.values(this.config.signalWeights)
      .filter((sw) => sw.enabled)
      .reduce((sum, sw) => sum + sw.weight, 0);
  }

  /**
   * Calculate category weight sum (enabled categories only)
   */
  private calculateCategoryWeightSum(): number {
    return Object.values(this.config.categoryWeights)
      .filter((cw) => cw.enabled)
      .reduce((sum, cw) => sum + cw.weight, 0);
  }

  /**
   * Analyze weight impact
   */
  analyzeWeightImpact(): WeightImpactAnalysis {
    const enabledSignals = Object.values(this.config.signalWeights).filter((sw) => sw.enabled);
    const signalWeightSum = enabledSignals.reduce((sum, sw) => sum + sw.weight, 0);

    // Calculate effective weights (after normalization)
    const effectiveWeights = enabledSignals.map((sw) => ({
      source: sw.source,
      effectiveWeight: signalWeightSum > 0 ? sw.weight / signalWeightSum : 0,
    }));

    // Sort by effective weight
    effectiveWeights.sort((a, b) => b.effectiveWeight - a.effectiveWeight);

    // Calculate category impact
    const categoryImpactMap = new Map<CompositeSignalCategory, number>();
    for (const cat of Object.values(CompositeSignalCategory)) {
      categoryImpactMap.set(cat, 0);
    }

    for (const ew of effectiveWeights) {
      const category = SIGNAL_CATEGORY_MAP[ew.source];
      const current = categoryImpactMap.get(category) ?? 0;
      categoryImpactMap.set(category, current + ew.effectiveWeight);
    }

    const categoryImpact = Array.from(categoryImpactMap.entries())
      .map(([category, totalWeight]) => ({ category, totalWeight }))
      .sort((a, b) => b.totalWeight - a.totalWeight);

    // Find disabled signals
    const disabledSignals = Object.values(this.config.signalWeights)
      .filter((sw) => !sw.enabled || sw.weight === 0)
      .map((sw) => sw.source);

    // Calculate balance metrics
    const weights = effectiveWeights.map((ew) => ew.effectiveWeight);
    const stdDev = calculateStdDev(weights);
    const maxWeight = Math.max(...weights, 0);
    const minWeight = Math.min(...weights.filter((w) => w > 0), 1);
    const ratio = minWeight > 0 ? maxWeight / minWeight : Infinity;

    let assessment: "balanced" | "skewed" | "extreme";
    if (stdDev < 0.03 && ratio < 2) {
      assessment = "balanced";
    } else if (stdDev < 0.08 && ratio < 5) {
      assessment = "skewed";
    } else {
      assessment = "extreme";
    }

    return {
      mostImpactfulSignals: effectiveWeights.slice(0, 5),
      categoryImpact,
      disabledSignals,
      balance: {
        signalWeightStdDev: stdDev,
        signalWeightRatio: ratio,
        assessment,
      },
    };
  }

  /**
   * Get change history
   */
  getHistory(): WeightChangeRecord[] {
    return [...this.history];
  }

  /**
   * Get recent history
   */
  getRecentHistory(count: number = 10): WeightChangeRecord[] {
    return this.history.slice(-count);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.length = 0;
    this.emit("history-cleared");
  }

  /**
   * Record a change
   */
  private recordChange(
    change: Omit<WeightChangeRecord, "id" | "timestamp">
  ): void {
    const record: WeightChangeRecord = {
      id: generateId(),
      timestamp: new Date(),
      ...change,
    };

    this.history.push(record);

    // Maintain max history size
    while (this.history.length > this.options.maxHistoryEntries) {
      this.history.shift();
    }
  }

  /**
   * Get configurator summary
   */
  getSummary(): ConfiguratorSummary {
    const activeSignals = Object.values(this.config.signalWeights).filter(
      (sw) => sw.enabled
    ).length;
    const activeCategories = Object.values(this.config.categoryWeights).filter(
      (cw) => cw.enabled
    ).length;

    return {
      currentPreset: this.config.preset,
      activeSignals,
      totalSignals: Object.keys(SignalSource).length,
      activeCategories,
      totalCategories: Object.keys(CompositeSignalCategory).length,
      validationMode: this.config.validationMode,
      lastModified: this.config.lastModified,
      historyCount: this.history.length,
      configName: this.config.name,
    };
  }

  /**
   * Set configuration name
   */
  setConfigName(name: string): void {
    this.config.name = name;
    this.config.lastModified = new Date();
  }

  /**
   * Set configuration description
   */
  setConfigDescription(description: string): void {
    this.config.description = description;
    this.config.lastModified = new Date();
  }

  /**
   * Set validation mode
   */
  setValidationMode(mode: WeightValidationMode): WeightValidationResult {
    this.config.validationMode = mode;
    this.config.lastModified = new Date();

    this.emit("validation-mode-changed", { mode });

    return this.validate();
  }

  /**
   * Export configuration to JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(json: string, changedBy?: string): WeightValidationResult {
    try {
      const imported = JSON.parse(json) as WeightConfiguration;

      // Validate structure
      if (!imported.signalWeights || !imported.categoryWeights) {
        return {
          isValid: false,
          errors: ["Invalid configuration format: missing signalWeights or categoryWeights"],
          warnings: [],
          signalWeightSum: 0,
          categoryWeightSum: 0,
        };
      }

      // Validate all signal sources exist
      for (const source of Object.values(SignalSource)) {
        if (!imported.signalWeights[source]) {
          return {
            isValid: false,
            errors: [`Missing signal weight for ${source}`],
            warnings: [],
            signalWeightSum: 0,
            categoryWeightSum: 0,
          };
        }
      }

      // Validate all categories exist
      for (const category of Object.values(CompositeSignalCategory)) {
        if (!imported.categoryWeights[category]) {
          return {
            isValid: false,
            errors: [`Missing category weight for ${category}`],
            warnings: [],
            signalWeightSum: 0,
            categoryWeightSum: 0,
          };
        }
      }

      const previousConfig = deepClone(this.config);

      // Apply imported config
      this.config = {
        ...imported,
        lastModified: new Date(),
      };

      // Record change
      this.recordChange({
        type: WeightChangeType.BULK_UPDATE,
        previousValue: JSON.stringify(previousConfig),
        newValue: JSON.stringify(this.config),
        description: "Imported configuration from JSON",
        changedBy,
      });

      // Auto-save if enabled
      if (this.options.autoSave && this.options.settingsPath) {
        this.saveToFile();
      }

      // Emit event
      this.emit("config-imported");

      return this.validate();
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Failed to parse configuration: ${error instanceof Error ? error.message : String(error)}`,
        ],
        warnings: [],
        signalWeightSum: 0,
        categoryWeightSum: 0,
      };
    }
  }

  /**
   * Save configuration to file
   */
  saveToFile(filePath?: string): boolean {
    const targetPath = filePath ?? this.options.settingsPath;
    if (!targetPath) {
      return false;
    }

    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(targetPath, this.exportConfig(), "utf8");
      this.emit("config-saved", { path: targetPath });
      return true;
    } catch (error) {
      this.emit("save-error", { path: targetPath, error });
      return false;
    }
  }

  /**
   * Load configuration from file
   */
  loadFromFile(filePath?: string): boolean {
    const targetPath = filePath ?? this.options.settingsPath;
    if (!targetPath) {
      return false;
    }

    try {
      if (!fs.existsSync(targetPath)) {
        return false;
      }

      const content = fs.readFileSync(targetPath, "utf8");
      const validation = this.importConfig(content, "file-load");

      if (validation.isValid) {
        this.emit("config-loaded", { path: targetPath });
        return true;
      }

      return false;
    } catch (error) {
      this.emit("load-error", { path: targetPath, error });
      return false;
    }
  }

  /**
   * Get all available presets
   */
  getAvailablePresets(): Array<{
    preset: WeightPreset;
    description: string;
  }> {
    return Object.entries(WEIGHT_PRESETS).map(([preset, data]) => ({
      preset: preset as WeightPreset,
      description: data.description,
    }));
  }

  /**
   * Get signals by category
   */
  getSignalsByCategory(category: CompositeSignalCategory): SignalWeight[] {
    return Object.values(this.config.signalWeights).filter(
      (sw) => SIGNAL_CATEGORY_MAP[sw.source] === category
    );
  }
}

// ============================================================================
// Shared Instance Management
// ============================================================================

let sharedInstance: SignalWeightConfigurator | null = null;

/**
 * Get shared configurator instance
 */
export function getSharedSignalWeightConfigurator(): SignalWeightConfigurator {
  if (!sharedInstance) {
    sharedInstance = new SignalWeightConfigurator();
  }
  return sharedInstance;
}

/**
 * Set shared configurator instance
 */
export function setSharedSignalWeightConfigurator(
  configurator: SignalWeightConfigurator
): void {
  sharedInstance = configurator;
}

/**
 * Reset shared configurator instance
 */
export function resetSharedSignalWeightConfigurator(): void {
  sharedInstance = null;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new configurator with options
 */
export function createSignalWeightConfigurator(
  options?: SignalWeightConfiguratorOptions
): SignalWeightConfigurator {
  return new SignalWeightConfigurator(options);
}

/**
 * Create a configurator with a specific preset
 */
export function createConfiguratorWithPreset(
  preset: WeightPreset,
  options?: Omit<SignalWeightConfiguratorOptions, "initialPreset">
): SignalWeightConfigurator {
  return new SignalWeightConfigurator({
    ...options,
    initialPreset: preset,
  });
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get effective weights from shared instance
 */
export function getEffectiveWeights(): {
  signalWeights: Partial<Record<SignalSource, number>>;
  categoryWeights: Partial<Record<CompositeSignalCategory, number>>;
} {
  return getSharedSignalWeightConfigurator().getEffectiveWeights();
}

/**
 * Set signal weight on shared instance
 */
export function setSignalWeight(
  source: SignalSource,
  weight: number
): WeightValidationResult {
  return getSharedSignalWeightConfigurator().setSignalWeight(source, weight);
}

/**
 * Set category weight on shared instance
 */
export function setCategoryWeight(
  category: CompositeSignalCategory,
  weight: number
): WeightValidationResult {
  return getSharedSignalWeightConfigurator().setCategoryWeight(category, weight);
}

/**
 * Apply preset to shared instance
 */
export function applyWeightPreset(preset: WeightPreset): WeightValidationResult {
  return getSharedSignalWeightConfigurator().applyPreset(preset);
}

/**
 * Validate weights on shared instance
 */
export function validateWeights(): WeightValidationResult {
  return getSharedSignalWeightConfigurator().validate();
}

/**
 * Get weight impact analysis from shared instance
 */
export function analyzeWeightImpact(): WeightImpactAnalysis {
  return getSharedSignalWeightConfigurator().analyzeWeightImpact();
}

/**
 * Reset weights to defaults on shared instance
 */
export function resetWeightsToDefaults(): WeightValidationResult {
  return getSharedSignalWeightConfigurator().reset();
}

/**
 * Export current weights configuration
 */
export function exportWeightsConfig(): string {
  return getSharedSignalWeightConfigurator().exportConfig();
}

/**
 * Import weights configuration
 */
export function importWeightsConfig(json: string): WeightValidationResult {
  return getSharedSignalWeightConfigurator().importConfig(json);
}

/**
 * Get configurator summary
 */
export function getConfiguratorSummary(): ConfiguratorSummary {
  return getSharedSignalWeightConfigurator().getSummary();
}

// ============================================================================
// Description Helper Functions
// ============================================================================

/**
 * Get human-readable description for a preset
 */
export function getPresetDescription(preset: WeightPreset): string {
  return WEIGHT_PRESETS[preset]?.description ?? "Unknown preset";
}

/**
 * Get human-readable description for a signal
 */
export function getSignalDescription(source: SignalSource): string {
  return SIGNAL_DESCRIPTIONS[source] ?? "Unknown signal";
}

/**
 * Get human-readable description for a category
 */
export function getCategoryDescription(category: CompositeSignalCategory): string {
  return CATEGORY_DESCRIPTIONS[category] ?? "Unknown category";
}

/**
 * Get validation mode description
 */
export function getValidationModeDescription(mode: WeightValidationMode): string {
  switch (mode) {
    case WeightValidationMode.STRICT:
      return "Weights must sum exactly to 1.0";
    case WeightValidationMode.NORMALIZE:
      return "Weights are automatically normalized to sum to 1.0";
    case WeightValidationMode.NONE:
      return "No validation - weights are used as configured";
    default:
      return "Unknown validation mode";
  }
}
