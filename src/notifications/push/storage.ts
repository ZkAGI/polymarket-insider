/**
 * Push notification subscription storage implementations
 * Provides in-memory and interface for database storage
 */

import {
  PushSubscription,
  PushSubscriptionRecord,
  PushSubscriptionState,
  PushSubscriptionStorage,
  generateSubscriptionId,
} from "./types";

/**
 * Error class for storage-related errors
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * In-memory implementation of PushSubscriptionStorage
 *
 * Suitable for development, testing, and small-scale deployments.
 * For production, implement a database-backed storage.
 */
export class InMemoryPushStorage implements PushSubscriptionStorage {
  private subscriptions: Map<string, PushSubscriptionRecord> = new Map();
  private endpointIndex: Map<string, string> = new Map(); // endpoint -> id
  private userIndex: Map<string, Set<string>> = new Map(); // userId -> Set<id>

  /**
   * Save a subscription
   *
   * @param subscription - Subscription record to save
   */
  async save(subscription: PushSubscriptionRecord): Promise<void> {
    // Check for existing subscription with same endpoint
    const existingId = this.endpointIndex.get(subscription.subscription.endpoint);
    if (existingId && existingId !== subscription.id) {
      // Remove old subscription
      await this.delete(existingId);
    }

    // Save the subscription
    this.subscriptions.set(subscription.id, subscription);
    this.endpointIndex.set(subscription.subscription.endpoint, subscription.id);

    // Update user index
    if (subscription.userId) {
      if (!this.userIndex.has(subscription.userId)) {
        this.userIndex.set(subscription.userId, new Set());
      }
      this.userIndex.get(subscription.userId)!.add(subscription.id);
    }
  }

  /**
   * Get subscription by ID
   *
   * @param id - Subscription ID
   * @returns Subscription record or null
   */
  async getById(id: string): Promise<PushSubscriptionRecord | null> {
    return this.subscriptions.get(id) || null;
  }

  /**
   * Get subscription by endpoint
   *
   * @param endpoint - Push endpoint URL
   * @returns Subscription record or null
   */
  async getByEndpoint(endpoint: string): Promise<PushSubscriptionRecord | null> {
    const id = this.endpointIndex.get(endpoint);
    if (!id) return null;
    return this.subscriptions.get(id) || null;
  }

  /**
   * Get all subscriptions for a user
   *
   * @param userId - User ID
   * @returns Array of subscription records
   */
  async getByUserId(userId: string): Promise<PushSubscriptionRecord[]> {
    const ids = this.userIndex.get(userId);
    if (!ids) return [];

    const result: PushSubscriptionRecord[] = [];
    for (const id of ids) {
      const subscription = this.subscriptions.get(id);
      if (subscription) {
        result.push(subscription);
      }
    }
    return result;
  }

  /**
   * Get all active subscriptions
   *
   * @returns Array of active subscription records
   */
  async getAllActive(): Promise<PushSubscriptionRecord[]> {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.state === PushSubscriptionState.ACTIVE
    );
  }

  /**
   * Update subscription
   *
   * @param id - Subscription ID
   * @param updates - Partial updates to apply
   */
  async update(id: string, updates: Partial<PushSubscriptionRecord>): Promise<void> {
    const existing = this.subscriptions.get(id);
    if (!existing) {
      throw new StorageError(`Subscription not found: ${id}`, "NOT_FOUND");
    }

    const updated: PushSubscriptionRecord = {
      ...existing,
      ...updates,
      id: existing.id, // ID cannot be changed
      updatedAt: new Date(),
    };

    // Handle endpoint change
    if (updates.subscription?.endpoint && updates.subscription.endpoint !== existing.subscription.endpoint) {
      this.endpointIndex.delete(existing.subscription.endpoint);
      this.endpointIndex.set(updates.subscription.endpoint, id);
    }

    // Handle user change
    if (updates.userId !== undefined && updates.userId !== existing.userId) {
      // Remove from old user index
      if (existing.userId) {
        this.userIndex.get(existing.userId)?.delete(id);
      }
      // Add to new user index
      if (updates.userId) {
        if (!this.userIndex.has(updates.userId)) {
          this.userIndex.set(updates.userId, new Set());
        }
        this.userIndex.get(updates.userId)!.add(id);
      }
    }

    this.subscriptions.set(id, updated);
  }

  /**
   * Delete subscription by ID
   *
   * @param id - Subscription ID
   */
  async delete(id: string): Promise<void> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return;

    // Remove from endpoint index
    this.endpointIndex.delete(subscription.subscription.endpoint);

    // Remove from user index
    if (subscription.userId) {
      this.userIndex.get(subscription.userId)?.delete(id);
    }

    // Remove subscription
    this.subscriptions.delete(id);
  }

  /**
   * Delete subscription by endpoint
   *
   * @param endpoint - Push endpoint URL
   */
  async deleteByEndpoint(endpoint: string): Promise<void> {
    const id = this.endpointIndex.get(endpoint);
    if (id) {
      await this.delete(id);
    }
  }

  /**
   * Mark subscription as expired
   *
   * @param id - Subscription ID
   */
  async markExpired(id: string): Promise<void> {
    await this.update(id, { state: PushSubscriptionState.EXPIRED });
  }

  /**
   * Get count of active subscriptions
   *
   * @returns Number of active subscriptions
   */
  async getActiveCount(): Promise<number> {
    let count = 0;
    for (const subscription of this.subscriptions.values()) {
      if (subscription.state === PushSubscriptionState.ACTIVE) {
        count++;
      }
    }
    return count;
  }

  /**
   * Clean up old/expired subscriptions
   *
   * @param maxAgeDays - Maximum age in days
   * @returns Number of subscriptions removed
   */
  async cleanup(maxAgeDays: number): Promise<number> {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let removed = 0;

    for (const [id, subscription] of this.subscriptions) {
      const age = now - subscription.createdAt.getTime();
      if (
        subscription.state !== PushSubscriptionState.ACTIVE ||
        age > maxAge
      ) {
        // Also remove if state is not active
        if (
          subscription.state === PushSubscriptionState.EXPIRED ||
          subscription.state === PushSubscriptionState.INVALID ||
          age > maxAge
        ) {
          await this.delete(id);
          removed++;
        }
      }
    }

    return removed;
  }

  /**
   * Get all subscriptions (for debugging/admin)
   */
  async getAll(): Promise<PushSubscriptionRecord[]> {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get total subscription count
   */
  async getTotalCount(): Promise<number> {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions (for testing)
   */
  async clear(): Promise<void> {
    this.subscriptions.clear();
    this.endpointIndex.clear();
    this.userIndex.clear();
  }
}

// ============================================================================
// Subscription Manager
// ============================================================================

/**
 * Subscription manager for handling push subscriptions
 *
 * Provides high-level operations for managing subscriptions
 * with support for different storage backends.
 */
export class PushSubscriptionManager {
  private storage: PushSubscriptionStorage;

  /**
   * Create a new subscription manager
   *
   * @param storage - Storage backend to use
   */
  constructor(storage: PushSubscriptionStorage) {
    this.storage = storage;
  }

  /**
   * Register a new subscription
   *
   * @param subscription - Push subscription from browser
   * @param userId - Optional user ID
   * @param metadata - Optional metadata
   * @returns Created subscription record
   */
  async subscribe(
    subscription: PushSubscription,
    userId?: string,
    metadata?: Record<string, unknown>
  ): Promise<PushSubscriptionRecord> {
    // Check for existing subscription
    const existing = await this.storage.getByEndpoint(subscription.endpoint);
    if (existing) {
      // Update existing subscription
      const updates: Partial<PushSubscriptionRecord> = {
        subscription,
        state: PushSubscriptionState.ACTIVE,
        userId: userId ?? existing.userId,
        metadata: metadata ?? existing.metadata,
        failedAttempts: 0,
      };
      await this.storage.update(existing.id, updates);
      return { ...existing, ...updates };
    }

    // Create new subscription
    const record: PushSubscriptionRecord = {
      id: generateSubscriptionId(subscription.endpoint),
      userId,
      subscription,
      state: PushSubscriptionState.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      failedAttempts: 0,
      metadata,
    };

    await this.storage.save(record);
    return record;
  }

  /**
   * Unsubscribe by endpoint
   *
   * @param endpoint - Push endpoint URL
   */
  async unsubscribe(endpoint: string): Promise<void> {
    const existing = await this.storage.getByEndpoint(endpoint);
    if (existing) {
      await this.storage.update(existing.id, {
        state: PushSubscriptionState.UNSUBSCRIBED,
      });
    }
  }

  /**
   * Unsubscribe all for a user
   *
   * @param userId - User ID
   */
  async unsubscribeUser(userId: string): Promise<void> {
    const subscriptions = await this.storage.getByUserId(userId);
    for (const sub of subscriptions) {
      await this.storage.update(sub.id, {
        state: PushSubscriptionState.UNSUBSCRIBED,
      });
    }
  }

  /**
   * Mark subscription as expired
   *
   * @param endpoint - Push endpoint URL
   */
  async markExpired(endpoint: string): Promise<void> {
    const existing = await this.storage.getByEndpoint(endpoint);
    if (existing) {
      await this.storage.markExpired(existing.id);
    }
  }

  /**
   * Record a successful notification
   *
   * @param endpoint - Push endpoint URL
   */
  async recordSuccess(endpoint: string): Promise<void> {
    const existing = await this.storage.getByEndpoint(endpoint);
    if (existing) {
      await this.storage.update(existing.id, {
        lastNotificationAt: new Date(),
        failedAttempts: 0,
      });
    }
  }

  /**
   * Record a failed notification
   *
   * @param endpoint - Push endpoint URL
   * @param expired - Whether the subscription is expired
   */
  async recordFailure(endpoint: string, expired: boolean = false): Promise<void> {
    const existing = await this.storage.getByEndpoint(endpoint);
    if (existing) {
      if (expired) {
        await this.storage.markExpired(existing.id);
      } else {
        await this.storage.update(existing.id, {
          failedAttempts: existing.failedAttempts + 1,
          state:
            existing.failedAttempts >= 2
              ? PushSubscriptionState.INVALID
              : existing.state,
        });
      }
    }
  }

  /**
   * Get all active subscriptions
   *
   * @returns Array of active push subscriptions
   */
  async getActiveSubscriptions(): Promise<PushSubscription[]> {
    const records = await this.storage.getAllActive();
    return records.map((r) => r.subscription);
  }

  /**
   * Get subscriptions for a specific user
   *
   * @param userId - User ID
   * @returns Array of push subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    const records = await this.storage.getByUserId(userId);
    return records
      .filter((r) => r.state === PushSubscriptionState.ACTIVE)
      .map((r) => r.subscription);
  }

  /**
   * Check if a subscription is active
   *
   * @param endpoint - Push endpoint URL
   * @returns true if subscription is active
   */
  async isActive(endpoint: string): Promise<boolean> {
    const existing = await this.storage.getByEndpoint(endpoint);
    return existing?.state === PushSubscriptionState.ACTIVE;
  }

  /**
   * Get subscription count
   *
   * @returns Number of active subscriptions
   */
  async getActiveCount(): Promise<number> {
    return this.storage.getActiveCount();
  }

  /**
   * Clean up old subscriptions
   *
   * @param maxAgeDays - Maximum age in days for expired subscriptions
   * @returns Number of subscriptions removed
   */
  async cleanup(maxAgeDays: number = 30): Promise<number> {
    return this.storage.cleanup(maxAgeDays);
  }

  /**
   * Get the underlying storage
   */
  getStorage(): PushSubscriptionStorage {
    return this.storage;
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

let storageInstance: InMemoryPushStorage | null = null;
let managerInstance: PushSubscriptionManager | null = null;

/**
 * Get the default in-memory storage instance
 */
export function getDefaultStorage(): InMemoryPushStorage {
  if (!storageInstance) {
    storageInstance = new InMemoryPushStorage();
  }
  return storageInstance;
}

/**
 * Get the default subscription manager
 *
 * @param storage - Optional custom storage backend
 */
export function getSubscriptionManager(
  storage?: PushSubscriptionStorage
): PushSubscriptionManager {
  if (storage) {
    return new PushSubscriptionManager(storage);
  }
  if (!managerInstance) {
    managerInstance = new PushSubscriptionManager(getDefaultStorage());
  }
  return managerInstance;
}

/**
 * Reset storage and manager instances (for testing)
 */
export function resetStorage(): void {
  if (storageInstance) {
    storageInstance.clear();
    storageInstance = null;
  }
  managerInstance = null;
}

/**
 * Create a new in-memory storage instance
 */
export function createInMemoryStorage(): InMemoryPushStorage {
  return new InMemoryPushStorage();
}

/**
 * Create a new subscription manager with custom storage
 *
 * @param storage - Storage backend
 */
export function createSubscriptionManager(
  storage: PushSubscriptionStorage
): PushSubscriptionManager {
  return new PushSubscriptionManager(storage);
}
