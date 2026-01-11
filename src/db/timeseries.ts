/**
 * Time-Series Data Storage Service
 *
 * Provides optimized storage and querying for time-series market data including:
 * - Chunking (time-based partitioning for efficient data management)
 * - Compression (aggregation of older data to reduce storage)
 * - Optimized range queries for charting and analysis
 *
 * This service works with PriceHistory, Trade, MarketSnapshot, and WalletSnapshot tables.
 *
 * @module timeseries
 */

import type {
  PriceHistory,
  Trade,
  PrismaClient,
  TimeInterval,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// Re-export types for consumers of this module
export type { PriceHistory, Trade };

// ===========================================================================
// TIME-SERIES DATA TYPES
// ===========================================================================

/**
 * Supported data types for time-series operations
 */
export type TimeSeriesDataType =
  | "priceHistory"
  | "trades"
  | "marketSnapshots"
  | "walletSnapshots";

/**
 * Time-series chunk representing a time period of data
 */
export interface TimeChunk {
  /** Start of the time chunk */
  startTime: Date;
  /** End of the time chunk */
  endTime: Date;
  /** Number of records in this chunk */
  recordCount: number;
  /** Size category: recent, intermediate, or archived */
  sizeCategory: "recent" | "intermediate" | "archived";
  /** Whether this chunk has been compressed */
  compressed: boolean;
}

/**
 * Chunk size configuration
 */
export interface ChunkConfig {
  /** Duration of each chunk in milliseconds */
  durationMs: number;
  /** Name of the chunk size (e.g., "1 hour", "1 day") */
  name: string;
}

/**
 * Available chunk sizes
 */
export const CHUNK_SIZES: Record<string, ChunkConfig> = {
  MINUTE_1: { durationMs: 60 * 1000, name: "1 minute" },
  MINUTE_5: { durationMs: 5 * 60 * 1000, name: "5 minutes" },
  MINUTE_15: { durationMs: 15 * 60 * 1000, name: "15 minutes" },
  HOUR_1: { durationMs: 60 * 60 * 1000, name: "1 hour" },
  HOUR_4: { durationMs: 4 * 60 * 60 * 1000, name: "4 hours" },
  DAY_1: { durationMs: 24 * 60 * 60 * 1000, name: "1 day" },
  WEEK_1: { durationMs: 7 * 24 * 60 * 60 * 1000, name: "1 week" },
  MONTH_1: { durationMs: 30 * 24 * 60 * 60 * 1000, name: "1 month" },
};

/**
 * Compression level determines how data is aggregated
 */
export type CompressionLevel = "none" | "low" | "medium" | "high";

/**
 * Compression configuration for a data age threshold
 */
export interface CompressionConfig {
  /** Age threshold in days after which compression applies */
  ageThresholdDays: number;
  /** Target time interval for compressed data */
  targetInterval: TimeInterval;
  /** Compression level */
  level: CompressionLevel;
  /** Whether to keep original data after compression */
  keepOriginal: boolean;
}

/**
 * Default compression configuration by data age
 */
export const DEFAULT_COMPRESSION_CONFIGS: CompressionConfig[] = [
  {
    ageThresholdDays: 7,
    targetInterval: "HOUR_1" as TimeInterval,
    level: "low",
    keepOriginal: true,
  },
  {
    ageThresholdDays: 30,
    targetInterval: "HOUR_4" as TimeInterval,
    level: "medium",
    keepOriginal: false,
  },
  {
    ageThresholdDays: 90,
    targetInterval: "DAY_1" as TimeInterval,
    level: "high",
    keepOriginal: false,
  },
  {
    ageThresholdDays: 365,
    targetInterval: "WEEK_1" as TimeInterval,
    level: "high",
    keepOriginal: false,
  },
];

/**
 * Aggregated price data point
 */
export interface AggregatedPricePoint {
  /** Start of the aggregation interval */
  timestamp: Date;
  /** Opening price (first in interval) */
  open: number;
  /** Highest price in interval */
  high: number;
  /** Lowest price in interval */
  low: number;
  /** Closing price (last in interval) */
  close: number;
  /** Average price weighted by volume */
  vwap: number;
  /** Total volume in interval */
  volume: number;
  /** Number of trades in interval */
  tradeCount: number;
  /** Market ID */
  marketId: string;
  /** Outcome ID */
  outcomeId: string;
  /** Time interval */
  interval: TimeInterval;
}

/**
 * Aggregated trade statistics
 */
export interface AggregatedTradeStats {
  /** Start of the aggregation interval */
  timestamp: Date;
  /** Total volume in interval */
  totalVolume: number;
  /** Total value in USD */
  totalValueUsd: number;
  /** Number of trades */
  tradeCount: number;
  /** Number of unique wallets */
  uniqueWallets: number;
  /** Number of whale trades */
  whaleTrades: number;
  /** Average trade size */
  avgTradeSize: number;
  /** Largest trade in interval */
  maxTradeSize: number;
  /** Market ID */
  marketId: string;
}

/**
 * Time range for queries
 */
export interface TimeRange {
  /** Start of time range */
  start: Date;
  /** End of time range */
  end: Date;
}

/**
 * Query result with metadata
 */
export interface TimeSeriesResult<T> {
  /** Data points */
  data: T[];
  /** Time range of the result */
  timeRange: TimeRange;
  /** Time interval of the data */
  interval: TimeInterval;
  /** Total number of data points */
  count: number;
  /** Whether data was compressed/aggregated */
  isCompressed: boolean;
  /** Query execution time in ms */
  queryTimeMs: number;
}

/**
 * Downsampling configuration
 */
export interface DownsampleConfig {
  /** Target number of data points */
  targetPoints: number;
  /** Aggregation method */
  method: "lttb" | "average" | "first" | "last" | "min" | "max";
}

/**
 * Time-series service configuration
 */
export interface TimeSeriesServiceConfig {
  /** Prisma client to use (defaults to singleton) */
  prisma?: PrismaClient;
  /** Compression configurations by age */
  compressionConfigs?: CompressionConfig[];
  /** Default chunk size */
  defaultChunkSize?: keyof typeof CHUNK_SIZES;
  /** Whether to automatically downsample large results */
  autoDownsample?: boolean;
  /** Maximum points to return before downsampling */
  maxPointsBeforeDownsample?: number;
  /** Logger function */
  logger?: (message: string, data?: unknown) => void;
}

/**
 * Compression result
 */
export interface CompressionResult {
  /** Data type that was compressed */
  dataType: TimeSeriesDataType;
  /** Time range that was compressed */
  timeRange: TimeRange;
  /** Number of original records */
  originalRecords: number;
  /** Number of compressed records */
  compressedRecords: number;
  /** Number of records deleted after compression */
  deletedRecords: number;
  /** Compression ratio (original / compressed) */
  compressionRatio: number;
  /** Storage saved in bytes (estimated) */
  storageSavedBytes: number;
  /** Duration of the compression operation in ms */
  durationMs: number;
}

/**
 * Storage statistics for time-series data
 */
export interface StorageStats {
  /** Data type */
  dataType: TimeSeriesDataType;
  /** Total record count */
  totalRecords: number;
  /** Estimated size in bytes */
  estimatedSizeBytes: number;
  /** Record count by age bucket */
  byAge: {
    /** Records < 7 days old */
    recent: number;
    /** Records 7-30 days old */
    intermediate: number;
    /** Records 30-90 days old */
    old: number;
    /** Records > 90 days old */
    archived: number;
  };
  /** Record count by compression status */
  byCompression: {
    /** Uncompressed records */
    uncompressed: number;
    /** Compressed records */
    compressed: number;
  };
  /** Oldest record timestamp */
  oldestRecord: Date | null;
  /** Newest record timestamp */
  newestRecord: Date | null;
}

/**
 * Chunk analysis result
 */
export interface ChunkAnalysis {
  /** Data type analyzed */
  dataType: TimeSeriesDataType;
  /** Total number of chunks */
  totalChunks: number;
  /** Chunks by category */
  chunks: TimeChunk[];
  /** Average records per chunk */
  avgRecordsPerChunk: number;
  /** Largest chunk */
  largestChunk: TimeChunk | null;
  /** Smallest chunk */
  smallestChunk: TimeChunk | null;
  /** Recommended actions */
  recommendations: string[];
}

// ===========================================================================
// TIME-SERIES SERVICE
// ===========================================================================

/**
 * Time-Series Data Storage Service
 *
 * Provides optimized storage and querying for time-series market data including
 * chunking, compression, and optimized range queries.
 */
export class TimeSeriesService {
  private prisma: PrismaClient;
  private compressionConfigs: CompressionConfig[];
  private defaultChunkSize: ChunkConfig;
  private autoDownsample: boolean;
  private maxPointsBeforeDownsample: number;
  private logger: (message: string, data?: unknown) => void;

  constructor(config: TimeSeriesServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
    this.compressionConfigs =
      config.compressionConfigs ?? DEFAULT_COMPRESSION_CONFIGS;
    const chunkSizeKey = config.defaultChunkSize ?? "HOUR_1";
    // HOUR_1 is always defined in CHUNK_SIZES, so this is safe
    this.defaultChunkSize = (CHUNK_SIZES[chunkSizeKey] ?? CHUNK_SIZES.HOUR_1) as ChunkConfig;
    this.autoDownsample = config.autoDownsample ?? true;
    this.maxPointsBeforeDownsample = config.maxPointsBeforeDownsample ?? 1000;
    this.logger = config.logger ?? (() => {});
  }

  // =========================================================================
  // CHUNK MANAGEMENT
  // =========================================================================

  /**
   * Get time chunk boundaries for a given time range.
   *
   * @param timeRange - Time range to chunk
   * @param chunkSize - Size of each chunk (defaults to service config)
   * @returns Array of chunk boundaries
   *
   * @example
   * ```typescript
   * const chunks = service.getChunkBoundaries(
   *   { start: new Date("2024-01-01"), end: new Date("2024-01-07") },
   *   "DAY_1"
   * );
   * // Returns 7 daily chunks
   * ```
   */
  getChunkBoundaries(
    timeRange: TimeRange,
    chunkSize: keyof typeof CHUNK_SIZES = "HOUR_1"
  ): TimeRange[] {
    const chunks: TimeRange[] = [];
    const chunkConfig = (CHUNK_SIZES[chunkSize] ?? CHUNK_SIZES.HOUR_1) as ChunkConfig;
    const durationMs = chunkConfig.durationMs;

    // Align to chunk boundaries
    const alignedStart = new Date(
      Math.floor(timeRange.start.getTime() / durationMs) * durationMs
    );

    let currentStart = alignedStart;
    while (currentStart < timeRange.end) {
      const chunkEnd = new Date(currentStart.getTime() + durationMs);
      chunks.push({
        start: currentStart,
        end: chunkEnd > timeRange.end ? timeRange.end : chunkEnd,
      });
      currentStart = chunkEnd;
    }

    return chunks;
  }

  /**
   * Analyze chunks for a specific data type.
   *
   * @param dataType - Type of data to analyze
   * @param chunkSize - Chunk size for analysis
   * @returns Chunk analysis with recommendations
   */
  async analyzeChunks(
    dataType: TimeSeriesDataType,
    chunkSize: keyof typeof CHUNK_SIZES = "DAY_1"
  ): Promise<ChunkAnalysis> {
    const startTime = Date.now();
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get time range of data
    const timeRange = await this.getDataTimeRange(dataType);
    if (!timeRange) {
      return {
        dataType,
        totalChunks: 0,
        chunks: [],
        avgRecordsPerChunk: 0,
        largestChunk: null,
        smallestChunk: null,
        recommendations: ["No data found for analysis"],
      };
    }

    // Limit to last year for analysis
    const effectiveStart =
      timeRange.start < oneYearAgo ? oneYearAgo : timeRange.start;
    const boundaries = this.getChunkBoundaries(
      { start: effectiveStart, end: timeRange.end },
      chunkSize
    );

    const chunks: TimeChunk[] = [];
    for (const boundary of boundaries) {
      const count = await this.countRecordsInRange(
        dataType,
        boundary.start,
        boundary.end
      );

      const ageInDays = Math.floor(
        (now.getTime() - boundary.start.getTime()) / (24 * 60 * 60 * 1000)
      );
      let sizeCategory: "recent" | "intermediate" | "archived";
      if (ageInDays <= 7) {
        sizeCategory = "recent";
      } else if (ageInDays <= 30) {
        sizeCategory = "intermediate";
      } else {
        sizeCategory = "archived";
      }

      // Check if compressed based on interval
      const isCompressed = await this.isChunkCompressed(
        dataType,
        boundary.start,
        boundary.end
      );

      chunks.push({
        startTime: boundary.start,
        endTime: boundary.end,
        recordCount: count,
        sizeCategory,
        compressed: isCompressed,
      });
    }

    // Calculate statistics
    const totalRecords = chunks.reduce((sum, c) => sum + c.recordCount, 0);
    const avgRecordsPerChunk =
      chunks.length > 0 ? totalRecords / chunks.length : 0;

    const sortedByCount = [...chunks].sort(
      (a, b) => b.recordCount - a.recordCount
    );
    const largestChunk = sortedByCount[0] || null;
    const smallestChunk = sortedByCount[sortedByCount.length - 1] || null;

    // Generate recommendations
    const recommendations: string[] = [];

    const uncompressedOldChunks = chunks.filter(
      (c) => !c.compressed && c.sizeCategory === "archived" && c.recordCount > 0
    );
    if (uncompressedOldChunks.length > 0) {
      recommendations.push(
        `Consider compressing ${uncompressedOldChunks.length} old uncompressed chunks to save storage`
      );
    }

    const emptyChunks = chunks.filter((c) => c.recordCount === 0);
    if (emptyChunks.length > chunks.length * 0.3) {
      recommendations.push(
        "High number of empty chunks suggests data gaps or sparse collection"
      );
    }

    if (largestChunk && largestChunk.recordCount > avgRecordsPerChunk * 10) {
      recommendations.push(
        `Chunk at ${largestChunk.startTime.toISOString()} is unusually large (${largestChunk.recordCount} records)`
      );
    }

    this.logger(
      `Chunk analysis completed in ${Date.now() - startTime}ms`,
      { dataType, totalChunks: chunks.length }
    );

    return {
      dataType,
      totalChunks: chunks.length,
      chunks,
      avgRecordsPerChunk,
      largestChunk,
      smallestChunk,
      recommendations,
    };
  }

  /**
   * Get the time range of data for a specific type.
   */
  private async getDataTimeRange(
    dataType: TimeSeriesDataType
  ): Promise<TimeRange | null> {
    let oldest: Date | null = null;
    let newest: Date | null = null;

    switch (dataType) {
      case "priceHistory": {
        const [first, last] = await Promise.all([
          this.prisma.priceHistory.findFirst({
            orderBy: { timestamp: "asc" },
            select: { timestamp: true },
          }),
          this.prisma.priceHistory.findFirst({
            orderBy: { timestamp: "desc" },
            select: { timestamp: true },
          }),
        ]);
        oldest = first?.timestamp ?? null;
        newest = last?.timestamp ?? null;
        break;
      }
      case "trades": {
        const [first, last] = await Promise.all([
          this.prisma.trade.findFirst({
            orderBy: { timestamp: "asc" },
            select: { timestamp: true },
          }),
          this.prisma.trade.findFirst({
            orderBy: { timestamp: "desc" },
            select: { timestamp: true },
          }),
        ]);
        oldest = first?.timestamp ?? null;
        newest = last?.timestamp ?? null;
        break;
      }
      case "marketSnapshots": {
        const [first, last] = await Promise.all([
          this.prisma.marketSnapshot.findFirst({
            orderBy: { timestamp: "asc" },
            select: { timestamp: true },
          }),
          this.prisma.marketSnapshot.findFirst({
            orderBy: { timestamp: "desc" },
            select: { timestamp: true },
          }),
        ]);
        oldest = first?.timestamp ?? null;
        newest = last?.timestamp ?? null;
        break;
      }
      case "walletSnapshots": {
        const [first, last] = await Promise.all([
          this.prisma.walletSnapshot.findFirst({
            orderBy: { timestamp: "asc" },
            select: { timestamp: true },
          }),
          this.prisma.walletSnapshot.findFirst({
            orderBy: { timestamp: "desc" },
            select: { timestamp: true },
          }),
        ]);
        oldest = first?.timestamp ?? null;
        newest = last?.timestamp ?? null;
        break;
      }
    }

    if (!oldest || !newest) {
      return null;
    }

    return { start: oldest, end: newest };
  }

  /**
   * Count records in a time range for a specific data type.
   */
  private async countRecordsInRange(
    dataType: TimeSeriesDataType,
    start: Date,
    end: Date
  ): Promise<number> {
    const where = {
      timestamp: {
        gte: start,
        lt: end,
      },
    };

    switch (dataType) {
      case "priceHistory":
        return this.prisma.priceHistory.count({ where });
      case "trades":
        return this.prisma.trade.count({ where });
      case "marketSnapshots":
        return this.prisma.marketSnapshot.count({ where });
      case "walletSnapshots":
        return this.prisma.walletSnapshot.count({ where });
    }
  }

  /**
   * Check if a chunk has been compressed (for price history).
   */
  private async isChunkCompressed(
    dataType: TimeSeriesDataType,
    start: Date,
    end: Date
  ): Promise<boolean> {
    if (dataType !== "priceHistory") {
      return false;
    }

    // Check if data is using larger intervals (indicating compression)
    const sample = await this.prisma.priceHistory.findFirst({
      where: {
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      select: { interval: true },
    });

    if (!sample) {
      return false;
    }

    // Consider intervals larger than 15 minutes as compressed
    return ["HOUR_1", "HOUR_4", "DAY_1", "WEEK_1"].includes(sample.interval);
  }

  // =========================================================================
  // COMPRESSION
  // =========================================================================

  /**
   * Get the appropriate compression config for a given data age.
   *
   * @param ageInDays - Age of data in days
   * @returns Compression config or null if no compression needed
   */
  getCompressionConfigForAge(ageInDays: number): CompressionConfig | null {
    // Sort configs by age threshold descending to find the highest applicable
    const sortedConfigs = [...this.compressionConfigs].sort(
      (a, b) => b.ageThresholdDays - a.ageThresholdDays
    );

    for (const config of sortedConfigs) {
      if (ageInDays >= config.ageThresholdDays) {
        return config;
      }
    }

    return null;
  }

  /**
   * Compress price history data for a specific time range.
   *
   * @param marketId - Market ID to compress
   * @param timeRange - Time range to compress
   * @param targetInterval - Target time interval for compression
   * @param deleteOriginal - Whether to delete original data after compression
   * @returns Compression result
   */
  async compressPriceHistory(
    marketId: string,
    timeRange: TimeRange,
    targetInterval: TimeInterval,
    deleteOriginal = false
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    const intervalMs = CHUNK_SIZES[targetInterval]?.durationMs ?? 3600000;

    // Get original records
    const originalRecords = await this.prisma.priceHistory.findMany({
      where: {
        marketId,
        timestamp: {
          gte: timeRange.start,
          lt: timeRange.end,
        },
      },
      orderBy: { timestamp: "asc" },
    });

    if (originalRecords.length === 0) {
      return {
        dataType: "priceHistory",
        timeRange,
        originalRecords: 0,
        compressedRecords: 0,
        deletedRecords: 0,
        compressionRatio: 1,
        storageSavedBytes: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // Group by outcome and interval
    const groupedData = new Map<string, Map<number, PriceHistory[]>>();

    for (const record of originalRecords) {
      const intervalStart =
        Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
      const key = record.outcomeId;

      if (!groupedData.has(key)) {
        groupedData.set(key, new Map());
      }
      const outcomeMap = groupedData.get(key)!;
      if (!outcomeMap.has(intervalStart)) {
        outcomeMap.set(intervalStart, []);
      }
      outcomeMap.get(intervalStart)!.push(record);
    }

    // Create aggregated records
    const compressedRecords: Prisma.PriceHistoryCreateManyInput[] = [];

    for (const [outcomeId, intervalMap] of groupedData) {
      for (const [intervalStart, records] of intervalMap) {
        // Aggregate data
        const sortedByTime = records.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        const totalVolume = records.reduce((sum, r) => sum + r.volume, 0);
        const totalTradeCount = records.reduce((sum, r) => sum + r.tradeCount, 0);

        // Volume-weighted average price
        const vwap =
          totalVolume > 0
            ? records.reduce((sum, r) => sum + r.price * r.volume, 0) / totalVolume
            : records.reduce((sum, r) => sum + r.price, 0) / records.length;

        // Best bid/ask (latest values)
        const lastRecord = sortedByTime[sortedByTime.length - 1];
        if (!lastRecord) continue;

        compressedRecords.push({
          marketId,
          outcomeId,
          price: vwap,
          volume: totalVolume,
          tradeCount: totalTradeCount,
          bestBid: lastRecord.bestBid,
          bestAsk: lastRecord.bestAsk,
          spread: lastRecord.spread,
          interval: targetInterval,
          timestamp: new Date(intervalStart),
        });
      }
    }

    // Insert compressed records and optionally delete originals in a transaction
    let deletedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      // Insert compressed records
      await tx.priceHistory.createMany({
        data: compressedRecords,
        skipDuplicates: true,
      });

      // Delete originals if requested
      if (deleteOriginal) {
        const result = await tx.priceHistory.deleteMany({
          where: {
            id: {
              in: originalRecords.map((r) => r.id),
            },
          },
        });
        deletedCount = result.count;
      }
    });

    const estimatedRecordSize = 200; // bytes per record estimate
    const storageSaved = deleteOriginal
      ? (originalRecords.length - compressedRecords.length) * estimatedRecordSize
      : 0;

    const result: CompressionResult = {
      dataType: "priceHistory",
      timeRange,
      originalRecords: originalRecords.length,
      compressedRecords: compressedRecords.length,
      deletedRecords: deletedCount,
      compressionRatio:
        compressedRecords.length > 0
          ? originalRecords.length / compressedRecords.length
          : 1,
      storageSavedBytes: storageSaved,
      durationMs: Date.now() - startTime,
    };

    this.logger("Price history compression completed", result);
    return result;
  }

  /**
   * Run automatic compression based on configured thresholds.
   *
   * @param marketIds - Optional market IDs to compress (all if not specified)
   * @returns Array of compression results
   */
  async runAutoCompression(marketIds?: string[]): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    const now = new Date();

    // Get markets to process
    const markets = await this.prisma.market.findMany({
      where: marketIds ? { id: { in: marketIds } } : undefined,
      select: { id: true },
    });

    for (const market of markets) {
      for (const config of this.compressionConfigs) {
        const cutoffDate = new Date(
          now.getTime() - config.ageThresholdDays * 24 * 60 * 60 * 1000
        );

        // Find uncompressed data older than threshold
        const oldestUncompressed = await this.prisma.priceHistory.findFirst({
          where: {
            marketId: market.id,
            timestamp: { lt: cutoffDate },
            interval: { in: ["MINUTE_1", "MINUTE_5", "MINUTE_15"] },
          },
          orderBy: { timestamp: "asc" },
          select: { timestamp: true },
        });

        if (oldestUncompressed) {
          // Compress data from oldest uncompressed to cutoff
          const result = await this.compressPriceHistory(
            market.id,
            {
              start: oldestUncompressed.timestamp,
              end: cutoffDate,
            },
            config.targetInterval,
            !config.keepOriginal
          );
          results.push(result);
        }
      }
    }

    return results;
  }

  // =========================================================================
  // OPTIMIZED RANGE QUERIES
  // =========================================================================

  /**
   * Query price history with optimized range selection.
   * Automatically selects appropriate interval based on time range.
   *
   * @param marketId - Market ID
   * @param outcomeId - Outcome ID
   * @param timeRange - Time range to query
   * @param maxPoints - Maximum number of points to return
   * @returns Time series result with appropriate granularity
   */
  async queryPriceHistory(
    marketId: string,
    outcomeId: string,
    timeRange: TimeRange,
    maxPoints = 500
  ): Promise<TimeSeriesResult<PriceHistory>> {
    const startTime = Date.now();
    const rangeMs = timeRange.end.getTime() - timeRange.start.getTime();

    // Select optimal interval based on range
    const optimalInterval = this.selectOptimalInterval(rangeMs, maxPoints);

    // Query with selected interval
    const data = await this.prisma.priceHistory.findMany({
      where: {
        marketId,
        outcomeId,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
        interval: optimalInterval,
      },
      orderBy: { timestamp: "asc" },
      take: maxPoints,
    });

    const queryTimeMs = Date.now() - startTime;

    return {
      data,
      timeRange,
      interval: optimalInterval,
      count: data.length,
      isCompressed: !["MINUTE_1", "MINUTE_5"].includes(optimalInterval),
      queryTimeMs,
    };
  }

  /**
   * Query aggregated price data (OHLCV).
   *
   * @param marketId - Market ID
   * @param outcomeId - Outcome ID
   * @param timeRange - Time range to query
   * @param interval - Aggregation interval
   * @returns Array of OHLCV data points
   */
  async queryOHLCV(
    marketId: string,
    outcomeId: string,
    timeRange: TimeRange,
    interval: TimeInterval
  ): Promise<AggregatedPricePoint[]> {
    const intervalMs = CHUNK_SIZES[interval]?.durationMs ?? 3600000;

    // Get raw data
    const rawData = await this.prisma.priceHistory.findMany({
      where: {
        marketId,
        outcomeId,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Group by interval
    const groupedData = new Map<number, PriceHistory[]>();
    for (const record of rawData) {
      const intervalStart =
        Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
      if (!groupedData.has(intervalStart)) {
        groupedData.set(intervalStart, []);
      }
      groupedData.get(intervalStart)!.push(record);
    }

    // Aggregate each interval
    const result: AggregatedPricePoint[] = [];
    for (const [intervalStart, records] of groupedData) {
      const sortedByTime = records.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const prices = records.map((r) => r.price);
      const totalVolume = records.reduce((sum, r) => sum + r.volume, 0);
      const totalTradeCount = records.reduce((sum, r) => sum + r.tradeCount, 0);

      const vwap =
        totalVolume > 0
          ? records.reduce((sum, r) => sum + r.price * r.volume, 0) / totalVolume
          : prices.reduce((sum, p) => sum + p, 0) / prices.length;

      const firstRecord = sortedByTime[0];
      const lastRecord = sortedByTime[sortedByTime.length - 1];
      if (!firstRecord || !lastRecord) continue;

      result.push({
        timestamp: new Date(intervalStart),
        open: firstRecord.price,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: lastRecord.price,
        vwap,
        volume: totalVolume,
        tradeCount: totalTradeCount,
        marketId,
        outcomeId,
        interval,
      });
    }

    return result.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Query aggregated trade statistics.
   *
   * @param marketId - Market ID
   * @param timeRange - Time range to query
   * @param interval - Aggregation interval
   * @returns Array of aggregated trade stats
   */
  async queryTradeStats(
    marketId: string,
    timeRange: TimeRange,
    interval: TimeInterval
  ): Promise<AggregatedTradeStats[]> {
    const intervalMs = CHUNK_SIZES[interval]?.durationMs ?? 3600000;

    // Get raw trade data
    const trades = await this.prisma.trade.findMany({
      where: {
        marketId,
        timestamp: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Group by interval
    const groupedData = new Map<number, Trade[]>();
    for (const trade of trades) {
      const intervalStart =
        Math.floor(trade.timestamp.getTime() / intervalMs) * intervalMs;
      if (!groupedData.has(intervalStart)) {
        groupedData.set(intervalStart, []);
      }
      groupedData.get(intervalStart)!.push(trade);
    }

    // Aggregate each interval
    const result: AggregatedTradeStats[] = [];
    for (const [intervalStart, intervalTrades] of groupedData) {
      const totalVolume = intervalTrades.reduce((sum, t) => sum + t.amount, 0);
      const totalValueUsd = intervalTrades.reduce((sum, t) => sum + t.usdValue, 0);
      const uniqueWallets = new Set(intervalTrades.map((t) => t.walletId)).size;
      const whaleTrades = intervalTrades.filter((t) => t.isWhale).length;
      const tradeSizes = intervalTrades.map((t) => t.usdValue);

      result.push({
        timestamp: new Date(intervalStart),
        totalVolume,
        totalValueUsd,
        tradeCount: intervalTrades.length,
        uniqueWallets,
        whaleTrades,
        avgTradeSize: tradeSizes.length > 0
          ? totalValueUsd / tradeSizes.length
          : 0,
        maxTradeSize: Math.max(...tradeSizes, 0),
        marketId,
      });
    }

    return result.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Select optimal time interval based on range and desired points.
   */
  private selectOptimalInterval(
    rangeMs: number,
    maxPoints: number
  ): TimeInterval {
    const targetIntervalMs = rangeMs / maxPoints;

    // Map to available intervals
    if (targetIntervalMs <= 60 * 1000) {
      return "MINUTE_1" as TimeInterval;
    } else if (targetIntervalMs <= 5 * 60 * 1000) {
      return "MINUTE_5" as TimeInterval;
    } else if (targetIntervalMs <= 15 * 60 * 1000) {
      return "MINUTE_15" as TimeInterval;
    } else if (targetIntervalMs <= 60 * 60 * 1000) {
      return "HOUR_1" as TimeInterval;
    } else if (targetIntervalMs <= 4 * 60 * 60 * 1000) {
      return "HOUR_4" as TimeInterval;
    } else if (targetIntervalMs <= 24 * 60 * 60 * 1000) {
      return "DAY_1" as TimeInterval;
    } else {
      return "WEEK_1" as TimeInterval;
    }
  }

  /**
   * Downsample data using Largest-Triangle-Three-Buckets algorithm.
   * Preserves visual characteristics while reducing data points.
   *
   * @param data - Array of price history points
   * @param targetPoints - Target number of points
   * @returns Downsampled data
   */
  downsampleLTTB(data: PriceHistory[], targetPoints: number): PriceHistory[] {
    if (data.length <= targetPoints) {
      return data;
    }

    const sampled: PriceHistory[] = [];
    const bucketSize = (data.length - 2) / (targetPoints - 2);

    // Always include first point
    const firstPoint = data[0];
    if (!firstPoint) return data;
    sampled.push(firstPoint);

    for (let i = 0; i < targetPoints - 2; i++) {
      const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
      const bucketEnd = Math.min(
        Math.floor((i + 2) * bucketSize) + 1,
        data.length - 1
      );

      // Average of next bucket for comparison
      let avgX = 0;
      let avgY = 0;
      const nextBucketStart = bucketEnd;
      const nextBucketEnd = Math.min(
        Math.floor((i + 3) * bucketSize) + 1,
        data.length
      );
      const nextBucketSize = nextBucketEnd - nextBucketStart;

      if (nextBucketSize > 0) {
        for (let j = nextBucketStart; j < nextBucketEnd; j++) {
          const point = data[j];
          if (point) {
            avgX += point.timestamp.getTime();
            avgY += point.price;
          }
        }
        avgX /= nextBucketSize;
        avgY /= nextBucketSize;
      }

      // Find point with largest triangle area
      let maxArea = -1;
      let maxIndex = bucketStart;
      const prevPoint = sampled[sampled.length - 1];
      if (!prevPoint) continue;

      for (let j = bucketStart; j < bucketEnd; j++) {
        const currentPoint = data[j];
        if (!currentPoint) continue;

        const area = Math.abs(
          (prevPoint.timestamp.getTime() - avgX) *
            (currentPoint.price - prevPoint.price) -
            (prevPoint.timestamp.getTime() - currentPoint.timestamp.getTime()) *
              (avgY - prevPoint.price)
        );

        if (area > maxArea) {
          maxArea = area;
          maxIndex = j;
        }
      }

      const selectedPoint = data[maxIndex];
      if (selectedPoint) {
        sampled.push(selectedPoint);
      }
    }

    // Always include last point
    const lastPoint = data[data.length - 1];
    if (lastPoint) {
      sampled.push(lastPoint);
    }

    return sampled;
  }

  // =========================================================================
  // STORAGE STATISTICS
  // =========================================================================

  /**
   * Get storage statistics for a specific data type.
   *
   * @param dataType - Data type to analyze
   * @returns Storage statistics
   */
  async getStorageStats(dataType: TimeSeriesDataType): Promise<StorageStats> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let totalRecords = 0;
    let recent = 0;
    let intermediate = 0;
    let old = 0;
    let archived = 0;
    let uncompressed = 0;
    let compressed = 0;
    let oldestRecord: Date | null = null;
    let newestRecord: Date | null = null;

    const timestampField = "timestamp";

    switch (dataType) {
      case "priceHistory": {
        const [total, recentCount, intermediateCount, oldCount, archivedCount] =
          await Promise.all([
            this.prisma.priceHistory.count(),
            this.prisma.priceHistory.count({
              where: { [timestampField]: { gte: sevenDaysAgo } },
            }),
            this.prisma.priceHistory.count({
              where: {
                [timestampField]: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
              },
            }),
            this.prisma.priceHistory.count({
              where: {
                [timestampField]: { gte: ninetyDaysAgo, lt: thirtyDaysAgo },
              },
            }),
            this.prisma.priceHistory.count({
              where: { [timestampField]: { lt: ninetyDaysAgo } },
            }),
          ]);

        totalRecords = total;
        recent = recentCount;
        intermediate = intermediateCount;
        old = oldCount;
        archived = archivedCount;

        // Check compression status
        const [uncompressedCount, compressedCount] = await Promise.all([
          this.prisma.priceHistory.count({
            where: { interval: { in: ["MINUTE_1", "MINUTE_5", "MINUTE_15"] } },
          }),
          this.prisma.priceHistory.count({
            where: { interval: { in: ["HOUR_1", "HOUR_4", "DAY_1", "WEEK_1"] } },
          }),
        ]);
        uncompressed = uncompressedCount;
        compressed = compressedCount;

        const [oldest, newest] = await Promise.all([
          this.prisma.priceHistory.findFirst({
            orderBy: { [timestampField]: "asc" },
            select: { [timestampField]: true },
          }),
          this.prisma.priceHistory.findFirst({
            orderBy: { [timestampField]: "desc" },
            select: { [timestampField]: true },
          }),
        ]);
        oldestRecord = oldest?.timestamp ?? null;
        newestRecord = newest?.timestamp ?? null;
        break;
      }

      case "trades": {
        const [total, recentCount, intermediateCount, oldCount, archivedCount] =
          await Promise.all([
            this.prisma.trade.count(),
            this.prisma.trade.count({
              where: { [timestampField]: { gte: sevenDaysAgo } },
            }),
            this.prisma.trade.count({
              where: {
                [timestampField]: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
              },
            }),
            this.prisma.trade.count({
              where: {
                [timestampField]: { gte: ninetyDaysAgo, lt: thirtyDaysAgo },
              },
            }),
            this.prisma.trade.count({
              where: { [timestampField]: { lt: ninetyDaysAgo } },
            }),
          ]);

        totalRecords = total;
        recent = recentCount;
        intermediate = intermediateCount;
        old = oldCount;
        archived = archivedCount;
        uncompressed = total; // Trades are not compressed
        compressed = 0;

        const [oldest, newest] = await Promise.all([
          this.prisma.trade.findFirst({
            orderBy: { [timestampField]: "asc" },
            select: { [timestampField]: true },
          }),
          this.prisma.trade.findFirst({
            orderBy: { [timestampField]: "desc" },
            select: { [timestampField]: true },
          }),
        ]);
        oldestRecord = oldest?.timestamp ?? null;
        newestRecord = newest?.timestamp ?? null;
        break;
      }

      case "marketSnapshots": {
        const [total, recentCount, intermediateCount, oldCount, archivedCount] =
          await Promise.all([
            this.prisma.marketSnapshot.count(),
            this.prisma.marketSnapshot.count({
              where: { [timestampField]: { gte: sevenDaysAgo } },
            }),
            this.prisma.marketSnapshot.count({
              where: {
                [timestampField]: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
              },
            }),
            this.prisma.marketSnapshot.count({
              where: {
                [timestampField]: { gte: ninetyDaysAgo, lt: thirtyDaysAgo },
              },
            }),
            this.prisma.marketSnapshot.count({
              where: { [timestampField]: { lt: ninetyDaysAgo } },
            }),
          ]);

        totalRecords = total;
        recent = recentCount;
        intermediate = intermediateCount;
        old = oldCount;
        archived = archivedCount;
        uncompressed = total; // Snapshots are not compressed
        compressed = 0;

        const [oldest, newest] = await Promise.all([
          this.prisma.marketSnapshot.findFirst({
            orderBy: { [timestampField]: "asc" },
            select: { [timestampField]: true },
          }),
          this.prisma.marketSnapshot.findFirst({
            orderBy: { [timestampField]: "desc" },
            select: { [timestampField]: true },
          }),
        ]);
        oldestRecord = oldest?.timestamp ?? null;
        newestRecord = newest?.timestamp ?? null;
        break;
      }

      case "walletSnapshots": {
        const [total, recentCount, intermediateCount, oldCount, archivedCount] =
          await Promise.all([
            this.prisma.walletSnapshot.count(),
            this.prisma.walletSnapshot.count({
              where: { [timestampField]: { gte: sevenDaysAgo } },
            }),
            this.prisma.walletSnapshot.count({
              where: {
                [timestampField]: { gte: thirtyDaysAgo, lt: sevenDaysAgo },
              },
            }),
            this.prisma.walletSnapshot.count({
              where: {
                [timestampField]: { gte: ninetyDaysAgo, lt: thirtyDaysAgo },
              },
            }),
            this.prisma.walletSnapshot.count({
              where: { [timestampField]: { lt: ninetyDaysAgo } },
            }),
          ]);

        totalRecords = total;
        recent = recentCount;
        intermediate = intermediateCount;
        old = oldCount;
        archived = archivedCount;
        uncompressed = total; // Snapshots are not compressed
        compressed = 0;

        const [oldest, newest] = await Promise.all([
          this.prisma.walletSnapshot.findFirst({
            orderBy: { [timestampField]: "asc" },
            select: { [timestampField]: true },
          }),
          this.prisma.walletSnapshot.findFirst({
            orderBy: { [timestampField]: "desc" },
            select: { [timestampField]: true },
          }),
        ]);
        oldestRecord = oldest?.timestamp ?? null;
        newestRecord = newest?.timestamp ?? null;
        break;
      }
    }

    // Estimate size based on average record size
    const avgRecordSizeBytes: Record<TimeSeriesDataType, number> = {
      priceHistory: 200,
      trades: 400,
      marketSnapshots: 1000,
      walletSnapshots: 500,
    };

    return {
      dataType,
      totalRecords,
      estimatedSizeBytes: totalRecords * avgRecordSizeBytes[dataType],
      byAge: {
        recent,
        intermediate,
        old,
        archived,
      },
      byCompression: {
        uncompressed,
        compressed,
      },
      oldestRecord,
      newestRecord,
    };
  }

  /**
   * Get storage statistics for all time-series data types.
   *
   * @returns Map of data type to storage statistics
   */
  async getAllStorageStats(): Promise<Map<TimeSeriesDataType, StorageStats>> {
    const dataTypes: TimeSeriesDataType[] = [
      "priceHistory",
      "trades",
      "marketSnapshots",
      "walletSnapshots",
    ];

    const stats = new Map<TimeSeriesDataType, StorageStats>();
    const results = await Promise.all(
      dataTypes.map((dt) => this.getStorageStats(dt))
    );

    for (let i = 0; i < dataTypes.length; i++) {
      const dataType = dataTypes[i];
      const result = results[i];
      if (dataType && result) {
        stats.set(dataType, result);
      }
    }

    return stats;
  }

  /**
   * Get a summary of all time-series storage.
   *
   * @returns Summary with totals and recommendations
   */
  async getStorageSummary(): Promise<{
    totalRecords: number;
    totalEstimatedSizeBytes: number;
    byDataType: Record<TimeSeriesDataType, StorageStats>;
    recommendations: string[];
  }> {
    const allStats = await this.getAllStorageStats();
    let totalRecords = 0;
    let totalSize = 0;
    const byDataType: Record<TimeSeriesDataType, StorageStats> = {} as Record<
      TimeSeriesDataType,
      StorageStats
    >;
    const recommendations: string[] = [];

    for (const [dataType, stats] of allStats) {
      totalRecords += stats.totalRecords;
      totalSize += stats.estimatedSizeBytes;
      byDataType[dataType] = stats;

      // Generate recommendations
      if (stats.byAge.archived > stats.totalRecords * 0.5) {
        recommendations.push(
          `${dataType}: Over 50% of data is archived. Consider running cleanup.`
        );
      }

      if (
        dataType === "priceHistory" &&
        stats.byCompression.uncompressed > stats.byCompression.compressed * 2
      ) {
        recommendations.push(
          `${dataType}: High ratio of uncompressed data. Run auto-compression to reduce storage.`
        );
      }
    }

    return {
      totalRecords,
      totalEstimatedSizeBytes: totalSize,
      byDataType,
      recommendations,
    };
  }

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  /**
   * Get the current compression configurations.
   *
   * @returns Array of compression configs
   */
  getCompressionConfigs(): CompressionConfig[] {
    return [...this.compressionConfigs];
  }

  /**
   * Update compression configurations.
   *
   * @param configs - New compression configs
   */
  setCompressionConfigs(configs: CompressionConfig[]): void {
    this.compressionConfigs = [...configs];
  }

  /**
   * Get the default chunk size.
   *
   * @returns Chunk configuration
   */
  getDefaultChunkSize(): ChunkConfig {
    return { ...this.defaultChunkSize };
  }

  /**
   * Check if auto-downsampling is enabled.
   *
   * @returns True if auto-downsampling is enabled
   */
  isAutoDownsampleEnabled(): boolean {
    return this.autoDownsample;
  }

  /**
   * Get maximum points before auto-downsampling triggers.
   *
   * @returns Maximum point count
   */
  getMaxPointsBeforeDownsample(): number {
    return this.maxPointsBeforeDownsample;
  }
}

/**
 * Default time-series service instance using the singleton Prisma client.
 */
export const timeSeriesService = new TimeSeriesService();

/**
 * Create a new time-series service instance with custom configuration.
 *
 * @param config - Service configuration
 * @returns A new TimeSeriesService instance
 */
export function createTimeSeriesService(
  config: TimeSeriesServiceConfig = {}
): TimeSeriesService {
  return new TimeSeriesService(config);
}
