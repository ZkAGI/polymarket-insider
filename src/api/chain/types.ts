/**
 * Types for Polygon Chain API (API-CHAIN-001)
 *
 * Type definitions for blockchain interactions on the Polygon network.
 */

import type { Chain } from "viem";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * RPC endpoint configuration
 */
export interface RpcEndpointConfig {
  /** RPC URL */
  url: string;

  /** Optional name for logging */
  name?: string;

  /** Priority for fallback ordering (lower = higher priority) */
  priority?: number;

  /** Whether this endpoint is enabled */
  enabled?: boolean;

  /** Rate limit (requests per second) */
  rateLimit?: number;

  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Polygon client configuration
 */
export interface PolygonClientConfig {
  /** Primary RPC endpoints (supports multiple for failover) */
  rpcEndpoints?: RpcEndpointConfig[];

  /** Chain configuration (defaults to Polygon mainnet) */
  chain?: Chain;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Maximum number of retries (default: 3) */
  maxRetries?: number;

  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: PolygonClientLogger;

  /** Batch request settings */
  batch?: {
    /** Enable batch requests (default: true) */
    enabled?: boolean;
    /** Maximum batch size (default: 10) */
    maxSize?: number;
    /** Batch wait time in ms (default: 50) */
    wait?: number;
  };

  /** Polling interval for subscriptions in ms (default: 4000) */
  pollingInterval?: number;
}

/**
 * Logger interface for the Polygon client
 */
export interface PolygonClientLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Connection state for the client
 */
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

/**
 * Connection event types
 */
export type ConnectionEventType =
  | "connect"
  | "disconnect"
  | "reconnect"
  | "error"
  | "stateChange"
  | "endpointSwitch";

/**
 * Connection event data
 */
export interface ConnectionEvent {
  type: ConnectionEventType;
  timestamp: Date;
  endpointUrl?: string;
  error?: Error;
  previousState?: ConnectionState;
  currentState?: ConnectionState;
}

/**
 * Endpoint health status
 */
export interface EndpointHealth {
  url: string;
  name?: string;
  isHealthy: boolean;
  lastChecked: Date;
  lastSuccessful?: Date;
  lastError?: Error;
  latency?: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
}

// ============================================================================
// Block and Transaction Types
// ============================================================================

/**
 * Basic block information
 */
export interface BlockInfo {
  number: bigint;
  hash: string;
  timestamp: bigint;
  parentHash: string;
  nonce: string | null;
  sha3Uncles: string;
  logsBloom: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: bigint;
  totalDifficulty: bigint | null;
  extraData: string;
  size: bigint;
  gasLimit: bigint;
  gasUsed: bigint;
  baseFeePerGas: bigint | null;
  transactions: string[] | TransactionInfo[];
  uncles: string[];
}

/**
 * Transaction information
 */
export interface TransactionInfo {
  hash: string;
  nonce: number;
  blockHash: string | null;
  blockNumber: bigint | null;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  value: bigint;
  gasPrice: bigint | null;
  gas: bigint;
  input: string;
  v?: bigint;
  r?: string;
  s?: string;
  type: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

/**
 * Transaction receipt
 */
export interface TransactionReceipt {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: bigint;
  from: string;
  to: string | null;
  cumulativeGasUsed: bigint;
  effectiveGasPrice: bigint;
  gasUsed: bigint;
  contractAddress: string | null;
  logs: LogEntry[];
  logsBloom: string;
  status: "success" | "reverted";
  type: string;
}

/**
 * Log entry from a transaction
 */
export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: bigint;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Client statistics
 */
export interface ClientStats {
  /** Total number of requests made */
  totalRequests: number;

  /** Number of successful requests */
  successfulRequests: number;

  /** Number of failed requests */
  failedRequests: number;

  /** Number of retries */
  retries: number;

  /** Number of endpoint switches */
  endpointSwitches: number;

  /** Average request latency in ms */
  averageLatency: number;

  /** Current connection state */
  connectionState: ConnectionState;

  /** Active endpoint URL */
  activeEndpoint?: string;

  /** Endpoint health status */
  endpointHealth: EndpointHealth[];

  /** Client uptime in ms */
  uptime: number;

  /** Last successful request timestamp */
  lastSuccessfulRequest?: Date;

  /** Last error */
  lastError?: Error;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Polygon client error codes
 */
export type PolygonClientErrorCode =
  | "CONNECTION_FAILED"
  | "REQUEST_TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE"
  | "RPC_ERROR"
  | "ALL_ENDPOINTS_FAILED"
  | "INVALID_ADDRESS"
  | "INVALID_BLOCK"
  | "INVALID_TRANSACTION"
  | "CONTRACT_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Polygon client error
 */
export class PolygonClientError extends Error {
  readonly code: PolygonClientErrorCode;
  readonly endpoint?: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: PolygonClientErrorCode,
    options?: {
      endpoint?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "PolygonClientError";
    this.code = code;
    this.endpoint = options?.endpoint;
    this.cause = options?.cause;
    this.context = options?.context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolygonClientError);
    }
  }
}

// ============================================================================
// Event Listener Types
// ============================================================================

/**
 * Connection event listener
 */
export type ConnectionEventListener = (event: ConnectionEvent) => void;

/**
 * Disposable subscription
 */
export interface Disposable {
  dispose: () => void;
}

// ============================================================================
// Wallet History Types (API-CHAIN-002)
// ============================================================================

/**
 * Wallet transaction from Polygonscan API
 */
export interface WalletTransaction {
  /** Transaction hash */
  hash: string;

  /** Block number */
  blockNumber: bigint;

  /** Block timestamp as Unix timestamp */
  timestamp: number;

  /** Transaction nonce */
  nonce: number;

  /** Block hash */
  blockHash: string;

  /** Transaction index within block */
  transactionIndex: number;

  /** Sender address */
  from: string;

  /** Recipient address (null for contract creation) */
  to: string | null;

  /** Value transferred in wei */
  value: bigint;

  /** Gas limit */
  gas: bigint;

  /** Gas price in wei */
  gasPrice: bigint;

  /** Transaction input data */
  input: string;

  /** Contract address (for contract creation transactions) */
  contractAddress: string | null;

  /** Cumulative gas used */
  cumulativeGasUsed: bigint;

  /** Actual gas used */
  gasUsed: bigint;

  /** Transaction confirmations */
  confirmations: number;

  /** Whether transaction errored */
  isError: boolean;

  /** Error code if transaction failed */
  txReceiptStatus: string;

  /** Method ID (first 4 bytes of input data) */
  methodId: string;

  /** Function name (if available) */
  functionName: string;
}

/**
 * Internal token transfer (ERC20, ERC721, etc.)
 */
export interface InternalTransaction {
  /** Transaction hash */
  hash: string;

  /** Block number */
  blockNumber: bigint;

  /** Block timestamp */
  timestamp: number;

  /** Sender address */
  from: string;

  /** Recipient address */
  to: string;

  /** Value transferred in wei */
  value: bigint;

  /** Contract address involved */
  contractAddress: string;

  /** Input data */
  input: string;

  /** Type of internal transaction */
  type: string;

  /** Gas used */
  gas: bigint;

  /** Gas used for internal call */
  gasUsed: bigint;

  /** Trace ID */
  traceId: string;

  /** Whether this call errored */
  isError: boolean;

  /** Error code if call failed */
  errCode: string;
}

/**
 * Wallet history options
 */
export interface WalletHistoryOptions {
  /** Page number for pagination (1-indexed) */
  page?: number;

  /** Number of results per page (max 10000) */
  pageSize?: number;

  /** Start block number */
  startBlock?: bigint;

  /** End block number */
  endBlock?: bigint;

  /** Sort order */
  sort?: "asc" | "desc";

  /** Filter by transaction type */
  txType?: "normal" | "internal" | "erc20" | "erc721" | "erc1155";
}

/**
 * Wallet history result
 */
export interface WalletHistoryResult {
  /** Wallet address */
  address: string;

  /** Transactions */
  transactions: WalletTransaction[];

  /** Total transaction count (if available) */
  totalCount?: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Current page */
  page: number;

  /** Page size */
  pageSize: number;
}

/**
 * Polygonscan API configuration
 */
export interface PolygonscanConfig {
  /** API key for Polygonscan */
  apiKey?: string;

  /** Base URL (defaults to https://api.polygonscan.com) */
  baseUrl?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum retries */
  maxRetries?: number;

  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Polygonscan API error
 */
export class PolygonscanError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly response?: unknown;

  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      response?: unknown;
    }
  ) {
    super(message);
    this.name = "PolygonscanError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.response = options?.response;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolygonscanError);
    }
  }
}

// ============================================================================
// Token Balance Types (API-CHAIN-003)
// ============================================================================

/**
 * Token information with balance
 */
export interface TokenBalance {
  /** Token contract address */
  contractAddress: string;

  /** Token symbol (e.g., "USDC", "WETH") */
  tokenSymbol: string;

  /** Token name (e.g., "USD Coin", "Wrapped Ether") */
  tokenName: string;

  /** Token decimal places */
  tokenDecimal: number;

  /** Raw balance in smallest unit (wei for 18 decimals) */
  balance: bigint;

  /** Human-readable balance with decimals applied */
  formattedBalance: string;
}

/**
 * Native token (MATIC) balance
 */
export interface NativeBalance {
  /** Balance in wei */
  balance: bigint;

  /** Human-readable balance in MATIC */
  formattedBalance: string;
}

/**
 * ERC721 NFT token
 */
export interface NFTToken {
  /** Token contract address */
  contractAddress: string;

  /** Token ID */
  tokenId: string;

  /** Token name */
  tokenName: string;

  /** Token symbol */
  tokenSymbol: string;

  /** Token URI (metadata URL) */
  tokenUri?: string;
}

/**
 * ERC1155 multi-token balance
 */
export interface ERC1155Balance {
  /** Token contract address */
  contractAddress: string;

  /** Token ID */
  tokenId: string;

  /** Token name */
  tokenName: string;

  /** Token symbol */
  tokenSymbol: string;

  /** Token value/amount */
  tokenValue: bigint;
}

/**
 * Complete wallet balance summary
 */
export interface WalletBalanceSummary {
  /** Wallet address */
  address: string;

  /** Native MATIC balance */
  nativeBalance: NativeBalance;

  /** ERC20 token balances */
  tokens: TokenBalance[];

  /** Total number of unique tokens held */
  tokenCount: number;
}

/**
 * Options for fetching token balances
 */
export interface TokenBalanceOptions {
  /** Specific contract address to query (for single token balance) */
  contractAddress?: string;

  /** Include zero balances (default: false) */
  includeZeroBalances?: boolean;

  /** Page number for pagination (1-indexed) */
  page?: number;

  /** Number of results per page (max 10000) */
  pageSize?: number;

  /** Sort order */
  sort?: "asc" | "desc";
}
