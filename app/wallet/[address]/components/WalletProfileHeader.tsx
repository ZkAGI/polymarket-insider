'use client';

import { useState } from 'react';

// Wallet data for the header
export interface WalletProfileHeaderProps {
  wallet: {
    address: string;
    label?: string;
    walletType: string;
    isWhale: boolean;
    isInsider: boolean;
    isFresh: boolean;
    isMonitored: boolean;
    isFlagged: boolean;
    isSanctioned: boolean;
    walletCreatedAt: Date | null;
    primaryFundingSource: string | null;
    notes: string | null;
  };
  onMonitorToggle?: () => void;
  onFlagToggle?: () => void;
  testId?: string;
}

// Wallet type configuration
const walletTypeConfig: Record<string, { label: string; icon: string; color: string }> = {
  EOA: {
    label: 'EOA',
    icon: '👤',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  CONTRACT: {
    label: 'Contract',
    icon: '📜',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  EXCHANGE: {
    label: 'Exchange',
    icon: '🏦',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  DEFI: {
    label: 'DeFi',
    icon: '⚡',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  MARKET_MAKER: {
    label: 'Market Maker',
    icon: '🎯',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  INSTITUTIONAL: {
    label: 'Institutional',
    icon: '🏢',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  },
  BOT: {
    label: 'Bot',
    icon: '🤖',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: '❓',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  },
};

// Format date for display
function formatDate(date: Date | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Copy to clipboard
function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    textArea.remove();
    return Promise.resolve();
  } catch (err) {
    textArea.remove();
    return Promise.reject(err);
  }
}

/**
 * Wallet Profile Header Component
 *
 * Displays wallet address, metadata, badges, and action buttons.
 */
export function WalletProfileHeader({
  wallet,
  onMonitorToggle,
  onFlagToggle,
  testId = 'wallet-profile-header',
}: WalletProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const typeConfig = walletTypeConfig[wallet.walletType] ?? walletTypeConfig.UNKNOWN;

  return (
    <div
      data-testid={testId}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
    >
      {/* Main header section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        {/* Left side: Address and badges */}
        <div className="flex-1 min-w-0">
          {/* Label if present */}
          {wallet.label && (
            <h1
              data-testid={`${testId}-label`}
              className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2"
            >
              {wallet.label}
            </h1>
          )}

          {/* Address with copy button */}
          <div className="flex items-center gap-2 mb-4">
            <code
              data-testid={`${testId}-address`}
              className="text-lg font-mono text-gray-700 dark:text-gray-300"
            >
              {wallet.address}
            </code>
            <button
              onClick={handleCopy}
              aria-label="Copy address"
              data-testid={`${testId}-copy-button`}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {copied ? (
                <span className="text-green-600 dark:text-green-400">✓</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">📋</span>
              )}
            </button>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Wallet type badge */}
            {typeConfig && (
              <span
                data-testid={`${testId}-type-badge`}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${typeConfig.color}`}
              >
                <span>{typeConfig.icon}</span>
                <span>{typeConfig.label}</span>
              </span>
            )}

            {/* Status badges */}
            {wallet.isWhale && (
              <span
                data-testid={`${testId}-whale-badge`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                🐋 Whale
              </span>
            )}

            {wallet.isInsider && (
              <span
                data-testid={`${testId}-insider-badge`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              >
                🎯 Potential Insider
              </span>
            )}

            {wallet.isFresh && (
              <span
                data-testid={`${testId}-fresh-badge`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              >
                ✨ Fresh
              </span>
            )}

            {wallet.isSanctioned && (
              <span
                data-testid={`${testId}-sanctioned-badge`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              >
                ⛔ Sanctioned
              </span>
            )}

            {wallet.isMonitored && (
              <span
                data-testid={`${testId}-monitored-badge`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
              >
                👁️ Monitored
              </span>
            )}

            {wallet.isFlagged && (
              <span
                data-testid={`${testId}-flagged-badge`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
              >
                🚩 Flagged
              </span>
            )}
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-2">
          {onMonitorToggle && (
            <button
              onClick={onMonitorToggle}
              data-testid={`${testId}-monitor-button`}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                wallet.isMonitored
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {wallet.isMonitored ? '👁️ Monitoring' : 'Monitor'}
            </button>
          )}

          {onFlagToggle && (
            <button
              onClick={onFlagToggle}
              data-testid={`${testId}-flag-button`}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                wallet.isFlagged
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {wallet.isFlagged ? '🚩 Flagged' : 'Flag'}
            </button>
          )}
        </div>
      </div>

      {/* Metadata section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        {/* Wallet created date */}
        <div data-testid={`${testId}-created-at`}>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Wallet Created</div>
          <div className="text-base font-medium text-gray-900 dark:text-gray-100">
            {formatDate(wallet.walletCreatedAt)}
          </div>
        </div>

        {/* Funding source */}
        <div data-testid={`${testId}-funding-source`}>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Funding Source</div>
          <div className="text-base font-medium text-gray-900 dark:text-gray-100">
            {wallet.primaryFundingSource || 'Unknown'}
          </div>
        </div>

        {/* Polygonscan link */}
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">On-Chain Explorer</div>
          <a
            href={`https://polygonscan.com/address/${wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`${testId}-polygonscan-link`}
            className="text-base font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on Polygonscan →
            </a>
        </div>
      </div>

      {/* Notes section (if present) */}
      {wallet.notes && (
        <div
          data-testid={`${testId}-notes`}
          className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Notes</div>
          <div className="text-base text-gray-700 dark:text-gray-300">{wallet.notes}</div>
        </div>
      )}
    </div>
  );
}
