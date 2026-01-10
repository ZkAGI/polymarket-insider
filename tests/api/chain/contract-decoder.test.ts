/**
 * Tests for Contract Decoder API (API-CHAIN-006)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ContractDecoder,
  createContractDecoder,
  getSharedContractDecoder,
  setSharedContractDecoder,
  resetSharedContractDecoder,
  decodeContractInteraction,
  batchDecodeContractInteractions,
  isPolymarketContract,
  getPolymarketContractName,
  POLYMARKET_CONTRACTS,
  FUNCTION_SELECTORS,
  type DecodedFillOrder,
  type DecodedFillOrders,
  type DecodedCancelOrder,
  type DecodedSplitPosition,
  type DecodedMergePositions,
  type DecodedRedeemPositions,
  type DecodedTokenTransfer,
  type DecodedTokenApprove,
  type DecodedCTFTransfer,
  type DecodedConvertPositions,
  type DecodedUnknown,
  type AnyDecodedInteraction,
} from "../../../src/api/chain";

// ============================================================================
// Test Fixtures
// ============================================================================

// Valid Ethereum address for testing
const validAddress = "0x742d35cc6634c0532925a3b844bc9e7595f8b123";
const validAddress2 = "0x742d35cc6634c0532925a3b844bc9e7595f8b456";

// CTF Exchange address (lowercase for comparison)
const ctfExchangeAddress = POLYMARKET_CONTRACTS.CTF_EXCHANGE;
const usdcAddress = POLYMARKET_CONTRACTS.USDC;
const conditionalTokensAddress = POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS;

// Sample function inputs
const sampleInputs = {
  // transfer(address,uint256) - 0xa9059cbb
  transfer: `${FUNCTION_SELECTORS.TRANSFER}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b456"}${"0000000000000000000000000000000000000000000000000000000000989680"}`, // to=validAddress2, amount=10000000 (10 USDC)

  // transferFrom(address,address,uint256) - 0x23b872dd
  transferFrom: `${FUNCTION_SELECTORS.TRANSFER_FROM}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b123"}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b456"}${"0000000000000000000000000000000000000000000000000000000001312d00"}`, // from=validAddress, to=validAddress2, amount=20000000 (20 USDC)

  // approve(address,uint256) - 0x095ea7b3
  approve: `${FUNCTION_SELECTORS.APPROVE}${"0000000000000000000000004bfb41d5b3570defd03c39a9a4d8de6bd8b8982e"}${"0000000000000000000000000000000000000000000000000000000005f5e100"}`, // spender=CTF Exchange, amount=100000000 (100 USDC)

  // approve unlimited
  approveUnlimited: `${FUNCTION_SELECTORS.APPROVE}${"0000000000000000000000004bfb41d5b3570defd03c39a9a4d8de6bd8b8982e"}${"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}`, // max uint256

  // fillOrder - 0x64a3d249
  fillOrder: `${FUNCTION_SELECTORS.FILL_ORDER}${"0".repeat(64)}${"0".repeat(64)}${"0".repeat(64)}${"0".repeat(64)}`,

  // fillOrders (batch) - 0xd798eff6
  fillOrders: `${FUNCTION_SELECTORS.FILL_ORDERS}${"0000000000000000000000000000000000000000000000000000000000000060"}${"0".repeat(64)}${"0".repeat(64)}${"0000000000000000000000000000000000000000000000000000000000000003"}`, // 3 orders

  // cancelOrder - 0x2e1a7d4d
  cancelOrder: `${FUNCTION_SELECTORS.CANCEL_ORDER}${"0".repeat(64)}${"0".repeat(64)}`,

  // cancelOrders (batch) - 0x4e71e0c8
  // ABI encoding: offset (0x20 = 32 bytes) points to array length, then array elements
  cancelOrders: `${FUNCTION_SELECTORS.CANCEL_ORDERS}${"0000000000000000000000000000000000000000000000000000000000000020"}${"0000000000000000000000000000000000000000000000000000000000000002"}${"0".repeat(64)}${"0".repeat(64)}`, // 2 orders

  // splitPosition - 0x72ce4275
  splitPosition: `${FUNCTION_SELECTORS.SPLIT_POSITION}${"0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174"}${"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}${"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"}${"0000000000000000000000000000000000000000000000000000000000000080"}${"0000000000000000000000000000000000000000000000000000000005f5e100"}`, // collateral=USDC, amount=100000000

  // mergePositions - 0x4374f3a0
  mergePositions: `${FUNCTION_SELECTORS.MERGE_POSITIONS}${"0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174"}${"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}${"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"}${"0000000000000000000000000000000000000000000000000000000000000080"}${"0000000000000000000000000000000000000000000000000000000002faf080"}`, // amount=50000000

  // redeemPositions - 0xe6f85d95
  redeemPositions: `${FUNCTION_SELECTORS.REDEEM_POSITIONS}${"0000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174"}${"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}${"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"}`,

  // safeTransferFrom (ERC1155) - 0xf242432a
  ctfTransfer: `${FUNCTION_SELECTORS.SAFE_TRANSFER_FROM_1155}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b123"}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b456"}${"0000000000000000000000000000000000000000000000000000000000000001"}${"00000000000000000000000000000000000000000000000000000000000003e8"}`, // tokenId=1, amount=1000

  // safeBatchTransferFrom (ERC1155) - 0x2eb2c2d6
  ctfBatchTransfer: `${FUNCTION_SELECTORS.SAFE_BATCH_TRANSFER_FROM}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b123"}${"000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f8b456"}${"0".repeat(64)}${"0".repeat(64)}`,

  // convertPositions - 0xfb63544e
  convertPositions: `${FUNCTION_SELECTORS.CONVERT_POSITIONS}${"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"}${"0000000000000000000000000000000000000000000000000000000000000001"}${"0000000000000000000000000000000000000000000000000000000005f5e100"}`,

  // Unknown function
  unknown: "0xdeadbeef" + "0".repeat(64),

  // Empty/short input
  empty: "0x",
  short: "0x1234",
};

// ============================================================================
// Tests
// ============================================================================

describe("ContractDecoder", () => {
  let decoder: ContractDecoder;

  beforeEach(() => {
    decoder = new ContractDecoder();
    resetSharedContractDecoder();
  });

  afterEach(() => {
    resetSharedContractDecoder();
  });

  describe("constructor", () => {
    it("should create decoder with default configuration", () => {
      const d = new ContractDecoder();
      expect(d).toBeDefined();
    });

    it("should create decoder with custom configuration", () => {
      const d = new ContractDecoder({
        decodeParameters: false,
        debug: true,
      });
      expect(d).toBeDefined();
    });

    it("should accept additional contract addresses", () => {
      const customAddress = "0x1234567890123456789012345678901234567890";
      const d = new ContractDecoder({
        additionalContracts: {
          CUSTOM_CONTRACT: customAddress,
        },
      });
      expect(d.isPolymarketContract(customAddress)).toBe(true);
    });

    it("should accept custom logger", () => {
      const logs: string[] = [];
      const customLogger = {
        debug: (msg: string) => logs.push(`debug: ${msg}`),
        info: (msg: string) => logs.push(`info: ${msg}`),
        warn: (msg: string) => logs.push(`warn: ${msg}`),
        error: (msg: string) => logs.push(`error: ${msg}`),
      };
      const d = new ContractDecoder({ logger: customLogger, debug: true });
      d.decode(ctfExchangeAddress, sampleInputs.fillOrder);
      expect(logs.some((l) => l.includes("debug:"))).toBe(true);
    });
  });

  describe("isPolymarketContract", () => {
    it("should return true for CTF Exchange address", () => {
      expect(decoder.isPolymarketContract(ctfExchangeAddress)).toBe(true);
    });

    it("should return true for USDC address", () => {
      expect(decoder.isPolymarketContract(usdcAddress)).toBe(true);
    });

    it("should return true for Conditional Tokens address", () => {
      expect(decoder.isPolymarketContract(conditionalTokensAddress)).toBe(true);
    });

    it("should return true for NegRisk CTF Exchange", () => {
      expect(decoder.isPolymarketContract(POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE)).toBe(true);
    });

    it("should return false for unknown address", () => {
      expect(decoder.isPolymarketContract(validAddress)).toBe(false);
    });

    it("should handle case-insensitive addresses", () => {
      expect(decoder.isPolymarketContract(ctfExchangeAddress.toLowerCase())).toBe(true);
      expect(decoder.isPolymarketContract(ctfExchangeAddress.toUpperCase())).toBe(true);
    });

    it("should return false for invalid address", () => {
      expect(decoder.isPolymarketContract("invalid")).toBe(false);
      expect(decoder.isPolymarketContract("")).toBe(false);
    });
  });

  describe("getContractName", () => {
    it("should return contract name for CTF Exchange", () => {
      expect(decoder.getContractName(ctfExchangeAddress)).toBe("CTF_EXCHANGE");
    });

    it("should return contract name for USDC", () => {
      expect(decoder.getContractName(usdcAddress)).toBe("USDC");
    });

    it("should return undefined for unknown address", () => {
      expect(decoder.getContractName(validAddress)).toBeUndefined();
    });

    it("should return undefined for invalid address", () => {
      expect(decoder.getContractName("invalid")).toBeUndefined();
    });
  });

  describe("getFunctionInfo", () => {
    it("should return info for transfer selector", () => {
      const info = decoder.getFunctionInfo(FUNCTION_SELECTORS.TRANSFER);
      expect(info).toBeDefined();
      expect(info?.name).toBe("transfer");
      expect(info?.type).toBe("TOKEN_TRANSFER");
    });

    it("should return info for fillOrder selector", () => {
      const info = decoder.getFunctionInfo(FUNCTION_SELECTORS.FILL_ORDER);
      expect(info).toBeDefined();
      expect(info?.name).toBe("fillOrder");
      expect(info?.type).toBe("FILL_ORDER");
    });

    it("should return undefined for unknown selector", () => {
      expect(decoder.getFunctionInfo("0xdeadbeef")).toBeUndefined();
    });

    it("should handle case-insensitive selectors", () => {
      expect(decoder.getFunctionInfo(FUNCTION_SELECTORS.TRANSFER.toUpperCase())).toBeDefined();
    });
  });

  describe("decode - ERC20 transfers", () => {
    it("should decode transfer to USDC", () => {
      const result = decoder.decode(usdcAddress, sampleInputs.transfer) as DecodedTokenTransfer;
      expect(result.type).toBe("TOKEN_TRANSFER");
      expect(result.functionName).toBe("transfer");
      expect(result.isPolymarketContract).toBe(true);
      expect(result.to?.toLowerCase()).toBe(validAddress2.toLowerCase());
      expect(result.amount).toBe("10000000");
      expect(result.tokenSymbol).toBe("USDC");
      expect(result.decimals).toBe(6);
      expect(result.formattedAmount).toBe("10.000000");
    });

    it("should decode transferFrom to USDC", () => {
      const result = decoder.decode(usdcAddress, sampleInputs.transferFrom) as DecodedTokenTransfer;
      expect(result.type).toBe("TOKEN_TRANSFER_FROM");
      expect(result.functionName).toBe("transferFrom");
      expect(result.from?.toLowerCase()).toBe(validAddress.toLowerCase());
      expect(result.to?.toLowerCase()).toBe(validAddress2.toLowerCase());
      expect(result.amount).toBe("20000000");
    });

    it("should decode transfer to unknown token without token info", () => {
      const result = decoder.decode(validAddress, sampleInputs.transfer) as DecodedTokenTransfer;
      expect(result.type).toBe("TOKEN_TRANSFER");
      expect(result.tokenSymbol).toBeUndefined();
      expect(result.decimals).toBeUndefined();
      expect(result.isPolymarketContract).toBe(false);
    });

    it("should decode transfer to USDC.e", () => {
      const result = decoder.decode(POLYMARKET_CONTRACTS.USDC_E, sampleInputs.transfer) as DecodedTokenTransfer;
      expect(result.tokenSymbol).toBe("USDC.e");
      expect(result.decimals).toBe(6);
    });
  });

  describe("decode - ERC20 approve", () => {
    it("should decode approve", () => {
      const result = decoder.decode(usdcAddress, sampleInputs.approve) as DecodedTokenApprove;
      expect(result.type).toBe("TOKEN_APPROVE");
      expect(result.functionName).toBe("approve");
      expect(result.spender?.toLowerCase()).toBe(ctfExchangeAddress.toLowerCase());
      expect(result.amount).toBe("100000000");
      expect(result.isUnlimited).toBe(false);
      expect(result.tokenSymbol).toBe("USDC");
    });

    it("should detect unlimited approval", () => {
      const result = decoder.decode(usdcAddress, sampleInputs.approveUnlimited) as DecodedTokenApprove;
      expect(result.type).toBe("TOKEN_APPROVE");
      expect(result.isUnlimited).toBe(true);
    });
  });

  describe("decode - CTF Exchange orders", () => {
    it("should decode fillOrder", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.fillOrder) as DecodedFillOrder;
      expect(result.type).toBe("FILL_ORDER");
      expect(result.functionName).toBe("fillOrder");
      expect(result.isPolymarketContract).toBe(true);
      expect(result.contractName).toBe("CTF_EXCHANGE");
    });

    it("should decode fillOrders (batch)", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.fillOrders) as DecodedFillOrders;
      expect(result.type).toBe("FILL_ORDERS");
      expect(result.functionName).toBe("fillOrders");
      expect(result.orderCount).toBe(3);
    });

    it("should decode cancelOrder", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.cancelOrder) as DecodedCancelOrder;
      expect(result.type).toBe("CANCEL_ORDER");
      expect(result.functionName).toBe("cancelOrder");
      expect(result.orderCount).toBe(1);
    });

    it("should decode cancelOrders (batch)", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.cancelOrders) as DecodedCancelOrder;
      expect(result.type).toBe("CANCEL_ORDERS");
      expect(result.functionName).toBe("cancelOrders");
      expect(result.orderCount).toBe(2);
    });
  });

  describe("decode - Conditional Token operations", () => {
    it("should decode splitPosition", () => {
      const result = decoder.decode(conditionalTokensAddress, sampleInputs.splitPosition) as DecodedSplitPosition;
      expect(result.type).toBe("SPLIT_POSITION");
      expect(result.functionName).toBe("splitPosition");
      expect(result.collateralToken?.toLowerCase()).toBe(usdcAddress.toLowerCase());
      expect(result.parentCollectionId).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      expect(result.conditionId).toBe("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
      expect(result.amount).toBe("100000000");
    });

    it("should decode mergePositions", () => {
      const result = decoder.decode(conditionalTokensAddress, sampleInputs.mergePositions) as DecodedMergePositions;
      expect(result.type).toBe("MERGE_POSITIONS");
      expect(result.functionName).toBe("mergePositions");
      expect(result.collateralToken?.toLowerCase()).toBe(usdcAddress.toLowerCase());
      expect(result.amount).toBe("50000000");
    });

    it("should decode redeemPositions", () => {
      const result = decoder.decode(conditionalTokensAddress, sampleInputs.redeemPositions) as DecodedRedeemPositions;
      expect(result.type).toBe("REDEEM_POSITIONS");
      expect(result.functionName).toBe("redeemPositions");
      expect(result.collateralToken?.toLowerCase()).toBe(usdcAddress.toLowerCase());
    });
  });

  describe("decode - CTF (ERC1155) transfers", () => {
    it("should decode safeTransferFrom (single)", () => {
      const result = decoder.decode(conditionalTokensAddress, sampleInputs.ctfTransfer) as DecodedCTFTransfer;
      expect(result.type).toBe("CTF_TRANSFER");
      expect(result.functionName).toBe("safeTransferFrom");
      expect(result.from?.toLowerCase()).toBe(validAddress.toLowerCase());
      expect(result.to?.toLowerCase()).toBe(validAddress2.toLowerCase());
      expect(result.tokenIds).toEqual(["1"]);
      expect(result.amounts).toEqual(["1000"]);
    });

    it("should decode safeBatchTransferFrom", () => {
      const result = decoder.decode(conditionalTokensAddress, sampleInputs.ctfBatchTransfer) as DecodedCTFTransfer;
      expect(result.type).toBe("CTF_BATCH_TRANSFER");
      expect(result.functionName).toBe("safeBatchTransferFrom");
      expect(result.from?.toLowerCase()).toBe(validAddress.toLowerCase());
      expect(result.to?.toLowerCase()).toBe(validAddress2.toLowerCase());
    });
  });

  describe("decode - NegRisk Exchange", () => {
    it("should decode convertPositions", () => {
      const result = decoder.decode(POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE, sampleInputs.convertPositions) as DecodedConvertPositions;
      expect(result.type).toBe("CONVERT_POSITIONS");
      expect(result.functionName).toBe("convertPositions");
      expect(result.marketId).toBe("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
      expect(result.indexSet).toBe("1");
      expect(result.amount).toBe("100000000");
    });
  });

  describe("decode - Unknown/edge cases", () => {
    it("should return UNKNOWN for unknown function selector", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.unknown) as DecodedUnknown;
      expect(result.type).toBe("UNKNOWN");
      expect(result.functionName).toBe("unknown");
      expect(result.functionSelector).toBe("0xdeadbeef");
      expect(result.isPolymarketContract).toBe(true);
    });

    it("should return UNKNOWN for empty input", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.empty) as DecodedUnknown;
      expect(result.type).toBe("UNKNOWN");
    });

    it("should return UNKNOWN for short input", () => {
      const result = decoder.decode(ctfExchangeAddress, sampleInputs.short) as DecodedUnknown;
      expect(result.type).toBe("UNKNOWN");
    });

    it("should throw for invalid address", () => {
      expect(() => decoder.decode("invalid", sampleInputs.transfer)).toThrow();
    });

    it("should handle null/undefined input gracefully", () => {
      const result = decoder.decode(ctfExchangeAddress, null as unknown as string);
      expect(result.type).toBe("UNKNOWN");
    });
  });

  describe("decode - without parameter decoding", () => {
    it("should skip parameter decoding when disabled", () => {
      const d = new ContractDecoder({ decodeParameters: false });
      const result = d.decode(usdcAddress, sampleInputs.transfer) as DecodedTokenTransfer;
      expect(result.type).toBe("TOKEN_TRANSFER");
      expect(result.to).toBeUndefined();
      expect(result.amount).toBeUndefined();
    });
  });

  describe("batchDecode", () => {
    it("should decode multiple transactions", () => {
      const transactions = [
        { to: usdcAddress, input: sampleInputs.transfer },
        { to: ctfExchangeAddress, input: sampleInputs.fillOrder },
        { to: validAddress, input: sampleInputs.unknown },
      ];

      const results = decoder.batchDecode(transactions);
      expect(results).toHaveLength(3);
      expect(results[0]?.type).toBe("TOKEN_TRANSFER");
      expect(results[1]?.type).toBe("FILL_ORDER");
      expect(results[2]?.type).toBe("UNKNOWN");
    });

    it("should handle empty array", () => {
      const results = decoder.batchDecode([]);
      expect(results).toHaveLength(0);
    });
  });

  describe("filterByType", () => {
    it("should filter interactions by type", () => {
      const interactions: AnyDecodedInteraction[] = [
        { type: "TOKEN_TRANSFER", contractAddress: usdcAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: true },
        { type: "FILL_ORDER", contractAddress: ctfExchangeAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: true },
        { type: "TOKEN_TRANSFER", contractAddress: usdcAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: true },
        { type: "UNKNOWN", contractAddress: validAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: false },
      ];

      const transfers = decoder.filterByType(interactions, ["TOKEN_TRANSFER"]);
      expect(transfers).toHaveLength(2);

      const orders = decoder.filterByType(interactions, ["FILL_ORDER", "FILL_ORDERS"]);
      expect(orders).toHaveLength(1);
    });
  });

  describe("filterPolymarketOnly", () => {
    it("should filter to only Polymarket interactions", () => {
      const interactions: AnyDecodedInteraction[] = [
        { type: "TOKEN_TRANSFER", contractAddress: usdcAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: true },
        { type: "TOKEN_TRANSFER", contractAddress: validAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: false },
        { type: "FILL_ORDER", contractAddress: ctfExchangeAddress, functionSelector: "", functionName: "", rawInput: "", isPolymarketContract: true },
      ];

      const polymarketOnly = decoder.filterPolymarketOnly(interactions);
      expect(polymarketOnly).toHaveLength(2);
      expect(polymarketOnly.every((i) => i.isPolymarketContract)).toBe(true);
    });
  });
});

describe("Factory functions", () => {
  beforeEach(() => {
    resetSharedContractDecoder();
  });

  afterEach(() => {
    resetSharedContractDecoder();
  });

  describe("createContractDecoder", () => {
    it("should create new decoder instance", () => {
      const decoder = createContractDecoder();
      expect(decoder).toBeInstanceOf(ContractDecoder);
    });

    it("should create decoder with custom config", () => {
      const decoder = createContractDecoder({ debug: true });
      expect(decoder).toBeInstanceOf(ContractDecoder);
    });
  });

  describe("getSharedContractDecoder", () => {
    it("should return same instance on multiple calls", () => {
      const d1 = getSharedContractDecoder();
      const d2 = getSharedContractDecoder();
      expect(d1).toBe(d2);
    });

    it("should create instance if none exists", () => {
      const decoder = getSharedContractDecoder();
      expect(decoder).toBeInstanceOf(ContractDecoder);
    });
  });

  describe("setSharedContractDecoder", () => {
    it("should set the shared decoder instance", () => {
      const customDecoder = createContractDecoder({ debug: true });
      setSharedContractDecoder(customDecoder);
      expect(getSharedContractDecoder()).toBe(customDecoder);
    });
  });

  describe("resetSharedContractDecoder", () => {
    it("should reset the shared decoder", () => {
      const d1 = getSharedContractDecoder();
      resetSharedContractDecoder();
      const d2 = getSharedContractDecoder();
      expect(d1).not.toBe(d2);
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    resetSharedContractDecoder();
  });

  afterEach(() => {
    resetSharedContractDecoder();
  });

  describe("decodeContractInteraction", () => {
    it("should decode using shared decoder", () => {
      const result = decodeContractInteraction(usdcAddress, sampleInputs.transfer);
      expect(result.type).toBe("TOKEN_TRANSFER");
    });

    it("should decode using custom decoder", () => {
      const customDecoder = createContractDecoder({ decodeParameters: false });
      const result = decodeContractInteraction(usdcAddress, sampleInputs.transfer, customDecoder);
      expect(result.type).toBe("TOKEN_TRANSFER");
      expect((result as DecodedTokenTransfer).to).toBeUndefined();
    });
  });

  describe("batchDecodeContractInteractions", () => {
    it("should batch decode using shared decoder", () => {
      const transactions = [
        { to: usdcAddress, input: sampleInputs.transfer },
        { to: ctfExchangeAddress, input: sampleInputs.fillOrder },
      ];
      const results = batchDecodeContractInteractions(transactions);
      expect(results).toHaveLength(2);
    });

    it("should batch decode using custom decoder", () => {
      const customDecoder = createContractDecoder();
      const transactions = [{ to: usdcAddress, input: sampleInputs.transfer }];
      const results = batchDecodeContractInteractions(transactions, customDecoder);
      expect(results).toHaveLength(1);
    });
  });

  describe("isPolymarketContract (function)", () => {
    it("should check using shared decoder", () => {
      expect(isPolymarketContract(ctfExchangeAddress)).toBe(true);
      expect(isPolymarketContract(validAddress)).toBe(false);
    });

    it("should check using custom decoder", () => {
      const customAddress = "0x1234567890123456789012345678901234567890";
      const customDecoder = createContractDecoder({
        additionalContracts: { CUSTOM: customAddress },
      });
      expect(isPolymarketContract(customAddress, customDecoder)).toBe(true);
      expect(isPolymarketContract(customAddress)).toBe(false);
    });
  });

  describe("getPolymarketContractName (function)", () => {
    it("should get name using shared decoder", () => {
      expect(getPolymarketContractName(ctfExchangeAddress)).toBe("CTF_EXCHANGE");
      expect(getPolymarketContractName(validAddress)).toBeUndefined();
    });

    it("should get name using custom decoder", () => {
      const customDecoder = createContractDecoder();
      expect(getPolymarketContractName(usdcAddress, customDecoder)).toBe("USDC");
    });
  });
});

describe("POLYMARKET_CONTRACTS constant", () => {
  it("should have CTF_EXCHANGE address", () => {
    expect(POLYMARKET_CONTRACTS.CTF_EXCHANGE).toBeDefined();
    expect(POLYMARKET_CONTRACTS.CTF_EXCHANGE.startsWith("0x")).toBe(true);
  });

  it("should have USDC address", () => {
    expect(POLYMARKET_CONTRACTS.USDC).toBeDefined();
    expect(POLYMARKET_CONTRACTS.USDC.startsWith("0x")).toBe(true);
  });

  it("should have CONDITIONAL_TOKENS address", () => {
    expect(POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS).toBeDefined();
    expect(POLYMARKET_CONTRACTS.CONDITIONAL_TOKENS.startsWith("0x")).toBe(true);
  });

  it("should have NEG_RISK_CTF_EXCHANGE address", () => {
    expect(POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE).toBeDefined();
    expect(POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE.startsWith("0x")).toBe(true);
  });

  it("should have all expected contracts", () => {
    const expectedContracts = [
      "CTF_EXCHANGE",
      "NEG_RISK_CTF_EXCHANGE",
      "CONDITIONAL_TOKENS",
      "USDC",
      "USDC_E",
      "PROXY_WALLET_FACTORY",
      "ROUTER",
    ];
    for (const contract of expectedContracts) {
      expect(POLYMARKET_CONTRACTS[contract as keyof typeof POLYMARKET_CONTRACTS]).toBeDefined();
    }
  });
});

describe("FUNCTION_SELECTORS constant", () => {
  it("should have transfer selector", () => {
    expect(FUNCTION_SELECTORS.TRANSFER).toBe("0xa9059cbb");
  });

  it("should have transferFrom selector", () => {
    expect(FUNCTION_SELECTORS.TRANSFER_FROM).toBe("0x23b872dd");
  });

  it("should have approve selector", () => {
    expect(FUNCTION_SELECTORS.APPROVE).toBe("0x095ea7b3");
  });

  it("should have fillOrder selector", () => {
    expect(FUNCTION_SELECTORS.FILL_ORDER).toBe("0x64a3d249");
  });

  it("should have all selectors start with 0x", () => {
    for (const selector of Object.values(FUNCTION_SELECTORS)) {
      expect(selector.startsWith("0x")).toBe(true);
      expect(selector.length).toBe(10); // 0x + 8 hex chars
    }
  });
});

describe("Edge cases and error handling", () => {
  let decoder: ContractDecoder;

  beforeEach(() => {
    decoder = new ContractDecoder();
  });

  it("should handle malformed hex in parameter decoding", () => {
    // Input with valid selector but malformed parameters
    const malformedInput = FUNCTION_SELECTORS.TRANSFER + "xyz123";
    const result = decoder.decode(usdcAddress, malformedInput);
    // Should still return the type but may have missing parameters
    expect(result.type).toBe("TOKEN_TRANSFER");
  });

  it("should handle very long input data", () => {
    const longInput = FUNCTION_SELECTORS.FILL_ORDERS + "0".repeat(10000);
    const result = decoder.decode(ctfExchangeAddress, longInput);
    expect(result.type).toBe("FILL_ORDERS");
  });

  it("should handle minimum valid input (just selector)", () => {
    const result = decoder.decode(usdcAddress, FUNCTION_SELECTORS.TRANSFER);
    expect(result.type).toBe("TOKEN_TRANSFER");
    expect((result as DecodedTokenTransfer).to).toBeUndefined();
  });

  it("should normalize contract addresses to checksum format", () => {
    const result = decoder.decode(ctfExchangeAddress.toLowerCase(), sampleInputs.fillOrder);
    expect(result.contractAddress).toBe(ctfExchangeAddress);
  });

  it("should handle uppercase function selector", () => {
    const uppercaseInput = sampleInputs.transfer.toUpperCase();
    const result = decoder.decode(usdcAddress, uppercaseInput);
    expect(result.type).toBe("TOKEN_TRANSFER");
  });

  it("should handle mixed case input", () => {
    const mixedInput = "0xA9059cBb" + "0".repeat(128);
    const result = decoder.decode(usdcAddress, mixedInput);
    expect(result.type).toBe("TOKEN_TRANSFER");
  });

  it("should decode from non-Polymarket contract with known selector", () => {
    // Using transfer selector on unknown contract
    const result = decoder.decode(validAddress, sampleInputs.transfer) as DecodedTokenTransfer;
    expect(result.type).toBe("TOKEN_TRANSFER");
    expect(result.isPolymarketContract).toBe(false);
    expect(result.contractName).toBeUndefined();
  });
});

describe("Real-world scenarios", () => {
  let decoder: ContractDecoder;

  beforeEach(() => {
    decoder = new ContractDecoder();
  });

  it("should handle a typical Polymarket trading flow", () => {
    // 1. Approve USDC spend
    const approveResult = decoder.decode(usdcAddress, sampleInputs.approve);
    expect(approveResult.type).toBe("TOKEN_APPROVE");

    // 2. Fill an order
    const fillResult = decoder.decode(ctfExchangeAddress, sampleInputs.fillOrder);
    expect(fillResult.type).toBe("FILL_ORDER");

    // 3. Transfer CTF tokens
    const transferResult = decoder.decode(conditionalTokensAddress, sampleInputs.ctfTransfer);
    expect(transferResult.type).toBe("CTF_TRANSFER");
  });

  it("should handle batch operations", () => {
    const transactions = [
      { to: usdcAddress, input: sampleInputs.approve },
      { to: ctfExchangeAddress, input: sampleInputs.fillOrders },
      { to: conditionalTokensAddress, input: sampleInputs.mergePositions },
    ];

    const results = decoder.batchDecode(transactions);

    // Filter to only order-related
    const orderOps = decoder.filterByType(results, ["FILL_ORDER", "FILL_ORDERS", "CANCEL_ORDER", "CANCEL_ORDERS"]);
    expect(orderOps).toHaveLength(1);

    // Filter to position operations
    const positionOps = decoder.filterByType(results, ["SPLIT_POSITION", "MERGE_POSITIONS", "REDEEM_POSITIONS"]);
    expect(positionOps).toHaveLength(1);
  });

  it("should identify all Polymarket interactions from mixed transactions", () => {
    const transactions = [
      { to: usdcAddress, input: sampleInputs.transfer }, // Polymarket USDC
      { to: validAddress, input: sampleInputs.transfer }, // Unknown contract
      { to: ctfExchangeAddress, input: sampleInputs.fillOrder }, // Polymarket CTF
      { to: validAddress2, input: sampleInputs.unknown }, // Unknown contract, unknown function
    ];

    const results = decoder.batchDecode(transactions);
    const polymarketOnly = decoder.filterPolymarketOnly(results);

    expect(results).toHaveLength(4);
    expect(polymarketOnly).toHaveLength(2);
  });
});
