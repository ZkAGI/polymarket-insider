/**
 * Tests for Database Indexing Optimization Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IndexService,
  createIndexService,
  INDEX_CATALOG,
  QUERY_PATTERNS,
  type IndexServiceConfig,
} from "../../src/db/indexes";

// Mock Prisma client
const mockPrismaClient = {
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
};

// Mock logger
const mockLogger = vi.fn();

describe("IndexService", () => {
  let service: IndexService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createIndexService({
      prisma: mockPrismaClient as unknown as IndexServiceConfig["prisma"],
      logger: mockLogger,
    });
  });

  describe("constructor", () => {
    it("should create service with default configuration", () => {
      const defaultService = new IndexService();
      expect(defaultService).toBeDefined();
    });

    it("should create service with custom configuration", () => {
      const customService = createIndexService({
        prisma: mockPrismaClient as unknown as IndexServiceConfig["prisma"],
        logger: mockLogger,
      });
      expect(customService).toBeDefined();
    });
  });

  describe("INDEX_CATALOG", () => {
    it("should have indexes defined", () => {
      expect(INDEX_CATALOG.length).toBeGreaterThan(0);
    });

    it("should have valid index definitions", () => {
      for (const index of INDEX_CATALOG) {
        expect(index.id).toBeTruthy();
        expect(index.table).toBeTruthy();
        expect(index.indexName).toBeTruthy();
        expect(index.columns.length).toBeGreaterThan(0);
        expect(typeof index.isUnique).toBe("boolean");
        expect(index.type).toBeTruthy();
        expect(index.description).toBeTruthy();
        expect(index.queryPatterns.length).toBeGreaterThan(0);
        expect(typeof index.isComposite).toBe("boolean");
        expect(index.priority).toBeGreaterThan(0);
        expect(["small", "medium", "large"]).toContain(index.sizeCategory);
      }
    });

    it("should have indexes for all main tables", () => {
      const tables = new Set(INDEX_CATALOG.map(idx => idx.table));
      const expectedTables = [
        "Market",
        "Outcome",
        "Wallet",
        "Trade",
        "PriceHistory",
        "MarketSnapshot",
        "WalletSnapshot",
        "Alert",
        "SyncLog",
        "JobQueue",
        "WalletFundingSource",
        "WalletCluster",
        "WalletClusterMember",
      ];

      for (const table of expectedTables) {
        expect(tables.has(table)).toBe(true);
      }
    });

    it("should have composite indexes marked correctly", () => {
      for (const index of INDEX_CATALOG) {
        if (index.columns.length > 1) {
          expect(index.isComposite).toBe(true);
        } else {
          expect(index.isComposite).toBe(false);
        }
      }
    });

    it("should have priority 1 indexes for critical lookups", () => {
      const criticalIndexes = INDEX_CATALOG.filter(idx => idx.priority === 1);
      expect(criticalIndexes.length).toBeGreaterThan(10);
    });
  });

  describe("QUERY_PATTERNS", () => {
    it("should have query patterns defined", () => {
      expect(QUERY_PATTERNS.length).toBeGreaterThan(0);
    });

    it("should have valid query pattern definitions", () => {
      for (const pattern of QUERY_PATTERNS) {
        expect(pattern.id).toBeTruthy();
        expect(pattern.description).toBeTruthy();
        expect(pattern.tables.length).toBeGreaterThan(0);
        expect(pattern.frequency).toBeTruthy();
        expect(pattern.sampleQuery).toBeTruthy();
        expect(pattern.idealIndexes.length).toBeGreaterThan(0);
      }
    });

    it("should have very_high frequency patterns for critical operations", () => {
      const veryHighPatterns = QUERY_PATTERNS.filter(
        qp => qp.frequency === "very_high"
      );
      expect(veryHighPatterns.length).toBeGreaterThan(0);
    });

    it("should reference valid index IDs in idealIndexes", () => {
      const indexIds = new Set(INDEX_CATALOG.map(idx => idx.id));

      for (const pattern of QUERY_PATTERNS) {
        for (const indexId of pattern.idealIndexes) {
          expect(indexIds.has(indexId)).toBe(true);
        }
      }
    });
  });

  describe("getAllIndexes", () => {
    it("should return all indexes", () => {
      const indexes = service.getAllIndexes();
      expect(indexes).toHaveLength(INDEX_CATALOG.length);
    });

    it("should return a copy of the catalog", () => {
      const indexes1 = service.getAllIndexes();
      const indexes2 = service.getAllIndexes();
      expect(indexes1).not.toBe(indexes2);
    });
  });

  describe("getIndexesForTable", () => {
    it("should return indexes for a specific table", () => {
      const marketIndexes = service.getIndexesForTable("Market");
      expect(marketIndexes.length).toBeGreaterThan(0);
      for (const idx of marketIndexes) {
        expect(idx.table).toBe("Market");
      }
    });

    it("should return empty array for unknown table", () => {
      const indexes = service.getIndexesForTable("NonExistentTable");
      expect(indexes).toHaveLength(0);
    });

    it("should include both single and composite indexes", () => {
      const tradeIndexes = service.getIndexesForTable("Trade");
      const hasSingle = tradeIndexes.some(idx => !idx.isComposite);
      const hasComposite = tradeIndexes.some(idx => idx.isComposite);
      expect(hasSingle).toBe(true);
      expect(hasComposite).toBe(true);
    });
  });

  describe("getCompositeIndexes", () => {
    it("should return only composite indexes", () => {
      const compositeIndexes = service.getCompositeIndexes();
      expect(compositeIndexes.length).toBeGreaterThan(0);
      for (const idx of compositeIndexes) {
        expect(idx.isComposite).toBe(true);
        expect(idx.columns.length).toBeGreaterThan(1);
      }
    });
  });

  describe("getIndexesByPriority", () => {
    it("should return indexes with specified priority", () => {
      const priority1Indexes = service.getIndexesByPriority(1);
      expect(priority1Indexes.length).toBeGreaterThan(0);
      for (const idx of priority1Indexes) {
        expect(idx.priority).toBe(1);
      }
    });

    it("should return empty array for non-existent priority", () => {
      const indexes = service.getIndexesByPriority(999);
      expect(indexes).toHaveLength(0);
    });
  });

  describe("getIndexesForQueryPattern", () => {
    it("should return indexes supporting a query pattern", () => {
      // Get the first index and use one of its query patterns
      const firstIndex = INDEX_CATALOG[0]!;
      const indexes = service.getIndexesForQueryPattern(firstIndex.queryPatterns[0]!);
      expect(indexes.length).toBeGreaterThan(0);
    });

    it("should return empty array for unknown pattern", () => {
      const indexes = service.getIndexesForQueryPattern("nonExistentPattern");
      expect(indexes).toHaveLength(0);
    });
  });

  describe("getIndexById", () => {
    it("should return index by ID", () => {
      const firstIndex = INDEX_CATALOG[0]!;
      const found = service.getIndexById(firstIndex.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(firstIndex.id);
    });

    it("should return undefined for unknown ID", () => {
      const found = service.getIndexById("nonExistentId");
      expect(found).toBeUndefined();
    });
  });

  describe("getAllQueryPatterns", () => {
    it("should return all query patterns", () => {
      const patterns = service.getAllQueryPatterns();
      expect(patterns).toHaveLength(QUERY_PATTERNS.length);
    });

    it("should return a copy of patterns", () => {
      const patterns1 = service.getAllQueryPatterns();
      const patterns2 = service.getAllQueryPatterns();
      expect(patterns1).not.toBe(patterns2);
    });
  });

  describe("getQueryPatternById", () => {
    it("should return pattern by ID", () => {
      const firstPattern = QUERY_PATTERNS[0]!;
      const found = service.getQueryPatternById(firstPattern.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(firstPattern.id);
    });

    it("should return undefined for unknown ID", () => {
      const found = service.getQueryPatternById("nonExistentId");
      expect(found).toBeUndefined();
    });
  });

  describe("getQueryPatternsByFrequency", () => {
    it("should return patterns with specified frequency", () => {
      const veryHighPatterns = service.getQueryPatternsByFrequency("very_high");
      expect(veryHighPatterns.length).toBeGreaterThan(0);
      for (const pattern of veryHighPatterns) {
        expect(pattern.frequency).toBe("very_high");
      }
    });

    it("should return empty for non-matching frequency", () => {
      // All valid frequencies should return results
      const patterns = service.getQueryPatternsByFrequency("low");
      // Could be empty or have results depending on patterns defined
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("getQueryPatternsForTable", () => {
    it("should return patterns involving a table", () => {
      const tradePatterns = service.getQueryPatternsForTable("Trade");
      expect(tradePatterns.length).toBeGreaterThan(0);
      for (const pattern of tradePatterns) {
        expect(pattern.tables).toContain("Trade");
      }
    });

    it("should return empty for unknown table", () => {
      const patterns = service.getQueryPatternsForTable("NonExistentTable");
      expect(patterns).toHaveLength(0);
    });
  });

  describe("analyzeQuery", () => {
    it("should analyze a query and return query plan", async () => {
      const mockPlan = [
        {
          Plan: {
            "Node Type": "Index Scan",
            "Startup Cost": 0.42,
            "Total Cost": 8.44,
            "Plan Rows": 1,
            "Plan Width": 200,
            "Index Name": "Market_slug_key",
          },
        },
      ];

      mockPrismaClient.$queryRawUnsafe.mockResolvedValueOnce([
        { "QUERY PLAN": mockPlan },
      ]);

      const result = await service.analyzeQuery(
        'SELECT * FROM "Market" WHERE slug = $1'
      );

      expect(result).toBeDefined();
      expect(result.planType).toBe("Index Scan");
      expect(result.startupCost).toBe(0.42);
      expect(result.totalCost).toBe(8.44);
      expect(result.rows).toBe(1);
      expect(result.indexesUsed).toContain("Market_slug_key");
      expect(result.usesSeqScan).toBe(false);
    });

    it("should detect sequential scan", async () => {
      const mockPlan = [
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Startup Cost": 0,
            "Total Cost": 1000,
            "Plan Rows": 50000,
            "Plan Width": 200,
          },
        },
      ];

      mockPrismaClient.$queryRawUnsafe.mockResolvedValueOnce([
        { "QUERY PLAN": mockPlan },
      ]);

      const result = await service.analyzeQuery(
        'SELECT * FROM "Market" WHERE description LIKE $1'
      );

      expect(result.usesSeqScan).toBe(true);
      expect(result.indexesUsed).toHaveLength(0);
    });

    it("should handle errors gracefully", async () => {
      mockPrismaClient.$queryRawUnsafe.mockRejectedValueOnce(
        new Error("Invalid query")
      );

      await expect(service.analyzeQuery("INVALID SQL")).rejects.toThrow(
        "Invalid query"
      );
    });
  });

  describe("analyzeQueryWithExecution", () => {
    it("should analyze query with actual execution", async () => {
      const mockPlan = [
        {
          Plan: {
            "Node Type": "Index Scan",
            "Startup Cost": 0.42,
            "Total Cost": 8.44,
            "Plan Rows": 1,
            "Plan Width": 200,
            "Index Name": "Market_slug_key",
            "Actual Rows": 1,
          },
          "Execution Time": 0.5,
          "Planning Time": 0.1,
        },
      ];

      mockPrismaClient.$queryRawUnsafe.mockResolvedValueOnce([
        { "QUERY PLAN": mockPlan },
      ]);

      const result = await service.analyzeQueryWithExecution(
        'SELECT * FROM "Market" WHERE slug = $1',
        ["test-slug"]
      );

      expect(result).toBeDefined();
      expect(result.executionTimeMs).toBe(0.5);
      expect(result.planningTimeMs).toBe(0.1);
      expect(result.actualRows).toBe(1);
      expect(result.indexEfficient).toBe(true);
      expect(result.rating).toBe("excellent");
    });

    it("should rate poor performance queries", async () => {
      const mockPlan = [
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Startup Cost": 0,
            "Total Cost": 100000,
            "Plan Rows": 100000,
            "Plan Width": 200,
            "Actual Rows": 100000,
          },
          "Execution Time": 1500,
          "Planning Time": 0.5,
        },
      ];

      mockPrismaClient.$queryRawUnsafe.mockResolvedValueOnce([
        { "QUERY PLAN": mockPlan },
      ]);

      const result = await service.analyzeQueryWithExecution(
        'SELECT * FROM "Trade"'
      );

      expect(result.indexEfficient).toBe(false);
      expect(result.rating).toBe("poor");
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should generate recommendations for slow queries", async () => {
      const mockPlan = [
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Startup Cost": 0,
            "Total Cost": 50000,
            "Plan Rows": 50000,
            "Plan Width": 200,
            "Actual Rows": 50000,
          },
          "Execution Time": 200,
          "Planning Time": 0.3,
        },
      ];

      mockPrismaClient.$queryRawUnsafe.mockResolvedValueOnce([
        { "QUERY PLAN": mockPlan },
      ]);

      const result = await service.analyzeQueryWithExecution(
        'SELECT * FROM "Trade" WHERE timestamp > $1'
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(
        result.recommendations.some(r => r.includes("index"))
      ).toBe(true);
    });
  });

  describe("getIndexUsageStats", () => {
    it("should return index usage statistics", async () => {
      const mockStats = [
        {
          tableName: "Market",
          indexName: "Market_pkey",
          indexScans: BigInt(1000),
          indexTuplesRead: BigInt(5000),
          indexTuplesFetched: BigInt(4500),
          indexSizeBytes: BigInt(1048576),
        },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValueOnce(mockStats);

      const result = await service.getIndexUsageStats();

      expect(result).toHaveLength(1);
      expect(result[0]!.indexName).toBe("Market_pkey");
      expect(result[0]!.isUsed).toBe(true);
      expect(result[0]!.indexSizeFormatted).toBe("1 MB");
      expect(result[0]!.efficiencyScore).toBeGreaterThan(0);
    });

    it("should identify unused indexes", async () => {
      const mockStats = [
        {
          tableName: "Market",
          indexName: "Market_unused_idx",
          indexScans: BigInt(0),
          indexTuplesRead: BigInt(0),
          indexTuplesFetched: BigInt(0),
          indexSizeBytes: BigInt(524288),
        },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValueOnce(mockStats);

      const result = await service.getIndexUsageStats();

      expect(result[0]!.isUsed).toBe(false);
      expect(result[0]!.efficiencyScore).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      mockPrismaClient.$queryRaw.mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      const result = await service.getIndexUsageStats();
      expect(result).toHaveLength(0);
    });
  });

  describe("getTableStats", () => {
    it("should return table statistics", async () => {
      const mockStats = [
        {
          tableName: "Trade",
          rowCount: BigInt(1000000),
          tableSizeBytes: BigInt(104857600),
          indexesSizeBytes: BigInt(52428800),
          indexCount: BigInt(10),
          seqScans: BigInt(100),
          indexScans: BigInt(900),
          deadTuples: BigInt(1000),
        },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValueOnce(mockStats);

      const result = await service.getTableStats();

      expect(result).toHaveLength(1);
      expect(result[0]!.tableName).toBe("Trade");
      expect(result[0]!.tableSizeFormatted).toBe("100 MB");
      expect(result[0]!.indexesSizeFormatted).toBe("50 MB");
      expect(result[0]!.indexScanRatio).toBeCloseTo(0.9, 1);
    });

    it("should handle database errors gracefully", async () => {
      mockPrismaClient.$queryRaw.mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      const result = await service.getTableStats();
      expect(result).toHaveLength(0);
    });
  });

  describe("getUnusedIndexes", () => {
    it("should return only unused indexes", async () => {
      const mockStats = [
        {
          tableName: "Market",
          indexName: "Market_used_idx",
          indexScans: BigInt(1000),
          indexTuplesRead: BigInt(5000),
          indexTuplesFetched: BigInt(4500),
          indexSizeBytes: BigInt(1048576),
        },
        {
          tableName: "Market",
          indexName: "Market_unused_idx",
          indexScans: BigInt(0),
          indexTuplesRead: BigInt(0),
          indexTuplesFetched: BigInt(0),
          indexSizeBytes: BigInt(524288),
        },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValueOnce(mockStats);

      const result = await service.getUnusedIndexes();

      expect(result).toHaveLength(1);
      expect(result[0]!.indexName).toBe("Market_unused_idx");
    });
  });

  describe("getIndexEfficiencyRanking", () => {
    it("should return indexes sorted by efficiency", async () => {
      const mockStats = [
        {
          tableName: "Market",
          indexName: "Market_low_efficiency_idx",
          indexScans: BigInt(100),
          indexTuplesRead: BigInt(10000),
          indexTuplesFetched: BigInt(1000),
          indexSizeBytes: BigInt(1048576),
        },
        {
          tableName: "Market",
          indexName: "Market_high_efficiency_idx",
          indexScans: BigInt(1000),
          indexTuplesRead: BigInt(5000),
          indexTuplesFetched: BigInt(4500),
          indexSizeBytes: BigInt(1048576),
        },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValueOnce(mockStats);

      const result = await service.getIndexEfficiencyRanking();

      expect(result).toHaveLength(2);
      expect(result[0]!.efficiencyScore).toBeGreaterThan(result[1]!.efficiencyScore);
    });

    it("should exclude unused indexes from ranking", async () => {
      const mockStats = [
        {
          tableName: "Market",
          indexName: "Market_unused_idx",
          indexScans: BigInt(0),
          indexTuplesRead: BigInt(0),
          indexTuplesFetched: BigInt(0),
          indexSizeBytes: BigInt(524288),
        },
        {
          tableName: "Market",
          indexName: "Market_used_idx",
          indexScans: BigInt(1000),
          indexTuplesRead: BigInt(5000),
          indexTuplesFetched: BigInt(4500),
          indexSizeBytes: BigInt(1048576),
        },
      ];

      mockPrismaClient.$queryRaw.mockResolvedValueOnce(mockStats);

      const result = await service.getIndexEfficiencyRanking();

      expect(result).toHaveLength(1);
      expect(result[0]!.indexName).toBe("Market_used_idx");
    });
  });

  describe("generateRecommendations", () => {
    it("should generate recommendations based on stats", async () => {
      const mockTableStats = [
        {
          tableName: "Trade",
          rowCount: BigInt(100000),
          tableSizeBytes: BigInt(104857600),
          indexesSizeBytes: BigInt(10485760),
          indexCount: BigInt(2),
          seqScans: BigInt(800),
          indexScans: BigInt(200),
          deadTuples: BigInt(1000),
        },
      ];

      const mockIndexStats = [
        {
          tableName: "Trade",
          indexName: "Trade_pkey",
          indexScans: BigInt(200),
          indexTuplesRead: BigInt(1000),
          indexTuplesFetched: BigInt(900),
          indexSizeBytes: BigInt(5242880),
        },
      ];

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce(mockTableStats)
        .mockResolvedValueOnce(mockIndexStats);

      const result = await service.generateRecommendations();

      expect(Array.isArray(result)).toBe(true);
      // Recommendations depend on specific data patterns
    });

    it("should sort recommendations by priority", async () => {
      const mockTableStats = [
        {
          tableName: "Trade",
          rowCount: BigInt(100000),
          tableSizeBytes: BigInt(104857600),
          indexesSizeBytes: BigInt(10485760),
          indexCount: BigInt(1),
          seqScans: BigInt(900),
          indexScans: BigInt(100),
          deadTuples: BigInt(1000),
        },
      ];

      const mockIndexStats = [
        {
          tableName: "Trade",
          indexName: "Trade_pkey",
          indexScans: BigInt(100),
          indexTuplesRead: BigInt(500),
          indexTuplesFetched: BigInt(450),
          indexSizeBytes: BigInt(5242880),
        },
      ];

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce(mockTableStats)
        .mockResolvedValueOnce(mockIndexStats);

      const result = await service.generateRecommendations();

      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i]!.priority).toBeLessThanOrEqual(result[i + 1]!.priority);
        }
      }
    });
  });

  describe("getSummary", () => {
    it("should return index summary statistics", async () => {
      const mockTableStats: unknown[] = [];
      const mockIndexStats: unknown[] = [];

      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce(mockTableStats)
        .mockResolvedValueOnce(mockIndexStats);

      const result = await service.getSummary();

      expect(result.totalIndexes).toBe(INDEX_CATALOG.length);
      expect(result.compositeIndexes).toBeGreaterThan(0);
      expect(result.tablesWithIndexes).toBeGreaterThan(0);
      expect(result.highPriorityPatterns).toBeGreaterThan(0);
      expect(typeof result.recommendations).toBe("number");
      expect(typeof result.indexesByTable).toBe("object");
    });

    it("should count indexes by table", async () => {
      mockPrismaClient.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getSummary();

      expect(result.indexesByTable["Market"]).toBeGreaterThan(0);
      expect(result.indexesByTable["Trade"]).toBeGreaterThan(0);
      expect(result.indexesByTable["Wallet"]).toBeGreaterThan(0);
    });
  });
});

describe("createIndexService", () => {
  it("should create a new instance", () => {
    const service = createIndexService();
    expect(service).toBeInstanceOf(IndexService);
  });

  it("should accept configuration", () => {
    const logger = vi.fn();
    const service = createIndexService({ logger });
    expect(service).toBeInstanceOf(IndexService);
  });
});

describe("Index Catalog Coverage", () => {
  it("should have Market table indexes for common queries", () => {
    const marketIndexes = INDEX_CATALOG.filter(idx => idx.table === "Market");
    const columns = marketIndexes.flatMap(idx => idx.columns);

    expect(columns).toContain("category");
    expect(columns).toContain("active");
    expect(columns).toContain("volume");
    expect(columns).toContain("volume24h");
    expect(columns).toContain("endDate");
  });

  it("should have Trade table indexes for time-based queries", () => {
    const tradeIndexes = INDEX_CATALOG.filter(idx => idx.table === "Trade");
    const columns = tradeIndexes.flatMap(idx => idx.columns);

    expect(columns).toContain("timestamp");
    expect(columns).toContain("marketId");
    expect(columns).toContain("walletId");
    expect(columns).toContain("isWhale");
  });

  it("should have Wallet table indexes for risk analysis", () => {
    const walletIndexes = INDEX_CATALOG.filter(idx => idx.table === "Wallet");
    const columns = walletIndexes.flatMap(idx => idx.columns);

    expect(columns).toContain("isWhale");
    expect(columns).toContain("isInsider");
    expect(columns).toContain("isFresh");
    expect(columns).toContain("suspicionScore");
    expect(columns).toContain("riskLevel");
  });

  it("should have Alert table indexes for notification queries", () => {
    const alertIndexes = INDEX_CATALOG.filter(idx => idx.table === "Alert");
    const columns = alertIndexes.flatMap(idx => idx.columns);

    expect(columns).toContain("type");
    expect(columns).toContain("severity");
    expect(columns).toContain("read");
    expect(columns).toContain("acknowledged");
    expect(columns).toContain("createdAt");
  });

  it("should have composite indexes for common query combinations", () => {
    const compositeIndexes = INDEX_CATALOG.filter(idx => idx.isComposite);

    // Check for market + timestamp combinations
    const marketTimestampIndex = compositeIndexes.find(
      idx => idx.table === "Trade" && idx.columns.includes("marketId") && idx.columns.includes("timestamp")
    );
    expect(marketTimestampIndex).toBeDefined();

    // Check for wallet + timestamp combinations
    const walletTimestampIndex = compositeIndexes.find(
      idx => idx.table === "Trade" && idx.columns.includes("walletId") && idx.columns.includes("timestamp")
    );
    expect(walletTimestampIndex).toBeDefined();

    // Check for status + scheduledFor combinations for job queue
    const jobQueueIndex = compositeIndexes.find(
      idx => idx.table === "JobQueue" && idx.columns.includes("status") && idx.columns.includes("scheduledFor")
    );
    expect(jobQueueIndex).toBeDefined();
  });
});

describe("Query Pattern Coverage", () => {
  it("should have patterns for high-traffic operations", () => {
    const veryHighPatterns = QUERY_PATTERNS.filter(
      qp => qp.frequency === "very_high"
    );

    const patternIds = veryHighPatterns.map(qp => qp.id);

    expect(patternIds).toContain("active_markets_by_category");
    expect(patternIds).toContain("wallet_trade_history");
    expect(patternIds).toContain("market_trade_feed");
    expect(patternIds).toContain("unread_alerts");
    expect(patternIds).toContain("market_price_chart");
    expect(patternIds).toContain("pending_jobs");
  });

  it("should have patterns for whale tracking", () => {
    const whalePatterns = QUERY_PATTERNS.filter(
      qp => qp.id.includes("whale") || qp.description.toLowerCase().includes("whale")
    );

    expect(whalePatterns.length).toBeGreaterThan(0);
  });

  it("should map patterns to ideal indexes", () => {
    for (const pattern of QUERY_PATTERNS) {
      expect(pattern.idealIndexes.length).toBeGreaterThan(0);

      for (const indexId of pattern.idealIndexes) {
        const index = INDEX_CATALOG.find(idx => idx.id === indexId);
        expect(index).toBeDefined();
      }
    }
  });
});
