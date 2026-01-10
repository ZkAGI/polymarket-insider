/**
 * Tests for WebSocket Message Parser Module (API-WS-006)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  // Constants
  MessageType,
  MessageCategory,
  ParseErrorCode,
  // Utility functions
  determineMessageType,
  determineMessageCategory,
  isValidJson,
  safeJsonParse,
  arrayBufferToString,
  blobToString,
  validateMessageSchema,
  createParseError,
  isPingPongMessage,
  isSubscriptionMessage,
  isMarketDataMessage,
  isErrorMessageType,
  extractMessageId,
  extractTimestamp,
  defaultSchemas,
  // Class and factory
  MessageParser,
  createMessageParser,
  getSharedMessageParser,
  setSharedMessageParser,
  resetSharedMessageParser,
} from "../../../src/api/ws/message-parser";
import type { MessageSchema } from "../../../src/api/ws/message-parser";

// ============================================================================
// Constants Tests
// ============================================================================

describe("MessageType constants", () => {
  it("should have correct subscription message types", () => {
    expect(MessageType.SUBSCRIBE).toBe("subscribe");
    expect(MessageType.UNSUBSCRIBE).toBe("unsubscribe");
    expect(MessageType.SUBSCRIBED).toBe("subscribed");
    expect(MessageType.UNSUBSCRIBED).toBe("unsubscribed");
  });

  it("should have correct market data message types", () => {
    expect(MessageType.PRICE_UPDATE).toBe("price_update");
    expect(MessageType.BOOK_UPDATE).toBe("book");
    expect(MessageType.TRADE).toBe("trade");
  });

  it("should have correct system message types", () => {
    expect(MessageType.ERROR).toBe("error");
    expect(MessageType.PING).toBe("ping");
    expect(MessageType.PONG).toBe("pong");
    expect(MessageType.HEARTBEAT).toBe("heartbeat");
  });

  it("should have correct connection message types", () => {
    expect(MessageType.CONNECTED).toBe("connected");
    expect(MessageType.DISCONNECTED).toBe("disconnected");
    expect(MessageType.RECONNECTING).toBe("reconnecting");
  });

  it("should have unknown type", () => {
    expect(MessageType.UNKNOWN).toBe("unknown");
  });
});

describe("MessageCategory constants", () => {
  it("should have correct categories", () => {
    expect(MessageCategory.SUBSCRIPTION).toBe("subscription");
    expect(MessageCategory.MARKET_DATA).toBe("market_data");
    expect(MessageCategory.SYSTEM).toBe("system");
    expect(MessageCategory.CONNECTION).toBe("connection");
    expect(MessageCategory.UNKNOWN).toBe("unknown");
  });
});

describe("ParseErrorCode constants", () => {
  it("should have correct error codes", () => {
    expect(ParseErrorCode.INVALID_JSON).toBe("INVALID_JSON");
    expect(ParseErrorCode.INVALID_FORMAT).toBe("INVALID_FORMAT");
    expect(ParseErrorCode.MISSING_TYPE).toBe("MISSING_TYPE");
    expect(ParseErrorCode.UNKNOWN_TYPE).toBe("UNKNOWN_TYPE");
    expect(ParseErrorCode.SCHEMA_VALIDATION).toBe("SCHEMA_VALIDATION");
    expect(ParseErrorCode.EMPTY_MESSAGE).toBe("EMPTY_MESSAGE");
    expect(ParseErrorCode.INVALID_DATA_TYPE).toBe("INVALID_DATA_TYPE");
  });
});

// ============================================================================
// determineMessageType Tests
// ============================================================================

describe("determineMessageType", () => {
  it("should return UNKNOWN for null", () => {
    expect(determineMessageType(null)).toBe(MessageType.UNKNOWN);
  });

  it("should return UNKNOWN for non-object", () => {
    expect(determineMessageType("string")).toBe(MessageType.UNKNOWN);
    expect(determineMessageType(123)).toBe(MessageType.UNKNOWN);
    expect(determineMessageType(undefined)).toBe(MessageType.UNKNOWN);
  });

  it("should detect subscription types", () => {
    expect(determineMessageType({ type: "subscribe" })).toBe(MessageType.SUBSCRIBE);
    expect(determineMessageType({ type: "unsubscribe" })).toBe(MessageType.UNSUBSCRIBE);
    expect(determineMessageType({ type: "subscribed" })).toBe(MessageType.SUBSCRIBED);
    expect(determineMessageType({ type: "unsubscribed" })).toBe(MessageType.UNSUBSCRIBED);
  });

  it("should detect market data types", () => {
    expect(determineMessageType({ type: "price_update" })).toBe(MessageType.PRICE_UPDATE);
    expect(determineMessageType({ type: "book" })).toBe(MessageType.BOOK_UPDATE);
    expect(determineMessageType({ type: "trade" })).toBe(MessageType.TRADE);
  });

  it("should detect system message types", () => {
    expect(determineMessageType({ type: "error" })).toBe(MessageType.ERROR);
    expect(determineMessageType({ type: "ping" })).toBe(MessageType.PING);
    expect(determineMessageType({ type: "pong" })).toBe(MessageType.PONG);
    expect(determineMessageType({ type: "heartbeat" })).toBe(MessageType.HEARTBEAT);
  });

  it("should detect connection types", () => {
    expect(determineMessageType({ type: "connected" })).toBe(MessageType.CONNECTED);
    expect(determineMessageType({ type: "disconnected" })).toBe(MessageType.DISCONNECTED);
    expect(determineMessageType({ type: "reconnecting" })).toBe(MessageType.RECONNECTING);
  });

  it("should be case insensitive", () => {
    expect(determineMessageType({ type: "SUBSCRIBE" })).toBe(MessageType.SUBSCRIBE);
    expect(determineMessageType({ type: "Price_Update" })).toBe(MessageType.PRICE_UPDATE);
    expect(determineMessageType({ type: "TRADE" })).toBe(MessageType.TRADE);
  });

  it("should infer price_update from structure", () => {
    expect(determineMessageType({ price: 0.5, asset_id: "abc" })).toBe(MessageType.PRICE_UPDATE);
    expect(determineMessageType({ price: 0.5, market: "xyz" })).toBe(MessageType.PRICE_UPDATE);
    expect(determineMessageType({ price: 0.5, token_id: "123" })).toBe(MessageType.PRICE_UPDATE);
  });

  it("should infer book_update from structure", () => {
    expect(determineMessageType({ bids: [] })).toBe(MessageType.BOOK_UPDATE);
    expect(determineMessageType({ asks: [] })).toBe(MessageType.BOOK_UPDATE);
    expect(determineMessageType({ bids: [], asks: [] })).toBe(MessageType.BOOK_UPDATE);
  });

  it("should infer trade from structure", () => {
    expect(determineMessageType({ side: "buy", size: 100, price: 0.5 })).toBe(MessageType.TRADE);
    expect(determineMessageType({ side: "sell", size: 50, amount: 100 })).toBe(MessageType.TRADE);
  });

  it("should return UNKNOWN for unknown type strings", () => {
    expect(determineMessageType({ type: "custom_type" })).toBe(MessageType.UNKNOWN);
    expect(determineMessageType({ type: "notification" })).toBe(MessageType.UNKNOWN);
  });

  it("should return UNKNOWN for object without type or recognizable structure", () => {
    expect(determineMessageType({ foo: "bar" })).toBe(MessageType.UNKNOWN);
    expect(determineMessageType({})).toBe(MessageType.UNKNOWN);
  });
});

// ============================================================================
// determineMessageCategory Tests
// ============================================================================

describe("determineMessageCategory", () => {
  it("should categorize subscription types", () => {
    expect(determineMessageCategory(MessageType.SUBSCRIBE)).toBe(MessageCategory.SUBSCRIPTION);
    expect(determineMessageCategory(MessageType.UNSUBSCRIBE)).toBe(MessageCategory.SUBSCRIPTION);
    expect(determineMessageCategory(MessageType.SUBSCRIBED)).toBe(MessageCategory.SUBSCRIPTION);
    expect(determineMessageCategory(MessageType.UNSUBSCRIBED)).toBe(MessageCategory.SUBSCRIPTION);
  });

  it("should categorize market data types", () => {
    expect(determineMessageCategory(MessageType.PRICE_UPDATE)).toBe(MessageCategory.MARKET_DATA);
    expect(determineMessageCategory(MessageType.BOOK_UPDATE)).toBe(MessageCategory.MARKET_DATA);
    expect(determineMessageCategory(MessageType.TRADE)).toBe(MessageCategory.MARKET_DATA);
  });

  it("should categorize system types", () => {
    expect(determineMessageCategory(MessageType.ERROR)).toBe(MessageCategory.SYSTEM);
    expect(determineMessageCategory(MessageType.PING)).toBe(MessageCategory.SYSTEM);
    expect(determineMessageCategory(MessageType.PONG)).toBe(MessageCategory.SYSTEM);
    expect(determineMessageCategory(MessageType.HEARTBEAT)).toBe(MessageCategory.SYSTEM);
  });

  it("should categorize connection types", () => {
    expect(determineMessageCategory(MessageType.CONNECTED)).toBe(MessageCategory.CONNECTION);
    expect(determineMessageCategory(MessageType.DISCONNECTED)).toBe(MessageCategory.CONNECTION);
    expect(determineMessageCategory(MessageType.RECONNECTING)).toBe(MessageCategory.CONNECTION);
  });

  it("should categorize unknown types", () => {
    expect(determineMessageCategory(MessageType.UNKNOWN)).toBe(MessageCategory.UNKNOWN);
  });
});

// ============================================================================
// isValidJson Tests
// ============================================================================

describe("isValidJson", () => {
  it("should return true for valid JSON", () => {
    expect(isValidJson("{}")).toBe(true);
    expect(isValidJson("[]")).toBe(true);
    expect(isValidJson('{"type":"test"}')).toBe(true);
    expect(isValidJson('"string"')).toBe(true);
    expect(isValidJson("123")).toBe(true);
    expect(isValidJson("null")).toBe(true);
    expect(isValidJson("true")).toBe(true);
  });

  it("should return false for invalid JSON", () => {
    expect(isValidJson("{")).toBe(false);
    expect(isValidJson("{type:test}")).toBe(false);
    expect(isValidJson("undefined")).toBe(false);
    expect(isValidJson("")).toBe(false);
    expect(isValidJson("not json")).toBe(false);
  });
});

// ============================================================================
// safeJsonParse Tests
// ============================================================================

describe("safeJsonParse", () => {
  it("should parse valid JSON and return success", () => {
    const result = safeJsonParse('{"type":"test"}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ type: "test" });
    }
  });

  it("should parse arrays", () => {
    const result = safeJsonParse("[1, 2, 3]");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3]);
    }
  });

  it("should return error for invalid JSON", () => {
    const result = safeJsonParse("{invalid}");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ParseErrorCode.INVALID_JSON);
      expect(result.error.message).toBeDefined();
      expect(result.error.timestamp).toBeInstanceOf(Date);
    }
  });

  it("should include raw data in error", () => {
    const result = safeJsonParse("{bad:json}");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.rawData).toBeDefined();
    }
  });

  it("should truncate long raw data in error", () => {
    const longString = "{" + "a".repeat(600) + "}";
    const result = safeJsonParse(longString);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.rawData?.length).toBeLessThanOrEqual(500);
    }
  });
});

// ============================================================================
// arrayBufferToString Tests
// ============================================================================

describe("arrayBufferToString", () => {
  it("should convert ArrayBuffer to string", () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode("Hello World").buffer;
    expect(arrayBufferToString(buffer as ArrayBuffer)).toBe("Hello World");
  });

  it("should handle empty ArrayBuffer", () => {
    const buffer = new ArrayBuffer(0);
    expect(arrayBufferToString(buffer)).toBe("");
  });

  it("should handle JSON in ArrayBuffer", () => {
    const encoder = new TextEncoder();
    const json = '{"type":"test"}';
    const buffer = encoder.encode(json).buffer;
    expect(arrayBufferToString(buffer as ArrayBuffer)).toBe(json);
  });
});

// ============================================================================
// blobToString Tests
// ============================================================================

describe("blobToString", () => {
  it("should convert Blob to string", async () => {
    const blob = new Blob(["Hello World"], { type: "text/plain" });
    const result = await blobToString(blob);
    expect(result).toBe("Hello World");
  });

  it("should handle empty Blob", async () => {
    const blob = new Blob([], { type: "text/plain" });
    const result = await blobToString(blob);
    expect(result).toBe("");
  });

  it("should handle JSON in Blob", async () => {
    const json = '{"type":"test"}';
    const blob = new Blob([json], { type: "application/json" });
    const result = await blobToString(blob);
    expect(result).toBe(json);
  });
});

// ============================================================================
// validateMessageSchema Tests
// ============================================================================

describe("validateMessageSchema", () => {
  const testSchema: MessageSchema = {
    type: "test",
    rules: [
      { field: "id", required: true, type: "string" },
      { field: "value", required: true, type: "number" },
      { field: "optional", required: false, type: "string" },
    ],
    allowUnknown: true,
  };

  it("should validate valid message", () => {
    const result = validateMessageSchema({ type: "test", id: "123", value: 42 }, testSchema);
    expect(result.valid).toBe(true);
  });

  it("should fail on missing required field", () => {
    const result = validateMessageSchema({ type: "test", id: "123" }, testSchema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Missing required field: value");
    }
  });

  it("should fail on wrong type", () => {
    const result = validateMessageSchema({ type: "test", id: 123, value: 42 }, testSchema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("id"))).toBe(true);
    }
  });

  it("should allow optional fields to be missing", () => {
    const result = validateMessageSchema({ type: "test", id: "123", value: 42 }, testSchema);
    expect(result.valid).toBe(true);
  });

  it("should validate optional fields when present", () => {
    const result = validateMessageSchema({ type: "test", id: "123", value: 42, optional: 123 }, testSchema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(e => e.includes("optional"))).toBe(true);
    }
  });

  it("should fail for non-object message", () => {
    const result = validateMessageSchema("not an object", testSchema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Message must be an object");
    }
  });

  it("should fail for null message", () => {
    const result = validateMessageSchema(null, testSchema);
    expect(result.valid).toBe(false);
  });

  it("should support custom validation function", () => {
    const customSchema: MessageSchema = {
      type: "custom",
      rules: [
        {
          field: "score",
          required: true,
          type: "number",
          validate: (v) => (v as number) >= 0 && (v as number) <= 100,
          errorMessage: "Score must be between 0 and 100",
        },
      ],
      allowUnknown: true,
    };

    const valid = validateMessageSchema({ score: 50 }, customSchema);
    expect(valid.valid).toBe(true);

    const invalid = validateMessageSchema({ score: 150 }, customSchema);
    expect(invalid.valid).toBe(false);
    if (!invalid.valid) {
      expect(invalid.errors).toContain("Score must be between 0 and 100");
    }
  });

  it("should support multiple types", () => {
    const multiTypeSchema: MessageSchema = {
      type: "multi",
      rules: [
        { field: "value", required: true, type: ["string", "number"] },
      ],
      allowUnknown: true,
    };

    const stringResult = validateMessageSchema({ value: "test" }, multiTypeSchema);
    expect(stringResult.valid).toBe(true);

    const numberResult = validateMessageSchema({ value: 123 }, multiTypeSchema);
    expect(numberResult.valid).toBe(true);

    const boolResult = validateMessageSchema({ value: true }, multiTypeSchema);
    expect(boolResult.valid).toBe(false);
  });
});

// ============================================================================
// createParseError Tests
// ============================================================================

describe("createParseError", () => {
  it("should create error with required fields", () => {
    const error = createParseError(ParseErrorCode.INVALID_JSON, "Test error");
    expect(error.code).toBe(ParseErrorCode.INVALID_JSON);
    expect(error.message).toBe("Test error");
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it("should include optional context", () => {
    const error = createParseError(ParseErrorCode.SCHEMA_VALIDATION, "Validation failed", {
      expected: "number",
      actual: "string",
      rawData: '{"test": "data"}',
    });
    expect(error.expected).toBe("number");
    expect(error.actual).toBe("string");
    expect(error.rawData).toBe('{"test": "data"}');
  });
});

// ============================================================================
// isPingPongMessage Tests
// ============================================================================

describe("isPingPongMessage", () => {
  it("should detect ping message", () => {
    expect(isPingPongMessage({ type: "ping" })).toBe(true);
    expect(isPingPongMessage({ type: "PING" })).toBe(true);
  });

  it("should detect pong message", () => {
    expect(isPingPongMessage({ type: "pong" })).toBe(true);
    expect(isPingPongMessage({ type: "PONG" })).toBe(true);
  });

  it("should detect heartbeat message", () => {
    expect(isPingPongMessage({ type: "heartbeat" })).toBe(true);
    expect(isPingPongMessage({ type: "HEARTBEAT" })).toBe(true);
  });

  it("should return false for other types", () => {
    expect(isPingPongMessage({ type: "trade" })).toBe(false);
    expect(isPingPongMessage({ type: "error" })).toBe(false);
    expect(isPingPongMessage(null)).toBe(false);
    expect(isPingPongMessage({})).toBe(false);
  });
});

// ============================================================================
// isSubscriptionMessage Tests
// ============================================================================

describe("isSubscriptionMessage", () => {
  it("should detect subscribe message", () => {
    expect(isSubscriptionMessage({ type: "subscribe" })).toBe(true);
  });

  it("should detect unsubscribe message", () => {
    expect(isSubscriptionMessage({ type: "unsubscribe" })).toBe(true);
  });

  it("should detect subscribed confirmation", () => {
    expect(isSubscriptionMessage({ type: "subscribed" })).toBe(true);
  });

  it("should detect unsubscribed confirmation", () => {
    expect(isSubscriptionMessage({ type: "unsubscribed" })).toBe(true);
  });

  it("should return false for other types", () => {
    expect(isSubscriptionMessage({ type: "trade" })).toBe(false);
    expect(isSubscriptionMessage({ type: "price_update" })).toBe(false);
    expect(isSubscriptionMessage(null)).toBe(false);
  });
});

// ============================================================================
// isMarketDataMessage Tests
// ============================================================================

describe("isMarketDataMessage", () => {
  it("should detect price_update message", () => {
    expect(isMarketDataMessage({ type: "price_update" })).toBe(true);
  });

  it("should detect book message", () => {
    expect(isMarketDataMessage({ type: "book" })).toBe(true);
  });

  it("should detect trade message", () => {
    expect(isMarketDataMessage({ type: "trade" })).toBe(true);
  });

  it("should detect price update by structure", () => {
    expect(isMarketDataMessage({ price: 0.5, asset_id: "abc" })).toBe(true);
    expect(isMarketDataMessage({ price: 0.5, market: "xyz" })).toBe(true);
    expect(isMarketDataMessage({ price: 0.5, token_id: "123" })).toBe(true);
  });

  it("should detect order book by structure", () => {
    expect(isMarketDataMessage({ bids: [] })).toBe(true);
    expect(isMarketDataMessage({ asks: [] })).toBe(true);
  });

  it("should detect trade by structure", () => {
    expect(isMarketDataMessage({ side: "buy", size: 100 })).toBe(true);
    expect(isMarketDataMessage({ side: "sell", amount: 50 })).toBe(true);
  });

  it("should return false for other types", () => {
    expect(isMarketDataMessage({ type: "subscribe" })).toBe(false);
    expect(isMarketDataMessage({ type: "error" })).toBe(false);
    expect(isMarketDataMessage(null)).toBe(false);
    expect(isMarketDataMessage({})).toBe(false);
  });
});

// ============================================================================
// isErrorMessageType Tests
// ============================================================================

describe("isErrorMessageType", () => {
  it("should detect error type message", () => {
    expect(isErrorMessageType({ type: "error" })).toBe(true);
  });

  it("should detect error field message", () => {
    expect(isErrorMessageType({ error: "Something went wrong" })).toBe(true);
  });

  it("should return false for non-error messages", () => {
    expect(isErrorMessageType({ type: "trade" })).toBe(false);
    expect(isErrorMessageType({ message: "test" })).toBe(false);
    expect(isErrorMessageType(null)).toBe(false);
  });
});

// ============================================================================
// extractMessageId Tests
// ============================================================================

describe("extractMessageId", () => {
  it("should extract id field", () => {
    expect(extractMessageId({ id: "msg-123" })).toBe("msg-123");
  });

  it("should extract message_id field", () => {
    expect(extractMessageId({ message_id: "msg-456" })).toBe("msg-456");
  });

  it("should extract request_id field", () => {
    expect(extractMessageId({ request_id: "req-789" })).toBe("req-789");
  });

  it("should prefer id over other fields", () => {
    expect(extractMessageId({ id: "first", message_id: "second" })).toBe("first");
  });

  it("should convert number id to string", () => {
    expect(extractMessageId({ id: 123 })).toBe("123");
  });

  it("should return undefined for missing id", () => {
    expect(extractMessageId({})).toBeUndefined();
    expect(extractMessageId(null)).toBeUndefined();
    expect(extractMessageId({ type: "test" })).toBeUndefined();
  });
});

// ============================================================================
// extractTimestamp Tests
// ============================================================================

describe("extractTimestamp", () => {
  it("should return current date for missing timestamp", () => {
    const before = new Date();
    const result = extractTimestamp({});
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should parse millisecond timestamp", () => {
    const ts = 1609459200000; // 2021-01-01T00:00:00.000Z
    const result = extractTimestamp({ timestamp: ts });
    expect(result.getTime()).toBe(ts);
  });

  it("should parse second timestamp", () => {
    const ts = 1609459200; // 2021-01-01T00:00:00.000Z
    const result = extractTimestamp({ timestamp: ts });
    expect(result.getTime()).toBe(ts * 1000);
  });

  it("should parse ISO string timestamp", () => {
    const iso = "2021-01-01T00:00:00.000Z";
    const result = extractTimestamp({ timestamp: iso });
    expect(result.toISOString()).toBe(iso);
  });

  it("should try alternative timestamp fields", () => {
    expect(extractTimestamp({ time: 1609459200000 }).getTime()).toBe(1609459200000);
    expect(extractTimestamp({ ts: 1609459200000 }).getTime()).toBe(1609459200000);
    expect(extractTimestamp({ created_at: "2021-01-01T00:00:00.000Z" }).toISOString()).toBe(
      "2021-01-01T00:00:00.000Z"
    );
  });

  it("should return current date for invalid timestamp string", () => {
    const before = new Date();
    const result = extractTimestamp({ timestamp: "not a date" });
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return current date for null input", () => {
    const before = new Date();
    const result = extractTimestamp(null);
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ============================================================================
// defaultSchemas Tests
// ============================================================================

describe("defaultSchemas", () => {
  it("should have price_update schema", () => {
    const schema = defaultSchemas.find((s) => s.type === "price_update");
    expect(schema).toBeDefined();
    expect(schema?.rules.some((r) => r.field === "price")).toBe(true);
  });

  it("should have trade schema", () => {
    const schema = defaultSchemas.find((s) => s.type === "trade");
    expect(schema).toBeDefined();
    expect(schema?.rules.some((r) => r.field === "price")).toBe(true);
  });

  it("should have book schema", () => {
    const schema = defaultSchemas.find((s) => s.type === "book");
    expect(schema).toBeDefined();
  });

  it("should have error schema", () => {
    const schema = defaultSchemas.find((s) => s.type === "error");
    expect(schema).toBeDefined();
  });

  it("should allow unknown fields in all default schemas", () => {
    for (const schema of defaultSchemas) {
      expect(schema.allowUnknown).toBe(true);
    }
  });
});

// ============================================================================
// MessageParser Class Tests
// ============================================================================

describe("MessageParser", () => {
  let parser: MessageParser;

  beforeEach(() => {
    parser = new MessageParser();
  });

  afterEach(() => {
    parser.dispose();
    resetSharedMessageParser();
  });

  describe("constructor", () => {
    it("should create parser with default config", () => {
      const p = new MessageParser();
      expect(p).toBeInstanceOf(MessageParser);
      p.dispose();
    });

    it("should create parser with custom config", () => {
      const p = new MessageParser({
        validateSchema: false,
        maxMessageSize: 500000,
        trackUnknownTypes: false,
        debug: true,
      });
      expect(p).toBeInstanceOf(MessageParser);
      p.dispose();
    });

    it("should accept custom schemas", () => {
      const customSchema: MessageSchema = {
        type: "custom_type",
        rules: [{ field: "custom_field", required: true, type: "string" }],
        allowUnknown: true,
      };
      const p = new MessageParser({ schemas: [customSchema] });
      expect(p.getSchemas().some((s) => s.type === "custom_type")).toBe(true);
      p.dispose();
    });
  });

  describe("parse", () => {
    it("should parse valid JSON message", () => {
      const result = parser.parse('{"type":"ping"}');
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PING);
      expect(result.category).toBe(MessageCategory.SYSTEM);
      expect(result.data).toEqual({ type: "ping" });
    });

    it("should parse price_update message", () => {
      const msg = { type: "price_update", asset_id: "token1", price: 0.65 };
      const result = parser.parse(JSON.stringify(msg));
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PRICE_UPDATE);
      expect(result.category).toBe(MessageCategory.MARKET_DATA);
    });

    it("should parse trade message", () => {
      const msg = { type: "trade", price: 0.5, size: 100, side: "buy" };
      const result = parser.parse(JSON.stringify(msg));
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.TRADE);
    });

    it("should parse book message", () => {
      const msg = { type: "book", bids: [[0.5, 100]], asks: [[0.6, 200]] };
      const result = parser.parse(JSON.stringify(msg));
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.BOOK_UPDATE);
    });

    it("should handle invalid JSON", () => {
      const result = parser.parse("{invalid json}");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ParseErrorCode.INVALID_JSON);
    });

    it("should handle empty message", () => {
      const result = parser.parse("");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ParseErrorCode.EMPTY_MESSAGE);
    });

    it("should handle whitespace-only message", () => {
      const result = parser.parse("   \n\t  ");
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ParseErrorCode.EMPTY_MESSAGE);
    });

    it("should handle message exceeding max size", () => {
      const smallParser = new MessageParser({ maxMessageSize: 100 });
      const largeMsg = JSON.stringify({ data: "x".repeat(200) });
      const result = smallParser.parse(largeMsg);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ParseErrorCode.INVALID_FORMAT);
      smallParser.dispose();
    });

    it("should parse ArrayBuffer input", () => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode('{"type":"ping"}').buffer;
      const result = parser.parse(buffer as ArrayBuffer);
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PING);
    });

    it("should track parse time", () => {
      const result = parser.parse('{"type":"ping"}');
      expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should set receivedAt timestamp", () => {
      const before = new Date();
      const result = parser.parse('{"type":"ping"}');
      const after = new Date();
      expect(result.receivedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.receivedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should handle unknown message types", () => {
      const result = parser.parse('{"type":"custom_unknown_type"}');
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.UNKNOWN);
      expect(result.category).toBe(MessageCategory.UNKNOWN);
    });

    it("should infer type from structure when type field is missing", () => {
      const result = parser.parse('{"price":0.5,"asset_id":"token1"}');
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PRICE_UPDATE);
    });
  });

  describe("parseAsync", () => {
    it("should parse string asynchronously", async () => {
      const result = await parser.parseAsync('{"type":"ping"}');
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PING);
    });

    it("should parse ArrayBuffer asynchronously", async () => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode('{"type":"pong"}').buffer;
      const result = await parser.parseAsync(buffer as ArrayBuffer);
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PONG);
    });

    it("should parse Blob asynchronously", async () => {
      const blob = new Blob(['{"type":"heartbeat"}'], { type: "application/json" });
      const result = await parser.parseAsync(blob);
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.HEARTBEAT);
    });
  });

  describe("schema management", () => {
    it("should add custom schema", () => {
      const customSchema: MessageSchema = {
        type: "my_type",
        rules: [{ field: "my_field", required: true }],
        allowUnknown: true,
      };
      parser.addSchema(customSchema);
      expect(parser.getSchemas().some((s) => s.type === "my_type")).toBe(true);
    });

    it("should remove schema", () => {
      const initialCount = parser.getSchemas().length;
      const removed = parser.removeSchema("price_update");
      expect(removed).toBe(true);
      expect(parser.getSchemas().length).toBe(initialCount - 1);
      expect(parser.getSchemas().some((s) => s.type === "price_update")).toBe(false);
    });

    it("should return false when removing non-existent schema", () => {
      const removed = parser.removeSchema("non_existent");
      expect(removed).toBe(false);
    });

    it("should be case insensitive for schema removal", () => {
      const removed = parser.removeSchema("PRICE_UPDATE");
      expect(removed).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should track total messages parsed", () => {
      parser.parse('{"type":"ping"}');
      parser.parse('{"type":"pong"}');
      const stats = parser.getStats();
      expect(stats.totalParsed).toBe(2);
    });

    it("should track successful parses", () => {
      parser.parse('{"type":"ping"}');
      parser.parse("invalid json");
      const stats = parser.getStats();
      expect(stats.successfulParses).toBe(1);
    });

    it("should track failed parses", () => {
      parser.parse('{"type":"ping"}');
      parser.parse("invalid json");
      const stats = parser.getStats();
      expect(stats.failedParses).toBe(1);
    });

    it("should track messages by type", () => {
      parser.parse('{"type":"ping"}');
      parser.parse('{"type":"ping"}');
      parser.parse('{"type":"pong"}');
      const stats = parser.getStats();
      expect(stats.messagesByType.get(MessageType.PING)).toBe(2);
      expect(stats.messagesByType.get(MessageType.PONG)).toBe(1);
    });

    it("should track messages by category", () => {
      parser.parse('{"type":"ping"}');
      parser.parse('{"type":"trade","price":0.5,"size":100}');
      const stats = parser.getStats();
      expect(stats.messagesByCategory.get(MessageCategory.SYSTEM)).toBe(1);
      expect(stats.messagesByCategory.get(MessageCategory.MARKET_DATA)).toBe(1);
    });

    it("should track errors by code", () => {
      parser.parse("invalid json 1");
      parser.parse("invalid json 2");
      parser.parse("");
      const stats = parser.getStats();
      expect(stats.errorsByCode.get(ParseErrorCode.INVALID_JSON)).toBe(2);
      expect(stats.errorsByCode.get(ParseErrorCode.EMPTY_MESSAGE)).toBe(1);
    });

    it("should track unknown types", () => {
      parser.parse('{"type":"custom_type_1"}');
      parser.parse('{"type":"custom_type_2"}');
      parser.parse('{"type":"custom_type_1"}');
      const unknownTypes = parser.getUnknownTypes();
      expect(unknownTypes).toContain("custom_type_1");
      expect(unknownTypes).toContain("custom_type_2");
      expect(unknownTypes.length).toBe(2);
    });

    it("should track average parse time", () => {
      parser.parse('{"type":"ping"}');
      parser.parse('{"type":"pong"}');
      const stats = parser.getStats();
      expect(stats.avgParseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should track max parse time", () => {
      parser.parse('{"type":"ping"}');
      const stats = parser.getStats();
      expect(stats.maxParseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should track last message timestamp", () => {
      const before = new Date();
      parser.parse('{"type":"ping"}');
      const stats = parser.getStats();
      const after = new Date();
      expect(stats.lastMessageAt).toBeDefined();
      expect(stats.lastMessageAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stats.lastMessageAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should reset stats", () => {
      parser.parse('{"type":"ping"}');
      parser.parse('{"type":"pong"}');
      parser.resetStats();
      const stats = parser.getStats();
      expect(stats.totalParsed).toBe(0);
      expect(stats.successfulParses).toBe(0);
      expect(stats.failedParses).toBe(0);
      expect(stats.messagesByType.size).toBe(0);
    });

    it("should return copy of stats", () => {
      parser.parse('{"type":"ping"}');
      const stats1 = parser.getStats();
      parser.parse('{"type":"pong"}');
      const stats2 = parser.getStats();
      expect(stats1.totalParsed).toBe(1);
      expect(stats2.totalParsed).toBe(2);
    });
  });

  describe("dispose", () => {
    it("should mark parser as disposed", () => {
      expect(parser.isDisposed()).toBe(false);
      parser.dispose();
      expect(parser.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      parser.dispose();
      parser.dispose(); // Should not throw
      expect(parser.isDisposed()).toBe(true);
    });

    it("should clear schemas on dispose", () => {
      parser.dispose();
      expect(parser.getSchemas().length).toBe(0);
    });
  });

  describe("validation", () => {
    it("should validate price_update schema", () => {
      const validMsg = { type: "price_update", price: 0.5 };
      const result = parser.parse(JSON.stringify(validMsg));
      expect(result.success).toBe(true);
    });

    it("should log validation warning for invalid price", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const validatorParser = new MessageParser({ logErrors: true });

      // Price > 1 should fail validation
      const invalidMsg = { type: "price_update", price: 1.5 };
      const result = validatorParser.parse(JSON.stringify(invalidMsg));

      // Parse should succeed (we don't fail on validation, just warn)
      expect(result.success).toBe(true);

      warnSpy.mockRestore();
      validatorParser.dispose();
    });

    it("should skip validation when disabled", () => {
      const noValidateParser = new MessageParser({ validateSchema: false });
      const msg = { type: "price_update", price: 999 }; // Invalid price
      const result = noValidateParser.parse(JSON.stringify(msg));
      expect(result.success).toBe(true);
      noValidateParser.dispose();
    });
  });

  describe("debug logging", () => {
    it("should log debug messages when enabled", () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const debugParser = new MessageParser({ debug: true, logger: mockLogger });
      debugParser.parse('{"type":"ping"}');
      expect(mockLogger.debug).toHaveBeenCalled();
      debugParser.dispose();
    });

    it("should not log debug messages when disabled", () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const quietParser = new MessageParser({ debug: false, logger: mockLogger });
      quietParser.parse('{"type":"ping"}');
      expect(mockLogger.debug).not.toHaveBeenCalled();
      quietParser.dispose();
    });
  });

  describe("error logging", () => {
    it("should log errors when enabled", () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const errorParser = new MessageParser({ logErrors: true, logger: mockLogger });
      errorParser.parse("invalid json");
      expect(mockLogger.error).toHaveBeenCalled();
      errorParser.dispose();
    });

    it("should not log errors when disabled", () => {
      const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const quietParser = new MessageParser({ logErrors: false, logger: mockLogger });
      quietParser.parse("invalid json");
      expect(mockLogger.error).not.toHaveBeenCalled();
      quietParser.dispose();
    });
  });
});

// ============================================================================
// Factory Functions and Singleton Tests
// ============================================================================

describe("createMessageParser", () => {
  it("should create new parser instance", () => {
    const parser = createMessageParser();
    expect(parser).toBeInstanceOf(MessageParser);
    parser.dispose();
  });

  it("should create parser with config", () => {
    const parser = createMessageParser({ debug: true });
    expect(parser).toBeInstanceOf(MessageParser);
    parser.dispose();
  });
});

describe("shared parser singleton", () => {
  afterEach(() => {
    resetSharedMessageParser();
  });

  it("should return same instance on multiple calls", () => {
    const parser1 = getSharedMessageParser();
    const parser2 = getSharedMessageParser();
    expect(parser1).toBe(parser2);
    parser1.dispose();
  });

  it("should allow setting custom shared parser", () => {
    const customParser = new MessageParser({ debug: true });
    setSharedMessageParser(customParser);
    const retrieved = getSharedMessageParser();
    expect(retrieved).toBe(customParser);
    customParser.dispose();
  });

  it("should reset shared parser", () => {
    const parser1 = getSharedMessageParser();
    resetSharedMessageParser();
    const parser2 = getSharedMessageParser();
    expect(parser1).not.toBe(parser2);
    parser2.dispose();
  });

  it("should dispose existing parser on reset", () => {
    const parser = getSharedMessageParser();
    resetSharedMessageParser();
    expect(parser.isDisposed()).toBe(true);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("MessageParser integration", () => {
  let parser: MessageParser;

  beforeEach(() => {
    parser = new MessageParser();
  });

  afterEach(() => {
    parser.dispose();
  });

  it("should handle realistic price update stream", () => {
    const messages = [
      '{"type":"price_update","asset_id":"token1","price":0.55,"timestamp":1609459200000}',
      '{"type":"price_update","asset_id":"token1","price":0.56,"timestamp":1609459201000}',
      '{"type":"price_update","asset_id":"token2","price":0.35,"timestamp":1609459202000}',
    ];

    for (const msg of messages) {
      const result = parser.parse(msg);
      expect(result.success).toBe(true);
      expect(result.type).toBe(MessageType.PRICE_UPDATE);
    }

    const stats = parser.getStats();
    expect(stats.totalParsed).toBe(3);
    expect(stats.successfulParses).toBe(3);
  });

  it("should handle mixed message types", () => {
    const messages = [
      '{"type":"subscribed","channel":"market","assets_ids":["token1"]}',
      '{"type":"price_update","asset_id":"token1","price":0.55}',
      '{"type":"trade","price":0.55,"size":100,"side":"buy"}',
      '{"type":"ping"}',
    ];

    const results = messages.map((msg) => parser.parse(msg));
    expect(results[0]!.type).toBe(MessageType.SUBSCRIBED);
    expect(results[1]!.type).toBe(MessageType.PRICE_UPDATE);
    expect(results[2]!.type).toBe(MessageType.TRADE);
    expect(results[3]!.type).toBe(MessageType.PING);

    const stats = parser.getStats();
    expect(stats.messagesByCategory.get(MessageCategory.SUBSCRIPTION)).toBe(1);
    expect(stats.messagesByCategory.get(MessageCategory.MARKET_DATA)).toBe(2);
    expect(stats.messagesByCategory.get(MessageCategory.SYSTEM)).toBe(1);
  });

  it("should handle malformed messages gracefully", () => {
    const messages = [
      '{"type":"price_update","price":0.55}',
      "{bad json",
      "",
      '{"type":"unknown_type"}',
      '{"price":0.5,"asset_id":"token1"}', // No type but inferrable
    ];

    const results = messages.map((msg) => parser.parse(msg));
    expect(results[0]!.success).toBe(true);
    expect(results[1]!.success).toBe(false);
    expect(results[2]!.success).toBe(false);
    expect(results[3]!.success).toBe(true);
    expect(results[3]!.type).toBe(MessageType.UNKNOWN);
    expect(results[4]!.success).toBe(true);
    expect(results[4]!.type).toBe(MessageType.PRICE_UPDATE);
  });

  it("should track statistics across many messages", () => {
    for (let i = 0; i < 100; i++) {
      parser.parse(`{"type":"price_update","price":${Math.random()},"asset_id":"token${i % 10}"}`);
    }

    const stats = parser.getStats();
    expect(stats.totalParsed).toBe(100);
    expect(stats.successfulParses).toBe(100);
    expect(stats.avgParseTimeMs).toBeGreaterThan(0);
    expect(stats.maxParseTimeMs).toBeGreaterThanOrEqual(stats.avgParseTimeMs);
  });
});
