/**
 * Wallet Profiler Service Tests (API-LIVE-003)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WalletProfilerService,
  createWalletProfilerService,
  walletProfilerService,
} from "../../src/services/wallet-profiler";
import type { Wallet } from "@prisma/client";
import { RiskLevel } from "@prisma/client";
import type { WalletAgeResult, AgeCategory, WalletAgeCalculator } from "../../src/detection/wallet-age";
import type { FreshWalletConfidenceScorer, FreshWalletConfidenceResult } from "../../src/detection/fresh-wallet-confidence";
import type { WalletBehaviorProfiler, WalletBehaviorProfile, TradingFrequency, ProfileTrade } from "../../src/detection/wallet-behavior-profiler";
import type { WalletService } from "../../src/db/wallets";

describe("WalletProfilerService", () => {
  // Mock dependencies
  let mockWalletService: {
    findById: ReturnType<typeof vi.fn>;
    findOrCreate: ReturnType<typeof vi.fn>;
    updateOnChainData: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  let mockAgeCalculator: {
    calculateAge: ReturnType<typeof vi.fn>;
  };

  let mockConfidenceScorer: {
    scoreWallet: ReturnType<typeof vi.fn>;
  };

  let mockBehaviorProfiler: {
    getProfile: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    buildProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockWalletService = {
      findById: vi.fn(),
      findOrCreate: vi.fn(),
      updateOnChainData: vi.fn(),
      update: vi.fn(),
    };

    mockAgeCalculator = {
      calculateAge: vi.fn(),
    };

    mockConfidenceScorer = {
      scoreWallet: vi.fn(),
    };

    mockBehaviorProfiler = {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
      buildProfile: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
    id: "wallet-1",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    label: null,
    walletType: "UNKNOWN",
    isWhale: false,
    isInsider: false,
    isFresh: false,
    isMonitored: false,
    isFlagged: false,
    isSanctioned: false,
    suspicionScore: 0,
    riskLevel: "NONE",
    totalVolume: 0,
    totalPnl: 0,
    tradeCount: 0,
    winCount: 0,
    winRate: null,
    avgTradeSize: null,
    maxTradeSize: null,
    firstTradeAt: null,
    lastTradeAt: null,
    walletCreatedAt: null,
    onChainTxCount: 0,
    walletAgeDays: null,
    primaryFundingSource: null,
    metadata: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: null,
    ...overrides,
  } as Wallet);

  const createMockAgeResult = (overrides: Partial<WalletAgeResult> = {}): WalletAgeResult => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    ageInDays: 30,
    ageInHours: 720,
    category: "ESTABLISHED" as AgeCategory,
    isFresh: false,
    isNew: false,
    firstTransactionTimestamp: Date.now() / 1000 - 30 * 24 * 60 * 60,
    firstTransactionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    firstTransactionHash: "0xtxhash",
    fromCache: false,
    calculatedAt: new Date(),
    ...overrides,
  });

  // Create a minimal mock for confidence results that satisfies the test needs
  const createMockConfidenceResult = (overrides: Record<string, unknown> = {}): FreshWalletConfidenceResult => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    confidenceScore: 30,
    confidenceLevel: "LOW",
    isSuspicious: false,
    severity: "LOW",
    categoryBreakdown: [],
    signalContributions: [],
    topSignals: [],
    summary: [],
    underlyingResults: {
      walletAge: null,
      zeroHistory: null,
      firstTrade: null,
      fundingPattern: null,
      reactivation: null,
      clustering: null,
    },
    calculatedAt: new Date(),
    ...overrides,
  } as unknown as FreshWalletConfidenceResult);

  // Create a minimal mock for behavior profile
  const createMockBehaviorProfile = (overrides: Record<string, unknown> = {}): WalletBehaviorProfile => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    version: 1,
    confidence: "HIGH",
    tradeCount: 10,
    totalVolume: 1000,
    timeDistribution: {
      hourlyDistribution: new Array(24).fill(0),
      dayOfWeekDistribution: new Array(7).fill(0),
      peakHours: [],
      peakDays: [],
      tradingDuringOffHours: 0,
    },
    marketPreferences: {
      categoryDistribution: {},
      topCategories: [],
      diversityScore: 0.5,
      concentrationScore: 0.3,
    },
    positionSizing: {
      avgSize: 100,
      medianSize: 80,
      maxSize: 500,
      minSize: 10,
      stdDev: 50,
      coefficient: 0.5,
      sizeDistribution: {},
    },
    performance: {
      winRate: 0.6,
      totalPnL: 100,
      avgPnLPerTrade: 10,
      bestTrade: 50,
      worstTrade: -20,
      profitFactor: 1.5,
    },
    tradingPatterns: {
      avgTradesPerDay: 2,
      avgTradesPerWeek: 10,
      avgTradesPerMonth: 40,
      buySellRatio: 1.2,
      holdingDuration: {},
      recentActivityLevel: "ACTIVE",
    },
    tradingFrequency: "REGULAR" as TradingFrequency,
    tradingStyle: "SWING",
    riskAppetite: "MODERATE",
    behaviorFlags: [],
    suspicionScore: 10,
    insights: [],
    tradeIds: [],
    ...overrides,
  } as unknown as WalletBehaviorProfile);

  // Helper to create a configured service with mocks
  const createTestService = (configOverrides: Record<string, unknown> = {}) => {
    return createWalletProfilerService({
      walletService: mockWalletService as unknown as WalletService,
      ageCalculator: mockAgeCalculator as unknown as WalletAgeCalculator,
      confidenceScorer: mockConfidenceScorer as unknown as FreshWalletConfidenceScorer,
      behaviorProfiler: mockBehaviorProfiler as unknown as WalletBehaviorProfiler,
      logger: vi.fn(),
      ...configOverrides,
    });
  };

  describe("constructor", () => {
    it("should create service with default config", () => {
      const service = new WalletProfilerService();
      expect(service).toBeInstanceOf(WalletProfilerService);
      expect(service.getIsRunning()).toBe(false);
    });

    it("should create service with custom config", () => {
      const service = new WalletProfilerService({
        cacheTtlMs: 60000,
        suspicionThreshold: 0.8,
        fetchOnChainData: false,
      });
      expect(service).toBeInstanceOf(WalletProfilerService);
    });

    it("should use custom logger", () => {
      const mockLogger = vi.fn();
      const service = createWalletProfilerService({
        logger: mockLogger,
      });
      expect(service).toBeInstanceOf(WalletProfilerService);
    });
  });

  describe("start/stop", () => {
    it("should start the service", () => {
      const service = createTestService();

      const startedHandler = vi.fn();
      service.on("started", startedHandler);

      service.start();

      expect(service.getIsRunning()).toBe(true);
      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it("should not start if already running", () => {
      const mockLogger = vi.fn();
      const service = createTestService({ logger: mockLogger });

      service.start();
      service.start();

      expect(mockLogger).toHaveBeenCalledWith("Service already running");
    });

    it("should stop the service", () => {
      const service = createTestService();

      const stoppedHandler = vi.fn();
      service.on("stopped", stoppedHandler);

      service.start();
      service.stop();

      expect(service.getIsRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalledTimes(1);
    });

    it("should not stop if not running", () => {
      const mockLogger = vi.fn();
      const service = createTestService({ logger: mockLogger });

      service.stop();

      expect(mockLogger).toHaveBeenCalledWith("Service not running");
    });
  });

  describe("profileWallet", () => {
    it("should profile an existing wallet", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result).not.toBeNull();
      expect(result?.address).toBe(mockWallet.address.toLowerCase());
      expect(result?.suspicionScore).toBe(mockConfidenceResult.confidenceScore);
      expect(mockWalletService.findOrCreate).toHaveBeenCalledWith(mockWallet.address.toLowerCase());
    });

    it("should create wallet if not found", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: true,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result).not.toBeNull();
      expect(result?.isNew).toBe(true);
      expect(mockWalletService.findOrCreate).toHaveBeenCalled();
    });

    it("should fetch on-chain data for new wallets when enabled", async () => {
      const mockWallet = createMockWallet();
      const mockAgeResult = createMockAgeResult();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: true,
      });
      mockAgeCalculator.calculateAge.mockResolvedValue(mockAgeResult);
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.updateOnChainData.mockResolvedValue(mockWallet);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: true });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result).not.toBeNull();
      expect(mockAgeCalculator.calculateAge).toHaveBeenCalledWith(mockWallet.address.toLowerCase());
      expect(mockWalletService.updateOnChainData).toHaveBeenCalledWith(
        mockWallet.id,
        expect.objectContaining({
          walletCreatedAt: mockAgeResult.firstTransactionDate,
          walletAgeDays: mockAgeResult.ageInDays,
        })
      );
    });

    it("should not fetch on-chain data for existing wallets", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: true });

      service.start();

      await service.profileWallet(mockWallet.address);

      expect(mockAgeCalculator.calculateAge).not.toHaveBeenCalled();
    });

    it("should use cache for recent profiles", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({
        fetchOnChainData: false,
        cacheTtlMs: 60000,
      });

      service.start();

      // First call
      const result1 = await service.profileWallet(mockWallet.address);

      // Second call - should use cache
      const result2 = await service.profileWallet(mockWallet.address);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(mockWalletService.findOrCreate).toHaveBeenCalledTimes(1);
      expect(mockConfidenceScorer.scoreWallet).toHaveBeenCalledTimes(1);

      const stats = service.getStats();
      expect(stats.cacheHits).toBe(1);
    });

    it("should bypass cache when requested", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({
        fetchOnChainData: false,
        cacheTtlMs: 60000,
      });

      service.start();

      // First call
      await service.profileWallet(mockWallet.address);

      // Second call with bypass cache
      await service.profileWallet(mockWallet.address, { bypassCache: true });

      expect(mockWalletService.findOrCreate).toHaveBeenCalledTimes(2);
      expect(mockConfidenceScorer.scoreWallet).toHaveBeenCalledTimes(2);
    });

    it("should emit wallet:profiled event", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({
        fetchOnChainData: false,
        enableEvents: true,
      });

      const profiledHandler = vi.fn();
      service.on("wallet:profiled", profiledHandler);

      service.start();

      await service.profileWallet(mockWallet.address);

      expect(profiledHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "wallet:profiled",
          walletId: mockWallet.id,
          address: mockWallet.address.toLowerCase(),
        })
      );
    });

    it("should track high suspicion in stats", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult({
        confidenceScore: 90,
        confidenceLevel: "VERY_HIGH",
        isSuspicious: true,
      });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue({
        ...mockWallet,
        suspicionScore: 90,
      });

      const service = createTestService({
        fetchOnChainData: false,
        enableEvents: true,
        suspicionThreshold: 70,
      });

      service.start();

      await service.profileWallet(mockWallet.address);

      const stats = service.getStats();
      expect(stats.highSuspicionCount).toBe(1);
    });

    it("should not emit events when disabled", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({
        fetchOnChainData: false,
        enableEvents: false,
      });

      const profiledHandler = vi.fn();
      service.on("wallet:profiled", profiledHandler);

      service.start();

      await service.profileWallet(mockWallet.address);

      expect(profiledHandler).not.toHaveBeenCalled();
    });

    it("should handle profiling errors gracefully", async () => {
      mockWalletService.findOrCreate.mockRejectedValue(new Error("Database error"));

      const service = createTestService({ fetchOnChainData: false });

      const errorHandler = vi.fn();
      service.on("profile:error", errorHandler);

      service.start();

      const result = await service.profileWallet("0x1234");

      expect(result).toBeNull();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "profile:error",
          message: "Database error",
        })
      );

      const stats = service.getStats();
      expect(stats.errorCount).toBe(1);
    });

    it("should update statistics after profiling", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult({
        isSuspicious: true,
      });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: true,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      await service.profileWallet(mockWallet.address);

      const stats = service.getStats();
      expect(stats.totalProfiled).toBe(1);
      expect(stats.newWalletsProfiled).toBe(1);
      expect(stats.lastProfiledAt).not.toBeNull();
    });
  });

  describe("updateBehaviorProfile", () => {
    it("should build new profile when no existing profile", async () => {
      const mockBehaviorProfile = createMockBehaviorProfile();
      const address = "0x1234567890abcdef1234567890abcdef12345678";

      mockBehaviorProfiler.getProfile.mockReturnValue(null);
      mockBehaviorProfiler.buildProfile.mockResolvedValue(mockBehaviorProfile);

      const service = createTestService({
        minTradesForProfile: 1, // Allow building with just 1 trade
      });

      service.start();

      const trades: ProfileTrade[] = [
        {
          tradeId: "trade-1",
          marketId: "market-1",
          side: "buy" as const,
          sizeUsd: 50,
          price: 0.5,
          timestamp: new Date(),
          outcome: "Yes",
        } as ProfileTrade,
      ];

      const result = await service.updateBehaviorProfile(address, trades);

      expect(result).not.toBeNull();
      expect(mockBehaviorProfiler.getProfile).toHaveBeenCalledWith(address.toLowerCase());
      expect(mockBehaviorProfiler.buildProfile).toHaveBeenCalledWith(
        address.toLowerCase(),
        expect.objectContaining({
          trades,
          includeTradeIds: true,
        })
      );
    });

    it("should update existing profile", async () => {
      const existingProfile = createMockBehaviorProfile();
      const updatedProfile = createMockBehaviorProfile({ tradeCount: 11 });
      const address = "0x1234567890abcdef1234567890abcdef12345678";

      mockBehaviorProfiler.getProfile.mockReturnValue(existingProfile);
      mockBehaviorProfiler.updateProfile.mockResolvedValue(updatedProfile);

      const service = createTestService();

      service.start();

      const trades: ProfileTrade[] = [
        {
          tradeId: "trade-2",
          marketId: "market-1",
          side: "sell" as const,
          sizeUsd: 100,
          price: 0.7,
          timestamp: new Date(),
          outcome: "Yes",
        } as ProfileTrade,
      ];

      const result = await service.updateBehaviorProfile(address, trades);

      expect(result).not.toBeNull();
      expect(mockBehaviorProfiler.updateProfile).toHaveBeenCalledWith(
        address.toLowerCase(),
        expect.objectContaining({
          newTrades: trades,
          fullRebuild: false,
        })
      );
    });
  });

  describe("cache management", () => {
    it("should clear cache", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({
        fetchOnChainData: false,
        cacheTtlMs: 60000,
      });

      service.start();

      // Profile wallet
      await service.profileWallet(mockWallet.address);

      // Clear cache
      service.clearCache();

      // Profile again - should not use cache
      await service.profileWallet(mockWallet.address);

      expect(mockWalletService.findOrCreate).toHaveBeenCalledTimes(2);
    });

    it("should expire stale cache entries", async () => {
      vi.useFakeTimers();

      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({
        fetchOnChainData: false,
        cacheTtlMs: 1000, // 1 second
      });

      service.start();

      // Profile wallet
      await service.profileWallet(mockWallet.address);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      // Profile again - should not use cache (expired)
      await service.profileWallet(mockWallet.address);

      expect(mockWalletService.findOrCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("statistics", () => {
    it("should track processing statistics", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      await service.profileWallet(mockWallet.address);

      const stats = service.getStats();
      expect(stats.totalProfiled).toBe(1);
      expect(stats.existingWalletsUpdated).toBe(1);
      expect(stats.startedAt).not.toBeNull();
      expect(stats.avgProfilingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should reset statistics", () => {
      const service = createTestService();

      service.start();
      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalProfiled).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.cacheHits).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      const mockLogger = vi.fn();
      const service = createTestService({
        suspicionThreshold: 50,
        logger: mockLogger,
      });

      service.updateConfig({ suspicionThreshold: 80 });

      expect(mockLogger).toHaveBeenCalledWith(
        "Config updated",
        expect.objectContaining({
          suspicionThreshold: 80,
        })
      );
    });
  });

  describe("dispose", () => {
    it("should dispose the service", () => {
      const service = createTestService();

      service.start();
      service.dispose();

      expect(service.getIsRunning()).toBe(false);
    });

    it("should clear cache on dispose", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      // Profile wallet to add to cache
      await service.profileWallet(mockWallet.address);

      service.dispose();

      const stats = service.getStats();
      expect(stats.cacheHits).toBe(0);
    });
  });

  describe("singleton and factory", () => {
    it("should export a singleton instance", () => {
      expect(walletProfilerService).toBeInstanceOf(WalletProfilerService);
    });

    it("should create new instances via factory", () => {
      const service1 = createWalletProfilerService();
      const service2 = createWalletProfilerService();
      expect(service1).not.toBe(service2);
    });
  });

  describe("risk level calculation", () => {
    it("should calculate correct risk level for low suspicion", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult({
        confidenceScore: 10,
      });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue({
        ...mockWallet,
        suspicionScore: 10,
        riskLevel: RiskLevel.NONE,
      });

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result?.riskLevel).toBe(RiskLevel.NONE);
    });

    it("should calculate correct risk level for medium suspicion", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult({
        confidenceScore: 50,
      });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue({
        ...mockWallet,
        suspicionScore: 50,
        riskLevel: RiskLevel.MEDIUM,
      });

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result?.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it("should calculate correct risk level for high suspicion", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult({
        confidenceScore: 75,
      });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue({
        ...mockWallet,
        suspicionScore: 75,
        riskLevel: RiskLevel.HIGH,
      });

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result?.riskLevel).toBe(RiskLevel.HIGH);
    });

    it("should calculate correct risk level for critical suspicion", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult({
        confidenceScore: 95,
      });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue({
        ...mockWallet,
        suspicionScore: 95,
        riskLevel: RiskLevel.CRITICAL,
      });

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const result = await service.profileWallet(mockWallet.address);

      expect(result?.riskLevel).toBe(RiskLevel.CRITICAL);
    });
  });

  describe("address normalization", () => {
    it("should normalize addresses to lowercase", async () => {
      const mockWallet = createMockWallet();
      const mockConfidenceResult = createMockConfidenceResult();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockConfidenceScorer.scoreWallet.mockResolvedValue(mockConfidenceResult);
      mockWalletService.update.mockResolvedValue(mockWallet);

      const service = createTestService({ fetchOnChainData: false });

      service.start();

      const upperAddress = "0x1234567890ABCDEF1234567890ABCDEF12345678";
      await service.profileWallet(upperAddress);

      expect(mockWalletService.findOrCreate).toHaveBeenCalledWith(upperAddress.toLowerCase());
    });
  });
});
