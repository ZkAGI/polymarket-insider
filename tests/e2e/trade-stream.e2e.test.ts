/**
 * E2E tests for Trade Stream Service (API-LIVE-002)
 *
 * Tests the integration of TradeStreamService with the trade stream client,
 * database services, and event system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TradeStreamService,
  createTradeStreamService,
  tradeStreamService,
  type TradeProcessedEvent,
  type WhaleTradeEvent,
  type NewWalletEvent,
  type ProcessingErrorEvent,
} from "../../src/services/trade-stream";
import type { ParsedTrade } from "../../src/api/ws/trade-stream";
import type { Trade, Wallet, Outcome } from "@prisma/client";
import { TradeSide } from "@prisma/client";

// Integration test timeout
const TIMEOUT = 30000;

// Mock the external dependencies
vi.mock("../../src/api/ws/trade-stream", () => {
  const handlers = new Map<string, (event: unknown) => void>();

  return {
    createTradeStreamClient: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      subscribe: vi.fn().mockResolvedValue({}),
      unsubscribeToken: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, handler: (event: unknown) => void) => {
        handlers.set(event, handler);
        return () => handlers.delete(event);
      }),
      emit: (event: string, data: unknown) => {
        const handler = handlers.get(event);
        if (handler) handler(data);
      },
      getHandlers: () => handlers,
    })),
    TradeStreamClient: vi.fn(),
  };
});

vi.mock("../../src/db/trades", () => ({
  tradeService: {
    upsertByClobTradeId: vi.fn(),
    findByClobTradeId: vi.fn(),
  },
  TradeService: vi.fn(),
}));

vi.mock("../../src/db/wallets", () => ({
  walletService: {
    findByAddress: vi.fn(),
    findOrCreate: vi.fn(),
    incrementTradeStats: vi.fn(),
  },
  WalletService: vi.fn(),
}));

vi.mock("../../src/db/client", () => ({
  prisma: {
    outcome: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../config/env", () => ({
  env: {
    WHALE_THRESHOLD_USD: 10000,
  },
}));

import { createTradeStreamClient } from "../../src/api/ws/trade-stream";
import { tradeService } from "../../src/db/trades";
import { walletService } from "../../src/db/wallets";
import { prisma } from "../../src/db/client";

const mockTradeService = vi.mocked(tradeService);
const mockWalletService = vi.mocked(walletService);
const mockOutcomeFindUnique = prisma.outcome.findUnique as ReturnType<typeof vi.fn>;

interface MockClient {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribeToken: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  getHandlers: () => Map<string, (event: unknown) => void>;
}

describe("Trade Stream Service E2E Tests", () => {
  let service: TradeStreamService;
  let mockClient: MockClient;

  const createMockParsedTrade = (overrides: Partial<ParsedTrade> = {}): ParsedTrade => ({
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    assetId: "token-abc-123",
    price: 0.65,
    probability: 65,
    size: 100,
    valueUsd: 65,
    side: "buy",
    makerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    takerAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    transactionHash: "0xdeadbeef1234567890",
    feeRateBps: 10,
    feeUsd: 0.065,
    timestamp: new Date(),
    receivedAt: new Date(),
    matchId: `match-${Date.now()}`,
    outcomeName: "Yes",
    marketQuestion: "Will BTC reach $100k?",
    sequence: 1,
    isLargeTrade: false,
    ...overrides,
  });

  const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
    id: `wallet-${Date.now()}`,
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
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

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mock client
    mockClient = createTradeStreamClient() as unknown as MockClient;

    // Setup default mock implementations
    mockWalletService.findOrCreate.mockResolvedValue({
      wallet: createMockWallet(),
      created: false,
    });

    mockOutcomeFindUnique.mockResolvedValue({
      id: "outcome-123",
      marketId: "market-456",
    } as Outcome);

    mockTradeService.upsertByClobTradeId.mockResolvedValue({
      id: "db-trade-1",
      marketId: "market-456",
      outcomeId: "outcome-123",
      walletId: "wallet-1",
      clobTradeId: "trade-123",
      matchId: "match-123",
      side: TradeSide.BUY,
      amount: 100,
      price: 0.65,
      usdValue: 65,
      feeUsd: 0.065,
      makerAddress: "0x1234",
      takerAddress: "0xabcd",
      isMaker: false,
      timestamp: new Date(),
      txHash: "0xdeadbeef",
      blockNumber: null,
      isWhale: false,
      isInsider: false,
      flags: [],
      createdAt: new Date(),
    } as Trade);

    mockWalletService.incrementTradeStats.mockResolvedValue(createMockWallet());

    service = createTradeStreamService({
      logger: vi.fn(),
    });
  });

  afterEach(() => {
    if (service.getIsRunning()) {
      service.stop();
    }
    service.dispose();
  });

  describe("Service Lifecycle Integration", () => {
    it("should start and connect to trade stream", async () => {
      const startedEvents: string[] = [];
      service.on("started", () => startedEvents.push("started"));

      await service.start();

      expect(service.getIsRunning()).toBe(true);
      expect(startedEvents).toContain("started");
      // Service is connected and running
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
  });

  describe("Trade Processing Integration", () => {
    it("should process trades end-to-end", async () => {
      await service.start();

      const processedEvents: TradeProcessedEvent[] = [];
      service.on("trade:processed", (event) => {
        processedEvents.push(event as TradeProcessedEvent);
      });

      // Trigger a trade event
      const mockTrade = createMockParsedTrade();
      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockWalletService.findOrCreate).toHaveBeenCalled();
      expect(mockOutcomeFindUnique).toHaveBeenCalled();
      expect(mockTradeService.upsertByClobTradeId).toHaveBeenCalled();
      expect(mockWalletService.incrementTradeStats).toHaveBeenCalled();

      const stats = service.getStats();
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(1);
      expect(stats.storedCount).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);

    it("should detect and emit whale trade events", async () => {
      await service.start();

      const whaleEvents: WhaleTradeEvent[] = [];
      service.on("trade:whale", (event) => {
        whaleEvents.push(event as WhaleTradeEvent);
      });

      // Trigger a whale trade
      const mockTrade = createMockParsedTrade({
        valueUsd: 15000, // Above threshold
      });

      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(whaleEvents.length).toBeGreaterThanOrEqual(1);
      expect(whaleEvents[0]?.usdValue).toBeGreaterThanOrEqual(15000);

      const stats = service.getStats();
      expect(stats.whaleTradesCount).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);

    it("should track new wallets", async () => {
      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: createMockWallet(),
        created: true, // New wallet
      });

      await service.start();

      const newWalletEvents: NewWalletEvent[] = [];
      service.on("wallet:new", (event) => {
        newWalletEvents.push(event as NewWalletEvent);
      });

      const mockTrade = createMockParsedTrade();
      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(newWalletEvents.length).toBeGreaterThanOrEqual(1);

      const stats = service.getStats();
      expect(stats.newWalletsCount).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);
  });

  describe("Error Handling Integration", () => {
    it("should handle database errors gracefully", async () => {
      mockTradeService.upsertByClobTradeId.mockRejectedValue(
        new Error("Database connection failed")
      );

      await service.start();

      const errorEvents: ProcessingErrorEvent[] = [];
      service.on("processing:error", (event) => {
        errorEvents.push(event as ProcessingErrorEvent);
      });

      const mockTrade = createMockParsedTrade();
      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
      expect(errorEvents[0]?.message).toContain("Database connection failed");

      const stats = service.getStats();
      expect(stats.errorCount).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);

    it("should handle missing outcome gracefully", async () => {
      mockOutcomeFindUnique.mockResolvedValue(null);

      await service.start();

      const mockTrade = createMockParsedTrade();
      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trade should not be stored when outcome is missing
      expect(mockTradeService.upsertByClobTradeId).not.toHaveBeenCalled();
    }, TIMEOUT);

    it("should handle duplicate trades", async () => {
      mockTradeService.upsertByClobTradeId.mockRejectedValue(
        new Error("Unique constraint failed: P2002")
      );

      await service.start();

      const mockTrade = createMockParsedTrade();
      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = service.getStats();
      expect(stats.duplicateCount).toBeGreaterThanOrEqual(1);
      // Duplicates should not count as errors
      expect(stats.errorCount).toBe(0);
    }, TIMEOUT);
  });

  describe("Subscription Management Integration", () => {
    it("should subscribe to market tokens", async () => {
      await service.start();

      // Verify service is running and can accept subscriptions
      expect(service.getIsRunning()).toBe(true);

      // This should not throw when subscribing
      await expect(service.subscribeToMarket("token-123")).resolves.not.toThrow();
    }, TIMEOUT);

    it("should subscribe to multiple tokens", async () => {
      await service.start();

      // Should accept array of tokens
      await expect(
        service.subscribeToMarket(["token-1", "token-2", "token-3"])
      ).resolves.not.toThrow();
    }, TIMEOUT);

    it("should unsubscribe from market", async () => {
      await service.start();

      // Should handle unsubscription without error
      await expect(
        service.unsubscribeFromMarket("token-123")
      ).resolves.not.toThrow();
    }, TIMEOUT);

    it("should throw when subscribing while not running", async () => {
      // Service not started
      await expect(service.subscribeToMarket("token-123")).rejects.toThrow(
        "Service not running"
      );
    }, TIMEOUT);
  });

  describe("Statistics Integration", () => {
    it("should accumulate statistics across multiple trades", async () => {
      await service.start();

      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      // Process multiple trades
      for (let i = 0; i < 5; i++) {
        const mockTrade = createMockParsedTrade({ id: `trade-${i}` });
        if (tradeHandler) {
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          });
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = service.getStats();
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(5);
      expect(stats.storedCount).toBeGreaterThanOrEqual(5);
    }, TIMEOUT);

    it("should reset statistics correctly", async () => {
      await service.start();

      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      // Process a trade
      const mockTrade = createMockParsedTrade();
      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset stats
      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.storedCount).toBe(0);
      expect(stats.errorCount).toBe(0);
    }, TIMEOUT);
  });

  describe("Configuration Integration", () => {
    it("should respect whale threshold configuration", async () => {
      service = createTradeStreamService({
        whaleThreshold: 5000, // Lower threshold
        logger: vi.fn(),
      });

      await service.start();

      const whaleEvents: WhaleTradeEvent[] = [];
      service.on("trade:whale", (event) => {
        whaleEvents.push(event as WhaleTradeEvent);
      });

      // Trade above custom threshold
      const mockTrade = createMockParsedTrade({
        valueUsd: 6000, // Above 5000 but below default 10000
      });

      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(whaleEvents.length).toBeGreaterThanOrEqual(1);
    }, TIMEOUT);

    it("should update configuration at runtime", async () => {
      await service.start();

      service.updateConfig({
        whaleThreshold: 20000,
        enableEvents: true,
      });

      // Verify new threshold is applied
      const whaleEvents: WhaleTradeEvent[] = [];
      service.on("trade:whale", (event) => {
        whaleEvents.push(event as WhaleTradeEvent);
      });

      // Trade below new threshold
      const mockTrade = createMockParsedTrade({
        valueUsd: 15000, // Below 20000
      });

      const handlers = mockClient.getHandlers();
      const tradeHandler = handlers.get("trade");

      if (tradeHandler) {
        tradeHandler({
          type: "trade",
          connectionId: "conn-1",
          timestamp: new Date(),
          subscriptionId: "sub-1",
          trade: mockTrade,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not be detected as whale with new higher threshold
      expect(whaleEvents.length).toBe(0);
    }, TIMEOUT);
  });

  describe("Singleton and Factory", () => {
    it("should export singleton instance", () => {
      expect(tradeStreamService).toBeInstanceOf(TradeStreamService);
    });

    it("should create independent instances with factory", () => {
      const service1 = createTradeStreamService({ whaleThreshold: 5000 });
      const service2 = createTradeStreamService({ whaleThreshold: 20000 });

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(TradeStreamService);
      expect(service2).toBeInstanceOf(TradeStreamService);
    });
  });
});
