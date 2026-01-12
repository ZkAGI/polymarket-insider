'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export type TrendDirection = 'up' | 'down' | 'neutral';

export type StatType =
  | 'ACTIVE_ALERTS'
  | 'SUSPICIOUS_WALLETS'
  | 'HOT_MARKETS'
  | 'LARGE_TRADES'
  | 'TOTAL_VOLUME'
  | 'CONNECTED_SOURCES'
  | 'CRITICAL_ALERTS'
  | 'WHALE_TRADES';

export type StatCategory = 'ALERTS' | 'WALLETS' | 'MARKETS' | 'TRADES' | 'SYSTEM';

export interface StatValue {
  id: string;
  type: StatType;
  category: StatCategory;
  label: string;
  value: number;
  previousValue?: number;
  trend?: TrendDirection;
  trendValue?: number;
  trendPercentage?: number;
  unit?: string;
  prefix?: string;
  suffix?: string;
  isHighlighted?: boolean;
  isCritical?: boolean;
  lastUpdated?: Date;
  description?: string;
}

export interface QuickStatsSummaryBarProps {
  stats: StatValue[];
  onStatClick?: (stat: StatValue) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  showTrends?: boolean;
  showLastUpdated?: boolean;
  animateChanges?: boolean;
  maxStats?: number;
  className?: string;
  testId?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const statTypeConfig: Record<
  StatType,
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    category: StatCategory;
    description: string;
  }
> = {
  ACTIVE_ALERTS: {
    label: 'Active Alerts',
    icon: '🚨',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    category: 'ALERTS',
    description: 'Currently active alert signals',
  },
  SUSPICIOUS_WALLETS: {
    label: 'Suspicious Wallets',
    icon: '👛',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    category: 'WALLETS',
    description: 'Wallets flagged as suspicious',
  },
  HOT_MARKETS: {
    label: 'Hot Markets',
    icon: '🔥',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    category: 'MARKETS',
    description: 'Markets with high activity',
  },
  LARGE_TRADES: {
    label: 'Large Trades',
    icon: '💰',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    category: 'TRADES',
    description: 'Trades above whale threshold',
  },
  TOTAL_VOLUME: {
    label: 'Total Volume',
    icon: '📊',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    category: 'TRADES',
    description: 'Total trading volume in 24h',
  },
  CONNECTED_SOURCES: {
    label: 'Connected',
    icon: '🔗',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    category: 'SYSTEM',
    description: 'Active data source connections',
  },
  CRITICAL_ALERTS: {
    label: 'Critical',
    icon: '⚠️',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    category: 'ALERTS',
    description: 'High-priority critical alerts',
  },
  WHALE_TRADES: {
    label: 'Whale Trades',
    icon: '🐋',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    category: 'TRADES',
    description: 'Trades above $100K',
  },
};

export const trendConfig: Record<
  TrendDirection,
  {
    icon: string;
    color: string;
    label: string;
    ariaLabel: string;
  }
> = {
  up: {
    icon: '↑',
    color: 'text-green-600 dark:text-green-400',
    label: 'Increasing',
    ariaLabel: 'trending up',
  },
  down: {
    icon: '↓',
    color: 'text-red-600 dark:text-red-400',
    label: 'Decreasing',
    ariaLabel: 'trending down',
  },
  neutral: {
    icon: '→',
    color: 'text-gray-500 dark:text-gray-400',
    label: 'Stable',
    ariaLabel: 'stable',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getStatTypeConfig(type: StatType) {
  return statTypeConfig[type];
}

export function getTrendConfig(direction: TrendDirection) {
  return trendConfig[direction];
}

export function calculateTrend(
  currentValue: number,
  previousValue: number
): { direction: TrendDirection; percentage: number; absoluteChange: number } {
  if (previousValue === 0) {
    if (currentValue > 0) {
      return { direction: 'up', percentage: 100, absoluteChange: currentValue };
    }
    return { direction: 'neutral', percentage: 0, absoluteChange: 0 };
  }

  const absoluteChange = currentValue - previousValue;
  const percentage = Math.round((absoluteChange / previousValue) * 100);

  if (percentage > 0) {
    return { direction: 'up', percentage, absoluteChange };
  } else if (percentage < 0) {
    return { direction: 'down', percentage: Math.abs(percentage), absoluteChange: Math.abs(absoluteChange) };
  }
  return { direction: 'neutral', percentage: 0, absoluteChange: 0 };
}

export function formatStatValue(value: number, prefix?: string, suffix?: string, unit?: string): string {
  let formatted: string;

  if (value >= 1000000) {
    formatted = `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    formatted = `${(value / 1000).toFixed(1)}K`;
  } else {
    formatted = value.toString();
  }

  // Apply prefix/suffix
  if (prefix) {
    formatted = `${prefix}${formatted}`;
  }
  if (suffix) {
    formatted = `${formatted}${suffix}`;
  }
  if (unit) {
    formatted = `${formatted} ${unit}`;
  }

  return formatted;
}

export function formatTrendValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

export function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 5) {
    return 'Just now';
  } else if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `${days}d ago`;
}

export function generateMockStats(count: number = 8): StatValue[] {
  const types: StatType[] = [
    'ACTIVE_ALERTS',
    'SUSPICIOUS_WALLETS',
    'HOT_MARKETS',
    'LARGE_TRADES',
    'TOTAL_VOLUME',
    'CONNECTED_SOURCES',
    'CRITICAL_ALERTS',
    'WHALE_TRADES',
  ];

  const mockStats: StatValue[] = [];
  const selectedTypes = types.slice(0, Math.min(count, types.length));

  selectedTypes.forEach((type, index) => {
    const config = statTypeConfig[type];
    const baseValue = Math.floor(Math.random() * 100) + 5;
    const previousValue = baseValue + Math.floor(Math.random() * 20) - 10;
    const { direction, percentage, absoluteChange } = calculateTrend(baseValue, previousValue);

    let value = baseValue;
    let prefix: string | undefined;

    // Special handling for volume type
    if (type === 'TOTAL_VOLUME') {
      value = Math.floor(Math.random() * 5000000) + 100000;
      prefix = '$';
    }

    // Special handling for connected sources
    if (type === 'CONNECTED_SOURCES') {
      value = Math.floor(Math.random() * 3) + 3;
    }

    mockStats.push({
      id: `stat-${type.toLowerCase()}-${index}`,
      type,
      category: config.category,
      label: config.label,
      value,
      previousValue,
      trend: direction,
      trendValue: absoluteChange,
      trendPercentage: percentage,
      prefix,
      isHighlighted: type === 'CRITICAL_ALERTS' && value > 0,
      isCritical: type === 'CRITICAL_ALERTS' && value > 5,
      lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 60000)),
      description: config.description,
    });
  });

  return mockStats;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatItemProps {
  stat: StatValue;
  onClick?: (stat: StatValue) => void;
  showTrend?: boolean;
  animateChanges?: boolean;
  testId?: string;
}

const StatItem = memo(function StatItem({
  stat,
  onClick,
  showTrend = true,
  animateChanges = true,
  testId,
}: StatItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(stat.value);

  // Animate on value change
  useEffect(() => {
    if (animateChanges && stat.value !== prevValueRef.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      prevValueRef.current = stat.value;
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stat.value, animateChanges]);

  const config = getStatTypeConfig(stat.type);
  const trendCfg = stat.trend ? getTrendConfig(stat.trend) : null;

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(stat);
    }
  }, [onClick, stat]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && onClick) {
        e.preventDefault();
        onClick(stat);
      }
    },
    [onClick, stat]
  );

  const formattedValue = formatStatValue(stat.value, stat.prefix, stat.suffix, stat.unit);

  return (
    <div
      className={`
        relative flex flex-col items-center sm:items-start p-3 sm:p-4 rounded-lg
        transition-all duration-200
        ${config.bgColor}
        ${stat.isHighlighted ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
        ${stat.isCritical ? 'animate-pulse ring-2 ring-offset-1 ring-red-500' : ''}
        ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : ''}
        ${isAnimating ? 'scale-[1.05] shadow-lg' : ''}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={`${stat.label}: ${formattedValue}${
        trendCfg ? `, ${trendCfg.ariaLabel}` : ''
      }`}
      data-testid={testId}
    >
      {/* Icon and Label Row */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg" role="img" aria-hidden="true">
          {config.icon}
        </span>
        <span
          className={`text-xs uppercase tracking-wider font-medium ${config.color}`}
          data-testid={testId ? `${testId}-label` : undefined}
        >
          {stat.label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <span
          className={`
            text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white
            transition-transform duration-300
            ${isAnimating ? 'scale-110' : ''}
          `}
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {formattedValue}
        </span>

        {/* Trend Indicator */}
        {showTrend && stat.trend && stat.trend !== 'neutral' && trendCfg && (
          <div
            className={`flex items-center gap-0.5 text-sm font-medium ${trendCfg.color}`}
            data-testid={testId ? `${testId}-trend` : undefined}
            aria-label={`${trendCfg.ariaLabel} by ${stat.trendPercentage}%`}
          >
            <span className="font-bold">{trendCfg.icon}</span>
            <span>{stat.trendPercentage}%</span>
          </div>
        )}
      </div>

      {/* Critical Badge */}
      {stat.isCritical && (
        <div
          className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 rounded-full"
          data-testid={testId ? `${testId}-critical-badge` : undefined}
        >
          <span className="text-white text-xs font-bold">!</span>
        </div>
      )}
    </div>
  );
});

interface LoadingSkeletonProps {
  count: number;
}

function LoadingSkeleton({ count }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center sm:items-start p-3 sm:p-4 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="w-20 h-3 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
          <div className="w-16 h-8 bg-gray-300 dark:bg-gray-600 rounded mt-1" />
        </div>
      ))}
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function QuickStatsSummaryBar({
  stats,
  onStatClick,
  onRefresh,
  isLoading = false,
  showTrends = true,
  showLastUpdated = false,
  animateChanges = true,
  maxStats = 8,
  className = '',
  testId = 'quick-stats-bar',
}: QuickStatsSummaryBarProps) {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Update last refresh time on refresh
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
      setLastRefresh(new Date());
    }
  }, [onRefresh]);

  // Limit displayed stats
  const displayedStats = stats.slice(0, maxStats);

  // Calculate total value for certain stats (for summary)
  const totalAlerts = stats
    .filter((s) => s.category === 'ALERTS')
    .reduce((sum, s) => sum + s.value, 0);
  const criticalCount = stats
    .filter((s) => s.isCritical)
    .length;

  return (
    <div
      className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${className}`}
      data-testid={testId}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Stats Grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4"
          data-testid={`${testId}-grid`}
        >
          {isLoading ? (
            <LoadingSkeleton count={Math.min(maxStats, 4)} />
          ) : displayedStats.length > 0 ? (
            displayedStats.map((stat) => (
              <StatItem
                key={stat.id}
                stat={stat}
                onClick={onStatClick}
                showTrend={showTrends}
                animateChanges={animateChanges}
                testId={`${testId}-stat-${stat.type.toLowerCase()}`}
              />
            ))
          ) : (
            <div
              className="col-span-full flex items-center justify-center py-4 text-gray-500 dark:text-gray-400"
              data-testid={`${testId}-empty`}
            >
              No stats available
            </div>
          )}
        </div>

        {/* Footer with summary and refresh */}
        {(showLastUpdated || onRefresh || criticalCount > 0) && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
            data-testid={`${testId}-footer`}
          >
            {/* Summary badges */}
            <div className="flex items-center gap-3">
              {totalAlerts > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full"
                  data-testid={`${testId}-total-alerts-badge`}
                >
                  🚨 {totalAlerts} total alerts
                </span>
              )}
              {criticalCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full animate-pulse"
                  data-testid={`${testId}-critical-badge`}
                >
                  ⚠️ {criticalCount} critical
                </span>
              )}
            </div>

            {/* Right side: last updated and refresh */}
            <div className="flex items-center gap-3">
              {showLastUpdated && (
                <span
                  className="text-xs text-gray-500 dark:text-gray-400"
                  data-testid={`${testId}-last-updated`}
                >
                  Updated {formatLastUpdated(lastRefresh)}
                </span>
              )}
              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className={`
                    inline-flex items-center gap-1 px-2 py-1 text-xs font-medium
                    bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
                    rounded hover:bg-gray-200 dark:hover:bg-gray-600
                    transition-colors duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                  aria-label="Refresh stats"
                  data-testid={`${testId}-refresh-button`}
                >
                  <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                  Refresh
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(QuickStatsSummaryBar);
