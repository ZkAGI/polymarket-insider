/**
 * Benchmark Definitions
 *
 * Implements the actual benchmark functions for measuring system performance.
 * These benchmarks use synthetic data processing to measure algorithmic performance.
 */

import { BenchmarkDefinition } from "./types";
import * as targets from "./targets";

// ============================================================================
// Test Data Generators
// ============================================================================

function generateWalletAddress(): string {
  return "0x" + Math.random().toString(16).slice(2).padStart(40, "0");
}

function generateMarketId(): string {
  return "market-" + Math.random().toString(36).slice(2, 10);
}

function generateTradeId(): string {
  return "trade-" + Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// Synthetic Processing Functions
// ============================================================================

/**
 * Simulates wallet age calculation from cached data
 */
function calculateWalletAge(firstTxTimestamp: number): {
  ageInDays: number;
  ageInHours: number;
  category: string;
  isFresh: boolean;
} {
  const now = Date.now();
  const ageMs = now - firstTxTimestamp;
  const ageInDays = ageMs / (1000 * 60 * 60 * 24);
  const ageInHours = ageMs / (1000 * 60 * 60);

  let category: string;
  if (ageInDays <= 7) category = "VERY_FRESH";
  else if (ageInDays <= 30) category = "FRESH";
  else if (ageInDays <= 90) category = "RECENT";
  else if (ageInDays <= 365) category = "ESTABLISHED";
  else category = "MATURE";

  return {
    ageInDays,
    ageInHours,
    category,
    isFresh: ageInDays <= 30,
  };
}

/**
 * Simulates fresh wallet threshold evaluation
 */
function evaluateFreshWalletThreshold(params: {
  walletAgeDays: number;
  transactionCount: number;
  tradingHistoryCount: number;
  firstTradeSize: number;
}): { isFresh: boolean; severity: string; score: number } {
  const { walletAgeDays, transactionCount, tradingHistoryCount, firstTradeSize } = params;

  let score = 0;
  if (walletAgeDays < 7) score += 30;
  else if (walletAgeDays < 30) score += 20;
  if (transactionCount < 5) score += 20;
  if (tradingHistoryCount === 0) score += 30;
  if (firstTradeSize > 1000) score += 20;

  let severity: string;
  if (score >= 80) severity = "HIGH";
  else if (score >= 50) severity = "MEDIUM";
  else if (score >= 20) severity = "LOW";
  else severity = "NONE";

  return {
    isFresh: walletAgeDays < 30 || tradingHistoryCount === 0,
    severity,
    score,
  };
}

/**
 * Simulates zero history check
 */
function checkZeroHistory(polymarketTradeCount: number): {
  hasZeroHistory: boolean;
  status: string;
} {
  return {
    hasZeroHistory: polymarketTradeCount === 0,
    status: polymarketTradeCount === 0 ? "ZERO_HISTORY" : "HAS_HISTORY",
  };
}

/**
 * Simulates first trade size analysis with statistics
 */
function analyzeFirstTradeSize(
  tradeSize: number,
  marketStats: { mean: number; stdDev: number; percentiles: number[] }
): { percentile: number; isOutlier: boolean; zScore: number } {
  const zScore = (tradeSize - marketStats.mean) / marketStats.stdDev;
  const percentile = marketStats.percentiles.filter((p) => p <= tradeSize).length / marketStats.percentiles.length * 100;

  return {
    percentile,
    isOutlier: Math.abs(zScore) > 2,
    zScore,
  };
}

/**
 * Simulates funding pattern analysis
 */
function analyzeFundingPattern(params: {
  deposits: Array<{ amount: number; timestamp: number }>;
  firstTradeTimestamp: number;
}): { pattern: string; timeToFirstTrade: number; isFlashTrading: boolean } {
  const { deposits, firstTradeTimestamp } = params;

  if (deposits.length === 0) {
    return { pattern: "UNKNOWN", timeToFirstTrade: 0, isFlashTrading: false };
  }

  const lastDeposit = deposits.reduce((latest, d) =>
    d.timestamp > latest.timestamp ? d : latest
  );

  const timeToFirstTrade = firstTradeTimestamp - lastDeposit.timestamp;
  const isFlashTrading = timeToFirstTrade < 60000; // Less than 1 minute

  let pattern: string;
  if (isFlashTrading) pattern = "FLASH_TRADING";
  else if (timeToFirstTrade < 3600000) pattern = "QUICK_TRADING";
  else pattern = "NORMAL";

  return { pattern, timeToFirstTrade, isFlashTrading };
}

/**
 * Simulates wallet clustering
 */
function clusterWallets(wallets: Array<{
  address: string;
  fundingSource: string;
  creationTime: number;
}>): { clusters: string[][]; clusterCount: number } {
  const fundingGroups = new Map<string, string[]>();

  for (const wallet of wallets) {
    const existing = fundingGroups.get(wallet.fundingSource) || [];
    existing.push(wallet.address);
    fundingGroups.set(wallet.fundingSource, existing);
  }

  const clusters = Array.from(fundingGroups.values()).filter((c) => c.length > 1);

  return { clusters, clusterCount: clusters.length };
}

/**
 * Simulates wallet reactivation check
 */
function checkWalletReactivation(params: {
  lastActivityTimestamp: number;
  currentActivityTimestamp: number;
  dormancyThresholdDays: number;
}): { isReactivation: boolean; dormancyDays: number } {
  const dormancyMs = params.currentActivityTimestamp - params.lastActivityTimestamp;
  const dormancyDays = dormancyMs / (1000 * 60 * 60 * 24);

  return {
    isReactivation: dormancyDays > params.dormancyThresholdDays,
    dormancyDays,
  };
}

/**
 * Simulates confidence score calculation
 */
function calculateConfidenceScore(signals: {
  ageScore: number;
  historyScore: number;
  fundingScore: number;
  tradingScore: number;
  clusterScore: number;
}): { totalScore: number; confidence: string } {
  const weights = { age: 0.25, history: 0.2, funding: 0.2, trading: 0.2, cluster: 0.15 };

  const totalScore =
    signals.ageScore * weights.age +
    signals.historyScore * weights.history +
    signals.fundingScore * weights.funding +
    signals.tradingScore * weights.trading +
    signals.clusterScore * weights.cluster;

  let confidence: string;
  if (totalScore >= 80) confidence = "HIGH";
  else if (totalScore >= 50) confidence = "MEDIUM";
  else confidence = "LOW";

  return { totalScore, confidence };
}

/**
 * Simulates history depth analysis
 */
function analyzeHistoryDepth(params: {
  totalTransactions: number;
  uniqueContracts: number;
  ageInDays: number;
}): { depthScore: number; category: string } {
  const txPerDay = params.totalTransactions / Math.max(1, params.ageInDays);
  const contractDiversity = params.uniqueContracts / Math.max(1, params.totalTransactions);

  const depthScore = Math.min(100, txPerDay * 10 + contractDiversity * 50 + params.ageInDays * 0.1);

  let category: string;
  if (depthScore >= 70) category = "DEEP";
  else if (depthScore >= 40) category = "MODERATE";
  else category = "SHALLOW";

  return { depthScore, category };
}

/**
 * Simulates alert generation
 */
function generateAlert(params: {
  walletAddress: string;
  confidenceScore: number;
  signals: Record<string, boolean>;
}): { alertId: string; severity: string; shouldAlert: boolean } {
  const activeSignals = Object.values(params.signals).filter(Boolean).length;

  const shouldAlert = params.confidenceScore >= 50 && activeSignals >= 2;
  let severity: string;
  if (params.confidenceScore >= 80) severity = "HIGH";
  else if (params.confidenceScore >= 50) severity = "MEDIUM";
  else severity = "LOW";

  return {
    alertId: "alert-" + Math.random().toString(36).slice(2),
    severity,
    shouldAlert,
  };
}

/**
 * Simulates volume baseline calculation
 */
function calculateVolumeBaseline(dataPoints: number[]): {
  mean: number;
  stdDev: number;
  percentiles: { p50: number; p90: number; p95: number; p99: number };
} {
  const sorted = [...dataPoints].sort((a, b) => a - b);
  const mean = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
  const variance = dataPoints.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / dataPoints.length;
  const stdDev = Math.sqrt(variance);

  const percentile = (p: number) => sorted[Math.floor(sorted.length * p / 100)] ?? 0;

  return {
    mean,
    stdDev,
    percentiles: {
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    },
  };
}

/**
 * Simulates rolling volume tracking
 */
class RollingVolumeStore {
  private data: Map<string, number[]> = new Map();
  private maxSize = 1000;

  addVolume(marketId: string, volume: number): void {
    const existing = this.data.get(marketId) || [];
    existing.push(volume);
    if (existing.length > this.maxSize) {
      existing.shift();
    }
    this.data.set(marketId, existing);
  }

  getAverage(marketId: string): number {
    const data = this.data.get(marketId) || [];
    return data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
  }
}

/**
 * Simulates volume spike detection
 */
function detectVolumeSpike(
  currentVolume: number,
  baseline: { mean: number; stdDev: number }
): { isSpike: boolean; spikeRatio: number; severity: string } {
  const spikeRatio = currentVolume / Math.max(1, baseline.mean);
  const zScore = (currentVolume - baseline.mean) / Math.max(1, baseline.stdDev);

  let severity: string;
  if (zScore > 4) severity = "EXTREME";
  else if (zScore > 3) severity = "HIGH";
  else if (zScore > 2) severity = "MEDIUM";
  else severity = "NONE";

  return {
    isSpike: zScore > 2,
    spikeRatio,
    severity,
  };
}

/**
 * Simulates trade size analysis
 */
function analyzeTradeSizeOutlier(
  tradeSize: number,
  marketStats: { mean: number; stdDev: number }
): { isOutlier: boolean; percentile: number; category: string } {
  const zScore = (tradeSize - marketStats.mean) / Math.max(1, marketStats.stdDev);
  const isOutlier = Math.abs(zScore) > 2;

  let category: string;
  if (zScore > 3) category = "WHALE";
  else if (zScore > 2) category = "LARGE";
  else if (zScore > 1) category = "ABOVE_AVERAGE";
  else category = "NORMAL";

  return { isOutlier, percentile: Math.min(100, 50 + zScore * 20), category };
}

/**
 * Simulates whale threshold calculation
 */
function calculateWhaleThreshold(params: {
  liquidity: number;
  dailyVolume: number;
}): { tier1: number; tier2: number; tier3: number } {
  const baseThreshold = Math.min(params.liquidity * 0.05, params.dailyVolume * 0.1);

  return {
    tier1: baseThreshold,
    tier2: baseThreshold * 2,
    tier3: baseThreshold * 5,
  };
}

/**
 * Simulates volume-to-liquidity ratio analysis
 */
function analyzeVolumeLiquidityRatio(
  tradeSize: number,
  liquidityDepth: number
): { ratio: number; severity: string; expectedSlippage: number } {
  const ratio = tradeSize / Math.max(1, liquidityDepth);
  const expectedSlippage = ratio * 0.5; // Simplified slippage model

  let severity: string;
  if (ratio > 0.5) severity = "CRITICAL";
  else if (ratio > 0.2) severity = "HIGH";
  else if (ratio > 0.1) severity = "MEDIUM";
  else severity = "LOW";

  return { ratio, severity, expectedSlippage };
}

/**
 * Simulates time-of-day volume normalization
 */
function normalizeVolumeForTime(
  volume: number,
  hourOfDay: number,
  hourlyProfile: number[]
): { normalizedVolume: number; isOffHours: boolean } {
  const expectedVolume = hourlyProfile[hourOfDay] || 1;
  const normalizedVolume = volume / expectedVolume;
  const isOffHours = hourOfDay < 6 || hourOfDay > 22;

  return { normalizedVolume, isOffHours };
}

/**
 * Simulates consecutive large trade detection
 */
function detectConsecutiveLargeTrades(
  recentTrades: Array<{ size: number; timestamp: number }>,
  largeThreshold: number
): { burstDetected: boolean; burstCount: number; totalVolume: number } {
  const largeTrades = recentTrades.filter((t) => t.size > largeThreshold);
  const burstDetected = largeTrades.length >= 3;

  return {
    burstDetected,
    burstCount: largeTrades.length,
    totalVolume: largeTrades.reduce((acc, t) => acc + t.size, 0),
  };
}

/**
 * Simulates market impact calculation
 */
function calculateMarketImpact(params: {
  tradeSize: number;
  priceBefore: number;
  priceAfter: number;
  liquidityDepth: number;
}): { impactBps: number; slippage: number; severity: string } {
  const impactBps = Math.abs(params.priceAfter - params.priceBefore) * 10000;
  const expectedImpact = (params.tradeSize / params.liquidityDepth) * 100;
  const slippage = impactBps - expectedImpact;

  let severity: string;
  if (impactBps > 200) severity = "EXCESSIVE";
  else if (impactBps > 100) severity = "HIGH";
  else if (impactBps > 50) severity = "MEDIUM";
  else severity = "LOW";

  return { impactBps, slippage, severity };
}

/**
 * Simulates volume clustering analysis
 */
function analyzeVolumeClustering(trades: Array<{
  walletAddress: string;
  timestamp: number;
  size: number;
}>): { clusterCount: number; coordinationScore: number; suspiciousWallets: string[] } {
  // Group by time windows
  const windowMs = 60000; // 1 minute windows
  const windows = new Map<number, Array<{ wallet: string; size: number }>>();

  for (const trade of trades) {
    const windowKey = Math.floor(trade.timestamp / windowMs);
    const existing = windows.get(windowKey) || [];
    existing.push({ wallet: trade.walletAddress, size: trade.size });
    windows.set(windowKey, existing);
  }

  // Find clusters (windows with multiple unique wallets)
  let clusterCount = 0;
  const suspiciousWallets = new Set<string>();

  for (const [, windowTrades] of windows) {
    const uniqueWallets = new Set(windowTrades.map((t) => t.wallet));
    if (uniqueWallets.size >= 3) {
      clusterCount++;
      for (const w of uniqueWallets) suspiciousWallets.add(w);
    }
  }

  const coordinationScore = Math.min(100, clusterCount * 20);

  return {
    clusterCount,
    coordinationScore,
    suspiciousWallets: Array.from(suspiciousWallets),
  };
}

/**
 * Simulates pre-event volume analysis
 */
function analyzePreEventVolume(params: {
  currentVolume: number;
  historicalAverage: number;
  hoursUntilEvent: number;
}): { isAnomaly: boolean; spikeRatio: number; severity: string } {
  const spikeRatio = params.currentVolume / Math.max(1, params.historicalAverage);

  // Higher sensitivity closer to event
  const sensitivityMultiplier = Math.max(1, 10 / params.hoursUntilEvent);
  const adjustedRatio = spikeRatio * sensitivityMultiplier;

  let severity: string;
  if (adjustedRatio > 5) severity = "CRITICAL";
  else if (adjustedRatio > 3) severity = "HIGH";
  else if (adjustedRatio > 2) severity = "MEDIUM";
  else severity = "LOW";

  return {
    isAnomaly: spikeRatio > 2,
    spikeRatio,
    severity,
  };
}

// ============================================================================
// Cache Implementation for Benchmarks
// ============================================================================

class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = 60000): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Simple Rate Limiter for Benchmarks
// ============================================================================

class SimpleRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens = 100, refillPerSecond = 10) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillPerSecond;
    this.lastRefill = Date.now();
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// ============================================================================
// Message Queue for Benchmarks
// ============================================================================

class SimpleMessageQueue<T> {
  private queue: T[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  enqueue(item: T): boolean {
    if (this.queue.length >= this.maxSize) {
      return false;
    }
    this.queue.push(item);
    return true;
  }

  dequeue(): T | undefined {
    return this.queue.shift();
  }

  clear(): void {
    this.queue = [];
  }
}

// ============================================================================
// Event Emitter for Benchmarks
// ============================================================================

class SimpleEventEmitter {
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  on(event: string, listener: (data: unknown) => void): void {
    const existing = this.listeners.get(event) || [];
    existing.push(listener);
    this.listeners.set(event, existing);
  }

  emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event) || [];
    for (const listener of listeners) {
      listener(data);
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// In-Memory Store for Benchmarks
// ============================================================================

class SimpleStore<T extends { id: string }> {
  private data = new Map<string, T>();

  upsert(item: T): void {
    this.data.set(item.id, item);
  }

  getById(id: string): T | undefined {
    return this.data.get(id);
  }

  clear(): void {
    this.data.clear();
  }
}

// ============================================================================
// Index Manager for Benchmarks
// ============================================================================

class SimpleIndexManager {
  private indexes = new Map<string, Map<string, Set<string>>>();

  addToIndex(indexName: string, key: string, entityId: string): void {
    let index = this.indexes.get(indexName);
    if (!index) {
      index = new Map();
      this.indexes.set(indexName, index);
    }
    let entities = index.get(key);
    if (!entities) {
      entities = new Set();
      index.set(key, entities);
    }
    entities.add(entityId);
  }

  lookup(indexName: string, key: string): Set<string> | undefined {
    const index = this.indexes.get(indexName);
    return index?.get(key);
  }
}

// ============================================================================
// Benchmark Definitions
// ============================================================================

// Shared state for benchmarks
let walletAgeCache: SimpleCache<{ ageInDays: number; category: string }>;
let testWalletAddress: string;
let firstTxTimestamp: number;

export const walletAgeBenchmark: BenchmarkDefinition = {
  target: targets.WALLET_AGE_CALCULATION,
  setup: async () => {
    walletAgeCache = new SimpleCache(10000);
    testWalletAddress = generateWalletAddress();
    firstTxTimestamp = Date.now() - 30 * 24 * 60 * 60 * 1000;
    // Pre-populate cache
    walletAgeCache.set(testWalletAddress, {
      ageInDays: 30,
      category: "FRESH",
    });
  },
  fn: async () => {
    // Simulate cached lookup + calculation
    const cached = walletAgeCache.get(testWalletAddress);
    if (!cached) {
      calculateWalletAge(firstTxTimestamp);
    }
  },
  teardown: async () => {
    walletAgeCache.clear();
  },
};

export const freshWalletThresholdBenchmark: BenchmarkDefinition = {
  target: targets.FRESH_WALLET_THRESHOLD,
  fn: async () => {
    evaluateFreshWalletThreshold({
      walletAgeDays: Math.random() * 60,
      transactionCount: Math.floor(Math.random() * 100),
      tradingHistoryCount: Math.floor(Math.random() * 20),
      firstTradeSize: Math.random() * 5000,
    });
  },
};

export const zeroHistoryBenchmark: BenchmarkDefinition = {
  target: targets.ZERO_HISTORY_CHECK,
  fn: async () => {
    checkZeroHistory(Math.floor(Math.random() * 10));
  },
};

let firstTradeMarketStats: { mean: number; stdDev: number; percentiles: number[] };

export const firstTradeSizeAnalysisBenchmark: BenchmarkDefinition = {
  target: targets.FIRST_TRADE_SIZE_ANALYSIS,
  setup: async () => {
    // Pre-calculate market stats
    const trades = Array.from({ length: 1000 }, () => Math.random() * 1000);
    const mean = trades.reduce((a, b) => a + b, 0) / trades.length;
    const stdDev = Math.sqrt(
      trades.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / trades.length
    );
    firstTradeMarketStats = {
      mean,
      stdDev,
      percentiles: trades.sort((a, b) => a - b),
    };
  },
  fn: async () => {
    analyzeFirstTradeSize(Math.random() * 2000, firstTradeMarketStats);
  },
};

export const fundingPatternAnalysisBenchmark: BenchmarkDefinition = {
  target: targets.FUNDING_PATTERN_ANALYSIS,
  fn: async () => {
    analyzeFundingPattern({
      deposits: [
        { amount: Math.random() * 10000, timestamp: Date.now() - 60000 },
        { amount: Math.random() * 5000, timestamp: Date.now() - 120000 },
      ],
      firstTradeTimestamp: Date.now(),
    });
  },
};

let clusterTestWallets: Array<{
  address: string;
  fundingSource: string;
  creationTime: number;
}>;

export const freshWalletClusteringBenchmark: BenchmarkDefinition = {
  target: targets.FRESH_WALLET_CLUSTERING,
  setup: async () => {
    const fundingSources = [
      generateWalletAddress(),
      generateWalletAddress(),
      generateWalletAddress(),
    ];
    clusterTestWallets = Array.from({ length: 20 }, (_, i) => ({
      address: generateWalletAddress(),
      fundingSource: fundingSources[i % fundingSources.length] ?? fundingSources[0]!,
      creationTime: Date.now() - Math.random() * 86400000,
    }));
  },
  fn: async () => {
    clusterWallets(clusterTestWallets);
  },
};

export const walletReactivationBenchmark: BenchmarkDefinition = {
  target: targets.WALLET_REACTIVATION,
  fn: async () => {
    checkWalletReactivation({
      lastActivityTimestamp: Date.now() - 45 * 24 * 60 * 60 * 1000,
      currentActivityTimestamp: Date.now(),
      dormancyThresholdDays: 30,
    });
  },
};

export const confidenceScoringBenchmark: BenchmarkDefinition = {
  target: targets.CONFIDENCE_SCORING,
  fn: async () => {
    calculateConfidenceScore({
      ageScore: Math.random() * 100,
      historyScore: Math.random() * 100,
      fundingScore: Math.random() * 100,
      tradingScore: Math.random() * 100,
      clusterScore: Math.random() * 100,
    });
  },
};

export const historyDepthAnalysisBenchmark: BenchmarkDefinition = {
  target: targets.HISTORY_DEPTH_ANALYSIS,
  fn: async () => {
    analyzeHistoryDepth({
      totalTransactions: Math.floor(Math.random() * 500),
      uniqueContracts: Math.floor(Math.random() * 50),
      ageInDays: Math.random() * 365,
    });
  },
};

export const freshWalletAlertBenchmark: BenchmarkDefinition = {
  target: targets.FRESH_WALLET_ALERT,
  fn: async () => {
    generateAlert({
      walletAddress: generateWalletAddress(),
      confidenceScore: Math.random() * 100,
      signals: {
        isFreshWallet: Math.random() > 0.5,
        hasZeroHistory: Math.random() > 0.7,
        largeFirstTrade: Math.random() > 0.8,
        suspiciousFunding: Math.random() > 0.85,
        inCluster: Math.random() > 0.75,
      },
    });
  },
};

let volumeDataPoints: number[];

export const volumeBaselineBenchmark: BenchmarkDefinition = {
  target: targets.VOLUME_BASELINE,
  setup: async () => {
    volumeDataPoints = Array.from({ length: 1000 }, () => 100 + Math.random() * 50);
  },
  fn: async () => {
    calculateVolumeBaseline(volumeDataPoints);
  },
};

let rollingVolumeStore: RollingVolumeStore;
let rollingMarketId: string;

export const rollingVolumeBenchmark: BenchmarkDefinition = {
  target: targets.ROLLING_VOLUME,
  setup: async () => {
    rollingVolumeStore = new RollingVolumeStore();
    rollingMarketId = generateMarketId();
    for (let i = 0; i < 100; i++) {
      rollingVolumeStore.addVolume(rollingMarketId, 100 + Math.random() * 50);
    }
  },
  fn: async () => {
    rollingVolumeStore.addVolume(rollingMarketId, Math.random() * 200);
    rollingVolumeStore.getAverage(rollingMarketId);
  },
};

let spikeBaseline: { mean: number; stdDev: number };

export const volumeSpikeBenchmark: BenchmarkDefinition = {
  target: targets.VOLUME_SPIKE,
  setup: async () => {
    const data = Array.from({ length: 500 }, () => 100 + Math.random() * 20);
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const stdDev = Math.sqrt(data.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / data.length);
    spikeBaseline = { mean, stdDev };
  },
  fn: async () => {
    detectVolumeSpike(100 + Math.random() * 500, spikeBaseline);
  },
};

let tradeSizeMarketStats: { mean: number; stdDev: number };

export const tradeSizeAnalysisBenchmark: BenchmarkDefinition = {
  target: targets.TRADE_SIZE_ANALYSIS,
  setup: async () => {
    const trades = Array.from({ length: 500 }, () => 100 + Math.random() * 200);
    const mean = trades.reduce((a, b) => a + b, 0) / trades.length;
    const stdDev = Math.sqrt(trades.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / trades.length);
    tradeSizeMarketStats = { mean, stdDev };
  },
  fn: async () => {
    analyzeTradeSizeOutlier(Math.random() * 5000, tradeSizeMarketStats);
  },
};

export const whaleThresholdBenchmark: BenchmarkDefinition = {
  target: targets.WHALE_THRESHOLD,
  fn: async () => {
    calculateWhaleThreshold({
      liquidity: Math.random() * 100000,
      dailyVolume: Math.random() * 500000,
    });
  },
};

export const volumeLiquidityRatioBenchmark: BenchmarkDefinition = {
  target: targets.VOLUME_LIQUIDITY_RATIO,
  fn: async () => {
    analyzeVolumeLiquidityRatio(Math.random() * 5000, Math.random() * 100000);
  },
};

let hourlyProfile: number[];

export const timeOfDayNormalizationBenchmark: BenchmarkDefinition = {
  target: targets.TIME_OF_DAY_NORMALIZATION,
  setup: async () => {
    hourlyProfile = Array.from({ length: 24 }, (_, h) =>
      h >= 9 && h <= 17 ? 200 + Math.random() * 50 : 50 + Math.random() * 20
    );
  },
  fn: async () => {
    normalizeVolumeForTime(Math.random() * 500, Math.floor(Math.random() * 24), hourlyProfile);
  },
};

let recentTrades: Array<{ size: number; timestamp: number }>;

export const consecutiveLargeTradesBenchmark: BenchmarkDefinition = {
  target: targets.CONSECUTIVE_LARGE_TRADES,
  setup: async () => {
    recentTrades = Array.from({ length: 20 }, () => ({
      size: Math.random() * 5000,
      timestamp: Date.now() - Math.random() * 60000,
    }));
  },
  fn: async () => {
    detectConsecutiveLargeTrades(recentTrades, 1000);
  },
};

export const marketImpactBenchmark: BenchmarkDefinition = {
  target: targets.MARKET_IMPACT,
  fn: async () => {
    calculateMarketImpact({
      tradeSize: Math.random() * 10000,
      priceBefore: 0.5 + (Math.random() - 0.5) * 0.1,
      priceAfter: 0.5 + (Math.random() - 0.5) * 0.15,
      liquidityDepth: Math.random() * 100000,
    });
  },
};

export const unusualVolumeAlertBenchmark: BenchmarkDefinition = {
  target: targets.UNUSUAL_VOLUME_ALERT,
  fn: async () => {
    generateAlert({
      walletAddress: generateMarketId(),
      confidenceScore: Math.random() * 100,
      signals: {
        volumeSpike: Math.random() > 0.5,
        largeTrade: Math.random() > 0.6,
        highImpact: Math.random() > 0.7,
      },
    });
  },
};

let clusterTrades: Array<{ walletAddress: string; timestamp: number; size: number }>;

export const volumeClusteringBenchmark: BenchmarkDefinition = {
  target: targets.VOLUME_CLUSTERING,
  setup: async () => {
    const baseTime = Date.now();
    clusterTrades = Array.from({ length: 30 }, () => ({
      walletAddress: generateWalletAddress(),
      timestamp: baseTime - Math.random() * 300000,
      size: 500 + Math.random() * 500,
    }));
  },
  fn: async () => {
    analyzeVolumeClustering(clusterTrades);
  },
};

export const preEventVolumeBenchmark: BenchmarkDefinition = {
  target: targets.PRE_EVENT_VOLUME,
  fn: async () => {
    analyzePreEventVolume({
      currentVolume: 100 + Math.random() * 500,
      historicalAverage: 100,
      hoursUntilEvent: 1 + Math.random() * 24,
    });
  },
};

// ============================================================================
// API Benchmarks
// ============================================================================

let apiCache: SimpleCache<unknown>;
let cacheKey: string;

export const apiCacheLookupBenchmark: BenchmarkDefinition = {
  target: targets.API_CACHE_LOOKUP,
  setup: async () => {
    apiCache = new SimpleCache(10000);
    cacheKey = "test-key-" + Math.random();
    apiCache.set(cacheKey, { data: "test data" });
  },
  fn: async () => {
    apiCache.get(cacheKey);
  },
  teardown: async () => {
    apiCache.clear();
  },
};

let rateLimiter: SimpleRateLimiter;

export const apiRateLimiterBenchmark: BenchmarkDefinition = {
  target: targets.API_RATE_LIMITER,
  setup: async () => {
    rateLimiter = new SimpleRateLimiter(1000, 100);
  },
  fn: async () => {
    rateLimiter.tryAcquire();
  },
};

export const tradeParsingBenchmark: BenchmarkDefinition = {
  target: targets.TRADE_PARSING,
  fn: async () => {
    // Simulate trade execution parsing
    const raw = {
      id: generateTradeId(),
      market: generateMarketId(),
      side: Math.random() > 0.5 ? "BUY" : "SELL",
      size: (Math.random() * 1000).toString(),
      price: Math.random().toFixed(4),
      timestamp: new Date().toISOString(),
    };
    // Parse and validate
    void {
      id: raw.id,
      market: raw.market,
      side: raw.side.toLowerCase(),
      size: parseFloat(raw.size),
      price: parseFloat(raw.price),
      timestamp: new Date(raw.timestamp).getTime(),
    };
  },
};

export const orderBookDepthBenchmark: BenchmarkDefinition = {
  target: targets.ORDERBOOK_DEPTH,
  fn: async () => {
    // Simulate order book depth calculation
    const bids = Array.from({ length: 50 }, () => ({
      price: Math.random(),
      size: Math.random() * 1000,
    }));
    const asks = Array.from({ length: 50 }, () => ({
      price: Math.random(),
      size: Math.random() * 1000,
    }));

    const bidDepth = bids.reduce((acc, b) => acc + b.size, 0);
    const askDepth = asks.reduce((acc, a) => acc + a.size, 0);
    const spread = (asks[0]?.price ?? 0) - (bids[0]?.price ?? 0);

    void { bidDepth, askDepth, spread };
  },
};

export const usdCalculationBenchmark: BenchmarkDefinition = {
  target: targets.USD_CALCULATION,
  fn: async () => {
    const size = Math.random() * 10000;
    const price = Math.random();
    const usdValue = size * price;
    void usdValue;
  },
};

// ============================================================================
// WebSocket Benchmarks
// ============================================================================

export const wsMessageParsingBenchmark: BenchmarkDefinition = {
  target: targets.WS_MESSAGE_PARSING,
  fn: async () => {
    const message = JSON.stringify({
      type: ["price_change", "trade", "order_book_update"][Math.floor(Math.random() * 3)],
      market: generateMarketId(),
      data: { price: Math.random(), size: Math.random() * 100 },
      timestamp: Date.now(),
    });
    JSON.parse(message);
  },
};

let messageQueue: SimpleMessageQueue<{ type: string; data: unknown }>;

export const wsMessageQueueBenchmark: BenchmarkDefinition = {
  target: targets.WS_MESSAGE_QUEUE,
  setup: async () => {
    messageQueue = new SimpleMessageQueue(10000);
  },
  fn: async () => {
    messageQueue.enqueue({ type: "test", data: {} });
    messageQueue.dequeue();
  },
  teardown: async () => {
    messageQueue.clear();
  },
};

let subscriptions: Set<string>;
let subMarketId: string;

export const wsSubscriptionLookupBenchmark: BenchmarkDefinition = {
  target: targets.WS_SUBSCRIPTION_LOOKUP,
  setup: async () => {
    subscriptions = new Set();
    for (let i = 0; i < 100; i++) {
      subscriptions.add(generateMarketId());
    }
    subMarketId = generateMarketId();
    subscriptions.add(subMarketId);
  },
  fn: async () => {
    subscriptions.has(subMarketId);
  },
};

let eventEmitter: SimpleEventEmitter;

export const wsEventDispatchBenchmark: BenchmarkDefinition = {
  target: targets.WS_EVENT_DISPATCH,
  setup: async () => {
    eventEmitter = new SimpleEventEmitter();
    for (let i = 0; i < 10; i++) {
      eventEmitter.on("test", () => {});
    }
  },
  fn: async () => {
    eventEmitter.emit("test", { type: "test", data: { value: 1 } });
  },
  teardown: async () => {
    eventEmitter.removeAllListeners();
  },
};

// ============================================================================
// Database Benchmarks
// ============================================================================

let marketStore: SimpleStore<{ id: string; slug: string; question: string }>;
let lookupMarketId: string;

export const dbMarketLookupBenchmark: BenchmarkDefinition = {
  target: targets.DB_MARKET_LOOKUP,
  setup: async () => {
    marketStore = new SimpleStore();
    for (let i = 0; i < 1000; i++) {
      const id = generateMarketId();
      marketStore.upsert({ id, slug: "slug-" + i, question: "Question " + i });
      if (i === 500) lookupMarketId = id;
    }
  },
  fn: async () => {
    marketStore.getById(lookupMarketId);
  },
};

export const dbTradeInsertPrepBenchmark: BenchmarkDefinition = {
  target: targets.DB_TRADE_INSERT_PREP,
  fn: async () => {
    // Simulate trade preparation for insert
    const trade = {
      id: generateTradeId(),
      marketId: generateMarketId(),
      walletAddress: generateWalletAddress(),
      side: Math.random() > 0.5 ? "buy" : "sell",
      size: Math.random() * 10000,
      price: Math.random(),
      timestamp: new Date(),
      createdAt: new Date(),
    };
    // Validate and transform
    void {
      ...trade,
      walletAddress: trade.walletAddress.toLowerCase(),
      sizeStr: trade.size.toString(),
    };
  },
};

let timeSeriesData: Map<string, Array<{ timestamp: number; value: number }>>;
let tsMarketId: string;

export const dbTimeseriesInsertBenchmark: BenchmarkDefinition = {
  target: targets.DB_TIMESERIES_INSERT,
  setup: async () => {
    timeSeriesData = new Map();
    tsMarketId = generateMarketId();
  },
  fn: async () => {
    const existing = timeSeriesData.get(tsMarketId) || [];
    existing.push({ timestamp: Date.now(), value: Math.random() * 1000 });
    if (existing.length > 10000) existing.shift();
    timeSeriesData.set(tsMarketId, existing);
  },
};

let indexManager: SimpleIndexManager;
let indexedAddress: string;

export const dbIndexLookupBenchmark: BenchmarkDefinition = {
  target: targets.DB_INDEX_LOOKUP,
  setup: async () => {
    indexManager = new SimpleIndexManager();
    for (let i = 0; i < 10000; i++) {
      const addr = generateWalletAddress();
      indexManager.addToIndex("walletAddress", addr, "entity-" + i);
      if (i === 5000) indexedAddress = addr;
    }
  },
  fn: async () => {
    indexManager.lookup("walletAddress", indexedAddress);
  },
};

// ============================================================================
// Processing Benchmarks
// ============================================================================

let batchTrades: Array<{
  marketId: string;
  walletAddress: string;
  size: number;
  timestamp: number;
}>;
let batchMarketStats: { mean: number; stdDev: number };

export const batchTradeProcessingBenchmark: BenchmarkDefinition = {
  target: targets.BATCH_TRADE_PROCESSING,
  setup: async () => {
    const marketId = generateMarketId();
    // Build stats
    const historicalSizes = Array.from({ length: 500 }, () => 100 + Math.random() * 200);
    const mean = historicalSizes.reduce((a, b) => a + b, 0) / historicalSizes.length;
    const stdDev = Math.sqrt(
      historicalSizes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / historicalSizes.length
    );
    batchMarketStats = { mean, stdDev };

    // Generate batch
    batchTrades = Array.from({ length: 100 }, () => ({
      marketId,
      walletAddress: generateWalletAddress(),
      size: Math.random() * 5000,
      timestamp: Date.now(),
    }));
  },
  fn: async () => {
    for (const trade of batchTrades) {
      analyzeTradeSizeOutlier(trade.size, batchMarketStats);
    }
  },
};

let pipelineMarketStats: { mean: number; stdDev: number };

export const fullDetectionPipelineBenchmark: BenchmarkDefinition = {
  target: targets.FULL_DETECTION_PIPELINE,
  setup: async () => {
    const historicalSizes = Array.from({ length: 500 }, () => 100 + Math.random() * 200);
    const mean = historicalSizes.reduce((a, b) => a + b, 0) / historicalSizes.length;
    const stdDev = Math.sqrt(
      historicalSizes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / historicalSizes.length
    );
    pipelineMarketStats = { mean, stdDev };
  },
  fn: async () => {
    const trade = {
      marketId: generateMarketId(),
      walletAddress: generateWalletAddress(),
      size: Math.random() * 5000,
      timestamp: Date.now(),
      price: Math.random(),
    };

    // Run through pipeline
    analyzeTradeSizeOutlier(trade.size, pipelineMarketStats);
    calculateWhaleThreshold({ liquidity: 50000, dailyVolume: 200000 });
    calculateMarketImpact({
      tradeSize: trade.size,
      priceBefore: 0.5,
      priceAfter: 0.5 + (Math.random() - 0.5) * 0.1,
      liquidityDepth: 50000,
    });
  },
};

let alertsToAggregate: Array<{ type: string; severity: string; timestamp: number }>;

export const alertAggregationBenchmark: BenchmarkDefinition = {
  target: targets.ALERT_AGGREGATION,
  setup: async () => {
    const types = ["spike", "large_trade", "burst"];
    const severities = ["low", "medium", "high"];
    alertsToAggregate = Array.from({ length: 50 }, () => ({
      type: types[Math.floor(Math.random() * types.length)] ?? "spike",
      severity: severities[Math.floor(Math.random() * severities.length)] ?? "low",
      timestamp: Date.now() - Math.random() * 3600000,
    }));
  },
  fn: async () => {
    // Aggregate alerts
    const byType = new Map<string, number>();
    const bySeverity = new Map<string, number>();

    for (const alert of alertsToAggregate) {
      byType.set(alert.type, (byType.get(alert.type) || 0) + 1);
      bySeverity.set(alert.severity, (bySeverity.get(alert.severity) || 0) + 1);
    }

    void {
      totalAlerts: alertsToAggregate.length,
      byType: Object.fromEntries(byType),
      bySeverity: Object.fromEntries(bySeverity),
    };
  },
};

// ============================================================================
// Memory Benchmarks
// ============================================================================

export const memoryDetectionStateBenchmark: BenchmarkDefinition = {
  target: targets.MEMORY_DETECTION_STATE,
  fn: async () => {
    const tracker = new RollingVolumeStore();
    const marketId = generateMarketId();
    for (let i = 0; i < 1000; i++) {
      tracker.addVolume(marketId, 100 + Math.random() * 100);
    }
  },
};

export const memoryCacheBenchmark: BenchmarkDefinition = {
  target: targets.MEMORY_CACHE,
  fn: async () => {
    const cache = new SimpleCache(100);
    for (let i = 0; i < 100; i++) {
      cache.set(`key-${i}`, { data: { value: i, nested: { a: 1, b: 2 } } });
    }
  },
};

// ============================================================================
// Export All Benchmark Definitions
// ============================================================================

export const ALL_BENCHMARKS: BenchmarkDefinition[] = [
  // Detection
  walletAgeBenchmark,
  freshWalletThresholdBenchmark,
  zeroHistoryBenchmark,
  firstTradeSizeAnalysisBenchmark,
  fundingPatternAnalysisBenchmark,
  freshWalletClusteringBenchmark,
  walletReactivationBenchmark,
  confidenceScoringBenchmark,
  historyDepthAnalysisBenchmark,
  freshWalletAlertBenchmark,
  volumeBaselineBenchmark,
  rollingVolumeBenchmark,
  volumeSpikeBenchmark,
  tradeSizeAnalysisBenchmark,
  whaleThresholdBenchmark,
  volumeLiquidityRatioBenchmark,
  timeOfDayNormalizationBenchmark,
  consecutiveLargeTradesBenchmark,
  marketImpactBenchmark,
  unusualVolumeAlertBenchmark,
  volumeClusteringBenchmark,
  preEventVolumeBenchmark,

  // API
  apiCacheLookupBenchmark,
  apiRateLimiterBenchmark,
  tradeParsingBenchmark,
  orderBookDepthBenchmark,
  usdCalculationBenchmark,

  // WebSocket
  wsMessageParsingBenchmark,
  wsMessageQueueBenchmark,
  wsSubscriptionLookupBenchmark,
  wsEventDispatchBenchmark,

  // Database
  dbMarketLookupBenchmark,
  dbTradeInsertPrepBenchmark,
  dbTimeseriesInsertBenchmark,
  dbIndexLookupBenchmark,

  // Processing
  batchTradeProcessingBenchmark,
  fullDetectionPipelineBenchmark,
  alertAggregationBenchmark,

  // Memory
  memoryDetectionStateBenchmark,
  memoryCacheBenchmark,
];
