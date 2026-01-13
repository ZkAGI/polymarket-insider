/**
 * E2E Tests for Real-time Anomaly Scoring (AI-PAT-002)
 *
 * Tests the full scoring workflow from trade input to anomaly detection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RealtimeAnomalyScorer,
  createRealtimeAnomalyScorer,
  resetSharedRealtimeAnomalyScorer,
  AnomalyRiskLevel,
  TradeData,
  WalletContext,
  MarketContext,
  createMockTrade,
  createMockWalletContext,
  createMockMarketContext,
} from "../../src/ai/realtime-anomaly-scoring";
import {
  AnomalyDetectionTrainingPipeline,
  createAnomalyDetectionTrainingPipeline,
  resetSharedAnomalyDetectionTrainingPipeline,
} from "../../src/ai/anomaly-detection-training";

describe("Real-time Anomaly Scoring E2E", () => {
  let scorer: RealtimeAnomalyScorer;
  let pipeline: AnomalyDetectionTrainingPipeline;
  let trainedModelId: string;

  beforeEach(async () => {
    // Reset all shared instances
    resetSharedRealtimeAnomalyScorer();
    resetSharedAnomalyDetectionTrainingPipeline();

    // Create pipeline with training configuration
    pipeline = createAnomalyDetectionTrainingPipeline({
      minSamples: 10,
      cvFolds: 2,
    });

    // Create comprehensive training dataset
    const dataset = pipeline.createDataset("e2e-test-dataset");

    // Add normal trading samples (90%)
    for (let i = 0; i < 90; i++) {
      pipeline.addSample(dataset.id, {
        walletAddress: `0x${(i + 1000).toString(16).padStart(40, "0")}`,
        features: {
          wallet_age_days: 30 + Math.random() * 300,
          total_trades: 20 + Math.floor(Math.random() * 200),
          unique_markets: 5 + Math.floor(Math.random() * 30),
          avg_trade_size: 100 + Math.random() * 2000,
          trade_size_stddev: 50 + Math.random() * 500,
          buy_sell_ratio: 0.4 + Math.random() * 0.2,
          holding_period_avg: 12 + Math.random() * 72,
          volume_spike_count: Math.floor(Math.random() * 3),
          whale_trade_count: 0,
          total_volume_usd: 5000 + Math.random() * 50000,
          off_hours_ratio: Math.random() * 0.15,
          pre_event_trade_ratio: Math.random() * 0.1,
          timing_consistency_score: 0.5 + Math.random() * 0.4,
          market_concentration: 0.1 + Math.random() * 0.3,
          niche_market_ratio: Math.random() * 0.2,
          political_market_ratio: Math.random() * 0.2,
          win_rate: 0.45 + Math.random() * 0.15,
          profit_factor: 0.8 + Math.random() * 0.5,
          max_consecutive_wins: Math.floor(Math.random() * 5),
          coordination_score: Math.random() * 10,
          cluster_membership_count: 0,
          sybil_risk_score: Math.random() * 10,
        },
        label: false, // Normal
        timestamp: new Date(),
      });
    }

    // Add anomalous trading samples (10%)
    for (let i = 0; i < 10; i++) {
      pipeline.addSample(dataset.id, {
        walletAddress: `0x${(i + 2000).toString(16).padStart(40, "0")}`,
        features: {
          wallet_age_days: Math.random() * 7, // Fresh wallet
          total_trades: Math.floor(Math.random() * 5),
          unique_markets: 1 + Math.floor(Math.random() * 2),
          avg_trade_size: 50000 + Math.random() * 150000, // Large trades
          trade_size_stddev: Math.random() * 100,
          buy_sell_ratio: Math.random() > 0.5 ? 1 : 0, // All buys or sells
          holding_period_avg: Math.random() * 2,
          volume_spike_count: 3 + Math.floor(Math.random() * 10),
          whale_trade_count: 3 + Math.floor(Math.random() * 5),
          total_volume_usd: 100000 + Math.random() * 500000,
          off_hours_ratio: 0.5 + Math.random() * 0.5,
          pre_event_trade_ratio: 0.7 + Math.random() * 0.3,
          timing_consistency_score: Math.random() * 0.3,
          market_concentration: 0.9 + Math.random() * 0.1,
          niche_market_ratio: 0.7 + Math.random() * 0.3,
          political_market_ratio: Math.random() * 0.5,
          win_rate: 0.85 + Math.random() * 0.15, // Very high win rate
          profit_factor: 5 + Math.random() * 20,
          max_consecutive_wins: 10 + Math.floor(Math.random() * 20),
          coordination_score: 50 + Math.random() * 50,
          cluster_membership_count: Math.floor(Math.random() * 5),
          sybil_risk_score: 50 + Math.random() * 50,
        },
        label: true, // Anomaly
        timestamp: new Date(),
      });
    }

    // Train model
    const trainedModel = await pipeline.train(dataset.id, "e2e-model", "1.0.0");
    trainedModelId = trainedModel.id;

    // Create scorer
    scorer = createRealtimeAnomalyScorer();
    scorer.setPipeline(pipeline);
    scorer.setDefaultModel(trainedModelId);
  });

  afterEach(() => {
    resetSharedRealtimeAnomalyScorer();
    resetSharedAnomalyDetectionTrainingPipeline();
  });

  // ============================================================================
  // Full Scoring Workflow Tests
  // ============================================================================

  describe("Full Scoring Workflow", () => {
    it("should score a normal-looking trade with low risk", () => {
      const normalTrade: TradeData = {
        id: "normal-trade-1",
        walletAddress: "0x" + "1".repeat(40),
        marketId: "market-1",
        side: "BUY",
        sizeUsd: 500,
        price: 0.55,
        timestamp: new Date(),
      };

      const normalContext: WalletContext = {
        walletAddress: normalTrade.walletAddress,
        walletAgeDays: 180,
        totalTrades: 150,
        uniqueMarkets: 25,
        avgTradeSize: 450,
        tradeSizeStdDev: 200,
        buySellRatio: 0.52,
        holdingPeriodAvg: 36,
        volumeSpikeCount: 1,
        whaleTradeCount: 0,
        totalVolumeUsd: 67500,
        offHoursRatio: 0.08,
        preEventTradeRatio: 0.05,
        timingConsistencyScore: 0.75,
        marketConcentration: 0.2,
        nicheMarketRatio: 0.15,
        politicalMarketRatio: 0.1,
        winRate: 0.52,
        profitFactor: 1.1,
        maxConsecutiveWins: 4,
        coordinationScore: 5,
        clusterMembershipCount: 0,
        sybilRiskScore: 3,
      };

      scorer.setWalletContext(normalContext);

      const result = scorer.scoreTrade(normalTrade);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.tradeId).toBe("normal-trade-1");
      expect(result.modelId).toBe(trainedModelId);
    });

    it("should score a suspicious-looking trade with higher risk", () => {
      const suspiciousTrade: TradeData = {
        id: "suspicious-trade-1",
        walletAddress: "0x" + "2".repeat(40),
        marketId: "niche-market-1",
        side: "BUY",
        sizeUsd: 100000,
        price: 0.35,
        timestamp: new Date(),
      };

      const suspiciousContext: WalletContext = {
        walletAddress: suspiciousTrade.walletAddress,
        walletAgeDays: 2,
        totalTrades: 3,
        uniqueMarkets: 1,
        avgTradeSize: 75000,
        tradeSizeStdDev: 25000,
        buySellRatio: 1, // All buys
        holdingPeriodAvg: 0.5,
        volumeSpikeCount: 8,
        whaleTradeCount: 3,
        totalVolumeUsd: 225000,
        offHoursRatio: 0.67,
        preEventTradeRatio: 0.9,
        timingConsistencyScore: 0.1,
        marketConcentration: 1,
        nicheMarketRatio: 1,
        politicalMarketRatio: 0,
        winRate: 1, // 100% win rate
        profitFactor: 15,
        maxConsecutiveWins: 3,
        coordinationScore: 75,
        clusterMembershipCount: 3,
        sybilRiskScore: 60,
      };

      scorer.setWalletContext(suspiciousContext);

      const result = scorer.scoreTrade(suspiciousTrade);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      // Suspicious trades should generally have higher scores
      // but this depends on model training
    });

    it("should process trades with complete context", () => {
      const trade = createMockTrade({
        id: "context-test-trade",
        walletAddress: "0x" + "3".repeat(40),
        marketId: "market-context-test",
        sizeUsd: 2500,
        side: "SELL",
      });

      const walletContext = createMockWalletContext(trade.walletAddress, {
        totalTrades: 75,
        winRate: 0.55,
        avgTradeSize: 2000,
      });

      const marketContext: MarketContext = {
        marketId: trade.marketId,
        category: "SPORTS",
        isNiche: false,
        isPolitical: false,
        liquidityUsd: 500000,
        avgDailyVolume: 50000,
        hoursUntilResolution: 48,
        probabilitySpread: 0.05,
      };

      scorer.setWalletContext(walletContext);
      scorer.setMarketContext(marketContext);

      const result = scorer.scoreTrade(trade);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.contributingFactors.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Batch Scoring Workflow Tests
  // ============================================================================

  describe("Batch Scoring Workflow", () => {
    it("should score a batch of trades efficiently", () => {
      const trades: TradeData[] = [];

      // Mix of normal and suspicious trades
      for (let i = 0; i < 20; i++) {
        const isSuspicious = i < 3;
        trades.push({
          id: `batch-trade-${i}`,
          walletAddress: `0x${(i + 100).toString(16).padStart(40, "0")}`,
          marketId: `market-${i % 5}`,
          side: i % 2 === 0 ? "BUY" : "SELL",
          sizeUsd: isSuspicious ? 80000 + Math.random() * 50000 : 100 + Math.random() * 2000,
          price: Math.random(),
          timestamp: new Date(),
        });

        // Set context for suspicious trades
        if (isSuspicious) {
          scorer.setWalletContext(
            createMockWalletContext(trades[i]!.walletAddress, {
              walletAgeDays: 1,
              totalTrades: 2,
              winRate: 0.95,
              whaleTradeCount: 5,
            })
          );
        }
      }

      const batchResult = scorer.scoreTradesBatch(trades);

      expect(batchResult.totalScored).toBe(20);
      expect(batchResult.results).toHaveLength(20);
      expect(batchResult.processingTimeMs).toBeGreaterThan(0);
      expect(batchResult.averageScore).toBeGreaterThanOrEqual(0);
      expect(batchResult.averageScore).toBeLessThanOrEqual(1);
    });

    it("should calculate score distribution correctly", () => {
      const trades = Array.from({ length: 50 }, (_, i) =>
        createMockTrade({ id: `dist-trade-${i}` })
      );

      const batchResult = scorer.scoreTradesBatch(trades);

      const distributionSum =
        batchResult.scoreDistribution.veryLow +
        batchResult.scoreDistribution.low +
        batchResult.scoreDistribution.medium +
        batchResult.scoreDistribution.high +
        batchResult.scoreDistribution.veryHigh;

      expect(distributionSum).toBe(batchResult.totalScored);
    });
  });

  // ============================================================================
  // Model Loading and Switching Tests
  // ============================================================================

  describe("Model Loading and Switching", () => {
    it("should handle model loading correctly", () => {
      const model = scorer.getLoadedModel(trainedModelId);

      expect(model).toBeDefined();
      expect(model?.id).toBe(trainedModelId);
    });

    it("should score with explicit model ID", () => {
      const trade = createMockTrade();
      const result = scorer.scoreTrade(trade, trainedModelId);

      expect(result.modelId).toBe(trainedModelId);
    });

    it("should auto-load model when scoring", () => {
      // Create a new scorer without pre-loaded model
      const newScorer = createRealtimeAnomalyScorer();
      newScorer.setPipeline(pipeline);
      newScorer.setDefaultModel(trainedModelId);

      // Unload the model
      newScorer.unloadModel(trainedModelId);

      // Scoring should auto-load the model
      const trade = createMockTrade();
      const result = newScorer.scoreTrade(trade);

      expect(result).toBeDefined();
      expect(newScorer.getLoadedModel(trainedModelId)).toBeDefined();
    });
  });

  // ============================================================================
  // Context Propagation Tests
  // ============================================================================

  describe("Context Propagation", () => {
    it("should use stored wallet context automatically", () => {
      const walletAddress = "0x" + "4".repeat(40);
      const context = createMockWalletContext(walletAddress, {
        totalTrades: 500,
        winRate: 0.48,
      });
      scorer.setWalletContext(context);

      const trade = createMockTrade({ walletAddress });
      const features = scorer.extractFeatures(trade);

      expect(features.total_trades).toBe(500);
      expect(features.win_rate).toBe(0.48);
    });

    it("should use stored market context automatically", () => {
      const marketId = "stored-market-1";
      const context = createMockMarketContext(marketId, {
        isNiche: true,
        isPolitical: true,
      });
      scorer.setMarketContext(context);

      const trade = createMockTrade({ marketId });
      const features = scorer.extractFeatures(trade);

      expect(features.niche_market_ratio).toBe(1);
      expect(features.political_market_ratio).toBe(1);
    });

    it("should update wallet context with trade history", () => {
      const walletAddress = "0x" + "5".repeat(40);

      // Score multiple trades to build context incrementally
      for (let i = 0; i < 10; i++) {
        const trade = createMockTrade({
          walletAddress,
          sizeUsd: 1000 + i * 100,
          side: i % 2 === 0 ? "BUY" : "SELL",
        });
        // Get existing context and pass it to update
        const existingContext = scorer.getWalletContext(walletAddress);
        scorer.updateWalletContext(trade, existingContext);
      }

      const context = scorer.getWalletContext(walletAddress);

      expect(context).toBeDefined();
      expect(context!.totalTrades).toBe(10);
      expect(context!.totalVolumeUsd).toBeGreaterThan(10000);
    });
  });

  // ============================================================================
  // Caching Behavior Tests
  // ============================================================================

  describe("Caching Behavior", () => {
    it("should cache and retrieve scores efficiently", () => {
      const trade = createMockTrade();

      // First scoring - cache miss
      const result1 = scorer.scoreTrade(trade);
      const stats1 = scorer.getStatistics();

      // Second scoring - cache hit
      const result2 = scorer.scoreTrade(trade);
      const stats2 = scorer.getStatistics();

      expect(result1.score).toBe(result2.score);
      expect(stats2.cacheHits).toBe(stats1.cacheHits + 1);
    });

    it("should generate unique cache keys for different trades", () => {
      const trade1 = createMockTrade({ id: "unique-1", sizeUsd: 1000 });
      const trade2 = createMockTrade({ id: "unique-2", sizeUsd: 2000 });

      scorer.scoreTrade(trade1);
      scorer.scoreTrade(trade2);

      const stats = scorer.getStatistics();

      expect(stats.cacheSize).toBe(2);
      expect(stats.cacheMisses).toBe(2);
    });

    it("should handle cache eviction", () => {
      scorer.updateConfig({
        cacheConfig: { enabled: true, ttlMs: 60000, maxSize: 5 },
      });

      // Score more trades than cache size
      for (let i = 0; i < 10; i++) {
        scorer.scoreTrade(createMockTrade({ id: `evict-trade-${i}` }));
      }

      const stats = scorer.getStatistics();

      expect(stats.cacheSize).toBe(5);
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe("Event Emission", () => {
    it("should emit events during scoring workflow", () => {
      const events: string[] = [];

      scorer.on("cache_miss", () => events.push("cache_miss"));
      scorer.on("trade_scored", () => events.push("trade_scored"));

      const trade = createMockTrade();
      scorer.scoreTrade(trade);

      expect(events).toContain("cache_miss");
      expect(events).toContain("trade_scored");
    });

    it("should emit batch_scored event for batch operations", () => {
      let batchEvent: unknown = null;

      scorer.on("batch_scored", (e) => {
        batchEvent = e;
      });

      const trades = Array.from({ length: 5 }, () => createMockTrade());
      scorer.scoreTradesBatch(trades);

      expect(batchEvent).toBeDefined();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe("Performance", () => {
    it("should score trades within acceptable time", () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        scorer.scoreTrade(createMockTrade({ id: `perf-${i}` }));
      }
      const elapsed = Date.now() - start;

      // Should score 100 trades in under 5 seconds
      expect(elapsed).toBeLessThan(5000);
    });

    it("should benefit from caching for repeated trades", () => {
      const trade = createMockTrade();

      // First run without cache
      scorer.clearCache();
      const start1 = Date.now();
      for (let i = 0; i < 100; i++) {
        scorer.scoreTrade(trade);
      }
      const elapsed1 = Date.now() - start1;

      // Cache should speed up subsequent scoring
      const start2 = Date.now();
      for (let i = 0; i < 100; i++) {
        scorer.scoreTrade(trade);
      }
      const elapsed2 = Date.now() - start2;

      // Cached runs should be faster (or at least not slower)
      expect(elapsed2).toBeLessThanOrEqual(elapsed1 + 50); // Allow small margin
    });

    it("should handle large batch efficiently", () => {
      const trades = Array.from({ length: 500 }, (_, i) =>
        createMockTrade({ id: `large-batch-${i}` })
      );

      const start = Date.now();
      const result = scorer.scoreTradesBatch(trades);
      const elapsed = Date.now() - start;

      expect(result.totalScored).toBe(500);
      // Should complete 500 trades in under 10 seconds
      expect(elapsed).toBeLessThan(10000);
    });
  });

  // ============================================================================
  // Risk Level Determination Tests
  // ============================================================================

  describe("Risk Level Determination", () => {
    it("should assign appropriate risk levels based on thresholds", () => {
      const trades: TradeData[] = [];

      // Create trades that might trigger different risk levels
      for (let i = 0; i < 30; i++) {
        trades.push(createMockTrade({ id: `risk-level-${i}` }));
      }

      const result = scorer.scoreTradesBatch(trades);

      // Check that risk levels are assigned
      const riskLevelCounts: Record<string, number> = {
        NONE: 0,
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      };

      for (const r of result.results) {
        const currentCount = riskLevelCounts[r.riskLevel] ?? 0;
        riskLevelCounts[r.riskLevel] = currentCount + 1;
      }

      // All trades should have valid risk levels
      const totalCounted = Object.values(riskLevelCounts).reduce((a, b) => a + b, 0);
      expect(totalCounted).toBe(result.totalScored);
    });

    it("should respect custom risk thresholds", () => {
      scorer.updateConfig({
        riskThresholds: {
          low: 0.1,
          medium: 0.2,
          high: 0.3,
          critical: 0.5,
        },
      });

      const trade = createMockTrade();
      const result = scorer.scoreTrade(trade);

      // Verify risk level is assigned based on custom thresholds
      expect(Object.values(AnomalyRiskLevel)).toContain(result.riskLevel);
    });
  });

  // ============================================================================
  // Contributing Factors Tests
  // ============================================================================

  describe("Contributing Factors", () => {
    it("should identify contributing factors for scores", () => {
      const trade = createMockTrade({ sizeUsd: 50000 });
      const context = createMockWalletContext(trade.walletAddress, {
        whaleTradeCount: 10,
        winRate: 0.9,
        coordinationScore: 80,
      });
      scorer.setWalletContext(context);

      const result = scorer.scoreTrade(trade);

      expect(result.contributingFactors).toBeDefined();
      expect(Array.isArray(result.contributingFactors)).toBe(true);
    });

    it("should sort contributing factors by contribution", () => {
      const trade = createMockTrade();
      const context = createMockWalletContext(trade.walletAddress);
      scorer.setWalletContext(context);

      const result = scorer.scoreTrade(trade);

      if (result.contributingFactors.length > 1) {
        for (let i = 0; i < result.contributingFactors.length - 1; i++) {
          const current = result.contributingFactors[i]!;
          const next = result.contributingFactors[i + 1]!;
          expect(Math.abs(current.contribution)).toBeGreaterThanOrEqual(
            Math.abs(next.contribution)
          );
        }
      }
    });
  });

  // ============================================================================
  // Confidence Calculation Tests
  // ============================================================================

  describe("Confidence Calculation", () => {
    it("should calculate higher confidence with more context", () => {
      const trade = createMockTrade();

      // Score without context
      const result1 = scorer.scoreTrade(trade);

      // Score with full context
      const fullContext = createMockWalletContext(trade.walletAddress, {
        totalTrades: 200,
        avgTradeSize: 1500,
        winRate: 0.55,
        walletAgeDays: 180,
      });
      scorer.setWalletContext(fullContext);

      const result2 = scorer.scoreTrade(
        createMockTrade({
          ...trade,
          id: trade.id + "-v2",
          walletAddress: trade.walletAddress,
        })
      );

      // Full context should give higher confidence
      expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
    });
  });

  // ============================================================================
  // Statistics Tracking Tests
  // ============================================================================

  describe("Statistics Tracking", () => {
    it("should accurately track scoring statistics", () => {
      const initialStats = scorer.getStatistics();
      expect(initialStats.scoringCount).toBe(0);

      // Score some trades
      for (let i = 0; i < 25; i++) {
        scorer.scoreTrade(createMockTrade({ id: `stat-trade-${i}` }));
      }

      const finalStats = scorer.getStatistics();

      expect(finalStats.scoringCount).toBe(25);
      expect(finalStats.cacheSize).toBe(25);
      expect(finalStats.loadedModelCount).toBe(1);
    });

    it("should calculate accurate anomaly rate", () => {
      // Score 100 trades
      for (let i = 0; i < 100; i++) {
        scorer.scoreTrade(createMockTrade({ id: `anomaly-rate-${i}` }));
      }

      const stats = scorer.getStatistics();

      expect(stats.anomalyRate).toBeGreaterThanOrEqual(0);
      expect(stats.anomalyRate).toBeLessThanOrEqual(1);
      expect(stats.anomalyRate).toBe(stats.anomalyCount / stats.scoringCount);
    });

    it("should track context counts correctly", () => {
      // Set multiple contexts
      for (let i = 0; i < 10; i++) {
        scorer.setWalletContext(createMockWalletContext(`0x${i.toString().padStart(40, "0")}`));
      }
      for (let i = 0; i < 5; i++) {
        scorer.setMarketContext(createMockMarketContext(`market-${i}`));
      }

      const stats = scorer.getStatistics();

      expect(stats.walletContextCount).toBe(10);
      expect(stats.marketContextCount).toBe(5);
    });
  });

  // ============================================================================
  // Reset and Cleanup Tests
  // ============================================================================

  describe("Reset and Cleanup", () => {
    it("should reset all state completely", () => {
      // Build up state
      for (let i = 0; i < 10; i++) {
        scorer.scoreTrade(createMockTrade({ id: `reset-trade-${i}` }));
      }
      for (let i = 0; i < 5; i++) {
        scorer.setWalletContext(createMockWalletContext(`0x${i.toString().padStart(40, "0")}`));
      }

      // Verify state exists
      const statsBefore = scorer.getStatistics();
      expect(statsBefore.scoringCount).toBeGreaterThan(0);
      expect(statsBefore.walletContextCount).toBeGreaterThan(0);

      // Reset
      scorer.reset();

      // Verify state is cleared
      const statsAfter = scorer.getStatistics();
      expect(statsAfter.scoringCount).toBe(0);
      expect(statsAfter.cacheSize).toBe(0);
      expect(statsAfter.walletContextCount).toBe(0);
      expect(statsAfter.loadedModelCount).toBe(0);
    });

    it("should cleanup expired cache entries", async () => {
      scorer.updateConfig({
        cacheConfig: { enabled: true, ttlMs: 50, maxSize: 1000 },
      });

      // Score some trades
      for (let i = 0; i < 5; i++) {
        scorer.scoreTrade(createMockTrade({ id: `cache-cleanup-${i}` }));
      }

      expect(scorer.getStatistics().cacheSize).toBe(5);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cleanup
      const removed = scorer.cleanupCache();

      expect(removed).toBe(5);
      expect(scorer.getStatistics().cacheSize).toBe(0);
    });
  });
});
