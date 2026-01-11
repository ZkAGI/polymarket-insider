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

// DET-FRESH-002: Fresh Wallet Threshold Configuration
export {
  FreshWalletAlertSeverity,
  DEFAULT_FRESH_WALLET_THRESHOLD,
  DEFAULT_SEVERITY_THRESHOLDS,
  DEFAULT_CATEGORY_THRESHOLDS,
  DEFAULT_TRADE_SIZE_THRESHOLDS,
  DEFAULT_TIME_MODIFIERS,
  DEFAULT_FRESH_WALLET_CONFIG,
  ENV_VARS,
  loadConfigFromEnv,
  FreshWalletConfigManager,
  createFreshWalletConfigManager,
  getSharedFreshWalletConfigManager,
  setSharedFreshWalletConfigManager,
  resetSharedFreshWalletConfigManager,
  getThresholdsForCategory,
  evaluateWalletFreshness,
  isFreshWalletDetectionEnabled,
  getFreshWalletConfig,
} from "./fresh-wallet-config";

export type {
  FreshWalletThreshold,
  SeverityThresholds,
  CategoryThresholds,
  FreshWalletConfig,
  FreshWalletConfigInput,
  ThresholdEvaluationResult,
} from "./fresh-wallet-config";

// DET-FRESH-003: Zero Trading History Detector
export {
  TradingHistoryStatus,
  WalletHistoryType,
  ZeroHistoryDetector,
  createZeroHistoryDetector,
  getSharedZeroHistoryDetector,
  setSharedZeroHistoryDetector,
  resetSharedZeroHistoryDetector,
  checkZeroHistory,
  batchCheckZeroHistory,
  hasNeverTradedOnPolymarket,
  isFirstPolymarketTrade,
  getPolymarketTradeCount,
  getZeroHistorySummary,
} from "./zero-history";

export type {
  ZeroHistoryCheckResult,
  ZeroHistoryCheckOptions,
  BatchZeroHistoryResult,
  ZeroHistorySummary,
  TradingStatusChange,
  ZeroHistoryDetectorConfig,
} from "./zero-history";

// DET-FRESH-004: First Trade Size Analyzer
export {
  FirstTradeSizeCategory,
  DEFAULT_FIRST_TRADE_THRESHOLDS,
  DEFAULT_FIRST_TRADE_STATS,
  FirstTradeSizeAnalyzer,
  createFirstTradeSizeAnalyzer,
  getSharedFirstTradeSizeAnalyzer,
  setSharedFirstTradeSizeAnalyzer,
  resetSharedFirstTradeSizeAnalyzer,
  analyzeFirstTradeSize,
  batchAnalyzeFirstTradeSize,
  isFirstTradeOutlier,
  getFirstTradeInfo,
  getFirstTradeSizeSummary,
} from "./first-trade-size";

export type {
  FirstTradeSizeResult,
  FirstTradeInfo,
  FirstTradeStats,
  FirstTradeSizeThresholds,
  FirstTradeSizeOptions,
  BatchFirstTradeSizeResult,
  FirstTradeSizeSummary,
  FirstTradeSizeAnalyzerConfig,
} from "./first-trade-size";
