/**
 * Tests for Token Balance API (API-CHAIN-003)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  TokenBalanceClient,
  createTokenBalanceClient,
  getSharedTokenBalanceClient,
  setSharedTokenBalanceClient,
  resetSharedTokenBalanceClient,
  getNativeBalance,
  getTokenBalance,
  getTokenBalances,
  getNFTTokens,
  getERC1155Balances,
  getWalletBalanceSummary,
} from "@/api/chain/balances";
import { PolygonClientError, PolygonscanError } from "@/api/chain/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test addresses
const TEST_WALLET = "0x1234567890123456789012345678901234567890";
const TEST_CONTRACT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

// Helper to create mock response
function createMockResponse<T>(result: T, status = "1", message = "OK"): Response {
  return {
    ok: true,
    json: async () => ({ status, message, result }),
    status: 200,
    statusText: "OK",
  } as Response;
}

function createErrorResponse(statusCode: number, statusText: string): Response {
  return {
    ok: false,
    json: async () => ({}),
    status: statusCode,
    statusText,
  } as Response;
}

describe("TokenBalanceClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTokenBalanceClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("constructor", () => {
    it("should create client with default configuration", () => {
      const client = new TokenBalanceClient();
      expect(client).toBeInstanceOf(TokenBalanceClient);
    });

    it("should create client with custom configuration", () => {
      const client = new TokenBalanceClient({
        apiKey: "test-api-key",
        baseUrl: "https://custom.api.com",
        timeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
      });
      expect(client).toBeInstanceOf(TokenBalanceClient);
    });
  });

  // ============================================================================
  // getNativeBalance Tests
  // ============================================================================

  describe("getNativeBalance", () => {
    it("should fetch native MATIC balance", async () => {
      const client = new TokenBalanceClient();
      const balanceWei = "1000000000000000000"; // 1 MATIC

      mockFetch.mockResolvedValueOnce(createMockResponse(balanceWei));

      const result = await client.getNativeBalance(TEST_WALLET);

      expect(result.balance).toBe(BigInt(balanceWei));
      expect(result.formattedBalance).toBe("1");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]![0]).toContain("action=balance");
    });

    it("should format large balances correctly", async () => {
      const client = new TokenBalanceClient();
      const balanceWei = "123456789012345678901"; // 123.456... MATIC

      mockFetch.mockResolvedValueOnce(createMockResponse(balanceWei));

      const result = await client.getNativeBalance(TEST_WALLET);

      expect(result.balance).toBe(BigInt(balanceWei));
      expect(parseFloat(result.formattedBalance)).toBeCloseTo(123.456789, 4);
    });

    it("should handle zero balance", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(createMockResponse("0"));

      const result = await client.getNativeBalance(TEST_WALLET);

      expect(result.balance).toBe(0n);
      expect(result.formattedBalance).toBe("0");
    });

    it("should throw error for invalid address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getNativeBalance("invalid-address")).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should throw error for empty address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getNativeBalance("")).rejects.toThrow(PolygonClientError);
    });

    it("should include API key in request when provided", async () => {
      const client = new TokenBalanceClient({ apiKey: "test-api-key" });

      mockFetch.mockResolvedValueOnce(createMockResponse("1000000000000000000"));

      await client.getNativeBalance(TEST_WALLET);

      expect(mockFetch.mock.calls[0]![0]).toContain("apikey=test-api-key");
    });
  });

  // ============================================================================
  // getTokenBalance Tests
  // ============================================================================

  describe("getTokenBalance", () => {
    it("should fetch specific token balance", async () => {
      const client = new TokenBalanceClient();
      const balanceWei = "1000000000000000000"; // 1 token

      // Mock token balance request
      mockFetch.mockResolvedValueOnce(createMockResponse(balanceWei));
      // Mock token info request
      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            tokenName: "USD Coin",
            tokenSymbol: "USDC",
            tokenDecimal: "6",
          },
        ])
      );

      const result = await client.getTokenBalance(TEST_WALLET, TEST_CONTRACT);

      expect(result).not.toBeNull();
      expect(result!.balance).toBe(BigInt(balanceWei));
      expect(result!.contractAddress).toBe(
        "0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD"
      ); // Checksummed
    });

    it("should return null for zero balance", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(createMockResponse("0"));

      const result = await client.getTokenBalance(TEST_WALLET, TEST_CONTRACT);

      expect(result).toBeNull();
    });

    it("should throw error for invalid wallet address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getTokenBalance("invalid", TEST_CONTRACT)).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should throw error for invalid contract address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getTokenBalance(TEST_WALLET, "invalid")).rejects.toThrow(
        PolygonClientError
      );
    });

    it("should handle token with 6 decimals (like USDC)", async () => {
      const client = new TokenBalanceClient();
      const balanceWei = "1000000"; // 1 USDC (6 decimals)

      mockFetch.mockResolvedValueOnce(createMockResponse(balanceWei));
      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            tokenName: "USD Coin",
            tokenSymbol: "USDC",
            tokenDecimal: "6",
          },
        ])
      );

      const result = await client.getTokenBalance(TEST_WALLET, TEST_CONTRACT);

      expect(result).not.toBeNull();
      expect(result!.formattedBalance).toBe("1");
      expect(result!.tokenDecimal).toBe(6);
    });

    it("should default to 18 decimals when token info unavailable", async () => {
      const client = new TokenBalanceClient();
      const balanceWei = "1000000000000000000";

      mockFetch.mockResolvedValueOnce(createMockResponse(balanceWei));
      mockFetch.mockResolvedValueOnce(createMockResponse([])); // Empty token info

      const result = await client.getTokenBalance(TEST_WALLET, TEST_CONTRACT);

      expect(result).not.toBeNull();
      expect(result!.tokenDecimal).toBe(18);
      expect(result!.tokenSymbol).toBe("UNKNOWN");
    });
  });

  // ============================================================================
  // getTokenBalances Tests
  // ============================================================================

  describe("getTokenBalances", () => {
    it("should fetch all token balances from transfer history", async () => {
      const client = new TokenBalanceClient();

      // Mock token transfers
      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenName: "Token A",
            tokenSymbol: "TKA",
            tokenDecimal: "18",
          },
          {
            contractAddress: "0x1111111111111111111111111111111111111111",
            tokenName: "Token B",
            tokenSymbol: "TKB",
            tokenDecimal: "8",
          },
        ])
      );
      // Mock balance for Token A
      mockFetch.mockResolvedValueOnce(createMockResponse("5000000000000000000"));
      // Mock balance for Token B
      mockFetch.mockResolvedValueOnce(createMockResponse("100000000"));

      const result = await client.getTokenBalances(TEST_WALLET);

      expect(result).toHaveLength(2);
      expect(result[0]!.tokenSymbol).toBe("TKA");
      expect(result[1]!.tokenSymbol).toBe("TKB");
    });

    it("should skip tokens with zero balance by default", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenName: "Token A",
            tokenSymbol: "TKA",
            tokenDecimal: "18",
          },
        ])
      );
      mockFetch.mockResolvedValueOnce(createMockResponse("0"));

      const result = await client.getTokenBalances(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("should include zero balances when option is set", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenName: "Token A",
            tokenSymbol: "TKA",
            tokenDecimal: "18",
          },
        ])
      );
      mockFetch.mockResolvedValueOnce(createMockResponse("0"));

      const result = await client.getTokenBalances(TEST_WALLET, {
        includeZeroBalances: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.balance).toBe(0n);
    });

    it("should handle pagination options", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      await client.getTokenBalances(TEST_WALLET, {
        page: 2,
        pageSize: 50,
        sort: "asc",
      });

      expect(mockFetch.mock.calls[0]![0]).toContain("page=2");
      expect(mockFetch.mock.calls[0]![0]).toContain("offset=50");
      expect(mockFetch.mock.calls[0]![0]).toContain("sort=asc");
    });

    it("should handle no token transfers", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([], "0", "No transactions found")
      );

      const result = await client.getTokenBalances(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("should deduplicate tokens from multiple transfers", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenName: "Token A",
            tokenSymbol: "TKA",
            tokenDecimal: "18",
          },
          {
            contractAddress: TEST_CONTRACT, // Same token
            tokenName: "Token A",
            tokenSymbol: "TKA",
            tokenDecimal: "18",
          },
        ])
      );
      mockFetch.mockResolvedValueOnce(createMockResponse("1000000000000000000"));

      const result = await client.getTokenBalances(TEST_WALLET);

      // Should only have one token, not two
      expect(result).toHaveLength(1);
    });

    it("should throw error for invalid address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getTokenBalances("invalid")).rejects.toThrow(
        PolygonClientError
      );
    });
  });

  // ============================================================================
  // getNFTTokens Tests
  // ============================================================================

  describe("getNFTTokens", () => {
    it("should fetch NFT tokens owned by wallet", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Cool NFT",
            tokenSymbol: "CNFT",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
        ])
      );

      const result = await client.getNFTTokens(TEST_WALLET);

      expect(result).toHaveLength(1);
      expect(result[0]!.tokenId).toBe("1");
      expect(result[0]!.tokenName).toBe("Cool NFT");
    });

    it("should not include NFTs that have been transferred out", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Cool NFT",
            tokenSymbol: "CNFT",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Cool NFT",
            tokenSymbol: "CNFT",
            from: TEST_WALLET, // Transferred out
            to: "0x9999999999999999999999999999999999999999",
            timeStamp: "2000000",
          },
        ])
      );

      const result = await client.getNFTTokens(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("should track multiple NFT tokens correctly", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "NFT 1",
            tokenSymbol: "NFT",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "2",
            tokenName: "NFT 2",
            tokenSymbol: "NFT",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "2000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "NFT 1",
            tokenSymbol: "NFT",
            from: TEST_WALLET, // Transferred out
            to: "0x9999999999999999999999999999999999999999",
            timeStamp: "3000000",
          },
        ])
      );

      const result = await client.getNFTTokens(TEST_WALLET);

      // Only NFT #2 should be owned
      expect(result).toHaveLength(1);
      expect(result[0]!.tokenId).toBe("2");
    });

    it("should handle no NFT transfers", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([], "0", "No transactions found")
      );

      const result = await client.getNFTTokens(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("should throw error for invalid address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getNFTTokens("invalid")).rejects.toThrow(
        PolygonClientError
      );
    });
  });

  // ============================================================================
  // getERC1155Balances Tests
  // ============================================================================

  describe("getERC1155Balances", () => {
    it("should fetch ERC1155 token balances", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Game Item",
            tokenSymbol: "ITEM",
            tokenValue: "10",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
        ])
      );

      const result = await client.getERC1155Balances(TEST_WALLET);

      expect(result).toHaveLength(1);
      expect(result[0]!.tokenId).toBe("1");
      expect(result[0]!.tokenValue).toBe(10n);
    });

    it("should calculate balance from multiple transfers", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Game Item",
            tokenSymbol: "ITEM",
            tokenValue: "10",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Game Item",
            tokenSymbol: "ITEM",
            tokenValue: "5",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "2000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Game Item",
            tokenSymbol: "ITEM",
            tokenValue: "3",
            from: TEST_WALLET, // Transferred out
            to: "0x9999999999999999999999999999999999999999",
            timeStamp: "3000000",
          },
        ])
      );

      const result = await client.getERC1155Balances(TEST_WALLET);

      // 10 + 5 - 3 = 12
      expect(result).toHaveLength(1);
      expect(result[0]!.tokenValue).toBe(12n);
    });

    it("should not include tokens with zero balance", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Game Item",
            tokenSymbol: "ITEM",
            tokenValue: "10",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Game Item",
            tokenSymbol: "ITEM",
            tokenValue: "10",
            from: TEST_WALLET, // All transferred out
            to: "0x9999999999999999999999999999999999999999",
            timeStamp: "2000000",
          },
        ])
      );

      const result = await client.getERC1155Balances(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("should handle multiple different token IDs", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "1",
            tokenName: "Item 1",
            tokenSymbol: "ITEM",
            tokenValue: "5",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "1000000",
          },
          {
            contractAddress: TEST_CONTRACT,
            tokenID: "2",
            tokenName: "Item 2",
            tokenSymbol: "ITEM",
            tokenValue: "10",
            from: "0x0000000000000000000000000000000000000000",
            to: TEST_WALLET,
            timeStamp: "2000000",
          },
        ])
      );

      const result = await client.getERC1155Balances(TEST_WALLET);

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.tokenId === "1")?.tokenValue).toBe(5n);
      expect(result.find((r) => r.tokenId === "2")?.tokenValue).toBe(10n);
    });

    it("should throw error for invalid address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getERC1155Balances("invalid")).rejects.toThrow(
        PolygonClientError
      );
    });
  });

  // ============================================================================
  // getWalletBalanceSummary Tests
  // ============================================================================

  describe("getWalletBalanceSummary", () => {
    it("should fetch complete wallet balance summary", async () => {
      const client = new TokenBalanceClient();

      // Mock native balance
      mockFetch.mockResolvedValueOnce(createMockResponse("1000000000000000000"));
      // Mock token transfers
      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            contractAddress: TEST_CONTRACT,
            tokenName: "Token A",
            tokenSymbol: "TKA",
            tokenDecimal: "18",
          },
        ])
      );
      // Mock token balance
      mockFetch.mockResolvedValueOnce(createMockResponse("5000000000000000000"));

      const result = await client.getWalletBalanceSummary(TEST_WALLET);

      expect(result.address).toBe("0x1234567890123456789012345678901234567890");
      expect(result.nativeBalance.balance).toBe(1000000000000000000n);
      expect(result.tokens).toHaveLength(1);
      expect(result.tokenCount).toBe(1);
    });

    it("should handle wallet with no tokens", async () => {
      const client = new TokenBalanceClient();

      mockFetch.mockResolvedValueOnce(createMockResponse("0"));
      mockFetch.mockResolvedValueOnce(
        createMockResponse([], "0", "No transactions found")
      );

      const result = await client.getWalletBalanceSummary(TEST_WALLET);

      expect(result.nativeBalance.balance).toBe(0n);
      expect(result.tokens).toHaveLength(0);
      expect(result.tokenCount).toBe(0);
    });

    it("should throw error for invalid address", async () => {
      const client = new TokenBalanceClient();

      await expect(client.getWalletBalanceSummary("invalid")).rejects.toThrow(
        PolygonClientError
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should handle HTTP errors", async () => {
      const client = new TokenBalanceClient({ maxRetries: 0 });

      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"));

      await expect(client.getNativeBalance(TEST_WALLET)).rejects.toThrow(
        PolygonscanError
      );
    });

    it("should handle rate limiting", async () => {
      const client = new TokenBalanceClient({ maxRetries: 0 });

      mockFetch.mockResolvedValueOnce(
        createMockResponse("Max rate limit reached", "0", "NOTOK")
      );

      await expect(client.getNativeBalance(TEST_WALLET)).rejects.toThrow(
        PolygonscanError
      );
    });

    it("should retry on server errors", async () => {
      const client = new TokenBalanceClient({ maxRetries: 2, retryDelay: 10 });

      mockFetch
        .mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"))
        .mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"))
        .mockResolvedValueOnce(createMockResponse("1000000000000000000"));

      const result = await client.getNativeBalance(TEST_WALLET);

      expect(result.balance).toBe(1000000000000000000n);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries exceeded", async () => {
      const client = new TokenBalanceClient({ maxRetries: 2, retryDelay: 10 });

      mockFetch
        .mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"))
        .mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"))
        .mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"));

      await expect(client.getNativeBalance(TEST_WALLET)).rejects.toThrow(
        PolygonscanError
      );
    });

    it("should handle API errors", async () => {
      const client = new TokenBalanceClient({ maxRetries: 0 });

      mockFetch.mockResolvedValueOnce(
        createMockResponse("Invalid API Key", "0", "NOTOK")
      );

      await expect(client.getNativeBalance(TEST_WALLET)).rejects.toThrow(
        PolygonscanError
      );
    });
  });

  // ============================================================================
  // Factory Functions and Singleton Tests
  // ============================================================================

  describe("factory functions", () => {
    it("createTokenBalanceClient should create new instance", () => {
      const client = createTokenBalanceClient();
      expect(client).toBeInstanceOf(TokenBalanceClient);
    });

    it("createTokenBalanceClient should accept configuration", () => {
      const client = createTokenBalanceClient({
        apiKey: "test-key",
        timeout: 60000,
      });
      expect(client).toBeInstanceOf(TokenBalanceClient);
    });

    it("getSharedTokenBalanceClient should return singleton", () => {
      const client1 = getSharedTokenBalanceClient();
      const client2 = getSharedTokenBalanceClient();
      expect(client1).toBe(client2);
    });

    it("setSharedTokenBalanceClient should update singleton", () => {
      const customClient = new TokenBalanceClient({ apiKey: "custom" });
      setSharedTokenBalanceClient(customClient);
      expect(getSharedTokenBalanceClient()).toBe(customClient);
    });

    it("resetSharedTokenBalanceClient should reset singleton", () => {
      const client1 = getSharedTokenBalanceClient();
      resetSharedTokenBalanceClient();
      const client2 = getSharedTokenBalanceClient();
      expect(client1).not.toBe(client2);
    });
  });

  // ============================================================================
  // Convenience Functions Tests
  // ============================================================================

  describe("convenience functions", () => {
    it("getNativeBalance should use shared client", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse("1000000000000000000"));

      const result = await getNativeBalance(TEST_WALLET);

      expect(result.balance).toBe(1000000000000000000n);
    });

    it("getTokenBalance should use shared client", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse("1000000000000000000"));
      mockFetch.mockResolvedValueOnce(
        createMockResponse([
          {
            tokenName: "Token",
            tokenSymbol: "TKN",
            tokenDecimal: "18",
          },
        ])
      );

      const result = await getTokenBalance(TEST_WALLET, TEST_CONTRACT);

      expect(result).not.toBeNull();
    });

    it("getTokenBalances should use shared client", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await getTokenBalances(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("getNFTTokens should use shared client", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await getNFTTokens(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("getERC1155Balances should use shared client", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await getERC1155Balances(TEST_WALLET);

      expect(result).toHaveLength(0);
    });

    it("getWalletBalanceSummary should use shared client", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse("0"));
      mockFetch.mockResolvedValueOnce(createMockResponse([]));

      const result = await getWalletBalanceSummary(TEST_WALLET);

      expect(result.tokenCount).toBe(0);
    });

    it("convenience functions should accept custom client", async () => {
      const customClient = new TokenBalanceClient({ apiKey: "custom-key" });

      mockFetch.mockResolvedValueOnce(createMockResponse("1000000000000000000"));

      await getNativeBalance(TEST_WALLET, customClient);

      expect(mockFetch.mock.calls[0]![0]).toContain("apikey=custom-key");
    });
  });
});
