/**
 * Market Database Service Tests
 *
 * Unit tests for the MarketService CRUD operations.
 * Uses mocked Prisma client to test service logic without database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Market, Outcome, PrismaClient } from "@prisma/client";
import {
  MarketService,
  createMarketService,
  type CreateMarketInput,
  type UpdateMarketInput,
  type MarketFilters,
  type MarketSortOptions,
  type PaginationOptions,
} from "../../src/db/markets";

// Mock market data
const mockMarket: Market = {
  id: "0x1234567890abcdef",
  slug: "will-bitcoin-reach-100k",
  question: "Will Bitcoin reach $100k by end of 2024?",
  description: "This market resolves to Yes if Bitcoin reaches $100,000",
  category: "crypto",
  subcategory: "bitcoin",
  tags: ["crypto", "bitcoin", "price"],
  imageUrl: "https://example.com/btc.png",
  iconUrl: "https://example.com/btc-icon.png",
  resolutionSource: "CoinGecko",
  resolvedBy: null,
  resolution: null,
  endDate: new Date("2024-12-31T23:59:59Z"),
  resolvedAt: null,
  active: true,
  closed: false,
  archived: false,
  volume: 1500000,
  volume24h: 50000,
  liquidity: 250000,
  tradeCount: 5000,
  uniqueTraders: 1200,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T12:00:00Z"),
};

const mockOutcome: Outcome = {
  id: "outcome-1",
  marketId: mockMarket.id,
  name: "Yes",
  clobTokenId: "token-yes-123",
  price: 0.65,
  probability: 65,
  priceChange24h: 2.5,
  volume: 800000,
  winner: null,
  payout: null,
  displayOrder: 0,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
};

const mockMarket2: Market = {
  id: "0xabcdef1234567890",
  slug: "will-eth-flip-btc",
  question: "Will ETH flip BTC market cap in 2024?",
  description: "This market resolves to Yes if ETH market cap exceeds BTC",
  category: "crypto",
  subcategory: "ethereum",
  tags: ["crypto", "ethereum", "bitcoin", "market-cap"],
  imageUrl: "https://example.com/eth.png",
  iconUrl: "https://example.com/eth-icon.png",
  resolutionSource: "CoinGecko",
  resolvedBy: null,
  resolution: null,
  endDate: new Date("2024-12-31T23:59:59Z"),
  resolvedAt: null,
  active: true,
  closed: false,
  archived: false,
  volume: 800000,
  volume24h: 25000,
  liquidity: 150000,
  tradeCount: 3000,
  uniqueTraders: 800,
  createdAt: new Date("2024-02-01T00:00:00Z"),
  updatedAt: new Date("2024-06-15T12:00:00Z"),
  lastSyncedAt: new Date("2024-06-15T11:00:00Z"),
};

/**
 * Create a mock Prisma client for testing
 */
function createMockPrismaClient() {
  return {
    market: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  } as unknown as PrismaClient;
}

describe("MarketService", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: MarketService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = createMarketService({ prisma: mockPrisma });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with provided prisma client", () => {
      const customPrisma = createMockPrismaClient();
      const customService = new MarketService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(MarketService);
    });

    it("should create service with createMarketService factory", () => {
      const customPrisma = createMockPrismaClient();
      const customService = createMarketService({ prisma: customPrisma });
      expect(customService).toBeInstanceOf(MarketService);
    });
  });

  describe("create", () => {
    it("should create a market with required fields", async () => {
      const input: CreateMarketInput = {
        id: mockMarket.id,
        slug: mockMarket.slug,
        question: mockMarket.question,
      };

      vi.mocked(mockPrisma.market.create).mockResolvedValue(mockMarket);

      const result = await service.create(input);

      expect(mockPrisma.market.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: input.id,
          slug: input.slug,
          question: input.question,
          active: true,
          closed: false,
          archived: false,
          volume: 0,
          volume24h: 0,
          liquidity: 0,
          tradeCount: 0,
          uniqueTraders: 0,
          tags: [],
        }),
      });
      expect(result).toEqual(mockMarket);
    });

    it("should create a market with all optional fields", async () => {
      const input: CreateMarketInput = {
        id: mockMarket.id,
        slug: mockMarket.slug,
        question: mockMarket.question,
        description: mockMarket.description ?? undefined,
        category: mockMarket.category ?? undefined,
        subcategory: mockMarket.subcategory ?? undefined,
        tags: mockMarket.tags,
        imageUrl: mockMarket.imageUrl ?? undefined,
        iconUrl: mockMarket.iconUrl ?? undefined,
        resolutionSource: mockMarket.resolutionSource ?? undefined,
        endDate: mockMarket.endDate ?? undefined,
        active: mockMarket.active,
        closed: mockMarket.closed,
        archived: mockMarket.archived,
        volume: mockMarket.volume,
        volume24h: mockMarket.volume24h,
        liquidity: mockMarket.liquidity,
        tradeCount: mockMarket.tradeCount,
        uniqueTraders: mockMarket.uniqueTraders,
      };

      vi.mocked(mockPrisma.market.create).mockResolvedValue(mockMarket);

      const result = await service.create(input);

      expect(mockPrisma.market.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: input.id,
          slug: input.slug,
          question: input.question,
          description: input.description,
          category: input.category,
          subcategory: input.subcategory,
          tags: input.tags,
          volume: input.volume,
        }),
      });
      expect(result).toEqual(mockMarket);
    });

    it("should use default values for boolean and numeric fields when not provided", async () => {
      const input: CreateMarketInput = {
        id: mockMarket.id,
        slug: mockMarket.slug,
        question: mockMarket.question,
      };

      vi.mocked(mockPrisma.market.create).mockResolvedValue(mockMarket);

      await service.create(input);

      expect(mockPrisma.market.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          active: true,
          closed: false,
          archived: false,
          volume: 0,
          volume24h: 0,
          liquidity: 0,
          tradeCount: 0,
          uniqueTraders: 0,
        }),
      });
    });
  });

  describe("createWithOutcomes", () => {
    it("should create a market with outcomes", async () => {
      const input: CreateMarketInput = {
        id: mockMarket.id,
        slug: mockMarket.slug,
        question: mockMarket.question,
      };
      const outcomes = [
        { name: "Yes", price: 0.65 },
        { name: "No", price: 0.35 },
      ];

      const marketWithOutcomes = {
        ...mockMarket,
        outcomes: [mockOutcome, { ...mockOutcome, id: "outcome-2", name: "No", price: 0.35 }],
      };

      vi.mocked(mockPrisma.market.create).mockResolvedValue(marketWithOutcomes);

      const result = await service.createWithOutcomes(input, outcomes);

      expect(mockPrisma.market.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: input.id,
          slug: input.slug,
          outcomes: {
            create: expect.arrayContaining([
              expect.objectContaining({ name: "Yes", price: 0.65, displayOrder: 0 }),
              expect.objectContaining({ name: "No", price: 0.35, displayOrder: 1 }),
            ]),
          },
        }),
        include: { outcomes: true },
      });
      expect(result.outcomes).toHaveLength(2);
    });

    it("should calculate probability from price when not provided", async () => {
      const input: CreateMarketInput = {
        id: mockMarket.id,
        slug: mockMarket.slug,
        question: mockMarket.question,
      };
      const outcomes = [{ name: "Yes", price: 0.75 }];

      vi.mocked(mockPrisma.market.create).mockResolvedValue({
        ...mockMarket,
        outcomes: [{ ...mockOutcome, probability: 75 }],
      } as unknown as Market);

      await service.createWithOutcomes(input, outcomes);

      expect(mockPrisma.market.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcomes: {
            create: expect.arrayContaining([
              expect.objectContaining({ price: 0.75, probability: 75 }),
            ]),
          },
        }),
        include: { outcomes: true },
      });
    });
  });

  describe("findById", () => {
    it("should find a market by ID", async () => {
      vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(mockMarket);

      const result = await service.findById(mockMarket.id);

      expect(mockPrisma.market.findUnique).toHaveBeenCalledWith({
        where: { id: mockMarket.id },
        include: undefined,
      });
      expect(result).toEqual(mockMarket);
    });

    it("should return null when market not found", async () => {
      vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(null);

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });

    it("should include outcomes when requested", async () => {
      const marketWithOutcomes = { ...mockMarket, outcomes: [mockOutcome] };
      vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(marketWithOutcomes);

      const result = await service.findById(mockMarket.id, true);

      expect(mockPrisma.market.findUnique).toHaveBeenCalledWith({
        where: { id: mockMarket.id },
        include: { outcomes: true },
      });
      expect(result).toEqual(marketWithOutcomes);
    });
  });

  describe("findBySlug", () => {
    it("should find a market by slug", async () => {
      vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(mockMarket);

      const result = await service.findBySlug(mockMarket.slug);

      expect(mockPrisma.market.findUnique).toHaveBeenCalledWith({
        where: { slug: mockMarket.slug },
        include: undefined,
      });
      expect(result).toEqual(mockMarket);
    });

    it("should return null when market not found by slug", async () => {
      vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(null);

      const result = await service.findBySlug("non-existent-slug");

      expect(result).toBeNull();
    });

    it("should include outcomes when requested", async () => {
      const marketWithOutcomes = { ...mockMarket, outcomes: [mockOutcome] };
      vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(marketWithOutcomes);

      const result = await service.findBySlug(mockMarket.slug, true);

      expect(mockPrisma.market.findUnique).toHaveBeenCalledWith({
        where: { slug: mockMarket.slug },
        include: { outcomes: true },
      });
      expect(result).toEqual(marketWithOutcomes);
    });
  });

  describe("findByIds", () => {
    it("should find multiple markets by IDs", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket, mockMarket2]);

      const result = await service.findByIds([mockMarket.id, mockMarket2.id]);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith({
        where: { id: { in: [mockMarket.id, mockMarket2.id] } },
        include: undefined,
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no markets found", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([]);

      const result = await service.findByIds(["non-existent"]);

      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update a market", async () => {
      const input: UpdateMarketInput = {
        volume: 2000000,
        active: false,
        closed: true,
      };

      const updatedMarket = { ...mockMarket, ...input };
      vi.mocked(mockPrisma.market.update).mockResolvedValue(updatedMarket);

      const result = await service.update(mockMarket.id, input);

      expect(mockPrisma.market.update).toHaveBeenCalledWith({
        where: { id: mockMarket.id },
        data: input,
      });
      expect(result.volume).toBe(2000000);
      expect(result.active).toBe(false);
      expect(result.closed).toBe(true);
    });

    it("should update a single field", async () => {
      const input: UpdateMarketInput = {
        volume: 3000000,
      };

      const updatedMarket = { ...mockMarket, volume: 3000000 };
      vi.mocked(mockPrisma.market.update).mockResolvedValue(updatedMarket);

      const result = await service.update(mockMarket.id, input);

      expect(result.volume).toBe(3000000);
    });

    it("should update nullable fields to null", async () => {
      const input: UpdateMarketInput = {
        description: null,
        category: null,
      };

      const updatedMarket = { ...mockMarket, description: null, category: null };
      vi.mocked(mockPrisma.market.update).mockResolvedValue(updatedMarket);

      const result = await service.update(mockMarket.id, input);

      expect(result.description).toBeNull();
      expect(result.category).toBeNull();
    });
  });

  describe("upsert", () => {
    it("should create a market if it does not exist", async () => {
      const input: CreateMarketInput = {
        id: "new-market-id",
        slug: "new-market-slug",
        question: "New market question?",
      };

      const newMarket = { ...mockMarket, ...input };
      vi.mocked(mockPrisma.market.upsert).mockResolvedValue(newMarket);

      const result = await service.upsert(input);

      expect(mockPrisma.market.upsert).toHaveBeenCalledWith({
        where: { id: input.id },
        create: expect.objectContaining({
          id: input.id,
          slug: input.slug,
          question: input.question,
        }),
        update: expect.objectContaining({
          slug: input.slug,
          question: input.question,
        }),
      });
      expect(result).toEqual(newMarket);
    });

    it("should update an existing market", async () => {
      const input: CreateMarketInput = {
        id: mockMarket.id,
        slug: mockMarket.slug,
        question: "Updated question?",
        volume: 5000000,
      };

      const updatedMarket = { ...mockMarket, ...input };
      vi.mocked(mockPrisma.market.upsert).mockResolvedValue(updatedMarket);

      const result = await service.upsert(input);

      expect(result.question).toBe("Updated question?");
      expect(result.volume).toBe(5000000);
    });
  });

  describe("delete", () => {
    it("should delete a market by ID", async () => {
      vi.mocked(mockPrisma.market.delete).mockResolvedValue(mockMarket);

      const result = await service.delete(mockMarket.id);

      expect(mockPrisma.market.delete).toHaveBeenCalledWith({
        where: { id: mockMarket.id },
      });
      expect(result).toEqual(mockMarket);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple markets by IDs", async () => {
      vi.mocked(mockPrisma.market.deleteMany).mockResolvedValue({ count: 2 });

      const result = await service.deleteMany([mockMarket.id, mockMarket2.id]);

      expect(mockPrisma.market.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [mockMarket.id, mockMarket2.id] } },
      });
      expect(result.count).toBe(2);
    });

    it("should return 0 when no markets deleted", async () => {
      vi.mocked(mockPrisma.market.deleteMany).mockResolvedValue({ count: 0 });

      const result = await service.deleteMany(["non-existent"]);

      expect(result.count).toBe(0);
    });
  });

  describe("findMany", () => {
    it("should find markets with no filters", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket, mockMarket2]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(2);

      const result = await service.findMany();

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { volume: "desc" },
        skip: 0,
        take: 100,
        include: undefined,
      });
      expect(result.markets).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should filter by active status", async () => {
      const filters: MarketFilters = { active: true };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true },
        })
      );
    });

    it("should filter by category", async () => {
      const filters: MarketFilters = { category: "crypto" };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket, mockMarket2]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(2);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: "crypto" },
        })
      );
    });

    it("should filter by tags", async () => {
      const filters: MarketFilters = { tags: ["bitcoin", "crypto"] };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tags: { hasSome: ["bitcoin", "crypto"] } },
        })
      );
    });

    it("should search by question text", async () => {
      const filters: MarketFilters = { search: "Bitcoin" };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { question: { contains: "Bitcoin", mode: "insensitive" } },
        })
      );
    });

    it("should filter by volume range", async () => {
      const filters: MarketFilters = { minVolume: 100000, maxVolume: 2000000 };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { volume: { gte: 100000, lte: 2000000 } },
        })
      );
    });

    it("should filter by end date range", async () => {
      const startDate = new Date("2024-06-01");
      const endDate = new Date("2024-12-31");
      const filters: MarketFilters = { endDateAfter: startDate, endDateBefore: endDate };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { endDate: { gte: startDate, lte: endDate } },
        })
      );
    });

    it("should filter by created date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-06-30");
      const filters: MarketFilters = { createdAfter: startDate, createdBefore: endDate };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdAt: { gte: startDate, lte: endDate } },
        })
      );
    });

    it("should sort by specified field and direction", async () => {
      const sort: MarketSortOptions = { field: "liquidity", direction: "asc" };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany({}, sort);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { liquidity: "asc" },
        })
      );
    });

    it("should handle pagination", async () => {
      const pagination: PaginationOptions = { skip: 10, take: 5 };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(100);

      const result = await service.findMany({}, undefined, pagination);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        })
      );
      expect(result.skip).toBe(10);
      expect(result.take).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it("should indicate no more results when at end", async () => {
      const pagination: PaginationOptions = { skip: 95, take: 5 };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(96);

      const result = await service.findMany({}, undefined, pagination);

      expect(result.hasMore).toBe(false);
    });

    it("should include outcomes when requested", async () => {
      const marketWithOutcomes = { ...mockMarket, outcomes: [mockOutcome] };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([marketWithOutcomes]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      const result = await service.findMany({}, undefined, {}, true);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { outcomes: true },
        })
      );
      expect(result.markets[0]).toHaveProperty("outcomes");
    });

    it("should combine multiple filters", async () => {
      const filters: MarketFilters = {
        active: true,
        closed: false,
        category: "crypto",
        minVolume: 100000,
      };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findMany(filters);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            active: true,
            closed: false,
            category: "crypto",
            volume: { gte: 100000 },
          },
        })
      );
    });
  });

  describe("findActive", () => {
    it("should find only active, non-closed markets", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findActive();

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true, closed: false },
        })
      );
    });

    it("should apply sort and pagination", async () => {
      const sort: MarketSortOptions = { field: "createdAt", direction: "desc" };
      const pagination: PaginationOptions = { take: 10 };
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findActive(sort, pagination);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      );
    });
  });

  describe("findByCategory", () => {
    it("should find markets by category", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket, mockMarket2]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(2);

      await service.findByCategory("crypto");

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: "crypto", active: true, closed: false },
        })
      );
    });

    it("should include inactive markets when requested", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.findByCategory("crypto", false);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: "crypto" },
        })
      );
    });
  });

  describe("search", () => {
    it("should search markets by question", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.search("Bitcoin");

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            question: { contains: "Bitcoin", mode: "insensitive" },
            active: true,
            closed: false,
          },
        })
      );
    });

    it("should search all markets when activeOnly is false", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.search("Bitcoin", false);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            question: { contains: "Bitcoin", mode: "insensitive" },
          },
        })
      );
    });
  });

  describe("getTrending", () => {
    it("should get trending markets sorted by volume", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket, mockMarket2]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(2);

      const result = await service.getTrending(10);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { volume: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(2);
    });

    it("should filter by category when provided", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.getTrending(5, "crypto");

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true, closed: false, category: "crypto" },
        })
      );
    });
  });

  describe("getRecent", () => {
    it("should get recently created markets", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket2, mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(2);

      const result = await service.getRecent(10);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      );
      expect(result).toHaveLength(2);
    });

    it("should include inactive markets when requested", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      await service.getRecent(10, false);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  describe("count", () => {
    it("should count markets with no filters", async () => {
      vi.mocked(mockPrisma.market.count).mockResolvedValue(100);

      const result = await service.count();

      expect(mockPrisma.market.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toBe(100);
    });

    it("should count markets with filters", async () => {
      vi.mocked(mockPrisma.market.count).mockResolvedValue(25);

      const result = await service.count({ category: "crypto", active: true });

      expect(mockPrisma.market.count).toHaveBeenCalledWith({
        where: { category: "crypto", active: true },
      });
      expect(result).toBe(25);
    });
  });

  describe("exists", () => {
    it("should return true when market exists", async () => {
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      const result = await service.exists(mockMarket.id);

      expect(mockPrisma.market.count).toHaveBeenCalledWith({
        where: { id: mockMarket.id },
      });
      expect(result).toBe(true);
    });

    it("should return false when market does not exist", async () => {
      vi.mocked(mockPrisma.market.count).mockResolvedValue(0);

      const result = await service.exists("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("existsBySlug", () => {
    it("should return true when market exists by slug", async () => {
      vi.mocked(mockPrisma.market.count).mockResolvedValue(1);

      const result = await service.existsBySlug(mockMarket.slug);

      expect(mockPrisma.market.count).toHaveBeenCalledWith({
        where: { slug: mockMarket.slug },
      });
      expect(result).toBe(true);
    });

    it("should return false when market does not exist by slug", async () => {
      vi.mocked(mockPrisma.market.count).mockResolvedValue(0);

      const result = await service.existsBySlug("non-existent-slug");

      expect(result).toBe(false);
    });
  });

  describe("createMany", () => {
    it("should create multiple markets", async () => {
      const markets: CreateMarketInput[] = [
        { id: "market-1", slug: "market-1", question: "Question 1?" },
        { id: "market-2", slug: "market-2", question: "Question 2?" },
      ];

      vi.mocked(mockPrisma.market.createMany).mockResolvedValue({ count: 2 });

      const result = await service.createMany(markets);

      expect(mockPrisma.market.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ id: "market-1", slug: "market-1" }),
          expect.objectContaining({ id: "market-2", slug: "market-2" }),
        ]),
        skipDuplicates: true,
      });
      expect(result.count).toBe(2);
    });

    it("should skip duplicates", async () => {
      vi.mocked(mockPrisma.market.createMany).mockResolvedValue({ count: 1 });

      const result = await service.createMany([
        { id: mockMarket.id, slug: mockMarket.slug, question: mockMarket.question },
      ]);

      expect(mockPrisma.market.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        })
      );
      expect(result.count).toBe(1);
    });
  });

  describe("markSynced", () => {
    it("should update last synced timestamp", async () => {
      const updatedMarket = { ...mockMarket, lastSyncedAt: new Date() };
      vi.mocked(mockPrisma.market.update).mockResolvedValue(updatedMarket);

      const result = await service.markSynced(mockMarket.id);

      expect(mockPrisma.market.update).toHaveBeenCalledWith({
        where: { id: mockMarket.id },
        data: { lastSyncedAt: expect.any(Date) },
      });
      expect(result.lastSyncedAt).not.toBeNull();
    });
  });

  describe("getNeedingSync", () => {
    it("should find markets that need syncing", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket2]);

      const maxAge = 60 * 60 * 1000; // 1 hour
      const result = await service.getNeedingSync(maxAge);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith({
        where: {
          active: true,
          closed: false,
          OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: expect.any(Date) } }],
        },
        orderBy: { lastSyncedAt: "asc" },
        take: 100,
      });
      expect(result).toHaveLength(1);
    });

    it("should respect limit parameter", async () => {
      vi.mocked(mockPrisma.market.findMany).mockResolvedValue([mockMarket]);

      await service.getNeedingSync(60 * 60 * 1000, 10);

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe("getStats", () => {
    it("should return aggregate statistics", async () => {
      vi.mocked(mockPrisma.market.aggregate).mockResolvedValue({
        _count: { id: 100 },
        _sum: { volume: 50000000, liquidity: 5000000 },
        _avg: { volume: 500000 },
        _min: {},
        _max: {},
      });

      const result = await service.getStats();

      expect(mockPrisma.market.aggregate).toHaveBeenCalledWith({
        where: {},
        _count: { id: true },
        _sum: { volume: true, liquidity: true },
        _avg: { volume: true },
      });
      expect(result.count).toBe(100);
      expect(result.totalVolume).toBe(50000000);
      expect(result.totalLiquidity).toBe(5000000);
      expect(result.avgVolume).toBe(500000);
    });

    it("should handle null aggregates", async () => {
      vi.mocked(mockPrisma.market.aggregate).mockResolvedValue({
        _count: { id: 0 },
        _sum: { volume: null, liquidity: null },
        _avg: { volume: null },
        _min: {},
        _max: {},
      });

      const result = await service.getStats();

      expect(result.count).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.totalLiquidity).toBe(0);
      expect(result.avgVolume).toBe(0);
    });

    it("should apply filters to aggregation", async () => {
      vi.mocked(mockPrisma.market.aggregate).mockResolvedValue({
        _count: { id: 25 },
        _sum: { volume: 10000000, liquidity: 1000000 },
        _avg: { volume: 400000 },
        _min: {},
        _max: {},
      });

      await service.getStats({ category: "crypto", active: true });

      expect(mockPrisma.market.aggregate).toHaveBeenCalledWith({
        where: { category: "crypto", active: true },
        _count: { id: true },
        _sum: { volume: true, liquidity: true },
        _avg: { volume: true },
      });
    });
  });
});

describe("MarketService edge cases", () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let service: MarketService;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = createMarketService({ prisma: mockPrisma });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle empty tags array", async () => {
    const filters: MarketFilters = { tags: [] };
    vi.mocked(mockPrisma.market.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.market.count).mockResolvedValue(0);

    await service.findMany(filters);

    // Empty tags should not add a filter
    expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it("should handle minimum volume only", async () => {
    const filters: MarketFilters = { minVolume: 1000 };
    vi.mocked(mockPrisma.market.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.market.count).mockResolvedValue(0);

    await service.findMany(filters);

    expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { volume: { gte: 1000 } },
      })
    );
  });

  it("should handle maximum volume only", async () => {
    const filters: MarketFilters = { maxVolume: 1000000 };
    vi.mocked(mockPrisma.market.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.market.count).mockResolvedValue(0);

    await service.findMany(filters);

    expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { volume: { lte: 1000000 } },
      })
    );
  });

  it("should handle all sort fields", async () => {
    const sortFields: Array<MarketSortOptions["field"]> = [
      "volume",
      "volume24h",
      "liquidity",
      "createdAt",
      "updatedAt",
      "endDate",
      "tradeCount",
    ];

    vi.mocked(mockPrisma.market.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.market.count).mockResolvedValue(0);

    for (const field of sortFields) {
      await service.findMany({}, { field, direction: "desc" });

      expect(mockPrisma.market.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { [field]: "desc" },
        })
      );
    }
  });
});
