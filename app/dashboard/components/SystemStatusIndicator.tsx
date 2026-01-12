'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Types of data sources that can be monitored
 */
export type DataSourceType =
  | 'GAMMA_API'
  | 'CLOB_API'
  | 'WEBSOCKET'
  | 'POLYGON_RPC'
  | 'DATABASE';

/**
 * Connection status for a data source
 */
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'DEGRADED' | 'UNKNOWN';

/**
 * Individual data source status
 */
export interface DataSourceStatus {
  type: DataSourceType;
  status: ConnectionStatus;
  latency?: number; // in ms
  lastChecked: Date;
  lastConnected?: Date;
  errorMessage?: string;
  retryCount?: number;
}

/**
 * Overall system health status
 */
export type SystemHealth = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE';

/**
 * Props for SystemStatusIndicator component
 */
export interface SystemStatusIndicatorProps {
  /** List of data source statuses */
  sources?: DataSourceStatus[];
  /** Called when a source is clicked */
  onSourceClick?: (source: DataSourceStatus) => void;
  /** Called when system health changes */
  onHealthChange?: (health: SystemHealth) => void;
  /** Show expanded view with all sources */
  expanded?: boolean;
  /** Toggle expanded view */
  onToggleExpanded?: () => void;
  /** Show latency information */
  showLatency?: boolean;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Configuration for each data source type
 */
export const dataSourceConfig: Record<
  DataSourceType,
  { label: string; icon: string; description: string }
> = {
  GAMMA_API: {
    label: 'Gamma API',
    icon: '📊',
    description: 'Market data and prices',
  },
  CLOB_API: {
    label: 'CLOB API',
    icon: '📈',
    description: 'Order book and trades',
  },
  WEBSOCKET: {
    label: 'WebSocket',
    icon: '🔌',
    description: 'Real-time updates',
  },
  POLYGON_RPC: {
    label: 'Polygon RPC',
    icon: '⛓️',
    description: 'Blockchain data',
  },
  DATABASE: {
    label: 'Database',
    icon: '🗄️',
    description: 'Local data storage',
  },
};

/**
 * Configuration for connection statuses
 */
export const statusConfig: Record<
  ConnectionStatus,
  { label: string; color: string; bgColor: string; dotColor: string; animate?: boolean }
> = {
  CONNECTED: {
    label: 'Connected',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    dotColor: 'bg-green-500',
  },
  DISCONNECTED: {
    label: 'Disconnected',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    dotColor: 'bg-red-500',
  },
  CONNECTING: {
    label: 'Connecting',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    dotColor: 'bg-yellow-500',
    animate: true,
  },
  DEGRADED: {
    label: 'Degraded',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    dotColor: 'bg-orange-500',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    dotColor: 'bg-gray-500',
  },
};

/**
 * Configuration for system health levels
 */
export const healthConfig: Record<
  SystemHealth,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  HEALTHY: {
    label: 'All Systems Operational',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '✅',
  },
  DEGRADED: {
    label: 'Some Services Degraded',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: '⚠️',
  },
  CRITICAL: {
    label: 'Critical Issues',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '🔴',
  },
  OFFLINE: {
    label: 'System Offline',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '❌',
  },
};

/**
 * Get data source configuration
 */
export function getDataSourceConfig(type: DataSourceType) {
  return dataSourceConfig[type];
}

/**
 * Get status configuration
 */
export function getStatusConfig(status: ConnectionStatus) {
  return statusConfig[status];
}

/**
 * Get health configuration
 */
export function getHealthConfig(health: SystemHealth) {
  return healthConfig[health];
}

/**
 * Calculate system health from source statuses
 */
export function calculateSystemHealth(sources: DataSourceStatus[]): SystemHealth {
  if (sources.length === 0) return 'UNKNOWN' as SystemHealth;

  const connectedCount = sources.filter((s) => s.status === 'CONNECTED').length;
  const disconnectedCount = sources.filter((s) => s.status === 'DISCONNECTED').length;
  const criticalSources = ['GAMMA_API', 'CLOB_API', 'WEBSOCKET'];
  const criticalDisconnected = sources.filter(
    (s) => criticalSources.includes(s.type) && s.status === 'DISCONNECTED'
  ).length;

  if (disconnectedCount === sources.length) return 'OFFLINE';
  if (criticalDisconnected > 0 || disconnectedCount >= sources.length / 2) return 'CRITICAL';
  if (connectedCount === sources.length) return 'HEALTHY';
  return 'DEGRADED';
}

/**
 * Format latency for display
 */
export function formatLatency(latency?: number): string {
  if (latency === undefined || latency === null) return '--';
  if (latency < 1) return '<1ms';
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
}

/**
 * Get latency indicator color
 */
export function getLatencyColor(latency?: number): string {
  if (latency === undefined) return 'text-gray-400';
  if (latency < 100) return 'text-green-500';
  if (latency < 500) return 'text-yellow-500';
  return 'text-red-500';
}

/**
 * Format time since last check
 */
export function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Generate mock data source statuses for testing/demo
 */
export function generateMockSources(): DataSourceStatus[] {
  const types: DataSourceType[] = ['GAMMA_API', 'CLOB_API', 'WEBSOCKET', 'POLYGON_RPC', 'DATABASE'];
  const statuses: ConnectionStatus[] = ['CONNECTED', 'CONNECTED', 'CONNECTED', 'DEGRADED', 'DISCONNECTED'];

  return types.map((type) => {
    const status = Math.random() > 0.2 ? 'CONNECTED' : statuses[Math.floor(Math.random() * statuses.length)]!;
    const latency = status === 'CONNECTED' ? Math.floor(Math.random() * 300) + 20 : undefined;

    return {
      type,
      status,
      latency,
      lastChecked: new Date(Date.now() - Math.floor(Math.random() * 30000)),
      lastConnected: status === 'CONNECTED' ? new Date() : new Date(Date.now() - Math.floor(Math.random() * 3600000)),
      errorMessage: status === 'DISCONNECTED' ? 'Connection timeout' : undefined,
      retryCount: status === 'DISCONNECTED' ? Math.floor(Math.random() * 5) : 0,
    };
  });
}

/**
 * Data source item component
 */
function DataSourceItem({
  source,
  onClick,
  showLatency,
  testId,
}: {
  source: DataSourceStatus;
  onClick?: (source: DataSourceStatus) => void;
  showLatency?: boolean;
  testId?: string;
}) {
  const sourceConfig = getDataSourceConfig(source.type);
  const statusCfg = getStatusConfig(source.status);

  const handleClick = () => {
    onClick?.(source);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(source);
    }
  };

  return (
    <div
      data-testid={testId || `source-item-${source.type.toLowerCase().replace(/_/g, '-')}`}
      data-source-type={source.type}
      data-source-status={source.status}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        flex items-center justify-between p-3 rounded-lg cursor-pointer
        transition-all duration-200 hover:scale-[1.02]
        ${statusCfg.bgColor}
        border border-transparent hover:border-gray-200 dark:hover:border-gray-600
      `}
      aria-label={`${sourceConfig.label}: ${statusCfg.label}${source.latency ? `, latency ${formatLatency(source.latency)}` : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Status indicator dot */}
        <div
          data-testid="source-status-indicator"
          className={`
            w-2.5 h-2.5 rounded-full
            ${statusCfg.dotColor}
            ${statusCfg.animate ? 'animate-pulse' : ''}
          `}
        />

        {/* Icon and label */}
        <div className="flex items-center gap-2">
          <span
            role="img"
            aria-hidden="true"
            data-testid="source-icon"
            className="text-base"
          >
            {sourceConfig.icon}
          </span>
          <div>
            <span
              data-testid="source-label"
              className={`text-sm font-medium ${statusCfg.color}`}
            >
              {sourceConfig.label}
            </span>
            <p
              data-testid="source-description"
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              {sourceConfig.description}
            </p>
          </div>
        </div>
      </div>

      {/* Right side: status and latency */}
      <div className="flex items-center gap-3">
        {showLatency && source.latency !== undefined && (
          <span
            data-testid="source-latency"
            className={`text-xs font-mono ${getLatencyColor(source.latency)}`}
          >
            {formatLatency(source.latency)}
          </span>
        )}
        <span
          data-testid="source-status-label"
          className={`text-xs font-medium ${statusCfg.color}`}
        >
          {statusCfg.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact status indicator for header
 */
function CompactIndicator({
  health,
  connectedCount,
  totalCount,
  onClick,
  testId,
}: {
  health: SystemHealth;
  connectedCount: number;
  totalCount: number;
  onClick?: () => void;
  testId?: string;
}) {
  const healthCfg = getHealthConfig(health);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      data-testid={testId || 'compact-status-indicator'}
      data-health={health}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
        transition-all duration-200 hover:scale-[1.02]
        ${healthCfg.bgColor}
      `}
      aria-label={`System status: ${healthCfg.label}, ${connectedCount} of ${totalCount} services connected`}
    >
      <span role="img" aria-hidden="true" className="text-sm">
        {healthCfg.icon}
      </span>
      <span className={`text-sm font-medium ${healthCfg.color}`}>
        {connectedCount}/{totalCount}
      </span>
    </div>
  );
}

/**
 * SystemStatusIndicator Component
 *
 * Displays the connection status for all data sources with health overview.
 * Shows compact view by default with expandable detailed view.
 */
export default function SystemStatusIndicator({
  sources = [],
  onSourceClick,
  onHealthChange,
  expanded = false,
  onToggleExpanded,
  showLatency = true,
  refreshInterval = 0,
  testId = 'system-status-indicator',
}: SystemStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [previousHealth, setPreviousHealth] = useState<SystemHealth | null>(null);

  // Calculate system health
  const systemHealth = calculateSystemHealth(sources);
  const connectedCount = sources.filter((s) => s.status === 'CONNECTED').length;
  const degradedCount = sources.filter((s) => s.status === 'DEGRADED').length;
  const disconnectedCount = sources.filter((s) => s.status === 'DISCONNECTED').length;

  // Notify health changes
  useEffect(() => {
    if (previousHealth !== null && previousHealth !== systemHealth) {
      onHealthChange?.(systemHealth);
    }
    setPreviousHealth(systemHealth);
  }, [systemHealth, previousHealth, onHealthChange]);

  // Handle toggle expanded
  const handleToggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
    onToggleExpanded?.();
  }, [onToggleExpanded]);

  // Auto-refresh tracking
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Sort sources: disconnected first, then degraded, then by type
  const sortedSources = [...sources].sort((a, b) => {
    const statusOrder: Record<ConnectionStatus, number> = {
      DISCONNECTED: 0,
      DEGRADED: 1,
      CONNECTING: 2,
      CONNECTED: 3,
      UNKNOWN: 4,
    };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // Empty state
  if (sources.length === 0) {
    return (
      <div
        data-testid={testId}
        className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800"
      >
        <p
          data-testid="status-empty"
          className="text-sm text-gray-500 dark:text-gray-400 text-center"
        >
          No data sources configured
        </p>
      </div>
    );
  }

  const healthCfg = getHealthConfig(systemHealth);

  return (
    <div
      data-testid={testId}
      data-system-health={systemHealth}
      className="space-y-3"
    >
      {/* Header with compact indicator and expand button */}
      <div className="flex items-center justify-between">
        <CompactIndicator
          health={systemHealth}
          connectedCount={connectedCount}
          totalCount={sources.length}
          onClick={handleToggleExpanded}
          testId="status-compact"
        />

        <button
          data-testid="expand-toggle"
          onClick={handleToggleExpanded}
          className={`
            p-1.5 rounded-lg transition-colors
            text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
            hover:bg-gray-100 dark:hover:bg-gray-700
          `}
          aria-label={isExpanded ? 'Collapse status details' : 'Expand status details'}
          aria-expanded={isExpanded}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div
          data-testid="expanded-view"
          className="space-y-4 animate-fadeIn"
        >
          {/* Health summary */}
          <div
            data-testid="health-summary"
            className={`
              flex items-center justify-between p-3 rounded-lg
              ${healthCfg.bgColor}
            `}
          >
            <div className="flex items-center gap-2">
              <span role="img" aria-hidden="true" className="text-lg">
                {healthCfg.icon}
              </span>
              <span className={`text-sm font-medium ${healthCfg.color}`}>
                {healthCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span data-testid="connected-count">{connectedCount} connected</span>
              {degradedCount > 0 && (
                <span data-testid="degraded-count" className="text-orange-500">
                  {degradedCount} degraded
                </span>
              )}
              {disconnectedCount > 0 && (
                <span data-testid="disconnected-count" className="text-red-500">
                  {disconnectedCount} offline
                </span>
              )}
            </div>
          </div>

          {/* Data sources list */}
          <div
            data-testid="sources-list"
            role="list"
            aria-label="Data source connection statuses"
            className="space-y-2"
          >
            {sortedSources.map((source) => (
              <DataSourceItem
                key={source.type}
                source={source}
                onClick={onSourceClick}
                showLatency={showLatency}
              />
            ))}
          </div>

          {/* Last checked timestamp */}
          <div
            data-testid="last-refresh"
            className="flex items-center justify-end text-xs text-gray-400 dark:text-gray-500"
          >
            <span>Last updated: {formatTimeSince(lastRefresh)}</span>
          </div>

          {/* Alerts for critical issues */}
          {systemHealth === 'CRITICAL' && (
            <div
              data-testid="critical-alert"
              role="alert"
              className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
            >
              <div className="flex items-center gap-2">
                <span role="img" aria-hidden="true" className="text-lg">
                  🚨
                </span>
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Critical services are offline. Some features may be unavailable.
                </span>
              </div>
            </div>
          )}

          {systemHealth === 'OFFLINE' && (
            <div
              data-testid="offline-alert"
              role="alert"
              className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
            >
              <div className="flex items-center gap-2">
                <span role="img" aria-hidden="true" className="text-lg">
                  ❌
                </span>
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  All services are offline. Please check your connection.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
