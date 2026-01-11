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

// DET-FRESH-009: Wallet History Depth Analyzer
export {
  HistoryDepthCategory,
  DEFAULT_DEPTH_THRESHOLDS,
  DEFAULT_SCORE_WEIGHTS,
  WalletHistoryDepthAnalyzer,
  createWalletHistoryDepthAnalyzer,
  getSharedWalletHistoryDepthAnalyzer,
  setSharedWalletHistoryDepthAnalyzer,
  resetSharedWalletHistoryDepthAnalyzer,
  analyzeWalletHistoryDepth,
  batchAnalyzeWalletHistoryDepth,
  hasShallowWalletHistory,
  getWalletHistoryDepthScore,
  getWalletHistoryDepthCategory,
  getWalletTotalTransactionCount,
  getHistoryDepthSummary,
} from "./wallet-history-depth";

export type {
  TransactionTypeDistribution,
  ActivityMetrics,
  WalletHistoryDepthResult,
  DepthScoreFactor,
  HistoryDepthOptions,
  BatchHistoryDepthResult,
  HistoryDepthSummary,
  WalletHistoryDepthAnalyzerConfig,
  DepthThresholds,
  DepthScoreWeights,
} from "./wallet-history-depth";

// DET-FRESH-010: Fresh Wallet Alert Generator
export {
  FreshWalletAlertType,
  AlertStatus,
  DEFAULT_ALERT_CONDITIONS,
  FreshWalletAlertGenerator,
  createFreshWalletAlertGenerator,
  getSharedFreshWalletAlertGenerator,
  setSharedFreshWalletAlertGenerator,
  resetSharedFreshWalletAlertGenerator,
  generateFreshWalletAlerts,
  batchGenerateFreshWalletAlerts,
  shouldTriggerFreshWalletAlert,
  getFreshWalletAlerts,
  getFreshWalletAlertSummary,
} from "./fresh-wallet-alert";

export type {
  FreshWalletAlertContext,
  FreshWalletAlert,
  AlertCondition,
  GenerateAlertOptions,
  BatchAlertResult,
  AlertSummary,
  AlertListener,
  FreshWalletAlertGeneratorConfig,
} from "./fresh-wallet-alert";

// DET-VOL-001: Market Baseline Volume Calculator
export {
  MarketMaturity,
  BaselineWindow,
  VolumeBaselineCalculator,
  createVolumeBaselineCalculator,
  getSharedVolumeBaselineCalculator,
  setSharedVolumeBaselineCalculator,
  resetSharedVolumeBaselineCalculator,
  calculateMarketVolumeBaseline,
  batchCalculateMarketVolumeBaselines,
  checkVolumeAnomaly,
  getMarketBaselineSummary,
} from "./volume-baseline";

export type {
  WindowVolumeStats,
  MarketVolumeBaseline,
  CalculateBaselineOptions,
  BatchBaselineResult,
  BaselineSummary,
  VolumeBaselineCalculatorConfig,
} from "./volume-baseline";

// DET-VOL-002: Rolling Volume Average Tracker
export {
  RollingWindow,
  WINDOW_DURATION_MS,
  WINDOW_DURATION_MINUTES,
  ALL_ROLLING_WINDOWS,
  RollingVolumeTracker,
  createRollingVolumeTracker,
  getSharedRollingVolumeTracker,
  setSharedRollingVolumeTracker,
  resetSharedRollingVolumeTracker,
  addVolumeData,
  getMarketRollingAverages,
  batchGetRollingAverages,
  isVolumeAnomalous,
  getRollingVolumesSummary,
} from "./rolling-volume";

export type {
  VolumeDataEntry,
  RollingAverageResult,
  MarketRollingAverages,
  VolumeThresholdBreach,
  RollingVolumeTrackerConfig,
  AddVolumeOptions,
  GetRollingAveragesOptions,
  BatchRollingAveragesResult,
  RollingAveragesSummary,
} from "./rolling-volume";

// DET-VOL-003: Volume Spike Detector
export {
  VolumeSpikeType,
  SpikeSeverity,
  SpikeDirection,
  DEFAULT_SPIKE_THRESHOLDS,
  DEFAULT_SUSTAINED_CONFIG,
  VolumeSpikeDetector,
  createVolumeSpikeDetector,
  getSharedVolumeSpikeDetector,
  setSharedVolumeSpikeDetector,
  resetSharedVolumeSpikeDetector,
  detectVolumeSpike,
  batchDetectVolumeSpikes,
  isMarketInSpike,
  getSpikeDetectionSummary,
  getRecentVolumeSpikes,
} from "./volume-spike";

export type {
  SpikeThresholdConfig,
  SustainedSpikeConfig,
  VolumeSpikeEvent,
  SpikeDetectionResult,
  VolumeSpikeDetectorConfig,
  DetectSpikeOptions,
  BatchSpikeDetectionResult,
  SpikeDetectionSummary,
} from "./volume-spike";

// DET-VOL-004: Individual Trade Size Analyzer
export {
  TradeSizeCategory,
  TradeSizeSeverity,
  ThresholdMethod,
  DEFAULT_PERCENTILE_THRESHOLDS,
  DEFAULT_ZSCORE_THRESHOLDS,
  DEFAULT_ABSOLUTE_THRESHOLDS,
  DEFAULT_TRADE_SIZE_THRESHOLD_CONFIG,
  TradeSizeAnalyzer,
  createTradeSizeAnalyzer,
  getSharedTradeSizeAnalyzer,
  setSharedTradeSizeAnalyzer,
  resetSharedTradeSizeAnalyzer,
  analyzeTrade,
  analyzeTrades,
  isTradeOutlier,
  getTradeSizePercentileRank,
  getMarketTradeSizeStats,
  getTradeSizeAnalyzerSummary,
  getRecentLargeTrades,
} from "./trade-size";

export type {
  TradeEntry,
  TradeSizePercentiles,
  MarketTradeSizeStats,
  TradeSizeThresholdConfig,
  TradeSizeAnalysisResult,
  LargeTradeEvent,
  WalletLargeTradeStats,
  MarketLargeTradeStats,
  BatchTradeSizeAnalysisResult,
  TradeSizeAnalyzerSummary,
  TradeSizeAnalyzerConfig,
  AnalyzeTradeOptions,
} from "./trade-size";

// DET-VOL-005: Whale Trade Threshold Calculator
export {
  LiquidityLevel,
  ThresholdStrategy,
  WhaleThresholdTier,
  DEFAULT_LIQUIDITY_PERCENTAGES,
  DEFAULT_VOLUME_PERCENTAGES,
  DEFAULT_IMPACT_THRESHOLDS,
  DEFAULT_FIXED_THRESHOLDS,
  DEFAULT_MINIMUM_THRESHOLDS,
  DEFAULT_MAXIMUM_THRESHOLDS,
  DEFAULT_COMBINED_WEIGHTS,
  DEFAULT_LIQUIDITY_CLASSIFICATION,
  DEFAULT_THRESHOLD_CONFIG,
  WhaleThresholdCalculator,
  createWhaleThresholdCalculator,
  getSharedWhaleThresholdCalculator,
  setSharedWhaleThresholdCalculator,
  resetSharedWhaleThresholdCalculator,
  calculateWhaleThresholds,
  batchCalculateWhaleThresholds,
  isWhaleTradeSize,
  getTierForTradeSize,
  getCachedWhaleThresholds,
  getWhaleThresholdSummary,
} from "./whale-threshold";

export type {
  LiquidityData,
  VolumeData,
  WhaleThresholds,
  ThresholdConfig,
  CalculateThresholdOptions,
  ThresholdChangeEvent,
  BatchThresholdResult,
  ThresholdCalculatorSummary,
  WhaleThresholdCalculatorConfig,
} from "./whale-threshold";

// DET-VOL-006: Volume-to-Liquidity Ratio Analyzer
export {
  RatioSeverity,
  LiquidityMeasure,
  TradeDirection,
  DEFAULT_RATIO_THRESHOLDS,
  VolumeLiquidityRatioAnalyzer,
  createVolumeLiquidityRatioAnalyzer,
  getSharedVolumeLiquidityRatioAnalyzer,
  setSharedVolumeLiquidityRatioAnalyzer,
  resetSharedVolumeLiquidityRatioAnalyzer,
  analyzeVolumeLiquidityRatio,
  batchAnalyzeVolumeLiquidityRatio,
  isHighRatioTrade,
  updateOrderBookCache,
  getMarketRatioStats,
  getRatioAnalyzerSummary,
} from "./volume-liquidity-ratio";

export type {
  OrderBookSnapshot,
  TradeForRatioAnalysis,
  RatioAnalysisResult,
  RatioHistoryEntry,
  MarketRatioStats,
  HighRatioAlertEvent,
  RatioThresholdConfig,
  VolumeLiquidityRatioAnalyzerConfig,
  AnalyzeRatioOptions,
  BatchRatioAnalysisResult,
  RatioAnalyzerSummary,
} from "./volume-liquidity-ratio";

// DET-VOL-007: Time-of-Day Volume Normalizer
export {
  DayOfWeek,
  TimePeriod,
  OffHoursAnomalySeverity,
  TimeOfDayNormalizer,
  createTimeOfDayNormalizer,
  getSharedTimeOfDayNormalizer,
  setSharedTimeOfDayNormalizer,
  resetSharedTimeOfDayNormalizer,
  addVolumeForTimeProfile,
  getTimeOfDayProfile,
  normalizeVolumeForTimeOfDay,
  checkOffHoursAnomaly,
  getExpectedVolumeForTime,
  getCurrentTimePeriod,
  getTimeOfDayNormalizerSummary,
} from "./time-of-day-normalizer";

export type {
  HourlyVolumeStats,
  DayOfWeekProfile,
  TimeOfDayProfile,
  VolumeDataPoint as TimeOfDayVolumeDataPoint,
  NormalizedVolumeResult,
  OffHoursAnomalyEvent,
  TimeOfDayNormalizerConfig,
  NormalizeVolumeOptions,
  BatchNormalizeOptions,
  BatchNormalizeResult,
  TimeOfDayNormalizerSummary,
} from "./time-of-day-normalizer";

// DET-VOL-008: Consecutive Large Trade Detector
export {
  BurstPatternType,
  BurstSeverity,
  BurstState,
  DEFAULT_BURST_THRESHOLDS,
  ConsecutiveLargeTradeDetector,
  createConsecutiveLargeTradeDetector,
  getSharedConsecutiveLargeTradeDetector,
  setSharedConsecutiveLargeTradeDetector,
  resetSharedConsecutiveLargeTradeDetector,
  processTradeForBurst,
  processTradesForBurst,
  isMarketInBurstState,
  isWalletInBurstState,
  getRecentBurstEvents,
  getBurstDetectorSummary,
} from "./consecutive-large-trades";

export type {
  SequenceTrade,
  BurstDetectionResult,
  BurstEvent,
  BurstThresholdConfig,
  ConsecutiveLargeTradeDetectorConfig,
  ProcessTradeOptions,
  BatchBurstDetectionResult,
  BurstDetectorSummary,
} from "./consecutive-large-trades";

// DET-VOL-009: Market Impact Calculator
export {
  ImpactSeverity,
  ImpactAnomalyType,
  TradeDirection as ImpactTradeDirection,
  LiquidityLevel as ImpactLiquidityLevel,
  DEFAULT_IMPACT_SEVERITY_THRESHOLDS,
  DEFAULT_EXCESSIVE_THRESHOLDS,
  DEFAULT_REVERSAL_CONFIG,
  MarketImpactCalculator,
  createMarketImpactCalculator,
  getSharedMarketImpactCalculator,
  setSharedMarketImpactCalculator,
  resetSharedMarketImpactCalculator,
  calculateMarketImpact,
  batchCalculateMarketImpact,
  hasExcessiveImpact,
  getTradeImpactSeverity,
  getRecentHighImpactEvents,
  getMarketImpactSummary,
} from "./market-impact";

export type {
  ImpactTradeData,
  MarketLiquidityData,
  MarketImpactResult,
  HighImpactEvent,
  ImpactSeverityThresholds,
  ExcessiveImpactThresholds,
  ReversalDetectionConfig,
  MarketImpactCalculatorConfig,
  CalculateImpactOptions,
  BatchImpactResult,
  MarketImpactSummary,
} from "./market-impact";

// DET-VOL-010: Unusual Volume Alert Generator
export {
  UnusualVolumeAlertType,
  VolumeAlertSeverity,
  VolumeAlertStatus,
  DEFAULT_VOLUME_ALERT_CONDITIONS,
  UnusualVolumeAlertGenerator,
  createUnusualVolumeAlertGenerator,
  getSharedUnusualVolumeAlertGenerator,
  setSharedUnusualVolumeAlertGenerator,
  resetSharedUnusualVolumeAlertGenerator,
  generateVolumeAlertFromSpike,
  generateVolumeAlertFromLargeTrade,
  generateVolumeAlertFromHighImpact,
  generateVolumeAlertFromBurst,
  getUnusualVolumeAlerts,
  getUnusualVolumeAlertSummary,
} from "./unusual-volume-alert";

export type {
  VolumeComparisonData,
  VolumeAlertContext,
  UnusualVolumeAlert,
  VolumeAlertCondition,
  GenerateVolumeAlertOptions,
  ProcessSpikeResult,
  ProcessLargeTradeResult,
  ProcessHighImpactResult,
  ProcessBurstResult,
  BatchVolumeAlertResult,
  VolumeAlertSummary,
  VolumeAlertListener,
  UnusualVolumeAlertGeneratorConfig,
} from "./unusual-volume-alert";

// DET-VOL-011: Volume Clustering Analyzer
export {
  CoordinationType,
  ClusterSeverity,
  DEFAULT_CLUSTER_THRESHOLDS,
  VolumeClusteringAnalyzer,
  createVolumeClusteringAnalyzer,
  getSharedVolumeClusteringAnalyzer,
  setSharedVolumeClusteringAnalyzer,
  resetSharedVolumeClusteringAnalyzer,
  analyzeTradesForClustering,
  analyzeTradesWithSlidingWindow,
  analyzeMultipleMarketsForClustering,
  getRecentVolumeClusters,
  getMarketVolumeClusters,
  getWalletVolumeClusters,
  getVolumeClusteringSummary,
} from "./volume-clustering";

export type {
  ClusterTrade,
  VolumeCluster,
  ClusterDetectionResult,
  BatchClusterDetectionResult,
  ClusterThresholdConfig,
  VolumeClusteringAnalyzerConfig,
  AnalyzeTradesOptions,
  ClusteringAnalyzerSummary,
} from "./volume-clustering";

// DET-VOL-012: Pre-Event Volume Spike Detector
export {
  EventType,
  PreEventWindow,
  PreEventSeverity,
  VolumeDirection,
  PRE_EVENT_WINDOW_DURATION_MS,
  PRE_EVENT_WINDOW_HOURS,
  ALL_PRE_EVENT_WINDOWS,
  DEFAULT_PRE_EVENT_THRESHOLDS,
  getPreEventWindow,
  PreEventVolumeDetector,
  createPreEventVolumeDetector,
  getSharedPreEventVolumeDetector,
  setSharedPreEventVolumeDetector,
  resetSharedPreEventVolumeDetector,
  registerMarketEvent,
  analyzePreEventVolume,
  batchAnalyzePreEventVolume,
  isInPreEventPeriod,
  getCurrentPreEventWindow,
  getRecentPreEventSpikes,
  getPreEventDetectorSummary,
  addHistoricalPreEventData,
} from "./pre-event-volume";

export type {
  MarketEvent,
  PreEventPattern,
  PreEventAnalysis,
  PreEventVolumeSpike,
  PreEventThresholdConfig,
  PreEventVolumeDetectorConfig,
  AnalyzePreEventOptions,
  RegisterEventOptions,
  BatchPreEventAnalysisResult,
  PreEventDetectorSummary,
} from "./pre-event-volume";

// DET-NICHE-001: Market Category Classifier
export {
  ClassificationConfidence,
  DEFAULT_CATEGORY_PATTERNS,
  HIGH_INSIDER_CATEGORIES,
  MarketCategoryClassifier,
  createMarketCategoryClassifier,
  getSharedMarketCategoryClassifier,
  setSharedMarketCategoryClassifier,
  resetSharedMarketCategoryClassifier,
  classifyMarket,
  classifyMarkets,
  isMarketInCategory,
  getMarketsByCategory,
  getHighInsiderPotentialMarkets,
  getClassificationSummary,
} from "./market-category-classifier";

export type {
  KeywordPattern,
  CategoryPatterns,
  CategoryScore,
  MarketForClassification,
  MarketClassificationResult,
  ClassifyMarketOptions,
  BatchClassificationResult,
  ClassificationSummary,
  MarketCategoryClassifierConfig,
} from "./market-category-classifier";

// DET-NICHE-002: Information-Advantage Market Identifier
export {
  InformationAdvantageType,
  InformationAdvantageTier,
  DEFAULT_CATEGORY_CONFIGS,
  CROSS_CATEGORY_HIGH_VALUE_KEYWORDS,
  InformationAdvantageIdentifier,
  createInformationAdvantageIdentifier,
  getSharedInformationAdvantageIdentifier,
  setSharedInformationAdvantageIdentifier,
  resetSharedInformationAdvantageIdentifier,
  analyzeMarketInformationAdvantage,
  analyzeMarketsInformationAdvantage,
  getHighValueMarketsForInsiderPotential,
  isHighValueMarketForInsider,
  getRankedMarketsForInsiderValue,
  getInformationAdvantageSummary,
} from "./information-advantage-identifier";

export type {
  HighValueKeywordPattern,
  CategoryAdvantageConfig,
  AsymmetryFactor,
  InformationAdvantageResult,
  AnalyzeMarketOptions,
  BatchAnalysisResult as InformationAdvantageBatchResult,
  MarketRanking,
  IdentifierSummary,
  InformationAdvantageIdentifierConfig,
} from "./information-advantage-identifier";

// DET-NICHE-003: Geopolitical Event Market Tagger
export {
  GeopoliticalRegion,
  GeopoliticalEventType,
  GeopoliticalActor,
  TagConfidence,
  DEFAULT_GEOPOLITICAL_KEYWORDS,
  DEFAULT_GEOPOLITICAL_SITUATIONS,
  GeopoliticalEventTagger,
  createGeopoliticalEventTagger,
  getSharedGeopoliticalEventTagger,
  setSharedGeopoliticalEventTagger,
  resetSharedGeopoliticalEventTagger,
  tagMarket,
  tagMarkets,
  isGeopoliticalMarket,
  getGeopoliticalMarketsByRegion,
  getGeopoliticalMarketsByEventType,
  getGeopoliticalMarketsByActor,
  getGeopoliticalMarketsBySituation,
  getRelatedGeopoliticalMarkets,
  linkRelatedGeopoliticalMarkets,
  getGeopoliticalTaggerSummary,
} from "./geopolitical-event-tagger";

export type {
  GeopoliticalTag,
  GeopoliticalTagResult,
  MarketForGeopoliticalTagging,
  GeopoliticalKeyword,
  GeopoliticalSituation,
  TagMarketOptions,
  BatchTaggingResult,
  TaggerSummary,
  GeopoliticalEventTaggerConfig,
} from "./geopolitical-event-tagger";

// DET-NICHE-004: Political Market Identifier
export {
  PoliticalEventCategory,
  PoliticalJurisdiction,
  PoliticalParty,
  PoliticalOffice,
  PoliticalConfidence,
  DEFAULT_POLITICAL_KEYWORDS,
  DEFAULT_POLITICAL_FIGURES,
  PoliticalMarketIdentifier,
  createPoliticalMarketIdentifier,
  getSharedPoliticalMarketIdentifier,
  setSharedPoliticalMarketIdentifier,
  resetSharedPoliticalMarketIdentifier,
  identifyPoliticalMarket,
  identifyPoliticalMarkets,
  isPoliticalMarket,
  isElectionMarket,
  isPolicyMarket,
  getPoliticalMarkets,
  getElectionMarkets,
  getPolicyMarkets,
  getPoliticalIdentifierSummary,
} from "./political-market-identifier";

export type {
  PoliticalTag,
  PoliticalMarketResult,
  MarketForPoliticalIdentification,
  PoliticalKeyword,
  PoliticalFigure,
  IdentifyPoliticalOptions,
  BatchPoliticalIdentificationResult,
  PoliticalIdentifierSummary,
  PoliticalMarketIdentifierConfig,
} from "./political-market-identifier";

// DET-NICHE-005: Regulatory Decision Market Detector
export {
  RegulatoryAgency,
  RegulatoryDecisionType,
  RegulatorySector,
  RegulatoryJurisdiction,
  RegulatoryConfidence,
  InsiderAdvantageLevel,
  DEFAULT_REGULATORY_KEYWORDS,
  RegulatoryDecisionDetector,
  createRegulatoryDecisionDetector,
  getSharedRegulatoryDecisionDetector,
  setSharedRegulatoryDecisionDetector,
  resetSharedRegulatoryDecisionDetector,
  detectRegulatoryMarket,
  detectRegulatoryMarkets,
  isRegulatoryMarket,
  getRegulatoryMarkets,
  getRegulatoryMarketsByAgency,
  getRegulatoryMarketsByDecisionType,
  getRegulatoryMarketsBySector,
  getHighInsiderAdvantageRegulatoryMarkets,
  getRegulatoryDetectorSummary,
} from "./regulatory-decision-detector";

export type {
  RegulatoryTag,
  RegulatoryDeadline,
  RegulatoryMarketResult,
  MarketForRegulatoryDetection,
  RegulatoryKeyword,
  DetectRegulatoryOptions,
  BatchRegulatoryDetectionResult,
  RegulatoryDetectorSummary,
  RegulatoryDecisionDetectorConfig,
} from "./regulatory-decision-detector";

// DET-NICHE-006: Market Liquidity Scorer
export {
  LiquidityCategory,
  LiquidityConfidence,
  ThinMarketSeverity,
  MarketLiquidityScorer,
  createMarketLiquidityScorer,
  getSharedMarketLiquidityScorer,
  setSharedMarketLiquidityScorer,
  resetSharedMarketLiquidityScorer,
  scoreMarketLiquidity,
  scoreMarketsLiquidity,
  isThinMarket,
  getThinMarkets,
  getHighInsiderAdvantageMarkets,
  getLiquidityScorerSummary,
} from "./market-liquidity-scorer";

export type {
  OrderBookData,
  TradeVolumeStats,
  MarketLiquidityScore,
  ThinMarketAlert,
  BatchLiquidityScoreResult,
  LiquidityScorerSummary,
  ScoreLiquidityOptions,
  MarketLiquidityScorerConfig,
} from "./market-liquidity-scorer";

// DET-NICHE-007: Niche Market Watchlist Manager
export {
  WatchlistPriority,
  WatchlistReason,
  WatchlistStatus,
  WatchlistEventType,
  NicheMarketWatchlist,
  createNicheMarketWatchlist,
  getSharedNicheMarketWatchlist,
  setSharedNicheMarketWatchlist,
  resetSharedNicheMarketWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isOnWatchlist,
  getWatchlistEntry,
  getActiveWatchlistEntries,
  getTopPriorityWatchlistEntries,
  getWatchlistSummary,
  getWatchlistStatistics,
} from "./niche-market-watchlist";

export type {
  WatchlistMarketData,
  WatchlistEntry,
  WatchlistEvent,
  AddToWatchlistOptions,
  UpdateWatchlistOptions,
  WatchlistFilterOptions,
  WatchlistStatistics,
  WatchlistSummary,
  NicheMarketWatchlistConfig,
} from "./niche-market-watchlist";

// DET-NICHE-008: Wallet Niche Market Concentration Analyzer
export {
  ConcentrationLevel,
  SpecialistType,
  ConcentrationSuspicion,
  DEFAULT_HIGH_VALUE_CATEGORIES,
  WalletConcentrationAnalyzer,
  createWalletConcentrationAnalyzer,
  getSharedWalletConcentrationAnalyzer,
  setSharedWalletConcentrationAnalyzer,
  resetSharedWalletConcentrationAnalyzer,
  addTradesForConcentration,
  analyzeWalletConcentration,
  batchAnalyzeWalletConcentration,
  isWalletSpecialist,
  hasHighWalletConcentration,
  getCategorySpecialists,
  getSuspiciousWallets,
  getWalletConcentrationScore,
  getConcentrationAnalysisSummary,
} from "./wallet-concentration";

export type {
  TradeForConcentration,
  CategoryStats,
  WalletConcentrationResult,
  ConcentrationAnalysisOptions,
  BatchConcentrationResult,
  ConcentrationSummary,
  WalletConcentrationAnalyzerConfig,
} from "./wallet-concentration";

// DET-NICHE-009: Cross-Market Correlation Detector
export {
  MarketRelationType,
  CorrelationType,
  CorrelationSeverity,
  CorrelationStatus,
  DEFAULT_CORRELATION_THRESHOLDS,
  CrossMarketCorrelationDetector,
  createCrossMarketCorrelationDetector,
  getSharedCrossMarketCorrelationDetector,
  setSharedCrossMarketCorrelationDetector,
  resetSharedCrossMarketCorrelationDetector,
  addMarketRelation,
  areMarketsRelated,
  analyzeCrossMarketCorrelation,
  analyzeMultipleMarketPairCorrelations,
  getRecentCrossMarketCorrelations,
  getMarketCrossMarketCorrelations,
  getWalletCrossMarketCorrelations,
  getCrossMarketCorrelationSummary,
  autoDetectMarketRelations,
} from "./cross-market-correlation";

export type {
  CorrelationTrade,
  MarketRelation,
  CrossMarketTradePair,
  CrossMarketCorrelation,
  CorrelationAnalysisResult,
  BatchCorrelationResult,
  CorrelationSummary,
  CorrelationThresholdConfig,
  CrossMarketCorrelationDetectorConfig,
  AnalyzeCorrelationOptions,
} from "./cross-market-correlation";

// DET-NICHE-010: Niche Market Alert Generator
export {
  NicheMarketAlertType,
  NicheAlertSeverity,
  NicheAlertStatus,
  DEFAULT_NICHE_ALERT_CONDITIONS,
  NicheMarketAlertGenerator,
  createNicheMarketAlertGenerator,
  getSharedNicheMarketAlertGenerator,
  setSharedNicheMarketAlertGenerator,
  resetSharedNicheMarketAlertGenerator,
  generateNicheMarketAlerts,
  getNicheMarketAlertsByType,
  getNicheMarketAlertsBySeverity,
  getNicheMarketAlertSummary,
  shouldTriggerNicheAlert,
  getNicheMarketAlertsForMarket,
} from "./niche-market-alert";

export type {
  NicheMarketContext,
  NicheWalletContext,
  NicheCorrelationContext,
  NicheAlertContext,
  NicheMarketAlert,
  NicheAlertCondition,
  GenerateNicheAlertOptions,
  ProcessAlertResult,
  BatchNicheAlertResult,
  NicheAlertSummary,
  NicheAlertListener,
  NicheMarketAlertGeneratorConfig,
} from "./niche-market-alert";

// DET-PAT-001: Wallet Behavior Profiler
export {
  TradingFrequency,
  TradingStyle,
  RiskAppetite,
  ProfileConfidence,
  BehaviorFlag,
  DEFAULT_PROFILER_CONFIG,
  WalletBehaviorProfiler,
  createWalletBehaviorProfiler,
  getSharedWalletBehaviorProfiler,
  setSharedWalletBehaviorProfiler,
  resetSharedWalletBehaviorProfiler,
  buildWalletBehaviorProfile,
  updateWalletBehaviorProfile,
  getWalletBehaviorProfile,
  batchBuildWalletBehaviorProfiles,
  hasHighSuspicionProfile,
  getPotentialInsiderProfiles,
  getWalletBehaviorProfilerSummary,
} from "./wallet-behavior-profiler";

export type {
  ProfileTrade,
  TimeDistribution,
  MarketPreferences,
  PositionSizing,
  PerformanceMetrics,
  TradingPatterns,
  WalletBehaviorProfile,
  BuildProfileOptions,
  UpdateProfileOptions,
  BatchProfileResult,
  ProfileSummary,
  WalletBehaviorProfilerConfig,
} from "./wallet-behavior-profiler";

// DET-PAT-002: Trading Pattern Classifier
export {
  TradingPatternType,
  PatternConfidence,
  PatternFeature,
  PatternRiskFlag,
  DEFAULT_CLASSIFIER_CONFIG,
  DEFAULT_PATTERN_DEFINITIONS,
  TradingPatternClassifier,
  createTradingPatternClassifier,
  getSharedTradingPatternClassifier,
  setSharedTradingPatternClassifier,
  resetSharedTradingPatternClassifier,
  classifyTradingPattern,
  updateTradingPatternClassification,
  getTradingPatternClassification,
  batchClassifyTradingPatterns,
  hasHighRiskPattern,
  getWalletsWithPotentialInsiderPattern,
  getTradingPatternClassifierSummary,
  isSuspiciousPattern,
  getPatternDescription,
} from "./trading-pattern-classifier";

export type {
  PatternTrade,
  ExtractedFeatures,
  FeatureContribution,
  PatternMatch,
  PatternClassificationResult,
  PatternDefinition,
  BatchClassificationResult as PatternBatchClassificationResult,
  ClassificationSummary as PatternClassificationSummary,
  TradingPatternClassifierConfig,
} from "./trading-pattern-classifier";

// DET-PAT-003: Timing Pattern Analyzer
export {
  TimeOfDayPeriod,
  DayOfWeekType,
  TimingPatternType,
  TimingSuspicionLevel,
  TimingAnomalyType,
  DEFAULT_TIMING_ANALYZER_CONFIG,
  TimingPatternAnalyzer,
  createTimingPatternAnalyzer,
  getSharedTimingPatternAnalyzer,
  setSharedTimingPatternAnalyzer,
  resetSharedTimingPatternAnalyzer,
  analyzeTimingPattern,
  batchAnalyzeTimingPatterns,
  hasSuspiciousTiming,
  getCachedTimingAnalysis,
  getWalletsWithSuspiciousTiming,
  getTimingAnalyzerSummary,
  addTradesForTimingAnalysis,
  getTimingPatternDescription,
  getSuspicionLevelDescription,
} from "./timing-pattern-analyzer";

export type {
  TimingTrade,
  HourDistribution,
  DayDistribution,
  PeriodDistribution,
  IntervalStats,
  TimingAnomaly,
  TimingPatternResult,
  TimingPatternAnalyzerConfig,
  AnalyzeTimingOptions,
  BatchTimingAnalysisResult,
  TimingAnalyzerSummary,
} from "./timing-pattern-analyzer";
