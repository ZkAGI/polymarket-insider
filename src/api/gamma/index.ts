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
  getMarketById,
  getMarketBySlug,
  getMarketOutcomes,
  getMarketOutcomesBySlug,
  getMarketVolumeHistory,
  getMarketVolumeHistoryBySlug,
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
} from "./types";

export type {
  GetActiveMarketsOptions,
  GetActiveMarketsResult,
  GetMarketByIdOptions,
  GetMarketBySlugOptions,
  GetMarketOutcomesOptions,
  GetMarketVolumeHistoryOptions,
} from "./markets";
