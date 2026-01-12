'use client';

import { useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  FeedAlert,
  AlertType,
  AlertSeverity,
  getAlertTypeIcon,
  getAlertTypeLabel,
  getSeverityColor,
  getSeverityBorderColor,
} from '../../dashboard/components/AlertFeed';

// Re-export types for external use
export type { FeedAlert, AlertType, AlertSeverity } from '../../dashboard/components/AlertFeed';

// Action types for alert
export type AlertAction = 'DISMISS' | 'MARK_READ' | 'MARK_UNREAD' | 'ACKNOWLEDGE' | 'INVESTIGATE';

// Alert detail modal props
export interface AlertDetailModalProps {
  alert: FeedAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: AlertAction, alert: FeedAlert) => void;
  onNavigateToMarket?: (marketId: string) => void;
  onNavigateToWallet?: (walletAddress: string) => void;
  testId?: string;
}

// Format date for full display
export function formatDetailDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// Format relative time with more detail
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return diffSecs <= 1 ? 'Just now' : `${diffSecs} seconds ago`;
  }
  if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  return formatDetailDate(date);
}

// Get severity description
export function getSeverityDescription(severity: AlertSeverity): string {
  const descriptions: Record<AlertSeverity, string> = {
    INFO: 'Informational alert for general awareness',
    LOW: 'Low priority alert that may require attention',
    MEDIUM: 'Medium priority alert requiring review',
    HIGH: 'High priority alert requiring prompt attention',
    CRITICAL: 'Critical alert requiring immediate action',
  };
  return descriptions[severity];
}

// Get alert type description
export function getAlertTypeDescription(type: AlertType): string {
  const descriptions: Record<AlertType, string> = {
    WHALE_TRADE: 'Large trade detected that may impact market liquidity or pricing',
    PRICE_MOVEMENT: 'Significant price or probability change detected in the market',
    INSIDER_ACTIVITY: 'Trading pattern suggests potential access to non-public information',
    FRESH_WALLET: 'Activity from a newly created or first-time trading wallet',
    WALLET_REACTIVATION: 'Previously dormant wallet has resumed trading activity',
    COORDINATED_ACTIVITY: 'Multiple wallets appear to be trading in coordination',
    UNUSUAL_PATTERN: 'Statistical anomaly detected in trading behavior',
    MARKET_RESOLVED: 'A market has been resolved with a final outcome',
    NEW_MARKET: 'Notable activity on a newly created market',
    SUSPICIOUS_FUNDING: 'Wallet received funds from a suspicious or flagged source',
    SANCTIONED_ACTIVITY: 'Activity detected from an address on sanction lists',
    SYSTEM: 'System-generated notification or maintenance alert',
  };
  return descriptions[type];
}

// Get action button config
interface ActionButtonConfig {
  label: string;
  icon: string;
  action: AlertAction;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function getActionButtons(alert: FeedAlert): ActionButtonConfig[] {
  const buttons: ActionButtonConfig[] = [];

  // Mark read/unread
  if (alert.read) {
    buttons.push({
      label: 'Mark as Unread',
      icon: '📬',
      action: 'MARK_UNREAD',
      variant: 'secondary',
    });
  } else {
    buttons.push({
      label: 'Mark as Read',
      icon: '📭',
      action: 'MARK_READ',
      variant: 'secondary',
    });
  }

  // Acknowledge (if not already)
  if (!alert.acknowledged) {
    buttons.push({
      label: 'Acknowledge',
      icon: '✓',
      action: 'ACKNOWLEDGE',
      variant: 'primary',
    });
  }

  // Dismiss
  buttons.push({
    label: 'Dismiss',
    icon: '✕',
    action: 'DISMISS',
    variant: 'danger',
  });

  return buttons;
}

// Truncate wallet address for display
export function truncateAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Detail section component
function DetailSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h4>
      <div>{children}</div>
    </div>
  );
}

// Main AlertDetailModal component
export default function AlertDetailModal({
  alert,
  isOpen,
  onClose,
  onAction,
  onNavigateToMarket,
  onNavigateToWallet,
  testId = 'alert-detail-modal',
}: AlertDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Focus trap and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle action button click
  const handleAction = useCallback(
    (action: AlertAction) => {
      if (alert) {
        onAction?.(action, alert);
        if (action === 'DISMISS') {
          onClose();
        }
      }
    },
    [alert, onAction, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle wallet copy
  const handleCopyWallet = useCallback(async () => {
    if (alert?.walletAddress) {
      await copyToClipboard(alert.walletAddress);
    }
  }, [alert?.walletAddress]);

  // Handle wallet navigation
  const handleWalletClick = useCallback(() => {
    if (alert?.walletAddress) {
      onNavigateToWallet?.(alert.walletAddress);
    }
  }, [alert?.walletAddress, onNavigateToWallet]);

  // Handle market navigation
  const handleMarketClick = useCallback(() => {
    if (alert?.marketId) {
      onNavigateToMarket?.(alert.marketId);
    }
  }, [alert?.marketId, onNavigateToMarket]);

  // Don't render if not open or no alert
  if (!isOpen || !alert) {
    return null;
  }

  const actionButtons = getActionButtons(alert);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      data-testid={testId}
    >
      <div
        ref={modalRef}
        className={`
          relative w-full max-w-2xl max-h-[90vh] overflow-hidden
          bg-white dark:bg-gray-800 rounded-xl shadow-2xl
          border-l-4 ${getSeverityBorderColor(alert.severity)}
          animate-modal-enter
        `}
        data-testid="modal-content"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Type icon */}
            <span
              className="text-3xl flex-shrink-0"
              role="img"
              aria-label={getAlertTypeLabel(alert.type)}
              data-testid="modal-icon"
            >
              {getAlertTypeIcon(alert.type)}
            </span>

            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex items-center flex-wrap gap-2 mb-2">
                {/* Severity badge */}
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getSeverityColor(alert.severity)}`}
                  data-testid="modal-severity"
                >
                  {alert.severity}
                </span>

                {/* Type badge */}
                <span
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  data-testid="modal-type"
                >
                  {getAlertTypeLabel(alert.type)}
                </span>

                {/* Read/Unread status */}
                {!alert.read && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    data-testid="modal-unread"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Unread
                  </span>
                )}

                {/* Acknowledged status */}
                {alert.acknowledged && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    data-testid="modal-acknowledged"
                  >
                    Acknowledged
                  </span>
                )}
              </div>

              {/* Title */}
              <h2
                id="modal-title"
                className="text-xl font-bold text-gray-900 dark:text-white"
                data-testid="modal-title"
              >
                {alert.title}
              </h2>
            </div>
          </div>

          {/* Close button */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close modal"
            data-testid="modal-close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6 space-y-6" data-testid="modal-body">
          {/* Message */}
          <DetailSection title="Message" testId="modal-message-section">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap" data-testid="modal-message">
              {alert.message}
            </p>
          </DetailSection>

          {/* Alert Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Type Info */}
            <DetailSection title="Alert Type" testId="modal-type-section">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getAlertTypeIcon(alert.type)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {getAlertTypeLabel(alert.type)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getAlertTypeDescription(alert.type)}
                </p>
              </div>
            </DetailSection>

            {/* Severity Info */}
            <DetailSection title="Severity Level" testId="modal-severity-section">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-red-500'
                        : alert.severity === 'HIGH'
                          ? 'bg-orange-500'
                          : alert.severity === 'MEDIUM'
                            ? 'bg-yellow-500'
                            : alert.severity === 'LOW'
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                    }`}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">{alert.severity}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getSeverityDescription(alert.severity)}
                </p>
              </div>
            </DetailSection>
          </div>

          {/* Timestamps */}
          <DetailSection title="Timestamps" testId="modal-timestamps-section">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white" data-testid="modal-created-at">
                  {formatRelativeTime(alert.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Full timestamp</span>
                <span
                  className="text-xs text-gray-600 dark:text-gray-400 font-mono"
                  data-testid="modal-full-timestamp"
                >
                  {formatDetailDate(alert.createdAt)}
                </span>
              </div>
            </div>
          </DetailSection>

          {/* Related Data */}
          {(alert.marketId || alert.marketName || alert.walletId || alert.walletAddress) && (
            <DetailSection title="Related Data" testId="modal-related-section">
              <div className="space-y-3">
                {/* Market info */}
                {(alert.marketId || alert.marketName) && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">📊</span>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Market</span>
                          <span
                            className="text-sm font-medium text-gray-900 dark:text-white truncate block"
                            data-testid="modal-market-name"
                          >
                            {alert.marketName || alert.marketId}
                          </span>
                        </div>
                      </div>
                      {alert.marketId && (
                        <button
                          onClick={handleMarketClick}
                          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          data-testid="modal-view-market"
                        >
                          View Market
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Wallet info */}
                {(alert.walletId || alert.walletAddress) && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">👛</span>
                        <div className="min-w-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400 block">Wallet</span>
                          <span
                            className="text-sm font-mono font-medium text-gray-900 dark:text-white"
                            data-testid="modal-wallet-address"
                          >
                            {alert.walletAddress
                              ? truncateAddress(alert.walletAddress)
                              : alert.walletId}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {alert.walletAddress && (
                          <button
                            onClick={handleCopyWallet}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                            aria-label="Copy wallet address"
                            data-testid="modal-copy-wallet"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={handleWalletClick}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          data-testid="modal-view-wallet"
                        >
                          View Wallet
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DetailSection>
          )}

          {/* Tags */}
          {alert.tags && alert.tags.length > 0 && (
            <DetailSection title="Tags" testId="modal-tags-section">
              <div className="flex flex-wrap gap-2" data-testid="modal-tags">
                {alert.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    data-testid={`modal-tag-${tag}`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Alert ID */}
          <DetailSection title="Alert ID" testId="modal-id-section">
            <code
              className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
              data-testid="modal-alert-id"
            >
              {alert.id}
            </code>
          </DetailSection>
        </div>

        {/* Footer with Actions */}
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
          data-testid="modal-footer"
        >
          {/* Investigate button */}
          {(alert.marketId || alert.walletAddress) && (
            <Link
              href={alert.marketId ? `/markets/${alert.marketId}` : `/wallets/${alert.walletAddress}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              data-testid="modal-investigate"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Investigate
            </Link>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end" data-testid="modal-actions">
            {actionButtons.map((button) => (
              <button
                key={button.action}
                onClick={() => handleAction(button.action)}
                disabled={button.disabled}
                className={`
                  inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${button.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  ${
                    button.variant === 'primary'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : button.variant === 'danger'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }
                `}
                data-testid={`modal-action-${button.action.toLowerCase()}`}
              >
                <span role="img" aria-hidden="true">
                  {button.icon}
                </span>
                {button.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-modal-enter {
          animation: modal-enter 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// Export sub-components and utilities for flexibility
export { DetailSection };
