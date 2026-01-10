/**
 * Alert Database Service Tests
 *
 * Unit tests for the AlertService CRUD operations.
 * Uses mocked Prisma client to test service logic without database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Alert, Market, Wallet, PrismaClient } from "@prisma/client";
import { AlertType, AlertSeverity, WalletType, RiskLevel, FundingSourceType } from "@prisma/client";
import {
  AlertService,
  createAlertService,
  type CreateAlertInput,
  type UpdateAlertInput,
  type AlertSortOptions,
} from "../../src/db/alerts";

// Mock alert data
const mockAlert: Alert = {
  id: "alert-1",
  type: AlertType.WHALE_TRADE,
  severity: AlertSeverity.HIGH,
  marketId: "market-1",
  walletId: "wallet-1",
  title: "Large Trade Detected",
  message: "Whale wallet made a $500k trade on the presidential election market",
  data: { tradeSize: 500000, marketName: "Presidential Election 2024" },
  tags: ["whale", "large-trade", "politics"],
  read: false,
  acknowledged: false,
  dismissed: false,
  actionBy: null,
  actionAt: null,
  createdAt: new Date("2024-06-15T10:30:00Z"),
  expiresAt: new Date("2024-07-15T10:30:00Z"),
};

const mockAlert2: Alert = {
  id: "alert-2",
  type: AlertType.FRESH_WALLET,
  severity: AlertSeverity.MEDIUM,
  marketId: "market-2",
  walletId: "wallet-2",
  title: "Fresh Wallet Activity",
  message: "New wallet made large first trade",
  data: null,
  tags: ["fresh-wallet"],
  read: true,
  acknowledged: false,
  dismissed: false,
  actionBy: null,
  actionAt: null,
  createdAt: new Date("2024-06-14T08:00:00Z"),
  expiresAt: null,
};

const mockAlert3: Alert = {
  id: "alert-3",
  type: AlertType.INSIDER_ACTIVITY,
  severity: AlertSeverity.CRITICAL,
  marketId: "market-1",
  walletId: "wallet-3",
  title: "Potential Insider Trading",
  message: "Wallet traded before major news announcement",
  data: { timingDiff: 3600 },
  tags: ["insider", "suspicious"],
  read: true,
  acknowledged: true,
  dismissed: false,
  actionBy: "admin@example.com",
  actionAt: new Date("2024-06-15T12:00:00Z"),
  createdAt: new Date("2024-06-13T15:00:00Z"),
  expiresAt: null,
};

const mockDismissedAlert: Alert = {
  ...mockAlert,
  id: "alert-dismissed",
  dismissed: true,
  read: true,
  actionBy: "user@example.com",
  actionAt: new Date("2024-06-15T11:00:00Z"),
};

// Note: Expired alert intentionally not used as a mock fixture since
// we test expiration through filter logic rather than checking specific instances

const mockMarket: Market = {
  id: "market-1",
  slug: "presidential-election-2024",
  question: "Who will win the 2024 Presidential Election?",
  description: "Prediction market for the 2024 US Presidential Election",
  category: "politics",
  subcategory: "elections",
  tags: ["politics", "us", "election"],
  imageUrl: null,
  iconUrl: null,
  resolutionSource: "Associated Press",
  resolvedBy: null,
  resolution: null,
  endDate: new Date("2024-11-05T00:00:00Z"),
  resolvedAt: null,
  active: true,
  closed: false,
  archived: false,
  volume: 50000000,
  volume24h: 1000000,
  liquidity: 5000000,
  tradeCount: 150000,
  uniqueTraders: 25000,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T00:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T00:00:00Z"),
};

const mockWallet: Wallet = {
  id: "wallet-1",
  address: "0xabcdef1234567890abcdef1234567890abcdef12",
  label: "Test Whale",
  walletType: WalletType.EOA,
  isWhale: true,
  isInsider: false,
  isFresh: false,
  isMonitored: true,
  isFlagged: false,
  isSanctioned: false,
  suspicionScore: 15.5,
  riskLevel: RiskLevel.LOW,
  totalVolume: 500000,
  totalPnl: 25000,
  tradeCount: 150,
  winCount: 90,
  winRate: 60,
  avgTradeSize: 3333.33,
  maxTradeSize: 50000,
  firstTradeAt: new Date("2024-01-15T00:00:00Z"),
  lastTradeAt: new Date("2024-06-14T00:00:00Z"),
  walletCreatedAt: new Date("2023-06-01T00:00:00Z"),
  onChainTxCount: 500,
  walletAgeDays: 380,
  primaryFundingSource: FundingSourceType.EXCHANGE,
  metadata: null,
  notes: "Known trader",
  createdAt: new Date("2024-01-15T00:00:00Z"),
  updatedAt: new Date("2024-06-15T00:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T00:00:00Z"),
};

/**
 * Create a mock Prisma client for testing
 */
function createMockPrismaClient() {
  return {
    alert: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  } as unknown as PrismaClient;
}

describe("AlertService", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: AlertService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = createAlertService({ prisma: mockPrisma });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with provided prisma client", () => {
      const customPrisma = createMockPrismaClient();
      const customService = new AlertService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(AlertService);
    });

    it("should create service with createAlertService factory", () => {
      const customPrisma = createMockPrismaClient();
      const customService = createAlertService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(AlertService);
    });
  });

  describe("create", () => {
    it("should create alert with required fields only", async () => {
      const input: CreateAlertInput = {
        type: AlertType.WHALE_TRADE,
        title: "Whale Trade",
        message: "A whale trade was detected",
      };

      const expectedAlert = {
        ...mockAlert,
        marketId: null,
        walletId: null,
        data: null,
        tags: [],
        severity: AlertSeverity.INFO,
      };

      (mockPrisma.alert.create as ReturnType<typeof vi.fn>).mockResolvedValue(expectedAlert);

      const result = await service.create(input);

      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: AlertType.WHALE_TRADE,
          severity: AlertSeverity.INFO,
          title: "Whale Trade",
          message: "A whale trade was detected",
          tags: [],
          read: false,
          acknowledged: false,
          dismissed: false,
        }),
      });
      expect(result.type).toBe(AlertType.WHALE_TRADE);
    });

    it("should create alert with all fields", async () => {
      const input: CreateAlertInput = {
        type: AlertType.WHALE_TRADE,
        severity: AlertSeverity.HIGH,
        marketId: "market-1",
        walletId: "wallet-1",
        title: "Large Trade Detected",
        message: "Whale wallet made a $500k trade",
        data: { tradeSize: 500000 },
        tags: ["whale", "large-trade"],
        read: false,
        acknowledged: false,
        dismissed: false,
        expiresAt: new Date("2024-07-15T00:00:00Z"),
      };

      (mockPrisma.alert.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockAlert);

      const result = await service.create(input);

      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: AlertType.WHALE_TRADE,
          severity: AlertSeverity.HIGH,
          marketId: "market-1",
          walletId: "wallet-1",
          title: "Large Trade Detected",
          message: "Whale wallet made a $500k trade",
          tags: ["whale", "large-trade"],
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it("should default severity to INFO if not provided", async () => {
      const input: CreateAlertInput = {
        type: AlertType.SYSTEM,
        title: "System Info",
        message: "System notification",
      };

      (mockPrisma.alert.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockAlert,
        severity: AlertSeverity.INFO,
      });

      await service.create(input);

      expect(mockPrisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: AlertSeverity.INFO,
        }),
      });
    });
  });

  describe("findById", () => {
    it("should find alert by id", async () => {
      (mockPrisma.alert.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAlert);

      const result = await service.findById("alert-1");

      expect(mockPrisma.alert.findUnique).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        include: undefined,
      });
      expect(result).toEqual(mockAlert);
    });

    it("should return null for non-existent alert", async () => {
      (mockPrisma.alert.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });

    it("should include market relation when requested", async () => {
      const alertWithMarket = { ...mockAlert, market: mockMarket };
      (mockPrisma.alert.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(alertWithMarket);

      const result = await service.findById("alert-1", { market: true });

      expect(mockPrisma.alert.findUnique).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        include: { market: true, wallet: false },
      });
      expect(result).toEqual(alertWithMarket);
    });

    it("should include wallet relation when requested", async () => {
      const alertWithWallet = { ...mockAlert, wallet: mockWallet };
      (mockPrisma.alert.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(alertWithWallet);

      const result = await service.findById("alert-1", { wallet: true });

      expect(mockPrisma.alert.findUnique).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        include: { market: false, wallet: true },
      });
      expect(result).toEqual(alertWithWallet);
    });

    it("should include all relations when requested", async () => {
      const alertWithRelations = { ...mockAlert, market: mockMarket, wallet: mockWallet };
      (mockPrisma.alert.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(alertWithRelations);

      const result = await service.findById("alert-1", { market: true, wallet: true });

      expect(mockPrisma.alert.findUnique).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        include: { market: true, wallet: true },
      });
      expect(result).toEqual(alertWithRelations);
    });
  });

  describe("findByIds", () => {
    it("should find multiple alerts by ids", async () => {
      const alerts = [mockAlert, mockAlert2];
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(alerts);

      const result = await service.findByIds(["alert-1", "alert-2"]);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["alert-1", "alert-2"] } },
        include: undefined,
      });
      expect(result).toEqual(alerts);
    });

    it("should return empty array for no matches", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.findByIds(["non-existent"]);

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update alert fields", async () => {
      const input: UpdateAlertInput = {
        read: true,
        severity: AlertSeverity.CRITICAL,
      };

      const updatedAlert = { ...mockAlert, read: true, severity: AlertSeverity.CRITICAL };
      (mockPrisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAlert);

      const result = await service.update("alert-1", input);

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: input,
      });
      expect(result.read).toBe(true);
      expect(result.severity).toBe(AlertSeverity.CRITICAL);
    });

    it("should update nullable fields to null", async () => {
      const input: UpdateAlertInput = {
        marketId: null,
        walletId: null,
        data: { type: "JsonNull" },
      };

      const updatedAlert = { ...mockAlert, ...input };
      (mockPrisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAlert);

      const result = await service.update("alert-1", input);

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: input,
      });
      expect(result.marketId).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete alert by id", async () => {
      (mockPrisma.alert.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockAlert);

      const result = await service.delete("alert-1");

      expect(mockPrisma.alert.delete).toHaveBeenCalledWith({
        where: { id: "alert-1" },
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple alerts by ids", async () => {
      (mockPrisma.alert.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      const result = await service.deleteMany(["alert-1", "alert-2", "alert-3"]);

      expect(mockPrisma.alert.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["alert-1", "alert-2", "alert-3"] } },
      });
      expect(result.count).toBe(3);
    });
  });

  describe("findMany", () => {
    it("should find all alerts with default settings", async () => {
      const alerts = [mockAlert, mockAlert2, mockAlert3];
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(alerts);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const result = await service.findMany();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 100,
        include: undefined,
      });
      expect(result.alerts).toEqual(alerts);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by type", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findMany({ type: AlertType.WHALE_TRADE });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: AlertType.WHALE_TRADE },
        })
      );
      expect(result.alerts).toHaveLength(1);
    });

    it("should filter by multiple types", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findMany({
        types: [AlertType.WHALE_TRADE, AlertType.FRESH_WALLET],
      });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: { in: [AlertType.WHALE_TRADE, AlertType.FRESH_WALLET] } },
        })
      );
      expect(result.alerts).toHaveLength(2);
    });

    it("should filter by severity", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ severity: AlertSeverity.HIGH });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { severity: AlertSeverity.HIGH },
        })
      );
    });

    it("should filter by multiple severities", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await service.findMany({
        severities: [AlertSeverity.HIGH, AlertSeverity.CRITICAL],
      });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] } },
        })
      );
    });

    it("should filter by marketId", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await service.findMany({ marketId: "market-1" });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { marketId: "market-1" },
        })
      );
    });

    it("should filter by walletId", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ walletId: "wallet-1" });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: "wallet-1" },
        })
      );
    });

    it("should filter by read status", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ read: false });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { read: false },
        })
      );
    });

    it("should filter by acknowledged status", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ acknowledged: true });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acknowledged: true },
        })
      );
    });

    it("should filter by dismissed status", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockDismissedAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ dismissed: true });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dismissed: true },
        })
      );
    });

    it("should filter by single tag", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ hasTag: "whale" });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tags: { has: "whale" } },
        })
      );
    });

    it("should filter by multiple tags", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await service.findMany({ hasTags: ["whale", "insider"] });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tags: { hasSome: ["whale", "insider"] } },
        })
      );
    });

    it("should filter by created date range", async () => {
      const after = new Date("2024-06-14T00:00:00Z");
      const before = new Date("2024-06-16T00:00:00Z");

      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await service.findMany({ createdAfter: after, createdBefore: before });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { gte: after, lte: before } },
        })
      );
    });

    it("should filter by expires date range", async () => {
      const after = new Date("2024-07-01T00:00:00Z");
      const before = new Date("2024-08-01T00:00:00Z");

      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ expiresAfter: after, expiresBefore: before });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expiresAt: { gte: after, lte: before } },
        })
      );
    });

    it("should filter for non-expired alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await service.findMany({ notExpired: true });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
          },
        })
      );
    });

    it("should filter by title contains", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ titleContains: "Large" });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { title: { contains: "Large", mode: "insensitive" } },
        })
      );
    });

    it("should filter by message contains", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ messageContains: "whale" });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { message: { contains: "whale", mode: "insensitive" } },
        })
      );
    });

    it("should sort by createdAt ascending", async () => {
      const sort: AlertSortOptions = { field: "createdAt", direction: "asc" };

      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert3, mockAlert2, mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      await service.findMany({}, sort);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "asc" },
        })
      );
    });

    it("should sort by severity descending", async () => {
      const sort: AlertSortOptions = { field: "severity", direction: "desc" };

      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert3, mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      await service.findMany({}, sort);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { severity: "desc" },
        })
      );
    });

    it("should sort by type", async () => {
      const sort: AlertSortOptions = { field: "type", direction: "asc" };

      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert2, mockAlert3, mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      await service.findMany({}, sort);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { type: "asc" },
        })
      );
    });

    it("should handle pagination", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      const result = await service.findMany({}, undefined, { skip: 10, take: 20 });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 20,
        })
      );
      expect(result.skip).toBe(10);
      expect(result.take).toBe(20);
      expect(result.hasMore).toBe(true);
    });

    it("should calculate hasMore correctly", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findMany({}, undefined, { take: 10 });

      expect(result.hasMore).toBe(false);
    });
  });

  describe("findByType", () => {
    it("should find alerts by type", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findByType(AlertType.WHALE_TRADE);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: AlertType.WHALE_TRADE },
        })
      );
      expect(result.alerts).toHaveLength(1);
    });
  });

  describe("findBySeverity", () => {
    it("should find alerts by severity", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findBySeverity(AlertSeverity.CRITICAL);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { severity: AlertSeverity.CRITICAL },
        })
      );
      expect(result.alerts).toHaveLength(1);
    });
  });

  describe("findUnread", () => {
    it("should find unread alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findUnread();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { read: false },
        })
      );
      expect(result.alerts).toHaveLength(1);
    });
  });

  describe("findUnacknowledged", () => {
    it("should find unacknowledged alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findUnacknowledged();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acknowledged: false },
        })
      );
      expect(result.alerts).toHaveLength(2);
    });
  });

  describe("findActive", () => {
    it("should find active (non-dismissed, non-expired) alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      await service.findActive();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dismissed: false,
          }),
        })
      );
    });
  });

  describe("findCritical", () => {
    it("should find high and critical severity alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findCritical();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] } },
        })
      );
      expect(result.alerts).toHaveLength(2);
    });
  });

  describe("findByWallet", () => {
    it("should find alerts for a specific wallet", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findByWallet("wallet-1");

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: "wallet-1" },
        })
      );
      expect(result.alerts).toHaveLength(1);
    });

    it("should combine wallet filter with additional filters", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findByWallet("wallet-1", { severity: AlertSeverity.HIGH });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletId: "wallet-1", severity: AlertSeverity.HIGH },
        })
      );
    });
  });

  describe("findByMarket", () => {
    it("should find alerts for a specific market", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findByMarket("market-1");

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { marketId: "market-1" },
        })
      );
      expect(result.alerts).toHaveLength(2);
    });
  });

  describe("getRecent", () => {
    it("should get recent alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert, mockAlert2, mockAlert3]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const result = await service.getRecent(3);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      );
      expect(result).toHaveLength(3);
    });

    it("should use default limit of 50", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.getRecent();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe("getRecentUnread", () => {
    it("should get recent unread alerts", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getRecentUnread(10);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { read: false },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("count", () => {
    it("should count all alerts", async () => {
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      const result = await service.count();

      expect(mockPrisma.alert.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(100);
    });

    it("should count alerts with filters", async () => {
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await service.count({ severity: AlertSeverity.CRITICAL });

      expect(mockPrisma.alert.count).toHaveBeenCalledWith({
        where: { severity: AlertSeverity.CRITICAL },
      });
      expect(result).toBe(5);
    });
  });

  describe("exists", () => {
    it("should return true if alert exists", async () => {
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.exists("alert-1");

      expect(mockPrisma.alert.count).toHaveBeenCalledWith({ where: { id: "alert-1" } });
      expect(result).toBe(true);
    });

    it("should return false if alert does not exist", async () => {
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.exists("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("createMany", () => {
    it("should bulk create alerts", async () => {
      const inputs: CreateAlertInput[] = [
        { type: AlertType.WHALE_TRADE, title: "Alert 1", message: "Message 1" },
        { type: AlertType.FRESH_WALLET, title: "Alert 2", message: "Message 2" },
      ];

      (mockPrisma.alert.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

      const result = await service.createMany(inputs);

      expect(mockPrisma.alert.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ type: AlertType.WHALE_TRADE, title: "Alert 1" }),
          expect.objectContaining({ type: AlertType.FRESH_WALLET, title: "Alert 2" }),
        ]),
      });
      expect(result.count).toBe(2);
    });
  });

  describe("markAsRead", () => {
    it("should mark alert as read", async () => {
      const updatedAlert = { ...mockAlert, read: true };
      (mockPrisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAlert);

      const result = await service.markAsRead("alert-1");

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: { read: true },
      });
      expect(result.read).toBe(true);
    });
  });

  describe("markManyAsRead", () => {
    it("should mark multiple alerts as read", async () => {
      (mockPrisma.alert.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      const result = await service.markManyAsRead(["alert-1", "alert-2", "alert-3"]);

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["alert-1", "alert-2", "alert-3"] } },
        data: { read: true },
      });
      expect(result.count).toBe(3);
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all unread alerts as read", async () => {
      (mockPrisma.alert.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 10 });

      const result = await service.markAllAsRead();

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
        where: { read: false },
        data: { read: true },
      });
      expect(result.count).toBe(10);
    });

    it("should respect filters when marking all as read", async () => {
      (mockPrisma.alert.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });

      await service.markAllAsRead({ severity: AlertSeverity.HIGH });

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
        where: { severity: AlertSeverity.HIGH, read: false },
        data: { read: true },
      });
    });
  });

  describe("acknowledge", () => {
    it("should acknowledge an alert", async () => {
      const updatedAlert = {
        ...mockAlert,
        acknowledged: true,
        read: true,
        actionBy: "admin@example.com",
        actionAt: expect.any(Date),
      };
      (mockPrisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAlert);

      const result = await service.acknowledge("alert-1", "admin@example.com");

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: {
          acknowledged: true,
          read: true,
          actionBy: "admin@example.com",
          actionAt: expect.any(Date),
        },
      });
      expect(result.acknowledged).toBe(true);
    });

    it("should acknowledge without actionBy", async () => {
      const updatedAlert = { ...mockAlert, acknowledged: true, read: true };
      (mockPrisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAlert);

      await service.acknowledge("alert-1");

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: {
          acknowledged: true,
          read: true,
          actionBy: undefined,
          actionAt: expect.any(Date),
        },
      });
    });
  });

  describe("acknowledgeMany", () => {
    it("should acknowledge multiple alerts", async () => {
      (mockPrisma.alert.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      const result = await service.acknowledgeMany(["alert-1", "alert-2", "alert-3"], "admin@example.com");

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["alert-1", "alert-2", "alert-3"] } },
        data: {
          acknowledged: true,
          read: true,
          actionBy: "admin@example.com",
          actionAt: expect.any(Date),
        },
      });
      expect(result.count).toBe(3);
    });
  });

  describe("dismiss", () => {
    it("should dismiss an alert", async () => {
      const updatedAlert = {
        ...mockAlert,
        dismissed: true,
        read: true,
        actionBy: "user@example.com",
        actionAt: expect.any(Date),
      };
      (mockPrisma.alert.update as ReturnType<typeof vi.fn>).mockResolvedValue(updatedAlert);

      const result = await service.dismiss("alert-1", "user@example.com");

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: "alert-1" },
        data: {
          dismissed: true,
          read: true,
          actionBy: "user@example.com",
          actionAt: expect.any(Date),
        },
      });
      expect(result.dismissed).toBe(true);
    });
  });

  describe("dismissMany", () => {
    it("should dismiss multiple alerts", async () => {
      (mockPrisma.alert.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

      const result = await service.dismissMany(["alert-1", "alert-2"]);

      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["alert-1", "alert-2"] } },
        data: {
          dismissed: true,
          read: true,
          actionBy: undefined,
          actionAt: expect.any(Date),
        },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("deleteExpired", () => {
    it("should delete expired alerts", async () => {
      (mockPrisma.alert.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 });

      const result = await service.deleteExpired();

      expect(mockPrisma.alert.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
      expect(result.count).toBe(5);
    });
  });

  describe("deleteOldDismissed", () => {
    it("should delete old dismissed alerts", async () => {
      const olderThan = new Date("2024-06-01T00:00:00Z");
      (mockPrisma.alert.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 10 });

      const result = await service.deleteOldDismissed(olderThan);

      expect(mockPrisma.alert.deleteMany).toHaveBeenCalledWith({
        where: {
          dismissed: true,
          createdAt: { lt: olderThan },
        },
      });
      expect(result.count).toBe(10);
    });
  });

  describe("getStats", () => {
    it("should get alert statistics", async () => {
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30) // unread
        .mockResolvedValueOnce(40) // unacknowledged
        .mockResolvedValueOnce(20); // dismissed

      (mockPrisma.alert.groupBy as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { severity: AlertSeverity.INFO, _count: { id: 20 } },
          { severity: AlertSeverity.LOW, _count: { id: 25 } },
          { severity: AlertSeverity.MEDIUM, _count: { id: 30 } },
          { severity: AlertSeverity.HIGH, _count: { id: 15 } },
          { severity: AlertSeverity.CRITICAL, _count: { id: 10 } },
        ])
        .mockResolvedValueOnce([
          { type: AlertType.WHALE_TRADE, _count: { id: 40 } },
          { type: AlertType.FRESH_WALLET, _count: { id: 25 } },
          { type: AlertType.INSIDER_ACTIVITY, _count: { id: 20 } },
        ]);

      const result = await service.getStats();

      expect(result.count).toBe(100);
      expect(result.unreadCount).toBe(30);
      expect(result.unacknowledgedCount).toBe(40);
      expect(result.dismissedCount).toBe(20);
      expect(result.bySeverity[AlertSeverity.HIGH]).toBe(15);
      expect(result.bySeverity[AlertSeverity.CRITICAL]).toBe(10);
      expect(result.byType[AlertType.WHALE_TRADE]).toBe(40);
    });

    it("should handle empty database", async () => {
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (mockPrisma.alert.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.count).toBe(0);
      expect(result.bySeverity[AlertSeverity.INFO]).toBe(0);
      expect(result.bySeverity[AlertSeverity.CRITICAL]).toBe(0);
      expect(result.byType).toEqual({});
    });
  });

  describe("getCountBySeverity", () => {
    it("should get alert count grouped by severity", async () => {
      (mockPrisma.alert.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { severity: AlertSeverity.INFO, _count: { id: 20 } },
        { severity: AlertSeverity.HIGH, _count: { id: 15 } },
      ]);

      const result = await service.getCountBySeverity();

      expect(result[AlertSeverity.INFO]).toBe(20);
      expect(result[AlertSeverity.HIGH]).toBe(15);
      expect(result[AlertSeverity.LOW]).toBe(0);
      expect(result[AlertSeverity.MEDIUM]).toBe(0);
      expect(result[AlertSeverity.CRITICAL]).toBe(0);
    });
  });

  describe("getCountByType", () => {
    it("should get alert count grouped by type", async () => {
      (mockPrisma.alert.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { type: AlertType.WHALE_TRADE, _count: { id: 40 } },
        { type: AlertType.FRESH_WALLET, _count: { id: 25 } },
      ]);

      const result = await service.getCountByType();

      expect(result[AlertType.WHALE_TRADE]).toBe(40);
      expect(result[AlertType.FRESH_WALLET]).toBe(25);
      expect(result[AlertType.INSIDER_ACTIVITY]).toBeUndefined();
    });
  });

  describe("search", () => {
    it("should search alerts by title", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.search("Large Trade");

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: "Large Trade", mode: "insensitive" } },
            { message: { contains: "Large Trade", mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 100,
      });
      expect(result.alerts).toHaveLength(1);
    });

    it("should search alerts by message", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.search("whale wallet");

      expect(result.alerts).toHaveLength(1);
    });

    it("should handle pagination in search", async () => {
      (mockPrisma.alert.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockAlert]);
      (mockPrisma.alert.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      const result = await service.search("trade", { skip: 10, take: 20 });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 20,
        })
      );
      expect(result.hasMore).toBe(true);
    });
  });

  describe("getSeverityPriority", () => {
    it("should return correct priority for each severity", () => {
      expect(service.getSeverityPriority(AlertSeverity.INFO)).toBe(1);
      expect(service.getSeverityPriority(AlertSeverity.LOW)).toBe(2);
      expect(service.getSeverityPriority(AlertSeverity.MEDIUM)).toBe(3);
      expect(service.getSeverityPriority(AlertSeverity.HIGH)).toBe(4);
      expect(service.getSeverityPriority(AlertSeverity.CRITICAL)).toBe(5);
    });
  });

  describe("compareBySeverity", () => {
    it("should sort alerts by severity correctly", () => {
      const lowAlert = { ...mockAlert, severity: AlertSeverity.LOW };
      const highAlert = { ...mockAlert, severity: AlertSeverity.HIGH };
      const criticalAlert = { ...mockAlert, severity: AlertSeverity.CRITICAL };

      expect(service.compareBySeverity(lowAlert, highAlert)).toBeGreaterThan(0);
      expect(service.compareBySeverity(highAlert, lowAlert)).toBeLessThan(0);
      expect(service.compareBySeverity(highAlert, highAlert)).toBe(0);
      expect(service.compareBySeverity(criticalAlert, lowAlert)).toBeLessThan(0);
    });

    it("should work with array sort", () => {
      const alerts = [
        { ...mockAlert, id: "1", severity: AlertSeverity.LOW },
        { ...mockAlert, id: "2", severity: AlertSeverity.CRITICAL },
        { ...mockAlert, id: "3", severity: AlertSeverity.MEDIUM },
      ];

      const sorted = [...alerts].sort((a, b) => service.compareBySeverity(a, b));

      expect(sorted).toHaveLength(3);
      expect(sorted[0]!.severity).toBe(AlertSeverity.CRITICAL);
      expect(sorted[1]!.severity).toBe(AlertSeverity.MEDIUM);
      expect(sorted[2]!.severity).toBe(AlertSeverity.LOW);
    });
  });
});
