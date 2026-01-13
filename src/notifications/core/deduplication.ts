/**
 * Notification Deduplication System
 * Prevents duplicate notifications for the same alert from being sent
 */

import {
  NotificationPayload,
  NotificationChannel,
  NotificationPriority,
  CreateQueueItemInput,
} from "./types";

/**
 * Deduplication configuration
 */
export interface DeduplicationConfig {
  /** Whether deduplication is enabled */
  enabled?: boolean;
  /** Default time window for deduplication (ms) */
  windowMs?: number;
  /** Per-channel window configuration */
  channelWindows?: Partial<Record<NotificationChannel, number>>;
  /** Maximum number of dedup entries to keep in memory */
  maxEntries?: number;
  /** Whether to include priority in dedup key */
  includePriority?: boolean;
  /** Custom key generator function */
  keyGenerator?: (payload: NotificationPayload, correlationId?: string) => string;
  /** Cleanup interval for expired entries (ms) */
  cleanupInterval?: number;
}

/**
 * Default deduplication configuration
 */
export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  enabled: true,
  windowMs: 5 * 60 * 1000, // 5 minutes default window
  channelWindows: {
    [NotificationChannel.EMAIL]: 60 * 60 * 1000, // 1 hour for emails
    [NotificationChannel.TELEGRAM]: 5 * 60 * 1000, // 5 minutes
    [NotificationChannel.DISCORD]: 5 * 60 * 1000, // 5 minutes
    [NotificationChannel.PUSH]: 2 * 60 * 1000, // 2 minutes for push (more frequent allowed)
    [NotificationChannel.SMS]: 60 * 60 * 1000, // 1 hour for SMS (expensive)
  },
  maxEntries: 10000,
  includePriority: false,
  cleanupInterval: 60 * 1000, // Clean up every minute
};

/**
 * Deduplication entry storing when a notification was last sent
 */
export interface DedupEntry {
  /** Deduplication key */
  key: string;
  /** First occurrence timestamp */
  firstSeen: Date;
  /** Last occurrence timestamp */
  lastSeen: Date;
  /** Number of duplicate attempts blocked */
  duplicateCount: number;
  /** Channel of the notification */
  channel: NotificationChannel;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Original queue item ID (first one that was allowed through) */
  originalItemId?: string;
}

/**
 * Result of a deduplication check
 */
export interface DedupCheckResult {
  /** Whether the notification is a duplicate */
  isDuplicate: boolean;
  /** Deduplication key used */
  key: string;
  /** If duplicate, information about the original */
  originalEntry?: DedupEntry;
  /** Reason for deduplication (if duplicate) */
  reason?: string;
  /** Time until deduplication window expires (ms) */
  windowRemainingMs?: number;
}

/**
 * Deduplication statistics
 */
export interface DedupStats {
  /** Total entries in cache */
  totalEntries: number;
  /** Entries by channel */
  byChannel: Record<NotificationChannel, number>;
  /** Total duplicates blocked */
  duplicatesBlocked: number;
  /** Duplicates blocked in last hour */
  duplicatesBlockedLastHour: number;
  /** Cache hit rate */
  hitRate: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Event types for deduplication
 */
export type DedupEventType =
  | "dedup:duplicate_blocked"
  | "dedup:entry_added"
  | "dedup:entry_expired"
  | "dedup:cache_cleanup"
  | "dedup:config_updated";

/**
 * Deduplication event
 */
export interface DedupEvent {
  type: DedupEventType;
  timestamp: Date;
  key?: string;
  channel?: NotificationChannel;
  duplicateCount?: number;
  entriesRemoved?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Deduplication event handler
 */
export type DedupEventHandler = (event: DedupEvent) => void | Promise<void>;

/**
 * Generate a stable hash for deduplication key
 * Uses a simple but effective string hashing approach
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to base36 for shorter string
  return Math.abs(hash).toString(36);
}

/**
 * Generate a deduplication key from notification payload
 */
export function generateDedupKey(
  payload: NotificationPayload,
  correlationId?: string,
  includePriority?: boolean,
  priority?: NotificationPriority
): string {
  const parts: string[] = [payload.channel];

  // Add correlation ID if present (highest priority identifier)
  if (correlationId) {
    parts.push(`cid:${correlationId}`);
  }

  // Add channel-specific identifiers
  switch (payload.channel) {
    case NotificationChannel.EMAIL:
      // For email: recipient + subject creates uniqueness
      const emailPayload = payload as { to: string | string[]; subject?: string };
      const recipients = Array.isArray(emailPayload.to)
        ? emailPayload.to.sort().join(",")
        : emailPayload.to;
      parts.push(`to:${recipients}`);
      if (emailPayload.subject) {
        parts.push(`subj:${hashString(emailPayload.subject)}`);
      }
      break;

    case NotificationChannel.TELEGRAM:
      // For Telegram: chat ID + message content hash
      const tgPayload = payload as { chatId: string | number };
      parts.push(`chat:${tgPayload.chatId}`);
      break;

    case NotificationChannel.DISCORD:
      // For Discord: webhook URL (or default) + content hash
      const discordPayload = payload as { webhookUrl?: string };
      if (discordPayload.webhookUrl) {
        parts.push(`wh:${hashString(discordPayload.webhookUrl)}`);
      }
      break;

    case NotificationChannel.PUSH:
      // For Push: target subscription(s) + tag
      const pushPayload = payload as { target: string | string[]; tag?: string };
      const targets = Array.isArray(pushPayload.target)
        ? pushPayload.target.sort().join(",")
        : pushPayload.target;
      parts.push(`tgt:${hashString(targets)}`);
      if (pushPayload.tag) {
        parts.push(`tag:${pushPayload.tag}`);
      }
      break;

    case NotificationChannel.SMS:
      // For SMS: phone number(s)
      const smsPayload = payload as { phoneNumber: string | string[] };
      const phones = Array.isArray(smsPayload.phoneNumber)
        ? smsPayload.phoneNumber.sort().join(",")
        : smsPayload.phoneNumber;
      parts.push(`ph:${phones}`);
      break;
  }

  // Add title hash
  parts.push(`title:${hashString(payload.title)}`);

  // Add body hash (main content identifier)
  parts.push(`body:${hashString(payload.body)}`);

  // Optionally include priority
  if (includePriority && priority !== undefined) {
    parts.push(`pri:${priority}`);
  }

  return parts.join("|");
}

/**
 * Notification Deduplication Manager
 * Tracks recent notifications to prevent duplicates
 */
export class NotificationDeduplicator {
  private config: Required<DeduplicationConfig>;
  private cache: Map<string, DedupEntry> = new Map();
  private eventHandlers: Set<DedupEventHandler> = new Set();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private totalChecks = 0;
  private totalHits = 0;
  private recentBlocks: Date[] = [];

  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      enabled: config.enabled ?? DEFAULT_DEDUP_CONFIG.enabled!,
      windowMs: config.windowMs ?? DEFAULT_DEDUP_CONFIG.windowMs!,
      channelWindows: {
        ...DEFAULT_DEDUP_CONFIG.channelWindows,
        ...config.channelWindows,
      } as Record<NotificationChannel, number>,
      maxEntries: config.maxEntries ?? DEFAULT_DEDUP_CONFIG.maxEntries!,
      includePriority: config.includePriority ?? DEFAULT_DEDUP_CONFIG.includePriority!,
      keyGenerator: config.keyGenerator ?? ((payload, correlationId) =>
        generateDedupKey(payload, correlationId, this.config.includePriority)),
      cleanupInterval: config.cleanupInterval ?? DEFAULT_DEDUP_CONFIG.cleanupInterval!,
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
    // Don't prevent Node.js from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get the deduplication window for a channel
   */
  getWindowForChannel(channel: NotificationChannel): number {
    return this.config.channelWindows[channel] ?? this.config.windowMs;
  }

  /**
   * Check if a notification is a duplicate
   */
  check(
    payload: NotificationPayload,
    correlationId?: string,
    _priority?: NotificationPriority
  ): DedupCheckResult {
    // Note: _priority is available for future use with includePriority config
    void _priority;
    this.totalChecks++;

    if (!this.config.enabled) {
      return {
        isDuplicate: false,
        key: this.config.keyGenerator(payload, correlationId),
      };
    }

    const key = this.config.keyGenerator(payload, correlationId);
    const existing = this.cache.get(key);
    const now = new Date();

    if (existing && existing.expiresAt > now) {
      // Found a valid duplicate
      this.totalHits++;
      this.recentBlocks.push(now);

      // Update the existing entry
      existing.lastSeen = now;
      existing.duplicateCount++;

      // Emit event
      this.emit({
        type: "dedup:duplicate_blocked",
        timestamp: now,
        key,
        channel: payload.channel,
        duplicateCount: existing.duplicateCount,
      });

      const windowRemainingMs = existing.expiresAt.getTime() - now.getTime();

      return {
        isDuplicate: true,
        key,
        originalEntry: { ...existing },
        reason: `Duplicate notification blocked (${existing.duplicateCount} duplicates in window)`,
        windowRemainingMs,
      };
    }

    return {
      isDuplicate: false,
      key,
    };
  }

  /**
   * Check and record a notification
   * Returns the check result and automatically records if not duplicate
   */
  checkAndRecord(
    payload: NotificationPayload,
    correlationId?: string,
    _priority?: NotificationPriority,
    itemId?: string
  ): DedupCheckResult {
    const result = this.check(payload, correlationId, _priority);

    if (!result.isDuplicate) {
      this.record(payload, correlationId, itemId);
    }

    return result;
  }

  /**
   * Record a notification for future deduplication
   */
  record(
    payload: NotificationPayload,
    correlationId?: string,
    itemId?: string
  ): DedupEntry {
    const key = this.config.keyGenerator(payload, correlationId);
    const now = new Date();
    const windowMs = this.getWindowForChannel(payload.channel);

    const entry: DedupEntry = {
      key,
      firstSeen: now,
      lastSeen: now,
      duplicateCount: 0,
      channel: payload.channel,
      expiresAt: new Date(now.getTime() + windowMs),
      originalItemId: itemId,
    };

    // Enforce max entries limit
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, entry);

    // Emit event
    this.emit({
      type: "dedup:entry_added",
      timestamp: now,
      key,
      channel: payload.channel,
    });

    return entry;
  }

  /**
   * Evict the oldest entry from cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.firstSeen.getTime() < oldestTime) {
        oldestTime = entry.firstSeen.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        removed++;

        this.emit({
          type: "dedup:entry_expired",
          timestamp: now,
          key,
          channel: entry.channel,
          duplicateCount: entry.duplicateCount,
        });
      }
    }

    // Clean up old block records (keep only last hour)
    const oneHourAgo = now.getTime() - 60 * 60 * 1000;
    this.recentBlocks = this.recentBlocks.filter(d => d.getTime() > oneHourAgo);

    if (removed > 0) {
      this.emit({
        type: "dedup:cache_cleanup",
        timestamp: now,
        entriesRemoved: removed,
      });
    }

    return removed;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.totalChecks = 0;
    this.totalHits = 0;
    this.recentBlocks = [];
  }

  /**
   * Remove a specific entry by key
   */
  remove(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Get an entry by key
   */
  get(key: string): DedupEntry | undefined {
    return this.cache.get(key);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    // Check if not expired
    return entry.expiresAt > new Date();
  }

  /**
   * Get the number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get deduplication statistics
   */
  getStats(): DedupStats {
    const byChannel: Record<NotificationChannel, number> = {
      [NotificationChannel.EMAIL]: 0,
      [NotificationChannel.TELEGRAM]: 0,
      [NotificationChannel.DISCORD]: 0,
      [NotificationChannel.PUSH]: 0,
      [NotificationChannel.SMS]: 0,
    };

    let totalDuplicates = 0;

    for (const entry of this.cache.values()) {
      byChannel[entry.channel]++;
      totalDuplicates += entry.duplicateCount;
    }

    // Calculate duplicates blocked in last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const duplicatesLastHour = this.recentBlocks.filter(
      d => d.getTime() > oneHourAgo
    ).length;

    return {
      totalEntries: this.cache.size,
      byChannel,
      duplicatesBlocked: totalDuplicates,
      duplicatesBlockedLastHour: duplicatesLastHour,
      hitRate: this.totalChecks > 0 ? this.totalHits / this.totalChecks : 0,
      timestamp: new Date(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DeduplicationConfig>): void {
    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.windowMs !== undefined) {
      this.config.windowMs = config.windowMs;
    }
    if (config.channelWindows) {
      this.config.channelWindows = {
        ...this.config.channelWindows,
        ...config.channelWindows,
      } as Record<NotificationChannel, number>;
    }
    if (config.maxEntries !== undefined) {
      this.config.maxEntries = config.maxEntries;
    }
    if (config.includePriority !== undefined) {
      this.config.includePriority = config.includePriority;
    }
    if (config.keyGenerator) {
      this.config.keyGenerator = config.keyGenerator;
    }
    if (config.cleanupInterval !== undefined) {
      this.config.cleanupInterval = config.cleanupInterval;
      this.startCleanupTimer();
    }

    this.emit({
      type: "dedup:config_updated",
      timestamp: new Date(),
      metadata: { config: { ...config } },
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config };
  }

  /**
   * Check if deduplication is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable deduplication
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable deduplication
   */
  disable(): void {
    this.config.enabled = false;
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add event handler
   */
  on(handler: DedupEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  off(handler: DedupEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: DedupEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Get all entries (for debugging/testing)
   */
  getAllEntries(): DedupEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Destroy the deduplicator
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

let sharedDeduplicator: NotificationDeduplicator | null = null;

/**
 * Get or create shared deduplicator instance
 */
export function getDeduplicator(config?: DeduplicationConfig): NotificationDeduplicator {
  if (!sharedDeduplicator) {
    sharedDeduplicator = new NotificationDeduplicator(config);
  }
  return sharedDeduplicator;
}

/**
 * Reset shared deduplicator instance
 */
export function resetDeduplicator(): void {
  if (sharedDeduplicator) {
    sharedDeduplicator.destroy();
  }
  sharedDeduplicator = null;
}

/**
 * Set custom deduplicator instance
 */
export function setDeduplicator(deduplicator: NotificationDeduplicator): void {
  sharedDeduplicator = deduplicator;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a notification is a duplicate using shared instance
 */
export function isDuplicate(
  payload: NotificationPayload,
  correlationId?: string,
  priority?: NotificationPriority
): DedupCheckResult {
  return getDeduplicator().check(payload, correlationId, priority);
}

/**
 * Check and record a notification using shared instance
 */
export function checkAndRecordNotification(
  payload: NotificationPayload,
  correlationId?: string,
  priority?: NotificationPriority,
  itemId?: string
): DedupCheckResult {
  return getDeduplicator().checkAndRecord(payload, correlationId, priority, itemId);
}

/**
 * Record a notification for deduplication using shared instance
 */
export function recordNotification(
  payload: NotificationPayload,
  correlationId?: string,
  itemId?: string
): DedupEntry {
  return getDeduplicator().record(payload, correlationId, itemId);
}

/**
 * Create a dedup key for a queue item input
 */
export function createDedupKeyFromInput(input: CreateQueueItemInput): string {
  return generateDedupKey(
    input.payload,
    input.correlationId,
    false,
    input.priority
  );
}
