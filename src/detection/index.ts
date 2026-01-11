/**
 * Detection Module
 *
 * Exports detection services for identifying suspicious wallet activity,
 * fresh wallets, whale trades, and insider patterns.
 */

// DET-FRESH-001: Wallet Age Calculator
export {
  AgeCategory,
  DEFAULT_AGE_THRESHOLDS,
  WalletAgeCalculator,
  createWalletAgeCalculator,
  getSharedWalletAgeCalculator,
  setSharedWalletAgeCalculator,
  resetSharedWalletAgeCalculator,
  calculateWalletAge,
  batchCalculateWalletAge,
  checkWalletFreshness,
  getWalletAgeCategory,
  getWalletAgeSummary,
} from "./wallet-age";

export type {
  AgeCategoryThresholds,
  WalletAgeResult,
  WalletAgeOptions,
  BatchWalletAgeResult,
  WalletAgeSummary,
  WalletAgeCalculatorConfig,
} from "./wallet-age";
