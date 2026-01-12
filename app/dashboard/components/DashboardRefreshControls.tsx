'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Auto-refresh interval options in milliseconds
 */
export type RefreshInterval =
  | 'OFF'
  | '5s'
  | '10s'
  | '30s'
  | '1m'
  | '5m';

/**
 * Refresh state indicating current refresh status
 */
export type RefreshState =
  | 'IDLE'
  | 'REFRESHING'
  | 'SUCCESS'
  | 'ERROR';

/**
 * Configuration for refresh interval options
 */
export interface RefreshIntervalConfig {
  label: string;
  ms: number | null;
  description: string;
}

/**
 * Props for DashboardRefreshControls component
 */
export interface DashboardRefreshControlsProps {
  /** Callback fired when manual refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Whether a refresh is currently in progress */
  isRefreshing?: boolean;
  /** Last refresh timestamp */
  lastRefreshTime?: Date | null;
  /** Current auto-refresh interval */
  autoRefreshInterval?: RefreshInterval;
  /** Callback fired when auto-refresh interval changes */
  onAutoRefreshChange?: (interval: RefreshInterval) => void;
  /** Whether auto-refresh controls should be shown */
  showAutoRefresh?: boolean;
  /** Whether last refresh time should be shown */
  showLastRefresh?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Compact mode - hide labels, show only icons */
  compact?: boolean;
  /** Test ID for component testing */
  testId?: string;
}

/**
 * Configuration for each refresh interval option
 */
export const refreshIntervalConfig: Record<RefreshInterval, RefreshIntervalConfig> = {
  OFF: {
    label: 'Off',
    ms: null,
    description: 'Auto-refresh disabled',
  },
  '5s': {
    label: '5s',
    ms: 5000,
    description: 'Refresh every 5 seconds',
  },
  '10s': {
    label: '10s',
    ms: 10000,
    description: 'Refresh every 10 seconds',
  },
  '30s': {
    label: '30s',
    ms: 30000,
    description: 'Refresh every 30 seconds',
  },
  '1m': {
    label: '1m',
    ms: 60000,
    description: 'Refresh every minute',
  },
  '5m': {
    label: '5m',
    ms: 300000,
    description: 'Refresh every 5 minutes',
  },
};

/**
 * Get configuration for a specific refresh interval
 */
export function getRefreshIntervalConfig(interval: RefreshInterval): RefreshIntervalConfig {
  return refreshIntervalConfig[interval];
}

/**
 * Get all available refresh interval options
 */
export function getRefreshIntervalOptions(): RefreshInterval[] {
  return Object.keys(refreshIntervalConfig) as RefreshInterval[];
}

/**
 * Format a Date to relative time string (e.g., "Just now", "5s ago", "2m ago")
 */
export function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 5) {
    return 'Just now';
  } else if (diffSec < 60) {
    return `${diffSec}s ago`;
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else {
    return date.toLocaleTimeString();
  }
}

/**
 * Format time until next refresh
 */
export function formatTimeUntilRefresh(intervalMs: number | null, lastRefresh: Date | null): string {
  if (!intervalMs || !lastRefresh) return '';

  const now = new Date();
  const nextRefresh = new Date(lastRefresh.getTime() + intervalMs);
  const remainingMs = nextRefresh.getTime() - now.getTime();

  if (remainingMs <= 0) return 'Refreshing...';

  const remainingSec = Math.ceil(remainingMs / 1000);

  if (remainingSec < 60) {
    return `${remainingSec}s`;
  } else {
    return `${Math.ceil(remainingSec / 60)}m`;
  }
}

/**
 * DashboardRefreshControls component
 *
 * Provides manual refresh button, auto-refresh toggle/interval selector,
 * and displays last refresh time.
 */
export default function DashboardRefreshControls({
  onRefresh,
  isRefreshing = false,
  lastRefreshTime = null,
  autoRefreshInterval = 'OFF',
  onAutoRefreshChange,
  showAutoRefresh = true,
  showLastRefresh = true,
  className = '',
  compact = false,
  testId = 'refresh-controls',
}: DashboardRefreshControlsProps) {
  const [refreshState, setRefreshState] = useState<RefreshState>('IDLE');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [displayLastRefresh, setDisplayLastRefresh] = useState(lastRefreshTime);
  const [countdown, setCountdown] = useState<string>('');
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update display time when prop changes
  useEffect(() => {
    setDisplayLastRefresh(lastRefreshTime);
  }, [lastRefreshTime]);

  // Update countdown timer
  useEffect(() => {
    const intervalConfig = refreshIntervalConfig[autoRefreshInterval];

    if (!intervalConfig.ms || !displayLastRefresh) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const formatted = formatTimeUntilRefresh(intervalConfig.ms, displayLastRefresh);
      setCountdown(formatted);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, displayLastRefresh]);

  // Handle auto-refresh timer
  useEffect(() => {
    const intervalConfig = refreshIntervalConfig[autoRefreshInterval];

    // Clear existing timer
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    // Set up new timer if interval is not OFF
    if (intervalConfig.ms && !isRefreshing) {
      autoRefreshTimerRef.current = setInterval(() => {
        handleRefreshClick();
      }, intervalConfig.ms);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshInterval, isRefreshing]);

  // Handle click outside dropdown to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle manual refresh click
  const handleRefreshClick = useCallback(async () => {
    if (isRefreshing || refreshState === 'REFRESHING') return;

    setRefreshState('REFRESHING');

    try {
      await onRefresh();
      setRefreshState('SUCCESS');
      setDisplayLastRefresh(new Date());

      // Reset to IDLE after brief success indication
      setTimeout(() => {
        setRefreshState('IDLE');
      }, 1000);
    } catch {
      setRefreshState('ERROR');

      // Reset to IDLE after error indication
      setTimeout(() => {
        setRefreshState('IDLE');
      }, 2000);
    }
  }, [isRefreshing, refreshState, onRefresh]);

  // Handle interval selection
  const handleIntervalSelect = useCallback(
    (interval: RefreshInterval) => {
      onAutoRefreshChange?.(interval);
      setIsDropdownOpen(false);
    },
    [onAutoRefreshChange]
  );

  // Handle keyboard navigation in dropdown
  const handleDropdownKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsDropdownOpen((prev) => !prev);
      }
    },
    []
  );

  // Handle keyboard navigation for interval options
  const handleOptionKeyDown = useCallback(
    (event: React.KeyboardEvent, interval: RefreshInterval) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleIntervalSelect(interval);
      }
    },
    [handleIntervalSelect]
  );

  // Determine if refresh button should be disabled
  const isDisabled = isRefreshing || refreshState === 'REFRESHING';

  // Get refresh button icon based on state
  const getRefreshIcon = () => {
    if (isDisabled) {
      return (
        <svg
          className="w-4 h-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          data-testid="refresh-icon-spinner"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      );
    }

    if (refreshState === 'SUCCESS') {
      return (
        <svg
          className="w-4 h-4 text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          data-testid="refresh-icon-success"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    if (refreshState === 'ERROR') {
      return (
        <svg
          className="w-4 h-4 text-red-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          data-testid="refresh-icon-error"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    // Default refresh icon
    return (
      <svg
        className="w-4 h-4"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        data-testid="refresh-icon-default"
      >
        <path
          fillRule="evenodd"
          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  // Get auto-refresh indicator icon
  const getAutoRefreshIcon = () => {
    if (autoRefreshInterval === 'OFF') {
      return (
        <svg
          className="w-4 h-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          data-testid="auto-refresh-icon-off"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    return (
      <svg
        className="w-4 h-4 text-green-500"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        data-testid="auto-refresh-icon-on"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
          clipRule="evenodd"
        />
      </svg>
    );
  };

  const intervalConfig = refreshIntervalConfig[autoRefreshInterval];

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      data-testid={testId}
    >
      {/* Manual Refresh Button */}
      <button
        onClick={handleRefreshClick}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md
          font-medium text-sm transition-all duration-200
          ${isDisabled
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 dark:active:bg-blue-900/70'
          }
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
        `}
        title={isDisabled ? 'Refreshing...' : 'Refresh dashboard'}
        aria-label={isDisabled ? 'Refreshing dashboard' : 'Refresh dashboard'}
        data-testid="refresh-button"
      >
        {getRefreshIcon()}
        {!compact && (
          <span data-testid="refresh-button-label">
            {isDisabled ? 'Refreshing' : 'Refresh'}
          </span>
        )}
      </button>

      {/* Auto-Refresh Controls */}
      {showAutoRefresh && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            onKeyDown={handleDropdownKeyDown}
            className={`
              inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md
              text-sm transition-all duration-200
              ${autoRefreshInterval !== 'OFF'
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }
              hover:bg-gray-200 dark:hover:bg-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
            `}
            aria-expanded={isDropdownOpen}
            aria-haspopup="listbox"
            aria-label={`Auto-refresh: ${intervalConfig.label}. ${intervalConfig.description}`}
            data-testid="auto-refresh-toggle"
          >
            {getAutoRefreshIcon()}
            {!compact && (
              <>
                <span data-testid="auto-refresh-label">
                  {autoRefreshInterval === 'OFF' ? 'Auto' : intervalConfig.label}
                </span>
                {autoRefreshInterval !== 'OFF' && countdown && (
                  <span
                    className="text-xs opacity-75"
                    data-testid="auto-refresh-countdown"
                  >
                    ({countdown})
                  </span>
                )}
              </>
            )}
            <svg
              className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className="absolute right-0 mt-1 w-48 py-1 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
              role="listbox"
              aria-label="Auto-refresh interval options"
              data-testid="auto-refresh-dropdown"
            >
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                Auto-refresh Interval
              </div>
              {getRefreshIntervalOptions().map((interval) => {
                const config = refreshIntervalConfig[interval];
                const isSelected = interval === autoRefreshInterval;

                return (
                  <button
                    key={interval}
                    onClick={() => handleIntervalSelect(interval)}
                    onKeyDown={(e) => handleOptionKeyDown(e, interval)}
                    className={`
                      w-full text-left px-3 py-2 text-sm
                      ${isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                      focus:outline-none focus:bg-blue-100 dark:focus:bg-blue-900/50
                    `}
                    role="option"
                    aria-selected={isSelected}
                    data-testid={`interval-option-${interval.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{config.label}</span>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {config.description}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Last Refresh Time */}
      {showLastRefresh && (
        <div
          className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
          title={displayLastRefresh?.toLocaleString() || 'Never refreshed'}
          data-testid="last-refresh-time"
        >
          {!compact && <span className="mr-1">Updated:</span>}
          <span data-testid="last-refresh-value">
            {formatRelativeTime(displayLastRefresh)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Generate mock refresh state for testing
 */
export function generateMockRefreshState(): {
  lastRefreshTime: Date;
  autoRefreshInterval: RefreshInterval;
  isRefreshing: boolean;
} {
  const intervals: RefreshInterval[] = ['OFF', '5s', '10s', '30s', '1m', '5m'];
  const randomIndex = Math.floor(Math.random() * intervals.length);
  const randomInterval = intervals[randomIndex] ?? 'OFF';

  return {
    lastRefreshTime: new Date(Date.now() - Math.floor(Math.random() * 60000)),
    autoRefreshInterval: randomInterval,
    isRefreshing: false,
  };
}
