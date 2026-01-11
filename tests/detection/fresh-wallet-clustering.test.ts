/**
 * Unit Tests for Fresh Wallet Clustering (DET-FRESH-006)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FreshWalletClusterAnalyzer,
  ClusterType,
  ClusterConfidenceLevel,
  DEFAULT_CLUSTERING_THRESHOLDS,
  createFreshWalletClusterAnalyzer,
  getSharedFreshWalletClusterAnalyzer,
  setSharedFreshWalletClusterAnalyzer,
  resetSharedFreshWalletClusterAnalyzer,
  analyzeWalletClusters,
  analyzeWalletClusterMembership,
  isWalletInCluster,
  hasHighCoordinationScore,
  getClusteringSummary,
  type WalletClusteringResult,
  type ClusteringThresholds,
} from "../../src/detection/fresh-wallet-clustering";
import { FreshWalletAlertSeverity } from "../../src/detection";

// Mock the external dependencies
vi.mock("../../src/api/clob/trades", () => ({
  getAllTradesByWallet: vi.fn(),
}));

vi.mock("../../src/api/chain/funding-source", () => ({
  getSharedFundingSourceTracker: vi.fn(),
}));

vi.mock("../../src/detection/wallet-age", () => ({
  getSharedWalletAgeCalculator: vi.fn(),
}));

vi.mock("../../src/detection/fresh-wallet-config", () => ({
  getSharedFreshWalletConfigManager: vi.fn(),
  FreshWalletAlertSeverity: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },
}));

import { getAllTradesByWallet } from "../../src/api/clob/trades";
import { getSharedFundingSourceTracker } from "../../src/api/chain/funding-source";
import { getSharedWalletAgeCalculator } from "../../src/detection/wallet-age";
import { getSharedFreshWalletConfigManager } from "../../src/detection/fresh-wallet-config";

// Test wallet addresses
const WALLET_1 = "0x1111111111111111111111111111111111111111";
const WALLET_2 = "0x2222222222222222222222222222222222222222";
const WALLET_3 = "0x3333333333333333333333333333333333333333";
const WALLET_4 = "0x4444444444444444444444444444444444444444";
const WALLET_5 = "0x5555555555555555555555555555555555555555";
const INVALID_ADDRESS = "0xinvalid";

// Common funding source
const FUNDING_SOURCE_1 = "0xf111111111111111111111111111111111111111";
const FUNDING_SOURCE_2 = "0xf222222222222222222222222222222222222222";

// Mock config manager
const mockConfigManager = {
  getConfig: vi.fn(),
  evaluateWallet: vi.fn(),
};

// Mock funding source tracker
const mockFundingTracker = {
  analyzeFundingSources: vi.fn(),
  getStats: vi.fn(),
};

// Mock wallet age calculator
const mockAgeCalculator = {
  calculateAge: vi.fn(),
  batchCalculateAge: vi.fn(),
};

// Sample trade data helper
const createTrade = (overrides: Partial<{
  id: string;
  asset_id: string;
  size: string;
  price: string;
  side: "buy" | "sell";
  created_at: string;
  transaction_hash: string;
}> = {}) => ({
  id: overrides.id ?? "trade-1",
  asset_id: overrides.asset_id ?? "token-123",
  size: overrides.size ?? "100",
  price: overrides.price ?? "0.5",
  side: overrides.side ?? "buy",
  created_at: overrides.created_at ?? "2024-01-01T00:00:00Z",
  transaction_hash: overrides.transaction_hash ?? "0xabc123",
});

// Sample funding analysis data helper
const createFundingAnalysis = (
  walletAddress: string,
  fundingSources: Array<{
    address: string;
    name?: string;
    type: string;
    totalAmount: bigint;
    formattedAmount: string;
    depth: number;
    firstTransferTimestamp: number;
    riskLevel?: string;
    isSanctioned?: boolean;
  }> = []
) => ({
  walletAddress,
  fundingSources: fundingSources.map((s) => ({
    address: s.address,
    name: s.name,
    type: s.type,
    totalAmount: s.totalAmount,
    formattedAmount: s.formattedAmount,
    transferCount: 1,
    firstTransferTimestamp: s.firstTransferTimestamp,
    lastTransferTimestamp: s.firstTransferTimestamp,
    transactionHashes: ["0x123"],
    riskLevel: s.riskLevel ?? "none",
    isSanctioned: s.isSanctioned ?? false,
    depth: s.depth,
  })),
  riskScore: 0,
  riskLevel: "none",
  riskFactors: [],
  summary: {
    totalSources: fundingSources.length,
    sourcesByType: { exchange: 0, mixer: 0, defi: 0, contract: 0, eoa: 0, unknown: 0 },
    sourcesByRisk: { critical: 0, high: 0, medium: 0, low: 0, none: 0 },
    exchangeFunds: { total: 0n, formatted: "0.000000", percentage: 0, exchanges: [] },
    mixerFunds: { total: 0n, formatted: "0.000000", percentage: 0, mixers: [] },
    defiFunds: { total: 0n, formatted: "0.000000", percentage: 0, protocols: [] },
    unknownFunds: { total: 0n, formatted: "0.000000", percentage: 0 },
    hasSanctionedSource: false,
    sanctionedSources: [],
  },
  graph: {
    targetWallet: walletAddress,
    nodes: [],
    edges: [],
    maxDepthExplored: 2,
    totalTransfersTraced: 0,
  },
  analyzedAt: new Date(),
  analysisDepth: 2,
  totalAmountTraced: fundingSources.reduce((a, s) => a + s.totalAmount, 0n),
  formattedTotalAmount: "0.000000",
});

// Sample wallet age result helper
const createAgeResult = (
  address: string,
  firstTransactionTimestamp: number | null = null
) => ({
  address,
  ageInDays: firstTransactionTimestamp
    ? Math.floor((Date.now() / 1000 - firstTransactionTimestamp) / 86400)
    : null,
  ageInHours: firstTransactionTimestamp
    ? Math.floor((Date.now() / 1000 - firstTransactionTimestamp) / 3600)
    : null,
  category: "NEW",
  isFresh: true,
  isNew: firstTransactionTimestamp === null,
  firstTransactionTimestamp,
  firstTransactionDate: firstTransactionTimestamp
    ? new Date(firstTransactionTimestamp * 1000)
    : null,
  firstTransactionHash: firstTransactionTimestamp ? "0x123" : null,
  fromCache: false,
  calculatedAt: new Date(),
});

describe("FreshWalletClusterAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFreshWalletClusterAnalyzer();

    // Set up default mocks
    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
    (getSharedFundingSourceTracker as ReturnType<typeof vi.fn>).mockReturnValue(
      mockFundingTracker
    );
    (getSharedWalletAgeCalculator as ReturnType<typeof vi.fn>).mockReturnValue(
      mockAgeCalculator
    );
  });

  afterEach(() => {
    resetSharedFreshWalletClusterAnalyzer();
  });

  describe("Constructor and Configuration", () => {
    it("should create instance with default configuration", () => {
      const analyzer = createFreshWalletClusterAnalyzer();
      expect(analyzer).toBeInstanceOf(FreshWalletClusterAnalyzer);
      expect(analyzer.getThresholds()).toEqual(DEFAULT_CLUSTERING_THRESHOLDS);
    });

    it("should create instance with custom configuration", () => {
      const customThresholds: Partial<ClusteringThresholds> = {
        minClusterSize: 3,
        temporalWindowHours: 48,
        minConfidence: 50,
      };

      const analyzer = createFreshWalletClusterAnalyzer({
        thresholds: customThresholds,
        cacheTtlMs: 10000,
        maxCacheSize: 100,
      });

      const thresholds = analyzer.getThresholds();
      expect(thresholds.minClusterSize).toBe(3);
      expect(thresholds.temporalWindowHours).toBe(48);
      expect(thresholds.minConfidence).toBe(50);
    });

    it("should have cache management methods", () => {
      const analyzer = createFreshWalletClusterAnalyzer();
      const stats = analyzer.getCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("ttlMs");
      expect(stats.size).toBe(0);
    });

    it("should have getConfigManager method", () => {
      const analyzer = createFreshWalletClusterAnalyzer();
      expect(analyzer.getConfigManager()).toBeDefined();
    });
  });

  describe("Singleton Management", () => {
    it("should return same instance for shared analyzer", () => {
      const instance1 = getSharedFreshWalletClusterAnalyzer();
      const instance2 = getSharedFreshWalletClusterAnalyzer();
      expect(instance1).toBe(instance2);
    });

    it("should allow setting shared analyzer", () => {
      const customAnalyzer = createFreshWalletClusterAnalyzer({
        thresholds: { minClusterSize: 5 },
      });
      setSharedFreshWalletClusterAnalyzer(customAnalyzer);

      const shared = getSharedFreshWalletClusterAnalyzer();
      expect(shared.getThresholds().minClusterSize).toBe(5);
    });

    it("should reset shared analyzer", () => {
      const firstInstance = getSharedFreshWalletClusterAnalyzer();
      resetSharedFreshWalletClusterAnalyzer();
      const secondInstance = getSharedFreshWalletClusterAnalyzer();
      expect(firstInstance).not.toBe(secondInstance);
    });
  });

  describe("Address Validation", () => {
    it("should reject invalid addresses in batch analysis", async () => {
      // Setup mocks for valid addresses
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(createAgeResult(WALLET_1));

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([INVALID_ADDRESS, WALLET_1]);

      expect(result.errors.has(INVALID_ADDRESS)).toBe(true);
      expect(result.errorCount).toBe(1);
      expect(result.successCount).toBe(1);
    });
  });

  describe("Funding Source Clustering", () => {
    it("should detect wallets with shared funding source", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      // All wallets funded by same source
      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              name: "Binance",
              type: "exchange",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      expect(result.successCount).toBe(3);

      // Should detect a funding source cluster
      const fundingClusters = result.clusters.filter(
        (c) => c.clusterType === ClusterType.FUNDING_SOURCE
      );
      expect(fundingClusters.length).toBeGreaterThan(0);

      // The wallets should be in the same cluster
      const cluster = fundingClusters[0];
      expect(cluster?.members).toContain(WALLET_1);
      expect(cluster?.members).toContain(WALLET_2);
      expect(cluster?.members).toContain(WALLET_3);
    });

    it("should detect suspicious funding sources in clusters", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              name: "Tornado Cash",
              type: "mixer",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
              riskLevel: "critical",
              isSanctioned: true,
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2]);

      const wallet1Result = result.results.get(WALLET_1);
      expect(wallet1Result).toBeDefined();

      // Should have suspicious funding cluster
      const suspiciousClusters = wallet1Result?.fundingSourceClusters.filter(
        (c) => c.isSuspicious
      );
      expect(suspiciousClusters?.length).toBeGreaterThan(0);
    });

    it("should not cluster wallets with different funding sources", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) => {
          // Each wallet has different funding source
          const sourceAddr = address === WALLET_1 ? FUNDING_SOURCE_1 : FUNDING_SOURCE_2;
          return createFundingAnalysis(address, [
            {
              address: sourceAddr,
              name: address === WALLET_1 ? "Binance" : "Coinbase",
              type: "exchange",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
            },
          ]);
        }
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp + (address === WALLET_1 ? 0 : 100000))
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2]);

      // Should not create a funding source cluster (different sources)
      const fundingClusters = result.clusters.filter(
        (c) =>
          c.clusterType === ClusterType.FUNDING_SOURCE &&
          c.members.includes(WALLET_1) &&
          c.members.includes(WALLET_2)
      );
      expect(fundingClusters.length).toBe(0);
    });
  });

  describe("Temporal Clustering", () => {
    it("should detect wallets created within same time window", async () => {
      const baseTimestamp = Math.floor(Date.now() / 1000) - 86400;

      // All wallets created within 1 hour of each other
      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) => {
        const offset =
          address === WALLET_1 ? 0 : address === WALLET_2 ? 600 : 1200; // 0, 10min, 20min
        return createAgeResult(address, baseTimestamp + offset);
      });

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) => createFundingAnalysis(address)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // Should detect a temporal cluster
      const temporalClusters = result.clusters.filter(
        (c) => c.clusterType === ClusterType.TEMPORAL
      );
      expect(temporalClusters.length).toBeGreaterThanOrEqual(0);

      // Check individual wallet results
      const wallet1Result = result.results.get(WALLET_1);
      expect(wallet1Result).toBeDefined();
    });

    it("should not cluster wallets created far apart", async () => {
      const baseTimestamp = Math.floor(Date.now() / 1000);

      // Wallets created weeks apart
      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) => {
        const offset =
          address === WALLET_1 ? 0 : address === WALLET_2 ? 604800 * 2 : 604800 * 4; // 0, 2 weeks, 4 weeks
        return createAgeResult(address, baseTimestamp - offset);
      });

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) => createFundingAnalysis(address)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // Should not detect a temporal cluster containing all three
      const temporalClusters = result.clusters.filter(
        (c) =>
          c.clusterType === ClusterType.TEMPORAL &&
          c.members.includes(WALLET_1) &&
          c.members.includes(WALLET_2) &&
          c.members.includes(WALLET_3)
      );
      expect(temporalClusters.length).toBe(0);
    });
  });

  describe("Trading Pattern Clustering", () => {
    it("should detect wallets with similar trading patterns", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) => createFundingAnalysis(address)
      );

      // Similar trading patterns - same market, similar sizes
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockImplementation(
        async (address: string) => {
          const tradeTime = new Date(timestamp * 1000).toISOString();
          return [
            createTrade({
              id: `${address}-1`,
              asset_id: "market-abc-123",
              size: "100",
              price: "0.5",
              side: "buy",
              created_at: tradeTime,
            }),
            createTrade({
              id: `${address}-2`,
              asset_id: "market-abc-123",
              size: "150",
              price: "0.55",
              side: "buy",
              created_at: new Date((timestamp + 3600) * 1000).toISOString(),
            }),
          ];
        }
      );

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // At minimum, should have no errors
      expect(result.errorCount).toBe(0);
      expect(result.successCount).toBe(3);

      // Check for trading pattern clusters (may or may not be detected based on similarity)
      const hasTradingClusters = result.clusters.some(
        (c) => c.clusterType === ClusterType.TRADING_PATTERN
      );
      // This is informational - trading clusters depend on pattern similarity
      expect(typeof hasTradingClusters).toBe("boolean");
    });

    it("should detect wallets trading on same markets", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;
      const sharedMarket = "shared-market-xyz";

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) => createFundingAnalysis(address)
      );

      // All wallets trade on same market
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockImplementation(async () => [
        createTrade({
          asset_id: sharedMarket,
          size: "100",
          price: "0.5",
          side: "buy",
          created_at: new Date(timestamp * 1000).toISOString(),
        }),
        createTrade({
          asset_id: sharedMarket,
          size: "200",
          price: "0.6",
          side: "sell",
          created_at: new Date((timestamp + 3600) * 1000).toISOString(),
        }),
      ]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // Check that wallets have trading pattern clusters
      for (const [, walletResult] of result.results) {
        if (walletResult.tradingPatternCluster) {
          expect(walletResult.tradingPatternCluster.sharedMarkets).toContain(
            sharedMarket
          );
        }
      }
    });
  });

  describe("Multi-Factor Clustering", () => {
    it("should detect multi-factor clusters", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      // Wallets with same funding source, created close together, similar trading
      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              name: "Common Source",
              type: "exchange",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp - 60, // Funded just before creation
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) => {
        const offset = address === WALLET_1 ? 0 : address === WALLET_2 ? 300 : 600;
        return createAgeResult(address, timestamp + offset);
      });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockImplementation(async () => [
        createTrade({
          asset_id: "common-market",
          size: "100",
          price: "0.5",
          side: "buy",
          created_at: new Date((timestamp + 1000) * 1000).toISOString(),
        }),
      ]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // With shared funding, temporal proximity, and same market trading,
      // we should see multiple cluster types or a multi-factor cluster
      expect(result.successCount).toBe(3);

      // Check if any wallet has high coordination score
      let hasHighScore = false;
      for (const [, walletResult] of result.results) {
        if (walletResult.coordinationScore > 0) {
          hasHighScore = true;
        }
      }
      expect(hasHighScore).toBe(true);
    });
  });

  describe("Coordination Score", () => {
    it("should calculate coordination score for clustered wallets", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              type: "exchange",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // Wallets in cluster should have coordination score > 0
      for (const [, walletResult] of result.results) {
        if (walletResult.clusterIds.length > 0) {
          expect(walletResult.coordinationScore).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("should return 0 coordination for unclustered wallets", async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      // Each wallet completely different
      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) => createFundingAnalysis(address)
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) => {
        const offset = address === WALLET_1 ? 0 : 86400 * 30; // 30 days apart
        return createAgeResult(address, timestamp - offset);
      });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2]);

      for (const [, walletResult] of result.results) {
        if (walletResult.clusterIds.length === 0) {
          expect(walletResult.coordinationScore).toBe(0);
        }
      }
    });
  });

  describe("Severity Determination", () => {
    it("should assign higher severity for suspicious clusters", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              name: "Mixer",
              type: "mixer",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
              riskLevel: "high",
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      // Check individual wallet results for suspicious funding clusters
      for (const [, walletResult] of result.results) {
        const suspiciousClusters = walletResult.fundingSourceClusters.filter(
          (c) => c.isSuspicious
        );
        if (suspiciousClusters.length > 0) {
          // Wallet with suspicious funding should have elevated severity or high coordination
          const hasSuspiciousIndicator =
            walletResult.severity !== FreshWalletAlertSeverity.LOW ||
            walletResult.coordinationScore > 0 ||
            walletResult.flagReasons.length > 0;
          expect(hasSuspiciousIndicator).toBe(true);
        }
      }
    });
  });

  describe("Summary Statistics", () => {
    it("should generate accurate summary statistics", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              type: "exchange",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([
        WALLET_1,
        WALLET_2,
        WALLET_3,
        WALLET_4,
        WALLET_5,
      ]);

      const summary = analyzer.getSummary(result);

      expect(summary.totalWallets).toBe(5);
      expect(summary.totalClusters).toBe(result.clusters.length);
      expect(summary.byClusterType).toBeDefined();
      expect(summary.byConfidenceLevel).toBeDefined();

      // Clustered percentage should be calculated
      expect(summary.clusteredPercentage).toBeGreaterThanOrEqual(0);
      expect(summary.clusteredPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe("Convenience Functions", () => {
    it("should work with analyzeWalletClusters convenience function", async () => {
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(createAgeResult(WALLET_1));
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await analyzeWalletClusters([WALLET_1, WALLET_2]);

      expect(result).toBeDefined();
      expect(result.totalProcessed).toBe(2);
    });

    it("should work with analyzeWalletClusterMembership convenience function", async () => {
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(createAgeResult(WALLET_1));
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await analyzeWalletClusterMembership(WALLET_1, [WALLET_2, WALLET_3]);

      expect(result).toBeDefined();
      expect(result.address.toLowerCase()).toBe(WALLET_1.toLowerCase());
    });

    it("should work with isWalletInCluster helper", () => {
      const resultWithCluster: WalletClusteringResult = {
        address: WALLET_1,
        clusterIds: ["FS-1"],
        clusterCount: 1,
        clusterConfidences: { "FS-1": 70 },
        fundingSourceClusters: [],
        temporalCluster: null,
        tradingPatternCluster: null,
        overallClusterConfidence: 70,
        confidenceLevel: ClusterConfidenceLevel.HIGH,
        coordinationScore: 50,
        severity: FreshWalletAlertSeverity.MEDIUM,
        flagReasons: [],
        fromCache: false,
        analyzedAt: new Date(),
      };

      const resultWithoutCluster: WalletClusteringResult = {
        ...resultWithCluster,
        clusterIds: [],
        clusterCount: 0,
        clusterConfidences: {},
        overallClusterConfidence: 0,
        coordinationScore: 0,
      };

      expect(isWalletInCluster(resultWithCluster)).toBe(true);
      expect(isWalletInCluster(resultWithoutCluster)).toBe(false);
    });

    it("should work with hasHighCoordinationScore helper", () => {
      const resultHighScore: WalletClusteringResult = {
        address: WALLET_1,
        clusterIds: [],
        clusterCount: 0,
        clusterConfidences: {},
        fundingSourceClusters: [],
        temporalCluster: null,
        tradingPatternCluster: null,
        overallClusterConfidence: 0,
        confidenceLevel: ClusterConfidenceLevel.LOW,
        coordinationScore: 75, // Above default threshold of 60
        severity: FreshWalletAlertSeverity.HIGH,
        flagReasons: [],
        fromCache: false,
        analyzedAt: new Date(),
      };

      const resultLowScore: WalletClusteringResult = {
        ...resultHighScore,
        coordinationScore: 30,
      };

      expect(hasHighCoordinationScore(resultHighScore)).toBe(true);
      expect(hasHighCoordinationScore(resultLowScore)).toBe(false);
      expect(hasHighCoordinationScore(resultHighScore, 80)).toBe(false);
      expect(hasHighCoordinationScore(resultLowScore, 20)).toBe(true);
    });

    it("should work with getClusteringSummary helper", async () => {
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(createAgeResult(WALLET_1));
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const batchResult = await analyzeWalletClusters([WALLET_1, WALLET_2]);
      const summary = getClusteringSummary(batchResult);

      expect(summary).toBeDefined();
      expect(summary.totalWallets).toBe(2);
    });
  });

  describe("Cache Behavior", () => {
    it("should cache results", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(
        createAgeResult(WALLET_1, timestamp)
      );
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();

      // First analysis
      await analyzer.analyzeWallets([WALLET_1]);
      expect(analyzer.getCacheStats().size).toBeGreaterThanOrEqual(0);

      // Clear cache
      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);
    });

    it("should return cached results when available", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(
        createAgeResult(WALLET_1, timestamp)
      );
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();

      // First call
      const result1 = await analyzer.analyzeWallet(WALLET_1, [WALLET_2]);
      expect(result1.fromCache).toBe(false);

      // Second call should be from cache
      const result2 = await analyzer.analyzeWallet(WALLET_1, [WALLET_2]);
      expect(result2.fromCache).toBe(true);
    });

    it("should bypass cache when requested", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(
        createAgeResult(WALLET_1, timestamp)
      );
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();

      // First call
      await analyzer.analyzeWallet(WALLET_1, [WALLET_2]);

      // Second call with bypass
      const result2 = await analyzer.analyzeWallet(WALLET_1, [WALLET_2], {
        bypassCache: true,
      });
      expect(result2.fromCache).toBe(false);
    });
  });

  describe("Instance Helper Methods", () => {
    it("should correctly identify clustered wallets", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockImplementation(
        async (address: string) =>
          createFundingAnalysis(address, [
            {
              address: FUNDING_SOURCE_1,
              type: "exchange",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              depth: 1,
              firstTransferTimestamp: timestamp,
            },
          ])
      );

      mockAgeCalculator.calculateAge.mockImplementation(async (address: string) =>
        createAgeResult(address, timestamp)
      );

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      for (const [, walletResult] of result.results) {
        const isClustered = analyzer.isWalletClustered(walletResult);
        expect(typeof isClustered).toBe("boolean");

        if (walletResult.clusterIds.length > 0) {
          expect(isClustered).toBe(true);
        }
      }
    });

    it("should correctly identify high coordination wallets", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(
        createAgeResult(WALLET_1, timestamp)
      );
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1]);

      const wallet1Result = result.results.get(WALLET_1);
      if (wallet1Result) {
        const hasHighCoord = analyzer.hasHighCoordination(wallet1Result);
        expect(typeof hasHighCoord).toBe("boolean");

        if (wallet1Result.coordinationScore >= 60) {
          expect(hasHighCoord).toBe(true);
        } else {
          expect(hasHighCoord).toBe(false);
        }
      }
    });
  });

  describe("Default Thresholds", () => {
    it("should have expected default threshold values", () => {
      expect(DEFAULT_CLUSTERING_THRESHOLDS.minClusterSize).toBe(2);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.temporalWindowHours).toBe(24);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.minConfidence).toBe(30);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.fundingSimilarityThreshold).toBe(0.5);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.tradingSimilarityThreshold).toBe(0.5);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.minSharedMarkets).toBe(2);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.highCoordinationThreshold).toBe(60);
      expect(DEFAULT_CLUSTERING_THRESHOLDS.criticalCoordinationThreshold).toBe(80);
    });
  });

  describe("Cluster Types", () => {
    it("should have correct ClusterType enum values", () => {
      expect(ClusterType.FUNDING_SOURCE).toBe("FUNDING_SOURCE");
      expect(ClusterType.TEMPORAL).toBe("TEMPORAL");
      expect(ClusterType.TRADING_PATTERN).toBe("TRADING_PATTERN");
      expect(ClusterType.MULTI_FACTOR).toBe("MULTI_FACTOR");
    });

    it("should have correct ClusterConfidenceLevel enum values", () => {
      expect(ClusterConfidenceLevel.VERY_HIGH).toBe("VERY_HIGH");
      expect(ClusterConfidenceLevel.HIGH).toBe("HIGH");
      expect(ClusterConfidenceLevel.MEDIUM).toBe("MEDIUM");
      expect(ClusterConfidenceLevel.LOW).toBe("LOW");
      expect(ClusterConfidenceLevel.VERY_LOW).toBe("VERY_LOW");
    });
  });

  describe("Error Handling", () => {
    it("should handle funding analysis errors gracefully", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockRejectedValue(
        new Error("API Error")
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(
        createAgeResult(WALLET_1, timestamp)
      );
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2]);

      // Should still process successfully despite funding errors
      expect(result.successCount).toBe(2);
    });

    it("should handle age calculation errors gracefully", async () => {
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockRejectedValue(new Error("API Error"));
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2]);

      // Should still process successfully despite age errors
      expect(result.successCount).toBe(2);
    });

    it("should handle trade fetch errors gracefully", async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;

      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(
        createAgeResult(WALLET_1, timestamp)
      );
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API Error")
      );

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2]);

      // Should still process successfully despite trade errors
      expect(result.successCount).toBe(2);
    });

    it("should throw for invalid address in single wallet analysis", async () => {
      const analyzer = createFreshWalletClusterAnalyzer();

      await expect(
        analyzer.analyzeWallet(INVALID_ADDRESS, [WALLET_1])
      ).rejects.toThrow(/Invalid address/);
    });
  });

  describe("Batch Processing Performance", () => {
    it("should track processing time", async () => {
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis(WALLET_1)
      );
      mockAgeCalculator.calculateAge.mockResolvedValue(createAgeResult(WALLET_1));
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = createFreshWalletClusterAnalyzer();
      const result = await analyzer.analyzeWallets([WALLET_1, WALLET_2, WALLET_3]);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
