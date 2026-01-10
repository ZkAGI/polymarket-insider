/**
 * Multi-market Subscription Manager (API-WS-009)
 *
 * Manages subscriptions across multiple markets efficiently:
 * - Track active subscriptions across different channels
 * - Batch subscription requests to reduce WebSocket overhead
 * - Handle subscription limits per connection
 * - Provide subscription status and health monitoring
 */

import type {
  WebSocketLogger,
  ConnectionState,
} from "./types";
import type {
  SubscriptionChannelValue,
  MarketSubscriptionInfo,
  ParsedPriceUpdate,
} from "./market-subscriptions";
import {
  SubscriptionChannel,
  generateSubscriptionId,
  normalizeTokenIds,
  buildSubscriptionMessage,
} from "./market-subscriptions";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default maximum subscriptions per connection
 */
export const DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION = 100;

/**
 * Default maximum tokens per subscription
 */
export const DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION = 50;

/**
 * Default batch size for subscription requests
 */
export const DEFAULT_BATCH_SIZE = 10;

/**
 * Default batch delay in milliseconds
 */
export const DEFAULT_BATCH_DELAY = 100;

/**
 * Default subscription timeout in milliseconds
 */
export const DEFAULT_SUBSCRIPTION_TIMEOUT = 10000;

/**
 * Default stale subscription threshold in milliseconds
 */
export const DEFAULT_STALE_SUBSCRIPTION_THRESHOLD = 60000;

/**
 * Subscription status values
 */
export const SubscriptionStatus = {
  PENDING: "pending",
  ACTIVE: "active",
  PAUSED: "paused",
  ERROR: "error",
  UNSUBSCRIBED: "unsubscribed",
} as const;

export type SubscriptionStatusValue = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

/**
 * Batch operation type
 */
export const BatchOperationType = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
} as const;

export type BatchOperationTypeValue = typeof BatchOperationType[keyof typeof BatchOperationType];

/**
 * Subscription manager event types
 */
export const SubscriptionManagerEventType = {
  SUBSCRIPTION_ADDED: "subscriptionAdded",
  SUBSCRIPTION_REMOVED: "subscriptionRemoved",
  SUBSCRIPTION_CONFIRMED: "subscriptionConfirmed",
  SUBSCRIPTION_ERROR: "subscriptionError",
  SUBSCRIPTION_STALE: "subscriptionStale",
  BATCH_SENT: "batchSent",
  BATCH_COMPLETE: "batchComplete",
  LIMIT_REACHED: "limitReached",
  STATUS_CHANGED: "statusChanged",
  HEALTH_UPDATED: "healthUpdated",
} as const;

export type SubscriptionManagerEventTypeValue = typeof SubscriptionManagerEventType[keyof typeof SubscriptionManagerEventType];

// ============================================================================
// Types
// ============================================================================

/**
 * Extended subscription info with manager-specific fields
 */
export interface ManagedSubscription extends MarketSubscriptionInfo {
  /** Subscription status */
  status: SubscriptionStatusValue;

  /** Retry count for failed subscriptions */
  retryCount: number;

  /** Maximum retry count before giving up */
  maxRetries: number;

  /** Last error encountered */
  lastError?: Error;

  /** When the subscription was last active */
  lastActiveAt?: Date;

  /** Priority (higher = more important) */
  priority: number;

  /** Whether the subscription is part of a batch */
  batchId?: string;

  /** Tags for categorization */
  tags: Set<string>;

  /** Auto-resubscribe on reconnect */
  autoResubscribe: boolean;
}

/**
 * Pending subscription operation
 */
export interface PendingOperation {
  /** Operation ID */
  id: string;

  /** Operation type */
  type: BatchOperationTypeValue;

  /** Token IDs */
  tokenIds: string[];

  /** Channel */
  channel: SubscriptionChannelValue;

  /** Priority */
  priority: number;

  /** Created timestamp */
  createdAt: Date;

  /** Timeout handle */
  timeoutHandle?: ReturnType<typeof setTimeout>;

  /** Promise resolve */
  resolve: (subscription: ManagedSubscription) => void;

  /** Promise reject */
  reject: (error: Error) => void;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch operation
 */
export interface BatchOperation {
  /** Batch ID */
  id: string;

  /** Operations in the batch */
  operations: PendingOperation[];

  /** Created timestamp */
  createdAt: Date;

  /** Sent timestamp */
  sentAt?: Date;

  /** Completed count */
  completedCount: number;

  /** Failed count */
  failedCount: number;
}

/**
 * Subscription filter criteria
 */
export interface SubscriptionFilter {
  /** Filter by status */
  status?: SubscriptionStatusValue | SubscriptionStatusValue[];

  /** Filter by channel */
  channel?: SubscriptionChannelValue | SubscriptionChannelValue[];

  /** Filter by tags (any match) */
  tags?: string[];

  /** Filter by confirmed state */
  confirmed?: boolean;

  /** Filter by token IDs (any match) */
  tokenIds?: string[];

  /** Filter by stale state */
  isStale?: boolean;

  /** Minimum priority */
  minPriority?: number;

  /** Maximum priority */
  maxPriority?: number;
}

/**
 * Subscription manager configuration
 */
export interface SubscriptionManagerConfig {
  /** Maximum subscriptions per connection (default: 100) */
  maxSubscriptionsPerConnection?: number;

  /** Maximum tokens per subscription (default: 50) */
  maxTokensPerSubscription?: number;

  /** Batch size for subscription requests (default: 10) */
  batchSize?: number;

  /** Batch delay in milliseconds (default: 100) */
  batchDelay?: number;

  /** Subscription timeout in milliseconds (default: 10000) */
  subscriptionTimeout?: number;

  /** Stale subscription threshold in milliseconds (default: 60000) */
  staleSubscriptionThreshold?: number;

  /** Maximum retry count for failed subscriptions (default: 3) */
  maxRetries?: number;

  /** Retry delay multiplier (default: 2) */
  retryDelayMultiplier?: number;

  /** Initial retry delay in milliseconds (default: 1000) */
  initialRetryDelay?: number;

  /** Enable stale detection (default: true) */
  enableStaleDetection?: boolean;

  /** Stale check interval in milliseconds (default: 30000) */
  staleCheckInterval?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Subscription manager statistics
 */
export interface SubscriptionManagerStats {
  /** Total subscriptions */
  totalSubscriptions: number;

  /** Active subscriptions */
  activeSubscriptions: number;

  /** Pending subscriptions */
  pendingSubscriptions: number;

  /** Paused subscriptions */
  pausedSubscriptions: number;

  /** Error subscriptions */
  errorSubscriptions: number;

  /** Total tokens subscribed */
  totalTokens: number;

  /** Batches sent */
  batchesSent: number;

  /** Batches completed */
  batchesCompleted: number;

  /** Total confirmations received */
  totalConfirmations: number;

  /** Total errors encountered */
  totalErrors: number;

  /** Stale subscriptions detected */
  staleSubscriptionsDetected: number;

  /** Subscription limit remaining */
  subscriptionLimitRemaining: number;

  /** Token limit remaining */
  tokenLimitRemaining: number;

  /** Average confirmation time in milliseconds */
  avgConfirmationTime: number;

  /** Last activity timestamp */
  lastActivityAt?: Date;
}

/**
 * Subscription health status
 */
export interface SubscriptionHealth {
  /** Overall health score (0-100) */
  score: number;

  /** Health status */
  status: "healthy" | "degraded" | "unhealthy";

  /** Active rate (percentage of subscriptions that are active) */
  activeRate: number;

  /** Error rate (percentage of subscriptions with errors) */
  errorRate: number;

  /** Stale rate (percentage of subscriptions that are stale) */
  staleRate: number;

  /** Limit utilization (percentage of subscription limit used) */
  limitUtilization: number;

  /** Issues detected */
  issues: string[];

  /** Recommendations */
  recommendations: string[];
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base subscription manager event
 */
export interface SubscriptionManagerEvent {
  type: SubscriptionManagerEventTypeValue;
  timestamp: Date;
}

/**
 * Subscription added event
 */
export interface SubscriptionAddedEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.SUBSCRIPTION_ADDED;
  subscription: ManagedSubscription;
}

/**
 * Subscription removed event
 */
export interface SubscriptionRemovedEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.SUBSCRIPTION_REMOVED;
  subscriptionId: string;
  tokenIds: string[];
  reason: string;
}

/**
 * Subscription confirmed event
 */
export interface SubscriptionConfirmedEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.SUBSCRIPTION_CONFIRMED;
  subscription: ManagedSubscription;
  confirmationTime: number;
}

/**
 * Subscription error event
 */
export interface SubscriptionErrorEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.SUBSCRIPTION_ERROR;
  subscriptionId: string;
  error: Error;
  willRetry: boolean;
  retryCount: number;
}

/**
 * Subscription stale event
 */
export interface SubscriptionStaleEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.SUBSCRIPTION_STALE;
  subscription: ManagedSubscription;
  lastUpdateAt?: Date;
  staleDuration: number;
}

/**
 * Batch sent event
 */
export interface BatchSentEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.BATCH_SENT;
  batchId: string;
  operationCount: number;
  tokenCount: number;
}

/**
 * Batch complete event
 */
export interface BatchCompleteEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.BATCH_COMPLETE;
  batchId: string;
  successCount: number;
  failureCount: number;
  duration: number;
}

/**
 * Limit reached event
 */
export interface LimitReachedEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.LIMIT_REACHED;
  limitType: "subscription" | "token";
  current: number;
  maximum: number;
}

/**
 * Status changed event
 */
export interface StatusChangedEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.STATUS_CHANGED;
  subscriptionId: string;
  previousStatus: SubscriptionStatusValue;
  newStatus: SubscriptionStatusValue;
  reason?: string;
}

/**
 * Health updated event
 */
export interface HealthUpdatedEvent extends SubscriptionManagerEvent {
  type: typeof SubscriptionManagerEventType.HEALTH_UPDATED;
  health: SubscriptionHealth;
  previousHealth?: SubscriptionHealth;
}

/**
 * All event types union
 */
export type SubscriptionManagerEventUnion =
  | SubscriptionAddedEvent
  | SubscriptionRemovedEvent
  | SubscriptionConfirmedEvent
  | SubscriptionErrorEvent
  | SubscriptionStaleEvent
  | BatchSentEvent
  | BatchCompleteEvent
  | LimitReachedEvent
  | StatusChangedEvent
  | HealthUpdatedEvent;

/**
 * Event listener map
 */
export interface SubscriptionManagerEventListenerMap {
  subscriptionAdded: ((event: SubscriptionAddedEvent) => void)[];
  subscriptionRemoved: ((event: SubscriptionRemovedEvent) => void)[];
  subscriptionConfirmed: ((event: SubscriptionConfirmedEvent) => void)[];
  subscriptionError: ((event: SubscriptionErrorEvent) => void)[];
  subscriptionStale: ((event: SubscriptionStaleEvent) => void)[];
  batchSent: ((event: BatchSentEvent) => void)[];
  batchComplete: ((event: BatchCompleteEvent) => void)[];
  limitReached: ((event: LimitReachedEvent) => void)[];
  statusChanged: ((event: StatusChangedEvent) => void)[];
  healthUpdated: ((event: HealthUpdatedEvent) => void)[];
}

type SubscriptionManagerEventKey = keyof SubscriptionManagerEventListenerMap;

// ============================================================================
// Send Function Type
// ============================================================================

/**
 * Function to send data over WebSocket
 */
export type SendJsonFunction = (data: unknown) => boolean;

// ============================================================================
// Default Logger
// ============================================================================

const defaultLogger: WebSocketLogger = {
  debug: () => {},
  info: () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// ============================================================================
// MultiMarketSubscriptionManager Class
// ============================================================================

/**
 * Manages subscriptions across multiple markets efficiently
 */
export class MultiMarketSubscriptionManager {
  private readonly config: Required<SubscriptionManagerConfig>;
  private readonly logger: WebSocketLogger;

  // Subscription tracking
  private readonly subscriptions: Map<string, ManagedSubscription> = new Map();
  private readonly tokenToSubscription: Map<string, string> = new Map();

  // Batching
  private readonly pendingOperations: Map<string, PendingOperation> = new Map();
  private readonly batches: Map<string, BatchOperation> = new Map();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  // Stale detection
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private stats: SubscriptionManagerStats;
  private confirmationTimes: number[] = [];

  // Event listeners
  private readonly listeners: SubscriptionManagerEventListenerMap = {
    subscriptionAdded: [],
    subscriptionRemoved: [],
    subscriptionConfirmed: [],
    subscriptionError: [],
    subscriptionStale: [],
    batchSent: [],
    batchComplete: [],
    limitReached: [],
    statusChanged: [],
    healthUpdated: [],
  };

  // Send function
  private sendJson: SendJsonFunction | null = null;

  // Disposed flag
  private disposed = false;

  // Last health snapshot
  private lastHealth: SubscriptionHealth | null = null;

  constructor(
    config: SubscriptionManagerConfig = {},
    logger: WebSocketLogger = defaultLogger
  ) {
    this.logger = config.debug
      ? {
          debug: console.log.bind(console, "[SubscriptionManager]"),
          info: console.log.bind(console, "[SubscriptionManager]"),
          warn: console.warn.bind(console, "[SubscriptionManager]"),
          error: console.error.bind(console, "[SubscriptionManager]"),
        }
      : logger;

    this.config = {
      maxSubscriptionsPerConnection: config.maxSubscriptionsPerConnection ?? DEFAULT_MAX_SUBSCRIPTIONS_PER_CONNECTION,
      maxTokensPerSubscription: config.maxTokensPerSubscription ?? DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      batchDelay: config.batchDelay ?? DEFAULT_BATCH_DELAY,
      subscriptionTimeout: config.subscriptionTimeout ?? DEFAULT_SUBSCRIPTION_TIMEOUT,
      staleSubscriptionThreshold: config.staleSubscriptionThreshold ?? DEFAULT_STALE_SUBSCRIPTION_THRESHOLD,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMultiplier: config.retryDelayMultiplier ?? 2,
      initialRetryDelay: config.initialRetryDelay ?? 1000,
      enableStaleDetection: config.enableStaleDetection ?? true,
      staleCheckInterval: config.staleCheckInterval ?? 30000,
      debug: config.debug ?? false,
    };

    this.stats = this.createInitialStats();

    // Start stale detection if enabled
    if (this.config.enableStaleDetection) {
      this.startStaleDetection();
    }
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Set the send function for WebSocket communication
   */
  setSendFunction(sendJson: SendJsonFunction): void {
    this.sendJson = sendJson;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<SubscriptionManagerConfig>> {
    return { ...this.config };
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Subscribe to market updates
   */
  async subscribe(
    tokenIds: string | string[],
    options: {
      channel?: SubscriptionChannelValue;
      priority?: number;
      tags?: string[];
      autoResubscribe?: boolean;
      metadata?: Record<string, unknown>;
      immediate?: boolean;
    } = {}
  ): Promise<ManagedSubscription> {
    if (this.disposed) {
      throw new Error("Manager has been disposed");
    }

    const normalizedTokenIds = normalizeTokenIds(tokenIds);
    if (normalizedTokenIds.length === 0) {
      throw new Error("At least one token ID is required");
    }

    // Check token count limit
    if (normalizedTokenIds.length > this.config.maxTokensPerSubscription) {
      throw new Error(
        `Token count exceeds maximum (${normalizedTokenIds.length} > ${this.config.maxTokensPerSubscription})`
      );
    }

    // Check subscription limit
    if (this.subscriptions.size >= this.config.maxSubscriptionsPerConnection) {
      this.emit("limitReached", {
        type: SubscriptionManagerEventType.LIMIT_REACHED,
        timestamp: new Date(),
        limitType: "subscription",
        current: this.subscriptions.size,
        maximum: this.config.maxSubscriptionsPerConnection,
      });
      throw new Error(
        `Subscription limit reached (${this.subscriptions.size}/${this.config.maxSubscriptionsPerConnection})`
      );
    }

    const channel = options.channel ?? SubscriptionChannel.MARKET;
    const priority = options.priority ?? 0;

    return new Promise((resolve, reject) => {
      const operationId = generateSubscriptionId();

      const operation: PendingOperation = {
        id: operationId,
        type: BatchOperationType.SUBSCRIBE,
        tokenIds: normalizedTokenIds,
        channel,
        priority,
        createdAt: new Date(),
        resolve: resolve as (subscription: ManagedSubscription) => void,
        reject,
        metadata: {
          tags: options.tags,
          autoResubscribe: options.autoResubscribe,
          ...options.metadata,
        },
      };

      // Set timeout
      operation.timeoutHandle = setTimeout(() => {
        this.handleOperationTimeout(operationId);
      }, this.config.subscriptionTimeout);

      this.pendingOperations.set(operationId, operation);

      if (options.immediate) {
        // Send immediately without batching
        this.sendOperation(operation);
      } else {
        // Schedule batch
        this.scheduleBatch();
      }
    });
  }

  /**
   * Subscribe to multiple markets at once
   */
  async subscribeMany(
    requests: Array<{
      tokenIds: string | string[];
      channel?: SubscriptionChannelValue;
      priority?: number;
      tags?: string[];
      autoResubscribe?: boolean;
      metadata?: Record<string, unknown>;
      immediate?: boolean;
    }>
  ): Promise<ManagedSubscription[]> {
    const promises = requests.map((req) => this.subscribe(req.tokenIds, req));
    return Promise.all(promises);
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Send unsubscribe message
    const message = buildSubscriptionMessage(
      subscription.tokenIds,
      "unsubscribe",
      subscription.channel,
      subscriptionId
    );

    if (this.sendJson) {
      this.sendJson(message);
    }

    // Clean up
    this.removeSubscription(subscriptionId, "user_request");
  }

  /**
   * Unsubscribe from a token
   */
  async unsubscribeToken(tokenId: string): Promise<void> {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    if (!subscriptionId) {
      throw new Error(`Token not subscribed: ${tokenId}`);
    }
    return this.unsubscribe(subscriptionId);
  }

  /**
   * Unsubscribe from all subscriptions
   */
  async unsubscribeAll(): Promise<void> {
    const subscriptionIds = Array.from(this.subscriptions.keys());
    for (const id of subscriptionIds) {
      await this.unsubscribe(id);
    }
  }

  /**
   * Pause a subscription (keeps it tracked but marks as paused)
   */
  pauseSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      const previousStatus = subscription.status;
      subscription.status = SubscriptionStatus.PAUSED;

      this.emit("statusChanged", {
        type: SubscriptionManagerEventType.STATUS_CHANGED,
        timestamp: new Date(),
        subscriptionId,
        previousStatus,
        newStatus: SubscriptionStatus.PAUSED,
        reason: "user_request",
      });
    }
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status === SubscriptionStatus.PAUSED) {
      // Re-subscribe
      const message = buildSubscriptionMessage(
        subscription.tokenIds,
        "subscribe",
        subscription.channel,
        subscriptionId
      );

      if (this.sendJson) {
        this.sendJson(message);
      }

      const previousStatus = subscription.status;
      subscription.status = SubscriptionStatus.PENDING;
      subscription.confirmed = false;

      this.emit("statusChanged", {
        type: SubscriptionManagerEventType.STATUS_CHANGED,
        timestamp: new Date(),
        subscriptionId,
        previousStatus,
        newStatus: SubscriptionStatus.PENDING,
        reason: "resumed",
      });
    }
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  private scheduleBatch(): void {
    if (this.batchTimer !== null) {
      return; // Already scheduled
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushBatch();
    }, this.config.batchDelay);
  }

  private flushBatch(): void {
    if (this.pendingOperations.size === 0) {
      return;
    }

    // Sort by priority (higher first)
    const operations = Array.from(this.pendingOperations.values()).sort(
      (a, b) => b.priority - a.priority
    );

    // Take up to batchSize operations
    const batchOperations = operations.slice(0, this.config.batchSize);

    if (batchOperations.length === 0) {
      return;
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const batch: BatchOperation = {
      id: batchId,
      operations: batchOperations,
      createdAt: new Date(),
      completedCount: 0,
      failedCount: 0,
    };

    this.batches.set(batchId, batch);

    // Mark operations as part of batch
    for (const op of batchOperations) {
      this.pendingOperations.delete(op.id);
    }

    // Send batch
    this.sendBatch(batch);

    // Schedule next batch if there are more pending operations
    if (this.pendingOperations.size > 0) {
      this.scheduleBatch();
    }
  }

  private sendBatch(batch: BatchOperation): void {
    batch.sentAt = new Date();

    let tokenCount = 0;
    for (const operation of batch.operations) {
      this.sendOperation(operation);
      tokenCount += operation.tokenIds.length;
    }

    this.stats.batchesSent++;

    this.emit("batchSent", {
      type: SubscriptionManagerEventType.BATCH_SENT,
      timestamp: new Date(),
      batchId: batch.id,
      operationCount: batch.operations.length,
      tokenCount,
    });
  }

  private sendOperation(operation: PendingOperation): void {
    if (operation.type === BatchOperationType.SUBSCRIBE) {
      // Create managed subscription
      const subscription = this.createManagedSubscription(operation);

      // Track subscription
      this.subscriptions.set(subscription.id, subscription);
      for (const tokenId of subscription.tokenIds) {
        this.tokenToSubscription.set(tokenId, subscription.id);
      }

      // Send subscribe message
      const message = buildSubscriptionMessage(
        subscription.tokenIds,
        "subscribe",
        subscription.channel,
        subscription.id
      );

      if (this.sendJson) {
        const sent = this.sendJson(message);
        if (!sent) {
          this.handleOperationError(operation.id, new Error("Failed to send subscription message"));
          return;
        }
      }

      this.logger.info(
        `Subscribing to ${subscription.tokenIds.length} token(s): ${subscription.tokenIds.join(", ")}`
      );

      this.emit("subscriptionAdded", {
        type: SubscriptionManagerEventType.SUBSCRIPTION_ADDED,
        timestamp: new Date(),
        subscription,
      });
    }
  }

  private createManagedSubscription(operation: PendingOperation): ManagedSubscription {
    const metadata = operation.metadata ?? {};
    const tags = (metadata.tags as string[] | undefined) ?? [];
    const autoResubscribe = (metadata.autoResubscribe as boolean | undefined) ?? true;

    return {
      id: operation.id,
      tokenIds: operation.tokenIds,
      channel: operation.channel,
      createdAt: operation.createdAt,
      confirmed: false,
      updateCount: 0,
      prices: new Map(),
      metadata,
      status: SubscriptionStatus.PENDING,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      priority: operation.priority,
      tags: new Set(tags),
      autoResubscribe,
    };
  }

  // ==========================================================================
  // Confirmation Handling
  // ==========================================================================

  /**
   * Handle subscription confirmation from WebSocket
   */
  handleConfirmation(
    subscriptionId: string,
    tokenIds?: string[]
  ): void {
    // Find subscription
    let subscription = this.subscriptions.get(subscriptionId);

    // If not found by ID, try to find by token IDs
    if (!subscription && tokenIds && tokenIds.length > 0) {
      for (const tokenId of tokenIds) {
        const subId = this.tokenToSubscription.get(tokenId);
        if (subId) {
          subscription = this.subscriptions.get(subId);
          subscriptionId = subId;
          break;
        }
      }
    }

    if (!subscription) {
      this.logger.warn(`Confirmation for unknown subscription: ${subscriptionId}`);
      return;
    }

    const previousStatus = subscription.status;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.confirmed = true;
    subscription.confirmedAt = new Date();
    subscription.lastActiveAt = new Date();

    // Calculate confirmation time
    const confirmationTime = Date.now() - subscription.createdAt.getTime();
    this.confirmationTimes.push(confirmationTime);
    if (this.confirmationTimes.length > 100) {
      this.confirmationTimes.shift();
    }

    this.stats.totalConfirmations++;
    this.stats.lastActivityAt = new Date();

    // Resolve pending operation
    const operation = this.findPendingOperation(subscriptionId);
    if (operation) {
      if (operation.timeoutHandle) {
        clearTimeout(operation.timeoutHandle);
      }
      operation.resolve(subscription);
      this.removePendingOperation(subscriptionId);
    }

    this.logger.info(`Subscription confirmed: ${subscriptionId}`);

    // Update batch if applicable
    if (subscription.batchId) {
      this.updateBatchCompletion(subscription.batchId, true);
    }

    this.emit("subscriptionConfirmed", {
      type: SubscriptionManagerEventType.SUBSCRIPTION_CONFIRMED,
      timestamp: new Date(),
      subscription,
      confirmationTime,
    });

    if (previousStatus !== SubscriptionStatus.ACTIVE) {
      this.emit("statusChanged", {
        type: SubscriptionManagerEventType.STATUS_CHANGED,
        timestamp: new Date(),
        subscriptionId,
        previousStatus,
        newStatus: SubscriptionStatus.ACTIVE,
        reason: "confirmed",
      });
    }
  }

  /**
   * Handle subscription error from WebSocket
   */
  handleError(
    subscriptionId: string,
    error: Error
  ): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Error for unknown subscription: ${subscriptionId}`);
      return;
    }

    subscription.lastError = error;
    subscription.retryCount++;

    const willRetry = subscription.retryCount < subscription.maxRetries;

    this.stats.totalErrors++;

    this.logger.error(`Subscription error: ${subscriptionId}`, error);

    this.emit("subscriptionError", {
      type: SubscriptionManagerEventType.SUBSCRIPTION_ERROR,
      timestamp: new Date(),
      subscriptionId,
      error,
      willRetry,
      retryCount: subscription.retryCount,
    });

    if (willRetry) {
      // Schedule retry
      const retryDelay = this.calculateRetryDelay(subscription.retryCount);
      setTimeout(() => {
        this.retrySubscription(subscriptionId);
      }, retryDelay);
    } else {
      // Mark as error
      const previousStatus = subscription.status;
      subscription.status = SubscriptionStatus.ERROR;

      // Reject pending operation
      const operation = this.findPendingOperation(subscriptionId);
      if (operation) {
        if (operation.timeoutHandle) {
          clearTimeout(operation.timeoutHandle);
        }
        operation.reject(error);
        this.removePendingOperation(subscriptionId);
      }

      // Update batch if applicable
      if (subscription.batchId) {
        this.updateBatchCompletion(subscription.batchId, false);
      }

      this.emit("statusChanged", {
        type: SubscriptionManagerEventType.STATUS_CHANGED,
        timestamp: new Date(),
        subscriptionId,
        previousStatus,
        newStatus: SubscriptionStatus.ERROR,
        reason: error.message,
      });
    }
  }

  /**
   * Handle price update from WebSocket
   */
  handlePriceUpdate(tokenId: string, update: ParsedPriceUpdate): void {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    if (!subscriptionId) {
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    subscription.lastUpdateAt = new Date();
    subscription.lastActiveAt = new Date();
    subscription.updateCount++;
    subscription.prices.set(tokenId, update);

    this.stats.lastActivityAt = new Date();
  }

  // ==========================================================================
  // Retry Logic
  // ==========================================================================

  private calculateRetryDelay(retryCount: number): number {
    return this.config.initialRetryDelay * Math.pow(this.config.retryDelayMultiplier, retryCount - 1);
  }

  private retrySubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || subscription.status === SubscriptionStatus.UNSUBSCRIBED) {
      return;
    }

    const previousStatus = subscription.status;
    subscription.status = SubscriptionStatus.PENDING;
    subscription.confirmed = false;

    // Send subscribe message
    const message = buildSubscriptionMessage(
      subscription.tokenIds,
      "subscribe",
      subscription.channel,
      subscriptionId
    );

    if (this.sendJson) {
      this.sendJson(message);
    }

    this.logger.info(`Retrying subscription: ${subscriptionId} (attempt ${subscription.retryCount})`);

    this.emit("statusChanged", {
      type: SubscriptionManagerEventType.STATUS_CHANGED,
      timestamp: new Date(),
      subscriptionId,
      previousStatus,
      newStatus: SubscriptionStatus.PENDING,
      reason: "retry",
    });
  }

  // ==========================================================================
  // Timeout Handling
  // ==========================================================================

  private handleOperationTimeout(operationId: string): void {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return;
    }

    const error = new Error(`Subscription timeout after ${this.config.subscriptionTimeout}ms`);
    this.handleOperationError(operationId, error);
  }

  private handleOperationError(operationId: string, error: Error): void {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return;
    }

    if (operation.timeoutHandle) {
      clearTimeout(operation.timeoutHandle);
    }

    // Check if subscription was created
    const subscription = this.subscriptions.get(operationId);
    if (subscription) {
      this.handleError(operationId, error);
    } else {
      // Operation failed before subscription was created
      operation.reject(error);
      this.pendingOperations.delete(operationId);
    }
  }

  // ==========================================================================
  // Stale Detection
  // ==========================================================================

  private startStaleDetection(): void {
    if (this.staleCheckTimer !== null) {
      return;
    }

    this.staleCheckTimer = setInterval(() => {
      this.checkStaleSubscriptions();
    }, this.config.staleCheckInterval);
  }

  private stopStaleDetection(): void {
    if (this.staleCheckTimer !== null) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
  }

  private checkStaleSubscriptions(): void {
    const now = Date.now();
    const threshold = this.config.staleSubscriptionThreshold;

    for (const subscription of this.subscriptions.values()) {
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        continue;
      }

      const lastUpdate = subscription.lastUpdateAt ?? subscription.confirmedAt ?? subscription.createdAt;
      const staleDuration = now - lastUpdate.getTime();

      if (staleDuration > threshold) {
        this.stats.staleSubscriptionsDetected++;

        this.emit("subscriptionStale", {
          type: SubscriptionManagerEventType.SUBSCRIPTION_STALE,
          timestamp: new Date(),
          subscription,
          lastUpdateAt: subscription.lastUpdateAt,
          staleDuration,
        });
      }
    }
  }

  // ==========================================================================
  // Batch Completion
  // ==========================================================================

  private updateBatchCompletion(batchId: string, success: boolean): void {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return;
    }

    if (success) {
      batch.completedCount++;
    } else {
      batch.failedCount++;
    }

    // Check if batch is complete
    if (batch.completedCount + batch.failedCount === batch.operations.length) {
      const duration = Date.now() - (batch.sentAt?.getTime() ?? batch.createdAt.getTime());

      this.stats.batchesCompleted++;

      this.emit("batchComplete", {
        type: SubscriptionManagerEventType.BATCH_COMPLETE,
        timestamp: new Date(),
        batchId,
        successCount: batch.completedCount,
        failureCount: batch.failedCount,
        duration,
      });

      // Clean up batch after a delay
      setTimeout(() => {
        this.batches.delete(batchId);
      }, 5000);
    }
  }

  // ==========================================================================
  // Pending Operation Helpers
  // ==========================================================================

  private findPendingOperation(subscriptionId: string): PendingOperation | undefined {
    return this.pendingOperations.get(subscriptionId);
  }

  private removePendingOperation(subscriptionId: string): void {
    this.pendingOperations.delete(subscriptionId);
  }

  // ==========================================================================
  // Subscription Removal
  // ==========================================================================

  private removeSubscription(subscriptionId: string, reason: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    const tokenIds = subscription.tokenIds;

    // Clean up token mappings
    for (const tokenId of tokenIds) {
      this.tokenToSubscription.delete(tokenId);
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    this.emit("subscriptionRemoved", {
      type: SubscriptionManagerEventType.SUBSCRIPTION_REMOVED,
      timestamp: new Date(),
      subscriptionId,
      tokenIds,
      reason,
    });
  }

  // ==========================================================================
  // Query Methods
  // ==========================================================================

  /**
   * Get a subscription by ID
   */
  getSubscription(subscriptionId: string): ManagedSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get subscription for a token
   */
  getSubscriptionForToken(tokenId: string): ManagedSubscription | undefined {
    const subscriptionId = this.tokenToSubscription.get(tokenId);
    return subscriptionId ? this.subscriptions.get(subscriptionId) : undefined;
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): ManagedSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscriptions matching filter criteria
   */
  getSubscriptions(filter: SubscriptionFilter): ManagedSubscription[] {
    let subscriptions = Array.from(this.subscriptions.values());

    // Filter by status
    if (filter.status !== undefined) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      subscriptions = subscriptions.filter((s) => statuses.includes(s.status));
    }

    // Filter by channel
    if (filter.channel !== undefined) {
      const channels = Array.isArray(filter.channel) ? filter.channel : [filter.channel];
      subscriptions = subscriptions.filter((s) => channels.includes(s.channel));
    }

    // Filter by tags
    if (filter.tags !== undefined && filter.tags.length > 0) {
      subscriptions = subscriptions.filter((s) =>
        filter.tags!.some((tag) => s.tags.has(tag))
      );
    }

    // Filter by confirmed
    if (filter.confirmed !== undefined) {
      subscriptions = subscriptions.filter((s) => s.confirmed === filter.confirmed);
    }

    // Filter by token IDs
    if (filter.tokenIds !== undefined && filter.tokenIds.length > 0) {
      subscriptions = subscriptions.filter((s) =>
        filter.tokenIds!.some((tokenId) => s.tokenIds.includes(tokenId))
      );
    }

    // Filter by stale
    if (filter.isStale !== undefined) {
      const now = Date.now();
      const threshold = this.config.staleSubscriptionThreshold;
      subscriptions = subscriptions.filter((s) => {
        if (s.status !== SubscriptionStatus.ACTIVE) {
          return false;
        }
        const lastUpdate = s.lastUpdateAt ?? s.confirmedAt ?? s.createdAt;
        const isStale = now - lastUpdate.getTime() > threshold;
        return filter.isStale ? isStale : !isStale;
      });
    }

    // Filter by priority
    if (filter.minPriority !== undefined) {
      subscriptions = subscriptions.filter((s) => s.priority >= filter.minPriority!);
    }
    if (filter.maxPriority !== undefined) {
      subscriptions = subscriptions.filter((s) => s.priority <= filter.maxPriority!);
    }

    return subscriptions;
  }

  /**
   * Get all subscribed token IDs
   */
  getSubscribedTokenIds(): string[] {
    return Array.from(this.tokenToSubscription.keys());
  }

  /**
   * Check if a token is subscribed
   */
  isTokenSubscribed(tokenId: string): boolean {
    return this.tokenToSubscription.has(tokenId);
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscribed token count
   */
  getSubscribedTokenCount(): number {
    return this.tokenToSubscription.size;
  }

  /**
   * Get subscription counts by status
   */
  getSubscriptionCountsByStatus(): Record<SubscriptionStatusValue, number> {
    const counts: Record<SubscriptionStatusValue, number> = {
      [SubscriptionStatus.PENDING]: 0,
      [SubscriptionStatus.ACTIVE]: 0,
      [SubscriptionStatus.PAUSED]: 0,
      [SubscriptionStatus.ERROR]: 0,
      [SubscriptionStatus.UNSUBSCRIBED]: 0,
    };

    for (const subscription of this.subscriptions.values()) {
      counts[subscription.status]++;
    }

    return counts;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get subscription manager statistics
   */
  getStats(): SubscriptionManagerStats {
    const counts = this.getSubscriptionCountsByStatus();

    // Calculate average confirmation time
    const avgConfirmationTime =
      this.confirmationTimes.length > 0
        ? this.confirmationTimes.reduce((a, b) => a + b, 0) / this.confirmationTimes.length
        : 0;

    return {
      ...this.stats,
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: counts[SubscriptionStatus.ACTIVE],
      pendingSubscriptions: counts[SubscriptionStatus.PENDING],
      pausedSubscriptions: counts[SubscriptionStatus.PAUSED],
      errorSubscriptions: counts[SubscriptionStatus.ERROR],
      totalTokens: this.tokenToSubscription.size,
      subscriptionLimitRemaining: this.config.maxSubscriptionsPerConnection - this.subscriptions.size,
      tokenLimitRemaining:
        this.config.maxSubscriptionsPerConnection * this.config.maxTokensPerSubscription -
        this.tokenToSubscription.size,
      avgConfirmationTime,
    };
  }

  /**
   * Get subscription health status
   */
  getHealth(): SubscriptionHealth {
    const stats = this.getStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Calculate rates
    const activeRate =
      stats.totalSubscriptions > 0
        ? (stats.activeSubscriptions / stats.totalSubscriptions) * 100
        : 100;

    const errorRate =
      stats.totalSubscriptions > 0
        ? (stats.errorSubscriptions / stats.totalSubscriptions) * 100
        : 0;

    // Check for stale subscriptions
    const staleSubscriptions = this.getSubscriptions({ isStale: true });
    const staleRate =
      stats.activeSubscriptions > 0
        ? (staleSubscriptions.length / stats.activeSubscriptions) * 100
        : 0;

    // Calculate limit utilization
    const limitUtilization =
      (stats.totalSubscriptions / this.config.maxSubscriptionsPerConnection) * 100;

    // Calculate health score
    let score = 100;

    // Deduct for low active rate
    if (activeRate < 80) {
      score -= (80 - activeRate) * 0.5;
      issues.push(`Active rate is low (${activeRate.toFixed(1)}%)`);
      recommendations.push("Check for subscription confirmation issues");
    }

    // Deduct for high error rate
    if (errorRate > 5) {
      score -= errorRate * 2;
      issues.push(`Error rate is high (${errorRate.toFixed(1)}%)`);
      recommendations.push("Review error logs and fix underlying issues");
    }

    // Deduct for high stale rate
    if (staleRate > 10) {
      score -= staleRate * 0.5;
      issues.push(`Stale rate is high (${staleRate.toFixed(1)}%)`);
      recommendations.push("Check WebSocket connection health");
    }

    // Deduct for high limit utilization
    if (limitUtilization > 90) {
      score -= (limitUtilization - 90) * 2;
      issues.push(`Subscription limit utilization is high (${limitUtilization.toFixed(1)}%)`);
      recommendations.push("Consider increasing subscription limit or removing unused subscriptions");
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: "healthy" | "degraded" | "unhealthy";
    if (score >= 80) {
      status = "healthy";
    } else if (score >= 50) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    const health: SubscriptionHealth = {
      score,
      status,
      activeRate,
      errorRate,
      staleRate,
      limitUtilization,
      issues,
      recommendations,
    };

    // Check if health changed significantly
    if (this.lastHealth && Math.abs(this.lastHealth.score - score) >= 10) {
      this.emit("healthUpdated", {
        type: SubscriptionManagerEventType.HEALTH_UPDATED,
        timestamp: new Date(),
        health,
        previousHealth: this.lastHealth,
      });
    }

    this.lastHealth = health;
    return health;
  }

  private createInitialStats(): SubscriptionManagerStats {
    return {
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      pendingSubscriptions: 0,
      pausedSubscriptions: 0,
      errorSubscriptions: 0,
      totalTokens: 0,
      batchesSent: 0,
      batchesCompleted: 0,
      totalConfirmations: 0,
      totalErrors: 0,
      staleSubscriptionsDetected: 0,
      subscriptionLimitRemaining: this.config.maxSubscriptionsPerConnection,
      tokenLimitRemaining:
        this.config.maxSubscriptionsPerConnection * this.config.maxTokensPerSubscription,
      avgConfirmationTime: 0,
    };
  }

  // ==========================================================================
  // Reconnection Support
  // ==========================================================================

  /**
   * Handle connection state change
   */
  handleConnectionStateChange(
    state: ConnectionState,
    _previousState: ConnectionState
  ): void {
    if (state === "connected") {
      // Resubscribe to all auto-resubscribe subscriptions
      this.resubscribeAll();
    } else if (state === "disconnected" || state === "error") {
      // Mark all subscriptions as unconfirmed
      for (const subscription of this.subscriptions.values()) {
        if (subscription.status === SubscriptionStatus.ACTIVE) {
          subscription.confirmed = false;
          subscription.status = SubscriptionStatus.PENDING;
        }
      }
    }
  }

  /**
   * Resubscribe to all eligible subscriptions
   */
  async resubscribeAll(): Promise<void> {
    const subscriptions = this.getSubscriptions({
      status: [SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE],
    }).filter((s) => s.autoResubscribe);

    for (const subscription of subscriptions) {
      if (!subscription.confirmed) {
        const message = buildSubscriptionMessage(
          subscription.tokenIds,
          "subscribe",
          subscription.channel,
          subscription.id
        );

        if (this.sendJson) {
          this.sendJson(message);
        }
      }
    }

    this.logger.info(`Resubscribed to ${subscriptions.length} subscription(s)`);
  }

  /**
   * Get subscriptions that need to be restored after reconnect
   */
  getSubscriptionsToRestore(): ManagedSubscription[] {
    return this.getSubscriptions({
      status: [SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE],
    }).filter((s) => s.autoResubscribe);
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Add an event listener
   */
  on<K extends SubscriptionManagerEventKey>(
    event: K,
    listener: SubscriptionManagerEventListenerMap[K][number]
  ): () => void {
    this.listeners[event].push(listener as never);
    return () => this.off(event, listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends SubscriptionManagerEventKey>(
    event: K,
    listener: SubscriptionManagerEventListenerMap[K][number]
  ): void {
    const index = this.listeners[event].indexOf(listener as never);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * Add a one-time event listener
   */
  once<K extends SubscriptionManagerEventKey>(
    event: K,
    listener: SubscriptionManagerEventListenerMap[K][number]
  ): () => void {
    const wrappedListener = ((eventData: unknown) => {
      this.off(event, wrappedListener as SubscriptionManagerEventListenerMap[K][number]);
      (listener as (e: unknown) => void)(eventData);
    }) as SubscriptionManagerEventListenerMap[K][number];

    return this.on(event, wrappedListener);
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event?: SubscriptionManagerEventKey): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      for (const key of Object.keys(this.listeners) as SubscriptionManagerEventKey[]) {
        this.listeners[key] = [];
      }
    }
  }

  private emit<K extends SubscriptionManagerEventKey>(
    event: K,
    data: Parameters<SubscriptionManagerEventListenerMap[K][number]>[0]
  ): void {
    const listeners = this.listeners[event];
    for (const listener of listeners) {
      try {
        (listener as (e: typeof data) => void)(data);
      } catch (error) {
        this.logger.error(`Error in ${event} listener:`, error);
      }
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Dispose of the manager and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop stale detection
    this.stopStaleDetection();

    // Clear batch timer
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear pending operation timeouts
    // Note: We don't reject pending operations to avoid unhandled promise rejections
    // in test environments. The subscriptions will simply not be confirmed.
    for (const operation of this.pendingOperations.values()) {
      if (operation.timeoutHandle) {
        clearTimeout(operation.timeoutHandle);
      }
    }
    this.pendingOperations.clear();

    // Clear subscriptions
    this.subscriptions.clear();
    this.tokenToSubscription.clear();
    this.batches.clear();

    // Clear listeners
    this.removeAllListeners();

    // Clear send function
    this.sendJson = null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new subscription manager
 */
export function createMultiMarketSubscriptionManager(
  config?: SubscriptionManagerConfig,
  logger?: WebSocketLogger
): MultiMarketSubscriptionManager {
  return new MultiMarketSubscriptionManager(config, logger);
}

// ============================================================================
// Singleton Management
// ============================================================================

let sharedManager: MultiMarketSubscriptionManager | null = null;

/**
 * Get the shared subscription manager
 */
export function getSharedSubscriptionManager(): MultiMarketSubscriptionManager {
  if (!sharedManager) {
    sharedManager = createMultiMarketSubscriptionManager();
  }
  return sharedManager;
}

/**
 * Set the shared subscription manager
 */
export function setSharedSubscriptionManager(manager: MultiMarketSubscriptionManager): void {
  if (sharedManager && sharedManager !== manager) {
    sharedManager.dispose();
  }
  sharedManager = manager;
}

/**
 * Reset the shared subscription manager
 */
export function resetSharedSubscriptionManager(): void {
  if (sharedManager) {
    sharedManager.dispose();
    sharedManager = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate subscription distribution across multiple managers
 */
export function calculateSubscriptionDistribution(
  tokenIds: string[],
  maxTokensPerSubscription: number = DEFAULT_MAX_TOKENS_PER_SUBSCRIPTION
): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];

  for (const tokenId of tokenIds) {
    currentBatch.push(tokenId);
    if (currentBatch.length >= maxTokensPerSubscription) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Merge subscription filters with AND logic
 */
export function mergeFilters(...filters: SubscriptionFilter[]): SubscriptionFilter {
  const merged: SubscriptionFilter = {};

  for (const filter of filters) {
    // Merge status
    if (filter.status !== undefined) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (merged.status === undefined) {
        merged.status = statuses;
      } else {
        const existingStatuses = Array.isArray(merged.status) ? merged.status : [merged.status];
        merged.status = existingStatuses.filter((s) => statuses.includes(s));
      }
    }

    // Merge channel
    if (filter.channel !== undefined) {
      const channels = Array.isArray(filter.channel) ? filter.channel : [filter.channel];
      if (merged.channel === undefined) {
        merged.channel = channels;
      } else {
        const existingChannels = Array.isArray(merged.channel) ? merged.channel : [merged.channel];
        merged.channel = existingChannels.filter((c) => channels.includes(c));
      }
    }

    // Merge tags (intersection)
    if (filter.tags !== undefined) {
      if (merged.tags === undefined) {
        merged.tags = [...filter.tags];
      } else {
        merged.tags = merged.tags.filter((t) => filter.tags!.includes(t));
      }
    }

    // Merge tokenIds (intersection)
    if (filter.tokenIds !== undefined) {
      if (merged.tokenIds === undefined) {
        merged.tokenIds = [...filter.tokenIds];
      } else {
        merged.tokenIds = merged.tokenIds.filter((t) => filter.tokenIds!.includes(t));
      }
    }

    // Merge boolean filters
    if (filter.confirmed !== undefined) {
      merged.confirmed = filter.confirmed;
    }
    if (filter.isStale !== undefined) {
      merged.isStale = filter.isStale;
    }

    // Merge priority ranges (intersection)
    if (filter.minPriority !== undefined) {
      merged.minPriority = Math.max(merged.minPriority ?? -Infinity, filter.minPriority);
    }
    if (filter.maxPriority !== undefined) {
      merged.maxPriority = Math.min(merged.maxPriority ?? Infinity, filter.maxPriority);
    }
  }

  return merged;
}

/**
 * Check if subscription matches filter
 */
export function matchesFilter(
  subscription: ManagedSubscription,
  filter: SubscriptionFilter,
  staleThreshold: number = DEFAULT_STALE_SUBSCRIPTION_THRESHOLD
): boolean {
  // Check status
  if (filter.status !== undefined) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!statuses.includes(subscription.status)) {
      return false;
    }
  }

  // Check channel
  if (filter.channel !== undefined) {
    const channels = Array.isArray(filter.channel) ? filter.channel : [filter.channel];
    if (!channels.includes(subscription.channel)) {
      return false;
    }
  }

  // Check tags
  if (filter.tags !== undefined && filter.tags.length > 0) {
    if (!filter.tags.some((tag) => subscription.tags.has(tag))) {
      return false;
    }
  }

  // Check confirmed
  if (filter.confirmed !== undefined && subscription.confirmed !== filter.confirmed) {
    return false;
  }

  // Check tokenIds
  if (filter.tokenIds !== undefined && filter.tokenIds.length > 0) {
    if (!filter.tokenIds.some((tokenId) => subscription.tokenIds.includes(tokenId))) {
      return false;
    }
  }

  // Check stale
  if (filter.isStale !== undefined) {
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }
    const lastUpdate = subscription.lastUpdateAt ?? subscription.confirmedAt ?? subscription.createdAt;
    const isStale = Date.now() - lastUpdate.getTime() > staleThreshold;
    if (filter.isStale !== isStale) {
      return false;
    }
  }

  // Check priority
  if (filter.minPriority !== undefined && subscription.priority < filter.minPriority) {
    return false;
  }
  if (filter.maxPriority !== undefined && subscription.priority > filter.maxPriority) {
    return false;
  }

  return true;
}
