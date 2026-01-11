/**
 * Unit Tests for Wallet Funding Pattern Analyzer (DET-FRESH-005)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FundingPatternAnalyzer,
  FundingPatternType,
  FundingTimingCategory,
  DEFAULT_FUNDING_PATTERN_THRESHOLDS,
  createFundingPatternAnalyzer,
  getSharedFundingPatternAnalyzer,
  setSharedFundingPatternAnalyzer,
  resetSharedFundingPatternAnalyzer,
  analyzeFundingPattern,
  batchAnalyzeFundingPattern,
  hasSuspiciousFundingPattern,
  hasFlashTrading,
  getFundingTimingCategory,
  getFundingPatternSummary,
  type FundingPatternResult,
  type FundingPatternAnalyzerConfig,
} from "../../src/detection/funding-pattern";
import { FreshWalletAlertSeverity } from "../../src/detection";

// Mock the external dependencies
vi.mock("../../src/api/clob/trades", () => ({
  getAllTradesByWallet: vi.fn(),
}));

vi.mock("../../src/api/chain/funding-source", () => ({
  getSharedFundingSourceTracker: vi.fn(),
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
import { getSharedFreshWalletConfigManager } from "../../src/detection/fresh-wallet-config";

// Test wallet addresses
const VALID_ADDRESS = "0x1234567890123456789012345678901234567890";
const VALID_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const INVALID_ADDRESS = "0xinvalid";

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
const createFundingAnalysis = (overrides: Partial<{
  fundingSources: Array<{
    address: string;
    name?: string;
    type: string;
    totalAmount: bigint;
    formattedAmount: string;
    transferCount: number;
    firstTransferTimestamp: number;
    lastTransferTimestamp: number;
    transactionHashes: string[];
    riskLevel: string;
    isSanctioned: boolean;
    depth: number;
  }>;
  riskScore: number;
  riskLevel: string;
  walletAddress: string;
}> = {}) => ({
  walletAddress: overrides.walletAddress ?? VALID_ADDRESS,
  fundingSources: overrides.fundingSources ?? [],
  riskScore: overrides.riskScore ?? 0,
  riskLevel: overrides.riskLevel ?? "none",
  riskFactors: [],
  summary: {
    totalSources: overrides.fundingSources?.length ?? 0,
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
    targetWallet: overrides.walletAddress ?? VALID_ADDRESS,
    nodes: [],
    edges: [],
    maxDepthExplored: 2,
    totalTransfersTraced: 0,
  },
  analyzedAt: new Date(),
  analysisDepth: 2,
  totalAmountTraced: 0n,
  formattedTotalAmount: "0.000000",
});

describe("FundingPatternAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFundingPatternAnalyzer();

    // Set up default mocks
    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
    (getSharedFundingSourceTracker as ReturnType<typeof vi.fn>).mockReturnValue(
      mockFundingTracker
    );
  });

  afterEach(() => {
    resetSharedFundingPatternAnalyzer();
  });

  describe("Constructor", () => {
    it("should create with default configuration", () => {
      const analyzer = new FundingPatternAnalyzer();
      expect(analyzer).toBeInstanceOf(FundingPatternAnalyzer);

      const stats = analyzer.getCacheStats();
      expect(stats.maxSize).toBe(1000);
      expect(stats.ttlMs).toBe(5 * 60 * 1000);

      const thresholds = analyzer.getThresholds();
      expect(thresholds).toEqual(DEFAULT_FUNDING_PATTERN_THRESHOLDS);
    });

    it("should create with custom configuration", () => {
      const config: FundingPatternAnalyzerConfig = {
        cacheTtlMs: 60000,
        maxCacheSize: 500,
        thresholds: {
          flashTimingSeconds: 600,
          flashTimingScore: 50,
        },
      };

      const analyzer = new FundingPatternAnalyzer(config);
      const stats = analyzer.getCacheStats();

      expect(stats.maxSize).toBe(500);
      expect(stats.ttlMs).toBe(60000);

      const thresholds = analyzer.getThresholds();
      expect(thresholds.flashTimingSeconds).toBe(600);
      expect(thresholds.flashTimingScore).toBe(50);
      // Other thresholds should be default
      expect(thresholds.veryFastTimingSeconds).toBe(
        DEFAULT_FUNDING_PATTERN_THRESHOLDS.veryFastTimingSeconds
      );
    });
  });

  describe("analyzeWallet", () => {
    it("should throw error for invalid address", async () => {
      const analyzer = new FundingPatternAnalyzer();

      await expect(analyzer.analyzeWallet(INVALID_ADDRESS)).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should throw error for empty address", async () => {
      const analyzer = new FundingPatternAnalyzer();

      await expect(analyzer.analyzeWallet("")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should handle wallet with no trades and no deposits", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasDeposits).toBe(false);
      expect(result.hasTrades).toBe(false);
      expect(result.patternType).toBe(FundingPatternType.NORMAL);
      expect(result.timingCategory).toBe(FundingTimingCategory.NO_TRADES);
      expect(result.preTradingDeposits).toHaveLength(0);
      expect(result.suspicionScore).toBe(0);
      expect(result.severity).toBe(FreshWalletAlertSeverity.LOW);
    });

    it("should handle wallet with trades but no deposits", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasDeposits).toBe(false);
      expect(result.hasTrades).toBe(true);
      expect(result.preTradingDeposits).toHaveLength(0);
      expect(result.firstTradeAfterFunding).toBeNull();
      expect(result.fundingToTradeIntervalSeconds).toBeNull();
    });

    it("should analyze normal funding pattern (slow timing)", async () => {
      // Trade happened 10 days after deposit
      const tradeTime = new Date("2024-01-11T00:00:00Z");
      const depositTime = Math.floor(new Date("2024-01-01T00:00:00Z").getTime() / 1000);
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0x28c6c06298d514db089934071355e5743bf21d60",
              name: "Binance",
              type: "exchange",
              totalAmount: 1000000000000000000n, // 1 ETH worth
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime,
              lastTransferTimestamp: depositTime,
              transactionHashes: ["0xhash1"],
              riskLevel: "low",
              isSanctioned: false,
              depth: 1,
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.hasDeposits).toBe(true);
      expect(result.hasTrades).toBe(true);
      expect(result.patternType).toBe(FundingPatternType.NORMAL);
      expect(result.timingCategory).toBe(FundingTimingCategory.SLOW);
      expect(result.preTradingDeposits).toHaveLength(1);
      expect(result.preTradingDeposits[0]?.isExchange).toBe(true);
      expect(result.preTradingDeposits[0]?.sourceName).toBe("Binance");
      expect(result.suspicionScore).toBe(0);
      expect(result.severity).toBe(FreshWalletAlertSeverity.LOW);
      expect(result.fundingRiskSummary.exchangePercentage).toBe(100);
    });

    it("should detect flash trading pattern", async () => {
      // Trade happened 2 minutes after deposit (flash trading)
      const depositTime = Math.floor(Date.now() / 1000) - 120;
      const tradeTime = new Date((depositTime + 120) * 1000);
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0xsource1",
              type: "eoa",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime,
              lastTransferTimestamp: depositTime,
              transactionHashes: ["0xhash1"],
              riskLevel: "medium",
              isSanctioned: false,
              depth: 1,
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.timingCategory).toBe(FundingTimingCategory.FLASH);
      expect(result.flagReasons).toContain(
        "Flash trading: Started trading within 5 minutes of funding"
      );
      expect(result.suspicionScore).toBeGreaterThanOrEqual(40);
    });

    it("should detect very fast trading pattern", async () => {
      // Trade happened 30 minutes after deposit
      const depositTime = Math.floor(Date.now() / 1000) - 1800;
      const tradeTime = new Date((depositTime + 1800) * 1000);
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0xsource1",
              type: "eoa",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime,
              lastTransferTimestamp: depositTime,
              transactionHashes: ["0xhash1"],
              riskLevel: "medium",
              isSanctioned: false,
              depth: 1,
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.timingCategory).toBe(FundingTimingCategory.VERY_FAST);
      expect(result.flagReasons).toContain(
        "Very fast trading: Started trading within 1 hour of funding"
      );
    });

    it("should flag sanctioned source", async () => {
      const depositTime = Math.floor(Date.now() / 1000) - 86400;
      const tradeTime = new Date((depositTime + 86400) * 1000);
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
              name: "Tornado Cash",
              type: "mixer",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime,
              lastTransferTimestamp: depositTime,
              transactionHashes: ["0xhash1"],
              riskLevel: "critical",
              isSanctioned: true,
              depth: 1,
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.fundingRiskSummary.hasSanctionedSources).toBe(true);
      expect(result.flagReasons).toContain(
        "Sanctioned source: Funds received from sanctioned address"
      );
      expect(result.severity).toBe(FreshWalletAlertSeverity.CRITICAL);
    });

    it("should flag mixer source", async () => {
      const depositTime = Math.floor(Date.now() / 1000) - 86400;
      const tradeTime = new Date((depositTime + 86400) * 1000);
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0x8589427373d6d84e98730d7795d8f6f8731fda16",
              name: "Railgun",
              type: "mixer",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime,
              lastTransferTimestamp: depositTime,
              transactionHashes: ["0xhash1"],
              riskLevel: "high",
              isSanctioned: false,
              depth: 1,
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(result.fundingRiskSummary.hasMixerSources).toBe(true);
      expect(result.fundingRiskSummary.mixerNames).toContain("Railgun");
      expect(result.suspicionScore).toBeGreaterThanOrEqual(30);
    });

    it("should return cached result on second call", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });

      const result1 = await analyzer.analyzeWallet(VALID_ADDRESS);
      expect(result1.fromCache).toBe(false);

      const result2 = await analyzer.analyzeWallet(VALID_ADDRESS);
      expect(result2.fromCache).toBe(true);

      // Should only call API once
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when requested", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });

      await analyzer.analyzeWallet(VALID_ADDRESS);
      const result2 = await analyzer.analyzeWallet(VALID_ADDRESS, { bypassCache: true });

      expect(result2.fromCache).toBe(false);
      expect(getAllTradesByWallet).toHaveBeenCalledTimes(2);
    });

    it("should handle funding source analysis failure gracefully", async () => {
      const trade = createTrade();
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockRejectedValue(new Error("API error"));

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      // Should still return result, just with no deposits
      expect(result.hasDeposits).toBe(false);
      expect(result.hasTrades).toBe(true);
    });

    it("should exclude deposits after first trade", async () => {
      // First trade at Jan 5
      const tradeTime = new Date("2024-01-05T00:00:00Z");
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      // Deposit at Jan 1 (before trade - should be included)
      // Deposit at Jan 10 (after trade - should be excluded)
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0xsource1",
              type: "exchange",
              name: "Binance",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: Math.floor(
                new Date("2024-01-01T00:00:00Z").getTime() / 1000
              ),
              lastTransferTimestamp: Math.floor(
                new Date("2024-01-01T00:00:00Z").getTime() / 1000
              ),
              transactionHashes: ["0xhash1"],
              riskLevel: "low",
              isSanctioned: false,
              depth: 1,
            },
            {
              address: "0xsource2",
              type: "exchange",
              name: "Coinbase",
              totalAmount: 2000000000000000000n,
              formattedAmount: "2.000000",
              transferCount: 1,
              firstTransferTimestamp: Math.floor(
                new Date("2024-01-10T00:00:00Z").getTime() / 1000
              ),
              lastTransferTimestamp: Math.floor(
                new Date("2024-01-10T00:00:00Z").getTime() / 1000
              ),
              transactionHashes: ["0xhash2"],
              riskLevel: "low",
              isSanctioned: false,
              depth: 1,
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      // Only the deposit before the trade should be included
      expect(result.preTradingDeposits).toHaveLength(1);
      expect(result.preTradingDeposits[0]?.sourceName).toBe("Binance");
    });

    it("should exclude indirect funding sources (depth > 1)", async () => {
      const depositTime = Math.floor(Date.now() / 1000) - 86400;
      const tradeTime = new Date((depositTime + 86400) * 1000);
      const trade = createTrade({ created_at: tradeTime.toISOString() });

      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(
        createFundingAnalysis({
          fundingSources: [
            {
              address: "0xdirect",
              type: "eoa",
              totalAmount: 1000000000000000000n,
              formattedAmount: "1.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime,
              lastTransferTimestamp: depositTime,
              transactionHashes: ["0xhash1"],
              riskLevel: "medium",
              isSanctioned: false,
              depth: 1, // Direct deposit
            },
            {
              address: "0xindirect",
              type: "exchange",
              name: "Binance",
              totalAmount: 5000000000000000000n,
              formattedAmount: "5.000000",
              transferCount: 1,
              firstTransferTimestamp: depositTime - 100,
              lastTransferTimestamp: depositTime - 100,
              transactionHashes: ["0xhash2"],
              riskLevel: "low",
              isSanctioned: false,
              depth: 2, // Indirect - one hop away
            },
          ],
        })
      );

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallet(VALID_ADDRESS);

      // Only depth-1 deposits should be included
      expect(result.preTradingDeposits).toHaveLength(1);
      expect(result.preTradingDeposits[0]?.sourceAddress).toBe("0xdirect");
    });
  });

  describe("analyzeWallets (batch)", () => {
    it("should process multiple wallets", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results.size).toBe(2);
    });

    it("should handle mix of valid and invalid addresses", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallets([VALID_ADDRESS, INVALID_ADDRESS]);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors.has(INVALID_ADDRESS)).toBe(true);
    });

    it("should track pattern type counts", async () => {
      // Mock different patterns for different wallets
      let callCount = 0;
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First wallet: flash pattern
          return Promise.resolve([
            createTrade({ created_at: new Date(Date.now() - 60000).toISOString() }),
          ]);
        }
        // Second wallet: normal pattern
        return Promise.resolve([
          createTrade({ created_at: new Date("2023-01-01").toISOString() }),
        ]);
      });

      mockFundingTracker.analyzeFundingSources.mockImplementation((addr: string) => {
        const depositTime = addr === VALID_ADDRESS
          ? Math.floor(Date.now() / 1000) - 120 // 2 min before trade (flash)
          : Math.floor(new Date("2022-01-01").getTime() / 1000); // Long before trade

        return Promise.resolve(
          createFundingAnalysis({
            walletAddress: addr,
            fundingSources: [
              {
                address: "0xsource",
                type: "eoa",
                totalAmount: 1000000000000000000n,
                formattedAmount: "1.000000",
                transferCount: 1,
                firstTransferTimestamp: depositTime,
                lastTransferTimestamp: depositTime,
                transactionHashes: ["0xhash"],
                riskLevel: "medium",
                isSanctioned: false,
                depth: 1,
              },
            ],
          })
        );
      });

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.analyzeWallets([VALID_ADDRESS, VALID_ADDRESS_2]);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getSummary", () => {
    it("should calculate summary for empty results", () => {
      const analyzer = new FundingPatternAnalyzer();
      const summary = analyzer.getSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.suspiciousPercentage).toBe(0);
      expect(summary.flashTimingPercentage).toBe(0);
      expect(summary.averageFundingToTradeSeconds).toBeNull();
      expect(summary.medianFundingToTradeSeconds).toBeNull();
      expect(summary.averageSuspicionScore).toBe(0);
    });

    it("should calculate summary for multiple results", () => {
      const results: FundingPatternResult[] = [
        {
          address: VALID_ADDRESS,
          hasDeposits: true,
          hasTrades: true,
          patternType: FundingPatternType.SUSPICIOUS,
          timingCategory: FundingTimingCategory.FLASH,
          preTradingDeposits: [],
          totalPreTradingAmount: 0n,
          formattedTotalPreTradingAmount: "0.000000",
          firstTradeAfterFunding: null,
          fundingToTradeIntervalSeconds: 100,
          lastDepositToTradeIntervalSeconds: 100,
          suspicionScore: 80,
          severity: FreshWalletAlertSeverity.CRITICAL,
          flagReasons: [],
          fundingRiskSummary: {
            overallRiskLevel: "critical",
            hasSanctionedSources: false,
            hasMixerSources: false,
            exchangePercentage: 0,
            mixerPercentage: 0,
            unknownPercentage: 100,
            uniqueSourceCount: 1,
            exchangeNames: [],
            mixerNames: [],
          },
          fromCache: false,
          analyzedAt: new Date(),
        },
        {
          address: VALID_ADDRESS_2,
          hasDeposits: true,
          hasTrades: true,
          patternType: FundingPatternType.NORMAL,
          timingCategory: FundingTimingCategory.SLOW,
          preTradingDeposits: [],
          totalPreTradingAmount: 0n,
          formattedTotalPreTradingAmount: "0.000000",
          firstTradeAfterFunding: null,
          fundingToTradeIntervalSeconds: 700000,
          lastDepositToTradeIntervalSeconds: 700000,
          suspicionScore: 0,
          severity: FreshWalletAlertSeverity.LOW,
          flagReasons: [],
          fundingRiskSummary: {
            overallRiskLevel: "none",
            hasSanctionedSources: false,
            hasMixerSources: false,
            exchangePercentage: 100,
            mixerPercentage: 0,
            unknownPercentage: 0,
            uniqueSourceCount: 1,
            exchangeNames: ["Binance"],
            mixerNames: [],
          },
          fromCache: false,
          analyzedAt: new Date(),
        },
      ];

      const analyzer = new FundingPatternAnalyzer();
      const summary = analyzer.getSummary(results);

      expect(summary.total).toBe(2);
      expect(summary.suspiciousPercentage).toBe(50);
      expect(summary.flashTimingPercentage).toBe(50);
      expect(summary.byPatternType[FundingPatternType.SUSPICIOUS]).toBe(1);
      expect(summary.byPatternType[FundingPatternType.NORMAL]).toBe(1);
      expect(summary.byTimingCategory[FundingTimingCategory.FLASH]).toBe(1);
      expect(summary.byTimingCategory[FundingTimingCategory.SLOW]).toBe(1);
      expect(summary.averageSuspicionScore).toBe(40);
      expect(summary.averageFundingToTradeSeconds).toBeGreaterThan(0);
      expect(summary.medianFundingToTradeSeconds).toBeGreaterThan(0);
    });
  });

  describe("Convenience methods", () => {
    beforeEach(() => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());
    });

    it("hasSuspiciousFundingPattern should return boolean", async () => {
      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.hasSuspiciousFundingPattern(VALID_ADDRESS);

      expect(typeof result).toBe("boolean");
    });

    it("hasFlashTrading should return boolean", async () => {
      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const result = await analyzer.hasFlashTrading(VALID_ADDRESS);

      expect(typeof result).toBe("boolean");
    });

    it("getFundingTimingCategory should return category", async () => {
      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      const category = await analyzer.getFundingTimingCategory(VALID_ADDRESS);

      expect(Object.values(FundingTimingCategory)).toContain(category);
    });
  });

  describe("Cache management", () => {
    it("should clear cache", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      await analyzer.analyzeWallet(VALID_ADDRESS);

      expect(analyzer.getCacheStats().size).toBe(1);

      analyzer.clearCache();
      expect(analyzer.getCacheStats().size).toBe(0);
    });

    it("should invalidate specific cache entry", async () => {
      (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);
      mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());

      const analyzer = new FundingPatternAnalyzer({
        fundingTracker: mockFundingTracker as never,
      });
      await analyzer.analyzeWallet(VALID_ADDRESS);
      await analyzer.analyzeWallet(VALID_ADDRESS_2);

      expect(analyzer.getCacheStats().size).toBe(2);

      const invalidated = analyzer.invalidateCacheEntry(VALID_ADDRESS);
      expect(invalidated).toBe(true);
      expect(analyzer.getCacheStats().size).toBe(1);
    });

    it("should return false when invalidating non-existent entry", () => {
      const analyzer = new FundingPatternAnalyzer();

      const invalidated = analyzer.invalidateCacheEntry(VALID_ADDRESS);
      expect(invalidated).toBe(false);
    });

    it("should return false when invalidating invalid address", () => {
      const analyzer = new FundingPatternAnalyzer();

      const invalidated = analyzer.invalidateCacheEntry(INVALID_ADDRESS);
      expect(invalidated).toBe(false);
    });
  });

  describe("Singleton management", () => {
    it("should create shared analyzer on first access", () => {
      const analyzer1 = getSharedFundingPatternAnalyzer();
      const analyzer2 = getSharedFundingPatternAnalyzer();

      expect(analyzer1).toBe(analyzer2);
      expect(analyzer1).toBeInstanceOf(FundingPatternAnalyzer);
    });

    it("should allow setting custom shared analyzer", () => {
      const customAnalyzer = createFundingPatternAnalyzer({
        maxCacheSize: 999,
      });

      setSharedFundingPatternAnalyzer(customAnalyzer);

      const sharedAnalyzer = getSharedFundingPatternAnalyzer();
      expect(sharedAnalyzer.getCacheStats().maxSize).toBe(999);
    });

    it("should reset shared analyzer", () => {
      const analyzer1 = getSharedFundingPatternAnalyzer();
      resetSharedFundingPatternAnalyzer();
      const analyzer2 = getSharedFundingPatternAnalyzer();

      expect(analyzer1).not.toBe(analyzer2);
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFundingPatternAnalyzer();

    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
    (getSharedFundingSourceTracker as ReturnType<typeof vi.fn>).mockReturnValue(
      mockFundingTracker
    );
    (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([createTrade()]);
    mockFundingTracker.analyzeFundingSources.mockResolvedValue(createFundingAnalysis());
  });

  afterEach(() => {
    resetSharedFundingPatternAnalyzer();
  });

  it("analyzeFundingPattern should use shared analyzer", async () => {
    const result = await analyzeFundingPattern(VALID_ADDRESS);
    expect(result.address).toContain("1234567890");
  });

  it("batchAnalyzeFundingPattern should process multiple wallets", async () => {
    const result = await batchAnalyzeFundingPattern([VALID_ADDRESS]);
    expect(result.totalProcessed).toBe(1);
  });

  it("hasSuspiciousFundingPattern should return boolean", async () => {
    const result = await hasSuspiciousFundingPattern(VALID_ADDRESS);
    expect(typeof result).toBe("boolean");
  });

  it("hasFlashTrading should return boolean", async () => {
    const result = await hasFlashTrading(VALID_ADDRESS);
    expect(typeof result).toBe("boolean");
  });

  it("getFundingTimingCategory should return category", async () => {
    const category = await getFundingTimingCategory(VALID_ADDRESS);
    expect(Object.values(FundingTimingCategory)).toContain(category);
  });

  it("getFundingPatternSummary should work", () => {
    const summary = getFundingPatternSummary([]);
    expect(summary.total).toBe(0);
  });
});

describe("Pattern detection edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedFundingPatternAnalyzer();

    (getSharedFreshWalletConfigManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockConfigManager
    );
    (getSharedFundingSourceTracker as ReturnType<typeof vi.fn>).mockReturnValue(
      mockFundingTracker
    );
  });

  afterEach(() => {
    resetSharedFundingPatternAnalyzer();
  });

  it("should flag multiple quick consecutive deposits", async () => {
    const baseTime = Math.floor(Date.now() / 1000) - 100000;
    const tradeTime = new Date((baseTime + 100000) * 1000);
    const trade = createTrade({ created_at: tradeTime.toISOString() });

    (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
    mockFundingTracker.analyzeFundingSources.mockResolvedValue(
      createFundingAnalysis({
        fundingSources: [
          {
            address: "0xsource1",
            type: "eoa",
            totalAmount: 1000000000000000000n,
            formattedAmount: "1.000000",
            transferCount: 1,
            firstTransferTimestamp: baseTime,
            lastTransferTimestamp: baseTime,
            transactionHashes: ["0xhash1"],
            riskLevel: "medium",
            isSanctioned: false,
            depth: 1,
          },
          {
            address: "0xsource2",
            type: "eoa",
            totalAmount: 2000000000000000000n,
            formattedAmount: "2.000000",
            transferCount: 1,
            firstTransferTimestamp: baseTime + 120, // 2 minutes later
            lastTransferTimestamp: baseTime + 120,
            transactionHashes: ["0xhash2"],
            riskLevel: "medium",
            isSanctioned: false,
            depth: 1,
          },
          {
            address: "0xsource3",
            type: "eoa",
            totalAmount: 1500000000000000000n,
            formattedAmount: "1.500000",
            transferCount: 1,
            firstTransferTimestamp: baseTime + 300, // 5 minutes after first
            lastTransferTimestamp: baseTime + 300,
            transactionHashes: ["0xhash3"],
            riskLevel: "medium",
            isSanctioned: false,
            depth: 1,
          },
        ],
      })
    );

    const analyzer = new FundingPatternAnalyzer({
      fundingTracker: mockFundingTracker as never,
    });
    const result = await analyzer.analyzeWallet(VALID_ADDRESS);

    expect(result.preTradingDeposits).toHaveLength(3);
    expect(result.flagReasons.some((r) => r.includes("Multiple quick deposits"))).toBe(true);
  });

  it("should flag high unknown source percentage", async () => {
    const depositTime = Math.floor(Date.now() / 1000) - 86400;
    const tradeTime = new Date((depositTime + 86400) * 1000);
    const trade = createTrade({ created_at: tradeTime.toISOString() });

    (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue([trade]);
    mockFundingTracker.analyzeFundingSources.mockResolvedValue(
      createFundingAnalysis({
        fundingSources: [
          {
            address: "0xunknown1",
            type: "eoa",
            totalAmount: 10000000000000000000n, // 10 ETH
            formattedAmount: "10.000000",
            transferCount: 1,
            firstTransferTimestamp: depositTime,
            lastTransferTimestamp: depositTime,
            transactionHashes: ["0xhash1"],
            riskLevel: "medium",
            isSanctioned: false,
            depth: 1,
          },
        ],
      })
    );

    const analyzer = new FundingPatternAnalyzer({
      fundingTracker: mockFundingTracker as never,
    });
    const result = await analyzer.analyzeWallet(VALID_ADDRESS);

    expect(result.fundingRiskSummary.unknownPercentage).toBe(100);
    expect(result.flagReasons.some((r) => r.includes("High unknown sources"))).toBe(true);
  });

  it("should correctly identify first trade after funding", async () => {
    const depositTime = Math.floor(new Date("2024-01-01T00:00:00Z").getTime() / 1000);
    const firstTradeTime = new Date("2024-01-01T00:30:00Z"); // 30 minutes after deposit
    const secondTradeTime = new Date("2024-01-02T00:00:00Z");

    const trades = [
      createTrade({
        id: "trade-2",
        created_at: secondTradeTime.toISOString(),
        size: "200",
        price: "0.5",
      }),
      createTrade({
        id: "trade-1",
        created_at: firstTradeTime.toISOString(),
        size: "100",
        price: "0.6",
      }),
    ];

    (getAllTradesByWallet as ReturnType<typeof vi.fn>).mockResolvedValue(trades);
    mockFundingTracker.analyzeFundingSources.mockResolvedValue(
      createFundingAnalysis({
        fundingSources: [
          {
            address: "0xsource",
            type: "exchange",
            name: "Binance",
            totalAmount: 1000000000000000000n,
            formattedAmount: "1.000000",
            transferCount: 1,
            firstTransferTimestamp: depositTime,
            lastTransferTimestamp: depositTime,
            transactionHashes: ["0xhash"],
            riskLevel: "low",
            isSanctioned: false,
            depth: 1,
          },
        ],
      })
    );

    const analyzer = new FundingPatternAnalyzer({
      fundingTracker: mockFundingTracker as never,
    });
    const result = await analyzer.analyzeWallet(VALID_ADDRESS);

    // Should correctly identify the first trade (trade-1, not trade-2)
    expect(result.firstTradeAfterFunding?.tradeId).toBe("trade-1");
    expect(result.firstTradeAfterFunding?.size).toBe(100);
    expect(result.firstTradeAfterFunding?.timeSinceLastDepositSeconds).toBe(1800); // 30 min
    expect(result.timingCategory).toBe(FundingTimingCategory.VERY_FAST);
  });
});
