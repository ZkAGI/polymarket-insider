/**
 * Multi-channel notification router for the Polymarket Tracker
 * Routes notifications to configured channels based on user preferences
 */

import {
  NotificationChannel,
  NotificationPayload,
  ChannelSendResult,
  ChannelHandler,
  NotificationPriority,
  QueueItem,
  getChannelFromPayload,
  EmailNotificationPayload,
  TelegramNotificationPayload,
  DiscordNotificationPayload,
  PushNotificationPayload,
  SmsNotificationPayload,
} from "./types";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Channel configuration for routing
 */
export interface ChannelConfig {
  /** Whether the channel is enabled */
  enabled: boolean;
  /** Channel-specific configuration */
  config?: Record<string, unknown>;
  /** Priority threshold - only send notifications at or above this priority */
  minPriority?: NotificationPriority;
  /** Maximum retries for this channel */
  maxRetries?: number;
  /** Whether to use as fallback when other channels fail */
  isFallback?: boolean;
  /** Delay before sending via this channel (ms) - useful for digest/batch */
  delay?: number;
}

/**
 * User notification preferences
 */
export interface UserNotificationPreferences {
  /** User identifier */
  userId: string;
  /** Channel configurations */
  channels: Partial<Record<NotificationChannel, ChannelConfig>>;
  /** Default channels to use when no specific preference exists */
  defaultChannels?: NotificationChannel[];
  /** Quiet hours configuration */
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
    /** Channels to allow during quiet hours (e.g., critical alerts) */
    allowedChannels?: NotificationChannel[];
    /** Priority threshold for quiet hours bypass */
    bypassPriority?: NotificationPriority;
  };
  /** Global enabled/disabled state */
  enabled: boolean;
}

/**
 * Routing decision for a notification
 */
export interface RoutingDecision {
  /** Whether to route the notification */
  shouldRoute: boolean;
  /** Channels to route to */
  targetChannels: NotificationChannel[];
  /** Reason for the decision */
  reason: string;
  /** Skipped channels with reasons */
  skippedChannels: Array<{
    channel: NotificationChannel;
    reason: string;
  }>;
  /** Whether quiet hours applies */
  quietHoursActive?: boolean;
  /** Fallback channels if primary fails */
  fallbackChannels: NotificationChannel[];
}

/**
 * Channel routing result
 */
export interface ChannelRoutingResult {
  /** Channel that was used */
  channel: NotificationChannel;
  /** Whether send was successful */
  success: boolean;
  /** Send result from the channel handler */
  result?: ChannelSendResult;
  /** Error if failed */
  error?: string;
  /** Duration in milliseconds */
  duration: number;
  /** Whether this was a fallback attempt */
  isFallback: boolean;
  /** Retry attempt number */
  attempt: number;
}

/**
 * Overall routing result for a notification
 */
export interface NotificationRoutingResult {
  /** Notification identifier */
  notificationId: string;
  /** Routing decision that was made */
  decision: RoutingDecision;
  /** Results from each channel */
  channelResults: ChannelRoutingResult[];
  /** Overall success - true if at least one channel succeeded */
  success: boolean;
  /** Total duration in milliseconds */
  totalDuration: number;
  /** Timestamp */
  timestamp: Date;
  /** Summary of results */
  summary: {
    attempted: number;
    succeeded: number;
    failed: number;
    fallbacksUsed: number;
  };
}

/**
 * Router event types
 */
export type RouterEventType =
  | "router:routing_started"
  | "router:routing_completed"
  | "router:channel_sending"
  | "router:channel_success"
  | "router:channel_failed"
  | "router:fallback_triggered"
  | "router:quiet_hours_blocked"
  | "router:preference_loaded"
  | "router:error";

/**
 * Router event
 */
export interface RouterEvent {
  type: RouterEventType;
  timestamp: Date;
  notificationId?: string;
  channel?: NotificationChannel;
  userId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Router event handler
 */
export type RouterEventHandler = (event: RouterEvent) => void | Promise<void>;

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Default channels when no preference exists */
  defaultChannels?: NotificationChannel[];
  /** Enable logging */
  enableLogging?: boolean;
  /** Log level */
  logLevel?: "debug" | "info" | "warn" | "error";
  /** Maximum concurrent channel sends */
  maxConcurrency?: number;
  /** Default retry count per channel */
  defaultMaxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Whether to continue routing to other channels on failure */
  continueOnFailure?: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ROUTER_CONFIG: Required<RouterConfig> = {
  defaultChannels: [NotificationChannel.EMAIL],
  enableLogging: true,
  logLevel: "info",
  maxConcurrency: 3,
  defaultMaxRetries: 2,
  retryDelay: 1000,
  continueOnFailure: true,
};

// ============================================================================
// Notification Router Class
// ============================================================================

/**
 * Multi-channel notification router
 * Routes notifications to configured channels based on user preferences
 */
export class NotificationRouter {
  private config: Required<RouterConfig>;
  private handlers: Map<NotificationChannel, ChannelHandler> = new Map();
  private preferencesStore: Map<string, UserNotificationPreferences> = new Map();
  private eventHandlers: Set<RouterEventHandler> = new Set();

  // Statistics
  private stats = {
    totalRouted: 0,
    totalSuccess: 0,
    totalFailed: 0,
    channelStats: {} as Record<NotificationChannel, { success: number; failed: number }>,
    fallbacksTriggered: 0,
  };

  constructor(config: RouterConfig = {}) {
    this.config = {
      ...DEFAULT_ROUTER_CONFIG,
      ...config,
    };

    // Initialize channel stats
    for (const channel of Object.values(NotificationChannel)) {
      this.stats.channelStats[channel] = { success: 0, failed: 0 };
    }
  }

  // ============================================================================
  // Handler Management
  // ============================================================================

  /**
   * Register a channel handler
   */
  registerHandler(handler: ChannelHandler): void {
    this.handlers.set(handler.channel, handler);
    this.log("debug", `Registered handler for channel: ${handler.channel}`);
  }

  /**
   * Unregister a channel handler
   */
  unregisterHandler(channel: NotificationChannel): void {
    this.handlers.delete(channel);
    this.log("debug", `Unregistered handler for channel: ${channel}`);
  }

  /**
   * Get registered handlers
   */
  getHandlers(): Map<NotificationChannel, ChannelHandler> {
    return new Map(this.handlers);
  }

  /**
   * Check if a handler is available
   */
  hasHandler(channel: NotificationChannel): boolean {
    const handler = this.handlers.get(channel);
    return handler !== undefined && handler.isAvailable();
  }

  // ============================================================================
  // User Preferences Management
  // ============================================================================

  /**
   * Set user notification preferences
   */
  setUserPreferences(preferences: UserNotificationPreferences): void {
    this.preferencesStore.set(preferences.userId, preferences);
    this.emitEvent({
      type: "router:preference_loaded",
      timestamp: new Date(),
      userId: preferences.userId,
      metadata: { channels: Object.keys(preferences.channels) },
    });
    this.log("debug", `Set preferences for user: ${preferences.userId}`);
  }

  /**
   * Get user notification preferences
   */
  getUserPreferences(userId: string): UserNotificationPreferences | undefined {
    return this.preferencesStore.get(userId);
  }

  /**
   * Remove user preferences
   */
  removeUserPreferences(userId: string): boolean {
    return this.preferencesStore.delete(userId);
  }

  /**
   * Create default preferences for a user
   */
  createDefaultPreferences(userId: string): UserNotificationPreferences {
    const preferences: UserNotificationPreferences = {
      userId,
      enabled: true,
      channels: {},
      defaultChannels: this.config.defaultChannels,
    };

    // Enable default channels
    for (const channel of this.config.defaultChannels) {
      preferences.channels[channel] = {
        enabled: true,
      };
    }

    return preferences;
  }

  // ============================================================================
  // Routing Logic
  // ============================================================================

  /**
   * Route a notification to configured channels
   */
  async route(
    notificationId: string,
    payload: NotificationPayload,
    userId?: string,
    priority: NotificationPriority = NotificationPriority.NORMAL
  ): Promise<NotificationRoutingResult> {
    const startTime = Date.now();

    this.emitEvent({
      type: "router:routing_started",
      timestamp: new Date(),
      notificationId,
      userId,
    });

    // Get routing decision
    const decision = this.getRoutingDecision(payload, userId, priority);

    if (!decision.shouldRoute) {
      this.log("info", `Not routing notification ${notificationId}: ${decision.reason}`);
      return this.createResult(notificationId, decision, [], startTime);
    }

    this.log(
      "info",
      `Routing notification ${notificationId} to channels: ${decision.targetChannels.join(", ")}`
    );

    // Route to target channels
    const channelResults: ChannelRoutingResult[] = [];

    for (const channel of decision.targetChannels) {
      const result = await this.sendToChannel(notificationId, payload, channel, priority);
      channelResults.push(result);

      // If failed and we have fallbacks, try them
      if (!result.success && decision.fallbackChannels.length > 0) {
        this.stats.fallbacksTriggered++;
        this.emitEvent({
          type: "router:fallback_triggered",
          timestamp: new Date(),
          notificationId,
          channel,
          metadata: { fallbacks: decision.fallbackChannels },
        });

        for (const fallbackChannel of decision.fallbackChannels) {
          if (fallbackChannel !== channel) {
            const fallbackResult = await this.sendToChannel(
              notificationId,
              payload,
              fallbackChannel,
              priority,
              true
            );
            channelResults.push(fallbackResult);

            if (fallbackResult.success) {
              break; // Stop trying fallbacks on first success
            }
          }
        }
      }

      // Stop if configured not to continue on failure
      if (!result.success && !this.config.continueOnFailure) {
        break;
      }
    }

    const result = this.createResult(notificationId, decision, channelResults, startTime);

    // Update stats
    this.stats.totalRouted++;
    if (result.success) {
      this.stats.totalSuccess++;
    } else {
      this.stats.totalFailed++;
    }

    this.emitEvent({
      type: "router:routing_completed",
      timestamp: new Date(),
      notificationId,
      metadata: {
        success: result.success,
        channelsAttempted: result.summary.attempted,
        channelsSucceeded: result.summary.succeeded,
      },
    });

    return result;
  }

  /**
   * Route a queue item
   */
  async routeQueueItem(item: QueueItem, userId?: string): Promise<NotificationRoutingResult> {
    return this.route(item.id, item.payload, userId, item.priority);
  }

  /**
   * Get routing decision for a notification
   */
  getRoutingDecision(
    payload: NotificationPayload,
    userId?: string,
    priority: NotificationPriority = NotificationPriority.NORMAL
  ): RoutingDecision {
    const payloadChannel = getChannelFromPayload(payload);
    const skippedChannels: Array<{ channel: NotificationChannel; reason: string }> = [];
    const targetChannels: NotificationChannel[] = [];
    const fallbackChannels: NotificationChannel[] = [];

    // If no user specified, use default channels or payload channel
    if (!userId) {
      // Check if we have a handler for the payload channel
      if (this.hasHandler(payloadChannel)) {
        targetChannels.push(payloadChannel);
      } else {
        // Use default channels
        for (const channel of this.config.defaultChannels) {
          if (this.hasHandler(channel)) {
            targetChannels.push(channel);
          }
        }
      }

      return {
        shouldRoute: targetChannels.length > 0,
        targetChannels,
        reason: targetChannels.length > 0 ? "Using default routing" : "No available handlers",
        skippedChannels,
        fallbackChannels,
      };
    }

    // Get user preferences
    const preferences = this.preferencesStore.get(userId);
    if (!preferences) {
      // No preferences - use defaults
      for (const channel of this.config.defaultChannels) {
        if (this.hasHandler(channel)) {
          targetChannels.push(channel);
        }
      }

      return {
        shouldRoute: targetChannels.length > 0,
        targetChannels,
        reason: "No user preferences found, using defaults",
        skippedChannels,
        fallbackChannels,
      };
    }

    // Check if notifications are globally disabled
    if (!preferences.enabled) {
      return {
        shouldRoute: false,
        targetChannels: [],
        reason: "User notifications disabled",
        skippedChannels,
        fallbackChannels,
      };
    }

    // Check quiet hours
    const quietHoursResult = this.checkQuietHours(preferences, priority);
    if (quietHoursResult.blocked) {
      this.emitEvent({
        type: "router:quiet_hours_blocked",
        timestamp: new Date(),
        userId,
        metadata: { reason: quietHoursResult.reason },
      });

      return {
        shouldRoute: false,
        targetChannels: [],
        reason: quietHoursResult.reason!,
        skippedChannels,
        quietHoursActive: true,
        fallbackChannels,
      };
    }

    // Get channels to check for primary targets
    const channelsToCheck =
      preferences.defaultChannels || (Object.keys(preferences.channels) as NotificationChannel[]);

    // Process all configured channels, distinguishing primary vs fallback
    const allConfiguredChannels = Object.keys(preferences.channels) as NotificationChannel[];

    for (const channel of allConfiguredChannels) {
      const channelConfig = preferences.channels[channel];

      // Skip if no config exists
      if (!channelConfig) {
        skippedChannels.push({ channel, reason: "No configuration" });
        continue;
      }

      // Skip if disabled
      if (!channelConfig.enabled) {
        skippedChannels.push({ channel, reason: "Disabled" });
        continue;
      }

      // Skip if no handler
      if (!this.hasHandler(channel)) {
        skippedChannels.push({ channel, reason: "No handler available" });
        continue;
      }

      // Check priority threshold
      if (channelConfig.minPriority && priority < channelConfig.minPriority) {
        skippedChannels.push({
          channel,
          reason: `Below priority threshold (${priority} < ${channelConfig.minPriority})`,
        });
        continue;
      }

      // Fallback channels are always collected separately
      if (channelConfig.isFallback) {
        fallbackChannels.push(channel);
        continue;
      }

      // For non-fallback channels, only add if in channelsToCheck
      if (channelsToCheck.includes(channel)) {
        targetChannels.push(channel);
      }
    }

    // If quiet hours is active but allows certain channels
    if (
      quietHoursResult.active &&
      preferences.quietHours?.allowedChannels &&
      targetChannels.length === 0
    ) {
      for (const channel of preferences.quietHours.allowedChannels) {
        if (this.hasHandler(channel) && !targetChannels.includes(channel)) {
          const channelConfig = preferences.channels[channel];
          if (channelConfig?.enabled) {
            targetChannels.push(channel);
          }
        }
      }
    }

    return {
      shouldRoute: targetChannels.length > 0,
      targetChannels,
      reason:
        targetChannels.length > 0
          ? `Routing to ${targetChannels.length} channel(s)`
          : "No enabled channels available",
      skippedChannels,
      quietHoursActive: quietHoursResult.active,
      fallbackChannels,
    };
  }

  // ============================================================================
  // Channel Sending
  // ============================================================================

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    notificationId: string,
    payload: NotificationPayload,
    channel: NotificationChannel,
    _priority: NotificationPriority,
    isFallback: boolean = false
  ): Promise<ChannelRoutingResult> {
    const startTime = Date.now();

    this.emitEvent({
      type: "router:channel_sending",
      timestamp: new Date(),
      notificationId,
      channel,
      metadata: { isFallback },
    });

    const handler = this.handlers.get(channel);
    if (!handler) {
      return {
        channel,
        success: false,
        error: "No handler registered",
        duration: Date.now() - startTime,
        isFallback,
        attempt: 1,
      };
    }

    // Check handler availability
    if (!handler.isAvailable()) {
      return {
        channel,
        success: false,
        error: "Handler not available",
        duration: Date.now() - startTime,
        isFallback,
        attempt: 1,
      };
    }

    // Convert payload if needed for the target channel
    const adaptedPayload = this.adaptPayloadForChannel(payload, channel);

    const maxRetries = this.config.defaultMaxRetries;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await handler.send(adaptedPayload);

        if (result.success) {
          this.stats.channelStats[channel].success++;
          this.emitEvent({
            type: "router:channel_success",
            timestamp: new Date(),
            notificationId,
            channel,
            metadata: { attempt, isFallback },
          });

          return {
            channel,
            success: true,
            result,
            duration: Date.now() - startTime,
            isFallback,
            attempt,
          };
        }

        lastError = result.error;

        // Check if we should retry
        if (!result.shouldRetry || attempt === maxRetries) {
          break;
        }

        // Wait before retry
        await this.sleep(this.config.retryDelay * attempt);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt === maxRetries) {
          break;
        }

        await this.sleep(this.config.retryDelay * attempt);
      }
    }

    // Failed after all retries
    this.stats.channelStats[channel].failed++;
    this.emitEvent({
      type: "router:channel_failed",
      timestamp: new Date(),
      notificationId,
      channel,
      error: lastError,
      metadata: { isFallback },
    });

    return {
      channel,
      success: false,
      error: lastError,
      duration: Date.now() - startTime,
      isFallback,
      attempt: maxRetries,
    };
  }

  /**
   * Adapt payload for a different channel
   * This allows routing a notification originally intended for one channel to another
   */
  private adaptPayloadForChannel(
    payload: NotificationPayload,
    targetChannel: NotificationChannel
  ): NotificationPayload {
    const sourceChannel = getChannelFromPayload(payload);

    // If same channel, return as-is
    if (sourceChannel === targetChannel) {
      return payload;
    }

    // Create adapted payload based on target channel
    const basePayload = {
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata,
    };

    switch (targetChannel) {
      case NotificationChannel.EMAIL: {
        const emailPayload: EmailNotificationPayload = {
          ...basePayload,
          channel: NotificationChannel.EMAIL,
          to: payload.metadata?.email as string | string[] || "unknown@example.com",
          subject: payload.title,
        };
        return emailPayload;
      }

      case NotificationChannel.TELEGRAM: {
        const telegramPayload: TelegramNotificationPayload = {
          ...basePayload,
          channel: NotificationChannel.TELEGRAM,
          chatId: payload.metadata?.telegramChatId as string | number || "0",
          parseMode: "HTML",
        };
        return telegramPayload;
      }

      case NotificationChannel.DISCORD: {
        const discordPayload: DiscordNotificationPayload = {
          ...basePayload,
          channel: NotificationChannel.DISCORD,
        };
        return discordPayload;
      }

      case NotificationChannel.PUSH: {
        const pushPayload: PushNotificationPayload = {
          ...basePayload,
          channel: NotificationChannel.PUSH,
          target: payload.metadata?.pushTarget as string | string[] || "",
        };
        return pushPayload;
      }

      case NotificationChannel.SMS: {
        const smsPayload: SmsNotificationPayload = {
          ...basePayload,
          channel: NotificationChannel.SMS,
          phoneNumber: payload.metadata?.phoneNumber as string | string[] || "",
        };
        return smsPayload;
      }

      default:
        return payload;
    }
  }

  // ============================================================================
  // Quiet Hours
  // ============================================================================

  /**
   * Check if quiet hours applies
   */
  private checkQuietHours(
    preferences: UserNotificationPreferences,
    priority: NotificationPriority
  ): { active: boolean; blocked: boolean; reason?: string } {
    if (!preferences.quietHours?.enabled) {
      return { active: false, blocked: false };
    }

    const { start, end, timezone, bypassPriority } = preferences.quietHours;

    // Check if priority bypasses quiet hours
    if (bypassPriority && priority >= bypassPriority) {
      return { active: true, blocked: false, reason: "Priority bypasses quiet hours" };
    }

    try {
      // Get current time in user's timezone
      const now = new Date();
      const userTime = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      const currentHours = userTime.getHours();
      const currentMinutes = userTime.getMinutes();
      const currentTime = currentHours * 60 + currentMinutes;

      // Parse start and end times
      const [startHours, startMinutes] = start.split(":").map(Number);
      const [endHours, endMinutes] = end.split(":").map(Number);
      const startTime = startHours! * 60 + startMinutes!;
      const endTime = endHours! * 60 + endMinutes!;

      // Check if current time is within quiet hours
      let isQuietTime: boolean;
      if (startTime <= endTime) {
        // Normal range (e.g., 22:00 - 08:00 within same day)
        isQuietTime = currentTime >= startTime && currentTime < endTime;
      } else {
        // Overnight range (e.g., 22:00 - 08:00 spanning midnight)
        isQuietTime = currentTime >= startTime || currentTime < endTime;
      }

      if (isQuietTime) {
        return {
          active: true,
          blocked: true,
          reason: `Quiet hours active (${start} - ${end} ${timezone})`,
        };
      }

      return { active: false, blocked: false };
    } catch {
      // On error, don't block
      return { active: false, blocked: false, reason: "Failed to check quiet hours" };
    }
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Add event handler
   */
  on(handler: RouterEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  off(handler: RouterEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: RouterEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            this.log("error", `Error in router event handler: ${error}`);
          });
        }
      } catch (error) {
        this.log("error", `Error in router event handler: ${error}`);
      }
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get router statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset router statistics
   */
  resetStats(): void {
    this.stats = {
      totalRouted: 0,
      totalSuccess: 0,
      totalFailed: 0,
      channelStats: {} as Record<NotificationChannel, { success: number; failed: number }>,
      fallbacksTriggered: 0,
    };

    for (const channel of Object.values(NotificationChannel)) {
      this.stats.channelStats[channel] = { success: 0, failed: 0 };
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Create routing result
   */
  private createResult(
    notificationId: string,
    decision: RoutingDecision,
    channelResults: ChannelRoutingResult[],
    startTime: number
  ): NotificationRoutingResult {
    const succeeded = channelResults.filter((r) => r.success).length;
    const failed = channelResults.filter((r) => !r.success).length;
    const fallbacksUsed = channelResults.filter((r) => r.isFallback && r.success).length;

    return {
      notificationId,
      decision,
      channelResults,
      success: succeeded > 0,
      totalDuration: Date.now() - startTime,
      timestamp: new Date(),
      summary: {
        attempted: channelResults.length,
        succeeded,
        failed,
        fallbacksUsed,
      },
    };
  }

  /**
   * Log helper
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.config.enableLogging) {
      return;
    }

    const levels = ["debug", "info", "warn", "error"];
    if (levels.indexOf(level) < levels.indexOf(this.config.logLevel)) {
      return;
    }

    const logMessage = `[NotificationRouter] ${message}`;
    const logFn =
      level === "debug"
        ? console.debug
        : level === "info"
          ? console.info
          : level === "warn"
            ? console.warn
            : console.error;

    if (data) {
      logFn(logMessage, data);
    } else {
      logFn(logMessage);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let routerInstance: NotificationRouter | null = null;

/**
 * Get or create the notification router singleton
 */
export function getNotificationRouter(config?: RouterConfig): NotificationRouter {
  if (!routerInstance) {
    routerInstance = new NotificationRouter(config);
  }
  return routerInstance;
}

/**
 * Reset the notification router singleton
 */
export function resetNotificationRouter(): void {
  routerInstance = null;
}

/**
 * Set custom notification router instance
 */
export function setNotificationRouter(router: NotificationRouter): void {
  routerInstance = router;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Route a notification using the shared router
 */
export async function routeNotification(
  notificationId: string,
  payload: NotificationPayload,
  userId?: string,
  priority?: NotificationPriority
): Promise<NotificationRoutingResult> {
  const router = getNotificationRouter();
  return router.route(notificationId, payload, userId, priority);
}

/**
 * Set user preferences on the shared router
 */
export function setUserNotificationPreferences(preferences: UserNotificationPreferences): void {
  const router = getNotificationRouter();
  router.setUserPreferences(preferences);
}

/**
 * Register a channel handler on the shared router
 */
export function registerChannelHandler(handler: ChannelHandler): void {
  const router = getNotificationRouter();
  router.registerHandler(handler);
}
