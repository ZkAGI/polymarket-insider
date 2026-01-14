/**
 * Post-Ingestion Detection Trigger (INGEST-DETECT-001)
 *
 * Triggers all detection and scoring pipelines after each successful
 * ingestion cycle to identify suspicious activity.
 *
 * Features:
 * - Run fresh wallet detectors after trade ingestion
 * - Run volume and whale detectors
 * - Update suspicion scores for wallets
 * - Generate alerts when thresholds are crossed
 * - Event emission for downstream systems
 * - Configurable detection thresholds
 * - Batch processing for efficiency
 */

import { EventEmitter } from "events";
import type { PrismaClient, Prisma } from "@prisma/client";
import { AlertType, AlertSeverity, RiskLevel } from "@prisma/client";
import { createPrismaClient } from "../db/client";
import { WalletService, createWalletService } from "../db/wallets";
import { AlertService, createAlertService } from "../db/alerts";

// Import detection modules
import {
  scoreFreshWalletConfidence,
  type FreshWalletConfidenceResult,
  ConfidenceLevel,
} from "../detection/fresh-wallet-confidence";
import {
  calculateCompositeSuspicionScore,
} from "../detection/composite-suspicion-scorer";
import {
  detectVolumeSpike,
  SpikeSeverity,
} from "../detection/volume-spike";
import {
  analyzeTrade,
  TradeSizeCategory,
} from "../detection/trade-size";
import { isWhaleTradeSize } from "../detection/whale-threshold";

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for the detection trigger
 */
export interface DetectionTriggerConfig {
  /** Minimum suspicion score to generate alert (default: 50) */
  alertThreshold?: number;

  /** Minimum suspicion score to flag wallet (default: 70) */
  flagThreshold?: number;

  /** Minimum suspicion score to mark as potential insider (default: 85) */
  insiderThreshold?: number;

  /** Maximum wallets to process per batch (default: 100) */
  batchSize?: number;

  /** Whether to enable fresh wallet detection (default: true) */
  enableFreshWalletDetection?: boolean;

  /** Whether to enable volume spike detection (default: true) */
  enableVolumeSpikeDetection?: boolean;

  /** Whether to enable whale detection (default: true) */
  enableWhaleDetection?: boolean;

  /** Whether to enable composite scoring (default: true) */
  enableCompositeScoring?: boolean;

  /** Custom Prisma client */
  prisma?: PrismaClient;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Result of a detection cycle
 */
export interface DetectionCycleResult {
  /** Whether the detection cycle completed successfully */
  success: boolean;

  /** Number of wallets processed */
  walletsProcessed: number;

  /** Number of trades analyzed */
  tradesAnalyzed: number;

  /** Number of fresh wallet alerts generated */
  freshWalletAlerts: number;

  /** Number of volume alerts generated */
  volumeAlerts: number;

  /** Number of whale trades detected */
  whaleTradesDetected: number;

  /** Number of wallets flagged */
  walletsFlagged: number;

  /** Number of potential insiders identified */
  potentialInsiders: number;

  /** Duration in milliseconds */
  durationMs: number;

  /** Error message if failed */
  error?: string;

  /** Timestamp of cycle completion */
  completedAt: Date;
}

/**
 * Trade data for detection analysis
 */
interface TradeForDetection {
  id: string;
  walletId: string;
  marketId: string;
  usdValue: number;
  timestamp: Date;
  isWhale: boolean;
}

/**
 * Wallet data for detection analysis
 */
interface WalletForDetection {
  id: string;
  address: string;
  tradeCount: number;
  totalVolume: number;
  suspicionScore: number;
  isFresh: boolean;
  isWhale: boolean;
  isInsider: boolean;
  isFlagged: boolean;
  firstTradeAt: Date | null;
}

// ============================================================================
// Detection Trigger Class
// ============================================================================

/**
 * Post-ingestion detection trigger
 */
export class DetectionTrigger extends EventEmitter {
  private readonly config: Required<
    Pick<
      DetectionTriggerConfig,
      | "alertThreshold"
      | "flagThreshold"
      | "insiderThreshold"
      | "batchSize"
      | "enableFreshWalletDetection"
      | "enableVolumeSpikeDetection"
      | "enableWhaleDetection"
      | "enableCompositeScoring"
      | "debug"
    >
  >;
  private readonly prisma: PrismaClient;
  private readonly walletService: WalletService;
  private readonly alertService: AlertService;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private isRunning = false;

  constructor(config: DetectionTriggerConfig = {}) {
    super();

    this.config = {
      alertThreshold: config.alertThreshold ?? 50,
      flagThreshold: config.flagThreshold ?? 70,
      insiderThreshold: config.insiderThreshold ?? 85,
      batchSize: config.batchSize ?? 100,
      enableFreshWalletDetection: config.enableFreshWalletDetection ?? true,
      enableVolumeSpikeDetection: config.enableVolumeSpikeDetection ?? true,
      enableWhaleDetection: config.enableWhaleDetection ?? true,
      enableCompositeScoring: config.enableCompositeScoring ?? true,
      debug: config.debug ?? false,
    };

    this.prisma = config.prisma ?? createPrismaClient();
    this.walletService = createWalletService({ prisma: this.prisma });
    this.alertService = createAlertService({ prisma: this.prisma });

    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [DetectionTrigger]`;
    if (data && this.config.debug) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Run detection cycle after ingestion
   */
  async runDetectionCycle(
    recentTradeIds?: string[],
    recentWalletIds?: string[]
  ): Promise<DetectionCycleResult> {
    if (this.isRunning) {
      return {
        success: false,
        walletsProcessed: 0,
        tradesAnalyzed: 0,
        freshWalletAlerts: 0,
        volumeAlerts: 0,
        whaleTradesDetected: 0,
        walletsFlagged: 0,
        potentialInsiders: 0,
        durationMs: 0,
        error: "Detection cycle already in progress",
        completedAt: new Date(),
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const result: DetectionCycleResult = {
      success: false,
      walletsProcessed: 0,
      tradesAnalyzed: 0,
      freshWalletAlerts: 0,
      volumeAlerts: 0,
      whaleTradesDetected: 0,
      walletsFlagged: 0,
      potentialInsiders: 0,
      durationMs: 0,
      completedAt: new Date(),
    };

    try {
      this.logger("Starting detection cycle");
      this.emit("detection:start");

      // 1. Get recent trades and wallets to analyze
      const { trades, wallets } = await this.getDataForDetection(
        recentTradeIds,
        recentWalletIds
      );
      result.tradesAnalyzed = trades.length;

      // 2. Run fresh wallet detection
      if (this.config.enableFreshWalletDetection) {
        const freshWalletResult = await this.runFreshWalletDetection(wallets);
        result.freshWalletAlerts += freshWalletResult.alertsGenerated;
      }

      // 3. Run volume spike detection
      if (this.config.enableVolumeSpikeDetection) {
        const volumeResult = await this.runVolumeSpikeDetection(trades);
        result.volumeAlerts += volumeResult.alertsGenerated;
      }

      // 4. Run whale detection
      if (this.config.enableWhaleDetection) {
        const whaleResult = await this.runWhaleDetection(trades);
        result.whaleTradesDetected = whaleResult.whaleTradesFound;
        result.volumeAlerts += whaleResult.alertsGenerated;
      }

      // 5. Update composite suspicion scores
      if (this.config.enableCompositeScoring) {
        const scoringResult = await this.updateSuspicionScores(wallets);
        result.walletsFlagged = scoringResult.walletsFlagged;
        result.potentialInsiders = scoringResult.potentialInsiders;
      }

      result.walletsProcessed = wallets.length;
      result.success = true;
      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger("Detection cycle completed", {
        walletsProcessed: result.walletsProcessed,
        tradesAnalyzed: result.tradesAnalyzed,
        freshWalletAlerts: result.freshWalletAlerts,
        volumeAlerts: result.volumeAlerts,
        whaleTradesDetected: result.whaleTradesDetected,
        walletsFlagged: result.walletsFlagged,
        potentialInsiders: result.potentialInsiders,
        durationMs: result.durationMs,
      });

      this.emit("detection:complete", result);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger("Detection cycle failed", { error: result.error });
      this.emit("detection:error", result);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Get data for detection analysis
   */
  private async getDataForDetection(
    recentTradeIds?: string[],
    recentWalletIds?: string[]
  ): Promise<{ trades: TradeForDetection[]; wallets: WalletForDetection[] }> {
    // Get recent trades (last 5 minutes if no IDs provided)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const trades = await this.prisma.trade.findMany({
      where: recentTradeIds?.length
        ? { id: { in: recentTradeIds } }
        : { timestamp: { gte: fiveMinutesAgo } },
      select: {
        id: true,
        walletId: true,
        marketId: true,
        usdValue: true,
        timestamp: true,
        isWhale: true,
      },
      take: this.config.batchSize * 10,
    });

    // Get unique wallet IDs from trades
    const walletIdsFromTrades = [...new Set(trades.map((t) => t.walletId))];

    // Combine with explicitly provided wallet IDs
    const allWalletIds = [
      ...new Set([...walletIdsFromTrades, ...(recentWalletIds ?? [])]),
    ];

    // Get wallet data
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: allWalletIds.slice(0, this.config.batchSize) } },
      select: {
        id: true,
        address: true,
        tradeCount: true,
        totalVolume: true,
        suspicionScore: true,
        isFresh: true,
        isWhale: true,
        isInsider: true,
        isFlagged: true,
        firstTradeAt: true,
      },
    });

    return { trades, wallets };
  }

  /**
   * Run fresh wallet detection
   */
  private async runFreshWalletDetection(
    wallets: WalletForDetection[]
  ): Promise<{ alertsGenerated: number }> {
    let alertsGenerated = 0;

    // Filter to fresh wallets or wallets with low trade count
    const freshWallets = wallets.filter(
      (w) => w.isFresh || w.tradeCount <= 3
    );

    for (const wallet of freshWallets) {
      try {
        // Score fresh wallet confidence
        const confidenceResult = await scoreFreshWalletConfidence(wallet.address);

        // Generate alert if suspicion is high enough
        if (
          confidenceResult.confidenceScore >= this.config.alertThreshold &&
          confidenceResult.confidenceLevel !== ConfidenceLevel.LOW &&
          confidenceResult.confidenceLevel !== ConfidenceLevel.VERY_LOW
        ) {
          // Create alert in database
          await this.alertService.create({
            type: AlertType.FRESH_WALLET,
            severity: this.mapConfidenceToSeverity(confidenceResult.confidenceLevel),
            walletId: wallet.id,
            title: `Fresh Wallet Suspicious Activity: ${wallet.address.slice(0, 10)}...`,
            message: this.buildFreshWalletAlertMessage(wallet, confidenceResult),
            data: {
              walletAddress: wallet.address,
              confidenceScore: confidenceResult.confidenceScore,
              confidenceLevel: confidenceResult.confidenceLevel,
              tradeCount: wallet.tradeCount,
              totalVolume: wallet.totalVolume,
            },
            tags: ["fresh_wallet", "detection", confidenceResult.confidenceLevel.toLowerCase()],
          });

          alertsGenerated++;
          this.emit("alert:fresh_wallet", {
            walletId: wallet.id,
            address: wallet.address,
            score: confidenceResult.confidenceScore,
          });
        }
      } catch (error) {
        this.logger("Failed to analyze fresh wallet", {
          walletId: wallet.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { alertsGenerated };
  }

  /**
   * Run volume spike detection
   */
  private async runVolumeSpikeDetection(
    trades: TradeForDetection[]
  ): Promise<{ alertsGenerated: number }> {
    let alertsGenerated = 0;

    // Group trades by market
    const tradesByMarket = new Map<string, TradeForDetection[]>();
    for (const trade of trades) {
      const existing = tradesByMarket.get(trade.marketId) ?? [];
      existing.push(trade);
      tradesByMarket.set(trade.marketId, existing);
    }

    // Analyze each market for volume spikes
    for (const [marketId, marketTrades] of tradesByMarket) {
      try {
        // Calculate recent volume
        const recentVolume = marketTrades.reduce((sum, t) => sum + t.usdValue, 0);

        // Detect volume spike
        const spikeResult = await detectVolumeSpike(marketId, recentVolume);

        // Generate alert if spike detected
        if (spikeResult.isSpike && spikeResult.spikeEvent) {
          const severity = spikeResult.spikeEvent.severity;

          await this.alertService.create({
            type: AlertType.PRICE_MOVEMENT, // Using PRICE_MOVEMENT for volume spike alerts
            severity: this.mapSpikeSeverityToAlertSeverity(severity),
            marketId,
            title: `Volume Spike Detected: ${severity}`,
            message: `Unusual volume activity detected in market. Current volume: $${recentVolume.toFixed(2)}, Baseline: $${spikeResult.baseline.average.toFixed(2)}. Volume is ${spikeResult.spikeEvent.percentageOfBaseline.toFixed(0)}% of baseline.`,
            data: {
              marketId,
              currentVolume: recentVolume,
              baselineVolume: spikeResult.baseline.average,
              percentageOfBaseline: spikeResult.spikeEvent.percentageOfBaseline,
              severity,
              tradeCount: marketTrades.length,
            },
            tags: ["volume_spike", "detection", severity.toLowerCase()],
          });

          alertsGenerated++;
          this.emit("alert:volume_spike", {
            marketId,
            volume: recentVolume,
            severity,
          });
        }
      } catch (error) {
        this.logger("Failed to analyze volume spike", {
          marketId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { alertsGenerated };
  }

  /**
   * Run whale trade detection
   */
  private async runWhaleDetection(
    trades: TradeForDetection[]
  ): Promise<{ whaleTradesFound: number; alertsGenerated: number }> {
    let whaleTradesFound = 0;
    let alertsGenerated = 0;

    for (const trade of trades) {
      try {
        // Check if trade size qualifies as whale
        const isWhale = await isWhaleTradeSize(trade.marketId, trade.usdValue);

        if (isWhale) {
          whaleTradesFound++;

          // Analyze trade size
          const tradeAnalysis = await analyzeTrade({
            tradeId: trade.id,
            marketId: trade.marketId,
            walletAddress: "", // Not available in trade data
            sizeUsd: trade.usdValue,
            timestamp: trade.timestamp.getTime(),
          });

          // Generate alert for significant whale trades
          if (tradeAnalysis.isFlagged || tradeAnalysis.category === TradeSizeCategory.WHALE) {
            await this.alertService.create({
              type: AlertType.WHALE_TRADE,
              severity:
                tradeAnalysis.category === TradeSizeCategory.WHALE
                  ? AlertSeverity.HIGH
                  : AlertSeverity.MEDIUM,
              marketId: trade.marketId,
              walletId: trade.walletId,
              title: `Whale Trade Detected: $${trade.usdValue.toFixed(2)}`,
              message: `Large trade detected. Size: $${trade.usdValue.toFixed(2)}, Category: ${tradeAnalysis.category}, Percentile: ${tradeAnalysis.percentileRank.toFixed(1)}%.`,
              data: {
                tradeId: trade.id,
                marketId: trade.marketId,
                walletId: trade.walletId,
                usdValue: trade.usdValue,
                category: tradeAnalysis.category,
                percentileRank: tradeAnalysis.percentileRank,
                isFlagged: tradeAnalysis.isFlagged,
              },
              tags: ["whale_trade", "detection", tradeAnalysis.category.toLowerCase()],
            });

            alertsGenerated++;
            this.emit("alert:whale_trade", {
              tradeId: trade.id,
              marketId: trade.marketId,
              walletId: trade.walletId,
              usdValue: trade.usdValue,
            });
          }

          // Update wallet whale status
          await this.walletService.update(trade.walletId, {
            isWhale: true,
          });
        }
      } catch (error) {
        this.logger("Failed to analyze whale trade", {
          tradeId: trade.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { whaleTradesFound, alertsGenerated };
  }

  /**
   * Update composite suspicion scores
   */
  private async updateSuspicionScores(
    wallets: WalletForDetection[]
  ): Promise<{ walletsFlagged: number; potentialInsiders: number }> {
    let walletsFlagged = 0;
    let potentialInsiders = 0;

    for (const wallet of wallets) {
      try {
        // Calculate composite suspicion score
        const scoreResult = await calculateCompositeSuspicionScore(wallet.address);

        // Update wallet with new score
        const updates: Record<string, unknown> = {
          suspicionScore: scoreResult.compositeScore,
        };

        // Flag wallet if threshold crossed
        if (
          scoreResult.compositeScore >= this.config.flagThreshold &&
          !wallet.isFlagged
        ) {
          updates.isFlagged = true;
          updates.riskLevel = this.scoreToRiskLevel(scoreResult.compositeScore);
          walletsFlagged++;

          this.emit("wallet:flagged", {
            walletId: wallet.id,
            address: wallet.address,
            score: scoreResult.compositeScore,
          });
        }

        // Mark as potential insider if threshold crossed
        if (
          scoreResult.compositeScore >= this.config.insiderThreshold &&
          !wallet.isInsider
        ) {
          updates.isInsider = true;
          potentialInsiders++;

          // Generate high-priority alert
          await this.alertService.create({
            type: AlertType.INSIDER_ACTIVITY,
            severity: AlertSeverity.CRITICAL,
            walletId: wallet.id,
            title: `Potential Insider Activity: ${wallet.address.slice(0, 10)}...`,
            message: `Wallet has very high suspicion score (${scoreResult.compositeScore.toFixed(1)}/100). Level: ${scoreResult.suspicionLevel}. Multiple suspicious indicators detected.`,
            data: {
              walletAddress: wallet.address,
              compositeScore: scoreResult.compositeScore,
              suspicionLevel: scoreResult.suspicionLevel,
              categoryCount: scoreResult.categoryBreakdown?.length ?? 0,
              riskFlagCount: scoreResult.riskFlags?.length ?? 0,
            } as Prisma.InputJsonObject,
            tags: [
              "insider",
              "detection",
              "critical",
              scoreResult.suspicionLevel.toLowerCase(),
            ],
          });

          this.emit("alert:insider", {
            walletId: wallet.id,
            address: wallet.address,
            score: scoreResult.compositeScore,
          });
        }

        // Apply updates
        await this.walletService.update(wallet.id, updates);
      } catch (error) {
        this.logger("Failed to update suspicion score", {
          walletId: wallet.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { walletsFlagged, potentialInsiders };
  }

  /**
   * Map confidence level to alert severity
   */
  private mapConfidenceToSeverity(level: ConfidenceLevel): AlertSeverity {
    switch (level) {
      case ConfidenceLevel.VERY_HIGH:
        return AlertSeverity.CRITICAL;
      case ConfidenceLevel.HIGH:
        return AlertSeverity.HIGH;
      case ConfidenceLevel.MODERATE:
        return AlertSeverity.MEDIUM;
      case ConfidenceLevel.LOW:
      case ConfidenceLevel.VERY_LOW:
      default:
        return AlertSeverity.LOW;
    }
  }

  /**
   * Map spike severity to alert severity
   */
  private mapSpikeSeverityToAlertSeverity(severity: SpikeSeverity): AlertSeverity {
    switch (severity) {
      case SpikeSeverity.CRITICAL:
        return AlertSeverity.CRITICAL;
      case SpikeSeverity.HIGH:
        return AlertSeverity.HIGH;
      case SpikeSeverity.MEDIUM:
        return AlertSeverity.MEDIUM;
      case SpikeSeverity.LOW:
      default:
        return AlertSeverity.LOW;
    }
  }

  /**
   * Convert suspicion score to risk level
   */
  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 85) return RiskLevel.CRITICAL;
    if (score >= 70) return RiskLevel.HIGH;
    if (score >= 50) return RiskLevel.MEDIUM;
    if (score >= 25) return RiskLevel.LOW;
    return RiskLevel.NONE;
  }

  /**
   * Build fresh wallet alert message
   */
  private buildFreshWalletAlertMessage(
    wallet: WalletForDetection,
    result: FreshWalletConfidenceResult
  ): string {
    const parts = [
      `Fresh wallet detected with suspicion score: ${result.confidenceScore.toFixed(1)}/100.`,
      `Confidence level: ${result.confidenceLevel}.`,
    ];

    if (wallet.tradeCount <= 1) {
      parts.push("This is their first trade on Polymarket.");
    } else {
      parts.push(`Trade count: ${wallet.tradeCount}.`);
    }

    if (wallet.totalVolume > 0) {
      parts.push(`Total volume: $${wallet.totalVolume.toFixed(2)}.`);
    }

    return parts.join(" ");
  }

  /**
   * Check if detection is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new detection trigger instance
 */
export function createDetectionTrigger(
  config: DetectionTriggerConfig = {}
): DetectionTrigger {
  return new DetectionTrigger(config);
}

// Shared instance
let sharedDetectionTrigger: DetectionTrigger | null = null;

/**
 * Get the shared detection trigger instance
 */
export function getSharedDetectionTrigger(): DetectionTrigger {
  if (!sharedDetectionTrigger) {
    sharedDetectionTrigger = createDetectionTrigger();
  }
  return sharedDetectionTrigger;
}

/**
 * Set the shared detection trigger instance
 */
export function setSharedDetectionTrigger(trigger: DetectionTrigger): void {
  sharedDetectionTrigger = trigger;
}

/**
 * Reset the shared detection trigger instance
 */
export function resetSharedDetectionTrigger(): void {
  sharedDetectionTrigger = null;
}
