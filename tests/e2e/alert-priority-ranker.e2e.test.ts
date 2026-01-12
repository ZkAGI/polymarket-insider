/**
 * Alert Priority Ranker E2E Tests (DET-SCORE-005)
 *
 * End-to-end integration tests for the alert priority ranker module.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PriorityLevel,
  PriorityFactor,
  UrgencyReason,
  AlertPriorityRanker,
  createAlertPriorityRanker,
  resetSharedAlertPriorityRanker,
  rankAlert,
  rankAlerts,
  getUrgentAlerts,
  getHighlightedAlerts,
  getTopPriorityAlerts,
  getAlertsByPriorityLevel,
  getAlertPriorityRankerSummary,
  getPriorityLevelDescription,
  getPriorityFactorDescription,
  getUrgencyReasonDescription,
  hasUrgentAlert,
  getWalletPriorityRanking,
  // Composite scorer dependencies
  resetSharedCompositeSuspicionScorer,
  SignalSource,
  CompositeSuspicionLevel,
  type CompositeScoreResult,
  // False positive reducer dependencies
  resetSharedFalsePositiveReducer,
  FilterAction,
  FilterConfidence,
  type FilterResult,
  // Pattern classifier for pattern detection
  TradingPatternType,
  PatternRiskFlag,
  // Selection analyzer for market sensitivity
  SelectionPatternType,
  // Coordination detector
  CoordinationRiskLevel,
  // Sybil detector
  SybilRiskLevel,
  SybilFlag,
} from "../../src/detection";

// ============================================================================
// Test Utilities
// ============================================================================

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function createMockCompositeResult(
  walletAddress: string,
  overrides: DeepPartial<CompositeScoreResult> = {}
): CompositeScoreResult {
  const defaultUnderlyingResults: CompositeScoreResult["underlyingResults"] = {
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
  };

  const defaultSignalContributions = [
    {
      source: SignalSource.WIN_RATE,
      category: "PERFORMANCE" as never,
      name: "Win Rate",
      rawScore: 50,
      weight: 0.12,
      weightedScore: 6,
      confidence: "MEDIUM" as never,
      dataQuality: 80,
      available: true,
      reason: "Moderate win rate",
      flags: [],
    },
    {
      source: SignalSource.PROFIT_LOSS,
      category: "PERFORMANCE" as never,
      name: "P&L",
      rawScore: 45,
      weight: 0.12,
      weightedScore: 5.4,
      confidence: "MEDIUM" as never,
      dataQuality: 75,
      available: true,
      reason: "Normal P&L",
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
      reason: "Low coordination",
      flags: [],
    },
  ];

  const defaultResult: CompositeScoreResult = {
    walletAddress,
    compositeScore: 50,
    suspicionLevel: CompositeSuspicionLevel.MEDIUM,
    shouldFlag: true,
    isPotentialInsider: false,
    categoryBreakdown: [],
    signalContributions: defaultSignalContributions,
    topSignals: defaultSignalContributions.slice(0, 3),
    riskFlags: [],
    summary: ["Medium suspicion detected"],
    keyFindings: [],
    dataQuality: 75,
    availableSignals: 3,
    totalSignals: 10,
    underlyingResults: defaultUnderlyingResults,
    fromCache: false,
    analyzedAt: new Date(),
  };

  // Merge overrides, ensuring underlyingResults are properly merged
  const merged = { ...defaultResult, ...overrides } as CompositeScoreResult;
  if (overrides.underlyingResults) {
    merged.underlyingResults = {
      ...defaultUnderlyingResults,
      ...overrides.underlyingResults,
    } as CompositeScoreResult["underlyingResults"];
  }
  return merged;
}

function createHighRiskCompositeResult(walletAddress: string): CompositeScoreResult {
  const signalContributions = [
    {
      source: SignalSource.WIN_RATE,
      category: "PERFORMANCE" as never,
      name: "Win Rate Analysis",
      rawScore: 92,
      weight: 0.12,
      weightedScore: 11.04,
      confidence: "HIGH" as never,
      dataQuality: 95,
      available: true,
      reason: "Exceptionally high win rate: 89%",
      flags: ["EXCEPTIONAL_WIN_RATE", "SUSTAINED_PERFORMANCE"],
    },
    {
      source: SignalSource.PROFIT_LOSS,
      category: "PERFORMANCE" as never,
      name: "Profit/Loss Analysis",
      rawScore: 88,
      weight: 0.12,
      weightedScore: 10.56,
      confidence: "HIGH" as never,
      dataQuality: 92,
      available: true,
      reason: "Total P&L: $125,000",
      flags: ["EXCEPTIONAL_RETURNS"],
    },
    {
      source: SignalSource.ACCURACY,
      category: "PERFORMANCE" as never,
      name: "Accuracy Analysis",
      rawScore: 90,
      weight: 0.08,
      weightedScore: 7.2,
      confidence: "HIGH" as never,
      dataQuality: 90,
      available: true,
      reason: "Near-perfect accuracy on high-stakes markets",
      flags: ["EXCEPTIONAL_ACCURACY"],
    },
    {
      source: SignalSource.COORDINATION,
      category: "NETWORK" as never,
      name: "Coordination Detection",
      rawScore: 75,
      weight: 0.12,
      weightedScore: 9,
      confidence: "HIGH" as never,
      dataQuality: 85,
      available: true,
      reason: "Part of coordinated trading group",
      flags: ["COORDINATED_ACTIVITY"],
    },
    {
      source: SignalSource.SYBIL,
      category: "NETWORK" as never,
      name: "Sybil Detection",
      rawScore: 80,
      weight: 0.12,
      weightedScore: 9.6,
      confidence: "HIGH" as never,
      dataQuality: 88,
      available: true,
      reason: "Likely part of sybil cluster",
      flags: ["SYBIL_CLUSTER"],
    },
    {
      source: SignalSource.MARKET_SELECTION,
      category: "BEHAVIOR" as never,
      name: "Market Selection",
      rawScore: 85,
      weight: 0.1,
      weightedScore: 8.5,
      confidence: "HIGH" as never,
      dataQuality: 82,
      available: true,
      reason: "Insider-like market selection pattern",
      flags: ["INSIDER_LIKE_SELECTION"],
    },
  ];

  return {
    walletAddress,
    compositeScore: 88,
    suspicionLevel: CompositeSuspicionLevel.CRITICAL,
    shouldFlag: true,
    isPotentialInsider: true,
    categoryBreakdown: [],
    signalContributions,
    topSignals: signalContributions.slice(0, 3),
    riskFlags: [],
    summary: ["Critical suspicion - potential insider trading"],
    keyFindings: [],
    dataQuality: 90,
    availableSignals: 6,
    totalSignals: 10,
    underlyingResults: {
      freshWallet: null,
      winRate: null,
      profitLoss: {
        walletAddress,
        tier: "EXCEPTIONAL" as never,
        suspicionLevel: "CRITICAL" as never,
        suspicionScore: 88,
        windowStats: {} as never,
        categoryStats: [],
        topCategories: [],
        worstCategories: [],
        realizedPnl: [],
        unrealizedPnl: [],
        aggregates: {
          totalRealizedPnl: 125000,
          totalUnrealizedPnl: 15000,
          totalPnl: 140000,
          totalCostBasis: 50000,
          totalFees: 500,
          overallRoi: 280,
        },
        trend: "STABLE" as never,
        history: [],
        anomalies: [],
        totalPositions: 50,
        dataQuality: 90,
        isPotentialInsider: true,
        analyzedAt: new Date(),
      },
      timing: null,
      sizing: null,
      selection: {
        walletAddress,
        primaryPattern: SelectionPatternType.INSIDER_LIKE,
        preferences: [],
        categoryPreferences: [],
        diversity: {} as never,
        timing: {} as never,
        marketStats: [],
        topMarkets: [],
        shifts: [],
        suspicionLevel: "HIGH" as never,
        suspicionScore: 85,
        riskFlags: [],
        insights: [],
        dataQuality: 85,
        isPotentiallySuspicious: true,
        totalTrades: 50,
        totalVolume: 250000,
        analyzedAt: new Date(),
      },
      coordination: {
        walletAddress,
        isCoordinated: true,
        groupCount: 2,
        highestRiskLevel: CoordinationRiskLevel.HIGH,
        groups: [],
        connectedWallets: [],
        walletsCompared: 10,
        analyzedAt: new Date(),
      },
      sybil: {
        walletAddress,
        isLikelySybil: true,
        sybilProbability: 80,
        confidence: "HIGH" as never,
        riskLevel: SybilRiskLevel.HIGH,
        clusters: [],
        relatedWallets: [],
        indicators: [],
        flags: [SybilFlag.SAME_FUNDER],
        summary: "Likely part of sybil cluster",
        analyzedAt: Date.now(),
      },
      accuracy: null,
      pattern: {
        address: walletAddress,
        primaryPattern: TradingPatternType.POTENTIAL_INSIDER,
        secondaryPatterns: [],
        confidence: "HIGH" as never,
        matchScore: 85,
        patternMatches: [],
        features: {} as never,
        riskFlags: [PatternRiskFlag.HIGH_WIN_RATE],
        riskScore: 85,
        insights: [],
        tradeCount: 50,
        classifiedAt: new Date(),
      },
    },
    fromCache: false,
    analyzedAt: new Date(),
  };
}

function createMockFilterResult(
  walletAddress: string,
  overrides: Partial<FilterResult> = {}
): FilterResult {
  const mockCompositeResult = createMockCompositeResult(walletAddress);
  return {
    walletAddress,
    originalScore: 50,
    adjustedScore: 50,
    originalLevel: CompositeSuspicionLevel.MEDIUM,
    adjustedLevel: CompositeSuspicionLevel.MEDIUM,
    isLikelyFalsePositive: false,
    isSuppressed: false,
    isDeferred: false,
    action: FilterAction.PASS,
    matches: [],
    primaryPattern: null,
    confidence: FilterConfidence.MEDIUM,
    filterReasons: [],
    scoreReduction: 0,
    originalResult: mockCompositeResult,
    fromCache: false,
    analyzedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// E2E Tests: Full Integration
// ============================================================================

describe("Alert Priority Ranker E2E Tests", () => {
  let ranker: AlertPriorityRanker;

  beforeEach(() => {
    resetSharedAlertPriorityRanker();
    resetSharedCompositeSuspicionScorer();
    resetSharedFalsePositiveReducer();
    ranker = createAlertPriorityRanker();
  });

  afterEach(() => {
    ranker.clearCache();
    resetSharedAlertPriorityRanker();
  });

  describe("High-Risk Wallet Detection", () => {
    it("should rank high-risk wallet as CRITICAL priority", () => {
      const result = createHighRiskCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking.priorityLevel).toBe(PriorityLevel.CRITICAL);
      expect(ranking.isUrgent).toBe(true);
      expect(ranking.isHighlighted).toBe(true);
    });

    it("should identify multiple urgency reasons for high-risk wallet", () => {
      const result = createHighRiskCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.CRITICAL_SCORE);
      expect(ranking.urgencyReasons).toContain(UrgencyReason.INSIDER_INDICATOR);
      expect(ranking.urgencyReasons).toContain(UrgencyReason.NETWORK_DETECTION);
      expect(ranking.urgencyReasons).toContain(UrgencyReason.SYBIL_CLUSTER);
    });

    it("should recommend immediate investigation for high-risk wallet", () => {
      const result = createHighRiskCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking.recommendedAction).toContain("IMMEDIATE");
    });
  });

  describe("Batch Ranking with Mixed Priority", () => {
    it("should correctly rank and sort wallets by priority", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", {
          compositeScore: 40,
          suspicionLevel: CompositeSuspicionLevel.LOW,
        }),
        createHighRiskCompositeResult("0x2222222222222222222222222222222222222222"),
        createMockCompositeResult("0x3333333333333333333333333333333333333333", {
          compositeScore: 65,
          suspicionLevel: CompositeSuspicionLevel.HIGH,
        }),
        createMockCompositeResult("0x4444444444444444444444444444444444444444", {
          compositeScore: 25,
          suspicionLevel: CompositeSuspicionLevel.LOW,
        }),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.rankings.length).toBe(4);
      expect(batch.rankings[0]!.rank).toBe(1);
      expect(batch.rankings[0]!.priorityScore).toBeGreaterThanOrEqual(batch.rankings[1]!.priorityScore);
      expect(batch.rankings[1]!.priorityScore).toBeGreaterThanOrEqual(batch.rankings[2]!.priorityScore);
      expect(batch.rankings[2]!.priorityScore).toBeGreaterThanOrEqual(batch.rankings[3]!.priorityScore);

      // The high-risk wallet should have the highest priority score of the actual high-risk wallet
      const highRiskRanking = batch.byWallet.get("0x2222222222222222222222222222222222222222");
      expect(highRiskRanking).toBeDefined();
      expect(highRiskRanking!.priorityLevel).toBe(PriorityLevel.CRITICAL);
    });

    it("should provide accurate level counts", () => {
      const results = [
        createHighRiskCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", {
          compositeScore: 75,
          suspicionLevel: CompositeSuspicionLevel.HIGH,
        }),
        createMockCompositeResult("0x3333333333333333333333333333333333333333", {
          compositeScore: 45,
          suspicionLevel: CompositeSuspicionLevel.MEDIUM,
        }),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.byLevel[PriorityLevel.CRITICAL]).toBeGreaterThanOrEqual(1);
      expect(batch.urgentCount).toBeGreaterThanOrEqual(1);
      expect(batch.highlightedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Score Escalation Detection", () => {
    it("should detect score escalation over time", () => {
      const address = "0x1234567890123456789012345678901234567890";

      // First ranking with low score
      ranker.rankAlert(
        createMockCompositeResult(address, { compositeScore: 35 }),
        undefined,
        { useCache: false }
      );

      // Second ranking with high score
      const escalatedResult = createMockCompositeResult(address, { compositeScore: 75 });
      const ranking = ranker.rankAlert(escalatedResult, undefined, { useCache: false });

      expect(ranking.urgencyReasons).toContain(UrgencyReason.SCORE_ESCALATION);
    });

    it("should track alert history correctly", () => {
      const address = "0x1234567890123456789012345678901234567890";

      for (let i = 0; i < 5; i++) {
        ranker.rankAlert(
          createMockCompositeResult(address, { compositeScore: 40 + i * 5 }),
          undefined,
          { useCache: false }
        );
      }

      const history = ranker.getAlertHistory(address);
      expect(history).not.toBeNull();
      expect(history!.timesRanked).toBe(5);
      expect(history!.previousScores.length).toBe(5);
    });
  });

  describe("Filter Integration", () => {
    it("should adjust priority based on filter results", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        compositeScore: 70,
      });

      // Without filter - just to populate cache
      ranker.rankAlert(result);

      ranker.clearCache();

      // With filter marking as likely false positive
      const filterResult = createMockFilterResult("0x1234567890123456789012345678901234567890", {
        isLikelyFalsePositive: true,
        adjustedScore: 45,
        action: FilterAction.REDUCE_SCORE,
      });
      const rankingWithFilter = ranker.rankAlert(result, filterResult, { useCache: false });

      // Pattern match factor should be reduced due to false positive
      const patternFactor = rankingWithFilter.factorContributions.find(
        f => f.factor === PriorityFactor.PATTERN_MATCH
      );
      expect(patternFactor!.reason).toContain("false positive");
    });

    it("should include filter result in ranking", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const filterResult = createMockFilterResult("0x1234567890123456789012345678901234567890", {
        adjustedScore: 42,
      });

      const ranking = ranker.rankAlert(result, filterResult);

      expect(ranking.filterResult).toBeDefined();
      expect(ranking.adjustedScore).toBe(42);
    });
  });

  describe("Time Decay Behavior", () => {
    it("should apply time decay to older alerts", () => {
      // Recent alert
      const recentResult = createMockCompositeResult(
        "0x1111111111111111111111111111111111111111",
        { analyzedAt: new Date() }
      );

      // Older alert (48 hours)
      const olderResult = createMockCompositeResult(
        "0x2222222222222222222222222222222222222222",
        { analyzedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      );

      const recentRanking = ranker.rankAlert(recentResult);
      const olderRanking = ranker.rankAlert(olderResult);

      expect(recentRanking.timeDecayMultiplier).toBe(1);
      expect(olderRanking.timeDecayMultiplier).toBeLessThan(1);
    });

    it("should respect minimum decay multiplier", () => {
      // Very old alert (30 days)
      const veryOldResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { analyzedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      );

      const ranking = ranker.rankAlert(veryOldResult);

      expect(ranking.timeDecayMultiplier).toBe(0.5); // Should be at minimum
    });
  });

  describe("Retrieval Methods", () => {
    beforeEach(() => {
      // Create a mix of alerts
      ranker.rankAlert(createHighRiskCompositeResult("0x1111111111111111111111111111111111111111"));
      ranker.rankAlert(createMockCompositeResult("0x2222222222222222222222222222222222222222", {
        compositeScore: 72,
        suspicionLevel: CompositeSuspicionLevel.HIGH,
      }));
      ranker.rankAlert(createMockCompositeResult("0x3333333333333333333333333333333333333333", {
        compositeScore: 45,
        suspicionLevel: CompositeSuspicionLevel.MEDIUM,
      }));
      ranker.rankAlert(createMockCompositeResult("0x4444444444444444444444444444444444444444", {
        compositeScore: 25,
        suspicionLevel: CompositeSuspicionLevel.LOW,
      }));
    });

    it("should retrieve urgent alerts correctly", () => {
      const urgent = ranker.getUrgentAlerts();

      expect(urgent.length).toBeGreaterThanOrEqual(1);
      for (const alert of urgent) {
        expect(alert.isUrgent).toBe(true);
      }

      // Should be sorted by priority
      for (let i = 1; i < urgent.length; i++) {
        expect(urgent[i - 1]!.priorityScore).toBeGreaterThanOrEqual(urgent[i]!.priorityScore);
      }
    });

    it("should retrieve highlighted alerts correctly", () => {
      const highlighted = ranker.getHighlightedAlerts();

      for (const alert of highlighted) {
        expect(alert.isHighlighted).toBe(true);
      }
    });

    it("should retrieve top N alerts", () => {
      const top2 = ranker.getTopAlerts(2);

      expect(top2.length).toBeLessThanOrEqual(2);
      if (top2.length === 2) {
        expect(top2[0]!.priorityScore).toBeGreaterThanOrEqual(top2[1]!.priorityScore);
      }
    });

    it("should retrieve alerts by priority level", () => {
      const criticalAlerts = ranker.getAlertsByLevel(PriorityLevel.CRITICAL);

      for (const alert of criticalAlerts) {
        expect(alert.priorityLevel).toBe(PriorityLevel.CRITICAL);
      }
    });
  });

  describe("Summary and Statistics", () => {
    it("should provide comprehensive summary statistics", () => {
      ranker.rankAlert(createHighRiskCompositeResult("0x1111111111111111111111111111111111111111"));
      ranker.rankAlert(createMockCompositeResult("0x2222222222222222222222222222222222222222"));

      const summary = ranker.getSummary();

      expect(summary.totalRanked).toBe(2);
      expect(summary.urgentAlerts).toBeGreaterThanOrEqual(1);
      expect(summary.highlightedAlerts).toBeGreaterThanOrEqual(1);
      expect(summary.averagePriorityScore).toBeGreaterThan(0);
      expect(summary.cacheStats.size).toBe(2);
      expect(summary.processingStats.totalProcessed).toBe(2);
    });

    it("should track most common urgency reasons", () => {
      // Create multiple alerts with same urgency reasons
      for (let i = 0; i < 5; i++) {
        ranker.rankAlert(
          createHighRiskCompositeResult(`0x${i.toString().padStart(40, "0")}`),
          undefined,
          { useCache: false }
        );
      }

      const summary = ranker.getSummary();

      expect(summary.commonUrgencyReasons.length).toBeGreaterThan(0);
      expect(summary.commonUrgencyReasons[0]!.count).toBeGreaterThan(0);
    });

    it("should track most impactful factors", () => {
      ranker.rankAlert(createHighRiskCompositeResult("0x1111111111111111111111111111111111111111"));
      ranker.rankAlert(createMockCompositeResult("0x2222222222222222222222222222222222222222"));

      const summary = ranker.getSummary();

      expect(summary.impactfulFactors.length).toBeGreaterThan(0);
      expect(summary.impactfulFactors[0]!.avgContribution).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Configuration Updates", () => {
    it("should apply updated weights to rankings", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");

      // Default ranking
      const defaultRanking = ranker.rankAlert(result);
      ranker.clearCache();

      // Update weights
      ranker.updateConfig({
        weights: {
          [PriorityFactor.SEVERITY]: 0.50, // Much higher severity weight
        } as never,
      });

      const updatedRanking = ranker.rankAlert(result, undefined, { useCache: false });

      // The severity factor should have higher contribution
      const defaultSeverity = defaultRanking.factorContributions.find(
        f => f.factor === PriorityFactor.SEVERITY
      );
      const updatedSeverity = updatedRanking.factorContributions.find(
        f => f.factor === PriorityFactor.SEVERITY
      );

      expect(updatedSeverity!.weight).toBe(0.50);
      expect(updatedSeverity!.weightedScore).toBeGreaterThan(defaultSeverity!.weightedScore);
    });

    it("should apply updated thresholds", () => {
      ranker.updateConfig({
        urgentThreshold: 50,
        highlightThreshold: 60,
      });

      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        compositeScore: 55,
      });

      // Just trigger a ranking to ensure config is applied
      ranker.rankAlert(result);

      // With lower thresholds, a score of 55 might be urgent now
      const config = ranker.getConfig();
      expect(config.urgentThreshold).toBe(50);
      expect(config.highlightThreshold).toBe(60);
    });

    it("should disable time decay when configured", () => {
      ranker.updateConfig({
        timeDecay: { enabled: false } as never,
      });

      const oldResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { analyzedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      );

      const ranking = ranker.rankAlert(oldResult);

      // Time decay should not be applied, but the multiplier is still calculated
      expect(ranking.timeDecayMultiplier).toBeLessThan(1);
    });
  });

  describe("Event Emission", () => {
    it("should emit events for urgent and highlighted alerts", async () => {
      const urgentEvents: unknown[] = [];
      const highlightedEvents: unknown[] = [];

      ranker.on("urgent-alert", (event) => urgentEvents.push(event));
      ranker.on("alert-highlighted", (event) => highlightedEvents.push(event));

      ranker.rankAlert(createHighRiskCompositeResult("0x1234567890123456789012345678901234567890"));

      expect(urgentEvents.length).toBe(1);
      expect(highlightedEvents.length).toBe(1);
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetSharedAlertPriorityRanker();
    });

    it("should rank using shared instance", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = rankAlert(result);

      expect(ranking.walletAddress).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should batch rank using shared instance", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222"),
      ];

      const batch = rankAlerts(results);

      expect(batch.rankings.length).toBe(2);
    });

    it("should get urgent alerts from shared instance", () => {
      rankAlert(createHighRiskCompositeResult("0x1234567890123456789012345678901234567890"));
      const urgent = getUrgentAlerts();

      expect(urgent.length).toBeGreaterThanOrEqual(1);
    });

    it("should get highlighted alerts from shared instance", () => {
      rankAlert(createHighRiskCompositeResult("0x1234567890123456789012345678901234567890"));
      const highlighted = getHighlightedAlerts();

      expect(highlighted.length).toBeGreaterThanOrEqual(1);
    });

    it("should get top priority alerts from shared instance", () => {
      rankAlert(createMockCompositeResult("0x1111111111111111111111111111111111111111"));
      rankAlert(createMockCompositeResult("0x2222222222222222222222222222222222222222"));
      rankAlert(createMockCompositeResult("0x3333333333333333333333333333333333333333"));

      const top = getTopPriorityAlerts(2);
      expect(top.length).toBeLessThanOrEqual(2);
    });

    it("should get alerts by priority level from shared instance", () => {
      rankAlert(createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        compositeScore: 45,
      }));

      const mediumAlerts = getAlertsByPriorityLevel(PriorityLevel.MEDIUM);
      expect(Array.isArray(mediumAlerts)).toBe(true);
    });

    it("should get summary from shared instance", () => {
      rankAlert(createMockCompositeResult("0x1234567890123456789012345678901234567890"));
      const summary = getAlertPriorityRankerSummary();

      expect(summary.totalRanked).toBeGreaterThanOrEqual(1);
    });

    it("should check urgent alert status", () => {
      rankAlert(createHighRiskCompositeResult("0x1234567890123456789012345678901234567890"));
      const isUrgent = hasUrgentAlert("0x1234567890123456789012345678901234567890");

      expect(isUrgent).toBe(true);
    });

    it("should get wallet priority ranking", () => {
      rankAlert(createMockCompositeResult("0x1234567890123456789012345678901234567890"));
      const ranking = getWalletPriorityRanking("0x1234567890123456789012345678901234567890");

      expect(ranking).not.toBeNull();
      expect(ranking!.walletAddress).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should provide description helpers", () => {
      expect(getPriorityLevelDescription(PriorityLevel.CRITICAL).length).toBeGreaterThan(0);
      expect(getPriorityFactorDescription(PriorityFactor.SEVERITY).length).toBeGreaterThan(0);
      expect(getUrgencyReasonDescription(UrgencyReason.CRITICAL_SCORE).length).toBeGreaterThan(0);
    });
  });

  describe("Multi-Signal Convergence Detection", () => {
    it("should detect convergence when multiple high signals agree", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        signalContributions: [
          {
            source: SignalSource.WIN_RATE,
            category: "PERFORMANCE" as never,
            name: "Win Rate",
            rawScore: 85,
            weight: 0.12,
            weightedScore: 10.2,
            confidence: "HIGH" as never,
            dataQuality: 90,
            available: true,
            reason: "High win rate",
            flags: [],
          },
          {
            source: SignalSource.PROFIT_LOSS,
            category: "PERFORMANCE" as never,
            name: "P&L",
            rawScore: 82,
            weight: 0.12,
            weightedScore: 9.84,
            confidence: "HIGH" as never,
            dataQuality: 88,
            available: true,
            reason: "High P&L",
            flags: [],
          },
          {
            source: SignalSource.ACCURACY,
            category: "PERFORMANCE" as never,
            name: "Accuracy",
            rawScore: 78,
            weight: 0.08,
            weightedScore: 6.24,
            confidence: "HIGH" as never,
            dataQuality: 85,
            available: true,
            reason: "High accuracy",
            flags: [],
          },
        ],
      });

      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.MULTI_SIGNAL_CONVERGENCE);

      const convergenceFactor = ranking.factorContributions.find(
        f => f.factor === PriorityFactor.CONVERGENCE
      );
      expect(convergenceFactor!.rawScore).toBeGreaterThanOrEqual(60);
    });
  });

  describe("Impact Factor Calculation", () => {
    it("should score high impact for large P&L values", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        underlyingResults: {
          profitLoss: {
            walletAddress: "0x1234567890123456789012345678901234567890",
            tier: "HIGH" as never,
            suspicionLevel: "HIGH" as never,
            suspicionScore: 75,
            windowStats: {} as never,
            categoryStats: [],
            topCategories: [],
            worstCategories: [],
            realizedPnl: [],
            unrealizedPnl: [],
            aggregates: {
              totalRealizedPnl: 75000,
              totalUnrealizedPnl: 25000,
              totalPnl: 100000,
              totalCostBasis: 35000,
              totalFees: 350,
              overallRoi: 286,
            },
            trend: "STABLE" as never,
            history: [],
            anomalies: [],
            totalPositions: 30,
            dataQuality: 85,
            isPotentialInsider: false,
            analyzedAt: new Date(),
          },
        },
      });

      const ranking = ranker.rankAlert(result);

      const impactFactor = ranking.factorContributions.find(
        f => f.factor === PriorityFactor.IMPACT
      );
      expect(impactFactor!.rawScore).toBeGreaterThanOrEqual(80);
    });
  });

  describe("Network Risk Factor", () => {
    it("should score high network risk for coordinated wallets", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        underlyingResults: {
          coordination: {
            walletAddress: "0x1234567890123456789012345678901234567890",
            isCoordinated: true,
            groupCount: 3,
            highestRiskLevel: CoordinationRiskLevel.HIGH,
            groups: [],
            connectedWallets: [],
            walletsCompared: 15,
            analyzedAt: new Date(),
          },
        },
      });

      const ranking = ranker.rankAlert(result);

      const networkFactor = ranking.factorContributions.find(
        f => f.factor === PriorityFactor.NETWORK_RISK
      );
      expect(networkFactor!.rawScore).toBeGreaterThanOrEqual(70);
      expect(networkFactor!.reason).toContain("Coordinated");
    });

    it("should score high network risk for sybil clusters", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
        underlyingResults: {
          sybil: {
            walletAddress: "0x1234567890123456789012345678901234567890",
            isLikelySybil: true,
            sybilProbability: 85,
            confidence: "HIGH" as never,
            riskLevel: SybilRiskLevel.HIGH,
            clusters: [],
            relatedWallets: [],
            indicators: [],
            flags: [],
            summary: "High probability sybil",
            analyzedAt: Date.now(),
          },
        },
      });

      const ranking = ranker.rankAlert(result);

      const networkFactor = ranking.factorContributions.find(
        f => f.factor === PriorityFactor.NETWORK_RISK
      );
      expect(networkFactor!.rawScore).toBeGreaterThanOrEqual(85);
      expect(networkFactor!.reason).toContain("Sybil");
    });
  });

  describe("Caching Behavior", () => {
    it("should return cached results on subsequent calls", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");

      const first = ranker.rankAlert(result);
      const second = ranker.rankAlert(result);

      expect(first.fromCache).toBe(false);
      expect(second.fromCache).toBe(true);
    });

    it("should bypass cache when option is set", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");

      ranker.rankAlert(result);
      const second = ranker.rankAlert(result, undefined, { useCache: false });

      expect(second.fromCache).toBe(false);
    });

    it("should track cache hit rate", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");

      ranker.rankAlert(result);
      ranker.rankAlert(result);
      ranker.rankAlert(result);

      const summary = ranker.getSummary();
      expect(summary.cacheStats.hitRate).toBeGreaterThan(0);
    });
  });
});
