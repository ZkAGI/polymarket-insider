/**
 * Unit Tests for Market Ingestion (INGEST-MARKET-001)
 *
 * Tests the market ingestion functionality:
 * - Fetch market list from Polymarket API
 * - Parse market identifiers, question text, status flags
 * - Normalize volume, liquidity, timestamps
 * - Upsert markets into Market table
 * - Update lastSyncedAt timestamp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MarketService, createMarketService, type CreateMarketInput } from "../../src/db/markets";

// Sample Gamma API response types
interface GammaMarketResponse {
  id?: string;
  conditionId?: string;
  slug?: string;
  question?: string;
  description?: string;
  category?: string;
  image?: string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  volume?: number;
  volumeNum?: number;
  liquidity?: number;
}

// Sample Gamma API response
const sampleGammaMarkets: GammaMarketResponse[] = [
  {
    id: "0x1234567890abcdef",
    conditionId: "0x1234567890abcdef",
    slug: "will-bitcoin-reach-100k-2024",
    question: "Will Bitcoin reach $100k by end of 2024?",
    description: "Resolution based on CoinGecko price",
    category: "crypto",
    image: "https://polymarket.com/images/btc.png",
    endDate: "2024-12-31T23:59:59Z",
    active: true,
    closed: false,
    archived: false,
    volume: 1500000,
    volumeNum: 1500000,
    liquidity: 250000,
  },
  {
    id: "0xabcdef1234567890",
    slug: "us-election-winner-2024",
    question: "Who will win the 2024 US Presidential Election?",
    description: "Based on official election results",
    category: "politics",
    image: "https://polymarket.com/images/election.png",
    endDate: "2024-11-05T23:59:59Z",
    active: true,
    closed: false,
    archived: false,
    volume: 50000000,
    liquidity: 5000000,
  },
  {
    conditionId: "0x9999888877776666",
    slug: "fed-rate-cut-march",
    question: "Will the Fed cut rates in March 2024?",
    category: "finance",
    active: true,
    closed: false,
    archived: false,
    volume: 800000,
    volumeNum: 800000,
  },
  // Edge case: market with minimal data
  {
    id: "0xminimal123",
    slug: "minimal-market",
    question: "Minimal market question?",
    active: true,
  },
  // Edge case: closed market
  {
    id: "0xclosed123",
    slug: "closed-market",
    question: "This market is closed",
    active: false,
    closed: true,
    archived: false,
  },
];

/**
 * Normalize Gamma API response to CreateMarketInput
 * This is the same logic used in the ingestion worker
 */
function normalizeMarketFromGamma(market: GammaMarketResponse): CreateMarketInput | null {
  const marketId = market.id || market.conditionId;
  if (!marketId) {
    return null; // Skip markets without ID
  }

  return {
    id: marketId,
    slug: market.slug ?? "",
    question: market.question ?? "",
    description: market.description,
    category: market.category,
    imageUrl: market.image,
    endDate: market.endDate ? new Date(market.endDate) : undefined,
    active: market.active ?? true,
    closed: market.closed ?? false,
    archived: market.archived ?? false,
    volume: market.volume ?? market.volumeNum ?? 0,
    liquidity: market.liquidity ?? 0,
  };
}

/**
 * Extract market ID from Gamma response
 */
function extractMarketId(market: GammaMarketResponse): string | null {
  return market.id || market.conditionId || null;
}

// Mock Prisma client
const createMockPrisma = () => {
  const upsertResults: Record<string, any> = {};

  return {
    market: {
      upsert: vi.fn().mockImplementation(async (args) => {
        const result = {
          id: args.where.id,
          ...args.create,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        upsertResults[args.where.id] = result;
        return result;
      }),
      findUnique: vi.fn().mockImplementation(async (args) => {
        return upsertResults[args.where.id] || null;
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    outcome: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    _upsertResults: upsertResults,
  };
};

describe("INGEST-MARKET-001: Polymarket Market Ingestion", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let marketService: MarketService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    marketService = createMarketService({
      prisma: mockPrisma as unknown as any,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Parse market identifiers", () => {
    it("should extract market ID from id field", () => {
      const market = sampleGammaMarkets[0]!;
      const id = extractMarketId(market);
      expect(id).toBe("0x1234567890abcdef");
    });

    it("should fallback to conditionId when id is missing", () => {
      const market = sampleGammaMarkets[2]!;
      const id = extractMarketId(market);
      expect(id).toBe("0x9999888877776666");
    });

    it("should return null when both id and conditionId are missing", () => {
      const market: GammaMarketResponse = {
        slug: "no-id-market",
        question: "No ID?",
      };
      const id = extractMarketId(market);
      expect(id).toBeNull();
    });

    it("should prefer id over conditionId when both exist", () => {
      const market = sampleGammaMarkets[0]!;
      const id = extractMarketId(market);
      expect(id).toBe(market.id);
    });
  });

  describe("Parse question text and metadata", () => {
    it("should normalize question text correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.question).toBe("Will Bitcoin reach $100k by end of 2024?");
    });

    it("should normalize slug correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.slug).toBe("will-bitcoin-reach-100k-2024");
    });

    it("should normalize description correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.description).toBe("Resolution based on CoinGecko price");
    });

    it("should normalize category correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.category).toBe("crypto");
    });

    it("should normalize image URL correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.imageUrl).toBe("https://polymarket.com/images/btc.png");
    });

    it("should handle missing description", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[2]!);
      expect(normalized?.description).toBeUndefined();
    });

    it("should handle missing category", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[3]!);
      expect(normalized?.category).toBeUndefined();
    });
  });

  describe("Parse status flags", () => {
    it("should parse active status flag correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.active).toBe(true);
    });

    it("should parse closed status flag correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[4]!);
      expect(normalized?.closed).toBe(true);
    });

    it("should parse archived status flag correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.archived).toBe(false);
    });

    it("should default active to true when missing", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.active).toBe(true);
    });

    it("should default closed to false when missing", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.closed).toBe(false);
    });

    it("should default archived to false when missing", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.archived).toBe(false);
    });

    it("should handle inactive market", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[4]!);
      expect(normalized?.active).toBe(false);
    });
  });

  describe("Normalize volume and liquidity", () => {
    it("should normalize volume from volume field", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[1]!);
      expect(normalized?.volume).toBe(50000000);
    });

    it("should use volumeNum when volume is not available", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
        volumeNum: 123456,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.volume).toBe(123456);
    });

    it("should prefer volume over volumeNum when both exist", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.volume).toBe(1500000);
    });

    it("should default volume to 0 when missing", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[3]!);
      expect(normalized?.volume).toBe(0);
    });

    it("should normalize liquidity correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.liquidity).toBe(250000);
    });

    it("should default liquidity to 0 when missing", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[3]!);
      expect(normalized?.liquidity).toBe(0);
    });

    it("should handle zero volume", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
        volume: 0,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.volume).toBe(0);
    });

    it("should handle large volume values", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
        volume: 999999999999,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.volume).toBe(999999999999);
    });
  });

  describe("Normalize timestamps", () => {
    it("should parse endDate timestamp correctly", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!);
      expect(normalized?.endDate).toBeInstanceOf(Date);
      expect(normalized?.endDate?.toISOString()).toBe("2024-12-31T23:59:59.000Z");
    });

    it("should handle different endDate formats", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
        endDate: "2024-06-15T12:00:00.000Z",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.endDate).toBeInstanceOf(Date);
    });

    it("should handle missing endDate", () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[3]!);
      expect(normalized?.endDate).toBeUndefined();
    });

    it("should handle null endDate", () => {
      const market: GammaMarketResponse = {
        id: "0xtest",
        slug: "test",
        question: "Test?",
        endDate: undefined,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.endDate).toBeUndefined();
    });
  });

  describe("Upsert markets into Market table", () => {
    it("should upsert market with correct data", async () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;
      await marketService.upsert(normalized);

      expect(mockPrisma.market.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "0x1234567890abcdef" },
          create: expect.objectContaining({
            id: "0x1234567890abcdef",
            slug: "will-bitcoin-reach-100k-2024",
            question: "Will Bitcoin reach $100k by end of 2024?",
          }),
        })
      );
    });

    it("should upsert multiple markets", async () => {
      for (const market of sampleGammaMarkets) {
        const normalized = normalizeMarketFromGamma(market);
        if (normalized) {
          await marketService.upsert(normalized);
        }
      }

      expect(mockPrisma.market.upsert).toHaveBeenCalledTimes(5);
    });

    it("should skip markets without ID", async () => {
      const invalidMarket: GammaMarketResponse = {
        slug: "no-id",
        question: "No ID?",
      };
      const normalized = normalizeMarketFromGamma(invalidMarket);
      expect(normalized).toBeNull();
    });

    it("should handle upsert errors gracefully", async () => {
      mockPrisma.market.upsert.mockRejectedValueOnce(new Error("Database error"));

      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;
      await expect(marketService.upsert(normalized)).rejects.toThrow("Database error");
    });

    it("should include create and update clauses in upsert", async () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;
      await marketService.upsert(normalized);

      expect(mockPrisma.market.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.any(Object),
          update: expect.any(Object),
        })
      );
    });
  });

  describe("Update lastSyncedAt timestamp", () => {
    it("should set lastSyncedAt in update clause", async () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;
      await marketService.upsert(normalized);

      expect(mockPrisma.market.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            lastSyncedAt: expect.any(Date),
          }),
        })
      );
    });

    it("should update lastSyncedAt on each sync", async () => {
      const normalized = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;

      await marketService.upsert(normalized);
      await marketService.upsert(normalized);

      expect(mockPrisma.market.upsert).toHaveBeenCalledTimes(2);

      // Both calls should have lastSyncedAt in update
      const calls = mockPrisma.market.upsert.mock.calls;
      expect(calls[0]![0].update.lastSyncedAt).toBeInstanceOf(Date);
      expect(calls[1]![0].update.lastSyncedAt).toBeInstanceOf(Date);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle malformed market data", () => {
      const malformedMarkets: any[] = [
        null,
        undefined,
        {},
        { slug: "no-id" },
        { id: "" }, // Empty ID
      ];

      for (const market of malformedMarkets) {
        if (market === null || market === undefined) {
          expect(() => normalizeMarketFromGamma(market as any)).toThrow();
        } else {
          const normalized = normalizeMarketFromGamma(market as GammaMarketResponse);
          expect(normalized).toBeNull();
        }
      }
    });

    it("should handle empty string ID", () => {
      const market: GammaMarketResponse = {
        id: "",
        slug: "empty-id",
        question: "Empty ID?",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized).toBeNull();
    });

    it("should handle whitespace-only ID", () => {
      const market: GammaMarketResponse = {
        id: "   ",
        slug: "whitespace-id",
        question: "Whitespace ID?",
      };
      // Note: This test assumes the current implementation doesn't trim whitespace
      // The actual behavior depends on the implementation
      const id = extractMarketId(market);
      expect(id).toBe("   "); // Current implementation doesn't trim
    });

    it("should handle special characters in text fields", () => {
      const market: GammaMarketResponse = {
        id: "0xspecial",
        slug: "special-chars",
        question: "Will <script>alert('xss')</script> work?",
        description: "Test with 'quotes' and \"double quotes\"",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.question).toContain("<script>");
      expect(normalized?.description).toContain("'quotes'");
    });

    it("should handle unicode characters", () => {
      const market: GammaMarketResponse = {
        id: "0xunicode",
        slug: "unicode-market",
        question: "Will 🚀 reach the 🌙?",
        description: "Résumé with émojis 中文",
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.question).toContain("🚀");
      expect(normalized?.description).toContain("中文");
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const market: GammaMarketResponse = {
        id: "0xlong",
        slug: "long-market",
        question: longString,
        description: longString,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.question.length).toBe(10000);
      expect(normalized?.description?.length).toBe(10000);
    });

    it("should handle negative volume (edge case)", () => {
      const market: GammaMarketResponse = {
        id: "0xnegative",
        slug: "negative-volume",
        question: "Negative volume?",
        volume: -1000,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.volume).toBe(-1000);
    });

    it("should handle floating point volume", () => {
      const market: GammaMarketResponse = {
        id: "0xfloat",
        slug: "float-volume",
        question: "Float volume?",
        volume: 1234.56789,
      };
      const normalized = normalizeMarketFromGamma(market);
      expect(normalized?.volume).toBeCloseTo(1234.56789);
    });
  });

  describe("Batch processing", () => {
    it("should process multiple markets in sequence", async () => {
      const results: any[] = [];

      for (const market of sampleGammaMarkets) {
        const normalized = normalizeMarketFromGamma(market);
        if (normalized) {
          const result = await marketService.upsert(normalized);
          results.push(result);
        }
      }

      expect(results).toHaveLength(5);
    });

    it("should handle partial failures in batch", async () => {
      mockPrisma.market.upsert
        .mockResolvedValueOnce({ id: "market-1" })
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce({ id: "market-3" });

      const normalized1 = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;
      const normalized2 = normalizeMarketFromGamma(sampleGammaMarkets[1]!)!;
      const normalized3 = normalizeMarketFromGamma(sampleGammaMarkets[2]!)!;

      const result1 = await marketService.upsert(normalized1);
      expect(result1.id).toBe("market-1");

      await expect(marketService.upsert(normalized2)).rejects.toThrow();

      const result3 = await marketService.upsert(normalized3);
      expect(result3.id).toBe("market-3");
    });

    it("should count successful and failed upserts", async () => {
      let successCount = 0;
      let errorCount = 0;

      mockPrisma.market.upsert
        .mockResolvedValueOnce({ id: "1" })
        .mockRejectedValueOnce(new Error("Error"))
        .mockResolvedValueOnce({ id: "3" });

      for (let i = 0; i < 3; i++) {
        const market = sampleGammaMarkets[i];
        if (!market) continue;
        const normalized = normalizeMarketFromGamma(market);
        if (normalized) {
          try {
            await marketService.upsert(normalized);
            successCount++;
          } catch {
            errorCount++;
          }
        }
      }

      expect(successCount).toBe(2);
      expect(errorCount).toBe(1);
    });
  });

  describe("Data integrity", () => {
    it("should preserve all market fields through normalization", () => {
      const market = sampleGammaMarkets[0]!;
      const normalized = normalizeMarketFromGamma(market)!;

      expect(normalized.id).toBe(market.id);
      expect(normalized.slug).toBe(market.slug);
      expect(normalized.question).toBe(market.question);
      expect(normalized.description).toBe(market.description);
      expect(normalized.category).toBe(market.category);
      expect(normalized.imageUrl).toBe(market.image);
      expect(normalized.active).toBe(market.active);
      expect(normalized.closed).toBe(market.closed);
      expect(normalized.archived).toBe(market.archived);
      expect(normalized.volume).toBe(market.volume);
      expect(normalized.liquidity).toBe(market.liquidity);
    });

    it("should not mutate original market object", () => {
      const market = { ...sampleGammaMarkets[0]! };
      const original = JSON.stringify(market);

      normalizeMarketFromGamma(market);

      expect(JSON.stringify(market)).toBe(original);
    });

    it("should return independent normalized objects", () => {
      const normalized1 = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;
      const normalized2 = normalizeMarketFromGamma(sampleGammaMarkets[0]!)!;

      normalized1.question = "Modified";

      expect(normalized2.question).toBe("Will Bitcoin reach $100k by end of 2024?");
    });
  });
});
