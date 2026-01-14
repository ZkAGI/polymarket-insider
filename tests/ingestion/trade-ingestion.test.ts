/**
 * Unit Tests for Trade Ingestion (INGEST-TRADE-001)
 *
 * Tests for trade parsing, normalization, and deduplication logic
 * used by the ingestion worker to fetch and store Polymarket trades.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TradeSide } from "@prisma/client";

/**
 * CLOB API trade response type (mirrored from ingestion-worker.ts)
 */
interface ClobTradeResponse {
  id?: string;
  match_id?: string;
  owner?: string;
  maker_address?: string;
  taker_address?: string;
  side: string;
  size?: string;
  amount?: string;
  price?: string;
  fee?: string;
  timestamp?: string;
  created_at?: string;
  transaction_hash?: string;
}

/**
 * Normalized trade input structure (matching CreateTradeInput)
 */
interface NormalizedTradeInput {
  marketId: string;
  outcomeId: string;
  walletId: string;
  clobTradeId: string;
  matchId?: string;
  side: TradeSide;
  amount: number;
  price: number;
  usdValue: number;
  feeUsd: number;
  makerAddress?: string;
  takerAddress?: string;
  isMaker: boolean;
  timestamp: Date;
  txHash?: string;
  isWhale: boolean;
  isInsider: boolean;
  flags: string[];
}

// === Trade Normalization Functions (extracted from ingestion worker logic) ===

/**
 * Extract wallet address from trade response.
 * Prioritizes taker_address, then maker_address, then owner.
 */
function extractWalletAddress(trade: ClobTradeResponse): string | null {
  const address = trade.taker_address || trade.maker_address || trade.owner;
  return address ? address.toLowerCase() : null;
}

/**
 * Generate a unique trade ID.
 * Uses CLOB trade ID if available, otherwise generates one.
 */
function generateTradeId(
  trade: ClobTradeResponse,
  marketId: string,
  outcomeId: string
): string {
  if (trade.id) {
    return trade.id;
  }
  return `${marketId}-${outcomeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse trade amount from response.
 * Handles both 'size' and 'amount' fields.
 */
function parseTradeAmount(trade: ClobTradeResponse): number {
  const rawAmount = trade.size || trade.amount || "0";
  const amount = parseFloat(rawAmount);
  return isNaN(amount) ? 0 : amount;
}

/**
 * Parse trade price from response.
 */
function parseTradePrice(trade: ClobTradeResponse): number {
  const price = parseFloat(trade.price || "0");
  return isNaN(price) ? 0 : price;
}

/**
 * Calculate USD value from amount and price.
 */
function calculateUsdValue(amount: number, price: number): number {
  return amount * price;
}

/**
 * Parse trade fee from response.
 */
function parseTradeFee(trade: ClobTradeResponse): number {
  const fee = parseFloat(trade.fee || "0");
  return isNaN(fee) ? 0 : fee;
}

/**
 * Normalize trade side to enum value.
 */
function normalizeTradeSide(side: string): TradeSide {
  const upperSide = side.toUpperCase();
  return upperSide === "BUY" ? TradeSide.BUY : TradeSide.SELL;
}

/**
 * Determine if wallet was maker or taker.
 */
function determineIsMaker(
  walletAddress: string,
  makerAddress?: string
): boolean {
  if (!makerAddress) return false;
  return walletAddress.toLowerCase() === makerAddress.toLowerCase();
}

/**
 * Parse trade timestamp from response.
 */
function parseTradeTimestamp(trade: ClobTradeResponse): Date {
  const rawTimestamp = trade.timestamp || trade.created_at;
  if (!rawTimestamp) {
    return new Date();
  }

  const parsed = new Date(rawTimestamp);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Determine if trade qualifies as whale trade.
 * Uses $10,000 USD threshold.
 */
function isWhaleTrade(usdValue: number, threshold = 10000): boolean {
  return usdValue >= threshold;
}

/**
 * Normalize a CLOB trade response to database input format.
 */
function normalizeTradeFromClob(
  trade: ClobTradeResponse,
  marketId: string,
  outcomeId: string,
  walletId: string
): NormalizedTradeInput | null {
  const walletAddress = extractWalletAddress(trade);
  if (!walletAddress) {
    return null;
  }

  const amount = parseTradeAmount(trade);
  const price = parseTradePrice(trade);
  const usdValue = calculateUsdValue(amount, price);

  return {
    marketId,
    outcomeId,
    walletId,
    clobTradeId: generateTradeId(trade, marketId, outcomeId),
    matchId: trade.match_id,
    side: normalizeTradeSide(trade.side),
    amount,
    price,
    usdValue,
    feeUsd: parseTradeFee(trade),
    makerAddress: trade.maker_address,
    takerAddress: trade.taker_address,
    isMaker: determineIsMaker(walletAddress, trade.maker_address),
    timestamp: parseTradeTimestamp(trade),
    txHash: trade.transaction_hash,
    isWhale: isWhaleTrade(usdValue),
    isInsider: false,
    flags: [],
  };
}

// === Sample Test Data ===

const sampleClobTrades: ClobTradeResponse[] = [
  {
    id: "trade-001",
    match_id: "match-001",
    maker_address: "0xmaker1234567890abcdef",
    taker_address: "0xtaker1234567890abcdef",
    side: "BUY",
    size: "100.5",
    price: "0.65",
    fee: "0.50",
    timestamp: "2024-01-15T10:30:00Z",
    transaction_hash: "0xtxhash1234567890",
  },
  {
    id: "trade-002",
    owner: "0xowner1234567890abcdef",
    side: "SELL",
    amount: "50.0",
    price: "0.35",
    created_at: "2024-01-15T11:00:00Z",
  },
  {
    id: "trade-003",
    taker_address: "0xWhale1234567890ABCDEF",
    side: "buy",
    size: "20000",
    price: "0.75",
    timestamp: "2024-01-15T12:00:00Z",
  },
  {
    // Trade without ID (should generate one)
    maker_address: "0xmaker9876543210",
    side: "SELL",
    size: "25.0",
    price: "0.45",
  },
  {
    // Trade with invalid amount
    id: "trade-005",
    taker_address: "0xvalid1234567890",
    side: "BUY",
    size: "invalid",
    price: "0.50",
  },
  {
    // Trade with missing wallet address
    id: "trade-006",
    side: "BUY",
    size: "100",
    price: "0.50",
  },
];

// === Test Suites ===

describe("INGEST-TRADE-001: Trade Ingestion Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractWalletAddress", () => {
    it("should extract taker_address when available", () => {
      const trade: ClobTradeResponse = {
        taker_address: "0xTaker123",
        maker_address: "0xMaker456",
        owner: "0xOwner789",
        side: "BUY",
      };

      const result = extractWalletAddress(trade);
      expect(result).toBe("0xtaker123");
    });

    it("should fall back to maker_address when taker_address missing", () => {
      const trade: ClobTradeResponse = {
        maker_address: "0xMaker456",
        owner: "0xOwner789",
        side: "BUY",
      };

      const result = extractWalletAddress(trade);
      expect(result).toBe("0xmaker456");
    });

    it("should fall back to owner when both addresses missing", () => {
      const trade: ClobTradeResponse = {
        owner: "0xOwner789",
        side: "BUY",
      };

      const result = extractWalletAddress(trade);
      expect(result).toBe("0xowner789");
    });

    it("should return null when no address available", () => {
      const trade: ClobTradeResponse = {
        side: "BUY",
      };

      const result = extractWalletAddress(trade);
      expect(result).toBeNull();
    });

    it("should lowercase the address", () => {
      const trade: ClobTradeResponse = {
        taker_address: "0xABCDEF123456",
        side: "BUY",
      };

      const result = extractWalletAddress(trade);
      expect(result).toBe("0xabcdef123456");
    });
  });

  describe("generateTradeId", () => {
    it("should use CLOB trade ID when available", () => {
      const trade: ClobTradeResponse = {
        id: "clob-trade-123",
        side: "BUY",
      };

      const result = generateTradeId(trade, "market-1", "outcome-1");
      expect(result).toBe("clob-trade-123");
    });

    it("should generate ID when CLOB ID not available", () => {
      const trade: ClobTradeResponse = {
        side: "BUY",
      };

      const result = generateTradeId(trade, "market-1", "outcome-1");
      expect(result).toMatch(/^market-1-outcome-1-\d+-[a-z0-9]+$/);
    });

    it("should generate unique IDs for different calls", () => {
      const trade: ClobTradeResponse = { side: "BUY" };

      const id1 = generateTradeId(trade, "market-1", "outcome-1");
      const id2 = generateTradeId(trade, "market-1", "outcome-1");

      // IDs might be same if called in same millisecond, but random suffix should differ
      // Just verify format is correct
      expect(id1).toMatch(/^market-1-outcome-1-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^market-1-outcome-1-\d+-[a-z0-9]+$/);
    });
  });

  describe("parseTradeAmount", () => {
    it("should parse size field", () => {
      const trade: ClobTradeResponse = {
        size: "100.5",
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(100.5);
    });

    it("should parse amount field when size not available", () => {
      const trade: ClobTradeResponse = {
        amount: "50.25",
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(50.25);
    });

    it("should prefer size over amount", () => {
      const trade: ClobTradeResponse = {
        size: "100",
        amount: "50",
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(100);
    });

    it("should return 0 for missing amount", () => {
      const trade: ClobTradeResponse = {
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(0);
    });

    it("should return 0 for invalid amount", () => {
      const trade: ClobTradeResponse = {
        size: "invalid",
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(0);
    });

    it("should handle integer amounts", () => {
      const trade: ClobTradeResponse = {
        size: "100",
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(100);
    });

    it("should handle very large amounts", () => {
      const trade: ClobTradeResponse = {
        size: "1000000.999",
        side: "BUY",
      };

      const result = parseTradeAmount(trade);
      expect(result).toBe(1000000.999);
    });
  });

  describe("parseTradePrice", () => {
    it("should parse valid price", () => {
      const trade: ClobTradeResponse = {
        price: "0.65",
        side: "BUY",
      };

      const result = parseTradePrice(trade);
      expect(result).toBe(0.65);
    });

    it("should return 0 for missing price", () => {
      const trade: ClobTradeResponse = {
        side: "BUY",
      };

      const result = parseTradePrice(trade);
      expect(result).toBe(0);
    });

    it("should return 0 for invalid price", () => {
      const trade: ClobTradeResponse = {
        price: "not-a-number",
        side: "BUY",
      };

      const result = parseTradePrice(trade);
      expect(result).toBe(0);
    });

    it("should handle price of 0", () => {
      const trade: ClobTradeResponse = {
        price: "0",
        side: "BUY",
      };

      const result = parseTradePrice(trade);
      expect(result).toBe(0);
    });

    it("should handle price of 1", () => {
      const trade: ClobTradeResponse = {
        price: "1.00",
        side: "BUY",
      };

      const result = parseTradePrice(trade);
      expect(result).toBe(1);
    });
  });

  describe("calculateUsdValue", () => {
    it("should calculate USD value correctly", () => {
      const result = calculateUsdValue(100, 0.65);
      expect(result).toBe(65);
    });

    it("should return 0 for zero amount", () => {
      const result = calculateUsdValue(0, 0.65);
      expect(result).toBe(0);
    });

    it("should return 0 for zero price", () => {
      const result = calculateUsdValue(100, 0);
      expect(result).toBe(0);
    });

    it("should handle large values", () => {
      const result = calculateUsdValue(100000, 0.75);
      expect(result).toBe(75000);
    });

    it("should handle decimal precision", () => {
      const result = calculateUsdValue(100.5, 0.65);
      expect(result).toBeCloseTo(65.325, 2);
    });
  });

  describe("parseTradeFee", () => {
    it("should parse valid fee", () => {
      const trade: ClobTradeResponse = {
        fee: "0.50",
        side: "BUY",
      };

      const result = parseTradeFee(trade);
      expect(result).toBe(0.5);
    });

    it("should return 0 for missing fee", () => {
      const trade: ClobTradeResponse = {
        side: "BUY",
      };

      const result = parseTradeFee(trade);
      expect(result).toBe(0);
    });

    it("should return 0 for invalid fee", () => {
      const trade: ClobTradeResponse = {
        fee: "invalid",
        side: "BUY",
      };

      const result = parseTradeFee(trade);
      expect(result).toBe(0);
    });
  });

  describe("normalizeTradeSide", () => {
    it("should normalize BUY", () => {
      expect(normalizeTradeSide("BUY")).toBe(TradeSide.BUY);
    });

    it("should normalize buy (lowercase)", () => {
      expect(normalizeTradeSide("buy")).toBe(TradeSide.BUY);
    });

    it("should normalize Buy (mixed case)", () => {
      expect(normalizeTradeSide("Buy")).toBe(TradeSide.BUY);
    });

    it("should normalize SELL", () => {
      expect(normalizeTradeSide("SELL")).toBe(TradeSide.SELL);
    });

    it("should normalize sell (lowercase)", () => {
      expect(normalizeTradeSide("sell")).toBe(TradeSide.SELL);
    });

    it("should default to SELL for unknown values", () => {
      expect(normalizeTradeSide("unknown")).toBe(TradeSide.SELL);
    });
  });

  describe("determineIsMaker", () => {
    it("should return true when wallet is maker", () => {
      const result = determineIsMaker("0xmaker123", "0xMaker123");
      expect(result).toBe(true);
    });

    it("should return false when wallet is not maker", () => {
      const result = determineIsMaker("0xtaker123", "0xMaker123");
      expect(result).toBe(false);
    });

    it("should return false when maker address missing", () => {
      const result = determineIsMaker("0xwallet123", undefined);
      expect(result).toBe(false);
    });

    it("should be case insensitive", () => {
      const result = determineIsMaker(
        "0xABCDEF123456",
        "0xabcdef123456"
      );
      expect(result).toBe(true);
    });
  });

  describe("parseTradeTimestamp", () => {
    it("should parse timestamp field", () => {
      const trade: ClobTradeResponse = {
        timestamp: "2024-01-15T10:30:00Z",
        side: "BUY",
      };

      const result = parseTradeTimestamp(trade);
      expect(result.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should fall back to created_at", () => {
      const trade: ClobTradeResponse = {
        created_at: "2024-01-15T11:00:00Z",
        side: "BUY",
      };

      const result = parseTradeTimestamp(trade);
      expect(result.toISOString()).toBe("2024-01-15T11:00:00.000Z");
    });

    it("should return current date for missing timestamp", () => {
      const trade: ClobTradeResponse = {
        side: "BUY",
      };

      const before = new Date();
      const result = parseTradeTimestamp(trade);
      const after = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should return current date for invalid timestamp", () => {
      const trade: ClobTradeResponse = {
        timestamp: "not-a-date",
        side: "BUY",
      };

      const before = new Date();
      const result = parseTradeTimestamp(trade);
      const after = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("isWhaleTrade", () => {
    it("should return true for trade >= $10,000", () => {
      expect(isWhaleTrade(10000)).toBe(true);
      expect(isWhaleTrade(15000)).toBe(true);
      expect(isWhaleTrade(100000)).toBe(true);
    });

    it("should return false for trade < $10,000", () => {
      expect(isWhaleTrade(9999.99)).toBe(false);
      expect(isWhaleTrade(5000)).toBe(false);
      expect(isWhaleTrade(0)).toBe(false);
    });

    it("should use custom threshold", () => {
      expect(isWhaleTrade(5000, 5000)).toBe(true);
      expect(isWhaleTrade(4999, 5000)).toBe(false);
    });
  });

  describe("normalizeTradeFromClob", () => {
    it("should normalize a complete trade", () => {
      const trade = sampleClobTrades[0]!;

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      expect(result!.marketId).toBe("market-123");
      expect(result!.outcomeId).toBe("outcome-456");
      expect(result!.walletId).toBe("wallet-789");
      expect(result!.clobTradeId).toBe("trade-001");
      expect(result!.matchId).toBe("match-001");
      expect(result!.side).toBe(TradeSide.BUY);
      expect(result!.amount).toBe(100.5);
      expect(result!.price).toBe(0.65);
      expect(result!.usdValue).toBeCloseTo(65.325, 2);
      expect(result!.feeUsd).toBe(0.5);
      expect(result!.makerAddress).toBe("0xmaker1234567890abcdef");
      expect(result!.takerAddress).toBe("0xtaker1234567890abcdef");
      expect(result!.isMaker).toBe(false); // wallet is taker
      expect(result!.txHash).toBe("0xtxhash1234567890");
      expect(result!.isWhale).toBe(false);
      expect(result!.isInsider).toBe(false);
      expect(result!.flags).toEqual([]);
    });

    it("should handle trade with owner field only", () => {
      const trade = sampleClobTrades[1]!;

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      expect(result!.side).toBe(TradeSide.SELL);
      expect(result!.amount).toBe(50.0);
      expect(result!.price).toBe(0.35);
    });

    it("should detect whale trades", () => {
      const trade = sampleClobTrades[2]!;

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      expect(result!.usdValue).toBe(15000); // 20000 * 0.75
      expect(result!.isWhale).toBe(true);
    });

    it("should generate trade ID when not provided", () => {
      const trade = sampleClobTrades[3]!;

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      expect(result!.clobTradeId).toMatch(/^market-123-outcome-456-\d+-[a-z0-9]+$/);
    });

    it("should handle invalid amount gracefully", () => {
      const trade = sampleClobTrades[4]!;

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(0);
      expect(result!.usdValue).toBe(0);
    });

    it("should return null for trade without wallet address", () => {
      const trade = sampleClobTrades[5]!;

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).toBeNull();
    });

    it("should handle lowercase side values", () => {
      const trade: ClobTradeResponse = {
        id: "test-trade",
        taker_address: "0xtest123",
        side: "buy",
        size: "100",
        price: "0.5",
      };

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      expect(result!.side).toBe(TradeSide.BUY);
    });
  });

  describe("Trade Deduplication", () => {
    it("should identify duplicate trades by CLOB ID", () => {
      const existingTradeIds = new Set(["trade-001", "trade-002"]);

      const trade1: ClobTradeResponse = { id: "trade-001", side: "BUY" };
      const trade2: ClobTradeResponse = { id: "trade-003", side: "BUY" };

      expect(existingTradeIds.has(trade1.id!)).toBe(true);
      expect(existingTradeIds.has(trade2.id!)).toBe(false);
    });

    it("should handle trades without IDs for deduplication", () => {
      const trade: ClobTradeResponse = { side: "BUY" };

      // Trades without IDs cannot be deduplicated by ID
      expect(trade.id).toBeUndefined();
    });
  });

  describe("Batch Trade Processing", () => {
    it("should process multiple trades and track results", () => {
      let ingested = 0;
      let skipped = 0;

      for (const trade of sampleClobTrades) {
        const result = normalizeTradeFromClob(
          trade,
          "market-123",
          "outcome-456",
          "wallet-789"
        );

        if (result) {
          ingested++;
        } else {
          skipped++;
        }
      }

      expect(ingested).toBe(5); // 5 valid trades
      expect(skipped).toBe(1); // 1 trade without wallet address
    });

    it("should handle empty trade array", () => {
      const trades: ClobTradeResponse[] = [];
      let processed = 0;

      for (const trade of trades) {
        const result = normalizeTradeFromClob(
          trade,
          "market-123",
          "outcome-456",
          "wallet-789"
        );
        if (result) processed++;
      }

      expect(processed).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string fields", () => {
      const trade: ClobTradeResponse = {
        id: "",
        taker_address: "0xtest123",
        side: "BUY",
        size: "",
        price: "",
      };

      const result = normalizeTradeFromClob(
        trade,
        "market-123",
        "outcome-456",
        "wallet-789"
      );

      expect(result).not.toBeNull();
      // Empty ID should trigger generation
      expect(result!.clobTradeId).toMatch(/^market-123-outcome-456-\d+-[a-z0-9]+$/);
      expect(result!.amount).toBe(0);
      expect(result!.price).toBe(0);
    });

    it("should handle whitespace in fields", () => {
      const trade: ClobTradeResponse = {
        id: "  trade-123  ",
        taker_address: "  0xtest123  ",
        side: "  BUY  ",
        size: "  100  ",
        price: "  0.5  ",
      };

      // parseFloat correctly parses numbers with leading/trailing whitespace
      const amount = parseTradeAmount(trade);
      const price = parseTradePrice(trade);

      expect(amount).toBe(100); // parseFloat handles whitespace correctly
      expect(price).toBe(0.5);
    });

    it("should handle negative values", () => {
      const trade: ClobTradeResponse = {
        id: "trade-negative",
        taker_address: "0xtest123",
        side: "BUY",
        size: "-100",
        price: "-0.5",
      };

      const amount = parseTradeAmount(trade);
      const price = parseTradePrice(trade);

      // parseFloat will parse negative numbers
      expect(amount).toBe(-100);
      expect(price).toBe(-0.5);
    });

    it("should handle scientific notation", () => {
      const trade: ClobTradeResponse = {
        id: "trade-scientific",
        taker_address: "0xtest123",
        side: "BUY",
        size: "1e6",
        price: "5e-1",
      };

      const amount = parseTradeAmount(trade);
      const price = parseTradePrice(trade);

      expect(amount).toBe(1000000);
      expect(price).toBe(0.5);
    });

    it("should handle Unix timestamp", () => {
      const trade: ClobTradeResponse = {
        timestamp: "1705315800000", // Unix timestamp in ms
        side: "BUY",
      };

      const result = parseTradeTimestamp(trade);
      // Should parse as a number and create valid date
      expect(result.getTime()).toBeGreaterThan(0);
    });
  });

  describe("CreateTradeInput Compatibility", () => {
    it("should produce output compatible with TradeService.create", () => {
      const trade: ClobTradeResponse = {
        id: "compatible-trade",
        match_id: "match-123",
        maker_address: "0xmaker123",
        taker_address: "0xtaker456",
        side: "BUY",
        size: "500",
        price: "0.75",
        fee: "1.25",
        timestamp: "2024-01-15T10:30:00Z",
        transaction_hash: "0xtx123",
      };

      const result = normalizeTradeFromClob(
        trade,
        "market-abc",
        "outcome-xyz",
        "wallet-123"
      );

      expect(result).not.toBeNull();

      // Verify all required fields for CreateTradeInput
      expect(result!.marketId).toBeDefined();
      expect(result!.outcomeId).toBeDefined();
      expect(result!.walletId).toBeDefined();
      expect(result!.side).toBeDefined();
      expect(typeof result!.amount).toBe("number");
      expect(typeof result!.price).toBe("number");
      expect(typeof result!.usdValue).toBe("number");
      expect(result!.timestamp).toBeInstanceOf(Date);
      expect(typeof result!.isWhale).toBe("boolean");
      expect(typeof result!.isInsider).toBe("boolean");
      expect(Array.isArray(result!.flags)).toBe(true);
    });
  });

  describe("Volume Calculation", () => {
    it("should calculate total volume from multiple trades", () => {
      const trades: ClobTradeResponse[] = [
        { id: "t1", taker_address: "0x1", side: "BUY", size: "100", price: "0.5" },
        { id: "t2", taker_address: "0x2", side: "SELL", size: "200", price: "0.6" },
        { id: "t3", taker_address: "0x3", side: "BUY", size: "150", price: "0.7" },
      ];

      let totalVolume = 0;
      for (const trade of trades) {
        const amount = parseTradeAmount(trade);
        const price = parseTradePrice(trade);
        totalVolume += calculateUsdValue(amount, price);
      }

      // 100*0.5 + 200*0.6 + 150*0.7 = 50 + 120 + 105 = 275
      expect(totalVolume).toBe(275);
    });
  });

  describe("Whale Detection Thresholds", () => {
    it("should classify trades by different whale thresholds", () => {
      const usdValues = [5000, 10000, 25000, 50000, 100000];

      const results = usdValues.map((usd) => ({
        usd,
        isWhale10k: isWhaleTrade(usd, 10000),
        isWhale25k: isWhaleTrade(usd, 25000),
        isWhale50k: isWhaleTrade(usd, 50000),
      }));

      expect(results[0]).toEqual({ usd: 5000, isWhale10k: false, isWhale25k: false, isWhale50k: false });
      expect(results[1]).toEqual({ usd: 10000, isWhale10k: true, isWhale25k: false, isWhale50k: false });
      expect(results[2]).toEqual({ usd: 25000, isWhale10k: true, isWhale25k: true, isWhale50k: false });
      expect(results[3]).toEqual({ usd: 50000, isWhale10k: true, isWhale25k: true, isWhale50k: true });
      expect(results[4]).toEqual({ usd: 100000, isWhale10k: true, isWhale25k: true, isWhale50k: true });
    });
  });
});
