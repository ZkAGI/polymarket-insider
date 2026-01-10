/**
 * USDC Transfer Tracker API (API-CHAIN-007)
 *
 * Monitor USDC deposits from wallets to Polymarket contracts.
 * Features:
 * - Identify Polymarket contract addresses
 * - Filter USDC transfers
 * - Track deposit amounts
 * - Emit deposit events
 * - Real-time monitoring support
 */

import { isAddress, getAddress } from "viem";
import { EventEmitter } from "events";

import { POLYMARKET_CONTRACTS } from "./contract-decoder";
import { PolygonClientError, type WalletTransaction } from "./types";
import { PolygonscanClient, getSharedPolygonscanClient } from "./history";

// ============================================================================
// Constants
// ============================================================================

/** USDC token addresses on Polygon */
export const USDC_ADDRESSES = {
  /** Native USDC on Polygon */
  USDC: POLYMARKET_CONTRACTS.USDC,
  /** Bridged USDC.e on Polygon */
  USDC_E: POLYMARKET_CONTRACTS.USDC_E,
} as const;

/** Known Polymarket contract addresses that receive USDC deposits */
export const POLYMARKET_DEPOSIT_CONTRACTS = {
  /** CTF Exchange - main trading contract */
  CTF_EXCHANGE: POLYMARKET_CONTRACTS.CTF_EXCHANGE,
  /** NegRisk CTF Exchange - for negative risk markets */
  NEG_RISK_CTF_EXCHANGE: POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE,
  /** Conditional Tokens contract */
  CONDITIONAL_TOKENS: POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS,
  /** Polymarket Router */
  ROUTER: POLYMARKET_CONTRACTS.ROUTER,
} as const;

/** ERC20 Transfer event topic */
export const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** ERC20 transfer function selector */
const TRANSFER_SELECTOR = "0xa9059cbb";

/** ERC20 transferFrom function selector */
const TRANSFER_FROM_SELECTOR = "0x23b872dd";

/** USDC decimals */
const USDC_DECIMALS = 6;

// ============================================================================
// Types
// ============================================================================

/**
 * USDC token type
 */
export type USDCTokenType = "USDC" | "USDC.e";

/**
 * Transfer direction relative to Polymarket
 */
export type TransferDirection = "deposit" | "withdrawal";

/**
 * USDC transfer event data
 */
export interface USDCTransfer {
  /** Transaction hash */
  transactionHash: string;

  /** Block number */
  blockNumber: bigint;

  /** Block timestamp */
  timestamp: number;

  /** Sender address */
  from: string;

  /** Recipient address */
  to: string;

  /** Raw amount in smallest units (6 decimals) */
  amount: bigint;

  /** Formatted amount in USDC */
  formattedAmount: string;

  /** USD value (1:1 for USDC) */
  usdValue: string;

  /** USDC token type */
  tokenType: USDCTokenType;

  /** Token contract address */
  tokenAddress: string;

  /** Transfer direction (deposit or withdrawal) */
  direction: TransferDirection;

  /** Polymarket contract name if applicable */
  polymarketContract?: string;

  /** Whether this is a Polymarket deposit */
  isPolymarketDeposit: boolean;

  /** Whether this is a Polymarket withdrawal */
  isPolymarketWithdrawal: boolean;
}

/**
 * Deposit summary for a wallet
 */
export interface WalletDepositSummary {
  /** Wallet address */
  walletAddress: string;

  /** Total deposited amount (raw) */
  totalDeposited: bigint;

  /** Total deposited formatted */
  totalDepositedFormatted: string;

  /** Total withdrawn amount (raw) */
  totalWithdrawn: bigint;

  /** Total withdrawn formatted */
  totalWithdrawnFormatted: string;

  /** Net position (deposits - withdrawals) */
  netPosition: bigint;

  /** Net position formatted */
  netPositionFormatted: string;

  /** Number of deposits */
  depositCount: number;

  /** Number of withdrawals */
  withdrawalCount: number;

  /** Individual transfers */
  transfers: USDCTransfer[];

  /** First deposit timestamp */
  firstDepositTimestamp?: number;

  /** Last deposit timestamp */
  lastDepositTimestamp?: number;

  /** Average deposit size */
  averageDepositSize: string;
}

/**
 * Deposit event types
 */
export type USDCTrackerEventType =
  | "deposit"
  | "withdrawal"
  | "largeDeposit"
  | "largeWithdrawal"
  | "error";

/**
 * Deposit event
 */
export interface USDCTrackerEvent {
  type: USDCTrackerEventType;
  transfer?: USDCTransfer;
  error?: Error;
  timestamp: Date;
}

/**
 * Event listener function
 */
export type USDCTrackerEventListener = (event: USDCTrackerEvent) => void;

/**
 * USDC tracker configuration
 */
export interface USDCTrackerConfig {
  /** Polygonscan client for fetching transactions */
  polygonscanClient?: PolygonscanClient;

  /** Large deposit threshold in USDC (default: 10000) */
  largeDepositThreshold?: number;

  /** Large withdrawal threshold in USDC (default: 10000) */
  largeWithdrawalThreshold?: number;

  /** Include USDC.e transfers (default: true) */
  includeUsdcE?: boolean;

  /** Additional Polymarket contract addresses to monitor */
  additionalContracts?: Record<string, string>;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: USDCTrackerLogger;
}

/**
 * Logger interface
 */
export interface USDCTrackerLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// ============================================================================
// USDC Tracker Class
// ============================================================================

/**
 * Tracker for USDC transfers to/from Polymarket contracts
 */
export class USDCTracker extends EventEmitter {
  private readonly config: Required<
    Omit<USDCTrackerConfig, "polygonscanClient" | "additionalContracts">
  > & {
    polygonscanClient?: PolygonscanClient;
    additionalContracts: Record<string, string>;
  };
  private readonly logger: USDCTrackerLogger;
  private readonly polymarketContracts: Map<string, string>;
  private readonly usdcAddresses: Set<string>;

  constructor(config: USDCTrackerConfig = {}) {
    super();

    const debug = config.debug ?? false;
    this.config = {
      polygonscanClient: config.polygonscanClient,
      largeDepositThreshold: config.largeDepositThreshold ?? 10000,
      largeWithdrawalThreshold: config.largeWithdrawalThreshold ?? 10000,
      includeUsdcE: config.includeUsdcE ?? true,
      additionalContracts: config.additionalContracts ?? {},
      debug,
      logger: config.logger ?? this.createDefaultLogger(debug),
    };

    this.logger = this.config.logger;

    // Initialize Polymarket contract lookup (lowercase for case-insensitive matching)
    this.polymarketContracts = new Map();
    for (const [name, address] of Object.entries(POLYMARKET_DEPOSIT_CONTRACTS)) {
      this.polymarketContracts.set(address.toLowerCase(), name);
    }
    for (const [name, address] of Object.entries(this.config.additionalContracts)) {
      this.polymarketContracts.set(address.toLowerCase(), name);
    }

    // Initialize USDC address lookup
    this.usdcAddresses = new Set([USDC_ADDRESSES.USDC.toLowerCase()]);
    if (this.config.includeUsdcE) {
      this.usdcAddresses.add(USDC_ADDRESSES.USDC_E.toLowerCase());
    }
  }

  /**
   * Get USDC transfers for a wallet
   */
  async getWalletTransfers(
    walletAddress: string,
    options: {
      startBlock?: bigint;
      endBlock?: bigint;
      pageSize?: number;
    } = {}
  ): Promise<USDCTransfer[]> {
    if (!walletAddress || !isAddress(walletAddress)) {
      throw new PolygonClientError(
        `Invalid wallet address: ${walletAddress}`,
        "INVALID_ADDRESS"
      );
    }

    const normalizedAddress = getAddress(walletAddress);
    const client = this.config.polygonscanClient ?? getSharedPolygonscanClient();

    // Fetch ERC20 token transfers
    const transfers: USDCTransfer[] = [];

    try {
      // Fetch transfers using the tokentx endpoint
      const result = await client.getWalletHistory(normalizedAddress, {
        txType: "erc20",
        startBlock: options.startBlock,
        endBlock: options.endBlock,
        pageSize: options.pageSize ?? 1000,
        sort: "desc",
      });

      // Parse and filter USDC transfers
      for (const tx of result.transactions) {
        const transfer = this.parseERC20Transfer(tx, normalizedAddress);
        if (transfer) {
          transfers.push(transfer);
        }
      }

      // Fetch more pages if needed
      let hasMore = result.hasMore;
      let page = 2;
      const maxPages = 100; // Safety limit

      while (hasMore && page <= maxPages) {
        const nextResult = await client.getWalletHistory(normalizedAddress, {
          txType: "erc20",
          startBlock: options.startBlock,
          endBlock: options.endBlock,
          pageSize: options.pageSize ?? 1000,
          page,
          sort: "desc",
        });

        for (const tx of nextResult.transactions) {
          const transfer = this.parseERC20Transfer(tx, normalizedAddress);
          if (transfer) {
            transfers.push(transfer);
          }
        }

        hasMore = nextResult.hasMore;
        page++;
      }
    } catch (error) {
      this.logger.error("Failed to fetch USDC transfers", error);
      throw error;
    }

    return transfers;
  }

  /**
   * Get Polymarket deposits for a wallet
   */
  async getPolymarketDeposits(
    walletAddress: string,
    options: {
      startBlock?: bigint;
      endBlock?: bigint;
    } = {}
  ): Promise<USDCTransfer[]> {
    const transfers = await this.getWalletTransfers(walletAddress, options);
    return transfers.filter((t) => t.isPolymarketDeposit);
  }

  /**
   * Get Polymarket withdrawals for a wallet
   */
  async getPolymarketWithdrawals(
    walletAddress: string,
    options: {
      startBlock?: bigint;
      endBlock?: bigint;
    } = {}
  ): Promise<USDCTransfer[]> {
    const transfers = await this.getWalletTransfers(walletAddress, options);
    return transfers.filter((t) => t.isPolymarketWithdrawal);
  }

  /**
   * Get deposit summary for a wallet
   */
  async getDepositSummary(
    walletAddress: string,
    options: {
      startBlock?: bigint;
      endBlock?: bigint;
    } = {}
  ): Promise<WalletDepositSummary> {
    if (!walletAddress || !isAddress(walletAddress)) {
      throw new PolygonClientError(
        `Invalid wallet address: ${walletAddress}`,
        "INVALID_ADDRESS"
      );
    }

    const normalizedAddress = getAddress(walletAddress);
    const transfers = await this.getWalletTransfers(normalizedAddress, options);

    // Filter to only Polymarket-related transfers
    const polymarketTransfers = transfers.filter(
      (t) => t.isPolymarketDeposit || t.isPolymarketWithdrawal
    );

    // Calculate summary
    let totalDeposited = 0n;
    let totalWithdrawn = 0n;
    let depositCount = 0;
    let withdrawalCount = 0;
    let firstDepositTimestamp: number | undefined;
    let lastDepositTimestamp: number | undefined;

    for (const transfer of polymarketTransfers) {
      if (transfer.isPolymarketDeposit) {
        totalDeposited += transfer.amount;
        depositCount++;

        if (!firstDepositTimestamp || transfer.timestamp < firstDepositTimestamp) {
          firstDepositTimestamp = transfer.timestamp;
        }
        if (!lastDepositTimestamp || transfer.timestamp > lastDepositTimestamp) {
          lastDepositTimestamp = transfer.timestamp;
        }
      } else if (transfer.isPolymarketWithdrawal) {
        totalWithdrawn += transfer.amount;
        withdrawalCount++;
      }
    }

    const netPosition = totalDeposited - totalWithdrawn;
    const averageDepositSize =
      depositCount > 0
        ? this.formatUSDC(totalDeposited / BigInt(depositCount))
        : "0.00";

    return {
      walletAddress: normalizedAddress,
      totalDeposited,
      totalDepositedFormatted: this.formatUSDC(totalDeposited),
      totalWithdrawn,
      totalWithdrawnFormatted: this.formatUSDC(totalWithdrawn),
      netPosition,
      netPositionFormatted: this.formatUSDC(netPosition),
      depositCount,
      withdrawalCount,
      transfers: polymarketTransfers,
      firstDepositTimestamp,
      lastDepositTimestamp,
      averageDepositSize,
    };
  }

  /**
   * Check if an address is a Polymarket deposit contract
   */
  isPolymarketContract(address: string): boolean {
    if (!address) return false;
    return this.polymarketContracts.has(address.toLowerCase());
  }

  /**
   * Get Polymarket contract name
   */
  getPolymarketContractName(address: string): string | undefined {
    if (!address) return undefined;
    return this.polymarketContracts.get(address.toLowerCase());
  }

  /**
   * Check if an address is a USDC token contract
   */
  isUSDCContract(address: string): boolean {
    if (!address) return false;
    return this.usdcAddresses.has(address.toLowerCase());
  }

  /**
   * Get USDC token type from address
   */
  getUSDCTokenType(address: string): USDCTokenType | undefined {
    if (!address) return undefined;
    const lowerAddress = address.toLowerCase();

    if (lowerAddress === USDC_ADDRESSES.USDC.toLowerCase()) {
      return "USDC";
    }
    if (lowerAddress === USDC_ADDRESSES.USDC_E.toLowerCase()) {
      return "USDC.e";
    }
    return undefined;
  }

  /**
   * Process a transfer and emit events if applicable
   */
  processTransfer(transfer: USDCTransfer): void {
    // Emit deposit event
    if (transfer.isPolymarketDeposit) {
      this.emit("deposit", { type: "deposit", transfer, timestamp: new Date() });

      // Check for large deposit
      const amountUSD = Number(transfer.formattedAmount);
      if (amountUSD >= this.config.largeDepositThreshold) {
        this.emit("largeDeposit", {
          type: "largeDeposit",
          transfer,
          timestamp: new Date(),
        });
      }
    }

    // Emit withdrawal event
    if (transfer.isPolymarketWithdrawal) {
      this.emit("withdrawal", {
        type: "withdrawal",
        transfer,
        timestamp: new Date(),
      });

      // Check for large withdrawal
      const amountUSD = Number(transfer.formattedAmount);
      if (amountUSD >= this.config.largeWithdrawalThreshold) {
        this.emit("largeWithdrawal", {
          type: "largeWithdrawal",
          transfer,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Format USDC amount
   */
  formatUSDC(amount: bigint): string {
    const isNegative = amount < 0n;
    const absAmount = isNegative ? -amount : amount;
    const whole = absAmount / BigInt(10 ** USDC_DECIMALS);
    const fraction = absAmount % BigInt(10 ** USDC_DECIMALS);
    const fractionStr = fraction.toString().padStart(USDC_DECIMALS, "0");

    // Remove trailing zeros but keep at least 2 decimal places
    let trimmedFraction = fractionStr.replace(/0+$/, "");
    if (trimmedFraction.length < 2) {
      trimmedFraction = fractionStr.slice(0, 2);
    }

    const sign = isNegative ? "-" : "";
    return `${sign}${whole}.${trimmedFraction}`;
  }

  /**
   * Parse USDC amount from string
   */
  parseUSDC(amount: string): bigint {
    const parts = amount.split(".");
    const whole = BigInt(parts[0] || "0");
    let fraction = parts[1] || "0";

    // Pad or truncate to 6 decimals
    if (fraction.length < USDC_DECIMALS) {
      fraction = fraction.padEnd(USDC_DECIMALS, "0");
    } else if (fraction.length > USDC_DECIMALS) {
      fraction = fraction.slice(0, USDC_DECIMALS);
    }

    return whole * BigInt(10 ** USDC_DECIMALS) + BigInt(fraction);
  }

  /**
   * Get tracker statistics
   */
  getStats(): {
    largeDepositThreshold: number;
    largeWithdrawalThreshold: number;
    monitoredContractCount: number;
    includesUsdcE: boolean;
  } {
    return {
      largeDepositThreshold: this.config.largeDepositThreshold,
      largeWithdrawalThreshold: this.config.largeWithdrawalThreshold,
      monitoredContractCount: this.polymarketContracts.size,
      includesUsdcE: this.config.includeUsdcE,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Parse ERC20 transfer from wallet transaction
   */
  private parseERC20Transfer(
    tx: WalletTransaction,
    walletAddress: string
  ): USDCTransfer | null {
    // Check if this is a USDC transfer
    const contractAddress = tx.contractAddress ?? tx.to;
    if (!contractAddress || !this.isUSDCContract(contractAddress)) {
      return null;
    }

    const tokenType = this.getUSDCTokenType(contractAddress);
    if (!tokenType) return null;

    // Parse transfer data from input
    const transferData = this.parseTransferInput(tx.input, tx.from, tx.to);
    if (!transferData) {
      // If we can't parse from input, try to infer from transaction structure
      // This handles cases where we're looking at a token transfer event
      // For ERC20 token tx endpoint, the 'from' and 'to' are the transfer participants
      // and 'contractAddress' is the token contract
      const from = tx.from.toLowerCase();
      const to = tx.to?.toLowerCase() ?? "";
      const normalizedWallet = walletAddress.toLowerCase();

      // Determine direction based on wallet involvement
      const isOutgoing = from === normalizedWallet;
      const isIncoming = to === normalizedWallet;

      if (!isOutgoing && !isIncoming) {
        return null;
      }

      // Use the transaction value as amount (for ERC20 transfers)
      const amount = tx.value;

      const isPolymarketDeposit = isOutgoing && this.isPolymarketContract(to);
      const isPolymarketWithdrawal = isIncoming && this.isPolymarketContract(from);

      return {
        transactionHash: tx.hash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        from: getAddress(tx.from),
        to: tx.to ? getAddress(tx.to) : "",
        amount,
        formattedAmount: this.formatUSDC(amount),
        usdValue: this.formatUSDC(amount),
        tokenType,
        tokenAddress: getAddress(contractAddress),
        direction: isOutgoing ? "deposit" : "withdrawal",
        polymarketContract: isPolymarketDeposit
          ? this.getPolymarketContractName(to)
          : isPolymarketWithdrawal
            ? this.getPolymarketContractName(from)
            : undefined,
        isPolymarketDeposit,
        isPolymarketWithdrawal,
      };
    }

    // We have parsed transfer data
    const { from, to, amount } = transferData;
    const normalizedWallet = walletAddress.toLowerCase();
    const isOutgoing = from.toLowerCase() === normalizedWallet;
    const isIncoming = to.toLowerCase() === normalizedWallet;

    if (!isOutgoing && !isIncoming) {
      return null;
    }

    const isPolymarketDeposit = isOutgoing && this.isPolymarketContract(to);
    const isPolymarketWithdrawal = isIncoming && this.isPolymarketContract(from);

    return {
      transactionHash: tx.hash,
      blockNumber: tx.blockNumber,
      timestamp: tx.timestamp,
      from: getAddress(from),
      to: getAddress(to),
      amount,
      formattedAmount: this.formatUSDC(amount),
      usdValue: this.formatUSDC(amount),
      tokenType,
      tokenAddress: getAddress(contractAddress),
      direction: isOutgoing ? "deposit" : "withdrawal",
      polymarketContract: isPolymarketDeposit
        ? this.getPolymarketContractName(to)
        : isPolymarketWithdrawal
          ? this.getPolymarketContractName(from)
          : undefined,
      isPolymarketDeposit,
      isPolymarketWithdrawal,
    };
  }

  /**
   * Parse transfer function input data
   */
  private parseTransferInput(
    input: string,
    txFrom: string,
    _txTo: string | null
  ): { from: string; to: string; amount: bigint } | null {
    if (!input || input.length < 10) {
      return null;
    }

    const selector = input.slice(0, 10).toLowerCase();

    // transfer(address,uint256)
    if (selector === TRANSFER_SELECTOR) {
      if (input.length < 138) return null; // 10 + 64 + 64

      const toWord = input.slice(10, 74);
      const amountWord = input.slice(74, 138);

      const to = "0x" + toWord.slice(24);
      if (!isAddress(to)) return null;

      const amount = BigInt("0x" + amountWord);

      return {
        from: txFrom,
        to,
        amount,
      };
    }

    // transferFrom(address,address,uint256)
    if (selector === TRANSFER_FROM_SELECTOR) {
      if (input.length < 202) return null; // 10 + 64 + 64 + 64

      const fromWord = input.slice(10, 74);
      const toWord = input.slice(74, 138);
      const amountWord = input.slice(138, 202);

      const from = "0x" + fromWord.slice(24);
      const to = "0x" + toWord.slice(24);
      if (!isAddress(from) || !isAddress(to)) return null;

      const amount = BigInt("0x" + amountWord);

      return {
        from,
        to,
        amount,
      };
    }

    return null;
  }

  private createDefaultLogger(debug: boolean): USDCTrackerLogger {
    const noop = () => {};
    return {
      debug: debug ? console.log.bind(console, "[USDCTracker]") : noop,
      info: console.log.bind(console, "[USDCTracker]"),
      warn: console.warn.bind(console, "[USDCTracker]"),
      error: console.error.bind(console, "[USDCTracker]"),
    };
  }
}

// ============================================================================
// Singleton Management and Convenience Functions
// ============================================================================

let sharedTracker: USDCTracker | null = null;

/**
 * Create a new USDCTracker instance
 */
export function createUSDCTracker(config?: USDCTrackerConfig): USDCTracker {
  return new USDCTracker(config);
}

/**
 * Get the shared USDCTracker instance
 */
export function getSharedUSDCTracker(): USDCTracker {
  if (!sharedTracker) {
    sharedTracker = new USDCTracker();
  }
  return sharedTracker;
}

/**
 * Set the shared USDCTracker instance
 */
export function setSharedUSDCTracker(tracker: USDCTracker): void {
  sharedTracker = tracker;
}

/**
 * Reset the shared USDCTracker instance
 */
export function resetSharedUSDCTracker(): void {
  sharedTracker = null;
}

/**
 * Get USDC transfers for a wallet (convenience function)
 */
export async function getUSDCTransfers(
  walletAddress: string,
  options?: {
    startBlock?: bigint;
    endBlock?: bigint;
    tracker?: USDCTracker;
  }
): Promise<USDCTransfer[]> {
  const tracker = options?.tracker ?? getSharedUSDCTracker();
  return tracker.getWalletTransfers(walletAddress, options);
}

/**
 * Get Polymarket deposits for a wallet (convenience function)
 */
export async function getPolymarketDeposits(
  walletAddress: string,
  options?: {
    startBlock?: bigint;
    endBlock?: bigint;
    tracker?: USDCTracker;
  }
): Promise<USDCTransfer[]> {
  const tracker = options?.tracker ?? getSharedUSDCTracker();
  return tracker.getPolymarketDeposits(walletAddress, options);
}

/**
 * Get Polymarket withdrawals for a wallet (convenience function)
 */
export async function getPolymarketWithdrawals(
  walletAddress: string,
  options?: {
    startBlock?: bigint;
    endBlock?: bigint;
    tracker?: USDCTracker;
  }
): Promise<USDCTransfer[]> {
  const tracker = options?.tracker ?? getSharedUSDCTracker();
  return tracker.getPolymarketWithdrawals(walletAddress, options);
}

/**
 * Get deposit summary for a wallet (convenience function)
 */
export async function getWalletDepositSummary(
  walletAddress: string,
  options?: {
    startBlock?: bigint;
    endBlock?: bigint;
    tracker?: USDCTracker;
  }
): Promise<WalletDepositSummary> {
  const tracker = options?.tracker ?? getSharedUSDCTracker();
  return tracker.getDepositSummary(walletAddress, options);
}

/**
 * Check if an address is a Polymarket deposit contract (convenience function)
 */
export function isPolymarketDepositContract(
  address: string,
  tracker?: USDCTracker
): boolean {
  const actualTracker = tracker ?? getSharedUSDCTracker();
  return actualTracker.isPolymarketContract(address);
}

/**
 * Check if an address is a USDC token contract (convenience function)
 */
export function isUSDCTokenContract(
  address: string,
  tracker?: USDCTracker
): boolean {
  const actualTracker = tracker ?? getSharedUSDCTracker();
  return actualTracker.isUSDCContract(address);
}

/**
 * Format USDC amount (convenience function)
 */
export function formatUSDCAmount(amount: bigint): string {
  const tracker = getSharedUSDCTracker();
  return tracker.formatUSDC(amount);
}

/**
 * Parse USDC amount string to bigint (convenience function)
 */
export function parseUSDCAmount(amount: string): bigint {
  const tracker = getSharedUSDCTracker();
  return tracker.parseUSDC(amount);
}
