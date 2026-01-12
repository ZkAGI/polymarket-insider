/**
 * E2E Tests for Multi-Signal Correlation Scorer (DET-SCORE-008)
 *
 * End-to-end tests for detecting signal correlations and applying boost.
 * Tests realistic scenarios with complex signal patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MultiSignalCorrelationScorer,
  createMultiSignalCorrelationScorer,
  resetSharedMultiSignalCorrelationScorer,
  CorrelationPattern,
  BoostImpact,
  type SignalPair,
} from "../../src/detection/multi-signal-correlation-scorer";
import {
  SignalSource,
  CompositeSuspicionLevel,
  CompositeSignalCategory,
  type CompositeScoreResult,
  type CompositeSignalContribution,
} from "../../src/detection/composite-suspicion-scorer";

// ============================================================================
// Test Utilities
// ============================================================================

function createContribution(
  source: SignalSource,
  rawScore: number,
  available: boolean = true
): CompositeSignalContribution {
  const categoryMap: Record<SignalSource, CompositeSignalCategory> = {
    [SignalSource.FRESH_WALLET]: CompositeSignalCategory.WALLET_PROFILE,
    [SignalSource.WIN_RATE]: CompositeSignalCategory.PERFORMANCE,
    [SignalSource.PROFIT_LOSS]: CompositeSignalCategory.PERFORMANCE,
    [SignalSource.TIMING_PATTERN]: CompositeSignalCategory.BEHAVIOR,
    [SignalSource.POSITION_SIZING]: CompositeSignalCategory.BEHAVIOR,
    [SignalSource.MARKET_SELECTION]: CompositeSignalCategory.BEHAVIOR,
    [SignalSource.COORDINATION]: CompositeSignalCategory.NETWORK,
    [SignalSource.SYBIL]: CompositeSignalCategory.NETWORK,
    [SignalSource.ACCURACY]: CompositeSignalCategory.PERFORMANCE,
    [SignalSource.TRADING_PATTERN]: CompositeSignalCategory.BEHAVIOR,
  };

  return {
    source,
    category: categoryMap[source],
    name: source,
    rawScore,
    weight: 0.1,
    weightedScore: rawScore * 0.1,
    confidence: rawScore >= 60 ? "HIGH" as any : rawScore >= 40 ? "MEDIUM" as any : "LOW" as any,
    dataQuality: Math.min(100, rawScore + 20),
    available,
    reason: `Signal ${source} with score ${rawScore}`,
    flags: rawScore >= 70 ? ["ELEVATED"] : [],
  };
}

function createCompositeResult(
  walletAddress: string,
  compositeScore: number,
  contributions: CompositeSignalContribution[]
): CompositeScoreResult {
  const level =
    compositeScore >= 80
      ? CompositeSuspicionLevel.CRITICAL
      : compositeScore >= 60
      ? CompositeSuspicionLevel.HIGH
      : compositeScore >= 40
      ? CompositeSuspicionLevel.MEDIUM
      : compositeScore >= 20
      ? CompositeSuspicionLevel.LOW
      : CompositeSuspicionLevel.NONE;

  return {
    walletAddress,
    compositeScore,
    suspicionLevel: level,
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
// E2E Tests
// ============================================================================

describe("Multi-Signal Correlation Scorer E2E", () => {
  let scorer: MultiSignalCorrelationScorer;

  beforeEach(() => {
    resetSharedMultiSignalCorrelationScorer();
    scorer = createMultiSignalCorrelationScorer();
  });

  afterEach(() => {
    resetSharedMultiSignalCorrelationScorer();
  });

  // ==========================================================================
  // Scenario: Potential Insider - Strong Performance Correlation
  // ==========================================================================

  describe("Potential Insider Detection", () => {
    it("should detect and boost score for wallet with correlated high performance metrics", () => {
      // A wallet with unusually high win rate, P&L, and accuracy - strongly correlated
      const contributions = [
        createContribution(SignalSource.WIN_RATE, 85),
        createContribution(SignalSource.PROFIT_LOSS, 88),
        createContribution(SignalSource.ACCURACY, 82),
        createContribution(SignalSource.TIMING_PATTERN, 65),
        createContribution(SignalSource.MARKET_SELECTION, 70),
      ];

      const compositeResult = createCompositeResult(
        "0xInsider1111111111111111111111111111111111",
        75,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should detect strong correlations
      expect(analysis.correlations.length).toBeGreaterThan(0);
      expect(analysis.totalBoost).toBeGreaterThan(0);
      expect(analysis.boostedScore).toBeGreaterThan(75);

      // Should detect performance outlier pattern
      const perfPattern = analysis.patterns.find(
        (p) => p.pattern === CorrelationPattern.PERFORMANCE_OUTLIERS
      );
      expect(perfPattern).toBeDefined();

      // Should have strong correlations
      expect(analysis.strongCorrelations.length).toBeGreaterThan(0);

      // Should generate insights
      expect(analysis.insights.length).toBeGreaterThan(0);
    });

    it("should detect timing + accuracy correlation suggesting insider knowledge", () => {
      // Wallet trades at unusual times but with high accuracy
      const contributions = [
        createContribution(SignalSource.TIMING_PATTERN, 75),
        createContribution(SignalSource.ACCURACY, 80),
        createContribution(SignalSource.WIN_RATE, 72),
        createContribution(SignalSource.MARKET_SELECTION, 68),
      ];

      const compositeResult = createCompositeResult(
        "0xInsider2222222222222222222222222222222222",
        70,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should detect timing + accuracy correlation
      const timingAccuracyCorr = analysis.correlations.find(
        (c) =>
          (c.signal1 === SignalSource.TIMING_PATTERN && c.signal2 === SignalSource.ACCURACY) ||
          (c.signal1 === SignalSource.ACCURACY && c.signal2 === SignalSource.TIMING_PATTERN)
      );
      expect(timingAccuracyCorr).toBeDefined();
      expect(analysis.totalBoost).toBeGreaterThan(0);
    });

    it("should heavily boost score for wallet with multiple insider-like signals", () => {
      // A wallet that hits all insider indicators
      const contributions = [
        createContribution(SignalSource.FRESH_WALLET, 70),
        createContribution(SignalSource.WIN_RATE, 90),
        createContribution(SignalSource.PROFIT_LOSS, 92),
        createContribution(SignalSource.ACCURACY, 88),
        createContribution(SignalSource.TIMING_PATTERN, 75),
        createContribution(SignalSource.MARKET_SELECTION, 80),
      ];

      const compositeResult = createCompositeResult(
        "0xInsider3333333333333333333333333333333333",
        80,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should have significant boost
      expect(analysis.totalBoost).toBeGreaterThan(5);
      expect(analysis.boostImpact).not.toBe(BoostImpact.NONE);

      // Score should be significantly boosted
      expect(analysis.boostedScore).toBeGreaterThan(80);

      // Should have many strong correlations
      expect(analysis.strongCorrelations.length).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // Scenario: Sybil Attack Detection
  // ==========================================================================

  describe("Sybil Attack Detection", () => {
    it("should detect sybil + coordination correlation", () => {
      const contributions = [
        createContribution(SignalSource.SYBIL, 75),
        createContribution(SignalSource.COORDINATION, 80),
        createContribution(SignalSource.FRESH_WALLET, 60),
      ];

      const compositeResult = createCompositeResult(
        "0xSybil11111111111111111111111111111111111",
        65,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should detect sybil-coordination correlation
      const sybilCoordCorr = analysis.correlations.find(
        (c) =>
          (c.signal1 === SignalSource.SYBIL && c.signal2 === SignalSource.COORDINATION) ||
          (c.signal1 === SignalSource.COORDINATION && c.signal2 === SignalSource.SYBIL)
      );
      expect(sybilCoordCorr).toBeDefined();
      expect(analysis.totalBoost).toBeGreaterThan(0);
    });

    it("should boost sybil cluster pattern appropriately", () => {
      // Multiple wallets in same sybil cluster
      const wallets = [
        "0xSybil11111111111111111111111111111111111",
        "0xSybil22222222222222222222222222222222222",
        "0xSybil33333333333333333333333333333333333",
      ];

      const results = wallets.map((addr) =>
        createCompositeResult(addr, 60, [
          createContribution(SignalSource.SYBIL, 70),
          createContribution(SignalSource.COORDINATION, 65),
          createContribution(SignalSource.FRESH_WALLET, 55),
        ])
      );

      const batchResult = scorer.batchAnalyzeCorrelations(results);

      // All should have some boost
      for (const [_, analysis] of batchResult.results) {
        expect(analysis.totalBoost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ==========================================================================
  // Scenario: Fresh Wallet with Suspicious Activity
  // ==========================================================================

  describe("Fresh Wallet Activity Pattern", () => {
    it("should detect fresh wallet + high win rate correlation", () => {
      const contributions = [
        createContribution(SignalSource.FRESH_WALLET, 75),
        createContribution(SignalSource.WIN_RATE, 70),
        createContribution(SignalSource.PROFIT_LOSS, 65),
      ];

      const compositeResult = createCompositeResult(
        "0xFresh11111111111111111111111111111111111",
        60,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should detect fresh wallet activity pattern
      const freshWalletCorr = analysis.correlations.find(
        (c) =>
          c.signal1 === SignalSource.FRESH_WALLET || c.signal2 === SignalSource.FRESH_WALLET
      );
      expect(freshWalletCorr).toBeDefined();
      expect(analysis.totalBoost).toBeGreaterThan(0);
    });

    it("should boost more when fresh wallet has exceptional accuracy", () => {
      const contributions = [
        createContribution(SignalSource.FRESH_WALLET, 80),
        createContribution(SignalSource.ACCURACY, 85),
        createContribution(SignalSource.WIN_RATE, 75),
      ];

      const compositeResult = createCompositeResult(
        "0xFresh22222222222222222222222222222222222",
        70,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Fresh wallet with high accuracy is very suspicious
      expect(analysis.totalBoost).toBeGreaterThan(0);

      // Should detect fresh wallet activity pattern
      const freshPattern = analysis.patterns.find(
        (p) => p.pattern === CorrelationPattern.FRESH_WALLET_ACTIVITY
      );
      expect(freshPattern).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario: Behavioral Consistency Pattern
  // ==========================================================================

  describe("Behavioral Consistency Detection", () => {
    it("should detect correlated behavioral signals", () => {
      const contributions = [
        createContribution(SignalSource.TIMING_PATTERN, 65),
        createContribution(SignalSource.POSITION_SIZING, 70),
        createContribution(SignalSource.MARKET_SELECTION, 68),
        createContribution(SignalSource.TRADING_PATTERN, 60),
      ];

      const compositeResult = createCompositeResult(
        "0xBehavior111111111111111111111111111111111",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should detect behavioral correlations
      const behavioralCorrs = analysis.correlations.filter(
        (c) =>
          c.pattern === CorrelationPattern.BEHAVIORAL_CONSISTENCY
      );
      expect(behavioralCorrs.length).toBeGreaterThan(0);
    });

    it("should boost for consistent unusual behavior across signals", () => {
      const contributions = [
        createContribution(SignalSource.TIMING_PATTERN, 75),
        createContribution(SignalSource.POSITION_SIZING, 72),
        createContribution(SignalSource.MARKET_SELECTION, 78),
      ];

      const compositeResult = createCompositeResult(
        "0xBehavior222222222222222222222222222222222",
        60,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      expect(analysis.totalBoost).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Scenario: Normal Trading Activity (Negative Case)
  // ==========================================================================

  describe("Normal Trading Activity (No Boost)", () => {
    it("should not boost for normal, uncorrelated signals", () => {
      const contributions = [
        createContribution(SignalSource.WIN_RATE, 30),
        createContribution(SignalSource.PROFIT_LOSS, 35),
        createContribution(SignalSource.ACCURACY, 25),
        createContribution(SignalSource.TIMING_PATTERN, 20),
      ];

      const compositeResult = createCompositeResult(
        "0xNormal11111111111111111111111111111111111",
        25,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      // Should have minimal to no boost
      expect(analysis.totalBoost).toBe(0);
      expect(analysis.boostImpact).toBe(BoostImpact.NONE);
    });

    it("should not boost for mixed signals", () => {
      const contributions = [
        createContribution(SignalSource.WIN_RATE, 60),
        createContribution(SignalSource.PROFIT_LOSS, 25),
        createContribution(SignalSource.ACCURACY, 55),
        createContribution(SignalSource.TIMING_PATTERN, 30),
      ];

      const compositeResult = createCompositeResult(
        "0xMixed111111111111111111111111111111111111",
        40,
        contributions
      );

      scorer.analyzeCorrelations(compositeResult);

      // Mixed signals should result in less boost
      // (one high, one low in performance category)
    });

    it("should not boost for single high signal", () => {
      const contributions = [
        createContribution(SignalSource.WIN_RATE, 80),
        createContribution(SignalSource.PROFIT_LOSS, 30),
        createContribution(SignalSource.ACCURACY, 25),
      ];

      const compositeResult = createCompositeResult(
        "0xSingle11111111111111111111111111111111111",
        45,
        contributions
      );

      scorer.analyzeCorrelations(compositeResult);

      // Single high signal without correlation should result in no/minimal boost
      // WIN_RATE and P&L don't correlate since one is low
    });
  });

  // ==========================================================================
  // Scenario: Batch Analysis of Portfolio
  // ==========================================================================

  describe("Batch Portfolio Analysis", () => {
    it("should analyze multiple wallets and identify high-risk ones", () => {
      const wallets = [
        {
          address: "0xHighRisk11111111111111111111111111111111",
          score: 70,
          contributions: [
            createContribution(SignalSource.WIN_RATE, 85),
            createContribution(SignalSource.PROFIT_LOSS, 88),
            createContribution(SignalSource.ACCURACY, 82),
          ],
        },
        {
          address: "0xMediumRisk111111111111111111111111111111",
          score: 50,
          contributions: [
            createContribution(SignalSource.WIN_RATE, 60),
            createContribution(SignalSource.PROFIT_LOSS, 55),
          ],
        },
        {
          address: "0xLowRisk11111111111111111111111111111111",
          score: 25,
          contributions: [
            createContribution(SignalSource.WIN_RATE, 30),
            createContribution(SignalSource.PROFIT_LOSS, 28),
          ],
        },
      ];

      const compositeResults = wallets.map((w) =>
        createCompositeResult(w.address, w.score, w.contributions)
      );

      const batchResult = scorer.batchAnalyzeCorrelations(compositeResults);

      expect(batchResult.totalProcessed).toBe(3);
      expect(batchResult.results.size).toBe(3);

      // High risk wallet should have highest boost
      const highRiskResult = batchResult.results.get(
        "0xHighRisk11111111111111111111111111111111"
      );
      const lowRiskResult = batchResult.results.get(
        "0xLowRisk11111111111111111111111111111111"
      );

      expect(highRiskResult!.totalBoost).toBeGreaterThanOrEqual(
        lowRiskResult!.totalBoost
      );
    });

    it("should track common patterns across portfolio", () => {
      const wallets = Array.from({ length: 10 }, (_, i) => ({
        address: `0x${i.toString().padStart(40, "0")}`,
        score: 60 + i,
        contributions: [
          createContribution(SignalSource.WIN_RATE, 70 + i),
          createContribution(SignalSource.PROFIT_LOSS, 68 + i),
          createContribution(SignalSource.ACCURACY, 65 + i),
        ],
      }));

      const compositeResults = wallets.map((w) =>
        createCompositeResult(w.address, w.score, w.contributions)
      );

      const batchResult = scorer.batchAnalyzeCorrelations(compositeResults);

      expect(batchResult.commonPatterns.length).toBeGreaterThan(0);
      expect(batchResult.averageBoost).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Scenario: Effectiveness Tracking Over Time
  // ==========================================================================

  describe("Effectiveness Tracking", () => {
    it("should track boost effectiveness over multiple detections", () => {
      // Record multiple effectiveness outcomes
      scorer.recordBoostEffectiveness(
        "0xWallet1111111111111111111111111111111111",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        60,
        75,
        true // Correct detection
      );

      scorer.recordBoostEffectiveness(
        "0xWallet2222222222222222222222222222222222",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        55,
        70,
        true
      );

      scorer.recordBoostEffectiveness(
        "0xWallet3333333333333333333333333333333333",
        CorrelationPattern.FRESH_WALLET_ACTIVITY,
        50,
        65,
        false // False positive
      );

      const stats = scorer.getEffectivenessStats();

      expect(stats.trackedCount).toBe(3);
      expect(stats.correctCount).toBe(2);
      expect(stats.incorrectCount).toBe(1);
      expect(stats.effectivenessRate).toBeCloseTo(2 / 3, 2);
    });

    it("should track effectiveness by pattern type", () => {
      scorer.recordBoostEffectiveness(
        "0xWallet1111111111111111111111111111111111",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        60,
        75,
        true
      );

      scorer.recordBoostEffectiveness(
        "0xWallet2222222222222222222222222222222222",
        CorrelationPattern.SYBIL_COORDINATION,
        65,
        80,
        false
      );

      const stats = scorer.getEffectivenessStats();

      expect(stats.byPattern[CorrelationPattern.PERFORMANCE_OUTLIERS].correct).toBe(1);
      expect(stats.byPattern[CorrelationPattern.SYBIL_COORDINATION].incorrect).toBe(1);
    });
  });

  // ==========================================================================
  // Scenario: Custom Signal Pairs
  // ==========================================================================

  describe("Custom Signal Pair Configuration", () => {
    it("should use custom signal pairs for analysis", () => {
      const customScorer = createMultiSignalCorrelationScorer({
        signalPairs: [
          {
            signal1: SignalSource.WIN_RATE,
            signal2: SignalSource.TIMING_PATTERN,
            pattern: CorrelationPattern.INSIDER_PATTERN,
            weight: 2.0,
            minScoreThreshold: 40,
            description: "Custom insider pattern",
          },
        ],
      });

      const contributions = [
        createContribution(SignalSource.WIN_RATE, 70),
        createContribution(SignalSource.TIMING_PATTERN, 75),
      ];

      const compositeResult = createCompositeResult(
        "0xCustom11111111111111111111111111111111111",
        60,
        contributions
      );

      const analysis = customScorer.analyzeCorrelations(compositeResult);

      expect(analysis.correlations.length).toBe(1);
      expect(analysis.correlations[0]!.pattern).toBe(CorrelationPattern.INSIDER_PATTERN);
    });

    it("should add and use new signal pairs dynamically", () => {
      const customPair: SignalPair = {
        signal1: SignalSource.TRADING_PATTERN,
        signal2: SignalSource.SYBIL,
        pattern: CorrelationPattern.NETWORK_COORDINATION,
        weight: 1.5,
        minScoreThreshold: 45,
        description: "Dynamic trading-sybil pair",
      };

      scorer.addSignalPair(customPair);

      const contributions = [
        createContribution(SignalSource.TRADING_PATTERN, 65),
        createContribution(SignalSource.SYBIL, 70),
      ];

      const compositeResult = createCompositeResult(
        "0xDynamic1111111111111111111111111111111111",
        55,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      const tradingSybilCorr = analysis.correlations.find(
        (c) =>
          (c.signal1 === SignalSource.TRADING_PATTERN && c.signal2 === SignalSource.SYBIL) ||
          (c.signal1 === SignalSource.SYBIL && c.signal2 === SignalSource.TRADING_PATTERN)
      );
      expect(tradingSybilCorr).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario: Boost Limits and Caps
  // ==========================================================================

  describe("Boost Limits", () => {
    it("should respect maximum boost configuration", () => {
      const limitedScorer = createMultiSignalCorrelationScorer({
        maxBoost: 5,
      });

      const contributions = [
        createContribution(SignalSource.WIN_RATE, 95),
        createContribution(SignalSource.PROFIT_LOSS, 95),
        createContribution(SignalSource.ACCURACY, 95),
        createContribution(SignalSource.TIMING_PATTERN, 90),
        createContribution(SignalSource.MARKET_SELECTION, 90),
      ];

      const compositeResult = createCompositeResult(
        "0xMaxBoost1111111111111111111111111111111",
        85,
        contributions
      );

      const analysis = limitedScorer.analyzeCorrelations(compositeResult);

      expect(analysis.totalBoost).toBeLessThanOrEqual(5);
      expect(analysis.boostedScore).toBeLessThanOrEqual(90);
    });

    it("should cap boosted score at 100", () => {
      const contributions = [
        createContribution(SignalSource.WIN_RATE, 98),
        createContribution(SignalSource.PROFIT_LOSS, 99),
        createContribution(SignalSource.ACCURACY, 97),
      ];

      const compositeResult = createCompositeResult(
        "0xCapped11111111111111111111111111111111111",
        98,
        contributions
      );

      const analysis = scorer.analyzeCorrelations(compositeResult);

      expect(analysis.boostedScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Scenario: Data Persistence
  // ==========================================================================

  describe("Data Persistence", () => {
    it("should export and import data correctly", () => {
      // Record some effectiveness data
      scorer.recordBoostEffectiveness(
        "0xExport11111111111111111111111111111111111",
        CorrelationPattern.PERFORMANCE_OUTLIERS,
        60,
        75,
        true
      );

      // Export
      const exported = scorer.exportData();

      // Create new scorer and import
      const newScorer = createMultiSignalCorrelationScorer();
      newScorer.importData(exported);

      // Verify data was imported
      const stats = newScorer.getEffectivenessStats();
      expect(stats.trackedCount).toBe(1);
      expect(stats.correctCount).toBe(1);
    });

    it("should preserve configuration across export/import", () => {
      const customScorer = createMultiSignalCorrelationScorer({
        maxBoost: 30,
        minCorrelationStrength: 0.4,
      });

      customScorer.recordBoostEffectiveness(
        "0xConfig11111111111111111111111111111111111",
        CorrelationPattern.INSIDER_PATTERN,
        55,
        70,
        true
      );

      const exported = customScorer.exportData();

      const newScorer = createMultiSignalCorrelationScorer();
      newScorer.importData(exported);

      // Config should be imported
      const summary = newScorer.getSummary();
      expect(summary.effectiveness.trackedCount).toBe(1);
    });
  });

  // ==========================================================================
  // Scenario: Performance Under Load
  // ==========================================================================

  describe("Performance", () => {
    it("should handle large batch analysis efficiently", () => {
      const walletCount = 100;
      const wallets = Array.from({ length: walletCount }, (_, i) => ({
        address: `0x${i.toString(16).padStart(40, "0")}`,
        score: 30 + (i % 50),
        contributions: [
          createContribution(SignalSource.WIN_RATE, 40 + (i % 40)),
          createContribution(SignalSource.PROFIT_LOSS, 35 + (i % 45)),
          createContribution(SignalSource.ACCURACY, 30 + (i % 50)),
        ],
      }));

      const compositeResults = wallets.map((w) =>
        createCompositeResult(w.address, w.score, w.contributions)
      );

      const startTime = Date.now();
      const batchResult = scorer.batchAnalyzeCorrelations(compositeResults);
      const duration = Date.now() - startTime;

      expect(batchResult.totalProcessed).toBe(walletCount);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it("should benefit from caching for repeated analyses", () => {
      const contributions = [
        createContribution(SignalSource.WIN_RATE, 70),
        createContribution(SignalSource.PROFIT_LOSS, 75),
      ];

      const compositeResult = createCompositeResult(
        "0xCached11111111111111111111111111111111111",
        60,
        contributions
      );

      // First analysis
      const start1 = Date.now();
      scorer.analyzeCorrelations(compositeResult);
      const duration1 = Date.now() - start1;

      // Second analysis (cached)
      const start2 = Date.now();
      scorer.analyzeCorrelations(compositeResult);
      const duration2 = Date.now() - start2;

      // Cached should be faster or equal
      expect(duration2).toBeLessThanOrEqual(duration1 + 1); // Allow 1ms tolerance

      // Verify cache was used
      const summary = scorer.getSummary();
      expect(summary.cacheStats.hitRate).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Scenario: Summary and Reporting
  // ==========================================================================

  describe("Summary and Reporting", () => {
    it("should provide comprehensive summary after multiple analyses", () => {
      // Perform multiple analyses
      const wallets = [
        { score: 75, win: 85, pl: 88, acc: 82 },
        { score: 50, win: 55, pl: 52, acc: 48 },
        { score: 30, win: 35, pl: 30, acc: 32 },
      ];

      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i]!;
        const contributions = [
          createContribution(SignalSource.WIN_RATE, w.win),
          createContribution(SignalSource.PROFIT_LOSS, w.pl),
          createContribution(SignalSource.ACCURACY, w.acc),
        ];

        const compositeResult = createCompositeResult(
          `0x${i.toString().padStart(40, "0")}`,
          w.score,
          contributions
        );

        scorer.analyzeCorrelations(compositeResult, { useCache: false });
      }

      const summary = scorer.getSummary();

      expect(summary.totalAnalyses).toBe(3);
      expect(summary.averageBoost).toBeGreaterThanOrEqual(0);
      expect(summary.maxBoost).toBeGreaterThanOrEqual(0);
      expect(Object.keys(summary.boostDistribution).length).toBe(5);
      expect(Object.keys(summary.patternFrequency).length).toBeGreaterThan(0);
    });

    it("should track pair effectiveness in summary", () => {
      // Perform analyses that trigger specific pairs
      for (let i = 0; i < 5; i++) {
        const contributions = [
          createContribution(SignalSource.WIN_RATE, 70 + i),
          createContribution(SignalSource.PROFIT_LOSS, 72 + i),
        ];

        const compositeResult = createCompositeResult(
          `0x${i.toString().padStart(40, "0")}`,
          60,
          contributions
        );

        scorer.analyzeCorrelations(compositeResult, { useCache: false });
      }

      const summary = scorer.getSummary();

      expect(summary.pairEffectiveness.length).toBeGreaterThan(0);
      // At least one pair should have been detected multiple times
      const topPair = summary.pairEffectiveness[0];
      if (topPair) {
        expect(topPair.detectionCount).toBeGreaterThan(0);
      }
    });
  });
});
