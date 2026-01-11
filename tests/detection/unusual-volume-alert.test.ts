/**
 * Tests for Unusual Volume Alert Generator (DET-VOL-010)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
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
  type UnusualVolumeAlertGeneratorConfig,
  type VolumeAlertCondition,
} from "../../src/detection/unusual-volume-alert";
import {
  VolumeSpikeType,
  SpikeSeverity,
  SpikeDirection,
  RollingWindow,
  type VolumeSpikeEvent,
} from "../../src/detection";
import {
  TradeSizeCategory,
  TradeSizeSeverity,
  type LargeTradeEvent,
} from "../../src/detection/trade-size";
import {
  ImpactSeverity,
  ImpactAnomalyType,
  TradeDirection,
  LiquidityLevel,
  type HighImpactEvent,
} from "../../src/detection/market-impact";
import {
  BurstSeverity,
  BurstPatternType,
  type BurstEvent,
} from "../../src/detection/consecutive-large-trades";
import { RollingVolumeTracker, resetSharedRollingVolumeTracker } from "../../src/detection/rolling-volume";
import { VolumeSpikeDetector, resetSharedVolumeSpikeDetector } from "../../src/detection/volume-spike";
import { TradeSizeAnalyzer, resetSharedTradeSizeAnalyzer } from "../../src/detection/trade-size";
import { MarketImpactCalculator, resetSharedMarketImpactCalculator } from "../../src/detection/market-impact";
import { ConsecutiveLargeTradeDetector, resetSharedConsecutiveLargeTradeDetector } from "../../src/detection/consecutive-large-trades";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create a mock volume spike event
 */
function createMockSpikeEvent(options: Partial<VolumeSpikeEvent> = {}): VolumeSpikeEvent {
  return {
    eventId: options.eventId ?? `spike_${Date.now()}`,
    marketId: options.marketId ?? "market-1",
    spikeType: options.spikeType ?? VolumeSpikeType.SUDDEN,
    severity: options.severity ?? SpikeSeverity.HIGH,
    direction: options.direction ?? SpikeDirection.UP,
    window: options.window ?? RollingWindow.FIVE_MINUTES,
    currentVolume: options.currentVolume ?? 500,
    baselineVolume: options.baselineVolume ?? 100,
    baselineStdDev: options.baselineStdDev ?? 20,
    zScore: options.zScore ?? 4.0,
    percentageOfBaseline: options.percentageOfBaseline ?? 5.0,
    detectedAt: options.detectedAt ?? new Date(),
    startTime: options.startTime ?? new Date(),
    durationMinutes: options.durationMinutes ?? 2,
    consecutivePoints: options.consecutivePoints ?? 3,
    peakVolume: options.peakVolume ?? 550,
    context: options.context ?? {
      isRecurring: false,
      previousSpikeTime: null,
      spikesLastHour: 0,
      dataReliability: 0.8,
    },
  };
}

/**
 * Create a mock large trade event
 */
function createMockLargeTradeEvent(options: {
  eventId?: string;
  trade?: {
    tradeId?: string;
    marketId?: string;
    sizeUsd?: number;
    timestamp?: number;
    walletAddress?: string;
    side?: "BUY" | "SELL";
    price?: number;
    outcome?: string;
  };
  marketId?: string;
  category?: TradeSizeCategory;
  severity?: TradeSizeSeverity;
  percentileRank?: number;
  zScore?: number;
  timesMedian?: number;
  detectedAt?: Date;
  marketStats?: {
    averageSizeUsd: number;
    medianSizeUsd: number;
    tradeCount: number;
  };
  context?: {
    walletRecentLargeTradeCount: number;
    marketRecentLargeTradeCount: number;
    isRepeatLargeTrader: boolean;
  };
} = {}): LargeTradeEvent {
  const marketId = options.trade?.marketId ?? options.marketId ?? "market-1";
  return {
    eventId: options.eventId ?? `trade_${Date.now()}`,
    trade: {
      tradeId: options.trade?.tradeId ?? "trade-123",
      marketId: marketId,
      sizeUsd: options.trade?.sizeUsd ?? 50000,
      timestamp: options.trade?.timestamp ?? Date.now(),
      walletAddress: options.trade?.walletAddress ?? "0x1234567890abcdef1234567890abcdef12345678",
      side: options.trade?.side ?? "BUY",
    },
    category: options.category ?? TradeSizeCategory.WHALE,
    severity: options.severity ?? TradeSizeSeverity.HIGH,
    percentileRank: options.percentileRank ?? 99.5,
    zScore: options.zScore ?? 3.5,
    timesMedian: options.timesMedian ?? 50,
    detectedAt: options.detectedAt ?? new Date(),
    marketStats: options.marketStats ?? {
      averageSizeUsd: 1000,
      medianSizeUsd: 500,
      tradeCount: 1000,
    },
    context: options.context ?? {
      walletRecentLargeTradeCount: 2,
      marketRecentLargeTradeCount: 5,
      isRepeatLargeTrader: true,
    },
  };
}

/**
 * Create a mock high impact event
 */
function createMockHighImpactEvent(options: Partial<HighImpactEvent> = {}): HighImpactEvent {
  return {
    eventId: options.eventId ?? `impact_${Date.now()}`,
    trade: {
      tradeId: options.trade?.tradeId ?? "trade-456",
      marketId: options.trade?.marketId ?? "market-1",
      walletAddress: options.trade?.walletAddress ?? "0x1234567890abcdef1234567890abcdef12345678",
      direction: options.trade?.direction ?? TradeDirection.BUY,
      sizeUsd: options.trade?.sizeUsd ?? 30000,
      timestamp: options.trade?.timestamp ?? Date.now(),
      priceBefore: options.trade?.priceBefore ?? 0.5,
      priceAfter: options.trade?.priceAfter ?? 0.55,
    },
    impactResult: {
      trade: {
        tradeId: "trade-456",
        marketId: "market-1",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        direction: TradeDirection.BUY,
        sizeUsd: 30000,
        timestamp: Date.now(),
        priceBefore: 0.5,
        priceAfter: 0.55,
      },
      actualImpact: options.impactResult?.actualImpact ?? 0.05,
      absoluteImpact: options.impactResult?.absoluteImpact ?? 0.05,
      impactBps: options.impactResult?.impactBps ?? 500,
      slippage: options.impactResult?.slippage ?? 0.02,
      slippageBps: options.impactResult?.slippageBps ?? 200,
      expectedImpact: options.impactResult?.expectedImpact ?? 0.02,
      impactRatio: options.impactResult?.impactRatio ?? 2.5,
      isExcessive: options.impactResult?.isExcessive ?? true,
      severity: options.severity ?? ImpactSeverity.HIGH,
      anomalyType: options.anomalyType ?? ImpactAnomalyType.EXCESSIVE_IMPACT,
      isAnomaly: true,
      analyzedAt: new Date(),
      context: {
        sizePercentOfDailyVolume: 5,
        sizePercentOfDepth: 10,
        liquidityLevel: LiquidityLevel.MEDIUM,
        hasLiquidityData: true,
      },
    },
    severity: options.severity ?? ImpactSeverity.HIGH,
    anomalyType: options.anomalyType ?? ImpactAnomalyType.EXCESSIVE_IMPACT,
    timestamp: options.timestamp ?? new Date(),
    context: options.context ?? {
      highImpactTradesLastHour: 2,
      walletHighImpactCount: 3,
      marketHighImpactCount: 5,
    },
  };
}

/**
 * Create a mock burst event
 */
function createMockBurstEvent(options: {
  eventId?: string;
  marketId?: string;
  walletAddresses?: string[];
  patternType?: BurstPatternType;
  severity?: BurstSeverity;
  consecutiveCount?: number;
  totalVolumeUsd?: number;
  startTime?: Date;
  endTime?: Date | null;
  durationMs?: number;
  intensity?: number;
  averageTradeSize?: number;
  largestTradeSize?: number;
  tradeIds?: string[];
  detectedAt?: Date;
  context?: {
    isContinuation: boolean;
    previousEventId: string | null;
    marketBurstsLastHour: number;
    walletBurstsLastHour: number;
  };
} = {}): BurstEvent {
  return {
    eventId: options.eventId ?? `burst_${Date.now()}`,
    marketId: options.marketId ?? "market-1",
    walletAddresses: options.walletAddresses ?? ["0x1234", "0x5678"],
    patternType: options.patternType ?? BurstPatternType.MARKET_BURST,
    severity: options.severity ?? BurstSeverity.HIGH,
    consecutiveCount: options.consecutiveCount ?? 5,
    totalVolumeUsd: options.totalVolumeUsd ?? 100000,
    startTime: options.startTime ?? new Date(Date.now() - 120000),
    endTime: options.endTime ?? new Date(),
    durationMs: options.durationMs ?? 120000,
    intensity: options.intensity ?? 2.5,
    averageTradeSize: options.averageTradeSize ?? 20000,
    largestTradeSize: options.largestTradeSize ?? 35000,
    tradeIds: options.tradeIds ?? ["trade-1", "trade-2", "trade-3", "trade-4", "trade-5"],
    detectedAt: options.detectedAt ?? new Date(),
    context: options.context ?? {
      isContinuation: false,
      previousEventId: null,
      marketBurstsLastHour: 1,
      walletBurstsLastHour: 0,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("UnusualVolumeAlertGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedUnusualVolumeAlertGenerator();
    resetSharedRollingVolumeTracker();
    resetSharedVolumeSpikeDetector();
    resetSharedTradeSizeAnalyzer();
    resetSharedMarketImpactCalculator();
    resetSharedConsecutiveLargeTradeDetector();
  });

  afterEach(() => {
    resetSharedUnusualVolumeAlertGenerator();
    resetSharedRollingVolumeTracker();
    resetSharedVolumeSpikeDetector();
    resetSharedTradeSizeAnalyzer();
    resetSharedMarketImpactCalculator();
    resetSharedConsecutiveLargeTradeDetector();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const stats = generator.getStats();
      expect(stats.storedAlerts).toBe(0);
      expect(stats.enabledConditions).toBeGreaterThan(0);
      expect(stats.totalConditions).toBe(DEFAULT_VOLUME_ALERT_CONDITIONS.length);
      expect(stats.cooldownMs).toBe(60000);
      expect(stats.primaryWindow).toBe(RollingWindow.FIVE_MINUTES);
    });

    it("should create with custom configuration", () => {
      const customCondition: VolumeAlertCondition = {
        id: "custom_condition",
        name: "Custom Condition",
        description: "Test custom condition",
        enabled: true,
        alertType: UnusualVolumeAlertType.GENERAL_ANOMALY,
        minZScore: 1.0,
        tags: ["custom"],
      };

      const config: UnusualVolumeAlertGeneratorConfig = {
        customConditions: [customCondition],
        cooldownMs: 30000,
        maxStoredAlerts: 100,
        primaryWindow: RollingWindow.ONE_HOUR,
      };

      const generator = new UnusualVolumeAlertGenerator(config);

      const stats = generator.getStats();
      expect(stats.cooldownMs).toBe(30000);
      expect(stats.primaryWindow).toBe(RollingWindow.ONE_HOUR);
      expect(stats.totalConditions).toBe(DEFAULT_VOLUME_ALERT_CONDITIONS.length + 1);
    });

    it("should replace default conditions when specified", () => {
      const customCondition: VolumeAlertCondition = {
        id: "only_condition",
        name: "Only Condition",
        description: "Only condition when replacing defaults",
        enabled: true,
        alertType: UnusualVolumeAlertType.VOLUME_SPIKE,
        minZScore: 2.0,
      };

      const generator = new UnusualVolumeAlertGenerator({
        customConditions: [customCondition],
        replaceDefaultConditions: true,
      });

      const stats = generator.getStats();
      expect(stats.totalConditions).toBe(1);
    });

    it("should use provided detectors", () => {
      const customTracker = new RollingVolumeTracker();
      const customSpikeDetector = new VolumeSpikeDetector();
      const customTradeSizeAnalyzer = new TradeSizeAnalyzer();
      const customImpactCalculator = new MarketImpactCalculator();
      const customBurstDetector = new ConsecutiveLargeTradeDetector();

      const generator = new UnusualVolumeAlertGenerator({
        volumeTracker: customTracker,
        spikeDetector: customSpikeDetector,
        tradeSizeAnalyzer: customTradeSizeAnalyzer,
        impactCalculator: customImpactCalculator,
        burstDetector: customBurstDetector,
      });

      expect(generator.getStats().storedAlerts).toBe(0);
    });
  });

  // ==========================================================================
  // Default Conditions Tests
  // ==========================================================================

  describe("default conditions", () => {
    it("should have correct default conditions", () => {
      expect(DEFAULT_VOLUME_ALERT_CONDITIONS.length).toBeGreaterThan(5);

      // Check for critical volume spike condition
      const criticalSpike = DEFAULT_VOLUME_ALERT_CONDITIONS.find(
        (c) => c.id === "critical_volume_spike"
      );
      expect(criticalSpike).toBeDefined();
      expect(criticalSpike?.alertType).toBe(UnusualVolumeAlertType.VOLUME_SPIKE);
      expect(criticalSpike?.minZScore).toBe(4.0);
      expect(criticalSpike?.overrideSeverity).toBe(VolumeAlertSeverity.CRITICAL);

      // Check for whale trade condition
      const whaleTrade = DEFAULT_VOLUME_ALERT_CONDITIONS.find(
        (c) => c.id === "whale_trade"
      );
      expect(whaleTrade).toBeDefined();
      expect(whaleTrade?.alertType).toBe(UnusualVolumeAlertType.WHALE_TRADE);
      expect(whaleTrade?.minTradeSizeUsd).toBe(50000);

      // Check for excessive impact condition
      const excessiveImpact = DEFAULT_VOLUME_ALERT_CONDITIONS.find(
        (c) => c.id === "excessive_impact"
      );
      expect(excessiveImpact).toBeDefined();
      expect(excessiveImpact?.alertType).toBe(UnusualVolumeAlertType.EXCESSIVE_IMPACT);

      // Check for trade burst condition
      const tradeBurst = DEFAULT_VOLUME_ALERT_CONDITIONS.find(
        (c) => c.id === "trade_burst"
      );
      expect(tradeBurst).toBeDefined();
      expect(tradeBurst?.alertType).toBe(UnusualVolumeAlertType.TRADE_BURST);
    });

    it("should have all conditions enabled by default", () => {
      for (const condition of DEFAULT_VOLUME_ALERT_CONDITIONS) {
        expect(condition.enabled).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Spike Event Processing Tests
  // ==========================================================================

  describe("processSpikeEvent", () => {
    it("should generate alert for high z-score spike", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        zScore: 4.5,
        severity: SpikeSeverity.CRITICAL,
      });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert?.type).toBe(UnusualVolumeAlertType.VOLUME_SPIKE);
      expect(result.alert?.severity).toBe(VolumeAlertSeverity.CRITICAL);
      expect(result.alert?.marketId).toBe("market-1");
      expect(result.matchedConditions.length).toBeGreaterThan(0);
    });

    it("should not generate alert for low severity spike", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        zScore: 1.5,
        severity: SpikeSeverity.LOW,
        percentageOfBaseline: 1.3,
      });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(false);
      expect(result.alert).toBeNull();
    });

    it("should generate sustained high volume alert", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        spikeType: VolumeSpikeType.SUSTAINED,
        durationMinutes: 10,
        zScore: 3.0,
        severity: SpikeSeverity.HIGH,
      });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.matchedConditions).toContain("sustained_high_volume");
    });

    it("should respect cooldown between alerts", () => {
      const generator = new UnusualVolumeAlertGenerator({ cooldownMs: 60000 });

      const spikeEvent = createMockSpikeEvent({ zScore: 4.5 });

      // First alert should work
      const result1 = generator.processSpikeEvent(spikeEvent);
      expect(result1.alert).not.toBeNull();

      // Second immediate alert should be blocked by cooldown
      const result2 = generator.processSpikeEvent(spikeEvent);
      expect(result2.alert).toBeNull();

      // With bypass, it should work
      const result3 = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });
      expect(result3.alert).not.toBeNull();
    });

    it("should include volume comparison data in context", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        currentVolume: 500,
        baselineVolume: 100,
        baselineStdDev: 20,
        zScore: 4.0,
        percentageOfBaseline: 5.0,
      });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(result.alert).not.toBeNull();
      expect(result.alert?.context.volumeComparison.currentVolume).toBe(500);
      expect(result.alert?.context.volumeComparison.baselineVolume).toBe(100);
      expect(result.alert?.context.volumeComparison.zScore).toBe(4.0);
      expect(result.alert?.context.volumeComparison.percentageOfBaseline).toBe(5.0);
    });

    it("should mark recurring alerts", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        context: {
          isRecurring: true,
          previousSpikeTime: new Date(Date.now() - 30 * 60 * 1000),
          spikesLastHour: 3,
          dataReliability: 0.8,
        },
      });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(result.alert?.context.isRecurring).toBe(true);
    });
  });

  // ==========================================================================
  // Large Trade Event Processing Tests
  // ==========================================================================

  describe("processLargeTradeEvent", () => {
    it("should generate alert for whale trade", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const tradeEvent = createMockLargeTradeEvent({
        category: TradeSizeCategory.WHALE,
        trade: {
          tradeId: "whale-1",
          sizeUsd: 75000,
          timestamp: Date.now(),
          marketId: "market-1",
          walletAddress: "0xabcd",
        },
      });

      const result = generator.processLargeTradeEvent(tradeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert?.type).toBe(UnusualVolumeAlertType.WHALE_TRADE);
      expect(result.matchedConditions).toContain("whale_trade");
    });

    it("should generate alert for large outlier trade", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const tradeEvent = createMockLargeTradeEvent({
        category: TradeSizeCategory.LARGE,
        trade: {
          tradeId: "large-1",
          sizeUsd: 15000,
          timestamp: Date.now(),
          marketId: "market-1",
          walletAddress: "0xabcd",
        },
      });

      const result = generator.processLargeTradeEvent(tradeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.matchedConditions).toContain("large_trade");
    });

    it("should include trade info in context", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const tradeEvent = createMockLargeTradeEvent({
        trade: {
          tradeId: "trade-info-test",
          sizeUsd: 60000,
          walletAddress: "0x9876543210fedcba9876543210fedcba98765432",
          timestamp: Date.now(),
          marketId: "market-1",
        },
        category: TradeSizeCategory.WHALE,
      });

      const result = generator.processLargeTradeEvent(tradeEvent, { bypassCooldown: true });

      expect(result.alert?.context.tradeInfo).not.toBeNull();
      expect(result.alert?.context.tradeInfo?.tradeId).toBe("trade-info-test");
      expect(result.alert?.context.tradeInfo?.tradeSizeUsd).toBe(60000);
      expect(result.alert?.context.tradeInfo?.tradeSizeCategory).toBe(TradeSizeCategory.WHALE);
    });

    it("should not generate alert for small sized trade", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const tradeEvent = createMockLargeTradeEvent({
        category: TradeSizeCategory.SMALL,
        trade: {
          tradeId: "small-1",
          sizeUsd: 500,
          timestamp: Date.now(),
          marketId: "market-1",
          walletAddress: "0xabcd",
        },
        severity: TradeSizeSeverity.LOW,
      });

      const result = generator.processLargeTradeEvent(tradeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(false);
      expect(result.alert).toBeNull();
    });
  });

  // ==========================================================================
  // High Impact Event Processing Tests
  // ==========================================================================

  describe("processHighImpactEvent", () => {
    it("should generate alert for excessive impact", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const impactEvent = createMockHighImpactEvent({
        impactResult: {
          ...createMockHighImpactEvent().impactResult,
          impactRatio: 2.5,
          isExcessive: true,
          impactBps: 300,
        },
        anomalyType: ImpactAnomalyType.EXCESSIVE_IMPACT,
      });

      const result = generator.processHighImpactEvent(impactEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.matchedConditions).toContain("excessive_impact");
    });

    it("should generate alert for high impact", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const impactEvent = createMockHighImpactEvent({
        impactResult: {
          ...createMockHighImpactEvent().impactResult,
          impactBps: 250,
          impactRatio: 1.5,
        },
        severity: ImpactSeverity.HIGH,
      });

      const result = generator.processHighImpactEvent(impactEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.matchedConditions).toContain("high_impact");
    });

    it("should generate critical alert for front-running", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const impactEvent = createMockHighImpactEvent({
        anomalyType: ImpactAnomalyType.FRONT_RUNNING,
        impactResult: {
          ...createMockHighImpactEvent().impactResult,
          impactBps: 150,
        },
        severity: ImpactSeverity.HIGH,
      });

      const result = generator.processHighImpactEvent(impactEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert?.severity).toBe(VolumeAlertSeverity.CRITICAL);
      expect(result.matchedConditions).toContain("front_running_suspected");
    });

    it("should include impact info in context", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const impactEvent = createMockHighImpactEvent({
        impactResult: {
          ...createMockHighImpactEvent().impactResult,
          impactBps: 400,
          impactRatio: 3.0,
        },
        anomalyType: ImpactAnomalyType.EXCESSIVE_IMPACT,
      });

      const result = generator.processHighImpactEvent(impactEvent, { bypassCooldown: true });

      expect(result.alert?.context.impactInfo).not.toBeNull();
      expect(result.alert?.context.impactInfo?.impactBps).toBe(400);
      expect(result.alert?.context.impactInfo?.impactRatio).toBe(3.0);
      expect(result.alert?.context.impactInfo?.anomalyType).toBe(ImpactAnomalyType.EXCESSIVE_IMPACT);
    });
  });

  // ==========================================================================
  // Burst Event Processing Tests
  // ==========================================================================

  describe("processBurstEvent", () => {
    it("should generate alert for trade burst", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const burstEvent = createMockBurstEvent({
        consecutiveCount: 5,
        totalVolumeUsd: 100000,
        patternType: BurstPatternType.MARKET_BURST,
      });

      const result = generator.processBurstEvent(burstEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.alert?.type).toBe(UnusualVolumeAlertType.TRADE_BURST);
    });

    it("should generate high severity alert for coordinated burst", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const burstEvent = createMockBurstEvent({
        consecutiveCount: 5,
        patternType: BurstPatternType.COORDINATED_BURST,
        severity: BurstSeverity.HIGH,
      });

      const result = generator.processBurstEvent(burstEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(true);
      expect(result.alert).not.toBeNull();
      expect(result.matchedConditions).toContain("coordinated_burst");
      expect(result.alert?.severity).toBe(VolumeAlertSeverity.HIGH);
    });

    it("should include burst info in context", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const burstEvent = createMockBurstEvent({
        consecutiveCount: 7,
        totalVolumeUsd: 150000,
        patternType: BurstPatternType.WALLET_BURST,
        durationMs: 180000,
      });

      const result = generator.processBurstEvent(burstEvent, { bypassCooldown: true });

      expect(result.alert?.context.burstInfo).not.toBeNull();
      expect(result.alert?.context.burstInfo?.tradeCount).toBe(7);
      expect(result.alert?.context.burstInfo?.totalVolume).toBe(150000);
      expect(result.alert?.context.burstInfo?.patternType).toBe(BurstPatternType.WALLET_BURST);
      expect(result.alert?.context.durationMinutes).toBeCloseTo(3, 1);
    });

    it("should not generate alert for small burst", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const burstEvent = createMockBurstEvent({
        consecutiveCount: 2,
        totalVolumeUsd: 5000,
        severity: BurstSeverity.LOW,
      });

      const result = generator.processBurstEvent(burstEvent, { bypassCooldown: true });

      // The predicate requires tradeCount >= 3
      expect(result.conditionsMet).toBe(false);
      expect(result.alert).toBeNull();
    });
  });

  // ==========================================================================
  // Alert Storage and Retrieval Tests
  // ==========================================================================

  describe("alert storage and retrieval", () => {
    it("should store generated alerts", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({ zScore: 4.5 });
      generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(generator.getAlertCount()).toBe(1);
      expect(generator.getAllAlerts().length).toBe(1);
    });

    it("should retrieve alerts by market", () => {
      const generator = new UnusualVolumeAlertGenerator();

      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-A", zScore: 4.5 }),
        { bypassCooldown: true }
      );
      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-B", zScore: 4.5 }),
        { bypassCooldown: true }
      );

      const marketAAlerts = generator.getAlertsForMarket("market-A");
      expect(marketAAlerts.length).toBe(1);
      expect(marketAAlerts[0]?.marketId).toBe("market-A");
    });

    it("should retrieve alerts by type", () => {
      const generator = new UnusualVolumeAlertGenerator();

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );
      generator.processLargeTradeEvent(
        createMockLargeTradeEvent({ marketId: "market-2" }),
        { bypassCooldown: true }
      );

      const spikeAlerts = generator.getAlertsByType(UnusualVolumeAlertType.VOLUME_SPIKE);
      expect(spikeAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it("should retrieve alerts by severity", () => {
      const generator = new UnusualVolumeAlertGenerator();

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5, severity: SpikeSeverity.CRITICAL }),
        { bypassCooldown: true }
      );

      const criticalAlerts = generator.getAlertsBySeverity(VolumeAlertSeverity.CRITICAL);
      expect(criticalAlerts.length).toBe(1);
    });

    it("should retrieve alert by ID", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      const alert = generator.getAlertById(result.alert!.id);
      expect(alert).not.toBeNull();
      expect(alert?.id).toBe(result.alert!.id);
    });

    it("should enforce max stored alerts limit", () => {
      const generator = new UnusualVolumeAlertGenerator({ maxStoredAlerts: 3 });

      for (let i = 0; i < 5; i++) {
        generator.processSpikeEvent(
          createMockSpikeEvent({ marketId: `market-${i}`, zScore: 4.5 }),
          { bypassCooldown: true }
        );
      }

      expect(generator.getAlertCount()).toBe(3);
    });
  });

  // ==========================================================================
  // Alert Status Management Tests
  // ==========================================================================

  describe("alert status management", () => {
    it("should update alert status", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      expect(result.alert?.status).toBe(VolumeAlertStatus.NEW);

      const updated = generator.updateAlertStatus(result.alert!.id, VolumeAlertStatus.ACKNOWLEDGED);
      expect(updated).toBe(true);

      const alert = generator.getAlertById(result.alert!.id);
      expect(alert?.status).toBe(VolumeAlertStatus.ACKNOWLEDGED);
    });

    it("should return false when updating non-existent alert", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const updated = generator.updateAlertStatus("non-existent-id", VolumeAlertStatus.READ);
      expect(updated).toBe(false);
    });

    it("should delete alert", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      const deleted = generator.deleteAlert(result.alert!.id);
      expect(deleted).toBe(true);
      expect(generator.getAlertById(result.alert!.id)).toBeNull();
    });

    it("should clear all alerts", () => {
      const generator = new UnusualVolumeAlertGenerator();

      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-1", zScore: 4.5 }),
        { bypassCooldown: true }
      );
      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-2", zScore: 4.5 }),
        { bypassCooldown: true }
      );

      generator.clearAlerts();
      expect(generator.getAlertCount()).toBe(0);
    });

    it("should clear expired alerts", () => {
      const generator = new UnusualVolumeAlertGenerator({ defaultExpirationMs: 1000 });

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      // Manually set expiration in the past
      const alert = generator.getAlertById(result.alert!.id);
      if (alert) {
        alert.expiresAt = new Date(Date.now() - 1000);
      }

      const clearedCount = generator.clearExpiredAlerts();
      expect(clearedCount).toBe(1);
      expect(generator.getAlertCount()).toBe(0);
    });
  });

  // ==========================================================================
  // Alert Summary Tests
  // ==========================================================================

  describe("getSummary", () => {
    it("should return empty summary when no alerts", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const summary = generator.getSummary();

      expect(summary.totalAlerts).toBe(0);
      expect(summary.averageZScore).toBeNull();
      expect(summary.mostCommonType).toBeNull();
      expect(summary.highestSeverity).toBeNull();
    });

    it("should return accurate summary statistics", () => {
      const generator = new UnusualVolumeAlertGenerator();

      // Add some alerts
      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-1", zScore: 4.5, severity: SpikeSeverity.CRITICAL }),
        { bypassCooldown: true }
      );
      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-2", zScore: 3.5, severity: SpikeSeverity.HIGH }),
        { bypassCooldown: true }
      );
      generator.processLargeTradeEvent(
        createMockLargeTradeEvent({ marketId: "market-3" }),
        { bypassCooldown: true }
      );

      const summary = generator.getSummary();

      expect(summary.totalAlerts).toBe(3);
      expect(summary.byType[UnusualVolumeAlertType.VOLUME_SPIKE]).toBeGreaterThanOrEqual(1);
      expect(summary.highestSeverity).toBe(VolumeAlertSeverity.CRITICAL);
      expect(summary.recentAlerts.length).toBe(3);
      expect(summary.topAlertMarkets.length).toBe(3);
    });

    it("should track most common alert type", () => {
      const generator = new UnusualVolumeAlertGenerator();

      // Add multiple spike alerts
      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-1", zScore: 4.5 }),
        { bypassCooldown: true }
      );
      generator.processSpikeEvent(
        createMockSpikeEvent({ marketId: "market-2", zScore: 4.5 }),
        { bypassCooldown: true }
      );
      generator.processLargeTradeEvent(
        createMockLargeTradeEvent({ marketId: "market-3" }),
        { bypassCooldown: true }
      );

      const summary = generator.getSummary();
      expect(summary.mostCommonType).toBe(UnusualVolumeAlertType.VOLUME_SPIKE);
    });
  });

  // ==========================================================================
  // Condition Management Tests
  // ==========================================================================

  describe("condition management", () => {
    it("should return all conditions", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const conditions = generator.getConditions();
      expect(conditions.length).toBe(DEFAULT_VOLUME_ALERT_CONDITIONS.length);
    });

    it("should return enabled conditions", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const enabledConditions = generator.getEnabledConditions();
      expect(enabledConditions.length).toBe(DEFAULT_VOLUME_ALERT_CONDITIONS.length);
    });

    it("should enable and disable conditions", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const disabled = generator.disableCondition("critical_volume_spike");
      expect(disabled).toBe(true);

      const conditions = generator.getEnabledConditions();
      const criticalCondition = conditions.find((c) => c.id === "critical_volume_spike");
      expect(criticalCondition).toBeUndefined();

      const enabled = generator.enableCondition("critical_volume_spike");
      expect(enabled).toBe(true);

      const conditionsAfterEnable = generator.getEnabledConditions();
      const criticalConditionAfterEnable = conditionsAfterEnable.find((c) => c.id === "critical_volume_spike");
      expect(criticalConditionAfterEnable).toBeDefined();
    });

    it("should return false when enabling/disabling non-existent condition", () => {
      const generator = new UnusualVolumeAlertGenerator();

      expect(generator.enableCondition("non-existent")).toBe(false);
      expect(generator.disableCondition("non-existent")).toBe(false);
    });
  });

  // ==========================================================================
  // Event Emission Tests
  // ==========================================================================

  describe("event emission", () => {
    it("should emit alertGenerated event", () => {
      const generator = new UnusualVolumeAlertGenerator();
      const eventHandler = vi.fn();

      generator.on("alertGenerated", eventHandler);

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      expect(eventHandler).toHaveBeenCalledTimes(1);
      const firstCall = eventHandler.mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall?.[0]).toHaveProperty("id");
      expect(firstCall?.[0]).toHaveProperty("type");
    });

    it("should emit criticalAlert event for critical severity", () => {
      const generator = new UnusualVolumeAlertGenerator();
      const criticalHandler = vi.fn();

      generator.on("criticalAlert", criticalHandler);

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 5.0, severity: SpikeSeverity.CRITICAL }),
        { bypassCooldown: true }
      );

      expect(criticalHandler).toHaveBeenCalledTimes(1);
    });

    it("should emit highAlert event for high severity", () => {
      const generator = new UnusualVolumeAlertGenerator();
      const highHandler = vi.fn();

      generator.on("highAlert", highHandler);

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 3.5, severity: SpikeSeverity.HIGH }),
        { bypassCooldown: true }
      );

      expect(highHandler).toHaveBeenCalledTimes(1);
    });

    it("should notify custom listeners", async () => {
      const generator = new UnusualVolumeAlertGenerator();
      const listener = vi.fn();

      generator.addAlertListener(listener);

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      // Allow async notification
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should remove custom listeners", async () => {
      const generator = new UnusualVolumeAlertGenerator();
      const listener = vi.fn();

      generator.addAlertListener(listener);
      generator.removeAlertListener(listener);

      generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Singleton Management Tests
  // ==========================================================================

  describe("singleton management", () => {
    it("should return same instance from getSharedUnusualVolumeAlertGenerator", () => {
      const instance1 = getSharedUnusualVolumeAlertGenerator();
      const instance2 = getSharedUnusualVolumeAlertGenerator();

      expect(instance1).toBe(instance2);
    });

    it("should allow setting shared instance", () => {
      const customGenerator = new UnusualVolumeAlertGenerator({ cooldownMs: 30000 });
      setSharedUnusualVolumeAlertGenerator(customGenerator);

      const retrieved = getSharedUnusualVolumeAlertGenerator();
      expect(retrieved.getStats().cooldownMs).toBe(30000);
    });

    it("should reset shared instance", () => {
      const instance1 = getSharedUnusualVolumeAlertGenerator();
      instance1.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      resetSharedUnusualVolumeAlertGenerator();

      const instance2 = getSharedUnusualVolumeAlertGenerator();
      expect(instance2.getAlertCount()).toBe(0);
    });

    it("should create new instance with createUnusualVolumeAlertGenerator", () => {
      const instance1 = createUnusualVolumeAlertGenerator({ cooldownMs: 10000 });
      const instance2 = createUnusualVolumeAlertGenerator({ cooldownMs: 20000 });

      expect(instance1).not.toBe(instance2);
      expect(instance1.getStats().cooldownMs).toBe(10000);
      expect(instance2.getStats().cooldownMs).toBe(20000);
    });
  });

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe("convenience functions", () => {
    it("should generate alert from spike using convenience function", () => {
      const spikeEvent = createMockSpikeEvent({ zScore: 4.5 });
      const alert = generateVolumeAlertFromSpike(spikeEvent, { bypassCooldown: true });

      expect(alert).not.toBeNull();
      expect(alert?.type).toBe(UnusualVolumeAlertType.VOLUME_SPIKE);
    });

    it("should generate alert from large trade using convenience function", () => {
      resetSharedUnusualVolumeAlertGenerator();
      const tradeEvent = createMockLargeTradeEvent();
      const alert = generateVolumeAlertFromLargeTrade(tradeEvent, { bypassCooldown: true });

      expect(alert).not.toBeNull();
    });

    it("should generate alert from high impact using convenience function", () => {
      resetSharedUnusualVolumeAlertGenerator();
      const impactEvent = createMockHighImpactEvent();
      const alert = generateVolumeAlertFromHighImpact(impactEvent, { bypassCooldown: true });

      expect(alert).not.toBeNull();
    });

    it("should generate alert from burst using convenience function", () => {
      resetSharedUnusualVolumeAlertGenerator();
      const burstEvent = createMockBurstEvent({ consecutiveCount: 5 });
      const alert = generateVolumeAlertFromBurst(burstEvent, { bypassCooldown: true });

      expect(alert).not.toBeNull();
    });

    it("should get all alerts using convenience function", () => {
      resetSharedUnusualVolumeAlertGenerator();
      generateVolumeAlertFromSpike(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      const alerts = getUnusualVolumeAlerts();
      expect(alerts.length).toBe(1);
    });

    it("should get summary using convenience function", () => {
      resetSharedUnusualVolumeAlertGenerator();
      generateVolumeAlertFromSpike(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      const summary = getUnusualVolumeAlertSummary();
      expect(summary.totalAlerts).toBe(1);
    });
  });

  // ==========================================================================
  // Alert Content Tests
  // ==========================================================================

  describe("alert content", () => {
    it("should generate appropriate title for volume spike", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true }
      );

      expect(result.alert?.title).toContain("Volume Spike");
      expect(result.alert?.title).toContain("4.5");
    });

    it("should generate appropriate title for whale trade", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processLargeTradeEvent(
        createMockLargeTradeEvent({ trade: { ...createMockLargeTradeEvent().trade, sizeUsd: 75000 } }),
        { bypassCooldown: true }
      );

      expect(result.alert?.title).toContain("Whale Trade");
      expect(result.alert?.title).toContain("75,000");
    });

    it("should generate message with volume comparison data", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({
          currentVolume: 500,
          baselineVolume: 100,
          zScore: 4.0,
        }),
        { bypassCooldown: true }
      );

      expect(result.alert?.message).toContain("Z-Score:");
      expect(result.alert?.message).toContain("Current Volume:");
      expect(result.alert?.message).toContain("Baseline Volume:");
    });

    it("should include severity prefix in title", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 5.0, severity: SpikeSeverity.CRITICAL }),
        { bypassCooldown: true }
      );

      expect(result.alert?.title).toContain("[CRITICAL]");
    });

    it("should generate appropriate tags", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ spikeType: VolumeSpikeType.SUDDEN, direction: SpikeDirection.UP }),
        { bypassCooldown: true }
      );

      expect(result.alert?.tags).toContain("volume_spike");
      expect(result.alert?.tags).toContain("sudden");
      expect(result.alert?.tags).toContain("up");
    });

    it("should add additional tags from options", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const result = generator.processSpikeEvent(
        createMockSpikeEvent({ zScore: 4.5 }),
        { bypassCooldown: true, additionalTags: ["custom_tag", "another_tag"] }
      );

      expect(result.alert?.tags).toContain("custom_tag");
      expect(result.alert?.tags).toContain("another_tag");
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle null/undefined values gracefully", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        zScore: null as unknown as number,
        percentageOfBaseline: null as unknown as number,
        severity: SpikeSeverity.LOW,
        currentVolume: 100,
        baselineVolume: 100,
      });

      // Should not throw - it may or may not meet conditions based on other criteria
      expect(() => {
        generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });
      }).not.toThrow();
    });

    it("should handle empty market ID", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({ marketId: "", zScore: 4.5 });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });
      expect(result.alert?.marketId).toBe("");
    });

    it("should handle very large z-scores", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({ zScore: 100 });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });
      expect(result.alert).not.toBeNull();
      expect(result.alert?.severity).toBe(VolumeAlertSeverity.CRITICAL);
    });

    it("should handle zero baseline volume", () => {
      const generator = new UnusualVolumeAlertGenerator();

      const spikeEvent = createMockSpikeEvent({
        baselineVolume: 0,
        zScore: 4.5,
      });

      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });
      expect(result.alert).not.toBeNull();
    });

    it("should handle events with disabled conditions", () => {
      const generator = new UnusualVolumeAlertGenerator();

      // Disable all conditions
      for (const condition of generator.getConditions()) {
        generator.disableCondition(condition.id);
      }

      const spikeEvent = createMockSpikeEvent({ zScore: 10 });
      const result = generator.processSpikeEvent(spikeEvent, { bypassCooldown: true });

      expect(result.conditionsMet).toBe(false);
      expect(result.alert).toBeNull();
    });
  });
});
