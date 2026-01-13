/**
 * MarketInfoSection Component
 *
 * Displays additional market information including resolution source,
 * link to Polymarket, and other metadata.
 */

import { MarketData } from './types';

export interface MarketInfoSectionProps {
  market: MarketData;
}

// Format date for display with time
function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Calculate days until end
function getDaysUntilEnd(endDate: Date | null): string | null {
  if (!endDate) return null;
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return 'Ended';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export function MarketInfoSection({ market }: MarketInfoSectionProps) {
  const daysRemaining = getDaysUntilEnd(market.endDate);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        ℹ️ Market Information
      </h2>

      <div className="space-y-4">
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Status
          </label>
          <div className="flex items-center gap-2">
            {market.active ? (
              <span className="text-green-600 dark:text-green-400 font-medium">● Active</span>
            ) : market.closed ? (
              <span className="text-gray-600 dark:text-gray-400 font-medium">● Closed</span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">● Inactive</span>
            )}
          </div>
        </div>

        {/* Time remaining */}
        {daysRemaining && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Time Remaining
            </label>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{daysRemaining}</p>
          </div>
        )}

        {/* Resolution source */}
        {market.resolutionSource && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Resolution Source
            </label>
            <p className="text-gray-900 dark:text-gray-100">{market.resolutionSource}</p>
          </div>
        )}

        {/* Last updated */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Last Updated
          </label>
          <p className="text-gray-900 dark:text-gray-100">{formatDateTime(market.updatedAt)}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700" />

        {/* Actions */}
        <div className="space-y-3">
          {/* View on Polymarket */}
          <a
            href={market.polymarketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-center transition-colors"
          >
            🔗 View on Polymarket
          </a>

          {/* Copy market ID */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(market.id);
              // In a real app, show a toast notification
              alert('Market ID copied to clipboard!');
            }}
            className="block w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-lg text-center transition-colors"
          >
            📋 Copy Market ID
          </button>

          {/* Copy market URL */}
          <button
            onClick={() => {
              const currentUrl = window.location.href;
              navigator.clipboard.writeText(currentUrl);
              // In a real app, show a toast notification
              alert('Market URL copied to clipboard!');
            }}
            className="block w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-lg text-center transition-colors"
          >
            🔗 Share Market
          </button>
        </div>

        {/* Info box */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>ℹ️ Note:</strong> This page tracks suspicious activity and whale movements in
            this market. Use the Polymarket link to place trades.
          </p>
        </div>
      </div>
    </div>
  );
}
