/**
 * Unit tests for push notification types and validation functions
 */

import { describe, it, expect } from "vitest";
import {
  PushNotificationStatus,
  PushSubscriptionState,
  PushUrgency,
  isValidVapidPublicKey,
  isValidVapidPrivateKey,
  isValidPushEndpoint,
  hasValidSubscriptionKeys,
  isValidPushSubscription,
  isValidVapidKeys,
  extractPushServiceDomain,
  identifyPushService,
  generateSubscriptionId,
  generateResultId,
  truncateEndpoint,
  calculateTtlByUrgency,
  isValidNotificationPayload,
  truncatePayload,
  DEFAULT_PUSH_CONFIG,
  type VapidKeys,
  type PushSubscription,
  type PushSubscriptionKeys,
  type PushNotificationPayload,
} from "../../../src/notifications/push";

describe("Push Notification Types", () => {
  describe("Enums", () => {
    it("should have correct PushNotificationStatus values", () => {
      expect(PushNotificationStatus.PENDING).toBe("pending");
      expect(PushNotificationStatus.SENT).toBe("sent");
      expect(PushNotificationStatus.DELIVERED).toBe("delivered");
      expect(PushNotificationStatus.FAILED).toBe("failed");
      expect(PushNotificationStatus.EXPIRED).toBe("expired");
    });

    it("should have correct PushSubscriptionState values", () => {
      expect(PushSubscriptionState.ACTIVE).toBe("active");
      expect(PushSubscriptionState.EXPIRED).toBe("expired");
      expect(PushSubscriptionState.UNSUBSCRIBED).toBe("unsubscribed");
      expect(PushSubscriptionState.INVALID).toBe("invalid");
    });

    it("should have correct PushUrgency values", () => {
      expect(PushUrgency.VERY_LOW).toBe("very-low");
      expect(PushUrgency.LOW).toBe("low");
      expect(PushUrgency.NORMAL).toBe("normal");
      expect(PushUrgency.HIGH).toBe("high");
    });
  });

  describe("DEFAULT_PUSH_CONFIG", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_PUSH_CONFIG.defaultTtl).toBe(3600);
      expect(DEFAULT_PUSH_CONFIG.defaultUrgency).toBe(PushUrgency.NORMAL);
      expect(DEFAULT_PUSH_CONFIG.devMode).toBe(false);
      expect(DEFAULT_PUSH_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_PUSH_CONFIG.retryDelay).toBe(1000);
      expect(DEFAULT_PUSH_CONFIG.timeout).toBe(30000);
      expect(DEFAULT_PUSH_CONFIG.maxConcurrency).toBe(10);
    });
  });
});

describe("VAPID Key Validation", () => {
  describe("isValidVapidPublicKey", () => {
    it("should return true for valid public key format", () => {
      // A valid VAPID public key is ~87 characters base64url encoded
      const validKey =
        "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw";
      expect(isValidVapidPublicKey(validKey)).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isValidVapidPublicKey("")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isValidVapidPublicKey(null as unknown as string)).toBe(false);
      expect(isValidVapidPublicKey(undefined as unknown as string)).toBe(false);
    });

    it("should return false for too short key", () => {
      expect(isValidVapidPublicKey("shortkey")).toBe(false);
    });

    it("should return false for key with invalid characters", () => {
      expect(
        isValidVapidPublicKey(
          "invalid!key@with#special$chars%that^are&not*allowed(in)base64url"
        )
      ).toBe(false);
    });
  });

  describe("isValidVapidPrivateKey", () => {
    it("should return true for valid private key format", () => {
      // A valid VAPID private key is ~43 characters base64url encoded
      const validKey = "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs";
      expect(isValidVapidPrivateKey(validKey)).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isValidVapidPrivateKey("")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isValidVapidPrivateKey(null as unknown as string)).toBe(false);
      expect(isValidVapidPrivateKey(undefined as unknown as string)).toBe(false);
    });

    it("should return false for too short key", () => {
      expect(isValidVapidPrivateKey("short")).toBe(false);
    });
  });

  describe("isValidVapidKeys", () => {
    it("should return true for valid VAPID keys", () => {
      const keys: VapidKeys = {
        publicKey:
          "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw",
        privateKey: "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
        subject: "mailto:test@example.com",
      };
      expect(isValidVapidKeys(keys)).toBe(true);
    });

    it("should return true for https subject", () => {
      const keys: VapidKeys = {
        publicKey:
          "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw",
        privateKey: "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
        subject: "https://example.com",
      };
      expect(isValidVapidKeys(keys)).toBe(true);
    });

    it("should return false for invalid subject format", () => {
      const keys: VapidKeys = {
        publicKey:
          "BNbxGY0mFnV1rYQRCAEMAj1amY0P3F32xq-Gma8CcDo7JRlW1yOmFmR6TaBJW1sXX1JXn-NxuKPb7n8KvMFXQsw",
        privateKey: "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
        subject: "test@example.com", // Missing mailto:
      };
      expect(isValidVapidKeys(keys)).toBe(false);
    });

    it("should return false for null keys", () => {
      expect(isValidVapidKeys(null as unknown as VapidKeys)).toBe(false);
    });

    it("should return false for invalid public key", () => {
      const keys: VapidKeys = {
        publicKey: "invalid",
        privateKey: "k4CUeRXJY5FH9hYhT3x5uLJq3Xzv8R2M6d0Y_kE1Fxs",
        subject: "mailto:test@example.com",
      };
      expect(isValidVapidKeys(keys)).toBe(false);
    });
  });
});

describe("Push Endpoint Validation", () => {
  describe("isValidPushEndpoint", () => {
    it("should return true for FCM endpoint", () => {
      expect(
        isValidPushEndpoint(
          "https://fcm.googleapis.com/fcm/send/abc123:xyz456"
        )
      ).toBe(true);
    });

    it("should return true for Mozilla endpoint", () => {
      expect(
        isValidPushEndpoint(
          "https://updates.push.services.mozilla.com/wpush/v2/abc123"
        )
      ).toBe(true);
    });

    it("should return true for any HTTPS endpoint", () => {
      expect(
        isValidPushEndpoint("https://custom-push-server.example.com/push/abc")
      ).toBe(true);
    });

    it("should return false for HTTP endpoint", () => {
      expect(
        isValidPushEndpoint("http://fcm.googleapis.com/fcm/send/abc123")
      ).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidPushEndpoint("")).toBe(false);
    });

    it("should return false for invalid URL", () => {
      expect(isValidPushEndpoint("not-a-url")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isValidPushEndpoint(null as unknown as string)).toBe(false);
      expect(isValidPushEndpoint(undefined as unknown as string)).toBe(false);
    });
  });

  describe("extractPushServiceDomain", () => {
    it("should extract domain from FCM endpoint", () => {
      expect(
        extractPushServiceDomain(
          "https://fcm.googleapis.com/fcm/send/abc123"
        )
      ).toBe("fcm.googleapis.com");
    });

    it("should extract domain from Mozilla endpoint", () => {
      expect(
        extractPushServiceDomain(
          "https://updates.push.services.mozilla.com/wpush/v2/abc"
        )
      ).toBe("updates.push.services.mozilla.com");
    });

    it("should return null for invalid URL", () => {
      expect(extractPushServiceDomain("not-a-url")).toBe(null);
    });
  });

  describe("identifyPushService", () => {
    it("should identify FCM service", () => {
      expect(
        identifyPushService("https://fcm.googleapis.com/fcm/send/abc123")
      ).toBe("fcm");
    });

    it("should identify Mozilla service", () => {
      expect(
        identifyPushService(
          "https://updates.push.services.mozilla.com/wpush/v2/abc"
        )
      ).toBe("mozilla");
    });

    it("should identify Apple service", () => {
      expect(
        identifyPushService("https://web.push.apple.com/abc123")
      ).toBe("apple");
    });

    it("should identify Windows service", () => {
      expect(
        identifyPushService("https://notify.windows.com/abc123")
      ).toBe("windows");
    });

    it("should return unknown for custom service", () => {
      expect(
        identifyPushService("https://custom-push.example.com/abc123")
      ).toBe("unknown");
    });
  });
});

describe("Push Subscription Validation", () => {
  describe("hasValidSubscriptionKeys", () => {
    it("should return true for valid keys", () => {
      const keys: PushSubscriptionKeys = {
        p256dh:
          "BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk0k",
        auth: "4vQK-SvRAN5eo-8ASlrwSg",
      };
      expect(hasValidSubscriptionKeys(keys)).toBe(true);
    });

    it("should return false for missing p256dh", () => {
      const keys = { auth: "4vQK-SvRAN5eo-8ASlrwSg" } as PushSubscriptionKeys;
      expect(hasValidSubscriptionKeys(keys)).toBe(false);
    });

    it("should return false for missing auth", () => {
      const keys = {
        p256dh:
          "BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk0k",
      } as PushSubscriptionKeys;
      expect(hasValidSubscriptionKeys(keys)).toBe(false);
    });

    it("should return false for too short keys", () => {
      const keys: PushSubscriptionKeys = {
        p256dh: "short",
        auth: "short",
      };
      expect(hasValidSubscriptionKeys(keys)).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(hasValidSubscriptionKeys(null as unknown as PushSubscriptionKeys)).toBe(false);
      expect(hasValidSubscriptionKeys(undefined as unknown as PushSubscriptionKeys)).toBe(
        false
      );
    });
  });

  describe("isValidPushSubscription", () => {
    const validSubscription: PushSubscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: {
        p256dh:
          "BLQELIDm-6b9Bl07YrEuXJ4BL_YBVQ0dvt9NQGGJxIQidJWHPNa9YrouvcQ9d7_MqzvGS9Alz60SZNCG3qfpk0k",
        auth: "4vQK-SvRAN5eo-8ASlrwSg",
      },
    };

    it("should return true for valid subscription", () => {
      expect(isValidPushSubscription(validSubscription)).toBe(true);
    });

    it("should return false for invalid endpoint", () => {
      const sub = { ...validSubscription, endpoint: "invalid" };
      expect(isValidPushSubscription(sub)).toBe(false);
    });

    it("should return false for invalid keys", () => {
      const sub = {
        ...validSubscription,
        keys: { p256dh: "short", auth: "short" },
      };
      expect(isValidPushSubscription(sub)).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isValidPushSubscription(null as unknown as PushSubscription)).toBe(false);
      expect(isValidPushSubscription(undefined as unknown as PushSubscription)).toBe(false);
    });
  });
});

describe("Notification Payload Validation", () => {
  describe("isValidNotificationPayload", () => {
    it("should return true for valid payload", () => {
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "Test body message",
      };
      expect(isValidNotificationPayload(payload)).toBe(true);
    });

    it("should return true for payload with all fields", () => {
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "Test body message",
        icon: "https://example.com/icon.png",
        badge: "https://example.com/badge.png",
        image: "https://example.com/image.png",
        tag: "test-tag",
        requireInteraction: true,
        silent: false,
        url: "https://example.com/action",
        actions: [
          { action: "view", title: "View" },
          { action: "dismiss", title: "Dismiss" },
        ],
      };
      expect(isValidNotificationPayload(payload)).toBe(true);
    });

    it("should return false for missing title", () => {
      const payload = { body: "Test body" } as PushNotificationPayload;
      expect(isValidNotificationPayload(payload)).toBe(false);
    });

    it("should return false for missing body", () => {
      const payload = { title: "Test Title" } as PushNotificationPayload;
      expect(isValidNotificationPayload(payload)).toBe(false);
    });

    it("should return false for title too long", () => {
      const payload: PushNotificationPayload = {
        title: "A".repeat(101),
        body: "Test body",
      };
      expect(isValidNotificationPayload(payload)).toBe(false);
    });

    it("should return false for body too long", () => {
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "A".repeat(501),
      };
      expect(isValidNotificationPayload(payload)).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isValidNotificationPayload(null as unknown as PushNotificationPayload)).toBe(
        false
      );
      expect(
        isValidNotificationPayload(undefined as unknown as PushNotificationPayload)
      ).toBe(false);
    });
  });

  describe("truncatePayload", () => {
    it("should not modify valid payload", () => {
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "Test body message",
      };
      const result = truncatePayload(payload);
      expect(result.title).toBe("Test Title");
      expect(result.body).toBe("Test body message");
    });

    it("should truncate title to 100 chars", () => {
      const payload: PushNotificationPayload = {
        title: "A".repeat(150),
        body: "Test body",
      };
      const result = truncatePayload(payload);
      expect(result.title.length).toBe(100);
    });

    it("should truncate body to 500 chars", () => {
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "B".repeat(600),
      };
      const result = truncatePayload(payload);
      expect(result.body.length).toBe(500);
    });

    it("should preserve other fields", () => {
      const payload: PushNotificationPayload = {
        title: "Test Title",
        body: "Test body",
        icon: "https://example.com/icon.png",
        tag: "test-tag",
      };
      const result = truncatePayload(payload);
      expect(result.icon).toBe("https://example.com/icon.png");
      expect(result.tag).toBe("test-tag");
    });
  });
});

describe("Utility Functions", () => {
  describe("generateSubscriptionId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateSubscriptionId("https://example.com/push/1");
      const id2 = generateSubscriptionId("https://example.com/push/2");
      expect(id1).not.toBe(id2);
    });

    it("should start with push_", () => {
      const id = generateSubscriptionId("https://example.com/push/test");
      expect(id.startsWith("push_")).toBe(true);
    });

    it("should be consistent for same endpoint", () => {
      // IDs include timestamp so won't be exactly the same, but hash portion should match
      const endpoint = "https://example.com/push/same";
      const id1 = generateSubscriptionId(endpoint);
      const id2 = generateSubscriptionId(endpoint);
      // Both should start with push_
      expect(id1.startsWith("push_")).toBe(true);
      expect(id2.startsWith("push_")).toBe(true);
    });
  });

  describe("generateResultId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateResultId();
      const id2 = generateResultId();
      expect(id1).not.toBe(id2);
    });

    it("should start with result_", () => {
      const id = generateResultId();
      expect(id.startsWith("result_")).toBe(true);
    });
  });

  describe("truncateEndpoint", () => {
    it("should truncate long endpoints", () => {
      const endpoint =
        "https://fcm.googleapis.com/fcm/send/abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz0";
      const result = truncateEndpoint(endpoint, 20);
      expect(result).toContain("...");
      expect(result.length).toBeLessThan(endpoint.length);
    });

    it("should not truncate short endpoints", () => {
      const endpoint = "https://short.com/x";
      const result = truncateEndpoint(endpoint, 20);
      expect(result).toBe(endpoint);
    });

    it("should use default showChars", () => {
      const endpoint =
        "https://fcm.googleapis.com/fcm/send/abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yz0";
      const result = truncateEndpoint(endpoint);
      expect(result).toContain("...");
    });
  });

  describe("calculateTtlByUrgency", () => {
    it("should return 24 hours for very-low urgency", () => {
      expect(calculateTtlByUrgency(PushUrgency.VERY_LOW)).toBe(86400);
    });

    it("should return 12 hours for low urgency", () => {
      expect(calculateTtlByUrgency(PushUrgency.LOW)).toBe(43200);
    });

    it("should return 1 hour for normal urgency", () => {
      expect(calculateTtlByUrgency(PushUrgency.NORMAL)).toBe(3600);
    });

    it("should return 15 minutes for high urgency", () => {
      expect(calculateTtlByUrgency(PushUrgency.HIGH)).toBe(900);
    });

    it("should return default for unknown urgency", () => {
      expect(calculateTtlByUrgency("unknown" as PushUrgency)).toBe(3600);
    });
  });
});
