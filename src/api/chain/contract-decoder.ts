/**
 * Contract Decoder API (API-CHAIN-006)
 *
 * Parse and decode Polymarket smart contract calls on Polygon.
 * Features:
 * - Decode CTF Exchange interactions (buy/sell outcome tokens)
 * - Decode USDC transfers
 * - Decode Conditional Token Framework (CTF) operations
 * - Decode NegRiskCTFExchange interactions
 * - Extract relevant data from transaction input
 */

import { isAddress, getAddress } from "viem";
import { PolygonClientError } from "./types";

// ============================================================================
// Polymarket Contract Addresses (Polygon Mainnet)
// ============================================================================

/**
 * Known Polymarket contract addresses on Polygon
 */
export const POLYMARKET_CONTRACTS = {
  /** CTF Exchange contract - main trading contract */
  CTF_EXCHANGE: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E",

  /** NegRisk CTF Exchange - for negative risk markets */
  NEG_RISK_CTF_EXCHANGE: "0xC5d563A36AE78145C45a50134d48A1215220f80a",

  /** Conditional Tokens contract (Gnosis CTF) */
  CONDITIONAL_TOKENS: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",

  /** USDC token contract on Polygon */
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",

  /** USDC.e (bridged USDC) on Polygon */
  USDC_E: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",

  /** Polymarket Proxy Wallet Factory */
  PROXY_WALLET_FACTORY: "0xaB45c5A4B0c941a2F231C04C3f49182e1A254052",

  /** Polymarket Router */
  ROUTER: "0x82a1c0aBB3E3E3F26E0E4E8d3A7bB12EDD82F78C",
} as const;

/**
 * Type for Polymarket contract names
 */
export type PolymarketContractName = keyof typeof POLYMARKET_CONTRACTS;

// ============================================================================
// Function Selectors (First 4 bytes of keccak256 hash of function signature)
// ============================================================================

/**
 * Known function selectors for Polymarket contracts
 */
export const FUNCTION_SELECTORS = {
  // CTF Exchange functions
  /** fillOrder(Order,Signature,uint256) */
  FILL_ORDER: "0x64a3d249",
  /** fillOrders(Order[],Signature[],uint256[]) */
  FILL_ORDERS: "0xd798eff6",
  /** matchOrders(Order,Order,Signature,Signature) */
  MATCH_ORDERS: "0x88ec79fb",
  /** cancelOrder(Order) */
  CANCEL_ORDER: "0x2e1a7d4d",
  /** cancelOrders(Order[]) */
  CANCEL_ORDERS: "0x4e71e0c8",

  // Conditional Tokens functions
  /** splitPosition(IERC20,bytes32,bytes32,uint256[],uint256) */
  SPLIT_POSITION: "0x72ce4275",
  /** mergePositions(IERC20,bytes32,bytes32,uint256[],uint256) */
  MERGE_POSITIONS: "0x4374f3a0",
  /** redeemPositions(IERC20,bytes32,bytes32,uint256[]) */
  REDEEM_POSITIONS: "0xe6f85d95",
  /** safeTransferFrom(address,address,uint256,uint256,bytes) */
  SAFE_TRANSFER_FROM_1155: "0xf242432a",
  /** safeBatchTransferFrom(address,address,uint256[],uint256[],bytes) */
  SAFE_BATCH_TRANSFER_FROM: "0x2eb2c2d6",

  // ERC20 functions (USDC)
  /** transfer(address,uint256) */
  TRANSFER: "0xa9059cbb",
  /** transferFrom(address,address,uint256) */
  TRANSFER_FROM: "0x23b872dd",
  /** approve(address,uint256) */
  APPROVE: "0x095ea7b3",

  // NegRisk Exchange functions
  /** fillOrder(Order,uint256) */
  NEG_RISK_FILL_ORDER: "0xe4b50cb8",
  /** convertPositions(bytes32,uint256,uint256) */
  CONVERT_POSITIONS: "0xfb63544e",

  // Proxy Wallet functions
  /** createProxyWallet() */
  CREATE_PROXY_WALLET: "0x3e9e7da3",
} as const;

/**
 * Type for function selector values
 */
export type FunctionSelector = (typeof FUNCTION_SELECTORS)[keyof typeof FUNCTION_SELECTORS];

// ============================================================================
// Types for Decoded Data
// ============================================================================

/**
 * Base interface for all decoded interactions
 */
export interface DecodedInteraction {
  /** Type of interaction */
  type: DecodedInteractionType;

  /** Contract address that was called */
  contractAddress: string;

  /** Contract name if known */
  contractName?: PolymarketContractName;

  /** Function selector (first 4 bytes of input) */
  functionSelector: string;

  /** Human-readable function name */
  functionName: string;

  /** Raw input data */
  rawInput: string;

  /** Whether this is a known Polymarket contract */
  isPolymarketContract: boolean;
}

/**
 * Types of decoded interactions
 */
export type DecodedInteractionType =
  | "FILL_ORDER"
  | "FILL_ORDERS"
  | "MATCH_ORDERS"
  | "CANCEL_ORDER"
  | "CANCEL_ORDERS"
  | "SPLIT_POSITION"
  | "MERGE_POSITIONS"
  | "REDEEM_POSITIONS"
  | "TOKEN_TRANSFER"
  | "TOKEN_TRANSFER_FROM"
  | "TOKEN_APPROVE"
  | "CTF_TRANSFER"
  | "CTF_BATCH_TRANSFER"
  | "CONVERT_POSITIONS"
  | "CREATE_PROXY_WALLET"
  | "UNKNOWN";

/**
 * Decoded order fill interaction
 */
export interface DecodedFillOrder extends DecodedInteraction {
  type: "FILL_ORDER";

  /** Token ID being traded */
  tokenId?: string;

  /** Maker address */
  maker?: string;

  /** Trade side (BUY or SELL) */
  side?: "BUY" | "SELL";

  /** Price per token (0-1 scale) */
  price?: string;

  /** Order size/amount */
  size?: string;

  /** Fill amount */
  fillAmount?: string;
}

/**
 * Decoded batch order fill
 */
export interface DecodedFillOrders extends DecodedInteraction {
  type: "FILL_ORDERS";

  /** Number of orders being filled */
  orderCount?: number;

  /** Fill amounts per order */
  fillAmounts?: string[];
}

/**
 * Decoded order cancellation
 */
export interface DecodedCancelOrder extends DecodedInteraction {
  type: "CANCEL_ORDER" | "CANCEL_ORDERS";

  /** Number of orders being cancelled (for batch) */
  orderCount?: number;
}

/**
 * Decoded position split
 */
export interface DecodedSplitPosition extends DecodedInteraction {
  type: "SPLIT_POSITION";

  /** Collateral token address (USDC) */
  collateralToken?: string;

  /** Parent collection ID */
  parentCollectionId?: string;

  /** Condition ID */
  conditionId?: string;

  /** Amount being split */
  amount?: string;
}

/**
 * Decoded position merge
 */
export interface DecodedMergePositions extends DecodedInteraction {
  type: "MERGE_POSITIONS";

  /** Collateral token address (USDC) */
  collateralToken?: string;

  /** Parent collection ID */
  parentCollectionId?: string;

  /** Condition ID */
  conditionId?: string;

  /** Amount being merged */
  amount?: string;
}

/**
 * Decoded position redemption
 */
export interface DecodedRedeemPositions extends DecodedInteraction {
  type: "REDEEM_POSITIONS";

  /** Collateral token address (USDC) */
  collateralToken?: string;

  /** Parent collection ID */
  parentCollectionId?: string;

  /** Condition ID */
  conditionId?: string;

  /** Index sets being redeemed */
  indexSets?: string[];
}

/**
 * Decoded ERC20 transfer
 */
export interface DecodedTokenTransfer extends DecodedInteraction {
  type: "TOKEN_TRANSFER" | "TOKEN_TRANSFER_FROM";

  /** Sender address (for transferFrom) */
  from?: string;

  /** Recipient address */
  to?: string;

  /** Amount being transferred (raw, needs decimal adjustment) */
  amount?: string;

  /** Token symbol if known */
  tokenSymbol?: string;

  /** Token decimals if known */
  decimals?: number;

  /** Formatted amount with decimals applied */
  formattedAmount?: string;
}

/**
 * Decoded ERC20 approval
 */
export interface DecodedTokenApprove extends DecodedInteraction {
  type: "TOKEN_APPROVE";

  /** Spender address */
  spender?: string;

  /** Approved amount (raw) */
  amount?: string;

  /** Whether this is unlimited approval */
  isUnlimited?: boolean;

  /** Token symbol if known */
  tokenSymbol?: string;
}

/**
 * Decoded ERC1155 transfer (CTF tokens)
 */
export interface DecodedCTFTransfer extends DecodedInteraction {
  type: "CTF_TRANSFER" | "CTF_BATCH_TRANSFER";

  /** Sender address */
  from?: string;

  /** Recipient address */
  to?: string;

  /** Token ID(s) being transferred */
  tokenIds?: string[];

  /** Amount(s) being transferred */
  amounts?: string[];
}

/**
 * Decoded position conversion (NegRisk)
 */
export interface DecodedConvertPositions extends DecodedInteraction {
  type: "CONVERT_POSITIONS";

  /** Market ID */
  marketId?: string;

  /** Index set */
  indexSet?: string;

  /** Amount being converted */
  amount?: string;
}

/**
 * Unknown interaction
 */
export interface DecodedUnknown extends DecodedInteraction {
  type: "UNKNOWN";
}

/**
 * Union type of all decoded interactions
 */
export type AnyDecodedInteraction =
  | DecodedFillOrder
  | DecodedFillOrders
  | DecodedCancelOrder
  | DecodedSplitPosition
  | DecodedMergePositions
  | DecodedRedeemPositions
  | DecodedTokenTransfer
  | DecodedTokenApprove
  | DecodedCTFTransfer
  | DecodedConvertPositions
  | DecodedUnknown;

// ============================================================================
// Decoder Configuration
// ============================================================================

/**
 * Configuration for the contract decoder
 */
export interface ContractDecoderConfig {
  /** Additional contract addresses to recognize */
  additionalContracts?: Record<string, string>;

  /** Whether to attempt parameter decoding (default: true) */
  decodeParameters?: boolean;

  /** Whether to log decoding operations (default: false) */
  debug?: boolean;

  /** Custom logger */
  logger?: ContractDecoderLogger;
}

/**
 * Logger interface for the decoder
 */
export interface ContractDecoderLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

// ============================================================================
// Contract Decoder Class
// ============================================================================

/**
 * Decoder for Polymarket smart contract interactions
 */
export class ContractDecoder {
  private readonly config: Required<ContractDecoderConfig>;
  private readonly logger: ContractDecoderLogger;
  private readonly contractAddresses: Map<string, PolymarketContractName>;
  private readonly functionSelectorMap: Map<string, { name: string; type: DecodedInteractionType }>;

  constructor(config: ContractDecoderConfig = {}) {
    const debug = config.debug ?? false;
    this.config = {
      additionalContracts: config.additionalContracts ?? {},
      decodeParameters: config.decodeParameters ?? true,
      debug,
      logger: config.logger ?? this.createDefaultLogger(debug),
    };

    this.logger = this.config.logger;

    // Build contract address lookup map (lowercase for case-insensitive matching)
    this.contractAddresses = new Map();
    for (const [name, address] of Object.entries(POLYMARKET_CONTRACTS)) {
      this.contractAddresses.set(address.toLowerCase(), name as PolymarketContractName);
    }
    for (const [name, address] of Object.entries(this.config.additionalContracts)) {
      this.contractAddresses.set(address.toLowerCase(), name as PolymarketContractName);
    }

    // Build function selector lookup map
    this.functionSelectorMap = new Map([
      [FUNCTION_SELECTORS.FILL_ORDER, { name: "fillOrder", type: "FILL_ORDER" as const }],
      [FUNCTION_SELECTORS.FILL_ORDERS, { name: "fillOrders", type: "FILL_ORDERS" as const }],
      [FUNCTION_SELECTORS.MATCH_ORDERS, { name: "matchOrders", type: "FILL_ORDER" as const }],
      [FUNCTION_SELECTORS.CANCEL_ORDER, { name: "cancelOrder", type: "CANCEL_ORDER" as const }],
      [FUNCTION_SELECTORS.CANCEL_ORDERS, { name: "cancelOrders", type: "CANCEL_ORDERS" as const }],
      [FUNCTION_SELECTORS.SPLIT_POSITION, { name: "splitPosition", type: "SPLIT_POSITION" as const }],
      [FUNCTION_SELECTORS.MERGE_POSITIONS, { name: "mergePositions", type: "MERGE_POSITIONS" as const }],
      [FUNCTION_SELECTORS.REDEEM_POSITIONS, { name: "redeemPositions", type: "REDEEM_POSITIONS" as const }],
      [FUNCTION_SELECTORS.SAFE_TRANSFER_FROM_1155, { name: "safeTransferFrom", type: "CTF_TRANSFER" as const }],
      [FUNCTION_SELECTORS.SAFE_BATCH_TRANSFER_FROM, { name: "safeBatchTransferFrom", type: "CTF_BATCH_TRANSFER" as const }],
      [FUNCTION_SELECTORS.TRANSFER, { name: "transfer", type: "TOKEN_TRANSFER" as const }],
      [FUNCTION_SELECTORS.TRANSFER_FROM, { name: "transferFrom", type: "TOKEN_TRANSFER_FROM" as const }],
      [FUNCTION_SELECTORS.APPROVE, { name: "approve", type: "TOKEN_APPROVE" as const }],
      [FUNCTION_SELECTORS.NEG_RISK_FILL_ORDER, { name: "fillOrder", type: "FILL_ORDER" as const }],
      [FUNCTION_SELECTORS.CONVERT_POSITIONS, { name: "convertPositions", type: "CONVERT_POSITIONS" as const }],
      [FUNCTION_SELECTORS.CREATE_PROXY_WALLET, { name: "createProxyWallet", type: "CREATE_PROXY_WALLET" as const }],
    ]);
  }

  /**
   * Decode a transaction's contract interaction
   */
  decode(toAddress: string, input: string): AnyDecodedInteraction {
    // Validate inputs
    if (!toAddress || !isAddress(toAddress)) {
      throw new PolygonClientError(`Invalid contract address: ${toAddress}`, "INVALID_ADDRESS");
    }

    if (!input || input.length < 10) {
      // Return unknown for empty or too-short input
      return this.createUnknownInteraction(toAddress, input || "0x");
    }

    const normalizedAddress = getAddress(toAddress).toLowerCase();
    const functionSelector = input.slice(0, 10).toLowerCase();

    // Look up contract name
    const contractName = this.contractAddresses.get(normalizedAddress);
    const isPolymarketContract = !!contractName;

    // Look up function info
    const functionInfo = this.functionSelectorMap.get(functionSelector);

    if (this.config.debug) {
      this.logger.debug(`Decoding: contract=${normalizedAddress}, selector=${functionSelector}`);
    }

    // Create base interaction
    const base: Omit<DecodedInteraction, "type"> = {
      contractAddress: getAddress(toAddress),
      contractName,
      functionSelector,
      functionName: functionInfo?.name ?? "unknown",
      rawInput: input,
      isPolymarketContract,
    };

    // If function is unknown, return unknown interaction
    if (!functionInfo) {
      return { ...base, type: "UNKNOWN" } as DecodedUnknown;
    }

    // Decode based on function type
    if (!this.config.decodeParameters) {
      return { ...base, type: functionInfo.type } as AnyDecodedInteraction;
    }

    try {
      switch (functionInfo.type) {
        case "FILL_ORDER":
          return this.decodeFillOrder(base, input);
        case "FILL_ORDERS":
          return this.decodeFillOrders(base, input);
        case "CANCEL_ORDER":
        case "CANCEL_ORDERS":
          return this.decodeCancelOrder(base, input, functionInfo.type);
        case "SPLIT_POSITION":
          return this.decodeSplitPosition(base, input);
        case "MERGE_POSITIONS":
          return this.decodeMergePositions(base, input);
        case "REDEEM_POSITIONS":
          return this.decodeRedeemPositions(base, input);
        case "TOKEN_TRANSFER":
          return this.decodeTokenTransfer(base, input, normalizedAddress);
        case "TOKEN_TRANSFER_FROM":
          return this.decodeTokenTransferFrom(base, input, normalizedAddress);
        case "TOKEN_APPROVE":
          return this.decodeTokenApprove(base, input, normalizedAddress);
        case "CTF_TRANSFER":
          return this.decodeCTFTransfer(base, input);
        case "CTF_BATCH_TRANSFER":
          return this.decodeCTFBatchTransfer(base, input);
        case "CONVERT_POSITIONS":
          return this.decodeConvertPositions(base, input);
        default:
          return { ...base, type: functionInfo.type } as AnyDecodedInteraction;
      }
    } catch (error) {
      if (this.config.debug) {
        this.logger.warn(`Failed to decode parameters: ${(error as Error).message}`);
      }
      return { ...base, type: functionInfo.type } as AnyDecodedInteraction;
    }
  }

  /**
   * Check if an address is a known Polymarket contract
   */
  isPolymarketContract(address: string): boolean {
    if (!address || !this.isValidAddressFormat(address)) {
      return false;
    }
    return this.contractAddresses.has(address.toLowerCase());
  }

  /**
   * Get the contract name for an address
   */
  getContractName(address: string): PolymarketContractName | undefined {
    if (!address || !this.isValidAddressFormat(address)) {
      return undefined;
    }
    return this.contractAddresses.get(address.toLowerCase());
  }

  /**
   * Check if a string is a valid Ethereum address format (case-insensitive)
   */
  private isValidAddressFormat(address: string): boolean {
    // Use viem's isAddress with lowercase (accepts any case)
    return isAddress(address.toLowerCase());
  }

  /**
   * Get function info from a selector
   */
  getFunctionInfo(selector: string): { name: string; type: DecodedInteractionType } | undefined {
    return this.functionSelectorMap.get(selector.toLowerCase());
  }

  /**
   * Batch decode multiple transactions
   */
  batchDecode(
    transactions: Array<{ to: string; input: string }>
  ): AnyDecodedInteraction[] {
    return transactions.map((tx) => this.decode(tx.to, tx.input));
  }

  /**
   * Filter decoded interactions by type
   */
  filterByType<T extends AnyDecodedInteraction>(
    interactions: AnyDecodedInteraction[],
    types: DecodedInteractionType[]
  ): T[] {
    return interactions.filter((i) => types.includes(i.type)) as T[];
  }

  /**
   * Get only Polymarket interactions from a list
   */
  filterPolymarketOnly(
    interactions: AnyDecodedInteraction[]
  ): AnyDecodedInteraction[] {
    return interactions.filter((i) => i.isPolymarketContract);
  }

  // ==========================================================================
  // Private Decoding Methods
  // ==========================================================================

  private createUnknownInteraction(
    address: string,
    input: string
  ): DecodedUnknown {
    const normalizedAddress = isAddress(address) ? getAddress(address) : address;
    const contractName = this.contractAddresses.get(normalizedAddress.toLowerCase());
    return {
      type: "UNKNOWN",
      contractAddress: normalizedAddress,
      contractName,
      functionSelector: input.length >= 10 ? input.slice(0, 10).toLowerCase() : "0x",
      functionName: "unknown",
      rawInput: input,
      isPolymarketContract: !!contractName,
    };
  }

  private decodeFillOrder(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedFillOrder {
    const result: DecodedFillOrder = {
      ...base,
      type: "FILL_ORDER",
    };

    // The fill order input contains the order struct and fill amount
    // Order struct typically has: tokenId, maker, side, price, size, etc.
    // Full ABI decoding would require ethers.js AbiCoder or viem's decodeAbiParameters
    // For now, extract what we can from raw hex

    const data = input.slice(10); // Remove function selector

    // First word after selector is often an offset to the order struct
    // Due to complexity of struct encoding, we'll extract basic info
    if (data.length >= 256) {
      // Attempt to extract tokenId from typical position (varies by ABI)
      // This is a simplified extraction - real implementation would use ABI decoding
      const potentialTokenId = "0x" + data.slice(0, 64);
      if (potentialTokenId !== "0x" + "0".repeat(64)) {
        result.tokenId = potentialTokenId;
      }
    }

    return result;
  }

  private decodeFillOrders(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedFillOrders {
    const result: DecodedFillOrders = {
      ...base,
      type: "FILL_ORDERS",
    };

    const data = input.slice(10);

    // For arrays, first word is typically offset to array, then length
    if (data.length >= 128) {
      // Try to extract order count from array length position
      const offsetWord = data.slice(0, 64);
      const offset = parseInt(offsetWord, 16);

      if (offset > 0 && offset * 2 < data.length) {
        const lengthPos = offset * 2;
        const lengthWord = data.slice(lengthPos, lengthPos + 64);
        const length = parseInt(lengthWord, 16);

        if (length > 0 && length < 1000) {
          result.orderCount = length;
        }
      }
    }

    return result;
  }

  private decodeCancelOrder(
    base: Omit<DecodedInteraction, "type">,
    input: string,
    type: "CANCEL_ORDER" | "CANCEL_ORDERS"
  ): DecodedCancelOrder {
    const result: DecodedCancelOrder = {
      ...base,
      type,
    };

    if (type === "CANCEL_ORDERS") {
      const data = input.slice(10);
      // Try to extract order count
      if (data.length >= 128) {
        const offsetWord = data.slice(0, 64);
        const offset = parseInt(offsetWord, 16);

        if (offset > 0 && offset * 2 < data.length) {
          const lengthPos = offset * 2;
          const lengthWord = data.slice(lengthPos, lengthPos + 64);
          const length = parseInt(lengthWord, 16);

          if (length > 0 && length < 1000) {
            result.orderCount = length;
          }
        }
      }
    } else {
      result.orderCount = 1;
    }

    return result;
  }

  private decodeSplitPosition(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedSplitPosition {
    const result: DecodedSplitPosition = {
      ...base,
      type: "SPLIT_POSITION",
    };

    const data = input.slice(10);

    // splitPosition(IERC20,bytes32,bytes32,uint256[],uint256)
    // Params: collateralToken, parentCollectionId, conditionId, partition, amount
    if (data.length >= 320) {
      // Collateral token is first parameter (address, left-padded to 32 bytes)
      const collateralWord = data.slice(0, 64);
      const collateralAddr = "0x" + collateralWord.slice(24);
      if (isAddress(collateralAddr)) {
        result.collateralToken = getAddress(collateralAddr);
      }

      // Parent collection ID (bytes32)
      result.parentCollectionId = "0x" + data.slice(64, 128);

      // Condition ID (bytes32)
      result.conditionId = "0x" + data.slice(128, 192);

      // Amount is the last parameter (but array offset complicates this)
      // For simplicity, try to get amount from expected position
      if (data.length >= 320) {
        const amountWord = data.slice(256, 320);
        const amount = BigInt("0x" + amountWord);
        if (amount > 0n) {
          result.amount = amount.toString();
        }
      }
    }

    return result;
  }

  private decodeMergePositions(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedMergePositions {
    const result: DecodedMergePositions = {
      ...base,
      type: "MERGE_POSITIONS",
    };

    const data = input.slice(10);

    // Same structure as splitPosition
    if (data.length >= 320) {
      const collateralWord = data.slice(0, 64);
      const collateralAddr = "0x" + collateralWord.slice(24);
      if (isAddress(collateralAddr)) {
        result.collateralToken = getAddress(collateralAddr);
      }

      result.parentCollectionId = "0x" + data.slice(64, 128);
      result.conditionId = "0x" + data.slice(128, 192);

      if (data.length >= 320) {
        const amountWord = data.slice(256, 320);
        const amount = BigInt("0x" + amountWord);
        if (amount > 0n) {
          result.amount = amount.toString();
        }
      }
    }

    return result;
  }

  private decodeRedeemPositions(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedRedeemPositions {
    const result: DecodedRedeemPositions = {
      ...base,
      type: "REDEEM_POSITIONS",
    };

    const data = input.slice(10);

    // redeemPositions(IERC20,bytes32,bytes32,uint256[])
    if (data.length >= 192) {
      const collateralWord = data.slice(0, 64);
      const collateralAddr = "0x" + collateralWord.slice(24);
      if (isAddress(collateralAddr)) {
        result.collateralToken = getAddress(collateralAddr);
      }

      result.parentCollectionId = "0x" + data.slice(64, 128);
      result.conditionId = "0x" + data.slice(128, 192);
    }

    return result;
  }

  private decodeTokenTransfer(
    base: Omit<DecodedInteraction, "type">,
    input: string,
    contractAddress: string
  ): DecodedTokenTransfer {
    const result: DecodedTokenTransfer = {
      ...base,
      type: "TOKEN_TRANSFER",
    };

    const data = input.slice(10);

    // transfer(address,uint256)
    if (data.length >= 128) {
      const toWord = data.slice(0, 64);
      const toAddr = "0x" + toWord.slice(24);
      if (isAddress(toAddr)) {
        result.to = getAddress(toAddr);
      }

      const amountWord = data.slice(64, 128);
      const amount = BigInt("0x" + amountWord);
      result.amount = amount.toString();

      // Add token info if known
      this.addTokenInfo(result, contractAddress);
    }

    return result;
  }

  private decodeTokenTransferFrom(
    base: Omit<DecodedInteraction, "type">,
    input: string,
    contractAddress: string
  ): DecodedTokenTransfer {
    const result: DecodedTokenTransfer = {
      ...base,
      type: "TOKEN_TRANSFER_FROM",
    };

    const data = input.slice(10);

    // transferFrom(address,address,uint256)
    if (data.length >= 192) {
      const fromWord = data.slice(0, 64);
      const fromAddr = "0x" + fromWord.slice(24);
      if (isAddress(fromAddr)) {
        result.from = getAddress(fromAddr);
      }

      const toWord = data.slice(64, 128);
      const toAddr = "0x" + toWord.slice(24);
      if (isAddress(toAddr)) {
        result.to = getAddress(toAddr);
      }

      const amountWord = data.slice(128, 192);
      const amount = BigInt("0x" + amountWord);
      result.amount = amount.toString();

      // Add token info if known
      this.addTokenInfo(result, contractAddress);
    }

    return result;
  }

  private decodeTokenApprove(
    base: Omit<DecodedInteraction, "type">,
    input: string,
    contractAddress: string
  ): DecodedTokenApprove {
    const result: DecodedTokenApprove = {
      ...base,
      type: "TOKEN_APPROVE",
    };

    const data = input.slice(10);

    // approve(address,uint256)
    if (data.length >= 128) {
      const spenderWord = data.slice(0, 64);
      const spenderAddr = "0x" + spenderWord.slice(24);
      if (isAddress(spenderAddr)) {
        result.spender = getAddress(spenderAddr);
      }

      const amountWord = data.slice(64, 128);
      const amount = BigInt("0x" + amountWord);
      result.amount = amount.toString();

      // Check if unlimited approval (max uint256)
      const maxUint256 = BigInt("0x" + "f".repeat(64));
      result.isUnlimited = amount === maxUint256;

      // Add token symbol if known
      if (contractAddress === POLYMARKET_CONTRACTS.USDC.toLowerCase()) {
        result.tokenSymbol = "USDC";
      } else if (contractAddress === POLYMARKET_CONTRACTS.USDC_E.toLowerCase()) {
        result.tokenSymbol = "USDC.e";
      }
    }

    return result;
  }

  private decodeCTFTransfer(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedCTFTransfer {
    const result: DecodedCTFTransfer = {
      ...base,
      type: "CTF_TRANSFER",
    };

    const data = input.slice(10);

    // safeTransferFrom(address,address,uint256,uint256,bytes)
    if (data.length >= 256) {
      const fromWord = data.slice(0, 64);
      const fromAddr = "0x" + fromWord.slice(24);
      if (isAddress(fromAddr)) {
        result.from = getAddress(fromAddr);
      }

      const toWord = data.slice(64, 128);
      const toAddr = "0x" + toWord.slice(24);
      if (isAddress(toAddr)) {
        result.to = getAddress(toAddr);
      }

      const tokenIdWord = data.slice(128, 192);
      result.tokenIds = [BigInt("0x" + tokenIdWord).toString()];

      const amountWord = data.slice(192, 256);
      result.amounts = [BigInt("0x" + amountWord).toString()];
    }

    return result;
  }

  private decodeCTFBatchTransfer(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedCTFTransfer {
    const result: DecodedCTFTransfer = {
      ...base,
      type: "CTF_BATCH_TRANSFER",
    };

    const data = input.slice(10);

    // safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)
    if (data.length >= 128) {
      const fromWord = data.slice(0, 64);
      const fromAddr = "0x" + fromWord.slice(24);
      if (isAddress(fromAddr)) {
        result.from = getAddress(fromAddr);
      }

      const toWord = data.slice(64, 128);
      const toAddr = "0x" + toWord.slice(24);
      if (isAddress(toAddr)) {
        result.to = getAddress(toAddr);
      }

      // Arrays are more complex to decode without full ABI support
      // The offsets point to array locations
      result.tokenIds = [];
      result.amounts = [];
    }

    return result;
  }

  private decodeConvertPositions(
    base: Omit<DecodedInteraction, "type">,
    input: string
  ): DecodedConvertPositions {
    const result: DecodedConvertPositions = {
      ...base,
      type: "CONVERT_POSITIONS",
    };

    const data = input.slice(10);

    // convertPositions(bytes32,uint256,uint256)
    if (data.length >= 192) {
      result.marketId = "0x" + data.slice(0, 64);

      const indexSetWord = data.slice(64, 128);
      result.indexSet = BigInt("0x" + indexSetWord).toString();

      const amountWord = data.slice(128, 192);
      result.amount = BigInt("0x" + amountWord).toString();
    }

    return result;
  }

  private addTokenInfo(result: DecodedTokenTransfer, contractAddress: string): void {
    if (contractAddress === POLYMARKET_CONTRACTS.USDC.toLowerCase()) {
      result.tokenSymbol = "USDC";
      result.decimals = 6;
      if (result.amount) {
        const formatted = Number(BigInt(result.amount)) / 1e6;
        result.formattedAmount = formatted.toFixed(6);
      }
    } else if (contractAddress === POLYMARKET_CONTRACTS.USDC_E.toLowerCase()) {
      result.tokenSymbol = "USDC.e";
      result.decimals = 6;
      if (result.amount) {
        const formatted = Number(BigInt(result.amount)) / 1e6;
        result.formattedAmount = formatted.toFixed(6);
      }
    }
  }

  private createDefaultLogger(debug: boolean): ContractDecoderLogger {
    const noop = () => {};
    return {
      debug: debug ? console.log.bind(console, "[ContractDecoder]") : noop,
      info: console.log.bind(console, "[ContractDecoder]"),
      warn: console.warn.bind(console, "[ContractDecoder]"),
      error: console.error.bind(console, "[ContractDecoder]"),
    };
  }
}

// ============================================================================
// Singleton Management and Convenience Functions
// ============================================================================

let sharedDecoder: ContractDecoder | null = null;

/**
 * Create a new ContractDecoder instance
 */
export function createContractDecoder(
  config?: ContractDecoderConfig
): ContractDecoder {
  return new ContractDecoder(config);
}

/**
 * Get the shared ContractDecoder instance
 */
export function getSharedContractDecoder(): ContractDecoder {
  if (!sharedDecoder) {
    sharedDecoder = new ContractDecoder();
  }
  return sharedDecoder;
}

/**
 * Set the shared ContractDecoder instance
 */
export function setSharedContractDecoder(decoder: ContractDecoder): void {
  sharedDecoder = decoder;
}

/**
 * Reset the shared ContractDecoder instance
 */
export function resetSharedContractDecoder(): void {
  sharedDecoder = null;
}

/**
 * Decode a contract interaction (convenience function)
 */
export function decodeContractInteraction(
  toAddress: string,
  input: string,
  decoder?: ContractDecoder
): AnyDecodedInteraction {
  const actualDecoder = decoder ?? getSharedContractDecoder();
  return actualDecoder.decode(toAddress, input);
}

/**
 * Batch decode contract interactions (convenience function)
 */
export function batchDecodeContractInteractions(
  transactions: Array<{ to: string; input: string }>,
  decoder?: ContractDecoder
): AnyDecodedInteraction[] {
  const actualDecoder = decoder ?? getSharedContractDecoder();
  return actualDecoder.batchDecode(transactions);
}

/**
 * Check if an address is a Polymarket contract (convenience function)
 */
export function isPolymarketContract(
  address: string,
  decoder?: ContractDecoder
): boolean {
  const actualDecoder = decoder ?? getSharedContractDecoder();
  return actualDecoder.isPolymarketContract(address);
}

/**
 * Get contract name for an address (convenience function)
 */
export function getPolymarketContractName(
  address: string,
  decoder?: ContractDecoder
): PolymarketContractName | undefined {
  const actualDecoder = decoder ?? getSharedContractDecoder();
  return actualDecoder.getContractName(address);
}
