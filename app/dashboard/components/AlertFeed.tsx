'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Alert types matching the Prisma schema
export type AlertType =
  | 'WHALE_TRADE'
  | 'PRICE_MOVEMENT'
  | 'INSIDER_ACTIVITY'
  | 'FRESH_WALLET'
  | 'WALLET_REACTIVATION'
  | 'COORDINATED_ACTIVITY'
  | 'UNUSUAL_PATTERN'
  | 'MARKET_RESOLVED'
  | 'NEW_MARKET'
  | 'SUSPICIOUS_FUNDING'
  | 'SANCTIONED_ACTIVITY'
  | 'SYSTEM';

export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FeedAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  marketId?: string | null;
  walletId?: string | null;
  walletAddress?: string;
  marketName?: string;
  tags?: string[];
  read: boolean;
  acknowledged: boolean;
  createdAt: Date;
  isNew?: boolean; // For animation purposes
}

export interface AlertFeedProps {
  alerts?: FeedAlert[];
  maxAlerts?: number;
  onAlertClick?: (alert: FeedAlert) => void;
  onMarkRead?: (alertId: string) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  emptyMessage?: string;
  testId?: string;
}

// Helper functions for alert display
export const getAlertTypeIcon = (type: AlertType): string => {
  const icons: Record<AlertType, string> = {
    WHALE_TRADE: '🐋',
    PRICE_MOVEMENT: '📈',
    INSIDER_ACTIVITY: '🔍',
    FRESH_WALLET: '✨',
    WALLET_REACTIVATION: '🔄',
    COORDINATED_ACTIVITY: '🔗',
    UNUSUAL_PATTERN: '⚠️',
    MARKET_RESOLVED: '✅',
    NEW_MARKET: '🆕',
    SUSPICIOUS_FUNDING: '💰',
    SANCTIONED_ACTIVITY: '🚫',
    SYSTEM: '⚙️',
  };
  return icons[type] || '📢';
};

export const getAlertTypeLabel = (type: AlertType): string => {
  const labels: Record<AlertType, string> = {
    WHALE_TRADE: 'Whale Trade',
    PRICE_MOVEMENT: 'Price Movement',
    INSIDER_ACTIVITY: 'Insider Activity',
    FRESH_WALLET: 'Fresh Wallet',
    WALLET_REACTIVATION: 'Reactivation',
    COORDINATED_ACTIVITY: 'Coordinated',
    UNUSUAL_PATTERN: 'Unusual Pattern',
    MARKET_RESOLVED: 'Resolved',
    NEW_MARKET: 'New Market',
    SUSPICIOUS_FUNDING: 'Suspicious Funding',
    SANCTIONED_ACTIVITY: 'Sanctioned',
    SYSTEM: 'System',
  };
  return labels[type] || type;
};

export const getSeverityColor = (severity: AlertSeverity): string => {
  const colors: Record<AlertSeverity, string> = {
    INFO: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return colors[severity] || colors.INFO;
};

export const getSeverityBorderColor = (severity: AlertSeverity): string => {
  const colors: Record<AlertSeverity, string> = {
    INFO: 'border-l-blue-500',
    LOW: 'border-l-green-500',
    MEDIUM: 'border-l-yellow-500',
    HIGH: 'border-l-orange-500',
    CRITICAL: 'border-l-red-500',
  };
  return colors[severity] || colors.INFO;
};

export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return diffSecs <= 1 ? 'just now' : `${diffSecs}s ago`;
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${diffDays}d ago`;
};

// Individual alert item component
function AlertItem({
  alert,
  onClick,
  isAnimating,
}: {
  alert: FeedAlert;
  onClick?: (alert: FeedAlert) => void;
  isAnimating?: boolean;
}) {
  return (
    <div
      className={`
        p-3 border-l-4 rounded-r-md cursor-pointer
        bg-white dark:bg-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-750
        transition-all duration-300 ease-in-out
        ${getSeverityBorderColor(alert.severity)}
        ${!alert.read ? 'shadow-sm' : 'opacity-80'}
        ${isAnimating ? 'animate-slide-in-right' : ''}
      `}
      onClick={() => onClick?.(alert)}
      role="article"
      aria-label={`Alert: ${alert.title}`}
      data-testid={`alert-item-${alert.id}`}
      data-alert-id={alert.id}
      data-alert-type={alert.type}
      data-alert-severity={alert.severity}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className="text-lg flex-shrink-0"
          role="img"
          aria-label={getAlertTypeLabel(alert.type)}
          data-testid="alert-icon"
        >
          {getAlertTypeIcon(alert.type)}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Severity badge */}
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${getSeverityColor(alert.severity)}`}
              data-testid="alert-severity"
            >
              {alert.severity}
            </span>

            {/* Type badge */}
            <span
              className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              data-testid="alert-type"
            >
              {getAlertTypeLabel(alert.type)}
            </span>

            {/* Unread indicator */}
            {!alert.read && (
              <span
                className="w-2 h-2 rounded-full bg-blue-500"
                aria-label="Unread"
                data-testid="unread-indicator"
              />
            )}
          </div>

          {/* Title */}
          <h3
            className={`text-sm font-medium text-gray-900 dark:text-white truncate ${!alert.read ? 'font-semibold' : ''}`}
            data-testid="alert-title"
          >
            {alert.title}
          </h3>

          {/* Message preview */}
          <p
            className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5"
            data-testid="alert-message"
          >
            {alert.message}
          </p>

          {/* Footer with timestamp and context */}
          <div className="flex items-center justify-between mt-2">
            <span
              className="text-xs text-gray-500 dark:text-gray-500"
              data-testid="alert-time"
            >
              {formatTimeAgo(alert.createdAt)}
            </span>

            {/* Market/Wallet context */}
            {(alert.marketName || alert.walletAddress) && (
              <span
                className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[120px]"
                data-testid="alert-context"
              >
                {alert.marketName ||
                  (alert.walletAddress
                    ? `${alert.walletAddress.slice(0, 6)}...${alert.walletAddress.slice(-4)}`
                    : '')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty state component
function EmptyFeed({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-center"
      data-testid="alert-feed-empty"
    >
      <span className="text-4xl mb-3" role="img" aria-label="No alerts">
        🔔
      </span>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

// Loading skeleton for alerts
function AlertSkeleton() {
  return (
    <div className="animate-pulse p-3 border-l-4 border-l-gray-300 dark:border-l-gray-600 rounded-r-md">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1" />
          <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

// Main AlertFeed component
export default function AlertFeed({
  alerts: externalAlerts,
  maxAlerts = 20,
  onAlertClick,
  onMarkRead,
  autoRefresh = false,
  refreshInterval = 30000,
  emptyMessage = 'No alerts to display',
  testId = 'alert-feed',
}: AlertFeedProps) {
  const [alerts, setAlerts] = useState<FeedAlert[]>(externalAlerts || []);
  const [isLoading, setIsLoading] = useState(!externalAlerts);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);
  const prevAlertsRef = useRef<FeedAlert[]>([]);

  // Update alerts when external alerts change
  useEffect(() => {
    if (externalAlerts) {
      // Identify new alerts for animation
      const prevIds = new Set(prevAlertsRef.current.map((a) => a.id));
      const newIds = externalAlerts.filter((a) => !prevIds.has(a.id)).map((a) => a.id);

      if (newIds.length > 0) {
        setAnimatingIds(new Set(newIds));
        // Clear animation flags after animation completes
        setTimeout(() => {
          setAnimatingIds(new Set());
        }, 500);
      }

      setAlerts(externalAlerts.slice(0, maxAlerts));
      prevAlertsRef.current = externalAlerts;
      setIsLoading(false);
    }
  }, [externalAlerts, maxAlerts]);

  // Simulated alert fetching when no external alerts provided
  useEffect(() => {
    if (externalAlerts) return;

    // Simulate initial load with mock data
    const loadMockAlerts = () => {
      const mockAlerts = generateMockAlerts(5);
      setAlerts(mockAlerts);
      prevAlertsRef.current = mockAlerts;
      setIsLoading(false);
    };

    // Simulate loading delay
    const timer = setTimeout(loadMockAlerts, 500);
    return () => clearTimeout(timer);
  }, [externalAlerts]);

  // Auto-refresh for simulated alerts
  useEffect(() => {
    if (!autoRefresh || externalAlerts) return;

    const interval = setInterval(() => {
      // Simulate new alert arriving
      const mockAlerts = generateMockAlerts(1);
      const baseAlert = mockAlerts[0];
      if (!baseAlert) return;

      const newAlert: FeedAlert = {
        ...baseAlert,
        id: `alert-${Date.now()}`,
        createdAt: new Date(),
        isNew: true,
      };

      setAnimatingIds(new Set([newAlert.id]));

      setAlerts((prev) => {
        const updated = [newAlert, ...prev].slice(0, maxAlerts);
        return updated;
      });

      // Clear animation after it completes
      setTimeout(() => {
        setAnimatingIds(new Set());
      }, 500);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, maxAlerts, externalAlerts]);

  const handleAlertClick = useCallback(
    (alert: FeedAlert) => {
      onAlertClick?.(alert);

      // Mark as read locally
      if (!alert.read && onMarkRead) {
        onMarkRead(alert.id);
      }

      // Update local state to mark as read
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, read: true } : a)));
    },
    [onAlertClick, onMarkRead]
  );

  // Calculate stats
  const unreadCount = alerts.filter((a) => !a.read).length;
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <div className="flex flex-col h-full" data-testid={testId}>
      {/* Header stats */}
      <div
        className="flex items-center justify-between px-1 py-2 border-b border-gray-200 dark:border-gray-700"
        data-testid="alert-feed-header"
      >
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              data-testid="unread-count"
            >
              {unreadCount} unread
            </span>
          )}
          {criticalCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              data-testid="critical-count"
            >
              {criticalCount} critical
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="total-count">
          {alerts.length} alerts
        </span>
      </div>

      {/* Alert list with scroll */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-2 py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        data-testid="alert-feed-list"
        role="feed"
        aria-label="Alert feed"
        aria-busy={isLoading}
      >
        {isLoading ? (
          // Loading skeletons
          <>
            <AlertSkeleton />
            <AlertSkeleton />
            <AlertSkeleton />
          </>
        ) : alerts.length === 0 ? (
          // Empty state
          <EmptyFeed message={emptyMessage} />
        ) : (
          // Alert items
          alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onClick={handleAlertClick}
              isAnimating={animatingIds.has(alert.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Helper function to generate mock alerts for demo/testing
export function generateMockAlerts(count: number): FeedAlert[] {
  const types: AlertType[] = [
    'WHALE_TRADE',
    'PRICE_MOVEMENT',
    'INSIDER_ACTIVITY',
    'FRESH_WALLET',
    'COORDINATED_ACTIVITY',
    'UNUSUAL_PATTERN',
  ];

  const severities: AlertSeverity[] = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  const mockTitles: Record<AlertType, string[]> = {
    WHALE_TRADE: [
      'Large trade detected on Trump 2024 market',
      'Whale position opened on Bitcoin ETF approval',
      '$500K trade on Election market',
    ],
    PRICE_MOVEMENT: [
      'Sudden 15% price drop detected',
      'Market probability shifted by 20%',
      'Unusual price volatility detected',
    ],
    INSIDER_ACTIVITY: [
      'Potential insider trading pattern detected',
      'Suspicious pre-announcement activity',
      'Unusual accuracy from new wallet',
    ],
    FRESH_WALLET: [
      'New wallet made large first trade',
      'Fresh wallet trading in niche market',
      'Recently created wallet showing unusual activity',
    ],
    WALLET_REACTIVATION: ['Dormant wallet reactivated with large trade'],
    COORDINATED_ACTIVITY: [
      'Multiple wallets trading in coordination',
      'Potential wash trading detected',
      'Synchronized trading pattern identified',
    ],
    UNUSUAL_PATTERN: [
      'Abnormal trading pattern detected',
      'Statistical anomaly in trade sequence',
      'Unusual timing pattern identified',
    ],
    MARKET_RESOLVED: ['Market resolved with unexpected outcome'],
    NEW_MARKET: ['High-volume trading on new market'],
    SUSPICIOUS_FUNDING: ['Wallet funded from suspicious source'],
    SANCTIONED_ACTIVITY: ['Activity from flagged address detected'],
    SYSTEM: ['System maintenance scheduled'],
  };

  const alerts: FeedAlert[] = [];

  for (let i = 0; i < count; i++) {
    const typeIndex = Math.floor(Math.random() * types.length);
    const severityIndex = Math.floor(Math.random() * severities.length);
    const type: AlertType = types[typeIndex] ?? 'WHALE_TRADE';
    const severity: AlertSeverity = severities[severityIndex] ?? 'INFO';
    const titles = mockTitles[type] ?? ['Alert triggered'];
    const titleIndex = Math.floor(Math.random() * titles.length);
    const title = titles[titleIndex] ?? 'Alert triggered';

    alerts.push({
      id: `mock-alert-${Date.now()}-${i}`,
      type,
      severity,
      title,
      message: `${title}. This alert was generated based on real-time market analysis and pattern detection algorithms.`,
      marketId: Math.random() > 0.3 ? `market-${Math.floor(Math.random() * 1000)}` : null,
      walletId: Math.random() > 0.3 ? `wallet-${Math.floor(Math.random() * 1000)}` : null,
      walletAddress:
        Math.random() > 0.5
          ? `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`
          : undefined,
      marketName: Math.random() > 0.5 ? 'Trump 2024 Election' : undefined,
      tags: ['automated', type.toLowerCase()],
      read: Math.random() > 0.6,
      acknowledged: Math.random() > 0.8,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 3600000)), // Random time in last hour
    });
  }

  // Sort by createdAt descending
  return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
