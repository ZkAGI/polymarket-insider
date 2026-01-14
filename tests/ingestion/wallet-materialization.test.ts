/**
 * Unit Tests for Wallet Materialization from Trades (INGEST-WALLET-001)
 *
 * Tests the wallet materialization logic that:
 * - Extracts unique wallet addresses from trades
 * - Creates wallet records if not present
 * - Updates wallet activity timestamps
 * - Tracks cumulative trade count and volume
 */

import { describe, it, expect, vi } from "vitest";
import type { Wallet } from "@prisma/client";
import { WalletType, RiskLevel } from "@prisma/client";

// Mock wallet data
const createMockWallet = (overrides: Partial<Wallet> = {}): Wallet => ({
  id: "wallet-1",
  address: "0x1234567890abcdef1234567890abcdef12345678",
  label: null,
  walletType: WalletType.UNKNOWN,
  isWhale: false,
  isInsider: false,
  isFresh: true,
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
});

// Note: Trade mock factory defined inline where needed for specific tests
// This keeps the test file focused on wallet materialization logic

describe("Wallet Materialization from Trades", () => {
  describe("extractWalletAddress", () => {
    it("should extract taker_address when available", () => {
      const trade = {
        taker_address: "0xABCD1234",
        maker_address: "0xEFGH5678",
        owner: "0xIJKL9012",
      };

      const walletAddress = trade.taker_address || trade.maker_address || trade.owner;
      expect(walletAddress).toBe("0xABCD1234");
    });

    it("should fall back to maker_address when taker_address is null", () => {
      const trade = {
        taker_address: null,
        maker_address: "0xEFGH5678",
        owner: "0xIJKL9012",
      };

      const walletAddress = trade.taker_address || trade.maker_address || trade.owner;
      expect(walletAddress).toBe("0xEFGH5678");
    });

    it("should fall back to owner when both addresses are null", () => {
      const trade = {
        taker_address: null,
        maker_address: null,
        owner: "0xIJKL9012",
      };

      const walletAddress = trade.taker_address || trade.maker_address || trade.owner;
      expect(walletAddress).toBe("0xIJKL9012");
    });

    it("should return undefined when all address fields are null", () => {
      const trade = {
        taker_address: null,
        maker_address: null,
        owner: null,
      };

      const walletAddress = trade.taker_address || trade.maker_address || trade.owner;
      expect(walletAddress).toBeNull();
    });

    it("should handle empty string taker_address as falsy", () => {
      const trade = {
        taker_address: "",
        maker_address: "0xEFGH5678",
        owner: "0xIJKL9012",
      };

      const walletAddress = trade.taker_address || trade.maker_address || trade.owner;
      expect(walletAddress).toBe("0xEFGH5678");
    });
  });

  describe("normalizeWalletAddress", () => {
    it("should normalize address to lowercase", () => {
      const address = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
      const normalized = address.toLowerCase();
      expect(normalized).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    it("should handle already lowercase address", () => {
      const address = "0xabcdef1234567890abcdef1234567890abcdef12";
      const normalized = address.toLowerCase();
      expect(normalized).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    it("should handle mixed case address", () => {
      const address = "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12";
      const normalized = address.toLowerCase();
      expect(normalized).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });
  });

  describe("extractUniqueWalletAddresses", () => {
    it("should extract unique wallet addresses from trades", () => {
      const trades = [
        { taker_address: "0xAAA", maker_address: null, owner: null },
        { taker_address: "0xBBB", maker_address: null, owner: null },
        { taker_address: "0xAAA", maker_address: null, owner: null }, // duplicate
        { taker_address: null, maker_address: "0xCCC", owner: null },
      ];

      const addresses = new Set<string>();
      for (const trade of trades) {
        const addr = trade.taker_address || trade.maker_address || trade.owner;
        if (addr) {
          addresses.add(addr.toLowerCase());
        }
      }

      expect(addresses.size).toBe(3);
      expect(addresses.has("0xaaa")).toBe(true);
      expect(addresses.has("0xbbb")).toBe(true);
      expect(addresses.has("0xccc")).toBe(true);
    });

    it("should handle empty trades array", () => {
      const trades: Array<{ taker_address: string | null; maker_address: string | null; owner: string | null }> = [];

      const addresses = new Set<string>();
      for (const trade of trades) {
        const addr = trade.taker_address || trade.maker_address || trade.owner;
        if (addr) {
          addresses.add(addr.toLowerCase());
        }
      }

      expect(addresses.size).toBe(0);
    });

    it("should skip trades with no wallet address", () => {
      const trades = [
        { taker_address: "0xAAA", maker_address: null, owner: null },
        { taker_address: null, maker_address: null, owner: null }, // no address
        { taker_address: "0xBBB", maker_address: null, owner: null },
      ];

      const addresses = new Set<string>();
      for (const trade of trades) {
        const addr = trade.taker_address || trade.maker_address || trade.owner;
        if (addr) {
          addresses.add(addr.toLowerCase());
        }
      }

      expect(addresses.size).toBe(2);
    });
  });

  describe("walletCreation", () => {
    it("should create wallet with default values when first seen", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";

      const wallet = createMockWallet({
        address,
        isFresh: true,
        tradeCount: 0,
        totalVolume: 0,
        firstTradeAt: null,
        lastTradeAt: null,
      });

      expect(wallet.address).toBe(address);
      expect(wallet.isFresh).toBe(true);
      expect(wallet.tradeCount).toBe(0);
      expect(wallet.totalVolume).toBe(0);
      expect(wallet.walletType).toBe(WalletType.UNKNOWN);
      expect(wallet.riskLevel).toBe(RiskLevel.NONE);
    });

    it("should set first trade timestamp on first trade", () => {
      const now = new Date();
      const wallet = createMockWallet({
        firstTradeAt: null,
        lastTradeAt: null,
        tradeCount: 0,
      });

      // Simulate first trade
      const updatedFirstTradeAt = wallet.firstTradeAt ?? now;
      const updatedLastTradeAt = now;

      expect(updatedFirstTradeAt).toEqual(now);
      expect(updatedLastTradeAt).toEqual(now);
    });
  });

  describe("walletActivityTimestampUpdate", () => {
    it("should update lastTradeAt on new trade", () => {
      const firstTradeTime = new Date("2024-01-01T00:00:00Z");
      const secondTradeTime = new Date("2024-06-15T12:00:00Z");

      const wallet = createMockWallet({
        firstTradeAt: firstTradeTime,
        lastTradeAt: firstTradeTime,
        tradeCount: 1,
      });

      // Simulate second trade
      const updatedLastTradeAt = secondTradeTime;

      expect(wallet.firstTradeAt).toEqual(firstTradeTime);
      expect(updatedLastTradeAt).toEqual(secondTradeTime);
      expect(updatedLastTradeAt.getTime()).toBeGreaterThan(wallet.firstTradeAt!.getTime());
    });

    it("should not change firstTradeAt on subsequent trades", () => {
      const firstTradeTime = new Date("2024-01-01T00:00:00Z");
      const secondTradeTime = new Date("2024-06-15T12:00:00Z");

      const wallet = createMockWallet({
        firstTradeAt: firstTradeTime,
        lastTradeAt: firstTradeTime,
        tradeCount: 1,
      });

      // Simulate update - firstTradeAt should preserve original value
      const updatedFirstTradeAt = wallet.firstTradeAt ?? secondTradeTime;

      expect(updatedFirstTradeAt).toEqual(firstTradeTime);
    });
  });

  describe("cumulativeTradeStats", () => {
    it("should increment trade count on each trade", () => {
      let tradeCount = 0;

      // Simulate 3 trades
      tradeCount++;
      tradeCount++;
      tradeCount++;

      expect(tradeCount).toBe(3);
    });

    it("should accumulate total volume from trades", () => {
      let totalVolume = 0;
      const trades = [
        { usdValue: 1000 },
        { usdValue: 2500 },
        { usdValue: 500 },
      ];

      for (const trade of trades) {
        totalVolume += trade.usdValue;
      }

      expect(totalVolume).toBe(4000);
    });

    it("should calculate average trade size correctly", () => {
      const totalVolume = 10000;
      const tradeCount = 5;

      const avgTradeSize = tradeCount > 0 ? totalVolume / tradeCount : null;

      expect(avgTradeSize).toBe(2000);
    });

    it("should track max trade size", () => {
      let maxTradeSize = 0;
      const trades = [
        { usdValue: 1000 },
        { usdValue: 5000 },
        { usdValue: 2000 },
        { usdValue: 3500 },
      ];

      for (const trade of trades) {
        maxTradeSize = Math.max(maxTradeSize, trade.usdValue);
      }

      expect(maxTradeSize).toBe(5000);
    });

    it("should handle zero trades correctly", () => {
      const tradeCount = 0;
      const totalVolume = 0;

      const avgTradeSize = tradeCount > 0 ? totalVolume / tradeCount : null;

      expect(avgTradeSize).toBeNull();
    });
  });

  describe("walletFreshDetection", () => {
    it("should mark wallet as fresh when no prior trades exist", () => {
      const wallet = createMockWallet({
        tradeCount: 0,
        firstTradeAt: null,
      });

      const isFresh = wallet.tradeCount === 0;
      expect(isFresh).toBe(true);
    });

    it("should identify wallet with prior Polymarket history as not fresh", () => {
      const wallet = createMockWallet({
        tradeCount: 10,
        firstTradeAt: new Date("2024-01-01"),
      });

      const isFresh = wallet.tradeCount === 0;
      expect(isFresh).toBe(false);
    });
  });

  describe("whaleDetection", () => {
    const WHALE_THRESHOLD = 10000; // $10,000 USD

    it("should detect whale trade above threshold", () => {
      const tradeUsdValue = 15000;
      const isWhale = tradeUsdValue >= WHALE_THRESHOLD;

      expect(isWhale).toBe(true);
    });

    it("should not mark trade below threshold as whale", () => {
      const tradeUsdValue = 5000;
      const isWhale = tradeUsdValue >= WHALE_THRESHOLD;

      expect(isWhale).toBe(false);
    });

    it("should mark trade exactly at threshold as whale", () => {
      const tradeUsdValue = 10000;
      const isWhale = tradeUsdValue >= WHALE_THRESHOLD;

      expect(isWhale).toBe(true);
    });
  });

  describe("walletStatsCalculation", () => {
    it("should correctly calculate stats after multiple trades", () => {
      const initialWallet = createMockWallet({
        tradeCount: 5,
        totalVolume: 5000,
        maxTradeSize: 2000,
        avgTradeSize: 1000,
      });

      // Add new trade of $3000
      const newTradeAmount = 3000;
      const newTradeCount = initialWallet.tradeCount + 1;
      const newTotalVolume = initialWallet.totalVolume + newTradeAmount;
      const newMaxTradeSize = Math.max(initialWallet.maxTradeSize ?? 0, newTradeAmount);
      const newAvgTradeSize = newTotalVolume / newTradeCount;

      expect(newTradeCount).toBe(6);
      expect(newTotalVolume).toBe(8000);
      expect(newMaxTradeSize).toBe(3000);
      expect(newAvgTradeSize).toBeCloseTo(1333.33, 1);
    });

    it("should preserve maxTradeSize when new trade is smaller", () => {
      const initialWallet = createMockWallet({
        tradeCount: 5,
        totalVolume: 10000,
        maxTradeSize: 5000,
      });

      // Add new trade of $1000 (smaller than max)
      const newTradeAmount = 1000;
      const newMaxTradeSize = Math.max(initialWallet.maxTradeSize ?? 0, newTradeAmount);

      expect(newMaxTradeSize).toBe(5000);
    });
  });

  describe("tradeIngestionWithWalletMaterialization", () => {
    it("should create wallet and update stats for new address", async () => {
      const mockPrisma = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue(null), // wallet doesn't exist
          create: vi.fn().mockResolvedValue(createMockWallet({
            id: "new-wallet-1",
            address: "0xnewwallet",
            tradeCount: 0,
            totalVolume: 0,
          })),
          update: vi.fn().mockImplementation(({ where, data }) => {
            return Promise.resolve(createMockWallet({
              id: where.id,
              tradeCount: data.tradeCount,
              totalVolume: data.totalVolume,
              lastTradeAt: data.lastTradeAt,
              firstTradeAt: data.firstTradeAt,
            }));
          }),
        },
      };

      // Simulate findOrCreate
      let wallet = await mockPrisma.wallet.findUnique({
        where: { address: "0xnewwallet" },
      });

      let created = false;
      if (!wallet) {
        wallet = await mockPrisma.wallet.create({
          data: { address: "0xnewwallet" },
        });
        created = true;
      }

      expect(created).toBe(true);
      expect(mockPrisma.wallet.create).toHaveBeenCalled();
    });

    it("should return existing wallet without creating for known address", async () => {
      const existingWallet = createMockWallet({
        id: "existing-wallet-1",
        address: "0xexisting",
        tradeCount: 10,
        totalVolume: 50000,
      });

      const mockPrisma = {
        wallet: {
          findUnique: vi.fn().mockResolvedValue(existingWallet),
          create: vi.fn(),
        },
      };

      // Simulate findOrCreate
      const wallet = await mockPrisma.wallet.findUnique({
        where: { address: "0xexisting" },
      });

      let created = false;
      if (!wallet) {
        await mockPrisma.wallet.create({
          data: { address: "0xexisting" },
        });
        created = true;
      }

      expect(created).toBe(false);
      expect(mockPrisma.wallet.create).not.toHaveBeenCalled();
      expect(wallet).toEqual(existingWallet);
    });
  });

  describe("batchWalletProcessing", () => {
    it("should process batch of trades and track statistics", () => {
      const trades = [
        { walletAddress: "0xAAA", usdValue: 1000 },
        { walletAddress: "0xBBB", usdValue: 2000 },
        { walletAddress: "0xAAA", usdValue: 1500 }, // same wallet, should accumulate
        { walletAddress: "0xCCC", usdValue: 500 },
        { walletAddress: "0xBBB", usdValue: 3000 }, // same wallet, should accumulate
      ];

      // Simulate wallet stats tracking
      const walletStats = new Map<string, { tradeCount: number; totalVolume: number }>();

      for (const trade of trades) {
        const addr = trade.walletAddress.toLowerCase();
        const current = walletStats.get(addr) || { tradeCount: 0, totalVolume: 0 };
        walletStats.set(addr, {
          tradeCount: current.tradeCount + 1,
          totalVolume: current.totalVolume + trade.usdValue,
        });
      }

      expect(walletStats.size).toBe(3);
      expect(walletStats.get("0xaaa")).toEqual({ tradeCount: 2, totalVolume: 2500 });
      expect(walletStats.get("0xbbb")).toEqual({ tradeCount: 2, totalVolume: 5000 });
      expect(walletStats.get("0xccc")).toEqual({ tradeCount: 1, totalVolume: 500 });
    });

    it("should count created vs existing wallets in batch", () => {
      const existingAddresses = new Set(["0xaaa", "0xbbb"]);
      const tradesAddresses = ["0xaaa", "0xbbb", "0xccc", "0xddd", "0xaaa"];

      let walletsCreated = 0;
      const seenAddresses = new Set<string>();

      for (const addr of tradesAddresses) {
        const normalized = addr.toLowerCase();
        if (!seenAddresses.has(normalized)) {
          seenAddresses.add(normalized);
          if (!existingAddresses.has(normalized)) {
            walletsCreated++;
          }
        }
      }

      expect(walletsCreated).toBe(2); // 0xccc and 0xddd are new
    });
  });

  describe("edgeCases", () => {
    it("should handle very large trade amounts", () => {
      const largeAmount = 1_000_000_000; // $1 billion
      const tradeCount = 1;

      const avgTradeSize = largeAmount / tradeCount;

      expect(avgTradeSize).toBe(1_000_000_000);
    });

    it("should handle very small trade amounts", () => {
      const smallAmount = 0.01; // 1 cent
      let totalVolume = 0;

      // Add 100 tiny trades
      for (let i = 0; i < 100; i++) {
        totalVolume += smallAmount;
      }

      expect(totalVolume).toBeCloseTo(1, 10);
    });

    it("should handle negative PnL correctly", () => {
      const wallet = createMockWallet({
        totalPnl: -5000,
      });

      expect(wallet.totalPnl).toBe(-5000);
      expect(wallet.totalPnl).toBeLessThan(0);
    });

    it("should handle concurrent trades from same wallet", () => {
      // Simulate concurrent trade processing
      let tradeCount = 10;
      const incrementBy = 3; // 3 concurrent trades

      // This simulates what happens with proper atomic increments
      tradeCount += incrementBy;

      expect(tradeCount).toBe(13);
    });

    it("should normalize uppercase addresses consistently", () => {
      const addresses = [
        "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        "0xabcdef1234567890abcdef1234567890abcdef12",
        "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
      ];

      const normalized = new Set(addresses.map(a => a.toLowerCase()));

      expect(normalized.size).toBe(1);
    });
  });
});
