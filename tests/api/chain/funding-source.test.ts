/**
 * Tests for Wallet Funding Source Identification API (API-CHAIN-008)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FundingSourceTracker,
  createFundingSourceTracker,
  getSharedFundingSourceTracker,
  setSharedFundingSourceTracker,
  resetSharedFundingSourceTracker,
  isKnownExchange,
  isKnownMixer,
  isSanctionedAddress,
  getExchangeInfoForAddress,
  getMixerInfoForAddress,
  identifyAddress,
  getAddressRiskLevel,
  KNOWN_EXCHANGES,
  KNOWN_MIXERS,
  KNOWN_DEFI_PROTOCOLS,
} from "../../../src/api/chain";

// ============================================================================
// Test Fixtures
// ============================================================================

// Valid Ethereum addresses for testing
const validWallet = "0x742d35Cc6634C0532925a3b844bC9e7595f8B123";

// Known exchange addresses (from KNOWN_EXCHANGES)
const binanceAddress = "0x28c6c06298d514db089934071355e5743bf21d60";
const coinbaseAddress = "0x503828976d22510aad0201ac7ec88293211d23da";
const krakenAddress = "0x2910543af39aba0cd09dbb2d50200b3e800a63d2";

// Known mixer addresses (from KNOWN_MIXERS)
const tornadoCashAddress = "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936";
const tornadoCash100EthAddress = "0xa160cdab225685da1d56aa342ad8841c3b53f291";
const railgunAddress = "0x8589427373d6d84e98730d7795d8f6f8731fda16";

// Known DeFi protocol addresses (from KNOWN_DEFI_PROTOCOLS)
const uniswapRouterAddress = "0xe592427a0aece92de3edee1f18e0157c05861564";
const polygonBridgeAddress = "0xa0c68c638235ee32657e8f720a23cec1bfc77c77";
const aavePoolAddress = "0x794a61358d6845594f94dc1db02a252b5b4814ad";

// Random unknown address
const unknownAddress = "0xabcdef1234567890abcdef1234567890abcdef12";

// Sample amounts (in wei - 18 decimals)
const sampleAmounts = {
  small: 1_000_000_000_000_000_000n, // 1 MATIC
  medium: 100_000_000_000_000_000_000n, // 100 MATIC
  large: 1000_000_000_000_000_000_000n, // 1000 MATIC
  veryLarge: 10000_000_000_000_000_000_000n, // 10000 MATIC
};

// Mock Polygonscan client
const createMockPolygonscanClient = (
  transactions: any[] = [],
  hasMore = false
) => ({
  getWalletHistory: vi.fn().mockResolvedValue({
    transactions,
    hasMore,
    page: 1,
    pageSize: 1000,
  }),
  getAllWalletHistory: vi.fn().mockResolvedValue(transactions),
  getInternalTransactions: vi.fn().mockResolvedValue([]),
  getTransactionCount: vi.fn().mockResolvedValue(100),
});

// Create mock transaction
const createMockTransaction = (overrides: Partial<any> = {}) => ({
  hash: "0x" + "1".repeat(64),
  blockNumber: 50000000n,
  timestamp: 1704067200, // 2024-01-01
  nonce: 1,
  blockHash: "0x" + "2".repeat(64),
  transactionIndex: 0,
  from: binanceAddress,
  to: validWallet.toLowerCase(),
  value: sampleAmounts.medium,
  gas: 21000n,
  gasPrice: 30000000000n,
  input: "0x",
  contractAddress: null,
  cumulativeGasUsed: 21000n,
  gasUsed: 21000n,
  confirmations: 1000,
  isError: false,
  txReceiptStatus: "1",
  methodId: "0x",
  functionName: "",
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("FundingSourceTracker", () => {
  let tracker: FundingSourceTracker;

  beforeEach(() => {
    tracker = new FundingSourceTracker();
    resetSharedFundingSourceTracker();
  });

  afterEach(() => {
    resetSharedFundingSourceTracker();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create tracker with default configuration", () => {
      const t = new FundingSourceTracker();
      expect(t).toBeDefined();
    });

    it("should create tracker with custom configuration", () => {
      const t = new FundingSourceTracker({
        maxDepth: 5,
        minTransferAmount: 1_000_000_000_000_000_000n,
        maxFundingSources: 100,
        debug: true,
      });
      expect(t).toBeDefined();
      const stats = t.getStats();
      expect(stats.maxDepth).toBe(5);
    });

    it("should accept additional exchange addresses", () => {
      const customExchange = "0x9999999999999999999999999999999999999999";
      const t = new FundingSourceTracker({
        additionalExchanges: {
          [customExchange]: {
            name: "Custom Exchange",
            type: "cex",
            trustLevel: "high",
          },
        },
      });
      expect(t.isExchange(customExchange)).toBe(true);
      expect(t.getExchangeInfo(customExchange)?.name).toBe("Custom Exchange");
    });

    it("should accept additional mixer addresses", () => {
      const customMixer = "0x8888888888888888888888888888888888888888";
      const t = new FundingSourceTracker({
        additionalMixers: {
          [customMixer]: {
            name: "Custom Mixer",
            type: "mixer",
            riskLevel: "high",
            sanctioned: false,
          },
        },
      });
      expect(t.isMixer(customMixer)).toBe(true);
      expect(t.getMixerInfo(customMixer)?.name).toBe("Custom Mixer");
    });

    it("should accept additional DeFi protocol addresses", () => {
      const customDefi = "0x7777777777777777777777777777777777777777";
      const t = new FundingSourceTracker({
        additionalDefiProtocols: {
          [customDefi]: {
            name: "Custom Protocol",
            type: "dex",
            trustLevel: "high",
          },
        },
      });
      expect(t.isDefiProtocol(customDefi)).toBe(true);
      expect(t.getDefiProtocolInfo(customDefi)?.name).toBe("Custom Protocol");
    });

    it("should accept custom logger", () => {
      const logs: string[] = [];
      const customLogger = {
        debug: (msg: string) => logs.push(`debug: ${msg}`),
        info: (msg: string) => logs.push(`info: ${msg}`),
        warn: (msg: string) => logs.push(`warn: ${msg}`),
        error: (msg: string) => logs.push(`error: ${msg}`),
      };
      const t = new FundingSourceTracker({ logger: customLogger, debug: true });
      expect(t).toBeDefined();
    });

    it("should accept custom Polygonscan client", () => {
      const mockClient = createMockPolygonscanClient();
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
      });
      expect(t).toBeDefined();
    });
  });

  // ==========================================================================
  // Exchange Detection Tests
  // ==========================================================================

  describe("isExchange", () => {
    it("should return true for Binance address", () => {
      expect(tracker.isExchange(binanceAddress)).toBe(true);
    });

    it("should return true for Coinbase address", () => {
      expect(tracker.isExchange(coinbaseAddress)).toBe(true);
    });

    it("should return true for Kraken address", () => {
      expect(tracker.isExchange(krakenAddress)).toBe(true);
    });

    it("should return false for non-exchange address", () => {
      expect(tracker.isExchange(unknownAddress)).toBe(false);
    });

    it("should return false for mixer address", () => {
      expect(tracker.isExchange(tornadoCashAddress)).toBe(false);
    });

    it("should handle case-insensitive matching", () => {
      expect(tracker.isExchange(binanceAddress.toUpperCase())).toBe(true);
      expect(tracker.isExchange(binanceAddress.toLowerCase())).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(tracker.isExchange("")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(tracker.isExchange(null as any)).toBe(false);
      expect(tracker.isExchange(undefined as any)).toBe(false);
    });
  });

  describe("getExchangeInfo", () => {
    it("should return exchange info for Binance", () => {
      const info = tracker.getExchangeInfo(binanceAddress);
      expect(info).toBeDefined();
      expect(info?.name).toBe("Binance");
      expect(info?.type).toBe("cex");
    });

    it("should return exchange info for Coinbase", () => {
      const info = tracker.getExchangeInfo(coinbaseAddress);
      expect(info).toBeDefined();
      expect(info?.name).toBe("Coinbase");
    });

    it("should return undefined for unknown address", () => {
      const info = tracker.getExchangeInfo(unknownAddress);
      expect(info).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const info = tracker.getExchangeInfo("");
      expect(info).toBeUndefined();
    });
  });

  // ==========================================================================
  // Mixer Detection Tests
  // ==========================================================================

  describe("isMixer", () => {
    it("should return true for Tornado Cash address", () => {
      expect(tracker.isMixer(tornadoCashAddress)).toBe(true);
    });

    it("should return true for Tornado Cash 100 ETH pool", () => {
      expect(tracker.isMixer(tornadoCash100EthAddress)).toBe(true);
    });

    it("should return true for Railgun address", () => {
      expect(tracker.isMixer(railgunAddress)).toBe(true);
    });

    it("should return false for exchange address", () => {
      expect(tracker.isMixer(binanceAddress)).toBe(false);
    });

    it("should return false for unknown address", () => {
      expect(tracker.isMixer(unknownAddress)).toBe(false);
    });

    it("should handle case-insensitive matching", () => {
      expect(tracker.isMixer(tornadoCashAddress.toUpperCase())).toBe(true);
      expect(tracker.isMixer(tornadoCashAddress.toLowerCase())).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(tracker.isMixer("")).toBe(false);
    });
  });

  describe("getMixerInfo", () => {
    it("should return mixer info for Tornado Cash", () => {
      const info = tracker.getMixerInfo(tornadoCashAddress);
      expect(info).toBeDefined();
      expect(info?.name).toBe("Tornado Cash");
      expect(info?.type).toBe("mixer");
      expect(info?.sanctioned).toBe(true);
      expect(info?.riskLevel).toBe("critical");
    });

    it("should return mixer info for Railgun", () => {
      const info = tracker.getMixerInfo(railgunAddress);
      expect(info).toBeDefined();
      expect(info?.name).toBe("Railgun");
      expect(info?.type).toBe("privacy");
      expect(info?.sanctioned).toBe(false);
    });

    it("should return undefined for unknown address", () => {
      const info = tracker.getMixerInfo(unknownAddress);
      expect(info).toBeUndefined();
    });
  });

  // ==========================================================================
  // DeFi Protocol Detection Tests
  // ==========================================================================

  describe("isDefiProtocol", () => {
    it("should return true for Uniswap Router", () => {
      expect(tracker.isDefiProtocol(uniswapRouterAddress)).toBe(true);
    });

    it("should return true for Polygon Bridge", () => {
      expect(tracker.isDefiProtocol(polygonBridgeAddress)).toBe(true);
    });

    it("should return true for Aave Pool", () => {
      expect(tracker.isDefiProtocol(aavePoolAddress)).toBe(true);
    });

    it("should return false for exchange address", () => {
      expect(tracker.isDefiProtocol(binanceAddress)).toBe(false);
    });

    it("should return false for unknown address", () => {
      expect(tracker.isDefiProtocol(unknownAddress)).toBe(false);
    });

    it("should handle case-insensitive matching", () => {
      expect(tracker.isDefiProtocol(uniswapRouterAddress.toUpperCase())).toBe(
        true
      );
    });

    it("should return false for empty string", () => {
      expect(tracker.isDefiProtocol("")).toBe(false);
    });
  });

  describe("getDefiProtocolInfo", () => {
    it("should return protocol info for Uniswap", () => {
      const info = tracker.getDefiProtocolInfo(uniswapRouterAddress);
      expect(info).toBeDefined();
      expect(info?.name).toBe("Uniswap V3 Router");
      expect(info?.type).toBe("dex");
    });

    it("should return protocol info for Polygon Bridge", () => {
      const info = tracker.getDefiProtocolInfo(polygonBridgeAddress);
      expect(info).toBeDefined();
      expect(info?.name).toBe("Polygon PoS Bridge");
      expect(info?.type).toBe("bridge");
    });

    it("should return undefined for unknown address", () => {
      const info = tracker.getDefiProtocolInfo(unknownAddress);
      expect(info).toBeUndefined();
    });
  });

  // ==========================================================================
  // Sanction Detection Tests
  // ==========================================================================

  describe("isSanctioned", () => {
    it("should return true for Tornado Cash (sanctioned)", () => {
      expect(tracker.isSanctioned(tornadoCashAddress)).toBe(true);
    });

    it("should return false for Railgun (not sanctioned)", () => {
      expect(tracker.isSanctioned(railgunAddress)).toBe(false);
    });

    it("should return false for exchange address", () => {
      expect(tracker.isSanctioned(binanceAddress)).toBe(false);
    });

    it("should return false for unknown address", () => {
      expect(tracker.isSanctioned(unknownAddress)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(tracker.isSanctioned("")).toBe(false);
    });

    it("should handle case-insensitive matching", () => {
      expect(tracker.isSanctioned(tornadoCashAddress.toUpperCase())).toBe(true);
    });
  });

  // ==========================================================================
  // Address Type Identification Tests
  // ==========================================================================

  describe("identifyAddressType", () => {
    it("should identify exchange addresses", () => {
      expect(tracker.identifyAddressType(binanceAddress)).toBe("exchange");
      expect(tracker.identifyAddressType(coinbaseAddress)).toBe("exchange");
    });

    it("should identify mixer addresses", () => {
      expect(tracker.identifyAddressType(tornadoCashAddress)).toBe("mixer");
      expect(tracker.identifyAddressType(railgunAddress)).toBe("mixer");
    });

    it("should identify DeFi protocol addresses", () => {
      expect(tracker.identifyAddressType(uniswapRouterAddress)).toBe("defi");
      expect(tracker.identifyAddressType(polygonBridgeAddress)).toBe("defi");
    });

    it("should return eoa for unknown addresses", () => {
      expect(tracker.identifyAddressType(unknownAddress)).toBe("eoa");
    });

    it("should return unknown for empty string", () => {
      expect(tracker.identifyAddressType("")).toBe("unknown");
    });
  });

  // ==========================================================================
  // Risk Level Tests
  // ==========================================================================

  describe("getRiskLevel", () => {
    it("should return critical for sanctioned mixers", () => {
      expect(tracker.getRiskLevel(tornadoCashAddress)).toBe("critical");
    });

    it("should return high for non-sanctioned mixers", () => {
      expect(tracker.getRiskLevel(railgunAddress)).toBe("high");
    });

    it("should return low for high-trust exchanges", () => {
      expect(tracker.getRiskLevel(binanceAddress)).toBe("low");
      expect(tracker.getRiskLevel(coinbaseAddress)).toBe("low");
    });

    it("should return low for high-trust DeFi protocols", () => {
      expect(tracker.getRiskLevel(uniswapRouterAddress)).toBe("low");
    });

    it("should return medium for unknown addresses", () => {
      expect(tracker.getRiskLevel(unknownAddress)).toBe("medium");
    });

    it("should return none for empty string", () => {
      expect(tracker.getRiskLevel("")).toBe("none");
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const stats = tracker.getStats();
      expect(stats.knownExchanges).toBeGreaterThan(0);
      expect(stats.knownMixers).toBeGreaterThan(0);
      expect(stats.knownDefiProtocols).toBeGreaterThan(0);
      expect(stats.maxDepth).toBe(3);
      expect(typeof stats.minTransferAmount).toBe("string");
    });

    it("should include counts for all known addresses", () => {
      const stats = tracker.getStats();
      expect(stats.knownExchanges).toBe(Object.keys(KNOWN_EXCHANGES).length);
      expect(stats.knownMixers).toBe(Object.keys(KNOWN_MIXERS).length);
      expect(stats.knownDefiProtocols).toBe(
        Object.keys(KNOWN_DEFI_PROTOCOLS).length
      );
    });

    it("should include additional addresses in counts", () => {
      const t = new FundingSourceTracker({
        additionalExchanges: {
          "0x1111111111111111111111111111111111111111": {
            name: "Test Exchange",
            type: "cex",
            trustLevel: "high",
          },
        },
      });
      const stats = t.getStats();
      expect(stats.knownExchanges).toBe(
        Object.keys(KNOWN_EXCHANGES).length + 1
      );
    });
  });

  // ==========================================================================
  // Incoming Transfers Tests
  // ==========================================================================

  describe("getIncomingTransfers", () => {
    it("should throw for invalid address", async () => {
      await expect(
        tracker.getIncomingTransfers("invalid")
      ).rejects.toThrow("Invalid wallet address");
    });

    it("should throw for empty address", async () => {
      await expect(tracker.getIncomingTransfers("")).rejects.toThrow(
        "Invalid wallet address"
      );
    });

    it("should return incoming transfers", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: coinbaseAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
      });

      const transfers = await t.getIncomingTransfers(validWallet);
      expect(transfers.length).toBe(2);
      expect(transfers[0]!.from.toLowerCase()).toBe(binanceAddress);
      expect(transfers[0]!.to).toBe(validWallet);
    });

    it("should filter out outgoing transfers", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: validWallet.toLowerCase(),
          to: binanceAddress.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
      });

      const transfers = await t.getIncomingTransfers(validWallet);
      expect(transfers.length).toBe(0);
    });

    it("should filter out failed transactions", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
          isError: true,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
      });

      const transfers = await t.getIncomingTransfers(validWallet);
      expect(transfers.length).toBe(0);
    });

    it("should filter by minimum amount", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: 100n, // Very small amount
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: coinbaseAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        minTransferAmount: sampleAmounts.medium,
      });

      const transfers = await t.getIncomingTransfers(validWallet);
      expect(transfers.length).toBe(1);
      expect(transfers[0]!.from.toLowerCase()).toBe(coinbaseAddress);
    });

    it("should handle pagination", async () => {
      const mockClient = {
        getWalletHistory: vi
          .fn()
          .mockResolvedValueOnce({
            transactions: [
              createMockTransaction({
                from: binanceAddress,
                to: validWallet.toLowerCase(),
              }),
            ],
            hasMore: true,
            page: 1,
            pageSize: 1000,
          })
          .mockResolvedValueOnce({
            transactions: [
              createMockTransaction({
                hash: "0x" + "2".repeat(64),
                from: coinbaseAddress,
                to: validWallet.toLowerCase(),
              }),
            ],
            hasMore: false,
            page: 2,
            pageSize: 1000,
          }),
      };

      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
      });

      const transfers = await t.getIncomingTransfers(validWallet);
      expect(transfers.length).toBe(2);
    });
  });

  // ==========================================================================
  // Funding Analysis Tests
  // ==========================================================================

  describe("analyzeFundingSources", () => {
    it("should throw for invalid address", async () => {
      await expect(
        tracker.analyzeFundingSources("invalid")
      ).rejects.toThrow("Invalid wallet address");
    });

    it("should return analysis with exchange source", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis).toBeDefined();
      expect(analysis.walletAddress).toBe(validWallet);
      expect(analysis.fundingSources.length).toBeGreaterThanOrEqual(1);
      expect(analysis.summary.totalSources).toBeGreaterThanOrEqual(1);
      expect(analysis.riskLevel).toBeDefined();
      expect(analysis.graph).toBeDefined();
    });

    it("should identify mixer sources with high risk", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: tornadoCashAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.riskScore).toBeGreaterThanOrEqual(50);
      expect(analysis.summary.hasSanctionedSource).toBe(true);
      expect(analysis.summary.sanctionedSources).toContain(tornadoCashAddress);
    });

    it("should calculate correct summary statistics", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: uniswapRouterAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.summary.sourcesByType.exchange).toBeGreaterThanOrEqual(1);
      expect(analysis.summary.sourcesByType.defi).toBeGreaterThanOrEqual(1);
      expect(analysis.summary.exchangeFunds.exchanges).toContain("Binance");
    });

    it("should emit events for detected sources", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const events: any[] = [];
      t.on("exchangeDetected", (event) => events.push(event));
      t.on("analysisComplete", (event) => events.push(event));

      await t.analyzeFundingSources(validWallet);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.some((e) => e.type === "analysisComplete")).toBe(true);
    });

    it("should emit mixerDetected event for mixer sources", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: tornadoCashAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const events: any[] = [];
      t.on("mixerDetected", (event) => events.push(event));

      await t.analyzeFundingSources(validWallet);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].source?.name).toBe("Tornado Cash");
    });

    it("should build funding graph", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.graph.targetWallet).toBe(validWallet);
      expect(analysis.graph.nodes.length).toBeGreaterThanOrEqual(1);
      expect(analysis.graph.edges.length).toBeGreaterThanOrEqual(1);
      expect(analysis.graph.maxDepthExplored).toBe(1);
    });

    it("should handle empty transaction history", async () => {
      const mockClient = createMockPolygonscanClient([]);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.fundingSources.length).toBe(0);
      expect(analysis.riskScore).toBe(0);
      expect(analysis.riskLevel).toBe("none");
    });
  });

  // ==========================================================================
  // Risk Calculation Tests
  // ==========================================================================

  describe("risk calculation", () => {
    it("should add points for sanctioned sources", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: tornadoCashAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.riskFactors.some((f) => f.type === "sanctioned_source")).toBe(
        true
      );
      const sanctionedFactor = analysis.riskFactors.find(
        (f) => f.type === "sanctioned_source"
      );
      expect(sanctionedFactor?.points).toBe(50);
    });

    it("should have low risk for exchange-only funding", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(["none", "low", "medium"]).toContain(analysis.riskLevel);
    });

    it("should limit risk score to 100", async () => {
      // This would require multiple high-risk sources
      const mockTransactions = [
        createMockTransaction({
          from: tornadoCashAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: tornadoCash100EthAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.riskScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Factory Functions and Singleton Tests
  // ==========================================================================

  describe("factory functions", () => {
    it("createFundingSourceTracker should create new instance", () => {
      const t = createFundingSourceTracker();
      expect(t).toBeInstanceOf(FundingSourceTracker);
    });

    it("createFundingSourceTracker should accept config", () => {
      const t = createFundingSourceTracker({ maxDepth: 5 });
      expect(t.getStats().maxDepth).toBe(5);
    });
  });

  describe("singleton management", () => {
    it("getSharedFundingSourceTracker should return same instance", () => {
      const t1 = getSharedFundingSourceTracker();
      const t2 = getSharedFundingSourceTracker();
      expect(t1).toBe(t2);
    });

    it("setSharedFundingSourceTracker should set instance", () => {
      const custom = new FundingSourceTracker({ maxDepth: 10 });
      setSharedFundingSourceTracker(custom);
      const shared = getSharedFundingSourceTracker();
      expect(shared.getStats().maxDepth).toBe(10);
    });

    it("resetSharedFundingSourceTracker should clear instance", () => {
      const custom = new FundingSourceTracker({ maxDepth: 10 });
      setSharedFundingSourceTracker(custom);
      resetSharedFundingSourceTracker();
      const shared = getSharedFundingSourceTracker();
      expect(shared.getStats().maxDepth).toBe(3); // Default
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedFundingSourceTracker();
    });

    it("isKnownExchange should use shared tracker", () => {
      expect(isKnownExchange(binanceAddress)).toBe(true);
      expect(isKnownExchange(unknownAddress)).toBe(false);
    });

    it("isKnownMixer should use shared tracker", () => {
      expect(isKnownMixer(tornadoCashAddress)).toBe(true);
      expect(isKnownMixer(unknownAddress)).toBe(false);
    });

    it("isSanctionedAddress should use shared tracker", () => {
      expect(isSanctionedAddress(tornadoCashAddress)).toBe(true);
      expect(isSanctionedAddress(railgunAddress)).toBe(false);
    });

    it("getExchangeInfoForAddress should use shared tracker", () => {
      const info = getExchangeInfoForAddress(binanceAddress);
      expect(info?.name).toBe("Binance");
    });

    it("getMixerInfoForAddress should use shared tracker", () => {
      const info = getMixerInfoForAddress(tornadoCashAddress);
      expect(info?.name).toBe("Tornado Cash");
    });

    it("identifyAddress should use shared tracker", () => {
      expect(identifyAddress(binanceAddress)).toBe("exchange");
      expect(identifyAddress(tornadoCashAddress)).toBe("mixer");
    });

    it("getAddressRiskLevel should use shared tracker", () => {
      expect(getAddressRiskLevel(tornadoCashAddress)).toBe("critical");
      expect(getAddressRiskLevel(binanceAddress)).toBe("low");
    });

    it("convenience functions should accept custom tracker", () => {
      const customTracker = new FundingSourceTracker({
        additionalExchanges: {
          "0x1111111111111111111111111111111111111111": {
            name: "Custom Exchange",
            type: "cex",
            trustLevel: "high",
          },
        },
      });

      expect(
        isKnownExchange(
          "0x1111111111111111111111111111111111111111",
          customTracker
        )
      ).toBe(true);
      expect(
        isKnownExchange("0x1111111111111111111111111111111111111111")
      ).toBe(false);
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("constants", () => {
    it("KNOWN_EXCHANGES should have expected exchanges", () => {
      expect(Object.keys(KNOWN_EXCHANGES).length).toBeGreaterThan(0);

      // Check some well-known exchanges
      const exchangeNames = Object.values(KNOWN_EXCHANGES).map((e) => e.name);
      expect(exchangeNames).toContain("Binance");
      expect(exchangeNames).toContain("Coinbase");
    });

    it("KNOWN_MIXERS should have expected mixers", () => {
      expect(Object.keys(KNOWN_MIXERS).length).toBeGreaterThan(0);

      // Check for Tornado Cash
      const mixerNames = Object.values(KNOWN_MIXERS).map((m) => m.name);
      expect(mixerNames).toContain("Tornado Cash");
    });

    it("KNOWN_DEFI_PROTOCOLS should have expected protocols", () => {
      expect(Object.keys(KNOWN_DEFI_PROTOCOLS).length).toBeGreaterThan(0);

      // Check for some protocols
      const protocolNames = Object.values(KNOWN_DEFI_PROTOCOLS).map((p) => p.name);
      expect(protocolNames.some((n) => n.includes("Uniswap"))).toBe(true);
    });

    it("all exchange addresses should be lowercase", () => {
      for (const address of Object.keys(KNOWN_EXCHANGES)) {
        expect(address).toBe(address.toLowerCase());
      }
    });

    it("all mixer addresses should be lowercase", () => {
      for (const address of Object.keys(KNOWN_MIXERS)) {
        expect(address).toBe(address.toLowerCase());
      }
    });

    it("all DeFi protocol addresses should be lowercase", () => {
      for (const address of Object.keys(KNOWN_DEFI_PROTOCOLS)) {
        expect(address).toBe(address.toLowerCase());
      }
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle mixed case addresses consistently", () => {
      const mixedCase = "0x28C6C06298D514DB089934071355E5743BF21D60";
      expect(tracker.isExchange(mixedCase)).toBe(true);
      expect(tracker.getExchangeInfo(mixedCase)?.name).toBe("Binance");
    });

    it("should handle addresses with different checksums", () => {
      const checksummed = "0x28c6c06298d514Db089934071355E5743bf21d60";
      expect(tracker.isExchange(checksummed)).toBe(true);
    });

    it("should handle very large transfer amounts", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: BigInt("999999999999999999999999999"),
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);
      expect(analysis.totalAmountTraced).toBe(BigInt("999999999999999999999999999"));
    });

    it("should handle zero value transfers", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: 0n,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
        minTransferAmount: 0n,
      });

      // Zero transfers should still be filtered if below min amount
      const transfers = await t.getIncomingTransfers(validWallet, {
        minAmount: 1n,
      });
      expect(transfers.length).toBe(0);
    });

    it("should handle self-transfers", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: validWallet.toLowerCase(),
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      // Self-transfers are technically incoming
      const transfers = await t.getIncomingTransfers(validWallet);
      expect(transfers.length).toBe(1);
    });

    it("should handle multiple transfers from same source", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      // Should consolidate into one source
      const binanceSources = analysis.fundingSources.filter(
        (s) => s.address.toLowerCase() === binanceAddress
      );
      expect(binanceSources.length).toBe(1);
      expect(binanceSources[0]!.transferCount).toBe(2);
    });
  });

  // ==========================================================================
  // Real-World Scenario Tests
  // ==========================================================================

  describe("real-world scenarios", () => {
    it("should analyze wallet funded by multiple exchanges", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
          timestamp: 1704067200,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: coinbaseAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
          timestamp: 1704153600,
        }),
        createMockTransaction({
          hash: "0x" + "3".repeat(64),
          from: krakenAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.small,
          timestamp: 1704240000,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.summary.exchangeFunds.exchanges.length).toBe(3);
      expect(analysis.summary.exchangeFunds.exchanges).toContain("Binance");
      expect(analysis.summary.exchangeFunds.exchanges).toContain("Coinbase");
      expect(analysis.summary.exchangeFunds.exchanges).toContain("Kraken");
      expect(analysis.riskLevel).not.toBe("critical");
    });

    it("should flag suspicious wallet with mixer funding", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: binanceAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: tornadoCashAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.riskLevel).toBe("critical");
      expect(analysis.summary.hasSanctionedSource).toBe(true);
      expect(analysis.summary.mixerFunds.mixers).toContain("Tornado Cash");
    });

    it("should handle wallet funded through DeFi protocols", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: uniswapRouterAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.medium,
        }),
        createMockTransaction({
          hash: "0x" + "2".repeat(64),
          from: aavePoolAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      expect(analysis.summary.defiFunds.protocols.length).toBeGreaterThanOrEqual(
        1
      );
      expect(analysis.summary.sourcesByType.defi).toBeGreaterThanOrEqual(1);
    });

    it("should handle bridge transfers", async () => {
      const mockTransactions = [
        createMockTransaction({
          from: polygonBridgeAddress,
          to: validWallet.toLowerCase(),
          value: sampleAmounts.large,
        }),
      ];

      const mockClient = createMockPolygonscanClient(mockTransactions);
      const t = new FundingSourceTracker({
        polygonscanClient: mockClient as any,
        maxDepth: 1,
      });

      const analysis = await t.analyzeFundingSources(validWallet);

      const bridgeSource = analysis.fundingSources.find(
        (s) => s.name === "Polygon PoS Bridge"
      );
      expect(bridgeSource).toBeDefined();
      expect(bridgeSource?.type).toBe("defi");
    });
  });
});
