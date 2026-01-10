/**
 * Wallet Transaction Monitor (API-CHAIN-005)
 *
 * Set up real-time monitoring for wallet activity using polling.
 * Monitors multiple wallet addresses for new transactions and emits events.
 *
 * Features:
 * - Monitor multiple wallet addresses simultaneously
 * - Configurable polling interval
 * - Emit events for new transactions (normal, internal, ERC20)
 * - Track last known block for each wallet
 * - Support for transaction filtering
 * - Automatic retry on errors
 */

import { isAddress, getAddress } from "viem";

import {
  type WalletTransaction,
  type InternalTransaction,
  type PolygonscanConfig,
  PolygonClientError,
} from "./types";
import { PolygonscanClient, createPolygonscanClient } from "./history";

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction types to monitor
 */
export type TransactionType = "normal" | "internal" | "erc20";

/**
 * Event types emitted by the wallet monitor
 */
export const WalletMonitorEventType = {
  /** New transaction detected */
  NEW_TRANSACTION: "wallet:newTransaction",
  /** New internal transaction detected */
  NEW_INTERNAL_TRANSACTION: "wallet:newInternalTransaction",
  /** Wallet monitoring started */
  MONITOR_STARTED: "wallet:monitorStarted",
  /** Wallet monitoring stopped */
  MONITOR_STOPPED: "wallet:monitorStopped",
  /** Wallet added to monitoring */
  WALLET_ADDED: "wallet:added",
  /** Wallet removed from monitoring */
  WALLET_REMOVED: "wallet:removed",
  /** Error during monitoring */
  MONITOR_ERROR: "wallet:monitorError",
  /** Polling cycle completed */
  POLL_COMPLETE: "wallet:pollComplete",
} as const;

export type WalletMonitorEventTypeValue =
  (typeof WalletMonitorEventType)[keyof typeof WalletMonitorEventType];

/**
 * Base event interface for wallet monitor events
 */
export interface WalletMonitorEvent {
  type: WalletMonitorEventTypeValue;
  timestamp: Date;
  address?: string;
}

/**
 * New transaction event data
 */
export interface NewTransactionEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.NEW_TRANSACTION;
  address: string;
  transaction: WalletTransaction;
  transactionType: "normal" | "erc20";
}

/**
 * New internal transaction event data
 */
export interface NewInternalTransactionEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.NEW_INTERNAL_TRANSACTION;
  address: string;
  transaction: InternalTransaction;
}

/**
 * Monitor started event data
 */
export interface MonitorStartedEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.MONITOR_STARTED;
  walletCount: number;
}

/**
 * Monitor stopped event data
 */
export interface MonitorStoppedEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.MONITOR_STOPPED;
}

/**
 * Wallet added event data
 */
export interface WalletAddedEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.WALLET_ADDED;
  address: string;
}

/**
 * Wallet removed event data
 */
export interface WalletRemovedEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.WALLET_REMOVED;
  address: string;
}

/**
 * Monitor error event data
 */
export interface MonitorErrorEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.MONITOR_ERROR;
  error: Error;
  address?: string;
}

/**
 * Poll complete event data
 */
export interface PollCompleteEvent extends WalletMonitorEvent {
  type: typeof WalletMonitorEventType.POLL_COMPLETE;
  walletCount: number;
  newTransactionCount: number;
  durationMs: number;
}

/**
 * Union of all wallet monitor events
 */
export type WalletMonitorEventData =
  | NewTransactionEvent
  | NewInternalTransactionEvent
  | MonitorStartedEvent
  | MonitorStoppedEvent
  | WalletAddedEvent
  | WalletRemovedEvent
  | MonitorErrorEvent
  | PollCompleteEvent;

/**
 * Event listener function type
 */
export type WalletMonitorEventListener<T extends WalletMonitorEvent = WalletMonitorEvent> = (
  event: T
) => void | Promise<void>;

/**
 * Listener options
 */
export interface WalletMonitorListenerOptions {
  /** Only fire once then remove */
  once?: boolean;
}

/**
 * Wallet monitor configuration
 */
export interface WalletMonitorConfig {
  /** Polling interval in milliseconds (default: 15000 - 15 seconds) */
  pollingIntervalMs?: number;

  /** Transaction types to monitor (default: ["normal"]) */
  transactionTypes?: TransactionType[];

  /** Maximum transactions to fetch per wallet per poll (default: 100) */
  maxTransactionsPerPoll?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: WalletMonitorLogger;

  /** Polygonscan client configuration */
  polygonscanConfig?: PolygonscanConfig;

  /** Whether to catch and log errors without stopping (default: true) */
  catchErrors?: boolean;

  /** Initial block to start monitoring from (default: use last transaction block) */
  initialBlockNumber?: bigint;
}

/**
 * Logger interface for wallet monitor
 */
export interface WalletMonitorLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Tracked wallet state
 */
interface TrackedWallet {
  /** Normalized address */
  address: string;

  /** Last known block number for normal/erc20 transactions */
  lastBlockNumber: bigint;

  /** Last known block number for internal transactions */
  lastInternalBlockNumber: bigint;

  /** When monitoring started for this wallet */
  monitoringSince: Date;

  /** Total transactions detected */
  totalTransactionsDetected: number;
}

/**
 * Wallet monitor statistics
 */
export interface WalletMonitorStats {
  /** Whether the monitor is running */
  isRunning: boolean;

  /** Number of wallets being monitored */
  walletCount: number;

  /** Total polling cycles completed */
  totalPollCycles: number;

  /** Total transactions detected across all wallets */
  totalTransactionsDetected: number;

  /** Total errors encountered */
  totalErrors: number;

  /** Last poll timestamp */
  lastPollAt?: Date;

  /** Average poll duration in ms */
  avgPollDurationMs: number;

  /** Monitor uptime in ms (since start) */
  uptimeMs: number;
}

/**
 * Registered listener with metadata
 */
interface RegisteredListener {
  id: number;
  callback: WalletMonitorEventListener;
  eventType: WalletMonitorEventTypeValue | "*";
  options: WalletMonitorListenerOptions;
}

// ============================================================================
// Constants
// ============================================================================

/** Default polling interval: 15 seconds */
const DEFAULT_POLLING_INTERVAL_MS = 15000;

/** Default max transactions per poll */
const DEFAULT_MAX_TRANSACTIONS_PER_POLL = 100;

// ============================================================================
// WalletMonitor Class
// ============================================================================

/**
 * Wallet transaction monitor for tracking new transactions on multiple wallets
 *
 * @example
 * ```typescript
 * const monitor = new WalletMonitor();
 *
 * // Add event listener
 * monitor.on(WalletMonitorEventType.NEW_TRANSACTION, (event) => {
 *   console.log(`New tx for ${event.address}: ${event.transaction.hash}`);
 * });
 *
 * // Add wallets to monitor
 * monitor.addWallet("0x1234...");
 * monitor.addWallet("0x5678...");
 *
 * // Start monitoring
 * await monitor.start();
 *
 * // Later: stop monitoring
 * monitor.stop();
 * ```
 */
export class WalletMonitor {
  // Configuration
  private readonly config: Required<
    Omit<WalletMonitorConfig, "polygonscanConfig" | "logger" | "initialBlockNumber">
  > & {
    logger: WalletMonitorLogger;
    initialBlockNumber?: bigint;
  };

  // Polygonscan client
  private readonly polygonscanClient: PolygonscanClient;

  // Tracked wallets
  private readonly wallets: Map<string, TrackedWallet> = new Map();

  // Event listeners
  private readonly listeners: RegisteredListener[] = [];
  private listenerIdCounter = 0;

  // State
  private running = false;
  private disposed = false;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private startedAt: Date | null = null;

  // Statistics
  private totalPollCycles = 0;
  private totalTransactionsDetected = 0;
  private totalErrors = 0;
  private lastPollAt: Date | null = null;
  private totalPollDurationMs = 0;

  constructor(config: WalletMonitorConfig = {}) {
    this.config = {
      pollingIntervalMs: config.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS,
      transactionTypes: config.transactionTypes ?? ["normal"],
      maxTransactionsPerPoll: config.maxTransactionsPerPoll ?? DEFAULT_MAX_TRANSACTIONS_PER_POLL,
      debug: config.debug ?? false,
      logger: config.logger ?? console,
      catchErrors: config.catchErrors ?? true,
      initialBlockNumber: config.initialBlockNumber,
    };

    this.polygonscanClient = createPolygonscanClient(config.polygonscanConfig);
  }

  // ==========================================================================
  // Public Methods - Wallet Management
  // ==========================================================================

  /**
   * Add a wallet address to monitor
   *
   * @param address - The wallet address to monitor
   * @param startBlock - Optional block number to start monitoring from
   * @returns The normalized address that was added
   */
  addWallet(address: string, startBlock?: bigint): string {
    if (this.disposed) {
      throw new Error("WalletMonitor has been disposed");
    }

    if (!address || !isAddress(address)) {
      throw new PolygonClientError(`Invalid address: ${address}`, "INVALID_ADDRESS");
    }

    const normalizedAddress = getAddress(address);

    // Don't add if already monitoring
    if (this.wallets.has(normalizedAddress)) {
      this.debug(`Wallet ${normalizedAddress} is already being monitored`);
      return normalizedAddress;
    }

    const initialBlock = startBlock ?? this.config.initialBlockNumber ?? BigInt(0);

    const wallet: TrackedWallet = {
      address: normalizedAddress,
      lastBlockNumber: initialBlock,
      lastInternalBlockNumber: initialBlock,
      monitoringSince: new Date(),
      totalTransactionsDetected: 0,
    };

    this.wallets.set(normalizedAddress, wallet);
    this.debug(`Added wallet to monitor: ${normalizedAddress}`);

    this.emit({
      type: WalletMonitorEventType.WALLET_ADDED,
      address: normalizedAddress,
      timestamp: new Date(),
    });

    return normalizedAddress;
  }

  /**
   * Remove a wallet address from monitoring
   *
   * @param address - The wallet address to remove
   * @returns true if the wallet was removed, false if it wasn't being monitored
   */
  removeWallet(address: string): boolean {
    if (!isAddress(address)) {
      return false;
    }

    const normalizedAddress = getAddress(address);
    const removed = this.wallets.delete(normalizedAddress);

    if (removed) {
      this.debug(`Removed wallet from monitor: ${normalizedAddress}`);
      this.emit({
        type: WalletMonitorEventType.WALLET_REMOVED,
        address: normalizedAddress,
        timestamp: new Date(),
      });
    }

    return removed;
  }

  /**
   * Get all monitored wallet addresses
   */
  getMonitoredWallets(): string[] {
    return Array.from(this.wallets.keys());
  }

  /**
   * Check if a wallet is being monitored
   */
  isMonitoringWallet(address: string): boolean {
    if (!isAddress(address)) {
      return false;
    }
    return this.wallets.has(getAddress(address));
  }

  /**
   * Get the number of monitored wallets
   */
  getWalletCount(): number {
    return this.wallets.size;
  }

  // ==========================================================================
  // Public Methods - Monitor Control
  // ==========================================================================

  /**
   * Start monitoring all added wallets
   */
  async start(): Promise<void> {
    if (this.disposed) {
      throw new Error("WalletMonitor has been disposed");
    }

    if (this.running) {
      this.debug("Monitor is already running");
      return;
    }

    this.running = true;
    this.startedAt = new Date();

    this.debug(`Starting wallet monitor with ${this.wallets.size} wallets`);

    this.emit({
      type: WalletMonitorEventType.MONITOR_STARTED,
      walletCount: this.wallets.size,
      timestamp: new Date(),
    });

    // Perform initial poll to establish baseline
    await this.poll();

    // Set up polling interval
    this.pollIntervalId = setInterval(() => {
      this.poll().catch((error) => {
        this.handleError(error as Error);
      });
    }, this.config.pollingIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    this.debug("Stopped wallet monitor");

    this.emit({
      type: WalletMonitorEventType.MONITOR_STOPPED,
      timestamp: new Date(),
    });
  }

  /**
   * Check if the monitor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Force an immediate poll (doesn't wait for the regular interval)
   */
  async pollNow(): Promise<void> {
    if (this.disposed) {
      throw new Error("WalletMonitor has been disposed");
    }

    await this.poll();
  }

  // ==========================================================================
  // Public Methods - Event Listeners
  // ==========================================================================

  /**
   * Add an event listener
   *
   * @param eventType - The event type to listen for, or "*" for all events
   * @param callback - The callback function
   * @param options - Listener options
   * @returns Unsubscribe function
   */
  on<T extends WalletMonitorEvent>(
    eventType: WalletMonitorEventTypeValue | "*",
    callback: WalletMonitorEventListener<T>,
    options: WalletMonitorListenerOptions = {}
  ): () => void {
    if (this.disposed) {
      throw new Error("WalletMonitor has been disposed");
    }

    const listener: RegisteredListener = {
      id: ++this.listenerIdCounter,
      callback: callback as WalletMonitorEventListener,
      eventType,
      options,
    };

    this.listeners.push(listener);
    this.debug(`Added listener ${listener.id} for event: ${eventType}`);

    return () => this.removeListener(listener.id);
  }

  /**
   * Add a one-time event listener
   */
  once<T extends WalletMonitorEvent>(
    eventType: WalletMonitorEventTypeValue | "*",
    callback: WalletMonitorEventListener<T>
  ): () => void {
    return this.on(eventType, callback, { once: true });
  }

  /**
   * Remove a listener by ID
   */
  private removeListener(id: number): void {
    const index = this.listeners.findIndex((l) => l.id === id);
    if (index !== -1) {
      this.listeners.splice(index, 1);
      this.debug(`Removed listener ${id}`);
    }
  }

  /**
   * Remove all listeners for an event type
   */
  removeAllListeners(eventType?: WalletMonitorEventTypeValue | "*"): void {
    if (eventType) {
      const toRemove = this.listeners.filter((l) => l.eventType === eventType);
      for (const listener of toRemove) {
        this.removeListener(listener.id);
      }
    } else {
      this.listeners.length = 0;
    }
  }

  // ==========================================================================
  // Public Methods - Statistics & Utilities
  // ==========================================================================

  /**
   * Get monitor statistics
   */
  getStats(): WalletMonitorStats {
    const uptimeMs = this.startedAt ? Date.now() - this.startedAt.getTime() : 0;
    const avgPollDurationMs =
      this.totalPollCycles > 0 ? this.totalPollDurationMs / this.totalPollCycles : 0;

    return {
      isRunning: this.running,
      walletCount: this.wallets.size,
      totalPollCycles: this.totalPollCycles,
      totalTransactionsDetected: this.totalTransactionsDetected,
      totalErrors: this.totalErrors,
      lastPollAt: this.lastPollAt ?? undefined,
      avgPollDurationMs,
      uptimeMs,
    };
  }

  /**
   * Get wallet-specific statistics
   */
  getWalletStats(address: string): TrackedWallet | null {
    if (!isAddress(address)) {
      return null;
    }
    const wallet = this.wallets.get(getAddress(address));
    return wallet ? { ...wallet } : null;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalPollCycles = 0;
    this.totalTransactionsDetected = 0;
    this.totalErrors = 0;
    this.totalPollDurationMs = 0;
    this.lastPollAt = null;

    for (const wallet of this.wallets.values()) {
      wallet.totalTransactionsDetected = 0;
    }
  }

  /**
   * Dispose the monitor and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.stop();
    this.wallets.clear();
    this.listeners.length = 0;
    this.disposed = true;

    this.debug("WalletMonitor disposed");
  }

  /**
   * Check if the monitor is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Perform a polling cycle
   */
  private async poll(): Promise<void> {
    if (!this.running && this.wallets.size === 0) {
      return;
    }

    const startTime = Date.now();
    let newTransactionCount = 0;

    this.debug(`Starting poll cycle for ${this.wallets.size} wallets`);

    for (const wallet of this.wallets.values()) {
      try {
        const txCount = await this.pollWallet(wallet);
        newTransactionCount += txCount;
      } catch (error) {
        this.handleError(error as Error, wallet.address);
      }
    }

    const durationMs = Date.now() - startTime;
    this.totalPollCycles++;
    this.totalPollDurationMs += durationMs;
    this.lastPollAt = new Date();

    this.debug(
      `Poll cycle complete: ${newTransactionCount} new transactions in ${durationMs}ms`
    );

    this.emit({
      type: WalletMonitorEventType.POLL_COMPLETE,
      walletCount: this.wallets.size,
      newTransactionCount,
      durationMs,
      timestamp: new Date(),
    });
  }

  /**
   * Poll a single wallet for new transactions
   */
  private async pollWallet(wallet: TrackedWallet): Promise<number> {
    let newTxCount = 0;

    // Poll normal transactions
    if (this.config.transactionTypes.includes("normal")) {
      const normalTxs = await this.fetchNewNormalTransactions(wallet);
      newTxCount += normalTxs.length;

      for (const tx of normalTxs) {
        this.emit({
          type: WalletMonitorEventType.NEW_TRANSACTION,
          address: wallet.address,
          transaction: tx,
          transactionType: "normal",
          timestamp: new Date(),
        });
      }
    }

    // Poll ERC20 transactions
    if (this.config.transactionTypes.includes("erc20")) {
      const erc20Txs = await this.fetchNewERC20Transactions(wallet);
      newTxCount += erc20Txs.length;

      for (const tx of erc20Txs) {
        this.emit({
          type: WalletMonitorEventType.NEW_TRANSACTION,
          address: wallet.address,
          transaction: tx,
          transactionType: "erc20",
          timestamp: new Date(),
        });
      }
    }

    // Poll internal transactions
    if (this.config.transactionTypes.includes("internal")) {
      const internalTxs = await this.fetchNewInternalTransactions(wallet);
      newTxCount += internalTxs.length;

      for (const tx of internalTxs) {
        this.emit({
          type: WalletMonitorEventType.NEW_INTERNAL_TRANSACTION,
          address: wallet.address,
          transaction: tx,
          timestamp: new Date(),
        });
      }
    }

    // Update wallet statistics
    wallet.totalTransactionsDetected += newTxCount;
    this.totalTransactionsDetected += newTxCount;

    return newTxCount;
  }

  /**
   * Fetch new normal transactions since last poll
   */
  private async fetchNewNormalTransactions(wallet: TrackedWallet): Promise<WalletTransaction[]> {
    // If this is the first poll (block 0), just get the latest transactions to establish baseline
    if (wallet.lastBlockNumber === BigInt(0)) {
      const result = await this.polygonscanClient.getWalletHistory(wallet.address, {
        page: 1,
        pageSize: 1,
        sort: "desc",
      });

      if (result.transactions.length > 0) {
        wallet.lastBlockNumber = result.transactions[0]!.blockNumber;
      }

      return []; // Don't emit events on first poll
    }

    // Fetch transactions after the last known block
    const result = await this.polygonscanClient.getWalletHistory(wallet.address, {
      page: 1,
      pageSize: this.config.maxTransactionsPerPoll,
      startBlock: wallet.lastBlockNumber + BigInt(1),
      sort: "asc",
    });

    // Update last known block
    if (result.transactions.length > 0) {
      const maxBlock = result.transactions.reduce(
        (max, tx) => (tx.blockNumber > max ? tx.blockNumber : max),
        wallet.lastBlockNumber
      );
      wallet.lastBlockNumber = maxBlock;
    }

    return result.transactions;
  }

  /**
   * Fetch new ERC20 transactions since last poll
   */
  private async fetchNewERC20Transactions(wallet: TrackedWallet): Promise<WalletTransaction[]> {
    // If this is the first poll (block 0), just get the latest to establish baseline
    if (wallet.lastBlockNumber === BigInt(0)) {
      const result = await this.polygonscanClient.getWalletHistory(wallet.address, {
        page: 1,
        pageSize: 1,
        sort: "desc",
        txType: "erc20",
      });

      if (result.transactions.length > 0) {
        // Update lastBlockNumber to establish baseline
        wallet.lastBlockNumber = result.transactions[0]!.blockNumber;
      }

      return []; // Don't emit events on first poll
    }

    // Fetch transactions after the last known block
    const result = await this.polygonscanClient.getWalletHistory(wallet.address, {
      page: 1,
      pageSize: this.config.maxTransactionsPerPoll,
      startBlock: wallet.lastBlockNumber + BigInt(1),
      sort: "asc",
      txType: "erc20",
    });

    // Update last known block (if higher than current)
    if (result.transactions.length > 0) {
      const maxBlock = result.transactions.reduce(
        (max, tx) => (tx.blockNumber > max ? tx.blockNumber : max),
        wallet.lastBlockNumber
      );
      if (maxBlock > wallet.lastBlockNumber) {
        wallet.lastBlockNumber = maxBlock;
      }
    }

    return result.transactions;
  }

  /**
   * Fetch new internal transactions since last poll
   */
  private async fetchNewInternalTransactions(
    wallet: TrackedWallet
  ): Promise<InternalTransaction[]> {
    // If this is the first poll (block 0), just get the latest to establish baseline
    if (wallet.lastInternalBlockNumber === BigInt(0)) {
      const result = await this.polygonscanClient.getInternalTransactions(wallet.address, {
        page: 1,
        pageSize: 1,
        sort: "desc",
      });

      if (result.length > 0) {
        wallet.lastInternalBlockNumber = result[0]!.blockNumber;
      }

      return []; // Don't emit events on first poll
    }

    // Fetch transactions after the last known block
    const result = await this.polygonscanClient.getInternalTransactions(wallet.address, {
      page: 1,
      pageSize: this.config.maxTransactionsPerPoll,
      startBlock: wallet.lastInternalBlockNumber + BigInt(1),
      sort: "asc",
    });

    // Update last known block
    if (result.length > 0) {
      const maxBlock = result.reduce(
        (max, tx) => (tx.blockNumber > max ? tx.blockNumber : max),
        wallet.lastInternalBlockNumber
      );
      wallet.lastInternalBlockNumber = maxBlock;
    }

    return result;
  }

  /**
   * Emit an event to all matching listeners
   */
  private emit(event: WalletMonitorEventData): void {
    const listenersToRemove: number[] = [];

    for (const listener of this.listeners) {
      // Check if listener matches this event type
      if (listener.eventType !== "*" && listener.eventType !== event.type) {
        continue;
      }

      try {
        const result = listener.callback(event);

        // Handle async listeners
        if (result instanceof Promise) {
          result.catch((error) => {
            this.config.logger.warn(`Async listener error: ${(error as Error).message}`);
          });
        }

        // Mark for removal if once
        if (listener.options.once) {
          listenersToRemove.push(listener.id);
        }
      } catch (error) {
        this.config.logger.warn(`Listener error: ${(error as Error).message}`);
      }
    }

    // Remove once listeners
    for (const id of listenersToRemove) {
      this.removeListener(id);
    }
  }

  /**
   * Handle an error during polling
   */
  private handleError(error: Error, address?: string): void {
    this.totalErrors++;

    if (this.config.catchErrors) {
      this.config.logger.error(`Monitor error: ${error.message}`, { address });

      this.emit({
        type: WalletMonitorEventType.MONITOR_ERROR,
        error,
        address,
        timestamp: new Date(),
      });
    } else {
      throw error;
    }
  }

  /**
   * Log debug message
   */
  private debug(message: string): void {
    if (this.config.debug) {
      this.config.logger.debug(`[WalletMonitor] ${message}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new WalletMonitor instance
 */
export function createWalletMonitor(config?: WalletMonitorConfig): WalletMonitor {
  return new WalletMonitor(config);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedMonitor: WalletMonitor | null = null;

/**
 * Get the shared WalletMonitor instance
 */
export function getSharedWalletMonitor(): WalletMonitor {
  if (!sharedMonitor) {
    sharedMonitor = new WalletMonitor();
  }
  return sharedMonitor;
}

/**
 * Set the shared WalletMonitor instance
 */
export function setSharedWalletMonitor(monitor: WalletMonitor): void {
  sharedMonitor = monitor;
}

/**
 * Reset the shared WalletMonitor instance
 */
export function resetSharedWalletMonitor(): void {
  if (sharedMonitor) {
    sharedMonitor.dispose();
  }
  sharedMonitor = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Start monitoring a wallet address (using shared monitor)
 */
export async function startMonitoringWallet(
  address: string,
  onNewTransaction?: WalletMonitorEventListener<NewTransactionEvent>,
  options?: {
    monitor?: WalletMonitor;
    transactionTypes?: TransactionType[];
  }
): Promise<{ stop: () => void; monitor: WalletMonitor }> {
  const monitor = options?.monitor ?? getSharedWalletMonitor();

  // Configure transaction types if provided
  if (options?.transactionTypes) {
    // Can't reconfigure shared monitor, but we add the wallet
  }

  // Add event listener if provided
  let unsubscribe: (() => void) | undefined;
  if (onNewTransaction) {
    unsubscribe = monitor.on(WalletMonitorEventType.NEW_TRANSACTION, onNewTransaction);
  }

  // Add wallet
  monitor.addWallet(address);

  // Start monitor if not already running
  if (!monitor.isRunning()) {
    await monitor.start();
  }

  return {
    stop: () => {
      monitor.removeWallet(address);
      if (unsubscribe) {
        unsubscribe();
      }
    },
    monitor,
  };
}

/**
 * Monitor multiple wallets (using shared monitor)
 */
export async function monitorWallets(
  addresses: string[],
  onNewTransaction?: WalletMonitorEventListener<NewTransactionEvent>,
  options?: {
    monitor?: WalletMonitor;
  }
): Promise<{ stop: () => void; monitor: WalletMonitor }> {
  const monitor = options?.monitor ?? getSharedWalletMonitor();

  // Add event listener if provided
  let unsubscribe: (() => void) | undefined;
  if (onNewTransaction) {
    unsubscribe = monitor.on(WalletMonitorEventType.NEW_TRANSACTION, onNewTransaction);
  }

  // Add wallets
  const addedAddresses: string[] = [];
  for (const address of addresses) {
    try {
      const normalizedAddress = monitor.addWallet(address);
      addedAddresses.push(normalizedAddress);
    } catch {
      // Skip invalid addresses
    }
  }

  // Start monitor if not already running
  if (!monitor.isRunning()) {
    await monitor.start();
  }

  return {
    stop: () => {
      for (const address of addedAddresses) {
        monitor.removeWallet(address);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    },
    monitor,
  };
}
