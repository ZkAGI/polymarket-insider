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
