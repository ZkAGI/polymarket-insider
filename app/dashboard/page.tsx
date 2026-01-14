'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from './components/DashboardLayout';
import WidgetContainer from './components/WidgetContainer';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import AlertFeed, { FeedAlert } from './components/AlertFeed';
import ActiveSignalsCounter, {
  SignalCount,
  SignalType,
  generateMockSignals,
} from './components/ActiveSignalsCounter';
import SuspiciousWalletsWidget, {
  SuspiciousWallet,
  RiskFlag,
  getSuspicionLevelFromScore,
} from './components/SuspiciousWalletsWidget';
import HotMarketsWidget, {
  HotMarket,
  MarketCategory,
  MarketAlertType,
  getHeatLevelFromScore,
} from './components/HotMarketsWidget';
import RecentLargeTradesWidget, {
  LargeTrade,
  generateMockTrades,
} from './components/RecentLargeTradesWidget';
import SystemStatusIndicator, {
  DataSourceStatus,
  SystemHealth,
  generateMockSources,
} from './components/SystemStatusIndicator';
import {
  StatValue,
  StatType,
  calculateTrend,
  statTypeConfig,
} from './components/QuickStatsSummaryBar';
import { RefreshInterval } from './components/DashboardRefreshControls';
import {
  useStats,
  useAlerts,
  useWhales,
  useMarkets,
  AlertSummary,
  WalletSummary,
  MarketSummary,
  AlertType as APIAlertType,
} from '@/hooks/useDashboardData';

export interface DashboardStats {
  activeAlerts: number;
  suspiciousWallets: number;
  hotMarkets: number;
  recentTrades: number;
  systemStatus: 'connected' | 'disconnected' | 'connecting';
}

const initialStats: DashboardStats = {
  activeAlerts: 0,
  suspiciousWallets: 0,
  hotMarkets: 0,
  recentTrades: 0,
  systemStatus: 'connecting',
};

// Helper to create a StatValue from raw data
function createStatValue(
  type: StatType,
  value: number,
  previousValue: number,
  options?: { prefix?: string; isCritical?: boolean; isHighlighted?: boolean }
): StatValue {
  const config = statTypeConfig[type];
  const { direction, percentage, absoluteChange } = calculateTrend(value, previousValue);

  return {
    id: `stat-${type.toLowerCase()}`,
    type,
    category: config.category,
    label: config.label,
    value,
    previousValue,
    trend: direction,
    trendValue: absoluteChange,
    trendPercentage: percentage,
    prefix: options?.prefix,
    isCritical: options?.isCritical,
    isHighlighted: options?.isHighlighted,
    lastUpdated: new Date(),
    description: config.description,
  };
}

// Convert API AlertSummary to UI FeedAlert
function convertAlertToFeedAlert(alert: AlertSummary): FeedAlert {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    marketId: alert.market?.id ?? null,
    walletId: alert.wallet?.id ?? null,
    walletAddress: alert.wallet?.address,
    marketName: alert.market?.question,
    tags: alert.tags,
    read: alert.read,
    acknowledged: alert.acknowledged,
    createdAt: new Date(alert.createdAt),
    isNew: false,
  };
}

// Convert API WalletSummary to UI SuspiciousWallet
function convertWalletToSuspiciousWallet(wallet: WalletSummary): SuspiciousWallet {
  // Map API flags to UI RiskFlags
  const riskFlags: RiskFlag[] = [];
  if (wallet.flags.isFresh) riskFlags.push('FRESH_WALLET');
  if (wallet.winRate && wallet.winRate >= 70) riskFlags.push('HIGH_WIN_RATE');
  if (wallet.flags.isWhale || (wallet.maxTradeSize && wallet.maxTradeSize >= 100000))
    riskFlags.push('LARGE_POSITIONS');
  if (wallet.flags.isInsider) riskFlags.push('NICHE_FOCUS');

  return {
    id: wallet.id,
    address: wallet.address,
    suspicionScore: wallet.suspicionScore,
    suspicionLevel: getSuspicionLevelFromScore(wallet.suspicionScore),
    riskFlags,
    totalVolume: wallet.totalVolume,
    winRate: wallet.winRate ?? 0,
    lastActivity: wallet.lastTradeAt ? new Date(wallet.lastTradeAt) : new Date(),
    tradeCount: wallet.tradeCount,
    isWatched: wallet.flags.isMonitored,
  };
}

// Map API AlertType to UI MarketAlertType
function mapAlertTypeToMarketAlertType(type: APIAlertType): MarketAlertType | null {
  const mapping: Record<string, MarketAlertType> = {
    WHALE_TRADE: 'WHALE_ACTIVITY',
    COORDINATED_ACTIVITY: 'COORDINATED_TRADING',
    PRICE_MOVEMENT: 'VOLUME_SPIKE',
    INSIDER_ACTIVITY: 'INSIDER_PATTERN',
    FRESH_WALLET: 'FRESH_WALLET_CLUSTER',
  };
  return mapping[type] ?? null;
}

// Convert API MarketSummary to UI HotMarket
function convertMarketToHotMarket(market: MarketSummary): HotMarket {
  // Map category string to MarketCategory enum
  const categoryMap: Record<string, MarketCategory> = {
    politics: 'POLITICS',
    crypto: 'CRYPTO',
    sports: 'SPORTS',
    entertainment: 'ENTERTAINMENT',
    finance: 'FINANCE',
    science: 'SCIENCE',
    geopolitical: 'GEOPOLITICAL',
  };
  const category: MarketCategory =
    categoryMap[market.category?.toLowerCase() ?? ''] ?? 'OTHER';

  // Calculate heat score based on alert count and volume
  const heatScore = Math.min(
    100,
    Math.round((market.alertCount * 10) + (market.volume24h / 100000))
  );

  // Get alert types
  const alertTypes: MarketAlertType[] = [];
  if (market.topAlertType) {
    const mapped = mapAlertTypeToMarketAlertType(market.topAlertType);
    if (mapped) alertTypes.push(mapped);
  }

  // Get first outcome price
  const primaryOutcome = market.outcomes[0];
  const probability = primaryOutcome?.price ?? 0.5;
  const priceChange = primaryOutcome?.priceChange24h ?? 0;

  return {
    id: market.id,
    title: market.question,
    slug: market.slug,
    category,
    heatLevel: getHeatLevelFromScore(heatScore),
    heatScore,
    alertCount: market.alertCount,
    alertTypes,
    currentProbability: probability,
    probabilityChange: priceChange,
    volume24h: market.volume24h,
    volumeChange: 0, // Not available in API
    suspiciousWallets: 0, // Not available in API
    lastAlert: new Date(), // Using current time as placeholder
    isWatched: false,
  };
}

export default function DashboardPage() {
  // SWR hooks for real API data
  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
    mutate: mutateStats,
  } = useStats({ refreshInterval: 30000 });

  const {
    alerts: apiAlerts,
    isLoading: isAlertsLoading,
    error: alertsError,
    mutate: mutateAlerts,
  } = useAlerts({ limit: 20, refreshInterval: 30000 });

  const {
    wallets: apiWallets,
    isLoading: isWalletsLoading,
    error: walletsError,
    mutate: mutateWallets,
  } = useWhales({ limit: 5, refreshInterval: 30000 });

  const {
    markets: apiMarkets,
    isLoading: isMarketsLoading,
    error: marketsError,
    mutate: mutateMarkets,
  } = useMarkets({ limit: 5, refreshInterval: 30000 });

  // Local state for components not yet connected to API
  const [signals, setSignals] = useState<SignalCount[]>([]);
  const [isSignalsLoading, setIsSignalsLoading] = useState(true);
  const [largeTrades, setLargeTrades] = useState<LargeTrade[]>([]);
  const [isTradesLoading, setIsTradesLoading] = useState(true);
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([]);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);

  // Dashboard refresh controls state
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const [lastDashboardRefresh, setLastDashboardRefresh] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<RefreshInterval>('30s');

  // Track previous stats for trend calculation
  const [previousStatsData, setPreviousStatsData] = useState<typeof statsData | null>(null);

  // Convert API alerts to UI format
  const alerts: FeedAlert[] = useMemo(() => {
    if (apiAlerts.length > 0) {
      return apiAlerts.map(convertAlertToFeedAlert);
    }
    return [];
  }, [apiAlerts]);

  // Convert API wallets to UI format
  const suspiciousWallets: SuspiciousWallet[] = useMemo(() => {
    if (apiWallets.length > 0) {
      return apiWallets.map(convertWalletToSuspiciousWallet);
    }
    return [];
  }, [apiWallets]);

  // Convert API markets to UI format
  const hotMarkets: HotMarket[] = useMemo(() => {
    if (apiMarkets.length > 0) {
      return apiMarkets.map(convertMarketToHotMarket);
    }
    return [];
  }, [apiMarkets]);

  // Calculate stats from API data
  const stats: DashboardStats = useMemo(() => {
    if (statsData) {
      return {
        activeAlerts: statsData.alerts,
        suspiciousWallets: statsData.suspiciousWallets,
        hotMarkets: statsData.hotMarkets,
        recentTrades: statsData.whaleTrades,
        systemStatus: 'connected' as const,
      };
    }
    return {
      ...initialStats,
      systemStatus: (isStatsLoading ? 'connecting' : statsError ? 'disconnected' : 'connected') as
        | 'connected'
        | 'disconnected'
        | 'connecting',
    };
  }, [statsData, isStatsLoading, statsError]);

  // Build quickStats from API data
  const quickStats = useMemo<StatValue[]>(() => {
    if (!statsData) {
      return [];
    }

    const prev = previousStatsData || statsData;

    return [
      createStatValue('ACTIVE_ALERTS', statsData.alerts, prev.alerts, {
        isHighlighted: statsData.alerts > 10,
      }),
      createStatValue('CRITICAL_ALERTS', statsData.criticalAlerts, prev.criticalAlerts, {
        isCritical: statsData.criticalAlerts > 0,
        isHighlighted: statsData.criticalAlerts > 0,
      }),
      createStatValue('SUSPICIOUS_WALLETS', statsData.suspiciousWallets, prev.suspiciousWallets),
      createStatValue('HOT_MARKETS', statsData.hotMarkets, prev.hotMarkets),
      createStatValue('LARGE_TRADES', statsData.whaleTrades, prev.whaleTrades),
      createStatValue('WHALE_TRADES', statsData.whaleTrades, prev.whaleTrades),
      createStatValue('TOTAL_VOLUME', statsData.volume24h, prev.volume24h, { prefix: '$' }),
      createStatValue('CONNECTED_SOURCES', 4, 4), // Placeholder - system status not in API
    ];
  }, [statsData, previousStatsData]);

  // Update previous stats when new data arrives
  useEffect(() => {
    if (statsData && !previousStatsData) {
      setPreviousStatsData(statsData);
    }
  }, [statsData, previousStatsData]);

  // Load initial mock data for components not connected to API
  useEffect(() => {
    const loadMockData = async () => {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate initial mock signals
      const mockSignals = generateMockSignals();
      setSignals(mockSignals);

      // Generate initial mock large trades
      const mockTrades = generateMockTrades(5);
      setLargeTrades(mockTrades);

      // Generate initial mock data sources
      const mockSources = generateMockSources();
      setDataSources(mockSources);

      setIsSignalsLoading(false);
      setIsTradesLoading(false);
      setLastDashboardRefresh(new Date());
    };

    loadMockData();
  }, []);

  // Handle alert click
  const handleAlertClick = useCallback((alert: FeedAlert) => {
    console.log('Alert clicked:', alert);
    // In a real app, this would open a detail modal or navigate to alert details
  }, []);

  // Handle mark as read - TODO: call API to mark as read
  const handleMarkRead = useCallback((alertId: string) => {
    console.log('Mark alert as read:', alertId);
    // TODO: Call API to mark alert as read
  }, []);

  // Handle refresh alerts
  const handleRefreshAlerts = useCallback(async () => {
    await mutateAlerts();
  }, [mutateAlerts]);

  // Handle signal click
  const handleSignalClick = useCallback((signalType: SignalType) => {
    console.log('Signal clicked:', signalType);
    // In a real app, this would filter alerts or navigate to signal details
  }, []);

  // Handle refresh signals
  const handleRefreshSignals = useCallback(async () => {
    setIsSignalsLoading(true);
    try {
      // Simulate API fetch
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newSignals = generateMockSignals();
      setSignals(newSignals);
    } finally {
      setIsSignalsLoading(false);
    }
  }, []);

  // Handle wallet click
  const handleWalletClick = useCallback((wallet: SuspiciousWallet) => {
    console.log('Wallet clicked:', wallet);
    // In a real app, this would navigate to wallet details
  }, []);

  // Handle wallet watch toggle - TODO: call API
  const handleWatchToggle = useCallback((walletId: string) => {
    console.log('Toggle watch for wallet:', walletId);
    // TODO: Call API to toggle watch status
  }, []);

  // Handle refresh wallets
  const handleRefreshWallets = useCallback(async () => {
    await mutateWallets();
  }, [mutateWallets]);

  // Handle market click
  const handleMarketClick = useCallback((market: HotMarket) => {
    console.log('Market clicked:', market);
    // In a real app, this would navigate to market details
  }, []);

  // Handle market watch toggle - TODO: call API
  const handleMarketWatchToggle = useCallback((marketId: string) => {
    console.log('Toggle watch for market:', marketId);
    // TODO: Call API to toggle watch status
  }, []);

  // Handle refresh markets
  const handleRefreshMarkets = useCallback(async () => {
    await mutateMarkets();
  }, [mutateMarkets]);

  // Handle trade click
  const handleTradeClick = useCallback((trade: LargeTrade) => {
    console.log('Trade clicked:', trade);
    // In a real app, this would navigate to trade details or open a modal
  }, []);

  // Handle trade wallet click
  const handleTradeWalletClick = useCallback((walletAddress: string) => {
    console.log('Wallet clicked from trade:', walletAddress);
    // In a real app, this would navigate to wallet details
  }, []);

  // Handle refresh trades
  const handleRefreshTrades = useCallback(async () => {
    setIsTradesLoading(true);
    try {
      // Simulate API fetch
      await new Promise((resolve) => setTimeout(resolve, 500));
      const newTrades = generateMockTrades(5);
      setLargeTrades(newTrades);
    } finally {
      setIsTradesLoading(false);
    }
  }, []);

  // Handle data source click
  const handleSourceClick = useCallback((source: DataSourceStatus) => {
    console.log('Data source clicked:', source);
    // In a real app, this would show detailed connection info or reconnect
  }, []);

  // Handle system health change
  const handleHealthChange = useCallback((health: SystemHealth) => {
    console.log('System health changed:', health);
    // In a real app, this could trigger notifications or alerts
  }, []);

  // Handle status expanded toggle
  const handleToggleStatusExpanded = useCallback(() => {
    setIsStatusExpanded((prev) => !prev);
  }, []);

  // Handle quick stat click
  const handleStatClick = useCallback((stat: StatValue) => {
    console.log('Quick stat clicked:', stat);
    // In a real app, this could navigate to relevant section or filter data
  }, []);

  // Handle quick stats refresh
  const handleQuickStatsRefresh = useCallback(async () => {
    // Store previous for trend calculation
    if (statsData) {
      setPreviousStatsData(statsData);
    }
    await mutateStats();
  }, [statsData, mutateStats]);

  // Handle full dashboard refresh - refreshes all widgets
  const handleDashboardRefresh = useCallback(async () => {
    setIsDashboardRefreshing(true);
    try {
      // Store previous stats for trend calculation
      if (statsData) {
        setPreviousStatsData(statsData);
      }

      // Refresh all widgets in parallel
      await Promise.all([
        mutateStats(),
        mutateAlerts(),
        mutateWallets(),
        mutateMarkets(),
        handleRefreshSignals(),
        handleRefreshTrades(),
      ]);

      // Update last refresh time
      setLastDashboardRefresh(new Date());
    } finally {
      setIsDashboardRefreshing(false);
    }
  }, [
    statsData,
    mutateStats,
    mutateAlerts,
    mutateWallets,
    mutateMarkets,
    handleRefreshSignals,
    handleRefreshTrades,
  ]);

  // Handle auto-refresh interval change
  const handleAutoRefreshChange = useCallback((interval: RefreshInterval) => {
    setAutoRefreshInterval(interval);
    console.log('Auto-refresh interval changed:', interval);
  }, []);

  // Show loading skeleton while initial data loads
  const isInitialLoading = isStatsLoading && !statsData;

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  // Show error state if stats API failed
  const hasError = !!(statsError || alertsError || walletsError || marketsError);

  return (
    <DashboardLayout
      stats={stats}
      quickStats={quickStats}
      onStatClick={handleStatClick}
      onStatsRefresh={handleQuickStatsRefresh}
      isStatsLoading={isStatsLoading}
      onDashboardRefresh={handleDashboardRefresh}
      isDashboardRefreshing={isDashboardRefreshing}
      lastDashboardRefresh={lastDashboardRefresh}
      autoRefreshInterval={autoRefreshInterval}
      onAutoRefreshChange={handleAutoRefreshChange}
      showRefreshControls={true}
    >
      {/* Error banner if any API failed */}
      {hasError && (
        <div className="lg:col-span-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 dark:text-red-400">Error loading data.</span>
            <button
              onClick={handleDashboardRefresh}
              className="text-sm underline text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Row 1: Alert Feed and Active Signals */}
      <div className="lg:col-span-2">
        <WidgetContainer
          title="Real-time Alert Feed"
          testId="alert-feed-widget"
          className="h-full min-h-[300px]"
          onRefresh={handleRefreshAlerts}
          isLoading={isAlertsLoading}
        >
          <AlertFeed
            alerts={alerts}
            maxAlerts={20}
            onAlertClick={handleAlertClick}
            onMarkRead={handleMarkRead}
            emptyMessage="No alerts detected. The system is monitoring for suspicious activity."
            testId="alert-feed-content"
          />
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Active Signals"
          testId="active-signals-widget"
          className="h-full min-h-[300px]"
          onRefresh={handleRefreshSignals}
          isLoading={isSignalsLoading}
        >
          <ActiveSignalsCounter
            signals={signals}
            onSignalClick={handleSignalClick}
            showTrends={true}
            testId="active-signals-content"
          />
        </WidgetContainer>
      </div>

      {/* Row 2: Top Suspicious Wallets and Hot Markets */}
      <div className="lg:col-span-1">
        <WidgetContainer
          title="Top Suspicious Wallets"
          testId="suspicious-wallets-widget"
          className="h-full min-h-[250px]"
          onRefresh={handleRefreshWallets}
          isLoading={isWalletsLoading}
        >
          <SuspiciousWalletsWidget
            wallets={suspiciousWallets}
            maxWallets={5}
            onWalletClick={handleWalletClick}
            onWatchToggle={handleWatchToggle}
            showRiskFlags={true}
            testId="suspicious-wallets-content"
          />
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Hot Markets"
          testId="hot-markets-widget"
          className="h-full min-h-[250px]"
          onRefresh={handleRefreshMarkets}
          isLoading={isMarketsLoading}
        >
          <HotMarketsWidget
            markets={hotMarkets}
            maxMarkets={5}
            onMarketClick={handleMarketClick}
            onWatchToggle={handleMarketWatchToggle}
            showAlertTypes={true}
            testId="hot-markets-content"
          />
        </WidgetContainer>
      </div>

      <div className="lg:col-span-1">
        <WidgetContainer
          title="Recent Large Trades"
          testId="large-trades-widget"
          className="h-full min-h-[250px]"
          onRefresh={handleRefreshTrades}
          isLoading={isTradesLoading}
        >
          <RecentLargeTradesWidget
            trades={largeTrades}
            maxTrades={5}
            minUsdValue={10000}
            onTradeClick={handleTradeClick}
            onWalletClick={handleTradeWalletClick}
            showMarketInfo={true}
            testId="recent-large-trades-content"
          />
        </WidgetContainer>
      </div>

      {/* Row 3: System Status */}
      <div className="lg:col-span-3">
        <WidgetContainer
          title="System Status"
          testId="system-status-widget"
          className="h-full min-h-[150px]"
        >
          <SystemStatusIndicator
            sources={dataSources}
            onSourceClick={handleSourceClick}
            onHealthChange={handleHealthChange}
            expanded={isStatusExpanded}
            onToggleExpanded={handleToggleStatusExpanded}
            showLatency={true}
            testId="system-status-content"
          />
        </WidgetContainer>
      </div>
    </DashboardLayout>
  );
}
