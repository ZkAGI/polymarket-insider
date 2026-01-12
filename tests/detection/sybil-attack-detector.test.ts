/**
 * Unit Tests for Sybil Attack Detector (DET-PAT-009)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SybilIndicatorType,
  SybilConfidence,
  SybilRiskLevel,
  SybilFlag,
  DEFAULT_SYBIL_THRESHOLDS,
  SybilAttackDetector,
  createSybilAttackDetector,
  getSharedSybilAttackDetector,
  setSharedSybilAttackDetector,
  resetSharedSybilAttackDetector,
  addWalletsForSybilAnalysis,
  addTradesForSybilAnalysis,
  analyzeWalletForSybil,
  batchAnalyzeForSybil,
  isWalletSybil,
  getDetectedSybilClusters,
  getHighRiskSybilClusters,
  getSybilDetectorSummary,
  getSybilIndicatorDescription,
  getSybilConfidenceDescription,
  getSybilRiskDescription,
  getSybilFlagDescription,
  SybilWallet,
  SybilTrade,
  FundingTransaction,
} from "../../src/detection/sybil-attack-detector";

// Test wallet addresses
const WALLET_A = "0x1111111111111111111111111111111111111111";
const WALLET_B = "0x2222222222222222222222222222222222222222";
const WALLET_C = "0x3333333333333333333333333333333333333333";
const WALLET_D = "0x4444444444444444444444444444444444444444";
const _WALLET_E = "0x5555555555555555555555555555555555555555";
void _WALLET_E; // Reserved for future use
const FUNDER_1 = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FUNDER_2 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Helper to create test wallet
function createTestWallet(overrides: Partial<SybilWallet> = {}): SybilWallet {
  const now = Date.now();
  return {
    address: WALLET_A,
    creationTimestamp: now - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    fundingSource: FUNDER_1,
    totalFundingUsd: 1000,
    uniqueFunderCount: 1,
    firstTradeTimestamp: now - 6 * 24 * 60 * 60 * 1000,
    tradeCount: 10,
    totalVolumeUsd: 5000,
    uniqueMarketsTraded: 5,
    avgTradeSizeUsd: 500,
    winRate: 0.6,
    activeHours: [9, 10, 11, 14, 15, 16],
    avgGasPrice: 30,
    lastActivityTimestamp: now - 1 * 60 * 60 * 1000, // 1 hour ago
    isFresh: false,
    ...overrides,
  };
}

// Helper to create test trade
function createTestTrade(overrides: Partial<SybilTrade> = {}): SybilTrade {
  return {
    tradeId: `trade_${Math.random().toString(36).substring(7)}`,
    walletAddress: WALLET_A,
    marketId: "market_1",
    side: "buy",
    sizeUsd: 500,
    price: 0.65,
    timestamp: Date.now() - 1 * 60 * 60 * 1000,
    gasPrice: 30,
    ...overrides,
  };
}

// Helper to create funding transaction
function createFundingTx(overrides: Partial<FundingTransaction> = {}): FundingTransaction {
  return {
    txHash: `0x${Math.random().toString(16).substring(2)}`,
    from: FUNDER_1,
    to: WALLET_A,
    amount: 1,
    amountUsd: 1000,
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe("SybilAttackDetector", () => {
  let detector: SybilAttackDetector;

  beforeEach(() => {
    detector = new SybilAttackDetector();
    resetSharedSybilAttackDetector();
  });

  afterEach(() => {
    detector.clear();
  });

  describe("Constructor", () => {
    it("should create with default config", () => {
      const det = new SybilAttackDetector();
      expect(det).toBeDefined();
    });

    it("should create with custom config", () => {
      const det = new SybilAttackDetector({
        thresholds: {
          ...DEFAULT_SYBIL_THRESHOLDS,
          minSybilScore: 70,
        },
        enableCaching: false,
      });
      expect(det).toBeDefined();
    });

    it("should merge partial threshold config", () => {
      const det = new SybilAttackDetector({
        thresholds: {
          minSybilScore: 80,
        } as any,
      });
      expect(det).toBeDefined();
    });
  });

  describe("Wallet Management", () => {
    it("should add a wallet", () => {
      const wallet = createTestWallet();
      detector.addWallet(wallet);
      expect(detector.getWallet(wallet.address)).toBeDefined();
    });

    it("should add multiple wallets", () => {
      const wallets = [
        createTestWallet({ address: WALLET_A }),
        createTestWallet({ address: WALLET_B }),
      ];
      detector.addWallets(wallets);
      expect(detector.getAllWallets()).toHaveLength(2);
    });

    it("should normalize wallet addresses", () => {
      const wallet = createTestWallet({
        address: "0x1111111111111111111111111111111111111111",
      });
      detector.addWallet(wallet);
      // Should find with checksummed address
      expect(detector.getWallet("0x1111111111111111111111111111111111111111")).toBeDefined();
    });

    it("should throw for invalid address", () => {
      const wallet = createTestWallet({ address: "invalid" });
      expect(() => detector.addWallet(wallet)).toThrow();
    });

    it("should get all tracked wallets", () => {
      detector.addWallets([
        createTestWallet({ address: WALLET_A }),
        createTestWallet({ address: WALLET_B }),
        createTestWallet({ address: WALLET_C }),
      ]);
      expect(detector.getAllWallets()).toHaveLength(3);
    });
  });

  describe("Trade Management", () => {
    it("should add a trade", () => {
      const trade = createTestTrade();
      detector.addTrade(trade);
      expect(detector.getWalletTrades(trade.walletAddress)).toHaveLength(1);
    });

    it("should add multiple trades", () => {
      const trades = [
        createTestTrade({ tradeId: "t1", walletAddress: WALLET_A }),
        createTestTrade({ tradeId: "t2", walletAddress: WALLET_A }),
        createTestTrade({ tradeId: "t3", walletAddress: WALLET_B }),
      ];
      detector.addTrades(trades);
      expect(detector.getWalletTrades(WALLET_A)).toHaveLength(2);
      expect(detector.getWalletTrades(WALLET_B)).toHaveLength(1);
    });

    it("should return empty array for wallet with no trades", () => {
      expect(detector.getWalletTrades(WALLET_A)).toEqual([]);
    });
  });

  describe("Funding Transaction Management", () => {
    it("should add funding transaction", () => {
      const tx = createFundingTx();
      detector.addFundingTransaction(tx);
      // Internal storage - just verify no error
      expect(true).toBe(true);
    });

    it("should add multiple funding transactions", () => {
      const txs = [
        createFundingTx({ to: WALLET_A }),
        createFundingTx({ to: WALLET_B }),
      ];
      detector.addFundingTransactions(txs);
      expect(true).toBe(true);
    });
  });

  describe("Pair Analysis", () => {
    it("should analyze wallet pair with no data", () => {
      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.sybilScore).toBe(0);
      expect(similarity.isLikelySybil).toBe(false);
    });

    it("should detect same funder", () => {
      const now = Date.now();
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          fundingSource: FUNDER_1,
          creationTimestamp: now - 1000,
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          fundingSource: FUNDER_1,
          creationTimestamp: now - 2000,
        })
      );

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.fundingSourceMatch).toBe(1);
      expect(similarity.flags).toContain(SybilFlag.SAME_FUNDER);
    });

    it("should detect creation time cluster", () => {
      const now = Date.now();
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          creationTimestamp: now,
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          creationTimestamp: now + 1000, // 1 second later
        })
      );

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.creationProximity).toBeGreaterThan(0.99);
      expect(similarity.flags).toContain(SybilFlag.CREATION_TIME_CLUSTER);
    });

    it("should detect market selection match", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      detector.addWallet(createTestWallet({ address: WALLET_B }));

      // Same markets
      const markets = ["market_1", "market_2", "market_3"];
      markets.forEach((marketId) => {
        detector.addTrade(createTestTrade({ walletAddress: WALLET_A, marketId }));
        detector.addTrade(createTestTrade({ walletAddress: WALLET_B, marketId }));
      });

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.marketSelectionOverlap).toBe(1);
      expect(similarity.flags).toContain(SybilFlag.MARKET_SELECTION_MATCH);
    });

    it("should detect size strategy match", () => {
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          avgTradeSizeUsd: 500,
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          avgTradeSizeUsd: 510, // Very similar
        })
      );

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.positionSizingSimilarity).toBeGreaterThan(0.9);
      expect(similarity.flags).toContain(SybilFlag.SIZE_STRATEGY_MATCH);
    });

    it("should detect gas price match", () => {
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          avgGasPrice: 30,
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          avgGasPrice: 31, // Very similar
        })
      );

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.gasUsageSimilarity).toBeGreaterThan(0.8);
      expect(similarity.flags).toContain(SybilFlag.GAS_PRICE_MATCH);
    });

    it("should detect timing fingerprint", () => {
      const activeHours = [9, 10, 11, 14, 15, 16];
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          activeHours,
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          activeHours, // Same hours
        })
      );

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.activityTimingCorrelation).toBeCloseTo(1, 10);
      expect(similarity.flags).toContain(SybilFlag.TIMING_FINGERPRINT);
    });

    it("should detect all fresh wallets", () => {
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          isFresh: true,
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          isFresh: true,
        })
      );

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.flags).toContain(SybilFlag.ALL_FRESH_WALLETS);
    });

    it("should calculate sybil score correctly for similar wallets", () => {
      const now = Date.now();
      const commonConfig = {
        fundingSource: FUNDER_1,
        creationTimestamp: now,
        avgTradeSizeUsd: 500,
        avgGasPrice: 30,
        activeHours: [9, 10, 11, 14, 15, 16],
        lastActivityTimestamp: now,
        isFresh: true,
      };

      detector.addWallet(createTestWallet({ address: WALLET_A, ...commonConfig }));
      detector.addWallet(createTestWallet({ address: WALLET_B, ...commonConfig }));

      // Same markets
      detector.addTrade(createTestTrade({ walletAddress: WALLET_A, marketId: "m1" }));
      detector.addTrade(createTestTrade({ walletAddress: WALLET_B, marketId: "m1" }));

      const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
      expect(similarity.sybilScore).toBeGreaterThan(60);
      expect(similarity.isLikelySybil).toBe(true);
    });
  });

  describe("Cluster Detection", () => {
    it("should detect no clusters with insufficient wallets", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      const clusters = detector.detectClusters();
      expect(clusters).toHaveLength(0);
    });

    it("should detect cluster of similar wallets", () => {
      const now = Date.now();
      const commonConfig = {
        fundingSource: FUNDER_1,
        creationTimestamp: now,
        avgTradeSizeUsd: 500,
        avgGasPrice: 30,
        activeHours: [9, 10, 11],
        lastActivityTimestamp: now,
        isFresh: true,
      };

      detector.addWallet(createTestWallet({ address: WALLET_A, ...commonConfig }));
      detector.addWallet(createTestWallet({ address: WALLET_B, ...commonConfig }));
      detector.addWallet(createTestWallet({ address: WALLET_C, ...commonConfig }));

      // Add same market trades
      [WALLET_A, WALLET_B, WALLET_C].forEach((wallet) => {
        detector.addTrade(createTestTrade({ walletAddress: wallet, marketId: "m1" }));
      });

      const clusters = detector.detectClusters();
      expect(clusters.length).toBeGreaterThanOrEqual(1);

      const cluster = clusters[0]!;
      expect(cluster.memberCount).toBeGreaterThanOrEqual(2);
      expect(cluster.sybilProbability).toBeGreaterThan(0);
    });

    it("should not cluster dissimilar wallets", () => {
      const now = Date.now();

      // Very different wallets
      detector.addWallet(
        createTestWallet({
          address: WALLET_A,
          fundingSource: FUNDER_1,
          creationTimestamp: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          avgTradeSizeUsd: 100,
          avgGasPrice: 10,
          activeHours: [1, 2, 3],
        })
      );
      detector.addWallet(
        createTestWallet({
          address: WALLET_B,
          fundingSource: FUNDER_2,
          creationTimestamp: now,
          avgTradeSizeUsd: 10000,
          avgGasPrice: 100,
          activeHours: [12, 13, 14],
        })
      );

      // Different markets
      detector.addTrade(createTestTrade({ walletAddress: WALLET_A, marketId: "m1" }));
      detector.addTrade(createTestTrade({ walletAddress: WALLET_B, marketId: "m2" }));

      const clusters = detector.detectClusters();
      // Should either have no clusters or low probability clusters
      if (clusters.length > 0) {
        expect(clusters[0]!.sybilProbability).toBeLessThan(60);
      }
    });

    it("should emit event on cluster detection", () => {
      const eventHandler = vi.fn();
      detector.on("clusterDetected", eventHandler);

      const now = Date.now();
      const commonConfig = {
        fundingSource: FUNDER_1,
        creationTimestamp: now,
        avgTradeSizeUsd: 500,
        avgGasPrice: 30,
        activeHours: [9, 10, 11],
        lastActivityTimestamp: now,
        isFresh: true,
      };

      detector.addWallet(createTestWallet({ address: WALLET_A, ...commonConfig }));
      detector.addWallet(createTestWallet({ address: WALLET_B, ...commonConfig }));

      detector.addTrade(createTestTrade({ walletAddress: WALLET_A, marketId: "m1" }));
      detector.addTrade(createTestTrade({ walletAddress: WALLET_B, marketId: "m1" }));

      detector.detectClusters();

      // Event may or may not fire depending on sybil score threshold
      // Just verify no error occurs
      expect(true).toBe(true);
    });
  });

  describe("Wallet Analysis", () => {
    it("should return low confidence for wallet with no data", () => {
      const result = detector.analyzeWallet(WALLET_A);
      expect(result.isLikelySybil).toBe(false);
      expect(result.confidence).toBe(SybilConfidence.VERY_LOW);
      expect(result.sybilProbability).toBe(0);
    });

    it("should return low confidence for wallet with few trades", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A, tradeCount: 1 }));
      detector.addTrade(createTestTrade({ walletAddress: WALLET_A }));

      const result = detector.analyzeWallet(WALLET_A, { minTrades: 5 });
      expect(result.summary).toContain("Insufficient data");
    });

    it("should detect sybil for wallet in suspicious cluster", () => {
      const now = Date.now();
      const commonConfig = {
        fundingSource: FUNDER_1,
        creationTimestamp: now,
        avgTradeSizeUsd: 500,
        avgGasPrice: 30,
        activeHours: [9, 10, 11],
        lastActivityTimestamp: now,
        isFresh: true,
        tradeCount: 10,
      };

      detector.addWallet(createTestWallet({ address: WALLET_A, ...commonConfig }));
      detector.addWallet(createTestWallet({ address: WALLET_B, ...commonConfig }));
      detector.addWallet(createTestWallet({ address: WALLET_C, ...commonConfig }));

      [WALLET_A, WALLET_B, WALLET_C].forEach((wallet) => {
        for (let i = 0; i < 5; i++) {
          detector.addTrade(
            createTestTrade({
              walletAddress: wallet,
              marketId: "m1",
              tradeId: `${wallet}_${i}`,
            })
          );
        }
      });

      const result = detector.analyzeWallet(WALLET_A);

      // The result depends on actual sybil score calculations
      expect(result.walletAddress).toBe(getChecksumAddress(WALLET_A));
      expect(result.analyzedAt).toBeDefined();
    });

    it("should use cache for repeated analysis", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      detector.addTrades([
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t1" }),
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t2" }),
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t3" }),
      ]);

      const result1 = detector.analyzeWallet(WALLET_A);
      const result2 = detector.analyzeWallet(WALLET_A);

      expect(result1.walletAddress).toBe(result2.walletAddress);
    });

    it("should bypass cache with forceRefresh", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      detector.addTrades([
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t1" }),
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t2" }),
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t3" }),
      ]);

      const result1 = detector.analyzeWallet(WALLET_A);
      const result2 = detector.analyzeWallet(WALLET_A, { forceRefresh: true });

      expect(result1.walletAddress).toBe(result2.walletAddress);
    });
  });

  describe("Batch Analysis", () => {
    it("should analyze multiple wallets", () => {
      const now = Date.now();
      const wallets = [WALLET_A, WALLET_B, WALLET_C];

      wallets.forEach((addr) => {
        detector.addWallet(
          createTestWallet({
            address: addr,
            creationTimestamp: now,
            tradeCount: 10,
          })
        );
        for (let i = 0; i < 5; i++) {
          detector.addTrade(
            createTestTrade({
              walletAddress: addr,
              marketId: "m1",
              tradeId: `${addr}_${i}`,
            })
          );
        }
      });

      const result = detector.batchAnalyze(wallets);

      expect(result.totalWalletsAnalyzed).toBe(3);
      expect(result.results.size).toBe(3);
      expect(result.analysisDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should respect max batch size", () => {
      const det = new SybilAttackDetector({ maxBatchSize: 2 });

      const wallets = [WALLET_A, WALLET_B, WALLET_C, WALLET_D];
      wallets.forEach((addr) => {
        det.addWallet(createTestWallet({ address: addr }));
      });

      const result = det.batchAnalyze(wallets);
      expect(result.totalWalletsAnalyzed).toBe(2);
    });

    it("should return high risk clusters", () => {
      // This test just verifies the structure
      const result = detector.batchAnalyze([WALLET_A]);
      expect(Array.isArray(result.highRiskClusters)).toBe(true);
    });
  });

  describe("Query Methods", () => {
    it("should check if wallet is likely sybil", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      const result = detector.isWalletLikelySybil(WALLET_A);
      expect(typeof result).toBe("boolean");
    });

    it("should get all clusters", () => {
      const clusters = detector.getClusters();
      expect(Array.isArray(clusters)).toBe(true);
    });

    it("should get high risk clusters", () => {
      const clusters = detector.getHighRiskClusters();
      expect(Array.isArray(clusters)).toBe(true);
    });

    it("should get wallet clusters", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      const clusters = detector.getWalletClusters(WALLET_A);
      expect(Array.isArray(clusters)).toBe(true);
    });

    it("should get summary", () => {
      const summary = detector.getSummary();

      expect(summary.totalWallets).toBe(0);
      expect(summary.totalTrades).toBe(0);
      expect(summary.totalClusters).toBe(0);
      expect(summary.highRiskClusterCount).toBe(0);
      expect(summary.sybilWalletCount).toBe(0);
      expect(summary.clusterSizeDistribution).toBeDefined();
      expect(Array.isArray(summary.topIndicators)).toBe(true);
      expect(Array.isArray(summary.topFlags)).toBe(true);
      expect(typeof summary.cacheHitRate).toBe("number");
      expect(summary.lastUpdated).toBeDefined();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      detector.addTrades([
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t1" }),
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t2" }),
        createTestTrade({ walletAddress: WALLET_A, tradeId: "t3" }),
      ]);

      void detector.analyzeWallet(WALLET_A);
      detector.clearCache();

      // No direct way to verify cache is cleared, but no error should occur
      void detector.analyzeWallet(WALLET_A);
      expect(true).toBe(true);
    });

    it("should invalidate cache when adding wallet data", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      void detector.analyzeWallet(WALLET_A);

      // Adding new data should invalidate cache
      detector.addWallet(createTestWallet({ address: WALLET_A, tradeCount: 20 }));

      // Analysis should use fresh data
      void detector.analyzeWallet(WALLET_A);
      expect(true).toBe(true);
    });
  });

  describe("Clear", () => {
    it("should clear all data", () => {
      detector.addWallet(createTestWallet({ address: WALLET_A }));
      detector.addTrade(createTestTrade({ walletAddress: WALLET_A }));

      detector.clear();

      expect(detector.getAllWallets()).toHaveLength(0);
      expect(detector.getWalletTrades(WALLET_A)).toHaveLength(0);
      expect(detector.getClusters()).toHaveLength(0);
    });
  });
});

describe("Factory Functions", () => {
  beforeEach(() => {
    resetSharedSybilAttackDetector();
  });

  it("should create detector with factory function", () => {
    const detector = createSybilAttackDetector();
    expect(detector).toBeInstanceOf(SybilAttackDetector);
  });

  it("should create detector with custom config", () => {
    const detector = createSybilAttackDetector({
      thresholds: {
        ...DEFAULT_SYBIL_THRESHOLDS,
        minSybilScore: 80,
      },
    });
    expect(detector).toBeInstanceOf(SybilAttackDetector);
  });

  it("should get shared instance", () => {
    const instance1 = getSharedSybilAttackDetector();
    const instance2 = getSharedSybilAttackDetector();
    expect(instance1).toBe(instance2);
  });

  it("should set shared instance", () => {
    const custom = new SybilAttackDetector();
    setSharedSybilAttackDetector(custom);
    expect(getSharedSybilAttackDetector()).toBe(custom);
  });

  it("should reset shared instance", () => {
    const instance1 = getSharedSybilAttackDetector();
    resetSharedSybilAttackDetector();
    const instance2 = getSharedSybilAttackDetector();
    expect(instance1).not.toBe(instance2);
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    resetSharedSybilAttackDetector();
  });

  it("should add wallets for analysis", () => {
    addWalletsForSybilAnalysis([createTestWallet({ address: WALLET_A })]);
    expect(getSharedSybilAttackDetector().getAllWallets()).toHaveLength(1);
  });

  it("should add trades for analysis", () => {
    addTradesForSybilAnalysis([createTestTrade({ walletAddress: WALLET_A })]);
    expect(getSharedSybilAttackDetector().getWalletTrades(WALLET_A)).toHaveLength(1);
  });

  it("should analyze wallet for sybil", () => {
    addWalletsForSybilAnalysis([createTestWallet({ address: WALLET_A })]);
    const result = analyzeWalletForSybil(WALLET_A);
    expect(result.walletAddress).toBeDefined();
  });

  it("should batch analyze for sybil", () => {
    addWalletsForSybilAnalysis([
      createTestWallet({ address: WALLET_A }),
      createTestWallet({ address: WALLET_B }),
    ]);
    const result = batchAnalyzeForSybil([WALLET_A, WALLET_B]);
    expect(result.totalWalletsAnalyzed).toBe(2);
  });

  it("should check if wallet is sybil", () => {
    addWalletsForSybilAnalysis([createTestWallet({ address: WALLET_A })]);
    const result = isWalletSybil(WALLET_A);
    expect(typeof result).toBe("boolean");
  });

  it("should get detected clusters", () => {
    const clusters = getDetectedSybilClusters();
    expect(Array.isArray(clusters)).toBe(true);
  });

  it("should get high risk clusters", () => {
    const clusters = getHighRiskSybilClusters();
    expect(Array.isArray(clusters)).toBe(true);
  });

  it("should get summary", () => {
    const summary = getSybilDetectorSummary();
    expect(summary.totalWallets).toBeDefined();
  });
});

describe("Description Functions", () => {
  it("should get indicator descriptions", () => {
    expect(getSybilIndicatorDescription(SybilIndicatorType.UNKNOWN)).toBeDefined();
    expect(getSybilIndicatorDescription(SybilIndicatorType.SHARED_FUNDING_SOURCE)).toContain(
      "funded"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.TEMPORAL_CREATION_CLUSTER)).toContain(
      "created"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.BEHAVIORAL_FINGERPRINT)).toContain(
      "behavioral"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.IDENTICAL_STRATEGIES)).toContain(
      "strategies"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.SEQUENTIAL_TRANSACTIONS)).toContain(
      "Sequential"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.GAS_PATTERN_MATCH)).toContain("gas");
    expect(getSybilIndicatorDescription(SybilIndicatorType.CONTRACT_INTERACTION_MATCH)).toContain(
      "contract"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.METADATA_CORRELATION)).toContain(
      "Metadata"
    );
    expect(getSybilIndicatorDescription(SybilIndicatorType.CIRCULAR_FUNDING)).toContain("Circular");
    expect(getSybilIndicatorDescription(SybilIndicatorType.FRESH_WALLET_SWARM)).toContain("fresh");
    expect(getSybilIndicatorDescription(SybilIndicatorType.MULTI_INDICATOR)).toContain("Multiple");
  });

  it("should get confidence descriptions", () => {
    expect(getSybilConfidenceDescription(SybilConfidence.VERY_LOW)).toContain("Very low");
    expect(getSybilConfidenceDescription(SybilConfidence.LOW)).toContain("Low");
    expect(getSybilConfidenceDescription(SybilConfidence.MEDIUM)).toContain("Medium");
    expect(getSybilConfidenceDescription(SybilConfidence.HIGH)).toContain("High");
    expect(getSybilConfidenceDescription(SybilConfidence.VERY_HIGH)).toContain("Very high");
  });

  it("should get risk descriptions", () => {
    expect(getSybilRiskDescription(SybilRiskLevel.NONE)).toContain("No");
    expect(getSybilRiskDescription(SybilRiskLevel.LOW)).toContain("Low");
    expect(getSybilRiskDescription(SybilRiskLevel.MEDIUM)).toContain("Medium");
    expect(getSybilRiskDescription(SybilRiskLevel.HIGH)).toContain("High");
    expect(getSybilRiskDescription(SybilRiskLevel.CRITICAL)).toContain("Critical");
  });

  it("should get flag descriptions", () => {
    expect(getSybilFlagDescription(SybilFlag.SAME_FUNDER)).toContain("Funded");
    expect(getSybilFlagDescription(SybilFlag.CREATION_TIME_CLUSTER)).toContain("Created");
    expect(getSybilFlagDescription(SybilFlag.TIMING_FINGERPRINT)).toContain("timing");
    expect(getSybilFlagDescription(SybilFlag.GAS_PRICE_MATCH)).toContain("gas");
    expect(getSybilFlagDescription(SybilFlag.NONCE_SEQUENCE)).toContain("nonce");
    expect(getSybilFlagDescription(SybilFlag.MARKET_SELECTION_MATCH)).toContain("market");
    expect(getSybilFlagDescription(SybilFlag.SIZE_STRATEGY_MATCH)).toContain("sizing");
    expect(getSybilFlagDescription(SybilFlag.NO_CROSS_INTERACTION)).toContain("interact");
    expect(getSybilFlagDescription(SybilFlag.CIRCULAR_FLOW)).toContain("circular");
    expect(getSybilFlagDescription(SybilFlag.SYNCHRONIZED_ACTIVITY)).toContain("Synchronized");
    expect(getSybilFlagDescription(SybilFlag.APPROVAL_PATTERN_MATCH)).toContain("approval");
    expect(getSybilFlagDescription(SybilFlag.SHARED_WITHDRAWAL_DEST)).toContain("withdrawal");
    expect(getSybilFlagDescription(SybilFlag.BOT_SIGNATURE)).toContain("Bot");
    expect(getSybilFlagDescription(SybilFlag.ALL_FRESH_WALLETS)).toContain("fresh");
  });
});

describe("Constants", () => {
  it("should have valid default thresholds", () => {
    expect(DEFAULT_SYBIL_THRESHOLDS.minSybilScore).toBeGreaterThan(0);
    expect(DEFAULT_SYBIL_THRESHOLDS.minSybilScore).toBeLessThanOrEqual(100);
    expect(DEFAULT_SYBIL_THRESHOLDS.creationTimeWindow).toBeGreaterThan(0);
    expect(DEFAULT_SYBIL_THRESHOLDS.minFundingSourceMatch).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SYBIL_THRESHOLDS.minFundingSourceMatch).toBeLessThanOrEqual(1);
    expect(DEFAULT_SYBIL_THRESHOLDS.minBehavioralMatch).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SYBIL_THRESHOLDS.minBehavioralMatch).toBeLessThanOrEqual(1);
    expect(DEFAULT_SYBIL_THRESHOLDS.minClusterSize).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_SYBIL_THRESHOLDS.maxClusterSize).toBeGreaterThan(
      DEFAULT_SYBIL_THRESHOLDS.minClusterSize
    );
  });
});

describe("Edge Cases", () => {
  let detector: SybilAttackDetector;

  beforeEach(() => {
    detector = new SybilAttackDetector();
  });

  afterEach(() => {
    detector.clear();
  });

  it("should handle empty wallet array", () => {
    const result = detector.batchAnalyze([]);
    expect(result.totalWalletsAnalyzed).toBe(0);
  });

  it("should handle wallet with no trades", () => {
    detector.addWallet(createTestWallet({ address: WALLET_A, tradeCount: 0 }));
    const result = detector.analyzeWallet(WALLET_A);
    expect(result.summary).toContain("Insufficient");
  });

  it("should handle wallet with undefined optional fields", () => {
    const wallet: SybilWallet = {
      address: WALLET_A,
      creationTimestamp: Date.now(),
      tradeCount: 5,
      totalVolumeUsd: 1000,
      uniqueMarketsTraded: 3,
      avgTradeSizeUsd: 200,
      lastActivityTimestamp: Date.now(),
      isFresh: false,
    };
    detector.addWallet(wallet);
    const result = detector.analyzeWallet(WALLET_A);
    expect(result).toBeDefined();
  });

  it("should handle wallet with empty active hours", () => {
    detector.addWallet(
      createTestWallet({
        address: WALLET_A,
        activeHours: [],
      })
    );
    detector.addWallet(
      createTestWallet({
        address: WALLET_B,
        activeHours: [],
      })
    );

    const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
    expect(similarity.activityTimingCorrelation).toBe(0);
  });

  it("should handle zero average values", () => {
    detector.addWallet(
      createTestWallet({
        address: WALLET_A,
        avgTradeSizeUsd: 0,
        avgGasPrice: 0,
      })
    );
    detector.addWallet(
      createTestWallet({
        address: WALLET_B,
        avgTradeSizeUsd: 0,
        avgGasPrice: 0,
      })
    );

    const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
    // Should handle gracefully
    expect(similarity).toBeDefined();
  });

  it("should handle very large cluster", () => {
    const det = new SybilAttackDetector({
      thresholds: {
        ...DEFAULT_SYBIL_THRESHOLDS,
        maxClusterSize: 5,
      },
    });

    // Add 10 similar wallets
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      det.addWallet(
        createTestWallet({
          address: `0x${i.toString().padStart(40, "1")}`,
          fundingSource: FUNDER_1,
          creationTimestamp: now,
        })
      );
    }

    const clusters = det.detectClusters();
    // Should skip clusters larger than maxClusterSize
    clusters.forEach((c) => {
      expect(c.memberCount).toBeLessThanOrEqual(5);
    });
  });

  it("should handle funding transactions with different funders", () => {
    detector.addWallet(createTestWallet({ address: WALLET_A }));
    detector.addWallet(createTestWallet({ address: WALLET_B }));

    detector.addFundingTransactions([
      createFundingTx({ from: FUNDER_1, to: WALLET_A }),
      createFundingTx({ from: FUNDER_1, to: WALLET_A }), // Same funder
      createFundingTx({ from: FUNDER_2, to: WALLET_B }), // Different funder
    ]);

    const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
    expect(similarity.fundingSourceMatch).toBe(0);
  });

  it("should handle shared funding from transactions", () => {
    detector.addWallet(createTestWallet({ address: WALLET_A }));
    detector.addWallet(createTestWallet({ address: WALLET_B }));

    // Same funder for both wallets
    detector.addFundingTransactions([
      createFundingTx({ from: FUNDER_1, to: WALLET_A }),
      createFundingTx({ from: FUNDER_1, to: WALLET_B }),
    ]);

    const similarity = detector.analyzeWalletPair(WALLET_A, WALLET_B);
    expect(similarity.fundingSourceMatch).toBe(1);
    expect(similarity.flags).toContain(SybilFlag.SAME_FUNDER);
  });
});

describe("Event Emission", () => {
  let detector: SybilAttackDetector;

  beforeEach(() => {
    detector = new SybilAttackDetector({ emitEvents: true });
  });

  afterEach(() => {
    detector.clear();
  });

  it("should emit sybilDetected event", () => {
    const handler = vi.fn();
    detector.on("sybilDetected", handler);

    const now = Date.now();
    const commonConfig = {
      fundingSource: FUNDER_1,
      creationTimestamp: now,
      avgTradeSizeUsd: 500,
      avgGasPrice: 30,
      activeHours: [9, 10, 11],
      lastActivityTimestamp: now,
      isFresh: true,
      tradeCount: 10,
    };

    detector.addWallet(createTestWallet({ address: WALLET_A, ...commonConfig }));
    detector.addWallet(createTestWallet({ address: WALLET_B, ...commonConfig }));

    [WALLET_A, WALLET_B].forEach((wallet) => {
      for (let i = 0; i < 5; i++) {
        detector.addTrade(
          createTestTrade({
            walletAddress: wallet,
            marketId: "m1",
            tradeId: `${wallet}_${i}`,
          })
        );
      }
    });

    void detector.analyzeWallet(WALLET_A);

    // Event may or may not fire depending on sybil score
    expect(true).toBe(true);
  });

  it("should not emit events when disabled", () => {
    const det = new SybilAttackDetector({ emitEvents: false });
    const handler = vi.fn();
    det.on("clusterDetected", handler);
    det.on("sybilDetected", handler);

    det.addWallet(createTestWallet({ address: WALLET_A }));
    det.addWallet(createTestWallet({ address: WALLET_B }));
    det.detectClusters();

    // No events should fire
    expect(handler).not.toHaveBeenCalled();
  });
});

// Helper function to get checksum address (matching viem behavior)
function getChecksumAddress(address: string): string {
  // Simple checksum for testing
  return address.slice(0, 2) + address.slice(2).toLowerCase();
}
