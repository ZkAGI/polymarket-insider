/**
 * Database Indexing Optimization Module
 *
 * Provides utilities for analyzing query patterns, documenting indexes,
 * testing query performance, and providing index optimization recommendations.
 *
 * Features:
 * - Comprehensive index documentation and catalog
 * - Query performance analysis using EXPLAIN ANALYZE
 * - Index usage statistics collection
 * - Automated index recommendations based on query patterns
 * - Performance benchmarking utilities
 */

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

// ===========================================================================
// TYPES AND INTERFACES
// ===========================================================================

/**
 * Index type classification
 */
export type IndexType = "btree" | "hash" | "gin" | "gist" | "brin";

/**
 * Index definition for documentation
 */
export interface IndexDefinition {
  /** Unique index identifier */
  id: string;
  /** Table the index is on */
  table: string;
  /** Index name in database */
  indexName: string;
  /** Columns included in the index */
  columns: string[];
  /** Whether this is a unique index */
  isUnique: boolean;
  /** Index type */
  type: IndexType;
  /** Description of index purpose */
  description: string;
  /** Query patterns this index optimizes */
  queryPatterns: string[];
  /** Whether index is a composite (multi-column) index */
  isComposite: boolean;
  /** Priority for query optimization (1 = highest) */
  priority: number;
  /** Estimated index size category */
  sizeCategory: "small" | "medium" | "large";
}

/**
 * Query execution plan from EXPLAIN
 */
export interface QueryPlan {
  /** Original query */
  query: string;
  /** Plan type (Seq Scan, Index Scan, etc.) */
  planType: string;
  /** Estimated startup cost */
  startupCost: number;
  /** Total estimated cost */
  totalCost: number;
  /** Estimated rows returned */
  rows: number;
  /** Row width in bytes */
  width: number;
  /** Indexes used (if any) */
  indexesUsed: string[];
  /** Whether query uses sequential scan */
  usesSeqScan: boolean;
  /** Full plan text */
  fullPlan: string;
}

/**
 * Query performance result from EXPLAIN ANALYZE
 */
export interface QueryPerformance {
  /** Original query */
  query: string;
  /** Query parameters */
  params?: unknown[];
  /** Execution plan */
  plan: QueryPlan;
  /** Actual execution time in milliseconds */
  executionTimeMs: number;
  /** Planning time in milliseconds */
  planningTimeMs: number;
  /** Actual rows returned */
  actualRows: number;
  /** Whether index was used efficiently */
  indexEfficient: boolean;
  /** Performance rating */
  rating: "excellent" | "good" | "fair" | "poor";
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Index usage statistics
 */
export interface IndexUsageStats {
  /** Index name */
  indexName: string;
  /** Table name */
  tableName: string;
  /** Number of index scans initiated */
  indexScans: number;
  /** Number of index entries fetched */
  indexTuplesRead: number;
  /** Number of live table rows fetched by index scans */
  indexTuplesFetched: number;
  /** Index size in bytes */
  indexSizeBytes: number;
  /** Index size formatted (e.g., "1.5 MB") */
  indexSizeFormatted: string;
  /** Whether index is being used */
  isUsed: boolean;
  /** Usage efficiency score (0-100) */
  efficiencyScore: number;
}

/**
 * Table statistics for analysis
 */
export interface TableStats {
  /** Table name */
  tableName: string;
  /** Number of rows */
  rowCount: number;
  /** Total table size in bytes */
  tableSizeBytes: number;
  /** Table size formatted */
  tableSizeFormatted: string;
  /** Total indexes size in bytes */
  indexesSizeBytes: number;
  /** Indexes size formatted */
  indexesSizeFormatted: string;
  /** Number of indexes */
  indexCount: number;
  /** Number of sequential scans */
  seqScans: number;
  /** Number of index scans */
  indexScans: number;
  /** Ratio of index scans to total scans */
  indexScanRatio: number;
  /** Dead tuple count (needs vacuum) */
  deadTuples: number;
}

/**
 * Index recommendation
 */
export interface IndexRecommendation {
  /** Table to add index on */
  table: string;
  /** Columns to include in index */
  columns: string[];
  /** Recommended index type */
  type: IndexType;
  /** Reason for recommendation */
  reason: string;
  /** Expected performance improvement */
  expectedImprovement: "low" | "medium" | "high";
  /** SQL to create the index */
  createSql: string;
  /** Priority (1 = highest) */
  priority: number;
}

/**
 * Query pattern for analysis
 */
export interface QueryPattern {
  /** Pattern identifier */
  id: string;
  /** Description of the query pattern */
  description: string;
  /** Tables involved */
  tables: string[];
  /** Columns used in WHERE clauses */
  whereColumns: string[];
  /** Columns used in ORDER BY */
  orderByColumns: string[];
  /** Columns used in JOINs */
  joinColumns: string[];
  /** Frequency classification */
  frequency: "very_high" | "high" | "medium" | "low";
  /** Sample query */
  sampleQuery: string;
  /** Ideal indexes for this pattern */
  idealIndexes: string[];
}

/**
 * Configuration for the IndexService
 */
export interface IndexServiceConfig {
  /** Prisma client to use */
  prisma?: PrismaClient;
  /** Logger function */
  logger?: (level: string, message: string, meta?: Record<string, unknown>) => void;
}

// ===========================================================================
// INDEX CATALOG
// ===========================================================================

/**
 * Comprehensive catalog of all indexes in the schema with documentation
 */
export const INDEX_CATALOG: IndexDefinition[] = [
  // Market table indexes
  {
    id: "market_category",
    table: "Market",
    indexName: "Market_category_idx",
    columns: ["category"],
    isUnique: false,
    type: "btree",
    description: "Filter markets by category (politics, crypto, sports)",
    queryPatterns: ["getMarketsByCategory", "listMarketsWithFilters"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "market_subcategory",
    table: "Market",
    indexName: "Market_subcategory_idx",
    columns: ["subcategory"],
    isUnique: false,
    type: "btree",
    description: "Filter markets by subcategory",
    queryPatterns: ["getMarketsBySubcategory", "drillDownFilters"],
    isComposite: false,
    priority: 3,
    sizeCategory: "small",
  },
  {
    id: "market_active",
    table: "Market",
    indexName: "Market_active_idx",
    columns: ["active"],
    isUnique: false,
    type: "btree",
    description: "Filter for active/inactive markets",
    queryPatterns: ["getActiveMarkets", "getClosedMarkets"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "market_closed",
    table: "Market",
    indexName: "Market_closed_idx",
    columns: ["closed"],
    isUnique: false,
    type: "btree",
    description: "Filter for closed markets",
    queryPatterns: ["getClosedMarkets", "listHistoricalMarkets"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "market_endDate",
    table: "Market",
    indexName: "Market_endDate_idx",
    columns: ["endDate"],
    isUnique: false,
    type: "btree",
    description: "Sort and filter by end date for upcoming/expiring markets",
    queryPatterns: ["getUpcomingMarkets", "getExpiringMarkets"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "market_volume",
    table: "Market",
    indexName: "Market_volume_idx",
    columns: ["volume"],
    isUnique: false,
    type: "btree",
    description: "Sort markets by total volume",
    queryPatterns: ["getTopVolumeMarkets", "marketLeaderboard"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "market_volume24h",
    table: "Market",
    indexName: "Market_volume24h_idx",
    columns: ["volume24h"],
    isUnique: false,
    type: "btree",
    description: "Sort markets by 24h volume for trending",
    queryPatterns: ["getTrendingMarkets", "getHotMarkets"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "market_createdAt",
    table: "Market",
    indexName: "Market_createdAt_idx",
    columns: ["createdAt"],
    isUnique: false,
    type: "btree",
    description: "Sort by creation date for new markets",
    queryPatterns: ["getNewMarkets", "listMarketsByDate"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "market_lastSyncedAt",
    table: "Market",
    indexName: "Market_lastSyncedAt_idx",
    columns: ["lastSyncedAt"],
    isUnique: false,
    type: "btree",
    description: "Find stale markets needing sync",
    queryPatterns: ["getStaleMarkets", "syncScheduler"],
    isComposite: false,
    priority: 3,
    sizeCategory: "small",
  },
  {
    id: "market_category_active",
    table: "Market",
    indexName: "Market_category_active_idx",
    columns: ["category", "active"],
    isUnique: false,
    type: "btree",
    description: "Composite index for active markets by category",
    queryPatterns: ["getActiveMarketsByCategory", "categoryFiltering"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "market_active_volume",
    table: "Market",
    indexName: "Market_active_volume_idx",
    columns: ["active", "volume"],
    isUnique: false,
    type: "btree",
    description: "Composite index for top active markets by volume",
    queryPatterns: ["getTopActiveMarkets", "homePageFeatured"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },

  // Outcome table indexes
  {
    id: "outcome_marketId",
    table: "Outcome",
    indexName: "Outcome_marketId_idx",
    columns: ["marketId"],
    isUnique: false,
    type: "btree",
    description: "Foreign key lookup for market outcomes",
    queryPatterns: ["getOutcomesByMarket", "marketDetails"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "outcome_clobTokenId",
    table: "Outcome",
    indexName: "Outcome_clobTokenId_idx",
    columns: ["clobTokenId"],
    isUnique: false,
    type: "btree",
    description: "Lookup outcome by CLOB token ID",
    queryPatterns: ["getOutcomeByToken", "tradeProcessing"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "outcome_price",
    table: "Outcome",
    indexName: "Outcome_price_idx",
    columns: ["price"],
    isUnique: false,
    type: "btree",
    description: "Sort outcomes by current price",
    queryPatterns: ["getPriceRankings", "priceFiltering"],
    isComposite: false,
    priority: 3,
    sizeCategory: "small",
  },

  // Wallet table indexes
  {
    id: "wallet_isWhale",
    table: "Wallet",
    indexName: "Wallet_isWhale_idx",
    columns: ["isWhale"],
    isUnique: false,
    type: "btree",
    description: "Filter for whale wallets",
    queryPatterns: ["getWhaleWallets", "whaleTracking"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_isInsider",
    table: "Wallet",
    indexName: "Wallet_isInsider_idx",
    columns: ["isInsider"],
    isUnique: false,
    type: "btree",
    description: "Filter for potential insider wallets",
    queryPatterns: ["getInsiderWallets", "insiderDetection"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_isFresh",
    table: "Wallet",
    indexName: "Wallet_isFresh_idx",
    columns: ["isFresh"],
    isUnique: false,
    type: "btree",
    description: "Filter for fresh/new wallets",
    queryPatterns: ["getFreshWallets", "freshWalletDetection"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_isMonitored",
    table: "Wallet",
    indexName: "Wallet_isMonitored_idx",
    columns: ["isMonitored"],
    isUnique: false,
    type: "btree",
    description: "Filter for monitored wallets",
    queryPatterns: ["getMonitoredWallets", "alertSystem"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_isFlagged",
    table: "Wallet",
    indexName: "Wallet_isFlagged_idx",
    columns: ["isFlagged"],
    isUnique: false,
    type: "btree",
    description: "Filter for flagged wallets",
    queryPatterns: ["getFlaggedWallets", "riskDashboard"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_suspicionScore",
    table: "Wallet",
    indexName: "Wallet_suspicionScore_idx",
    columns: ["suspicionScore"],
    isUnique: false,
    type: "btree",
    description: "Sort wallets by suspicion score",
    queryPatterns: ["getHighRiskWallets", "riskRanking"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_riskLevel",
    table: "Wallet",
    indexName: "Wallet_riskLevel_idx",
    columns: ["riskLevel"],
    isUnique: false,
    type: "btree",
    description: "Filter wallets by risk level",
    queryPatterns: ["getWalletsByRiskLevel", "riskFiltering"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_totalVolume",
    table: "Wallet",
    indexName: "Wallet_totalVolume_idx",
    columns: ["totalVolume"],
    isUnique: false,
    type: "btree",
    description: "Sort wallets by total trading volume",
    queryPatterns: ["getTopWallets", "leaderboard"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_tradeCount",
    table: "Wallet",
    indexName: "Wallet_tradeCount_idx",
    columns: ["tradeCount"],
    isUnique: false,
    type: "btree",
    description: "Sort wallets by trade count",
    queryPatterns: ["getMostActiveWallets", "activityRanking"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "wallet_winRate",
    table: "Wallet",
    indexName: "Wallet_winRate_idx",
    columns: ["winRate"],
    isUnique: false,
    type: "btree",
    description: "Sort wallets by win rate",
    queryPatterns: ["getTopPerformers", "performanceRanking"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "wallet_firstTradeAt",
    table: "Wallet",
    indexName: "Wallet_firstTradeAt_idx",
    columns: ["firstTradeAt"],
    isUnique: false,
    type: "btree",
    description: "Find wallets by first trade date",
    queryPatterns: ["getNewTraders", "walletAgeAnalysis"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "wallet_lastTradeAt",
    table: "Wallet",
    indexName: "Wallet_lastTradeAt_idx",
    columns: ["lastTradeAt"],
    isUnique: false,
    type: "btree",
    description: "Find recently active wallets",
    queryPatterns: ["getRecentlyActiveWallets", "activityFiltering"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_walletCreatedAt",
    table: "Wallet",
    indexName: "Wallet_walletCreatedAt_idx",
    columns: ["walletCreatedAt"],
    isUnique: false,
    type: "btree",
    description: "Find wallets by on-chain creation date",
    queryPatterns: ["getFreshWalletsByAge", "walletAgeFiltering"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "wallet_createdAt",
    table: "Wallet",
    indexName: "Wallet_createdAt_idx",
    columns: ["createdAt"],
    isUnique: false,
    type: "btree",
    description: "Sort by record creation date",
    queryPatterns: ["getRecentlyAddedWallets", "auditTrail"],
    isComposite: false,
    priority: 3,
    sizeCategory: "small",
  },
  {
    id: "wallet_isWhale_totalVolume",
    table: "Wallet",
    indexName: "Wallet_isWhale_totalVolume_idx",
    columns: ["isWhale", "totalVolume"],
    isUnique: false,
    type: "btree",
    description: "Composite index for whale leaderboard",
    queryPatterns: ["getTopWhales", "whaleLeaderboard"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "wallet_isInsider_suspicionScore",
    table: "Wallet",
    indexName: "Wallet_isInsider_suspicionScore_idx",
    columns: ["isInsider", "suspicionScore"],
    isUnique: false,
    type: "btree",
    description: "Composite index for insider risk ranking",
    queryPatterns: ["getHighRiskInsiders", "insiderLeaderboard"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },

  // Trade table indexes
  {
    id: "trade_marketId",
    table: "Trade",
    indexName: "Trade_marketId_idx",
    columns: ["marketId"],
    isUnique: false,
    type: "btree",
    description: "Foreign key lookup for market trades",
    queryPatterns: ["getTradesByMarket", "marketActivity"],
    isComposite: false,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_outcomeId",
    table: "Trade",
    indexName: "Trade_outcomeId_idx",
    columns: ["outcomeId"],
    isUnique: false,
    type: "btree",
    description: "Foreign key lookup for outcome trades",
    queryPatterns: ["getTradesByOutcome", "outcomeActivity"],
    isComposite: false,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_walletId",
    table: "Trade",
    indexName: "Trade_walletId_idx",
    columns: ["walletId"],
    isUnique: false,
    type: "btree",
    description: "Foreign key lookup for wallet trades",
    queryPatterns: ["getTradesByWallet", "walletHistory"],
    isComposite: false,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_timestamp",
    table: "Trade",
    indexName: "Trade_timestamp_idx",
    columns: ["timestamp"],
    isUnique: false,
    type: "btree",
    description: "Time-based queries and sorting",
    queryPatterns: ["getRecentTrades", "timeRangeQueries", "tradeHistory"],
    isComposite: false,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_isWhale",
    table: "Trade",
    indexName: "Trade_isWhale_idx",
    columns: ["isWhale"],
    isUnique: false,
    type: "btree",
    description: "Filter for whale trades",
    queryPatterns: ["getWhaleTrades", "whaleActivity"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "trade_isInsider",
    table: "Trade",
    indexName: "Trade_isInsider_idx",
    columns: ["isInsider"],
    isUnique: false,
    type: "btree",
    description: "Filter for potential insider trades",
    queryPatterns: ["getInsiderTrades", "insiderActivity"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "trade_usdValue",
    table: "Trade",
    indexName: "Trade_usdValue_idx",
    columns: ["usdValue"],
    isUnique: false,
    type: "btree",
    description: "Sort trades by value",
    queryPatterns: ["getLargeTrades", "tradeValueFiltering"],
    isComposite: false,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_side",
    table: "Trade",
    indexName: "Trade_side_idx",
    columns: ["side"],
    isUnique: false,
    type: "btree",
    description: "Filter by buy/sell",
    queryPatterns: ["getBuyTrades", "getSellTrades"],
    isComposite: false,
    priority: 2,
    sizeCategory: "medium",
  },
  {
    id: "trade_txHash",
    table: "Trade",
    indexName: "Trade_txHash_idx",
    columns: ["txHash"],
    isUnique: false,
    type: "btree",
    description: "Lookup by transaction hash",
    queryPatterns: ["getTradeByTx", "txVerification"],
    isComposite: false,
    priority: 2,
    sizeCategory: "large",
  },
  {
    id: "trade_matchId",
    table: "Trade",
    indexName: "Trade_matchId_idx",
    columns: ["matchId"],
    isUnique: false,
    type: "btree",
    description: "Lookup by match ID for order matching",
    queryPatterns: ["getMatchedTrades", "orderMatching"],
    isComposite: false,
    priority: 2,
    sizeCategory: "large",
  },
  {
    id: "trade_marketId_timestamp",
    table: "Trade",
    indexName: "Trade_marketId_timestamp_idx",
    columns: ["marketId", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for market trade history",
    queryPatterns: ["getMarketTradeHistory", "marketActivityTimeline"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_walletId_timestamp",
    table: "Trade",
    indexName: "Trade_walletId_timestamp_idx",
    columns: ["walletId", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for wallet trade history",
    queryPatterns: ["getWalletTradeHistory", "walletActivityTimeline"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_marketId_walletId",
    table: "Trade",
    indexName: "Trade_marketId_walletId_idx",
    columns: ["marketId", "walletId"],
    isUnique: false,
    type: "btree",
    description: "Composite index for wallet activity in market",
    queryPatterns: ["getWalletMarketActivity", "positionAnalysis"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_timestamp_usdValue",
    table: "Trade",
    indexName: "Trade_timestamp_usdValue_idx",
    columns: ["timestamp", "usdValue"],
    isUnique: false,
    type: "btree",
    description: "Composite index for recent large trades",
    queryPatterns: ["getRecentLargeTrades", "whaleAlerts"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "trade_isWhale_timestamp",
    table: "Trade",
    indexName: "Trade_isWhale_timestamp_idx",
    columns: ["isWhale", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for whale trade timeline",
    queryPatterns: ["getRecentWhaleTrades", "whaleActivityFeed"],
    isComposite: true,
    priority: 1,
    sizeCategory: "medium",
  },

  // PriceHistory table indexes
  {
    id: "priceHistory_marketId_timestamp",
    table: "PriceHistory",
    indexName: "PriceHistory_marketId_timestamp_idx",
    columns: ["marketId", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for market price history",
    queryPatterns: ["getMarketPriceHistory", "charting"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "priceHistory_outcomeId_timestamp",
    table: "PriceHistory",
    indexName: "PriceHistory_outcomeId_timestamp_idx",
    columns: ["outcomeId", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for outcome price history",
    queryPatterns: ["getOutcomePriceHistory", "outcomeCharting"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "priceHistory_timestamp",
    table: "PriceHistory",
    indexName: "PriceHistory_timestamp_idx",
    columns: ["timestamp"],
    isUnique: false,
    type: "btree",
    description: "Time-based queries for price data",
    queryPatterns: ["getRecentPrices", "timeRangePrices"],
    isComposite: false,
    priority: 1,
    sizeCategory: "large",
  },
  {
    id: "priceHistory_interval",
    table: "PriceHistory",
    indexName: "PriceHistory_interval_idx",
    columns: ["interval"],
    isUnique: false,
    type: "btree",
    description: "Filter by time interval",
    queryPatterns: ["getHourlyPrices", "getDailyPrices"],
    isComposite: false,
    priority: 2,
    sizeCategory: "medium",
  },
  {
    id: "priceHistory_marketId_interval_timestamp",
    table: "PriceHistory",
    indexName: "PriceHistory_marketId_interval_timestamp_idx",
    columns: ["marketId", "interval", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for market charting with interval",
    queryPatterns: ["getMarketChartData", "intervalBasedCharting"],
    isComposite: true,
    priority: 1,
    sizeCategory: "large",
  },

  // MarketSnapshot table indexes
  {
    id: "marketSnapshot_marketId",
    table: "MarketSnapshot",
    indexName: "MarketSnapshot_marketId_idx",
    columns: ["marketId"],
    isUnique: false,
    type: "btree",
    description: "Foreign key lookup for market snapshots",
    queryPatterns: ["getMarketSnapshots", "marketHistory"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "marketSnapshot_timestamp",
    table: "MarketSnapshot",
    indexName: "MarketSnapshot_timestamp_idx",
    columns: ["timestamp"],
    isUnique: false,
    type: "btree",
    description: "Time-based snapshot queries",
    queryPatterns: ["getRecentSnapshots", "timeRangeSnapshots"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "marketSnapshot_marketId_timestamp",
    table: "MarketSnapshot",
    indexName: "MarketSnapshot_marketId_timestamp_idx",
    columns: ["marketId", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for market snapshot history",
    queryPatterns: ["getMarketSnapshotHistory", "marketStateTimeline"],
    isComposite: true,
    priority: 1,
    sizeCategory: "medium",
  },

  // WalletSnapshot table indexes
  {
    id: "walletSnapshot_walletId",
    table: "WalletSnapshot",
    indexName: "WalletSnapshot_walletId_idx",
    columns: ["walletId"],
    isUnique: false,
    type: "btree",
    description: "Foreign key lookup for wallet snapshots",
    queryPatterns: ["getWalletSnapshots", "walletHistory"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "walletSnapshot_timestamp",
    table: "WalletSnapshot",
    indexName: "WalletSnapshot_timestamp_idx",
    columns: ["timestamp"],
    isUnique: false,
    type: "btree",
    description: "Time-based wallet snapshot queries",
    queryPatterns: ["getRecentWalletSnapshots", "timeRangeSnapshots"],
    isComposite: false,
    priority: 1,
    sizeCategory: "medium",
  },
  {
    id: "walletSnapshot_walletId_timestamp",
    table: "WalletSnapshot",
    indexName: "WalletSnapshot_walletId_timestamp_idx",
    columns: ["walletId", "timestamp"],
    isUnique: false,
    type: "btree",
    description: "Composite index for wallet snapshot history",
    queryPatterns: ["getWalletSnapshotHistory", "walletStateTimeline"],
    isComposite: true,
    priority: 1,
    sizeCategory: "medium",
  },

  // Alert table indexes
  {
    id: "alert_type",
    table: "Alert",
    indexName: "Alert_type_idx",
    columns: ["type"],
    isUnique: false,
    type: "btree",
    description: "Filter alerts by type",
    queryPatterns: ["getAlertsByType", "alertFiltering"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_severity",
    table: "Alert",
    indexName: "Alert_severity_idx",
    columns: ["severity"],
    isUnique: false,
    type: "btree",
    description: "Filter alerts by severity",
    queryPatterns: ["getCriticalAlerts", "severityFiltering"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_marketId",
    table: "Alert",
    indexName: "Alert_marketId_idx",
    columns: ["marketId"],
    isUnique: false,
    type: "btree",
    description: "Get alerts for a specific market",
    queryPatterns: ["getMarketAlerts", "marketNotifications"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_walletId",
    table: "Alert",
    indexName: "Alert_walletId_idx",
    columns: ["walletId"],
    isUnique: false,
    type: "btree",
    description: "Get alerts for a specific wallet",
    queryPatterns: ["getWalletAlerts", "walletNotifications"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_read",
    table: "Alert",
    indexName: "Alert_read_idx",
    columns: ["read"],
    isUnique: false,
    type: "btree",
    description: "Filter unread alerts",
    queryPatterns: ["getUnreadAlerts", "notificationBadge"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_acknowledged",
    table: "Alert",
    indexName: "Alert_acknowledged_idx",
    columns: ["acknowledged"],
    isUnique: false,
    type: "btree",
    description: "Filter unacknowledged alerts",
    queryPatterns: ["getPendingAlerts", "alertQueue"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_createdAt",
    table: "Alert",
    indexName: "Alert_createdAt_idx",
    columns: ["createdAt"],
    isUnique: false,
    type: "btree",
    description: "Sort alerts by creation date",
    queryPatterns: ["getRecentAlerts", "alertTimeline"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_expiresAt",
    table: "Alert",
    indexName: "Alert_expiresAt_idx",
    columns: ["expiresAt"],
    isUnique: false,
    type: "btree",
    description: "Find expired or expiring alerts",
    queryPatterns: ["getExpiredAlerts", "alertCleanup"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "alert_type_severity",
    table: "Alert",
    indexName: "Alert_type_severity_idx",
    columns: ["type", "severity"],
    isUnique: false,
    type: "btree",
    description: "Composite index for type+severity filtering",
    queryPatterns: ["getAlertsByTypeAndSeverity", "priorityFiltering"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_type_read",
    table: "Alert",
    indexName: "Alert_type_read_idx",
    columns: ["type", "read"],
    isUnique: false,
    type: "btree",
    description: "Composite index for unread alerts by type",
    queryPatterns: ["getUnreadByType", "notificationCounts"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "alert_createdAt_type",
    table: "Alert",
    indexName: "Alert_createdAt_type_idx",
    columns: ["createdAt", "type"],
    isUnique: false,
    type: "btree",
    description: "Composite index for recent alerts by type",
    queryPatterns: ["getRecentAlertsByType", "typeTimeline"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },

  // SyncLog table indexes
  {
    id: "syncLog_syncType",
    table: "SyncLog",
    indexName: "SyncLog_syncType_idx",
    columns: ["syncType"],
    isUnique: false,
    type: "btree",
    description: "Filter sync logs by type",
    queryPatterns: ["getSyncLogsByType", "syncMonitoring"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "syncLog_entityType",
    table: "SyncLog",
    indexName: "SyncLog_entityType_idx",
    columns: ["entityType"],
    isUnique: false,
    type: "btree",
    description: "Filter sync logs by entity type",
    queryPatterns: ["getSyncLogsByEntity", "entitySyncHistory"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "syncLog_status",
    table: "SyncLog",
    indexName: "SyncLog_status_idx",
    columns: ["status"],
    isUnique: false,
    type: "btree",
    description: "Filter sync logs by status",
    queryPatterns: ["getFailedSyncs", "syncHealthCheck"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "syncLog_startedAt",
    table: "SyncLog",
    indexName: "SyncLog_startedAt_idx",
    columns: ["startedAt"],
    isUnique: false,
    type: "btree",
    description: "Sort sync logs by start time",
    queryPatterns: ["getRecentSyncLogs", "syncTimeline"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },

  // JobQueue table indexes
  {
    id: "jobQueue_jobType",
    table: "JobQueue",
    indexName: "JobQueue_jobType_idx",
    columns: ["jobType"],
    isUnique: false,
    type: "btree",
    description: "Filter jobs by type",
    queryPatterns: ["getJobsByType", "jobMonitoring"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "jobQueue_status",
    table: "JobQueue",
    indexName: "JobQueue_status_idx",
    columns: ["status"],
    isUnique: false,
    type: "btree",
    description: "Filter jobs by status",
    queryPatterns: ["getPendingJobs", "getRunningJobs"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "jobQueue_priority",
    table: "JobQueue",
    indexName: "JobQueue_priority_idx",
    columns: ["priority"],
    isUnique: false,
    type: "btree",
    description: "Sort jobs by priority",
    queryPatterns: ["getHighPriorityJobs", "priorityQueue"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "jobQueue_scheduledFor",
    table: "JobQueue",
    indexName: "JobQueue_scheduledFor_idx",
    columns: ["scheduledFor"],
    isUnique: false,
    type: "btree",
    description: "Find jobs scheduled for execution",
    queryPatterns: ["getDueJobs", "jobScheduler"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "jobQueue_status_scheduledFor",
    table: "JobQueue",
    indexName: "JobQueue_status_scheduledFor_idx",
    columns: ["status", "scheduledFor"],
    isUnique: false,
    type: "btree",
    description: "Composite index for pending scheduled jobs",
    queryPatterns: ["getNextJobs", "jobWorker"],
    isComposite: true,
    priority: 1,
    sizeCategory: "small",
  },

  // WalletFundingSource table indexes
  {
    id: "walletFundingSource_walletId",
    table: "WalletFundingSource",
    indexName: "WalletFundingSource_walletId_idx",
    columns: ["walletId"],
    isUnique: false,
    type: "btree",
    description: "Get funding sources for wallet",
    queryPatterns: ["getWalletFundingSources", "fundingAnalysis"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "walletFundingSource_sourceAddress",
    table: "WalletFundingSource",
    indexName: "WalletFundingSource_sourceAddress_idx",
    columns: ["sourceAddress"],
    isUnique: false,
    type: "btree",
    description: "Find wallets funded by address",
    queryPatterns: ["getWalletsByFundingSource", "sourceTracking"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "walletFundingSource_sourceType",
    table: "WalletFundingSource",
    indexName: "WalletFundingSource_sourceType_idx",
    columns: ["sourceType"],
    isUnique: false,
    type: "btree",
    description: "Filter by funding source type",
    queryPatterns: ["getWalletsBySourceType", "fundingTypeAnalysis"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "walletFundingSource_riskLevel",
    table: "WalletFundingSource",
    indexName: "WalletFundingSource_riskLevel_idx",
    columns: ["riskLevel"],
    isUnique: false,
    type: "btree",
    description: "Filter by funding risk level",
    queryPatterns: ["getHighRiskFunding", "riskAnalysis"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "walletFundingSource_transferredAt",
    table: "WalletFundingSource",
    indexName: "WalletFundingSource_transferredAt_idx",
    columns: ["transferredAt"],
    isUnique: false,
    type: "btree",
    description: "Sort by transfer date",
    queryPatterns: ["getRecentFunding", "fundingTimeline"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },

  // WalletCluster table indexes
  {
    id: "walletCluster_clusterType",
    table: "WalletCluster",
    indexName: "WalletCluster_clusterType_idx",
    columns: ["clusterType"],
    isUnique: false,
    type: "btree",
    description: "Filter clusters by type",
    queryPatterns: ["getClustersByType", "clusterAnalysis"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "walletCluster_confidence",
    table: "WalletCluster",
    indexName: "WalletCluster_confidence_idx",
    columns: ["confidence"],
    isUnique: false,
    type: "btree",
    description: "Sort clusters by confidence",
    queryPatterns: ["getHighConfidenceClusters", "clusterRanking"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },
  {
    id: "walletCluster_totalVolume",
    table: "WalletCluster",
    indexName: "WalletCluster_totalVolume_idx",
    columns: ["totalVolume"],
    isUnique: false,
    type: "btree",
    description: "Sort clusters by volume",
    queryPatterns: ["getLargestClusters", "clusterLeaderboard"],
    isComposite: false,
    priority: 2,
    sizeCategory: "small",
  },

  // WalletClusterMember table indexes
  {
    id: "walletClusterMember_clusterId",
    table: "WalletClusterMember",
    indexName: "WalletClusterMember_clusterId_idx",
    columns: ["clusterId"],
    isUnique: false,
    type: "btree",
    description: "Get cluster members",
    queryPatterns: ["getClusterMembers", "clusterDetails"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
  {
    id: "walletClusterMember_walletId",
    table: "WalletClusterMember",
    indexName: "WalletClusterMember_walletId_idx",
    columns: ["walletId"],
    isUnique: false,
    type: "btree",
    description: "Get clusters containing wallet",
    queryPatterns: ["getWalletClusters", "walletClusterMembership"],
    isComposite: false,
    priority: 1,
    sizeCategory: "small",
  },
];

/**
 * Common query patterns with documentation
 */
export const QUERY_PATTERNS: QueryPattern[] = [
  {
    id: "active_markets_by_category",
    description: "Get active markets filtered by category, sorted by volume",
    tables: ["Market"],
    whereColumns: ["active", "category"],
    orderByColumns: ["volume"],
    joinColumns: [],
    frequency: "very_high",
    sampleQuery: "SELECT * FROM \"Market\" WHERE active = true AND category = 'politics' ORDER BY volume DESC LIMIT 20",
    idealIndexes: ["market_category_active", "market_active_volume"],
  },
  {
    id: "wallet_trade_history",
    description: "Get trade history for a wallet, sorted by timestamp",
    tables: ["Trade", "Wallet"],
    whereColumns: ["walletId"],
    orderByColumns: ["timestamp"],
    joinColumns: ["walletId"],
    frequency: "very_high",
    sampleQuery: "SELECT * FROM \"Trade\" WHERE \"walletId\" = ? ORDER BY timestamp DESC LIMIT 50",
    idealIndexes: ["trade_walletId_timestamp"],
  },
  {
    id: "market_trade_feed",
    description: "Get recent trades for a market",
    tables: ["Trade", "Market"],
    whereColumns: ["marketId"],
    orderByColumns: ["timestamp"],
    joinColumns: ["marketId"],
    frequency: "very_high",
    sampleQuery: "SELECT * FROM \"Trade\" WHERE \"marketId\" = ? ORDER BY timestamp DESC LIMIT 100",
    idealIndexes: ["trade_marketId_timestamp"],
  },
  {
    id: "whale_trade_alerts",
    description: "Get recent whale trades above a value threshold",
    tables: ["Trade"],
    whereColumns: ["isWhale", "timestamp", "usdValue"],
    orderByColumns: ["timestamp"],
    joinColumns: [],
    frequency: "high",
    sampleQuery: "SELECT * FROM \"Trade\" WHERE \"isWhale\" = true AND timestamp > NOW() - INTERVAL '24 hours' ORDER BY timestamp DESC",
    idealIndexes: ["trade_isWhale_timestamp", "trade_timestamp_usdValue"],
  },
  {
    id: "unread_alerts",
    description: "Get unread alerts for notification badge",
    tables: ["Alert"],
    whereColumns: ["read"],
    orderByColumns: ["createdAt"],
    joinColumns: [],
    frequency: "very_high",
    sampleQuery: "SELECT COUNT(*) FROM \"Alert\" WHERE read = false",
    idealIndexes: ["alert_read"],
  },
  {
    id: "market_price_chart",
    description: "Get price history for market charting",
    tables: ["PriceHistory"],
    whereColumns: ["marketId", "interval", "timestamp"],
    orderByColumns: ["timestamp"],
    joinColumns: [],
    frequency: "very_high",
    sampleQuery: "SELECT * FROM \"PriceHistory\" WHERE \"marketId\" = ? AND interval = 'HOUR_1' AND timestamp > NOW() - INTERVAL '7 days' ORDER BY timestamp",
    idealIndexes: ["priceHistory_marketId_interval_timestamp"],
  },
  {
    id: "top_whales_leaderboard",
    description: "Get top whale wallets by volume",
    tables: ["Wallet"],
    whereColumns: ["isWhale"],
    orderByColumns: ["totalVolume"],
    joinColumns: [],
    frequency: "high",
    sampleQuery: "SELECT * FROM \"Wallet\" WHERE \"isWhale\" = true ORDER BY \"totalVolume\" DESC LIMIT 100",
    idealIndexes: ["wallet_isWhale_totalVolume"],
  },
  {
    id: "pending_jobs",
    description: "Get next jobs to process",
    tables: ["JobQueue"],
    whereColumns: ["status", "scheduledFor"],
    orderByColumns: ["priority", "scheduledFor"],
    joinColumns: [],
    frequency: "very_high",
    sampleQuery: "SELECT * FROM \"JobQueue\" WHERE status = 'PENDING' AND \"scheduledFor\" <= NOW() ORDER BY priority, \"scheduledFor\" LIMIT 10",
    idealIndexes: ["jobQueue_status_scheduledFor"],
  },
  {
    id: "high_risk_wallets",
    description: "Get wallets with high suspicion scores",
    tables: ["Wallet"],
    whereColumns: ["isInsider", "suspicionScore", "riskLevel"],
    orderByColumns: ["suspicionScore"],
    joinColumns: [],
    frequency: "high",
    sampleQuery: "SELECT * FROM \"Wallet\" WHERE \"suspicionScore\" > 70 ORDER BY \"suspicionScore\" DESC LIMIT 50",
    idealIndexes: ["wallet_suspicionScore", "wallet_isInsider_suspicionScore"],
  },
  {
    id: "wallet_positions_in_market",
    description: "Get all trades by a wallet in a specific market",
    tables: ["Trade"],
    whereColumns: ["walletId", "marketId"],
    orderByColumns: ["timestamp"],
    joinColumns: [],
    frequency: "high",
    sampleQuery: "SELECT * FROM \"Trade\" WHERE \"walletId\" = ? AND \"marketId\" = ? ORDER BY timestamp",
    idealIndexes: ["trade_marketId_walletId"],
  },
];

// ===========================================================================
// INDEX SERVICE
// ===========================================================================

/**
 * Database Indexing Optimization Service
 *
 * Provides utilities for analyzing query performance, documenting indexes,
 * and generating optimization recommendations.
 */
export class IndexService {
  private prisma: PrismaClient;
  private logger: (level: string, message: string, meta?: Record<string, unknown>) => void;

  constructor(config: IndexServiceConfig = {}) {
    this.prisma = config.prisma ?? defaultPrisma;
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger implementation
   */
  private defaultLogger(
    level: string,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[${timestamp}] [IndexService] [${level.toUpperCase()}] ${message}${metaStr}`);
  }

  // =========================================================================
  // INDEX CATALOG ACCESS
  // =========================================================================

  /**
   * Get all documented indexes
   */
  getAllIndexes(): IndexDefinition[] {
    return [...INDEX_CATALOG];
  }

  /**
   * Get indexes for a specific table
   */
  getIndexesForTable(table: string): IndexDefinition[] {
    return INDEX_CATALOG.filter(idx => idx.table === table);
  }

  /**
   * Get composite indexes only
   */
  getCompositeIndexes(): IndexDefinition[] {
    return INDEX_CATALOG.filter(idx => idx.isComposite);
  }

  /**
   * Get indexes by priority
   */
  getIndexesByPriority(priority: number): IndexDefinition[] {
    return INDEX_CATALOG.filter(idx => idx.priority === priority);
  }

  /**
   * Get indexes supporting a query pattern
   */
  getIndexesForQueryPattern(patternId: string): IndexDefinition[] {
    return INDEX_CATALOG.filter(idx => idx.queryPatterns.includes(patternId));
  }

  /**
   * Get index by ID
   */
  getIndexById(id: string): IndexDefinition | undefined {
    return INDEX_CATALOG.find(idx => idx.id === id);
  }

  // =========================================================================
  // QUERY PATTERN ACCESS
  // =========================================================================

  /**
   * Get all documented query patterns
   */
  getAllQueryPatterns(): QueryPattern[] {
    return [...QUERY_PATTERNS];
  }

  /**
   * Get query pattern by ID
   */
  getQueryPatternById(id: string): QueryPattern | undefined {
    return QUERY_PATTERNS.find(qp => qp.id === id);
  }

  /**
   * Get query patterns by frequency
   */
  getQueryPatternsByFrequency(frequency: QueryPattern["frequency"]): QueryPattern[] {
    return QUERY_PATTERNS.filter(qp => qp.frequency === frequency);
  }

  /**
   * Get query patterns for a table
   */
  getQueryPatternsForTable(table: string): QueryPattern[] {
    return QUERY_PATTERNS.filter(qp => qp.tables.includes(table));
  }

  // =========================================================================
  // QUERY PERFORMANCE ANALYSIS
  // =========================================================================

  /**
   * Analyze query performance using EXPLAIN
   */
  async analyzeQuery(query: string, _params?: unknown[]): Promise<QueryPlan> {
    this.logger("debug", "Analyzing query", { query });

    try {
      const explainQuery = `EXPLAIN (FORMAT JSON) ${query}`;
      const result = await this.prisma.$queryRawUnsafe<{ "QUERY PLAN": unknown }[]>(explainQuery);

      const plan = result[0]?.["QUERY PLAN"];
      const planData = Array.isArray(plan) ? plan[0] : plan;

      return this.parseQueryPlan(query, planData);
    } catch (error) {
      this.logger("error", "Failed to analyze query", { error: String(error) });
      throw error;
    }
  }

  /**
   * Analyze query with execution (EXPLAIN ANALYZE)
   */
  async analyzeQueryWithExecution(query: string, params?: unknown[]): Promise<QueryPerformance> {
    this.logger("debug", "Analyzing query with execution", { query });

    try {
      const explainQuery = `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`;
      const result = await this.prisma.$queryRawUnsafe<{ "QUERY PLAN": unknown }[]>(explainQuery);

      const plan = result[0]?.["QUERY PLAN"];
      const planData = Array.isArray(plan) ? plan[0] : plan;

      const queryPlan = this.parseQueryPlan(query, planData);
      return this.parseQueryPerformance(query, params, queryPlan, planData);
    } catch (error) {
      this.logger("error", "Failed to analyze query with execution", { error: String(error) });
      throw error;
    }
  }

  /**
   * Parse EXPLAIN output into QueryPlan
   */
  private parseQueryPlan(query: string, planData: unknown): QueryPlan {
    const plan = planData as Record<string, unknown>;
    const planNode = plan["Plan"] as Record<string, unknown> | undefined;

    if (!planNode) {
      return {
        query,
        planType: "Unknown",
        startupCost: 0,
        totalCost: 0,
        rows: 0,
        width: 0,
        indexesUsed: [],
        usesSeqScan: false,
        fullPlan: JSON.stringify(planData, null, 2),
      };
    }

    const nodeType = String(planNode["Node Type"] || "Unknown");
    const indexName = planNode["Index Name"] as string | undefined;
    const indexesUsed: string[] = indexName ? [indexName] : [];

    // Recursively find all index usages
    this.collectIndexesFromPlan(planNode, indexesUsed);

    return {
      query,
      planType: nodeType,
      startupCost: Number(planNode["Startup Cost"] || 0),
      totalCost: Number(planNode["Total Cost"] || 0),
      rows: Number(planNode["Plan Rows"] || 0),
      width: Number(planNode["Plan Width"] || 0),
      indexesUsed,
      usesSeqScan: this.checkForSeqScan(planNode),
      fullPlan: JSON.stringify(planData, null, 2),
    };
  }

  /**
   * Recursively collect index names from plan nodes
   */
  private collectIndexesFromPlan(node: Record<string, unknown>, indexes: string[]): void {
    const indexName = node["Index Name"] as string | undefined;
    if (indexName && !indexes.includes(indexName)) {
      indexes.push(indexName);
    }

    const plans = node["Plans"] as Record<string, unknown>[] | undefined;
    if (plans) {
      for (const subPlan of plans) {
        this.collectIndexesFromPlan(subPlan, indexes);
      }
    }
  }

  /**
   * Check if plan uses sequential scan
   */
  private checkForSeqScan(node: Record<string, unknown>): boolean {
    const nodeType = String(node["Node Type"] || "");
    if (nodeType === "Seq Scan") {
      return true;
    }

    const plans = node["Plans"] as Record<string, unknown>[] | undefined;
    if (plans) {
      for (const subPlan of plans) {
        if (this.checkForSeqScan(subPlan)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse EXPLAIN ANALYZE output into QueryPerformance
   */
  private parseQueryPerformance(
    query: string,
    params: unknown[] | undefined,
    plan: QueryPlan,
    planData: unknown
  ): QueryPerformance {
    const data = planData as Record<string, unknown>;
    const planNode = data["Plan"] as Record<string, unknown> | undefined;

    const executionTime = Number(data["Execution Time"] || 0);
    const planningTime = Number(data["Planning Time"] || 0);
    const actualRows = Number(planNode?.["Actual Rows"] || 0);

    // Determine efficiency and rating
    const indexEfficient = !plan.usesSeqScan && plan.indexesUsed.length > 0;
    const rating = this.rateQueryPerformance(executionTime, plan.usesSeqScan, plan.rows);
    const recommendations = this.generateQueryRecommendations(plan, executionTime);

    return {
      query,
      params,
      plan,
      executionTimeMs: executionTime,
      planningTimeMs: planningTime,
      actualRows,
      indexEfficient,
      rating,
      recommendations,
    };
  }

  /**
   * Rate query performance
   */
  private rateQueryPerformance(
    executionTimeMs: number,
    usesSeqScan: boolean,
    estimatedRows: number
  ): QueryPerformance["rating"] {
    // Penalize seq scans on large tables
    if (usesSeqScan && estimatedRows > 10000) {
      if (executionTimeMs > 1000) return "poor";
      if (executionTimeMs > 500) return "fair";
    }

    if (executionTimeMs < 10) return "excellent";
    if (executionTimeMs < 100) return "good";
    if (executionTimeMs < 500) return "fair";
    return "poor";
  }

  /**
   * Generate optimization recommendations for a single query
   */
  private generateQueryRecommendations(plan: QueryPlan, executionTimeMs: number): string[] {
    const recommendations: string[] = [];

    if (plan.usesSeqScan && plan.rows > 1000) {
      recommendations.push(
        "Consider adding an index to avoid sequential scan on large table"
      );
    }

    if (executionTimeMs > 100 && plan.indexesUsed.length === 0) {
      recommendations.push(
        "Query does not use any indexes. Review WHERE and ORDER BY columns for indexing."
      );
    }

    if (plan.totalCost > 10000) {
      recommendations.push(
        "High query cost detected. Consider query optimization or adding composite indexes."
      );
    }

    if (plan.rows > 100000 && !plan.planType.includes("Index")) {
      recommendations.push(
        "Large result set without index usage. Consider adding covering indexes."
      );
    }

    return recommendations;
  }

  // =========================================================================
  // DATABASE STATISTICS
  // =========================================================================

  /**
   * Get index usage statistics from pg_stat_user_indexes
   */
  async getIndexUsageStats(): Promise<IndexUsageStats[]> {
    try {
      const result = await this.prisma.$queryRaw<IndexUsageStats[]>`
        SELECT
          schemaname,
          relname as "tableName",
          indexrelname as "indexName",
          idx_scan as "indexScans",
          idx_tup_read as "indexTuplesRead",
          idx_tup_fetch as "indexTuplesFetched",
          pg_relation_size(indexrelid) as "indexSizeBytes"
        FROM pg_stat_user_indexes
        ORDER BY relname, indexrelname
      `;

      return result.map(stat => ({
        ...stat,
        indexSizeFormatted: this.formatBytes(Number(stat.indexSizeBytes)),
        isUsed: Number(stat.indexScans) > 0,
        efficiencyScore: this.calculateIndexEfficiency(stat),
      }));
    } catch (error) {
      this.logger("error", "Failed to get index usage stats", { error: String(error) });
      return [];
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<TableStats[]> {
    try {
      const result = await this.prisma.$queryRaw<TableStats[]>`
        SELECT
          relname as "tableName",
          n_live_tup as "rowCount",
          pg_total_relation_size(relid) as "tableSizeBytes",
          pg_indexes_size(relid) as "indexesSizeBytes",
          (SELECT count(*) FROM pg_indexes WHERE tablename = relname) as "indexCount",
          seq_scan as "seqScans",
          idx_scan as "indexScans",
          n_dead_tup as "deadTuples"
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `;

      return result.map(stat => ({
        ...stat,
        tableSizeFormatted: this.formatBytes(Number(stat.tableSizeBytes)),
        indexesSizeFormatted: this.formatBytes(Number(stat.indexesSizeBytes)),
        indexScanRatio: Number(stat.indexScans) / (Number(stat.seqScans) + Number(stat.indexScans) + 1),
      }));
    } catch (error) {
      this.logger("error", "Failed to get table stats", { error: String(error) });
      return [];
    }
  }

  /**
   * Get unused indexes
   */
  async getUnusedIndexes(): Promise<IndexUsageStats[]> {
    const stats = await this.getIndexUsageStats();
    return stats.filter(stat => !stat.isUsed);
  }

  /**
   * Get index efficiency ranking
   */
  async getIndexEfficiencyRanking(): Promise<IndexUsageStats[]> {
    const stats = await this.getIndexUsageStats();
    return stats
      .filter(stat => stat.isUsed)
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  }

  // =========================================================================
  // RECOMMENDATIONS
  // =========================================================================

  /**
   * Generate index recommendations based on query patterns and usage stats
   */
  async generateRecommendations(): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    const tableStats = await this.getTableStats();
    const indexStats = await this.getIndexUsageStats();

    // Check for tables with low index scan ratio
    for (const table of tableStats) {
      if (table.indexScanRatio < 0.5 && Number(table.rowCount) > 1000) {
        const existingIndexes = indexStats.filter(
          idx => idx.tableName === table.tableName
        );

        if (existingIndexes.length < 3) {
          recommendations.push({
            table: table.tableName,
            columns: ["(analyze query patterns)"],
            type: "btree",
            reason: `Low index scan ratio (${(table.indexScanRatio * 100).toFixed(1)}%) with ${table.rowCount} rows`,
            expectedImprovement: "high",
            createSql: `-- Analyze query patterns for ${table.tableName} to determine optimal index columns`,
            priority: 1,
          });
        }
      }
    }

    // Check for missing composite indexes based on patterns
    for (const pattern of QUERY_PATTERNS) {
      if (pattern.frequency === "very_high" && pattern.whereColumns.length > 1) {
        const table = pattern.tables[0];
        const existingComposite = INDEX_CATALOG.find(
          idx =>
            idx.table === table &&
            idx.isComposite &&
            pattern.whereColumns.every(col => idx.columns.includes(col))
        );

        if (!existingComposite) {
          recommendations.push({
            table: table!,
            columns: pattern.whereColumns,
            type: "btree",
            reason: `High-frequency query pattern "${pattern.id}" lacks optimal composite index`,
            expectedImprovement: "high",
            createSql: `CREATE INDEX IF NOT EXISTS "${table}_${pattern.whereColumns.join('_')}_idx" ON "${table}" (${pattern.whereColumns.map(c => `"${c}"`).join(', ')})`,
            priority: 1,
          });
        }
      }
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Calculate index efficiency score
   */
  private calculateIndexEfficiency(stat: IndexUsageStats): number {
    const scans = Number(stat.indexScans);
    const reads = Number(stat.indexTuplesRead);
    const fetches = Number(stat.indexTuplesFetched);

    if (scans === 0) return 0;

    // Efficiency based on ratio of fetched to read (higher is better)
    const readEfficiency = reads > 0 ? (fetches / reads) * 100 : 100;

    // Frequency score based on usage
    const frequencyScore = Math.min(scans / 100, 100);

    return Math.round((readEfficiency + frequencyScore) / 2);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<{
    totalIndexes: number;
    compositeIndexes: number;
    tablesWithIndexes: number;
    indexesByTable: Record<string, number>;
    highPriorityPatterns: number;
    recommendations: number;
  }> {
    const recommendations = await this.generateRecommendations();
    const tables = new Set(INDEX_CATALOG.map(idx => idx.table));
    const indexesByTable: Record<string, number> = {};

    for (const idx of INDEX_CATALOG) {
      indexesByTable[idx.table] = (indexesByTable[idx.table] || 0) + 1;
    }

    return {
      totalIndexes: INDEX_CATALOG.length,
      compositeIndexes: INDEX_CATALOG.filter(idx => idx.isComposite).length,
      tablesWithIndexes: tables.size,
      indexesByTable,
      highPriorityPatterns: QUERY_PATTERNS.filter(qp => qp.frequency === "very_high").length,
      recommendations: recommendations.length,
    };
  }
}

// ===========================================================================
// SINGLETON AND FACTORY
// ===========================================================================

/**
 * Default index service instance
 */
export const indexService = new IndexService();

/**
 * Create a new index service instance with custom configuration
 */
export function createIndexService(config: IndexServiceConfig = {}): IndexService {
  return new IndexService(config);
}
