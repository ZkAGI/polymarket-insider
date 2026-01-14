/**
 * Unit Tests for Ingestion Worker (INGEST-CORE-001)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IngestionWorker,
  createIngestionWorker,
  type IngestionWorkerConfig,
  type IngestionHealth,
  type CycleResult,
} from "../../src/workers/ingestion-worker";

// Mock Prisma client
const mockPrisma = {
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
  syncLog: {
    create: vi.fn().mockResolvedValue({ id: "sync-log-1" }),
    update: vi.fn().mockResolvedValue({}),
  },
  outcome: {
    findMany: vi.fn().mockResolvedValue([
      { id: "outcome-1", clobTokenId: "token-1" },
    ]),
  },
  market: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ id: "market-1" }),
    count: vi.fn().mockResolvedValue(0),
  },
  wallet: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "wallet-1", address: "0x123" }),
    update: vi.fn().mockResolvedValue({ id: "wallet-1" }),
  },
  trade: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "trade-1" }),
  },
};

// Mock Gamma client
const mockGammaClient = {
  get: vi.fn().mockResolvedValue([]),
  getBaseUrl: vi.fn().mockReturnValue("https://gamma-api.polymarket.com"),
  getTimeout: vi.fn().mockReturnValue(30000),
  getRetries: vi.fn().mockReturnValue(3),
  hasApiKey: vi.fn().mockReturnValue(false),
};

// Mock CLOB client
const mockClobClient = {
  get: vi.fn().mockResolvedValue([]),
  getBaseUrl: vi.fn().mockReturnValue("https://clob.polymarket.com"),
  getTimeout: vi.fn().mockReturnValue(30000),
  getRetries: vi.fn().mockReturnValue(3),
  hasCredentials: vi.fn().mockReturnValue(false),
};

// Create worker with mocks (without starting the loop)
function createTestWorker(config: Partial<IngestionWorkerConfig> = {}): IngestionWorker {
  return createIngestionWorker({
    prisma: mockPrisma as unknown as any,
    gammaClient: mockGammaClient as unknown as any,
    clobClient: mockClobClient as unknown as any,
    cycleIntervalMs: 1000,
    marketSyncIntervalMs: 1000,
    tradeFetchIntervalMs: 1000,
    debug: false,
    logger: vi.fn(),
    ...config,
  });
}

describe("IngestionWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create worker with default configuration", () => {
      const worker = createTestWorker();

      expect(worker).toBeInstanceOf(IngestionWorker);
      expect(worker.getIsRunning()).toBe(false);
      expect(worker.getIsIngesting()).toBe(false);
    });

    it("should generate unique worker ID", () => {
      const worker1 = createTestWorker();
      const worker2 = createTestWorker();

      expect(worker1.getWorkerId()).not.toBe(worker2.getWorkerId());
    });

    it("should use provided worker ID", () => {
      const worker = createTestWorker({ workerId: "custom-worker-id" });

      expect(worker.getWorkerId()).toBe("custom-worker-id");
    });

    it("should accept custom cycle interval", () => {
      const worker = createTestWorker({ cycleIntervalMs: 5000 });
      expect(worker).toBeDefined();
    });

    it("should accept custom market sync interval", () => {
      const worker = createTestWorker({ marketSyncIntervalMs: 10000 });
      expect(worker).toBeDefined();
    });

    it("should accept custom trade fetch interval", () => {
      const worker = createTestWorker({ tradeFetchIntervalMs: 15000 });
      expect(worker).toBeDefined();
    });

    it("should accept custom max markets per cycle", () => {
      const worker = createTestWorker({ maxMarketsPerCycle: 100 });
      expect(worker).toBeDefined();
    });

    it("should accept custom max trades per market", () => {
      const worker = createTestWorker({ maxTradesPerMarket: 200 });
      expect(worker).toBeDefined();
    });

    it("should accept custom retry delay", () => {
      const worker = createTestWorker({ retryDelayMs: 2000 });
      expect(worker).toBeDefined();
    });

    it("should accept custom max retries", () => {
      const worker = createTestWorker({ maxRetries: 5 });
      expect(worker).toBeDefined();
    });

    it("should accept debug flag", () => {
      const worker = createTestWorker({ debug: true });
      expect(worker).toBeDefined();
    });
  });

  describe("getHealth", () => {
    it("should return initial health state", () => {
      const worker = createTestWorker();
      const health = worker.getHealth();

      expect(health.isRunning).toBe(false);
      expect(health.isIngesting).toBe(false);
      expect(health.lastMarketSyncAt).toBeNull();
      expect(health.lastTradeIngestAt).toBeNull();
      expect(health.cyclesCompleted).toBe(0);
      expect(health.cyclesFailed).toBe(0);
      expect(health.marketsSynced).toBe(0);
      expect(health.tradesIngested).toBe(0);
      expect(health.walletsCreated).toBe(0);
      expect(health.consecutiveErrors).toBe(0);
      expect(health.lastError).toBeNull();
      expect(health.startedAt).toBeNull();
      expect(health.uptimeSeconds).toBe(0);
    });

    it("should calculate uptime when startedAt is set", () => {
      const worker = createTestWorker();

      // Manually set started state for testing
      (worker as any).health.startedAt = new Date(Date.now() - 5000);

      const health = worker.getHealth();
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(4);
    });
  });

  describe("getWorkerId", () => {
    it("should return the worker ID", () => {
      const worker = createTestWorker({ workerId: "test-worker-123" });
      expect(worker.getWorkerId()).toBe("test-worker-123");
    });

    it("should return auto-generated ID when not provided", () => {
      const worker = createTestWorker();
      const workerId = worker.getWorkerId();
      expect(workerId).toMatch(/^ingestion-\d+-[a-z0-9]+$/);
    });
  });

  describe("getIsRunning", () => {
    it("should return false initially", () => {
      const worker = createTestWorker();
      expect(worker.getIsRunning()).toBe(false);
    });

    it("should return true when running flag is set", () => {
      const worker = createTestWorker();
      (worker as any).isRunning = true;
      expect(worker.getIsRunning()).toBe(true);
    });
  });

  describe("getIsIngesting", () => {
    it("should return false initially", () => {
      const worker = createTestWorker();
      expect(worker.getIsIngesting()).toBe(false);
    });

    it("should return true when ingesting flag is set", () => {
      const worker = createTestWorker();
      (worker as any).isIngesting = true;
      expect(worker.getIsIngesting()).toBe(true);
    });
  });

  describe("stop (when not running)", () => {
    it("should log message when not running", async () => {
      const mockLogger = vi.fn();
      const worker = createTestWorker({ logger: mockLogger });

      await worker.stop();

      expect(mockLogger).toHaveBeenCalledWith("Worker not running");
    });

    it("should not disconnect prisma when not running", async () => {
      const worker = createTestWorker();

      await worker.stop();

      expect(mockPrisma.$disconnect).not.toHaveBeenCalled();
    });
  });

  describe("forceCycle (when not running)", () => {
    it("should throw if worker is not running", async () => {
      const worker = createTestWorker();

      await expect(worker.forceCycle()).rejects.toThrow("Worker not running");
    });
  });

  describe("event emitter", () => {
    it("should be an EventEmitter", () => {
      const worker = createTestWorker();
      expect(typeof worker.on).toBe("function");
      expect(typeof worker.emit).toBe("function");
      expect(typeof worker.off).toBe("function");
    });

    it("should allow registering event handlers", () => {
      const worker = createTestWorker();
      const handler = vi.fn();

      worker.on("started", handler);
      worker.emit("started", { workerId: "test" });

      expect(handler).toHaveBeenCalledWith({ workerId: "test" });
    });

    it("should allow removing event handlers", () => {
      const worker = createTestWorker();
      const handler = vi.fn();

      worker.on("stopped", handler);
      worker.off("stopped", handler);
      worker.emit("stopped", { workerId: "test" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("createIngestionWorker factory", () => {
    it("should create a new worker instance", () => {
      const worker = createIngestionWorker({
        prisma: mockPrisma as unknown as any,
        gammaClient: mockGammaClient as unknown as any,
        clobClient: mockClobClient as unknown as any,
        cycleIntervalMs: 5000,
        logger: vi.fn(),
      });

      expect(worker).toBeInstanceOf(IngestionWorker);
    });

    it("should create worker with default config when no options provided", () => {
      // This will use real clients, but we're just testing instantiation
      const worker = createIngestionWorker({
        prisma: mockPrisma as unknown as any,
      });

      expect(worker).toBeInstanceOf(IngestionWorker);
    });
  });
});

describe("IngestionHealth interface", () => {
  it("should have all required fields", () => {
    const health: IngestionHealth = {
      isRunning: false,
      isIngesting: false,
      lastMarketSyncAt: null,
      lastTradeIngestAt: null,
      cyclesCompleted: 0,
      cyclesFailed: 0,
      marketsSynced: 0,
      tradesIngested: 0,
      walletsCreated: 0,
      consecutiveErrors: 0,
      lastError: null,
      startedAt: null,
      uptimeSeconds: 0,
    };

    expect(health).toBeDefined();
    expect(typeof health.isRunning).toBe("boolean");
    expect(typeof health.isIngesting).toBe("boolean");
    expect(typeof health.cyclesCompleted).toBe("number");
    expect(typeof health.cyclesFailed).toBe("number");
    expect(typeof health.marketsSynced).toBe("number");
    expect(typeof health.tradesIngested).toBe("number");
    expect(typeof health.walletsCreated).toBe("number");
    expect(typeof health.consecutiveErrors).toBe("number");
    expect(typeof health.uptimeSeconds).toBe("number");
  });

  it("should allow Date values for timestamps", () => {
    const now = new Date();
    const health: IngestionHealth = {
      isRunning: true,
      isIngesting: true,
      lastMarketSyncAt: now,
      lastTradeIngestAt: now,
      cyclesCompleted: 5,
      cyclesFailed: 1,
      marketsSynced: 100,
      tradesIngested: 500,
      walletsCreated: 25,
      consecutiveErrors: 0,
      lastError: null,
      startedAt: now,
      uptimeSeconds: 3600,
    };

    expect(health.lastMarketSyncAt).toBeInstanceOf(Date);
    expect(health.lastTradeIngestAt).toBeInstanceOf(Date);
    expect(health.startedAt).toBeInstanceOf(Date);
  });

  it("should allow string for lastError", () => {
    const health: IngestionHealth = {
      isRunning: false,
      isIngesting: false,
      lastMarketSyncAt: null,
      lastTradeIngestAt: null,
      cyclesCompleted: 0,
      cyclesFailed: 1,
      marketsSynced: 0,
      tradesIngested: 0,
      walletsCreated: 0,
      consecutiveErrors: 3,
      lastError: "Network connection failed",
      startedAt: null,
      uptimeSeconds: 0,
    };

    expect(health.lastError).toBe("Network connection failed");
  });
});

describe("CycleResult interface", () => {
  it("should have all required fields", () => {
    const result: CycleResult = {
      success: true,
      marketsSynced: 10,
      tradesIngested: 100,
      walletsCreated: 5,
      durationMs: 5000,
      completedAt: new Date(),
    };

    expect(result).toBeDefined();
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.marketsSynced).toBe("number");
    expect(typeof result.tradesIngested).toBe("number");
    expect(typeof result.walletsCreated).toBe("number");
    expect(typeof result.durationMs).toBe("number");
    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it("should allow optional error field", () => {
    const result: CycleResult = {
      success: false,
      marketsSynced: 0,
      tradesIngested: 0,
      walletsCreated: 0,
      durationMs: 1000,
      completedAt: new Date(),
      error: "Network failure",
    };

    expect(result.error).toBe("Network failure");
    expect(result.success).toBe(false);
  });

  it("should allow successful result without error", () => {
    const result: CycleResult = {
      success: true,
      marketsSynced: 50,
      tradesIngested: 250,
      walletsCreated: 10,
      durationMs: 3000,
      completedAt: new Date(),
    };

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
  });
});

describe("Worker configuration validation", () => {
  it("should accept all configuration options", () => {
    const config: IngestionWorkerConfig = {
      cycleIntervalMs: 60000,
      marketSyncIntervalMs: 300000,
      tradeFetchIntervalMs: 30000,
      maxMarketsPerCycle: 50,
      maxTradesPerMarket: 100,
      retryDelayMs: 1000,
      maxRetries: 3,
      workerId: "custom-worker",
      debug: true,
      logger: vi.fn(),
    };

    const worker = createTestWorker(config);
    expect(worker.getWorkerId()).toBe("custom-worker");
  });

  it("should work with minimal configuration", () => {
    const worker = createIngestionWorker({
      prisma: mockPrisma as unknown as any,
    });

    expect(worker).toBeInstanceOf(IngestionWorker);
    expect(worker.getIsRunning()).toBe(false);
  });
});
