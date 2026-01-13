/**
 * Unit tests for VAPID key utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VapidError,
  generateVapidKeys,
  base64urlEncode,
  base64urlDecode,
  validateVapidKeys,
  createVapidKeys,
  loadVapidKeysFromEnv,
  generateVapidKeysEnvString,
  createVapidAuthHeader,
  getAudienceFromEndpoint,
  formatCryptoKeyHeader,
  getVapidKeys,
  setVapidKeys,
  resetVapidKeys,
  hasVapidKeys,
  isValidVapidPublicKey,
  isValidVapidPrivateKey,
  type VapidKeys,
} from "../../../src/notifications/push";

describe("VAPID Utilities", () => {
  beforeEach(() => {
    resetVapidKeys();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    resetVapidKeys();
  });

  describe("generateVapidKeys", () => {
    it("should generate valid VAPID keys with mailto subject", () => {
      const keys = generateVapidKeys("mailto:test@example.com");

      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(keys.subject).toBe("mailto:test@example.com");
      expect(isValidVapidPublicKey(keys.publicKey)).toBe(true);
      expect(isValidVapidPrivateKey(keys.privateKey)).toBe(true);
    });

    it("should generate valid VAPID keys with https subject", () => {
      const keys = generateVapidKeys("https://example.com");

      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(keys.subject).toBe("https://example.com");
    });

    it("should generate unique keys each time", () => {
      const keys1 = generateVapidKeys("mailto:test@example.com");
      const keys2 = generateVapidKeys("mailto:test@example.com");

      expect(keys1.publicKey).not.toBe(keys2.publicKey);
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
    });

    it("should throw VapidError for empty subject", () => {
      expect(() => generateVapidKeys("")).toThrow(VapidError);
      expect(() => generateVapidKeys("")).toThrow("Subject is required");
    });

    it("should throw VapidError for invalid subject format", () => {
      expect(() => generateVapidKeys("test@example.com")).toThrow(VapidError);
      expect(() => generateVapidKeys("test@example.com")).toThrow(
        "Subject must be a mailto: email or https:// URL"
      );
    });

    it("should throw VapidError for null subject", () => {
      expect(() => generateVapidKeys(null as unknown as string)).toThrow(VapidError);
    });
  });

  describe("base64urlEncode/base64urlDecode", () => {
    it("should encode and decode buffer correctly", () => {
      const original = Buffer.from("Hello, World!");
      const encoded = base64urlEncode(original);
      const decoded = base64urlDecode(encoded);

      expect(decoded.toString()).toBe("Hello, World!");
    });

    it("should encode without padding", () => {
      const buffer = Buffer.from("test");
      const encoded = base64urlEncode(buffer);
      expect(encoded).not.toContain("=");
    });

    it("should replace + with - and / with _", () => {
      // Create a buffer that would produce + and / in standard base64
      const buffer = Buffer.from([0xff, 0xfe, 0xfd]);
      const encoded = base64urlEncode(buffer);
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
    });

    it("should handle empty buffer", () => {
      const encoded = base64urlEncode(Buffer.from(""));
      expect(encoded).toBe("");
      const decoded = base64urlDecode("");
      expect(decoded.length).toBe(0);
    });

    it("should roundtrip binary data correctly", () => {
      const binaryData = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        binaryData[i] = i;
      }
      const encoded = base64urlEncode(binaryData);
      const decoded = base64urlDecode(encoded);
      expect(decoded.equals(binaryData)).toBe(true);
    });
  });

  describe("validateVapidKeys", () => {
    it("should return true for valid keys", () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      expect(validateVapidKeys(keys)).toBe(true);
    });

    it("should return false for invalid public key", () => {
      const keys: VapidKeys = {
        publicKey: "invalid",
        privateKey: "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
        subject: "mailto:test@example.com",
      };
      expect(validateVapidKeys(keys)).toBe(false);
    });

    it("should return false for invalid private key", () => {
      const keys: VapidKeys = {
        publicKey:
          "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw",
        privateKey: "invalid",
        subject: "mailto:test@example.com",
      };
      expect(validateVapidKeys(keys)).toBe(false);
    });
  });

  describe("createVapidKeys", () => {
    it("should create VapidKeys object from valid strings", () => {
      const publicKey =
        "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw";
      const privateKey = "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs";
      const subject = "mailto:test@example.com";

      const keys = createVapidKeys(publicKey, privateKey, subject);

      expect(keys.publicKey).toBe(publicKey);
      expect(keys.privateKey).toBe(privateKey);
      expect(keys.subject).toBe(subject);
    });

    it("should throw VapidError for invalid public key", () => {
      expect(() =>
        createVapidKeys(
          "invalid",
          "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
          "mailto:test@example.com"
        )
      ).toThrow(VapidError);
    });

    it("should throw VapidError for invalid private key", () => {
      expect(() =>
        createVapidKeys(
          "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw",
          "invalid",
          "mailto:test@example.com"
        )
      ).toThrow(VapidError);
    });

    it("should throw VapidError for invalid subject", () => {
      expect(() =>
        createVapidKeys(
          "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw",
          "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
          "invalid"
        )
      ).toThrow(VapidError);
    });
  });

  describe("loadVapidKeysFromEnv", () => {
    it("should return null when env vars are not set", () => {
      expect(loadVapidKeysFromEnv()).toBe(null);
    });

    it("should load keys from environment variables", () => {
      vi.stubEnv(
        "VAPID_PUBLIC_KEY",
        "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw"
      );
      vi.stubEnv("VAPID_PRIVATE_KEY", "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs");
      vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");

      const keys = loadVapidKeysFromEnv();

      expect(keys).not.toBe(null);
      expect(keys!.subject).toBe("mailto:test@example.com");
    });

    it("should use EMAIL_FROM as fallback for subject", () => {
      vi.stubEnv(
        "VAPID_PUBLIC_KEY",
        "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw"
      );
      vi.stubEnv("VAPID_PRIVATE_KEY", "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs");
      vi.stubEnv("EMAIL_FROM", "admin@example.com");

      const keys = loadVapidKeysFromEnv();

      expect(keys).not.toBe(null);
      expect(keys!.subject).toBe("mailto:admin@example.com");
    });

    it("should return null for invalid keys", () => {
      vi.stubEnv("VAPID_PUBLIC_KEY", "invalid");
      vi.stubEnv("VAPID_PRIVATE_KEY", "invalid");
      vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");

      const keys = loadVapidKeysFromEnv();

      expect(keys).toBe(null);
    });
  });

  describe("generateVapidKeysEnvString", () => {
    it("should generate valid env string", () => {
      const envString = generateVapidKeysEnvString("mailto:test@example.com");

      expect(envString).toContain("VAPID_PUBLIC_KEY=");
      expect(envString).toContain("VAPID_PRIVATE_KEY=");
      expect(envString).toContain("VAPID_SUBJECT=mailto:test@example.com");
      expect(envString).toContain("# Web Push VAPID Keys");
    });
  });

  describe("createVapidAuthHeader", () => {
    it("should create valid JWT", () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      const jwt = createVapidAuthHeader(
        "https://fcm.googleapis.com",
        keys.subject,
        keys.publicKey,
        keys.privateKey
      );

      // JWT has 3 parts
      const parts = jwt.split(".");
      expect(parts.length).toBe(3);

      // Header should be base64url encoded JSON with typ and alg
      const header = JSON.parse(base64urlDecode(parts[0]!).toString());
      expect(header.typ).toBe("JWT");
      expect(header.alg).toBe("ES256");

      // Payload should have aud, exp, and sub
      const payload = JSON.parse(base64urlDecode(parts[1]!).toString());
      expect(payload.aud).toBe("https://fcm.googleapis.com");
      expect(payload.sub).toBe("mailto:test@example.com");
      expect(typeof payload.exp).toBe("number");
    });

    it("should respect custom expiration", () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      const now = Math.floor(Date.now() / 1000);
      const customExpiration = 3600; // 1 hour

      const jwt = createVapidAuthHeader(
        "https://fcm.googleapis.com",
        keys.subject,
        keys.publicKey,
        keys.privateKey,
        customExpiration
      );

      const parts = jwt.split(".");
      const payload = JSON.parse(base64urlDecode(parts[1]!).toString());

      // Expiration should be approximately now + customExpiration
      expect(payload.exp).toBeGreaterThanOrEqual(now + customExpiration - 2);
      expect(payload.exp).toBeLessThanOrEqual(now + customExpiration + 2);
    });
  });

  describe("getAudienceFromEndpoint", () => {
    it("should extract origin from FCM endpoint", () => {
      const audience = getAudienceFromEndpoint(
        "https://fcm.googleapis.com/fcm/send/abc123"
      );
      expect(audience).toBe("https://fcm.googleapis.com");
    });

    it("should extract origin from Mozilla endpoint", () => {
      const audience = getAudienceFromEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/abc"
      );
      expect(audience).toBe("https://updates.push.services.mozilla.com");
    });

    it("should throw VapidError for invalid URL", () => {
      expect(() => getAudienceFromEndpoint("not-a-url")).toThrow(VapidError);
    });
  });

  describe("formatCryptoKeyHeader", () => {
    it("should format key correctly", () => {
      const publicKey = "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7";
      const header = formatCryptoKeyHeader(publicKey);
      expect(header).toBe(`p256ecdsa=${publicKey}`);
    });
  });

  describe("VAPID Key Singleton", () => {
    it("should return null when no keys are set", () => {
      expect(getVapidKeys()).toBe(null);
      expect(hasVapidKeys()).toBe(false);
    });

    it("should store and retrieve keys", () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      setVapidKeys(keys);

      expect(hasVapidKeys()).toBe(true);
      expect(getVapidKeys()).toEqual(keys);
    });

    it("should reset keys", () => {
      const keys = generateVapidKeys("mailto:test@example.com");
      setVapidKeys(keys);
      expect(hasVapidKeys()).toBe(true);

      resetVapidKeys();
      expect(hasVapidKeys()).toBe(false);
      expect(getVapidKeys()).toBe(null);
    });

    it("should throw VapidError when setting invalid keys", () => {
      const invalidKeys: VapidKeys = {
        publicKey: "invalid",
        privateKey: "invalid",
        subject: "mailto:test@example.com",
      };
      expect(() => setVapidKeys(invalidKeys)).toThrow(VapidError);
    });

    it("should load from env if available", () => {
      vi.stubEnv(
        "VAPID_PUBLIC_KEY",
        "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw"
      );
      vi.stubEnv("VAPID_PRIVATE_KEY", "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs");
      vi.stubEnv("VAPID_SUBJECT", "mailto:env@example.com");

      const keys = getVapidKeys();
      expect(keys).not.toBe(null);
      expect(keys!.subject).toBe("mailto:env@example.com");
    });
  });
});

describe("VapidError", () => {
  it("should have correct name", () => {
    const error = new VapidError("test message", "TEST_CODE");
    expect(error.name).toBe("VapidError");
  });

  it("should have correct message and code", () => {
    const error = new VapidError("test message", "TEST_CODE");
    expect(error.message).toBe("test message");
    expect(error.code).toBe("TEST_CODE");
  });

  it("should be instanceof Error", () => {
    const error = new VapidError("test", "TEST");
    expect(error instanceof Error).toBe(true);
    expect(error instanceof VapidError).toBe(true);
  });
});
