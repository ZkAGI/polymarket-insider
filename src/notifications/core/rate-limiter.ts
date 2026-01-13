/**
 * Notification Rate Limiter
 * Prevents spam by limiting notification frequency per user/channel
 * Uses token bucket algorithm for flexible rate limiting
 */

import {
  NotificationChannel,
  NotificationPriority,
  NotificationPayload,
  CreateQueueItemInput,
} from "./types";

/**
 * Rate limit configuration for a specific scope
 */
export interface RateLimitRule {
  /** Maximum number of tokens (burst capacity) */
  maxTokens: number;
  /** Token refill rate per second */
  refillRatePerSecond: number;
  /** Window in milliseconds for sliding window limits */
  windowMs?: number;
  /** Maximum notifications per window (alternative to token bucket) */
  maxPerWindow?: number;
}

/**
 * Rate limit key types
 */
export enum RateLimitKeyType {
  /** Global rate limit for all notifications */
  GLOBAL = "global",
  /** Per-channel rate limit */
  CHANNEL = "channel",
  /** Per-recipient rate limit */
  RECIPIENT = "recipient",
  /** Per-user rate limit (userId in context) */
  USER = "user",
  /** Composite key (channel + recipient) */
  CHANNEL_RECIPIENT = "channel_recipient",
}

/**
 * Rate limit configuration
 */
export interface RateLimiterConfig {
  /** Whether rate limiting is enabled */
  enabled?: boolean;
  /** Global limits applied to all notifications */
  globalLimit?: RateLimitRule;
  /** Per-channel limits */
  channelLimits?: Partial<Record<NotificationChannel, RateLimitRule>>;
  /** Default per-recipient limits */
  recipientLimit?: RateLimitRule;
  /** Per-user limits (for logged in users) */
  userLimit?: RateLimitRule;
  /** Whether to allow priority override (CRITICAL bypasses limits) */
  allowPriorityOverride?: boolean;
  /** Priority threshold for override (default: CRITICAL) */
  priorityOverrideThreshold?: NotificationPriority;
  /** Cleanup interval for expired buckets (ms) */
  cleanupInterval?: number;
  /** Time to keep inactive buckets (ms) */
  bucketTTL?: number;
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  enabled: true,
  globalLimit: {
    maxTokens: 1000, // Allow burst of 1000
    refillRatePerSecond: 100, // Refill 100 per second
    windowMs: 60 * 1000, // 1 minute window
    maxPerWindow: 1000, // Max 1000 per minute globally
  },
  channelLimits: {
    [NotificationChannel.EMAIL]: {
      maxTokens: 100,
      refillRatePerSecond: 1, // 1 per second = 60 per minute
      windowMs: 60 * 60 * 1000, // 1 hour window
      maxPerWindow: 100, // Max 100 emails per hour
    },
    [NotificationChannel.TELEGRAM]: {
      maxTokens: 30,
      refillRatePerSecond: 0.5, // 30 per minute
      windowMs: 60 * 1000,
      maxPerWindow: 30,
    },
    [NotificationChannel.DISCORD]: {
      maxTokens: 30,
      refillRatePerSecond: 0.5,
      windowMs: 60 * 1000,
      maxPerWindow: 30,
    },
    [NotificationChannel.PUSH]: {
      maxTokens: 120,
      refillRatePerSecond: 2, // 120 per minute
      windowMs: 60 * 1000,
      maxPerWindow: 120,
    },
    [NotificationChannel.SMS]: {
      maxTokens: 10,
      refillRatePerSecond: 0.05, // Very limited SMS
      windowMs: 60 * 60 * 1000, // 1 hour
      maxPerWindow: 10,
    },
  },
  recipientLimit: {
    maxTokens: 10,
    refillRatePerSecond: 0.1, // 6 per minute per recipient
    windowMs: 60 * 1000,
    maxPerWindow: 10,
  },
  userLimit: {
    maxTokens: 50,
    refillRatePerSecond: 0.5, // 30 per minute per user
    windowMs: 60 * 1000,
    maxPerWindow: 50,
  },
  allowPriorityOverride: true,
  priorityOverrideThreshold: NotificationPriority.CRITICAL,
  cleanupInterval: 60 * 1000, // Clean every minute
  bucketTTL: 60 * 60 * 1000, // Keep buckets for 1 hour
};

/**
 * Token bucket state
 */
export interface TokenBucket {
  /** Current number of tokens */
  tokens: number;
  /** Maximum tokens */
  maxTokens: number;
  /** Last refill timestamp */
  lastRefill: number;
  /** Refill rate per second */
  refillRatePerSecond: number;
  /** Sliding window counts */
  windowCounts: Array<{ timestamp: number; count: number }>;
  /** Last access timestamp for TTL */
  lastAccess: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the notification is allowed */
  allowed: boolean;
  /** Rate limit key that was checked */
  key: string;
  /** Key type */
  keyType: RateLimitKeyType;
  /** Current token count */
  currentTokens?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** Current window count */
  currentWindowCount?: number;
  /** Max per window */
  maxPerWindow?: number;
  /** Time until tokens refill (ms) */
  retryAfterMs?: number;
  /** Reason for denial */
  reason?: string;
  /** Whether this was a priority override */
  priorityOverride?: boolean;
}

/**
 * Aggregate rate limit check result
 */
export interface AggregateRateLimitResult {
  /** Whether the notification is allowed */
  allowed: boolean;
  /** Results from each scope check */
  results: RateLimitResult[];
  /** The failing result if denied */
  deniedBy?: RateLimitResult;
  /** Minimum retry after time */
  retryAfterMs?: number;
  /** Whether priority override was applied */
  priorityOverride?: boolean;
}

/**
 * Rate limiter statistics
 */
export interface RateLimiterStats {
  /** Total checks performed */
  totalChecks: number;
  /** Total allowed */
  totalAllowed: number;
  /** Total denied */
  totalDenied: number;
  /** Priority overrides used */
  priorityOverrides: number;
  /** Denials by key type */
  denialsByKeyType: Record<RateLimitKeyType, number>;
  /** Denials by channel */
  denialsByChannel: Record<NotificationChannel, number>;
  /** Current number of buckets */
  activeBuckets: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Rate limiter event types
 */
export type RateLimiterEventType =
  | "ratelimit:allowed"
  | "ratelimit:denied"
  | "ratelimit:priority_override"
  | "ratelimit:bucket_created"
  | "ratelimit:bucket_expired"
  | "ratelimit:cleanup"
  | "ratelimit:config_updated";

/**
 * Rate limiter event
 */
export interface RateLimiterEvent {
  type: RateLimiterEventType;
  timestamp: Date;
  key?: string;
  keyType?: RateLimitKeyType;
  channel?: NotificationChannel;
  allowed?: boolean;
  reason?: string;
  retryAfterMs?: number;
  bucketsRemoved?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Rate limiter event handler
 */
export type RateLimiterEventHandler = (event: RateLimiterEvent) => void | Promise<void>;

/**
 * Extract recipient identifier from notification payload
 */
export function extractRecipientId(payload: NotificationPayload): string {
  switch (payload.channel) {
    case NotificationChannel.EMAIL: {
      const emailPayload = payload as { to: string | string[] };
      return Array.isArray(emailPayload.to)
        ? emailPayload.to.sort().join(",")
        : emailPayload.to;
    }
    case NotificationChannel.TELEGRAM: {
      const tgPayload = payload as { chatId: string | number };
      return String(tgPayload.chatId);
    }
    case NotificationChannel.DISCORD: {
      const discordPayload = payload as { webhookUrl?: string };
      return discordPayload.webhookUrl || "default";
    }
    case NotificationChannel.PUSH: {
      const pushPayload = payload as { target: string | string[] };
      return Array.isArray(pushPayload.target)
        ? pushPayload.target.sort().join(",")
        : pushPayload.target;
    }
    case NotificationChannel.SMS: {
      const smsPayload = payload as { phoneNumber: string | string[] };
      return Array.isArray(smsPayload.phoneNumber)
        ? smsPayload.phoneNumber.sort().join(",")
        : smsPayload.phoneNumber;
    }
    default:
      return "unknown";
  }
}

/**
 * Generate rate limit key
 */
export function generateRateLimitKey(
  keyType: RateLimitKeyType,
  channel?: NotificationChannel,
  recipientId?: string,
  userId?: string
): string {
  switch (keyType) {
    case RateLimitKeyType.GLOBAL:
      return "global";
    case RateLimitKeyType.CHANNEL:
      return `channel:${channel}`;
    case RateLimitKeyType.RECIPIENT:
      return `recipient:${recipientId}`;
    case RateLimitKeyType.USER:
      return `user:${userId}`;
    case RateLimitKeyType.CHANNEL_RECIPIENT:
      return `channel_recipient:${channel}:${recipientId}`;
    default:
      return "unknown";
  }
}

/**
 * Notification Rate Limiter
 * Uses token bucket algorithm with sliding window support
 */
export class NotificationRateLimiter {
  private config: Required<RateLimiterConfig>;
  private buckets: Map<string, TokenBucket> = new Map();
  private eventHandlers: Set<RateLimiterEventHandler> = new Set();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private totalChecks = 0;
  private totalAllowed = 0;
  private totalDenied = 0;
  private priorityOverrides = 0;
  private denialsByKeyType: Record<RateLimitKeyType, number> = {
    [RateLimitKeyType.GLOBAL]: 0,
    [RateLimitKeyType.CHANNEL]: 0,
    [RateLimitKeyType.RECIPIENT]: 0,
    [RateLimitKeyType.USER]: 0,
    [RateLimitKeyType.CHANNEL_RECIPIENT]: 0,
  };
  private denialsByChannel: Record<NotificationChannel, number> = {
    [NotificationChannel.EMAIL]: 0,
    [NotificationChannel.TELEGRAM]: 0,
    [NotificationChannel.DISCORD]: 0,
    [NotificationChannel.PUSH]: 0,
    [NotificationChannel.SMS]: 0,
  };

  constructor(config: RateLimiterConfig = {}) {
    this.config = this.mergeConfig(config);
    this.startCleanupTimer();
  }

  /**
   * Merge config with defaults
   * Note: To disable a limit, explicitly pass undefined in config (e.g., globalLimit: undefined)
   * This is checked with Object.prototype.hasOwnProperty to differentiate from "not provided"
   *
   * channelLimits are merged by default (partial config updates specific channels).
   * To completely replace channelLimits without merging, pass an empty object {}.
   */
  private mergeConfig(config: RateLimiterConfig): Required<RateLimiterConfig> {
    // Check if a property was explicitly set (even to undefined)
    const hasOwnProp = (key: keyof RateLimiterConfig) =>
      Object.prototype.hasOwnProperty.call(config, key);

    // For channelLimits, check if it's explicitly set to empty object (meaning "no defaults")
    // vs partial object (meaning "merge with defaults")
    let channelLimits: Record<NotificationChannel, RateLimitRule>;
    if (hasOwnProp("channelLimits")) {
      const provided = config.channelLimits || {};
      const providedKeys = Object.keys(provided);
      // If channelLimits is explicitly empty {}, don't merge with defaults
      if (providedKeys.length === 0 && config.channelLimits !== undefined) {
        channelLimits = {} as Record<NotificationChannel, RateLimitRule>;
      } else {
        // Otherwise merge with defaults
        channelLimits = {
          ...DEFAULT_RATE_LIMITER_CONFIG.channelLimits,
          ...provided,
        } as Record<NotificationChannel, RateLimitRule>;
      }
    } else {
      channelLimits = DEFAULT_RATE_LIMITER_CONFIG.channelLimits as Record<NotificationChannel, RateLimitRule>;
    }

    return {
      enabled: config.enabled ?? DEFAULT_RATE_LIMITER_CONFIG.enabled!,
      globalLimit: hasOwnProp("globalLimit")
        ? (config.globalLimit as RateLimitRule)
        : DEFAULT_RATE_LIMITER_CONFIG.globalLimit!,
      channelLimits,
      recipientLimit: hasOwnProp("recipientLimit")
        ? (config.recipientLimit as RateLimitRule)
        : DEFAULT_RATE_LIMITER_CONFIG.recipientLimit!,
      userLimit: hasOwnProp("userLimit")
        ? (config.userLimit as RateLimitRule)
        : DEFAULT_RATE_LIMITER_CONFIG.userLimit!,
      allowPriorityOverride:
        config.allowPriorityOverride ?? DEFAULT_RATE_LIMITER_CONFIG.allowPriorityOverride!,
      priorityOverrideThreshold:
        config.priorityOverrideThreshold ??
        DEFAULT_RATE_LIMITER_CONFIG.priorityOverrideThreshold!,
      cleanupInterval: config.cleanupInterval ?? DEFAULT_RATE_LIMITER_CONFIG.cleanupInterval!,
      bucketTTL: config.bucketTTL ?? DEFAULT_RATE_LIMITER_CONFIG.bucketTTL!,
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get or create a token bucket
   */
  private getOrCreateBucket(key: string, rule: RateLimitRule): TokenBucket {
    let bucket = this.buckets.get(key);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: rule.maxTokens,
        maxTokens: rule.maxTokens,
        lastRefill: now,
        refillRatePerSecond: rule.refillRatePerSecond,
        windowCounts: [],
        lastAccess: now,
      };
      this.buckets.set(key, bucket);

      this.emit({
        type: "ratelimit:bucket_created",
        timestamp: new Date(),
        key,
      });
    }

    // Update access time
    bucket.lastAccess = now;

    // Refill tokens
    this.refillBucket(bucket);

    // Clean old window counts
    if (rule.windowMs) {
      const windowStart = now - rule.windowMs;
      bucket.windowCounts = bucket.windowCounts.filter((c) => c.timestamp > windowStart);
    }

    return bucket;
  }

  /**
   * Refill bucket tokens based on elapsed time
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = elapsed * bucket.refillRatePerSecond;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Try to consume a token from the bucket
   */
  private tryConsume(bucket: TokenBucket, rule: RateLimitRule): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();

    // Check sliding window limit
    if (rule.windowMs && rule.maxPerWindow !== undefined) {
      const windowStart = now - rule.windowMs;
      const windowCount = bucket.windowCounts
        .filter((c) => c.timestamp > windowStart)
        .reduce((sum, c) => sum + c.count, 0);

      if (windowCount >= rule.maxPerWindow) {
        // Find oldest entry to calculate retry time
        const oldestInWindow = bucket.windowCounts.find((c) => c.timestamp > windowStart);
        const retryAfterMs = oldestInWindow
          ? oldestInWindow.timestamp + rule.windowMs - now
          : rule.windowMs;
        return { allowed: false, retryAfterMs };
      }
    }

    // Check token bucket
    if (bucket.tokens < 1) {
      // Calculate time until one token is available
      const retryAfterMs = (1 / bucket.refillRatePerSecond) * 1000;
      return { allowed: false, retryAfterMs };
    }

    // Consume token
    bucket.tokens -= 1;

    // Record in sliding window
    if (rule.windowMs) {
      bucket.windowCounts.push({ timestamp: now, count: 1 });
    }

    return { allowed: true };
  }

  /**
   * Check a single rate limit scope
   */
  private checkScope(
    keyType: RateLimitKeyType,
    rule: RateLimitRule,
    channel?: NotificationChannel,
    recipientId?: string,
    userId?: string
  ): RateLimitResult {
    const key = generateRateLimitKey(keyType, channel, recipientId, userId);
    const bucket = this.getOrCreateBucket(key, rule);
    const { allowed, retryAfterMs } = this.tryConsume(bucket, rule);

    const windowCount = rule.windowMs
      ? bucket.windowCounts.reduce((sum, c) => sum + c.count, 0)
      : undefined;

    return {
      allowed,
      key,
      keyType,
      currentTokens: bucket.tokens,
      maxTokens: bucket.maxTokens,
      currentWindowCount: windowCount,
      maxPerWindow: rule.maxPerWindow,
      retryAfterMs,
      reason: allowed ? undefined : `Rate limit exceeded for ${keyType}`,
    };
  }

  /**
   * Check if a notification is rate limited
   */
  check(
    payload: NotificationPayload,
    options?: {
      priority?: NotificationPriority;
      userId?: string;
    }
  ): AggregateRateLimitResult {
    this.totalChecks++;

    if (!this.config.enabled) {
      this.totalAllowed++;
      return {
        allowed: true,
        results: [],
      };
    }

    const channel = payload.channel;
    const recipientId = extractRecipientId(payload);
    const userId = options?.userId;
    const priority = options?.priority ?? NotificationPriority.NORMAL;

    // Check for priority override
    if (
      this.config.allowPriorityOverride &&
      priority >= this.config.priorityOverrideThreshold
    ) {
      this.totalAllowed++;
      this.priorityOverrides++;

      this.emit({
        type: "ratelimit:priority_override",
        timestamp: new Date(),
        channel,
        metadata: { priority, recipientId },
      });

      return {
        allowed: true,
        results: [],
        priorityOverride: true,
      };
    }

    const results: RateLimitResult[] = [];

    // Check global limit
    if (this.config.globalLimit) {
      const result = this.checkScope(
        RateLimitKeyType.GLOBAL,
        this.config.globalLimit,
        channel,
        recipientId,
        userId
      );
      results.push(result);
      if (!result.allowed) {
        return this.handleDenied(result, results, channel);
      }
    }

    // Check channel limit
    const channelLimit = this.config.channelLimits[channel];
    if (channelLimit) {
      const result = this.checkScope(
        RateLimitKeyType.CHANNEL,
        channelLimit,
        channel,
        recipientId,
        userId
      );
      results.push(result);
      if (!result.allowed) {
        return this.handleDenied(result, results, channel);
      }
    }

    // Check recipient limit
    if (this.config.recipientLimit) {
      const result = this.checkScope(
        RateLimitKeyType.RECIPIENT,
        this.config.recipientLimit,
        channel,
        recipientId,
        userId
      );
      results.push(result);
      if (!result.allowed) {
        return this.handleDenied(result, results, channel);
      }
    }

    // Check user limit (if userId provided)
    if (userId && this.config.userLimit) {
      const result = this.checkScope(
        RateLimitKeyType.USER,
        this.config.userLimit,
        channel,
        recipientId,
        userId
      );
      results.push(result);
      if (!result.allowed) {
        return this.handleDenied(result, results, channel);
      }
    }

    // All checks passed
    this.totalAllowed++;

    this.emit({
      type: "ratelimit:allowed",
      timestamp: new Date(),
      channel,
      allowed: true,
    });

    return {
      allowed: true,
      results,
    };
  }

  /**
   * Handle rate limit denial
   */
  private handleDenied(
    deniedBy: RateLimitResult,
    results: RateLimitResult[],
    channel: NotificationChannel
  ): AggregateRateLimitResult {
    this.totalDenied++;
    this.denialsByKeyType[deniedBy.keyType]++;
    this.denialsByChannel[channel]++;

    this.emit({
      type: "ratelimit:denied",
      timestamp: new Date(),
      key: deniedBy.key,
      keyType: deniedBy.keyType,
      channel,
      allowed: false,
      reason: deniedBy.reason,
      retryAfterMs: deniedBy.retryAfterMs,
    });

    return {
      allowed: false,
      results,
      deniedBy,
      retryAfterMs: deniedBy.retryAfterMs,
    };
  }

  /**
   * Check if a notification should be rate limited (convenience method)
   */
  isRateLimited(
    payload: NotificationPayload,
    options?: {
      priority?: NotificationPriority;
      userId?: string;
    }
  ): boolean {
    return !this.check(payload, options).allowed;
  }

  /**
   * Check from queue item input
   */
  checkQueueInput(input: CreateQueueItemInput): AggregateRateLimitResult {
    const userId = (input.context?.userId as string) || undefined;
    return this.check(input.payload, {
      priority: input.priority,
      userId,
    });
  }

  /**
   * Get remaining capacity for a specific scope
   */
  getRemaining(
    keyType: RateLimitKeyType,
    channel?: NotificationChannel,
    recipientId?: string,
    userId?: string
  ): { tokens: number; windowRemaining?: number } {
    const key = generateRateLimitKey(keyType, channel, recipientId, userId);
    const bucket = this.buckets.get(key);

    if (!bucket) {
      // Return max capacity if no bucket exists yet
      let rule: RateLimitRule | undefined;
      switch (keyType) {
        case RateLimitKeyType.GLOBAL:
          rule = this.config.globalLimit;
          break;
        case RateLimitKeyType.CHANNEL:
          rule = channel ? this.config.channelLimits[channel] : undefined;
          break;
        case RateLimitKeyType.RECIPIENT:
          rule = this.config.recipientLimit;
          break;
        case RateLimitKeyType.USER:
          rule = this.config.userLimit;
          break;
      }

      return {
        tokens: rule?.maxTokens ?? Infinity,
        windowRemaining: rule?.maxPerWindow ?? undefined,
      };
    }

    // Refill first
    this.refillBucket(bucket);

    // Calculate window remaining
    let rule: RateLimitRule | undefined;
    switch (keyType) {
      case RateLimitKeyType.GLOBAL:
        rule = this.config.globalLimit;
        break;
      case RateLimitKeyType.CHANNEL:
        rule = channel ? this.config.channelLimits[channel] : undefined;
        break;
      case RateLimitKeyType.RECIPIENT:
        rule = this.config.recipientLimit;
        break;
      case RateLimitKeyType.USER:
        rule = this.config.userLimit;
        break;
    }

    let windowRemaining: number | undefined;
    if (rule?.windowMs && rule?.maxPerWindow !== undefined) {
      const now = Date.now();
      const windowStart = now - rule.windowMs;
      const windowCount = bucket.windowCounts
        .filter((c) => c.timestamp > windowStart)
        .reduce((sum, c) => sum + c.count, 0);
      windowRemaining = rule.maxPerWindow - windowCount;
    }

    return {
      tokens: bucket.tokens,
      windowRemaining,
    };
  }

  /**
   * Get time until rate limit resets for a scope
   */
  getResetTime(
    keyType: RateLimitKeyType,
    channel?: NotificationChannel,
    recipientId?: string,
    userId?: string
  ): number {
    const key = generateRateLimitKey(keyType, channel, recipientId, userId);
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return 0;
    }

    // Get rule for this key type
    let rule: RateLimitRule | undefined;
    switch (keyType) {
      case RateLimitKeyType.GLOBAL:
        rule = this.config.globalLimit;
        break;
      case RateLimitKeyType.CHANNEL:
        rule = channel ? this.config.channelLimits[channel] : undefined;
        break;
      case RateLimitKeyType.RECIPIENT:
        rule = this.config.recipientLimit;
        break;
      case RateLimitKeyType.USER:
        rule = this.config.userLimit;
        break;
    }

    if (!rule?.windowMs) {
      return 0;
    }

    const now = Date.now();
    const oldestInWindow = bucket.windowCounts.find(
      (c) => c.timestamp > now - rule!.windowMs!
    );

    if (!oldestInWindow) {
      return 0;
    }

    return oldestInWindow.timestamp + rule.windowMs - now;
  }

  /**
   * Clean up expired buckets
   */
  cleanup(): number {
    const now = Date.now();
    const expireTime = now - this.config.bucketTTL;
    let removed = 0;

    for (const [key, bucket] of this.buckets) {
      if (bucket.lastAccess < expireTime) {
        this.buckets.delete(key);
        removed++;

        this.emit({
          type: "ratelimit:bucket_expired",
          timestamp: new Date(),
          key,
        });
      }
    }

    if (removed > 0) {
      this.emit({
        type: "ratelimit:cleanup",
        timestamp: new Date(),
        bucketsRemoved: removed,
      });
    }

    return removed;
  }

  /**
   * Clear all buckets
   */
  clear(): void {
    this.buckets.clear();
    this.totalChecks = 0;
    this.totalAllowed = 0;
    this.totalDenied = 0;
    this.priorityOverrides = 0;
    this.denialsByKeyType = {
      [RateLimitKeyType.GLOBAL]: 0,
      [RateLimitKeyType.CHANNEL]: 0,
      [RateLimitKeyType.RECIPIENT]: 0,
      [RateLimitKeyType.USER]: 0,
      [RateLimitKeyType.CHANNEL_RECIPIENT]: 0,
    };
    this.denialsByChannel = {
      [NotificationChannel.EMAIL]: 0,
      [NotificationChannel.TELEGRAM]: 0,
      [NotificationChannel.DISCORD]: 0,
      [NotificationChannel.PUSH]: 0,
      [NotificationChannel.SMS]: 0,
    };
  }

  /**
   * Get statistics
   */
  getStats(): RateLimiterStats {
    return {
      totalChecks: this.totalChecks,
      totalAllowed: this.totalAllowed,
      totalDenied: this.totalDenied,
      priorityOverrides: this.priorityOverrides,
      denialsByKeyType: { ...this.denialsByKeyType },
      denialsByChannel: { ...this.denialsByChannel },
      activeBuckets: this.buckets.size,
      timestamp: new Date(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = this.mergeConfig({ ...this.config, ...config });

    if (config.cleanupInterval !== undefined) {
      this.startCleanupTimer();
    }

    this.emit({
      type: "ratelimit:config_updated",
      timestamp: new Date(),
      metadata: { config: { ...config } },
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimiterConfig {
    return { ...this.config };
  }

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable rate limiting
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable rate limiting
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Add event handler
   */
  on(handler: RateLimiterEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  off(handler: RateLimiterEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Emit event
   */
  private emit(event: RateLimiterEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Get all buckets (for debugging/testing)
   */
  getAllBuckets(): Map<string, TokenBucket> {
    return new Map(this.buckets);
  }

  /**
   * Get bucket for a key (for debugging/testing)
   */
  getBucket(key: string): TokenBucket | undefined {
    return this.buckets.get(key);
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
    this.eventHandlers.clear();
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let sharedRateLimiter: NotificationRateLimiter | null = null;

/**
 * Get or create shared rate limiter instance
 */
export function getRateLimiter(config?: RateLimiterConfig): NotificationRateLimiter {
  if (!sharedRateLimiter) {
    sharedRateLimiter = new NotificationRateLimiter(config);
  }
  return sharedRateLimiter;
}

/**
 * Reset shared rate limiter instance
 */
export function resetRateLimiter(): void {
  if (sharedRateLimiter) {
    sharedRateLimiter.destroy();
  }
  sharedRateLimiter = null;
}

/**
 * Set custom rate limiter instance
 */
export function setRateLimiter(limiter: NotificationRateLimiter): void {
  sharedRateLimiter = limiter;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a notification is rate limited using shared instance
 */
export function isNotificationRateLimited(
  payload: NotificationPayload,
  options?: {
    priority?: NotificationPriority;
    userId?: string;
  }
): boolean {
  return getRateLimiter().isRateLimited(payload, options);
}

/**
 * Check rate limit for a notification using shared instance
 */
export function checkNotificationRateLimit(
  payload: NotificationPayload,
  options?: {
    priority?: NotificationPriority;
    userId?: string;
  }
): AggregateRateLimitResult {
  return getRateLimiter().check(payload, options);
}

/**
 * Check rate limit for a queue input using shared instance
 */
export function checkQueueInputRateLimit(input: CreateQueueItemInput): AggregateRateLimitResult {
  return getRateLimiter().checkQueueInput(input);
}

/**
 * Get rate limiter statistics using shared instance
 */
export function getRateLimiterStats(): RateLimiterStats {
  return getRateLimiter().getStats();
}
