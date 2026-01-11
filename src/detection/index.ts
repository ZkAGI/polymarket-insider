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

// DET-FRESH-005: Wallet Funding Pattern Analyzer
export {
  FundingPatternType,
  FundingTimingCategory,
  DEFAULT_FUNDING_PATTERN_THRESHOLDS,
  FundingPatternAnalyzer,
  createFundingPatternAnalyzer,
  getSharedFundingPatternAnalyzer,
  setSharedFundingPatternAnalyzer,
  resetSharedFundingPatternAnalyzer,
  analyzeFundingPattern,
  batchAnalyzeFundingPattern,
  hasSuspiciousFundingPattern,
  hasFlashTrading,
  getFundingTimingCategory,
  getFundingPatternSummary,
} from "./funding-pattern";

export type {
  FundingDeposit,
  FirstTradeAfterFunding,
  FundingPatternResult,
  FundingRiskSummary,
  FundingPatternOptions,
  FundingPatternThresholds,
  BatchFundingPatternResult,
  FundingPatternSummary,
  FundingPatternAnalyzerConfig,
} from "./funding-pattern";

// DET-FRESH-006: Fresh Wallet Clustering
export {
  ClusterType,
  ClusterConfidenceLevel,
  DEFAULT_CLUSTERING_THRESHOLDS,
  FreshWalletClusterAnalyzer,
  createFreshWalletClusterAnalyzer,
  getSharedFreshWalletClusterAnalyzer,
  setSharedFreshWalletClusterAnalyzer,
  resetSharedFreshWalletClusterAnalyzer,
  analyzeWalletClusters,
  analyzeWalletClusterMembership,
  isWalletInCluster,
  hasHighCoordinationScore,
  getClusteringSummary,
} from "./fresh-wallet-clustering";

export type {
  ClusterCharacteristic,
  WalletCluster,
  FundingSourceCluster,
  TemporalCluster,
  TradingPatternMetrics,
  TradingPatternCluster,
  WalletClusteringResult,
  BatchClusteringResult,
  ClusteringSummary,
  ClusteringOptions,
  ClusteringThresholds,
  FreshWalletClusterAnalyzerConfig,
} from "./fresh-wallet-clustering";

// DET-FRESH-007: Wallet Reactivation Detector
export {
  ReactivationStatus,
  DormancySeverity,
  ActivityPatternType,
  DEFAULT_DORMANCY_SEVERITY_THRESHOLDS,
  WalletReactivationDetector,
  createWalletReactivationDetector,
  getSharedWalletReactivationDetector,
  setSharedWalletReactivationDetector,
  resetSharedWalletReactivationDetector,
  checkWalletReactivation,
  batchCheckWalletReactivation,
  isWalletDormant,
  wasWalletRecentlyReactivated,
  getWalletDaysSinceActivity,
  getReactivationSummary,
} from "./wallet-reactivation";

export type {
  ReactivationEvent,
  ActivityTimelineEntry,
  WalletReactivationResult,
  ReactivationCheckOptions,
  BatchReactivationResult,
  ReactivationSummary,
  WalletReactivationDetectorConfig,
  DormancySeverityThresholds,
} from "./wallet-reactivation";

// DET-FRESH-008: Fresh Wallet Confidence Scorer
export {
  ConfidenceLevel,
  SignalCategory,
  DEFAULT_SIGNAL_WEIGHTS,
  FreshWalletConfidenceScorer,
  createFreshWalletConfidenceScorer,
  getSharedFreshWalletConfidenceScorer,
  setSharedFreshWalletConfidenceScorer,
  resetSharedFreshWalletConfidenceScorer,
  scoreFreshWalletConfidence,
  batchScoreFreshWalletConfidence,
  isFreshWalletSuspicious,
  getConfidenceSummary,
} from "./fresh-wallet-confidence";

export type {
  SignalContribution,
  SignalCategoryBreakdown,
  FreshWalletConfidenceResult,
  ConfidenceScorerOptions,
  SignalWeights,
  BatchConfidenceResult,
  ConfidenceSummary,
  FreshWalletConfidenceScorerConfig,
} from "./fresh-wallet-confidence";
