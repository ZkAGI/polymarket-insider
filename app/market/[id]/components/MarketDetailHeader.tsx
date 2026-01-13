/**
 * MarketDetailHeader Component
 *
 * Displays the market question, status badges, and key metadata.
 */

import { MarketData } from './types';

export interface MarketDetailHeaderProps {
  market: MarketData;
}

// Format category name for display
function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Format volume to readable string
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

// Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function MarketDetailHeader({ market }: MarketDetailHeaderProps) {
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      POLITICS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      CRYPTO: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      FINANCE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      TECHNOLOGY: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      ENTERTAINMENT: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      SCIENCE: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
      GEOPOLITICS: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      SPORTS: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return colors[category] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getStatusBadge = () => {
    if (market.closed) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          🔒 Closed
        </span>
      );
    }
    if (market.active) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          ✅ Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
        ⏸️ Inactive
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* Status and category badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {getStatusBadge()}
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(market.category)}`}
        >
          📁 {formatCategory(market.category)}
        </span>
      </div>

      {/* Market question */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {market.question}
      </h1>

      {/* Market metadata */}
      <div className="flex flex-wrap gap-6 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-medium">📊 Volume:</span>
          <span>{formatVolume(market.volume)}</span>
        </div>

        {market.liquidity && (
          <div className="flex items-center gap-2">
            <span className="font-medium">💧 Liquidity:</span>
            <span>{formatVolume(market.liquidity)}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="font-medium">📅 Created:</span>
          <span>{formatDate(market.createdAt)}</span>
        </div>

        {market.endDate && (
          <div className="flex items-center gap-2">
            <span className="font-medium">🏁 Ends:</span>
            <span>{formatDate(market.endDate)}</span>
          </div>
        )}
      </div>

      {/* Market description */}
      {market.description && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{market.description}</p>
        </div>
      )}

      {/* Market ID for reference */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
          <span className="font-medium">Market ID:</span>
          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">{market.id}</code>
        </div>
      </div>
    </div>
  );
}
