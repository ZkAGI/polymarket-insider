/**
 * Tests for Post-Ingestion Detection Trigger (INGEST-DETECT-001)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted to ensure mocks are created before vi.mock calls
const { mockTradeFind, mockWalletFind, mockWalletUpdate, mockAlertCreate } = vi.hoisted(() => ({
  mockTradeFind: vi.fn(),
  mockWalletFind: vi.fn(),
  mockWalletUpdate: vi.fn(),
  mockAlertCreate: vi.fn(),
}));

// Mock Prisma client
vi.mock("../../src/db/client", () => ({
  createPrismaClient: vi.fn().mockReturnValue({
    trade: { findMany: mockTradeFind },
    wallet: { findMany: mockWalletFind, update: mockWalletUpdate },
  }),
}));

// Mock wallet service
vi.mock("../../src/db/wallets", () => ({
  createWalletService: vi.fn().mockReturnValue({
    update: mockWalletUpdate,
  }),
}));

// Mock alert service
vi.mock("../../src/db/alerts", () => ({
  createAlertService: vi.fn().mockReturnValue({
    create: mockAlertCreate,
  }),
}));

// Mock detection modules
vi.mock("../../src/detection/fresh-wallet-confidence", () => ({
  scoreFreshWalletConfidence: vi.fn().mockResolvedValue({
    confidenceScore: 30,
    confidenceLevel: "LOW",
    isSuspicious: false,
  }),
  ConfidenceLevel: {
    VERY_LOW: "VERY_LOW",
    LOW: "LOW",
    MODERATE: "MODERATE",
    HIGH: "HIGH",
    VERY_HIGH: "VERY_HIGH",
  },
}));

vi.mock("../../src/detection/composite-suspicion-scorer", () => ({
  calculateCompositeSuspicionScore: vi.fn().mockResolvedValue({
    compositeScore: 40,
    suspicionLevel: "MODERATE",
    categoryBreakdown: [],
    riskFlags: [],
  }),
}));

vi.mock("../../src/detection/volume-spike", () => ({
  detectVolumeSpike: vi.fn().mockResolvedValue({
    isSpike: false,
    spikeEvent: null,
    baseline: { average: 1000, stdDev: 100, isReliable: true },
  }),
  SpikeSeverity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },
}));

vi.mock("../../src/detection/trade-size", () => ({
  analyzeTrade: vi.fn().mockResolvedValue({
    category: "MEDIUM",
    isFlagged: false,
    percentileRank: 50,
  }),
  TradeSizeCategory: {
    SMALL: "SMALL",
    MEDIUM: "MEDIUM",
    LARGE: "LARGE",
    VERY_LARGE: "VERY_LARGE",
    WHALE: "WHALE",
  },
}));

vi.mock("../../src/detection/whale-threshold", () => ({
  isWhaleTradeSize: vi.fn().mockResolvedValue(false),
}));

// Import after mocks
import {
  DetectionTrigger,
  createDetectionTrigger,
  getSharedDetectionTrigger,
  setSharedDetectionTrigger,
  resetSharedDetectionTrigger,
  type DetectionTriggerConfig,
} from "../../src/workers/detection-trigger";

describe("DetectionTrigger", () => {
  let trigger: DetectionTrigger;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedDetectionTrigger();

    // Setup default mock returns
    mockTradeFind.mockResolvedValue([]);
    mockWalletFind.mockResolvedValue([]);
    mockWalletUpdate.mockResolvedValue({});
    mockAlertCreate.mockResolvedValue({ id: "alert-1" });

    trigger = createDetectionTrigger({
      debug: false,
    });
  });

  afterEach(() => {
    resetSharedDetectionTrigger();
  });

  describe("createDetectionTrigger", () => {
    it("should create a DetectionTrigger instance", () => {
      const trigger = createDetectionTrigger();
      expect(trigger).toBeInstanceOf(DetectionTrigger);
    });

    it("should apply default config values", () => {
      const trigger = createDetectionTrigger();
      expect(trigger.getIsRunning()).toBe(false);
    });

    it("should accept custom config", () => {
      const config: DetectionTriggerConfig = {
        alertThreshold: 60,
        flagThreshold: 80,
        insiderThreshold: 90,
        batchSize: 50,
        enableFreshWalletDetection: false,
        enableVolumeSpikeDetection: false,
        enableWhaleDetection: false,
        enableCompositeScoring: false,
        debug: true,
      };
      const trigger = createDetectionTrigger(config);
      expect(trigger).toBeInstanceOf(DetectionTrigger);
    });
  });

  describe("getSharedDetectionTrigger", () => {
    it("should return the same instance on multiple calls", () => {
      const trigger1 = getSharedDetectionTrigger();
      const trigger2 = getSharedDetectionTrigger();
      expect(trigger1).toBe(trigger2);
    });

    it("should create a new instance after reset", () => {
      const trigger1 = getSharedDetectionTrigger();
      resetSharedDetectionTrigger();
      const trigger2 = getSharedDetectionTrigger();
      expect(trigger1).not.toBe(trigger2);
    });
  });

  describe("setSharedDetectionTrigger", () => {
    it("should set the shared instance", () => {
      const customTrigger = createDetectionTrigger();
      setSharedDetectionTrigger(customTrigger);
      expect(getSharedDetectionTrigger()).toBe(customTrigger);
    });
  });

  describe("runDetectionCycle", () => {
    it("should complete successfully with no data", async () => {
      const result = await trigger.runDetectionCycle();

      expect(result.success).toBe(true);
      expect(result.walletsProcessed).toBe(0);
      expect(result.tradesAnalyzed).toBe(0);
      expect(result.freshWalletAlerts).toBe(0);
      expect(result.volumeAlerts).toBe(0);
      expect(result.whaleTradesDetected).toBe(0);
      expect(result.walletsFlagged).toBe(0);
      expect(result.potentialInsiders).toBe(0);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should process trades and wallets", async () => {
      mockTradeFind.mockResolvedValue([
        {
          id: "trade-1",
          walletId: "wallet-1",
          marketId: "market-1",
          usdValue: 100,
          timestamp: new Date(),
          isWhale: false,
        },
      ]);
      mockWalletFind.mockResolvedValue([
        {
          id: "wallet-1",
          address: "0x1234567890123456789012345678901234567890",
          tradeCount: 1,
          totalVolume: 100,
          suspicionScore: 0,
          isFresh: true,
          isWhale: false,
          isInsider: false,
          isFlagged: false,
          firstTradeAt: new Date(),
        },
      ]);

      const result = await trigger.runDetectionCycle();

      expect(result.success).toBe(true);
      expect(result.tradesAnalyzed).toBe(1);
      expect(result.walletsProcessed).toBe(1);
    });

    it("should accept specific trade and wallet IDs", async () => {
      mockTradeFind.mockResolvedValue([
        {
          id: "trade-123",
          walletId: "wallet-456",
          marketId: "market-1",
          usdValue: 500,
          timestamp: new Date(),
          isWhale: false,
        },
      ]);
      mockWalletFind.mockResolvedValue([
        {
          id: "wallet-456",
          address: "0xaabbccdd",
          tradeCount: 5,
          totalVolume: 5000,
          suspicionScore: 20,
          isFresh: false,
          isWhale: false,
          isInsider: false,
          isFlagged: false,
          firstTradeAt: new Date(),
        },
      ]);

      const result = await trigger.runDetectionCycle(
        ["trade-123"],
        ["wallet-456"]
      );

      expect(result.success).toBe(true);
      expect(mockTradeFind).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["trade-123"] } },
        })
      );
    });

    it("should prevent concurrent execution", async () => {
      // Setup slow running detection
      mockTradeFind.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );
      mockWalletFind.mockResolvedValue([]);

      // Start first cycle
      const cycle1Promise = trigger.runDetectionCycle();

      // Try to start second cycle immediately
      const cycle2Result = await trigger.runDetectionCycle();

      // Second should fail immediately
      expect(cycle2Result.success).toBe(false);
      expect(cycle2Result.error).toBe("Detection cycle already in progress");

      // Wait for first to complete
      const cycle1Result = await cycle1Promise;
      expect(cycle1Result.success).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      mockTradeFind.mockRejectedValue(new Error("DB connection failed"));

      const result = await trigger.runDetectionCycle();

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection failed");
    });
  });

  describe("Event emission", () => {
    it("should emit detection:start event", async () => {
      const startHandler = vi.fn();
      trigger.on("detection:start", startHandler);

      await trigger.runDetectionCycle();

      expect(startHandler).toHaveBeenCalled();
    });

    it("should emit detection:complete event on success", async () => {
      const completeHandler = vi.fn();
      trigger.on("detection:complete", completeHandler);

      await trigger.runDetectionCycle();

      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should emit detection:error event on failure", async () => {
      mockTradeFind.mockRejectedValue(new Error("Test error"));

      const errorHandler = vi.fn();
      trigger.on("detection:error", errorHandler);

      await trigger.runDetectionCycle();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Test error",
        })
      );
    });
  });

  describe("Detection configuration", () => {
    it("should disable fresh wallet detection when configured", async () => {
      const trigger = createDetectionTrigger({
        enableFreshWalletDetection: false,
        enableVolumeSpikeDetection: false,
        enableWhaleDetection: false,
        enableCompositeScoring: false,
      });

      mockTradeFind.mockResolvedValue([]);
      mockWalletFind.mockResolvedValue([
        {
          id: "wallet-1",
          address: "0x1234",
          tradeCount: 1,
          totalVolume: 100,
          suspicionScore: 0,
          isFresh: true,
          isWhale: false,
          isInsider: false,
          isFlagged: false,
          firstTradeAt: new Date(),
        },
      ]);

      const result = await trigger.runDetectionCycle();

      expect(result.success).toBe(true);
      expect(result.freshWalletAlerts).toBe(0);
    });
  });

  describe("getIsRunning", () => {
    it("should return false when not running", () => {
      expect(trigger.getIsRunning()).toBe(false);
    });

    it("should return true while detection cycle is in progress", async () => {
      let isRunningDuringCycle = false;

      mockTradeFind.mockImplementation(async () => {
        isRunningDuringCycle = trigger.getIsRunning();
        return [];
      });
      mockWalletFind.mockResolvedValue([]);

      await trigger.runDetectionCycle();

      expect(isRunningDuringCycle).toBe(true);
      expect(trigger.getIsRunning()).toBe(false);
    });
  });
});

describe("Detection Trigger Integration with Ingestion Worker", () => {
  it("should export required types and functions", async () => {
    const exports = await import("../../src/workers/detection-trigger");

    expect(exports.DetectionTrigger).toBeDefined();
    expect(exports.createDetectionTrigger).toBeDefined();
    expect(exports.getSharedDetectionTrigger).toBeDefined();
    expect(exports.setSharedDetectionTrigger).toBeDefined();
    expect(exports.resetSharedDetectionTrigger).toBeDefined();
  });

  // Skip this test in unit tests as it requires full module tree
  // Covered by E2E tests
  it.skip("should be re-exported from workers index", async () => {
    const workersExports = await import("../../src/workers");

    expect(workersExports.DetectionTrigger).toBeDefined();
    expect(workersExports.createDetectionTrigger).toBeDefined();
    expect(workersExports.getSharedDetectionTrigger).toBeDefined();
  });
});
