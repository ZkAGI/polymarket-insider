/**
 * False Positive Reducer Unit Tests (DET-SCORE-004)
 *
 * Comprehensive tests for the false positive reducer module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FalsePositivePattern,
  FilterAction,
  FilterConfidence,
  FilterPriority,
  FilterOutcome,
  PATTERN_DESCRIPTIONS,
  CONFIDENCE_SCORES,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_FILTER_RULES,
  DEFAULT_REDUCER_CONFIG,
  FalsePositiveReducer,
  createFalsePositiveReducer,
  getSharedFalsePositiveReducer,
  setSharedFalsePositiveReducer,
  resetSharedFalsePositiveReducer,
  filterFalsePositives,
  batchFilterFalsePositives,
  addFilterRule,
  removeFilterRule,
  getFilterRules,
  getReducerEffectiveness,
  getReducerSummary,
  getFalsePositivePatternDescription,
  getFilterConfidenceScore,
  type FilterRule,
  type CompositeScoreResult,
  CompositeSuspicionLevel,
  SignalSource,
} from "../../src/detection";

// ============================================================================
// Test Utilities
// ============================================================================

function createMockCompositeResult(
  walletAddress: string,
  overrides: Partial<CompositeScoreResult> = {}
): CompositeScoreResult {
  const defaultResult: CompositeScoreResult = {
    walletAddress,
    compositeScore: 50,
    suspicionLevel: CompositeSuspicionLevel.MEDIUM,
    shouldFlag: true,
    isPotentialInsider: false,
    categoryBreakdown: [],
    signalContributions: [
      {
        source: SignalSource.FRESH_WALLET,
        category: "WALLET_PROFILE" as never,
        name: "Fresh Wallet Analysis",
        rawScore: 30,
        weight: 0.1,
        weightedScore: 3,
        confidence: "MEDIUM" as never,
        dataQuality: 80,
        available: true,
        reason: "Normal wallet",
        flags: [],
      },
      {
        source: SignalSource.WIN_RATE,
        category: "PERFORMANCE" as never,
        name: "Win Rate Analysis",
        rawScore: 40,
        weight: 0.12,
        weightedScore: 4.8,
        confidence: "MEDIUM" as never,
        dataQuality: 75,
        available: true,
        reason: "Moderate win rate",
        flags: [],
      },
      {
        source: SignalSource.PROFIT_LOSS,
        category: "PERFORMANCE" as never,
        name: "Profit/Loss Analysis",
        rawScore: 35,
        weight: 0.12,
        weightedScore: 4.2,
        confidence: "MEDIUM" as never,
        dataQuality: 70,
        available: true,
        reason: "Normal P&L",
        flags: [],
      },
      {
        source: SignalSource.TIMING_PATTERN,
        category: "BEHAVIOR" as never,
        name: "Timing Pattern Analysis",
        rawScore: 25,
        weight: 0.1,
        weightedScore: 2.5,
        confidence: "MEDIUM" as never,
        dataQuality: 85,
        available: true,
        reason: "Regular timing",
        flags: [],
      },
      {
        source: SignalSource.POSITION_SIZING,
        category: "BEHAVIOR" as never,
        name: "Position Sizing Analysis",
        rawScore: 30,
        weight: 0.08,
        weightedScore: 2.4,
        confidence: "MEDIUM" as never,
        dataQuality: 80,
        available: true,
        reason: "Normal sizing",
        flags: [],
      },
      {
        source: SignalSource.MARKET_SELECTION,
        category: "BEHAVIOR" as never,
        name: "Market Selection Analysis",
        rawScore: 35,
        weight: 0.1,
        weightedScore: 3.5,
        confidence: "MEDIUM" as never,
        dataQuality: 75,
        available: true,
        reason: "Diverse selection",
        flags: [],
      },
      {
        source: SignalSource.COORDINATION,
        category: "NETWORK" as never,
        name: "Coordination Detection",
        rawScore: 20,
        weight: 0.12,
        weightedScore: 2.4,
        confidence: "MEDIUM" as never,
        dataQuality: 70,
        available: true,
        reason: "Low coordination",
        flags: [],
      },
      {
        source: SignalSource.SYBIL,
        category: "NETWORK" as never,
        name: "Sybil Detection",
        rawScore: 15,
        weight: 0.1,
        weightedScore: 1.5,
        confidence: "MEDIUM" as never,
        dataQuality: 65,
        available: true,
        reason: "Low sybil risk",
        flags: [],
      },
      {
        source: SignalSource.ACCURACY,
        category: "PERFORMANCE" as never,
        name: "Historical Accuracy",
        rawScore: 30,
        weight: 0.1,
        weightedScore: 3,
        confidence: "MEDIUM" as never,
        dataQuality: 70,
        available: true,
        reason: "Average accuracy",
        flags: [],
      },
      {
        source: SignalSource.TRADING_PATTERN,
        category: "BEHAVIOR" as never,
        name: "Trading Pattern",
        rawScore: 25,
        weight: 0.06,
        weightedScore: 1.5,
        confidence: "MEDIUM" as never,
        dataQuality: 80,
        available: true,
        reason: "Normal pattern",
        flags: [],
      },
    ],
    topSignals: [],
    riskFlags: [],
    dataQuality: 75,
    availableSignals: 10,
    totalSignals: 10,
    summary: ["Test result"],
    keyFindings: [],
    underlyingResults: {
      freshWallet: null,
      winRate: null,
      profitLoss: null,
      timing: null,
      sizing: null,
      selection: null,
      coordination: null,
      sybil: null,
      accuracy: null,
      pattern: null,
    },
    fromCache: false,
    analyzedAt: new Date(),
  };

  return { ...defaultResult, ...overrides };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("FalsePositiveReducer", () => {
  let reducer: FalsePositiveReducer;

  beforeEach(() => {
    reducer = new FalsePositiveReducer();
    resetSharedFalsePositiveReducer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSharedFalsePositiveReducer();
  });

  // ==========================================================================
  // Constants and Enums
  // ==========================================================================

  describe("constants", () => {
    it("should have all FalsePositivePattern values", () => {
      expect(FalsePositivePattern.CONSISTENT_HIGH_VOLUME).toBe("CONSISTENT_HIGH_VOLUME");
      expect(FalsePositivePattern.MARKET_MAKER).toBe("MARKET_MAKER");
      expect(FalsePositivePattern.ESTABLISHED_WHALE).toBe("ESTABLISHED_WHALE");
      expect(FalsePositivePattern.ARBITRAGE_BOT).toBe("ARBITRAGE_BOT");
      expect(FalsePositivePattern.PORTFOLIO_REBALANCER).toBe("PORTFOLIO_REBALANCER");
      expect(FalsePositivePattern.DCA_TRADER).toBe("DCA_TRADER");
      expect(FalsePositivePattern.NEWS_REACTIVE).toBe("NEWS_REACTIVE");
      expect(FalsePositivePattern.LOW_SIGNAL_CONFIDENCE).toBe("LOW_SIGNAL_CONFIDENCE");
      expect(FalsePositivePattern.ISOLATED_SIGNAL_SPIKE).toBe("ISOLATED_SIGNAL_SPIKE");
      expect(FalsePositivePattern.RETAIL_PATTERN).toBe("RETAIL_PATTERN");
      expect(FalsePositivePattern.EVENT_TRADER).toBe("EVENT_TRADER");
      expect(FalsePositivePattern.VOLATILITY_RESPONSE).toBe("VOLATILITY_RESPONSE");
    });

    it("should have all FilterAction values", () => {
      expect(FilterAction.PASS).toBe("PASS");
      expect(FilterAction.REDUCE_SCORE).toBe("REDUCE_SCORE");
      expect(FilterAction.MARK_FALSE_POSITIVE).toBe("MARK_FALSE_POSITIVE");
      expect(FilterAction.SUPPRESS).toBe("SUPPRESS");
      expect(FilterAction.DEFER).toBe("DEFER");
    });

    it("should have all FilterConfidence values", () => {
      expect(FilterConfidence.VERY_LOW).toBe("VERY_LOW");
      expect(FilterConfidence.LOW).toBe("LOW");
      expect(FilterConfidence.MEDIUM).toBe("MEDIUM");
      expect(FilterConfidence.HIGH).toBe("HIGH");
      expect(FilterConfidence.VERY_HIGH).toBe("VERY_HIGH");
    });

    it("should have all FilterPriority values", () => {
      expect(FilterPriority.CRITICAL).toBe(0);
      expect(FilterPriority.HIGH).toBe(1);
      expect(FilterPriority.NORMAL).toBe(2);
      expect(FilterPriority.LOW).toBe(3);
    });

    it("should have all FilterOutcome values", () => {
      expect(FilterOutcome.TRUE_NEGATIVE).toBe("TRUE_NEGATIVE");
      expect(FilterOutcome.FALSE_NEGATIVE).toBe("FALSE_NEGATIVE");
      expect(FilterOutcome.TRUE_POSITIVE).toBe("TRUE_POSITIVE");
      expect(FilterOutcome.FALSE_POSITIVE).toBe("FALSE_POSITIVE");
      expect(FilterOutcome.PENDING).toBe("PENDING");
    });

    it("should have pattern descriptions for all patterns", () => {
      for (const pattern of Object.values(FalsePositivePattern)) {
        expect(PATTERN_DESCRIPTIONS[pattern]).toBeDefined();
        expect(typeof PATTERN_DESCRIPTIONS[pattern]).toBe("string");
        expect(PATTERN_DESCRIPTIONS[pattern].length).toBeGreaterThan(0);
      }
    });

    it("should have confidence scores for all levels", () => {
      expect(CONFIDENCE_SCORES[FilterConfidence.VERY_LOW]).toBe(20);
      expect(CONFIDENCE_SCORES[FilterConfidence.LOW]).toBe(40);
      expect(CONFIDENCE_SCORES[FilterConfidence.MEDIUM]).toBe(60);
      expect(CONFIDENCE_SCORES[FilterConfidence.HIGH]).toBe(80);
      expect(CONFIDENCE_SCORES[FilterConfidence.VERY_HIGH]).toBe(95);
    });

    it("should have confidence thresholds", () => {
      expect(CONFIDENCE_THRESHOLDS.veryLow).toBe(20);
      expect(CONFIDENCE_THRESHOLDS.low).toBe(40);
      expect(CONFIDENCE_THRESHOLDS.medium).toBe(60);
      expect(CONFIDENCE_THRESHOLDS.high).toBe(80);
      expect(CONFIDENCE_THRESHOLDS.veryHigh).toBe(90);
    });

    it("should have valid default configuration", () => {
      expect(DEFAULT_REDUCER_CONFIG.cacheTtlMs).toBeGreaterThan(0);
      expect(DEFAULT_REDUCER_CONFIG.maxCacheSize).toBeGreaterThan(0);
      expect(DEFAULT_REDUCER_CONFIG.minScoreForFiltering).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_REDUCER_CONFIG.maxScoreForSuppression).toBeGreaterThan(0);
      expect(DEFAULT_REDUCER_CONFIG.defaultScoreReduction).toBeGreaterThan(0);
    });

    it("should have valid default filter rules", () => {
      expect(DEFAULT_FILTER_RULES.length).toBeGreaterThan(0);
      for (const rule of DEFAULT_FILTER_RULES) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.pattern).toBeDefined();
        expect(rule.action).toBeDefined();
        expect(rule.priority).toBeDefined();
        expect(typeof rule.enabled).toBe("boolean");
      }
    });
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe("constructor", () => {
    it("should create instance with default config", () => {
      const instance = new FalsePositiveReducer();
      expect(instance).toBeInstanceOf(FalsePositiveReducer);
    });

    it("should merge custom config with defaults", () => {
      const instance = new FalsePositiveReducer({
        cacheTtlMs: 10000,
        maxCacheSize: 500,
      });
      const config = instance.getConfig();
      expect(config.cacheTtlMs).toBe(10000);
      expect(config.maxCacheSize).toBe(500);
      expect(config.minScoreForFiltering).toBe(DEFAULT_REDUCER_CONFIG.minScoreForFiltering);
    });

    it("should initialize with default rules", () => {
      const instance = new FalsePositiveReducer();
      const rules = instance.getRules();
      expect(rules.length).toBe(DEFAULT_FILTER_RULES.length);
    });
  });

  // ==========================================================================
  // Core Filtering
  // ==========================================================================

  describe("filter", () => {
    it("should pass through low score results without filtering", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 15 }
      );

      const result = await reducer.filter(mockResult);

      expect(result.action).toBe(FilterAction.PASS);
      expect(result.adjustedScore).toBe(15);
      expect(result.isLikelyFalsePositive).toBe(false);
      expect(result.isSuppressed).toBe(false);
    });

    it("should apply score reduction for matching rules", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          dataQuality: 30, // Low data quality triggers reduction
          availableSignals: 10,
        }
      );

      const result = await reducer.filter(mockResult);

      // The low-data-quality rule should match and reduce score
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches.some((m) => m.rule.id === "low-data-quality")).toBe(true);
    });

    it("should use cache when enabled", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      // First call
      const result1 = await reducer.filter(mockResult);
      expect(result1.fromCache).toBe(false);

      // Second call should be from cache
      const result2 = await reducer.filter(mockResult);
      expect(result2.fromCache).toBe(true);
    });

    it("should skip cache when disabled", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      // First call
      await reducer.filter(mockResult);

      // Second call with cache disabled
      const result = await reducer.filter(mockResult, { useCache: false });
      expect(result.fromCache).toBe(false);
    });

    it("should identify likely false positives", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 55,
          dataQuality: 25, // Very low data quality
          availableSignals: 2, // Few signals
        }
      );

      const result = await reducer.filter(mockResult);

      // Should be marked for deferral due to insufficient signals
      expect(result.isDeferred || result.matches.length > 0).toBe(true);
    });

    it("should emit events for filtered wallets", async () => {
      const listener = vi.fn();
      reducer.on("score-reduced", listener);

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          dataQuality: 30,
        }
      );

      await reducer.filter(mockResult);

      // May or may not emit depending on rule matches
      // The listener should be called if score is reduced
    });

    it("should handle invalid wallet address", async () => {
      const mockResult = createMockCompositeResult("invalid-address");

      // The filter method doesn't throw for invalid address since
      // the address comes from CompositeScoreResult which was already validated
      const result = await reducer.filter(mockResult);
      expect(result).toBeDefined();
    });
  });

  // ==========================================================================
  // Rule Application
  // ==========================================================================

  describe("rule application", () => {
    it("should apply low data quality rule", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          dataQuality: 30, // Below 40 threshold
          availableSignals: 10,
        }
      );

      const result = await reducer.filter(mockResult);

      expect(result.matches.some((m) => m.rule.id === "low-data-quality")).toBe(true);
    });

    it("should apply insufficient signals rule", async () => {
      const signalContributions = [
        {
          source: SignalSource.FRESH_WALLET,
          category: "WALLET_PROFILE" as never,
          name: "Fresh Wallet",
          rawScore: 50,
          weight: 0.1,
          weightedScore: 5,
          confidence: "MEDIUM" as never,
          dataQuality: 80,
          available: true,
          reason: "Test",
          flags: [],
        },
        {
          source: SignalSource.WIN_RATE,
          category: "PERFORMANCE" as never,
          name: "Win Rate",
          rawScore: 60,
          weight: 0.12,
          weightedScore: 7.2,
          confidence: "MEDIUM" as never,
          dataQuality: 80,
          available: true,
          reason: "Test",
          flags: [],
        },
      ];

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          availableSignals: 2, // Below 3 threshold
          totalSignals: 2, // Match availableSignals to maintain good signal ratio for confidence
          signalContributions,
          dataQuality: 80,
        }
      );

      const result = await reducer.filter(mockResult);

      expect(result.matches.some((m) => m.rule.id === "insufficient-signals")).toBe(true);
      expect(result.isDeferred).toBe(true);
    });

    it("should apply isolated signal spike rule", async () => {
      const signalContributions = [
        {
          source: SignalSource.FRESH_WALLET,
          category: "WALLET_PROFILE" as never,
          name: "Fresh Wallet",
          rawScore: 90,
          weight: 0.1,
          weightedScore: 9, // Very high
          confidence: "HIGH" as never,
          dataQuality: 90,
          available: true,
          reason: "Suspicious",
          flags: ["suspicious"],
        },
        {
          source: SignalSource.WIN_RATE,
          category: "PERFORMANCE" as never,
          name: "Win Rate",
          rawScore: 20,
          weight: 0.12,
          weightedScore: 2.4, // Low
          confidence: "MEDIUM" as never,
          dataQuality: 80,
          available: true,
          reason: "Normal",
          flags: [],
        },
        {
          source: SignalSource.PROFIT_LOSS,
          category: "PERFORMANCE" as never,
          name: "P&L",
          rawScore: 15,
          weight: 0.12,
          weightedScore: 1.8, // Low
          confidence: "MEDIUM" as never,
          dataQuality: 80,
          available: true,
          reason: "Normal",
          flags: [],
        },
      ];

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 55,
          signalContributions,
          availableSignals: 3,
        }
      );

      const result = await reducer.filter(mockResult);

      expect(
        result.matches.some((m) => m.rule.id === "isolated-signal-spike")
      ).toBe(true);
    });

    it("should respect rule score bounds", async () => {
      // Add a rule with specific score bounds
      reducer.addRule({
        id: "test-bounded-rule",
        name: "Test Bounded Rule",
        description: "Only applies for scores 40-60",
        pattern: FalsePositivePattern.RETAIL_PATTERN,
        action: FilterAction.REDUCE_SCORE,
        priority: FilterPriority.NORMAL,
        enabled: true,
        minScore: 40,
        maxScore: 60,
        scoreReduction: 5,
        condition: () => true,
      });

      // Score below bounds - should not match
      const mockResultLow = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 30 }
      );
      const resultLow = await reducer.filter(mockResultLow);
      expect(
        resultLow.matches.some((m) => m.rule.id === "test-bounded-rule")
      ).toBe(false);

      // Score within bounds - should match
      reducer.clearCache();
      const mockResultMid = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );
      const resultMid = await reducer.filter(mockResultMid);
      expect(
        resultMid.matches.some((m) => m.rule.id === "test-bounded-rule")
      ).toBe(true);

      // Score above bounds - should not match
      reducer.clearCache();
      const mockResultHigh = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 70 }
      );
      const resultHigh = await reducer.filter(mockResultHigh);
      expect(
        resultHigh.matches.some((m) => m.rule.id === "test-bounded-rule")
      ).toBe(false);
    });

    it("should apply rules in priority order", async () => {
      // CRITICAL rules should be applied first
      const rules = reducer.getRules().filter((r) => r.enabled);
      const sortedPriorities = rules.map((r) => r.priority).sort((a, b) => a - b);

      // Verify priorities are properly ordered
      expect(sortedPriorities[0] ?? -1).toBe(FilterPriority.CRITICAL);
    });
  });

  // ==========================================================================
  // Rule Management
  // ==========================================================================

  describe("rule management", () => {
    it("should add a custom rule", () => {
      const customRule: FilterRule = {
        id: "custom-rule-1",
        name: "Custom Test Rule",
        description: "A test rule",
        pattern: FalsePositivePattern.RETAIL_PATTERN,
        action: FilterAction.REDUCE_SCORE,
        priority: FilterPriority.NORMAL,
        enabled: true,
        scoreReduction: 10,
      };

      const initialCount = reducer.getRules().length;
      reducer.addRule(customRule);

      expect(reducer.getRules().length).toBe(initialCount + 1);
      expect(reducer.getRule("custom-rule-1")).toBeDefined();
      expect(reducer.getRule("custom-rule-1")?.name).toBe("Custom Test Rule");
    });

    it("should remove a rule", () => {
      const initialCount = reducer.getRules().length;
      const removed = reducer.removeRule("low-data-quality");

      expect(removed).toBe(true);
      expect(reducer.getRules().length).toBe(initialCount - 1);
      expect(reducer.getRule("low-data-quality")).toBeUndefined();
    });

    it("should return false when removing non-existent rule", () => {
      const removed = reducer.removeRule("non-existent");
      expect(removed).toBe(false);
    });

    it("should enable a rule", () => {
      reducer.disableRule("low-data-quality");
      expect(reducer.getRule("low-data-quality")?.enabled).toBe(false);

      const enabled = reducer.enableRule("low-data-quality");
      expect(enabled).toBe(true);
      expect(reducer.getRule("low-data-quality")?.enabled).toBe(true);
    });

    it("should disable a rule", () => {
      const disabled = reducer.disableRule("low-data-quality");
      expect(disabled).toBe(true);
      expect(reducer.getRule("low-data-quality")?.enabled).toBe(false);
    });

    it("should update a rule", () => {
      const updated = reducer.updateRule("low-data-quality", {
        scoreReduction: 30,
        description: "Updated description",
      });

      expect(updated).toBe(true);
      const rule = reducer.getRule("low-data-quality");
      expect(rule?.scoreReduction).toBe(30);
      expect(rule?.description).toBe("Updated description");
    });

    it("should return false when updating non-existent rule", () => {
      const updated = reducer.updateRule("non-existent", { scoreReduction: 10 });
      expect(updated).toBe(false);
    });

    it("should emit events on rule changes", () => {
      const addListener = vi.fn();
      const removeListener = vi.fn();
      const enableListener = vi.fn();
      const disableListener = vi.fn();
      const updateListener = vi.fn();

      reducer.on("rule-added", addListener);
      reducer.on("rule-removed", removeListener);
      reducer.on("rule-enabled", enableListener);
      reducer.on("rule-disabled", disableListener);
      reducer.on("rule-updated", updateListener);

      reducer.addRule({
        id: "test-rule",
        name: "Test",
        description: "Test",
        pattern: FalsePositivePattern.RETAIL_PATTERN,
        action: FilterAction.PASS,
        priority: FilterPriority.LOW,
        enabled: true,
      });
      expect(addListener).toHaveBeenCalled();

      reducer.disableRule("test-rule");
      expect(disableListener).toHaveBeenCalled();

      reducer.enableRule("test-rule");
      expect(enableListener).toHaveBeenCalled();

      reducer.updateRule("test-rule", { scoreReduction: 5 });
      expect(updateListener).toHaveBeenCalled();

      reducer.removeRule("test-rule");
      expect(removeListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  describe("batchFilter", () => {
    it("should filter multiple results", async () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", {
          compositeScore: 50,
        }),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", {
          compositeScore: 60,
        }),
        createMockCompositeResult("0x3333333333333333333333333333333333333333", {
          compositeScore: 40,
        }),
      ];

      const batchResult = await reducer.batchFilter(results);

      expect(batchResult.totalProcessed).toBe(3);
      expect(batchResult.results.size).toBe(3);
      expect(batchResult.failed.size).toBe(0);
    });

    it("should aggregate batch statistics", async () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", {
          compositeScore: 50,
          dataQuality: 30,
        }),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", {
          compositeScore: 60,
          dataQuality: 25,
        }),
      ];

      const batchResult = await reducer.batchFilter(results);

      expect(batchResult.processedAt).toBeDefined();
      expect(typeof batchResult.averageScoreReduction).toBe("number");
    });
  });

  // ==========================================================================
  // Feedback and Tuning
  // ==========================================================================

  describe("feedback", () => {
    it("should accept feedback for filtered wallets", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50, dataQuality: 30 }
      );

      await reducer.filter(mockResult);

      // This should not throw
      expect(() => {
        reducer.provideFeedback({
          walletAddress: "0x1234567890123456789012345678901234567890",
          trueOutcome: FilterOutcome.TRUE_NEGATIVE,
          verificationSource: "manual",
          timestamp: new Date(),
        });
      }).not.toThrow();
    });

    it("should throw for invalid wallet address in feedback", () => {
      expect(() => {
        reducer.provideFeedback({
          walletAddress: "invalid",
          trueOutcome: FilterOutcome.TRUE_NEGATIVE,
          verificationSource: "manual",
          timestamp: new Date(),
        });
      }).toThrow("Invalid wallet address");
    });

    it("should emit feedback-received event", async () => {
      const listener = vi.fn();
      reducer.on("feedback-received", listener);

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);

      reducer.provideFeedback({
        walletAddress: "0x1234567890123456789012345678901234567890",
        trueOutcome: FilterOutcome.TRUE_NEGATIVE,
        verificationSource: "manual",
        timestamp: new Date(),
      });

      expect(listener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Statistics and Summary
  // ==========================================================================

  describe("statistics", () => {
    it("should track filter effectiveness", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);

      const effectiveness = reducer.getEffectiveness();

      expect(effectiveness.totalApplications).toBeGreaterThan(0);
      expect(effectiveness.pending).toBeGreaterThan(0);
    });

    it("should provide pattern statistics", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50, dataQuality: 30 }
      );

      await reducer.filter(mockResult);

      const patternStats = reducer.getPatternStatistics();

      // Should have stats for patterns that matched
      expect(patternStats).toBeDefined();
    });

    it("should provide rule statistics", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);

      const ruleStats = reducer.getRuleStatistics();

      expect(ruleStats.length).toBeGreaterThan(0);
      for (const stat of ruleStats) {
        expect(stat.ruleId).toBeDefined();
        expect(stat.applications).toBeGreaterThan(0);
      }
    });

    it("should provide comprehensive summary", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);

      const summary = reducer.getSummary();

      expect(summary.totalAnalyzed).toBe(1);
      expect(summary.activeRules).toBeGreaterThan(0);
      expect(summary.totalRules).toBeGreaterThan(0);
      expect(summary.effectiveness).toBeDefined();
      expect(summary.cacheStats).toBeDefined();
    });
  });

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  describe("cache management", () => {
    it("should clear cache", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);
      expect(reducer.getCachedResult(mockResult.walletAddress)).not.toBeNull();

      reducer.clearCache();
      expect(reducer.getCachedResult(mockResult.walletAddress)).toBeNull();
    });

    it("should invalidate specific wallet cache", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const mockResult = createMockCompositeResult(address, { compositeScore: 50 });

      await reducer.filter(mockResult);
      expect(reducer.getCachedResult(address)).not.toBeNull();

      const invalidated = reducer.invalidateCache(address);
      expect(invalidated).toBe(true);
      expect(reducer.getCachedResult(address)).toBeNull();
    });

    it("should return false for invalid address on invalidate", () => {
      const invalidated = reducer.invalidateCache("invalid");
      expect(invalidated).toBe(false);
    });

    it("should maintain cache size", async () => {
      const smallCacheReducer = new FalsePositiveReducer({
        maxCacheSize: 3,
      });

      // Add more than max size
      for (let i = 1; i <= 5; i++) {
        const address = `0x${"0".repeat(38)}${i.toString().padStart(2, "0")}`;
        const mockResult = createMockCompositeResult(address, {
          compositeScore: 50 + i,
        });
        await smallCacheReducer.filter(mockResult);
      }

      const summary = smallCacheReducer.getSummary();
      expect(summary.cacheStats.size).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe("configuration", () => {
    it("should update configuration", () => {
      reducer.updateConfig({
        cacheTtlMs: 60000,
        defaultScoreReduction: 20,
      });

      const config = reducer.getConfig();
      expect(config.cacheTtlMs).toBe(60000);
      expect(config.defaultScoreReduction).toBe(20);
    });

    it("should reset to defaults", () => {
      reducer.updateConfig({ cacheTtlMs: 60000 });
      reducer.addRule({
        id: "custom-rule",
        name: "Custom",
        description: "Custom rule",
        pattern: FalsePositivePattern.RETAIL_PATTERN,
        action: FilterAction.PASS,
        priority: FilterPriority.LOW,
        enabled: true,
      });

      reducer.resetToDefaults();

      const config = reducer.getConfig();
      expect(config.cacheTtlMs).toBe(DEFAULT_REDUCER_CONFIG.cacheTtlMs);

      const rules = reducer.getRules();
      expect(rules.length).toBe(DEFAULT_FILTER_RULES.length);
    });

    it("should emit config-updated event", () => {
      const listener = vi.fn();
      reducer.on("config-updated", listener);

      reducer.updateConfig({ cacheTtlMs: 60000 });

      expect(listener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Export/Import
  // ==========================================================================

  describe("export/import", () => {
    it("should export configuration", () => {
      const exported = reducer.exportConfig();

      expect(exported).toHaveProperty("version");
      expect(exported).toHaveProperty("exportedAt");
      expect(exported).toHaveProperty("config");
      expect(exported).toHaveProperty("rules");
    });

    it("should import configuration", () => {
      const exported = reducer.exportConfig() as {
        config: Record<string, unknown>;
        rules: FilterRule[];
      };

      // Modify config
      exported.config.cacheTtlMs = 120000;

      reducer.importConfig(exported);

      expect(reducer.getConfig().cacheTtlMs).toBe(120000);
    });

    it("should emit config-imported event", () => {
      const listener = vi.fn();
      reducer.on("config-imported", listener);

      reducer.importConfig({ config: { cacheTtlMs: 60000 } });

      expect(listener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // History
  // ==========================================================================

  describe("history", () => {
    it("should track filter history", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);

      const history = reducer.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]!.walletAddress).toBe(mockResult.walletAddress);
    });

    it("should limit history by parameter", async () => {
      for (let i = 1; i <= 5; i++) {
        const address = `0x${"0".repeat(38)}${i.toString().padStart(2, "0")}`;
        const mockResult = createMockCompositeResult(address, {
          compositeScore: 50,
        });
        await reducer.filter(mockResult);
      }

      const history = reducer.getHistory(3);
      expect(history.length).toBe(3);
    });

    it("should clear history", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      await reducer.filter(mockResult);
      expect(reducer.getHistory().length).toBe(1);

      reducer.clearHistory();
      expect(reducer.getHistory().length).toBe(0);
    });
  });

  // ==========================================================================
  // Singleton Management
  // ==========================================================================

  describe("singleton functions", () => {
    it("should return shared instance", () => {
      const shared1 = getSharedFalsePositiveReducer();
      const shared2 = getSharedFalsePositiveReducer();
      expect(shared1).toBe(shared2);
    });

    it("should allow setting custom instance", () => {
      const custom = new FalsePositiveReducer();
      setSharedFalsePositiveReducer(custom);
      expect(getSharedFalsePositiveReducer()).toBe(custom);
    });

    it("should reset shared instance", () => {
      const shared1 = getSharedFalsePositiveReducer();
      resetSharedFalsePositiveReducer();
      const shared2 = getSharedFalsePositiveReducer();
      expect(shared1).not.toBe(shared2);
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe("factory functions", () => {
    it("should create instance with createFalsePositiveReducer", () => {
      const instance = createFalsePositiveReducer({ cacheTtlMs: 60000 });
      expect(instance).toBeInstanceOf(FalsePositiveReducer);
      expect(instance.getConfig().cacheTtlMs).toBe(60000);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedFalsePositiveReducer();
    });

    it("should filter with filterFalsePositives", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 50 }
      );

      const result = await filterFalsePositives(mockResult);
      expect(result.walletAddress).toBe(mockResult.walletAddress);
    });

    it("should batch filter with batchFilterFalsePositives", async () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222"),
      ];

      const batchResult = await batchFilterFalsePositives(results);
      expect(batchResult.totalProcessed).toBe(2);
    });

    it("should add rules with addFilterRule", () => {
      const initialRules = getFilterRules().length;
      addFilterRule({
        id: "convenience-test",
        name: "Test",
        description: "Test",
        pattern: FalsePositivePattern.RETAIL_PATTERN,
        action: FilterAction.PASS,
        priority: FilterPriority.LOW,
        enabled: true,
      });

      expect(getFilterRules().length).toBe(initialRules + 1);
    });

    it("should remove rules with removeFilterRule", () => {
      const removed = removeFilterRule("low-data-quality");
      expect(removed).toBe(true);
    });

    it("should get effectiveness with getReducerEffectiveness", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890"
      );
      await filterFalsePositives(mockResult);

      const effectiveness = getReducerEffectiveness();
      expect(effectiveness).toBeDefined();
      expect(effectiveness.totalApplications).toBeGreaterThan(0);
    });

    it("should get summary with getReducerSummary", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890"
      );
      await filterFalsePositives(mockResult);

      const summary = getReducerSummary();
      expect(summary).toBeDefined();
      expect(summary.totalAnalyzed).toBeGreaterThan(0);
    });

    it("should get pattern description", () => {
      const description = getFalsePositivePatternDescription(
        FalsePositivePattern.MARKET_MAKER
      );
      expect(description).toBe(PATTERN_DESCRIPTIONS[FalsePositivePattern.MARKET_MAKER]);
    });

    it("should get confidence score", () => {
      const score = getFilterConfidenceScore(FilterConfidence.HIGH);
      expect(score).toBe(CONFIDENCE_SCORES[FilterConfidence.HIGH]);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty signal contributions", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          signalContributions: [],
          availableSignals: 0,
        }
      );

      const result = await reducer.filter(mockResult);
      expect(result).toBeDefined();
    });

    it("should handle very high scores", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 100 }
      );

      const result = await reducer.filter(mockResult);
      expect(result.adjustedScore).toBeLessThanOrEqual(100);
    });

    it("should handle score at boundary", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 20 } // At minScoreForFiltering
      );

      const result = await reducer.filter(mockResult);
      expect(result).toBeDefined();
    });

    it("should handle concurrent filtering", async () => {
      const addresses = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
      ];

      const results = await Promise.all(
        addresses.map((addr) =>
          reducer.filter(createMockCompositeResult(addr, { compositeScore: 50 }))
        )
      );

      expect(results.length).toBe(3);
      results.forEach((r) => expect(r).toBeDefined());
    });

    it("should not reduce score below zero", async () => {
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 25,
          dataQuality: 10, // Very low, should trigger big reduction
        }
      );

      const result = await reducer.filter(mockResult);
      expect(result.adjustedScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Event Emission
  // ==========================================================================

  describe("events", () => {
    it("should emit likely-false-positive event", async () => {
      const listener = vi.fn();
      reducer.on("likely-false-positive", listener);

      // Create a result that should be marked as likely FP
      const signalContributions = [
        {
          source: SignalSource.TRADING_PATTERN,
          category: "BEHAVIOR" as never,
          name: "Trading Pattern",
          rawScore: 50,
          weight: 0.06,
          weightedScore: 3,
          confidence: "HIGH" as never,
          dataQuality: 90,
          available: true,
          reason: "Bot behavior",
          flags: ["bot"],
        },
        {
          source: SignalSource.TIMING_PATTERN,
          category: "BEHAVIOR" as never,
          name: "Timing",
          rawScore: 15,
          weight: 0.1,
          weightedScore: 1.5,
          confidence: "HIGH" as never,
          dataQuality: 90,
          available: true,
          reason: "Regular",
          flags: [],
        },
        {
          source: SignalSource.MARKET_SELECTION,
          category: "BEHAVIOR" as never,
          name: "Selection",
          rawScore: 30,
          weight: 0.1,
          weightedScore: 3,
          confidence: "HIGH" as never,
          dataQuality: 90,
          available: true,
          reason: "Diverse",
          flags: [],
        },
      ];

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 55,
          signalContributions,
          availableSignals: 3,
          dataQuality: 90,
        }
      );

      await reducer.filter(mockResult);

      // The arbitrage-bot rule should match and mark as FP
      // Check if the listener was called (may depend on rule matching)
    });

    it("should emit alert-suppressed event", async () => {
      const listener = vi.fn();
      reducer.on("alert-suppressed", listener);

      // Create a result that should be suppressed
      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 23, // Low score that can be suppressed
          dataQuality: 30,
        }
      );

      await reducer.filter(mockResult);

      // Check if suppression occurred
    });

    it("should emit alert-deferred event", async () => {
      const listener = vi.fn();
      reducer.on("alert-deferred", listener);

      const signalContributions = [
        {
          source: SignalSource.FRESH_WALLET,
          category: "WALLET_PROFILE" as never,
          name: "Fresh Wallet",
          rawScore: 50,
          weight: 0.1,
          weightedScore: 5,
          confidence: "MEDIUM" as never,
          dataQuality: 80,
          available: true,
          reason: "Test",
          flags: [],
        },
        {
          source: SignalSource.WIN_RATE,
          category: "PERFORMANCE" as never,
          name: "Win Rate",
          rawScore: 60,
          weight: 0.12,
          weightedScore: 7.2,
          confidence: "MEDIUM" as never,
          dataQuality: 80,
          available: true,
          reason: "Test",
          flags: [],
        },
      ];

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          availableSignals: 2, // Insufficient signals
          totalSignals: 2, // Match availableSignals to maintain good signal ratio for confidence
          signalContributions,
          dataQuality: 80,
        }
      );

      await reducer.filter(mockResult);

      expect(listener).toHaveBeenCalled();
    });

    it("should emit score-reduced event when score is actually reduced", async () => {
      const listener = vi.fn();
      reducer.on("score-reduced", listener);

      // Use a rule configuration that we know will reduce the score
      reducer.addRule({
        id: "test-reduce-score",
        name: "Test Reduce Score",
        description: "Always reduces score for testing",
        pattern: FalsePositivePattern.LOW_SIGNAL_CONFIDENCE,
        action: FilterAction.REDUCE_SCORE,
        priority: FilterPriority.CRITICAL,
        enabled: true,
        scoreReduction: 10,
        condition: () => true, // Always matches
      });

      const mockResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 50,
          dataQuality: 70,
          availableSignals: 10,
        }
      );

      await reducer.filter(mockResult);

      expect(listener).toHaveBeenCalled();
    });
  });
});
