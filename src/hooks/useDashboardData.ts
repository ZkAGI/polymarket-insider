/**
 * Dashboard Data Hooks
 *
 * SWR-based hooks for fetching dashboard data from API endpoints.
 * Features:
 * - Automatic revalidation every 30 seconds
 * - Error handling with retry
 * - Loading states
 * - Optimistic updates
 */

import useSWR, { SWRConfiguration } from "swr";

// =============================================================================
// Types from API responses
// =============================================================================

/**
 * Stats API response type
 */
export interface DashboardStatsResponse {
  alerts: number;
  criticalAlerts: number;
  suspiciousWallets: number;
  hotMarkets: number;
  volume24h: number;
  whaleTrades: number;
  trends: {
    alerts: number;
    criticalAlerts: number;
    suspiciousWallets: number;
    hotMarkets: number;
    volume24h: number;
    whaleTrades: number;
  };
  generatedAt: string;
}

/**
 * Alert types from Prisma schema
 */
export type AlertType =
  | "WHALE_TRADE"
  | "PRICE_MOVEMENT"
  | "INSIDER_ACTIVITY"
  | "FRESH_WALLET"
  | "WALLET_REACTIVATION"
  | "COORDINATED_ACTIVITY"
  | "UNUSUAL_PATTERN"
  | "MARKET_RESOLVED"
  | "NEW_MARKET"
  | "SUSPICIOUS_FUNDING"
  | "SANCTIONED_ACTIVITY"
  | "SYSTEM";

export type AlertSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Alert summary from API
 */
export interface AlertSummary {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  tags: string[];
  read: boolean;
  acknowledged: boolean;
  createdAt: string;
  market: {
    id: string;
    question: string;
    slug: string;
    category: string | null;
  } | null;
  wallet: {
    id: string;
    address: string;
    label: string | null;
    suspicionScore: number;
  } | null;
}

/**
 * Alerts API response type
 */
export interface DashboardAlertsResponse {
  alerts: AlertSummary[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    severity: AlertSeverity[] | null;
    type: AlertType[] | null;
    since: string | null;
    read: boolean | null;
  };
  generatedAt: string;
}

/**
 * Wallet types from Prisma schema
 */
export type WalletType =
  | "UNKNOWN"
  | "RETAIL"
  | "WHALE"
  | "MARKET_MAKER"
  | "BOT"
  | "INSIDER"
  | "EXCHANGE"
  | "CONTRACT";

export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Wallet summary from API
 */
export interface WalletSummary {
  id: string;
  address: string;
  label: string | null;
  walletType: WalletType;
  suspicionScore: number;
  riskLevel: RiskLevel;
  totalVolume: number;
  tradeCount: number;
  winRate: number | null;
  totalPnl: number;
  avgTradeSize: number | null;
  maxTradeSize: number | null;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  walletAgeDays: number | null;
  flags: {
    isWhale: boolean;
    isInsider: boolean;
    isFresh: boolean;
    isFlagged: boolean;
    isMonitored: boolean;
    isSanctioned: boolean;
  };
}

/**
 * Whales API response type
 */
export interface DashboardWhalesResponse {
  wallets: WalletSummary[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    minScore: number | null;
    isWhale: boolean | null;
    isInsider: boolean | null;
    isFlagged: boolean | null;
  };
  generatedAt: string;
}

/**
 * Market summary from API
 */
export interface MarketSummary {
  id: string;
  question: string;
  slug: string;
  category: string | null;
  subcategory: string | null;
  volume: number;
  volume24h: number;
  liquidity: number;
  alertCount: number;
  topAlertType: AlertType | null;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  imageUrl: string | null;
  outcomes: {
    name: string;
    price: number;
    priceChange24h: number;
  }[];
}

/**
 * Markets API response type
 */
export interface DashboardMarketsResponse {
  markets: MarketSummary[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: {
    category: string | null;
  };
  generatedAt: string;
}

// =============================================================================
// Fetcher function
// =============================================================================

/**
 * Generic fetcher for SWR
 * Handles JSON parsing and error responses
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error("An error occurred while fetching the data.");
    // Attach extra info to the error object
    (error as Error & { info?: unknown; status?: number }).info =
      await response.json().catch(() => null);
    (error as Error & { info?: unknown; status?: number }).status =
      response.status;
    throw error;
  }

  return response.json();
}

// =============================================================================
// Default SWR configuration
// =============================================================================

const defaultConfig: SWRConfiguration = {
  refreshInterval: 30000, // Refresh every 30 seconds
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};

// =============================================================================
// Stats Hook
// =============================================================================

export interface UseStatsOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

export interface UseStatsResult {
  data: DashboardStatsResponse | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => Promise<DashboardStatsResponse | undefined>;
}

/**
 * Hook for fetching dashboard statistics
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useStats();
 *
 * if (isLoading) return <Skeleton />;
 * if (error) return <Error onRetry={mutate} />;
 *
 * return <Stats alerts={data.alerts} volume={data.volume24h} />;
 * ```
 */
export function useStats(options: UseStatsOptions = {}): UseStatsResult {
  const { refreshInterval = 30000, enabled = true } = options;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DashboardStatsResponse>(
      enabled ? "/api/dashboard/stats" : null,
      fetcher,
      {
        ...defaultConfig,
        refreshInterval,
      }
    );

  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

// =============================================================================
// Alerts Hook
// =============================================================================

export interface UseAlertsOptions {
  limit?: number;
  offset?: number;
  severity?: AlertSeverity[];
  type?: AlertType[];
  since?: string;
  read?: boolean;
  refreshInterval?: number;
  enabled?: boolean;
}

export interface UseAlertsResult {
  data: DashboardAlertsResponse | undefined;
  alerts: AlertSummary[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => Promise<DashboardAlertsResponse | undefined>;
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  } | null;
}

/**
 * Hook for fetching dashboard alerts
 *
 * @example
 * ```tsx
 * const { alerts, isLoading, error, pagination } = useAlerts({
 *   limit: 20,
 *   severity: ['HIGH', 'CRITICAL']
 * });
 * ```
 */
export function useAlerts(options: UseAlertsOptions = {}): UseAlertsResult {
  const {
    limit = 20,
    offset = 0,
    severity,
    type,
    since,
    read,
    refreshInterval = 30000,
    enabled = true,
  } = options;

  // Build query string
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (severity && severity.length > 0) {
    params.set("severity", severity.join(","));
  }
  if (type && type.length > 0) {
    params.set("type", type.join(","));
  }
  if (since) {
    params.set("since", since);
  }
  if (read !== undefined) {
    params.set("read", String(read));
  }

  const url = enabled ? `/api/dashboard/alerts?${params.toString()}` : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DashboardAlertsResponse>(url, fetcher, {
      ...defaultConfig,
      refreshInterval,
    });

  return {
    data,
    alerts: data?.alerts ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
    pagination: data?.pagination ?? null,
  };
}

// =============================================================================
// Whales (Suspicious Wallets) Hook
// =============================================================================

export interface UseWhalesOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  isWhale?: boolean;
  isInsider?: boolean;
  isFlagged?: boolean;
  refreshInterval?: number;
  enabled?: boolean;
}

export interface UseWhalesResult {
  data: DashboardWhalesResponse | undefined;
  wallets: WalletSummary[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => Promise<DashboardWhalesResponse | undefined>;
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  } | null;
}

/**
 * Hook for fetching suspicious wallets (whales)
 *
 * @example
 * ```tsx
 * const { wallets, isLoading, error } = useWhales({
 *   limit: 10,
 *   minScore: 50
 * });
 * ```
 */
export function useWhales(options: UseWhalesOptions = {}): UseWhalesResult {
  const {
    limit = 10,
    offset = 0,
    minScore,
    isWhale,
    isInsider,
    isFlagged,
    refreshInterval = 30000,
    enabled = true,
  } = options;

  // Build query string
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (minScore !== undefined) {
    params.set("minScore", String(minScore));
  }
  if (isWhale !== undefined) {
    params.set("isWhale", String(isWhale));
  }
  if (isInsider !== undefined) {
    params.set("isInsider", String(isInsider));
  }
  if (isFlagged !== undefined) {
    params.set("isFlagged", String(isFlagged));
  }

  const url = enabled ? `/api/dashboard/whales?${params.toString()}` : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DashboardWhalesResponse>(url, fetcher, {
      ...defaultConfig,
      refreshInterval,
    });

  return {
    data,
    wallets: data?.wallets ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
    pagination: data?.pagination ?? null,
  };
}

// =============================================================================
// Markets Hook
// =============================================================================

export interface UseMarketsOptions {
  limit?: number;
  offset?: number;
  category?: string;
  refreshInterval?: number;
  enabled?: boolean;
}

export interface UseMarketsResult {
  data: DashboardMarketsResponse | undefined;
  markets: MarketSummary[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => Promise<DashboardMarketsResponse | undefined>;
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  } | null;
}

/**
 * Hook for fetching hot markets
 *
 * @example
 * ```tsx
 * const { markets, isLoading, error } = useMarkets({
 *   limit: 10,
 *   category: 'politics'
 * });
 * ```
 */
export function useMarkets(options: UseMarketsOptions = {}): UseMarketsResult {
  const {
    limit = 10,
    offset = 0,
    category,
    refreshInterval = 30000,
    enabled = true,
  } = options;

  // Build query string
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (category) {
    params.set("category", category);
  }

  const url = enabled ? `/api/dashboard/markets?${params.toString()}` : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<DashboardMarketsResponse>(url, fetcher, {
      ...defaultConfig,
      refreshInterval,
    });

  return {
    data,
    markets: data?.markets ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
    pagination: data?.pagination ?? null,
  };
}

// =============================================================================
// Combined Dashboard Hook
// =============================================================================

export interface UseDashboardDataOptions {
  statsEnabled?: boolean;
  alertsEnabled?: boolean;
  whalesEnabled?: boolean;
  marketsEnabled?: boolean;
  refreshInterval?: number;
  alertsLimit?: number;
  whalesLimit?: number;
  marketsLimit?: number;
}

export interface UseDashboardDataResult {
  stats: UseStatsResult;
  alerts: UseAlertsResult;
  whales: UseWhalesResult;
  markets: UseMarketsResult;
  isLoading: boolean;
  hasError: boolean;
  refreshAll: () => Promise<void>;
}

/**
 * Combined hook for fetching all dashboard data
 *
 * @example
 * ```tsx
 * const { stats, alerts, whales, markets, isLoading, refreshAll } = useDashboardData();
 *
 * if (isLoading) return <DashboardSkeleton />;
 *
 * return (
 *   <Dashboard
 *     stats={stats.data}
 *     alerts={alerts.alerts}
 *     whales={whales.wallets}
 *     markets={markets.markets}
 *     onRefresh={refreshAll}
 *   />
 * );
 * ```
 */
export function useDashboardData(
  options: UseDashboardDataOptions = {}
): UseDashboardDataResult {
  const {
    statsEnabled = true,
    alertsEnabled = true,
    whalesEnabled = true,
    marketsEnabled = true,
    refreshInterval = 30000,
    alertsLimit = 20,
    whalesLimit = 10,
    marketsLimit = 10,
  } = options;

  const stats = useStats({ enabled: statsEnabled, refreshInterval });
  const alerts = useAlerts({
    enabled: alertsEnabled,
    refreshInterval,
    limit: alertsLimit,
  });
  const whales = useWhales({
    enabled: whalesEnabled,
    refreshInterval,
    limit: whalesLimit,
  });
  const markets = useMarkets({
    enabled: marketsEnabled,
    refreshInterval,
    limit: marketsLimit,
  });

  const isLoading =
    stats.isLoading || alerts.isLoading || whales.isLoading || markets.isLoading;

  const hasError = !!(stats.error || alerts.error || whales.error || markets.error);

  const refreshAll = async () => {
    await Promise.all([
      stats.mutate(),
      alerts.mutate(),
      whales.mutate(),
      markets.mutate(),
    ]);
  };

  return {
    stats,
    alerts,
    whales,
    markets,
    isLoading,
    hasError,
    refreshAll,
  };
}
