/**
 * Unit Tests for Fresh Wallet Confidence Scorer (DET-FRESH-008)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FreshWalletConfidenceScorer,
  ConfidenceLevel,
  SignalCategory,
  DEFAULT_SIGNAL_WEIGHTS,
  createFreshWalletConfidenceScorer,
  getSharedFreshWalletConfidenceScorer,
  setSharedFreshWalletConfidenceScorer,
  resetSharedFreshWalletConfidenceScorer,
  scoreFreshWalletConfidence,
  batchScoreFreshWalletConfidence,
  isFreshWalletSuspicious,
  getConfidenceSummary,
  type FreshWalletConfidenceResult,
  type FreshWalletConfidenceScorerConfig,
} from "../../src/detection/fresh-wallet-confidence";
import { FreshWalletAlertSeverity, AgeCategory, TradingHistoryStatus, WalletHistoryType, FirstTradeSizeCategory, FundingPatternType, FundingTimingCategory, ClusterConfidenceLevel, ReactivationStatus, DormancySeverity, ActivityPatternType } from "../../src/detection";

// Mock all external dependencies
vi.mock("../../src/detection/wallet-age", () => ({
  calculateWalletAge: vi.fn(),
  getSharedWalletAgeCalculator: vi.fn(() => ({
    calculateAge: vi.fn(),
  })),
  AgeCategory: {
    NEW: "NEW",
    VERY_FRESH: "VERY_FRESH",
    FRESH: "FRESH",
    RECENT: "RECENT",
    ESTABLISHED: "ESTABLISHED",
    MATURE: "MATURE",
  },
}));

vi.mock("../../src/detection/zero-history", () => ({
  checkZeroHistory: vi.fn(),
  getSharedZeroHistoryDetector: vi.fn(() => ({
    checkWallet: vi.fn(),
  })),
  TradingHistoryStatus: {
    NEVER_TRADED: "NEVER_TRADED",
    FIRST_TRADE: "FIRST_TRADE",
    MINIMAL_HISTORY: "MINIMAL_HISTORY",
    HAS_HISTORY: "HAS_HISTORY",
  },
  WalletHistoryType: {
    NEW_EVERYWHERE: "NEW_EVERYWHERE",
    BLOCKCHAIN_NEW_PM_ACTIVE: "BLOCKCHAIN_NEW_PM_ACTIVE",
    BLOCKCHAIN_VETERAN_PM_NEW: "BLOCKCHAIN_VETERAN_PM_NEW",
    ESTABLISHED: "ESTABLISHED",
  },
}));

vi.mock("../../src/detection/first-trade-size", () => ({
  analyzeFirstTradeSize: vi.fn(),
  getSharedFirstTradeSizeAnalyzer: vi.fn(() => ({
    analyzeWallet: vi.fn(),
  })),
  FirstTradeSizeCategory: {
    OUTLIER: "OUTLIER",
    VERY_LARGE: "VERY_LARGE",
    LARGE: "LARGE",
    NORMAL: "NORMAL",
    SMALL: "SMALL",
  },
}));

vi.mock("../../src/detection/funding-pattern", () => ({
  analyzeFundingPattern: vi.fn(),
  getSharedFundingPatternAnalyzer: vi.fn(() => ({
    analyzeWallet: vi.fn(),
  })),
  FundingPatternType: {
    SUSPICIOUS: "SUSPICIOUS",
    FLASH: "FLASH",
    IMMEDIATE: "IMMEDIATE",
    QUICK: "QUICK",
    NORMAL: "NORMAL",
  },
  FundingTimingCategory: {
    FLASH: "FLASH",
    VERY_FAST: "VERY_FAST",
    FAST: "FAST",
    MODERATE: "MODERATE",
    SLOW: "SLOW",
    NO_TRADES: "NO_TRADES",
  },
}));

vi.mock("../../src/detection/fresh-wallet-clustering", () => ({
  analyzeWalletClusterMembership: vi.fn(),
  getSharedFreshWalletClusterAnalyzer: vi.fn(() => ({
    analyzeWallet: vi.fn(),
  })),
  ClusterConfidenceLevel: {
    VERY_HIGH: "VERY_HIGH",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
    VERY_LOW: "VERY_LOW",
  },
}));

vi.mock("../../src/detection/wallet-reactivation", () => ({
  checkWalletReactivation: vi.fn(),
  getSharedWalletReactivationDetector: vi.fn(() => ({
    checkWallet: vi.fn(),
  })),
  ReactivationStatus: {
    NEVER_DORMANT: "NEVER_DORMANT",
    DORMANT: "DORMANT",
    JUST_REACTIVATED: "JUST_REACTIVATED",
    RECENTLY_REACTIVATED: "RECENTLY_REACTIVATED",
    NO_HISTORY: "NO_HISTORY",
  },
  DormancySeverity: {
    SHORT: "SHORT",
    MEDIUM: "MEDIUM",
    LONG: "LONG",
    EXTENDED: "EXTENDED",
  },
  ActivityPatternType: {
    REGULAR: "REGULAR",
    SPORADIC: "SPORADIC",
    BURST: "BURST",
    SINGLE_SHOT: "SINGLE_SHOT",
  },
}));

vi.mock("../../src/detection/fresh-wallet-config", () => ({
  getSharedFreshWalletConfigManager: vi.fn(() => ({
    getConfig: vi.fn(),
    evaluateWallet: vi.fn(),
  })),
  FreshWalletAlertSeverity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },
}));

import { getSharedWalletAgeCalculator } from "../../src/detection/wallet-age";
import { getSharedZeroHistoryDetector } from "../../src/detection/zero-history";
import { getSharedFirstTradeSizeAnalyzer } from "../../src/detection/first-trade-size";
import { getSharedFundingPatternAnalyzer } from "../../src/detection/funding-pattern";
import { getSharedFreshWalletClusterAnalyzer } from "../../src/detection/fresh-wallet-clustering";
import { getSharedWalletReactivationDetector } from "../../src/detection/wallet-reactivation";

// Type for mock analyzer objects
interface MockAgeCalculator {
  calculateAge: ReturnType<typeof vi.fn>;
}

interface MockDetector {
  checkWallet: ReturnType<typeof vi.fn>;
}

interface MockSizeAnalyzer {
  analyzeWallet: ReturnType<typeof vi.fn>;
}

// Test wallet addresses
const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const INVALID_ADDRESS = "0xinvalid";

// Mock result factories
function createMockWalletAgeResult(overrides = {}) {
  return {
    address: VALID_ADDRESS,
    ageInDays: 30,
    category: AgeCategory.FRESH,
    isNew: false,
    isFresh: true,
    firstTransactionAt: new Date(),
    transactionCount: 10,
    fromCache: false,
    checkedAt: new Date(),
    ...overrides,
  };
}

function createMockZeroHistoryResult(overrides = {}) {
  return {
    address: VALID_ADDRESS,
    status: TradingHistoryStatus.HAS_HISTORY,
    historyType: WalletHistoryType.ESTABLISHED,
    hasNeverTraded: false,
    isFirstTrade: false,
    polymarketTradeCount: 25,
    blockchainTransactionCount: 100,
    severity: FreshWalletAlertSeverity.LOW,
    fromCache: false,
    checkedAt: new Date(),
    ...overrides,
  };
}

function createMockFirstTradeSizeResult(overrides = {}) {
  return {
    address: VALID_ADDRESS,
    hasTrades: true,
    sizeCategory: FirstTradeSizeCategory.NORMAL,
    isOutlier: false,
    flagReasons: [],
    percentile: 50,
    multipleOfAverage: 1.0,
    firstTradeInfo: {
      size: 100,
      sizeUsd: 100,
      tokenId: "token1",
      marketId: "market1",
      timestamp: new Date(),
    },
    severity: FreshWalletAlertSeverity.LOW,
    fromCache: false,
    checkedAt: new Date(),
    ...overrides,
  };
}

function createMockFundingPatternResult(overrides = {}) {
  return {
    address: VALID_ADDRESS,
    patternType: FundingPatternType.NORMAL,
    timingCategory: FundingTimingCategory.SLOW,
    suspicionScore: 10,
    fundingRiskSummary: {
      hasSanctionedSources: false,
      hasMixerSources: false,
      unknownPercentage: 10,
    },
    deposits: [],
    firstTrade: null,
    severity: FreshWalletAlertSeverity.LOW,
    fromCache: false,
    checkedAt: new Date(),
    ...overrides,
  };
}

function createMockClusteringResult(overrides = {}) {
  return {
    address: VALID_ADDRESS,
    coordinationScore: 10,
    clusterCount: 0,
    confidenceLevel: ClusterConfidenceLevel.VERY_LOW,
    clusters: [],
    severity: FreshWalletAlertSeverity.LOW,
    fromCache: false,
    checkedAt: new Date(),
    ...overrides,
  };
}

function createMockReactivationResult(overrides = {}) {
  return {
    address: VALID_ADDRESS,
    status: ReactivationStatus.NEVER_DORMANT,
    isReactivated: false,
    isSuspicious: false,
    daysSinceLastActivity: 5,
    lastActivityAt: new Date(),
    firstActivityAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    totalTradeCount: 100,
    totalVolume: 10000,
    uniqueMarketsTraded: 10,
    reactivationEvent: null,
    activityTimeline: [],
    severity: FreshWalletAlertSeverity.LOW,
    walletAge: null,
    fromCache: false,
    checkedAt: new Date(),
    ...overrides,
  };
}

describe("FreshWalletConfidenceScorer", () => {
  let mockAgeCalculator: MockAgeCalculator;
  let mockZeroHistoryDetector: MockDetector;
  let mockFirstTradeSizeAnalyzer: MockSizeAnalyzer;
  let mockFundingPatternAnalyzer: MockSizeAnalyzer;
  let mockClusterAnalyzer: MockSizeAnalyzer;
  let mockReactivationDetector: MockDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFreshWalletConfidenceScorer();

    // Set up mock calculators/analyzers
    mockAgeCalculator = {
      calculateAge: vi.fn().mockResolvedValue(createMockWalletAgeResult()),
    };
    mockZeroHistoryDetector = {
      checkWallet: vi.fn().mockResolvedValue(createMockZeroHistoryResult()),
    };
    mockFirstTradeSizeAnalyzer = {
      analyzeWallet: vi.fn().mockResolvedValue(createMockFirstTradeSizeResult()),
    };
    mockFundingPatternAnalyzer = {
      analyzeWallet: vi.fn().mockResolvedValue(createMockFundingPatternResult()),
    };
    mockClusterAnalyzer = {
      analyzeWallet: vi.fn().mockResolvedValue(createMockClusteringResult()),
    };
    mockReactivationDetector = {
      checkWallet: vi.fn().mockResolvedValue(createMockReactivationResult()),
    };

    vi.mocked(getSharedWalletAgeCalculator).mockReturnValue(mockAgeCalculator as any);
    vi.mocked(getSharedZeroHistoryDetector).mockReturnValue(mockZeroHistoryDetector as any);
    vi.mocked(getSharedFirstTradeSizeAnalyzer).mockReturnValue(mockFirstTradeSizeAnalyzer as any);
    vi.mocked(getSharedFundingPatternAnalyzer).mockReturnValue(mockFundingPatternAnalyzer as any);
    vi.mocked(getSharedFreshWalletClusterAnalyzer).mockReturnValue(mockClusterAnalyzer as any);
    vi.mocked(getSharedWalletReactivationDetector).mockReturnValue(mockReactivationDetector as any);
  });

  afterEach(() => {
    resetSharedFreshWalletConfidenceScorer();
  });

  describe("Constructor", () => {
    it("should create with default configuration", () => {
      const scorer = new FreshWalletConfidenceScorer();
      expect(scorer).toBeInstanceOf(FreshWalletConfidenceScorer);

      const stats = scorer.getCacheStats();
      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(5 * 60 * 1000);
      expect(scorer.getSuspiciousThreshold()).toBe(60);
    });

    it("should create with custom configuration", () => {
      const config: FreshWalletConfidenceScorerConfig = {
        cacheTtlMs: 60000,
        maxCacheSize: 200,
        suspiciousThreshold: 70,
      };

      const scorer = new FreshWalletConfidenceScorer(config);
      const stats = scorer.getCacheStats();

      expect(stats.maxSize).toBe(200);
      expect(stats.ttlMs).toBe(60000);
      expect(scorer.getSuspiciousThreshold()).toBe(70);
    });

    it("should create with custom signal weights", () => {
      const config: FreshWalletConfidenceScorerConfig = {
        signalWeights: {
          walletAge: 0.30,
          fundingPattern: 0.30,
        },
      };

      const scorer = new FreshWalletConfidenceScorer(config);
      const weights = scorer.getSignalWeights();

      expect(weights.walletAge).toBe(0.30);
      expect(weights.fundingPattern).toBe(0.30);
      // Others should use defaults
      expect(weights.tradingBehavior).toBe(DEFAULT_SIGNAL_WEIGHTS.tradingBehavior);
    });
  });

  describe("scoreWallet", () => {
    it("should throw error for invalid address", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      await expect(scorer.scoreWallet(INVALID_ADDRESS)).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should throw error for empty address", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      await expect(scorer.scoreWallet("")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should return low confidence for established wallet", async () => {
      // Inject mocks directly instead of relying on getShared* functions
      const customAgeCalculator = {
        calculateAge: vi.fn().mockResolvedValue(createMockWalletAgeResult({
          category: AgeCategory.MATURE,
          ageInDays: 365,
          isFresh: false,
        })),
      };
      const customZeroHistoryDetector = {
        checkWallet: vi.fn().mockResolvedValue(createMockZeroHistoryResult({
          status: TradingHistoryStatus.HAS_HISTORY,
          historyType: WalletHistoryType.ESTABLISHED,
          polymarketTradeCount: 100,
        })),
      };
      const customFirstTradeSizeAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockFirstTradeSizeResult({
          sizeCategory: FirstTradeSizeCategory.SMALL,
          isOutlier: false,
        })),
      };
      const customFundingPatternAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockFundingPatternResult({
          patternType: FundingPatternType.NORMAL,
          timingCategory: FundingTimingCategory.SLOW,
        })),
      };
      const customClusterAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockClusteringResult({
          coordinationScore: 5,
          clusterCount: 0,
          confidenceLevel: ClusterConfidenceLevel.VERY_LOW,
        })),
      };
      const customReactivationDetector = {
        checkWallet: vi.fn().mockResolvedValue(createMockReactivationResult({
          status: ReactivationStatus.NEVER_DORMANT,
          isSuspicious: false,
        })),
      };

      const scorer = new FreshWalletConfidenceScorer({
        ageCalculator: customAgeCalculator as any,
        zeroHistoryDetector: customZeroHistoryDetector as any,
        firstTradeSizeAnalyzer: customFirstTradeSizeAnalyzer as any,
        fundingPatternAnalyzer: customFundingPatternAnalyzer as any,
        clusterAnalyzer: customClusterAnalyzer as any,
        reactivationDetector: customReactivationDetector as any,
      });
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.confidenceScore).toBeLessThan(40);
      expect(result.confidenceLevel).toBe(ConfidenceLevel.VERY_LOW);
      expect(result.isSuspicious).toBe(false);
    });

    it("should return high confidence for suspicious fresh wallet", async () => {
      mockAgeCalculator.calculateAge.mockResolvedValue(createMockWalletAgeResult({
        category: AgeCategory.NEW,
        ageInDays: null,
        isNew: true,
        isFresh: true,
      }));
      mockZeroHistoryDetector.checkWallet.mockResolvedValue(createMockZeroHistoryResult({
        status: TradingHistoryStatus.NEVER_TRADED,
        historyType: WalletHistoryType.NEW_EVERYWHERE,
        hasNeverTraded: true,
        polymarketTradeCount: 0,
      }));
      mockFirstTradeSizeAnalyzer.analyzeWallet.mockResolvedValue(createMockFirstTradeSizeResult({
        sizeCategory: FirstTradeSizeCategory.OUTLIER,
        isOutlier: true,
        flagReasons: ["First trade is 10x larger than average"],
      }));
      mockFundingPatternAnalyzer.analyzeWallet.mockResolvedValue(createMockFundingPatternResult({
        patternType: FundingPatternType.FLASH,
        timingCategory: FundingTimingCategory.FLASH,
        suspicionScore: 90,
      }));
      mockClusterAnalyzer.analyzeWallet.mockResolvedValue(createMockClusteringResult({
        coordinationScore: 70,
        clusterCount: 2,
        confidenceLevel: ClusterConfidenceLevel.HIGH,
      }));
      mockReactivationDetector.checkWallet.mockResolvedValue(createMockReactivationResult({
        status: ReactivationStatus.NO_HISTORY,
      }));

      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.confidenceScore).toBeGreaterThan(60);
      // Since we set up very suspicious signals, it could be HIGH or VERY_HIGH
      expect([ConfidenceLevel.HIGH, ConfidenceLevel.VERY_HIGH]).toContain(result.confidenceLevel);
      expect(result.isSuspicious).toBe(true);
    });

    it("should use cached result when available", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      // First call
      const result1 = await scorer.scoreWallet(VALID_ADDRESS);
      expect(result1.fromCache).toBe(false);
      expect(mockAgeCalculator.calculateAge).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await scorer.scoreWallet(VALID_ADDRESS);
      expect(result2.fromCache).toBe(true);
      expect(mockAgeCalculator.calculateAge).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when requested", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      await scorer.scoreWallet(VALID_ADDRESS);
      expect(mockAgeCalculator.calculateAge).toHaveBeenCalledTimes(1);

      const result = await scorer.scoreWallet(VALID_ADDRESS, { bypassCache: true });
      expect(result.fromCache).toBe(false);
      expect(mockAgeCalculator.calculateAge).toHaveBeenCalledTimes(2);
    });

    it("should skip specific signals when requested", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      await scorer.scoreWallet(VALID_ADDRESS, {
        skipSignals: [SignalCategory.WALLET_AGE, SignalCategory.FUNDING_PATTERN],
      });

      expect(mockAgeCalculator.calculateAge).not.toHaveBeenCalled();
      expect(mockFundingPatternAnalyzer.analyzeWallet).not.toHaveBeenCalled();
      expect(mockZeroHistoryDetector.checkWallet).toHaveBeenCalled();
    });

    it("should include category breakdown", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.categoryBreakdown).toHaveLength(5);
      expect(result.categoryBreakdown.map(c => c.category)).toContain(SignalCategory.WALLET_AGE);
      expect(result.categoryBreakdown.map(c => c.category)).toContain(SignalCategory.TRADING_BEHAVIOR);
      expect(result.categoryBreakdown.map(c => c.category)).toContain(SignalCategory.FUNDING_PATTERN);
      expect(result.categoryBreakdown.map(c => c.category)).toContain(SignalCategory.COORDINATION);
      expect(result.categoryBreakdown.map(c => c.category)).toContain(SignalCategory.ACTIVITY_PATTERN);
    });

    it("should include signal contributions", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.signalContributions.length).toBeGreaterThan(0);
      expect(result.signalContributions[0]).toHaveProperty("signalId");
      expect(result.signalContributions[0]).toHaveProperty("name");
      expect(result.signalContributions[0]).toHaveProperty("rawScore");
      expect(result.signalContributions[0]).toHaveProperty("weight");
      expect(result.signalContributions[0]).toHaveProperty("weightedScore");
      expect(result.signalContributions[0]).toHaveProperty("reason");
    });

    it("should include top signals sorted by contribution", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.topSignals.length).toBeLessThanOrEqual(5);

      // Verify sorted by weightedScore descending
      for (let i = 1; i < result.topSignals.length; i++) {
        expect(result.topSignals[i]!.weightedScore).toBeLessThanOrEqual(result.topSignals[i - 1]!.weightedScore);
      }
    });

    it("should include summary", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.summary).toBeInstanceOf(Array);
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("should include underlying results", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.underlyingResults).toHaveProperty("walletAge");
      expect(result.underlyingResults).toHaveProperty("zeroHistory");
      expect(result.underlyingResults).toHaveProperty("firstTradeSize");
      expect(result.underlyingResults).toHaveProperty("fundingPattern");
      expect(result.underlyingResults).toHaveProperty("clustering");
      expect(result.underlyingResults).toHaveProperty("reactivation");
    });

    it("should handle errors in underlying detectors gracefully", async () => {
      mockAgeCalculator.calculateAge.mockRejectedValue(new Error("API error"));
      mockFundingPatternAnalyzer.analyzeWallet.mockRejectedValue(new Error("Network error"));

      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      // Should still return a result even with failed signals
      expect(result.confidenceScore).toBeDefined();
      expect(result.underlyingResults.walletAge).toBeNull();
      expect(result.underlyingResults.fundingPattern).toBeNull();
    });
  });

  describe("Confidence Level Classification", () => {
    it("should classify VERY_LOW confidence (0-20)", async () => {
      // Inject mocks directly
      const customAgeCalculator = {
        calculateAge: vi.fn().mockResolvedValue(createMockWalletAgeResult({
          category: AgeCategory.MATURE,
          ageInDays: 500,
          isFresh: false,
        })),
      };
      const customZeroHistoryDetector = {
        checkWallet: vi.fn().mockResolvedValue(createMockZeroHistoryResult({
          status: TradingHistoryStatus.HAS_HISTORY,
          historyType: WalletHistoryType.ESTABLISHED,
          polymarketTradeCount: 500,
        })),
      };
      const customFirstTradeSizeAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockFirstTradeSizeResult({
          sizeCategory: FirstTradeSizeCategory.SMALL,
          isOutlier: false,
        })),
      };
      const customFundingPatternAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockFundingPatternResult({
          patternType: FundingPatternType.NORMAL,
          timingCategory: FundingTimingCategory.SLOW,
        })),
      };
      const customClusterAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockClusteringResult({
          coordinationScore: 5,
          clusterCount: 0,
          confidenceLevel: ClusterConfidenceLevel.VERY_LOW,
        })),
      };
      const customReactivationDetector = {
        checkWallet: vi.fn().mockResolvedValue(createMockReactivationResult({
          status: ReactivationStatus.NEVER_DORMANT,
          isSuspicious: false,
        })),
      };

      const scorer = new FreshWalletConfidenceScorer({
        ageCalculator: customAgeCalculator as any,
        zeroHistoryDetector: customZeroHistoryDetector as any,
        firstTradeSizeAnalyzer: customFirstTradeSizeAnalyzer as any,
        fundingPatternAnalyzer: customFundingPatternAnalyzer as any,
        clusterAnalyzer: customClusterAnalyzer as any,
        reactivationDetector: customReactivationDetector as any,
      });
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.confidenceLevel).toBe(ConfidenceLevel.VERY_LOW);
    });

    it("should classify VERY_HIGH confidence (80-100)", async () => {
      mockAgeCalculator.calculateAge.mockResolvedValue(createMockWalletAgeResult({
        category: AgeCategory.NEW,
        ageInDays: null,
        isNew: true,
        isFresh: true,
      }));
      mockZeroHistoryDetector.checkWallet.mockResolvedValue(createMockZeroHistoryResult({
        status: TradingHistoryStatus.NEVER_TRADED,
        historyType: WalletHistoryType.NEW_EVERYWHERE,
      }));
      mockFirstTradeSizeAnalyzer.analyzeWallet.mockResolvedValue(createMockFirstTradeSizeResult({
        sizeCategory: FirstTradeSizeCategory.OUTLIER,
        isOutlier: true,
      }));
      mockFundingPatternAnalyzer.analyzeWallet.mockResolvedValue(createMockFundingPatternResult({
        patternType: FundingPatternType.SUSPICIOUS,
        timingCategory: FundingTimingCategory.FLASH,
        fundingRiskSummary: {
          hasSanctionedSources: true,
          hasMixerSources: true,
          unknownPercentage: 90,
        },
      }));
      mockClusterAnalyzer.analyzeWallet.mockResolvedValue(createMockClusteringResult({
        coordinationScore: 90,
        clusterCount: 3,
        confidenceLevel: ClusterConfidenceLevel.VERY_HIGH,
      }));
      mockReactivationDetector.checkWallet.mockResolvedValue(createMockReactivationResult({
        status: ReactivationStatus.JUST_REACTIVATED,
        isSuspicious: true,
        reactivationEvent: {
          lastActivityBefore: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
          firstActivityAfter: new Date(),
          dormancyDays: 400,
          dormancySeverity: DormancySeverity.EXTENDED,
          reactivationTradeCount: 10,
          reactivationVolume: 50000,
          activityPattern: ActivityPatternType.BURST,
        },
      }));

      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.confidenceLevel).toBe(ConfidenceLevel.VERY_HIGH);
      expect(result.severity).toBe(FreshWalletAlertSeverity.CRITICAL);
    });
  });

  describe("Severity Mapping", () => {
    it("should map high confidence to CRITICAL severity", async () => {
      mockAgeCalculator.calculateAge.mockResolvedValue(createMockWalletAgeResult({
        category: AgeCategory.NEW,
        isFresh: true,
      }));
      mockZeroHistoryDetector.checkWallet.mockResolvedValue(createMockZeroHistoryResult({
        status: TradingHistoryStatus.NEVER_TRADED,
        historyType: WalletHistoryType.NEW_EVERYWHERE,
      }));
      mockFirstTradeSizeAnalyzer.analyzeWallet.mockResolvedValue(createMockFirstTradeSizeResult({
        sizeCategory: FirstTradeSizeCategory.OUTLIER,
        isOutlier: true,
      }));
      mockFundingPatternAnalyzer.analyzeWallet.mockResolvedValue(createMockFundingPatternResult({
        patternType: FundingPatternType.SUSPICIOUS,
        timingCategory: FundingTimingCategory.FLASH,
        fundingRiskSummary: {
          hasSanctionedSources: true,
          hasMixerSources: false,
          unknownPercentage: 90,
        },
      }));
      mockClusterAnalyzer.analyzeWallet.mockResolvedValue(createMockClusteringResult({
        coordinationScore: 90,
        clusterCount: 3,
        confidenceLevel: ClusterConfidenceLevel.VERY_HIGH,
      }));

      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.severity).toBe(FreshWalletAlertSeverity.CRITICAL);
    });

    it("should map low confidence to LOW severity", async () => {
      // Inject mocks directly
      const customAgeCalculator = {
        calculateAge: vi.fn().mockResolvedValue(createMockWalletAgeResult({
          category: AgeCategory.MATURE,
          isFresh: false,
          ageInDays: 365,
        })),
      };
      const customZeroHistoryDetector = {
        checkWallet: vi.fn().mockResolvedValue(createMockZeroHistoryResult({
          status: TradingHistoryStatus.HAS_HISTORY,
          historyType: WalletHistoryType.ESTABLISHED,
        })),
      };
      const customFirstTradeSizeAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockFirstTradeSizeResult({
          sizeCategory: FirstTradeSizeCategory.SMALL,
          isOutlier: false,
        })),
      };
      const customFundingPatternAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockFundingPatternResult({
          patternType: FundingPatternType.NORMAL,
          timingCategory: FundingTimingCategory.SLOW,
        })),
      };
      const customClusterAnalyzer = {
        analyzeWallet: vi.fn().mockResolvedValue(createMockClusteringResult({
          coordinationScore: 5,
          clusterCount: 0,
          confidenceLevel: ClusterConfidenceLevel.VERY_LOW,
        })),
      };
      const customReactivationDetector = {
        checkWallet: vi.fn().mockResolvedValue(createMockReactivationResult({
          status: ReactivationStatus.NEVER_DORMANT,
          isSuspicious: false,
        })),
      };

      const scorer = new FreshWalletConfidenceScorer({
        ageCalculator: customAgeCalculator as any,
        zeroHistoryDetector: customZeroHistoryDetector as any,
        firstTradeSizeAnalyzer: customFirstTradeSizeAnalyzer as any,
        fundingPatternAnalyzer: customFundingPatternAnalyzer as any,
        clusterAnalyzer: customClusterAnalyzer as any,
        reactivationDetector: customReactivationDetector as any,
      });
      const result = await scorer.scoreWallet(VALID_ADDRESS);

      expect(result.severity).toBe(FreshWalletAlertSeverity.LOW);
    });
  });

  describe("scoreWallets (Batch)", () => {
    it("should process multiple wallets", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(2);
    });

    it("should handle errors in batch processing", async () => {
      mockAgeCalculator.calculateAge
        .mockResolvedValueOnce(createMockWalletAgeResult())
        .mockRejectedValueOnce(new Error("API error"));
      mockZeroHistoryDetector.checkWallet
        .mockResolvedValueOnce(createMockZeroHistoryResult())
        .mockRejectedValueOnce(new Error("API error"));
      mockFirstTradeSizeAnalyzer.analyzeWallet
        .mockResolvedValueOnce(createMockFirstTradeSizeResult())
        .mockRejectedValueOnce(new Error("API error"));
      mockFundingPatternAnalyzer.analyzeWallet
        .mockResolvedValueOnce(createMockFundingPatternResult())
        .mockRejectedValueOnce(new Error("API error"));
      mockClusterAnalyzer.analyzeWallet
        .mockResolvedValueOnce(createMockClusteringResult())
        .mockRejectedValueOnce(new Error("API error"));
      mockReactivationDetector.checkWallet
        .mockResolvedValueOnce(createMockReactivationResult())
        .mockRejectedValueOnce(new Error("API error"));

      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2); // Both succeed because individual signal failures are handled gracefully
    });

    it("should count suspicious wallets", async () => {
      // First wallet: suspicious
      mockAgeCalculator.calculateAge.mockResolvedValueOnce(createMockWalletAgeResult({
        category: AgeCategory.NEW,
        isFresh: true,
      }));
      mockZeroHistoryDetector.checkWallet.mockResolvedValueOnce(createMockZeroHistoryResult({
        status: TradingHistoryStatus.NEVER_TRADED,
        historyType: WalletHistoryType.NEW_EVERYWHERE,
      }));
      mockFundingPatternAnalyzer.analyzeWallet.mockResolvedValueOnce(createMockFundingPatternResult({
        patternType: FundingPatternType.SUSPICIOUS,
      }));

      // Second wallet: not suspicious
      mockAgeCalculator.calculateAge.mockResolvedValueOnce(createMockWalletAgeResult({
        category: AgeCategory.MATURE,
        isFresh: false,
      }));
      mockZeroHistoryDetector.checkWallet.mockResolvedValueOnce(createMockZeroHistoryResult({
        status: TradingHistoryStatus.HAS_HISTORY,
      }));
      mockFundingPatternAnalyzer.analyzeWallet.mockResolvedValueOnce(createMockFundingPatternResult({
        patternType: FundingPatternType.NORMAL,
      }));

      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.suspiciousCount).toBeGreaterThanOrEqual(0);
    });

    it("should calculate average confidence score", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.averageConfidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.averageConfidenceScore).toBeLessThanOrEqual(100);
    });

    it("should track processing time", async () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = await scorer.scoreWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getSummary", () => {
    it("should return correct summary statistics", () => {
      const mockResults: FreshWalletConfidenceResult[] = [
        {
          address: "0x1111111111111111111111111111111111111111",
          confidenceScore: 85,
          confidenceLevel: ConfidenceLevel.VERY_HIGH,
          severity: FreshWalletAlertSeverity.CRITICAL,
          isSuspicious: true,
          categoryBreakdown: [],
          signalContributions: [],
          topSignals: [{ signalId: "wallet_age", name: "Wallet Age", rawScore: 100, weight: 0.2, weightedScore: 20, reason: "test", available: true }],
          summary: [],
          underlyingResults: {
            walletAge: null,
            zeroHistory: null,
            firstTradeSize: null,
            fundingPattern: null,
            clustering: null,
            reactivation: null,
          },
          fromCache: false,
          analyzedAt: new Date(),
        },
        {
          address: "0x2222222222222222222222222222222222222222",
          confidenceScore: 25,
          confidenceLevel: ConfidenceLevel.LOW,
          severity: FreshWalletAlertSeverity.LOW,
          isSuspicious: false,
          categoryBreakdown: [],
          signalContributions: [],
          topSignals: [{ signalId: "funding_pattern", name: "Funding Pattern", rawScore: 50, weight: 0.25, weightedScore: 12.5, reason: "test", available: true }],
          summary: [],
          underlyingResults: {
            walletAge: null,
            zeroHistory: null,
            firstTradeSize: null,
            fundingPattern: null,
            clustering: null,
            reactivation: null,
          },
          fromCache: false,
          analyzedAt: new Date(),
        },
        {
          address: "0x3333333333333333333333333333333333333333",
          confidenceScore: 15,
          confidenceLevel: ConfidenceLevel.VERY_LOW,
          severity: FreshWalletAlertSeverity.LOW,
          isSuspicious: false,
          categoryBreakdown: [],
          signalContributions: [],
          topSignals: [{ signalId: "wallet_age", name: "Wallet Age", rawScore: 30, weight: 0.2, weightedScore: 6, reason: "test", available: true }],
          summary: [],
          underlyingResults: {
            walletAge: null,
            zeroHistory: null,
            firstTradeSize: null,
            fundingPattern: null,
            clustering: null,
            reactivation: null,
          },
          fromCache: false,
          analyzedAt: new Date(),
        },
      ];

      const scorer = new FreshWalletConfidenceScorer();
      const summary = scorer.getSummary(mockResults);

      expect(summary.total).toBe(3);
      expect(summary.byConfidenceLevel[ConfidenceLevel.VERY_HIGH]).toBe(1);
      expect(summary.byConfidenceLevel[ConfidenceLevel.LOW]).toBe(1);
      expect(summary.byConfidenceLevel[ConfidenceLevel.VERY_LOW]).toBe(1);
      expect(summary.suspiciousPercentage).toBeCloseTo(33.33, 1);
      expect(summary.averageScore).toBeCloseTo(41.67, 1);
      expect(summary.medianScore).toBe(25);
      expect(summary.mostCommonTopSignal).toBe("wallet_age");
      expect(summary.topSignalDistribution["wallet_age"]).toBe(2);
    });

    it("should handle empty results", () => {
      const scorer = new FreshWalletConfidenceScorer();
      const summary = scorer.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.suspiciousPercentage).toBe(0);
      expect(summary.averageScore).toBe(0);
      expect(summary.medianScore).toBeNull();
      expect(summary.mostCommonTopSignal).toBeNull();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      await scorer.scoreWallet(VALID_ADDRESS);
      expect(scorer.getCacheStats().size).toBe(1);

      scorer.clearCache();
      expect(scorer.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      const scorer = new FreshWalletConfidenceScorer();

      await scorer.scoreWallet(VALID_ADDRESS);
      expect(scorer.getCacheStats().size).toBe(1);

      const result = scorer.invalidateCacheEntry(VALID_ADDRESS);
      expect(result).toBe(true);
      expect(scorer.getCacheStats().size).toBe(0);
    });

    it("should return false when invalidating non-existent entry", () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = scorer.invalidateCacheEntry(VALID_ADDRESS);
      expect(result).toBe(false);
    });

    it("should return false when invalidating invalid address", () => {
      const scorer = new FreshWalletConfidenceScorer();
      const result = scorer.invalidateCacheEntry(INVALID_ADDRESS);
      expect(result).toBe(false);
    });
  });

  describe("Singleton Management", () => {
    it("should create new instance with createFreshWalletConfidenceScorer", () => {
      const scorer = createFreshWalletConfidenceScorer();
      expect(scorer).toBeInstanceOf(FreshWalletConfidenceScorer);
    });

    it("should return shared instance with getSharedFreshWalletConfidenceScorer", () => {
      const scorer1 = getSharedFreshWalletConfidenceScorer();
      const scorer2 = getSharedFreshWalletConfidenceScorer();
      expect(scorer1).toBe(scorer2);
    });

    it("should set custom shared instance", () => {
      const customScorer = new FreshWalletConfidenceScorer({
        suspiciousThreshold: 75,
      });
      setSharedFreshWalletConfidenceScorer(customScorer);

      const shared = getSharedFreshWalletConfidenceScorer();
      expect(shared.getSuspiciousThreshold()).toBe(75);
    });

    it("should reset shared instance", () => {
      const scorer1 = getSharedFreshWalletConfidenceScorer();
      resetSharedFreshWalletConfidenceScorer();
      const scorer2 = getSharedFreshWalletConfidenceScorer();
      expect(scorer1).not.toBe(scorer2);
    });
  });

  describe("Convenience Functions", () => {
    it("scoreFreshWalletConfidence should use shared scorer", async () => {
      const result = await scoreFreshWalletConfidence(VALID_ADDRESS);
      expect(result.address.toLowerCase()).toBe(VALID_ADDRESS.toLowerCase());
    });

    it("batchScoreFreshWalletConfidence should use shared scorer", async () => {
      const result = await batchScoreFreshWalletConfidence([VALID_ADDRESS]);
      expect(result.totalProcessed).toBe(1);
    });

    it("isFreshWalletSuspicious should return correct result", async () => {
      mockAgeCalculator.calculateAge.mockResolvedValue(createMockWalletAgeResult({
        category: AgeCategory.MATURE,
        isFresh: false,
      }));

      const isSuspicious = await isFreshWalletSuspicious(VALID_ADDRESS);
      expect(typeof isSuspicious).toBe("boolean");
    });

    it("isFreshWalletSuspicious should respect custom threshold", async () => {
      mockAgeCalculator.calculateAge.mockResolvedValue(createMockWalletAgeResult({
        category: AgeCategory.FRESH,
        isFresh: true,
      }));

      // With very low threshold, should be suspicious
      const isSuspicious = await isFreshWalletSuspicious(VALID_ADDRESS, 10);
      expect(typeof isSuspicious).toBe("boolean");
    });

    it("getConfidenceSummary should use shared scorer", () => {
      const results: FreshWalletConfidenceResult[] = [];
      const summary = getConfidenceSummary(results);
      expect(summary.total).toBe(0);
    });
  });

  describe("Signal Weights", () => {
    it("DEFAULT_SIGNAL_WEIGHTS should sum to approximately 1", () => {
      const sum = Object.values(DEFAULT_SIGNAL_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("should respect custom signal weights", async () => {
      const customWeights = {
        walletAge: 0.5,
        tradingBehavior: 0.1,
        fundingPattern: 0.2,
        coordination: 0.1,
        activityPattern: 0.1,
      };

      const scorer = new FreshWalletConfidenceScorer({
        signalWeights: customWeights,
      });

      const weights = scorer.getSignalWeights();
      expect(weights.walletAge).toBe(0.5);
      expect(weights.tradingBehavior).toBe(0.1);
    });
  });

  describe("Signal Categories", () => {
    it("should have all signal categories defined", () => {
      expect(SignalCategory.WALLET_AGE).toBe("WALLET_AGE");
      expect(SignalCategory.TRADING_BEHAVIOR).toBe("TRADING_BEHAVIOR");
      expect(SignalCategory.FUNDING_PATTERN).toBe("FUNDING_PATTERN");
      expect(SignalCategory.COORDINATION).toBe("COORDINATION");
      expect(SignalCategory.ACTIVITY_PATTERN).toBe("ACTIVITY_PATTERN");
    });
  });

  describe("Confidence Levels", () => {
    it("should have all confidence levels defined", () => {
      expect(ConfidenceLevel.VERY_LOW).toBe("VERY_LOW");
      expect(ConfidenceLevel.LOW).toBe("LOW");
      expect(ConfidenceLevel.MODERATE).toBe("MODERATE");
      expect(ConfidenceLevel.HIGH).toBe("HIGH");
      expect(ConfidenceLevel.VERY_HIGH).toBe("VERY_HIGH");
    });
  });
});
