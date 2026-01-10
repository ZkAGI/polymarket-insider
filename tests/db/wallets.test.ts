/**
 * Wallet Database Service Tests
 *
 * Unit tests for the WalletService CRUD operations.
 * Uses mocked Prisma client to test service logic without database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Wallet, Trade, Alert, WalletFundingSource, WalletSnapshot, WalletClusterMember, PrismaClient } from "@prisma/client";
import { WalletType, RiskLevel, FundingSourceType, TradeSide } from "@prisma/client";
import {
  WalletService,
  createWalletService,
  type CreateWalletInput,
  type UpdateWalletInput,
  type WalletSortOptions,
} from "../../src/db/wallets";

// Mock wallet data
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

const mockWallet2: Wallet = {
  id: "wallet-2",
  address: "0x1234567890abcdef1234567890abcdef12345678",
  label: "Fresh Wallet",
  walletType: WalletType.UNKNOWN,
  isWhale: false,
  isInsider: false,
  isFresh: true,
  isMonitored: false,
  isFlagged: true,
  isSanctioned: false,
  suspicionScore: 75,
  riskLevel: RiskLevel.HIGH,
  totalVolume: 10000,
  totalPnl: -500,
  tradeCount: 5,
  winCount: 1,
  winRate: 20,
  avgTradeSize: 2000,
  maxTradeSize: 5000,
  firstTradeAt: new Date("2024-06-10T00:00:00Z"),
  lastTradeAt: new Date("2024-06-14T00:00:00Z"),
  walletCreatedAt: new Date("2024-06-08T00:00:00Z"),
  onChainTxCount: 10,
  walletAgeDays: 6,
  primaryFundingSource: FundingSourceType.MIXER,
  metadata: { source: "suspicious" },
  notes: "Suspicious activity",
  createdAt: new Date("2024-06-10T00:00:00Z"),
  updatedAt: new Date("2024-06-15T00:00:00Z"),
  lastSyncedAt: null,
};

const mockInsiderWallet: Wallet = {
  ...mockWallet,
  id: "wallet-insider-1",
  address: "0x5555555555555555555555555555555555555555",
  label: "Suspected Insider",
  isWhale: false,
  isInsider: true,
  suspicionScore: 85,
  riskLevel: RiskLevel.HIGH,
};

const mockSanctionedWallet: Wallet = {
  ...mockWallet,
  id: "wallet-sanctioned-1",
  address: "0x9999999999999999999999999999999999999999",
  label: "Sanctioned Entity",
  isSanctioned: true,
  suspicionScore: 100,
  riskLevel: RiskLevel.CRITICAL,
};

const mockTrade: Trade = {
  id: "trade-1",
  marketId: "market-1",
  outcomeId: "outcome-1",
  walletId: mockWallet.id,
  clobTradeId: "clob-123",
  matchId: "match-456",
  side: TradeSide.BUY,
  amount: 100,
  price: 0.65,
  usdValue: 65,
  feeUsd: 0.13,
  makerAddress: "0x1111111111111111111111111111111111111111",
  takerAddress: mockWallet.address,
  isMaker: false,
  timestamp: new Date("2024-06-15T10:30:00Z"),
  txHash: "0xabc123",
  blockNumber: BigInt(58000000),
  isWhale: false,
  isInsider: false,
  flags: [],
  createdAt: new Date("2024-06-15T10:30:05Z"),
};

const mockAlert: Alert = {
  id: "alert-1",
  type: "WHALE_TRADE",
  severity: "HIGH",
  marketId: "market-1",
  walletId: mockWallet.id,
  title: "Large Trade Detected",
  message: "Whale wallet made a large trade",
  data: null,
  tags: ["whale"],
  read: false,
  acknowledged: false,
  dismissed: false,
  actionBy: null,
  actionAt: null,
  createdAt: new Date("2024-06-15T10:30:00Z"),
  expiresAt: null,
};

const mockFundingSource: WalletFundingSource = {
  id: "funding-1",
  walletId: mockWallet.id,
  sourceAddress: "0x2222222222222222222222222222222222222222",
  sourceType: FundingSourceType.EXCHANGE,
  sourceLabel: "Binance",
  amount: 10000,
  txHash: "0xfund123",
  depth: 1,
  riskLevel: RiskLevel.NONE,
  isSanctioned: false,
  transferredAt: new Date("2024-01-14T00:00:00Z"),
  createdAt: new Date("2024-01-14T00:00:00Z"),
};

const mockSnapshot: WalletSnapshot = {
  id: "snapshot-1",
  walletId: mockWallet.id,
  totalVolume: 400000,
  totalPnl: 20000,
  tradeCount: 120,
  winRate: 58,
  suspicionScore: 12,
  positions: null,
  timestamp: new Date("2024-05-15T00:00:00Z"),
};

const mockClusterMember: WalletClusterMember = {
  id: "cluster-member-1",
  clusterId: "cluster-1",
  walletId: mockWallet.id,
  role: "primary",
  confidence: 85,
  createdAt: new Date("2024-03-01T00:00:00Z"),
};

/**
 * Create a mock Prisma client for testing
 */
function createMockPrismaClient() {
  return {
    wallet: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
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

describe("WalletService", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: WalletService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = createWalletService({ prisma: mockPrisma });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with provided prisma client", () => {
      const customPrisma = createMockPrismaClient();
      const customService = new WalletService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(WalletService);
    });

    it("should create service with createWalletService factory", () => {
      const customPrisma = createMockPrismaClient();
      const customService = createWalletService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(WalletService);
    });
  });

  describe("create", () => {
    it("should create wallet with required fields only", async () => {
      const input: CreateWalletInput = {
        address: "0xABCDef1234567890ABCDef1234567890ABCDef12",
      };

      (mockPrisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        address: input.address.toLowerCase(),
        label: null,
        walletType: WalletType.UNKNOWN,
        isWhale: false,
        isInsider: false,
        isFresh: false,
        isMonitored: false,
        isFlagged: false,
        isSanctioned: false,
        suspicionScore: 0,
        riskLevel: RiskLevel.NONE,
        totalVolume: 0,
        totalPnl: 0,
        tradeCount: 0,
        winCount: 0,
        winRate: null,
      });

      const result = await service.create(input);

      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
          walletType: WalletType.UNKNOWN,
          isWhale: false,
          suspicionScore: 0,
          riskLevel: RiskLevel.NONE,
        }),
      });
      expect(result.address).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    it("should create wallet with all fields", async () => {
      const input: CreateWalletInput = {
        address: "0xABCDef1234567890ABCDef1234567890ABCDef12",
        label: "Test Wallet",
        walletType: WalletType.EOA,
        isWhale: true,
        isInsider: false,
        isFresh: false,
        isMonitored: true,
        isFlagged: false,
        isSanctioned: false,
        suspicionScore: 25,
        riskLevel: RiskLevel.LOW,
        totalVolume: 100000,
        totalPnl: 5000,
        tradeCount: 50,
        winCount: 30,
        winRate: 60,
        avgTradeSize: 2000,
        maxTradeSize: 10000,
        firstTradeAt: new Date("2024-01-01T00:00:00Z"),
        lastTradeAt: new Date("2024-06-01T00:00:00Z"),
        walletCreatedAt: new Date("2023-06-01T00:00:00Z"),
        onChainTxCount: 200,
        walletAgeDays: 365,
        primaryFundingSource: FundingSourceType.EXCHANGE,
        metadata: { source: "test" },
        notes: "Test notes",
      };

      (mockPrisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "new-wallet",
        ...input,
        address: input.address.toLowerCase(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: null,
      });

      const result = await service.create(input);

      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
          label: "Test Wallet",
          walletType: WalletType.EOA,
          isWhale: true,
          suspicionScore: 25,
          riskLevel: RiskLevel.LOW,
        }),
      });
      expect(result.label).toBe("Test Wallet");
    });

    it("should normalize address to lowercase", async () => {
      const input: CreateWalletInput = {
        address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      };

      (mockPrisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        address: input.address.toLowerCase(),
      });

      await service.create(input);

      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
        }),
      });
    });
  });

  describe("findById", () => {
    it("should find wallet by ID", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);

      const result = await service.findById("wallet-1");

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: undefined,
      });
      expect(result).toEqual(mockWallet);
    });

    it("should return null if wallet not found", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should include trades relation when requested", async () => {
      const walletWithTrades = {
        ...mockWallet,
        trades: [mockTrade],
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithTrades);

      const result = await service.findById("wallet-1", { trades: true });

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: {
          trades: true,
          alerts: false,
          fundingSources: false,
          snapshots: false,
          walletClusters: false,
        },
      });
      expect(result).toEqual(walletWithTrades);
    });

    it("should include alerts relation when requested", async () => {
      const walletWithAlerts = {
        ...mockWallet,
        alerts: [mockAlert],
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithAlerts);

      const result = await service.findById("wallet-1", { alerts: true });

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: {
          trades: false,
          alerts: true,
          fundingSources: false,
          snapshots: false,
          walletClusters: false,
        },
      });
      expect(result).toEqual(walletWithAlerts);
    });

    it("should include funding sources relation when requested", async () => {
      const walletWithFunding = {
        ...mockWallet,
        fundingSources: [mockFundingSource],
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithFunding);

      const result = await service.findById("wallet-1", { fundingSources: true });

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: {
          trades: false,
          alerts: false,
          fundingSources: true,
          snapshots: false,
          walletClusters: false,
        },
      });
      expect(result).toEqual(walletWithFunding);
    });

    it("should include snapshots relation when requested", async () => {
      const walletWithSnapshots = {
        ...mockWallet,
        snapshots: [mockSnapshot],
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithSnapshots);

      const result = await service.findById("wallet-1", { snapshots: true });

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: {
          trades: false,
          alerts: false,
          fundingSources: false,
          snapshots: true,
          walletClusters: false,
        },
      });
      expect(result).toEqual(walletWithSnapshots);
    });

    it("should include wallet clusters relation when requested", async () => {
      const walletWithClusters = {
        ...mockWallet,
        walletClusters: [mockClusterMember],
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithClusters);

      const result = await service.findById("wallet-1", { walletClusters: true });

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: {
          trades: false,
          alerts: false,
          fundingSources: false,
          snapshots: false,
          walletClusters: true,
        },
      });
      expect(result).toEqual(walletWithClusters);
    });

    it("should include all relations when requested", async () => {
      const walletWithAll = {
        ...mockWallet,
        trades: [mockTrade],
        alerts: [mockAlert],
        fundingSources: [mockFundingSource],
        snapshots: [mockSnapshot],
        walletClusters: [mockClusterMember],
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithAll);

      const result = await service.findById("wallet-1", {
        trades: true,
        alerts: true,
        fundingSources: true,
        snapshots: true,
        walletClusters: true,
      });

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        include: {
          trades: true,
          alerts: true,
          fundingSources: true,
          snapshots: true,
          walletClusters: true,
        },
      });
      expect(result).toEqual(walletWithAll);
    });
  });

  describe("findByAddress", () => {
    it("should find wallet by address", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);

      const result = await service.findByAddress("0xABCDef1234567890ABCDef1234567890ABCDef12");

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { address: "0xabcdef1234567890abcdef1234567890abcdef12" },
        include: undefined,
      });
      expect(result).toEqual(mockWallet);
    });

    it("should return null if address not found", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findByAddress("0x0000000000000000000000000000000000000000");

      expect(result).toBeNull();
    });

    it("should normalize address to lowercase for lookup", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);

      await service.findByAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");

      expect(mockPrisma.wallet.findUnique).toHaveBeenCalledWith({
        where: { address: "0xabcdef1234567890abcdef1234567890abcdef12" },
        include: undefined,
      });
    });
  });

  describe("findByIds", () => {
    it("should find multiple wallets by IDs", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet, mockWallet2]);

      const result = await service.findByIds(["wallet-1", "wallet-2"]);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["wallet-1", "wallet-2"] } },
        include: undefined,
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no wallets found", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.findByIds(["nonexistent"]);

      expect(result).toHaveLength(0);
    });
  });

  describe("findByAddresses", () => {
    it("should find multiple wallets by addresses", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet, mockWallet2]);

      const result = await service.findByAddresses([
        "0xABCDef1234567890ABCDef1234567890ABCDef12",
        "0x1234567890ABCDEF1234567890ABCDEF12345678",
      ]);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
        where: {
          address: {
            in: [
              "0xabcdef1234567890abcdef1234567890abcdef12",
              "0x1234567890abcdef1234567890abcdef12345678",
            ],
          },
        },
        include: undefined,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("should update wallet fields", async () => {
      const input: UpdateWalletInput = {
        label: "Updated Label",
        isWhale: true,
        suspicionScore: 50,
      };

      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        ...input,
      });

      const result = await service.update("wallet-1", input);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: input,
      });
      expect(result.label).toBe("Updated Label");
      expect(result.suspicionScore).toBe(50);
    });

    it("should set nullable field to null", async () => {
      const input: UpdateWalletInput = {
        label: null,
        winRate: null,
        notes: null,
      };

      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        label: null,
        winRate: null,
        notes: null,
      });

      const result = await service.update("wallet-1", input);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: input,
      });
      expect(result.label).toBeNull();
    });
  });

  describe("updateByAddress", () => {
    it("should update wallet by address", async () => {
      const input: UpdateWalletInput = {
        isMonitored: true,
      };

      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isMonitored: true,
      });

      const result = await service.updateByAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12", input);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { address: "0xabcdef1234567890abcdef1234567890abcdef12" },
        data: input,
      });
      expect(result.isMonitored).toBe(true);
    });
  });

  describe("upsertByAddress", () => {
    it("should create new wallet if not exists", async () => {
      const input: CreateWalletInput = {
        address: "0xnewwallet1234567890abcdef1234567890abcdef",
        label: "New Wallet",
        isWhale: true,
      };

      (mockPrisma.wallet.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        id: "new-wallet-id",
        address: "0xnewwallet1234567890abcdef1234567890abcdef",
        label: "New Wallet",
        isWhale: true,
      });

      const result = await service.upsertByAddress(input.address, input);

      expect(mockPrisma.wallet.upsert).toHaveBeenCalledWith({
        where: { address: "0xnewwallet1234567890abcdef1234567890abcdef" },
        create: expect.objectContaining({
          address: "0xnewwallet1234567890abcdef1234567890abcdef",
          label: "New Wallet",
          isWhale: true,
        }),
        update: expect.objectContaining({
          label: "New Wallet",
          isWhale: true,
        }),
      });
      expect(result.label).toBe("New Wallet");
    });

    it("should update existing wallet", async () => {
      const input: CreateWalletInput = {
        address: mockWallet.address,
        label: "Updated Label",
        totalVolume: 600000,
      };

      (mockPrisma.wallet.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        label: "Updated Label",
        totalVolume: 600000,
      });

      const result = await service.upsertByAddress(input.address, input);

      expect(result.label).toBe("Updated Label");
      expect(result.totalVolume).toBe(600000);
    });
  });

  describe("delete", () => {
    it("should delete wallet by ID", async () => {
      (mockPrisma.wallet.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);

      const result = await service.delete("wallet-1");

      expect(mockPrisma.wallet.delete).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
      });
      expect(result).toEqual(mockWallet);
    });
  });

  describe("deleteByAddress", () => {
    it("should delete wallet by address", async () => {
      (mockPrisma.wallet.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);

      const result = await service.deleteByAddress("0xABCDef1234567890ABCDef1234567890ABCDef12");

      expect(mockPrisma.wallet.delete).toHaveBeenCalledWith({
        where: { address: "0xabcdef1234567890abcdef1234567890abcdef12" },
      });
      expect(result).toEqual(mockWallet);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple wallets by IDs", async () => {
      (mockPrisma.wallet.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

      const result = await service.deleteMany(["wallet-1", "wallet-2"]);

      expect(mockPrisma.wallet.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["wallet-1", "wallet-2"] } },
      });
      expect(result.count).toBe(2);
    });
  });

  describe("findMany", () => {
    it("should find all wallets with default pagination", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet, mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findMany();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 100,
        include: undefined,
      });
      expect(result.wallets).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by wallet type", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ walletType: WalletType.EOA });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletType: WalletType.EOA },
        })
      );
    });

    it("should filter by whale status", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ isWhale: true });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isWhale: true },
        })
      );
    });

    it("should filter by insider status", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockInsiderWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ isInsider: true });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isInsider: true },
        })
      );
    });

    it("should filter by fresh status", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ isFresh: true });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFresh: true },
        })
      );
    });

    it("should filter by monitored status", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ isMonitored: true });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isMonitored: true },
        })
      );
    });

    it("should filter by flagged status", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ isFlagged: true });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFlagged: true },
        })
      );
    });

    it("should filter by sanctioned status", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSanctionedWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ isSanctioned: true });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isSanctioned: true },
        })
      );
    });

    it("should filter by risk level", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ riskLevel: RiskLevel.HIGH });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { riskLevel: RiskLevel.HIGH },
        })
      );
    });

    it("should filter by suspicion score range", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ minSuspicionScore: 50, maxSuspicionScore: 90 });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { suspicionScore: { gte: 50, lte: 90 } },
        })
      );
    });

    it("should filter by total volume range", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ minTotalVolume: 100000, maxTotalVolume: 1000000 });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { totalVolume: { gte: 100000, lte: 1000000 } },
        })
      );
    });

    it("should filter by trade count range", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ minTradeCount: 100, maxTradeCount: 200 });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tradeCount: { gte: 100, lte: 200 } },
        })
      );
    });

    it("should filter by win rate range", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ minWinRate: 50, maxWinRate: 70 });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { winRate: { gte: 50, lte: 70 } },
        })
      );
    });

    it("should filter by first trade date range", async () => {
      const after = new Date("2024-01-01T00:00:00Z");
      const before = new Date("2024-06-01T00:00:00Z");
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ firstTradeAfter: after, firstTradeBefore: before });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { firstTradeAt: { gte: after, lte: before } },
        })
      );
    });

    it("should filter by last trade date range", async () => {
      const after = new Date("2024-06-01T00:00:00Z");
      const before = new Date("2024-06-30T00:00:00Z");
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ lastTradeAfter: after, lastTradeBefore: before });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { lastTradeAt: { gte: after, lte: before } },
        })
      );
    });

    it("should filter by wallet created date range", async () => {
      const after = new Date("2023-01-01T00:00:00Z");
      const before = new Date("2024-01-01T00:00:00Z");
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ walletCreatedAfter: after, walletCreatedBefore: before });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { walletCreatedAt: { gte: after, lte: before } },
        })
      );
    });

    it("should filter by primary funding source", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ primaryFundingSource: FundingSourceType.EXCHANGE });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { primaryFundingSource: FundingSourceType.EXCHANGE },
        })
      );
    });

    it("should filter by label contains", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ labelContains: "Whale" });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { label: { contains: "Whale", mode: "insensitive" } },
        })
      );
    });

    it("should filter by address contains", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({ addressContains: "abcdef" });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { address: { contains: "abcdef", mode: "insensitive" } },
        })
      );
    });

    it("should apply sorting", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await service.findMany({}, { field: "suspicionScore", direction: "desc" });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { suspicionScore: "desc" },
        })
      );
    });

    it("should apply pagination", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findMany({}, undefined, { skip: 1, take: 1 });

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
        })
      );
      expect(result.skip).toBe(1);
      expect(result.take).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should indicate hasMore when more results exist", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await service.findMany({}, undefined, { take: 1 });

      expect(result.hasMore).toBe(true);
    });
  });

  describe("findWhales", () => {
    it("should find whale wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findWhales();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isWhale: true },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findInsiders", () => {
    it("should find insider wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockInsiderWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findInsiders();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isInsider: true },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findFresh", () => {
    it("should find fresh wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findFresh();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFresh: true },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findMonitored", () => {
    it("should find monitored wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findMonitored();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isMonitored: true },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findFlagged", () => {
    it("should find flagged wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findFlagged();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFlagged: true },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findSanctioned", () => {
    it("should find sanctioned wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockSanctionedWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findSanctioned();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isSanctioned: true },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findByRiskLevel", () => {
    it("should find wallets by risk level", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findByRiskLevel(RiskLevel.HIGH);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { riskLevel: RiskLevel.HIGH },
        })
      );
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findHighRisk", () => {
    it("should find high risk wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2, mockSanctionedWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.findHighRisk();

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            riskLevel: { in: [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL] },
          },
        })
      );
      expect(result.wallets).toHaveLength(2);
    });
  });

  describe("getTopByVolume", () => {
    it("should get top wallets by volume", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getTopByVolume(10);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalVolume: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getTopBySuspicionScore", () => {
    it("should get top wallets by suspicion score", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getTopBySuspicionScore(10);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { suspicionScore: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getTopByTradeCount", () => {
    it("should get top wallets by trade count", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getTopByTradeCount(10);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { tradeCount: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getTopByPnl", () => {
    it("should get top wallets by PnL", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getTopByPnl(10);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalPnl: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getRecentlyActive", () => {
    it("should get recently active wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getRecentlyActive(10);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastTradeAt: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("getNewest", () => {
    it("should get newest wallets", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet2]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.getNewest(10);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("count", () => {
    it("should count wallets with no filters", async () => {
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await service.count();

      expect(mockPrisma.wallet.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(5);
    });

    it("should count wallets with filters", async () => {
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await service.count({ isWhale: true });

      expect(mockPrisma.wallet.count).toHaveBeenCalledWith({ where: { isWhale: true } });
      expect(result).toBe(2);
    });
  });

  describe("exists", () => {
    it("should return true if wallet exists", async () => {
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.exists("wallet-1");

      expect(result).toBe(true);
    });

    it("should return false if wallet does not exist", async () => {
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.exists("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("existsByAddress", () => {
    it("should return true if address exists", async () => {
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.existsByAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");

      expect(mockPrisma.wallet.count).toHaveBeenCalledWith({
        where: { address: "0xabcdef1234567890abcdef1234567890abcdef12" },
      });
      expect(result).toBe(true);
    });

    it("should return false if address does not exist", async () => {
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.existsByAddress("0x0000000000000000000000000000000000000000");

      expect(result).toBe(false);
    });
  });

  describe("createMany", () => {
    it("should bulk create wallets", async () => {
      (mockPrisma.wallet.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

      const wallets: CreateWalletInput[] = [
        { address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        { address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" },
      ];

      const result = await service.createMany(wallets);

      expect(mockPrisma.wallet.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          }),
          expect.objectContaining({
            address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          }),
        ]),
        skipDuplicates: true,
      });
      expect(result.count).toBe(2);
    });
  });

  describe("markAsWhale", () => {
    it("should mark wallet as whale", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isWhale: true,
      });

      const result = await service.markAsWhale("wallet-1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isWhale: true },
      });
      expect(result.isWhale).toBe(true);
    });
  });

  describe("markAsInsider", () => {
    it("should mark wallet as insider", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isInsider: true,
      });

      const result = await service.markAsInsider("wallet-1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isInsider: true },
      });
      expect(result.isInsider).toBe(true);
    });
  });

  describe("markAsFresh", () => {
    it("should mark wallet as fresh", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isFresh: true,
      });

      const result = await service.markAsFresh("wallet-1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isFresh: true },
      });
      expect(result.isFresh).toBe(true);
    });
  });

  describe("markAsMonitored", () => {
    it("should mark wallet as monitored", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isMonitored: true,
      });

      const result = await service.markAsMonitored("wallet-1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isMonitored: true },
      });
      expect(result.isMonitored).toBe(true);
    });
  });

  describe("markAsFlagged", () => {
    it("should mark wallet as flagged", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isFlagged: true,
      });

      const result = await service.markAsFlagged("wallet-1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isFlagged: true },
      });
      expect(result.isFlagged).toBe(true);
    });
  });

  describe("markAsSanctioned", () => {
    it("should mark wallet as sanctioned with critical risk level", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isSanctioned: true,
        riskLevel: RiskLevel.CRITICAL,
      });

      const result = await service.markAsSanctioned("wallet-1");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isSanctioned: true, riskLevel: RiskLevel.CRITICAL },
      });
      expect(result.isSanctioned).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
    });
  });

  describe("unmark", () => {
    it("should unmark whale flag", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isWhale: false,
      });

      const result = await service.unmark("wallet-1", "isWhale");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isWhale: false },
      });
      expect(result.isWhale).toBe(false);
    });

    it("should unmark insider flag", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        isInsider: false,
      });

      const result = await service.unmark("wallet-1", "isInsider");

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { isInsider: false },
      });
      expect(result.isInsider).toBe(false);
    });
  });

  describe("updateSuspicionScore", () => {
    it("should update suspicion score and set appropriate risk level - NONE", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 15,
        riskLevel: RiskLevel.NONE,
      });

      const result = await service.updateSuspicionScore("wallet-1", 15);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 15, riskLevel: RiskLevel.NONE },
      });
      expect(result.suspicionScore).toBe(15);
      expect(result.riskLevel).toBe(RiskLevel.NONE);
    });

    it("should update suspicion score and set appropriate risk level - LOW", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 25,
        riskLevel: RiskLevel.LOW,
      });

      const result = await service.updateSuspicionScore("wallet-1", 25);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 25, riskLevel: RiskLevel.LOW },
      });
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it("should update suspicion score and set appropriate risk level - MEDIUM", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 45,
        riskLevel: RiskLevel.MEDIUM,
      });

      const result = await service.updateSuspicionScore("wallet-1", 45);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 45, riskLevel: RiskLevel.MEDIUM },
      });
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it("should update suspicion score and set appropriate risk level - HIGH", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 65,
        riskLevel: RiskLevel.HIGH,
      });

      const result = await service.updateSuspicionScore("wallet-1", 65);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 65, riskLevel: RiskLevel.HIGH },
      });
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it("should update suspicion score and set appropriate risk level - CRITICAL", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 85,
        riskLevel: RiskLevel.CRITICAL,
      });

      const result = await service.updateSuspicionScore("wallet-1", 85);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 85, riskLevel: RiskLevel.CRITICAL },
      });
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it("should clamp score to 0-100 range", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 100,
        riskLevel: RiskLevel.CRITICAL,
      });

      await service.updateSuspicionScore("wallet-1", 150);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 100, riskLevel: RiskLevel.CRITICAL },
      });
    });

    it("should clamp negative score to 0", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        suspicionScore: 0,
        riskLevel: RiskLevel.NONE,
      });

      await service.updateSuspicionScore("wallet-1", -10);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { suspicionScore: 0, riskLevel: RiskLevel.NONE },
      });
    });
  });

  describe("updateRiskLevel", () => {
    it("should update risk level", async () => {
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        riskLevel: RiskLevel.HIGH,
      });

      const result = await service.updateRiskLevel("wallet-1", RiskLevel.HIGH);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: { riskLevel: RiskLevel.HIGH },
      });
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });
  });

  describe("incrementTradeStats", () => {
    it("should increment trade statistics", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        tradeCount: 151,
        totalVolume: 501000,
        maxTradeSize: 50000,
        avgTradeSize: 501000 / 151,
        lastTradeAt: new Date(),
      });

      const result = await service.incrementTradeStats("wallet-1", 1000);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: expect.objectContaining({
          tradeCount: 151,
          totalVolume: 501000,
        }),
      });
      expect(result.tradeCount).toBe(151);
    });

    it("should update max trade size when larger trade occurs", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        tradeCount: 151,
        totalVolume: 600000,
        maxTradeSize: 100000,
      });

      const result = await service.incrementTradeStats("wallet-1", 100000);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: expect.objectContaining({
          maxTradeSize: 100000,
        }),
      });
      expect(result.maxTradeSize).toBe(100000);
    });

    it("should update win count and win rate when isWin is true", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        tradeCount: 151,
        winCount: 91,
        winRate: (91 / 151) * 100,
      });

      const result = await service.incrementTradeStats("wallet-1", 1000, true);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: expect.objectContaining({
          winCount: 91,
          winRate: (91 / 151) * 100,
        }),
      });
      expect(result.winCount).toBe(91);
    });

    it("should update win rate but not win count when isWin is false", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        tradeCount: 151,
        winCount: 90,
        winRate: (90 / 151) * 100,
      });

      const result = await service.incrementTradeStats("wallet-1", 1000, false);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: expect.objectContaining({
          winCount: 90,
          winRate: (90 / 151) * 100,
        }),
      });
      expect(result.winCount).toBe(90);
    });

    it("should throw error if wallet not found", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.incrementTradeStats("nonexistent", 1000)).rejects.toThrow("Wallet not found");
    });

    it("should set firstTradeAt if null", async () => {
      const walletWithoutFirstTrade = {
        ...mockWallet,
        firstTradeAt: null,
      };
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(walletWithoutFirstTrade);
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...walletWithoutFirstTrade,
        firstTradeAt: new Date(),
      });

      const result = await service.incrementTradeStats("wallet-1", 1000);

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: expect.objectContaining({
          firstTradeAt: expect.any(Date),
        }),
      });
      expect(result.firstTradeAt).not.toBeNull();
    });
  });

  describe("updateOnChainData", () => {
    it("should update on-chain data", async () => {
      const walletCreatedAt = new Date("2023-01-01T00:00:00Z");
      (mockPrisma.wallet.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        walletCreatedAt,
        onChainTxCount: 1000,
        walletAgeDays: 540,
        lastSyncedAt: new Date(),
      });

      const result = await service.updateOnChainData("wallet-1", {
        walletCreatedAt,
        onChainTxCount: 1000,
        walletAgeDays: 540,
      });

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: "wallet-1" },
        data: expect.objectContaining({
          walletCreatedAt,
          onChainTxCount: 1000,
          walletAgeDays: 540,
          lastSyncedAt: expect.any(Date),
        }),
      });
      expect(result.onChainTxCount).toBe(1000);
    });
  });

  describe("getStats", () => {
    it("should get aggregate statistics", async () => {
      (mockPrisma.wallet.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _count: { id: 10 },
        _sum: { totalVolume: 5000000, tradeCount: 1000 },
        _avg: { suspicionScore: 35 },
      });
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(3)  // whaleCount
        .mockResolvedValueOnce(1)  // insiderCount
        .mockResolvedValueOnce(2)  // freshCount
        .mockResolvedValueOnce(5)  // monitoredCount
        .mockResolvedValueOnce(1); // flaggedCount

      const result = await service.getStats();

      expect(result.count).toBe(10);
      expect(result.totalVolume).toBe(5000000);
      expect(result.avgSuspicionScore).toBe(35);
      expect(result.totalTradeCount).toBe(1000);
      expect(result.whaleCount).toBe(3);
      expect(result.insiderCount).toBe(1);
      expect(result.freshCount).toBe(2);
      expect(result.monitoredCount).toBe(5);
      expect(result.flaggedCount).toBe(1);
    });

    it("should handle null aggregates", async () => {
      (mockPrisma.wallet.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
        _count: { id: 0 },
        _sum: { totalVolume: null, tradeCount: null },
        _avg: { suspicionScore: null },
      });
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.count).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.avgSuspicionScore).toBe(0);
      expect(result.totalTradeCount).toBe(0);
    });
  });

  describe("getCountByRiskLevel", () => {
    it("should get count by risk level", async () => {
      (mockPrisma.wallet.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { riskLevel: RiskLevel.NONE, _count: { id: 5 } },
        { riskLevel: RiskLevel.LOW, _count: { id: 3 } },
        { riskLevel: RiskLevel.HIGH, _count: { id: 2 } },
      ]);

      const result = await service.getCountByRiskLevel();

      expect(result[RiskLevel.NONE]).toBe(5);
      expect(result[RiskLevel.LOW]).toBe(3);
      expect(result[RiskLevel.MEDIUM]).toBe(0);
      expect(result[RiskLevel.HIGH]).toBe(2);
      expect(result[RiskLevel.CRITICAL]).toBe(0);
    });
  });

  describe("getCountByWalletType", () => {
    it("should get count by wallet type", async () => {
      (mockPrisma.wallet.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
        { walletType: WalletType.EOA, _count: { id: 8 } },
        { walletType: WalletType.EXCHANGE, _count: { id: 2 } },
      ]);

      const result = await service.getCountByWalletType();

      expect(result[WalletType.EOA]).toBe(8);
      expect(result[WalletType.EXCHANGE]).toBe(2);
      expect(result[WalletType.UNKNOWN]).toBe(0);
      expect(result[WalletType.CONTRACT]).toBe(0);
    });
  });

  describe("search", () => {
    it("should search by address", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.search("abcdef");

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { address: { contains: "abcdef", mode: "insensitive" } },
            { label: { contains: "abcdef", mode: "insensitive" } },
          ],
        },
        orderBy: { totalVolume: "desc" },
        skip: 0,
        take: 100,
      });
      expect(result.wallets).toHaveLength(1);
    });

    it("should search by label", async () => {
      (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
      (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.search("Whale");

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { address: { contains: "whale", mode: "insensitive" } },
            { label: { contains: "Whale", mode: "insensitive" } },
          ],
        },
        orderBy: { totalVolume: "desc" },
        skip: 0,
        take: 100,
      });
      expect(result.wallets).toHaveLength(1);
    });
  });

  describe("findOrCreate", () => {
    it("should return existing wallet", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockWallet);

      const result = await service.findOrCreate(mockWallet.address);

      expect(result.wallet).toEqual(mockWallet);
      expect(result.created).toBe(false);
      expect(mockPrisma.wallet.create).not.toHaveBeenCalled();
    });

    it("should create new wallet if not exists", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        address: "0xnewaddress1234567890abcdef1234567890abcd",
      });

      const result = await service.findOrCreate("0xNewAddress1234567890abcdef1234567890abcd");

      expect(result.created).toBe(true);
      expect(mockPrisma.wallet.create).toHaveBeenCalled();
    });

    it("should use defaults when creating new wallet", async () => {
      (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.wallet.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockWallet,
        label: "Default Label",
        isMonitored: true,
      });

      await service.findOrCreate("0xNewAddress1234567890abcdef1234567890abcd", {
        label: "Default Label",
        isMonitored: true,
      });

      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          label: "Default Label",
          isMonitored: true,
        }),
      });
    });
  });

  describe("sorting options", () => {
    it.each([
      ["suspicionScore", "asc"],
      ["suspicionScore", "desc"],
      ["totalVolume", "asc"],
      ["totalVolume", "desc"],
      ["totalPnl", "asc"],
      ["totalPnl", "desc"],
      ["tradeCount", "asc"],
      ["tradeCount", "desc"],
      ["winRate", "asc"],
      ["winRate", "desc"],
      ["firstTradeAt", "asc"],
      ["firstTradeAt", "desc"],
      ["lastTradeAt", "asc"],
      ["lastTradeAt", "desc"],
      ["walletCreatedAt", "asc"],
      ["walletCreatedAt", "desc"],
      ["createdAt", "asc"],
      ["createdAt", "desc"],
      ["updatedAt", "asc"],
      ["updatedAt", "desc"],
    ] as Array<[WalletSortOptions["field"], WalletSortOptions["direction"]]>)(
      "should sort by %s %s",
      async (field, direction) => {
        (mockPrisma.wallet.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockWallet]);
        (mockPrisma.wallet.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

        await service.findMany({}, { field, direction });

        expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { [field]: direction },
          })
        );
      }
    );
  });
});
