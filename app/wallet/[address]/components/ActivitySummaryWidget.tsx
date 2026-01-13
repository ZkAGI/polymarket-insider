'use client';

// Activity summary props
export interface ActivitySummaryWidgetProps {
  totalVolume: number;
  totalPnl: number;
  tradeCount: number;
  winCount: number;
  winRate: number | null;
  avgTradeSize: number | null;
  maxTradeSize: number | null;
  firstTradeAt: Date | null;
  lastTradeAt: Date | null;
  walletAgeDays: number | null;
  onChainTxCount: number;
  testId?: string;
}

// Format currency
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Format number with commas
function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

// Format percentage
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format date
function formatDate(date: Date | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Get PnL color
function getPnlColor(pnl: number): string {
  if (pnl > 0) return 'text-green-600 dark:text-green-400';
  if (pnl < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

// Get win rate color
function getWinRateColor(winRate: number): string {
  if (winRate >= 70) return 'text-green-600 dark:text-green-400';
  if (winRate >= 55) return 'text-blue-600 dark:text-blue-400';
  if (winRate >= 45) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Activity Summary Widget Component
 *
 * Displays wallet activity statistics in a grid layout.
 */
export function ActivitySummaryWidget({
  totalVolume,
  totalPnl,
  tradeCount,
  winCount,
  winRate,
  avgTradeSize,
  maxTradeSize,
  firstTradeAt,
  lastTradeAt,
  walletAgeDays,
  onChainTxCount,
  testId = 'activity-summary-widget',
}: ActivitySummaryWidgetProps) {
  const lossCount = tradeCount - winCount;

  return (
    <div
      data-testid={testId}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
    >
      {/* Header */}
      <h2
        data-testid={`${testId}-title`}
        className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6"
      >
        Activity Summary
      </h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {/* Total Volume */}
        <div data-testid={`${testId}-total-volume`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Volume</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalVolume)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            across {formatNumber(tradeCount)} trades
          </div>
        </div>

        {/* Total P&L */}
        <div data-testid={`${testId}-total-pnl`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total P&L</div>
          <div className={`text-2xl font-bold ${getPnlColor(totalPnl)}`}>
            {totalPnl >= 0 ? '+' : ''}
            {formatCurrency(totalPnl)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {totalPnl >= 0 ? 'profit' : 'loss'}
          </div>
        </div>

        {/* Win Rate */}
        <div data-testid={`${testId}-win-rate`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Win Rate</div>
          <div className={`text-2xl font-bold ${winRate !== null ? getWinRateColor(winRate) : 'text-gray-400'}`}>
            {winRate !== null ? formatPercentage(winRate) : 'N/A'}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {winCount}W / {lossCount}L
          </div>
        </div>

        {/* Trade Count */}
        <div data-testid={`${testId}-trade-count`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Trades</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(tradeCount)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {onChainTxCount} on-chain txs
          </div>
        </div>

        {/* Average Trade Size */}
        <div data-testid={`${testId}-avg-trade-size`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Trade Size</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {avgTradeSize !== null ? formatCurrency(avgTradeSize) : 'N/A'}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">per trade</div>
        </div>

        {/* Max Trade Size */}
        <div data-testid={`${testId}-max-trade-size`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Largest Trade</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {maxTradeSize !== null ? formatCurrency(maxTradeSize) : 'N/A'}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">single position</div>
        </div>

        {/* First Trade */}
        <div data-testid={`${testId}-first-trade`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">First Trade</div>
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(firstTradeAt)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {walletAgeDays !== null ? `${walletAgeDays} days old` : ''}
          </div>
        </div>

        {/* Last Trade */}
        <div data-testid={`${testId}-last-trade`} className="space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Last Trade</div>
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(lastTradeAt)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">most recent</div>
        </div>
      </div>

      {/* Summary section */}
      <div
        data-testid={`${testId}-summary`}
        className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Age (days)</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {walletAgeDays !== null ? formatNumber(walletAgeDays) : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">On-Chain Txs</div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(onChainTxCount)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Win Count</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatNumber(winCount)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loss Count</div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatNumber(lossCount)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
