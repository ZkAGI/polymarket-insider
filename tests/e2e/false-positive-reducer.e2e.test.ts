/**
 * False Positive Reducer E2E Tests (DET-SCORE-004)
 *
 * Integration tests for real-world scenarios with the false positive reducer.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FalsePositiveReducer,
  FalsePositivePattern,
  FilterAction,
  FilterConfidence,
  FilterOutcome,
  type FilterRule,
  type CompositeScoreResult,
  CompositeSuspicionLevel,
  SignalSource,
  resetSharedFalsePositiveReducer,
  createFalsePositiveReducer,
  filterFalsePositives,
  batchFilterFalsePositives,
  getReducerSummary,
  provideFeedbackForTuning,
} from "../../src/detection";

// ============================================================================
// Test Utilities
// ============================================================================

function createMockCompositeResult(
  walletAddress: string,
  overrides: Partial<CompositeScoreResult> = {}
): CompositeScoreResult {
  const defaultSignals = [
    {
      source: SignalSource.FRESH_WALLET,
      category: "WALLET_PROFILE" as never,
      name: "Fresh Wallet",
      rawScore: 30,
      weight: 0.1,
      weightedScore: 3,
      confidence: "MEDIUM" as never,
      dataQuality: 80,
      available: true,
      reason: "Normal",
      flags: [],
    },
    {
      source: SignalSource.WIN_RATE,
      category: "PERFORMANCE" as never,
      name: "Win Rate",
      rawScore: 40,
      weight: 0.12,
      weightedScore: 4.8,
      confidence: "MEDIUM" as never,
      dataQuality: 75,
      available: true,
      reason: "Moderate",
      flags: [],
    },
    {
      source: SignalSource.PROFIT_LOSS,
      category: "PERFORMANCE" as never,
      name: "P&L",
      rawScore: 35,
      weight: 0.12,
      weightedScore: 4.2,
      confidence: "MEDIUM" as never,
      dataQuality: 70,
      available: true,
      reason: "Normal",
      flags: [],
    },
    {
      source: SignalSource.TIMING_PATTERN,
      category: "BEHAVIOR" as never,
      name: "Timing",
      rawScore: 25,
      weight: 0.1,
      weightedScore: 2.5,
      confidence: "MEDIUM" as never,
      dataQuality: 85,
      available: true,
      reason: "Regular",
      flags: [],
    },
    {
      source: SignalSource.POSITION_SIZING,
      category: "BEHAVIOR" as never,
      name: "Sizing",
      rawScore: 30,
      weight: 0.08,
      weightedScore: 2.4,
      confidence: "MEDIUM" as never,
      dataQuality: 80,
      available: true,
      reason: "Normal",
      flags: [],
    },
    {
      source: SignalSource.MARKET_SELECTION,
      category: "BEHAVIOR" as never,
      name: "Selection",
      rawScore: 35,
      weight: 0.1,
      weightedScore: 3.5,
      confidence: "MEDIUM" as never,
      dataQuality: 75,
      available: true,
      reason: "Diverse",
      flags: [],
    },
    {
      source: SignalSource.COORDINATION,
      category: "NETWORK" as never,
      name: "Coordination",
      rawScore: 20,
      weight: 0.12,
      weightedScore: 2.4,
      confidence: "MEDIUM" as never,
      dataQuality: 70,
      available: true,
      reason: "Low",
      flags: [],
    },
    {
      source: SignalSource.SYBIL,
      category: "NETWORK" as never,
      name: "Sybil",
      rawScore: 15,
      weight: 0.1,
      weightedScore: 1.5,
      confidence: "MEDIUM" as never,
      dataQuality: 65,
      available: true,
      reason: "Low risk",
      flags: [],
    },
    {
      source: SignalSource.ACCURACY,
      category: "PERFORMANCE" as never,
      name: "Accuracy",
      rawScore: 30,
      weight: 0.1,
      weightedScore: 3,
      confidence: "MEDIUM" as never,
      dataQuality: 70,
      available: true,
      reason: "Average",
      flags: [],
    },
    {
      source: SignalSource.TRADING_PATTERN,
      category: "BEHAVIOR" as never,
      name: "Pattern",
      rawScore: 25,
      weight: 0.06,
      weightedScore: 1.5,
      confidence: "MEDIUM" as never,
      dataQuality: 80,
      available: true,
      reason: "Normal",
      flags: [],
    },
  ];

  return {
    walletAddress,
    compositeScore: 50,
    suspicionLevel: CompositeSuspicionLevel.MEDIUM,
    shouldFlag: true,
    isPotentialInsider: false,
    categoryBreakdown: [],
    signalContributions: defaultSignals,
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
    ...overrides,
  };
}

// ============================================================================
// E2E Test Suite
// ============================================================================

describe("FalsePositiveReducer E2E Tests", () => {
  let reducer: FalsePositiveReducer;

  beforeEach(() => {
    resetSharedFalsePositiveReducer();
    reducer = createFalsePositiveReducer();
  });

  afterEach(() => {
    resetSharedFalsePositiveReducer();
  });

  // ==========================================================================
  // Real-World Scenario: Market Maker Detection
  // ==========================================================================

  describe("Market Maker Detection Scenario", () => {
    it("should correctly identify market maker pattern", async () => {
      // Market maker characteristics:
      // - Low win rate suspicion (profits from spread, not direction)
      // - Low coordination (independent activity)
      // - Diverse market selection
      const marketMakerResult = createMockCompositeResult(
        "0xaaaa000000000000000000000000000000000001",
        {
          compositeScore: 55,
          signalContributions: [
            {
              source: SignalSource.WIN_RATE,
              category: "PERFORMANCE" as never,
              name: "Win Rate",
              rawScore: 20, // Low - expected for MM
              weight: 0.12,
              weightedScore: 2.4,
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Near 50% win rate",
              flags: [],
            },
            {
              source: SignalSource.COORDINATION,
              category: "NETWORK" as never,
              name: "Coordination",
              rawScore: 15, // Low coordination
              weight: 0.12,
              weightedScore: 1.8,
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Independent trading",
              flags: [],
            },
            {
              source: SignalSource.MARKET_SELECTION,
              category: "BEHAVIOR" as never,
              name: "Selection",
              rawScore: 50, // Diverse markets
              weight: 0.1,
              weightedScore: 5,
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Multiple markets",
              flags: [],
            },
          ],
          dataQuality: 90,
          availableSignals: 3,
          totalSignals: 3, // Match for good confidence ratio
        }
      );

      const result = await reducer.filter(marketMakerResult);

      expect(result.matches.some((m) =>
        m.rule.pattern === FalsePositivePattern.MARKET_MAKER
      )).toBe(true);
      expect(result.adjustedScore).toBeLessThan(55);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Established Whale Detection
  // ==========================================================================

  describe("Established Whale Detection Scenario", () => {
    it("should correctly identify established whale pattern", async () => {
      // Established whale characteristics:
      // - Old wallet (low fresh wallet score)
      // - Large positions (high sizing score)
      const whaleResult = createMockCompositeResult(
        "0xbbbb000000000000000000000000000000000001",
        {
          compositeScore: 60,
          signalContributions: [
            {
              source: SignalSource.FRESH_WALLET,
              category: "WALLET_PROFILE" as never,
              name: "Fresh Wallet",
              rawScore: 10, // Very old wallet
              weight: 0.1,
              weightedScore: 1,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Wallet created 3 years ago",
              flags: [],
            },
            {
              source: SignalSource.POSITION_SIZING,
              category: "BEHAVIOR" as never,
              name: "Sizing",
              rawScore: 75, // Large positions
              weight: 0.08,
              weightedScore: 6,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Large position sizes",
              flags: [],
            },
          ],
          dataQuality: 95,
          availableSignals: 2,
          totalSignals: 2, // Match for good confidence ratio
        }
      );

      const result = await reducer.filter(whaleResult);

      expect(result.matches.some((m) =>
        m.rule.pattern === FalsePositivePattern.ESTABLISHED_WHALE
      )).toBe(true);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Low Data Quality Handling
  // ==========================================================================

  describe("Low Data Quality Handling", () => {
    it("should reduce score for low data quality results", async () => {
      // Configure reducer with lower minimum confidence to allow action on low-quality data
      const lowConfReducer = new FalsePositiveReducer({
        minConfidenceForAction: FilterConfidence.VERY_LOW,
      });

      const lowQualityResult = createMockCompositeResult(
        "0xcccc000000000000000000000000000000000001",
        {
          compositeScore: 65,
          dataQuality: 25, // Very low quality
          availableSignals: 10, // Full signals for good ratio
          totalSignals: 10,
        }
      );

      const result = await lowConfReducer.filter(lowQualityResult);

      expect(result.matches.some((m) =>
        m.rule.id === "low-data-quality"
      )).toBe(true);
      expect(result.adjustedScore).toBeLessThan(65);
      expect(result.scoreReduction).toBeGreaterThan(0);
    });

    it("should defer decision for insufficient signals", async () => {
      const insufficientSignalsResult = createMockCompositeResult(
        "0xdddd000000000000000000000000000000000001",
        {
          compositeScore: 55,
          availableSignals: 2, // Less than 3
          totalSignals: 2, // Match to maintain good confidence ratio
          dataQuality: 80,
          signalContributions: [
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
              reason: "New wallet",
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
              reason: "High win rate",
              flags: [],
            },
          ],
        }
      );

      const result = await reducer.filter(insufficientSignalsResult);

      expect(result.isDeferred).toBe(true);
      expect(result.action).toBe(FilterAction.DEFER);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Isolated Signal Spike
  // ==========================================================================

  describe("Isolated Signal Spike Detection", () => {
    it("should detect and reduce score for isolated high signal", async () => {
      const isolatedSpikeResult = createMockCompositeResult(
        "0xeeee000000000000000000000000000000000001",
        {
          compositeScore: 60,
          signalContributions: [
            {
              source: SignalSource.ACCURACY,
              category: "PERFORMANCE" as never,
              name: "Accuracy",
              rawScore: 95, // Very high
              weight: 0.1,
              weightedScore: 9.5, // Dominates
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Perfect accuracy",
              flags: [],
            },
            {
              source: SignalSource.WIN_RATE,
              category: "PERFORMANCE" as never,
              name: "Win Rate",
              rawScore: 25,
              weight: 0.12,
              weightedScore: 3, // Normal
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Normal",
              flags: [],
            },
            {
              source: SignalSource.TIMING_PATTERN,
              category: "BEHAVIOR" as never,
              name: "Timing",
              rawScore: 20,
              weight: 0.1,
              weightedScore: 2, // Normal
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Normal",
              flags: [],
            },
          ],
          dataQuality: 90,
          availableSignals: 3,
          totalSignals: 3, // Match for good confidence ratio
        }
      );

      const result = await reducer.filter(isolatedSpikeResult);

      expect(result.matches.some((m) =>
        m.rule.pattern === FalsePositivePattern.ISOLATED_SIGNAL_SPIKE
      )).toBe(true);
      expect(result.adjustedScore).toBeLessThan(60);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Batch Processing
  // ==========================================================================

  describe("Batch Processing Scenarios", () => {
    it("should efficiently process multiple wallets", async () => {
      const wallets = [];
      for (let i = 1; i <= 20; i++) {
        const addr = `0x${i.toString(16).padStart(40, "0")}`;
        wallets.push(
          createMockCompositeResult(addr, {
            compositeScore: 40 + Math.floor(Math.random() * 30),
            dataQuality: 50 + Math.floor(Math.random() * 40),
          })
        );
      }

      const startTime = Date.now();
      const batchResult = await reducer.batchFilter(wallets);
      const endTime = Date.now();

      expect(batchResult.totalProcessed).toBe(20);
      expect(batchResult.results.size).toBe(20);
      expect(batchResult.failed.size).toBe(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should be fast
    });

    it("should aggregate batch statistics correctly", async () => {
      // Use reducer with lower confidence requirement to ensure rules trigger
      const batchReducer = new FalsePositiveReducer({
        minConfidenceForAction: FilterConfidence.VERY_LOW,
      });

      const wallets = [
        createMockCompositeResult("0x0000000000000000000000000000000000000001", {
          compositeScore: 50,
          dataQuality: 30, // Will trigger reduction
          availableSignals: 10,
          totalSignals: 10,
        }),
        createMockCompositeResult("0x0000000000000000000000000000000000000002", {
          compositeScore: 60,
          dataQuality: 30, // Will trigger reduction
          availableSignals: 10,
          totalSignals: 10,
        }),
        createMockCompositeResult("0x0000000000000000000000000000000000000003", {
          compositeScore: 25,
          dataQuality: 90, // Won't trigger reduction (below minScoreForFiltering)
          availableSignals: 10,
          totalSignals: 10,
        }),
      ];

      const batchResult = await batchReducer.batchFilter(wallets);

      expect(batchResult.totalProcessed).toBe(3);
      expect(batchResult.averageScoreReduction).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Feedback Loop
  // ==========================================================================

  describe("Feedback Loop Scenarios", () => {
    it("should accept and track feedback", async () => {
      // Use reducer with lower confidence requirement to ensure rules trigger
      const feedbackReducer = new FalsePositiveReducer({
        minConfidenceForAction: FilterConfidence.VERY_LOW,
      });

      // Use a properly formatted 40-char hex address (0x + 40 hex chars)
      const wallet = "0xfeedba00000000000000000000000000000000c1";
      const result = createMockCompositeResult(wallet, {
        compositeScore: 55,
        dataQuality: 35, // Low enough to trigger low-data-quality rule
        availableSignals: 10,
        totalSignals: 10,
      });

      // Filter the result and ensure it's added to history
      const filterResult = await feedbackReducer.filter(result);

      // Verify filter processed the result
      expect(filterResult.walletAddress).toBeDefined();

      // Provide feedback
      feedbackReducer.provideFeedback({
        walletAddress: wallet,
        trueOutcome: FilterOutcome.TRUE_NEGATIVE,
        verificationSource: "manual-review",
        timestamp: new Date(),
        notes: "Confirmed legitimate trader",
      });

      // Check that history has at least one entry with feedback
      const history = feedbackReducer.getHistory();
      const entryWithFeedback = history.find((h) => h.feedback !== undefined);
      expect(entryWithFeedback).toBeDefined();
      expect(entryWithFeedback?.feedback?.trueOutcome).toBe(FilterOutcome.TRUE_NEGATIVE);
    });

    it("should track multiple feedbacks for effectiveness metrics", async () => {
      // Process multiple wallets
      const wallets = [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
        "0x0000000000000000000000000000000000000003",
      ];

      for (const wallet of wallets) {
        await reducer.filter(
          createMockCompositeResult(wallet, {
            compositeScore: 55,
            dataQuality: 35,
          })
        );
      }

      // Provide feedback
      reducer.provideFeedback({
        walletAddress: wallets[0]!,
        trueOutcome: FilterOutcome.TRUE_NEGATIVE,
        verificationSource: "manual",
        timestamp: new Date(),
      });

      reducer.provideFeedback({
        walletAddress: wallets[1]!,
        trueOutcome: FilterOutcome.FALSE_NEGATIVE,
        verificationSource: "manual",
        timestamp: new Date(),
      });

      reducer.provideFeedback({
        walletAddress: wallets[2]!,
        trueOutcome: FilterOutcome.TRUE_POSITIVE,
        verificationSource: "manual",
        timestamp: new Date(),
      });

      const effectiveness = reducer.getEffectiveness();
      expect(effectiveness.trueNegatives).toBe(1);
      expect(effectiveness.falseNegatives).toBe(1);
      expect(effectiveness.truePositives).toBe(1);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Custom Rules
  // ==========================================================================

  describe("Custom Rule Scenarios", () => {
    it("should apply custom rules correctly", async () => {
      // Add a custom rule for detecting specific pattern
      reducer.addRule({
        id: "high-accuracy-whale",
        name: "High Accuracy Whale",
        description: "Detects whales with unusually high accuracy",
        pattern: FalsePositivePattern.ESTABLISHED_WHALE,
        action: FilterAction.REDUCE_SCORE,
        priority: 1,
        enabled: true,
        minScore: 50,
        maxScore: 80,
        scoreReduction: 15,
        condition: (result) => {
          const accuracySignal = result.signalContributions.find(
            (s) => s.source === SignalSource.ACCURACY
          );
          const sizingSignal = result.signalContributions.find(
            (s) => s.source === SignalSource.POSITION_SIZING
          );
          return (
            accuracySignal?.available === true &&
            accuracySignal.rawScore > 70 &&
            sizingSignal?.available === true &&
            sizingSignal.rawScore > 60
          );
        },
      });

      const whaleResult = createMockCompositeResult(
        "0xaccc0000000000000000000000000000000001",
        {
          compositeScore: 65,
          signalContributions: [
            {
              source: SignalSource.ACCURACY,
              category: "PERFORMANCE" as never,
              name: "Accuracy",
              rawScore: 80,
              weight: 0.1,
              weightedScore: 8,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "High accuracy",
              flags: [],
            },
            {
              source: SignalSource.POSITION_SIZING,
              category: "BEHAVIOR" as never,
              name: "Sizing",
              rawScore: 70,
              weight: 0.08,
              weightedScore: 5.6,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Large positions",
              flags: [],
            },
          ],
          dataQuality: 95,
          availableSignals: 2,
          totalSignals: 2,
        }
      );

      const result = await reducer.filter(whaleResult);

      expect(result.matches.some((m) => m.rule.id === "high-accuracy-whale")).toBe(
        true
      );
      expect(result.adjustedScore).toBeLessThan(65);
    });

    it("should allow enabling/disabling rules dynamically", async () => {
      const wallet = "0xffff000000000000000000000000000000000001";
      const result = createMockCompositeResult(wallet, {
        compositeScore: 55,
        dataQuality: 35,
      });

      // Filter with low-data-quality enabled
      const result1 = await reducer.filter(result);
      const hasLowDataQualityMatch1 = result1.matches.some(
        (m) => m.rule.id === "low-data-quality"
      );

      // Disable the rule
      reducer.disableRule("low-data-quality");
      reducer.clearCache();

      // Filter again
      const result2 = await reducer.filter(result);
      const hasLowDataQualityMatch2 = result2.matches.some(
        (m) => m.rule.id === "low-data-quality"
      );

      expect(hasLowDataQualityMatch1).toBe(true);
      expect(hasLowDataQualityMatch2).toBe(false);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Retail Trader Pattern
  // ==========================================================================

  describe("Retail Trader Pattern Scenarios", () => {
    it("should detect typical retail patterns", async () => {
      const retailResult = createMockCompositeResult(
        "0x1111000000000000000000000000000000000001",
        {
          compositeScore: 45,
          signalContributions: [
            {
              source: SignalSource.POSITION_SIZING,
              category: "BEHAVIOR" as never,
              name: "Sizing",
              rawScore: 20, // Small positions
              weight: 0.08,
              weightedScore: 1.6,
              confidence: "MEDIUM" as never,
              dataQuality: 80,
              available: true,
              reason: "Small positions",
              flags: [],
            },
            {
              source: SignalSource.ACCURACY,
              category: "PERFORMANCE" as never,
              name: "Accuracy",
              rawScore: 35, // Average accuracy
              weight: 0.1,
              weightedScore: 3.5,
              confidence: "MEDIUM" as never,
              dataQuality: 80,
              available: true,
              reason: "Average",
              flags: [],
            },
          ],
          dataQuality: 80,
          availableSignals: 2,
          totalSignals: 2, // Match for good confidence ratio
        }
      );

      const result = await reducer.filter(retailResult);

      expect(result.matches.some((m) =>
        m.rule.pattern === FalsePositivePattern.RETAIL_PATTERN
      )).toBe(true);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Configuration Persistence
  // ==========================================================================

  describe("Configuration Persistence Scenarios", () => {
    it("should export and import configuration correctly", async () => {
      // Customize configuration
      reducer.updateConfig({ cacheTtlMs: 120000 });
      reducer.addRule({
        id: "custom-export-test",
        name: "Export Test",
        description: "Test rule for export",
        pattern: FalsePositivePattern.RETAIL_PATTERN,
        action: FilterAction.REDUCE_SCORE,
        priority: 2,
        enabled: true,
        scoreReduction: 5,
      });

      // Export
      const exported = reducer.exportConfig();

      // Create new reducer
      const newReducer = createFalsePositiveReducer();

      // Import
      newReducer.importConfig(exported as { config?: Record<string, unknown>; rules?: FilterRule[] });

      // Verify
      expect(newReducer.getConfig().cacheTtlMs).toBe(120000);
      expect(newReducer.getRule("custom-export-test")).toBeDefined();
    });

    it("should reset to defaults correctly", async () => {
      // Modify configuration
      reducer.updateConfig({ cacheTtlMs: 999999 });
      reducer.addRule({
        id: "will-be-removed",
        name: "Temporary",
        description: "Will be removed on reset",
        pattern: FalsePositivePattern.DCA_TRADER,
        action: FilterAction.PASS,
        priority: 3,
        enabled: true,
      });

      // Reset
      reducer.resetToDefaults();

      // Verify
      expect(reducer.getConfig().cacheTtlMs).not.toBe(999999);
      expect(reducer.getRule("will-be-removed")).toBeUndefined();
    });
  });

  // ==========================================================================
  // Real-World Scenario: DCA Trader Detection
  // ==========================================================================

  describe("DCA Trader Detection Scenarios", () => {
    it("should detect DCA trading pattern", async () => {
      const dcaResult = createMockCompositeResult(
        "0x2222000000000000000000000000000000000001",
        {
          compositeScore: 40,
          signalContributions: [
            {
              source: SignalSource.TIMING_PATTERN,
              category: "BEHAVIOR" as never,
              name: "Timing",
              rawScore: 15, // Very regular timing
              weight: 0.1,
              weightedScore: 1.5,
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Weekly consistent",
              flags: [],
            },
            {
              source: SignalSource.POSITION_SIZING,
              category: "BEHAVIOR" as never,
              name: "Sizing",
              rawScore: 10, // Consistent small sizes
              weight: 0.08,
              weightedScore: 0.8,
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Fixed amounts",
              flags: [],
            },
          ],
          dataQuality: 90,
          availableSignals: 2,
          totalSignals: 2, // Match for good confidence ratio
        }
      );

      const result = await reducer.filter(dcaResult);

      expect(result.matches.some((m) =>
        m.rule.pattern === FalsePositivePattern.DCA_TRADER
      )).toBe(true);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Summary and Statistics
  // ==========================================================================

  describe("Summary and Statistics Scenarios", () => {
    it("should provide accurate summary after multiple operations", async () => {
      // Process multiple wallets
      for (let i = 1; i <= 10; i++) {
        const addr = `0x${i.toString(16).padStart(40, "0")}`;
        await reducer.filter(
          createMockCompositeResult(addr, {
            compositeScore: 40 + i * 3,
            dataQuality: 30 + i * 5,
          })
        );
      }

      const summary = reducer.getSummary();

      expect(summary.totalAnalyzed).toBe(10);
      expect(summary.activeRules).toBeGreaterThan(0);
      expect(summary.patternStats.length).toBeGreaterThan(0);
      expect(summary.ruleStats.length).toBeGreaterThan(0);
      expect(summary.cacheStats.size).toBeGreaterThan(0);
    });

    it("should track pattern statistics correctly", async () => {
      // Process wallets that trigger specific patterns
      for (let i = 0; i < 5; i++) {
        const addr = `0x${(100 + i).toString(16).padStart(40, "0")}`;
        await reducer.filter(
          createMockCompositeResult(addr, {
            compositeScore: 55,
            dataQuality: 30, // Triggers low-data-quality
          })
        );
      }

      const patternStats = reducer.getPatternStatistics();
      const lowConfidenceStats = patternStats.find(
        (s) => s.pattern === FalsePositivePattern.LOW_SIGNAL_CONFIDENCE
      );

      expect(lowConfidenceStats).toBeDefined();
      expect(lowConfidenceStats?.matchCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Convenience Functions
  // ==========================================================================

  describe("Convenience Functions Integration", () => {
    beforeEach(() => {
      resetSharedFalsePositiveReducer();
    });

    it("should work with filterFalsePositives convenience function", async () => {
      const result = await filterFalsePositives(
        createMockCompositeResult("0x1234567890123456789012345678901234567890", {
          compositeScore: 55,
          dataQuality: 35,
        })
      );

      expect(result).toBeDefined();
      expect(result.walletAddress).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should work with batchFilterFalsePositives convenience function", async () => {
      const results = await batchFilterFalsePositives([
        createMockCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222"),
      ]);

      expect(results.totalProcessed).toBe(2);
    });

    it("should work with getReducerSummary convenience function", async () => {
      await filterFalsePositives(
        createMockCompositeResult("0x1234567890123456789012345678901234567890")
      );

      const summary = getReducerSummary();
      expect(summary.totalAnalyzed).toBeGreaterThan(0);
    });

    it("should work with provideFeedbackForTuning convenience function", async () => {
      const wallet = "0x1234567890123456789012345678901234567890";
      await filterFalsePositives(createMockCompositeResult(wallet));

      expect(() => {
        provideFeedbackForTuning({
          walletAddress: wallet,
          trueOutcome: FilterOutcome.TRUE_NEGATIVE,
          verificationSource: "test",
          timestamp: new Date(),
        });
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Real-World Scenario: High Volume Processing
  // ==========================================================================

  describe("High Volume Processing", () => {
    it("should handle 100 wallets efficiently", async () => {
      const wallets = [];
      for (let i = 1; i <= 100; i++) {
        wallets.push(
          createMockCompositeResult(
            `0x${i.toString(16).padStart(40, "0")}`,
            {
              compositeScore: 30 + (i % 50),
              dataQuality: 40 + (i % 50),
            }
          )
        );
      }

      const startTime = Date.now();
      const result = await reducer.batchFilter(wallets);
      const endTime = Date.now();

      expect(result.totalProcessed).toBe(100);
      expect(result.failed.size).toBe(0);
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Cache Behavior
  // ==========================================================================

  describe("Cache Behavior", () => {
    it("should correctly use cache for repeated requests", async () => {
      const wallet = "0x3333000000000000000000000000000000000001";
      const mockResult = createMockCompositeResult(wallet, {
        compositeScore: 55,
        dataQuality: 35,
      });

      // First request - should not be from cache
      const result1 = await reducer.filter(mockResult);
      expect(result1.fromCache).toBe(false);

      // Second request - should be from cache
      const result2 = await reducer.filter(mockResult);
      expect(result2.fromCache).toBe(true);

      // Same results
      expect(result1.adjustedScore).toBe(result2.adjustedScore);
      expect(result1.action).toBe(result2.action);
    });

    it("should respect cache bypass option", async () => {
      const wallet = "0x4444000000000000000000000000000000000001";
      const mockResult = createMockCompositeResult(wallet, {
        compositeScore: 55,
        dataQuality: 35,
      });

      // First request
      await reducer.filter(mockResult);

      // Second request with cache bypass
      const result = await reducer.filter(mockResult, { useCache: false });
      expect(result.fromCache).toBe(false);
    });
  });

  // ==========================================================================
  // Real-World Scenario: Arbitrage Bot Detection
  // ==========================================================================

  describe("Arbitrage Bot Detection", () => {
    it("should detect arbitrage bot patterns", async () => {
      const botResult = createMockCompositeResult(
        "0x5555000000000000000000000000000000000001",
        {
          compositeScore: 60,
          signalContributions: [
            {
              source: SignalSource.TRADING_PATTERN,
              category: "BEHAVIOR" as never,
              name: "Trading Pattern",
              rawScore: 60,
              weight: 0.06,
              weightedScore: 3.6,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Bot pattern detected",
              flags: ["bot", "automated"],
            },
            {
              source: SignalSource.TIMING_PATTERN,
              category: "BEHAVIOR" as never,
              name: "Timing",
              rawScore: 10, // Very consistent
              weight: 0.1,
              weightedScore: 1,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Millisecond precision",
              flags: [],
            },
            {
              source: SignalSource.MARKET_SELECTION,
              category: "BEHAVIOR" as never,
              name: "Selection",
              rawScore: 40,
              weight: 0.1,
              weightedScore: 4,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Cross-market",
              flags: [],
            },
          ],
          dataQuality: 95,
          availableSignals: 3,
          totalSignals: 3, // Match availableSignals for good confidence ratio
        }
      );

      const result = await reducer.filter(botResult);

      expect(result.matches.some((m) =>
        m.rule.pattern === FalsePositivePattern.ARBITRAGE_BOT
      )).toBe(true);
      expect(result.isLikelyFalsePositive).toBe(true);
    });
  });
});
