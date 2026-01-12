'use client';

import { useState, useEffect, useCallback } from 'react';

// Signal types representing different detection categories
export type SignalType =
  | 'FRESH_WALLET'
  | 'WHALE_ACTIVITY'
  | 'COORDINATED_TRADING'
  | 'UNUSUAL_VOLUME'
  | 'PRICE_ANOMALY'
  | 'INSIDER_PATTERN'
  | 'SYBIL_DETECTION'
  | 'NICHE_MARKET';

// Signal status for severity-based display
export type SignalStatus = 'ACTIVE' | 'MONITORING' | 'RESOLVED';

// Individual signal count data
export interface SignalCount {
  type: SignalType;
  count: number;
  previousCount?: number;
  status: SignalStatus;
  lastUpdated: Date;
}

// Props for the ActiveSignalsCounter component
export interface ActiveSignalsCounterProps {
  signals?: SignalCount[];
  onSignalClick?: (signalType: SignalType) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showTrends?: boolean;
  testId?: string;
}

// Signal type configuration with labels, icons, and colors
export const signalConfig: Record<
  SignalType,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  FRESH_WALLET: {
    label: 'Fresh Wallets',
    icon: '✨',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  WHALE_ACTIVITY: {
    label: 'Whale Activity',
    icon: '🐋',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  COORDINATED_TRADING: {
    label: 'Coordinated',
    icon: '🔗',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  UNUSUAL_VOLUME: {
    label: 'Volume Spike',
    icon: '📊',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  PRICE_ANOMALY: {
    label: 'Price Anomaly',
    icon: '📈',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  INSIDER_PATTERN: {
    label: 'Insider Pattern',
    icon: '🔍',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  SYBIL_DETECTION: {
    label: 'Sybil Attack',
    icon: '👥',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
  NICHE_MARKET: {
    label: 'Niche Market',
    icon: '🎯',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
  },
};

// Get signal configuration
export const getSignalConfig = (type: SignalType) => {
  return signalConfig[type] || signalConfig.FRESH_WALLET;
};

// Get status indicator color
export const getStatusColor = (status: SignalStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-500';
    case 'MONITORING':
      return 'bg-yellow-500';
    case 'RESOLVED':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
};

// Calculate trend direction
export const getTrendIndicator = (
  current: number,
  previous?: number
): { direction: 'up' | 'down' | 'stable'; change: number } => {
  if (previous === undefined) {
    return { direction: 'stable', change: 0 };
  }
  const change = current - previous;
  if (change > 0) {
    return { direction: 'up', change };
  } else if (change < 0) {
    return { direction: 'down', change: Math.abs(change) };
  }
  return { direction: 'stable', change: 0 };
};

// Individual signal item component
function SignalItem({
  signal,
  onClick,
  showTrend,
  isAnimating,
}: {
  signal: SignalCount;
  onClick?: (type: SignalType) => void;
  showTrend?: boolean;
  isAnimating?: boolean;
}) {
  const config = getSignalConfig(signal.type);
  const trend = getTrendIndicator(signal.count, signal.previousCount);

  return (
    <div
      className={`
        flex items-center justify-between p-2 rounded-lg
        cursor-pointer transition-all duration-200
        hover:opacity-80 hover:scale-[1.02]
        ${config.bgColor}
        ${isAnimating ? 'animate-pulse' : ''}
      `}
      onClick={() => onClick?.(signal.type)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(signal.type);
        }
      }}
      aria-label={`${config.label}: ${signal.count} active signals`}
      data-testid={`signal-item-${signal.type.toLowerCase().replace(/_/g, '-')}`}
      data-signal-type={signal.type}
      data-signal-count={signal.count}
    >
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <span
          className={`w-2 h-2 rounded-full ${getStatusColor(signal.status)}`}
          aria-label={`Status: ${signal.status.toLowerCase()}`}
          data-testid="signal-status-indicator"
        />

        {/* Icon */}
        <span
          className="text-sm"
          role="img"
          aria-hidden="true"
          data-testid="signal-icon"
        >
          {config.icon}
        </span>

        {/* Label */}
        <span
          className={`text-xs font-medium ${config.color}`}
          data-testid="signal-label"
        >
          {config.label}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Trend indicator */}
        {showTrend && trend.direction !== 'stable' && (
          <span
            className={`text-xs ${
              trend.direction === 'up'
                ? 'text-red-500'
                : 'text-green-500'
            }`}
            aria-label={`${trend.direction === 'up' ? 'Increased' : 'Decreased'} by ${trend.change}`}
            data-testid="signal-trend"
            data-trend-direction={trend.direction}
            data-trend-change={trend.change}
          >
            {trend.direction === 'up' ? '↑' : '↓'}
            {trend.change}
          </span>
        )}

        {/* Count badge */}
        <span
          className={`
            min-w-[24px] h-6 px-1.5
            flex items-center justify-center
            text-xs font-bold rounded-md
            ${signal.count > 0 ? config.color : 'text-gray-400 dark:text-gray-500'}
            bg-white dark:bg-gray-800
            shadow-sm
          `}
          data-testid="signal-count"
        >
          {signal.count}
        </span>
      </div>
    </div>
  );
}

// Summary stats component
function SignalSummary({ signals }: { signals: SignalCount[] }) {
  const totalActive = signals.reduce((sum, s) => sum + s.count, 0);
  const activeTypes = signals.filter((s) => s.count > 0).length;
  const criticalCount = signals.filter(
    (s) => s.count > 0 && (s.type === 'INSIDER_PATTERN' || s.type === 'SYBIL_DETECTION')
  ).length;

  return (
    <div
      className="flex items-center justify-between px-1 py-2 border-b border-gray-200 dark:border-gray-700"
      data-testid="signals-summary"
    >
      <div className="flex items-center gap-3">
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          data-testid="total-signals"
        >
          {totalActive} total
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          data-testid="active-types"
        >
          {activeTypes} types
        </span>
        {criticalCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse"
            data-testid="critical-signals"
          >
            {criticalCount} critical
          </span>
        )}
      </div>
    </div>
  );
}

// Loading skeleton component
function SignalSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array(4)
        .fill(null)
        .map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
              <div className="w-4 h-4 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-20 h-3 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="w-6 h-6 rounded bg-gray-300 dark:bg-gray-600" />
          </div>
        ))}
    </div>
  );
}

// Empty state component
function EmptySignals() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-center"
      data-testid="signals-empty"
    >
      <span className="text-4xl mb-3" role="img" aria-label="No signals">
        📡
      </span>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No active signals detected
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Monitoring all detection channels
      </p>
    </div>
  );
}

// Default signal types with initial zero counts
const defaultSignalTypes: SignalType[] = [
  'FRESH_WALLET',
  'WHALE_ACTIVITY',
  'COORDINATED_TRADING',
  'UNUSUAL_VOLUME',
  'PRICE_ANOMALY',
  'INSIDER_PATTERN',
  'SYBIL_DETECTION',
  'NICHE_MARKET',
];

// Generate mock signals for demo/testing
export function generateMockSignals(): SignalCount[] {
  return defaultSignalTypes.map((type) => ({
    type,
    count: Math.floor(Math.random() * 15),
    previousCount: Math.floor(Math.random() * 15),
    status: (['ACTIVE', 'MONITORING', 'RESOLVED'] as SignalStatus[])[
      Math.floor(Math.random() * 3)
    ] as SignalStatus,
    lastUpdated: new Date(),
  }));
}

// Main ActiveSignalsCounter component
export default function ActiveSignalsCounter({
  signals: externalSignals,
  onSignalClick,
  autoRefresh = false,
  refreshInterval = 10000,
  showTrends = true,
  testId = 'active-signals-counter',
}: ActiveSignalsCounterProps) {
  const [signals, setSignals] = useState<SignalCount[]>(externalSignals || []);
  const [isLoading, setIsLoading] = useState(!externalSignals);
  const [animatingTypes, setAnimatingTypes] = useState<Set<SignalType>>(new Set());

  // Update signals when external signals change
  useEffect(() => {
    if (externalSignals) {
      // Track which signals changed for animation
      const prevSignalMap = new Map(signals.map((s) => [s.type, s.count]));
      const changedTypes = externalSignals
        .filter((s) => prevSignalMap.get(s.type) !== s.count)
        .map((s) => s.type);

      if (changedTypes.length > 0) {
        setAnimatingTypes(new Set(changedTypes));
        setTimeout(() => setAnimatingTypes(new Set()), 500);
      }

      setSignals(externalSignals);
      setIsLoading(false);
    }
  }, [externalSignals, signals]);

  // Load mock data if no external signals provided
  useEffect(() => {
    if (externalSignals) return;

    const loadMockSignals = () => {
      const mockSignals = generateMockSignals();
      setSignals(mockSignals);
      setIsLoading(false);
    };

    const timer = setTimeout(loadMockSignals, 500);
    return () => clearTimeout(timer);
  }, [externalSignals]);

  // Auto-refresh for simulated signals
  useEffect(() => {
    if (!autoRefresh || externalSignals) return;

    const interval = setInterval(() => {
      setSignals((prev) => {
        const updated = prev.map((signal) => {
          // Randomly update some counts
          if (Math.random() > 0.7) {
            const change = Math.floor(Math.random() * 5) - 2;
            const newCount = Math.max(0, signal.count + change);

            if (newCount !== signal.count) {
              setAnimatingTypes((types) => new Set(types).add(signal.type));
              setTimeout(
                () =>
                  setAnimatingTypes((types) => {
                    const newTypes = new Set(types);
                    newTypes.delete(signal.type);
                    return newTypes;
                  }),
                500
              );
            }

            return {
              ...signal,
              previousCount: signal.count,
              count: newCount,
              lastUpdated: new Date(),
            };
          }
          return signal;
        });
        return updated;
      });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, externalSignals]);

  const handleSignalClick = useCallback(
    (type: SignalType) => {
      onSignalClick?.(type);
    },
    [onSignalClick]
  );

  // Sort signals: active counts first, then by type
  const sortedSignals = [...signals].sort((a, b) => {
    if (a.count > 0 && b.count === 0) return -1;
    if (a.count === 0 && b.count > 0) return 1;
    return b.count - a.count;
  });

  const hasActiveSignals = signals.some((s) => s.count > 0);

  return (
    <div className="flex flex-col h-full" data-testid={testId}>
      {/* Summary header */}
      {!isLoading && signals.length > 0 && <SignalSummary signals={signals} />}

      {/* Signal list */}
      <div
        className="flex-1 overflow-y-auto space-y-2 py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        data-testid="signals-list"
        role="list"
        aria-label="Active signals by type"
      >
        {isLoading ? (
          <SignalSkeleton />
        ) : !hasActiveSignals ? (
          <EmptySignals />
        ) : (
          sortedSignals.map((signal) => (
            <SignalItem
              key={signal.type}
              signal={signal}
              onClick={handleSignalClick}
              showTrend={showTrends}
              isAnimating={animatingTypes.has(signal.type)}
            />
          ))
        )}
      </div>
    </div>
  );
}
