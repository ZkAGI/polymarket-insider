/**
 * Polymarket Gamma API module
 *
 * Exports the API client and types for interacting with
 * the Polymarket Gamma API.
 */

export { GammaClient, GammaApiException, gammaClient, createGammaClient } from "./client";

export {
  getActiveMarkets,
  getAllActiveMarkets,
  getMarketsByCategory,
  getAllMarketsByCategory,
  getCategoryCounts,
  getMarketById,
  getMarketBySlug,
  getMarketOutcomes,
  getMarketOutcomesBySlug,
  getMarketVolumeHistory,
  getMarketVolumeHistoryBySlug,
  getMarketPriceHistory,
  getMarketPriceHistoryBySlug,
  getTrendingMarkets,
  parseSlugFromUrl,
} from "./markets";

export type {
  GammaOutcome,
  GammaMarket,
  GammaMarketsResponse,
  GammaApiError,
  GammaClientConfig,
  GammaRequestOptions,
  MarketOutcome,
  MarketOutcomesResult,
  TimeInterval,
  TimeRange,
  VolumeDataPoint,
  VolumeHistoryResult,
  PriceDataPoint,
  PriceHistoryResult,
} from "./types";

export { MarketCategory } from "./types";

export type {
  GetActiveMarketsOptions,
  GetActiveMarketsResult,
  GetMarketsByCategoryOptions,
  GetMarketsByCategoryResult,
  GetMarketByIdOptions,
  GetMarketBySlugOptions,
  GetMarketOutcomesOptions,
  GetMarketVolumeHistoryOptions,
  GetMarketPriceHistoryOptions,
  GetTrendingMarketsOptions,
  GetTrendingMarketsResult,
  TrendingSortBy,
} from "./markets";

// Pagination utilities
export {
  paginate,
  paginateEndpoint,
  paginateStream,
  paginateParallel,
  createPaginator,
} from "./paginate";

export type {
  PaginationConfig,
  PageFetchParams,
  PageResult,
  PaginatedResult,
  PaginateEndpointConfig,
} from "./paginate";

// Rate limiting utilities
export {
  RateLimiter,
  RateLimiterError,
  createRateLimiter,
  getSharedRateLimiter,
  resetSharedRateLimiter,
  withRateLimit,
  executeWithRateLimit,
} from "./rate-limiter";

export type { RateLimiterConfig, RateLimiterStats } from "./rate-limiter";

// Error handling utilities
export {
  ErrorHandler,
  GammaErrorType,
  ErrorSeverity,
  classifyError,
  calculateBackoffDelay,
  shouldRetry,
  createErrorContext,
  logError,
  createErrorHandler,
  getSharedErrorHandler,
  resetSharedErrorHandler,
  setSharedErrorHandler,
  withErrorHandling,
  withErrorHandlingOrThrow,
} from "./error-handler";

export type {
  ErrorHandlerConfig,
  ErrorLogger,
  ErrorContext,
  ErrorHandlerResult,
  WrapWithErrorHandlingOptions,
} from "./error-handler";

// Caching utilities
export {
  ResponseCache,
  createCache,
  getSharedCache,
  resetSharedCache,
  setSharedCache,
  CacheTTL,
  CacheKeyPrefix,
  marketCacheKey,
  marketBySlugCacheKey,
  activeMarketsCacheKey,
  trendingMarketsCacheKey,
  outcomesCacheKey,
  volumeHistoryCacheKey,
  priceHistoryCacheKey,
  withCache,
  withSharedCache,
} from "./cache";

export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheOptions,
  CacheLogger,
} from "./cache";
