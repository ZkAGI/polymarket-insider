'use client';

import { useState, useEffect, useCallback } from 'react';

// Suspicion level enum
export type SuspicionLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// Risk flags for wallets
export type RiskFlag =
  | 'FRESH_WALLET'
  | 'HIGH_WIN_RATE'
  | 'UNUSUAL_TIMING'
  | 'LARGE_POSITIONS'
  | 'COORDINATED'
  | 'SYBIL_LINKED'
  | 'NICHE_FOCUS';

// Wallet data interface
export interface SuspiciousWallet {
  id: string;
  address: string;
  suspicionScore: number;
  suspicionLevel: SuspicionLevel;
  riskFlags: RiskFlag[];
  totalVolume: number;
  winRate: number;
  lastActivity: Date;
  tradeCount: number;
  isWatched?: boolean;
}

// Props for the component
export interface SuspiciousWalletsWidgetProps {
  wallets?: SuspiciousWallet[];
  maxWallets?: number;
  onWalletClick?: (wallet: SuspiciousWallet) => void;
  onWatchToggle?: (walletId: string) => void;
  showRiskFlags?: boolean;
  testId?: string;
}

// Suspicion level configuration
export const suspicionLevelConfig: Record<
  SuspicionLevel,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  CRITICAL: {
    label: 'Critical',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    borderColor: 'border-red-400 dark:border-red-600',
  },
  HIGH: {
    label: 'High',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
    borderColor: 'border-orange-400 dark:border-orange-600',
  },
  MEDIUM: {
    label: 'Medium',
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40',
    borderColor: 'border-yellow-400 dark:border-yellow-600',
  },
  LOW: {
    label: 'Low',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    borderColor: 'border-blue-400 dark:border-blue-600',
  },
  NONE: {
    label: 'None',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-900/40',
    borderColor: 'border-gray-400 dark:border-gray-600',
  },
};

// Risk flag configuration
export const riskFlagConfig: Record<RiskFlag, { label: string; icon: string; color: string }> = {
  FRESH_WALLET: {
    label: 'Fresh',
    icon: '✨',
    color: 'text-purple-600 dark:text-purple-400',
  },
  HIGH_WIN_RATE: {
    label: 'High Win',
    icon: '🎯',
    color: 'text-green-600 dark:text-green-400',
  },
  UNUSUAL_TIMING: {
    label: 'Timing',
    icon: '⏰',
    color: 'text-orange-600 dark:text-orange-400',
  },
  LARGE_POSITIONS: {
    label: 'Large',
    icon: '🐋',
    color: 'text-blue-600 dark:text-blue-400',
  },
  COORDINATED: {
    label: 'Coord',
    icon: '🔗',
    color: 'text-pink-600 dark:text-pink-400',
  },
  SYBIL_LINKED: {
    label: 'Sybil',
    icon: '👥',
    color: 'text-red-600 dark:text-red-400',
  },
  NICHE_FOCUS: {
    label: 'Niche',
    icon: '🎪',
    color: 'text-teal-600 dark:text-teal-400',
  },
};

// Get suspicion level configuration
export const getSuspicionLevelConfig = (level: SuspicionLevel) => {
  return suspicionLevelConfig[level] || suspicionLevelConfig.NONE;
};

// Get risk flag configuration
export const getRiskFlagConfig = (flag: RiskFlag) => {
  return riskFlagConfig[flag] || riskFlagConfig.FRESH_WALLET;
};

// Format wallet address for display
export const formatWalletAddress = (address: string): string => {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Format volume for display
export const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
};

// Format time ago for display
export const formatTimeAgo = (date: Date): string => {
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

// Get suspicion level from score
export const getSuspicionLevelFromScore = (score: number): SuspicionLevel => {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'NONE';
};

// Score bar component
function ScoreBar({ score }: { score: number }) {
  const level = getSuspicionLevelFromScore(score);
  const config = getSuspicionLevelConfig(level);

  return (
    <div className="flex items-center gap-2" data-testid="wallet-score-bar">
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
          data-testid="wallet-score-fill"
        />
      </div>
      <span
        className={`text-xs font-bold min-w-[2rem] text-right ${config.color}`}
        data-testid="wallet-score-value"
      >
        {score}
      </span>
    </div>
  );
}

// Risk flags display component
function RiskFlagsDisplay({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) return null;

  const displayFlags = flags.slice(0, 3);
  const moreCount = flags.length - 3;

  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="wallet-risk-flags">
      {displayFlags.map((flag) => {
        const config = getRiskFlagConfig(flag);
        return (
          <span
            key={flag}
            className={`text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-gray-800 shadow-sm ${config.color}`}
            title={config.label}
            data-testid={`risk-flag-${flag.toLowerCase().replace(/_/g, '-')}`}
          >
            <span role="img" aria-hidden="true">{config.icon}</span>
          </span>
        );
      })}
      {moreCount > 0 && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          data-testid="risk-flags-more"
        >
          +{moreCount}
        </span>
      )}
    </div>
  );
}

// Individual wallet item component
function WalletItem({
  wallet,
  rank,
  onClick,
  onWatchToggle,
  showRiskFlags,
}: {
  wallet: SuspiciousWallet;
  rank: number;
  onClick?: (wallet: SuspiciousWallet) => void;
  onWatchToggle?: (walletId: string) => void;
  showRiskFlags?: boolean;
}) {
  const levelConfig = getSuspicionLevelConfig(wallet.suspicionLevel);

  return (
    <div
      className={`
        relative p-3 rounded-lg border-l-4
        cursor-pointer transition-all duration-200
        hover:shadow-md hover:scale-[1.01]
        ${levelConfig.bgColor} ${levelConfig.borderColor}
      `}
      onClick={() => onClick?.(wallet)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(wallet);
        }
      }}
      aria-label={`Wallet ${formatWalletAddress(wallet.address)} with suspicion score ${wallet.suspicionScore}`}
      data-testid={`wallet-item-${wallet.id}`}
      data-wallet-address={wallet.address}
      data-wallet-score={wallet.suspicionScore}
    >
      {/* Rank badge */}
      <div
        className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center shadow"
        data-testid="wallet-rank"
      >
        {rank}
      </div>

      {/* Watch button */}
      <button
        className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
          wallet.isWatched
            ? 'text-yellow-500 hover:text-yellow-600'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onWatchToggle?.(wallet.id);
        }}
        aria-label={wallet.isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        data-testid="wallet-watch-button"
      >
        <svg className="w-4 h-4" fill={wallet.isWatched ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>

      {/* Wallet header */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${levelConfig.bgColor} ${levelConfig.color}`}
          data-testid="wallet-level-badge"
        >
          {levelConfig.label}
        </span>
        <span
          className="text-sm font-mono text-gray-900 dark:text-white"
          data-testid="wallet-address"
        >
          {formatWalletAddress(wallet.address)}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-2">
        <ScoreBar score={wallet.suspicionScore} />
      </div>

      {/* Risk flags */}
      {showRiskFlags && wallet.riskFlags.length > 0 && (
        <div className="mb-2">
          <RiskFlagsDisplay flags={wallet.riskFlags} />
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-3">
          <span data-testid="wallet-volume" title="Total Volume">
            {formatVolume(wallet.totalVolume)}
          </span>
          <span data-testid="wallet-win-rate" title="Win Rate">
            {(wallet.winRate * 100).toFixed(0)}% win
          </span>
          <span data-testid="wallet-trades" title="Trade Count">
            {wallet.tradeCount} trades
          </span>
        </div>
        <span
          className="text-gray-400 dark:text-gray-500"
          data-testid="wallet-last-activity"
        >
          {formatTimeAgo(wallet.lastActivity)}
        </span>
      </div>
    </div>
  );
}

// Summary stats component
function WalletsSummary({ wallets }: { wallets: SuspiciousWallet[] }) {
  const criticalCount = wallets.filter((w) => w.suspicionLevel === 'CRITICAL').length;
  const highCount = wallets.filter((w) => w.suspicionLevel === 'HIGH').length;
  const watchedCount = wallets.filter((w) => w.isWatched).length;

  return (
    <div
      className="flex items-center justify-between px-1 py-2 border-b border-gray-200 dark:border-gray-700"
      data-testid="wallets-summary"
    >
      <div className="flex items-center gap-3">
        {criticalCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse"
            data-testid="critical-wallets-count"
          >
            {criticalCount} critical
          </span>
        )}
        {highCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
            data-testid="high-wallets-count"
          >
            {highCount} high
          </span>
        )}
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          data-testid="total-wallets-count"
        >
          {wallets.length} total
        </span>
      </div>
      {watchedCount > 0 && (
        <span
          className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          data-testid="watched-wallets-count"
        >
          {watchedCount} watched
        </span>
      )}
    </div>
  );
}

// Loading skeleton component
function WalletSkeleton() {
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
              <div className="w-24 h-4 rounded bg-gray-300 dark:bg-gray-600" />
            </div>
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
function EmptyWallets() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-center"
      data-testid="wallets-empty"
    >
      <span className="text-4xl mb-3" role="img" aria-label="No suspicious wallets">
        🔍
      </span>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No suspicious wallets detected
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Monitoring wallet activity for anomalies
      </p>
    </div>
  );
}

// Generate mock suspicious wallets for demo/testing
export function generateMockWallets(count: number = 5): SuspiciousWallet[] {
  const riskFlagsOptions: RiskFlag[] = [
    'FRESH_WALLET',
    'HIGH_WIN_RATE',
    'UNUSUAL_TIMING',
    'LARGE_POSITIONS',
    'COORDINATED',
    'SYBIL_LINKED',
    'NICHE_FOCUS',
  ];

  const wallets: SuspiciousWallet[] = [];

  for (let i = 0; i < count; i++) {
    const score = Math.floor(Math.random() * 100);
    const flagCount = Math.floor(Math.random() * 4) + 1;
    const shuffledFlags = [...riskFlagsOptions].sort(() => Math.random() - 0.5);
    const selectedFlags = shuffledFlags.slice(0, flagCount);

    wallets.push({
      id: `wallet-${i + 1}`,
      address: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
      suspicionScore: score,
      suspicionLevel: getSuspicionLevelFromScore(score),
      riskFlags: selectedFlags,
      totalVolume: Math.floor(Math.random() * 500000) + 1000,
      winRate: Math.random() * 0.5 + 0.5, // 50-100%
      lastActivity: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)), // Within last week
      tradeCount: Math.floor(Math.random() * 100) + 5,
      isWatched: Math.random() > 0.7,
    });
  }

  // Sort by suspicion score descending
  return wallets.sort((a, b) => b.suspicionScore - a.suspicionScore);
}

// Main SuspiciousWalletsWidget component
export default function SuspiciousWalletsWidget({
  wallets: externalWallets,
  maxWallets = 5,
  onWalletClick,
  onWatchToggle,
  showRiskFlags = true,
  testId = 'suspicious-wallets-widget',
}: SuspiciousWalletsWidgetProps) {
  const [wallets, setWallets] = useState<SuspiciousWallet[]>(externalWallets || []);
  const [isLoading, setIsLoading] = useState(!externalWallets);

  // Update wallets when external wallets change
  useEffect(() => {
    if (externalWallets) {
      setWallets(externalWallets);
      setIsLoading(false);
    }
  }, [externalWallets]);

  // Load mock data if no external wallets provided
  useEffect(() => {
    if (externalWallets) return;

    const loadMockWallets = () => {
      const mockWallets = generateMockWallets(maxWallets);
      setWallets(mockWallets);
      setIsLoading(false);
    };

    const timer = setTimeout(loadMockWallets, 500);
    return () => clearTimeout(timer);
  }, [externalWallets, maxWallets]);

  const handleWalletClick = useCallback(
    (wallet: SuspiciousWallet) => {
      onWalletClick?.(wallet);
    },
    [onWalletClick]
  );

  const handleWatchToggle = useCallback(
    (walletId: string) => {
      if (onWatchToggle) {
        onWatchToggle(walletId);
      } else {
        // Default local toggle behavior if no external handler
        setWallets((prev) =>
          prev.map((w) =>
            w.id === walletId ? { ...w, isWatched: !w.isWatched } : w
          )
        );
      }
    },
    [onWatchToggle]
  );

  // Sort and limit wallets
  const displayWallets = [...wallets]
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .slice(0, maxWallets);

  const hasWallets = displayWallets.length > 0;

  return (
    <div className="flex flex-col h-full" data-testid={testId}>
      {/* Summary header */}
      {!isLoading && wallets.length > 0 && <WalletsSummary wallets={displayWallets} />}

      {/* Wallets list */}
      <div
        className="flex-1 overflow-y-auto space-y-3 py-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        data-testid="wallets-list"
        role="list"
        aria-label="Suspicious wallets ranked by score"
      >
        {isLoading ? (
          <WalletSkeleton />
        ) : !hasWallets ? (
          <EmptyWallets />
        ) : (
          displayWallets.map((wallet, index) => (
            <WalletItem
              key={wallet.id}
              wallet={wallet}
              rank={index + 1}
              onClick={handleWalletClick}
              onWatchToggle={handleWatchToggle}
              showRiskFlags={showRiskFlags}
            />
          ))
        )}
      </div>
    </div>
  );
}
