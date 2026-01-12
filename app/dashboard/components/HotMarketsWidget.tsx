'use client';

import { useState, useEffect, useCallback } from 'react';

// Market category enum
export type MarketCategory =
  | 'POLITICS'
  | 'CRYPTO'
  | 'SPORTS'
  | 'ENTERTAINMENT'
  | 'FINANCE'
  | 'SCIENCE'
  | 'GEOPOLITICAL'
  | 'OTHER';

// Heat level enum (based on suspicious activity)
export type HeatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// Alert type for markets
export type MarketAlertType =
  | 'WHALE_ACTIVITY'
  | 'COORDINATED_TRADING'
  | 'VOLUME_SPIKE'
  | 'PRICE_MANIPULATION'
  | 'FRESH_WALLET_CLUSTER'
  | 'INSIDER_PATTERN';

// Hot market data interface
export interface HotMarket {
  id: string;
  title: string;
  slug: string;
  category: MarketCategory;
  heatLevel: HeatLevel;
  heatScore: number; // 0-100
  alertCount: number;
  alertTypes: MarketAlertType[];
  currentProbability: number; // 0-1
  probabilityChange: number; // -1 to 1 (percentage change)
  volume24h: number;
  volumeChange: number; // percentage change in volume
  suspiciousWallets: number;
  lastAlert: Date;
  isWatched?: boolean;
}

// Props for the component
export interface HotMarketsWidgetProps {
  markets?: HotMarket[];
  maxMarkets?: number;
  onMarketClick?: (market: HotMarket) => void;
  onWatchToggle?: (marketId: string) => void;
  showAlertTypes?: boolean;
  testId?: string;
}

// Heat level configuration
export const heatLevelConfig: Record<
  HeatLevel,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    borderColor: 'border-red-400 dark:border-red-600',
    icon: '🔥',
  },
  HIGH: {
    label: 'High',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    borderColor: 'border-orange-400 dark:border-orange-600',
    icon: '🌡️',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40',
    borderColor: 'border-yellow-400 dark:border-yellow-600',
    icon: '📊',
  },
  LOW: {
    label: 'Low',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    borderColor: 'border-blue-400 dark:border-blue-600',
    icon: '📉',
  },
  NONE: {
    label: 'None',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-900/40',
    borderColor: 'border-gray-400 dark:border-gray-600',
    icon: '✓',
  },
};

// Market category configuration
export const categoryConfig: Record<MarketCategory, { label: string; icon: string; color: string }> = {
  POLITICS: {
    label: 'Politics',
    icon: '🏛️',
    color: 'text-purple-600 dark:text-purple-400',
  },
  CRYPTO: {
    label: 'Crypto',
    icon: '₿',
    color: 'text-orange-600 dark:text-orange-400',
  },
  SPORTS: {
    label: 'Sports',
    icon: '⚽',
    color: 'text-green-600 dark:text-green-400',
  },
  ENTERTAINMENT: {
    label: 'Entertainment',
    icon: '🎬',
    color: 'text-pink-600 dark:text-pink-400',
  },
  FINANCE: {
    label: 'Finance',
    icon: '💹',
    color: 'text-blue-600 dark:text-blue-400',
  },
  SCIENCE: {
    label: 'Science',
    icon: '🔬',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  GEOPOLITICAL: {
    label: 'Geopolitical',
    icon: '🌍',
    color: 'text-red-600 dark:text-red-400',
  },
  OTHER: {
    label: 'Other',
    icon: '📋',
    color: 'text-gray-600 dark:text-gray-400',
  },
};

// Alert type configuration
export const alertTypeConfig: Record<MarketAlertType, { label: string; icon: string; color: string }> = {
  WHALE_ACTIVITY: {
    label: 'Whale',
    icon: '🐋',
    color: 'text-blue-600 dark:text-blue-400',
  },
  COORDINATED_TRADING: {
    label: 'Coordinated',
    icon: '🔗',
    color: 'text-pink-600 dark:text-pink-400',
  },
  VOLUME_SPIKE: {
    label: 'Volume',
    icon: '📈',
    color: 'text-green-600 dark:text-green-400',
  },
  PRICE_MANIPULATION: {
    label: 'Price',
    icon: '⚠️',
    color: 'text-red-600 dark:text-red-400',
  },
  FRESH_WALLET_CLUSTER: {
    label: 'Fresh',
    icon: '✨',
    color: 'text-purple-600 dark:text-purple-400',
  },
  INSIDER_PATTERN: {
    label: 'Insider',
    icon: '🎯',
    color: 'text-orange-600 dark:text-orange-400',
  },
};

// Get heat level configuration
export const getHeatLevelConfig = (level: HeatLevel) => {
  return heatLevelConfig[level] || heatLevelConfig.NONE;
};

// Get category configuration
export const getCategoryConfig = (category: MarketCategory) => {
  return categoryConfig[category] || categoryConfig.OTHER;
};

// Get alert type configuration
export const getAlertTypeConfig = (type: MarketAlertType) => {
  return alertTypeConfig[type] || alertTypeConfig.VOLUME_SPIKE;
};

// Get heat level from score
export const getHeatLevelFromScore = (score: number): HeatLevel => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'NONE';
};

// Format volume for display
export const formatMarketVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
};

// Format percentage change for display
export const formatPercentageChange = (change: number): string => {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${(change * 100).toFixed(1)}%`;
};

// Format probability for display
export const formatProbability = (probability: number): string => {
  return `${(probability * 100).toFixed(0)}%`;
};

// Format time ago for display
export const formatMarketTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

// Truncate market title
export const truncateTitle = (title: string, maxLength: number = 50): string => {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 3)}...`;
};

// Heat score bar component
function HeatScoreBar({ score }: { score: number }) {
  const level = getHeatLevelFromScore(score);
  const config = getHeatLevelConfig(level);

  return (
    <div className="flex items-center gap-2" data-testid="market-heat-bar">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            level === 'CRITICAL' ? 'bg-red-500' :
            level === 'HIGH' ? 'bg-orange-500' :
            level === 'MEDIUM' ? 'bg-yellow-500' :
            level === 'LOW' ? 'bg-blue-500' :
            'bg-gray-400'
          }`}
          style={{ width: `${Math.min(score, 100)}%` }}
          data-testid="market-heat-fill"
        />
      </div>
      <span
        className={`text-xs font-bold min-w-[2rem] text-right ${config.color}`}
        data-testid="market-heat-value"
      >
        {score}
      </span>
    </div>
  );
}

// Alert types display component
function AlertTypesDisplay({ types }: { types: MarketAlertType[] }) {
  if (types.length === 0) return null;

  const displayTypes = types.slice(0, 3);
  const moreCount = types.length - 3;

  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="market-alert-types">
      {displayTypes.map((type) => {
        const config = getAlertTypeConfig(type);
        return (
          <span
            key={type}
            className={`text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-gray-800 shadow-sm ${config.color}`}
            title={config.label}
            data-testid={`alert-type-${type.toLowerCase().replace(/_/g, '-')}`}
          >
            <span role="img" aria-hidden="true">{config.icon}</span>
          </span>
        );
      })}
      {moreCount > 0 && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          data-testid="alert-types-more"
        >
          +{moreCount}
        </span>
      )}
    </div>
  );
}

// Probability change indicator
function ProbabilityChangeIndicator({ change }: { change: number }) {
  const isPositive = change >= 0;
  const colorClass = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <span className={`text-xs font-medium ${colorClass}`} data-testid="probability-change">
      {isPositive ? '↑' : '↓'} {formatPercentageChange(change)}
    </span>
  );
}

// Individual market item component
function MarketItem({
  market,
  rank,
  onClick,
  onWatchToggle,
  showAlertTypes,
}: {
  market: HotMarket;
  rank: number;
  onClick?: (market: HotMarket) => void;
  onWatchToggle?: (marketId: string) => void;
  showAlertTypes?: boolean;
}) {
  const heatConfig = getHeatLevelConfig(market.heatLevel);
  const categoryConf = getCategoryConfig(market.category);

  return (
    <div
      className={`
        relative p-3 rounded-lg border-l-4
        cursor-pointer transition-all duration-200
        hover:shadow-md hover:scale-[1.01]
        ${heatConfig.bgColor} ${heatConfig.borderColor}
      `}
      onClick={() => onClick?.(market)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(market);
        }
      }}
      aria-label={`Market ${truncateTitle(market.title)} with heat score ${market.heatScore}`}
      data-testid={`market-item-${market.id}`}
      data-market-id={market.id}
      data-market-slug={market.slug}
      data-market-heat={market.heatScore}
    >
      {/* Rank badge */}
      <div
        className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center shadow"
        data-testid="market-rank"
      >
        {rank}
      </div>

      {/* Watch button */}
      <button
        className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
          market.isWatched
            ? 'text-yellow-500 hover:text-yellow-600'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onWatchToggle?.(market.id);
        }}
        aria-label={market.isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        data-testid="market-watch-button"
      >
        <svg className="w-4 h-4" fill={market.isWatched ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>

      {/* Market header */}
      <div className="flex items-center gap-2 mb-1 pr-6">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${heatConfig.bgColor} ${heatConfig.color}`}
          data-testid="market-heat-badge"
        >
          <span role="img" aria-hidden="true">{heatConfig.icon}</span> {heatConfig.label}
        </span>
        <span
          className={`text-xs ${categoryConf.color}`}
          title={categoryConf.label}
          data-testid="market-category"
        >
          <span role="img" aria-hidden="true">{categoryConf.icon}</span>
        </span>
      </div>

      {/* Market title */}
      <h3
        className="text-sm font-medium text-gray-900 dark:text-white mb-2 pr-6 line-clamp-2"
        data-testid="market-title"
        title={market.title}
      >
        {truncateTitle(market.title, 60)}
      </h3>

      {/* Heat score bar */}
      <div className="mb-2">
        <HeatScoreBar score={market.heatScore} />
      </div>

      {/* Alert types */}
      {showAlertTypes && market.alertTypes.length > 0 && (
        <div className="mb-2">
          <AlertTypesDisplay types={market.alertTypes} />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-3">
          <span data-testid="market-probability" title="Current Probability">
            {formatProbability(market.currentProbability)}
            {market.probabilityChange !== 0 && (
              <span className="ml-1">
                <ProbabilityChangeIndicator change={market.probabilityChange} />
              </span>
            )}
          </span>
          <span data-testid="market-volume" title="24h Volume">
            {formatMarketVolume(market.volume24h)}
          </span>
          <span data-testid="market-alerts" title="Alert Count">
            {market.alertCount} alerts
          </span>
        </div>
        <span
          className="text-gray-400 dark:text-gray-500"
          data-testid="market-last-alert"
        >
          {formatMarketTimeAgo(market.lastAlert)}
        </span>
      </div>
    </div>
  );
}

// Summary stats component
function MarketsSummary({ markets }: { markets: HotMarket[] }) {
  const criticalCount = markets.filter((m) => m.heatLevel === 'CRITICAL').length;
  const highCount = markets.filter((m) => m.heatLevel === 'HIGH').length;
  const watchedCount = markets.filter((m) => m.isWatched).length;
  const totalAlerts = markets.reduce((sum, m) => sum + m.alertCount, 0);

  return (
    <div
      className="flex items-center justify-between px-1 py-2 border-b border-gray-200 dark:border-gray-700"
      data-testid="markets-summary"
    >
      <div className="flex items-center gap-3">
        {criticalCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse"
            data-testid="critical-markets-count"
          >
            {criticalCount} critical
          </span>
        )}
        {highCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
            data-testid="high-markets-count"
          >
            {highCount} high
          </span>
        )}
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          data-testid="total-markets-count"
        >
          {markets.length} markets
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          data-testid="total-alerts-count"
        >
          {totalAlerts} alerts
        </span>
      </div>
      {watchedCount > 0 && (
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          data-testid="watched-markets-count"
        >
          {watchedCount} watched
        </span>
      )}
    </div>
  );
}

// Loading skeleton component
function MarketSkeleton() {
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
              <div className="w-16 h-4 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-6 h-4 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="w-3/4 h-4 rounded bg-gray-300 dark:bg-gray-600 mb-2" />
            <div className="h-2 rounded bg-gray-300 dark:bg-gray-600 mb-2" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-3 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-12 h-3 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="w-12 h-3 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
          </div>
        ))}
    </div>
  );
}

// Empty state component
function EmptyMarkets() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-center"
      data-testid="markets-empty"
    >
      <span className="text-4xl mb-3" role="img" aria-label="No hot markets">
        📊
      </span>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No hot markets detected
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Monitoring markets for suspicious activity
      </p>
    </div>
  );
}

// Sample market titles for mock data
const sampleMarketTitles: { title: string; category: MarketCategory }[] = [
  { title: 'Will Trump win the 2024 Presidential Election?', category: 'POLITICS' },
  { title: 'Will Bitcoin reach $100K by end of 2024?', category: 'CRYPTO' },
  { title: 'Will the Fed cut rates in December?', category: 'FINANCE' },
  { title: 'Will Russia withdraw from Ukraine by March?', category: 'GEOPOLITICAL' },
  { title: 'Will the Lakers win the NBA Championship?', category: 'SPORTS' },
  { title: 'Will ChatGPT-5 be released in 2024?', category: 'SCIENCE' },
  { title: 'Will Oppenheimer win Best Picture?', category: 'ENTERTAINMENT' },
  { title: 'Will Ethereum hit $5K before Bitcoin halving?', category: 'CRYPTO' },
  { title: 'Will the SEC approve a Solana ETF?', category: 'CRYPTO' },
  { title: 'Will there be a government shutdown?', category: 'POLITICS' },
];

// Generate mock hot markets for demo/testing
export function generateMockMarkets(count: number = 5): HotMarket[] {
  const alertTypesOptions: MarketAlertType[] = [
    'WHALE_ACTIVITY',
    'COORDINATED_TRADING',
    'VOLUME_SPIKE',
    'PRICE_MANIPULATION',
    'FRESH_WALLET_CLUSTER',
    'INSIDER_PATTERN',
  ];

  const markets: HotMarket[] = [];

  for (let i = 0; i < count; i++) {
    const score = Math.floor(Math.random() * 100);
    const alertCount = Math.floor(Math.random() * 4) + 1;
    const shuffledAlerts = [...alertTypesOptions].sort(() => Math.random() - 0.5);
    const selectedAlerts = shuffledAlerts.slice(0, alertCount);
    const sampleMarket = sampleMarketTitles[i % sampleMarketTitles.length];

    markets.push({
      id: `market-${i + 1}`,
      title: sampleMarket?.title || `Market ${i + 1}`,
      slug: `market-${i + 1}-slug`,
      category: sampleMarket?.category || 'OTHER',
      heatLevel: getHeatLevelFromScore(score),
      heatScore: score,
      alertCount: Math.floor(Math.random() * 15) + 1,
      alertTypes: selectedAlerts,
      currentProbability: Math.random() * 0.8 + 0.1, // 10-90%
      probabilityChange: (Math.random() - 0.5) * 0.2, // -10% to +10%
      volume24h: Math.floor(Math.random() * 2000000) + 10000,
      volumeChange: (Math.random() - 0.3) * 0.5, // -15% to +35%
      suspiciousWallets: Math.floor(Math.random() * 10) + 1,
      lastAlert: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3)), // Within last 3 days
      isWatched: Math.random() > 0.7,
    });
  }

  // Sort by heat score descending (by alert count)
  return markets.sort((a, b) => b.heatScore - a.heatScore);
}

// Main HotMarketsWidget component
export default function HotMarketsWidget({
  markets: externalMarkets,
  maxMarkets = 5,
  onMarketClick,
  onWatchToggle,
  showAlertTypes = true,
  testId = 'hot-markets-widget',
}: HotMarketsWidgetProps) {
  const [markets, setMarkets] = useState<HotMarket[]>(externalMarkets || []);
  const [isLoading, setIsLoading] = useState(!externalMarkets);

  // Update markets when external markets change
  useEffect(() => {
    if (externalMarkets) {
      setMarkets(externalMarkets);
      setIsLoading(false);
    }
  }, [externalMarkets]);

  // Load mock data if no external markets provided
  useEffect(() => {
    if (externalMarkets) return;

    const loadMockMarkets = () => {
      const mockMarkets = generateMockMarkets(maxMarkets);
      setMarkets(mockMarkets);
      setIsLoading(false);
    };

    const timer = setTimeout(loadMockMarkets, 500);
    return () => clearTimeout(timer);
  }, [externalMarkets, maxMarkets]);

  const handleMarketClick = useCallback(
    (market: HotMarket) => {
      onMarketClick?.(market);
    },
    [onMarketClick]
  );

  const handleWatchToggle = useCallback(
    (marketId: string) => {
      if (onWatchToggle) {
        onWatchToggle(marketId);
      } else {
        // Default local toggle behavior if no external handler
        setMarkets((prev) =>
          prev.map((m) =>
            m.id === marketId ? { ...m, isWatched: !m.isWatched } : m
          )
        );
      }
    },
    [onWatchToggle]
  );

  // Sort and limit markets
  const displayMarkets = [...markets]
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, maxMarkets);

  const hasMarkets = displayMarkets.length > 0;

  return (
    <div className="flex flex-col h-full" data-testid={testId}>
      {/* Summary header */}
      {!isLoading && markets.length > 0 && <MarketsSummary markets={displayMarkets} />}

      {/* Markets list */}
      <div
        className="flex-1 overflow-y-auto space-y-3 py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        data-testid="markets-list"
        role="list"
        aria-label="Hot markets ranked by suspicious activity"
      >
        {isLoading ? (
          <MarketSkeleton />
        ) : !hasMarkets ? (
          <EmptyMarkets />
        ) : (
          displayMarkets.map((market, index) => (
            <MarketItem
              key={market.id}
              market={market}
              rank={index + 1}
              onClick={handleMarketClick}
              onWatchToggle={handleWatchToggle}
              showAlertTypes={showAlertTypes}
            />
          ))
        )}
      </div>
    </div>
  );
}
