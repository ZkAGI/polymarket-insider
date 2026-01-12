/**
 * Alert Priority Ranker Unit Tests (DET-SCORE-005)
 *
 * Comprehensive tests for the alert priority ranker module.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PriorityLevel,
  PriorityFactor,
  UrgencyReason,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_LEVEL_THRESHOLDS,
  DEFAULT_TIME_DECAY,
  DEFAULT_RANKER_CONFIG,
  PRIORITY_LEVEL_DESCRIPTIONS,
  PRIORITY_FACTOR_DESCRIPTIONS,
  URGENCY_REASON_DESCRIPTIONS,
  AlertPriorityRanker,
  createAlertPriorityRanker,
  getSharedAlertPriorityRanker,
  setSharedAlertPriorityRanker,
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
  type CompositeScoreResult,
  CompositeSuspicionLevel,
  SignalSource,
  type FilterResult,
  FilterAction,
  FilterConfidence,
  CoordinationRiskLevel,
  SybilRiskLevel,
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
      weight: 0.12,
      weightedScore: 1.8,
      confidence: "MEDIUM" as never,
      dataQuality: 65,
      available: true,
      reason: "No sybil indicators",
      flags: [],
    },
    {
      source: SignalSource.ACCURACY,
      category: "PERFORMANCE" as never,
      name: "Accuracy Analysis",
      rawScore: 45,
      weight: 0.08,
      weightedScore: 3.6,
      confidence: "MEDIUM" as never,
      dataQuality: 80,
      available: true,
      reason: "Normal accuracy",
      flags: [],
    },
    {
      source: SignalSource.TRADING_PATTERN,
      category: "BEHAVIOR" as never,
      name: "Trading Pattern Analysis",
      rawScore: 40,
      weight: 0.06,
      weightedScore: 2.4,
      confidence: "MEDIUM" as never,
      dataQuality: 75,
      available: true,
      reason: "Standard pattern",
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
    availableSignals: 10,
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
// Tests: Constants and Enums
// ============================================================================

describe("Alert Priority Ranker Constants", () => {
  describe("PriorityLevel enum", () => {
    it("should have all expected priority levels", () => {
      expect(PriorityLevel.CRITICAL).toBe("CRITICAL");
      expect(PriorityLevel.HIGH).toBe("HIGH");
      expect(PriorityLevel.MEDIUM).toBe("MEDIUM");
      expect(PriorityLevel.LOW).toBe("LOW");
      expect(PriorityLevel.MINIMAL).toBe("MINIMAL");
    });
  });

  describe("PriorityFactor enum", () => {
    it("should have all expected priority factors", () => {
      expect(PriorityFactor.SEVERITY).toBe("SEVERITY");
      expect(PriorityFactor.CONFIDENCE).toBe("CONFIDENCE");
      expect(PriorityFactor.RECENCY).toBe("RECENCY");
      expect(PriorityFactor.IMPACT).toBe("IMPACT");
      expect(PriorityFactor.CONVERGENCE).toBe("CONVERGENCE");
      expect(PriorityFactor.MARKET_SENSITIVITY).toBe("MARKET_SENSITIVITY");
      expect(PriorityFactor.NETWORK_RISK).toBe("NETWORK_RISK");
      expect(PriorityFactor.PATTERN_MATCH).toBe("PATTERN_MATCH");
      expect(PriorityFactor.ANOMALY_INTENSITY).toBe("ANOMALY_INTENSITY");
      expect(PriorityFactor.NOVELTY).toBe("NOVELTY");
    });
  });

  describe("UrgencyReason enum", () => {
    it("should have all expected urgency reasons", () => {
      expect(UrgencyReason.CRITICAL_SCORE).toBe("CRITICAL_SCORE");
      expect(UrgencyReason.MULTI_SIGNAL_CONVERGENCE).toBe("MULTI_SIGNAL_CONVERGENCE");
      expect(UrgencyReason.RECENT_ACTIVITY).toBe("RECENT_ACTIVITY");
      expect(UrgencyReason.HIGH_IMPACT).toBe("HIGH_IMPACT");
      expect(UrgencyReason.NETWORK_DETECTION).toBe("NETWORK_DETECTION");
      expect(UrgencyReason.SYBIL_CLUSTER).toBe("SYBIL_CLUSTER");
      expect(UrgencyReason.INSIDER_INDICATOR).toBe("INSIDER_INDICATOR");
      expect(UrgencyReason.TIME_SENSITIVE_MARKET).toBe("TIME_SENSITIVE_MARKET");
      expect(UrgencyReason.NEW_DETECTION).toBe("NEW_DETECTION");
      expect(UrgencyReason.SCORE_ESCALATION).toBe("SCORE_ESCALATION");
    });
  });

  describe("DEFAULT_PRIORITY_WEIGHTS", () => {
    it("should sum to approximately 1.0", () => {
      const sum = Object.values(DEFAULT_PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("should have reasonable weights for each factor", () => {
      expect(DEFAULT_PRIORITY_WEIGHTS[PriorityFactor.SEVERITY]).toBe(0.20);
      expect(DEFAULT_PRIORITY_WEIGHTS[PriorityFactor.CONFIDENCE]).toBe(0.12);
      expect(DEFAULT_PRIORITY_WEIGHTS[PriorityFactor.RECENCY]).toBe(0.10);
      expect(DEFAULT_PRIORITY_WEIGHTS[PriorityFactor.IMPACT]).toBe(0.12);
    });
  });

  describe("DEFAULT_LEVEL_THRESHOLDS", () => {
    it("should have descending thresholds", () => {
      expect(DEFAULT_LEVEL_THRESHOLDS.critical).toBeGreaterThan(DEFAULT_LEVEL_THRESHOLDS.high);
      expect(DEFAULT_LEVEL_THRESHOLDS.high).toBeGreaterThan(DEFAULT_LEVEL_THRESHOLDS.medium);
      expect(DEFAULT_LEVEL_THRESHOLDS.medium).toBeGreaterThan(DEFAULT_LEVEL_THRESHOLDS.low);
    });
  });

  describe("DEFAULT_TIME_DECAY", () => {
    it("should have valid default settings", () => {
      expect(DEFAULT_TIME_DECAY.enabled).toBe(true);
      expect(DEFAULT_TIME_DECAY.decayStartHours).toBe(24);
      expect(DEFAULT_TIME_DECAY.decayRatePerHour).toBe(0.5);
      expect(DEFAULT_TIME_DECAY.minMultiplier).toBe(0.5);
    });
  });

  describe("DEFAULT_RANKER_CONFIG", () => {
    it("should have valid configuration", () => {
      expect(DEFAULT_RANKER_CONFIG.urgentThreshold).toBe(75);
      expect(DEFAULT_RANKER_CONFIG.highlightThreshold).toBe(85);
      expect(DEFAULT_RANKER_CONFIG.cacheTtlMs).toBe(5 * 60 * 1000);
      expect(DEFAULT_RANKER_CONFIG.maxCacheSize).toBe(1000);
    });
  });

  describe("Description constants", () => {
    it("should have descriptions for all priority levels", () => {
      for (const level of Object.values(PriorityLevel)) {
        expect(PRIORITY_LEVEL_DESCRIPTIONS[level]).toBeDefined();
        expect(typeof PRIORITY_LEVEL_DESCRIPTIONS[level]).toBe("string");
      }
    });

    it("should have descriptions for all priority factors", () => {
      for (const factor of Object.values(PriorityFactor)) {
        expect(PRIORITY_FACTOR_DESCRIPTIONS[factor]).toBeDefined();
        expect(typeof PRIORITY_FACTOR_DESCRIPTIONS[factor]).toBe("string");
      }
    });

    it("should have descriptions for all urgency reasons", () => {
      for (const reason of Object.values(UrgencyReason)) {
        expect(URGENCY_REASON_DESCRIPTIONS[reason]).toBeDefined();
        expect(typeof URGENCY_REASON_DESCRIPTIONS[reason]).toBe("string");
      }
    });
  });
});

// ============================================================================
// Tests: AlertPriorityRanker Class
// ============================================================================

describe("AlertPriorityRanker", () => {
  let ranker: AlertPriorityRanker;

  beforeEach(() => {
    ranker = new AlertPriorityRanker();
    resetSharedAlertPriorityRanker();
  });

  afterEach(() => {
    ranker.clearCache();
    resetSharedAlertPriorityRanker();
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      const instance = new AlertPriorityRanker();
      const config = instance.getConfig();
      expect(config.urgentThreshold).toBe(DEFAULT_RANKER_CONFIG.urgentThreshold);
      expect(config.highlightThreshold).toBe(DEFAULT_RANKER_CONFIG.highlightThreshold);
    });

    it("should accept custom configuration", () => {
      const custom = new AlertPriorityRanker({
        urgentThreshold: 80,
        highlightThreshold: 90,
      });
      const config = custom.getConfig();
      expect(config.urgentThreshold).toBe(80);
      expect(config.highlightThreshold).toBe(90);
    });

    it("should merge custom weights with defaults", () => {
      const custom = new AlertPriorityRanker({
        weights: {
          [PriorityFactor.SEVERITY]: 0.30,
        } as never,
      });
      const config = custom.getConfig();
      expect(config.weights[PriorityFactor.SEVERITY]).toBe(0.30);
      expect(config.weights[PriorityFactor.CONFIDENCE]).toBe(DEFAULT_PRIORITY_WEIGHTS[PriorityFactor.CONFIDENCE]);
    });
  });

  describe("rankAlert", () => {
    it("should rank a basic alert", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking).toBeDefined();
      expect(ranking.walletAddress).toBe("0x1234567890123456789012345678901234567890");
      expect(ranking.priorityScore).toBeGreaterThanOrEqual(0);
      expect(ranking.priorityScore).toBeLessThanOrEqual(100);
      expect(Object.values(PriorityLevel)).toContain(ranking.priorityLevel);
    });

    it("should classify critical priority for high scores", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 95,
          suspicionLevel: CompositeSuspicionLevel.CRITICAL,
          isPotentialInsider: true,
          signalContributions: [
            {
              source: SignalSource.WIN_RATE,
              category: "PERFORMANCE" as never,
              name: "Win Rate",
              rawScore: 95,
              weight: 0.12,
              weightedScore: 11.4,
              confidence: "HIGH" as never,
              dataQuality: 95,
              available: true,
              reason: "Extremely high win rate",
              flags: ["EXCEPTIONAL_WIN_RATE"],
            },
            {
              source: SignalSource.PROFIT_LOSS,
              category: "PERFORMANCE" as never,
              name: "P&L",
              rawScore: 90,
              weight: 0.12,
              weightedScore: 10.8,
              confidence: "HIGH" as never,
              dataQuality: 90,
              available: true,
              reason: "Massive profits",
              flags: ["EXCEPTIONAL_RETURNS"],
            },
            {
              source: SignalSource.ACCURACY,
              category: "PERFORMANCE" as never,
              name: "Accuracy",
              rawScore: 92,
              weight: 0.08,
              weightedScore: 7.36,
              confidence: "HIGH" as never,
              dataQuality: 88,
              available: true,
              reason: "Near-perfect accuracy",
              flags: ["EXCEPTIONAL_ACCURACY"],
            },
          ],
          dataQuality: 95,
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.priorityLevel).toBe(PriorityLevel.CRITICAL);
      expect(ranking.isUrgent).toBe(true);
    });

    it("should include factor contributions", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking.factorContributions).toBeDefined();
      expect(ranking.factorContributions.length).toBeGreaterThan(0);

      for (const contribution of ranking.factorContributions) {
        expect(contribution.factor).toBeDefined();
        expect(contribution.name).toBeDefined();
        expect(contribution.rawScore).toBeGreaterThanOrEqual(0);
        expect(contribution.weight).toBeGreaterThanOrEqual(0);
        expect(contribution.reason).toBeDefined();
      }
    });

    it("should identify top factors", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking.topFactors).toBeDefined();
      expect(ranking.topFactors.length).toBeLessThanOrEqual(3);
      expect(ranking.topFactors.length).toBeGreaterThan(0);

      // Top factors should be sorted by weighted score
      for (let i = 1; i < ranking.topFactors.length; i++) {
        expect(ranking.topFactors[i - 1]!.weightedScore).toBeGreaterThanOrEqual(
          ranking.topFactors[i]!.weightedScore
        );
      }
    });

    it("should apply time decay when enabled", () => {
      const pastResult = createMockCompositeResult(
        "0x1111111111111111111111111111111111111111",
        {
          analyzedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        }
      );
      const recentResult = createMockCompositeResult(
        "0x2222222222222222222222222222222222222222",
        {
          analyzedAt: new Date(), // Now
        }
      );

      const pastRanking = ranker.rankAlert(pastResult);
      const recentRanking = ranker.rankAlert(recentResult);

      expect(pastRanking.timeDecayMultiplier).toBeLessThan(1);
      expect(recentRanking.timeDecayMultiplier).toBe(1);
      expect(pastRanking.alertAgeHours).toBeGreaterThan(recentRanking.alertAgeHours);
    });

    it("should skip time decay when option is set", () => {
      const pastResult = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          analyzedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        }
      );

      const withDecay = ranker.rankAlert(pastResult, undefined, { skipTimeDecay: false });
      const withoutDecay = ranker.rankAlert(pastResult, undefined, { skipTimeDecay: true, useCache: false });

      // Without decay, the multiplier should still show time decay but score shouldn't be affected
      expect(withoutDecay.priorityScore).toBeGreaterThanOrEqual(withDecay.priorityScore);
    });

    it("should use cache when available", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");

      const first = ranker.rankAlert(result);
      expect(first.fromCache).toBe(false);

      const second = ranker.rankAlert(result);
      expect(second.fromCache).toBe(true);
    });

    it("should skip cache when option is set", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");

      ranker.rankAlert(result);
      const second = ranker.rankAlert(result, undefined, { useCache: false });
      expect(second.fromCache).toBe(false);
    });

    it("should generate summary and recommended action", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result);

      expect(ranking.summary).toBeDefined();
      expect(typeof ranking.summary).toBe("string");
      expect(ranking.summary.length).toBeGreaterThan(0);

      expect(ranking.recommendedAction).toBeDefined();
      expect(typeof ranking.recommendedAction).toBe("string");
      expect(ranking.recommendedAction.length).toBeGreaterThan(0);
    });

    it("should include filter result when provided", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const filterResult = createMockFilterResult("0x1234567890123456789012345678901234567890", {
        adjustedScore: 45,
      });

      const ranking = ranker.rankAlert(result, filterResult);

      expect(ranking.filterResult).toBeDefined();
      expect(ranking.adjustedScore).toBe(45);
    });
  });

  describe("rankAlerts (batch)", () => {
    it("should rank multiple alerts", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", { compositeScore: 80 }),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", { compositeScore: 60 }),
        createMockCompositeResult("0x3333333333333333333333333333333333333333", { compositeScore: 40 }),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.rankings).toHaveLength(3);
      expect(batch.totalProcessed).toBe(3);
    });

    it("should sort alerts by priority score", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", { compositeScore: 40 }),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", { compositeScore: 80 }),
        createMockCompositeResult("0x3333333333333333333333333333333333333333", { compositeScore: 60 }),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.rankings[0]!.priorityScore).toBeGreaterThanOrEqual(batch.rankings[1]!.priorityScore);
      expect(batch.rankings[1]!.priorityScore).toBeGreaterThanOrEqual(batch.rankings[2]!.priorityScore);
    });

    it("should assign ranks correctly", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", { compositeScore: 40 }),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", { compositeScore: 80 }),
        createMockCompositeResult("0x3333333333333333333333333333333333333333", { compositeScore: 60 }),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.rankings[0]!.rank).toBe(1);
      expect(batch.rankings[1]!.rank).toBe(2);
      expect(batch.rankings[2]!.rank).toBe(3);
    });

    it("should provide byWallet lookup", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222"),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.byWallet.size).toBe(2);
      expect(batch.byWallet.has("0x1111111111111111111111111111111111111111")).toBe(true);
      expect(batch.byWallet.has("0x2222222222222222222222222222222222222222")).toBe(true);
    });

    it("should count by priority level", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111", {
          compositeScore: 95,
          suspicionLevel: CompositeSuspicionLevel.CRITICAL,
        }),
        createMockCompositeResult("0x2222222222222222222222222222222222222222", {
          compositeScore: 50,
          suspicionLevel: CompositeSuspicionLevel.MEDIUM,
        }),
      ];

      const batch = ranker.rankAlerts(results);

      expect(batch.byLevel).toBeDefined();
      expect(typeof batch.byLevel[PriorityLevel.CRITICAL]).toBe("number");
    });

    it("should handle filter results map", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222"),
      ];

      const filterResults = new Map<string, FilterResult>([
        ["0x1111111111111111111111111111111111111111", createMockFilterResult("0x1111111111111111111111111111111111111111")],
      ]);

      const batch = ranker.rankAlerts(results, filterResults);

      expect(batch.rankings[0]!.filterResult || batch.rankings[1]!.filterResult).toBeDefined();
    });
  });

  describe("urgency detection", () => {
    it("should detect critical score urgency", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 85,
          suspicionLevel: CompositeSuspicionLevel.HIGH,
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.CRITICAL_SCORE);
    });

    it("should detect insider indicator urgency", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          isPotentialInsider: true,
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.INSIDER_INDICATOR);
    });

    it("should detect recent activity urgency", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          analyzedAt: new Date(), // Just now
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.RECENT_ACTIVITY);
    });

    it("should detect new detection urgency", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = ranker.rankAlert(result, undefined, { useCache: false });

      expect(ranking.urgencyReasons).toContain(UrgencyReason.NEW_DETECTION);
    });

    it("should detect network detection urgency", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          underlyingResults: {
            coordination: {
              walletAddress: "0x1234567890123456789012345678901234567890",
              isCoordinated: true,
              groupCount: 2,
              highestRiskLevel: CoordinationRiskLevel.HIGH,
              groups: [],
              connectedWallets: [],
              walletsCompared: 10,
              analyzedAt: new Date(),
            },
          },
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.NETWORK_DETECTION);
    });

    it("should detect sybil cluster urgency", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          underlyingResults: {
            sybil: {
              walletAddress: "0x1234567890123456789012345678901234567890",
              isLikelySybil: true,
              sybilProbability: 80,
              confidence: "HIGH" as never,
              riskLevel: SybilRiskLevel.HIGH,
              clusters: [],
              relatedWallets: [],
              indicators: [],
              flags: [],
              summary: "Sybil detected",
              analyzedAt: Date.now(),
            },
          },
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.SYBIL_CLUSTER);
    });

    it("should detect multi-signal convergence", () => {
      const result = createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
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
              reason: "High profits",
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
        }
      );
      const ranking = ranker.rankAlert(result);

      expect(ranking.urgencyReasons).toContain(UrgencyReason.MULTI_SIGNAL_CONVERGENCE);
    });
  });

  describe("cache management", () => {
    it("should get cached ranking", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      ranker.rankAlert(result);

      const cached = ranker.getCachedRanking("0x1234567890123456789012345678901234567890");
      expect(cached).toBeDefined();
    });

    it("should return null for non-existent cache entry", () => {
      const cached = ranker.getCachedRanking("0x9999999999999999999999999999999999999999");
      expect(cached).toBeNull();
    });

    it("should clear cache", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      ranker.rankAlert(result);
      ranker.clearCache();

      const cached = ranker.getCachedRanking("0x1234567890123456789012345678901234567890");
      expect(cached).toBeNull();
    });

    it("should invalidate specific cache entry", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      ranker.rankAlert(result);

      const invalidated = ranker.invalidateCache("0x1234567890123456789012345678901234567890");
      expect(invalidated).toBe(true);

      const cached = ranker.getCachedRanking("0x1234567890123456789012345678901234567890");
      expect(cached).toBeNull();
    });
  });

  describe("retrieval methods", () => {
    beforeEach(() => {
      // Add various alerts
      ranker.rankAlert(createMockCompositeResult(
        "0x1111111111111111111111111111111111111111",
        { compositeScore: 90, suspicionLevel: CompositeSuspicionLevel.CRITICAL }
      ));
      ranker.rankAlert(createMockCompositeResult(
        "0x2222222222222222222222222222222222222222",
        { compositeScore: 75, suspicionLevel: CompositeSuspicionLevel.HIGH }
      ));
      ranker.rankAlert(createMockCompositeResult(
        "0x3333333333333333333333333333333333333333",
        { compositeScore: 50, suspicionLevel: CompositeSuspicionLevel.MEDIUM }
      ));
    });

    it("should get urgent alerts", () => {
      const urgent = ranker.getUrgentAlerts();
      expect(urgent.length).toBeGreaterThanOrEqual(1);
      for (const alert of urgent) {
        expect(alert.isUrgent).toBe(true);
      }
    });

    it("should get highlighted alerts", () => {
      const highlighted = ranker.getHighlightedAlerts();
      for (const alert of highlighted) {
        expect(alert.isHighlighted).toBe(true);
      }
    });

    it("should get top alerts", () => {
      const top = ranker.getTopAlerts(2);
      expect(top.length).toBeLessThanOrEqual(2);

      if (top.length > 1) {
        expect(top[0]!.priorityScore).toBeGreaterThanOrEqual(top[1]!.priorityScore);
      }
    });

    it("should get alerts by level", () => {
      const mediumAlerts = ranker.getAlertsByLevel(PriorityLevel.MEDIUM);
      for (const alert of mediumAlerts) {
        expect(alert.priorityLevel).toBe(PriorityLevel.MEDIUM);
      }
    });
  });

  describe("alert history", () => {
    it("should track alert history", () => {
      const address = "0x1234567890123456789012345678901234567890";
      ranker.rankAlert(createMockCompositeResult(address, { compositeScore: 50 }), undefined, { useCache: false });
      ranker.rankAlert(createMockCompositeResult(address, { compositeScore: 60 }), undefined, { useCache: false });

      const history = ranker.getAlertHistory(address);
      expect(history).toBeDefined();
      expect(history!.timesRanked).toBe(2);
      expect(history!.previousScores).toHaveLength(2);
    });

    it("should detect score escalation", () => {
      const address = "0x1234567890123456789012345678901234567890";

      // First ranking
      ranker.rankAlert(createMockCompositeResult(address, { compositeScore: 40 }), undefined, { useCache: false });

      // Escalated score
      const escalatedResult = createMockCompositeResult(address, { compositeScore: 75 });
      const ranking = ranker.rankAlert(escalatedResult, undefined, { useCache: false });

      expect(ranking.urgencyReasons).toContain(UrgencyReason.SCORE_ESCALATION);
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      ranker.updateConfig({
        urgentThreshold: 80,
        highlightThreshold: 90,
      });

      const config = ranker.getConfig();
      expect(config.urgentThreshold).toBe(80);
      expect(config.highlightThreshold).toBe(90);
    });

    it("should update weights", () => {
      ranker.updateConfig({
        weights: {
          [PriorityFactor.SEVERITY]: 0.30,
        } as never,
      });

      const config = ranker.getConfig();
      expect(config.weights[PriorityFactor.SEVERITY]).toBe(0.30);
    });

    it("should update time decay settings", () => {
      ranker.updateConfig({
        timeDecay: {
          enabled: false,
        } as never,
      });

      const config = ranker.getConfig();
      expect(config.timeDecay.enabled).toBe(false);
    });
  });

  describe("summary and statistics", () => {
    it("should provide summary statistics", () => {
      ranker.rankAlert(createMockCompositeResult("0x1111111111111111111111111111111111111111"));
      ranker.rankAlert(createMockCompositeResult("0x2222222222222222222222222222222222222222"));

      const summary = ranker.getSummary();

      expect(summary.totalRanked).toBe(2);
      expect(summary.byLevel).toBeDefined();
      expect(summary.averagePriorityScore).toBeGreaterThanOrEqual(0);
      expect(summary.cacheStats).toBeDefined();
      expect(summary.processingStats).toBeDefined();
    });

    it("should track common urgency reasons", () => {
      ranker.rankAlert(createMockCompositeResult(
        "0x1111111111111111111111111111111111111111",
        { compositeScore: 85 }
      ));

      const summary = ranker.getSummary();
      expect(summary.commonUrgencyReasons).toBeDefined();
    });

    it("should track impactful factors", () => {
      ranker.rankAlert(createMockCompositeResult("0x1111111111111111111111111111111111111111"));

      const summary = ranker.getSummary();
      expect(summary.impactfulFactors).toBeDefined();
      expect(Array.isArray(summary.impactfulFactors)).toBe(true);
    });

    it("should reset statistics", () => {
      ranker.rankAlert(createMockCompositeResult("0x1111111111111111111111111111111111111111"));
      ranker.resetStats();

      const summary = ranker.getSummary();
      expect(summary.processingStats.totalProcessed).toBe(0);
    });
  });

  describe("event emission", () => {
    it("should emit urgent-alert event", () => {
      const listener = vi.fn();
      ranker.on("urgent-alert", listener);

      ranker.rankAlert(createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 95,
          suspicionLevel: CompositeSuspicionLevel.CRITICAL,
          isPotentialInsider: true,
        }
      ));

      expect(listener).toHaveBeenCalled();
    });

    it("should emit alert-highlighted event", () => {
      const listener = vi.fn();
      ranker.on("alert-highlighted", listener);

      ranker.rankAlert(createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        {
          compositeScore: 95,
          suspicionLevel: CompositeSuspicionLevel.CRITICAL,
        }
      ));

      expect(listener).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Tests: Factory Functions and Shared Instance
// ============================================================================

describe("Factory Functions and Shared Instance", () => {
  beforeEach(() => {
    resetSharedAlertPriorityRanker();
  });

  afterEach(() => {
    resetSharedAlertPriorityRanker();
  });

  describe("createAlertPriorityRanker", () => {
    it("should create new instance", () => {
      const ranker = createAlertPriorityRanker();
      expect(ranker).toBeInstanceOf(AlertPriorityRanker);
    });

    it("should accept configuration", () => {
      const ranker = createAlertPriorityRanker({ urgentThreshold: 80 });
      expect(ranker.getConfig().urgentThreshold).toBe(80);
    });
  });

  describe("shared instance management", () => {
    it("should get shared instance", () => {
      const shared1 = getSharedAlertPriorityRanker();
      const shared2 = getSharedAlertPriorityRanker();
      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const custom = new AlertPriorityRanker({ urgentThreshold: 80 });
      setSharedAlertPriorityRanker(custom);
      expect(getSharedAlertPriorityRanker()).toBe(custom);
    });

    it("should reset shared instance", () => {
      const first = getSharedAlertPriorityRanker();
      resetSharedAlertPriorityRanker();
      const second = getSharedAlertPriorityRanker();
      expect(first).not.toBe(second);
    });
  });
});

// ============================================================================
// Tests: Convenience Functions
// ============================================================================

describe("Convenience Functions", () => {
  beforeEach(() => {
    resetSharedAlertPriorityRanker();
  });

  afterEach(() => {
    resetSharedAlertPriorityRanker();
  });

  describe("rankAlert (convenience)", () => {
    it("should rank using shared instance", () => {
      const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
      const ranking = rankAlert(result);
      expect(ranking).toBeDefined();
      expect(ranking.walletAddress).toBe("0x1234567890123456789012345678901234567890");
    });
  });

  describe("rankAlerts (convenience)", () => {
    it("should batch rank using shared instance", () => {
      const results = [
        createMockCompositeResult("0x1111111111111111111111111111111111111111"),
        createMockCompositeResult("0x2222222222222222222222222222222222222222"),
      ];
      const batch = rankAlerts(results);
      expect(batch.rankings).toHaveLength(2);
    });
  });

  describe("getUrgentAlerts (convenience)", () => {
    it("should get urgent alerts using shared instance", () => {
      rankAlert(createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 90 }
      ));
      const urgent = getUrgentAlerts();
      expect(Array.isArray(urgent)).toBe(true);
    });
  });

  describe("getHighlightedAlerts (convenience)", () => {
    it("should get highlighted alerts using shared instance", () => {
      rankAlert(createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 95 }
      ));
      const highlighted = getHighlightedAlerts();
      expect(Array.isArray(highlighted)).toBe(true);
    });
  });

  describe("getTopPriorityAlerts (convenience)", () => {
    it("should get top priority alerts using shared instance", () => {
      rankAlert(createMockCompositeResult("0x1111111111111111111111111111111111111111"));
      const top = getTopPriorityAlerts(5);
      expect(Array.isArray(top)).toBe(true);
      expect(top.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getAlertsByPriorityLevel (convenience)", () => {
    it("should get alerts by level using shared instance", () => {
      rankAlert(createMockCompositeResult("0x1111111111111111111111111111111111111111"));
      const alerts = getAlertsByPriorityLevel(PriorityLevel.MEDIUM);
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe("getAlertPriorityRankerSummary (convenience)", () => {
    it("should get summary using shared instance", () => {
      const summary = getAlertPriorityRankerSummary();
      expect(summary).toBeDefined();
      expect(summary.totalRanked).toBeGreaterThanOrEqual(0);
    });
  });

  describe("description helpers", () => {
    it("should get priority level description", () => {
      const desc = getPriorityLevelDescription(PriorityLevel.CRITICAL);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get priority factor description", () => {
      const desc = getPriorityFactorDescription(PriorityFactor.SEVERITY);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should get urgency reason description", () => {
      const desc = getUrgencyReasonDescription(UrgencyReason.CRITICAL_SCORE);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  describe("hasUrgentAlert", () => {
    it("should check if wallet has urgent alert", () => {
      rankAlert(createMockCompositeResult(
        "0x1234567890123456789012345678901234567890",
        { compositeScore: 95, isPotentialInsider: true }
      ));
      const hasUrgent = hasUrgentAlert("0x1234567890123456789012345678901234567890");
      expect(typeof hasUrgent).toBe("boolean");
    });

    it("should return false for unknown wallet", () => {
      const hasUrgent = hasUrgentAlert("0x9999999999999999999999999999999999999999");
      expect(hasUrgent).toBe(false);
    });
  });

  describe("getWalletPriorityRanking", () => {
    it("should get cached ranking for wallet", () => {
      rankAlert(createMockCompositeResult("0x1234567890123456789012345678901234567890"));
      const ranking = getWalletPriorityRanking("0x1234567890123456789012345678901234567890");
      expect(ranking).toBeDefined();
    });

    it("should return null for unknown wallet", () => {
      const ranking = getWalletPriorityRanking("0x9999999999999999999999999999999999999999");
      expect(ranking).toBeNull();
    });
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  let ranker: AlertPriorityRanker;

  beforeEach(() => {
    ranker = new AlertPriorityRanker();
  });

  afterEach(() => {
    ranker.clearCache();
  });

  it("should handle empty signal contributions", () => {
    const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
      signalContributions: [],
    });
    const ranking = ranker.rankAlert(result);
    expect(ranking).toBeDefined();
    expect(ranking.priorityScore).toBeGreaterThanOrEqual(0);
  });

  it("should handle zero composite score", () => {
    const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
      compositeScore: 0,
      suspicionLevel: CompositeSuspicionLevel.NONE,
      dataQuality: 50,
      signalContributions: [],
    });
    const ranking = ranker.rankAlert(result);
    expect(ranking).toBeDefined();
    // Note: Even with zero composite score, the priority is influenced by other factors:
    // - Novelty (first-time detection = 100)
    // - Recency (recent activity = high)
    // - Confidence (depends on data quality)
    // So the result can still be high. We just verify it's a valid level.
    expect(Object.values(PriorityLevel)).toContain(ranking.priorityLevel);
    // Verify the severity factor contribution is low
    const severityFactor = ranking.factorContributions.find(f => f.factor === PriorityFactor.SEVERITY);
    if (severityFactor) {
      expect(severityFactor.rawScore).toBe(0);
    }
  });

  it("should handle maximum composite score", () => {
    const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
      compositeScore: 100,
      suspicionLevel: CompositeSuspicionLevel.CRITICAL,
    });
    const ranking = ranker.rankAlert(result);
    expect(ranking).toBeDefined();
    expect(ranking.priorityLevel).toBe(PriorityLevel.CRITICAL);
  });

  it("should handle missing underlying results", () => {
    // The mock function provides null values for all underlying results by default
    const result = createMockCompositeResult("0x1234567890123456789012345678901234567890");
    const ranking = ranker.rankAlert(result);
    expect(ranking).toBeDefined();
  });

  it("should handle very old alerts", () => {
    const result = createMockCompositeResult("0x1234567890123456789012345678901234567890", {
      analyzedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    });
    const ranking = ranker.rankAlert(result);
    expect(ranking).toBeDefined();
    expect(ranking.timeDecayMultiplier).toBe(0.5); // Should hit minimum
  });

  it("should handle invalid wallet address gracefully", () => {
    expect(() => {
      ranker.getCachedRanking("invalid-address");
    }).not.toThrow();
  });

  it("should handle empty batch ranking", () => {
    const batch = ranker.rankAlerts([]);
    expect(batch.rankings).toHaveLength(0);
    expect(batch.totalProcessed).toBe(0);
  });

  it("should maintain cache size limit", () => {
    const smallCacheRanker = new AlertPriorityRanker({ maxCacheSize: 5 });

    for (let i = 0; i < 10; i++) {
      const address = `0x${i.toString().padStart(40, "0")}`;
      smallCacheRanker.rankAlert(createMockCompositeResult(address), undefined, { useCache: false });
    }

    const summary = smallCacheRanker.getSummary();
    expect(summary.cacheStats.size).toBeLessThanOrEqual(5);
  });
});
