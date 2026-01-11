/**
 * Unit Tests for Wallet Reactivation Detector (DET-FRESH-007)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WalletReactivationDetector,
  ReactivationStatus,
  DormancySeverity,
  ActivityPatternType,
  DEFAULT_DORMANCY_SEVERITY_THRESHOLDS,
  createWalletReactivationDetector,
  getSharedWalletReactivationDetector,
  setSharedWalletReactivationDetector,
  resetSharedWalletReactivationDetector,
  checkWalletReactivation,
  batchCheckWalletReactivation,
  isWalletDormant,
  wasWalletRecentlyReactivated,
  getWalletDaysSinceActivity,
  getReactivationSummary,
  type WalletReactivationResult,
  type WalletReactivationDetectorConfig,
} from "../../src/detection/wallet-reactivation";
import { FreshWalletAlertSeverity, AgeCategory } from "../../src/detection";

// Mock the external dependencies
vi.mock("../../src/api/clob/trades", () => ({
  getAllTradesByWallet: vi.fn(),
  getWalletActivitySummary: vi.fn(),
}));

vi.mock("../../src/detection/wallet-age", () => ({
  calculateWalletAge: vi.fn(),
  AgeCategory: {
    NEW: "NEW",
    VERY_FRESH: "VERY_FRESH",
    FRESH: "FRESH",
    RECENT: "RECENT",
    ESTABLISHED: "ESTABLISHED",
    MATURE: "MATURE",
  },
}));

vi.mock("../../src/detection/fresh-wallet-config", () => ({
  getSharedFreshWalletConfigManager: vi.fn(),
  FreshWalletAlertSeverity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },
}));

import { getAllTradesByWallet, getWalletActivitySummary } from "../../src/api/clob/trades";
import { calculateWalletAge } from "../../src/detection/wallet-age";
import { getSharedFreshWalletConfigManager } from "../../src/detection/fresh-wallet-config";

// Test wallet addresses
const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const INVALID_ADDRESS = "0xinvalid";

// Mock config manager
const mockConfigManager = {
  getConfig: vi.fn(),
  evaluateWallet: vi.fn(),
};

// Helper to create mock trades
function createMockTrades(dates: Date[], baseVolume: number = 100): Array<{
  id: string;
  asset_id: string;
  side: string;
  price: string;
  size: string;
  created_at: string;
}> {
  return dates.map((date, i) => ({
    id: `${i}`,
    asset_id: "0x123",
    side: i % 2 === 0 ? "buy" : "sell",
    price: "0.5",
    size: String(baseVolume),
    created_at: date.toISOString(),
  }));
}

// Helper to get days ago date
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe("WalletReactivationDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedWalletReactivationDetector();

    // Set up default mocks
    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(mockConfigManager);
  });

  afterEach(() => {
    resetSharedWalletReactivationDetector();
  });

  describe("Constructor", () => {
    it("should create with default configuration", () => {
      const detector = new WalletReactivationDetector();
      expect(detector).toBeInstanceOf(WalletReactivationDetector);

      const stats = detector.getCacheStats();
      expect(stats.maxSize).toBe(1000);
      expect(stats.ttlMs).toBe(5 * 60 * 1000);
      expect(detector.getDormancyThreshold()).toBe(30);
    });

    it("should create with custom configuration", () => {
      const config: WalletReactivationDetectorConfig = {
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        defaultDormancyThresholdDays: 60,
        defaultActivityWindowDays: 180,
        defaultMaxTrades: 1000,
      };

      const detector = new WalletReactivationDetector(config);
      const stats = detector.getCacheStats();

      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);
      expect(detector.getDormancyThreshold()).toBe(60);
    });

    it("should create with custom dormancy severity thresholds", () => {
      const config: WalletReactivationDetectorConfig = {
        dormancySeverityThresholds: {
          shortMaxDays: 45,
          mediumMaxDays: 120,
          longMaxDays: 240,
        },
      };

      const detector = new WalletReactivationDetector(config);
      const thresholds = detector.getDormancySeverityThresholds();

      expect(thresholds.shortMaxDays).toBe(45);
      expect(thresholds.mediumMaxDays).toBe(120);
      expect(thresholds.longMaxDays).toBe(240);
    });
  });

  describe("checkWallet", () => {
    it("should throw error for invalid address", async () => {
      const detector = new WalletReactivationDetector();

      await expect(detector.checkWallet(INVALID_ADDRESS)).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should throw error for empty address", async () => {
      const detector = new WalletReactivationDetector();

      await expect(detector.checkWallet("")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should return NO_HISTORY status for wallet with no trades", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.status).toBe(ReactivationStatus.NO_HISTORY);
      expect(result.isReactivated).toBe(false);
      expect(result.totalTradeCount).toBe(0);
      expect(result.daysSinceLastActivity).toBeNull();
    });

    it("should detect dormant wallet", async () => {
      // Trades from 60 days ago - beyond 30-day dormancy threshold
      const mockTrades = createMockTrades([daysAgo(60), daysAgo(62), daysAgo(65)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 3,
        totalVolume: 300,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[2]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 100,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.status).toBe(ReactivationStatus.DORMANT);
      expect(result.isReactivated).toBe(false);
      expect(result.daysSinceLastActivity).toBeGreaterThanOrEqual(59);
    });

    it("should detect never dormant wallet with consistent activity", async () => {
      // Regular trades over the past 30 days
      const mockTrades = createMockTrades([
        daysAgo(1),
        daysAgo(5),
        daysAgo(10),
        daysAgo(15),
        daysAgo(20),
        daysAgo(25),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 6,
        totalVolume: 600,
        uniqueTokens: new Set(["token1", "token2"]),
        firstTradeAt: mockTrades[5]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 365,
        category: AgeCategory.MATURE,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.status).toBe(ReactivationStatus.NEVER_DORMANT);
      expect(result.isReactivated).toBe(false);
    });

    it("should detect just reactivated wallet", async () => {
      // Old trades followed by dormancy, then very recent activity
      const mockTrades = createMockTrades([
        daysAgo(2), // Just came back
        daysAgo(100), // Old activity
        daysAgo(105),
        daysAgo(110),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 4,
        totalVolume: 400,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[3]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 200,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.status).toBe(ReactivationStatus.JUST_REACTIVATED);
      expect(result.isReactivated).toBe(true);
      expect(result.reactivationEvent).not.toBeNull();
      expect(result.reactivationEvent!.dormancyDays).toBeGreaterThanOrEqual(90);
    });

    it("should detect recently reactivated wallet", async () => {
      // Old trades followed by dormancy, then activity 10-15 days ago
      const mockTrades = createMockTrades([
        daysAgo(10),
        daysAgo(12),
        daysAgo(15),
        daysAgo(100), // Gap > 30 days (dormancy)
        daysAgo(105),
        daysAgo(110),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 6,
        totalVolume: 600,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[5]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 200,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.status).toBe(ReactivationStatus.RECENTLY_REACTIVATED);
      expect(result.isReactivated).toBe(true);
      expect(result.reactivationEvent).not.toBeNull();
    });

    it("should use cached result when available", async () => {
      const mockTrades = createMockTrades([daysAgo(5)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();

      // First call - should fetch from API
      const result1 = await detector.checkWallet(VALID_ADDRESS);
      expect(result1.fromCache).toBe(false);
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await detector.checkWallet(VALID_ADDRESS);
      expect(result2.fromCache).toBe(true);
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when requested", async () => {
      const mockTrades = createMockTrades([daysAgo(5)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();

      await detector.checkWallet(VALID_ADDRESS);
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(1);

      const result = await detector.checkWallet(VALID_ADDRESS, { bypassCache: true });
      expect(result.fromCache).toBe(false);
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(2);
    });

    it("should skip wallet age calculation when requested", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS, { includeWalletAge: false });

      expect(result.walletAge).toBeNull();
      expect(calculateWalletAge).not.toHaveBeenCalled();
    });

    it("should use custom dormancy threshold", async () => {
      // Trades 45 days ago - dormant with default (30 days) but not with 60 day threshold
      const mockTrades = createMockTrades([daysAgo(45)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 100,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();

      // With default threshold (30 days), should be dormant
      const result1 = await detector.checkWallet(VALID_ADDRESS);
      expect(result1.status).toBe(ReactivationStatus.DORMANT);

      // With 60 day threshold, should not be dormant
      const result2 = await detector.checkWallet(VALID_ADDRESS, {
        dormancyThresholdDays: 60,
        bypassCache: true,
      });
      expect(result2.status).toBe(ReactivationStatus.NEVER_DORMANT);
    });
  });

  describe("Reactivation Event Detection", () => {
    it("should detect reactivation event with correct dormancy duration", async () => {
      const mockTrades = createMockTrades([
        daysAgo(5),  // Recent activity
        daysAgo(90), // Old activity (85 day gap)
        daysAgo(92),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 3,
        totalVolume: 300,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[2]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 100,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.reactivationEvent).not.toBeNull();
      expect(result.reactivationEvent!.dormancyDays).toBeGreaterThanOrEqual(80);
      expect(result.reactivationEvent!.dormancyDays).toBeLessThanOrEqual(90);
    });

    it("should classify dormancy severity correctly", async () => {
      // Test SHORT dormancy (30-60 days)
      const mockTradesShort = createMockTrades([daysAgo(5), daysAgo(50)]);
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTradesShort);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTradesShort[1]!.created_at,
        lastTradeAt: mockTradesShort[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 100,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const resultShort = await detector.checkWallet(VALID_ADDRESS);

      expect(resultShort.reactivationEvent?.dormancySeverity).toBe(DormancySeverity.SHORT);
    });

    it("should detect burst activity pattern", async () => {
      // Many trades in quick succession after dormancy
      const mockTrades = createMockTrades([
        daysAgo(1),
        daysAgo(1),
        daysAgo(1),
        daysAgo(2),
        daysAgo(2),
        daysAgo(2),
        daysAgo(100), // Long dormancy before
        daysAgo(102),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 8,
        totalVolume: 800,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[7]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 150,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.reactivationEvent?.activityPattern).toBe(ActivityPatternType.BURST);
    });

    it("should detect single shot activity pattern", async () => {
      // Single trade after dormancy
      const mockTrades = createMockTrades([
        daysAgo(5),
        daysAgo(100),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 150,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.reactivationEvent?.activityPattern).toBe(ActivityPatternType.SINGLE_SHOT);
    });
  });

  describe("Suspicious Reactivation Detection", () => {
    it("should flag long dormancy reactivation as suspicious", async () => {
      const mockTrades = createMockTrades([
        daysAgo(3),
        daysAgo(250), // >180 days = LONG dormancy
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 300,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.isSuspicious).toBe(true);
      expect(result.reactivationEvent?.dormancySeverity).toBe(DormancySeverity.LONG);
    });

    it("should flag burst activity after dormancy as suspicious", async () => {
      const mockTrades = createMockTrades([
        daysAgo(1),
        daysAgo(1),
        daysAgo(1),
        daysAgo(1),
        daysAgo(1),
        daysAgo(80),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 6,
        totalVolume: 600,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[5]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 100,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.isSuspicious).toBe(true);
      expect(result.reactivationEvent?.activityPattern).toBe(ActivityPatternType.BURST);
    });

    it("should flag fresh wallet with sudden reactivation as suspicious", async () => {
      const mockTrades = createMockTrades([
        daysAgo(3),
        daysAgo(100),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 15,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.isSuspicious).toBe(true);
    });

    it("should not flag regular reactivation as suspicious", async () => {
      const mockTrades = createMockTrades([
        daysAgo(3),
        daysAgo(5),
        daysAgo(50), // SHORT dormancy
        daysAgo(52),
        daysAgo(55),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 5,
        totalVolume: 500,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[4]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 365,
        category: AgeCategory.MATURE,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.isSuspicious).toBe(false);
    });
  });

  describe("Alert Severity", () => {
    it("should assign CRITICAL severity to extended dormancy with fresh wallet", async () => {
      const mockTrades = createMockTrades([
        daysAgo(2),
        daysAgo(400), // >365 days = EXTENDED
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 20,
        category: AgeCategory.FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.severity).toBe(FreshWalletAlertSeverity.CRITICAL);
    });

    it("should assign HIGH severity to long dormancy", async () => {
      const mockTrades = createMockTrades([
        daysAgo(3),
        daysAgo(250), // >180 days = LONG
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 300,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.severity).toBe(FreshWalletAlertSeverity.HIGH);
    });

    it("should assign LOW severity to no history", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 100,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.severity).toBe(FreshWalletAlertSeverity.LOW);
    });
  });

  describe("Activity Timeline", () => {
    it("should build correct activity timeline", async () => {
      const mockTrades = createMockTrades([
        daysAgo(1),
        daysAgo(1),
        daysAgo(5),
        daysAgo(10),
      ]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 4,
        totalVolume: 400,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[3]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 50,
        category: AgeCategory.FRESH,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallet(VALID_ADDRESS);

      expect(result.activityTimeline.length).toBeGreaterThan(0);
      // The most recent day should have 2 trades
      const mostRecentDay = result.activityTimeline.find((e) => e.tradeCount === 2);
      expect(mostRecentDay).toBeDefined();
    });
  });

  describe("checkWallets (Batch)", () => {
    it("should process multiple wallets", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it("should handle errors in batch processing", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("API error"));
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
    });

    it("should count reactivated and suspicious wallets", async () => {
      // First wallet: reactivated
      const reactivatedTrades = createMockTrades([daysAgo(2), daysAgo(100)]);
      // Second wallet: no history

      (getAllTradesByWallet as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(reactivatedTrades)
        .mockResolvedValueOnce(null);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: reactivatedTrades[1]!.created_at,
        lastTradeAt: reactivatedTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 150,
        category: AgeCategory.ESTABLISHED,
        isNew: false,
        isFresh: false,
      });

      const detector = new WalletReactivationDetector();
      const result = await detector.checkWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.reactivatedCount).toBe(1);
    });
  });

  describe("getSummary", () => {
    it("should return correct summary statistics", async () => {
      const mockResults: WalletReactivationResult[] = [
        {
          address: "0x1111111111111111111111111111111111111111",
          status: ReactivationStatus.JUST_REACTIVATED,
          isReactivated: true,
          isSuspicious: true,
          daysSinceLastActivity: 5,
          lastActivityAt: new Date(),
          firstActivityAt: new Date(),
          totalTradeCount: 10,
          totalVolume: 1000,
          uniqueMarketsTraded: 2,
          reactivationEvent: {
            lastActivityBefore: daysAgo(100),
            firstActivityAfter: daysAgo(5),
            dormancyDays: 95,
            dormancySeverity: DormancySeverity.MEDIUM,
            reactivationTradeCount: 5,
            reactivationVolume: 500,
            activityPattern: ActivityPatternType.BURST,
          },
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.HIGH,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
        {
          address: "0x2222222222222222222222222222222222222222",
          status: ReactivationStatus.DORMANT,
          isReactivated: false,
          isSuspicious: false,
          daysSinceLastActivity: 60,
          lastActivityAt: daysAgo(60),
          firstActivityAt: daysAgo(100),
          totalTradeCount: 5,
          totalVolume: 500,
          uniqueMarketsTraded: 1,
          reactivationEvent: null,
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.LOW,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
        {
          address: "0x3333333333333333333333333333333333333333",
          status: ReactivationStatus.NO_HISTORY,
          isReactivated: false,
          isSuspicious: false,
          daysSinceLastActivity: null,
          lastActivityAt: null,
          firstActivityAt: null,
          totalTradeCount: 0,
          totalVolume: 0,
          uniqueMarketsTraded: 0,
          reactivationEvent: null,
          activityTimeline: [],
          severity: FreshWalletAlertSeverity.LOW,
          walletAge: null,
          fromCache: false,
          checkedAt: new Date(),
        },
      ];

      const detector = new WalletReactivationDetector();
      const summary = detector.getSummary(mockResults);

      expect(summary.total).toBe(3);
      expect(summary.byStatus[ReactivationStatus.JUST_REACTIVATED]).toBe(1);
      expect(summary.byStatus[ReactivationStatus.DORMANT]).toBe(1);
      expect(summary.byStatus[ReactivationStatus.NO_HISTORY]).toBe(1);
      expect(summary.reactivatedPercentage).toBeCloseTo(33.33, 1);
      expect(summary.suspiciousPercentage).toBeCloseTo(33.33, 1);
      expect(summary.averageDormancyDays).toBe(95);
      expect(summary.medianDormancyDays).toBe(95);
      expect(summary.maxDormancyDays).toBe(95);
    });
  });

  describe("Convenience Methods", () => {
    it("isDormant should return correct result", async () => {
      const mockTrades = createMockTrades([daysAgo(60)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });

      const detector = new WalletReactivationDetector();
      const isDormant = await detector.isDormant(VALID_ADDRESS);

      expect(isDormant).toBe(true);
    });

    it("wasRecentlyReactivated should return correct result", async () => {
      const mockTrades = createMockTrades([daysAgo(5), daysAgo(100)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });

      const detector = new WalletReactivationDetector();
      const wasReactivated = await detector.wasRecentlyReactivated(VALID_ADDRESS);

      expect(wasReactivated).toBe(true);
    });

    it("getDaysSinceLastActivity should return correct value", async () => {
      const mockTrades = createMockTrades([daysAgo(10)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });

      const detector = new WalletReactivationDetector();
      const days = await detector.getDaysSinceLastActivity(VALID_ADDRESS);

      expect(days).toBeGreaterThanOrEqual(9);
      expect(days).toBeLessThanOrEqual(11);
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      const mockTrades = createMockTrades([daysAgo(5)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();

      await detector.checkWallet(VALID_ADDRESS);
      expect(detector.getCacheStats().size).toBe(1);

      detector.clearCache();
      expect(detector.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      const mockTrades = createMockTrades([daysAgo(5)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();

      await detector.checkWallet(VALID_ADDRESS);
      expect(detector.getCacheStats().size).toBe(1);

      const result = detector.invalidateCacheEntry(VALID_ADDRESS);
      expect(result).toBe(true);
      expect(detector.getCacheStats().size).toBe(0);
    });

    it("should return false when invalidating non-existent entry", () => {
      const detector = new WalletReactivationDetector();
      const result = detector.invalidateCacheEntry(VALID_ADDRESS);
      expect(result).toBe(false);
    });

    it("should return false when invalidating invalid address", () => {
      const detector = new WalletReactivationDetector();
      const result = detector.invalidateCacheEntry(INVALID_ADDRESS);
      expect(result).toBe(false);
    });
  });

  describe("Activity Tracking", () => {
    it("should track last known activity", async () => {
      const mockTrades = createMockTrades([daysAgo(5)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      await detector.checkWallet(VALID_ADDRESS);

      const lastKnown = detector.getLastKnownActivity(VALID_ADDRESS);
      expect(lastKnown).toBeDefined();
    });

    it("should detect activity change", async () => {
      const detector = new WalletReactivationDetector();

      // No previous activity tracked
      expect(detector.hasActivityChanged(VALID_ADDRESS, null)).toBe(false);

      // Mock tracking some activity
      const mockTrades = createMockTrades([daysAgo(5)]);
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      await detector.checkWallet(VALID_ADDRESS);

      // Now check with different activity
      const differentDate = new Date(Date.now() - 1000000);
      expect(detector.hasActivityChanged(VALID_ADDRESS, differentDate)).toBe(true);
    });

    it("should clear activity tracking", async () => {
      const mockTrades = createMockTrades([daysAgo(5)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const detector = new WalletReactivationDetector();
      await detector.checkWallet(VALID_ADDRESS);

      expect(detector.getLastKnownActivity(VALID_ADDRESS)).toBeDefined();

      detector.clearActivityTracking();

      expect(detector.getLastKnownActivity(VALID_ADDRESS)).toBeUndefined();
    });
  });

  describe("Singleton Management", () => {
    it("should create new instance with createWalletReactivationDetector", () => {
      const detector = createWalletReactivationDetector();
      expect(detector).toBeInstanceOf(WalletReactivationDetector);
    });

    it("should return shared instance with getSharedWalletReactivationDetector", () => {
      const detector1 = getSharedWalletReactivationDetector();
      const detector2 = getSharedWalletReactivationDetector();
      expect(detector1).toBe(detector2);
    });

    it("should set custom shared instance", () => {
      const customDetector = new WalletReactivationDetector({
        defaultDormancyThresholdDays: 90,
      });
      setSharedWalletReactivationDetector(customDetector);

      const shared = getSharedWalletReactivationDetector();
      expect(shared.getDormancyThreshold()).toBe(90);
    });

    it("should reset shared instance", () => {
      const detector1 = getSharedWalletReactivationDetector();
      resetSharedWalletReactivationDetector();
      const detector2 = getSharedWalletReactivationDetector();
      expect(detector1).not.toBe(detector2);
    });
  });

  describe("Convenience Functions", () => {
    it("checkWalletReactivation should use shared detector", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const result = await checkWalletReactivation(VALID_ADDRESS);
      expect(result.address.toLowerCase()).toBe(VALID_ADDRESS.toLowerCase());
    });

    it("batchCheckWalletReactivation should use shared detector", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (calculateWalletAge as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: VALID_ADDRESS,
        ageInDays: 10,
        category: AgeCategory.VERY_FRESH,
        isNew: false,
        isFresh: true,
      });

      const result = await batchCheckWalletReactivation([VALID_ADDRESS]);
      expect(result.totalProcessed).toBe(1);
    });

    it("isWalletDormant should use shared detector", async () => {
      const mockTrades = createMockTrades([daysAgo(60)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });

      const isDormant = await isWalletDormant(VALID_ADDRESS);
      expect(isDormant).toBe(true);
    });

    it("wasWalletRecentlyReactivated should use shared detector", async () => {
      const mockTrades = createMockTrades([daysAgo(5), daysAgo(100)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 2,
        totalVolume: 200,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[1]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });

      const wasReactivated = await wasWalletRecentlyReactivated(VALID_ADDRESS);
      expect(wasReactivated).toBe(true);
    });

    it("getWalletDaysSinceActivity should use shared detector", async () => {
      const mockTrades = createMockTrades([daysAgo(10)]);

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrades);
      (getWalletActivitySummary as ReturnType<typeof vi.fn>).mockReturnValue({
        walletAddress: VALID_ADDRESS,
        totalTrades: 1,
        totalVolume: 100,
        uniqueTokens: new Set(["token1"]),
        firstTradeAt: mockTrades[0]!.created_at,
        lastTradeAt: mockTrades[0]!.created_at,
      });

      const days = await getWalletDaysSinceActivity(VALID_ADDRESS);
      expect(days).toBeGreaterThanOrEqual(9);
    });

    it("getReactivationSummary should use shared detector", () => {
      const results: WalletReactivationResult[] = [];
      const summary = getReactivationSummary(results);
      expect(summary.total).toBe(0);
    });
  });

  describe("DEFAULT_DORMANCY_SEVERITY_THRESHOLDS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.shortMaxDays).toBe(60);
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.mediumMaxDays).toBe(180);
      expect(DEFAULT_DORMANCY_SEVERITY_THRESHOLDS.longMaxDays).toBe(365);
    });
  });
});
