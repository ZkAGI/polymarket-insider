/**
 * Unit Tests for Fresh Wallet Alert Generator (DET-FRESH-010)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FreshWalletAlertGenerator,
  FreshWalletAlertType,
  AlertStatus,
  DEFAULT_ALERT_CONDITIONS,
  createFreshWalletAlertGenerator,
  getSharedFreshWalletAlertGenerator,
  setSharedFreshWalletAlertGenerator,
  resetSharedFreshWalletAlertGenerator,
  generateFreshWalletAlerts,
  batchGenerateFreshWalletAlerts,
  shouldTriggerFreshWalletAlert,
  getFreshWalletAlerts,
  getFreshWalletAlertSummary,
  type AlertCondition,
} from "../../src/detection/fresh-wallet-alert";
import {
  ConfidenceLevel,
  type FreshWalletConfidenceResult,
  type FreshWalletConfidenceScorer,
} from "../../src/detection/fresh-wallet-confidence";
import { FreshWalletAlertSeverity } from "../../src/detection/fresh-wallet-config";

// Mock the confidence scorer
vi.mock("../../src/detection/fresh-wallet-confidence", () => ({
  ConfidenceLevel: {
    VERY_LOW: "VERY_LOW",
    LOW: "LOW",
    MODERATE: "MODERATE",
    HIGH: "HIGH",
    VERY_HIGH: "VERY_HIGH",
  },
  getSharedFreshWalletConfidenceScorer: vi.fn(() => ({
    scoreWallet: vi.fn(),
    scoreWallets: vi.fn(),
  })),
}));

import { getSharedFreshWalletConfidenceScorer } from "../../src/detection/fresh-wallet-confidence";

// Test addresses
const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const VALID_ADDRESS_3 = "0x1111111111111111111111111111111111111111";
const INVALID_ADDRESS = "0xinvalid";

// Mock result factories
function createMockConfidenceResult(overrides: Partial<FreshWalletConfidenceResult> = {}): FreshWalletConfidenceResult {
  return {
    address: VALID_ADDRESS,
    confidenceScore: 65,
    confidenceLevel: ConfidenceLevel.HIGH,
    severity: FreshWalletAlertSeverity.HIGH,
    isSuspicious: true,
    categoryBreakdown: [],
    signalContributions: [],
    topSignals: [
      { signalId: "test_signal", name: "Test Signal", rawScore: 80, weight: 0.5, weightedScore: 40, reason: "Test reason", available: true },
    ],
    summary: ["Test summary point"],
    underlyingResults: {
      walletAge: {
        address: VALID_ADDRESS,
        ageInDays: 5,
        ageInHours: 120,
        category: "FRESH" as any,
        isNew: false,
        isFresh: true,
        firstTransactionTimestamp: Math.floor(Date.now() / 1000) - 5 * 86400,
        firstTransactionDate: new Date(Date.now() - 5 * 86400000),
        firstTransactionHash: "0xabc123",
        fromCache: false,
        calculatedAt: new Date(),
      },
      zeroHistory: {
        address: VALID_ADDRESS,
        hasZeroHistory: false,
        status: "HAS_HISTORY" as any,
        historyType: "ESTABLISHED" as any,
        polymarketTradeCount: 5,
        polymarketVolume: 1000,
        uniqueMarketsTraded: 3,
        firstTradeAt: "2024-01-01T00:00:00Z",
        lastTradeAt: "2024-01-10T00:00:00Z",
        daysSinceLastTrade: 1,
        walletAge: null,
        isSuspiciousFirstTimer: false,
        severity: FreshWalletAlertSeverity.LOW,
        fromCache: false,
        checkedAt: new Date(),
      },
      firstTradeSize: {
        address: VALID_ADDRESS,
        hasTrades: true,
        isOutlier: false,
        firstTrade: {
          id: "trade1",
          assetId: "asset1",
          size: 100,
          sizeUsd: 100,
          price: 0.5,
          side: "buy" as const,
          timestamp: "2024-01-01T00:00:00Z",
          transactionHash: "0xabc",
        },
        sizeCategory: "NORMAL" as any,
        percentile: 50,
        zScore: 0,
        multipleOfAverage: 1,
        severity: FreshWalletAlertSeverity.LOW,
        flagReasons: [],
        comparisonStats: null,
        fromCache: false,
        analyzedAt: new Date(),
      },
      fundingPattern: {
        address: VALID_ADDRESS,
        hasDeposits: true,
        hasTrades: true,
        patternType: "NORMAL" as any,
        timingCategory: "SLOW" as any,
        preTradingDeposits: [],
        totalPreTradingAmount: BigInt(0),
        formattedTotalPreTradingAmount: "0",
        firstTradeAfterFunding: null,
        fundingToTradeIntervalSeconds: 86400,
        lastDepositToTradeIntervalSeconds: 86400,
        suspicionScore: 10,
        severity: FreshWalletAlertSeverity.LOW,
        flagReasons: [],
        fundingRiskSummary: {
          overallRiskLevel: "LOW" as any,
          hasSanctionedSources: false,
          hasMixerSources: false,
          exchangePercentage: 100,
          mixerPercentage: 0,
          unknownPercentage: 0,
          uniqueSourceCount: 1,
          exchangeNames: ["Binance"],
          mixerNames: [],
        },
        fromCache: false,
        analyzedAt: new Date(),
      },
      clustering: {
        address: VALID_ADDRESS,
        clusterIds: [],
        clusterCount: 0,
        clusterConfidences: {},
        fundingSourceClusters: [],
        temporalCluster: null,
        tradingPatternCluster: null,
        overallClusterConfidence: 10,
        coordinationScore: 10,
        confidenceLevel: "VERY_LOW" as any,
        severity: FreshWalletAlertSeverity.LOW,
        flagReasons: [],
        fromCache: false,
        analyzedAt: new Date(),
      },
      reactivation: {
        address: VALID_ADDRESS,
        status: "NEVER_DORMANT" as any,
        isReactivated: false,
        isSuspicious: false,
        daysSinceLastActivity: 1,
        lastActivityAt: new Date(),
        firstActivityAt: new Date(Date.now() - 86400000 * 30),
        totalTradeCount: 10,
        totalVolume: 1000,
        uniqueMarketsTraded: 5,
        reactivationEvent: null,
        activityTimeline: [],
        severity: FreshWalletAlertSeverity.LOW,
        walletAge: null,
        fromCache: false,
        checkedAt: new Date(),
      },
    },
    fromCache: false,
    analyzedAt: new Date(),
    ...overrides,
  };
}

function createHighConfidenceResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 85,
    confidenceLevel: ConfidenceLevel.VERY_HIGH,
    severity: FreshWalletAlertSeverity.CRITICAL,
    isSuspicious: true,
    underlyingResults: {
      ...createMockConfidenceResult().underlyingResults,
      walletAge: {
        ...createMockConfidenceResult().underlyingResults.walletAge!,
        isFresh: true,
        ageInDays: 2,
      },
      zeroHistory: {
        ...createMockConfidenceResult().underlyingResults.zeroHistory!,
        hasZeroHistory: true,
        status: "FIRST_TRADE" as any,
        polymarketTradeCount: 1,
      },
    },
  });
}

function createFirstTradeResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 70,
    confidenceLevel: ConfidenceLevel.HIGH,
    underlyingResults: {
      ...createMockConfidenceResult().underlyingResults,
      zeroHistory: {
        ...createMockConfidenceResult().underlyingResults.zeroHistory!,
        status: "FIRST_TRADE" as any,
        polymarketTradeCount: 1,
      },
    },
  });
}

function createLargeTradeResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 70,
    confidenceLevel: ConfidenceLevel.HIGH,
    underlyingResults: {
      ...createMockConfidenceResult().underlyingResults,
      firstTradeSize: {
        ...createMockConfidenceResult().underlyingResults.firstTradeSize!,
        isOutlier: true,
        firstTrade: {
          id: "trade1",
          assetId: "asset1",
          size: 10000,
          sizeUsd: 10000,
          price: 0.5,
          side: "buy" as const,
          timestamp: "2024-01-01T00:00:00Z",
          transactionHash: "0xabc",
        },
        flagReasons: ["Unusually large first trade"],
      },
    },
  });
}

function createSuspiciousFundingResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 75,
    confidenceLevel: ConfidenceLevel.HIGH,
    underlyingResults: {
      ...createMockConfidenceResult().underlyingResults,
      fundingPattern: {
        ...createMockConfidenceResult().underlyingResults.fundingPattern!,
        patternType: "SUSPICIOUS" as any,
        timingCategory: "FLASH" as any,
        fundingToTradeIntervalSeconds: 120, // 2 minutes
      },
    },
  });
}

function createClusterResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 70,
    confidenceLevel: ConfidenceLevel.HIGH,
    underlyingResults: {
      ...createMockConfidenceResult().underlyingResults,
      clustering: {
        ...createMockConfidenceResult().underlyingResults.clustering!,
        clusterCount: 2,
        coordinationScore: 75,
        confidenceLevel: "HIGH" as any,
      },
    },
  });
}

function createReactivationResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 65,
    confidenceLevel: ConfidenceLevel.HIGH,
    underlyingResults: {
      ...createMockConfidenceResult().underlyingResults,
      reactivation: {
        ...createMockConfidenceResult().underlyingResults.reactivation!,
        status: "RECENTLY_REACTIVATED" as any,
        isReactivated: true,
        isSuspicious: true,
        reactivationEvent: {
          lastActivityBefore: new Date(Date.now() - 90 * 86400000),
          firstActivityAfter: new Date(),
          dormancyDays: 90,
          dormancySeverity: "LONG" as any,
          reactivationTradeCount: 5,
          reactivationVolume: 500,
          activityPattern: "BURST" as any,
        },
      },
    },
  });
}

function createLowConfidenceResult(): FreshWalletConfidenceResult {
  return createMockConfidenceResult({
    confidenceScore: 25,
    confidenceLevel: ConfidenceLevel.LOW,
    severity: FreshWalletAlertSeverity.LOW,
    isSuspicious: false,
  });
}

describe("FreshWalletAlertGenerator", () => {
  let mockScorer: { scoreWallet: ReturnType<typeof vi.fn>; scoreWallets: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFreshWalletAlertGenerator();

    mockScorer = {
      scoreWallet: vi.fn(),
      scoreWallets: vi.fn(),
    };

    (getSharedFreshWalletConfidenceScorer as ReturnType<typeof vi.fn>).mockReturnValue(mockScorer);
  });

  afterEach(() => {
    resetSharedFreshWalletAlertGenerator();
  });

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const generator = new FreshWalletAlertGenerator();
      expect(generator).toBeInstanceOf(FreshWalletAlertGenerator);
      expect(generator.getMinAlertThreshold()).toBe(40);
      expect(generator.getConditions().length).toBeGreaterThan(0);
    });

    it("should create with custom configuration", () => {
      const generator = new FreshWalletAlertGenerator({
        minAlertThreshold: 50,
        maxStoredAlerts: 500,
      });
      expect(generator.getMinAlertThreshold()).toBe(50);
    });

    it("should merge custom conditions with defaults", () => {
      const customCondition: AlertCondition = {
        id: "custom_condition",
        name: "Custom Condition",
        description: "Test custom condition",
        enabled: true,
        minConfidenceScore: 70,
        alertType: FreshWalletAlertType.GENERAL,
        tags: ["custom"],
      };

      const generator = new FreshWalletAlertGenerator({
        customConditions: [customCondition],
      });

      const conditions = generator.getConditions();
      expect(conditions.find(c => c.id === "custom_condition")).toBeDefined();
      expect(conditions.length).toBe(DEFAULT_ALERT_CONDITIONS.length + 1);
    });

    it("should replace default conditions when specified", () => {
      const customCondition: AlertCondition = {
        id: "custom_only",
        name: "Custom Only",
        description: "Only custom condition",
        enabled: true,
        alertType: FreshWalletAlertType.GENERAL,
      };

      const generator = new FreshWalletAlertGenerator({
        customConditions: [customCondition],
        replaceDefaultConditions: true,
      });

      expect(generator.getConditions().length).toBe(1);
      expect(generator.getConditions()[0]!.id).toBe("custom_only");
    });
  });

  describe("generateAlerts", () => {
    it("should throw for invalid address", async () => {
      const generator = new FreshWalletAlertGenerator();
      await expect(generator.generateAlerts(INVALID_ADDRESS)).rejects.toThrow("Invalid wallet address");
    });

    it("should return empty array when confidence score is below threshold", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createLowConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      expect(alerts).toHaveLength(0);
    });

    it("should generate first trade alert when conditions match", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createFirstTradeResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      expect(alerts.length).toBeGreaterThan(0);

      const firstTradeAlert = alerts.find(a => a.type === FreshWalletAlertType.FIRST_TRADE);
      expect(firstTradeAlert).toBeDefined();
    });

    it("should generate large trade alert when conditions match", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createLargeTradeResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const largeTradeAlert = alerts.find(a => a.type === FreshWalletAlertType.LARGE_TRADE);
      expect(largeTradeAlert).toBeDefined();
      expect(largeTradeAlert?.severity).toBe(FreshWalletAlertSeverity.HIGH);
    });

    it("should generate suspicious funding alert when conditions match", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createSuspiciousFundingResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const fundingAlert = alerts.find(a => a.type === FreshWalletAlertType.SUSPICIOUS_FUNDING);
      expect(fundingAlert).toBeDefined();
    });

    it("should generate coordinated activity alert when conditions match", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createClusterResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const clusterAlert = alerts.find(a => a.type === FreshWalletAlertType.COORDINATED_ACTIVITY);
      expect(clusterAlert).toBeDefined();
    });

    it("should generate reactivation alert when conditions match", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createReactivationResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const reactivationAlert = alerts.find(a => a.type === FreshWalletAlertType.WALLET_REACTIVATION);
      expect(reactivationAlert).toBeDefined();
    });

    it("should generate general alert for very high confidence", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const generalAlert = alerts.find(
        a => a.type === FreshWalletAlertType.GENERAL &&
            a.severity === FreshWalletAlertSeverity.CRITICAL
      );
      expect(generalAlert).toBeDefined();
    });

    it("should use pre-computed result when provided", async () => {
      const preComputedResult = createHighConfidenceResult();

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS, {
        preComputedResult,
      });

      expect(mockScorer.scoreWallet).not.toHaveBeenCalled();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("should include market ID when provided", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS, {
        marketId: "market123",
      });

      expect(alerts[0]!.marketId).toBe("market123");
    });

    it("should add additional tags when provided", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS, {
        additionalTags: ["custom_tag"],
      });

      expect(alerts[0]!.tags).toContain("custom_tag");
    });

    it("should store generated alerts", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);

      expect(generator.getAlertCount()).toBeGreaterThan(0);
    });

    it("should notify listeners when alerts are generated", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const listener = vi.fn();
      generator.addListener(listener);

      await generator.generateAlerts(VALID_ADDRESS);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe("generateAlertsForWallets", () => {
    it("should process multiple wallets", async () => {
      mockScorer.scoreWallet
        .mockResolvedValueOnce(createHighConfidenceResult())
        .mockResolvedValueOnce(createLowConfidenceResult())
        .mockResolvedValueOnce(createFirstTradeResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const result = await generator.generateAlertsForWallets([
        VALID_ADDRESS,
        VALID_ADDRESS_2,
        VALID_ADDRESS_3,
      ]);

      expect(result.totalProcessed).toBe(3);
      expect(result.alerts.size).toBe(2); // 2 wallets should have alerts
      expect(result.noAlerts.length).toBe(1); // 1 wallet should have no alerts
    });

    it("should handle errors gracefully", async () => {
      mockScorer.scoreWallet
        .mockResolvedValueOnce(createHighConfidenceResult())
        .mockRejectedValueOnce(new Error("API error"));

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const result = await generator.generateAlertsForWallets([
        VALID_ADDRESS,
        VALID_ADDRESS_2,
      ]);

      expect(result.errors.size).toBe(1);
      expect(result.alerts.size).toBe(1);
    });

    it("should track statistics by type and severity", async () => {
      mockScorer.scoreWallet
        .mockResolvedValueOnce(createHighConfidenceResult())
        .mockResolvedValueOnce(createLargeTradeResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const result = await generator.generateAlertsForWallets([
        VALID_ADDRESS,
        VALID_ADDRESS_2,
      ]);

      expect(result.totalAlerts).toBeGreaterThan(0);
      expect(result.byType).toBeDefined();
      expect(result.bySeverity).toBeDefined();
    });
  });

  describe("shouldAlert", () => {
    it("should return true when wallet should trigger alerts", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const result = await generator.shouldAlert(VALID_ADDRESS);
      expect(result).toBe(true);
    });

    it("should return false when wallet should not trigger alerts", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createLowConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const result = await generator.shouldAlert(VALID_ADDRESS);
      expect(result).toBe(false);
    });

    it("should return false for invalid address", async () => {
      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const result = await generator.shouldAlert(INVALID_ADDRESS);
      expect(result).toBe(false);
    });
  });

  describe("alert management", () => {
    it("should retrieve alerts for a specific wallet", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);

      const alerts = generator.getAlertsForWallet(VALID_ADDRESS);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("should retrieve all alerts", async () => {
      mockScorer.scoreWallet
        .mockResolvedValueOnce(createHighConfidenceResult())
        .mockResolvedValueOnce(createFirstTradeResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);
      await generator.generateAlerts(VALID_ADDRESS_2);

      const allAlerts = generator.getAllAlerts();
      expect(allAlerts.length).toBeGreaterThan(1);
    });

    it("should retrieve alerts by type", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);

      const generalAlerts = generator.getAlertsByType(FreshWalletAlertType.GENERAL);
      expect(generalAlerts.length).toBeGreaterThanOrEqual(0);
    });

    it("should retrieve alerts by severity", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);

      const criticalAlerts = generator.getAlertsBySeverity(FreshWalletAlertSeverity.CRITICAL);
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it("should update alert status", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const alertId = alerts[0]!.id;

      const updated = generator.updateAlertStatus(alertId, AlertStatus.ACKNOWLEDGED);
      expect(updated).toBe(true);

      const alert = generator.getAlertById(alertId);
      expect(alert?.status).toBe(AlertStatus.ACKNOWLEDGED);
    });

    it("should delete an alert", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const alerts = await generator.generateAlerts(VALID_ADDRESS);
      const alertId = alerts[0]!.id;

      const deleted = generator.deleteAlert(alertId);
      expect(deleted).toBe(true);

      const alert = generator.getAlertById(alertId);
      expect(alert).toBeNull();
    });

    it("should clear all alerts", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);
      expect(generator.getAlertCount()).toBeGreaterThan(0);

      generator.clearAlerts();
      expect(generator.getAlertCount()).toBe(0);
    });

    it("should clear expired alerts", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
        defaultExpirationMs: 1, // Very short expiration
      });

      await generator.generateAlerts(VALID_ADDRESS);

      // Wait a bit for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const clearedCount = generator.clearExpiredAlerts();
      expect(clearedCount).toBeGreaterThan(0);
    });
  });

  describe("alert summary", () => {
    it("should provide summary statistics", async () => {
      mockScorer.scoreWallet
        .mockResolvedValueOnce(createHighConfidenceResult())
        .mockResolvedValueOnce(createLargeTradeResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      await generator.generateAlerts(VALID_ADDRESS);
      await generator.generateAlerts(VALID_ADDRESS_2);

      const summary = generator.getAlertSummary();

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.byType).toBeDefined();
      expect(summary.bySeverity).toBeDefined();
      expect(summary.byStatus).toBeDefined();
      expect(typeof summary.averageConfidenceScore).toBe("number");
    });
  });

  describe("condition management", () => {
    it("should return enabled conditions", () => {
      const generator = new FreshWalletAlertGenerator();
      const enabled = generator.getEnabledConditions();
      expect(enabled.every(c => c.enabled)).toBe(true);
    });

    it("should enable a condition", () => {
      const generator = new FreshWalletAlertGenerator();
      const conditionId = DEFAULT_ALERT_CONDITIONS[0]!.id;

      generator.disableCondition(conditionId);
      expect(generator.getConditions().find(c => c.id === conditionId)?.enabled).toBe(false);

      generator.enableCondition(conditionId);
      expect(generator.getConditions().find(c => c.id === conditionId)?.enabled).toBe(true);
    });

    it("should disable a condition", () => {
      const generator = new FreshWalletAlertGenerator();
      const conditionId = DEFAULT_ALERT_CONDITIONS[0]!.id;

      const result = generator.disableCondition(conditionId);
      expect(result).toBe(true);
      expect(generator.getConditions().find(c => c.id === conditionId)?.enabled).toBe(false);
    });

    it("should return false for non-existent condition", () => {
      const generator = new FreshWalletAlertGenerator();
      const result = generator.disableCondition("non_existent");
      expect(result).toBe(false);
    });
  });

  describe("listeners", () => {
    it("should add and remove listeners", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const listener = vi.fn();
      generator.addListener(listener);

      await generator.generateAlerts(VALID_ADDRESS);
      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      generator.removeListener(listener);

      await generator.generateAlerts(VALID_ADDRESS_2);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle listener errors gracefully", async () => {
      mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

      const generator = new FreshWalletAlertGenerator({
        confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
      });

      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });

      generator.addListener(errorListener);

      // Should not throw
      await expect(generator.generateAlerts(VALID_ADDRESS)).resolves.not.toThrow();
    });
  });
});

describe("Singleton Management", () => {
  beforeEach(() => {
    resetSharedFreshWalletAlertGenerator();
  });

  afterEach(() => {
    resetSharedFreshWalletAlertGenerator();
  });

  it("should create generator with factory function", () => {
    const generator = createFreshWalletAlertGenerator();
    expect(generator).toBeInstanceOf(FreshWalletAlertGenerator);
  });

  it("should get shared generator instance", () => {
    const generator1 = getSharedFreshWalletAlertGenerator();
    const generator2 = getSharedFreshWalletAlertGenerator();
    expect(generator1).toBe(generator2);
  });

  it("should set shared generator instance", () => {
    const customGenerator = createFreshWalletAlertGenerator({
      minAlertThreshold: 80,
    });

    setSharedFreshWalletAlertGenerator(customGenerator);

    const sharedGenerator = getSharedFreshWalletAlertGenerator();
    expect(sharedGenerator).toBe(customGenerator);
    expect(sharedGenerator.getMinAlertThreshold()).toBe(80);
  });

  it("should reset shared generator instance", () => {
    const generator1 = getSharedFreshWalletAlertGenerator();
    resetSharedFreshWalletAlertGenerator();
    const generator2 = getSharedFreshWalletAlertGenerator();

    expect(generator1).not.toBe(generator2);
  });
});

describe("Convenience Functions", () => {
  let mockScorer: { scoreWallet: ReturnType<typeof vi.fn>; scoreWallets: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFreshWalletAlertGenerator();

    mockScorer = {
      scoreWallet: vi.fn(),
      scoreWallets: vi.fn(),
    };

    (getSharedFreshWalletConfidenceScorer as ReturnType<typeof vi.fn>).mockReturnValue(mockScorer);
  });

  afterEach(() => {
    resetSharedFreshWalletAlertGenerator();
  });

  it("should generate alerts with convenience function", async () => {
    mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

    const customGenerator = createFreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    const alerts = await generateFreshWalletAlerts(VALID_ADDRESS, { generator: customGenerator });
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("should batch generate alerts with convenience function", async () => {
    mockScorer.scoreWallet
      .mockResolvedValueOnce(createHighConfidenceResult())
      .mockResolvedValueOnce(createFirstTradeResult());

    const customGenerator = createFreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    const result = await batchGenerateFreshWalletAlerts([VALID_ADDRESS, VALID_ADDRESS_2], { generator: customGenerator });
    expect(result.totalProcessed).toBe(2);
  });

  it("should check alert trigger with convenience function", async () => {
    mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

    const customGenerator = createFreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    const result = await shouldTriggerFreshWalletAlert(VALID_ADDRESS, { generator: customGenerator });
    expect(result).toBe(true);
  });

  it("should get alerts with convenience function", async () => {
    mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

    const customGenerator = createFreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    await customGenerator.generateAlerts(VALID_ADDRESS);

    const alerts = getFreshWalletAlerts(VALID_ADDRESS, customGenerator);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it("should get alert summary with convenience function", async () => {
    mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

    const customGenerator = createFreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    await customGenerator.generateAlerts(VALID_ADDRESS);

    const summary = getFreshWalletAlertSummary(customGenerator);
    expect(summary.total).toBeGreaterThan(0);
  });
});

describe("Default Alert Conditions", () => {
  it("should have required properties for all conditions", () => {
    for (const condition of DEFAULT_ALERT_CONDITIONS) {
      expect(condition.id).toBeDefined();
      expect(condition.name).toBeDefined();
      expect(condition.description).toBeDefined();
      expect(typeof condition.enabled).toBe("boolean");
      expect(condition.alertType).toBeDefined();
    }
  });

  it("should have unique IDs", () => {
    const ids = DEFAULT_ALERT_CONDITIONS.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should cover all alert types", () => {
    const types = new Set(DEFAULT_ALERT_CONDITIONS.map(c => c.alertType));
    expect(types.size).toBeGreaterThan(1);
  });
});

describe("Alert Context", () => {
  let mockScorer: { scoreWallet: ReturnType<typeof vi.fn>; scoreWallets: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockScorer = {
      scoreWallet: vi.fn(),
      scoreWallets: vi.fn(),
    };

    (getSharedFreshWalletConfidenceScorer as ReturnType<typeof vi.fn>).mockReturnValue(mockScorer);
  });

  it("should include all context fields in generated alert", async () => {
    mockScorer.scoreWallet.mockResolvedValue(createHighConfidenceResult());

    const generator = new FreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    const alerts = await generator.generateAlerts(VALID_ADDRESS, {
      marketId: "test_market",
      tradeId: "test_trade",
    });

    const alert = alerts[0]!;
    expect(alert.context.confidenceScore).toBeDefined();
    expect(alert.context.confidenceLevel).toBeDefined();
    expect(alert.context.topSignals).toBeDefined();
    expect(alert.context.summary).toBeDefined();
    expect(alert.context.marketId).toBe("test_market");
    expect(alert.context.tradeId).toBe("test_trade");
  });

  it("should include underlying result data in context", async () => {
    const result = createHighConfidenceResult();
    mockScorer.scoreWallet.mockResolvedValue(result);

    const generator = new FreshWalletAlertGenerator({
      confidenceScorer: mockScorer as unknown as FreshWalletConfidenceScorer,
    });

    const alerts = await generator.generateAlerts(VALID_ADDRESS);
    const alert = alerts[0]!;

    expect(alert.context.walletAgeDays).toBe(result.underlyingResults.walletAge?.ageInDays);
    expect(alert.context.polymarketTradeCount).toBe(result.underlyingResults.zeroHistory?.polymarketTradeCount);
  });
});
