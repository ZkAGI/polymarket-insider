/**
 * Trade Stream Service Tests (API-LIVE-002)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TradeStreamService,
  createTradeStreamService,
  tradeStreamService,
} from "../../src/services/trade-stream";
import type { ParsedTrade, TradeEvent, TradeBatchEvent } from "../../src/api/ws/trade-stream";
import type { Trade, Wallet, Outcome } from "@prisma/client";
import { TradeSide } from "@prisma/client";

// Mock the trade stream client
vi.mock("../../src/api/ws/trade-stream", () => ({
  createTradeStreamClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    subscribe: vi.fn().mockResolvedValue({}),
    unsubscribeToken: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {}),
  })),
  TradeStreamClient: vi.fn(),
}));

// Mock the trade service
vi.mock("../../src/db/trades", () => ({
  tradeService: {
    upsertByClobTradeId: vi.fn(),
  },
  TradeService: vi.fn(),
}));

// Mock the wallet service
vi.mock("../../src/db/wallets", () => ({
  walletService: {
    findByAddress: vi.fn(),
    findOrCreate: vi.fn(),
    incrementTradeStats: vi.fn(),
  },
  WalletService: vi.fn(),
}));

// Mock the Prisma client
vi.mock("../../src/db/client", () => ({
  prisma: {
    outcome: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock env
vi.mock("../../config/env", () => ({
  env: {
    WHALE_THRESHOLD_USD: 10000,
  },
}));

import { createTradeStreamClient } from "../../src/api/ws/trade-stream";
import { tradeService } from "../../src/db/trades";
import { walletService } from "../../src/db/wallets";
import { prisma } from "../../src/db/client";

const mockCreateTradeStreamClient = vi.mocked(createTradeStreamClient);
const mockTradeService = vi.mocked(tradeService);
const mockWalletService = vi.mocked(walletService);
const mockOutcomeFindUnique = prisma.outcome.findUnique as ReturnType<typeof vi.fn>;

describe("TradeStreamService", () => {
  let mockTradeStreamClient: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribeToken: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    eventHandlers: Map<string, (event: unknown) => void>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTradeStreamClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      subscribe: vi.fn().mockResolvedValue({}),
      unsubscribeToken: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockImplementation((event, handler) => {
        mockTradeStreamClient.eventHandlers.set(event, handler);
        return () => mockTradeStreamClient.eventHandlers.delete(event);
      }),
      eventHandlers: new Map(),
    };

    mockCreateTradeStreamClient.mockReturnValue(mockTradeStreamClient as unknown as ReturnType<typeof createTradeStreamClient>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockParsedTrade = (overrides: Partial<ParsedTrade> = {}): ParsedTrade => ({
    id: "trade-123",
    assetId: "token-abc",
    price: 0.65,
    probability: 65,
    size: 100,
    valueUsd: 65,
    side: "buy",
    makerAddress: "0xmaker",
    takerAddress: "0xtaker",
    transactionHash: "0xtxhash",
    feeRateBps: 10,
    feeUsd: 0.065,
    timestamp: new Date("2024-01-01T12:00:00Z"),
    receivedAt: new Date("2024-01-01T12:00:00Z"),
    matchId: "match-123",
    outcomeName: "Yes",
    marketQuestion: "Test Market?",
    sequence: 1,
    isLargeTrade: false,
    ...overrides,
  });

  const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
    id: "wallet-1",
    address: "0xtaker",
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

  const createMockTrade = (overrides: Partial<Trade> = {}): Trade => ({
    id: "db-trade-1",
    marketId: "market-1",
    outcomeId: "outcome-1",
    walletId: "wallet-1",
    clobTradeId: "trade-123",
    matchId: "match-123",
    side: TradeSide.BUY,
    amount: 100,
    price: 0.65,
    usdValue: 65,
    feeUsd: 0.065,
    makerAddress: "0xmaker",
    takerAddress: "0xtaker",
    isMaker: false,
    timestamp: new Date("2024-01-01T12:00:00Z"),
    txHash: "0xtxhash",
    blockNumber: null,
    isWhale: false,
    isInsider: false,
    flags: [],
    createdAt: new Date(),
    ...overrides,
  } as Trade);

  describe("constructor", () => {
    it("should create service with default config", () => {
      const service = new TradeStreamService();
      expect(service).toBeInstanceOf(TradeStreamService);
      expect(service.getIsRunning()).toBe(false);
    });

    it("should create service with custom config", () => {
      const service = new TradeStreamService({
        whaleThreshold: 50000,
        autoCreateWallets: false,
        enableEvents: false,
      });
      expect(service).toBeInstanceOf(TradeStreamService);
    });

    it("should use custom logger", () => {
      const mockLogger = vi.fn();
      const service = createTradeStreamService({
        logger: mockLogger,
      });
      expect(service).toBeInstanceOf(TradeStreamService);
    });
  });

  describe("start/stop", () => {
    it("should start the service", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      const startedHandler = vi.fn();
      service.on("started", startedHandler);

      await service.start();

      expect(service.getIsRunning()).toBe(true);
      expect(startedHandler).toHaveBeenCalledTimes(1);
      expect(mockTradeStreamClient.connect).toHaveBeenCalledTimes(1);
    });

    it("should not start if already running", async () => {
      const mockLogger = vi.fn();
      const service = createTradeStreamService({
        logger: mockLogger,
      });

      await service.start();
      await service.start();

      expect(mockLogger).toHaveBeenCalledWith("Service already running");
    });

    it("should stop the service", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      const stoppedHandler = vi.fn();
      service.on("stopped", stoppedHandler);

      await service.start();
      service.stop();

      expect(service.getIsRunning()).toBe(false);
      expect(stoppedHandler).toHaveBeenCalledTimes(1);
      expect(mockTradeStreamClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it("should not stop if not running", () => {
      const mockLogger = vi.fn();
      const service = createTradeStreamService({
        logger: mockLogger,
      });

      service.stop();

      expect(mockLogger).toHaveBeenCalledWith("Service not running");
    });

    it("should set up event handlers on start", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      expect(mockTradeStreamClient.on).toHaveBeenCalledWith("trade", expect.any(Function));
      expect(mockTradeStreamClient.on).toHaveBeenCalledWith("tradeBatch", expect.any(Function));
      expect(mockTradeStreamClient.on).toHaveBeenCalledWith("largeTrade", expect.any(Function));
      expect(mockTradeStreamClient.on).toHaveBeenCalledWith("tradeStreamError", expect.any(Function));
    });

    it("should handle connection failure", async () => {
      mockTradeStreamClient.connect.mockRejectedValueOnce(new Error("Connection failed"));

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await expect(service.start()).rejects.toThrow("Connection failed");
      expect(service.getIsRunning()).toBe(false);
    });
  });

  describe("subscribe/unsubscribe", () => {
    it("should subscribe to market trade stream", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();
      await service.subscribeToMarket("token-123");

      expect(mockTradeStreamClient.subscribe).toHaveBeenCalledWith({
        tokenIds: ["token-123"],
      });
    });

    it("should subscribe to multiple tokens", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();
      await service.subscribeToMarket(["token-1", "token-2"]);

      expect(mockTradeStreamClient.subscribe).toHaveBeenCalledWith({
        tokenIds: ["token-1", "token-2"],
      });
    });

    it("should throw if subscribing while not running", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await expect(service.subscribeToMarket("token-123")).rejects.toThrow(
        "Service not running"
      );
    });

    it("should unsubscribe from market", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();
      await service.unsubscribeFromMarket("token-123");

      expect(mockTradeStreamClient.unsubscribeToken).toHaveBeenCalledWith("token-123");
    });
  });

  describe("processTrade", () => {
    it("should process a trade and store it in the database", async () => {
      const mockTrade = createMockParsedTrade();
      const mockWallet = createMockWallet();
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      // Trigger trade event
      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          const originalHandler = tradeHandler;
          // Wait for async processing
          setTimeout(() => resolve(), 10);
          originalHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(mockWalletService.findOrCreate).toHaveBeenCalled();
      expect(mockOutcomeFindUnique).toHaveBeenCalledWith({
        where: { clobTokenId: "token-abc" },
        select: { id: true, marketId: true },
      });
      expect(mockTradeService.upsertByClobTradeId).toHaveBeenCalled();
      expect(mockWalletService.incrementTradeStats).toHaveBeenCalledWith("wallet-1", 65);
    });

    it("should skip trades without wallet address", async () => {
      const mockTrade = createMockParsedTrade({
        makerAddress: undefined,
        takerAddress: undefined,
      });

      const mockLogger = vi.fn();
      const service = createTradeStreamService({
        logger: mockLogger,
      });

      await service.start();

      // Trigger trade event
      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 10);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(mockLogger).toHaveBeenCalledWith(
        "Trade missing wallet address, skipping",
        expect.objectContaining({ tradeId: mockTrade.id })
      );
      expect(mockTradeService.upsertByClobTradeId).not.toHaveBeenCalled();
    });

    it("should skip trades when outcome is not found", async () => {
      const mockTrade = createMockParsedTrade();
      const mockWallet = createMockWallet();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue(null);

      const mockLogger = vi.fn();
      const service = createTradeStreamService({
        logger: mockLogger,
      });

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 10);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(mockLogger).toHaveBeenCalledWith(
        "Outcome not found for asset, skipping",
        expect.objectContaining({ assetId: mockTrade.assetId })
      );
      expect(mockTradeService.upsertByClobTradeId).not.toHaveBeenCalled();
    });

    it("should emit wallet:new event when a new wallet is created", async () => {
      const mockTrade = createMockParsedTrade();
      const mockWallet = createMockWallet();
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: true,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      const newWalletHandler = vi.fn();
      service.on("wallet:new", newWalletHandler);

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(newWalletHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "wallet:new",
          walletId: "wallet-1",
          address: "0xtaker",
        })
      );
    });

    it("should detect whale trades", async () => {
      const mockTrade = createMockParsedTrade({
        valueUsd: 15000, // Above default threshold of 10000
      });
      const mockWallet = createMockWallet();
      const mockStoredTrade = createMockTrade({ isWhale: true });

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      const whaleHandler = vi.fn();
      service.on("trade:whale", whaleHandler);

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(whaleHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "trade:whale",
          usdValue: 15000,
        })
      );
    });

    it("should handle duplicate trades gracefully", async () => {
      const mockTrade = createMockParsedTrade();
      const mockWallet = createMockWallet();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockRejectedValue(
        new Error("Unique constraint failed on the constraint: `Trade_clobTradeId_key`")
      );

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      const stats = service.getStats();
      expect(stats.duplicateCount).toBe(1);
      expect(stats.errorCount).toBe(0);
    });
  });

  describe("processTradeBatch", () => {
    it("should process multiple trades in a batch", async () => {
      const mockTrade1 = createMockParsedTrade({ id: "trade-1" });
      const mockTrade2 = createMockParsedTrade({ id: "trade-2" });
      const mockWallet = createMockWallet();
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      const batchHandler = mockTradeStreamClient.eventHandlers.get("tradeBatch");
      if (batchHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
          batchHandler({
            type: "tradeBatch",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trades: [mockTrade1, mockTrade2],
            count: 2,
          } as TradeBatchEvent);
        });
      }

      expect(mockTradeService.upsertByClobTradeId).toHaveBeenCalledTimes(2);
    });
  });

  describe("statistics", () => {
    it("should track processing statistics", async () => {
      const mockTrade = createMockParsedTrade();
      const mockWallet = createMockWallet();
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: true,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      const stats = service.getStats();
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(1);
      expect(stats.storedCount).toBeGreaterThanOrEqual(1);
      expect(stats.newWalletsCount).toBeGreaterThanOrEqual(1);
      expect(stats.startedAt).not.toBeNull();
    });

    it("should reset statistics", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      // Modify stats internally by triggering processing
      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.storedCount).toBe(0);
      expect(stats.errorCount).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should update configuration", async () => {
      const mockLogger = vi.fn();
      const service = createTradeStreamService({
        whaleThreshold: 10000,
        logger: mockLogger,
      });

      service.updateConfig({ whaleThreshold: 50000 });

      expect(mockLogger).toHaveBeenCalledWith(
        "Config updated",
        expect.objectContaining({
          whaleThreshold: 50000,
        })
      );
    });

    it("should not emit events when disabled", async () => {
      const mockTrade = createMockParsedTrade({ valueUsd: 15000 });
      const mockWallet = createMockWallet();
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        enableEvents: false,
        logger: vi.fn(),
      });

      const whaleHandler = vi.fn();
      service.on("trade:whale", whaleHandler);

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(whaleHandler).not.toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should dispose the service", async () => {
      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();
      service.dispose();

      expect(service.getIsRunning()).toBe(false);
      expect(mockTradeStreamClient.dispose).toHaveBeenCalled();
    });
  });

  describe("singleton and factory", () => {
    it("should export a singleton instance", () => {
      expect(tradeStreamService).toBeInstanceOf(TradeStreamService);
    });

    it("should create new instances via factory", () => {
      const service1 = createTradeStreamService();
      const service2 = createTradeStreamService();
      expect(service1).not.toBe(service2);
    });
  });

  describe("edge cases", () => {
    it("should prefer taker address over maker address", async () => {
      const mockTrade = createMockParsedTrade({
        makerAddress: "0xmaker",
        takerAddress: "0xtaker",
      });
      const mockWallet = createMockWallet({ address: "0xtaker" });
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(mockWalletService.findOrCreate).toHaveBeenCalledWith("0xtaker");
    });

    it("should use maker address when taker is not available", async () => {
      const mockTrade = createMockParsedTrade({
        makerAddress: "0xmaker",
        takerAddress: undefined,
      });
      const mockWallet = createMockWallet({ address: "0xmaker" });
      const mockStoredTrade = createMockTrade();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockResolvedValue(mockStoredTrade);
      mockWalletService.incrementTradeStats.mockResolvedValue(mockWallet);

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(mockWalletService.findOrCreate).toHaveBeenCalledWith("0xmaker");
    });

    it("should handle processing errors", async () => {
      const mockTrade = createMockParsedTrade();
      const mockWallet = createMockWallet();

      mockWalletService.findOrCreate.mockResolvedValue({
        wallet: mockWallet,
        created: false,
      });
      mockOutcomeFindUnique.mockResolvedValue({
        id: "outcome-1",
        marketId: "market-1",
      } as Outcome);
      mockTradeService.upsertByClobTradeId.mockRejectedValue(
        new Error("Database error")
      );

      const service = createTradeStreamService({
        logger: vi.fn(),
      });

      const errorHandler = vi.fn();
      service.on("processing:error", errorHandler);

      await service.start();

      const tradeHandler = mockTradeStreamClient.eventHandlers.get("trade");
      if (tradeHandler) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 50);
          tradeHandler({
            type: "trade",
            connectionId: "conn-1",
            timestamp: new Date(),
            subscriptionId: "sub-1",
            trade: mockTrade,
          } as TradeEvent);
        });
      }

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "processing:error",
          message: "Database error",
        })
      );

      const stats = service.getStats();
      expect(stats.errorCount).toBeGreaterThanOrEqual(1);
    });
  });
});
