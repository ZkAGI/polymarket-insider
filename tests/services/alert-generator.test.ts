/**
 * Unit Tests for Alert Generator Service (API-LIVE-004)
 */

import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "events";
import { AlertType, AlertSeverity, TradeSide, RiskLevel } from "@prisma/client";
import {
  AlertGeneratorService,
  createAlertGeneratorService,
  type AlertGeneratorConfig,
  type AlertCreatedEvent,
} from "../../src/services/alert-generator";
import type { WhaleTradeEvent, NewWalletEvent } from "../../src/services/trade-stream";
import type { WalletProfiledEvent } from "../../src/services/wallet-profiler";
import { ConfidenceLevel } from "../../src/detection/fresh-wallet-confidence";

// ============================================================================
// Mocks
// ============================================================================

/**
 * Mock TradeStreamService
 */
class MockTradeStreamService extends EventEmitter {}

/**
 * Mock WalletProfilerService
 */
class MockWalletProfilerService extends EventEmitter {}

/**
 * Mock AlertService
 */
const createMockAlertService = () => ({
  create: vi.fn().mockImplementation(async (input) => ({
    id: `alert-${Date.now()}`,
    type: input.type,
    severity: input.severity ?? AlertSeverity.INFO,
    marketId: input.marketId ?? null,
    walletId: input.walletId ?? null,
    title: input.title,
    message: input.message,
    data: input.data ?? null,
    tags: input.tags ?? [],
    read: false,
    acknowledged: false,
    dismissed: false,
    expiresAt: null,
    actionBy: null,
    actionAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
});

/**
 * Mock AlertBroadcaster
 */
const createMockBroadcaster = () => ({
  broadcast: vi.fn().mockImplementation(async (alert) => ({
    alertId: alert.id,
    totalSubscribers: 10,
    eligibleSubscribers: 8,
    sent: 7,
    failed: 1,
    deactivated: 0,
    results: [],
    duration: 150,
  })),
});

/**
 * Create a test service instance
 */
function createTestService(overrides: Partial<AlertGeneratorConfig> = {}) {
  const mockTradeStreamService = new MockTradeStreamService();
  const mockWalletProfilerService = new MockWalletProfilerService();
  const mockAlertService = createMockAlertService();
  const mockBroadcaster = createMockBroadcaster();

  const service = createAlertGeneratorService({
    tradeStreamService: mockTradeStreamService as any,
    walletProfilerService: mockWalletProfilerService as any,
    alertService: mockAlertService as any,
    alertBroadcaster: mockBroadcaster as any,
    enableEvents: true,
    enableTelegramBroadcast: true,
    whaleThreshold: 50000,
    suspicionThreshold: 70,
    deduplicationWindowMs: 5000, // 5 seconds for faster tests
    ...overrides,
  });

  return {
    service,
    mockTradeStreamService,
    mockWalletProfilerService,
    mockAlertService,
    mockBroadcaster,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("AlertGeneratorService", () => {
  describe("constructor", () => {
    it("should create service with default config", () => {
      const service = createAlertGeneratorService();
      expect(service).toBeInstanceOf(AlertGeneratorService);
      expect(service.getIsRunning()).toBe(false);
    });

    it("should create service with custom config", () => {
      const { service } = createTestService({
        whaleThreshold: 100000,
        suspicionThreshold: 80,
        deduplicationWindowMs: 10000,
      });

      expect(service).toBeInstanceOf(AlertGeneratorService);
    });

    it("should have empty stats initially", () => {
      const { service } = createTestService();
      const stats = service.getStats();

      expect(stats.totalGenerated).toBe(0);
      expect(stats.broadcastCount).toBe(0);
      expect(stats.suppressedCount).toBe(0);
      expect(stats.startedAt).toBeNull();
    });
  });

  describe("start/stop", () => {
    it("should start the service", async () => {
      const { service } = createTestService();

      await service.start();

      expect(service.getIsRunning()).toBe(true);
      expect(service.getStats().startedAt).not.toBeNull();
    });

    it("should stop the service", async () => {
      const { service } = createTestService();

      await service.start();
      service.stop();

      expect(service.getIsRunning()).toBe(false);
    });

    it("should not start twice", async () => {
      const logger = vi.fn();

      const serviceWithLogger = createAlertGeneratorService({
        logger,
      });

      await serviceWithLogger.start();
      await serviceWithLogger.start();

      expect(logger).toHaveBeenCalledWith("Service already running");

      serviceWithLogger.stop();
    });

    it("should emit started event", async () => {
      const { service } = createTestService();
      const startedHandler = vi.fn();

      service.on("started", startedHandler);
      await service.start();

      expect(startedHandler).toHaveBeenCalled();

      service.stop();
    });

    it("should emit stopped event", async () => {
      const { service } = createTestService();
      const stoppedHandler = vi.fn();

      service.on("stopped", stoppedHandler);
      await service.start();
      service.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe("whale trade alerts", () => {
    it("should generate alert for whale trade", async () => {
      const { service, mockTradeStreamService, mockAlertService } = createTestService();

      await service.start();

      const alertCreatedHandler = vi.fn();
      service.on("alert:created", alertCreatedHandler);

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "trade-1",
        clobTradeId: "clob-1",
        marketId: "market-1",
        walletId: "wallet-1",
        walletAddress: "0x1234567890123456789012345678901234567890",
        side: TradeSide.BUY,
        amount: 10000,
        price: 0.75,
        usdValue: 100000,
        timestamp: new Date(),
      };

      mockTradeStreamService.emit("trade:whale", whaleEvent);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAlertService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.WHALE_TRADE,
          severity: AlertSeverity.MEDIUM,
          marketId: "market-1",
          walletId: "wallet-1",
        })
      );

      expect(alertCreatedHandler).toHaveBeenCalled();
      const calls = alertCreatedHandler.mock.calls;
      const event = calls[0]?.[0] as AlertCreatedEvent | undefined;
      expect(event?.alert.type).toBe(AlertType.WHALE_TRADE);

      service.stop();
    });

    it("should calculate correct severity for whale trades", async () => {
      const { service, mockTradeStreamService, mockAlertService } = createTestService();

      await service.start();

      const testCases = [
        { usdValue: 600000, expectedSeverity: AlertSeverity.CRITICAL },
        { usdValue: 300000, expectedSeverity: AlertSeverity.HIGH },
        { usdValue: 150000, expectedSeverity: AlertSeverity.MEDIUM },
        { usdValue: 75000, expectedSeverity: AlertSeverity.LOW },
        { usdValue: 30000, expectedSeverity: AlertSeverity.INFO },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i]!;

        const whaleEvent: WhaleTradeEvent = {
          type: "trade:whale",
          tradeId: `trade-${i}`,
          clobTradeId: `clob-${i}`,
          marketId: `market-${i}`,
          walletId: `wallet-severity-${i}`,
          walletAddress: `0x${i.toString().padStart(40, "0")}`,
          side: TradeSide.BUY,
          amount: 1000,
          price: 0.5,
          usdValue: tc.usdValue,
          timestamp: new Date(),
        };

        mockTradeStreamService.emit("trade:whale", whaleEvent);
        await new Promise((resolve) => setTimeout(resolve, 50));

        const calls = mockAlertService.create.mock.calls;
        const lastCall = calls[calls.length - 1]?.[0];
        expect(lastCall?.severity).toBe(tc.expectedSeverity);
      }

      service.stop();
    });

    it("should deduplicate whale trade alerts within window", async () => {
      const { service, mockTradeStreamService, mockAlertService } = createTestService({
        deduplicationWindowMs: 1000,
      });

      await service.start();

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "trade-1",
        clobTradeId: "clob-1",
        marketId: "market-1",
        walletId: "wallet-dedup",
        walletAddress: "0x1234567890123456789012345678901234567890",
        side: TradeSide.BUY,
        amount: 10000,
        price: 0.75,
        usdValue: 100000,
        timestamp: new Date(),
      };

      // Emit twice quickly
      mockTradeStreamService.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      mockTradeStreamService.emit("trade:whale", { ...whaleEvent, tradeId: "trade-2" });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only create one alert
      expect(mockAlertService.create).toHaveBeenCalledTimes(1);
      expect(service.getStats().suppressedCount).toBe(1);

      service.stop();
    });
  });

  describe("new wallet alerts", () => {
    it("should generate alert for new wallet", async () => {
      const { service, mockTradeStreamService, mockAlertService } = createTestService();

      await service.start();

      const newWalletEvent: NewWalletEvent = {
        type: "wallet:new",
        walletId: "wallet-new-1",
        address: "0xabcdef1234567890abcdef1234567890abcdef12",
        fromTrade: "trade-1",
      };

      mockTradeStreamService.emit("wallet:new", newWalletEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAlertService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.FRESH_WALLET,
          severity: AlertSeverity.MEDIUM,
          walletId: "wallet-new-1",
        })
      );

      service.stop();
    });
  });

  describe("wallet profiled alerts", () => {
    it("should generate alert for high suspicion wallet", async () => {
      const { service, mockWalletProfilerService, mockAlertService } = createTestService({
        suspicionThreshold: 70,
      });

      await service.start();

      const profiledEvent: WalletProfiledEvent = {
        type: "wallet:profiled",
        walletId: "wallet-suspicious-1",
        address: "0x1111111111111111111111111111111111111111",
        suspicionScore: 85,
        riskLevel: RiskLevel.HIGH,
        isFresh: true,
        isNew: false,
        confidenceLevel: ConfidenceLevel.HIGH,
        profilingTimeMs: 50,
        timestamp: new Date(),
      };

      mockWalletProfilerService.emit("wallet:profiled", profiledEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAlertService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.INSIDER_ACTIVITY,
          severity: AlertSeverity.HIGH,
          walletId: "wallet-suspicious-1",
        })
      );

      service.stop();
    });

    it("should not generate alert for low suspicion wallet", async () => {
      const { service, mockWalletProfilerService, mockAlertService } = createTestService({
        suspicionThreshold: 70,
      });

      await service.start();

      const profiledEvent: WalletProfiledEvent = {
        type: "wallet:profiled",
        walletId: "wallet-normal-1",
        address: "0x2222222222222222222222222222222222222222",
        suspicionScore: 50,
        riskLevel: RiskLevel.LOW,
        isFresh: false,
        isNew: false,
        confidenceLevel: ConfidenceLevel.LOW,
        profilingTimeMs: 30,
        timestamp: new Date(),
      };

      mockWalletProfilerService.emit("wallet:profiled", profiledEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAlertService.create).not.toHaveBeenCalled();

      service.stop();
    });

    it("should calculate correct severity for suspicion scores", async () => {
      const { service, mockWalletProfilerService, mockAlertService } = createTestService();

      await service.start();

      const testCases = [
        { score: 96, expectedSeverity: AlertSeverity.CRITICAL },
        { score: 88, expectedSeverity: AlertSeverity.HIGH },
        { score: 78, expectedSeverity: AlertSeverity.MEDIUM },
        { score: 72, expectedSeverity: AlertSeverity.LOW },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i]!;

        const profiledEvent: WalletProfiledEvent = {
          type: "wallet:profiled",
          walletId: `wallet-susp-${i}`,
          address: `0x${(i + 3).toString().padStart(40, "0")}`,
          suspicionScore: tc.score,
          riskLevel: RiskLevel.HIGH,
          isFresh: false,
          isNew: false,
          confidenceLevel: ConfidenceLevel.HIGH,
          profilingTimeMs: 25,
          timestamp: new Date(),
        };

        mockWalletProfilerService.emit("wallet:profiled", profiledEvent);
        await new Promise((resolve) => setTimeout(resolve, 50));

        const calls = mockAlertService.create.mock.calls;
        const lastCall = calls[calls.length - 1]?.[0];
        expect(lastCall?.severity).toBe(tc.expectedSeverity);
      }

      service.stop();
    });
  });

  describe("rate limiting", () => {
    it("should suppress alerts when wallet rate limit exceeded", async () => {
      const { service, mockTradeStreamService, mockAlertService } = createTestService({
        maxAlertsPerWalletPerHour: 2,
        deduplicationWindowMs: 10, // Very short for testing
      });

      await service.start();

      const suppressedHandler = vi.fn();
      service.on("alert:suppressed", suppressedHandler);

      // Generate 3 alerts for same wallet
      for (let i = 0; i < 3; i++) {
        const whaleEvent: WhaleTradeEvent = {
          type: "trade:whale",
          tradeId: `trade-${i}`,
          clobTradeId: `clob-${i}`,
          marketId: `market-rate-${i}`, // Different markets
          walletId: "wallet-rate-limited",
          walletAddress: "0x9999999999999999999999999999999999999999",
          side: TradeSide.SELL,
          amount: 5000,
          price: 0.6,
          usdValue: 80000,
          timestamp: new Date(),
        };

        mockTradeStreamService.emit("trade:whale", whaleEvent);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // Should only create 2 alerts
      expect(mockAlertService.create).toHaveBeenCalledTimes(2);
      expect(suppressedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "rate_limit",
          walletId: "wallet-rate-limited",
        })
      );

      service.stop();
    });
  });

  describe("Telegram broadcasting", () => {
    it("should broadcast alerts when enabled", async () => {
      const { service, mockTradeStreamService, mockBroadcaster } = createTestService({
        enableTelegramBroadcast: true,
      });

      await service.start();

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "trade-broadcast",
        clobTradeId: "clob-broadcast",
        marketId: "market-broadcast",
        walletId: "wallet-broadcast",
        walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        side: TradeSide.BUY,
        amount: 8000,
        price: 0.8,
        usdValue: 120000,
        timestamp: new Date(),
      };

      mockTradeStreamService.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockBroadcaster.broadcast).toHaveBeenCalled();
      expect(service.getStats().broadcastCount).toBe(1);

      service.stop();
    });

    it("should not broadcast when disabled", async () => {
      const { service, mockTradeStreamService, mockBroadcaster } = createTestService({
        enableTelegramBroadcast: false,
      });

      await service.start();

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "trade-no-broadcast",
        clobTradeId: "clob-no-broadcast",
        marketId: "market-no-broadcast",
        walletId: "wallet-no-broadcast",
        walletAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        side: TradeSide.SELL,
        amount: 6000,
        price: 0.7,
        usdValue: 90000,
        timestamp: new Date(),
      };

      mockTradeStreamService.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockBroadcaster.broadcast).not.toHaveBeenCalled();

      service.stop();
    });
  });

  describe("statistics", () => {
    it("should track alert statistics", async () => {
      const { service, mockTradeStreamService } = createTestService();

      await service.start();

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "trade-stats",
        clobTradeId: "clob-stats",
        marketId: "market-stats",
        walletId: "wallet-stats",
        walletAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
        side: TradeSide.BUY,
        amount: 7000,
        price: 0.65,
        usdValue: 110000,
        timestamp: new Date(),
      };

      mockTradeStreamService.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();
      expect(stats.totalGenerated).toBe(1);
      expect(stats.byType[AlertType.WHALE_TRADE]).toBe(1);
      expect(stats.bySeverity[AlertSeverity.MEDIUM]).toBe(1);
      expect(stats.lastAlertAt).not.toBeNull();

      service.stop();
    });

    it("should reset statistics", async () => {
      const { service, mockTradeStreamService } = createTestService();

      await service.start();

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "trade-reset",
        clobTradeId: "clob-reset",
        marketId: "market-reset",
        walletId: "wallet-reset",
        walletAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        side: TradeSide.SELL,
        amount: 5500,
        price: 0.55,
        usdValue: 95000,
        timestamp: new Date(),
      };

      mockTradeStreamService.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(service.getStats().totalGenerated).toBe(1);

      service.resetStats();

      expect(service.getStats().totalGenerated).toBe(0);
      expect(service.getStats().lastAlertAt).toBeNull();

      service.stop();
    });
  });

  describe("configuration updates", () => {
    it("should update configuration at runtime", async () => {
      const { service } = createTestService();

      await service.start();

      service.updateConfig({
        whaleThreshold: 200000,
        suspicionThreshold: 90,
        enableTelegramBroadcast: false,
      });

      // Config is private, but we can verify behavior
      // by checking that higher threshold whale trades don't generate alerts
      service.stop();
    });
  });

  describe("manual alert generation", () => {
    it("should allow manual alert generation", async () => {
      const { service, mockAlertService } = createTestService();

      await service.start();

      const alert = await service.generateAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: "Test Alert",
        message: "This is a test alert",
        tags: ["test"],
      });

      expect(alert).toBeDefined();
      expect(alert.type).toBe(AlertType.SYSTEM);
      expect(mockAlertService.create).toHaveBeenCalled();

      service.stop();
    });
  });

  describe("dispose", () => {
    it("should dispose service and clean up", async () => {
      const { service } = createTestService();

      await service.start();
      service.dispose();

      expect(service.getIsRunning()).toBe(false);
    });
  });
});
