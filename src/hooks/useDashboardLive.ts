/**
 * Dashboard Live Updates Hook (UI-WS-001)
 *
 * React hook that connects to the dashboard SSE endpoint and provides
 * real-time updates to components.
 *
 * Features:
 * - Automatic connection management
 * - Reconnection with exponential backoff
 * - Event filtering and callbacks
 * - Connection status tracking
 * - SWR integration for optimistic updates
 *
 * Usage:
 * ```tsx
 * const { isConnected, lastEvent, onAlert, onWhaleTrade } = useDashboardLive();
 * ```
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  DashboardEvent,
  DashboardEventTypeValue,
  AlertEventData,
  WhaleTradeEventData,
  StatsUpdateData,
} from "@/lib/dashboard-events";
import { DashboardEventType } from "@/lib/dashboard-events";

// ============================================================================
// Types
// ============================================================================

/**
 * Connection status
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

/**
 * Event callback types
 */
export type AlertCallback = (data: AlertEventData) => void;
export type WhaleTradeCallback = (data: WhaleTradeEventData) => void;
export type StatsUpdateCallback = (data: StatsUpdateData) => void;
export type GenericEventCallback = (event: DashboardEvent) => void;

/**
 * Hook configuration options
 */
export interface UseDashboardLiveOptions {
  /** Whether to auto-connect on mount (default: true) */
  enabled?: boolean;
  /** Reconnection attempts before giving up (default: 5) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Callback when alert:new event received */
  onAlert?: AlertCallback;
  /** Callback when trade:whale event received */
  onWhaleTrade?: WhaleTradeCallback;
  /** Callback when stats:update event received */
  onStatsUpdate?: StatsUpdateCallback;
  /** Callback for any event */
  onEvent?: GenericEventCallback;
  /** Callback when connection status changes */
  onConnectionChange?: (status: ConnectionStatus) => void;
}

/**
 * Hook return type
 */
export interface UseDashboardLiveResult {
  /** Current connection status */
  status: ConnectionStatus;
  /** Whether the connection is established */
  isConnected: boolean;
  /** Whether currently reconnecting */
  isReconnecting: boolean;
  /** Last received event */
  lastEvent: DashboardEvent | null;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date | null;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Error message if connection failed */
  error: string | null;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Retry connection after failure */
  retry: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time dashboard updates via SSE
 */
export function useDashboardLive(
  options: UseDashboardLiveOptions = {}
): UseDashboardLiveResult {
  const {
    enabled = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
    onAlert,
    onWhaleTrade,
    onStatsUpdate,
    onEvent,
    onConnectionChange,
  } = options;

  // State
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<DashboardEvent | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentDelayRef = useRef(reconnectDelay);
  const isManualDisconnectRef = useRef(false);

  // Derived state
  const isConnected = status === "connected";
  const isReconnecting = status === "reconnecting";

  /**
   * Update connection status and notify callback
   */
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      onConnectionChange?.(newStatus);
    },
    [onConnectionChange]
  );

  /**
   * Handle incoming SSE message
   */
  const handleMessage = useCallback(
    (messageEvent: MessageEvent) => {
      try {
        const parsed = JSON.parse(messageEvent.data) as DashboardEvent;
        setLastEvent(parsed);

        // Call generic event callback
        onEvent?.(parsed);

        // Call specific callbacks based on event type
        switch (parsed.type) {
          case DashboardEventType.ALERT_NEW:
            if (
              onAlert &&
              "data" in parsed &&
              parsed.data !== undefined
            ) {
              onAlert(parsed.data as AlertEventData);
            }
            break;
          case DashboardEventType.TRADE_WHALE:
            if (
              onWhaleTrade &&
              "data" in parsed &&
              parsed.data !== undefined
            ) {
              onWhaleTrade(parsed.data as WhaleTradeEventData);
            }
            break;
          case DashboardEventType.STATS_UPDATE:
            if (
              onStatsUpdate &&
              "data" in parsed &&
              parsed.data !== undefined
            ) {
              onStatsUpdate(parsed.data as StatsUpdateData);
            }
            break;
        }
      } catch {
        console.warn("[useDashboardLive] Failed to parse message:", messageEvent.data);
      }
    },
    [onAlert, onWhaleTrade, onStatsUpdate, onEvent]
  );

  /**
   * Handle heartbeat event
   */
  const handleHeartbeat = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      setLastHeartbeat(new Date(data.timestamp));
    } catch {
      setLastHeartbeat(new Date());
    }
  }, []);

  /**
   * Handle connection opened
   */
  const handleOpen = useCallback(() => {
    updateStatus("connected");
    setError(null);
    setReconnectAttempts(0);
    currentDelayRef.current = reconnectDelay;
    console.log("[useDashboardLive] Connected to live updates");
  }, [updateStatus, reconnectDelay]);

  /**
   * Handle connection error and attempt reconnection
   */
  const handleError = useCallback(() => {
    // Don't reconnect if manually disconnected
    if (isManualDisconnectRef.current) {
      return;
    }

    // Close the failed connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Check if we should attempt reconnection
    if (reconnectAttempts >= maxReconnectAttempts) {
      updateStatus("disconnected");
      setError(`Failed to connect after ${maxReconnectAttempts} attempts`);
      console.error("[useDashboardLive] Max reconnection attempts reached");
      return;
    }

    // Schedule reconnection with exponential backoff
    updateStatus("reconnecting");
    setReconnectAttempts((prev) => prev + 1);

    const delay = Math.min(currentDelayRef.current, maxReconnectDelay);
    console.log(
      `[useDashboardLive] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      currentDelayRef.current = Math.min(
        currentDelayRef.current * 2,
        maxReconnectDelay
      );
      connect();
    }, delay);
  }, [
    reconnectAttempts,
    maxReconnectAttempts,
    maxReconnectDelay,
    updateStatus,
  ]);

  /**
   * Connect to the SSE endpoint
   */
  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isManualDisconnectRef.current = false;
    updateStatus("connecting");

    try {
      const eventSource = new EventSource("/api/dashboard/live");
      eventSourceRef.current = eventSource;

      // Standard message handler
      eventSource.onmessage = handleMessage;

      // Connection opened
      eventSource.onopen = handleOpen;

      // Connection error
      eventSource.onerror = handleError;

      // Listen for specific event types
      eventSource.addEventListener("connected", (event) => {
        console.log("[useDashboardLive] Connection confirmed:", event.data);
      });

      eventSource.addEventListener("heartbeat", handleHeartbeat);
    } catch (err) {
      console.error("[useDashboardLive] Failed to create EventSource:", err);
      setError("Failed to create connection");
      updateStatus("disconnected");
    }
  }, [handleMessage, handleOpen, handleError, handleHeartbeat, updateStatus]);

  /**
   * Disconnect from the SSE endpoint
   */
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateStatus("disconnected");
    setReconnectAttempts(0);
    currentDelayRef.current = reconnectDelay;
    console.log("[useDashboardLive] Disconnected");
  }, [updateStatus, reconnectDelay]);

  /**
   * Retry connection after failure
   */
  const retry = useCallback(() => {
    setReconnectAttempts(0);
    currentDelayRef.current = reconnectDelay;
    setError(null);
    connect();
  }, [connect, reconnectDelay]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    status,
    isConnected,
    isReconnecting,
    lastEvent,
    lastHeartbeat,
    reconnectAttempts,
    error,
    connect,
    disconnect,
    retry,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook that subscribes to specific event types
 */
export function useDashboardEvent<T extends DashboardEventTypeValue>(
  eventType: T,
  callback: (event: DashboardEvent) => void,
  options?: Omit<UseDashboardLiveOptions, "onEvent">
): UseDashboardLiveResult {
  const handleEvent = useCallback(
    (event: DashboardEvent) => {
      if (event.type === eventType) {
        callback(event);
      }
    },
    [eventType, callback]
  );

  return useDashboardLive({
    ...options,
    onEvent: handleEvent,
  });
}

/**
 * Hook that returns just the connection status
 */
export function useDashboardConnectionStatus(): {
  status: ConnectionStatus;
  isConnected: boolean;
  error: string | null;
} {
  const { status, isConnected, error } = useDashboardLive();
  return { status, isConnected, error };
}

export default useDashboardLive;
