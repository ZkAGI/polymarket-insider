/**
 * In-memory queue storage implementation
 * Provides a fast, non-persistent storage for the notification queue
 */

import {
  QueueItem,
  QueueStorage,
  QueueFilterOptions,
  QueueStats,
  UpdateQueueItemInput,
  NotificationStatus,
  NotificationChannel,
  NotificationPriority,
} from "./types";

/**
 * In-memory queue storage
 * Suitable for single-process deployments or testing
 */
export class InMemoryQueueStorage implements QueueStorage {
  private items: Map<string, QueueItem> = new Map();
  private statusIndex: Map<NotificationStatus, Set<string>> = new Map();
  private channelIndex: Map<NotificationChannel, Set<string>> = new Map();
  private priorityIndex: Map<NotificationPriority, Set<string>> = new Map();
  private correlationIndex: Map<string, Set<string>> = new Map();
  private processingTimes: number[] = [];
  private maxProcessingTimeSamples = 1000;

  constructor() {
    // Initialize indexes
    for (const status of Object.values(NotificationStatus)) {
      this.statusIndex.set(status, new Set());
    }
    for (const channel of Object.values(NotificationChannel)) {
      this.channelIndex.set(channel, new Set());
    }
    for (const priority of Object.values(NotificationPriority)) {
      if (typeof priority === "number") {
        this.priorityIndex.set(priority, new Set());
      }
    }
  }

  /**
   * Add item to queue
   */
  async add(item: QueueItem): Promise<void> {
    this.items.set(item.id, { ...item });
    this.addToIndexes(item);
  }

  /**
   * Get item by ID
   */
  async get(id: string): Promise<QueueItem | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  /**
   * Update item
   */
  async update(id: string, updates: UpdateQueueItemInput): Promise<QueueItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    const oldStatus = item.status;

    // Apply updates
    if (updates.status !== undefined) {
      item.status = updates.status;
    }
    if (updates.incrementAttempts) {
      item.attempts += 1;
    }
    if (updates.error !== undefined) {
      item.error = updates.error;
    }
    if (updates.processingStartedAt !== undefined) {
      item.processingStartedAt = updates.processingStartedAt;
    }
    if (updates.completedAt !== undefined) {
      item.completedAt = updates.completedAt;
      // Track processing time
      if (item.processingStartedAt && updates.completedAt) {
        const duration =
          updates.completedAt.getTime() - item.processingStartedAt.getTime();
        this.recordProcessingTime(duration);
      }
    }
    if (updates.scheduledAt !== undefined) {
      item.scheduledAt = updates.scheduledAt;
    }
    item.updatedAt = new Date();

    // Update indexes if needed
    if (oldStatus !== item.status) {
      this.statusIndex.get(oldStatus)?.delete(id);
      this.statusIndex.get(item.status)?.add(id);
    }

    this.items.set(id, item);
    return { ...item };
  }

  /**
   * Remove item from queue
   */
  async remove(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    this.removeFromIndexes(item);
    this.items.delete(id);
    return true;
  }

  /**
   * Find items matching filter
   */
  async find(filter: QueueFilterOptions): Promise<QueueItem[]> {
    let candidates: Set<string> | null = null;

    // Use indexes to narrow down candidates
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      candidates = this.intersectSets(
        statuses.map((s) => this.statusIndex.get(s) || new Set())
      );
    }

    if (filter.channel) {
      const channels = Array.isArray(filter.channel) ? filter.channel : [filter.channel];
      const channelSet = this.intersectSets(
        channels.map((c) => this.channelIndex.get(c) || new Set())
      );
      candidates = candidates ? this.intersect(candidates, channelSet) : channelSet;
    }

    if (filter.priority) {
      const priorities = Array.isArray(filter.priority)
        ? filter.priority
        : [filter.priority];
      const prioritySet = this.intersectSets(
        priorities.map((p) => this.priorityIndex.get(p) || new Set())
      );
      candidates = candidates ? this.intersect(candidates, prioritySet) : prioritySet;
    }

    if (filter.correlationId) {
      const correlationSet = this.correlationIndex.get(filter.correlationId) || new Set();
      candidates = candidates ? this.intersect(candidates, correlationSet) : correlationSet;
    }

    // If no index-based filtering, start with all items
    if (candidates === null) {
      candidates = new Set(this.items.keys());
    }

    // Apply remaining filters
    let results: QueueItem[] = [];
    for (const id of candidates) {
      const item = this.items.get(id);
      if (!item) continue;

      // Date filters
      if (filter.createdAfter && item.createdAt < filter.createdAfter) continue;
      if (filter.createdBefore && item.createdAt > filter.createdBefore) continue;
      if (
        filter.scheduledBefore &&
        item.scheduledAt &&
        item.scheduledAt > filter.scheduledBefore
      )
        continue;

      results.push({ ...item });
    }

    // Sort by priority (highest first) then by createdAt (oldest first)
    results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Apply pagination
    if (filter.offset) {
      results = results.slice(filter.offset);
    }
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Count items matching filter
   */
  async count(filter: QueueFilterOptions): Promise<number> {
    const items = await this.find({ ...filter, limit: undefined, offset: undefined });
    return items.length;
  }

  /**
   * Get items ready for processing
   * Items are returned sorted by priority (highest first) then by creation time (oldest first)
   */
  async getReadyForProcessing(limit: number): Promise<QueueItem[]> {
    const pendingIds = this.statusIndex.get(NotificationStatus.PENDING) || new Set();
    const now = new Date();
    const results: QueueItem[] = [];

    for (const id of pendingIds) {
      const item = this.items.get(id);
      if (!item) continue;

      // Check if scheduled for later
      if (item.scheduledAt && item.scheduledAt > now) continue;

      results.push({ ...item });
    }

    // Sort by priority (highest first) then by createdAt (oldest first)
    results.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return results.slice(0, limit);
  }

  /**
   * Atomically mark an item as processing
   * Returns false if item was already processing or not pending
   */
  async markProcessing(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;
    if (item.status !== NotificationStatus.PENDING) return false;

    // Atomic update
    item.status = NotificationStatus.PROCESSING;
    item.processingStartedAt = new Date();
    item.updatedAt = new Date();

    // Update index
    this.statusIndex.get(NotificationStatus.PENDING)?.delete(id);
    this.statusIndex.get(NotificationStatus.PROCESSING)?.add(id);

    this.items.set(id, item);
    return true;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const byStatus: Record<NotificationStatus, number> = {} as Record<
      NotificationStatus,
      number
    >;
    const byChannel: Record<NotificationChannel, number> = {} as Record<
      NotificationChannel,
      number
    >;
    const byPriority: Record<NotificationPriority, number> = {} as Record<
      NotificationPriority,
      number
    >;

    // Initialize counts
    for (const status of Object.values(NotificationStatus)) {
      byStatus[status] = this.statusIndex.get(status)?.size || 0;
    }
    for (const channel of Object.values(NotificationChannel)) {
      byChannel[channel] = this.channelIndex.get(channel)?.size || 0;
    }
    for (const priority of Object.values(NotificationPriority)) {
      if (typeof priority === "number") {
        byPriority[priority] = this.priorityIndex.get(priority)?.size || 0;
      }
    }

    // Calculate queue depth
    const queueDepth =
      (this.statusIndex.get(NotificationStatus.PENDING)?.size || 0) +
      (this.statusIndex.get(NotificationStatus.PROCESSING)?.size || 0) +
      (this.statusIndex.get(NotificationStatus.RETRYING)?.size || 0);

    // Calculate success rate
    const sent = this.statusIndex.get(NotificationStatus.SENT)?.size || 0;
    const failed = this.statusIndex.get(NotificationStatus.FAILED)?.size || 0;
    const deadLetter = this.statusIndex.get(NotificationStatus.DEAD_LETTER)?.size || 0;
    const totalProcessed = sent + failed + deadLetter;
    const successRate = totalProcessed > 0 ? (sent / totalProcessed) * 100 : 100;

    // Calculate average processing time
    const avgProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0;

    // Count processed in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let processedLastHour = 0;
    for (const item of this.items.values()) {
      if (
        item.status === NotificationStatus.SENT &&
        item.completedAt &&
        item.completedAt >= oneHourAgo
      ) {
        processedLastHour++;
      }
    }

    return {
      total: this.items.size,
      byStatus,
      byChannel,
      byPriority,
      avgProcessingTime,
      successRate,
      queueDepth,
      processedLastHour,
      timestamp: new Date(),
    };
  }

  /**
   * Clear items matching filter
   */
  async clear(filter?: QueueFilterOptions): Promise<number> {
    if (!filter) {
      const count = this.items.size;
      this.items.clear();
      // Reset all indexes
      for (const [, set] of this.statusIndex) set.clear();
      for (const [, set] of this.channelIndex) set.clear();
      for (const [, set] of this.priorityIndex) set.clear();
      this.correlationIndex.clear();
      this.processingTimes = [];
      return count;
    }

    const toRemove = await this.find(filter);
    for (const item of toRemove) {
      await this.remove(item.id);
    }
    return toRemove.length;
  }

  /**
   * Get dead letter items
   */
  async getDeadLetter(limit: number = 100): Promise<QueueItem[]> {
    return this.find({
      status: NotificationStatus.DEAD_LETTER,
      limit,
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private addToIndexes(item: QueueItem): void {
    this.statusIndex.get(item.status)?.add(item.id);
    this.channelIndex.get(item.payload.channel)?.add(item.id);
    this.priorityIndex.get(item.priority)?.add(item.id);
    if (item.correlationId) {
      if (!this.correlationIndex.has(item.correlationId)) {
        this.correlationIndex.set(item.correlationId, new Set());
      }
      this.correlationIndex.get(item.correlationId)?.add(item.id);
    }
  }

  private removeFromIndexes(item: QueueItem): void {
    this.statusIndex.get(item.status)?.delete(item.id);
    this.channelIndex.get(item.payload.channel)?.delete(item.id);
    this.priorityIndex.get(item.priority)?.delete(item.id);
    if (item.correlationId) {
      this.correlationIndex.get(item.correlationId)?.delete(item.id);
    }
  }

  private intersect(a: Set<string>, b: Set<string>): Set<string> {
    const result = new Set<string>();
    for (const item of a) {
      if (b.has(item)) result.add(item);
    }
    return result;
  }

  private intersectSets(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) return new Set();
    if (sets.length === 1) return new Set(sets[0]);

    // Start with the smallest set for efficiency
    const sorted = [...sets].sort((a, b) => a.size - b.size);
    let result: Set<string> = sorted[0] ?? new Set();

    for (let i = 1; i < sorted.length; i++) {
      const nextSet = sorted[i];
      if (nextSet) {
        result = this.intersect(result, nextSet);
      }
    }

    return result;
  }

  private recordProcessingTime(duration: number): void {
    this.processingTimes.push(duration);
    if (this.processingTimes.length > this.maxProcessingTimeSamples) {
      this.processingTimes.shift();
    }
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let sharedStorage: InMemoryQueueStorage | null = null;

/**
 * Get or create shared queue storage instance
 */
export function getQueueStorage(): InMemoryQueueStorage {
  if (!sharedStorage) {
    sharedStorage = new InMemoryQueueStorage();
  }
  return sharedStorage;
}

/**
 * Reset shared queue storage instance
 */
export function resetQueueStorage(): void {
  sharedStorage = null;
}

/**
 * Set custom queue storage instance
 */
export function setQueueStorage(storage: InMemoryQueueStorage): void {
  sharedStorage = storage;
}
