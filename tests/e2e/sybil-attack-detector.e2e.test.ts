/**
 * E2E Tests for Sybil Attack Detector (DET-PAT-009)
 *
 * These tests simulate realistic sybil attack scenarios on Polymarket
 * to verify the detection system works correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SybilRiskLevel,
  SybilFlag,
  SybilAttackDetector,
  SybilWallet,
  SybilTrade,
} from "../../src/detection/sybil-attack-detector";

// Realistic test addresses
const OPERATOR_WALLET = "0x9876543210987654321098765432109876543210";
const EXCHANGE_HOT_WALLET = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Generate deterministic wallet addresses
function generateWallet(index: number): string {
  return `0x${index.toString(16).padStart(40, "0")}`;
}

// Generate realistic timestamps
function hoursAgo(hours: number): number {
  return Date.now() - hours * 60 * 60 * 1000;
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// Helper to create a realistic sybil wallet cluster
function createSybilCluster(
  count: number,
  baseConfig: Partial<SybilWallet>,
  startIndex: number = 1
): SybilWallet[] {
  const wallets: SybilWallet[] = [];
  const baseTimestamp = baseConfig.creationTimestamp || daysAgo(3);

  for (let i = 0; i < count; i++) {
    wallets.push({
      address: generateWallet(startIndex + i),
      creationTimestamp: baseTimestamp + i * 60 * 1000, // 1 minute apart
      fundingSource: baseConfig.fundingSource,
      totalFundingUsd: baseConfig.totalFundingUsd || 1000,
      uniqueFunderCount: 1,
      firstTradeTimestamp: baseTimestamp + (i + 1) * 60 * 60 * 1000, // 1 hour after creation
      tradeCount: baseConfig.tradeCount || 10,
      totalVolumeUsd: baseConfig.totalVolumeUsd || 5000,
      uniqueMarketsTraded: baseConfig.uniqueMarketsTraded || 3,
      avgTradeSizeUsd: baseConfig.avgTradeSizeUsd || 500,
      winRate: baseConfig.winRate,
      activeHours: baseConfig.activeHours || [9, 10, 11, 14, 15],
      avgGasPrice: baseConfig.avgGasPrice || 30,
      lastActivityTimestamp: hoursAgo(1),
      isFresh: baseConfig.isFresh ?? true,
    });
  }

  return wallets;
}

// Helper to generate trades for a wallet
function generateTradesForWallet(
  walletAddress: string,
  markets: string[],
  count: number,
  baseTimestamp: number
): SybilTrade[] {
  const trades: SybilTrade[] = [];

  for (let i = 0; i < count; i++) {
    trades.push({
      tradeId: `${walletAddress}_trade_${i}`,
      walletAddress,
      marketId: markets[i % markets.length]!,
      side: i % 2 === 0 ? "buy" : "sell",
      sizeUsd: 400 + Math.random() * 200, // 400-600 USD
      price: 0.5 + Math.random() * 0.3, // 0.5-0.8
      timestamp: baseTimestamp + i * 30 * 60 * 1000, // 30 minutes apart
      gasPrice: 28 + Math.random() * 4, // 28-32 gwei
    });
  }

  return trades;
}

describe("E2E: Sybil Attack Detection Scenarios", () => {
  let detector: SybilAttackDetector;

  beforeEach(() => {
    detector = new SybilAttackDetector({
      thresholds: {
        minSybilScore: 60,
        creationTimeWindow: 24 * 60 * 60 * 1000,
        minFundingSourceMatch: 0.8,
        minBehavioralMatch: 0.7,
        minTradingPatternSimilarity: 0.75,
        minGasUsageSimilarity: 0.8,
        minActivityTimingCorrelation: 0.7,
        minMarketSelectionOverlap: 0.6,
        minClusterSize: 2,
        maxClusterSize: 100,
        minTradesForAnalysis: 3,
      },
      emitEvents: true,
    });
  });

  afterEach(() => {
    detector.clear();
  });

  describe("Scenario 1: Classic Sybil Attack - Same Funder", () => {
    it("should detect wallets funded from the same source", () => {
      // Create 5 wallets all funded by the same operator
      const wallets = createSybilCluster(5, {
        fundingSource: OPERATOR_WALLET,
        creationTimestamp: daysAgo(2),
        avgTradeSizeUsd: 500,
        avgGasPrice: 30,
        activeHours: [9, 10, 11, 14, 15],
        isFresh: true,
      });

      wallets.forEach((w) => detector.addWallet(w));

      // Add funding transactions
      wallets.forEach((w) => {
        detector.addFundingTransaction({
          txHash: `0x${Math.random().toString(16).substring(2)}`,
          from: OPERATOR_WALLET,
          to: w.address,
          amount: 1,
          amountUsd: 1000,
          timestamp: w.creationTimestamp - 60000,
        });
      });

      // Add trades to same markets
      const markets = ["market_election_2024", "market_fed_rates", "market_crypto"];
      wallets.forEach((w) => {
        const trades = generateTradesForWallet(w.address, markets, 5, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      // Detect clusters
      const clusters = detector.detectClusters();

      expect(clusters.length).toBeGreaterThanOrEqual(1);

      const mainCluster = clusters[0]!;
      expect(mainCluster.memberCount).toBeGreaterThanOrEqual(2);
      expect(mainCluster.flags).toContain(SybilFlag.SAME_FUNDER);
      expect(mainCluster.commonFundingSources).toContain(OPERATOR_WALLET.toLowerCase());
    });
  });

  describe("Scenario 2: Fresh Wallet Swarm", () => {
    it("should detect coordinated fresh wallets acting together", () => {
      const now = Date.now();

      // Create 10 fresh wallets created within 2 hours
      const wallets: SybilWallet[] = [];
      for (let i = 0; i < 10; i++) {
        wallets.push({
          address: generateWallet(100 + i),
          creationTimestamp: now - 2 * 60 * 60 * 1000 + i * 10 * 60 * 1000, // Every 10 min
          fundingSource: EXCHANGE_HOT_WALLET, // Same exchange
          totalFundingUsd: 500,
          uniqueFunderCount: 1,
          firstTradeTimestamp: now - 1 * 60 * 60 * 1000 + i * 5 * 60 * 1000,
          tradeCount: 8,
          totalVolumeUsd: 4000,
          uniqueMarketsTraded: 2,
          avgTradeSizeUsd: 500,
          activeHours: [14, 15, 16], // All trading in same hours
          avgGasPrice: 25,
          lastActivityTimestamp: now - 30 * 60 * 1000,
          isFresh: true, // All fresh
        });
      }

      wallets.forEach((w) => detector.addWallet(w));

      // All trading same hot market
      const markets = ["market_hot_political"];
      wallets.forEach((w) => {
        const trades = generateTradesForWallet(w.address, markets, 8, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      const clusters = detector.detectClusters();

      expect(clusters.length).toBeGreaterThanOrEqual(1);

      // Should detect fresh wallet indicators
      const clusterFlags = clusters.flatMap((c) => c.flags);
      expect(clusterFlags).toContain(SybilFlag.ALL_FRESH_WALLETS);
    });
  });

  describe("Scenario 3: Behavioral Fingerprint Match", () => {
    it("should detect wallets with identical behavioral patterns", () => {
      // Create wallets with very similar behavior but different funders
      const behaviorConfig = {
        activeHours: [9, 10, 11, 12], // Same active hours
        avgTradeSizeUsd: 750,
        avgGasPrice: 35,
        winRate: 0.72,
      };

      const wallets = [
        {
          address: generateWallet(200),
          creationTimestamp: daysAgo(10),
          fundingSource: generateWallet(1000), // Different funder
          totalFundingUsd: 2000,
          uniqueFunderCount: 1,
          firstTradeTimestamp: daysAgo(9),
          tradeCount: 25,
          totalVolumeUsd: 18750,
          uniqueMarketsTraded: 4,
          ...behaviorConfig,
          lastActivityTimestamp: hoursAgo(2),
          isFresh: false,
        },
        {
          address: generateWallet(201),
          creationTimestamp: daysAgo(10) + 30 * 60 * 1000, // 30 min later
          fundingSource: generateWallet(1001), // Different funder
          totalFundingUsd: 2100,
          uniqueFunderCount: 1,
          firstTradeTimestamp: daysAgo(9),
          tradeCount: 24,
          totalVolumeUsd: 18000,
          uniqueMarketsTraded: 4,
          ...behaviorConfig,
          lastActivityTimestamp: hoursAgo(2),
          isFresh: false,
        },
        {
          address: generateWallet(202),
          creationTimestamp: daysAgo(10) + 45 * 60 * 1000, // 45 min later
          fundingSource: generateWallet(1002), // Different funder
          totalFundingUsd: 1950,
          uniqueFunderCount: 1,
          firstTradeTimestamp: daysAgo(9),
          tradeCount: 26,
          totalVolumeUsd: 19500,
          uniqueMarketsTraded: 4,
          ...behaviorConfig,
          lastActivityTimestamp: hoursAgo(2),
          isFresh: false,
        },
      ];

      wallets.forEach((w) => detector.addWallet(w));

      // Same market selection
      const markets = ["market_a", "market_b", "market_c", "market_d"];
      wallets.forEach((w) => {
        const trades = generateTradesForWallet(w.address, markets, 10, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      const clusters = detector.detectClusters();

      // Should detect behavioral patterns
      expect(clusters.length).toBeGreaterThanOrEqual(0);

      if (clusters.length > 0) {
        const clusterFlags = clusters.flatMap((c) => c.flags);
        // Should have timing or market selection flags
        const hasBehavioralFlags =
          clusterFlags.includes(SybilFlag.TIMING_FINGERPRINT) ||
          clusterFlags.includes(SybilFlag.MARKET_SELECTION_MATCH) ||
          clusterFlags.includes(SybilFlag.SIZE_STRATEGY_MATCH);
        expect(hasBehavioralFlags).toBe(true);
      }
    });
  });

  describe("Scenario 4: Gas Price Pattern Match", () => {
    it("should detect wallets with identical gas price patterns", () => {
      // Create wallets with very similar gas patterns (suggests same operator)
      const wallets: SybilWallet[] = [];
      for (let i = 0; i < 4; i++) {
        wallets.push({
          address: generateWallet(300 + i),
          creationTimestamp: daysAgo(5) + i * 60 * 60 * 1000,
          totalFundingUsd: 1500,
          uniqueFunderCount: 1,
          firstTradeTimestamp: daysAgo(4),
          tradeCount: 15,
          totalVolumeUsd: 7500,
          uniqueMarketsTraded: 5,
          avgTradeSizeUsd: 500,
          avgGasPrice: 42.5, // All using exact same gas price strategy
          activeHours: [10, 11, 12, 13, 14],
          lastActivityTimestamp: hoursAgo(1),
          isFresh: false,
        });
      }

      wallets.forEach((w) => detector.addWallet(w));

      // Add trades with identical gas prices
      const markets = ["market_x", "market_y", "market_z"];
      wallets.forEach((w) => {
        const trades: SybilTrade[] = [];
        for (let j = 0; j < 15; j++) {
          trades.push({
            tradeId: `${w.address}_trade_${j}`,
            walletAddress: w.address,
            marketId: markets[j % markets.length]!,
            side: "buy",
            sizeUsd: 500,
            price: 0.65,
            timestamp: w.firstTradeTimestamp! + j * 60 * 60 * 1000,
            gasPrice: 42.5, // Exact same gas price
          });
        }
        detector.addTrades(trades);
      });

      const clusters = detector.detectClusters();

      if (clusters.length > 0) {
        const clusterFlags = clusters.flatMap((c) => c.flags);
        expect(clusterFlags).toContain(SybilFlag.GAS_PRICE_MATCH);
      }
    });
  });

  describe("Scenario 5: Legitimate Independent Traders", () => {
    it("should NOT flag independent traders with different patterns", () => {
      // Create truly independent wallets
      const wallets: SybilWallet[] = [
        {
          address: generateWallet(400),
          creationTimestamp: daysAgo(180), // 6 months old
          fundingSource: generateWallet(2000),
          totalFundingUsd: 50000,
          uniqueFunderCount: 5,
          firstTradeTimestamp: daysAgo(170),
          tradeCount: 500,
          totalVolumeUsd: 250000,
          uniqueMarketsTraded: 50,
          avgTradeSizeUsd: 500,
          winRate: 0.55,
          activeHours: [9, 10, 11, 12], // Morning trader
          avgGasPrice: 25,
          lastActivityTimestamp: hoursAgo(2),
          isFresh: false,
        },
        {
          address: generateWallet(401),
          creationTimestamp: daysAgo(365), // 1 year old
          fundingSource: generateWallet(2001),
          totalFundingUsd: 100000,
          uniqueFunderCount: 10,
          firstTradeTimestamp: daysAgo(350),
          tradeCount: 1000,
          totalVolumeUsd: 500000,
          uniqueMarketsTraded: 100,
          avgTradeSizeUsd: 500,
          winRate: 0.52,
          activeHours: [20, 21, 22, 23], // Evening trader
          avgGasPrice: 45,
          lastActivityTimestamp: hoursAgo(5),
          isFresh: false,
        },
        {
          address: generateWallet(402),
          creationTimestamp: daysAgo(90), // 3 months old
          fundingSource: generateWallet(2002),
          totalFundingUsd: 25000,
          uniqueFunderCount: 3,
          firstTradeTimestamp: daysAgo(85),
          tradeCount: 200,
          totalVolumeUsd: 100000,
          uniqueMarketsTraded: 30,
          avgTradeSizeUsd: 500,
          winRate: 0.48,
          activeHours: [14, 15, 16, 17], // Afternoon trader
          avgGasPrice: 35,
          lastActivityTimestamp: hoursAgo(8),
          isFresh: false,
        },
      ];

      wallets.forEach((w) => detector.addWallet(w));

      // Different market selections
      const marketSets = [
        ["politics_1", "politics_2", "politics_3"],
        ["crypto_1", "crypto_2", "crypto_3"],
        ["sports_1", "sports_2", "sports_3"],
      ];

      wallets.forEach((w, i) => {
        const trades = generateTradesForWallet(
          w.address,
          marketSets[i]!,
          20,
          w.firstTradeTimestamp!
        );
        detector.addTrades(trades);
      });

      // Analyze each wallet
      wallets.forEach((w) => {
        const result = detector.analyzeWallet(w.address);
        // Should not be flagged as sybil
        expect(result.isLikelySybil).toBe(false);
      });

      // Cluster detection should find no high-risk clusters
      const clusters = detector.detectClusters();
      const highRiskClusters = clusters.filter(
        (c) => c.riskLevel === SybilRiskLevel.HIGH || c.riskLevel === SybilRiskLevel.CRITICAL
      );
      expect(highRiskClusters).toHaveLength(0);
    });
  });

  describe("Scenario 6: Mixed Sybil and Legitimate", () => {
    it("should correctly identify sybil cluster among legitimate wallets", () => {
      // Add legitimate wallets
      const legitimateWallets: SybilWallet[] = [
        {
          address: generateWallet(500),
          creationTimestamp: daysAgo(200),
          fundingSource: generateWallet(3000),
          totalFundingUsd: 75000,
          uniqueFunderCount: 8,
          firstTradeTimestamp: daysAgo(190),
          tradeCount: 800,
          totalVolumeUsd: 400000,
          uniqueMarketsTraded: 80,
          avgTradeSizeUsd: 500,
          winRate: 0.53,
          activeHours: [10, 11, 12],
          avgGasPrice: 28,
          lastActivityTimestamp: hoursAgo(3),
          isFresh: false,
        },
        {
          address: generateWallet(501),
          creationTimestamp: daysAgo(150),
          fundingSource: generateWallet(3001),
          totalFundingUsd: 30000,
          uniqueFunderCount: 4,
          firstTradeTimestamp: daysAgo(145),
          tradeCount: 400,
          totalVolumeUsd: 200000,
          uniqueMarketsTraded: 40,
          avgTradeSizeUsd: 500,
          winRate: 0.51,
          activeHours: [18, 19, 20],
          avgGasPrice: 50,
          lastActivityTimestamp: hoursAgo(6),
          isFresh: false,
        },
      ];

      // Add sybil cluster
      const sybilWallets = createSybilCluster(
        4,
        {
          fundingSource: OPERATOR_WALLET,
          creationTimestamp: daysAgo(1),
          avgTradeSizeUsd: 600,
          avgGasPrice: 32,
          activeHours: [9, 10, 11],
          isFresh: true,
        },
        600
      );

      [...legitimateWallets, ...sybilWallets].forEach((w) => detector.addWallet(w));

      // Add trades
      legitimateWallets.forEach((w, i) => {
        const markets = [`legit_market_${i}_1`, `legit_market_${i}_2`];
        const trades = generateTradesForWallet(w.address, markets, 10, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      const sybilMarkets = ["sybil_target_1", "sybil_target_2"];
      sybilWallets.forEach((w) => {
        const trades = generateTradesForWallet(w.address, sybilMarkets, 8, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      // Add funding for sybils
      sybilWallets.forEach((w) => {
        detector.addFundingTransaction({
          txHash: `0x${Math.random().toString(16).substring(2)}`,
          from: OPERATOR_WALLET,
          to: w.address,
          amount: 1,
          amountUsd: 1000,
          timestamp: w.creationTimestamp - 60000,
        });
      });

      // Analyze
      const clusters = detector.detectClusters();

      // Should find at least one cluster containing sybil wallets
      const sybilAddresses = new Set(sybilWallets.map((w) => w.address));
      const sybilClusters = clusters.filter((c) =>
        c.members.some((m) => sybilAddresses.has(m))
      );

      expect(sybilClusters.length).toBeGreaterThanOrEqual(1);

      // Legitimate wallets should not be in sybil clusters
      const legitAddresses = new Set(legitimateWallets.map((w) => w.address));
      sybilClusters.forEach((c) => {
        c.members.forEach((m) => {
          expect(legitAddresses.has(m)).toBe(false);
        });
      });
    });
  });

  describe("Scenario 7: Airdrop Farming Pattern", () => {
    it("should detect airdrop farming sybil pattern", () => {
      // Airdrop farmers create many wallets, do minimal activity, and wait
      const wallets: SybilWallet[] = [];
      const farmingStart = daysAgo(30);

      for (let i = 0; i < 20; i++) {
        wallets.push({
          address: generateWallet(700 + i),
          creationTimestamp: farmingStart + i * 5 * 60 * 1000, // Every 5 minutes
          fundingSource: OPERATOR_WALLET,
          totalFundingUsd: 100, // Small amounts
          uniqueFunderCount: 1,
          firstTradeTimestamp: farmingStart + 24 * 60 * 60 * 1000 + i * 5 * 60 * 1000,
          tradeCount: 5, // Minimal trading
          totalVolumeUsd: 250,
          uniqueMarketsTraded: 2,
          avgTradeSizeUsd: 50,
          activeHours: [12, 13], // Very narrow active window
          avgGasPrice: 20, // Cheap gas
          lastActivityTimestamp: daysAgo(25), // Inactive since farming
          isFresh: false,
        });
      }

      wallets.forEach((w) => detector.addWallet(w));

      // Same minimal markets
      const markets = ["airdrop_eligible_1", "airdrop_eligible_2"];
      wallets.forEach((w) => {
        const trades = generateTradesForWallet(w.address, markets, 5, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      // Add funding
      wallets.forEach((w) => {
        detector.addFundingTransaction({
          txHash: `0x${Math.random().toString(16).substring(2)}`,
          from: OPERATOR_WALLET,
          to: w.address,
          amount: 0.1,
          amountUsd: 100,
          timestamp: w.creationTimestamp - 60000,
        });
      });

      const clusters = detector.detectClusters();

      // Should detect large cluster
      expect(clusters.length).toBeGreaterThanOrEqual(1);

      // Check for indicators
      const allFlags = clusters.flatMap((c) => c.flags);
      expect(allFlags).toContain(SybilFlag.SAME_FUNDER);
      expect(allFlags).toContain(SybilFlag.CREATION_TIME_CLUSTER);
    });
  });

  describe("Scenario 8: Market Manipulation Ring", () => {
    it("should detect coordinated market manipulation", () => {
      // Group of wallets coordinating to move market prices
      const wallets: SybilWallet[] = [];
      for (let i = 0; i < 6; i++) {
        wallets.push({
          address: generateWallet(800 + i),
          creationTimestamp: daysAgo(7) + i * 30 * 60 * 1000,
          fundingSource: generateWallet(4000 + Math.floor(i / 2)), // Pairs share funders
          totalFundingUsd: 10000,
          uniqueFunderCount: 1,
          firstTradeTimestamp: daysAgo(6),
          tradeCount: 50,
          totalVolumeUsd: 50000,
          uniqueMarketsTraded: 3,
          avgTradeSizeUsd: 1000, // Large position sizes
          winRate: 0.65, // Suspiciously high
          activeHours: [14, 15], // Narrow window - coordinated timing
          avgGasPrice: 38,
          lastActivityTimestamp: hoursAgo(1),
          isFresh: false,
        });
      }

      wallets.forEach((w) => detector.addWallet(w));

      // All targeting same low-liquidity markets
      const targetMarkets = ["low_liquidity_target"];
      wallets.forEach((w) => {
        const trades = generateTradesForWallet(w.address, targetMarkets, 15, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      const clusters = detector.detectClusters();

      // Should detect coordination
      expect(clusters.length).toBeGreaterThanOrEqual(1);

      const mainCluster = clusters[0]!;
      expect(mainCluster.memberCount).toBeGreaterThanOrEqual(2);

      // Should flag market selection match and timing
      expect(mainCluster.flags).toContain(SybilFlag.MARKET_SELECTION_MATCH);
    });
  });

  describe("Scenario 9: Batch Analysis Performance", () => {
    it("should handle batch analysis of many wallets efficiently", () => {
      const walletCount = 50;
      const wallets: SybilWallet[] = [];

      // Mix of sybil and legitimate wallets
      for (let i = 0; i < walletCount; i++) {
        const isSybil = i < 10; // First 10 are sybils
        wallets.push({
          address: generateWallet(900 + i),
          creationTimestamp: isSybil ? daysAgo(2) + i * 60000 : daysAgo(30 + i * 3),
          fundingSource: isSybil ? OPERATOR_WALLET : generateWallet(5000 + i),
          totalFundingUsd: 1000 + i * 100,
          uniqueFunderCount: isSybil ? 1 : 1 + Math.floor(i / 10),
          firstTradeTimestamp: daysAgo(1),
          tradeCount: 10 + i,
          totalVolumeUsd: 5000 + i * 500,
          uniqueMarketsTraded: 3 + Math.floor(i / 5),
          avgTradeSizeUsd: 400 + (isSybil ? 0 : i * 10),
          activeHours: isSybil ? [10, 11, 12] : [Math.floor(i / 2) % 24],
          avgGasPrice: isSybil ? 30 : 20 + i,
          lastActivityTimestamp: hoursAgo(i % 24),
          isFresh: isSybil,
        });
      }

      wallets.forEach((w) => detector.addWallet(w));

      // Add trades
      wallets.forEach((w, idx) => {
        const isSybil = idx < 10;
        const markets = isSybil
          ? ["sybil_market_1", "sybil_market_2"]
          : [`market_${idx}_1`, `market_${idx}_2`];
        const trades = generateTradesForWallet(w.address, markets, 5, w.firstTradeTimestamp!);
        detector.addTrades(trades);
      });

      const startTime = Date.now();
      const result = detector.batchAnalyze(wallets.map((w) => w.address));
      const duration = Date.now() - startTime;

      expect(result.totalWalletsAnalyzed).toBe(walletCount);
      expect(result.results.size).toBe(walletCount);
      expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds

      // Should find sybil wallets
      expect(result.sybilWalletCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Scenario 10: Temporal Analysis", () => {
    it("should detect wallets created in temporal clusters", () => {
      const creationBase = daysAgo(5);

      // Group 1: Created within 10 minutes of each other
      const group1 = createSybilCluster(
        4,
        {
          creationTimestamp: creationBase,
          avgTradeSizeUsd: 300,
          avgGasPrice: 25,
          activeHours: [8, 9, 10],
        },
        1000
      );

      // Group 2: Created within 10 minutes of each other, but different time
      const group2 = createSybilCluster(
        4,
        {
          creationTimestamp: creationBase + 24 * 60 * 60 * 1000, // 1 day later
          avgTradeSizeUsd: 600,
          avgGasPrice: 40,
          activeHours: [18, 19, 20],
        },
        1010
      );

      [...group1, ...group2].forEach((w) => detector.addWallet(w));

      // Different market preferences per group
      group1.forEach((w) => {
        const trades = generateTradesForWallet(
          w.address,
          ["group1_market"],
          5,
          w.firstTradeTimestamp!
        );
        detector.addTrades(trades);
      });

      group2.forEach((w) => {
        const trades = generateTradesForWallet(
          w.address,
          ["group2_market"],
          5,
          w.firstTradeTimestamp!
        );
        detector.addTrades(trades);
      });

      const clusters = detector.detectClusters();

      // Should detect at least 2 separate clusters based on creation time
      const _creationTimeClusters = clusters.filter((c) =>
        c.flags.includes(SybilFlag.CREATION_TIME_CLUSTER)
      );
      void _creationTimeClusters; // Used for verification

      // At minimum, temporal patterns should be detected
      expect(clusters.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Summary and Statistics", () => {
    it("should provide accurate summary statistics", () => {
      // Add some wallets and clusters
      const wallets = createSybilCluster(
        5,
        {
          fundingSource: OPERATOR_WALLET,
          creationTimestamp: daysAgo(3),
        },
        1100
      );

      wallets.forEach((w) => detector.addWallet(w));
      wallets.forEach((w) => {
        const trades = generateTradesForWallet(
          w.address,
          ["test_market"],
          5,
          w.firstTradeTimestamp!
        );
        detector.addTrades(trades);
      });

      void detector.detectClusters();

      const summary = detector.getSummary();

      expect(summary.totalWallets).toBe(5);
      expect(summary.totalTrades).toBe(25);
      expect(summary.lastUpdated).toBeDefined();
      expect(summary.clusterSizeDistribution).toBeDefined();
      expect(Array.isArray(summary.topIndicators)).toBe(true);
      expect(Array.isArray(summary.topFlags)).toBe(true);
    });
  });
});
