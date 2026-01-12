/**
 * Sybil Attack Detector (DET-PAT-009)
 *
 * Detect potential sybil attacks using multiple wallets on Polymarket.
 * This module identifies clusters of wallets that are likely controlled by
 * a single entity attempting to appear as independent actors.
 *
 * Features:
 * - Identify wallet clusters with similar behavior
 * - Analyze funding patterns for shared sources
 * - Detect behavioral fingerprinting matches
 * - Score sybil probability for wallet clusters
 * - Flag high-risk sybil clusters
 * - Support batch analysis and caching
 * - Event emission for sybil detection alerts
 */

import { EventEmitter } from "events";
import { isAddress, getAddress } from "viem";

// ============================================================================
// Types
// ============================================================================

/**
 * Type of sybil indicator detected
 */
export enum SybilIndicatorType {
  /** Unknown - insufficient data */
  UNKNOWN = "UNKNOWN",
  /** Wallets funded from same source */
  SHARED_FUNDING_SOURCE = "SHARED_FUNDING_SOURCE",
  /** Wallets created in quick succession */
  TEMPORAL_CREATION_CLUSTER = "TEMPORAL_CREATION_CLUSTER",
  /** Similar behavioral patterns */
  BEHAVIORAL_FINGERPRINT = "BEHAVIORAL_FINGERPRINT",
  /** Identical trading strategies */
  IDENTICAL_STRATEGIES = "IDENTICAL_STRATEGIES",
  /** Sequential transaction patterns */
  SEQUENTIAL_TRANSACTIONS = "SEQUENTIAL_TRANSACTIONS",
  /** Gas price/nonce patterns suggesting same operator */
  GAS_PATTERN_MATCH = "GAS_PATTERN_MATCH",
  /** Similar contract interactions */
  CONTRACT_INTERACTION_MATCH = "CONTRACT_INTERACTION_MATCH",
  /** IP/metadata correlation (if available) */
  METADATA_CORRELATION = "METADATA_CORRELATION",
  /** Circular funding patterns */
  CIRCULAR_FUNDING = "CIRCULAR_FUNDING",
  /** Fresh wallets acting in coordination */
  FRESH_WALLET_SWARM = "FRESH_WALLET_SWARM",
  /** Multiple indicators detected */
  MULTI_INDICATOR = "MULTI_INDICATOR",
}

/**
 * Confidence level in sybil detection
 */
export enum SybilConfidence {
  /** Very low - minimal indicators */
  VERY_LOW = "VERY_LOW",
  /** Low confidence */
  LOW = "LOW",
  /** Medium confidence */
  MEDIUM = "MEDIUM",
  /** High confidence */
  HIGH = "HIGH",
  /** Very high - strong evidence */
  VERY_HIGH = "VERY_HIGH",
}

/**
 * Risk level for sybil cluster
 */
export enum SybilRiskLevel {
  /** No significant risk */
  NONE = "NONE",
  /** Low risk - may be benign */
  LOW = "LOW",
  /** Medium risk - warrants monitoring */
  MEDIUM = "MEDIUM",
  /** High risk - likely sybil attack */
  HIGH = "HIGH",
  /** Critical - definite sybil indicators */
  CRITICAL = "CRITICAL",
}

/**
 * Specific flags for sybil detection
 */
export enum SybilFlag {
  /** Same funding address */
  SAME_FUNDER = "SAME_FUNDER",
  /** Created within suspicious time window */
  CREATION_TIME_CLUSTER = "CREATION_TIME_CLUSTER",
  /** Identical trade timing patterns */
  TIMING_FINGERPRINT = "TIMING_FINGERPRINT",
  /** Same gas price preferences */
  GAS_PRICE_MATCH = "GAS_PRICE_MATCH",
  /** Sequential nonce patterns */
  NONCE_SEQUENCE = "NONCE_SEQUENCE",
  /** Identical market selection */
  MARKET_SELECTION_MATCH = "MARKET_SELECTION_MATCH",
  /** Same position sizing strategy */
  SIZE_STRATEGY_MATCH = "SIZE_STRATEGY_MATCH",
  /** Wallets never interact with each other */
  NO_CROSS_INTERACTION = "NO_CROSS_INTERACTION",
  /** Funds flow in circular pattern */
  CIRCULAR_FLOW = "CIRCULAR_FLOW",
  /** All wallets active/inactive at same times */
  SYNCHRONIZED_ACTIVITY = "SYNCHRONIZED_ACTIVITY",
  /** Same token approval patterns */
  APPROVAL_PATTERN_MATCH = "APPROVAL_PATTERN_MATCH",
  /** Identical withdrawal destinations */
  SHARED_WITHDRAWAL_DEST = "SHARED_WITHDRAWAL_DEST",
  /** Bot-like precision in all wallets */
  BOT_SIGNATURE = "BOT_SIGNATURE",
  /** All wallets are fresh */
  ALL_FRESH_WALLETS = "ALL_FRESH_WALLETS",
}

/**
 * Wallet data for sybil analysis
 */
export interface SybilWallet {
  /** Wallet address */
  address: string;
  /** Wallet creation timestamp (first activity) */
  creationTimestamp: number;
  /** First funding source address */
  fundingSource?: string;
  /** Total funding received in USD */
  totalFundingUsd?: number;
  /** Number of unique funders */
  uniqueFunderCount?: number;
  /** First trade timestamp */
  firstTradeTimestamp?: number;
  /** Total trade count */
  tradeCount: number;
  /** Total volume in USD */
  totalVolumeUsd: number;
  /** Unique markets traded */
  uniqueMarketsTraded: number;
  /** Average trade size in USD */
  avgTradeSizeUsd: number;
  /** Win rate (0-1) */
  winRate?: number;
  /** Active hours (0-23) */
  activeHours?: number[];
  /** Average gas price used (gwei) */
  avgGasPrice?: number;
  /** Last activity timestamp */
  lastActivityTimestamp: number;
  /** Is wallet fresh (< 7 days) */
  isFresh: boolean;
}

/**
 * Trade data for sybil behavioral analysis
 */
export interface SybilTrade {
  /** Unique trade ID */
  tradeId: string;
  /** Wallet address */
  walletAddress: string;
  /** Market ID */
  marketId: string;
  /** Trade side */
  side: "buy" | "sell";
  /** Trade size in USD */
  sizeUsd: number;
  /** Trade price */
  price: number;
  /** Trade timestamp (ms) */
  timestamp: number;
  /** Gas price used (gwei) */
  gasPrice?: number;
  /** Transaction nonce */
  nonce?: number;
}

/**
 * Funding transaction for sybil analysis
 */
export interface FundingTransaction {
  /** Transaction hash */
  txHash: string;
  /** Sender address */
  from: string;
  /** Receiver address */
  to: string;
  /** Amount in native token */
  amount: number;
  /** Amount in USD */
  amountUsd: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Wallet pair sybil similarity metrics
 */
export interface WalletSybilSimilarity {
  /** First wallet address */
  walletA: string;
  /** Second wallet address */
  walletB: string;
  /** Overall sybil score (0-100) */
  sybilScore: number;
  /** Funding source match score (0-1) */
  fundingSourceMatch: number;
  /** Creation time proximity score (0-1) */
  creationProximity: number;
  /** Behavioral fingerprint match (0-1) */
  behavioralMatch: number;
  /** Trading pattern similarity (0-1) */
  tradingPatternSimilarity: number;
  /** Gas usage similarity (0-1) */
  gasUsageSimilarity: number;
  /** Activity timing correlation (0-1) */
  activityTimingCorrelation: number;
  /** Market selection overlap (0-1) */
  marketSelectionOverlap: number;
  /** Position sizing similarity (0-1) */
  positionSizingSimilarity: number;
  /** Sybil flags detected */
  flags: SybilFlag[];
  /** Are wallets likely sybils */
  isLikelySybil: boolean;
}

/**
 * A cluster of suspected sybil wallets
 */
export interface SybilCluster {
  /** Unique cluster ID */
  clusterId: string;
  /** Member wallet addresses */
  members: string[];
  /** Number of members */
  memberCount: number;
  /** Primary sybil indicator */
  primaryIndicator: SybilIndicatorType;
  /** All indicators detected */
  indicators: SybilIndicatorType[];
  /** Confidence in sybil detection */
  confidence: SybilConfidence;
  /** Risk level */
  riskLevel: SybilRiskLevel;
  /** Sybil probability score (0-100) */
  sybilProbability: number;
  /** Common funding sources */
  commonFundingSources: string[];
  /** Total trades by cluster */
  totalTrades: number;
  /** Total volume by cluster */
  totalVolumeUsd: number;
  /** Shared markets */
  sharedMarkets: string[];
  /** Pair-wise similarities */
  pairSimilarities: WalletSybilSimilarity[];
  /** All flags from pairs */
  flags: SybilFlag[];
  /** Suspected operator address (if identified) */
  suspectedOperator?: string;
  /** Detection timestamp */
  detectedAt: number;
  /** Last updated timestamp */
  updatedAt: number;
  /** Human-readable description */
  description: string;
}

/**
 * Result of sybil analysis for a wallet
 */
export interface SybilAnalysisResult {
  /** Wallet address analyzed */
  walletAddress: string;
  /** Whether wallet is likely part of sybil cluster */
  isLikelySybil: boolean;
  /** Sybil probability (0-100) */
  sybilProbability: number;
  /** Confidence in analysis */
  confidence: SybilConfidence;
  /** Risk level */
  riskLevel: SybilRiskLevel;
  /** Clusters wallet belongs to */
  clusters: SybilCluster[];
  /** Related wallets (potential sybils) */
  relatedWallets: string[];
  /** Detected indicators */
  indicators: SybilIndicatorType[];
  /** Detected flags */
  flags: SybilFlag[];
  /** Analysis timestamp */
  analyzedAt: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Result of batch sybil analysis
 */
export interface BatchSybilAnalysisResult {
  /** Individual analysis results */
  results: Map<string, SybilAnalysisResult>;
  /** All detected clusters */
  clusters: SybilCluster[];
  /** Total wallets analyzed */
  totalWalletsAnalyzed: number;
  /** Wallets flagged as sybils */
  sybilWalletCount: number;
  /** High risk clusters */
  highRiskClusters: SybilCluster[];
  /** Analysis duration (ms) */
  analysisDurationMs: number;
}

/**
 * Threshold configuration for sybil detection
 */
export interface SybilThresholdConfig {
  /** Minimum sybil score to flag (0-100) */
  minSybilScore: number;
  /** Creation time window for clustering (ms) */
  creationTimeWindow: number;
  /** Minimum funding source match for flag */
  minFundingSourceMatch: number;
  /** Minimum behavioral match for flag */
  minBehavioralMatch: number;
  /** Minimum trading pattern similarity */
  minTradingPatternSimilarity: number;
  /** Minimum gas usage similarity */
  minGasUsageSimilarity: number;
  /** Minimum activity timing correlation */
  minActivityTimingCorrelation: number;
  /** Minimum market selection overlap */
  minMarketSelectionOverlap: number;
  /** Minimum cluster size for detection */
  minClusterSize: number;
  /** Maximum cluster size to analyze */
  maxClusterSize: number;
  /** Minimum trades for analysis */
  minTradesForAnalysis: number;
}

/**
 * Configuration for SybilAttackDetector
 */
export interface SybilAttackDetectorConfig {
  /** Detection thresholds */
  thresholds: SybilThresholdConfig;
  /** Enable caching */
  enableCaching: boolean;
  /** Cache TTL in ms */
  cacheTtlMs: number;
  /** Emit events */
  emitEvents: boolean;
  /** Include pair similarities in results */
  includePairSimilarities: boolean;
  /** Max wallets for batch analysis */
  maxBatchSize: number;
}

/**
 * Options for sybil analysis
 */
export interface AnalyzeSybilOptions {
  /** Force fresh analysis (ignore cache) */
  forceRefresh?: boolean;
  /** Include related wallet details */
  includeRelatedDetails?: boolean;
  /** Minimum trades for the wallet to be analyzed */
  minTrades?: number;
}

/**
 * Summary of sybil detection state
 */
export interface SybilDetectorSummary {
  /** Total wallets tracked */
  totalWallets: number;
  /** Total trades tracked */
  totalTrades: number;
  /** Total clusters detected */
  totalClusters: number;
  /** High risk clusters */
  highRiskClusterCount: number;
  /** Wallets flagged as sybils */
  sybilWalletCount: number;
  /** Cluster size distribution */
  clusterSizeDistribution: Record<string, number>;
  /** Most common indicators */
  topIndicators: { indicator: SybilIndicatorType; count: number }[];
  /** Most common flags */
  topFlags: { flag: SybilFlag; count: number }[];
  /** Cache hit rate */
  cacheHitRate: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default sybil detection thresholds
 */
export const DEFAULT_SYBIL_THRESHOLDS: SybilThresholdConfig = {
  minSybilScore: 60,
  creationTimeWindow: 24 * 60 * 60 * 1000, // 24 hours
  minFundingSourceMatch: 0.8,
  minBehavioralMatch: 0.7,
  minTradingPatternSimilarity: 0.75,
  minGasUsageSimilarity: 0.8,
  minActivityTimingCorrelation: 0.7,
  minMarketSelectionOverlap: 0.6,
  minClusterSize: 2,
  maxClusterSize: 100,
  minTradesForAnalysis: 3,
};

/**
 * Default detector configuration
 */
const DEFAULT_CONFIG: SybilAttackDetectorConfig = {
  thresholds: DEFAULT_SYBIL_THRESHOLDS,
  enableCaching: true,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  emitEvents: true,
  includePairSimilarities: true,
  maxBatchSize: 1000,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize wallet address
 */
function normalizeAddress(address: string): string {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address);
}

/**
 * Generate unique cluster ID
 */
function generateClusterId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate creation time proximity score
 */
function calculateCreationProximity(
  timestampA: number,
  timestampB: number,
  windowMs: number
): number {
  const diff = Math.abs(timestampA - timestampB);
  if (diff >= windowMs) return 0;
  return 1 - diff / windowMs;
}

/**
 * Calculate array similarity using Jaccard index
 */
function calculateJaccardSimilarity<T>(arrA: T[], arrB: T[]): number {
  if (arrA.length === 0 && arrB.length === 0) return 1;
  if (arrA.length === 0 || arrB.length === 0) return 0;

  const setA = new Set(arrA);
  const setB = new Set(arrB);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate numeric similarity (0-1) based on relative difference
 */
function calculateNumericSimilarity(
  valueA: number,
  valueB: number,
  maxDiffRatio: number = 0.5
): number {
  if (valueA === 0 && valueB === 0) return 1;
  if (valueA === 0 || valueB === 0) return 0;

  const diff = Math.abs(valueA - valueB);
  const avg = (valueA + valueB) / 2;
  const ratio = diff / avg;

  if (ratio >= maxDiffRatio) return 0;
  return 1 - ratio / maxDiffRatio;
}

/**
 * Calculate hour distribution similarity
 */
function calculateHourDistributionSimilarity(
  hoursA: number[],
  hoursB: number[]
): number {
  if (hoursA.length === 0 || hoursB.length === 0) return 0;

  // Create frequency distributions
  const freqA = new Array(24).fill(0);
  const freqB = new Array(24).fill(0);

  hoursA.forEach((h) => freqA[h]++);
  hoursB.forEach((h) => freqB[h]++);

  // Normalize
  const sumA = hoursA.length;
  const sumB = hoursB.length;

  // Calculate cosine similarity
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 24; i++) {
    const a = freqA[i] / sumA;
    const b = freqB[i] / sumB;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Determine sybil indicator type from flags
 */
function determineIndicatorType(flags: SybilFlag[]): SybilIndicatorType {
  if (flags.length === 0) return SybilIndicatorType.UNKNOWN;
  if (flags.length > 3) return SybilIndicatorType.MULTI_INDICATOR;

  // Priority order for primary indicator
  if (
    flags.includes(SybilFlag.SAME_FUNDER) ||
    flags.includes(SybilFlag.CIRCULAR_FLOW)
  ) {
    return SybilIndicatorType.SHARED_FUNDING_SOURCE;
  }
  if (flags.includes(SybilFlag.CREATION_TIME_CLUSTER)) {
    return SybilIndicatorType.TEMPORAL_CREATION_CLUSTER;
  }
  if (
    flags.includes(SybilFlag.TIMING_FINGERPRINT) ||
    flags.includes(SybilFlag.SYNCHRONIZED_ACTIVITY)
  ) {
    return SybilIndicatorType.BEHAVIORAL_FINGERPRINT;
  }
  if (
    flags.includes(SybilFlag.MARKET_SELECTION_MATCH) &&
    flags.includes(SybilFlag.SIZE_STRATEGY_MATCH)
  ) {
    return SybilIndicatorType.IDENTICAL_STRATEGIES;
  }
  if (
    flags.includes(SybilFlag.GAS_PRICE_MATCH) ||
    flags.includes(SybilFlag.NONCE_SEQUENCE)
  ) {
    return SybilIndicatorType.GAS_PATTERN_MATCH;
  }
  if (flags.includes(SybilFlag.ALL_FRESH_WALLETS)) {
    return SybilIndicatorType.FRESH_WALLET_SWARM;
  }

  return SybilIndicatorType.BEHAVIORAL_FINGERPRINT;
}

/**
 * Determine confidence level from sybil score
 */
function determineConfidence(sybilScore: number): SybilConfidence {
  if (sybilScore >= 90) return SybilConfidence.VERY_HIGH;
  if (sybilScore >= 75) return SybilConfidence.HIGH;
  if (sybilScore >= 60) return SybilConfidence.MEDIUM;
  if (sybilScore >= 40) return SybilConfidence.LOW;
  return SybilConfidence.VERY_LOW;
}

/**
 * Determine risk level from sybil score and cluster size
 */
function determineRiskLevel(
  sybilScore: number,
  clusterSize: number,
  totalVolumeUsd: number
): SybilRiskLevel {
  // Factor in cluster size and volume
  const sizeFactor = Math.min(clusterSize / 10, 1);
  const volumeFactor = Math.min(totalVolumeUsd / 100000, 1);
  const adjustedScore = sybilScore * (1 + sizeFactor * 0.2 + volumeFactor * 0.1);

  if (adjustedScore >= 85) return SybilRiskLevel.CRITICAL;
  if (adjustedScore >= 70) return SybilRiskLevel.HIGH;
  if (adjustedScore >= 50) return SybilRiskLevel.MEDIUM;
  if (adjustedScore >= 30) return SybilRiskLevel.LOW;
  return SybilRiskLevel.NONE;
}

/**
 * Generate human-readable description for cluster
 */
function generateClusterDescription(cluster: SybilCluster): string {
  const parts: string[] = [];

  parts.push(`Cluster of ${cluster.memberCount} wallets`);

  if (cluster.sybilProbability >= 80) {
    parts.push("with high probability of being controlled by same entity");
  } else if (cluster.sybilProbability >= 60) {
    parts.push("with moderate probability of sybil behavior");
  } else {
    parts.push("with some sybil indicators");
  }

  if (cluster.commonFundingSources.length > 0) {
    parts.push(`sharing ${cluster.commonFundingSources.length} funding source(s)`);
  }

  if (cluster.totalVolumeUsd > 0) {
    parts.push(`totaling $${cluster.totalVolumeUsd.toLocaleString()} in volume`);
  }

  return parts.join(" ");
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Sybil Attack Detector
 *
 * Detects potential sybil attacks by analyzing wallet clusters for
 * indicators of shared control.
 */
export class SybilAttackDetector extends EventEmitter {
  private config: SybilAttackDetectorConfig;
  private wallets: Map<string, SybilWallet> = new Map();
  private trades: Map<string, SybilTrade[]> = new Map();
  private fundingTxs: Map<string, FundingTransaction[]> = new Map();
  private clusters: Map<string, SybilCluster> = new Map();
  private walletToCluster: Map<string, Set<string>> = new Map();
  private analysisCache: Map<string, { result: SybilAnalysisResult; timestamp: number }> =
    new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(config: Partial<SybilAttackDetectorConfig> = {}) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_SYBIL_THRESHOLDS,
        ...config.thresholds,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Data Management
  // --------------------------------------------------------------------------

  /**
   * Add or update wallet data
   */
  addWallet(wallet: SybilWallet): void {
    const address = normalizeAddress(wallet.address);
    this.wallets.set(address, { ...wallet, address });
    this.invalidateCacheForWallet(address);
  }

  /**
   * Add multiple wallets
   */
  addWallets(wallets: SybilWallet[]): void {
    wallets.forEach((w) => this.addWallet(w));
  }

  /**
   * Add trade for a wallet
   */
  addTrade(trade: SybilTrade): void {
    const address = normalizeAddress(trade.walletAddress);
    const trades = this.trades.get(address) || [];
    trades.push({ ...trade, walletAddress: address });
    this.trades.set(address, trades);
    this.invalidateCacheForWallet(address);
  }

  /**
   * Add multiple trades
   */
  addTrades(trades: SybilTrade[]): void {
    trades.forEach((t) => this.addTrade(t));
  }

  /**
   * Add funding transaction
   */
  addFundingTransaction(tx: FundingTransaction): void {
    const to = normalizeAddress(tx.to);
    const txs = this.fundingTxs.get(to) || [];
    txs.push({ ...tx, to });
    this.fundingTxs.set(to, txs);
    this.invalidateCacheForWallet(to);
  }

  /**
   * Add multiple funding transactions
   */
  addFundingTransactions(txs: FundingTransaction[]): void {
    txs.forEach((tx) => this.addFundingTransaction(tx));
  }

  /**
   * Get wallet data
   */
  getWallet(address: string): SybilWallet | undefined {
    return this.wallets.get(normalizeAddress(address));
  }

  /**
   * Get trades for wallet
   */
  getWalletTrades(address: string): SybilTrade[] {
    return this.trades.get(normalizeAddress(address)) || [];
  }

  /**
   * Get all tracked wallets
   */
  getAllWallets(): string[] {
    return Array.from(this.wallets.keys());
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.wallets.clear();
    this.trades.clear();
    this.fundingTxs.clear();
    this.clusters.clear();
    this.walletToCluster.clear();
    this.analysisCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // --------------------------------------------------------------------------
  // Pair Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze similarity between two wallets for sybil indicators
   */
  analyzeWalletPair(addressA: string, addressB: string): WalletSybilSimilarity {
    const walletA = this.wallets.get(normalizeAddress(addressA));
    const walletB = this.wallets.get(normalizeAddress(addressB));

    if (!walletA || !walletB) {
      return {
        walletA: addressA,
        walletB: addressB,
        sybilScore: 0,
        fundingSourceMatch: 0,
        creationProximity: 0,
        behavioralMatch: 0,
        tradingPatternSimilarity: 0,
        gasUsageSimilarity: 0,
        activityTimingCorrelation: 0,
        marketSelectionOverlap: 0,
        positionSizingSimilarity: 0,
        flags: [],
        isLikelySybil: false,
      };
    }

    const tradesA = this.trades.get(walletA.address) || [];
    const tradesB = this.trades.get(walletB.address) || [];
    const fundingA = this.fundingTxs.get(walletA.address) || [];
    const fundingB = this.fundingTxs.get(walletB.address) || [];

    const flags: SybilFlag[] = [];

    // Calculate funding source match
    let fundingSourceMatch = 0;
    if (fundingA.length > 0 && fundingB.length > 0) {
      const fundersA = new Set(fundingA.map((f) => f.from.toLowerCase()));
      const fundersB = new Set(fundingB.map((f) => f.from.toLowerCase()));
      const sharedFunders = new Set([...fundersA].filter((x) => fundersB.has(x)));
      if (sharedFunders.size > 0) {
        fundingSourceMatch = sharedFunders.size / Math.min(fundersA.size, fundersB.size);
        if (fundingSourceMatch >= this.config.thresholds.minFundingSourceMatch) {
          flags.push(SybilFlag.SAME_FUNDER);
        }
      }
    } else if (
      walletA.fundingSource &&
      walletB.fundingSource &&
      walletA.fundingSource.toLowerCase() === walletB.fundingSource.toLowerCase()
    ) {
      fundingSourceMatch = 1;
      flags.push(SybilFlag.SAME_FUNDER);
    }

    // Calculate creation proximity
    const creationProximity = calculateCreationProximity(
      walletA.creationTimestamp,
      walletB.creationTimestamp,
      this.config.thresholds.creationTimeWindow
    );
    if (creationProximity >= 0.8) {
      flags.push(SybilFlag.CREATION_TIME_CLUSTER);
    }

    // Calculate trading pattern similarity
    const marketsA = new Set(tradesA.map((t) => t.marketId));
    const marketsB = new Set(tradesB.map((t) => t.marketId));
    const marketSelectionOverlap = calculateJaccardSimilarity(
      Array.from(marketsA),
      Array.from(marketsB)
    );
    if (marketSelectionOverlap >= this.config.thresholds.minMarketSelectionOverlap) {
      flags.push(SybilFlag.MARKET_SELECTION_MATCH);
    }

    // Calculate position sizing similarity
    const positionSizingSimilarity = calculateNumericSimilarity(
      walletA.avgTradeSizeUsd,
      walletB.avgTradeSizeUsd,
      0.3
    );
    if (positionSizingSimilarity >= 0.8) {
      flags.push(SybilFlag.SIZE_STRATEGY_MATCH);
    }

    // Calculate gas usage similarity
    let gasUsageSimilarity = 0;
    if (walletA.avgGasPrice && walletB.avgGasPrice) {
      gasUsageSimilarity = calculateNumericSimilarity(
        walletA.avgGasPrice,
        walletB.avgGasPrice,
        0.2
      );
      if (gasUsageSimilarity >= this.config.thresholds.minGasUsageSimilarity) {
        flags.push(SybilFlag.GAS_PRICE_MATCH);
      }
    }

    // Calculate activity timing correlation
    let activityTimingCorrelation = 0;
    if (
      walletA.activeHours &&
      walletB.activeHours &&
      walletA.activeHours.length > 0 &&
      walletB.activeHours.length > 0
    ) {
      activityTimingCorrelation = calculateHourDistributionSimilarity(
        walletA.activeHours,
        walletB.activeHours
      );
      if (activityTimingCorrelation >= this.config.thresholds.minActivityTimingCorrelation) {
        flags.push(SybilFlag.TIMING_FINGERPRINT);
      }
    }

    // Check for synchronized activity
    if (
      Math.abs(walletA.lastActivityTimestamp - walletB.lastActivityTimestamp) <
      60 * 60 * 1000 // 1 hour
    ) {
      flags.push(SybilFlag.SYNCHRONIZED_ACTIVITY);
    }

    // Check for all fresh wallets
    if (walletA.isFresh && walletB.isFresh) {
      flags.push(SybilFlag.ALL_FRESH_WALLETS);
    }

    // Calculate behavioral match (composite)
    const behavioralMatch =
      (activityTimingCorrelation +
        marketSelectionOverlap +
        positionSizingSimilarity +
        (walletA.winRate !== undefined && walletB.winRate !== undefined
          ? calculateNumericSimilarity(walletA.winRate, walletB.winRate, 0.2)
          : 0)) /
      4;

    // Calculate trading pattern similarity (composite)
    const tradingPatternSimilarity =
      (marketSelectionOverlap + positionSizingSimilarity) / 2;

    // Calculate overall sybil score
    const weights = {
      fundingSourceMatch: 0.25,
      creationProximity: 0.15,
      behavioralMatch: 0.2,
      tradingPatternSimilarity: 0.15,
      gasUsageSimilarity: 0.1,
      activityTimingCorrelation: 0.15,
    };

    const sybilScore = Math.min(
      100,
      Math.round(
        (fundingSourceMatch * weights.fundingSourceMatch +
          creationProximity * weights.creationProximity +
          behavioralMatch * weights.behavioralMatch +
          tradingPatternSimilarity * weights.tradingPatternSimilarity +
          gasUsageSimilarity * weights.gasUsageSimilarity +
          activityTimingCorrelation * weights.activityTimingCorrelation) *
          100
      )
    );

    // Add flag bonus
    const flagBonus = Math.min(20, flags.length * 5);
    const finalScore = Math.min(100, sybilScore + flagBonus);

    return {
      walletA: walletA.address,
      walletB: walletB.address,
      sybilScore: finalScore,
      fundingSourceMatch,
      creationProximity,
      behavioralMatch,
      tradingPatternSimilarity,
      gasUsageSimilarity,
      activityTimingCorrelation,
      marketSelectionOverlap,
      positionSizingSimilarity,
      flags,
      isLikelySybil: finalScore >= this.config.thresholds.minSybilScore,
    };
  }

  // --------------------------------------------------------------------------
  // Cluster Detection
  // --------------------------------------------------------------------------

  /**
   * Detect sybil clusters from all tracked wallets
   */
  detectClusters(): SybilCluster[] {
    const walletAddresses = Array.from(this.wallets.keys());
    const n = walletAddresses.length;

    if (n < this.config.thresholds.minClusterSize) {
      return [];
    }

    // Build similarity graph
    const similarities: Map<string, Map<string, WalletSybilSimilarity>> = new Map();
    const sybilPairs: Array<[string, string, WalletSybilSimilarity]> = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const addrA = walletAddresses[i]!;
        const addrB = walletAddresses[j]!;
        const similarity = this.analyzeWalletPair(addrA, addrB);

        if (!similarities.has(addrA)) similarities.set(addrA, new Map());
        if (!similarities.has(addrB)) similarities.set(addrB, new Map());
        similarities.get(addrA)!.set(addrB, similarity);
        similarities.get(addrB)!.set(addrA, similarity);

        if (similarity.isLikelySybil) {
          sybilPairs.push([addrA, addrB, similarity]);
        }
      }
    }

    // Build clusters using union-find
    const parent: Map<string, string> = new Map();
    const rank: Map<string, number> = new Map();

    function find(x: string): string {
      if (!parent.has(x)) {
        parent.set(x, x);
        rank.set(x, 0);
      }
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    }

    function union(x: string, y: string): void {
      const rootX = find(x);
      const rootY = find(y);
      if (rootX !== rootY) {
        const rankX = rank.get(rootX) || 0;
        const rankY = rank.get(rootY) || 0;
        if (rankX < rankY) {
          parent.set(rootX, rootY);
        } else if (rankX > rankY) {
          parent.set(rootY, rootX);
        } else {
          parent.set(rootY, rootX);
          rank.set(rootX, rankX + 1);
        }
      }
    }

    // Union sybil pairs
    for (const [addrA, addrB] of sybilPairs) {
      union(addrA, addrB);
    }

    // Group by root
    const clusterMembers: Map<string, string[]> = new Map();
    for (const addr of walletAddresses) {
      if (parent.has(addr)) {
        const root = find(addr);
        if (!clusterMembers.has(root)) {
          clusterMembers.set(root, []);
        }
        clusterMembers.get(root)!.push(addr);
      }
    }

    // Build cluster objects
    const detectedClusters: SybilCluster[] = [];

    for (const [_root, members] of clusterMembers) {
      if (
        members.length < this.config.thresholds.minClusterSize ||
        members.length > this.config.thresholds.maxClusterSize
      ) {
        continue;
      }

      const pairSimilarities: WalletSybilSimilarity[] = [];
      const allFlags: Set<SybilFlag> = new Set();
      let totalSybilScore = 0;
      let pairCount = 0;

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const sim = similarities.get(members[i]!)?.get(members[j]!);
          if (sim) {
            pairSimilarities.push(sim);
            totalSybilScore += sim.sybilScore;
            pairCount++;
            sim.flags.forEach((f) => allFlags.add(f));
          }
        }
      }

      const avgSybilScore = pairCount > 0 ? totalSybilScore / pairCount : 0;
      const flags = Array.from(allFlags);
      const indicators: SybilIndicatorType[] = [determineIndicatorType(flags)];

      // Calculate cluster stats
      let totalTrades = 0;
      let totalVolumeUsd = 0;
      const allMarkets: Set<string> = new Set();
      const fundingSources: Set<string> = new Set();

      for (const addr of members) {
        const wallet = this.wallets.get(addr);
        const trades = this.trades.get(addr) || [];
        const funding = this.fundingTxs.get(addr) || [];

        if (wallet) {
          totalTrades += wallet.tradeCount;
          totalVolumeUsd += wallet.totalVolumeUsd;
        }
        trades.forEach((t) => allMarkets.add(t.marketId));
        funding.forEach((f) => fundingSources.add(f.from.toLowerCase()));
        if (wallet?.fundingSource) {
          fundingSources.add(wallet.fundingSource.toLowerCase());
        }
      }

      // Find shared markets (traded by all members)
      const marketCounts: Map<string, number> = new Map();
      for (const addr of members) {
        const trades = this.trades.get(addr) || [];
        const walletMarkets = new Set(trades.map((t) => t.marketId));
        walletMarkets.forEach((m) => {
          marketCounts.set(m, (marketCounts.get(m) || 0) + 1);
        });
      }
      const sharedMarkets = Array.from(marketCounts.entries())
        .filter(([_, count]) => count === members.length)
        .map(([market]) => market);

      const riskLevel = determineRiskLevel(avgSybilScore, members.length, totalVolumeUsd);
      const confidence = determineConfidence(avgSybilScore);

      const cluster: SybilCluster = {
        clusterId: generateClusterId(),
        members,
        memberCount: members.length,
        primaryIndicator: indicators[0] ?? SybilIndicatorType.UNKNOWN,
        indicators,
        confidence,
        riskLevel,
        sybilProbability: Math.round(avgSybilScore),
        commonFundingSources: Array.from(fundingSources),
        totalTrades,
        totalVolumeUsd,
        sharedMarkets,
        pairSimilarities: this.config.includePairSimilarities ? pairSimilarities : [],
        flags,
        detectedAt: Date.now(),
        updatedAt: Date.now(),
        description: "",
      };

      cluster.description = generateClusterDescription(cluster);
      detectedClusters.push(cluster);

      // Store cluster
      this.clusters.set(cluster.clusterId, cluster);
      for (const addr of members) {
        if (!this.walletToCluster.has(addr)) {
          this.walletToCluster.set(addr, new Set());
        }
        this.walletToCluster.get(addr)!.add(cluster.clusterId);
      }

      // Emit event
      if (this.config.emitEvents) {
        this.emit("clusterDetected", cluster);
      }
    }

    return detectedClusters;
  }

  // --------------------------------------------------------------------------
  // Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze a single wallet for sybil indicators
   */
  analyzeWallet(
    address: string,
    options: AnalyzeSybilOptions = {}
  ): SybilAnalysisResult {
    const normalizedAddress = normalizeAddress(address);

    // Check cache
    if (this.config.enableCaching && !options.forceRefresh) {
      const cached = this.analysisCache.get(normalizedAddress);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTtlMs) {
        this.cacheHits++;
        return cached.result;
      }
    }
    this.cacheMisses++;

    const wallet = this.wallets.get(normalizedAddress);
    const trades = this.trades.get(normalizedAddress) || [];

    // Check minimum trades
    const minTrades = options.minTrades ?? this.config.thresholds.minTradesForAnalysis;
    if (!wallet || trades.length < minTrades) {
      const result: SybilAnalysisResult = {
        walletAddress: normalizedAddress,
        isLikelySybil: false,
        sybilProbability: 0,
        confidence: SybilConfidence.VERY_LOW,
        riskLevel: SybilRiskLevel.NONE,
        clusters: [],
        relatedWallets: [],
        indicators: [],
        flags: [],
        analyzedAt: Date.now(),
        summary: "Insufficient data for sybil analysis",
      };

      if (this.config.enableCaching) {
        this.analysisCache.set(normalizedAddress, { result, timestamp: Date.now() });
      }
      return result;
    }

    // Find related wallets
    const relatedWallets: string[] = [];
    const clusterIds = this.walletToCluster.get(normalizedAddress) || new Set();
    const allClusters: SybilCluster[] = [];

    for (const clusterId of clusterIds) {
      const cluster = this.clusters.get(clusterId);
      if (cluster) {
        allClusters.push(cluster);
        cluster.members
          .filter((m) => m !== normalizedAddress)
          .forEach((m) => relatedWallets.push(m));
      }
    }

    // If no clusters yet, run detection
    if (allClusters.length === 0 && this.wallets.size >= this.config.thresholds.minClusterSize) {
      this.detectClusters();
      const newClusterIds = this.walletToCluster.get(normalizedAddress) || new Set();
      for (const clusterId of newClusterIds) {
        const cluster = this.clusters.get(clusterId);
        if (cluster) {
          allClusters.push(cluster);
          cluster.members
            .filter((m) => m !== normalizedAddress)
            .forEach((m) => relatedWallets.push(m));
        }
      }
    }

    // Calculate overall sybil probability
    let maxSybilProbability = 0;
    let maxRiskLevel = SybilRiskLevel.NONE;
    const allIndicators: Set<SybilIndicatorType> = new Set();
    const allFlags: Set<SybilFlag> = new Set();

    for (const cluster of allClusters) {
      if (cluster.sybilProbability > maxSybilProbability) {
        maxSybilProbability = cluster.sybilProbability;
      }
      if (this.riskLevelValue(cluster.riskLevel) > this.riskLevelValue(maxRiskLevel)) {
        maxRiskLevel = cluster.riskLevel;
      }
      cluster.indicators.forEach((i) => allIndicators.add(i));
      cluster.flags.forEach((f) => allFlags.add(f));
    }

    const isLikelySybil = maxSybilProbability >= this.config.thresholds.minSybilScore;
    const confidence = determineConfidence(maxSybilProbability);

    const result: SybilAnalysisResult = {
      walletAddress: normalizedAddress,
      isLikelySybil,
      sybilProbability: maxSybilProbability,
      confidence,
      riskLevel: maxRiskLevel,
      clusters: allClusters,
      relatedWallets: [...new Set(relatedWallets)],
      indicators: Array.from(allIndicators),
      flags: Array.from(allFlags),
      analyzedAt: Date.now(),
      summary: this.generateAnalysisSummary(
        isLikelySybil,
        maxSybilProbability,
        allClusters.length,
        relatedWallets.length
      ),
    };

    if (this.config.enableCaching) {
      this.analysisCache.set(normalizedAddress, { result, timestamp: Date.now() });
    }

    if (this.config.emitEvents && isLikelySybil) {
      this.emit("sybilDetected", result);
    }

    return result;
  }

  /**
   * Batch analyze multiple wallets
   */
  batchAnalyze(
    addresses: string[],
    options: AnalyzeSybilOptions = {}
  ): BatchSybilAnalysisResult {
    const startTime = Date.now();
    const limitedAddresses = addresses.slice(0, this.config.maxBatchSize);

    // Run cluster detection first
    this.detectClusters();

    const results: Map<string, SybilAnalysisResult> = new Map();
    let sybilWalletCount = 0;

    for (const address of limitedAddresses) {
      const result = this.analyzeWallet(address, options);
      results.set(normalizeAddress(address), result);
      if (result.isLikelySybil) {
        sybilWalletCount++;
      }
    }

    const highRiskClusters = Array.from(this.clusters.values()).filter(
      (c) =>
        c.riskLevel === SybilRiskLevel.HIGH || c.riskLevel === SybilRiskLevel.CRITICAL
    );

    return {
      results,
      clusters: Array.from(this.clusters.values()),
      totalWalletsAnalyzed: limitedAddresses.length,
      sybilWalletCount,
      highRiskClusters,
      analysisDurationMs: Date.now() - startTime,
    };
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Check if wallet is likely a sybil
   */
  isWalletLikelySybil(address: string): boolean {
    const result = this.analyzeWallet(address);
    return result.isLikelySybil;
  }

  /**
   * Get all detected clusters
   */
  getClusters(): SybilCluster[] {
    return Array.from(this.clusters.values());
  }

  /**
   * Get high risk clusters
   */
  getHighRiskClusters(): SybilCluster[] {
    return Array.from(this.clusters.values()).filter(
      (c) =>
        c.riskLevel === SybilRiskLevel.HIGH || c.riskLevel === SybilRiskLevel.CRITICAL
    );
  }

  /**
   * Get clusters for a wallet
   */
  getWalletClusters(address: string): SybilCluster[] {
    const normalizedAddress = normalizeAddress(address);
    const clusterIds = this.walletToCluster.get(normalizedAddress) || new Set();
    return Array.from(clusterIds)
      .map((id) => this.clusters.get(id))
      .filter((c): c is SybilCluster => c !== undefined);
  }

  /**
   * Get summary of detector state
   */
  getSummary(): SybilDetectorSummary {
    const clusters = Array.from(this.clusters.values());
    const sybilWallets = new Set<string>();

    clusters.forEach((c) => {
      if (c.sybilProbability >= this.config.thresholds.minSybilScore) {
        c.members.forEach((m) => sybilWallets.add(m));
      }
    });

    // Calculate cluster size distribution
    const sizeDistribution: Record<string, number> = {};
    clusters.forEach((c) => {
      const sizeKey =
        c.memberCount <= 5
          ? `${c.memberCount}`
          : c.memberCount <= 10
          ? "6-10"
          : c.memberCount <= 20
          ? "11-20"
          : "21+";
      sizeDistribution[sizeKey] = (sizeDistribution[sizeKey] || 0) + 1;
    });

    // Count indicators
    const indicatorCounts: Map<SybilIndicatorType, number> = new Map();
    clusters.forEach((c) => {
      c.indicators.forEach((i) => {
        indicatorCounts.set(i, (indicatorCounts.get(i) || 0) + 1);
      });
    });
    const topIndicators = Array.from(indicatorCounts.entries())
      .map(([indicator, count]) => ({ indicator, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Count flags
    const flagCounts: Map<SybilFlag, number> = new Map();
    clusters.forEach((c) => {
      c.flags.forEach((f) => {
        flagCounts.set(f, (flagCounts.get(f) || 0) + 1);
      });
    });
    const topFlags = Array.from(flagCounts.entries())
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0;

    return {
      totalWallets: this.wallets.size,
      totalTrades: Array.from(this.trades.values()).reduce((sum, t) => sum + t.length, 0),
      totalClusters: clusters.length,
      highRiskClusterCount: clusters.filter(
        (c) =>
          c.riskLevel === SybilRiskLevel.HIGH || c.riskLevel === SybilRiskLevel.CRITICAL
      ).length,
      sybilWalletCount: sybilWallets.size,
      clusterSizeDistribution: sizeDistribution,
      topIndicators,
      topFlags,
      cacheHitRate,
      lastUpdated: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  /**
   * Invalidate cache for a wallet
   */
  private invalidateCacheForWallet(address: string): void {
    this.analysisCache.delete(address);
    // Also invalidate related wallets in same clusters
    const clusterIds = this.walletToCluster.get(address) || new Set();
    for (const clusterId of clusterIds) {
      const cluster = this.clusters.get(clusterId);
      if (cluster) {
        cluster.members.forEach((m) => this.analysisCache.delete(m));
      }
    }
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Convert risk level to numeric value for comparison
   */
  private riskLevelValue(level: SybilRiskLevel): number {
    switch (level) {
      case SybilRiskLevel.NONE:
        return 0;
      case SybilRiskLevel.LOW:
        return 1;
      case SybilRiskLevel.MEDIUM:
        return 2;
      case SybilRiskLevel.HIGH:
        return 3;
      case SybilRiskLevel.CRITICAL:
        return 4;
    }
  }

  /**
   * Generate analysis summary text
   */
  private generateAnalysisSummary(
    isLikelySybil: boolean,
    probability: number,
    clusterCount: number,
    relatedCount: number
  ): string {
    if (!isLikelySybil) {
      return "No significant sybil indicators detected";
    }

    const parts: string[] = [];

    if (probability >= 80) {
      parts.push("High probability of sybil behavior");
    } else if (probability >= 60) {
      parts.push("Moderate probability of sybil behavior");
    } else {
      parts.push("Some sybil indicators present");
    }

    if (clusterCount > 0) {
      parts.push(`found in ${clusterCount} cluster(s)`);
    }

    if (relatedCount > 0) {
      parts.push(`with ${relatedCount} related wallet(s)`);
    }

    return parts.join(", ");
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new SybilAttackDetector instance
 */
export function createSybilAttackDetector(
  config: Partial<SybilAttackDetectorConfig> = {}
): SybilAttackDetector {
  return new SybilAttackDetector(config);
}

// Shared instance
let sharedInstance: SybilAttackDetector | null = null;

/**
 * Get the shared SybilAttackDetector instance
 */
export function getSharedSybilAttackDetector(): SybilAttackDetector {
  if (!sharedInstance) {
    sharedInstance = new SybilAttackDetector();
  }
  return sharedInstance;
}

/**
 * Set the shared SybilAttackDetector instance
 */
export function setSharedSybilAttackDetector(detector: SybilAttackDetector): void {
  sharedInstance = detector;
}

/**
 * Reset the shared SybilAttackDetector instance
 */
export function resetSharedSybilAttackDetector(): void {
  sharedInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Add wallets for sybil analysis using shared instance
 */
export function addWalletsForSybilAnalysis(wallets: SybilWallet[]): void {
  getSharedSybilAttackDetector().addWallets(wallets);
}

/**
 * Add trades for sybil analysis using shared instance
 */
export function addTradesForSybilAnalysis(trades: SybilTrade[]): void {
  getSharedSybilAttackDetector().addTrades(trades);
}

/**
 * Analyze wallet for sybil indicators using shared instance
 */
export function analyzeWalletForSybil(
  address: string,
  options?: AnalyzeSybilOptions
): SybilAnalysisResult {
  return getSharedSybilAttackDetector().analyzeWallet(address, options);
}

/**
 * Batch analyze wallets for sybil indicators using shared instance
 */
export function batchAnalyzeForSybil(
  addresses: string[],
  options?: AnalyzeSybilOptions
): BatchSybilAnalysisResult {
  return getSharedSybilAttackDetector().batchAnalyze(addresses, options);
}

/**
 * Check if wallet is likely a sybil using shared instance
 */
export function isWalletSybil(address: string): boolean {
  return getSharedSybilAttackDetector().isWalletLikelySybil(address);
}

/**
 * Get detected sybil clusters using shared instance
 */
export function getDetectedSybilClusters(): SybilCluster[] {
  return getSharedSybilAttackDetector().getClusters();
}

/**
 * Get high risk sybil clusters using shared instance
 */
export function getHighRiskSybilClusters(): SybilCluster[] {
  return getSharedSybilAttackDetector().getHighRiskClusters();
}

/**
 * Get sybil detector summary using shared instance
 */
export function getSybilDetectorSummary(): SybilDetectorSummary {
  return getSharedSybilAttackDetector().getSummary();
}

// ============================================================================
// Description Functions
// ============================================================================

/**
 * Get human-readable description for sybil indicator
 */
export function getSybilIndicatorDescription(indicator: SybilIndicatorType): string {
  switch (indicator) {
    case SybilIndicatorType.UNKNOWN:
      return "Unknown indicator";
    case SybilIndicatorType.SHARED_FUNDING_SOURCE:
      return "Wallets funded from the same source";
    case SybilIndicatorType.TEMPORAL_CREATION_CLUSTER:
      return "Wallets created in quick succession";
    case SybilIndicatorType.BEHAVIORAL_FINGERPRINT:
      return "Similar behavioral patterns detected";
    case SybilIndicatorType.IDENTICAL_STRATEGIES:
      return "Identical trading strategies employed";
    case SybilIndicatorType.SEQUENTIAL_TRANSACTIONS:
      return "Sequential transaction patterns";
    case SybilIndicatorType.GAS_PATTERN_MATCH:
      return "Matching gas price/nonce patterns";
    case SybilIndicatorType.CONTRACT_INTERACTION_MATCH:
      return "Similar contract interaction patterns";
    case SybilIndicatorType.METADATA_CORRELATION:
      return "Metadata correlation detected";
    case SybilIndicatorType.CIRCULAR_FUNDING:
      return "Circular funding pattern detected";
    case SybilIndicatorType.FRESH_WALLET_SWARM:
      return "Group of fresh wallets acting together";
    case SybilIndicatorType.MULTI_INDICATOR:
      return "Multiple sybil indicators detected";
  }
}

/**
 * Get human-readable description for sybil confidence
 */
export function getSybilConfidenceDescription(confidence: SybilConfidence): string {
  switch (confidence) {
    case SybilConfidence.VERY_LOW:
      return "Very low confidence - minimal indicators";
    case SybilConfidence.LOW:
      return "Low confidence - some indicators present";
    case SybilConfidence.MEDIUM:
      return "Medium confidence - moderate evidence";
    case SybilConfidence.HIGH:
      return "High confidence - strong evidence";
    case SybilConfidence.VERY_HIGH:
      return "Very high confidence - conclusive evidence";
  }
}

/**
 * Get human-readable description for sybil risk level
 */
export function getSybilRiskDescription(risk: SybilRiskLevel): string {
  switch (risk) {
    case SybilRiskLevel.NONE:
      return "No significant sybil risk";
    case SybilRiskLevel.LOW:
      return "Low risk - may be benign";
    case SybilRiskLevel.MEDIUM:
      return "Medium risk - warrants monitoring";
    case SybilRiskLevel.HIGH:
      return "High risk - likely sybil attack";
    case SybilRiskLevel.CRITICAL:
      return "Critical risk - definite sybil indicators";
  }
}

/**
 * Get human-readable description for sybil flag
 */
export function getSybilFlagDescription(flag: SybilFlag): string {
  switch (flag) {
    case SybilFlag.SAME_FUNDER:
      return "Funded by the same address";
    case SybilFlag.CREATION_TIME_CLUSTER:
      return "Created within suspicious time window";
    case SybilFlag.TIMING_FINGERPRINT:
      return "Identical timing patterns";
    case SybilFlag.GAS_PRICE_MATCH:
      return "Same gas price preferences";
    case SybilFlag.NONCE_SEQUENCE:
      return "Sequential nonce patterns";
    case SybilFlag.MARKET_SELECTION_MATCH:
      return "Identical market selection";
    case SybilFlag.SIZE_STRATEGY_MATCH:
      return "Same position sizing strategy";
    case SybilFlag.NO_CROSS_INTERACTION:
      return "Wallets never interact with each other";
    case SybilFlag.CIRCULAR_FLOW:
      return "Funds flow in circular pattern";
    case SybilFlag.SYNCHRONIZED_ACTIVITY:
      return "Synchronized activity periods";
    case SybilFlag.APPROVAL_PATTERN_MATCH:
      return "Same token approval patterns";
    case SybilFlag.SHARED_WITHDRAWAL_DEST:
      return "Identical withdrawal destinations";
    case SybilFlag.BOT_SIGNATURE:
      return "Bot-like precision in all wallets";
    case SybilFlag.ALL_FRESH_WALLETS:
      return "All wallets are fresh";
  }
}
