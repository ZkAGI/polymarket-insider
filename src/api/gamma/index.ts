/**
 * Polymarket Gamma API module
 *
 * Exports the API client and types for interacting with
 * the Polymarket Gamma API.
 */

export {
  GammaClient,
  GammaApiException,
  gammaClient,
  createGammaClient,
} from "./client";

export { getActiveMarkets, getAllActiveMarkets } from "./markets";

export type {
  GammaOutcome,
  GammaMarket,
  GammaMarketsResponse,
  GammaApiError,
  GammaClientConfig,
  GammaRequestOptions,
} from "./types";

export type { GetActiveMarketsOptions, GetActiveMarketsResult } from "./markets";
