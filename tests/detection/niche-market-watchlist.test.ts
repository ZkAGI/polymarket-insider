/**
 * Tests for Niche Market Watchlist Manager (DET-NICHE-007)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MarketCategory } from "../../src/api/gamma/types";
import {
  InformationAdvantageTier,
} from "../../src/detection/information-advantage-identifier";
import {
  LiquidityCategory,
  MarketLiquidityScore,
} from "../../src/detection/market-liquidity-scorer";
import {
  NicheMarketWatchlist,
  WatchlistPriority,
  WatchlistReason,
  WatchlistStatus,
  WatchlistEventType,
  WatchlistMarketData,
  WatchlistEvent,
  createNicheMarketWatchlist,
  getSharedNicheMarketWatchlist,
  setSharedNicheMarketWatchlist,
  resetSharedNicheMarketWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isOnWatchlist,
  getWatchlistEntry,
  getActiveWatchlistEntries,
  getTopPriorityWatchlistEntries,
  getWatchlistSummary,
  getWatchlistStatistics,
} from "../../src/detection/niche-market-watchlist";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockMarket(
  id: string,
  question: string,
  category: MarketCategory = MarketCategory.POLITICS,
  overrides: Partial<WatchlistMarketData> = {}
): WatchlistMarketData {
  return {
    marketId: id,
    question,
    category,
    slug: `market-${id}`,
    volume24hUsd: 10000,
    ...overrides,
  };
}

function createMockLiquidityScore(
  marketId: string,
  overrides: Partial<MarketLiquidityScore> = {}
): MarketLiquidityScore {
  return {
    marketId,
    liquidityScore: 30,
    category: LiquidityCategory.THIN,
    isThinMarket: true,
    thinMarketSeverity: null,
    confidence: "MEDIUM" as any,
    confidenceScore: 60,
    componentScores: {
      orderBookDepth: 25,
      tradeVolume: 30,
      spread: 40,
      participation: 25,
    },
    orderBookData: null,
    tradeVolumeStats: null,
    insiderAdvantageMultiplier: 2.0,
    estimatedPriceImpact1k: 2.5,
    estimatedPriceImpact10k: 25,
    scoredAt: new Date(),
    fromCache: false,
    ...overrides,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe("NicheMarketWatchlist", () => {
  let watchlist: NicheMarketWatchlist;

  beforeEach(() => {
    watchlist = new NicheMarketWatchlist();
    resetSharedNicheMarketWatchlist();
  });

  afterEach(() => {
    watchlist.clear();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe("constructor", () => {
    it("should create instance with default config", () => {
      const wl = new NicheMarketWatchlist();
      const config = wl.getConfig();

      expect(config.maxWatchlistSize).toBe(1000);
      expect(config.defaultPriority).toBe(WatchlistPriority.MEDIUM);
      expect(config.autoCalculatePriority).toBe(true);
      expect(config.debug).toBe(false);
    });

    it("should create instance with custom config", () => {
      const wl = new NicheMarketWatchlist({
        maxWatchlistSize: 500,
        defaultPriority: WatchlistPriority.HIGH,
        autoCalculatePriority: false,
        debug: true,
      });
      const config = wl.getConfig();

      expect(config.maxWatchlistSize).toBe(500);
      expect(config.defaultPriority).toBe(WatchlistPriority.HIGH);
      expect(config.autoCalculatePriority).toBe(false);
      expect(config.debug).toBe(true);
    });

    it("should allow custom priority weights", () => {
      const wl = new NicheMarketWatchlist({
        priorityWeights: {
          informationAdvantage: 0.5,
          liquidityRisk: 0.25,
        },
      });
      const config = wl.getConfig();

      expect(config.priorityWeights.informationAdvantage).toBe(0.5);
      expect(config.priorityWeights.liquidityRisk).toBe(0.25);
      // Defaults for non-specified
      expect(config.priorityWeights.categoryImportance).toBe(0.20);
    });
  });

  // ==========================================================================
  // Adding Markets
  // ==========================================================================

  describe("addMarket", () => {
    it("should add a market to the watchlist", () => {
      const market = createMockMarket("mkt-1", "Will X happen?");
      const entry = watchlist.addMarket(market);

      expect(entry.market.marketId).toBe("mkt-1");
      expect(entry.market.question).toBe("Will X happen?");
      expect(entry.status).toBe(WatchlistStatus.ACTIVE);
      expect(watchlist.getCount()).toBe(1);
    });

    it("should auto-calculate priority based on market data", () => {
      const market = createMockMarket(
        "mkt-1",
        "Will the FDA approve drug X?",
        MarketCategory.HEALTH,
        {
          informationAdvantageScore: 85,
          isThinMarket: true,
          insiderAdvantageMultiplier: 2.5,
        }
      );
      const entry = watchlist.addMarket(market, {
        reasons: [
          WatchlistReason.HIGH_INFORMATION_ADVANTAGE,
          WatchlistReason.THIN_LIQUIDITY,
        ],
      });

      expect(entry.priorityScore).toBeGreaterThan(50);
      expect([WatchlistPriority.HIGH, WatchlistPriority.CRITICAL]).toContain(
        entry.priority
      );
    });

    it("should use provided priority when specified", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        priority: WatchlistPriority.CRITICAL,
      });

      expect(entry.priority).toBe(WatchlistPriority.CRITICAL);
      expect(entry.priorityScore).toBe(90);
    });

    it("should apply liquidity score data when provided", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const liquidityScore = createMockLiquidityScore("mkt-1");

      const entry = watchlist.addMarket(market, { liquidityScore });

      expect(entry.market.liquidityScore).toBe(30);
      expect(entry.market.liquidityCategory).toBe(LiquidityCategory.THIN);
      expect(entry.market.isThinMarket).toBe(true);
      expect(entry.market.insiderAdvantageMultiplier).toBe(2.0);
    });

    it("should apply information advantage data when provided", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        informationAdvantageScore: 75,
        informationAdvantageTier: InformationAdvantageTier.HIGH,
      });

      expect(entry.market.informationAdvantageScore).toBe(75);
      expect(entry.market.informationAdvantageTier).toBe(
        InformationAdvantageTier.HIGH
      );
    });

    it("should throw error when adding duplicate market", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      expect(() => watchlist.addMarket(market)).toThrow(
        "Market mkt-1 is already on the watchlist"
      );
    });

    it("should throw error when watchlist is full", () => {
      const wl = new NicheMarketWatchlist({ maxWatchlistSize: 2 });
      wl.addMarket(createMockMarket("mkt-1", "Market 1"));
      wl.addMarket(createMockMarket("mkt-2", "Market 2"));

      expect(() =>
        wl.addMarket(createMockMarket("mkt-3", "Market 3"))
      ).toThrow("Watchlist size limit (2) reached");
    });

    it("should set default reason when none provided", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market);

      expect(entry.reasons).toContain(WatchlistReason.MANUAL_ADDITION);
    });

    it("should use provided reasons", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        reasons: [
          WatchlistReason.POLITICAL_EVENT,
          WatchlistReason.THIN_LIQUIDITY,
        ],
      });

      expect(entry.reasons).toHaveLength(2);
      expect(entry.reasons).toContain(WatchlistReason.POLITICAL_EVENT);
      expect(entry.reasons).toContain(WatchlistReason.THIN_LIQUIDITY);
    });

    it("should set custom status when provided", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        status: WatchlistStatus.PENDING_REVIEW,
      });

      expect(entry.status).toBe(WatchlistStatus.PENDING_REVIEW);
    });

    it("should set notes when provided", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        notes: ["Important market", "Monitor closely"],
      });

      expect(entry.notes).toHaveLength(2);
      expect(entry.notes).toContain("Important market");
    });

    it("should set metadata when provided", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        metadata: { source: "auto-detection", score: 85 },
      });

      expect(entry.metadata.source).toBe("auto-detection");
      expect(entry.metadata.score).toBe(85);
    });

    it("should set addedBy field", () => {
      const market = createMockMarket("mkt-1", "Test market");
      const entry = watchlist.addMarket(market, {
        addedBy: "detection-system",
      });

      expect(entry.addedBy).toBe("detection-system");
    });

    it("should generate unique entry ID", () => {
      const market1 = createMockMarket("mkt-1", "Market 1");
      const market2 = createMockMarket("mkt-2", "Market 2");

      const entry1 = watchlist.addMarket(market1);
      const entry2 = watchlist.addMarket(market2);

      expect(entry1.entryId).not.toBe(entry2.entryId);
      expect(entry1.entryId).toMatch(/^wl_\d+_[a-z0-9]+$/);
    });
  });

  // ==========================================================================
  // Removing Markets
  // ==========================================================================

  describe("removeMarket", () => {
    it("should remove a market from the watchlist", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const removed = watchlist.removeMarket("mkt-1");

      expect(removed).toBe(true);
      expect(watchlist.getCount()).toBe(0);
      expect(watchlist.hasMarket("mkt-1")).toBe(false);
    });

    it("should return false for non-existent market", () => {
      const removed = watchlist.removeMarket("non-existent");
      expect(removed).toBe(false);
    });

    it("should emit removal event", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const events: WatchlistEvent[] = [];
      watchlist.on("MARKET_REMOVED", (event) => events.push(event));

      watchlist.removeMarket("mkt-1");

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(WatchlistEventType.MARKET_REMOVED);
      expect(events[0]!.marketId).toBe("mkt-1");
    });
  });

  // ==========================================================================
  // Updating Entries
  // ==========================================================================

  describe("updateEntry", () => {
    it("should update priority", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const updated = watchlist.updateEntry("mkt-1", {
        priority: WatchlistPriority.CRITICAL,
      });

      expect(updated?.priority).toBe(WatchlistPriority.CRITICAL);
      expect(updated?.priorityScore).toBe(90);
    });

    it("should update status", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const updated = watchlist.updateEntry("mkt-1", {
        status: WatchlistStatus.PAUSED,
      });

      expect(updated?.status).toBe(WatchlistStatus.PAUSED);
    });

    it("should add reasons", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const updated = watchlist.updateEntry("mkt-1", {
        addReasons: [WatchlistReason.UNUSUAL_ACTIVITY],
      });

      expect(updated?.reasons).toContain(WatchlistReason.UNUSUAL_ACTIVITY);
    });

    it("should remove reasons", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market, {
        reasons: [WatchlistReason.POLITICAL_EVENT, WatchlistReason.THIN_LIQUIDITY],
      });

      const updated = watchlist.updateEntry("mkt-1", {
        removeReasons: [WatchlistReason.THIN_LIQUIDITY],
      });

      expect(updated?.reasons).not.toContain(WatchlistReason.THIN_LIQUIDITY);
      expect(updated?.reasons).toContain(WatchlistReason.POLITICAL_EVENT);
    });

    it("should add notes", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const updated = watchlist.updateEntry("mkt-1", {
        addNotes: ["New observation"],
      });

      expect(updated?.notes).toContain("New observation");
    });

    it("should merge metadata", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market, { metadata: { key1: "value1" } });

      const updated = watchlist.updateEntry("mkt-1", {
        metadata: { key2: "value2" },
      });

      expect(updated?.metadata.key1).toBe("value1");
      expect(updated?.metadata.key2).toBe("value2");
    });

    it("should update market data", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const updated = watchlist.updateEntry("mkt-1", {
        marketData: { volume24hUsd: 50000 },
      });

      expect(updated?.market.volume24hUsd).toBe(50000);
    });

    it("should return null for non-existent market", () => {
      const updated = watchlist.updateEntry("non-existent", {
        priority: WatchlistPriority.HIGH,
      });
      expect(updated).toBeNull();
    });

    it("should emit priority changed event", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const events: WatchlistEvent[] = [];
      watchlist.on("PRIORITY_CHANGED", (event) => events.push(event));

      watchlist.updateEntry("mkt-1", { priority: WatchlistPriority.HIGH });

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(WatchlistEventType.PRIORITY_CHANGED);
    });

    it("should emit status changed event", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const events: WatchlistEvent[] = [];
      watchlist.on("STATUS_CHANGED", (event) => events.push(event));

      watchlist.updateEntry("mkt-1", { status: WatchlistStatus.PAUSED });

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(WatchlistEventType.STATUS_CHANGED);
    });

    it("should recalculate priority when reasons change", () => {
      const wl = new NicheMarketWatchlist({ autoCalculatePriority: true });
      const market = createMockMarket("mkt-1", "Test market", MarketCategory.POLITICS);
      wl.addMarket(market);

      const initialScore = wl.getEntry("mkt-1")?.priorityScore;

      wl.updateEntry("mkt-1", {
        addReasons: [
          WatchlistReason.HIGH_INFORMATION_ADVANTAGE,
          WatchlistReason.REGULATORY_DECISION,
        ],
      });

      const newScore = wl.getEntry("mkt-1")?.priorityScore;
      expect(newScore).toBeGreaterThan(initialScore || 0);
    });
  });

  // ==========================================================================
  // Status Operations
  // ==========================================================================

  describe("status operations", () => {
    it("should archive a market", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const result = watchlist.archiveMarket("mkt-1");

      expect(result).toBe(true);
      expect(watchlist.getEntry("mkt-1")?.status).toBe(WatchlistStatus.ARCHIVED);
    });

    it("should pause a market", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const result = watchlist.pauseMarket("mkt-1");

      expect(result).toBe(true);
      expect(watchlist.getEntry("mkt-1")?.status).toBe(WatchlistStatus.PAUSED);
    });

    it("should resume a market", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market, { status: WatchlistStatus.PAUSED });

      const result = watchlist.resumeMarket("mkt-1");

      expect(result).toBe(true);
      expect(watchlist.getEntry("mkt-1")?.status).toBe(WatchlistStatus.ACTIVE);
    });
  });

  // ==========================================================================
  // Alert Recording
  // ==========================================================================

  describe("recordAlert", () => {
    it("should record an alert", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      const result = watchlist.recordAlert("mkt-1");
      const entry = watchlist.getEntry("mkt-1");

      expect(result).toBe(true);
      expect(entry?.alertCount).toBe(1);
      expect(entry?.lastAlertAt).toBeDefined();
    });

    it("should increment alert count on multiple alerts", () => {
      const market = createMockMarket("mkt-1", "Test market");
      watchlist.addMarket(market);

      watchlist.recordAlert("mkt-1");
      watchlist.recordAlert("mkt-1");
      watchlist.recordAlert("mkt-1");

      expect(watchlist.getEntry("mkt-1")?.alertCount).toBe(3);
    });

    it("should return false for non-existent market", () => {
      const result = watchlist.recordAlert("non-existent");
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  describe("query methods", () => {
    beforeEach(() => {
      // Add various markets
      watchlist.addMarket(
        createMockMarket("mkt-1", "Political market", MarketCategory.POLITICS),
        {
          priority: WatchlistPriority.CRITICAL,
          reasons: [WatchlistReason.POLITICAL_EVENT],
        }
      );
      watchlist.addMarket(
        createMockMarket("mkt-2", "Tech market", MarketCategory.TECH),
        {
          priority: WatchlistPriority.HIGH,
          reasons: [WatchlistReason.THIN_LIQUIDITY],
        }
      );
      watchlist.addMarket(
        createMockMarket("mkt-3", "Sports market", MarketCategory.SPORTS),
        {
          priority: WatchlistPriority.LOW,
          status: WatchlistStatus.PAUSED,
        }
      );
      watchlist.addMarket(
        createMockMarket("mkt-4", "Crypto market", MarketCategory.CRYPTO),
        {
          priority: WatchlistPriority.MEDIUM,
          status: WatchlistStatus.ARCHIVED,
        }
      );
    });

    describe("getEntry", () => {
      it("should return entry by market ID", () => {
        const entry = watchlist.getEntry("mkt-1");
        expect(entry?.market.marketId).toBe("mkt-1");
      });

      it("should return null for non-existent market", () => {
        expect(watchlist.getEntry("non-existent")).toBeNull();
      });
    });

    describe("getEntryById", () => {
      it("should return entry by entry ID", () => {
        const entry = watchlist.getEntry("mkt-1");
        const fetched = watchlist.getEntryById(entry!.entryId);
        expect(fetched?.market.marketId).toBe("mkt-1");
      });
    });

    describe("hasMarket", () => {
      it("should return true for existing market", () => {
        expect(watchlist.hasMarket("mkt-1")).toBe(true);
      });

      it("should return false for non-existent market", () => {
        expect(watchlist.hasMarket("non-existent")).toBe(false);
      });
    });

    describe("getEntries", () => {
      it("should return all entries by default", () => {
        const entries = watchlist.getEntries();
        expect(entries).toHaveLength(4);
      });

      it("should filter by priority", () => {
        const entries = watchlist.getEntries({
          priorities: [WatchlistPriority.CRITICAL, WatchlistPriority.HIGH],
        });
        expect(entries).toHaveLength(2);
      });

      it("should filter by status", () => {
        const entries = watchlist.getEntries({
          statuses: [WatchlistStatus.ACTIVE],
        });
        expect(entries).toHaveLength(2); // mkt-1, mkt-2
      });

      it("should filter by reasons", () => {
        const entries = watchlist.getEntries({
          reasons: [WatchlistReason.THIN_LIQUIDITY],
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]!.market.marketId).toBe("mkt-2");
      });

      it("should filter by category", () => {
        const entries = watchlist.getEntries({
          categories: [MarketCategory.POLITICS],
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]!.market.marketId).toBe("mkt-1");
      });

      it("should filter by minimum priority score", () => {
        const entries = watchlist.getEntries({
          minPriorityScore: 70,
        });
        expect(entries.every((e) => e.priorityScore >= 70)).toBe(true);
      });

      it("should filter by search text", () => {
        const entries = watchlist.getEntries({
          searchText: "political",
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]!.market.marketId).toBe("mkt-1");
      });

      it("should sort by priority score descending", () => {
        const entries = watchlist.getEntries({
          sortBy: "priorityScore",
          sortOrder: "desc",
        });
        expect(entries[0]!.priority).toBe(WatchlistPriority.CRITICAL);
      });

      it("should sort by addedAt ascending", () => {
        const entries = watchlist.getEntries({
          sortBy: "addedAt",
          sortOrder: "asc",
        });
        expect(entries[0]!.market.marketId).toBe("mkt-1");
      });

      it("should apply limit and offset", () => {
        const entries = watchlist.getEntries({
          limit: 2,
          offset: 1,
        });
        expect(entries).toHaveLength(2);
      });

      it("should combine multiple filters", () => {
        const entries = watchlist.getEntries({
          statuses: [WatchlistStatus.ACTIVE],
          priorities: [WatchlistPriority.CRITICAL, WatchlistPriority.HIGH],
        });
        expect(entries).toHaveLength(2);
      });
    });

    describe("getEntriesByPriority", () => {
      it("should return entries with specific priority", () => {
        const entries = watchlist.getEntriesByPriority(WatchlistPriority.CRITICAL);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.market.marketId).toBe("mkt-1");
      });
    });

    describe("getActiveEntries", () => {
      it("should return only active entries", () => {
        const entries = watchlist.getActiveEntries();
        expect(entries).toHaveLength(2);
        expect(entries.every((e) => e.status === WatchlistStatus.ACTIVE)).toBe(true);
      });
    });

    describe("getTopPriorityEntries", () => {
      it("should return top priority entries", () => {
        const entries = watchlist.getTopPriorityEntries(2);
        expect(entries).toHaveLength(2);
        expect(entries[0]!.priority).toBe(WatchlistPriority.CRITICAL);
      });

      it("should only include active entries", () => {
        const entries = watchlist.getTopPriorityEntries(10);
        expect(entries.every((e) => e.status === WatchlistStatus.ACTIVE)).toBe(true);
      });
    });

    describe("getEntriesByCategory", () => {
      it("should return entries by category", () => {
        const entries = watchlist.getEntriesByCategory(MarketCategory.TECH);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.market.marketId).toBe("mkt-2");
      });
    });

    describe("getEntriesByReason", () => {
      it("should return entries by reason", () => {
        const entries = watchlist.getEntriesByReason(WatchlistReason.POLITICAL_EVENT);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.market.marketId).toBe("mkt-1");
      });
    });

    describe("getMarketIds", () => {
      it("should return all market IDs", () => {
        const ids = watchlist.getMarketIds();
        expect(ids).toHaveLength(4);
        expect(ids).toContain("mkt-1");
        expect(ids).toContain("mkt-2");
      });
    });

    describe("getCount", () => {
      it("should return total entry count", () => {
        expect(watchlist.getCount()).toBe(4);
      });
    });
  });

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  describe("bulk operations", () => {
    describe("addMarkets", () => {
      it("should add multiple markets", () => {
        const results = watchlist.addMarkets([
          { market: createMockMarket("mkt-1", "Market 1") },
          { market: createMockMarket("mkt-2", "Market 2") },
          { market: createMockMarket("mkt-3", "Market 3") },
        ]);

        expect(results.filter((r) => r.entry)).toHaveLength(3);
        expect(watchlist.getCount()).toBe(3);
      });

      it("should handle partial failures", () => {
        watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));

        const results = watchlist.addMarkets([
          { market: createMockMarket("mkt-1", "Duplicate") },
          { market: createMockMarket("mkt-2", "Market 2") },
        ]);

        expect(results.filter((r) => r.entry)).toHaveLength(1);
        expect(results.filter((r) => r.error)).toHaveLength(1);
      });

      it("should apply options to each market", () => {
        const results = watchlist.addMarkets([
          {
            market: createMockMarket("mkt-1", "Market 1"),
            options: { priority: WatchlistPriority.HIGH },
          },
          {
            market: createMockMarket("mkt-2", "Market 2"),
            options: { priority: WatchlistPriority.LOW },
          },
        ]);

        expect(results[0]!.entry?.priority).toBe(WatchlistPriority.HIGH);
        expect(results[1]!.entry?.priority).toBe(WatchlistPriority.LOW);
      });
    });

    describe("removeMarkets", () => {
      it("should remove multiple markets", () => {
        watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));
        watchlist.addMarket(createMockMarket("mkt-2", "Market 2"));
        watchlist.addMarket(createMockMarket("mkt-3", "Market 3"));

        const removed = watchlist.removeMarkets(["mkt-1", "mkt-3"]);

        expect(removed).toBe(2);
        expect(watchlist.getCount()).toBe(1);
        expect(watchlist.hasMarket("mkt-2")).toBe(true);
      });

      it("should handle non-existent markets", () => {
        watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));

        const removed = watchlist.removeMarkets(["mkt-1", "non-existent"]);

        expect(removed).toBe(1);
      });
    });

    describe("reprioritizeAll", () => {
      it("should recalculate all priorities", () => {
        // Create a watchlist with auto-calculate disabled so updateEntry won't recalculate
        const wl = new NicheMarketWatchlist({ autoCalculatePriority: false });
        const market = createMockMarket("mkt-1", "Market 1", MarketCategory.POLITICS);
        wl.addMarket(market, { priority: WatchlistPriority.LOW });

        // Update market data that would affect priority (but won't auto-recalculate)
        wl.updateEntry("mkt-1", {
          marketData: {
            informationAdvantageScore: 90,
            isThinMarket: true,
          },
        });

        // Verify still LOW before reprioritize
        expect(wl.getEntry("mkt-1")?.priority).toBe(WatchlistPriority.LOW);

        // Reprioritize - now it should recalculate based on the new data
        const updated = wl.reprioritizeAll();

        expect(updated).toBeGreaterThan(0);
        // Should have higher priority now due to high information advantage score
        expect(wl.getEntry("mkt-1")?.priority).not.toBe(WatchlistPriority.LOW);
      });
    });

    describe("clear", () => {
      it("should clear all entries", () => {
        watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));
        watchlist.addMarket(createMockMarket("mkt-2", "Market 2"));

        const cleared = watchlist.clear();

        expect(cleared).toBe(2);
        expect(watchlist.getCount()).toBe(0);
      });

      it("should emit cleared event", () => {
        watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));

        const events: WatchlistEvent[] = [];
        watchlist.on("WATCHLIST_CLEARED", (event) => events.push(event));

        watchlist.clear();

        expect(events).toHaveLength(1);
        expect(events[0]!.type).toBe(WatchlistEventType.WATCHLIST_CLEARED);
      });
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe("statistics", () => {
    beforeEach(() => {
      watchlist.addMarket(
        createMockMarket("mkt-1", "Market 1", MarketCategory.POLITICS),
        {
          priority: WatchlistPriority.CRITICAL,
          reasons: [WatchlistReason.POLITICAL_EVENT],
        }
      );
      watchlist.addMarket(
        createMockMarket("mkt-2", "Market 2", MarketCategory.TECH),
        {
          priority: WatchlistPriority.HIGH,
          status: WatchlistStatus.PAUSED,
          reasons: [WatchlistReason.THIN_LIQUIDITY],
        }
      );
      watchlist.recordAlert("mkt-1");
      watchlist.recordAlert("mkt-1");
    });

    describe("getStatistics", () => {
      it("should return correct total entries", () => {
        const stats = watchlist.getStatistics();
        expect(stats.totalEntries).toBe(2);
      });

      it("should return correct status counts", () => {
        const stats = watchlist.getStatistics();
        expect(stats.activeEntries).toBe(1);
        expect(stats.pausedEntries).toBe(1);
        expect(stats.archivedEntries).toBe(0);
      });

      it("should return correct priority distribution", () => {
        const stats = watchlist.getStatistics();
        expect(stats.byPriority[WatchlistPriority.CRITICAL]).toBe(1);
        expect(stats.byPriority[WatchlistPriority.HIGH]).toBe(1);
      });

      it("should return correct category distribution", () => {
        const stats = watchlist.getStatistics();
        expect(stats.byCategory[MarketCategory.POLITICS]).toBe(1);
        expect(stats.byCategory[MarketCategory.TECH]).toBe(1);
      });

      it("should return correct reason distribution", () => {
        const stats = watchlist.getStatistics();
        expect(stats.byReason[WatchlistReason.POLITICAL_EVENT]).toBe(1);
        expect(stats.byReason[WatchlistReason.THIN_LIQUIDITY]).toBe(1);
      });

      it("should return correct total alerts", () => {
        const stats = watchlist.getStatistics();
        expect(stats.totalAlerts).toBe(2);
      });

      it("should calculate average priority score", () => {
        const stats = watchlist.getStatistics();
        expect(stats.averagePriorityScore).toBeGreaterThan(0);
      });
    });

    describe("getSummary", () => {
      it("should return complete summary", () => {
        const summary = watchlist.getSummary();

        expect(summary.statistics).toBeDefined();
        expect(summary.topPriorityMarkets).toBeDefined();
        expect(summary.recentlyAdded).toBeDefined();
        expect(summary.recentAlerts).toBeDefined();
        expect(summary.generatedAt).toBeInstanceOf(Date);
      });

      it("should include top priority markets", () => {
        const summary = watchlist.getSummary();
        expect(summary.topPriorityMarkets.length).toBeGreaterThan(0);
      });

      it("should include markets with alerts", () => {
        const summary = watchlist.getSummary();
        const hasAlerts = summary.recentAlerts.some(
          (e) => e.market.marketId === "mkt-1"
        );
        expect(hasAlerts).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Events
  // ==========================================================================

  describe("events", () => {
    it("should emit watchlistUpdate for all events", () => {
      const events: WatchlistEvent[] = [];
      watchlist.on("watchlistUpdate", (event) => events.push(event));

      watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));
      watchlist.updateEntry("mkt-1", { priority: WatchlistPriority.HIGH });
      watchlist.removeMarket("mkt-1");

      expect(events.length).toBeGreaterThanOrEqual(3);
    });

    it("should emit MARKET_ADDED event", () => {
      const events: WatchlistEvent[] = [];
      watchlist.on("MARKET_ADDED", (event) => events.push(event));

      watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe(WatchlistEventType.MARKET_ADDED);
    });

    it("should include previous state in events", () => {
      const market = createMockMarket("mkt-1", "Market 1");
      watchlist.addMarket(market, { priority: WatchlistPriority.LOW });

      const events: WatchlistEvent[] = [];
      watchlist.on("PRIORITY_CHANGED", (event) => events.push(event));

      watchlist.updateEntry("mkt-1", { priority: WatchlistPriority.HIGH });

      expect(events[0]!.previousState?.priority).toBe(WatchlistPriority.LOW);
      expect(events[0]!.newState?.priority).toBe(WatchlistPriority.HIGH);
    });

    it("should track event history", () => {
      watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));
      watchlist.updateEntry("mkt-1", { priority: WatchlistPriority.HIGH });

      const events = watchlist.getRecentEvents(10);
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it("should get events for specific market", () => {
      watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));
      watchlist.addMarket(createMockMarket("mkt-2", "Market 2"));
      watchlist.updateEntry("mkt-1", { priority: WatchlistPriority.HIGH });

      const mkt1Events = watchlist.getMarketEvents("mkt-1");
      expect(
        mkt1Events.every((e) => e.marketId === "mkt-1" || !e.marketId)
      ).toBe(true);
    });

    it("should limit event history size", () => {
      const wl = new NicheMarketWatchlist({ maxEventHistory: 5 });

      for (let i = 0; i < 10; i++) {
        wl.addMarket(createMockMarket(`mkt-${i}`, `Market ${i}`));
      }

      const events = wl.getRecentEvents(100);
      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  // ==========================================================================
  // Priority Calculation
  // ==========================================================================

  describe("priority calculation", () => {
    it("should give higher priority to political markets", () => {
      const political = createMockMarket(
        "mkt-1",
        "Political",
        MarketCategory.POLITICS
      );
      const sports = createMockMarket("mkt-2", "Sports", MarketCategory.SPORTS);

      const entry1 = watchlist.addMarket(political);
      const entry2 = watchlist.addMarket(sports);

      expect(entry1.priorityScore).toBeGreaterThan(entry2.priorityScore);
    });

    it("should give higher priority to thin markets", () => {
      const thin = createMockMarket("mkt-1", "Thin", MarketCategory.TECH, {
        isThinMarket: true,
        liquidityScore: 20,
      });
      const liquid = createMockMarket("mkt-2", "Liquid", MarketCategory.TECH, {
        isThinMarket: false,
        liquidityScore: 80,
      });

      const entry1 = watchlist.addMarket(thin, {
        reasons: [WatchlistReason.THIN_LIQUIDITY],
      });
      const entry2 = watchlist.addMarket(liquid);

      expect(entry1.priorityScore).toBeGreaterThan(entry2.priorityScore);
    });

    it("should give higher priority to high information advantage", () => {
      const highInfo = createMockMarket("mkt-1", "High Info", MarketCategory.LEGAL, {
        informationAdvantageScore: 90,
      });
      const lowInfo = createMockMarket("mkt-2", "Low Info", MarketCategory.LEGAL, {
        informationAdvantageScore: 20,
      });

      const entry1 = watchlist.addMarket(highInfo, {
        reasons: [WatchlistReason.HIGH_INFORMATION_ADVANTAGE],
      });
      const entry2 = watchlist.addMarket(lowInfo);

      expect(entry1.priorityScore).toBeGreaterThan(entry2.priorityScore);
    });

    it("should boost priority for time-sensitive reasons", () => {
      const timeSensitive = createMockMarket(
        "mkt-1",
        "Time Sensitive",
        MarketCategory.BUSINESS
      );
      const normal = createMockMarket(
        "mkt-2",
        "Normal",
        MarketCategory.BUSINESS
      );

      const entry1 = watchlist.addMarket(timeSensitive, {
        reasons: [WatchlistReason.APPROACHING_EXPIRY],
      });
      const entry2 = watchlist.addMarket(normal);

      expect(entry1.priorityScore).toBeGreaterThan(entry2.priorityScore);
    });

    it("should boost priority for multiple high-importance reasons", () => {
      const multiReason = createMockMarket(
        "mkt-1",
        "Multi",
        MarketCategory.POLITICS
      );
      const singleReason = createMockMarket(
        "mkt-2",
        "Single",
        MarketCategory.POLITICS
      );

      const entry1 = watchlist.addMarket(multiReason, {
        reasons: [
          WatchlistReason.HIGH_INFORMATION_ADVANTAGE,
          WatchlistReason.REGULATORY_DECISION,
          WatchlistReason.THIN_LIQUIDITY,
        ],
      });
      const entry2 = watchlist.addMarket(singleReason, {
        reasons: [WatchlistReason.MANUAL_ADDITION],
      });

      expect(entry1.priorityScore).toBeGreaterThan(entry2.priorityScore);
    });
  });
});

// ============================================================================
// Factory Functions Tests
// ============================================================================

describe("createNicheMarketWatchlist", () => {
  it("should create a new instance", () => {
    const wl = createNicheMarketWatchlist();
    expect(wl).toBeInstanceOf(NicheMarketWatchlist);
  });

  it("should accept config", () => {
    const wl = createNicheMarketWatchlist({ maxWatchlistSize: 100 });
    expect(wl.getConfig().maxWatchlistSize).toBe(100);
  });
});

// ============================================================================
// Shared Instance Tests
// ============================================================================

describe("shared instance", () => {
  beforeEach(() => {
    resetSharedNicheMarketWatchlist();
  });

  afterEach(() => {
    resetSharedNicheMarketWatchlist();
  });

  it("should return same instance on multiple calls", () => {
    const wl1 = getSharedNicheMarketWatchlist();
    const wl2 = getSharedNicheMarketWatchlist();
    expect(wl1).toBe(wl2);
  });

  it("should allow setting custom instance", () => {
    const custom = new NicheMarketWatchlist({ maxWatchlistSize: 50 });
    setSharedNicheMarketWatchlist(custom);

    expect(getSharedNicheMarketWatchlist().getConfig().maxWatchlistSize).toBe(50);
  });

  it("should reset instance", () => {
    const wl1 = getSharedNicheMarketWatchlist();
    wl1.addMarket(createMockMarket("mkt-1", "Market 1"));

    resetSharedNicheMarketWatchlist();

    const wl2 = getSharedNicheMarketWatchlist();
    expect(wl2.getCount()).toBe(0);
  });
});

// ============================================================================
// Convenience Functions Tests
// ============================================================================

describe("convenience functions", () => {
  beforeEach(() => {
    resetSharedNicheMarketWatchlist();
  });

  afterEach(() => {
    resetSharedNicheMarketWatchlist();
  });

  describe("addToWatchlist", () => {
    it("should add to shared watchlist", () => {
      const entry = addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      expect(entry.market.marketId).toBe("mkt-1");
      expect(getSharedNicheMarketWatchlist().getCount()).toBe(1);
    });
  });

  describe("removeFromWatchlist", () => {
    it("should remove from shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      const removed = removeFromWatchlist("mkt-1");
      expect(removed).toBe(true);
      expect(getSharedNicheMarketWatchlist().getCount()).toBe(0);
    });
  });

  describe("isOnWatchlist", () => {
    it("should check shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      expect(isOnWatchlist("mkt-1")).toBe(true);
      expect(isOnWatchlist("mkt-2")).toBe(false);
    });
  });

  describe("getWatchlistEntry", () => {
    it("should get entry from shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      const entry = getWatchlistEntry("mkt-1");
      expect(entry?.market.marketId).toBe("mkt-1");
    });
  });

  describe("getActiveWatchlistEntries", () => {
    it("should get active entries from shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      addToWatchlist(createMockMarket("mkt-2", "Market 2"), {
        status: WatchlistStatus.PAUSED,
      });

      const active = getActiveWatchlistEntries();
      expect(active).toHaveLength(1);
    });
  });

  describe("getTopPriorityWatchlistEntries", () => {
    it("should get top priority from shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"), {
        priority: WatchlistPriority.CRITICAL,
      });
      addToWatchlist(createMockMarket("mkt-2", "Market 2"), {
        priority: WatchlistPriority.LOW,
      });

      const top = getTopPriorityWatchlistEntries(1);
      expect(top).toHaveLength(1);
      expect(top[0]!.priority).toBe(WatchlistPriority.CRITICAL);
    });
  });

  describe("getWatchlistSummary", () => {
    it("should get summary from shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      const summary = getWatchlistSummary();
      expect(summary.statistics.totalEntries).toBe(1);
    });
  });

  describe("getWatchlistStatistics", () => {
    it("should get statistics from shared watchlist", () => {
      addToWatchlist(createMockMarket("mkt-1", "Market 1"));
      const stats = getWatchlistStatistics();
      expect(stats.totalEntries).toBe(1);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
  let watchlist: NicheMarketWatchlist;

  beforeEach(() => {
    watchlist = new NicheMarketWatchlist();
  });

  afterEach(() => {
    watchlist.clear();
  });

  it("should handle empty watchlist statistics", () => {
    const stats = watchlist.getStatistics();
    expect(stats.totalEntries).toBe(0);
    expect(stats.averagePriorityScore).toBe(0);
  });

  it("should handle empty filters", () => {
    watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));
    const entries = watchlist.getEntries({});
    expect(entries).toHaveLength(1);
  });

  it("should handle invalid market ID gracefully", () => {
    expect(watchlist.getEntry("")).toBeNull();
    expect(watchlist.removeMarket("")).toBe(false);
    expect(watchlist.updateEntry("", {})).toBeNull();
  });

  it("should handle special characters in market data", () => {
    const market = createMockMarket(
      "mkt-special-!@#$%",
      "Will 'foo' & \"bar\" happen? <test>"
    );
    const entry = watchlist.addMarket(market);
    expect(entry.market.question).toBe("Will 'foo' & \"bar\" happen? <test>");
  });

  it("should handle very long market questions", () => {
    const longQuestion = "A".repeat(10000);
    const market = createMockMarket("mkt-1", longQuestion);
    const entry = watchlist.addMarket(market);
    expect(entry.market.question.length).toBe(10000);
  });

  it("should handle date filtering with edge dates", () => {
    watchlist.addMarket(createMockMarket("mkt-1", "Market 1"));

    const futureDate = new Date(Date.now() + 86400000);
    const pastDate = new Date(Date.now() - 86400000);

    const entriesAfterFuture = watchlist.getEntries({ addedAfter: futureDate });
    const entriesBeforePast = watchlist.getEntries({ addedBefore: pastDate });

    expect(entriesAfterFuture).toHaveLength(0);
    expect(entriesBeforePast).toHaveLength(0);
  });

  it("should handle concurrent modifications", async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        Promise.resolve().then(() => {
          try {
            watchlist.addMarket(createMockMarket(`mkt-${i}`, `Market ${i}`));
          } catch {
            // Ignore duplicates
          }
        })
      );
    }

    await Promise.all(promises);
    expect(watchlist.getCount()).toBe(100);
  });

  it("should maintain data integrity after many operations", () => {
    // Add markets
    for (let i = 0; i < 50; i++) {
      watchlist.addMarket(createMockMarket(`mkt-${i}`, `Market ${i}`));
    }

    // Update some
    for (let i = 0; i < 25; i++) {
      watchlist.updateEntry(`mkt-${i}`, {
        priority: WatchlistPriority.HIGH,
      });
    }

    // Remove some
    for (let i = 25; i < 35; i++) {
      watchlist.removeMarket(`mkt-${i}`);
    }

    // Verify state
    expect(watchlist.getCount()).toBe(40);
    const high = watchlist.getEntriesByPriority(WatchlistPriority.HIGH);
    expect(high).toHaveLength(25);
  });

  it("should handle uptime calculation", () => {
    expect(watchlist.getUptimeMs()).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Type Coverage Tests
// ============================================================================

describe("type coverage", () => {
  it("should have all WatchlistPriority values", () => {
    expect(WatchlistPriority.CRITICAL).toBeDefined();
    expect(WatchlistPriority.HIGH).toBeDefined();
    expect(WatchlistPriority.MEDIUM).toBeDefined();
    expect(WatchlistPriority.LOW).toBeDefined();
    expect(WatchlistPriority.MINIMAL).toBeDefined();
  });

  it("should have all WatchlistReason values", () => {
    expect(WatchlistReason.HIGH_INFORMATION_ADVANTAGE).toBeDefined();
    expect(WatchlistReason.THIN_LIQUIDITY).toBeDefined();
    expect(WatchlistReason.REGULATORY_DECISION).toBeDefined();
    expect(WatchlistReason.POLITICAL_EVENT).toBeDefined();
    expect(WatchlistReason.GEOPOLITICAL_EVENT).toBeDefined();
    expect(WatchlistReason.UNUSUAL_ACTIVITY).toBeDefined();
    expect(WatchlistReason.MANUAL_ADDITION).toBeDefined();
    expect(WatchlistReason.APPROACHING_EXPIRY).toBeDefined();
    expect(WatchlistReason.PRE_EVENT_MONITORING).toBeDefined();
    expect(WatchlistReason.RELATED_MARKET).toBeDefined();
  });

  it("should have all WatchlistStatus values", () => {
    expect(WatchlistStatus.ACTIVE).toBeDefined();
    expect(WatchlistStatus.PAUSED).toBeDefined();
    expect(WatchlistStatus.ARCHIVED).toBeDefined();
    expect(WatchlistStatus.PENDING_REVIEW).toBeDefined();
  });

  it("should have all WatchlistEventType values", () => {
    expect(WatchlistEventType.MARKET_ADDED).toBeDefined();
    expect(WatchlistEventType.MARKET_REMOVED).toBeDefined();
    expect(WatchlistEventType.PRIORITY_CHANGED).toBeDefined();
    expect(WatchlistEventType.STATUS_CHANGED).toBeDefined();
    expect(WatchlistEventType.METADATA_UPDATED).toBeDefined();
    expect(WatchlistEventType.BULK_UPDATE).toBeDefined();
    expect(WatchlistEventType.WATCHLIST_CLEARED).toBeDefined();
  });
});
