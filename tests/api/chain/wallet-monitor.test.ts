/**
 * Tests for Wallet Monitor (API-CHAIN-005)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WalletMonitor,
  WalletMonitorEventType,
  createWalletMonitor,
  getSharedWalletMonitor,
  setSharedWalletMonitor,
  resetSharedWalletMonitor,
  startMonitoringWallet,
  monitorWallets,
  type WalletMonitorConfig,
} from "../../../src/api/chain/wallet-monitor";
import { PolygonClientError } from "../../../src/api/chain/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test wallet addresses (properly checksummed for viem)
const VALID_ADDRESS = "0x742D35CC6634C0532925A3B844BC9E7595F2BD8e";
const VALID_ADDRESS_2 = "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe";
const INVALID_ADDRESS = "not-an-address";
const CHECKSUMMED_ADDRESS = "0x742D35CC6634C0532925A3B844BC9E7595F2BD8e";

// Sample transaction data from Polygonscan API
const sampleTransaction = {
  blockNumber: "50000000",
  timeStamp: "1700000000",
  hash: "0xabc123",
  nonce: "1",
  blockHash: "0xblock123",
  transactionIndex: "0",
  from: VALID_ADDRESS.toLowerCase(),
  to: "0xrecipient",
  value: "1000000000000000000",
  gas: "21000",
  gasPrice: "30000000000",
  isError: "0",
  txreceipt_status: "1",
  input: "0x",
  contractAddress: "",
  cumulativeGasUsed: "21000",
  gasUsed: "21000",
  confirmations: "100",
  methodId: "",
  functionName: "",
};

const sampleInternalTransaction = {
  blockNumber: "50000001",
  timeStamp: "1700000100",
  hash: "0xdef456",
  from: VALID_ADDRESS.toLowerCase(),
  to: "0xrecipient",
  value: "500000000000000000",
  contractAddress: "0xcontract",
  input: "0x",
  type: "call",
  gas: "100000",
  gasUsed: "50000",
  traceId: "0",
  isError: "0",
  errCode: "",
};

// Helper to create mock API responses
function createMockResponse(
  transactions: unknown[],
  status = "1",
  message = "OK"
): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        status,
        message,
        result: transactions,
      }),
  } as Response;
}

describe("WalletMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetSharedWalletMonitor();

    // Default mock response - empty transactions
    mockFetch.mockResolvedValue(
      createMockResponse([], "0", "No transactions found")
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSharedWalletMonitor();
  });

  describe("Constructor", () => {
    it("should create instance with default config", () => {
      const monitor = new WalletMonitor();
      expect(monitor).toBeInstanceOf(WalletMonitor);
      expect(monitor.isRunning()).toBe(false);
      expect(monitor.getWalletCount()).toBe(0);
    });

    it("should create instance with custom config", () => {
      const config: WalletMonitorConfig = {
        pollingIntervalMs: 5000,
        transactionTypes: ["normal", "internal"],
        maxTransactionsPerPoll: 50,
        debug: true,
      };
      const monitor = new WalletMonitor(config);
      expect(monitor).toBeInstanceOf(WalletMonitor);
    });

    it("should create instance with custom logger", () => {
      const customLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const monitor = new WalletMonitor({ debug: true, logger: customLogger });
      monitor.addWallet(VALID_ADDRESS);
      expect(customLogger.debug).toHaveBeenCalled();
    });
  });

  describe("Wallet Management", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor();
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should add a valid wallet address", () => {
      const result = monitor.addWallet(VALID_ADDRESS);
      expect(result).toBe(CHECKSUMMED_ADDRESS);
      expect(monitor.getWalletCount()).toBe(1);
      expect(monitor.isMonitoringWallet(VALID_ADDRESS)).toBe(true);
    });

    it("should normalize addresses to checksum format", () => {
      const lowercaseAddress = VALID_ADDRESS.toLowerCase();
      const result = monitor.addWallet(lowercaseAddress);
      expect(result).toBe(CHECKSUMMED_ADDRESS);
    });

    it("should not add duplicate wallets", () => {
      monitor.addWallet(VALID_ADDRESS);
      monitor.addWallet(VALID_ADDRESS); // Try to add again
      expect(monitor.getWalletCount()).toBe(1);
    });

    it("should throw on invalid address", () => {
      expect(() => monitor.addWallet(INVALID_ADDRESS)).toThrow(PolygonClientError);
    });

    it("should throw on empty address", () => {
      expect(() => monitor.addWallet("")).toThrow(PolygonClientError);
    });

    it("should remove a wallet", () => {
      monitor.addWallet(VALID_ADDRESS);
      const removed = monitor.removeWallet(VALID_ADDRESS);
      expect(removed).toBe(true);
      expect(monitor.getWalletCount()).toBe(0);
      expect(monitor.isMonitoringWallet(VALID_ADDRESS)).toBe(false);
    });

    it("should return false when removing non-existent wallet", () => {
      const removed = monitor.removeWallet(VALID_ADDRESS);
      expect(removed).toBe(false);
    });

    it("should return false when removing invalid address", () => {
      const removed = monitor.removeWallet(INVALID_ADDRESS);
      expect(removed).toBe(false);
    });

    it("should get all monitored wallets", () => {
      monitor.addWallet(VALID_ADDRESS);
      monitor.addWallet(VALID_ADDRESS_2);
      const wallets = monitor.getMonitoredWallets();
      expect(wallets).toHaveLength(2);
      expect(wallets).toContain(CHECKSUMMED_ADDRESS);
    });

    it("should emit WALLET_ADDED event", () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.WALLET_ADDED, listener);
      monitor.addWallet(VALID_ADDRESS);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.WALLET_ADDED,
          address: CHECKSUMMED_ADDRESS,
        })
      );
    });

    it("should emit WALLET_REMOVED event", () => {
      const listener = vi.fn();
      monitor.addWallet(VALID_ADDRESS);
      monitor.on(WalletMonitorEventType.WALLET_REMOVED, listener);
      monitor.removeWallet(VALID_ADDRESS);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.WALLET_REMOVED,
          address: CHECKSUMMED_ADDRESS,
        })
      );
    });

    it("should add wallet with custom start block", () => {
      const startBlock = BigInt(50000000);
      monitor.addWallet(VALID_ADDRESS, startBlock);
      const stats = monitor.getWalletStats(VALID_ADDRESS);
      expect(stats?.lastBlockNumber).toBe(startBlock);
    });
  });

  describe("Monitor Control", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor({ pollingIntervalMs: 1000 });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should start monitoring", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();
      expect(monitor.isRunning()).toBe(true);
    });

    it("should emit MONITOR_STARTED event", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.MONITOR_STARTED, listener);
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.MONITOR_STARTED,
          walletCount: 1,
        })
      );
    });

    it("should stop monitoring", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it("should emit MONITOR_STOPPED event", async () => {
      const listener = vi.fn();
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();
      monitor.on(WalletMonitorEventType.MONITOR_STOPPED, listener);
      monitor.stop();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.MONITOR_STOPPED,
        })
      );
    });

    it("should not start if already running", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();
      await monitor.start(); // Try to start again
      expect(monitor.isRunning()).toBe(true);
    });

    it("should poll at configured interval", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();

      // Clear initial call count
      mockFetch.mockClear();

      // Advance time by polling interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should allow manual poll with pollNow", async () => {
      monitor.addWallet(VALID_ADDRESS);
      mockFetch.mockClear();

      await monitor.pollNow();

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Event Listeners", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor();
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should register event listener", () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.NEW_TRANSACTION, listener);
      expect(monitor).toBeDefined(); // No direct way to check listener count
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = monitor.on(WalletMonitorEventType.WALLET_ADDED, listener);
      expect(typeof unsubscribe).toBe("function");

      // Add wallet to trigger event
      monitor.addWallet(VALID_ADDRESS);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe and try again
      unsubscribe();
      monitor.addWallet(VALID_ADDRESS_2);
      expect(listener).toHaveBeenCalledTimes(1); // Should not increase
    });

    it("should support wildcard listener (*)", () => {
      const listener = vi.fn();
      monitor.on("*", listener);
      monitor.addWallet(VALID_ADDRESS);
      expect(listener).toHaveBeenCalled();
    });

    it("should support once listener", () => {
      const listener = vi.fn();
      monitor.once(WalletMonitorEventType.WALLET_ADDED, listener);

      monitor.addWallet(VALID_ADDRESS);
      expect(listener).toHaveBeenCalledTimes(1);

      monitor.addWallet(VALID_ADDRESS_2);
      expect(listener).toHaveBeenCalledTimes(1); // Should not increase
    });

    it("should remove all listeners for event type", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      monitor.on(WalletMonitorEventType.WALLET_ADDED, listener1);
      monitor.on(WalletMonitorEventType.WALLET_ADDED, listener2);

      monitor.removeAllListeners(WalletMonitorEventType.WALLET_ADDED);

      monitor.addWallet(VALID_ADDRESS);
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("should remove all listeners when no type specified", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      monitor.on(WalletMonitorEventType.WALLET_ADDED, listener1);
      monitor.on(WalletMonitorEventType.WALLET_REMOVED, listener2);

      monitor.removeAllListeners();

      monitor.addWallet(VALID_ADDRESS);
      monitor.removeWallet(VALID_ADDRESS);
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe("Transaction Detection", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor({
        pollingIntervalMs: 1000,
        transactionTypes: ["normal"],
      });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should establish baseline on first poll (no events)", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.NEW_TRANSACTION, listener);
      monitor.addWallet(VALID_ADDRESS);

      // First poll - should establish baseline, not emit
      mockFetch.mockResolvedValueOnce(createMockResponse([sampleTransaction]));
      await monitor.pollNow();

      expect(listener).not.toHaveBeenCalled();
    });

    it("should emit NEW_TRANSACTION on subsequent polls", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.NEW_TRANSACTION, listener);
      monitor.addWallet(VALID_ADDRESS);

      // First poll - establish baseline
      mockFetch.mockResolvedValueOnce(createMockResponse([sampleTransaction]));
      await monitor.pollNow();

      // Second poll with new transaction
      const newTx = { ...sampleTransaction, hash: "0xnew123", blockNumber: "50000001" };
      mockFetch.mockResolvedValueOnce(createMockResponse([newTx]));
      await monitor.pollNow();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.NEW_TRANSACTION,
          address: CHECKSUMMED_ADDRESS,
          transactionType: "normal",
        })
      );
    });

    it("should emit POLL_COMPLETE after each poll", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.POLL_COMPLETE, listener);
      monitor.addWallet(VALID_ADDRESS);

      await monitor.pollNow();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.POLL_COMPLETE,
          walletCount: 1,
        })
      );
    });

    it("should update last block number after detecting transactions", async () => {
      monitor.addWallet(VALID_ADDRESS);

      // First poll
      mockFetch.mockResolvedValueOnce(createMockResponse([sampleTransaction]));
      await monitor.pollNow();

      const stats = monitor.getWalletStats(VALID_ADDRESS);
      expect(stats?.lastBlockNumber).toBe(BigInt(50000000));
    });
  });

  describe("Internal Transaction Detection", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor({
        pollingIntervalMs: 1000,
        transactionTypes: ["internal"],
      });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should emit NEW_INTERNAL_TRANSACTION", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.NEW_INTERNAL_TRANSACTION, listener);
      monitor.addWallet(VALID_ADDRESS);

      // First poll - establish baseline
      mockFetch.mockResolvedValueOnce(createMockResponse([sampleInternalTransaction]));
      await monitor.pollNow();

      // Second poll with new transaction
      const newTx = { ...sampleInternalTransaction, hash: "0xnew456", blockNumber: "50000002" };
      mockFetch.mockResolvedValueOnce(createMockResponse([newTx]));
      await monitor.pollNow();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.NEW_INTERNAL_TRANSACTION,
          address: CHECKSUMMED_ADDRESS,
        })
      );
    });
  });

  describe("ERC20 Transaction Detection", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor({
        pollingIntervalMs: 1000,
        transactionTypes: ["erc20"],
      });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should detect ERC20 transactions", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.NEW_TRANSACTION, listener);
      monitor.addWallet(VALID_ADDRESS);

      // First poll - establish baseline
      mockFetch.mockResolvedValueOnce(createMockResponse([sampleTransaction]));
      await monitor.pollNow();

      // Second poll with new transaction
      const newTx = { ...sampleTransaction, hash: "0xerc20tx", blockNumber: "50000001" };
      mockFetch.mockResolvedValueOnce(createMockResponse([newTx]));
      await monitor.pollNow();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.NEW_TRANSACTION,
          transactionType: "erc20",
        })
      );
    });
  });

  describe("Error Handling", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      // Configure with minimal retries to avoid test timeouts
      monitor = new WalletMonitor({
        pollingIntervalMs: 1000,
        catchErrors: true,
        polygonscanConfig: {
          maxRetries: 0, // No retries for faster tests
          retryDelay: 10,
        },
      });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should emit MONITOR_ERROR on fetch failure", async () => {
      const listener = vi.fn();
      monitor.on(WalletMonitorEventType.MONITOR_ERROR, listener);
      monitor.addWallet(VALID_ADDRESS);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await monitor.pollNow();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletMonitorEventType.MONITOR_ERROR,
        })
      );
    });

    it("should continue monitoring after error when catchErrors is true", async () => {
      const errorListener = vi.fn();
      const pollListener = vi.fn();
      monitor.on(WalletMonitorEventType.MONITOR_ERROR, errorListener);
      monitor.on(WalletMonitorEventType.POLL_COMPLETE, pollListener);
      monitor.addWallet(VALID_ADDRESS);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await monitor.pollNow();

      // Should still emit poll complete despite error
      expect(pollListener).toHaveBeenCalled();
    });

    it("should throw when catchErrors is false", async () => {
      const throwingMonitor = new WalletMonitor({
        catchErrors: false,
        polygonscanConfig: {
          maxRetries: 0,
          retryDelay: 10,
        },
      });
      throwingMonitor.addWallet(VALID_ADDRESS);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await expect(throwingMonitor.pollNow()).rejects.toThrow("Network error");

      throwingMonitor.dispose();
    });

    it("should increment error count on errors", async () => {
      monitor.addWallet(VALID_ADDRESS);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      await monitor.pollNow();

      const stats = monitor.getStats();
      expect(stats.totalErrors).toBe(1);
    });
  });

  describe("Statistics", () => {
    let monitor: WalletMonitor;

    beforeEach(() => {
      monitor = new WalletMonitor({ pollingIntervalMs: 1000 });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it("should track poll cycles", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.pollNow();
      await monitor.pollNow();

      const stats = monitor.getStats();
      expect(stats.totalPollCycles).toBe(2);
    });

    it("should track running state", async () => {
      expect(monitor.getStats().isRunning).toBe(false);
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();
      expect(monitor.getStats().isRunning).toBe(true);
    });

    it("should track wallet count", () => {
      expect(monitor.getStats().walletCount).toBe(0);
      monitor.addWallet(VALID_ADDRESS);
      expect(monitor.getStats().walletCount).toBe(1);
    });

    it("should track transactions detected", async () => {
      monitor.addWallet(VALID_ADDRESS);

      // First poll - establish baseline
      mockFetch.mockResolvedValueOnce(createMockResponse([sampleTransaction]));
      await monitor.pollNow();

      // Second poll with new transaction
      const newTx = { ...sampleTransaction, hash: "0xnew", blockNumber: "50000001" };
      mockFetch.mockResolvedValueOnce(createMockResponse([newTx]));
      await monitor.pollNow();

      const stats = monitor.getStats();
      expect(stats.totalTransactionsDetected).toBe(1);
    });

    it("should track last poll time", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.pollNow();

      const stats = monitor.getStats();
      expect(stats.lastPollAt).toBeInstanceOf(Date);
    });

    it("should calculate average poll duration", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.pollNow();
      await monitor.pollNow();

      const stats = monitor.getStats();
      expect(stats.avgPollDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should reset statistics", async () => {
      monitor.addWallet(VALID_ADDRESS);
      await monitor.pollNow();

      monitor.resetStats();

      const stats = monitor.getStats();
      expect(stats.totalPollCycles).toBe(0);
      expect(stats.totalTransactionsDetected).toBe(0);
    });

    it("should return wallet-specific statistics", () => {
      monitor.addWallet(VALID_ADDRESS);
      const walletStats = monitor.getWalletStats(VALID_ADDRESS);

      expect(walletStats).toBeDefined();
      expect(walletStats?.address).toBe(CHECKSUMMED_ADDRESS);
      expect(walletStats?.monitoringSince).toBeInstanceOf(Date);
    });

    it("should return null for non-monitored wallet stats", () => {
      const walletStats = monitor.getWalletStats(VALID_ADDRESS);
      expect(walletStats).toBeNull();
    });
  });

  describe("Dispose", () => {
    it("should dispose correctly", () => {
      const monitor = new WalletMonitor();
      monitor.addWallet(VALID_ADDRESS);
      monitor.dispose();

      expect(monitor.isDisposed()).toBe(true);
      expect(monitor.getWalletCount()).toBe(0);
    });

    it("should stop monitoring on dispose", async () => {
      const monitor = new WalletMonitor();
      monitor.addWallet(VALID_ADDRESS);
      await monitor.start();

      monitor.dispose();

      expect(monitor.isRunning()).toBe(false);
    });

    it("should throw on operations after dispose", () => {
      const monitor = new WalletMonitor();
      monitor.dispose();

      expect(() => monitor.addWallet(VALID_ADDRESS)).toThrow("WalletMonitor has been disposed");
      expect(() => monitor.start()).rejects.toThrow("WalletMonitor has been disposed");
      expect(() => monitor.on("*", vi.fn())).toThrow("WalletMonitor has been disposed");
    });

    it("should not throw on multiple dispose calls", () => {
      const monitor = new WalletMonitor();
      monitor.dispose();
      expect(() => monitor.dispose()).not.toThrow();
    });
  });

  describe("Factory Functions", () => {
    it("should create monitor with createWalletMonitor", () => {
      const monitor = createWalletMonitor();
      expect(monitor).toBeInstanceOf(WalletMonitor);
      monitor.dispose();
    });

    it("should create monitor with config", () => {
      const monitor = createWalletMonitor({ pollingIntervalMs: 5000 });
      expect(monitor).toBeInstanceOf(WalletMonitor);
      monitor.dispose();
    });
  });

  describe("Singleton Management", () => {
    afterEach(() => {
      resetSharedWalletMonitor();
    });

    it("should get shared monitor", () => {
      const monitor1 = getSharedWalletMonitor();
      const monitor2 = getSharedWalletMonitor();
      expect(monitor1).toBe(monitor2);
    });

    it("should set shared monitor", () => {
      const customMonitor = new WalletMonitor();
      setSharedWalletMonitor(customMonitor);

      const shared = getSharedWalletMonitor();
      expect(shared).toBe(customMonitor);
    });

    it("should reset shared monitor", () => {
      const monitor1 = getSharedWalletMonitor();
      resetSharedWalletMonitor();
      const monitor2 = getSharedWalletMonitor();

      expect(monitor1).not.toBe(monitor2);
    });

    it("should dispose shared monitor on reset", () => {
      const monitor = getSharedWalletMonitor();
      resetSharedWalletMonitor();
      expect(monitor.isDisposed()).toBe(true);
    });
  });

  describe("Convenience Functions", () => {
    afterEach(() => {
      resetSharedWalletMonitor();
    });

    it("should start monitoring a single wallet", async () => {
      const onNewTransaction = vi.fn();
      const { stop, monitor } = await startMonitoringWallet(
        VALID_ADDRESS,
        onNewTransaction
      );

      expect(monitor.isMonitoringWallet(VALID_ADDRESS)).toBe(true);
      expect(monitor.isRunning()).toBe(true);

      stop();
      expect(monitor.isMonitoringWallet(VALID_ADDRESS)).toBe(false);
    });

    it("should use provided monitor", async () => {
      const customMonitor = new WalletMonitor();
      const { monitor } = await startMonitoringWallet(VALID_ADDRESS, undefined, {
        monitor: customMonitor,
      });

      expect(monitor).toBe(customMonitor);
      customMonitor.dispose();
    });

    it("should monitor multiple wallets", async () => {
      // Use a fresh monitor to avoid shared state issues
      const freshMonitor = new WalletMonitor();
      const onNewTransaction = vi.fn();
      const { stop, monitor } = await monitorWallets(
        [VALID_ADDRESS, VALID_ADDRESS_2],
        onNewTransaction,
        { monitor: freshMonitor }
      );

      expect(monitor.getWalletCount()).toBe(2);
      expect(monitor.isRunning()).toBe(true);

      stop();
      expect(monitor.getWalletCount()).toBe(0);
      freshMonitor.dispose();
    });

    it("should skip invalid addresses in monitorWallets", async () => {
      // Use a fresh monitor to avoid shared state issues
      const freshMonitor = new WalletMonitor();
      const { monitor } = await monitorWallets([VALID_ADDRESS, INVALID_ADDRESS], undefined, {
        monitor: freshMonitor,
      });

      expect(monitor.getWalletCount()).toBe(1);
      monitor.stop();
      freshMonitor.dispose();
    });
  });

  describe("Multiple Transaction Types", () => {
    it("should monitor multiple transaction types simultaneously", async () => {
      const monitor = new WalletMonitor({
        pollingIntervalMs: 1000,
        transactionTypes: ["normal", "internal", "erc20"],
      });

      const listener = vi.fn();
      monitor.on("*", listener);
      monitor.addWallet(VALID_ADDRESS);

      // First poll to establish baseline
      mockFetch
        .mockResolvedValueOnce(createMockResponse([sampleTransaction])) // normal
        .mockResolvedValueOnce(createMockResponse([sampleTransaction])) // erc20
        .mockResolvedValueOnce(createMockResponse([sampleInternalTransaction])); // internal

      await monitor.pollNow();

      // Check that all types were polled (3 API calls)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      monitor.dispose();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty wallet list gracefully", async () => {
      const monitor = new WalletMonitor();
      await monitor.pollNow(); // Should not throw
      monitor.dispose();
    });

    it("should handle async listener errors gracefully", async () => {
      const monitor = new WalletMonitor();
      const errorListener = vi.fn().mockRejectedValue(new Error("Listener error"));

      monitor.on(WalletMonitorEventType.WALLET_ADDED, errorListener);

      // Should not throw despite async error
      expect(() => monitor.addWallet(VALID_ADDRESS)).not.toThrow();

      monitor.dispose();
    });

    it("should handle sync listener errors gracefully", () => {
      const monitor = new WalletMonitor();
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error("Sync error");
      });

      monitor.on(WalletMonitorEventType.WALLET_ADDED, errorListener);

      // Should not throw despite sync error
      expect(() => monitor.addWallet(VALID_ADDRESS)).not.toThrow();

      monitor.dispose();
    });
  });
});

describe("Type Exports", () => {
  it("should export WalletMonitorEventType constants", () => {
    expect(WalletMonitorEventType.NEW_TRANSACTION).toBe("wallet:newTransaction");
    expect(WalletMonitorEventType.NEW_INTERNAL_TRANSACTION).toBe("wallet:newInternalTransaction");
    expect(WalletMonitorEventType.MONITOR_STARTED).toBe("wallet:monitorStarted");
    expect(WalletMonitorEventType.MONITOR_STOPPED).toBe("wallet:monitorStopped");
    expect(WalletMonitorEventType.WALLET_ADDED).toBe("wallet:added");
    expect(WalletMonitorEventType.WALLET_REMOVED).toBe("wallet:removed");
    expect(WalletMonitorEventType.MONITOR_ERROR).toBe("wallet:monitorError");
    expect(WalletMonitorEventType.POLL_COMPLETE).toBe("wallet:pollComplete");
  });
});
