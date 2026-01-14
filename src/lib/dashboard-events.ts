/**
 * Dashboard Events Module (UI-WS-001)
 *
 * Provides a centralized event bus for broadcasting real-time dashboard updates.
 * This module enables services to emit events that will be pushed to connected
 * dashboard clients via Server-Sent Events (SSE).
 *
 * Event types:
 * - alert:new - New alert created
 * - trade:whale - Whale trade detected
 * - stats:update - Dashboard stats changed
 * - connection:status - Connection status change
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/**
 * Dashboard event types
 */
export const DashboardEventType = {
  /** New alert created */
  ALERT_NEW: "alert:new",
  /** Whale trade detected */
  TRADE_WHALE: "trade:whale",
  /** Stats updated */
  STATS_UPDATE: "stats:update",
  /** Connection status changed */
  CONNECTION_STATUS: "connection:status",
} as const;

export type DashboardEventTypeValue =
  (typeof DashboardEventType)[keyof typeof DashboardEventType];

/**
 * Base dashboard event
 */
export interface BaseDashboardEvent {
  /** Event type */
  type: DashboardEventTypeValue;
  /** Timestamp of the event */
  timestamp: string;
  /** Optional event ID */
  id?: string;
}

/**
 * Alert data structure for events
 */
export interface AlertEventData {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  marketId?: string | null;
  walletId?: string | null;
  walletAddress?: string;
  marketName?: string;
  tags?: string[];
  createdAt: string;
}

/**
 * New alert event
 */
export interface AlertNewEvent extends BaseDashboardEvent {
  type: typeof DashboardEventType.ALERT_NEW;
  data: AlertEventData;
}

/**
 * Whale trade data structure for events
 */
export interface WhaleTradeEventData {
  tradeId: string;
  marketId: string;
  walletAddress: string;
  side: "BUY" | "SELL";
  amount: number;
  price: number;
  usdValue: number;
  marketQuestion?: string;
}

/**
 * Whale trade event
 */
export interface TradeWhaleEvent extends BaseDashboardEvent {
  type: typeof DashboardEventType.TRADE_WHALE;
  data: WhaleTradeEventData;
}

/**
 * Stats update data
 */
export interface StatsUpdateData {
  alerts?: number;
  criticalAlerts?: number;
  suspiciousWallets?: number;
  hotMarkets?: number;
  volume24h?: number;
  whaleTrades?: number;
  /** Which field(s) changed */
  changedFields: string[];
}

/**
 * Stats update event
 */
export interface StatsUpdateEvent extends BaseDashboardEvent {
  type: typeof DashboardEventType.STATS_UPDATE;
  data: StatsUpdateData;
}

/**
 * Connection status event
 */
export interface ConnectionStatusEvent extends BaseDashboardEvent {
  type: typeof DashboardEventType.CONNECTION_STATUS;
  data: {
    status: "connected" | "disconnected" | "reconnecting";
    message?: string;
  };
}

/**
 * Union of all dashboard events
 */
export type DashboardEvent =
  | AlertNewEvent
  | TradeWhaleEvent
  | StatsUpdateEvent
  | ConnectionStatusEvent;

/**
 * Subscriber callback type
 */
export type DashboardEventSubscriber = (event: DashboardEvent) => void;

/**
 * Statistics for the event bus
 */
export interface DashboardEventBusStats {
  /** Total events emitted */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<string, number>;
  /** Current subscriber count */
  subscriberCount: number;
  /** When the bus started */
  startedAt: Date;
  /** Last event timestamp */
  lastEventAt: Date | null;
}

// ============================================================================
// Dashboard Event Bus Class
// ============================================================================

/**
 * Dashboard Event Bus
 *
 * Singleton class that manages real-time event broadcasting for the dashboard.
 * Services emit events to this bus, and connected SSE clients receive them.
 */
class DashboardEventBus extends EventEmitter {
  private static instance: DashboardEventBus | null = null;

  /** Set of active subscribers */
  private subscribers: Set<DashboardEventSubscriber> = new Set();

  /** Event statistics */
  private stats: DashboardEventBusStats;

  /** Event counter for generating IDs */
  private eventCounter = 0;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE connections

    this.stats = {
      totalEvents: 0,
      eventsByType: {},
      subscriberCount: 0,
      startedAt: new Date(),
      lastEventAt: null,
    };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DashboardEventBus {
    if (!DashboardEventBus.instance) {
      DashboardEventBus.instance = new DashboardEventBus();
    }
    return DashboardEventBus.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    if (DashboardEventBus.instance) {
      DashboardEventBus.instance.removeAllListeners();
      DashboardEventBus.instance.subscribers.clear();
    }
    DashboardEventBus.instance = null;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    this.eventCounter++;
    return `evt_${Date.now()}_${this.eventCounter}`;
  }

  /**
   * Emit a dashboard event to all subscribers
   */
  emitDashboardEvent(event: Omit<DashboardEvent, "id" | "timestamp">): void {
    const fullEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
    } as DashboardEvent;

    // Update statistics
    this.stats.totalEvents++;
    this.stats.lastEventAt = new Date();
    this.stats.eventsByType[event.type] =
      (this.stats.eventsByType[event.type] ?? 0) + 1;

    // Emit to internal EventEmitter listeners
    this.emit("event", fullEvent);
    this.emit(event.type, fullEvent);

    // Notify all subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(fullEvent);
      } catch (error) {
        console.error("[DashboardEventBus] Subscriber error:", error);
      }
    }
  }

  /**
   * Emit a new alert event
   */
  emitAlertNew(data: AlertEventData): void {
    this.emitDashboardEvent({
      type: DashboardEventType.ALERT_NEW,
      data,
    });
  }

  /**
   * Emit a whale trade event
   */
  emitWhalesTrade(data: WhaleTradeEventData): void {
    this.emitDashboardEvent({
      type: DashboardEventType.TRADE_WHALE,
      data,
    });
  }

  /**
   * Emit a stats update event
   */
  emitStatsUpdate(data: StatsUpdateData): void {
    this.emitDashboardEvent({
      type: DashboardEventType.STATS_UPDATE,
      data,
    });
  }

  /**
   * Subscribe to dashboard events
   */
  subscribe(callback: DashboardEventSubscriber): () => void {
    this.subscribers.add(callback);
    this.stats.subscriberCount = this.subscribers.size;

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      this.stats.subscriberCount = this.subscribers.size;
    };
  }

  /**
   * Get current subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get event bus statistics
   */
  getStats(): DashboardEventBusStats {
    return {
      ...this.stats,
      subscriberCount: this.subscribers.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalEvents: 0,
      eventsByType: {},
      subscriberCount: this.subscribers.size,
      startedAt: new Date(),
      lastEventAt: null,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Get the dashboard event bus singleton
 */
export function getDashboardEventBus(): DashboardEventBus {
  return DashboardEventBus.getInstance();
}

/**
 * Convenience function to emit an alert event
 */
export function emitAlertNew(data: AlertEventData): void {
  getDashboardEventBus().emitAlertNew(data);
}

/**
 * Convenience function to emit a whale trade event
 */
export function emitWhaleTrade(data: WhaleTradeEventData): void {
  getDashboardEventBus().emitWhalesTrade(data);
}

/**
 * Convenience function to emit a stats update event
 */
export function emitStatsUpdate(data: StatsUpdateData): void {
  getDashboardEventBus().emitStatsUpdate(data);
}

/**
 * Subscribe to dashboard events
 */
export function subscribeToDashboardEvents(
  callback: DashboardEventSubscriber
): () => void {
  return getDashboardEventBus().subscribe(callback);
}

/**
 * Reset the event bus (for testing)
 */
export function resetDashboardEventBus(): void {
  DashboardEventBus.resetInstance();
}

export { DashboardEventBus };
