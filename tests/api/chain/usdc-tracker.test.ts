/**
 * Tests for USDC Transfer Tracker API (API-CHAIN-007)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  USDCTracker,
  createUSDCTracker,
  getSharedUSDCTracker,
  setSharedUSDCTracker,
  resetSharedUSDCTracker,
  isPolymarketDepositContract,
  isUSDCTokenContract,
  formatUSDCAmount,
  parseUSDCAmount,
  USDC_ADDRESSES,
  POLYMARKET_DEPOSIT_CONTRACTS,
  TRANSFER_EVENT_TOPIC,
  type USDCTransfer,
} from "../../../src/api/chain";
import { POLYMARKET_CONTRACTS } from "../../../src/api/chain/contract-decoder";

// ============================================================================
// Test Fixtures
// ============================================================================

// Valid Ethereum addresses for testing (properly checksummed)
const validWallet = "0x742d35Cc6634C0532925a3b844bC9e7595f8B123";

// USDC addresses
const usdcAddress = USDC_ADDRESSES.USDC;
const usdcEAddress = USDC_ADDRESSES.USDC_E;

// Polymarket contract addresses
const ctfExchangeAddress = POLYMARKET_DEPOSIT_CONTRACTS.CTF_EXCHANGE;
const negRiskExchangeAddress = POLYMARKET_DEPOSIT_CONTRACTS.NEG_RISK_CTF_EXCHANGE;
const conditionalTokensAddress = POLYMARKET_DEPOSIT_CONTRACTS.CONDITIONAL_TOKENS;
const routerAddress = POLYMARKET_DEPOSIT_CONTRACTS.ROUTER;

// Random non-Polymarket address
const randomAddress = "0x1234567890123456789012345678901234567890";

// Sample transfer amounts
const sampleAmounts = {
  small: 10_000_000n, // 10 USDC
  medium: 1_000_000_000n, // 1000 USDC
  large: 15_000_000_000n, // 15000 USDC
  veryLarge: 100_000_000_000n, // 100000 USDC
};

// Mock PolygonscanClient
const createMockPolygonscanClient = (transactions: any[] = []) => ({
  getWalletHistory: vi.fn().mockResolvedValue({
    transactions,
    hasMore: false,
    page: 1,
    pageSize: 1000,
  }),
  getAllWalletHistory: vi.fn().mockResolvedValue(transactions),
  getInternalTransactions: vi.fn().mockResolvedValue([]),
  getTransactionCount: vi.fn().mockResolvedValue(100),
});

// Create mock ERC20 transaction
const createMockERC20Transaction = (overrides: Partial<any> = {}) => ({
  hash: "0x" + "1".repeat(64),
  blockNumber: 50000000n,
  timestamp: 1704067200, // 2024-01-01
  nonce: 1,
  blockHash: "0x" + "2".repeat(64),
  transactionIndex: 0,
  from: validWallet.toLowerCase(),
  to: ctfExchangeAddress.toLowerCase(),
  value: sampleAmounts.medium,
  gas: 100000n,
  gasPrice: 30000000000n,
  input: "0xa9059cbb" + // transfer selector
    "000000000000000000000000" + ctfExchangeAddress.slice(2).toLowerCase() + // to
    "000000000000000000000000000000000000000000000000000000003b9aca00", // amount (1000 USDC)
  contractAddress: usdcAddress,
  cumulativeGasUsed: 100000n,
  gasUsed: 50000n,
  confirmations: 1000,
  isError: false,
  txReceiptStatus: "1",
  methodId: "0xa9059cbb",
  functionName: "transfer(address,uint256)",
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("USDCTracker", () => {
  let tracker: USDCTracker;

  beforeEach(() => {
    tracker = new USDCTracker();
    resetSharedUSDCTracker();
  });

  afterEach(() => {
    resetSharedUSDCTracker();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create tracker with default configuration", () => {
      const t = new USDCTracker();
      expect(t).toBeDefined();
    });

    it("should create tracker with custom configuration", () => {
      const t = new USDCTracker({
        largeDepositThreshold: 50000,
        largeWithdrawalThreshold: 25000,
        includeUsdcE: false,
        debug: true,
      });
      expect(t).toBeDefined();
      const stats = t.getStats();
      expect(stats.largeDepositThreshold).toBe(50000);
      expect(stats.largeWithdrawalThreshold).toBe(25000);
      expect(stats.includesUsdcE).toBe(false);
    });

    it("should accept additional contract addresses", () => {
      const customAddress = "0x1234567890123456789012345678901234567890";
      const t = new USDCTracker({
        additionalContracts: {
          CUSTOM_CONTRACT: customAddress,
        },
      });
      expect(t.isPolymarketContract(customAddress)).toBe(true);
    });

    it("should accept custom logger", () => {
      const logs: string[] = [];
      const customLogger = {
        debug: (msg: string) => logs.push(`debug: ${msg}`),
        info: (msg: string) => logs.push(`info: ${msg}`),
        warn: (msg: string) => logs.push(`warn: ${msg}`),
        error: (msg: string) => logs.push(`error: ${msg}`),
      };
      const t = new USDCTracker({ logger: customLogger, debug: true });
      expect(t).toBeDefined();
    });

    it("should accept custom Polygonscan client", () => {
      const mockClient = createMockPolygonscanClient();
      const t = new USDCTracker({
        polygonscanClient: mockClient as any,
      });
      expect(t).toBeDefined();
    });
  });

  // ==========================================================================
  // Address Detection Tests
  // ==========================================================================

  describe("isPolymarketContract", () => {
    it("should return true for CTF Exchange", () => {
      expect(tracker.isPolymarketContract(ctfExchangeAddress)).toBe(true);
    });

    it("should return true for NegRisk Exchange", () => {
      expect(tracker.isPolymarketContract(negRiskExchangeAddress)).toBe(true);
    });

    it("should return true for Conditional Tokens", () => {
      expect(tracker.isPolymarketContract(conditionalTokensAddress)).toBe(true);
    });

    it("should return true for Router", () => {
      expect(tracker.isPolymarketContract(routerAddress)).toBe(true);
    });

    it("should return false for non-Polymarket address", () => {
      expect(tracker.isPolymarketContract(randomAddress)).toBe(false);
    });

    it("should return false for USDC address", () => {
      expect(tracker.isPolymarketContract(usdcAddress)).toBe(false);
    });

    it("should handle case-insensitive matching", () => {
      expect(tracker.isPolymarketContract(ctfExchangeAddress.toLowerCase())).toBe(true);
      expect(tracker.isPolymarketContract(ctfExchangeAddress.toUpperCase())).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(tracker.isPolymarketContract("")).toBe(false);
    });

    it("should return false for invalid address", () => {
      expect(tracker.isPolymarketContract("invalid")).toBe(false);
    });
  });

  describe("getPolymarketContractName", () => {
    it("should return CTF_EXCHANGE for CTF Exchange address", () => {
      expect(tracker.getPolymarketContractName(ctfExchangeAddress)).toBe("CTF_EXCHANGE");
    });

    it("should return NEG_RISK_CTF_EXCHANGE for NegRisk Exchange", () => {
      expect(tracker.getPolymarketContractName(negRiskExchangeAddress)).toBe("NEG_RISK_CTF_EXCHANGE");
    });

    it("should return CONDITIONAL_TOKENS for Conditional Tokens", () => {
      expect(tracker.getPolymarketContractName(conditionalTokensAddress)).toBe("CONDITIONAL_TOKENS");
    });

    it("should return ROUTER for Router", () => {
      expect(tracker.getPolymarketContractName(routerAddress)).toBe("ROUTER");
    });

    it("should return undefined for non-Polymarket address", () => {
      expect(tracker.getPolymarketContractName(randomAddress)).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      expect(tracker.getPolymarketContractName("")).toBeUndefined();
    });
  });

  describe("isUSDCContract", () => {
    it("should return true for USDC address", () => {
      expect(tracker.isUSDCContract(usdcAddress)).toBe(true);
    });

    it("should return true for USDC.e address when enabled", () => {
      expect(tracker.isUSDCContract(usdcEAddress)).toBe(true);
    });

    it("should return false for USDC.e when disabled", () => {
      const t = new USDCTracker({ includeUsdcE: false });
      expect(t.isUSDCContract(usdcEAddress)).toBe(false);
    });

    it("should return false for non-USDC address", () => {
      expect(tracker.isUSDCContract(randomAddress)).toBe(false);
    });

    it("should handle case-insensitive matching", () => {
      expect(tracker.isUSDCContract(usdcAddress.toLowerCase())).toBe(true);
      expect(tracker.isUSDCContract(usdcAddress.toUpperCase())).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(tracker.isUSDCContract("")).toBe(false);
    });
  });

  describe("getUSDCTokenType", () => {
    it("should return USDC for USDC address", () => {
      expect(tracker.getUSDCTokenType(usdcAddress)).toBe("USDC");
    });

    it("should return USDC.e for USDC.e address", () => {
      expect(tracker.getUSDCTokenType(usdcEAddress)).toBe("USDC.e");
    });

    it("should return undefined for non-USDC address", () => {
      expect(tracker.getUSDCTokenType(randomAddress)).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      expect(tracker.getUSDCTokenType("")).toBeUndefined();
    });
  });

  // ==========================================================================
  // USDC Formatting Tests
  // ==========================================================================

  describe("formatUSDC", () => {
    it("should format small amounts correctly", () => {
      expect(tracker.formatUSDC(1_000_000n)).toBe("1.00");
    });

    it("should format amounts with decimals", () => {
      expect(tracker.formatUSDC(1_234_567n)).toBe("1.234567");
    });

    it("should format large amounts correctly", () => {
      expect(tracker.formatUSDC(1_000_000_000_000n)).toBe("1000000.00");
    });

    it("should format zero correctly", () => {
      expect(tracker.formatUSDC(0n)).toBe("0.00");
    });

    it("should format amounts less than 1 USDC", () => {
      expect(tracker.formatUSDC(500_000n)).toBe("0.50");
    });

    it("should handle negative amounts", () => {
      expect(tracker.formatUSDC(-1_000_000n)).toBe("-1.00");
    });

    it("should preserve significant decimals", () => {
      expect(tracker.formatUSDC(1_000_001n)).toBe("1.000001");
    });
  });

  describe("parseUSDC", () => {
    it("should parse whole numbers", () => {
      expect(tracker.parseUSDC("100")).toBe(100_000_000n);
    });

    it("should parse decimal numbers", () => {
      expect(tracker.parseUSDC("1.5")).toBe(1_500_000n);
    });

    it("should parse numbers with full precision", () => {
      expect(tracker.parseUSDC("1.234567")).toBe(1_234_567n);
    });

    it("should truncate excess decimals", () => {
      expect(tracker.parseUSDC("1.12345678")).toBe(1_123_456n);
    });

    it("should handle zero", () => {
      expect(tracker.parseUSDC("0")).toBe(0n);
    });

    it("should handle decimal without leading zero", () => {
      expect(tracker.parseUSDC(".5")).toBe(500_000n);
    });
  });

  // ==========================================================================
  // Wallet Transfer Tests
  // ==========================================================================

  describe("getWalletTransfers", () => {
    it("should throw error for invalid address", async () => {
      await expect(tracker.getWalletTransfers("invalid")).rejects.toThrow("Invalid wallet address");
    });

    it("should throw error for empty address", async () => {
      await expect(tracker.getWalletTransfers("")).rejects.toThrow("Invalid wallet address");
    });

    it("should return transfers for valid wallet", async () => {
      const mockTx = createMockERC20Transaction();
      const mockClient = createMockPolygonscanClient([mockTx]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      await t.getWalletTransfers(validWallet);
      expect(mockClient.getWalletHistory).toHaveBeenCalled();
    });

    it("should filter non-USDC transfers", async () => {
      const nonUsdcTx = createMockERC20Transaction({
        contractAddress: randomAddress,
      });
      const mockClient = createMockPolygonscanClient([nonUsdcTx]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      const transfers = await t.getWalletTransfers(validWallet);
      // Non-USDC transfers should be filtered out
      expect(transfers.length).toBe(0);
    });

    it("should handle pagination", async () => {
      const mockTx = createMockERC20Transaction();
      const mockClient = createMockPolygonscanClient([mockTx]);
      mockClient.getWalletHistory
        .mockResolvedValueOnce({
          transactions: [mockTx],
          hasMore: true,
          page: 1,
          pageSize: 1000,
        })
        .mockResolvedValueOnce({
          transactions: [],
          hasMore: false,
          page: 2,
          pageSize: 1000,
        });

      const t = new USDCTracker({ polygonscanClient: mockClient as any });
      await t.getWalletTransfers(validWallet);

      expect(mockClient.getWalletHistory).toHaveBeenCalledTimes(2);
    });

    it("should accept block range options", async () => {
      const mockClient = createMockPolygonscanClient([]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      await t.getWalletTransfers(validWallet, {
        startBlock: 50000000n,
        endBlock: 50001000n,
      });

      expect(mockClient.getWalletHistory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          startBlock: 50000000n,
          endBlock: 50001000n,
        })
      );
    });
  });

  // ==========================================================================
  // Polymarket Deposit/Withdrawal Tests
  // ==========================================================================

  describe("getPolymarketDeposits", () => {
    it("should return only Polymarket deposits", async () => {
      const depositTx = createMockERC20Transaction({
        from: validWallet.toLowerCase(),
        to: ctfExchangeAddress.toLowerCase(),
      });
      const withdrawalTx = createMockERC20Transaction({
        hash: "0x" + "2".repeat(64),
        from: ctfExchangeAddress.toLowerCase(),
        to: validWallet.toLowerCase(),
      });
      const otherTx = createMockERC20Transaction({
        hash: "0x" + "3".repeat(64),
        from: validWallet.toLowerCase(),
        to: randomAddress.toLowerCase(),
      });

      const mockClient = createMockPolygonscanClient([depositTx, withdrawalTx, otherTx]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      const deposits = await t.getPolymarketDeposits(validWallet);
      expect(deposits.every(d => d.isPolymarketDeposit)).toBe(true);
    });
  });

  describe("getPolymarketWithdrawals", () => {
    it("should return only Polymarket withdrawals", async () => {
      const withdrawalTx = createMockERC20Transaction({
        from: ctfExchangeAddress.toLowerCase(),
        to: validWallet.toLowerCase(),
      });

      const mockClient = createMockPolygonscanClient([withdrawalTx]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      const withdrawals = await t.getPolymarketWithdrawals(validWallet);
      expect(withdrawals.every(w => w.isPolymarketWithdrawal)).toBe(true);
    });
  });

  // ==========================================================================
  // Deposit Summary Tests
  // ==========================================================================

  describe("getDepositSummary", () => {
    it("should throw error for invalid address", async () => {
      await expect(tracker.getDepositSummary("invalid")).rejects.toThrow("Invalid wallet address");
    });

    it("should calculate totals correctly", async () => {
      const mockClient = createMockPolygonscanClient([]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      const summary = await t.getDepositSummary(validWallet);

      expect(summary.walletAddress).toBeDefined();
      expect(summary.totalDeposited).toBe(0n);
      expect(summary.totalWithdrawn).toBe(0n);
      expect(summary.netPosition).toBe(0n);
      expect(summary.depositCount).toBe(0);
      expect(summary.withdrawalCount).toBe(0);
    });

    it("should return properly formatted amounts", async () => {
      const mockClient = createMockPolygonscanClient([]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      const summary = await t.getDepositSummary(validWallet);

      expect(summary.totalDepositedFormatted).toBe("0.00");
      expect(summary.totalWithdrawnFormatted).toBe("0.00");
      expect(summary.netPositionFormatted).toBe("0.00");
      expect(summary.averageDepositSize).toBe("0.00");
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("processTransfer", () => {
    it("should emit deposit event for Polymarket deposits", () => {
      const depositListener = vi.fn();
      tracker.on("deposit", depositListener);

      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: validWallet,
        to: ctfExchangeAddress,
        amount: sampleAmounts.medium,
        formattedAmount: "1000.00",
        usdValue: "1000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "deposit",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: true,
        isPolymarketWithdrawal: false,
      };

      tracker.processTransfer(transfer);

      expect(depositListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "deposit",
          transfer,
        })
      );
    });

    it("should emit withdrawal event for Polymarket withdrawals", () => {
      const withdrawalListener = vi.fn();
      tracker.on("withdrawal", withdrawalListener);

      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: ctfExchangeAddress,
        to: validWallet,
        amount: sampleAmounts.medium,
        formattedAmount: "1000.00",
        usdValue: "1000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "withdrawal",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: false,
        isPolymarketWithdrawal: true,
      };

      tracker.processTransfer(transfer);

      expect(withdrawalListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "withdrawal",
          transfer,
        })
      );
    });

    it("should emit largeDeposit event for deposits above threshold", () => {
      const t = new USDCTracker({ largeDepositThreshold: 1000 });
      const largeDepositListener = vi.fn();
      t.on("largeDeposit", largeDepositListener);

      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: validWallet,
        to: ctfExchangeAddress,
        amount: sampleAmounts.large, // 15000 USDC
        formattedAmount: "15000.00",
        usdValue: "15000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "deposit",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: true,
        isPolymarketWithdrawal: false,
      };

      t.processTransfer(transfer);

      expect(largeDepositListener).toHaveBeenCalled();
    });

    it("should emit largeWithdrawal event for withdrawals above threshold", () => {
      const t = new USDCTracker({ largeWithdrawalThreshold: 1000 });
      const largeWithdrawalListener = vi.fn();
      t.on("largeWithdrawal", largeWithdrawalListener);

      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: ctfExchangeAddress,
        to: validWallet,
        amount: sampleAmounts.large, // 15000 USDC
        formattedAmount: "15000.00",
        usdValue: "15000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "withdrawal",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: false,
        isPolymarketWithdrawal: true,
      };

      t.processTransfer(transfer);

      expect(largeWithdrawalListener).toHaveBeenCalled();
    });

    it("should not emit largeDeposit for deposits below threshold", () => {
      const t = new USDCTracker({ largeDepositThreshold: 100000 });
      const largeDepositListener = vi.fn();
      t.on("largeDeposit", largeDepositListener);

      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: validWallet,
        to: ctfExchangeAddress,
        amount: sampleAmounts.medium, // 1000 USDC
        formattedAmount: "1000.00",
        usdValue: "1000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "deposit",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: true,
        isPolymarketWithdrawal: false,
      };

      t.processTransfer(transfer);

      expect(largeDepositListener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe("getStats", () => {
    it("should return correct statistics", () => {
      const t = new USDCTracker({
        largeDepositThreshold: 50000,
        largeWithdrawalThreshold: 25000,
        includeUsdcE: false,
      });

      const stats = t.getStats();

      expect(stats.largeDepositThreshold).toBe(50000);
      expect(stats.largeWithdrawalThreshold).toBe(25000);
      expect(stats.includesUsdcE).toBe(false);
      expect(stats.monitoredContractCount).toBeGreaterThan(0);
    });

    it("should count additional contracts", () => {
      const t = new USDCTracker({
        additionalContracts: {
          CUSTOM1: randomAddress,
          CUSTOM2: "0x9876543210987654321098765432109876543210",
        },
      });

      const stats = t.getStats();
      // Default contracts + 2 custom
      expect(stats.monitoredContractCount).toBe(4 + 2);
    });
  });

  // ==========================================================================
  // Singleton and Factory Tests
  // ==========================================================================

  describe("createUSDCTracker", () => {
    it("should create new instance", () => {
      const t = createUSDCTracker();
      expect(t).toBeInstanceOf(USDCTracker);
    });

    it("should accept configuration", () => {
      const t = createUSDCTracker({
        largeDepositThreshold: 50000,
      });
      expect(t.getStats().largeDepositThreshold).toBe(50000);
    });
  });

  describe("getSharedUSDCTracker", () => {
    it("should return shared instance", () => {
      const t1 = getSharedUSDCTracker();
      const t2 = getSharedUSDCTracker();
      expect(t1).toBe(t2);
    });

    it("should create new instance if none exists", () => {
      resetSharedUSDCTracker();
      const t = getSharedUSDCTracker();
      expect(t).toBeInstanceOf(USDCTracker);
    });
  });

  describe("setSharedUSDCTracker", () => {
    it("should set shared instance", () => {
      const custom = new USDCTracker({ largeDepositThreshold: 99999 });
      setSharedUSDCTracker(custom);

      const shared = getSharedUSDCTracker();
      expect(shared.getStats().largeDepositThreshold).toBe(99999);
    });
  });

  describe("resetSharedUSDCTracker", () => {
    it("should reset shared instance", () => {
      const custom = new USDCTracker({ largeDepositThreshold: 99999 });
      setSharedUSDCTracker(custom);
      resetSharedUSDCTracker();

      const shared = getSharedUSDCTracker();
      expect(shared.getStats().largeDepositThreshold).toBe(10000); // default
    });
  });

  // ==========================================================================
  // Convenience Function Tests
  // ==========================================================================

  describe("isPolymarketDepositContract", () => {
    it("should check using shared tracker", () => {
      expect(isPolymarketDepositContract(ctfExchangeAddress)).toBe(true);
      expect(isPolymarketDepositContract(randomAddress)).toBe(false);
    });

    it("should accept custom tracker", () => {
      const custom = new USDCTracker({
        additionalContracts: { CUSTOM: randomAddress },
      });
      expect(isPolymarketDepositContract(randomAddress, custom)).toBe(true);
    });
  });

  describe("isUSDCTokenContract", () => {
    it("should check using shared tracker", () => {
      expect(isUSDCTokenContract(usdcAddress)).toBe(true);
      expect(isUSDCTokenContract(randomAddress)).toBe(false);
    });

    it("should accept custom tracker", () => {
      const custom = new USDCTracker({ includeUsdcE: false });
      expect(isUSDCTokenContract(usdcEAddress, custom)).toBe(false);
    });
  });

  describe("formatUSDCAmount", () => {
    it("should format amount using shared tracker", () => {
      expect(formatUSDCAmount(1_000_000n)).toBe("1.00");
      expect(formatUSDCAmount(1_234_567n)).toBe("1.234567");
    });
  });

  describe("parseUSDCAmount", () => {
    it("should parse amount using shared tracker", () => {
      expect(parseUSDCAmount("100")).toBe(100_000_000n);
      expect(parseUSDCAmount("1.5")).toBe(1_500_000n);
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("USDC_ADDRESSES", () => {
    it("should contain USDC address", () => {
      expect(USDC_ADDRESSES.USDC).toBe(POLYMARKET_CONTRACTS.USDC);
    });

    it("should contain USDC.e address", () => {
      expect(USDC_ADDRESSES.USDC_E).toBe(POLYMARKET_CONTRACTS.USDC_E);
    });
  });

  describe("POLYMARKET_DEPOSIT_CONTRACTS", () => {
    it("should contain CTF Exchange", () => {
      expect(POLYMARKET_DEPOSIT_CONTRACTS.CTF_EXCHANGE).toBe(POLYMARKET_CONTRACTS.CTF_EXCHANGE);
    });

    it("should contain NegRisk Exchange", () => {
      expect(POLYMARKET_DEPOSIT_CONTRACTS.NEG_RISK_CTF_EXCHANGE).toBe(POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE);
    });

    it("should contain Conditional Tokens", () => {
      expect(POLYMARKET_DEPOSIT_CONTRACTS.CONDITIONAL_TOKENS).toBe(POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS);
    });

    it("should contain Router", () => {
      expect(POLYMARKET_DEPOSIT_CONTRACTS.ROUTER).toBe(POLYMARKET_CONTRACTS.ROUTER);
    });
  });

  describe("TRANSFER_EVENT_TOPIC", () => {
    it("should be the ERC20 Transfer event topic", () => {
      // keccak256("Transfer(address,address,uint256)")
      expect(TRANSFER_EVENT_TOPIC).toBe(
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty transfer list", async () => {
      const mockClient = createMockPolygonscanClient([]);
      const t = new USDCTracker({ polygonscanClient: mockClient as any });

      const transfers = await t.getWalletTransfers(validWallet);
      expect(transfers).toEqual([]);
    });

    it("should handle mixed case addresses", () => {
      const mixedCase = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
      expect(tracker.isPolymarketContract(mixedCase)).toBe(true);
    });

    it("should handle address normalization", () => {
      const lowerCase = ctfExchangeAddress.toLowerCase();
      const upperCase = ctfExchangeAddress.toUpperCase();

      expect(tracker.isPolymarketContract(lowerCase)).toBe(true);
      expect(tracker.isPolymarketContract(upperCase)).toBe(true);
      expect(tracker.getPolymarketContractName(lowerCase)).toBe("CTF_EXCHANGE");
    });

    it("should handle very large amounts", () => {
      const largeAmount = 1_000_000_000_000_000n; // 1 billion USDC
      const formatted = tracker.formatUSDC(largeAmount);
      expect(formatted).toBe("1000000000.00");
    });

    it("should handle very small amounts", () => {
      const smallAmount = 1n; // 0.000001 USDC
      const formatted = tracker.formatUSDC(smallAmount);
      expect(formatted).toBe("0.000001");
    });
  });

  // ==========================================================================
  // Real-world Scenario Tests
  // ==========================================================================

  describe("real-world scenarios", () => {
    it("should correctly identify deposit to CTF Exchange", () => {
      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: validWallet,
        to: ctfExchangeAddress,
        amount: sampleAmounts.large,
        formattedAmount: "15000.00",
        usdValue: "15000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "deposit",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: true,
        isPolymarketWithdrawal: false,
      };

      expect(transfer.isPolymarketDeposit).toBe(true);
      expect(transfer.direction).toBe("deposit");
      expect(transfer.polymarketContract).toBe("CTF_EXCHANGE");
    });

    it("should correctly identify withdrawal from Conditional Tokens", () => {
      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: conditionalTokensAddress,
        to: validWallet,
        amount: sampleAmounts.medium,
        formattedAmount: "1000.00",
        usdValue: "1000.00",
        tokenType: "USDC",
        tokenAddress: usdcAddress,
        direction: "withdrawal",
        polymarketContract: "CONDITIONAL_TOKENS",
        isPolymarketDeposit: false,
        isPolymarketWithdrawal: true,
      };

      expect(transfer.isPolymarketWithdrawal).toBe(true);
      expect(transfer.direction).toBe("withdrawal");
      expect(transfer.polymarketContract).toBe("CONDITIONAL_TOKENS");
    });

    it("should handle USDC.e deposits", () => {
      const transfer: USDCTransfer = {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 50000000n,
        timestamp: 1704067200,
        from: validWallet,
        to: ctfExchangeAddress,
        amount: sampleAmounts.medium,
        formattedAmount: "1000.00",
        usdValue: "1000.00",
        tokenType: "USDC.e",
        tokenAddress: usdcEAddress,
        direction: "deposit",
        polymarketContract: "CTF_EXCHANGE",
        isPolymarketDeposit: true,
        isPolymarketWithdrawal: false,
      };

      expect(transfer.tokenType).toBe("USDC.e");
      expect(transfer.isPolymarketDeposit).toBe(true);
    });

    it("should track multiple deposits and withdrawals", () => {
      const transfers: USDCTransfer[] = [
        // Deposit 1
        {
          transactionHash: "0x" + "1".repeat(64),
          blockNumber: 50000000n,
          timestamp: 1704067200,
          from: validWallet,
          to: ctfExchangeAddress,
          amount: 5_000_000_000n, // 5000 USDC
          formattedAmount: "5000.00",
          usdValue: "5000.00",
          tokenType: "USDC",
          tokenAddress: usdcAddress,
          direction: "deposit",
          polymarketContract: "CTF_EXCHANGE",
          isPolymarketDeposit: true,
          isPolymarketWithdrawal: false,
        },
        // Deposit 2
        {
          transactionHash: "0x" + "2".repeat(64),
          blockNumber: 50000100n,
          timestamp: 1704068200,
          from: validWallet,
          to: ctfExchangeAddress,
          amount: 3_000_000_000n, // 3000 USDC
          formattedAmount: "3000.00",
          usdValue: "3000.00",
          tokenType: "USDC",
          tokenAddress: usdcAddress,
          direction: "deposit",
          polymarketContract: "CTF_EXCHANGE",
          isPolymarketDeposit: true,
          isPolymarketWithdrawal: false,
        },
        // Withdrawal
        {
          transactionHash: "0x" + "3".repeat(64),
          blockNumber: 50000200n,
          timestamp: 1704069200,
          from: ctfExchangeAddress,
          to: validWallet,
          amount: 2_000_000_000n, // 2000 USDC
          formattedAmount: "2000.00",
          usdValue: "2000.00",
          tokenType: "USDC",
          tokenAddress: usdcAddress,
          direction: "withdrawal",
          polymarketContract: "CTF_EXCHANGE",
          isPolymarketDeposit: false,
          isPolymarketWithdrawal: true,
        },
      ];

      const deposits = transfers.filter(t => t.isPolymarketDeposit);
      const withdrawals = transfers.filter(t => t.isPolymarketWithdrawal);

      const totalDeposited = deposits.reduce((sum, t) => sum + t.amount, 0n);
      const totalWithdrawn = withdrawals.reduce((sum, t) => sum + t.amount, 0n);
      const netPosition = totalDeposited - totalWithdrawn;

      expect(deposits.length).toBe(2);
      expect(withdrawals.length).toBe(1);
      expect(totalDeposited).toBe(8_000_000_000n); // 8000 USDC
      expect(totalWithdrawn).toBe(2_000_000_000n); // 2000 USDC
      expect(netPosition).toBe(6_000_000_000n); // 6000 USDC
    });
  });
});
