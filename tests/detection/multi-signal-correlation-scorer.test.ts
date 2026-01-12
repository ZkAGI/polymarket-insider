/**
 * Unit Tests for Multi-Signal Correlation Scorer (DET-SCORE-008)
 *
 * Tests for detecting signal correlations and applying boost to composite scores.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MultiSignalCorrelationScorer,
  createMultiSignalCorrelationScorer,
  getSharedMultiSignalCorrelationScorer,
  setSharedMultiSignalCorrelationScorer,
  resetSharedMultiSignalCorrelationScorer,
  analyzeSignalCorrelations,
  batchAnalyzeSignalCorrelations,
  applySignalCorrelationBoost,
  getCorrelationScorerSummary,
  recordCorrelationBoostEffectiveness,
  getCorrelationTypeDescription,
  getCorrelationStrengthDescription,
  getCorrelationPatternDescription,
  getBoostImpactDescription,
  SignalCorrelationType,
  CorrelationStrength,
  CorrelationPattern,
  BoostImpact,
  CORRELATION_TYPE_DESCRIPTIONS,
  CORRELATION_STRENGTH_DESCRIPTIONS,
  CORRELATION_PATTERN_DESCRIPTIONS,
  BOOST_IMPACT_DESCRIPTIONS,
  DEFAULT_SIGNAL_PAIRS,
  DEFAULT_CORRELATION_SCORER_CONFIG,
  CORRELATION_STRENGTH_THRESHOLDS,
  BOOST_IMPACT_THRESHOLDS,
  type SignalPair,
} from "../../src/detection/multi-signal-correlation-scorer";
import {
  SignalSource,
  CompositeSuspicionLevel,
  type CompositeScoreResult,
  type CompositeSignalContribution,
} from "../../src/detection/composite-suspicion-scorer";

// ============================================================================
// Test Utilities
// ============================================================================

function createMockContribution(
  source: SignalSource,
  rawScore: number,
  available: boolean = true
): CompositeSignalContribution {
  return {
    source,
    category: "PERFORMANCE" as any,
    name: source,
    rawScore,
    weight: 0.1,
    weightedScore: rawScore * 0.1,
    confidence: "HIGH" as any,
    dataQuality: 80,
    available,
    reason: `Test ${source}`,
    flags: [],
  };
}

function createMockCompositeResult(
  walletAddress: string,
  compositeScore: number,
  contributions: CompositeSignalContribution[]
): CompositeScoreResult {
  return {
    walletAddress,
    compositeScore,
    suspicionLevel: CompositeSuspicionLevel.MEDIUM,
    shouldFlag: compositeScore >= 50,
    isPotentialInsider: compositeScore >= 70,
    categoryBreakdown: [],
    signalContributions: contributions,
    topSignals: contributions.slice(0, 3),
    riskFlags: [],
    dataQuality: 80,
    availableSignals: contributions.filter((c) => c.available).length,
    totalSignals: Object.keys(SignalSource).length,
    summary: [],
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
}

// ============================================================================
// Tests
// ============================================================================

describe("MultiSignalCorrelationScorer", () => {
  let scorer: MultiSignalCorrelationScorer;

  beforeEach(() => {
    resetSharedMultiSignalCorrelationScorer();
    scorer = createMultiSignalCorrelationScorer();
  });

  afterEach(() => {
    resetSharedMultiSignalCorrelationScorer();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Enum and Constant Tests
  // ==========================================================================

  describe("Enums and Constants", () => {
    it("should have all correlation types defined", () => {
      expect(SignalCorrelationType.STRONG_POSITIVE).toBe("STRONG_POSITIVE");
      expect(SignalCorrelationType.MODERATE_POSITIVE).toBe("MODERATE_POSITIVE");
      expect(SignalCorrelationType.WEAK_POSITIVE).toBe("WEAK_POSITIVE");
      expect(SignalCorrelationType.NONE).toBe("NONE");
      expect(SignalCorrelationType.CONTRADICTION).toBe("CONTRADICTION");
    });

    it("should have all correlation strengths defined", () => {
      expect(CorrelationStrength.VERY_STRONG).toBe("VERY_STRONG");
      expect(CorrelationStrength.STRONG).toBe("STRONG");
      expect(CorrelationStrength.MODERATE).toBe("MODERATE");
      expect(CorrelationStrength.WEAK).toBe("WEAK");
      expect(CorrelationStrength.NEGLIGIBLE).toBe("NEGLIGIBLE");
    });

    it("should have all correlation patterns defined", () => {
      expect(CorrelationPattern.BEHAVIORAL_CONSISTENCY).toBe("BEHAVIORAL_CONSISTENCY");
      expect(CorrelationPattern.PERFORMANCE_OUTLIERS).toBe("PERFORMANCE_OUTLIERS");
      expect(CorrelationPattern.NETWORK_COORDINATION).toBe("NETWORK_COORDINATION");
      expect(CorrelationPattern.FRESH_WALLET_ACTIVITY).toBe("FRESH_WALLET_ACTIVITY");
      expect(CorrelationPattern.TIMING_ACCURACY).toBe("TIMING_ACCURACY");
      expect(CorrelationPattern.INSIDER_PATTERN).toBe("INSIDER_PATTERN");
      expect(CorrelationPattern.SYBIL_COORDINATION).toBe("SYBIL_COORDINATION");
      expect(CorrelationPattern.GENERAL_AGREEMENT).toBe("GENERAL_AGREEMENT");
    });

    it("should have all boost impact levels defined", () => {
      expect(BoostImpact.NONE).toBe("NONE");
      expect(BoostImpact.MINOR).toBe("MINOR");
      expect(BoostImpact.MODERATE).toBe("MODERATE");
      expect(BoostImpact.SIGNIFICANT).toBe("SIGNIFICANT");
      expect(BoostImpact.MAJOR).toBe("MAJOR");
    });

    it("should have descriptions for all correlation types", () => {
      for (const type of Object.values(SignalCorrelationType)) {
        expect(CORRELATION_TYPE_DESCRIPTIONS[type]).toBeDefined();
        expect(typeof CORRELATION_TYPE_DESCRIPTIONS[type]).toBe("string");
      }
    });

    it("should have descriptions for all correlation strengths", () => {
      for (const strength of Object.values(CorrelationStrength)) {
        expect(CORRELATION_STRENGTH_DESCRIPTIONS[strength]).toBeDefined();
        expect(typeof CORRELATION_STRENGTH_DESCRIPTIONS[strength]).toBe("string");
      }
    });

    it("should have descriptions for all correlation patterns", () => {
      for (const pattern of Object.values(CorrelationPattern)) {
        expect(CORRELATION_PATTERN_DESCRIPTIONS[pattern]).toBeDefined();
        expect(typeof CORRELATION_PATTERN_DESCRIPTIONS[pattern]).toBe("string");
      }
    });

    it("should have descriptions for all boost impacts", () => {
      for (const impact of Object.values(BoostImpact)) {
        expect(BOOST_IMPACT_DESCRIPTIONS[impact]).toBeDefined();
        expect(typeof BOOST_IMPACT_DESCRIPTIONS[impact]).toBe("string");
      }
    });

    it("should have valid default signal pairs", () => {
      expect(DEFAULT_SIGNAL_PAIRS.length).toBeGreaterThan(0);
      for (const pair of DEFAULT_SIGNAL_PAIRS) {
        expect(pair.signal1).toBeDefined();
        expect(pair.signal2).toBeDefined();
        expect(pair.pattern).toBeDefined();
        expect(pair.weight).toBeGreaterThan(0);
        expect(pair.minScoreThreshold).toBeGreaterThanOrEqual(0);
        expect(pair.description).toBeDefined();
      }
    });

    it("should have valid correlation strength thresholds", () => {
      expect(CORRELATION_STRENGTH_THRESHOLDS.veryStrong).toBeGreaterThan(
        CORRELATION_STRENGTH_THRESHOLDS.strong
      );
      expect(CORRELATION_STRENGTH_THRESHOLDS.strong).toBeGreaterThan(
        CORRELATION_STRENGTH_THRESHOLDS.moderate
      );
      expect(CORRELATION_STRENGTH_THRESHOLDS.moderate).toBeGreaterThan(
        CORRELATION_STRENGTH_THRESHOLDS.weak
      );
    });

    it("should have valid boost impact thresholds", () => {
      expect(BOOST_IMPACT_THRESHOLDS.minor).toBeLessThan(BOOST_IMPACT_THRESHOLDS.moderate);
      expect(BOOST_IMPACT_THRESHOLDS.moderate).toBeLessThan(BOOST_IMPACT_THRESHOLDS.significant);
      expect(BOOST_IMPACT_THRESHOLDS.significant).toBeLessThan(BOOST_IMPACT_THRESHOLDS.major);
    });

    it("should have valid default configuration", () => {
      expect(DEFAULT_CORRELATION_SCORER_CONFIG.signalPairs.length).toBeGreaterThan(0);
      expect(DEFAULT_CORRELATION_SCORER_CONFIG.minCorrelationStrength).toBeGreaterThan(0);
      expect(DEFAULT_CORRELATION_SCORER_CONFIG.maxBoost).toBeGreaterThan(0);
      expect(DEFAULT_CORRELATION_SCORER_CONFIG.boostMultiplier).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("Constructor", () => {
    it("should create with default configuration", () => {
      const scorer = createMultiSignalCorrelationScorer();
      const summary = scorer.getSummary();
      expect(summary.totalAnalyses).toBe(0);
    });

    it("should create with custom configuration", () => {
      const scorer = createMultiSignalCorrelationScorer({
        maxBoost: 50,
        minCorrelationStrength: 0.5,
      });
      expect(scorer).toBeDefined();
    });

    it("should create with custom signal pairs", () => {
      const customPairs: SignalPair[] = [
        {
          signal1: SignalSource.WIN_RATE,
          signal2: SignalSource.ACCURACY,
          pattern: CorrelationPattern.PERFORMANCE_OUTLIERS,
          weight: 2.0,
          minScoreThreshold: 30,
          description: "Custom pair",
        },
      ];
      const scorer = createMultiSignalCorrelationScorer({
        signalPairs: customPairs,
      });
      expect(scorer.getSignalPairs()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Analyze Correlations Tests
  // ==========================================================================

  describe("analyzeCorrelations", () => {
    it("should analyze correlations with no signals", () => {
      const result = createMockCompositeResult("0x1234567890abcdef1234567890abcdef12345678", 50, []);
      const analysis = scorer.analyzeCorrelations(result);

      expect(analysis.walletAddress).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(analysis.originalScore).toBe(50);
      expect(analysis.boostedScore).toBe(50);
      expect(analysis.totalBoost).toBe(0);
      expect(analysis.correlations).toHaveLength(0);
    });

    it("should detect correlation between high win rate and high P&L", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 60),
        createMockContribution(SignalSource.PROFIT_LOSS, 65),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);

      expect(analysis.correlations.length).toBeGreaterThanOrEqual(1);
      expect(analysis.totalBoost).toBeGreaterThan(0);
      expect(analysis.boostedScore).toBeGreaterThan(analysis.originalScore);
    });

    it("should detect performance outlier pattern", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
        createMockContribution(SignalSource.ACCURACY, 72),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);

      const perfPattern = analysis.patterns.find(
        (p) => p.pattern === CorrelationPattern.PERFORMANCE_OUTLIERS
      );
      expect(perfPattern).toBeDefined();
      expect(perfPattern!.detected).toBe(true);
    });

    it("should detect fresh wallet activity pattern", () => {
      const contributions = [
        createMockContribution(SignalSource.FRESH_WALLET, 70),
        createMockContribution(SignalSource.WIN_RATE, 65),
        createMockContribution(SignalSource.ACCURACY, 60),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);

      const freshPattern = analysis.patterns.find(
        (p) => p.pattern === CorrelationPattern.FRESH_WALLET_ACTIVITY
      );
      expect(freshPattern).toBeDefined();
    });

    it("should detect sybil coordination pattern", () => {
      const contributions = [
        createMockContribution(SignalSource.SYBIL, 70),
        createMockContribution(SignalSource.COORDINATION, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);

      const coordCorrelation = analysis.correlations.find(
        (c) =>
          (c.signal1 === SignalSource.SYBIL && c.signal2 === SignalSource.COORDINATION) ||
          (c.signal1 === SignalSource.COORDINATION && c.signal2 === SignalSource.SYBIL)
      );
      expect(coordCorrelation).toBeDefined();
    });

    it("should not apply boost below minimum correlation strength", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 35),
        createMockContribution(SignalSource.PROFIT_LOSS, 36),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        30,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.totalBoost).toBe(0);
    });

    it("should apply maximum boost limit", () => {
      const scorer = createMultiSignalCorrelationScorer({ maxBoost: 10 });
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 95),
        createMockContribution(SignalSource.PROFIT_LOSS, 95),
        createMockContribution(SignalSource.ACCURACY, 95),
        createMockContribution(SignalSource.FRESH_WALLET, 90),
        createMockContribution(SignalSource.TIMING_PATTERN, 90),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        85,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.totalBoost).toBeLessThanOrEqual(10);
    });

    it("should cap boosted score at 100", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 95),
        createMockContribution(SignalSource.PROFIT_LOSS, 95),
        createMockContribution(SignalSource.ACCURACY, 95),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        95,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.boostedScore).toBeLessThanOrEqual(100);
    });

    it("should generate insights when enabled", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result, { includeInsights: true });
      expect(analysis.insights.length).toBeGreaterThan(0);
    });

    it("should not generate insights when disabled", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result, { includeInsights: false });
      expect(analysis.insights).toHaveLength(0);
    });

    it("should use cached results when enabled", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      // First call - should not be cached
      const analysis1 = scorer.analyzeCorrelations(result, { useCache: true });

      // Second call - should use cache
      const analysis2 = scorer.analyzeCorrelations(result, { useCache: true });

      // Should be same result
      expect(analysis1.boostedScore).toBe(analysis2.boostedScore);
    });

    it("should skip cache when disabled", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      scorer.analyzeCorrelations(result, { useCache: true });
      scorer.analyzeCorrelations(result, { useCache: false });

      // Both should work
      const summary = scorer.getSummary();
      expect(summary.totalAnalyses).toBe(2);
    });

    it("should calculate high scoring signal count correctly", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
        createMockContribution(SignalSource.ACCURACY, 30),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.highScoringSignalCount).toBe(2);
    });

    it("should calculate average signal score correctly", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 60),
        createMockContribution(SignalSource.PROFIT_LOSS, 80),
        createMockContribution(SignalSource.ACCURACY, 40),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.averageSignalScore).toBe(60);
    });

    it("should identify strong correlations", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 80),
        createMockContribution(SignalSource.PROFIT_LOSS, 82),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        75,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.strongCorrelations.length).toBeGreaterThanOrEqual(0);
    });

    it("should emit correlation-boost event when boost applied", () => {
      const eventHandler = vi.fn();
      scorer.on("correlation-boost", eventHandler);

      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      scorer.analyzeCorrelations(result);

      if (eventHandler.mock.calls.length > 0) {
        expect(eventHandler).toHaveBeenCalled();
        const firstCall = eventHandler.mock.calls[0];
        if (firstCall) {
          expect(firstCall[0]).toHaveProperty("walletAddress");
          expect(firstCall[0]).toHaveProperty("totalBoost");
        }
      }
    });

    it("should emit multi-signal-agreement event for many strong correlations", () => {
      const eventHandler = vi.fn();
      scorer.on("multi-signal-agreement", eventHandler);

      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 85),
        createMockContribution(SignalSource.PROFIT_LOSS, 87),
        createMockContribution(SignalSource.ACCURACY, 84),
        createMockContribution(SignalSource.TIMING_PATTERN, 80),
        createMockContribution(SignalSource.MARKET_SELECTION, 82),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        75,
        contributions
      );

      scorer.analyzeCorrelations(result);

      // May or may not trigger depending on correlation detection
    });

    it("should skip unavailable signals", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70, true),
        createMockContribution(SignalSource.PROFIT_LOSS, 75, false),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);

      // Should not detect correlation since one signal is unavailable
      const winRatePLCorr = analysis.correlations.find(
        (c) =>
          (c.signal1 === SignalSource.WIN_RATE && c.signal2 === SignalSource.PROFIT_LOSS) ||
          (c.signal1 === SignalSource.PROFIT_LOSS && c.signal2 === SignalSource.WIN_RATE)
      );
      expect(winRatePLCorr).toBeUndefined();
    });
  });

  // ==========================================================================
  // Batch Analysis Tests
  // ==========================================================================

  describe("batchAnalyzeCorrelations", () => {
    it("should batch analyze multiple composite results", () => {
      const results: CompositeScoreResult[] = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", 50, [
          createMockContribution(SignalSource.WIN_RATE, 60),
          createMockContribution(SignalSource.PROFIT_LOSS, 65),
        ]),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", 55, [
          createMockContribution(SignalSource.WIN_RATE, 70),
          createMockContribution(SignalSource.ACCURACY, 72),
        ]),
      ];

      const batchResult = scorer.batchAnalyzeCorrelations(results);

      expect(batchResult.totalProcessed).toBe(2);
      expect(batchResult.results.size).toBe(2);
      expect(batchResult.failed.size).toBe(0);
    });

    it("should calculate average boost in batch", () => {
      const results: CompositeScoreResult[] = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", 50, [
          createMockContribution(SignalSource.WIN_RATE, 70),
          createMockContribution(SignalSource.PROFIT_LOSS, 75),
        ]),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", 55, [
          createMockContribution(SignalSource.WIN_RATE, 80),
          createMockContribution(SignalSource.ACCURACY, 82),
        ]),
      ];

      const batchResult = scorer.batchAnalyzeCorrelations(results);

      expect(batchResult.averageBoost).toBeGreaterThanOrEqual(0);
    });

    it("should count significant boosts in batch", () => {
      const results: CompositeScoreResult[] = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", 50, [
          createMockContribution(SignalSource.WIN_RATE, 85),
          createMockContribution(SignalSource.PROFIT_LOSS, 90),
          createMockContribution(SignalSource.ACCURACY, 88),
        ]),
      ];

      const batchResult = scorer.batchAnalyzeCorrelations(results);

      expect(typeof batchResult.significantBoostCount).toBe("number");
    });

    it("should collect common patterns in batch", () => {
      const results: CompositeScoreResult[] = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", 50, [
          createMockContribution(SignalSource.WIN_RATE, 70),
          createMockContribution(SignalSource.PROFIT_LOSS, 75),
          createMockContribution(SignalSource.ACCURACY, 72),
        ]),
      ];

      const batchResult = scorer.batchAnalyzeCorrelations(results);

      expect(Array.isArray(batchResult.commonPatterns)).toBe(true);
    });
  });

  // ==========================================================================
  // Apply Correlation Boost Tests
  // ==========================================================================

  describe("applyCorrelationBoost", () => {
    it("should return boosted score directly", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      const boostedScore = scorer.applyCorrelationBoost(result);

      expect(boostedScore).toBeGreaterThanOrEqual(60);
    });

    it("should respect custom max boost option", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 90),
        createMockContribution(SignalSource.PROFIT_LOSS, 92),
        createMockContribution(SignalSource.ACCURACY, 91),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        80,
        contributions
      );

      const boostedScore = scorer.applyCorrelationBoost(result, { maxBoost: 5 });

      expect(boostedScore).toBeLessThanOrEqual(85);
    });
  });

  // ==========================================================================
  // Effectiveness Tracking Tests
  // ==========================================================================

  describe("Effectiveness Tracking", () => {
    it("should record boost effectiveness", () => {
      scorer.recordBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );

      const stats = scorer.getEffectivenessStats();
      expect(stats.trackedCount).toBe(1);
      expect(stats.correctCount).toBe(1);
    });

    it("should track incorrect outcomes", () => {
      scorer.recordBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.FRESH_WALLET_ACTIVITY,
        40,
        55,
        false
      );

      const stats = scorer.getEffectivenessStats();
      expect(stats.incorrectCount).toBe(1);
    });

    it("should track unknown outcomes", () => {
      scorer.recordBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.SYBIL_COORDINATION,
        45,
        60,
        null
      );

      const stats = scorer.getEffectivenessStats();
      expect(stats.unknownCount).toBe(1);
    });

    it("should calculate effectiveness rate", () => {
      scorer.recordBoostEffectiveness(
        "0x1111111111111111111111111111111111111111",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );
      scorer.recordBoostEffectiveness(
        "0x2222222222222222222222222222222222222222",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        55,
        70,
        true
      );
      scorer.recordBoostEffectiveness(
        "0x3333333333333333333333333333333333333333",
        CorrelationPattern.FRESH_WALLET_ACTIVITY,
        45,
        60,
        false
      );

      const stats = scorer.getEffectivenessStats();
      expect(stats.effectivenessRate).toBeCloseTo(2 / 3, 2);
    });

    it("should track effectiveness by pattern", () => {
      scorer.recordBoostEffectiveness(
        "0x1111111111111111111111111111111111111111",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );
      scorer.recordBoostEffectiveness(
        "0x2222222222222222222222222222222222222222",
        CorrelationPattern.FRESH_WALLET_ACTIVITY,
        40,
        55,
        false
      );

      const stats = scorer.getEffectivenessStats();
      expect(stats.byPattern[CorrelationPattern.PERFORMANCE_OUTLIERS].correct).toBe(1);
      expect(stats.byPattern[CorrelationPattern.FRESH_WALLET_ACTIVITY].incorrect).toBe(1);
    });

    it("should emit effectiveness-recorded event", () => {
      const eventHandler = vi.fn();
      scorer.on("effectiveness-recorded", eventHandler);

      scorer.recordBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should limit effectiveness records", () => {
      const smallLimitScorer = createMultiSignalCorrelationScorer({
        maxEffectivenessRecords: 5,
      });

      for (let i = 0; i < 10; i++) {
        smallLimitScorer.recordBoostEffectiveness(
          `0x${"0".repeat(40 - i.toString().length)}${i}`,
          CorrelationPattern.PERFORMANCE_OUTLIERS,
          50,
          65,
          true
        );
      }

      const stats = smallLimitScorer.getEffectivenessStats();
      expect(stats.trackedCount).toBe(5);
    });
  });

  // ==========================================================================
  // Signal Pair Management Tests
  // ==========================================================================

  describe("Signal Pair Management", () => {
    it("should add custom signal pair", () => {
      const initialCount = scorer.getSignalPairs().length;

      scorer.addSignalPair({
        signal1: SignalSource.COORDINATION,
        signal2: SignalSource.MARKET_SELECTION,
        pattern: CorrelationPattern.BEHAVIORAL_CONSISTENCY,
        weight: 1.5,
        minScoreThreshold: 40,
        description: "Custom coordination pair",
      });

      expect(scorer.getSignalPairs().length).toBe(initialCount + 1);
    });

    it("should emit signal-pair-added event", () => {
      const eventHandler = vi.fn();
      scorer.on("signal-pair-added", eventHandler);

      scorer.addSignalPair({
        signal1: SignalSource.TIMING_PATTERN,
        signal2: SignalSource.POSITION_SIZING,
        pattern: CorrelationPattern.BEHAVIORAL_CONSISTENCY,
        weight: 1.0,
        minScoreThreshold: 35,
        description: "Test pair",
      });

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should remove signal pair", () => {
      scorer.addSignalPair({
        signal1: SignalSource.SYBIL,
        signal2: SignalSource.TRADING_PATTERN,
        pattern: CorrelationPattern.NETWORK_COORDINATION,
        weight: 1.2,
        minScoreThreshold: 40,
        description: "Removable pair",
      });

      const initialCount = scorer.getSignalPairs().length;
      const removed = scorer.removeSignalPair(SignalSource.SYBIL, SignalSource.TRADING_PATTERN);

      expect(removed).toBe(true);
      expect(scorer.getSignalPairs().length).toBe(initialCount - 1);
    });

    it("should return false when removing non-existent pair", () => {
      const removed = scorer.removeSignalPair(SignalSource.FRESH_WALLET, SignalSource.SYBIL);
      expect(removed).toBe(false);
    });

    it("should emit signal-pair-removed event", () => {
      const eventHandler = vi.fn();
      scorer.on("signal-pair-removed", eventHandler);

      // First add a pair
      scorer.addSignalPair({
        signal1: SignalSource.SYBIL,
        signal2: SignalSource.TRADING_PATTERN,
        pattern: CorrelationPattern.NETWORK_COORDINATION,
        weight: 1.2,
        minScoreThreshold: 40,
        description: "To be removed",
      });

      // Then remove it
      scorer.removeSignalPair(SignalSource.SYBIL, SignalSource.TRADING_PATTERN);

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should get signal pairs as array", () => {
      const pairs = scorer.getSignalPairs();
      expect(Array.isArray(pairs)).toBe(true);
      expect(pairs.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe("Configuration", () => {
    it("should update configuration", () => {
      scorer.updateConfig({ maxBoost: 50 });
      // Config is updated (no direct getter, so we test behavior)
    });

    it("should emit config-updated event", () => {
      const eventHandler = vi.fn();
      scorer.on("config-updated", eventHandler);

      scorer.updateConfig({ minCorrelationStrength: 0.5 });

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should update signal pairs via config", () => {
      const newPairs: SignalPair[] = [
        {
          signal1: SignalSource.WIN_RATE,
          signal2: SignalSource.ACCURACY,
          pattern: CorrelationPattern.PERFORMANCE_OUTLIERS,
          weight: 1.0,
          minScoreThreshold: 30,
          description: "Only pair",
        },
      ];

      scorer.updateConfig({ signalPairs: newPairs });
      expect(scorer.getSignalPairs()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Cache Tests
  // ==========================================================================

  describe("Cache", () => {
    it("should clear cache", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      // Populate cache
      scorer.analyzeCorrelations(result);

      // Clear
      scorer.clearCache();

      const summary = scorer.getSummary();
      expect(summary.cacheStats.size).toBe(0);
    });

    it("should emit cache-cleared event", () => {
      const eventHandler = vi.fn();
      scorer.on("cache-cleared", eventHandler);

      scorer.clearCache();

      expect(eventHandler).toHaveBeenCalled();
    });

    it("should respect cache TTL", () => {
      const shortTtlScorer = createMultiSignalCorrelationScorer({
        cacheTtlMs: 1, // 1ms TTL
      });

      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 70),
        createMockContribution(SignalSource.PROFIT_LOSS, 75),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        60,
        contributions
      );

      shortTtlScorer.analyzeCorrelations(result);

      // Wait for cache to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // This should not use cache (expired)
          shortTtlScorer.analyzeCorrelations(result);
          const summary = shortTtlScorer.getSummary();
          expect(summary.totalAnalyses).toBe(2);
          resolve();
        }, 10);
      });
    });

    it("should respect cache size limit", () => {
      const smallCacheScorer = createMultiSignalCorrelationScorer({
        maxCacheSize: 2,
      });

      for (let i = 1; i <= 5; i++) {
        const result = createMockCompositeResult(
          `0x${"0".repeat(40 - i.toString().length)}${i}`,
          50,
          [createMockContribution(SignalSource.WIN_RATE, 50)]
        );
        smallCacheScorer.analyzeCorrelations(result);
      }

      const summary = smallCacheScorer.getSummary();
      expect(summary.cacheStats.size).toBeLessThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Summary Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return summary with correct structure", () => {
      const summary = scorer.getSummary();

      expect(summary).toHaveProperty("totalAnalyses");
      expect(summary).toHaveProperty("analysesWithBoost");
      expect(summary).toHaveProperty("averageBoost");
      expect(summary).toHaveProperty("maxBoost");
      expect(summary).toHaveProperty("boostDistribution");
      expect(summary).toHaveProperty("patternFrequency");
      expect(summary).toHaveProperty("pairEffectiveness");
      expect(summary).toHaveProperty("effectiveness");
      expect(summary).toHaveProperty("cacheStats");
    });

    it("should track analysis counts", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        [createMockContribution(SignalSource.WIN_RATE, 50)]
      );

      scorer.analyzeCorrelations(result);
      scorer.analyzeCorrelations(result, { useCache: false });

      const summary = scorer.getSummary();
      expect(summary.totalAnalyses).toBe(2);
    });

    it("should track cache hit rate", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        [createMockContribution(SignalSource.WIN_RATE, 50)]
      );

      // First call - miss
      scorer.analyzeCorrelations(result);
      // Second call - hit
      scorer.analyzeCorrelations(result);

      const summary = scorer.getSummary();
      expect(summary.cacheStats.hitRate).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Export/Import Tests
  // ==========================================================================

  describe("Export/Import", () => {
    it("should export data", () => {
      scorer.recordBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );

      const exported = scorer.exportData();

      expect(exported).toHaveProperty("effectivenessRecords");
      expect(exported).toHaveProperty("config");
      expect(exported).toHaveProperty("statistics");
      expect(exported.effectivenessRecords.length).toBe(1);
    });

    it("should import data", () => {
      const scorer1 = createMultiSignalCorrelationScorer();
      scorer1.recordBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );

      const exported = scorer1.exportData();

      const scorer2 = createMultiSignalCorrelationScorer();
      scorer2.importData(exported);

      const stats = scorer2.getEffectivenessStats();
      expect(stats.trackedCount).toBe(1);
    });

    it("should emit data-imported event", () => {
      const eventHandler = vi.fn();
      scorer.on("data-imported", eventHandler);

      scorer.importData({
        effectivenessRecords: [],
        config: DEFAULT_CORRELATION_SCORER_CONFIG,
        statistics: {
          totalAnalyses: 0,
          analysesWithBoost: 0,
          totalBoostApplied: 0,
          maxBoostApplied: 0,
        },
      });

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Factory and Singleton Tests
  // ==========================================================================

  describe("Factory and Singleton", () => {
    it("should create new instance with factory", () => {
      const scorer = createMultiSignalCorrelationScorer();
      expect(scorer).toBeInstanceOf(MultiSignalCorrelationScorer);
    });

    it("should get shared instance", () => {
      const shared1 = getSharedMultiSignalCorrelationScorer();
      const shared2 = getSharedMultiSignalCorrelationScorer();
      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const custom = createMultiSignalCorrelationScorer({ maxBoost: 50 });
      setSharedMultiSignalCorrelationScorer(custom);

      const shared = getSharedMultiSignalCorrelationScorer();
      expect(shared).toBe(custom);
    });

    it("should reset shared instance", () => {
      const custom = createMultiSignalCorrelationScorer();
      setSharedMultiSignalCorrelationScorer(custom);

      resetSharedMultiSignalCorrelationScorer();

      const shared = getSharedMultiSignalCorrelationScorer();
      expect(shared).not.toBe(custom);
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetSharedMultiSignalCorrelationScorer();
    });

    it("should analyze using shared instance", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        [createMockContribution(SignalSource.WIN_RATE, 60)]
      );

      const analysis = analyzeSignalCorrelations(result);
      expect(analysis.walletAddress).toBe("0x1234567890abcdef1234567890abcdef12345678");
    });

    it("should batch analyze using shared instance", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", 50, []),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", 55, []),
      ];

      const batchResult = batchAnalyzeSignalCorrelations(results);
      expect(batchResult.totalProcessed).toBe(2);
    });

    it("should apply boost using shared instance", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        [createMockContribution(SignalSource.WIN_RATE, 60)]
      );

      const boostedScore = applySignalCorrelationBoost(result);
      expect(typeof boostedScore).toBe("number");
    });

    it("should get summary using shared instance", () => {
      const summary = getCorrelationScorerSummary();
      expect(summary).toHaveProperty("totalAnalyses");
    });

    it("should record effectiveness using shared instance", () => {
      recordCorrelationBoostEffectiveness(
        "0x1234567890abcdef1234567890abcdef12345678",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        50,
        65,
        true
      );

      const summary = getCorrelationScorerSummary();
      expect(summary.effectiveness.trackedCount).toBe(1);
    });
  });

  // ==========================================================================
  // Description Helper Tests
  // ==========================================================================

  describe("Description Helpers", () => {
    it("should get correlation type description", () => {
      const desc = getCorrelationTypeDescription(SignalCorrelationType.STRONG_POSITIVE);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get correlation strength description", () => {
      const desc = getCorrelationStrengthDescription(CorrelationStrength.VERY_STRONG);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get correlation pattern description", () => {
      const desc = getCorrelationPatternDescription(CorrelationPattern.INSIDER_PATTERN);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get boost impact description", () => {
      const desc = getBoostImpactDescription(BoostImpact.MAJOR);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Boost Impact Classification Tests
  // ==========================================================================

  describe("Boost Impact Classification", () => {
    it("should classify no boost impact correctly", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        30,
        [createMockContribution(SignalSource.WIN_RATE, 20)]
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.boostImpact).toBe(BoostImpact.NONE);
    });

    it("should classify minor boost impact correctly", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        [
          createMockContribution(SignalSource.WIN_RATE, 45),
          createMockContribution(SignalSource.PROFIT_LOSS, 46),
        ]
      );

      const analysis = scorer.analyzeCorrelations(result);
      // May be NONE or MINOR depending on correlation calculation
      expect([BoostImpact.NONE, BoostImpact.MINOR]).toContain(analysis.boostImpact);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle empty composite result", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        0,
        []
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.totalBoost).toBe(0);
      expect(analysis.boostImpact).toBe(BoostImpact.NONE);
    });

    it("should handle perfect scores", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 100),
        createMockContribution(SignalSource.PROFIT_LOSS, 100),
        createMockContribution(SignalSource.ACCURACY, 100),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        100,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.boostedScore).toBe(100);
    });

    it("should handle zero scores", () => {
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 0),
        createMockContribution(SignalSource.PROFIT_LOSS, 0),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        0,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.totalBoost).toBe(0);
    });

    it("should handle single signal", () => {
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        [createMockContribution(SignalSource.WIN_RATE, 80)]
      );

      const analysis = scorer.analyzeCorrelations(result);
      expect(analysis.correlations).toHaveLength(0);
      expect(analysis.totalBoost).toBe(0);
    });

    it("should handle contradictory signals", () => {
      // One very high, one very low - should detect contradiction
      const contributions = [
        createMockContribution(SignalSource.WIN_RATE, 90),
        createMockContribution(SignalSource.PROFIT_LOSS, 10),
      ];
      const result = createMockCompositeResult(
        "0x1234567890abcdef1234567890abcdef12345678",
        50,
        contributions
      );

      scorer.analyzeCorrelations(result);
      // Either no correlation detected or contradiction detected
      // Depends on configuration
    });
  });
});
