/**
 * Web Push notification types for the Polymarket Tracker
 * Defines interfaces and types for Web Push API integration
 */

/**
 * Push notification delivery status
 */
export enum PushNotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  EXPIRED = "expired",
}

/**
 * Push subscription state
 */
export enum PushSubscriptionState {
  ACTIVE = "active",
  EXPIRED = "expired",
  UNSUBSCRIBED = "unsubscribed",
  INVALID = "invalid",
}

/**
 * Push notification urgency levels
 * https://datatracker.ietf.org/doc/html/rfc8030#section-5.3
 */
export enum PushUrgency {
  VERY_LOW = "very-low",
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
}

/**
 * VAPID (Voluntary Application Server Identification) keys configuration
 * Used for authentication with push services
 */
export interface VapidKeys {
  /** Public key for client-side subscription */
  publicKey: string;
  /** Private key for server-side signing (keep secret!) */
  privateKey: string;
  /** Contact email or URL for push service communication */
  subject: string;
}

/**
 * Push service configuration
 */
export interface PushServiceConfig {
  /** VAPID keys for authentication */
  vapidKeys: VapidKeys;
  /** Default TTL (Time To Live) in seconds */
  defaultTtl?: number;
  /** Default urgency level */
  defaultUrgency?: PushUrgency;
  /** Whether to enable development mode (logs instead of sending) */
  devMode?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum concurrent requests */
  maxConcurrency?: number;
}

/**
 * Push subscription keys from the browser
 * These are provided by the PushSubscription.getKey() method
 */
export interface PushSubscriptionKeys {
  /** p256dh key - used for message encryption */
  p256dh: string;
  /** auth key - authentication secret */
  auth: string;
}

/**
 * Push subscription endpoint and keys
 * Represents a user's push subscription from the browser
 */
export interface PushSubscription {
  /** Unique endpoint URL provided by the push service */
  endpoint: string;
  /** Expiration time of the subscription (if provided) */
  expirationTime?: number | null;
  /** Subscription keys for encryption */
  keys: PushSubscriptionKeys;
}

/**
 * Push subscription with metadata
 * Extended subscription info stored in database
 */
export interface PushSubscriptionRecord {
  /** Unique identifier for this subscription */
  id: string;
  /** User ID associated with this subscription */
  userId?: string;
  /** The actual push subscription data */
  subscription: PushSubscription;
  /** Subscription state */
  state: PushSubscriptionState;
  /** User agent string from the subscriber */
  userAgent?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Last successful notification timestamp */
  lastNotificationAt?: Date;
  /** Number of failed delivery attempts */
  failedAttempts: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notification payload for Web Push
 */
export interface PushNotificationPayload {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Icon URL */
  icon?: string;
  /** Badge URL (small monochrome icon) */
  badge?: string;
  /** Image URL (large image to display) */
  image?: string;
  /** Notification tag for grouping/replacing */
  tag?: string;
  /** Whether to require user interaction to dismiss */
  requireInteraction?: boolean;
  /** Whether notification should be silent */
  silent?: boolean;
  /** Vibration pattern for mobile devices */
  vibrate?: number[];
  /** Timestamp to show on notification */
  timestamp?: number;
  /** URL to open when notification is clicked */
  url?: string;
  /** Action buttons */
  actions?: PushNotificationAction[];
  /** Custom data to pass to service worker */
  data?: Record<string, unknown>;
  /** Direction of text (ltr, rtl, auto) */
  dir?: "ltr" | "rtl" | "auto";
  /** Language code */
  lang?: string;
  /** Renotify if tag matches existing notification */
  renotify?: boolean;
}

/**
 * Notification action button
 */
export interface PushNotificationAction {
  /** Action identifier */
  action: string;
  /** Button text */
  title: string;
  /** Button icon URL */
  icon?: string;
}

/**
 * Push notification message to send
 */
export interface PushNotificationMessage {
  /** Target subscription */
  subscription: PushSubscription;
  /** Notification payload */
  payload: PushNotificationPayload;
  /** Message options */
  options?: PushMessageOptions;
}

/**
 * Push message options
 */
export interface PushMessageOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Urgency level */
  urgency?: PushUrgency;
  /** Topic for message replacement */
  topic?: string;
}

/**
 * Push send result
 */
export interface PushSendResult {
  /** Unique result identifier */
  id: string;
  /** Subscription endpoint */
  endpoint: string;
  /** Delivery status */
  status: PushNotificationStatus;
  /** HTTP status code from push service */
  statusCode?: number;
  /** Timestamp when sent */
  timestamp: Date;
  /** Error message if failed */
  error?: string;
  /** Whether the subscription is expired/invalid */
  subscriptionExpired?: boolean;
}

/**
 * Batch push options
 */
export interface PushBatchOptions {
  /** Maximum concurrent sends */
  concurrency?: number;
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Delay between batches in milliseconds */
  batchDelay?: number;
}

/**
 * Batch push result
 */
export interface PushBatchResult {
  /** Total notifications attempted */
  total: number;
  /** Successfully sent */
  sent: number;
  /** Failed to send */
  failed: number;
  /** Expired subscriptions found */
  expired: number;
  /** Individual results */
  results: PushSendResult[];
  /** List of expired endpoint URLs */
  expiredEndpoints: string[];
}

/**
 * Push event types
 */
export type PushEventType =
  | "notification:sending"
  | "notification:sent"
  | "notification:failed"
  | "notification:delivered"
  | "subscription:created"
  | "subscription:updated"
  | "subscription:expired"
  | "subscription:deleted"
  | "service:started"
  | "service:stopped"
  | "error";

/**
 * Push event data
 */
export interface PushEvent {
  /** Event type */
  type: PushEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Subscription ID if applicable */
  subscriptionId?: string;
  /** Endpoint URL if applicable */
  endpoint?: string;
  /** Result ID if applicable */
  resultId?: string;
  /** Error message if applicable */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Push event handler
 */
export type PushEventHandler = (event: PushEvent) => void | Promise<void>;

/**
 * Push subscription storage interface
 * Implement this interface for custom storage backends
 */
export interface PushSubscriptionStorage {
  /** Save a subscription */
  save(subscription: PushSubscriptionRecord): Promise<void>;
  /** Get subscription by ID */
  getById(id: string): Promise<PushSubscriptionRecord | null>;
  /** Get subscription by endpoint */
  getByEndpoint(endpoint: string): Promise<PushSubscriptionRecord | null>;
  /** Get all subscriptions for a user */
  getByUserId(userId: string): Promise<PushSubscriptionRecord[]>;
  /** Get all active subscriptions */
  getAllActive(): Promise<PushSubscriptionRecord[]>;
  /** Update subscription */
  update(id: string, updates: Partial<PushSubscriptionRecord>): Promise<void>;
  /** Delete subscription */
  delete(id: string): Promise<void>;
  /** Delete subscription by endpoint */
  deleteByEndpoint(endpoint: string): Promise<void>;
  /** Mark subscription as expired */
  markExpired(id: string): Promise<void>;
  /** Get count of active subscriptions */
  getActiveCount(): Promise<number>;
  /** Clean up old/expired subscriptions */
  cleanup(maxAgeDays: number): Promise<number>;
}

/**
 * Push statistics
 */
export interface PushStatistics {
  /** Total active subscriptions */
  activeSubscriptions: number;
  /** Total notifications sent */
  totalSent: number;
  /** Total notifications failed */
  totalFailed: number;
  /** Total expired subscriptions */
  totalExpired: number;
  /** Success rate percentage */
  successRate: number;
  /** Statistics timestamp */
  timestamp: Date;
}

// ============================================================================
// Validation and Utility Functions
// ============================================================================

/**
 * Check if a string is a valid VAPID public key
 * VAPID keys are base64url-encoded, uncompressed P-256 public keys
 */
export function isValidVapidPublicKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  // VAPID public keys are 65 bytes when decoded, ~87 chars base64url encoded
  const base64UrlRegex = /^[A-Za-z0-9_-]{80,90}$/;
  return base64UrlRegex.test(key);
}

/**
 * Check if a string is a valid VAPID private key
 * VAPID private keys are base64url-encoded P-256 private keys
 */
export function isValidVapidPrivateKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  // VAPID private keys are 32 bytes when decoded, ~43 chars base64url encoded
  const base64UrlRegex = /^[A-Za-z0-9_-]{40,50}$/;
  return base64UrlRegex.test(key);
}

/**
 * Check if a string is a valid push subscription endpoint
 */
export function isValidPushEndpoint(endpoint: string): boolean {
  if (!endpoint || typeof endpoint !== "string") return false;
  try {
    const url = new URL(endpoint);
    // Push endpoints must be HTTPS
    if (url.protocol !== "https:") return false;
    // Must have a hostname
    if (!url.hostname) return false;
    // Common push service domains
    const validDomains = [
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
      "push.apple.com",
      "wns.windows.com",
      "notify.windows.com",
      "web.push.apple.com",
    ];
    // Allow known domains or any valid HTTPS URL
    return validDomains.some((d) => url.hostname.includes(d)) || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if a push subscription has valid keys
 */
export function hasValidSubscriptionKeys(keys: PushSubscriptionKeys): boolean {
  if (!keys || typeof keys !== "object") return false;
  // p256dh key should be ~87 characters base64url encoded
  if (!keys.p256dh || typeof keys.p256dh !== "string" || keys.p256dh.length < 80) return false;
  // auth key should be ~22 characters base64url encoded (16 bytes)
  if (!keys.auth || typeof keys.auth !== "string" || keys.auth.length < 20) return false;
  return true;
}

/**
 * Validate a complete push subscription
 */
export function isValidPushSubscription(subscription: PushSubscription): boolean {
  if (!subscription || typeof subscription !== "object") return false;
  if (!isValidPushEndpoint(subscription.endpoint)) return false;
  if (!hasValidSubscriptionKeys(subscription.keys)) return false;
  return true;
}

/**
 * Validate VAPID keys configuration
 */
export function isValidVapidKeys(keys: VapidKeys): boolean {
  if (!keys || typeof keys !== "object") return false;
  if (!isValidVapidPublicKey(keys.publicKey)) return false;
  if (!isValidVapidPrivateKey(keys.privateKey)) return false;
  if (!keys.subject || typeof keys.subject !== "string") return false;
  // Subject must be a mailto: or https: URL
  if (!keys.subject.startsWith("mailto:") && !keys.subject.startsWith("https://")) {
    return false;
  }
  return true;
}

/**
 * Extract the push service domain from an endpoint
 */
export function extractPushServiceDomain(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Identify the push service provider from an endpoint
 */
export function identifyPushService(
  endpoint: string
): "fcm" | "mozilla" | "apple" | "windows" | "unknown" {
  const domain = extractPushServiceDomain(endpoint);
  if (!domain) return "unknown";

  if (domain.includes("fcm.googleapis.com") || domain.includes("android.googleapis.com")) {
    return "fcm";
  }
  if (domain.includes("mozilla.com") || domain.includes("mozilla.org")) {
    return "mozilla";
  }
  if (domain.includes("apple.com")) {
    return "apple";
  }
  if (domain.includes("windows.com")) {
    return "windows";
  }

  return "unknown";
}

/**
 * Generate a unique subscription ID from endpoint
 */
export function generateSubscriptionId(endpoint: string): string {
  // Create a hash-like ID from the endpoint
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    const char = endpoint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const timestamp = Date.now().toString(36);
  const hashStr = Math.abs(hash).toString(36);
  return `push_${timestamp}_${hashStr}`;
}

/**
 * Generate a unique result ID
 */
export function generateResultId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `result_${timestamp}_${random}`;
}

/**
 * Truncate endpoint for logging (hide sensitive parts)
 */
export function truncateEndpoint(endpoint: string, showChars: number = 20): string {
  if (!endpoint || endpoint.length <= showChars * 2 + 3) {
    return endpoint;
  }
  const start = endpoint.substring(0, showChars);
  const end = endpoint.substring(endpoint.length - showChars);
  return `${start}...${end}`;
}

/**
 * Calculate TTL (Time To Live) in seconds based on urgency
 */
export function calculateTtlByUrgency(urgency: PushUrgency): number {
  switch (urgency) {
    case PushUrgency.VERY_LOW:
      return 86400; // 24 hours
    case PushUrgency.LOW:
      return 43200; // 12 hours
    case PushUrgency.NORMAL:
      return 3600; // 1 hour
    case PushUrgency.HIGH:
      return 900; // 15 minutes
    default:
      return 3600; // Default 1 hour
  }
}

/**
 * Validate notification payload
 */
export function isValidNotificationPayload(payload: PushNotificationPayload): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.title || typeof payload.title !== "string") return false;
  if (!payload.body || typeof payload.body !== "string") return false;
  // Title and body have reasonable limits
  if (payload.title.length > 100) return false;
  if (payload.body.length > 500) return false;
  return true;
}

/**
 * Truncate payload text fields to safe lengths
 */
export function truncatePayload(payload: PushNotificationPayload): PushNotificationPayload {
  return {
    ...payload,
    title: payload.title.substring(0, 100),
    body: payload.body.substring(0, 500),
  };
}

/**
 * Default push service configuration
 */
export const DEFAULT_PUSH_CONFIG: Partial<PushServiceConfig> = {
  defaultTtl: 3600, // 1 hour
  defaultUrgency: PushUrgency.NORMAL,
  devMode: false,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  maxConcurrency: 10,
};
