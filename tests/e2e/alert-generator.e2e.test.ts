/**
 * E2E Tests for Alert Generator Service (API-LIVE-004)
 *
 * Tests the integration of AlertGeneratorService with event sources,
 * database services, and Telegram broadcasting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { AlertType, AlertSeverity, TradeSide, RiskLevel } from "@prisma/client";
import {
  AlertGeneratorService,
  createAlertGeneratorService,
  alertGeneratorService,
  type AlertCreatedEvent,
} from "../../src/services/alert-generator";
import type { WhaleTradeEvent, NewWalletEvent } from "../../src/services/trade-stream";
import type { WalletProfiledEvent } from "../../src/services/wallet-profiler";
import { ConfidenceLevel } from "../../src/detection/fresh-wallet-confidence";

// Integration test timeout
const TIMEOUT = 30000;

// Mock the database client
vi.mock("../../src/db/client", () => ({
  prisma: {
    alert: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock AlertService
vi.mock("../../src/db/alerts", () => ({
  alertService: {
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    getRecentAlerts: vi.fn(),
  },
  AlertService: vi.fn(),
  createAlertService: vi.fn(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    getRecentAlerts: vi.fn(),
  })),
}));

// Mock TradeStreamService
class MockTradeStreamService extends EventEmitter {}

// Mock WalletProfilerService
class MockWalletProfilerService extends EventEmitter {}

// Mock AlertBroadcaster
const createMockBroadcaster = () => ({
  broadcast: vi.fn().mockImplementation(async (alert) => ({
    alertId: alert.id,
    totalSubscribers: 5,
    eligibleSubscribers: 4,
    sent: 4,
    failed: 0,
    deactivated: 0,
    results: [],
    duration: 100,
  })),
});

// Test IDs for tracking
const TEST_MARKET_ID = "e2e-test-market-" + Date.now();
const TEST_WALLET_ID_PREFIX = "e2e-test-wallet-";

// Mock alert service type
interface MockAlertServiceType {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

describe("AlertGeneratorService E2E Tests", () => {
  let service: AlertGeneratorService;
  let mockTradeStream: MockTradeStreamService;
  let mockWalletProfiler: MockWalletProfilerService;
  let mockBroadcaster: ReturnType<typeof createMockBroadcaster>;
  let mockAlertServiceInstance: MockAlertServiceType;
  let alertIdCounter = 0;

  const createMockAlert = (overrides: Record<string, unknown> = {}) => ({
    id: `alert-${++alertIdCounter}`,
    type: AlertType.WHALE_TRADE,
    severity: AlertSeverity.MEDIUM,
    title: "Test Alert",
    message: "Test message",
    marketId: TEST_MARKET_ID,
    walletId: null,
    tags: [],
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    alertIdCounter = 0;

    mockTradeStream = new MockTradeStreamService();
    mockWalletProfiler = new MockWalletProfilerService();
    mockBroadcaster = createMockBroadcaster();

    // Setup mock alert service
    mockAlertServiceInstance = {
      create: vi.fn().mockImplementation(async (data) => createMockAlert(data)),
      findById: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };

    service = createAlertGeneratorService({
      tradeStreamService: mockTradeStream as any,
      walletProfilerService: mockWalletProfiler as any,
      alertService: mockAlertServiceInstance as any,
      alertBroadcaster: mockBroadcaster as any,
      enableEvents: true,
      enableTelegramBroadcast: true,
      whaleThreshold: 50000,
      suspicionThreshold: 70,
      deduplicationWindowMs: 100,
      maxAlertsPerWalletPerHour: 50,
      maxAlertsPerMarketPerHour: 100,
    });
  });

  afterEach(() => {
    if (service.getIsRunning()) {
      service.stop();
    }
    service.dispose();
  });

  describe("Service Lifecycle Integration", () => {
    it("should start and connect to event sources", async () => {
      const startedEvents: string[] = [];
      service.on("started", () => startedEvents.push("started"));

      await service.start();

      expect(service.getIsRunning()).toBe(true);
      expect(startedEvents).toContain("started");
      expect(service.getStats().startedAt).not.toBeNull();
    }, TIMEOUT);

    it("should stop and disconnect cleanly", async () => {
      await service.start();

      const stoppedEvents: string[] = [];
      service.on("stopped", () => stoppedEvents.push("stopped"));

      service.stop();

      expect(service.getIsRunning()).toBe(false);
      expect(stoppedEvents).toContain("stopped");
    }, TIMEOUT);

    it("should handle multiple start/stop cycles", async () => {
      for (let i = 0; i < 3; i++) {
        await service.start();
        expect(service.getIsRunning()).toBe(true);

        service.stop();
        expect(service.getIsRunning()).toBe(false);
      }
    }, TIMEOUT);

    it("should emit lifecycle events correctly", async () => {
      const startedHandler = vi.fn();
      const stoppedHandler = vi.fn();

      service.on("started", startedHandler);
      service.on("stopped", stoppedHandler);

      await service.start();
      expect(startedHandler).toHaveBeenCalledTimes(1);

      service.stop();
      expect(stoppedHandler).toHaveBeenCalledTimes(1);
    }, TIMEOUT);
  });

  describe("Whale Trade Alert Integration", () => {
    it("should create alert for whale trade events", async () => {
      await service.start();

      const alertCreatedHandler = vi.fn();
      service.on("alert:created", alertCreatedHandler);

      const walletId = `${TEST_WALLET_ID_PREFIX}whale-1`;
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-trade-1",
        clobTradeId: "e2e-clob-1",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2e1111111111111111111111111111111111111",
        side: TradeSide.BUY,
        amount: 5000,
        price: 0.72,
        usdValue: 150000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockAlertServiceInstance.create).toHaveBeenCalled();
      const createCall = mockAlertServiceInstance.create.mock.calls[0]?.[0];
      expect(createCall?.type).toBe(AlertType.WHALE_TRADE);
      expect(createCall?.walletId).toBe(walletId);
      expect(createCall?.marketId).toBe(TEST_MARKET_ID);

      expect(alertCreatedHandler).toHaveBeenCalled();
      const event = alertCreatedHandler.mock.calls[0]?.[0] as AlertCreatedEvent | undefined;
      expect(event?.type).toBe("alert:created");
    }, TIMEOUT);

    it("should calculate CRITICAL severity for very large trades", async () => {
      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}critical-1`;
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-critical-trade",
        clobTradeId: "e2e-critical-clob",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2e2222222222222222222222222222222222222",
        side: TradeSide.BUY,
        amount: 10000,
        price: 0.6,
        usdValue: 600000, // $600K = CRITICAL
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockAlertServiceInstance.create).toHaveBeenCalled();
      const createCall = mockAlertServiceInstance.create.mock.calls[0]?.[0];
      expect(createCall?.severity).toBe(AlertSeverity.CRITICAL);
    }, TIMEOUT);

    it("should calculate HIGH severity for large trades", async () => {
      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}high-1`;
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-high-trade",
        clobTradeId: "e2e-high-clob",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2e3333333333333333333333333333333333333",
        side: TradeSide.SELL,
        amount: 5000,
        price: 0.5,
        usdValue: 300000, // $300K = HIGH
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const createCall = mockAlertServiceInstance.create.mock.calls[0]?.[0];
      expect(createCall?.severity).toBe(AlertSeverity.HIGH);
    }, TIMEOUT);

    it("should broadcast whale trade alert to Telegram", async () => {
      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}broadcast-1`;
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-broadcast-trade",
        clobTradeId: "e2e-broadcast-clob",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2e4444444444444444444444444444444444444",
        side: TradeSide.BUY,
        amount: 8000,
        price: 0.8,
        usdValue: 200000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockBroadcaster.broadcast).toHaveBeenCalled();
    }, TIMEOUT);
  });

  describe("Fresh Wallet Alert Integration", () => {
    it("should create alert for new wallet events", async () => {
      await service.start();

      const alertCreatedHandler = vi.fn();
      service.on("alert:created", alertCreatedHandler);

      const walletId = `${TEST_WALLET_ID_PREFIX}fresh-1`;
      const newWalletEvent: NewWalletEvent = {
        type: "wallet:new",
        walletId,
        address: "0xe2e5555555555555555555555555555555555555",
        fromTrade: "e2e-fresh-trade-1",
      };

      mockTradeStream.emit("wallet:new", newWalletEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockAlertServiceInstance.create).toHaveBeenCalled();
      const createCall = mockAlertServiceInstance.create.mock.calls[0]?.[0];
      expect(createCall?.type).toBe(AlertType.FRESH_WALLET);
      expect(createCall?.severity).toBe(AlertSeverity.MEDIUM);
      expect(createCall?.walletId).toBe(walletId);
    }, TIMEOUT);
  });

  describe("Suspicious Wallet Alert Integration", () => {
    it("should create alert for high suspicion wallet profiles", async () => {
      await service.start();

      const alertCreatedHandler = vi.fn();
      service.on("alert:created", alertCreatedHandler);

      const walletId = `${TEST_WALLET_ID_PREFIX}suspicious-1`;
      const profiledEvent: WalletProfiledEvent = {
        type: "wallet:profiled",
        walletId,
        address: "0xe2e6666666666666666666666666666666666666",
        suspicionScore: 88,
        riskLevel: RiskLevel.HIGH,
        isFresh: true,
        isNew: false,
        confidenceLevel: ConfidenceLevel.HIGH,
        profilingTimeMs: 45,
        timestamp: new Date(),
      };

      mockWalletProfiler.emit("wallet:profiled", profiledEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockAlertServiceInstance.create).toHaveBeenCalled();
      const createCall = mockAlertServiceInstance.create.mock.calls[0]?.[0];
      expect(createCall?.type).toBe(AlertType.INSIDER_ACTIVITY);
      expect(createCall?.walletId).toBe(walletId);
    }, TIMEOUT);

    it("should NOT create alert for low suspicion wallet", async () => {
      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}normal-1`;
      const profiledEvent: WalletProfiledEvent = {
        type: "wallet:profiled",
        walletId,
        address: "0xe2e7777777777777777777777777777777777777",
        suspicionScore: 45, // Below threshold (70)
        riskLevel: RiskLevel.LOW,
        isFresh: false,
        isNew: false,
        confidenceLevel: ConfidenceLevel.LOW,
        profilingTimeMs: 30,
        timestamp: new Date(),
      };

      mockWalletProfiler.emit("wallet:profiled", profiledEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should not create an alert for low suspicion
      expect(mockAlertServiceInstance.create).not.toHaveBeenCalled();
    }, TIMEOUT);

    it("should calculate CRITICAL severity for very high suspicion score", async () => {
      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}critical-suspicion`;
      const profiledEvent: WalletProfiledEvent = {
        type: "wallet:profiled",
        walletId,
        address: "0xe2e8888888888888888888888888888888888888",
        suspicionScore: 98, // Very high = CRITICAL
        riskLevel: RiskLevel.CRITICAL,
        isFresh: true,
        isNew: true,
        confidenceLevel: ConfidenceLevel.HIGH,
        profilingTimeMs: 50,
        timestamp: new Date(),
      };

      mockWalletProfiler.emit("wallet:profiled", profiledEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const createCall = mockAlertServiceInstance.create.mock.calls[0]?.[0];
      expect(createCall?.severity).toBe(AlertSeverity.CRITICAL);
    }, TIMEOUT);
  });

  describe("Deduplication Integration", () => {
    it("should deduplicate alerts within time window", async () => {
      await service.start();

      const suppressedHandler = vi.fn();
      service.on("alert:suppressed", suppressedHandler);

      const walletId = `${TEST_WALLET_ID_PREFIX}dedup-1`;

      // Emit same whale event twice quickly
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-dedup-trade",
        clobTradeId: "e2e-dedup-clob",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2e9999999999999999999999999999999999999",
        side: TradeSide.BUY,
        amount: 3000,
        price: 0.65,
        usdValue: 100000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      mockTradeStream.emit("trade:whale", { ...whaleEvent, tradeId: "e2e-dedup-trade-2" });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only create 1 alert due to deduplication
      expect(mockAlertServiceInstance.create).toHaveBeenCalledTimes(1);
      expect(service.getStats().suppressedCount).toBe(1);
      expect(suppressedHandler).toHaveBeenCalled();
    }, TIMEOUT);

    it("should allow alerts after deduplication window expires", async () => {
      // Use a very short dedup window for this test
      service = createAlertGeneratorService({
        tradeStreamService: mockTradeStream as any,
        walletProfilerService: mockWalletProfiler as any,
        alertService: mockAlertServiceInstance as any,
        alertBroadcaster: mockBroadcaster as any,
        enableEvents: true,
        enableTelegramBroadcast: true,
        deduplicationWindowMs: 50, // Very short for testing
        maxAlertsPerWalletPerHour: 50,
        maxAlertsPerMarketPerHour: 100,
      });

      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}dedup-expire`;

      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-dedup-expire-1",
        clobTradeId: "e2e-dedup-expire-clob-1",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2eaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        side: TradeSide.BUY,
        amount: 4000,
        price: 0.7,
        usdValue: 100000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Wait for dedup window to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      mockTradeStream.emit("trade:whale", { ...whaleEvent, tradeId: "e2e-dedup-expire-2" });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have created 2 alerts since window expired
      expect(mockAlertServiceInstance.create).toHaveBeenCalledTimes(2);
    }, TIMEOUT);
  });

  describe("Statistics Integration", () => {
    it("should accumulate statistics across multiple alerts", async () => {
      await service.start();

      // Emit multiple different events
      const walletId1 = `${TEST_WALLET_ID_PREFIX}stats-1`;
      const walletId2 = `${TEST_WALLET_ID_PREFIX}stats-2`;

      const whaleEvent1: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-stats-trade-1",
        clobTradeId: "e2e-stats-clob-1",
        marketId: TEST_MARKET_ID,
        walletId: walletId1,
        walletAddress: "0xe2ebbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        side: TradeSide.BUY,
        amount: 5000,
        price: 0.7,
        usdValue: 250000,
        timestamp: new Date(),
      };

      const newWalletEvent: NewWalletEvent = {
        type: "wallet:new",
        walletId: walletId2,
        address: "0xe2ecccccccccccccccccccccccccccccccccccc",
        fromTrade: "e2e-stats-fresh-trade",
      };

      mockTradeStream.emit("trade:whale", whaleEvent1);
      await new Promise((resolve) => setTimeout(resolve, 150));

      mockTradeStream.emit("wallet:new", newWalletEvent);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = service.getStats();
      expect(stats.totalGenerated).toBe(2);
      expect(stats.broadcastCount).toBe(2);
      expect(stats.byType[AlertType.WHALE_TRADE]).toBe(1);
      expect(stats.byType[AlertType.FRESH_WALLET]).toBe(1);
      expect(stats.lastAlertAt).not.toBeNull();
    }, TIMEOUT);

    it("should reset statistics correctly", async () => {
      await service.start();

      // Generate an alert
      const walletId = `${TEST_WALLET_ID_PREFIX}reset-stats`;
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-reset-trade",
        clobTradeId: "e2e-reset-clob",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2edddddddddddddddddddddddddddddddddddd",
        side: TradeSide.SELL,
        amount: 2000,
        price: 0.5,
        usdValue: 80000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(service.getStats().totalGenerated).toBe(1);

      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalGenerated).toBe(0);
      expect(stats.suppressedCount).toBe(0);
      expect(stats.broadcastCount).toBe(0);
    }, TIMEOUT);
  });

  describe("Configuration Integration", () => {
    it("should respect initial configuration", async () => {
      // Create service with specific config
      service = createAlertGeneratorService({
        tradeStreamService: mockTradeStream as any,
        walletProfilerService: mockWalletProfiler as any,
        alertService: mockAlertServiceInstance as any,
        alertBroadcaster: mockBroadcaster as any,
        enableEvents: true,
        enableTelegramBroadcast: false, // Disabled
        suspicionThreshold: 80,
      });

      await service.start();

      const walletId = `${TEST_WALLET_ID_PREFIX}config-test`;
      const whaleEvent: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-config-trade",
        clobTradeId: "e2e-config-clob",
        marketId: TEST_MARKET_ID,
        walletId,
        walletAddress: "0xe2eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        side: TradeSide.BUY,
        amount: 3000,
        price: 0.6,
        usdValue: 120000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Alert should be created but not broadcast
      expect(mockAlertServiceInstance.create).toHaveBeenCalled();
      expect(mockBroadcaster.broadcast).not.toHaveBeenCalled();
    }, TIMEOUT);

    it("should update configuration at runtime", async () => {
      await service.start();

      // Initially broadcasting is enabled
      const walletId1 = `${TEST_WALLET_ID_PREFIX}runtime-1`;
      const whaleEvent1: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-runtime-trade-1",
        clobTradeId: "e2e-runtime-clob-1",
        marketId: TEST_MARKET_ID,
        walletId: walletId1,
        walletAddress: "0xe2efffffffffffffffffffffffffffffffffffff",
        side: TradeSide.BUY,
        amount: 1000,
        price: 0.6,
        usdValue: 60000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent1);
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockBroadcaster.broadcast).toHaveBeenCalledTimes(1);

      // Update config to disable broadcasting
      service.updateConfig({
        enableTelegramBroadcast: false,
      });

      const walletId2 = `${TEST_WALLET_ID_PREFIX}runtime-2`;
      const whaleEvent2: WhaleTradeEvent = {
        type: "trade:whale",
        tradeId: "e2e-runtime-trade-2",
        clobTradeId: "e2e-runtime-clob-2",
        marketId: `${TEST_MARKET_ID}-runtime`,
        walletId: walletId2,
        walletAddress: "0xe2e0000000000000000000000000000000000001",
        side: TradeSide.SELL,
        amount: 2000,
        price: 0.7,
        usdValue: 80000,
        timestamp: new Date(),
      };

      mockTradeStream.emit("trade:whale", whaleEvent2);
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Broadcast count should still be 1 (not called for second alert)
      expect(mockBroadcaster.broadcast).toHaveBeenCalledTimes(1);
      expect(service.getStats().totalGenerated).toBe(2);
      expect(service.getStats().broadcastCount).toBe(1);
    }, TIMEOUT);
  });

  describe("Manual Alert Generation", () => {
    it("should generate alert via generateAlert method", async () => {
      await service.start();

      const alert = await service.generateAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: "E2E Test Alert",
        message: "This is a test alert created during E2E testing",
        tags: ["e2e-test", "system"],
      });

      expect(alert).toBeDefined();
      expect(alert.id).toBeDefined();
      expect(mockAlertServiceInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.SYSTEM,
          severity: AlertSeverity.INFO,
          title: "E2E Test Alert",
        })
      );
    }, TIMEOUT);

    it("should skip broadcasting for manual alerts when disabled", async () => {
      service = createAlertGeneratorService({
        tradeStreamService: mockTradeStream as any,
        walletProfilerService: mockWalletProfiler as any,
        alertService: mockAlertServiceInstance as any,
        alertBroadcaster: mockBroadcaster as any,
        enableEvents: true,
        enableTelegramBroadcast: false,
      });

      await service.start();

      await service.generateAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.LOW,
        title: "No Broadcast Alert",
        message: "This alert should not be broadcast",
      });

      expect(mockBroadcaster.broadcast).not.toHaveBeenCalled();
    }, TIMEOUT);
  });

  describe("Singleton and Factory", () => {
    it("should export singleton instance", () => {
      expect(alertGeneratorService).toBeInstanceOf(AlertGeneratorService);
    });

    it("should create independent instances with factory", () => {
      const service1 = createAlertGeneratorService({
        alertService: mockAlertServiceInstance as any,
        alertBroadcaster: mockBroadcaster as any,
        suspicionThreshold: 60,
      });
      const service2 = createAlertGeneratorService({
        alertService: mockAlertServiceInstance as any,
        alertBroadcaster: mockBroadcaster as any,
        suspicionThreshold: 80,
      });

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(AlertGeneratorService);
      expect(service2).toBeInstanceOf(AlertGeneratorService);
    });
  });

  describe("Dispose", () => {
    it("should clean up resources on dispose", async () => {
      await service.start();
      expect(service.getIsRunning()).toBe(true);

      service.dispose();
      expect(service.getIsRunning()).toBe(false);

      // Verify no listeners left
      expect(service.listenerCount("alert:created")).toBe(0);
    }, TIMEOUT);

    it("should handle dispose when not running", () => {
      // Service never started
      expect(() => service.dispose()).not.toThrow();
      expect(service.getIsRunning()).toBe(false);
    }, TIMEOUT);
  });
});
