/**
 * Web Push notification client for the Polymarket Tracker
 * Handles sending push notifications via the Web Push protocol
 */

import * as crypto from "crypto";
import * as https from "https";
import * as http from "http";
import {
  PushServiceConfig,
  PushSubscription,
  PushNotificationPayload,
  PushSendResult,
  PushNotificationStatus,
  PushBatchOptions,
  PushBatchResult,
  PushMessageOptions,
  PushEventType,
  PushEvent,
  PushEventHandler,
  DEFAULT_PUSH_CONFIG,
  isValidPushSubscription,
  truncatePayload,
  generateResultId,
} from "./types";
import {
  base64urlDecode,
  createVapidAuthHeader,
  getAudienceFromEndpoint,
  setVapidKeys,
} from "./vapid";

/**
 * Error class for push notification client errors
 */
export class PushClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "PushClientError";
  }
}

/**
 * Encryption result interface
 */
interface EncryptionResult {
  ciphertext: Buffer;
  salt: Buffer;
  localPublicKey: Buffer;
}

/**
 * Web Push notification client
 *
 * Handles sending push notifications using the Web Push protocol
 * with VAPID authentication and payload encryption.
 */
export class PushClient {
  private config: Required<PushServiceConfig>;
  private eventHandlers: Map<PushEventType, Set<PushEventHandler>> = new Map();
  private stats = {
    sent: 0,
    failed: 0,
    expired: 0,
  };

  /**
   * Create a new PushClient instance
   *
   * @param config - Push service configuration
   * @throws PushClientError if VAPID keys are invalid
   */
  constructor(config: PushServiceConfig) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_PUSH_CONFIG,
      ...config,
      vapidKeys: config.vapidKeys,
    } as Required<PushServiceConfig>;

    // Validate VAPID keys
    if (
      !this.config.vapidKeys ||
      !this.config.vapidKeys.publicKey ||
      !this.config.vapidKeys.privateKey
    ) {
      throw new PushClientError("VAPID keys are required", "MISSING_VAPID_KEYS");
    }

    // Store VAPID keys for global access
    setVapidKeys(this.config.vapidKeys);

    this.emit({
      type: "service:started",
      timestamp: new Date(),
    });
  }

  /**
   * Send a push notification to a single subscription
   *
   * @param subscription - Push subscription to send to
   * @param payload - Notification payload
   * @param options - Optional message options
   * @returns Push send result
   */
  async send(
    subscription: PushSubscription,
    payload: PushNotificationPayload,
    options?: PushMessageOptions
  ): Promise<PushSendResult> {
    const resultId = generateResultId();
    const timestamp = new Date();

    // Emit sending event
    this.emit({
      type: "notification:sending",
      timestamp,
      endpoint: subscription.endpoint,
      resultId,
    });

    // Validate subscription
    if (!isValidPushSubscription(subscription)) {
      const result: PushSendResult = {
        id: resultId,
        endpoint: subscription.endpoint,
        status: PushNotificationStatus.FAILED,
        timestamp,
        error: "Invalid subscription",
      };
      this.stats.failed++;
      this.emit({
        type: "notification:failed",
        timestamp: new Date(),
        endpoint: subscription.endpoint,
        resultId,
        error: result.error,
      });
      return result;
    }

    // Validate required fields exist (title and body must exist and be non-empty)
    if (!payload.title || !payload.body) {
      const result: PushSendResult = {
        id: resultId,
        endpoint: subscription.endpoint,
        status: PushNotificationStatus.FAILED,
        timestamp,
        error: "Invalid notification payload",
      };
      this.stats.failed++;
      this.emit({
        type: "notification:failed",
        timestamp: new Date(),
        endpoint: subscription.endpoint,
        resultId,
        error: result.error,
      });
      return result;
    }

    // Truncate payload to safe lengths after validation
    const safePayload = truncatePayload(payload);

    // Dev mode - just log
    if (this.config.devMode) {
      const result: PushSendResult = {
        id: resultId,
        endpoint: subscription.endpoint,
        status: PushNotificationStatus.SENT,
        statusCode: 201,
        timestamp,
      };
      this.stats.sent++;
      this.emit({
        type: "notification:sent",
        timestamp: new Date(),
        endpoint: subscription.endpoint,
        resultId,
        metadata: { devMode: true, payload: safePayload },
      });
      return result;
    }

    // Attempt to send with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.sendRequest(subscription, safePayload, options, resultId);
        this.stats.sent++;
        this.emit({
          type: "notification:sent",
          timestamp: new Date(),
          endpoint: subscription.endpoint,
          resultId,
        });
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if subscription is expired (410 Gone)
        if (error instanceof PushClientError && error.statusCode === 410) {
          const result: PushSendResult = {
            id: resultId,
            endpoint: subscription.endpoint,
            status: PushNotificationStatus.EXPIRED,
            statusCode: 410,
            timestamp,
            subscriptionExpired: true,
            error: "Subscription expired",
          };
          this.stats.expired++;
          this.emit({
            type: "subscription:expired",
            timestamp: new Date(),
            endpoint: subscription.endpoint,
            resultId,
          });
          return result;
        }

        // Check if subscription is invalid (404 Not Found)
        if (error instanceof PushClientError && error.statusCode === 404) {
          const result: PushSendResult = {
            id: resultId,
            endpoint: subscription.endpoint,
            status: PushNotificationStatus.FAILED,
            statusCode: 404,
            timestamp,
            subscriptionExpired: true,
            error: "Subscription not found",
          };
          this.stats.failed++;
          this.emit({
            type: "notification:failed",
            timestamp: new Date(),
            endpoint: subscription.endpoint,
            resultId,
            error: result.error,
          });
          return result;
        }

        // Retry on recoverable errors
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // All retries failed
    const result: PushSendResult = {
      id: resultId,
      endpoint: subscription.endpoint,
      status: PushNotificationStatus.FAILED,
      timestamp,
      error: lastError?.message || "Unknown error",
    };
    this.stats.failed++;
    this.emit({
      type: "notification:failed",
      timestamp: new Date(),
      endpoint: subscription.endpoint,
      resultId,
      error: result.error,
    });
    return result;
  }

  /**
   * Send push notifications to multiple subscriptions
   *
   * @param subscriptions - Array of subscriptions
   * @param payload - Notification payload
   * @param options - Batch options
   * @returns Batch result with all send results
   */
  async sendBatch(
    subscriptions: PushSubscription[],
    payload: PushNotificationPayload,
    options?: PushBatchOptions
  ): Promise<PushBatchResult> {
    const batchOptions: Required<PushBatchOptions> = {
      concurrency: options?.concurrency ?? this.config.maxConcurrency,
      stopOnError: options?.stopOnError ?? false,
      batchDelay: options?.batchDelay ?? 0,
    };

    const results: PushSendResult[] = [];
    const expiredEndpoints: string[] = [];
    let sent = 0;
    let failed = 0;
    let expired = 0;

    // Process in batches with concurrency limit
    for (let i = 0; i < subscriptions.length; i += batchOptions.concurrency) {
      const batch = subscriptions.slice(i, i + batchOptions.concurrency);

      const batchResults = await Promise.all(batch.map((sub) => this.send(sub, payload)));

      for (const result of batchResults) {
        results.push(result);

        if (result.status === PushNotificationStatus.SENT) {
          sent++;
        } else if (result.subscriptionExpired) {
          expired++;
          expiredEndpoints.push(result.endpoint);
        } else {
          failed++;
        }

        if (batchOptions.stopOnError && result.status === PushNotificationStatus.FAILED) {
          break;
        }
      }

      // Delay between batches
      if (batchOptions.batchDelay > 0 && i + batchOptions.concurrency < subscriptions.length) {
        await this.delay(batchOptions.batchDelay);
      }
    }

    return {
      total: subscriptions.length,
      sent,
      failed,
      expired,
      results,
      expiredEndpoints,
    };
  }

  /**
   * Add an event handler
   *
   * @param type - Event type to listen for
   * @param handler - Event handler function
   */
  on(type: PushEventType, handler: PushEventHandler): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);
  }

  /**
   * Remove an event handler
   *
   * @param type - Event type
   * @param handler - Handler to remove
   */
  off(type: PushEventType, handler: PushEventHandler): void {
    this.eventHandlers.get(type)?.delete(handler);
  }

  /**
   * Get current statistics
   */
  getStats(): { sent: number; failed: number; expired: number } {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { sent: 0, failed: 0, expired: 0 };
  }

  /**
   * Get the public VAPID key for client-side subscription
   */
  getPublicKey(): string {
    return this.config.vapidKeys.publicKey;
  }

  /**
   * Check if client is in dev mode
   */
  isDevMode(): boolean {
    return this.config.devMode;
  }

  /**
   * Stop the client and emit stop event
   */
  stop(): void {
    this.emit({
      type: "service:stopped",
      timestamp: new Date(),
    });
  }

  /**
   * Send the actual HTTP request to the push service
   */
  private async sendRequest(
    subscription: PushSubscription,
    payload: PushNotificationPayload,
    options: PushMessageOptions | undefined,
    resultId: string
  ): Promise<PushSendResult> {
    // Encrypt the payload
    const payloadBuffer = Buffer.from(JSON.stringify(payload));
    const encrypted = await this.encryptPayload(payloadBuffer, subscription);

    // Build request headers
    const audience = getAudienceFromEndpoint(subscription.endpoint);
    const vapidJwt = createVapidAuthHeader(
      audience,
      this.config.vapidKeys.subject,
      this.config.vapidKeys.publicKey,
      this.config.vapidKeys.privateKey
    );

    const ttl = options?.ttl ?? this.config.defaultTtl;
    const urgency = options?.urgency ?? this.config.defaultUrgency;

    const headers: Record<string, string> = {
      TTL: String(ttl),
      Urgency: urgency,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(encrypted.ciphertext.length),
      Authorization: `vapid t=${vapidJwt}, k=${this.config.vapidKeys.publicKey}`,
    };

    if (options?.topic) {
      headers["Topic"] = options.topic;
    }

    // Make the request
    const url = new URL(subscription.endpoint);
    const requestOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers,
      timeout: this.config.timeout,
    };

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === "https:" ? https : http;
      const req = protocol.request(requestOptions, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const statusCode = res.statusCode || 0;

          // Success: 201 Created
          if (statusCode === 201) {
            resolve({
              id: resultId,
              endpoint: subscription.endpoint,
              status: PushNotificationStatus.SENT,
              statusCode,
              timestamp: new Date(),
            });
            return;
          }

          // Subscription gone: 410
          if (statusCode === 410) {
            reject(
              new PushClientError("Subscription expired", "SUBSCRIPTION_EXPIRED", statusCode)
            );
            return;
          }

          // Subscription not found: 404
          if (statusCode === 404) {
            reject(
              new PushClientError("Subscription not found", "SUBSCRIPTION_NOT_FOUND", statusCode)
            );
            return;
          }

          // Rate limited: 429
          if (statusCode === 429) {
            reject(new PushClientError("Rate limited", "RATE_LIMITED", statusCode));
            return;
          }

          // Other errors
          reject(
            new PushClientError(`Push service error: ${statusCode} - ${body}`, "PUSH_ERROR", statusCode)
          );
        });
      });

      req.on("error", (error) => {
        reject(new PushClientError(`Network error: ${error.message}`, "NETWORK_ERROR"));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new PushClientError("Request timeout", "TIMEOUT"));
      });

      // Write encrypted payload
      req.write(encrypted.ciphertext);
      req.end();
    });
  }

  /**
   * Encrypt payload using Web Push encryption
   * Based on RFC 8291 (Message Encryption for Web Push)
   */
  private async encryptPayload(
    payload: Buffer,
    subscription: PushSubscription
  ): Promise<EncryptionResult> {
    // Generate local key pair for this message
    const localKeyPair = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });

    // Export local public key (uncompressed)
    const localPublicKeyDer = localKeyPair.publicKey.export({
      type: "spki",
      format: "der",
    });
    const localPublicKey = localPublicKeyDer.subarray(-65);

    // Decode subscription's public key
    const subscriptionPublicKey = base64urlDecode(subscription.keys.p256dh);

    // Import subscription public key
    const peerPublicKey = crypto.createPublicKey({
      key: Buffer.concat([
        // SPKI header for P-256
        Buffer.from([
          0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
          0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
        ]),
        subscriptionPublicKey,
      ]),
      format: "der",
      type: "spki",
    });

    // Compute shared secret using ECDH
    const sharedSecret = crypto.diffieHellman({
      privateKey: localKeyPair.privateKey,
      publicKey: peerPublicKey,
    });

    // Decode auth secret
    const authSecret = base64urlDecode(subscription.keys.auth);

    // Generate salt (16 bytes)
    const salt = crypto.randomBytes(16);

    // Derive keys using HKDF
    // IKM = ECDH(local_private, peer_public)
    // PRK = HKDF-Extract(auth_secret, IKM)
    const prk = this.hkdfExtract(authSecret, sharedSecret);

    // Info for content encryption key derivation
    // "WebPush: info" || 0x00 || receiver_public || sender_public
    const keyInfo = Buffer.concat([
      Buffer.from("WebPush: info\x00"),
      subscriptionPublicKey,
      localPublicKey,
    ]);

    // Derive CEK and nonce
    const ikm = this.hkdfExpand(prk, keyInfo, 32);

    const cekInfo = Buffer.from("Content-Encoding: aes128gcm\x00");
    const nonceInfo = Buffer.from("Content-Encoding: nonce\x00");

    const prkFinal = this.hkdfExtract(salt, ikm);
    const contentEncryptionKey = this.hkdfExpand(prkFinal, cekInfo, 16);
    const nonce = this.hkdfExpand(prkFinal, nonceInfo, 12);

    // Add padding to payload (RFC 8291)
    // Record size is 4096 by default, but we use a smaller size for efficiency
    const recordSize = 4096;
    const paddedPayload = Buffer.concat([payload, Buffer.from([2])]);

    // Encrypt with AES-128-GCM
    const cipher = crypto.createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
    const encrypted = Buffer.concat([cipher.update(paddedPayload), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Build the complete encrypted message
    // Format: salt (16) + record_size (4) + key_id_len (1) + key_id (65) + ciphertext + tag (16)
    const recordSizeBuffer = Buffer.alloc(4);
    recordSizeBuffer.writeUInt32BE(recordSize, 0);

    const ciphertext = Buffer.concat([
      salt,
      recordSizeBuffer,
      Buffer.from([65]), // Key ID length
      localPublicKey,
      encrypted,
      authTag,
    ]);

    return {
      ciphertext,
      salt,
      localPublicKey,
    };
  }

  /**
   * HKDF Extract function
   */
  private hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
    return crypto.createHmac("sha256", salt).update(ikm).digest();
  }

  /**
   * HKDF Expand function
   */
  private hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
    let output = Buffer.alloc(0);
    let counter = 1;
    let t = Buffer.alloc(0);

    while (output.length < length) {
      const input = Buffer.concat([t, info, Buffer.from([counter])]);
      t = crypto.createHmac("sha256", prk).update(input).digest();
      output = Buffer.concat([output, t]);
      counter++;
    }

    return output.subarray(0, length);
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(event: PushEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

let pushClientInstance: PushClient | null = null;

/**
 * Get or create the singleton PushClient instance
 *
 * @param config - Configuration (required on first call)
 * @returns PushClient instance
 */
export function getPushClient(config?: PushServiceConfig): PushClient {
  if (!pushClientInstance && config) {
    pushClientInstance = new PushClient(config);
  }
  if (!pushClientInstance) {
    throw new PushClientError(
      "PushClient not initialized. Call getPushClient with config first.",
      "NOT_INITIALIZED"
    );
  }
  return pushClientInstance;
}

/**
 * Create a new PushClient instance (does not affect singleton)
 *
 * @param config - Push service configuration
 * @returns New PushClient instance
 */
export function createPushClient(config: PushServiceConfig): PushClient {
  return new PushClient(config);
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetPushClient(): void {
  if (pushClientInstance) {
    pushClientInstance.stop();
    pushClientInstance = null;
  }
}

/**
 * Check if PushClient is initialized
 */
export function isPushClientInitialized(): boolean {
  return pushClientInstance !== null;
}
