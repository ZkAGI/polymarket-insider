/**
 * CurrentOddsDisplay Component
 *
 * Displays current odds/probabilities for all market outcomes.
 */

import { MarketOutcomeData } from './types';

export interface CurrentOddsDisplayProps {
  outcomes: MarketOutcomeData[];
}

// Format probability for display
function formatProbability(probability: number): string {
  return `${probability.toFixed(1)}%`;
}

// Format price for display
function formatPrice(price: number): string {
  return `$${price.toFixed(3)}`;
}

// Format change for display
function formatChange(change: number | undefined): string | null {
  if (change === undefined || change === null) return null;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

// Get color class for change
function getChangeColor(change: number | undefined): string {
  if (change === undefined || change === null) return 'text-gray-600 dark:text-gray-400';
  if (change > 0) return 'text-green-600 dark:text-green-400';
  if (change < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

// Get outcome icon
function getOutcomeIcon(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower === 'yes') return '✅';
  if (nameLower === 'no') return '❌';
  return '🔹';
}

export function CurrentOddsDisplay({ outcomes }: CurrentOddsDisplayProps) {
  // Sort outcomes by probability descending
  const sortedOutcomes = [...outcomes].sort((a, b) => b.probability - a.probability);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        📈 Current Odds
      </h2>

      <div className="space-y-4">
        {sortedOutcomes.map((outcome) => {
          const changeText = formatChange(outcome.change24h);
          const changeColor = getChangeColor(outcome.change24h);

          return (
            <div
              key={outcome.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              {/* Outcome name and icon */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getOutcomeIcon(outcome.name)}</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {outcome.name}
                  </span>
                </div>

                {/* 24h change */}
                {changeText && (
                  <div className={`text-sm font-medium ${changeColor}`}>
                    {changeText} 24h
                  </div>
                )}
              </div>

              {/* Probability bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-500">Probability</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatProbability(outcome.probability)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${outcome.probability}%` }}
                  />
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Share Price</span>
                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                  {formatPrice(outcome.price)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-500">
          <p className="mb-1">
            💡 <strong>Tip:</strong> Probabilities represent the market's collective prediction.
          </p>
          <p>
            📊 Share prices reflect the cost to buy a share that pays $1 if the outcome occurs.
          </p>
        </div>
      </div>
    </div>
  );
}
