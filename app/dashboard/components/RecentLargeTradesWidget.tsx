'use client';

import { useState, useEffect, useCallback } from 'react';

// Trade direction
export type TradeDirection = 'BUY' | 'SELL';

// Trade size category based on threshold
export type TradeSizeCategory = 'WHALE' | 'VERY_LARGE' | 'LARGE';

// Large trade data interface
export interface LargeTrade {
  id: string;
  marketId: string;
  marketTitle: string;
  marketSlug?: string;
  walletAddress: string;
  direction: TradeDirection;
  size: number; // in shares
  price: number; // 0-1
  usdValue: number;
  sizeCategory: TradeSizeCategory;
  timestamp: Date;
  txHash?: string;
  isMaker: boolean;
  isWhale: boolean;
  isSuspicious: boolean;
}

// Props for the component
export interface RecentLargeTradesWidgetProps {
  trades?: LargeTrade[];
  maxTrades?: number;
  minUsdValue?: number;
  onTradeClick?: (trade: LargeTrade) => void;
  onWalletClick?: (walletAddress: string) => void;
  showMarketInfo?: boolean;
  testId?: string;
}

// Trade size category configuration
export const sizeCategoryConfig: Record<
  TradeSizeCategory,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  WHALE: {
    label: 'Whale',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/40',
    borderColor: 'border-purple-400 dark:border-purple-600',
    icon: '🐋',
  },
  VERY_LARGE: {
    label: 'Very Large',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    borderColor: 'border-orange-400 dark:border-orange-600',
    icon: '📊',
  },
  LARGE: {
    label: 'Large',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    borderColor: 'border-blue-400 dark:border-blue-600',
    icon: '📈',
  },
};

// Trade direction configuration
export const directionConfig: Record<
  TradeDirection,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  BUY: {
    label: 'Buy',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    icon: '↑',
  },
  SELL: {
    label: 'Sell',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    icon: '↓',
  },
};

// Get size category configuration
export const getSizeCategoryConfig = (category: TradeSizeCategory) => {
  return sizeCategoryConfig[category] || sizeCategoryConfig.LARGE;
};

// Get direction configuration
export const getDirectionConfig = (direction: TradeDirection) => {
  return directionConfig[direction] || directionConfig.BUY;
};

// Determine size category based on USD value
export const getSizeCategoryFromValue = (usdValue: number): TradeSizeCategory => {
  if (usdValue >= 100000) return 'WHALE';
  if (usdValue >= 25000) return 'VERY_LARGE';
  return 'LARGE';
};

// Format wallet address for display
export const formatTradeWalletAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Format USD value for display
export const formatTradeUsdValue = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Format price/probability for display
export const formatTradePrice = (price: number): string => {
  return `${(price * 100).toFixed(1)}%`;
};

// Format time ago for display
export const formatTradeTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  if (diffSecs > 10) return `${diffSecs}s ago`;
  return 'Just now';
};

// Format share size for display
export const formatShareSize = (size: number): string => {
  if (size >= 1000000) {
    return `${(size / 1000000).toFixed(2)}M shares`;
  }
  if (size >= 1000) {
    return `${(size / 1000).toFixed(1)}K shares`;
  }
  return `${size.toFixed(0)} shares`;
};

// Truncate market title
export const truncateMarketTitle = (title: string, maxLength: number = 40): string => {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 3)}...`;
};

// Individual trade item component
function TradeItem({
  trade,
  index,
  onClick,
  onWalletClick,
  showMarketInfo,
}: {
  trade: LargeTrade;
  index: number;
  onClick?: (trade: LargeTrade) => void;
  onWalletClick?: (walletAddress: string) => void;
  showMarketInfo?: boolean;
}) {
  const sizeConfig = getSizeCategoryConfig(trade.sizeCategory);
  const dirConfig = getDirectionConfig(trade.direction);

  return (
    <div
      className={`
        relative p-3 rounded-lg border-l-4
        cursor-pointer transition-all duration-200
        hover:shadow-md hover:scale-[1.01]
        ${sizeConfig.bgColor} ${sizeConfig.borderColor}
        ${trade.isSuspicious ? 'ring-2 ring-red-400 dark:ring-red-500' : ''}
      `}
      onClick={() => onClick?.(trade)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(trade);
        }
      }}
      aria-label={`Trade ${formatTradeUsdValue(trade.usdValue)} ${trade.direction} at ${formatTradePrice(trade.price)}`}
      data-testid={`trade-item-${trade.id}`}
      data-trade-id={trade.id}
      data-trade-value={trade.usdValue}
      data-trade-direction={trade.direction}
    >
      {/* Index badge */}
      <div
        className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center shadow"
        data-testid="trade-index"
      >
        {index + 1}
      </div>

      {/* Suspicious indicator */}
      {trade.isSuspicious && (
        <div
          className="absolute top-2 right-2 text-red-500 animate-pulse"
          title="Suspicious activity detected"
          data-testid="suspicious-indicator"
        >
          <span role="img" aria-label="Warning">⚠️</span>
        </div>
      )}

      {/* Trade header with badges */}
      <div className="flex items-center gap-2 mb-1 pr-6">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${dirConfig.bgColor} ${dirConfig.color}`}
          data-testid="trade-direction-badge"
        >
          <span className="mr-1">{dirConfig.icon}</span>
          {dirConfig.label}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${sizeConfig.bgColor} ${sizeConfig.color}`}
          data-testid="trade-size-badge"
        >
          <span role="img" aria-hidden="true" className="mr-1">{sizeConfig.icon}</span>
          {sizeConfig.label}
        </span>
        {trade.isWhale && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
            data-testid="whale-badge"
          >
            🐋
          </span>
        )}
        {trade.isMaker && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            title="Maker order"
            data-testid="maker-badge"
          >
            M
          </span>
        )}
      </div>

      {/* USD Value - main display */}
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-xl font-bold text-gray-900 dark:text-white"
          data-testid="trade-usd-value"
        >
          {formatTradeUsdValue(trade.usdValue)}
        </span>
        <span
          className="text-sm text-gray-500 dark:text-gray-400"
          data-testid="trade-price"
        >
          @ {formatTradePrice(trade.price)}
        </span>
      </div>

      {/* Market info */}
      {showMarketInfo && (
        <div className="mb-2">
          <span
            className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1"
            title={trade.marketTitle}
            data-testid="trade-market-title"
          >
            {truncateMarketTitle(trade.marketTitle)}
          </span>
        </div>
      )}

      {/* Bottom row: wallet and timestamp */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <button
            className="font-mono hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onWalletClick?.(trade.walletAddress);
            }}
            data-testid="trade-wallet-address"
            title={trade.walletAddress}
          >
            {formatTradeWalletAddress(trade.walletAddress)}
          </button>
          {trade.txHash && (
            <a
              href={`https://polygonscan.com/tx/${trade.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-500"
              onClick={(e) => e.stopPropagation()}
              title="View on Polygonscan"
              data-testid="trade-tx-link"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
        <span
          className="text-gray-400 dark:text-gray-500"
          data-testid="trade-timestamp"
        >
          {formatTradeTimeAgo(trade.timestamp)}
        </span>
      </div>
    </div>
  );
}

// Summary stats component
function TradesSummary({ trades }: { trades: LargeTrade[] }) {
  const whaleCount = trades.filter((t) => t.sizeCategory === 'WHALE').length;
  const suspiciousCount = trades.filter((t) => t.isSuspicious).length;
  const buyCount = trades.filter((t) => t.direction === 'BUY').length;
  const sellCount = trades.filter((t) => t.direction === 'SELL').length;
  const totalVolume = trades.reduce((sum, t) => sum + t.usdValue, 0);

  return (
    <div
      className="flex items-center justify-between px-1 py-2 border-b border-gray-200 dark:border-gray-700"
      data-testid="trades-summary"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          data-testid="total-volume-badge"
        >
          {formatTradeUsdValue(totalVolume)} vol
        </span>
        {whaleCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
            data-testid="whale-count-badge"
          >
            {whaleCount} whale{whaleCount !== 1 ? 's' : ''}
          </span>
        )}
        {suspiciousCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse"
            data-testid="suspicious-count-badge"
          >
            {suspiciousCount} suspicious
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          data-testid="buy-count-badge"
        >
          {buyCount} buys
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          data-testid="sell-count-badge"
        >
          {sellCount} sells
        </span>
      </div>
    </div>
  );
}

// Loading skeleton component
function TradeSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array(3)
        .fill(null)
        .map((_, i) => (
          <div
            key={i}
            className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 border-l-4 border-gray-300 dark:border-gray-600"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-12 h-4 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-16 h-4 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="w-20 h-6 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-12 h-4 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="flex items-center justify-between">
              <div className="w-24 h-3 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-12 h-3 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
          </div>
        ))}
    </div>
  );
}

// Empty state component
function EmptyTrades() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-center"
      data-testid="trades-empty"
    >
      <span className="text-4xl mb-3" role="img" aria-label="No large trades">
        📊
      </span>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No large trades detected
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Monitoring for whale activity
      </p>
    </div>
  );
}

// Sample market titles for mock data
const sampleMarkets = [
  { title: 'Will Trump win the 2024 Presidential Election?', id: 'market-1' },
  { title: 'Will Bitcoin reach $100K by end of 2024?', id: 'market-2' },
  { title: 'Will the Fed cut rates in December?', id: 'market-3' },
  { title: 'Will Russia withdraw from Ukraine by March?', id: 'market-4' },
  { title: 'Will the Lakers win the NBA Championship?', id: 'market-5' },
  { title: 'Will ChatGPT-5 be released in 2024?', id: 'market-6' },
  { title: 'Will Oppenheimer win Best Picture?', id: 'market-7' },
  { title: 'Will Ethereum hit $5K before Bitcoin halving?', id: 'market-8' },
];

// Generate a random wallet address
function generateRandomWallet(): string {
  const chars = '0123456789abcdef';
  let addr = '0x';
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

// Generate a random transaction hash
function generateRandomTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Generate mock large trades for demo/testing
export function generateMockTrades(count: number = 5): LargeTrade[] {
  const trades: LargeTrade[] = [];

  for (let i = 0; i < count; i++) {
    // Generate random USD value ranging from 10K to 500K
    const usdValue = Math.floor(Math.random() * 490000) + 10000;
    const sizeCategory = getSizeCategoryFromValue(usdValue);
    const price = Math.random() * 0.8 + 0.1; // 10-90%
    const size = usdValue / price; // shares = usd / price
    const direction: TradeDirection = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const market = sampleMarkets[i % sampleMarkets.length] || sampleMarkets[0];

    trades.push({
      id: `trade-${i + 1}`,
      marketId: market?.id || `market-${i}`,
      marketTitle: market?.title || `Market ${i + 1}`,
      marketSlug: `market-${i + 1}-slug`,
      walletAddress: generateRandomWallet(),
      direction,
      size,
      price,
      usdValue,
      sizeCategory,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 86400000)), // Within last 24h
      txHash: Math.random() > 0.2 ? generateRandomTxHash() : undefined, // 80% have tx hash
      isMaker: Math.random() > 0.6, // 40% are makers
      isWhale: sizeCategory === 'WHALE',
      isSuspicious: Math.random() > 0.85, // 15% are suspicious
    });
  }

  // Sort by timestamp descending (most recent first)
  return trades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Main RecentLargeTradesWidget component
export default function RecentLargeTradesWidget({
  trades: externalTrades,
  maxTrades = 5,
  minUsdValue = 10000,
  onTradeClick,
  onWalletClick,
  showMarketInfo = true,
  testId = 'recent-large-trades-widget',
}: RecentLargeTradesWidgetProps) {
  const [trades, setTrades] = useState<LargeTrade[]>(externalTrades || []);
  const [isLoading, setIsLoading] = useState(!externalTrades);

  // Update trades when external trades change
  useEffect(() => {
    if (externalTrades) {
      setTrades(externalTrades);
      setIsLoading(false);
    }
  }, [externalTrades]);

  // Load mock data if no external trades provided
  useEffect(() => {
    if (externalTrades) return;

    const loadMockTrades = () => {
      const mockTrades = generateMockTrades(maxTrades);
      setTrades(mockTrades);
      setIsLoading(false);
    };

    const timer = setTimeout(loadMockTrades, 500);
    return () => clearTimeout(timer);
  }, [externalTrades, maxTrades]);

  const handleTradeClick = useCallback(
    (trade: LargeTrade) => {
      onTradeClick?.(trade);
    },
    [onTradeClick]
  );

  const handleWalletClick = useCallback(
    (walletAddress: string) => {
      onWalletClick?.(walletAddress);
    },
    [onWalletClick]
  );

  // Filter by minimum USD value and limit trades
  const displayTrades = trades
    .filter((t) => t.usdValue >= minUsdValue)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, maxTrades);

  const hasTrades = displayTrades.length > 0;

  return (
    <div className="flex flex-col h-full" data-testid={testId}>
      {/* Summary header */}
      {!isLoading && trades.length > 0 && <TradesSummary trades={displayTrades} />}

      {/* Trades list */}
      <div
        className="flex-1 overflow-y-auto space-y-3 py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        data-testid="trades-list"
        role="list"
        aria-label="Recent large trades"
      >
        {isLoading ? (
          <TradeSkeleton />
        ) : !hasTrades ? (
          <EmptyTrades />
        ) : (
          displayTrades.map((trade, index) => (
            <TradeItem
              key={trade.id}
              trade={trade}
              index={index}
              onClick={handleTradeClick}
              onWalletClick={handleWalletClick}
              showMarketInfo={showMarketInfo}
            />
          ))
        )}
      </div>
    </div>
  );
}
