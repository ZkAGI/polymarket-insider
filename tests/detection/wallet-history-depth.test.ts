/**
 * Unit Tests for Wallet History Depth Analyzer (DET-FRESH-009)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WalletHistoryDepthAnalyzer,
  HistoryDepthCategory,
  DEFAULT_DEPTH_THRESHOLDS,
  DEFAULT_SCORE_WEIGHTS,
  createWalletHistoryDepthAnalyzer,
  getSharedWalletHistoryDepthAnalyzer,
  setSharedWalletHistoryDepthAnalyzer,
  resetSharedWalletHistoryDepthAnalyzer,
  analyzeWalletHistoryDepth,
  batchAnalyzeWalletHistoryDepth,
  hasShallowWalletHistory,
  getWalletHistoryDepthScore,
  getWalletHistoryDepthCategory,
  getWalletTotalTransactionCount,
  getHistoryDepthSummary,
  type WalletHistoryDepthResult,
  type WalletHistoryDepthAnalyzerConfig,
} from "../../src/detection/wallet-history-depth";
import { FreshWalletAlertSeverity } from "../../src/detection";

// Mock the external dependencies
vi.mock("../../src/api/chain", () => ({
  getWalletHistory: vi.fn(),
  getInternalTransactions: vi.fn(),
  getTransactionCount: vi.fn(),
}));

import {
  getWalletHistory,
  getInternalTransactions,
  getTransactionCount,
} from "../../src/api/chain";

// Test wallet addresses
const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const INVALID_ADDRESS = "0xinvalid";

// Helper to create mock wallet transactions
function createMockWalletTransactions(
  count: number,
  options: {
    startTimestamp?: number;
    spanDays?: number;
    withContracts?: boolean;
    withInput?: boolean;
  } = {}
): Array<{
  hash: string;
  blockNumber: bigint;
  timestamp: number;
  nonce: number;
  blockHash: string;
  transactionIndex: number;
  from: string;
  to: string | null;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  input: string;
  contractAddress: string | null;
  cumulativeGasUsed: bigint;
  gasUsed: bigint;
  confirmations: number;
  isError: boolean;
  txReceiptStatus: string;
  methodId: string;
  functionName: string;
}> {
  const {
    startTimestamp = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60, // 30 days ago
    spanDays = 30,
    withContracts = false,
    withInput = false,
  } = options;

  const transactions = [];
  const spanSeconds = spanDays * 24 * 60 * 60;

  for (let i = 0; i < count; i++) {
    const timestamp = startTimestamp + Math.floor((i / Math.max(count - 1, 1)) * spanSeconds);
    transactions.push({
      hash: `0x${i.toString(16).padStart(64, "0")}`,
      blockNumber: BigInt(1000000 + i),
      timestamp,
      nonce: i,
      blockHash: `0x${(i + 1).toString(16).padStart(64, "0")}`,
      transactionIndex: i % 10,
      from: VALID_ADDRESS,
      to: withContracts ? `0x${"c".repeat(40)}` : `0x${"d".repeat(40)}`,
      value: BigInt(i * 1000000000000000),
      gas: BigInt(21000),
      gasPrice: BigInt(20000000000),
      input: withInput ? "0x12345678" : "0x",
      contractAddress: withContracts && i % 5 === 0 ? `0x${"e".repeat(40)}` : null,
      cumulativeGasUsed: BigInt(21000 * (i + 1)),
      gasUsed: BigInt(21000),
      confirmations: 1000 - i,
      isError: false,
      txReceiptStatus: "1",
      methodId: withInput ? "0x12345678" : "",
      functionName: withInput ? "transfer" : "",
    });
  }

  return transactions;
}

// Helper to create mock internal transactions
function createMockInternalTransactions(
  count: number,
  startTimestamp?: number
): Array<{
  hash: string;
  blockNumber: bigint;
  timestamp: number;
  from: string;
  to: string;
  value: bigint;
  contractAddress: string;
  input: string;
  type: string;
  gas: bigint;
  gasUsed: bigint;
  traceId: string;
  isError: boolean;
  errCode: string;
}> {
  const baseTimestamp = startTimestamp ?? Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

  return Array.from({ length: count }, (_, i) => ({
    hash: `0x${(i + 100).toString(16).padStart(64, "0")}`,
    blockNumber: BigInt(1000000 + i),
    timestamp: baseTimestamp + i * 1000,
    from: `0x${"a".repeat(40)}`,
    to: VALID_ADDRESS,
    value: BigInt(i * 100000000000000),
    contractAddress: `0x${"b".repeat(40)}`,
    input: "0x",
    type: "call",
    gas: BigInt(50000),
    gasUsed: BigInt(40000),
    traceId: `0_${i}`,
    isError: false,
    errCode: "",
  }));
}

// Helper to create a getWalletHistory mock that distinguishes between normal and erc20 calls
function mockWalletHistory(
  normalTransactions: ReturnType<typeof createMockWalletTransactions>,
  erc20Transactions: ReturnType<typeof createMockWalletTransactions> = []
) {
  (getWalletHistory as ReturnType<typeof vi.fn>).mockImplementation(
    (_address: string, options?: { txType?: string }) => {
      if (options?.txType === "erc20") {
        return Promise.resolve({
          address: VALID_ADDRESS,
          transactions: erc20Transactions,
          hasMore: false,
          page: 1,
          pageSize: 1000,
        });
      }
      return Promise.resolve({
        address: VALID_ADDRESS,
        transactions: normalTransactions,
        hasMore: false,
        page: 1,
        pageSize: 1000,
      });
    }
  );
}

// Helper to create a getWalletHistory mock for multiple wallets
function mockWalletHistoryMulti(
  walletConfig: Array<{
    address: string;
    normalTxs: ReturnType<typeof createMockWalletTransactions>;
    erc20Txs?: ReturnType<typeof createMockWalletTransactions>;
  }>
) {
  const configMap = new Map(
    walletConfig.map(c => [c.address.toLowerCase(), c])
  );

  (getWalletHistory as ReturnType<typeof vi.fn>).mockImplementation(
    (address: string, options?: { txType?: string }) => {
      const normalizedAddr = address.toLowerCase();
      const config = configMap.get(normalizedAddr);

      if (!config) {
        return Promise.resolve({
          address,
          transactions: [],
          hasMore: false,
          page: 1,
          pageSize: 1000,
        });
      }

      if (options?.txType === "erc20") {
        return Promise.resolve({
          address,
          transactions: config.erc20Txs ?? [],
          hasMore: false,
          page: 1,
          pageSize: 1000,
        });
      }
      return Promise.resolve({
        address,
        transactions: config.normalTxs,
        hasMore: false,
        page: 1,
        pageSize: 1000,
      });
    }
  );
}

describe("WalletHistoryDepthAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedWalletHistoryDepthAnalyzer();
  });

  afterEach(() => {
    resetSharedWalletHistoryDepthAnalyzer();
  });

  describe("Constructor", () => {
    it("should create with default configuration", () => {
      const analyzer = new WalletHistoryDepthAnalyzer();
      expect(analyzer).toBeInstanceOf(WalletHistoryDepthAnalyzer);

      const stats = analyzer.getCacheStats();
      expect(stats.maxSize).toBe(1000);
      expect(stats.ttlMs).toBe(10 * 60 * 1000);
    });

    it("should create with custom configuration", () => {
      const config: WalletHistoryDepthAnalyzerConfig = {
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        defaultMaxTransactionsPerType: 500,
      };

      const analyzer = new WalletHistoryDepthAnalyzer(config);
      const stats = analyzer.getCacheStats();

      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);
    });

    it("should create with custom depth thresholds", () => {
      const config: WalletHistoryDepthAnalyzerConfig = {
        depthThresholds: {
          veryShallowMax: 5,
          shallowMax: 25,
          moderateMax: 100,
          deepMax: 500,
        },
      };

      const analyzer = new WalletHistoryDepthAnalyzer(config);
      const thresholds = analyzer.getDepthThresholds();

      expect(thresholds.veryShallowMax).toBe(5);
      expect(thresholds.shallowMax).toBe(25);
      expect(thresholds.moderateMax).toBe(100);
      expect(thresholds.deepMax).toBe(500);
    });

    it("should create with custom score weights", () => {
      const config: WalletHistoryDepthAnalyzerConfig = {
        scoreWeights: {
          transactionCount: 0.4,
          historySpan: 0.2,
          transactionVariety: 0.2,
          contractInteraction: 0.1,
          activityConsistency: 0.1,
        },
      };

      const analyzer = new WalletHistoryDepthAnalyzer(config);
      const weights = analyzer.getScoreWeights();

      expect(weights.transactionCount).toBe(0.4);
      expect(weights.historySpan).toBe(0.2);
    });
  });

  describe("analyzeDepth", () => {
    it("should throw error for invalid address", async () => {
      const analyzer = new WalletHistoryDepthAnalyzer();

      await expect(analyzer.analyzeDepth(INVALID_ADDRESS)).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should throw error for empty address", async () => {
      const analyzer = new WalletHistoryDepthAnalyzer();

      await expect(analyzer.analyzeDepth("")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should return NONE category for wallet with no transactions", async () => {
      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      mockWalletHistory([], []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.depthCategory).toBe(HistoryDepthCategory.NONE);
      expect(result.transactionCounts.total).toBe(0);
      expect(result.depthScore).toBe(0);
      expect(result.hasSufficientHistory).toBe(false);
    });

    it("should classify VERY_SHALLOW for few transactions", async () => {
      const mockTxs = createMockWalletTransactions(5);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.depthCategory).toBe(HistoryDepthCategory.VERY_SHALLOW);
      expect(result.transactionCounts.normal).toBe(5);
      expect(result.hasSufficientHistory).toBe(true);
    });

    it("should classify SHALLOW for moderate transaction count", async () => {
      const mockTxs = createMockWalletTransactions(30);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.depthCategory).toBe(HistoryDepthCategory.SHALLOW);
      expect(result.transactionCounts.normal).toBe(30);
    });

    it("should classify MODERATE for higher transaction count", async () => {
      const mockTxs = createMockWalletTransactions(100, { spanDays: 90 });
      const mockInternals = createMockInternalTransactions(20);
      const mockErc20 = createMockWalletTransactions(30);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      mockWalletHistory(mockTxs, mockErc20);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockInternals);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.depthCategory).toBe(HistoryDepthCategory.MODERATE);
      expect(result.transactionCounts.total).toBe(150); // 100 + 20 + 30
    });

    it("should classify DEEP for many transactions", async () => {
      const mockTxs = createMockWalletTransactions(300, { spanDays: 180, withContracts: true, withInput: true });
      const mockInternals = createMockInternalTransactions(100);
      const mockErc20 = createMockWalletTransactions(100);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(300);
      mockWalletHistory(mockTxs, mockErc20);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockInternals);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.depthCategory).toBe(HistoryDepthCategory.DEEP);
      expect(result.transactionCounts.total).toBe(500);
    });

    it("should classify VERY_DEEP for many transactions", async () => {
      const mockTxs = createMockWalletTransactions(800, { spanDays: 365, withContracts: true, withInput: true });
      const mockInternals = createMockInternalTransactions(200);
      const mockErc20 = createMockWalletTransactions(200);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(800);
      mockWalletHistory(mockTxs, mockErc20);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockInternals);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.depthCategory).toBe(HistoryDepthCategory.VERY_DEEP);
      expect(result.transactionCounts.total).toBe(1200);
    });

    it("should calculate activity metrics correctly", async () => {
      const startTimestamp = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60; // 60 days ago
      const mockTxs = createMockWalletTransactions(30, { startTimestamp, spanDays: 60, withContracts: true, withInput: true });

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.activityMetrics.firstTransactionAt).toBeInstanceOf(Date);
      expect(result.activityMetrics.lastTransactionAt).toBeInstanceOf(Date);
      expect(result.activityMetrics.historySpanDays).toBeGreaterThan(50);
      expect(result.activityMetrics.avgTransactionsPerMonth).toBeGreaterThan(0);
    });

    it("should detect suspicious pattern for very shallow history with no variety", async () => {
      // Create transactions with no internal/erc20 and very recent
      // 5 transactions = VERY_SHALLOW, 0 internal, 0 erc20 = suspicious
      const mockTxs = createMockWalletTransactions(5, { spanDays: 3 });

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      mockWalletHistory(mockTxs, []); // No ERC20 transactions
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]); // No internal transactions

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      // VERY_SHALLOW + no internal + no erc20 = suspicious
      expect(result.depthCategory).toBe(HistoryDepthCategory.VERY_SHALLOW);
      expect(result.transactionCounts.internal).toBe(0);
      expect(result.transactionCounts.erc20).toBe(0);
      expect(result.isSuspicious).toBe(true);
      expect(result.severity).toBe(FreshWalletAlertSeverity.HIGH);
    });

    it("should use cached results when available", async () => {
      const mockTxs = createMockWalletTransactions(20);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();

      // First call
      const result1 = await analyzer.analyzeDepth(VALID_ADDRESS);
      expect(result1.fromCache).toBe(false);

      // Second call should be cached
      const result2 = await analyzer.analyzeDepth(VALID_ADDRESS);
      expect(result2.fromCache).toBe(true);

      // Only 2 calls to getWalletHistory (normal + erc20) for first request
      expect(getWalletHistory).toHaveBeenCalledTimes(2);
    });

    it("should bypass cache when requested", async () => {
      const mockTxs = createMockWalletTransactions(20);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();

      // First call
      await analyzer.analyzeDepth(VALID_ADDRESS);

      // Second call with bypass
      const result2 = await analyzer.analyzeDepth(VALID_ADDRESS, { bypassCache: true });
      expect(result2.fromCache).toBe(false);

      // Should have made additional API calls
      expect(getWalletHistory).toHaveBeenCalledTimes(4);
    });

    it("should handle API errors gracefully", async () => {
      (getTransactionCount as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      (getWalletHistory as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      // Should still return a result with zero counts
      expect(result.transactionCounts.total).toBe(0);
      expect(result.depthCategory).toBe(HistoryDepthCategory.NONE);
    });
  });

  describe("batchAnalyzeDepth", () => {
    it("should analyze multiple wallets", async () => {
      const mockTxs1 = createMockWalletTransactions(5);
      const mockTxs2 = createMockWalletTransactions(100);

      (getTransactionCount as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(100);
      mockWalletHistoryMulti([
        { address: VALID_ADDRESS, normalTxs: mockTxs1, erc20Txs: [] },
        { address: VALID_ADDRESS_2, normalTxs: mockTxs2, erc20Txs: [] },
      ]);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.batchAnalyzeDepth([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(2);
    });

    it("should handle errors in batch processing", async () => {
      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      mockWalletHistory([], []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.batchAnalyzeDepth([VALID_ADDRESS, INVALID_ADDRESS]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors.has(INVALID_ADDRESS)).toBe(true);
    });

    it("should count shallow and suspicious wallets", async () => {
      // First wallet: shallow + suspicious
      const mockTxs1 = createMockWalletTransactions(3, { spanDays: 1 });
      // Second wallet: deep
      const mockTxs2 = createMockWalletTransactions(300, { spanDays: 180 });

      (getTransactionCount as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(300);
      mockWalletHistoryMulti([
        { address: VALID_ADDRESS, normalTxs: mockTxs1, erc20Txs: [] },
        { address: VALID_ADDRESS_2, normalTxs: mockTxs2, erc20Txs: [] },
      ]);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.batchAnalyzeDepth([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.shallowHistoryCount).toBe(1);
      expect(result.suspiciousCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getSummary", () => {
    it("should calculate summary statistics", () => {
      const results: WalletHistoryDepthResult[] = [
        {
          address: VALID_ADDRESS,
          transactionCounts: { normal: 5, internal: 0, erc20: 0, total: 5 },
          depthCategory: HistoryDepthCategory.VERY_SHALLOW,
          depthScore: 10,
          activityMetrics: {
            firstTransactionAt: new Date(),
            lastTransactionAt: new Date(),
            historySpanDays: 10,
            avgTransactionsPerMonth: null,
            hasLargeGaps: false,
            uniqueContractsInteracted: 1,
          },
          hasSufficientHistory: true,
          isSuspicious: true,
          severity: FreshWalletAlertSeverity.HIGH,
          scoreFactors: [],
          fromCache: false,
          analyzedAt: new Date(),
        },
        {
          address: VALID_ADDRESS_2,
          transactionCounts: { normal: 200, internal: 50, erc20: 50, total: 300 },
          depthCategory: HistoryDepthCategory.DEEP,
          depthScore: 70,
          activityMetrics: {
            firstTransactionAt: new Date(),
            lastTransactionAt: new Date(),
            historySpanDays: 365,
            avgTransactionsPerMonth: 25,
            hasLargeGaps: false,
            uniqueContractsInteracted: 50,
          },
          hasSufficientHistory: true,
          isSuspicious: false,
          severity: FreshWalletAlertSeverity.LOW,
          scoreFactors: [],
          fromCache: false,
          analyzedAt: new Date(),
        },
      ];

      const analyzer = new WalletHistoryDepthAnalyzer();
      const summary = analyzer.getSummary(results);

      expect(summary.total).toBe(2);
      expect(summary.byCategory[HistoryDepthCategory.VERY_SHALLOW]).toBe(1);
      expect(summary.byCategory[HistoryDepthCategory.DEEP]).toBe(1);
      expect(summary.averageDepthScore).toBe(40);
      expect(summary.medianDepthScore).toBe(40);
      expect(summary.shallowHistoryPercentage).toBe(50);
      expect(summary.suspiciousPercentage).toBe(50);
      expect(summary.averageTransactionCount).toBe(153);
    });

    it("should handle empty results", () => {
      const analyzer = new WalletHistoryDepthAnalyzer();
      const summary = analyzer.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.averageDepthScore).toBeNull();
      expect(summary.medianDepthScore).toBeNull();
    });
  });

  describe("Convenience Methods", () => {
    it("hasShallowHistory should return correct result", async () => {
      // 30 normal + 0 internal + 0 erc20 = 30 total = SHALLOW
      const mockTxs = createMockWalletTransactions(30);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.hasShallowHistory(VALID_ADDRESS);

      expect(result).toBe(true); // 30 transactions is SHALLOW
    });

    it("getDepthScore should return the score", async () => {
      const mockTxs = createMockWalletTransactions(30);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const score = await analyzer.getDepthScore(VALID_ADDRESS);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("getDepthCategory should return the category", async () => {
      const mockTxs = createMockWalletTransactions(30);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const category = await analyzer.getDepthCategory(VALID_ADDRESS);

      expect(category).toBe(HistoryDepthCategory.SHALLOW);
    });

    it("getTotalTransactionCount should return total count", async () => {
      const mockTxs = createMockWalletTransactions(30);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(30);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const count = await analyzer.getTotalTransactionCount(VALID_ADDRESS);

      expect(count).toBe(30);
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      const mockTxs = createMockWalletTransactions(20);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(analyzer.getCacheStats().size).toBe(1);

      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      const mockTxs = createMockWalletTransactions(20);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      await analyzer.analyzeDepth(VALID_ADDRESS);

      const invalidated = analyzer.invalidateCacheEntry(VALID_ADDRESS);
      expect(invalidated).toBe(true);
      expect(analyzer.getCacheStats().size).toBe(0);
    });

    it("should return false when invalidating non-existent entry", () => {
      const analyzer = new WalletHistoryDepthAnalyzer();
      const invalidated = analyzer.invalidateCacheEntry(VALID_ADDRESS);
      expect(invalidated).toBe(false);
    });

    it("should return false when invalidating invalid address", () => {
      const analyzer = new WalletHistoryDepthAnalyzer();
      const invalidated = analyzer.invalidateCacheEntry(INVALID_ADDRESS);
      expect(invalidated).toBe(false);
    });
  });

  describe("Singleton Management", () => {
    it("should create singleton on first call", () => {
      const instance1 = getSharedWalletHistoryDepthAnalyzer();
      const instance2 = getSharedWalletHistoryDepthAnalyzer();

      expect(instance1).toBe(instance2);
    });

    it("should allow setting custom singleton", () => {
      const custom = new WalletHistoryDepthAnalyzer({ cacheTtlMs: 30000 });
      setSharedWalletHistoryDepthAnalyzer(custom);

      const instance = getSharedWalletHistoryDepthAnalyzer();
      expect(instance).toBe(custom);
      expect(instance.getCacheStats().ttlMs).toBe(30000);
    });

    it("should reset singleton", () => {
      const instance1 = getSharedWalletHistoryDepthAnalyzer();
      resetSharedWalletHistoryDepthAnalyzer();
      const instance2 = getSharedWalletHistoryDepthAnalyzer();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("Convenience Functions", () => {
    beforeEach(() => {
      const mockTxs = createMockWalletTransactions(20);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    it("analyzeWalletHistoryDepth should use shared instance", async () => {
      const result = await analyzeWalletHistoryDepth(VALID_ADDRESS);
      expect(result.address).toBe(VALID_ADDRESS.toLowerCase().replace(/^0x/, "0x"));
    });

    it("batchAnalyzeWalletHistoryDepth should use shared instance", async () => {
      const result = await batchAnalyzeWalletHistoryDepth([VALID_ADDRESS]);
      expect(result.totalProcessed).toBe(1);
    });

    it("hasShallowWalletHistory should use shared instance", async () => {
      const result = await hasShallowWalletHistory(VALID_ADDRESS);
      expect(typeof result).toBe("boolean");
    });

    it("getWalletHistoryDepthScore should use shared instance", async () => {
      const score = await getWalletHistoryDepthScore(VALID_ADDRESS);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("getWalletHistoryDepthCategory should use shared instance", async () => {
      const category = await getWalletHistoryDepthCategory(VALID_ADDRESS);
      expect(Object.values(HistoryDepthCategory)).toContain(category);
    });

    it("getWalletTotalTransactionCount should use shared instance", async () => {
      const count = await getWalletTotalTransactionCount(VALID_ADDRESS);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("getHistoryDepthSummary should use shared instance", () => {
      const results: WalletHistoryDepthResult[] = [];
      const summary = getHistoryDepthSummary(results);
      expect(summary.total).toBe(0);
    });

    it("createWalletHistoryDepthAnalyzer should create new instance", () => {
      const analyzer1 = createWalletHistoryDepthAnalyzer();
      const analyzer2 = createWalletHistoryDepthAnalyzer();
      expect(analyzer1).not.toBe(analyzer2);
    });
  });

  describe("Default Constants", () => {
    it("should export DEFAULT_DEPTH_THRESHOLDS", () => {
      expect(DEFAULT_DEPTH_THRESHOLDS).toBeDefined();
      expect(DEFAULT_DEPTH_THRESHOLDS.veryShallowMax).toBe(10);
      expect(DEFAULT_DEPTH_THRESHOLDS.shallowMax).toBe(50);
      expect(DEFAULT_DEPTH_THRESHOLDS.moderateMax).toBe(200);
      expect(DEFAULT_DEPTH_THRESHOLDS.deepMax).toBe(1000);
    });

    it("should export DEFAULT_SCORE_WEIGHTS", () => {
      expect(DEFAULT_SCORE_WEIGHTS).toBeDefined();
      expect(DEFAULT_SCORE_WEIGHTS.transactionCount).toBe(0.35);
      expect(DEFAULT_SCORE_WEIGHTS.historySpan).toBe(0.25);
      expect(DEFAULT_SCORE_WEIGHTS.transactionVariety).toBe(0.15);
      expect(DEFAULT_SCORE_WEIGHTS.contractInteraction).toBe(0.15);
      expect(DEFAULT_SCORE_WEIGHTS.activityConsistency).toBe(0.10);

      // Weights should sum to 1
      const sum = Object.values(DEFAULT_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe("Score Factors", () => {
    it("should include all score factors in result", async () => {
      const mockTxs = createMockWalletTransactions(50, { spanDays: 60, withContracts: true, withInput: true });
      const mockInternals = createMockInternalTransactions(10);
      const mockErc20 = createMockWalletTransactions(20);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      mockWalletHistory(mockTxs, mockErc20);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue(mockInternals);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.scoreFactors.length).toBe(5);

      const factorNames = result.scoreFactors.map(f => f.name);
      expect(factorNames).toContain("transactionCount");
      expect(factorNames).toContain("historySpan");
      expect(factorNames).toContain("transactionVariety");
      expect(factorNames).toContain("contractInteraction");
      expect(factorNames).toContain("activityConsistency");

      // Each factor should have all required fields
      for (const factor of result.scoreFactors) {
        expect(factor.name).toBeDefined();
        expect(factor.weight).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
        expect(factor.value).toBeDefined();
        expect(factor.contribution).toBeGreaterThanOrEqual(0);
        expect(factor.description).toBeDefined();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle single transaction", async () => {
      const mockTxs = createMockWalletTransactions(1);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.transactionCounts.total).toBe(1);
      expect(result.depthCategory).toBe(HistoryDepthCategory.VERY_SHALLOW);
      expect(result.activityMetrics.historySpanDays).toBe(0); // Single tx has 0 span
    });

    it("should handle transactions with large gaps", async () => {
      // Create transactions with a 100+ day gap
      const now = Math.floor(Date.now() / 1000);
      const oldTimestamp = now - 150 * 24 * 60 * 60; // 150 days ago
      const newTimestamp = now - 10 * 24 * 60 * 60; // 10 days ago

      const mockTxs = [
        ...createMockWalletTransactions(5, { startTimestamp: oldTimestamp, spanDays: 5 }),
        ...createMockWalletTransactions(5, { startTimestamp: newTimestamp, spanDays: 5 }),
      ];

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(VALID_ADDRESS);

      expect(result.activityMetrics.hasLargeGaps).toBe(true);
    });

    it("should normalize wallet addresses", async () => {
      const lowercaseAddress = VALID_ADDRESS.toLowerCase();
      const mockTxs = createMockWalletTransactions(10);

      (getTransactionCount as ReturnType<typeof vi.fn>).mockResolvedValue(10);
      mockWalletHistory(mockTxs, []);
      (getInternalTransactions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analyzer = new WalletHistoryDepthAnalyzer();
      const result = await analyzer.analyzeDepth(lowercaseAddress);

      // Address should be checksummed
      expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });
});
