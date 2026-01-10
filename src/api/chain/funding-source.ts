/**
 * Wallet Funding Source Identification API (API-CHAIN-008)
 *
 * Trace where wallet funds originated from.
 * Features:
 * - Trace incoming transfers to find funding sources
 * - Identify known exchange wallets (Coinbase, Binance, etc.)
 * - Flag mixer/privacy tools (Tornado Cash, etc.)
 * - Build funding graph showing money flow
 * - Calculate funding source statistics
 */

import { isAddress, getAddress } from "viem";
import { EventEmitter } from "events";

import { PolygonClientError } from "./types";
import { PolygonscanClient, getSharedPolygonscanClient } from "./history";

// ============================================================================
// Constants
// ============================================================================

/**
 * Known centralized exchange deposit/hot wallet addresses on Polygon
 * These are commonly used addresses, not exhaustive
 */
export const KNOWN_EXCHANGES: Record<string, ExchangeInfo> = {
  // Binance
  "0x28c6c06298d514db089934071355e5743bf21d60": {
    name: "Binance",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": {
    name: "Binance",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0xf977814e90da44bfa03b6295a0616a897441acec": {
    name: "Binance",
    type: "cex",
    subtype: "cold_wallet",
    trustLevel: "high",
  },
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": {
    name: "Binance",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Coinbase
  "0x503828976d22510aad0201ac7ec88293211d23da": {
    name: "Coinbase",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740": {
    name: "Coinbase",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x3cd751e6b0078be393132286c442345e5dc49699": {
    name: "Coinbase",
    type: "cex",
    subtype: "cold_wallet",
    trustLevel: "high",
  },
  "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511": {
    name: "Coinbase",
    type: "cex",
    subtype: "commerce",
    trustLevel: "high",
  },

  // Crypto.com
  "0x6262998ced04146fa42253a5c0af90ca02dfd2a3": {
    name: "Crypto.com",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x46340b20830761efd32832a74d7169b29feb9758": {
    name: "Crypto.com",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Kraken
  "0x2910543af39aba0cd09dbb2d50200b3e800a63d2": {
    name: "Kraken",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0xae2d4617c862309a3d75a0ffb358c7a5009c673f": {
    name: "Kraken",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // OKX
  "0x98ec059dc3adfbdd63429454aeb0c990fba4a128": {
    name: "OKX",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b": {
    name: "OKX",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // KuCoin
  "0xf16e9b0d03470827a95cdfd0cb8a8a3b46969b91": {
    name: "KuCoin",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x1692e170361cefd1eb7240ec13d048fd9af6d667": {
    name: "KuCoin",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Gate.io
  "0x0d0707963952f2fba59dd06f2b425ace40b492fe": {
    name: "Gate.io",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c": {
    name: "Gate.io",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Huobi/HTX
  "0x46705dfff24256421a05d056c29e81bdc09723b8": {
    name: "Huobi",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x5c985e89dde482efe97ea9f1950ad149eb73829b": {
    name: "Huobi",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Bybit
  "0xf89d7b9c864f589bbf53a82105107622b35eaa40": {
    name: "Bybit",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x1db92e2eebc8e0c075a02bea49a2935bcd2dfcf4": {
    name: "Bybit",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Gemini
  "0xd24400ae8bfebb18ca49be86258a3c749cf46853": {
    name: "Gemini",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8": {
    name: "Gemini",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },

  // Bitfinex
  "0x876eabf441b2ee5b5b0554fd502a8e0600950cfa": {
    name: "Bitfinex",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
  "0x742d35cc6634c0532925a3b844bc454e4438f44e": {
    name: "Bitfinex",
    type: "cex",
    subtype: "hot_wallet",
    trustLevel: "high",
  },
};

/**
 * Known mixer/privacy tool contracts to flag
 * These are sanctioned or high-risk addresses
 */
export const KNOWN_MIXERS: Record<string, MixerInfo> = {
  // Tornado Cash contracts (sanctioned by OFAC)
  "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 0.1 ETH Pool",
  },
  "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 1 ETH Pool",
  },
  "0xa160cdab225685da1d56aa342ad8841c3b53f291": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 10 ETH Pool",
  },
  "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 100 ETH Pool",
  },
  "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 10000 DAI Pool",
  },
  "0x22aaa7720ddd5388a3c0a3333430953c68f1849b": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 100000 DAI Pool",
  },
  "0xba214c1c1928a32bffe790263e38b4af9bfcd659": {
    name: "Tornado Cash",
    type: "mixer",
    riskLevel: "critical",
    sanctioned: true,
    description: "Tornado Cash 1000 USDC Pool",
  },

  // Other privacy tools
  "0x8589427373d6d84e98730d7795d8f6f8731fda16": {
    name: "Railgun",
    type: "privacy",
    riskLevel: "high",
    sanctioned: false,
    description: "Railgun Privacy Contract",
  },
};

/**
 * Known DeFi protocol contracts (bridges, DEXes, etc.)
 */
export const KNOWN_DEFI_PROTOCOLS: Record<string, DefiProtocolInfo> = {
  // Polygon Bridge
  "0xa0c68c638235ee32657e8f720a23cec1bfc77c77": {
    name: "Polygon PoS Bridge",
    type: "bridge",
    trustLevel: "high",
  },
  "0x8484ef722627bf18ca5ae6bcf031c23e6e922b30": {
    name: "Polygon Plasma Bridge",
    type: "bridge",
    trustLevel: "high",
  },

  // Uniswap
  "0xe592427a0aece92de3edee1f18e0157c05861564": {
    name: "Uniswap V3 Router",
    type: "dex",
    trustLevel: "high",
  },
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": {
    name: "Uniswap V3 Router 2",
    type: "dex",
    trustLevel: "high",
  },

  // QuickSwap
  "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff": {
    name: "QuickSwap Router",
    type: "dex",
    trustLevel: "high",
  },

  // SushiSwap
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": {
    name: "SushiSwap Router",
    type: "dex",
    trustLevel: "high",
  },

  // 1inch
  "0x1111111254eeb25477b68fb85ed929f73a960582": {
    name: "1inch Router V5",
    type: "aggregator",
    trustLevel: "high",
  },

  // Aave
  "0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf": {
    name: "Aave V2 Lending Pool",
    type: "lending",
    trustLevel: "high",
  },
  "0x794a61358d6845594f94dc1db02a252b5b4814ad": {
    name: "Aave V3 Pool",
    type: "lending",
    trustLevel: "high",
  },

  // Curve
  "0x094d12e5b541784701fd8d65f11fc0598fbc6332": {
    name: "Curve Router",
    type: "dex",
    trustLevel: "high",
  },

  // Stargate (LayerZero bridge)
  "0x45a01e4e04f14f7a4a6702c74187c5f6222033cd": {
    name: "Stargate Router",
    type: "bridge",
    trustLevel: "high",
  },

  // Multichain (formerly AnySwap)
  "0x4f3aff3a747fcade12598081e80c6605a8be192f": {
    name: "Multichain Router",
    type: "bridge",
    trustLevel: "medium",
  },
};

/** Default configuration values */
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MIN_TRANSFER_AMOUNT = 1_000_000n; // 1 USDC (6 decimals)
const DEFAULT_MAX_FUNDING_SOURCES = 50;
const DEFAULT_LOOKBACK_BLOCKS = 100_000_000n; // ~3+ years on Polygon

// ============================================================================
// Types
// ============================================================================

/**
 * Exchange wallet information
 */
export interface ExchangeInfo {
  /** Exchange name */
  name: string;
  /** Exchange type */
  type: "cex" | "dex";
  /** Wallet subtype */
  subtype?: "hot_wallet" | "cold_wallet" | "commerce" | "other";
  /** Trust level for the source */
  trustLevel: "high" | "medium" | "low";
}

/**
 * Mixer/privacy tool information
 */
export interface MixerInfo {
  /** Service name */
  name: string;
  /** Type of service */
  type: "mixer" | "privacy" | "tumbler";
  /** Risk level */
  riskLevel: "critical" | "high" | "medium" | "low";
  /** Whether sanctioned by authorities */
  sanctioned: boolean;
  /** Description */
  description?: string;
}

/**
 * DeFi protocol information
 */
export interface DefiProtocolInfo {
  /** Protocol name */
  name: string;
  /** Protocol type */
  type: "bridge" | "dex" | "lending" | "aggregator" | "vault" | "other";
  /** Trust level */
  trustLevel: "high" | "medium" | "low";
}

/**
 * Type of funding source
 */
export type FundingSourceType =
  | "exchange"
  | "mixer"
  | "defi"
  | "contract"
  | "eoa"
  | "unknown";

/**
 * Risk level for a funding source
 */
export type FundingRiskLevel = "critical" | "high" | "medium" | "low" | "none";

/**
 * Individual funding source
 */
export interface FundingSource {
  /** Source wallet address */
  address: string;

  /** Source type */
  type: FundingSourceType;

  /** Name if known (e.g., "Binance", "Tornado Cash") */
  name?: string;

  /** Detailed info if available */
  info?: ExchangeInfo | MixerInfo | DefiProtocolInfo;

  /** Total amount received from this source */
  totalAmount: bigint;

  /** Formatted total amount */
  formattedAmount: string;

  /** Number of transfers from this source */
  transferCount: number;

  /** First transfer timestamp */
  firstTransferTimestamp: number;

  /** Last transfer timestamp */
  lastTransferTimestamp: number;

  /** Transaction hashes of transfers from this source */
  transactionHashes: string[];

  /** Risk level */
  riskLevel: FundingRiskLevel;

  /** Is this a sanctioned address? */
  isSanctioned: boolean;

  /** Depth in the funding graph (1 = direct, 2 = one hop, etc.) */
  depth: number;
}

/**
 * Edge in the funding graph
 */
export interface FundingEdge {
  /** Source address */
  from: string;

  /** Destination address */
  to: string;

  /** Transfer amount */
  amount: bigint;

  /** Formatted amount */
  formattedAmount: string;

  /** Transfer timestamp */
  timestamp: number;

  /** Transaction hash */
  transactionHash: string;

  /** Block number */
  blockNumber: bigint;
}

/**
 * Funding graph for visualization
 */
export interface FundingGraph {
  /** Target wallet being analyzed */
  targetWallet: string;

  /** All nodes (wallets) in the graph */
  nodes: FundingGraphNode[];

  /** All edges (transfers) in the graph */
  edges: FundingEdge[];

  /** Maximum depth explored */
  maxDepthExplored: number;

  /** Total number of transfers traced */
  totalTransfersTraced: number;
}

/**
 * Node in the funding graph
 */
export interface FundingGraphNode {
  /** Wallet address */
  address: string;

  /** Node type */
  type: FundingSourceType;

  /** Name if known */
  name?: string;

  /** Risk level */
  riskLevel: FundingRiskLevel;

  /** Depth from target (0 = target wallet) */
  depth: number;

  /** Is this the target wallet? */
  isTarget: boolean;

  /** Total value flowing through this node */
  totalValue: bigint;
}

/**
 * Complete funding analysis result
 */
export interface FundingAnalysis {
  /** Wallet address analyzed */
  walletAddress: string;

  /** All identified funding sources */
  fundingSources: FundingSource[];

  /** Overall risk score (0-100) */
  riskScore: number;

  /** Overall risk level */
  riskLevel: FundingRiskLevel;

  /** Risk factors contributing to the score */
  riskFactors: RiskFactor[];

  /** Summary statistics */
  summary: FundingSummary;

  /** Funding graph for visualization */
  graph: FundingGraph;

  /** Analysis timestamp */
  analyzedAt: Date;

  /** Analysis depth */
  analysisDepth: number;

  /** Total amount traced */
  totalAmountTraced: bigint;

  /** Formatted total amount */
  formattedTotalAmount: string;
}

/**
 * Risk factor detail
 */
export interface RiskFactor {
  /** Factor type */
  type: string;

  /** Factor description */
  description: string;

  /** Severity */
  severity: FundingRiskLevel;

  /** Points added to risk score */
  points: number;

  /** Related addresses */
  relatedAddresses?: string[];
}

/**
 * Funding summary statistics
 */
export interface FundingSummary {
  /** Total unique funding sources */
  totalSources: number;

  /** Breakdown by source type */
  sourcesByType: Record<FundingSourceType, number>;

  /** Breakdown by risk level */
  sourcesByRisk: Record<FundingRiskLevel, number>;

  /** Exchange-sourced funds */
  exchangeFunds: {
    total: bigint;
    formatted: string;
    percentage: number;
    exchanges: string[];
  };

  /** Mixer/privacy tool funds */
  mixerFunds: {
    total: bigint;
    formatted: string;
    percentage: number;
    mixers: string[];
  };

  /** DeFi protocol funds */
  defiFunds: {
    total: bigint;
    formatted: string;
    percentage: number;
    protocols: string[];
  };

  /** Unknown/EOA funds */
  unknownFunds: {
    total: bigint;
    formatted: string;
    percentage: number;
  };

  /** Has sanctioned source */
  hasSanctionedSource: boolean;

  /** Sanctioned source addresses */
  sanctionedSources: string[];
}

/**
 * Funding source tracker configuration
 */
export interface FundingSourceConfig {
  /** Polygonscan client for fetching transactions */
  polygonscanClient?: PolygonscanClient;

  /** Maximum depth to trace (default: 3) */
  maxDepth?: number;

  /** Minimum transfer amount to consider (default: 1 USDC) */
  minTransferAmount?: bigint;

  /** Maximum number of funding sources to return (default: 50) */
  maxFundingSources?: number;

  /** Number of blocks to look back (default: all) */
  lookbackBlocks?: bigint;

  /** Additional exchange addresses */
  additionalExchanges?: Record<string, ExchangeInfo>;

  /** Additional mixer addresses */
  additionalMixers?: Record<string, MixerInfo>;

  /** Additional DeFi protocol addresses */
  additionalDefiProtocols?: Record<string, DefiProtocolInfo>;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom logger */
  logger?: FundingSourceLogger;
}

/**
 * Logger interface
 */
export interface FundingSourceLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Event types for the funding source tracker
 */
export type FundingSourceEventType =
  | "sourceIdentified"
  | "mixerDetected"
  | "exchangeDetected"
  | "analysisComplete"
  | "error";

/**
 * Event data
 */
export interface FundingSourceEvent {
  type: FundingSourceEventType;
  source?: FundingSource;
  analysis?: FundingAnalysis;
  error?: Error;
  timestamp: Date;
}

/**
 * Event listener type
 */
export type FundingSourceEventListener = (event: FundingSourceEvent) => void;

// ============================================================================
// FundingSourceTracker Class
// ============================================================================

/**
 * Tracker for identifying wallet funding sources
 */
export class FundingSourceTracker extends EventEmitter {
  private readonly config: Required<
    Omit<
      FundingSourceConfig,
      | "polygonscanClient"
      | "additionalExchanges"
      | "additionalMixers"
      | "additionalDefiProtocols"
    >
  > & {
    polygonscanClient?: PolygonscanClient;
    additionalExchanges: Record<string, ExchangeInfo>;
    additionalMixers: Record<string, MixerInfo>;
    additionalDefiProtocols: Record<string, DefiProtocolInfo>;
  };

  private readonly logger: FundingSourceLogger;
  private readonly exchanges: Map<string, ExchangeInfo>;
  private readonly mixers: Map<string, MixerInfo>;
  private readonly defiProtocols: Map<string, DefiProtocolInfo>;

  constructor(config: FundingSourceConfig = {}) {
    super();

    const debug = config.debug ?? false;
    this.config = {
      polygonscanClient: config.polygonscanClient,
      maxDepth: config.maxDepth ?? DEFAULT_MAX_DEPTH,
      minTransferAmount: config.minTransferAmount ?? DEFAULT_MIN_TRANSFER_AMOUNT,
      maxFundingSources: config.maxFundingSources ?? DEFAULT_MAX_FUNDING_SOURCES,
      lookbackBlocks: config.lookbackBlocks ?? DEFAULT_LOOKBACK_BLOCKS,
      additionalExchanges: config.additionalExchanges ?? {},
      additionalMixers: config.additionalMixers ?? {},
      additionalDefiProtocols: config.additionalDefiProtocols ?? {},
      debug,
      logger: config.logger ?? this.createDefaultLogger(debug),
    };

    this.logger = this.config.logger;

    // Initialize exchange lookup
    this.exchanges = new Map();
    for (const [address, info] of Object.entries(KNOWN_EXCHANGES)) {
      this.exchanges.set(address.toLowerCase(), info);
    }
    for (const [address, info] of Object.entries(this.config.additionalExchanges)) {
      this.exchanges.set(address.toLowerCase(), info);
    }

    // Initialize mixer lookup
    this.mixers = new Map();
    for (const [address, info] of Object.entries(KNOWN_MIXERS)) {
      this.mixers.set(address.toLowerCase(), info);
    }
    for (const [address, info] of Object.entries(this.config.additionalMixers)) {
      this.mixers.set(address.toLowerCase(), info);
    }

    // Initialize DeFi protocol lookup
    this.defiProtocols = new Map();
    for (const [address, info] of Object.entries(KNOWN_DEFI_PROTOCOLS)) {
      this.defiProtocols.set(address.toLowerCase(), info);
    }
    for (const [address, info] of Object.entries(this.config.additionalDefiProtocols)) {
      this.defiProtocols.set(address.toLowerCase(), info);
    }
  }

  /**
   * Analyze funding sources for a wallet
   */
  async analyzeFundingSources(
    walletAddress: string,
    options: {
      maxDepth?: number;
      minTransferAmount?: bigint;
      startBlock?: bigint;
      endBlock?: bigint;
    } = {}
  ): Promise<FundingAnalysis> {
    if (!walletAddress || !isAddress(walletAddress)) {
      throw new PolygonClientError(
        `Invalid wallet address: ${walletAddress}`,
        "INVALID_ADDRESS"
      );
    }

    const normalizedAddress = getAddress(walletAddress);
    const maxDepth = options.maxDepth ?? this.config.maxDepth;
    const minAmount = options.minTransferAmount ?? this.config.minTransferAmount;

    this.logger.debug(`Analyzing funding sources for ${normalizedAddress}`);

    // Build funding graph through recursive tracing
    const graph = await this.buildFundingGraph(normalizedAddress, {
      maxDepth,
      minAmount,
      startBlock: options.startBlock,
      endBlock: options.endBlock,
    });

    // Extract funding sources from graph
    const fundingSources = this.extractFundingSources(graph);

    // Calculate risk score and factors
    const { riskScore, riskLevel, riskFactors } = this.calculateRisk(fundingSources);

    // Build summary
    const summary = this.buildSummary(fundingSources);

    // Calculate total amount traced
    let totalAmountTraced = 0n;
    for (const source of fundingSources) {
      totalAmountTraced += source.totalAmount;
    }

    const analysis: FundingAnalysis = {
      walletAddress: normalizedAddress,
      fundingSources: fundingSources.slice(0, this.config.maxFundingSources),
      riskScore,
      riskLevel,
      riskFactors,
      summary,
      graph,
      analyzedAt: new Date(),
      analysisDepth: maxDepth,
      totalAmountTraced,
      formattedTotalAmount: this.formatAmount(totalAmountTraced),
    };

    // Emit analysis complete event
    this.emit("analysisComplete", {
      type: "analysisComplete",
      analysis,
      timestamp: new Date(),
    });

    return analysis;
  }

  /**
   * Get incoming transfers for a wallet
   */
  async getIncomingTransfers(
    walletAddress: string,
    options: {
      startBlock?: bigint;
      endBlock?: bigint;
      minAmount?: bigint;
    } = {}
  ): Promise<FundingEdge[]> {
    if (!walletAddress || !isAddress(walletAddress)) {
      throw new PolygonClientError(
        `Invalid wallet address: ${walletAddress}`,
        "INVALID_ADDRESS"
      );
    }

    const normalizedAddress = getAddress(walletAddress);
    const client = this.config.polygonscanClient ?? getSharedPolygonscanClient();
    const minAmount = options.minAmount ?? this.config.minTransferAmount;

    try {
      // Fetch transaction history
      const result = await client.getWalletHistory(normalizedAddress, {
        sort: "desc",
        pageSize: 1000,
        startBlock: options.startBlock,
        endBlock: options.endBlock,
      });

      const edges: FundingEdge[] = [];

      for (const tx of result.transactions) {
        // Only consider incoming transfers
        if (tx.to?.toLowerCase() !== normalizedAddress.toLowerCase()) {
          continue;
        }

        // Skip failed transactions
        if (tx.isError) {
          continue;
        }

        // Skip below minimum amount
        if (tx.value < minAmount) {
          continue;
        }

        edges.push({
          from: tx.from,
          to: normalizedAddress,
          amount: tx.value,
          formattedAmount: this.formatAmount(tx.value),
          timestamp: tx.timestamp,
          transactionHash: tx.hash,
          blockNumber: tx.blockNumber,
        });
      }

      // Fetch additional pages if needed
      let hasMore = result.hasMore;
      let page = 2;
      const maxPages = 10; // Limit pages for performance

      while (hasMore && page <= maxPages) {
        const nextResult = await client.getWalletHistory(normalizedAddress, {
          sort: "desc",
          pageSize: 1000,
          page,
          startBlock: options.startBlock,
          endBlock: options.endBlock,
        });

        for (const tx of nextResult.transactions) {
          if (tx.to?.toLowerCase() !== normalizedAddress.toLowerCase()) {
            continue;
          }
          if (tx.isError) {
            continue;
          }
          if (tx.value < minAmount) {
            continue;
          }

          edges.push({
            from: tx.from,
            to: normalizedAddress,
            amount: tx.value,
            formattedAmount: this.formatAmount(tx.value),
            timestamp: tx.timestamp,
            transactionHash: tx.hash,
            blockNumber: tx.blockNumber,
          });
        }

        hasMore = nextResult.hasMore;
        page++;
      }

      return edges;
    } catch (error) {
      this.logger.error("Failed to fetch incoming transfers", error);
      throw error;
    }
  }

  /**
   * Check if an address is a known exchange
   */
  isExchange(address: string): boolean {
    if (!address) return false;
    return this.exchanges.has(address.toLowerCase());
  }

  /**
   * Get exchange info for an address
   */
  getExchangeInfo(address: string): ExchangeInfo | undefined {
    if (!address) return undefined;
    return this.exchanges.get(address.toLowerCase());
  }

  /**
   * Check if an address is a known mixer/privacy tool
   */
  isMixer(address: string): boolean {
    if (!address) return false;
    return this.mixers.has(address.toLowerCase());
  }

  /**
   * Get mixer info for an address
   */
  getMixerInfo(address: string): MixerInfo | undefined {
    if (!address) return undefined;
    return this.mixers.get(address.toLowerCase());
  }

  /**
   * Check if an address is a known DeFi protocol
   */
  isDefiProtocol(address: string): boolean {
    if (!address) return false;
    return this.defiProtocols.has(address.toLowerCase());
  }

  /**
   * Get DeFi protocol info for an address
   */
  getDefiProtocolInfo(address: string): DefiProtocolInfo | undefined {
    if (!address) return undefined;
    return this.defiProtocols.get(address.toLowerCase());
  }

  /**
   * Check if an address is sanctioned
   */
  isSanctioned(address: string): boolean {
    if (!address) return false;
    const mixer = this.mixers.get(address.toLowerCase());
    return mixer?.sanctioned ?? false;
  }

  /**
   * Identify the type of an address
   */
  identifyAddressType(address: string): FundingSourceType {
    if (!address) return "unknown";
    const lowerAddress = address.toLowerCase();

    if (this.exchanges.has(lowerAddress)) {
      return "exchange";
    }
    if (this.mixers.has(lowerAddress)) {
      return "mixer";
    }
    if (this.defiProtocols.has(lowerAddress)) {
      return "defi";
    }

    // Check if it's a contract (starts with 0x and has code)
    // For simplicity, we'll mark unknown addresses as EOA
    // In production, you'd want to check if the address has code
    return "eoa";
  }

  /**
   * Get risk level for an address
   */
  getRiskLevel(address: string): FundingRiskLevel {
    if (!address) return "none";
    const lowerAddress = address.toLowerCase();

    // Check mixer risk
    const mixer = this.mixers.get(lowerAddress);
    if (mixer) {
      return mixer.riskLevel;
    }

    // Check exchange risk (generally low)
    const exchange = this.exchanges.get(lowerAddress);
    if (exchange) {
      return exchange.trustLevel === "high"
        ? "low"
        : exchange.trustLevel === "medium"
          ? "medium"
          : "high";
    }

    // Check DeFi protocol risk
    const defi = this.defiProtocols.get(lowerAddress);
    if (defi) {
      return defi.trustLevel === "high"
        ? "low"
        : defi.trustLevel === "medium"
          ? "medium"
          : "high";
    }

    // Unknown addresses have medium risk by default
    return "medium";
  }

  /**
   * Get tracker statistics
   */
  getStats(): {
    knownExchanges: number;
    knownMixers: number;
    knownDefiProtocols: number;
    maxDepth: number;
    minTransferAmount: string;
  } {
    return {
      knownExchanges: this.exchanges.size,
      knownMixers: this.mixers.size,
      knownDefiProtocols: this.defiProtocols.size,
      maxDepth: this.config.maxDepth,
      minTransferAmount: this.formatAmount(this.config.minTransferAmount),
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build funding graph recursively
   */
  private async buildFundingGraph(
    targetAddress: string,
    options: {
      maxDepth: number;
      minAmount: bigint;
      startBlock?: bigint;
      endBlock?: bigint;
    }
  ): Promise<FundingGraph> {
    const nodes: Map<string, FundingGraphNode> = new Map();
    const edges: FundingEdge[] = [];
    const visited: Set<string> = new Set();

    // Add target node
    const targetLower = targetAddress.toLowerCase();
    nodes.set(targetLower, {
      address: targetAddress,
      type: "eoa",
      depth: 0,
      isTarget: true,
      totalValue: 0n,
      riskLevel: "none",
    });

    // BFS to explore funding sources
    const queue: Array<{ address: string; depth: number }> = [
      { address: targetAddress, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth >= options.maxDepth) {
        continue;
      }

      if (visited.has(current.address.toLowerCase())) {
        continue;
      }
      visited.add(current.address.toLowerCase());

      try {
        const transfers = await this.getIncomingTransfers(current.address, {
          minAmount: options.minAmount,
          startBlock: options.startBlock,
          endBlock: options.endBlock,
        });

        for (const transfer of transfers) {
          const fromLower = transfer.from.toLowerCase();

          // Add edge
          edges.push(transfer);

          // Add or update node
          if (!nodes.has(fromLower)) {
            const type = this.identifyAddressType(transfer.from);
            const name = this.getAddressName(transfer.from);
            const riskLevel = this.getRiskLevel(transfer.from);

            const node: FundingGraphNode = {
              address: transfer.from,
              type,
              name,
              riskLevel,
              depth: current.depth + 1,
              isTarget: false,
              totalValue: transfer.amount,
            };

            nodes.set(fromLower, node);

            // Emit events for interesting sources
            if (type === "mixer") {
              this.emit("mixerDetected", {
                type: "mixerDetected",
                source: {
                  address: transfer.from,
                  type,
                  name,
                  totalAmount: transfer.amount,
                  formattedAmount: this.formatAmount(transfer.amount),
                  transferCount: 1,
                  firstTransferTimestamp: transfer.timestamp,
                  lastTransferTimestamp: transfer.timestamp,
                  transactionHashes: [transfer.transactionHash],
                  riskLevel,
                  isSanctioned: this.isSanctioned(transfer.from),
                  depth: current.depth + 1,
                },
                timestamp: new Date(),
              });
            } else if (type === "exchange") {
              this.emit("exchangeDetected", {
                type: "exchangeDetected",
                source: {
                  address: transfer.from,
                  type,
                  name,
                  totalAmount: transfer.amount,
                  formattedAmount: this.formatAmount(transfer.amount),
                  transferCount: 1,
                  firstTransferTimestamp: transfer.timestamp,
                  lastTransferTimestamp: transfer.timestamp,
                  transactionHashes: [transfer.transactionHash],
                  riskLevel,
                  isSanctioned: false,
                  depth: current.depth + 1,
                },
                timestamp: new Date(),
              });
            }

            // Only continue tracing for EOA/unknown sources
            // Don't trace into exchanges, mixers, or DeFi protocols
            if (
              type === "eoa" ||
              type === "unknown" ||
              type === "contract"
            ) {
              queue.push({ address: transfer.from, depth: current.depth + 1 });
            }
          } else {
            // Update existing node
            const existingNode = nodes.get(fromLower)!;
            existingNode.totalValue += transfer.amount;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to trace funding for ${current.address}: ${error}`
        );
      }
    }

    return {
      targetWallet: targetAddress,
      nodes: Array.from(nodes.values()),
      edges,
      maxDepthExplored: options.maxDepth,
      totalTransfersTraced: edges.length,
    };
  }

  /**
   * Extract funding sources from graph
   */
  private extractFundingSources(graph: FundingGraph): FundingSource[] {
    const sourcesMap: Map<string, FundingSource> = new Map();

    // Process edges to build funding sources
    for (const edge of graph.edges) {
      const fromLower = edge.from.toLowerCase();
      const toLower = edge.to.toLowerCase();

      // Only count as funding source if directly or indirectly funding target
      // (source -> target or source -> intermediate -> target)
      const targetLower = graph.targetWallet.toLowerCase();
      if (toLower !== targetLower) {
        // Check if this is in the path to target
        const node = graph.nodes.find((n) => n.address.toLowerCase() === fromLower);
        if (!node || node.isTarget) continue;
      }

      const existing = sourcesMap.get(fromLower);
      if (existing) {
        existing.totalAmount += edge.amount;
        existing.formattedAmount = this.formatAmount(existing.totalAmount);
        existing.transferCount++;
        existing.transactionHashes.push(edge.transactionHash);
        if (edge.timestamp < existing.firstTransferTimestamp) {
          existing.firstTransferTimestamp = edge.timestamp;
        }
        if (edge.timestamp > existing.lastTransferTimestamp) {
          existing.lastTransferTimestamp = edge.timestamp;
        }
      } else {
        const type = this.identifyAddressType(edge.from);
        const name = this.getAddressName(edge.from);
        const riskLevel = this.getRiskLevel(edge.from);
        const info = this.getAddressInfo(edge.from);
        const node = graph.nodes.find((n) => n.address.toLowerCase() === fromLower);

        sourcesMap.set(fromLower, {
          address: edge.from,
          type,
          name,
          info,
          totalAmount: edge.amount,
          formattedAmount: this.formatAmount(edge.amount),
          transferCount: 1,
          firstTransferTimestamp: edge.timestamp,
          lastTransferTimestamp: edge.timestamp,
          transactionHashes: [edge.transactionHash],
          riskLevel,
          isSanctioned: this.isSanctioned(edge.from),
          depth: node?.depth ?? 1,
        });
      }
    }

    // Sort by total amount (descending)
    return Array.from(sourcesMap.values()).sort(
      (a, b) => (b.totalAmount > a.totalAmount ? 1 : -1)
    );
  }

  /**
   * Calculate risk score and factors
   */
  private calculateRisk(sources: FundingSource[]): {
    riskScore: number;
    riskLevel: FundingRiskLevel;
    riskFactors: RiskFactor[];
  } {
    let riskScore = 0;
    const riskFactors: RiskFactor[] = [];

    // Check for sanctioned sources (critical)
    const sanctionedSources = sources.filter((s) => s.isSanctioned);
    if (sanctionedSources.length > 0) {
      riskScore += 50;
      riskFactors.push({
        type: "sanctioned_source",
        description: `Funds received from ${sanctionedSources.length} sanctioned address(es)`,
        severity: "critical",
        points: 50,
        relatedAddresses: sanctionedSources.map((s) => s.address),
      });
    }

    // Check for mixer sources (high risk)
    const mixerSources = sources.filter((s) => s.type === "mixer" && !s.isSanctioned);
    if (mixerSources.length > 0) {
      riskScore += 30;
      riskFactors.push({
        type: "mixer_source",
        description: `Funds received from ${mixerSources.length} mixer/privacy tool(s)`,
        severity: "high",
        points: 30,
        relatedAddresses: mixerSources.map((s) => s.address),
      });
    }

    // Check for high-risk unknown sources
    const unknownSources = sources.filter(
      (s) => s.type === "eoa" || s.type === "unknown"
    );
    const totalAmount = sources.reduce((sum, s) => sum + s.totalAmount, 0n);
    const unknownAmount = unknownSources.reduce((sum, s) => sum + s.totalAmount, 0n);

    if (totalAmount > 0n) {
      const unknownPercentage = Number((unknownAmount * 100n) / totalAmount);
      if (unknownPercentage > 50) {
        riskScore += 15;
        riskFactors.push({
          type: "high_unknown_ratio",
          description: `${unknownPercentage.toFixed(1)}% of funds from unknown/unidentified sources`,
          severity: "medium",
          points: 15,
        });
      }
    }

    // Check for depth of funding (indirect funding)
    const deepSources = sources.filter((s) => s.depth > 2);
    if (deepSources.length > 0) {
      riskScore += 10;
      riskFactors.push({
        type: "deep_funding_chain",
        description: `${deepSources.length} source(s) traced through multiple hops`,
        severity: "medium",
        points: 10,
        relatedAddresses: deepSources.map((s) => s.address),
      });
    }

    // Determine overall risk level
    let riskLevel: FundingRiskLevel;
    if (riskScore >= 50) {
      riskLevel = "critical";
    } else if (riskScore >= 30) {
      riskLevel = "high";
    } else if (riskScore >= 15) {
      riskLevel = "medium";
    } else if (riskScore > 0) {
      riskLevel = "low";
    } else {
      riskLevel = "none";
    }

    return { riskScore: Math.min(riskScore, 100), riskLevel, riskFactors };
  }

  /**
   * Build summary statistics
   */
  private buildSummary(sources: FundingSource[]): FundingSummary {
    const sourcesByType: Record<FundingSourceType, number> = {
      exchange: 0,
      mixer: 0,
      defi: 0,
      contract: 0,
      eoa: 0,
      unknown: 0,
    };

    const sourcesByRisk: Record<FundingRiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    let totalAmount = 0n;
    let exchangeTotal = 0n;
    let mixerTotal = 0n;
    let defiTotal = 0n;
    let unknownTotal = 0n;

    const exchanges: string[] = [];
    const mixers: string[] = [];
    const protocols: string[] = [];
    const sanctionedSources: string[] = [];

    for (const source of sources) {
      sourcesByType[source.type]++;
      sourcesByRisk[source.riskLevel]++;
      totalAmount += source.totalAmount;

      if (source.isSanctioned) {
        sanctionedSources.push(source.address);
      }

      switch (source.type) {
        case "exchange":
          exchangeTotal += source.totalAmount;
          if (source.name && !exchanges.includes(source.name)) {
            exchanges.push(source.name);
          }
          break;
        case "mixer":
          mixerTotal += source.totalAmount;
          if (source.name && !mixers.includes(source.name)) {
            mixers.push(source.name);
          }
          break;
        case "defi":
          defiTotal += source.totalAmount;
          if (source.name && !protocols.includes(source.name)) {
            protocols.push(source.name);
          }
          break;
        default:
          unknownTotal += source.totalAmount;
      }
    }

    const calcPercentage = (amount: bigint): number => {
      if (totalAmount === 0n) return 0;
      return Number((amount * 10000n) / totalAmount) / 100;
    };

    return {
      totalSources: sources.length,
      sourcesByType,
      sourcesByRisk,
      exchangeFunds: {
        total: exchangeTotal,
        formatted: this.formatAmount(exchangeTotal),
        percentage: calcPercentage(exchangeTotal),
        exchanges,
      },
      mixerFunds: {
        total: mixerTotal,
        formatted: this.formatAmount(mixerTotal),
        percentage: calcPercentage(mixerTotal),
        mixers,
      },
      defiFunds: {
        total: defiTotal,
        formatted: this.formatAmount(defiTotal),
        percentage: calcPercentage(defiTotal),
        protocols,
      },
      unknownFunds: {
        total: unknownTotal,
        formatted: this.formatAmount(unknownTotal),
        percentage: calcPercentage(unknownTotal),
      },
      hasSanctionedSource: sanctionedSources.length > 0,
      sanctionedSources,
    };
  }

  /**
   * Get human-readable name for an address
   */
  private getAddressName(address: string): string | undefined {
    const lowerAddress = address.toLowerCase();

    const exchange = this.exchanges.get(lowerAddress);
    if (exchange) return exchange.name;

    const mixer = this.mixers.get(lowerAddress);
    if (mixer) return mixer.name;

    const defi = this.defiProtocols.get(lowerAddress);
    if (defi) return defi.name;

    return undefined;
  }

  /**
   * Get detailed info for an address
   */
  private getAddressInfo(
    address: string
  ): ExchangeInfo | MixerInfo | DefiProtocolInfo | undefined {
    const lowerAddress = address.toLowerCase();

    return (
      this.exchanges.get(lowerAddress) ||
      this.mixers.get(lowerAddress) ||
      this.defiProtocols.get(lowerAddress)
    );
  }

  /**
   * Format amount for display (assumes 18 decimals for native transfers)
   */
  private formatAmount(amount: bigint): string {
    const decimals = 18; // MATIC has 18 decimals
    const isNegative = amount < 0n;
    const absAmount = isNegative ? -amount : amount;
    const whole = absAmount / BigInt(10 ** decimals);
    const fraction = absAmount % BigInt(10 ** decimals);
    const fractionStr = fraction.toString().padStart(decimals, "0");

    // Keep 6 decimal places for display
    const trimmedFraction = fractionStr.slice(0, 6);

    const sign = isNegative ? "-" : "";
    return `${sign}${whole}.${trimmedFraction}`;
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(debug: boolean): FundingSourceLogger {
    const noop = () => {};
    return {
      debug: debug ? console.log.bind(console, "[FundingSource]") : noop,
      info: console.log.bind(console, "[FundingSource]"),
      warn: console.warn.bind(console, "[FundingSource]"),
      error: console.error.bind(console, "[FundingSource]"),
    };
  }
}

// ============================================================================
// Singleton Management and Convenience Functions
// ============================================================================

let sharedTracker: FundingSourceTracker | null = null;

/**
 * Create a new FundingSourceTracker instance
 */
export function createFundingSourceTracker(
  config?: FundingSourceConfig
): FundingSourceTracker {
  return new FundingSourceTracker(config);
}

/**
 * Get the shared FundingSourceTracker instance
 */
export function getSharedFundingSourceTracker(): FundingSourceTracker {
  if (!sharedTracker) {
    sharedTracker = new FundingSourceTracker();
  }
  return sharedTracker;
}

/**
 * Set the shared FundingSourceTracker instance
 */
export function setSharedFundingSourceTracker(
  tracker: FundingSourceTracker
): void {
  sharedTracker = tracker;
}

/**
 * Reset the shared FundingSourceTracker instance
 */
export function resetSharedFundingSourceTracker(): void {
  sharedTracker = null;
}

/**
 * Analyze funding sources for a wallet (convenience function)
 */
export async function analyzeFundingSources(
  walletAddress: string,
  options?: {
    maxDepth?: number;
    minTransferAmount?: bigint;
    startBlock?: bigint;
    endBlock?: bigint;
    tracker?: FundingSourceTracker;
  }
): Promise<FundingAnalysis> {
  const tracker = options?.tracker ?? getSharedFundingSourceTracker();
  return tracker.analyzeFundingSources(walletAddress, options);
}

/**
 * Get incoming transfers for a wallet (convenience function)
 */
export async function getWalletFundingTransfers(
  walletAddress: string,
  options?: {
    startBlock?: bigint;
    endBlock?: bigint;
    minAmount?: bigint;
    tracker?: FundingSourceTracker;
  }
): Promise<FundingEdge[]> {
  const tracker = options?.tracker ?? getSharedFundingSourceTracker();
  return tracker.getIncomingTransfers(walletAddress, options);
}

/**
 * Check if address is a known exchange (convenience function)
 */
export function isKnownExchange(
  address: string,
  tracker?: FundingSourceTracker
): boolean {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.isExchange(address);
}

/**
 * Check if address is a known mixer (convenience function)
 */
export function isKnownMixer(
  address: string,
  tracker?: FundingSourceTracker
): boolean {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.isMixer(address);
}

/**
 * Check if address is sanctioned (convenience function)
 */
export function isSanctionedAddress(
  address: string,
  tracker?: FundingSourceTracker
): boolean {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.isSanctioned(address);
}

/**
 * Get exchange info for address (convenience function)
 */
export function getExchangeInfoForAddress(
  address: string,
  tracker?: FundingSourceTracker
): ExchangeInfo | undefined {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.getExchangeInfo(address);
}

/**
 * Get mixer info for address (convenience function)
 */
export function getMixerInfoForAddress(
  address: string,
  tracker?: FundingSourceTracker
): MixerInfo | undefined {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.getMixerInfo(address);
}

/**
 * Identify address type (convenience function)
 */
export function identifyAddress(
  address: string,
  tracker?: FundingSourceTracker
): FundingSourceType {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.identifyAddressType(address);
}

/**
 * Get risk level for address (convenience function)
 */
export function getAddressRiskLevel(
  address: string,
  tracker?: FundingSourceTracker
): FundingRiskLevel {
  const actualTracker = tracker ?? getSharedFundingSourceTracker();
  return actualTracker.getRiskLevel(address);
}
