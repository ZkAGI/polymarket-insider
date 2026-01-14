/**
 * Alert Generator Service (API-LIVE-004)
 *
 * Background service that generates alerts from detection signals and broadcasts
 * them via Telegram and other notification channels.
 *
 * Features:
 * - Listen for 'trade:processed' and 'wallet:profiled' events
 * - Run detection algorithms: fresh wallet, whale trade, volume spike, etc.
 * - If detection triggers: create Alert in database
 * - Calculate severity (CRITICAL/HIGH/MEDIUM/LOW/INFO)
 * - Call Telegram broadcaster to send alert
 * - Emit 'alert:created' event for UI updates
 * - Deduplicate similar alerts within time window
 */

import { EventEmitter } from "events";
import type { PrismaClient, Alert } from "@prisma/client";
import { AlertType, AlertSeverity } from "@prisma/client";
import {
  AlertService,
  alertService as defaultAlertService,
  type CreateAlertInput,
} from "../db/alerts";
import { prisma as defaultPrisma } from "../db/client";
import {
  AlertBroadcaster,
  alertBroadcaster as defaultBroadcaster,
  type BroadcastResult,
} from "../telegram/broadcaster";
import {
  TradeStreamService,
  tradeStreamService as defaultTradeStreamService,
  type TradeProcessedEvent,
  type WhaleTradeEvent,
  type NewWalletEvent,
} from "./trade-stream";
import {
  WalletProfilerService,
  type WalletProfiledEvent,
} from "./wallet-profiler";
import { env } from "../../config/env";
import {
  getDashboardEventBus,
  type AlertEventData,
} from "../lib/dashboard-events";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the Alert Generator Service
 */
export interface AlertGeneratorConfig {
  /** TradeStreamService to listen to */
  tradeStreamService?: TradeStreamService;

  /** WalletProfilerService to listen to */
  walletProfilerService?: WalletProfilerService;

  /** AlertService for storing alerts */
  alertService?: AlertService;

  /** AlertBroadcaster for Telegram notifications */
  alertBroadcaster?: AlertBroadcaster;

  /** Custom Prisma client */
  prisma?: PrismaClient;

  /** Enable emitting events */
  enableEvents?: boolean;

  /** Enable Telegram broadcasting */
  enableTelegramBroadcast?: boolean;

  /** Whale trade USD threshold to generate alerts */
  whaleThreshold?: number;

  /** Suspicion score threshold to generate alerts */
  suspicionThreshold?: number;

  /** Deduplication time window in milliseconds (default: 5 minutes) */
  deduplicationWindowMs?: number;

  /** Maximum alerts per hour per wallet (default: 10) */
  maxAlertsPerWalletPerHour?: number;

  /** Maximum alerts per hour per market (default: 20) */
  maxAlertsPerMarketPerHour?: number;

  /** Logger function */
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Alert created event
 */
export interface AlertCreatedEvent {
  type: "alert:created";
  alert: Alert;
  broadcastResult?: BroadcastResult;
}

/**
 * Alert suppressed event (deduplicated)
 */
export interface AlertSuppressedEvent {
  type: "alert:suppressed";
  reason: "duplicate" | "rate_limit";
  alertType: AlertType;
  walletId?: string;
  marketId?: string;
}

/**
 * Alert generation statistics
 */
export interface AlertGeneratorStats {
  /** Total alerts generated */
  totalGenerated: number;

  /** Alerts broadcast via Telegram */
  broadcastCount: number;

  /** Alerts suppressed due to deduplication */
  suppressedCount: number;

  /** Alerts by type */
  byType: Partial<Record<AlertType, number>>;

  /** Alerts by severity */
  bySeverity: Record<AlertSeverity, number>;

  /** Service start time */
  startedAt: Date | null;

  /** Last alert generated at */
  lastAlertAt: Date | null;
}

// Deduplication key format: "type:walletId:marketId"
// Rate limit tracking uses separate Maps

/**
 * Rate limit tracker
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// ============================================================================
// Alert Generator Service
// ============================================================================

/**
 * Alert Generator Service
 *
 * Generates alerts from detection signals and broadcasts them.
 */
export class AlertGeneratorService extends EventEmitter {
  private config: Required<
    Pick<
      AlertGeneratorConfig,
      | "enableEvents"
      | "enableTelegramBroadcast"
      | "whaleThreshold"
      | "suspicionThreshold"
      | "deduplicationWindowMs"
      | "maxAlertsPerWalletPerHour"
      | "maxAlertsPerMarketPerHour"
    >
  >;

  private readonly tradeStreamService?: TradeStreamService;
  private readonly walletProfilerService?: WalletProfilerService;
  private readonly alertService: AlertService;
  private readonly alertBroadcaster: AlertBroadcaster;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  private isRunning = false;
  private stats: AlertGeneratorStats = {
    totalGenerated: 0,
    broadcastCount: 0,
    suppressedCount: 0,
    byType: {},
    bySeverity: {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0,
    },
    startedAt: null,
    lastAlertAt: null,
  };

  // Deduplication cache: Map<keyHash, timestamp>
  private deduplicationCache: Map<string, number> = new Map();
  private deduplicationCleanupInterval?: NodeJS.Timeout;

  // Rate limit tracking
  private walletRateLimits: Map<string, RateLimitEntry> = new Map();
  private marketRateLimits: Map<string, RateLimitEntry> = new Map();
  private rateLimitCleanupInterval?: NodeJS.Timeout;

  // Event listener cleanup
  private tradeProcessedHandler?: (event: TradeProcessedEvent) => void;
  private whaleTradeHandler?: (event: WhaleTradeEvent) => void;
  private newWalletHandler?: (event: NewWalletEvent) => void;
  private walletProfiledHandler?: (event: WalletProfiledEvent) => void;

  constructor(config: AlertGeneratorConfig = {}) {
    super();

    this.config = {
      enableEvents: config.enableEvents ?? true,
      enableTelegramBroadcast: config.enableTelegramBroadcast ?? true,
      whaleThreshold: config.whaleThreshold ?? env.WHALE_THRESHOLD_USD,
      suspicionThreshold: config.suspicionThreshold ?? 70, // Score 0-100
      deduplicationWindowMs: config.deduplicationWindowMs ?? 5 * 60 * 1000, // 5 minutes
      maxAlertsPerWalletPerHour: config.maxAlertsPerWalletPerHour ?? 10,
      maxAlertsPerMarketPerHour: config.maxAlertsPerMarketPerHour ?? 20,
    };

    this.tradeStreamService = config.tradeStreamService;
    this.walletProfilerService = config.walletProfilerService;
    this.alertService = config.alertService ?? defaultAlertService;
    this.alertBroadcaster = config.alertBroadcaster ?? defaultBroadcaster;
    // prisma kept for future direct DB access if needed
    void (config.prisma ?? defaultPrisma);
    this.logger = config.logger ?? this.defaultLogger.bind(this);
  }

  /**
   * Default logger
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [AlertGeneratorService] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [AlertGeneratorService] ${message}`);
    }
  }

  /**
   * Start the alert generator service.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger("Service already running");
      return;
    }

    this.logger("Starting alert generator service", {
      whaleThreshold: this.config.whaleThreshold,
      suspicionThreshold: this.config.suspicionThreshold,
      enableTelegramBroadcast: this.config.enableTelegramBroadcast,
    });

    this.isRunning = true;
    this.stats.startedAt = new Date();

    // Set up event handlers
    this.setupEventHandlers();

    // Start cleanup intervals
    this.startCleanupIntervals();

    this.emit("started");
    this.logger("Alert generator service started");
  }

  /**
   * Stop the alert generator service.
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger("Service not running");
      return;
    }

    this.logger("Stopping alert generator service");

    // Remove event handlers
    this.removeEventHandlers();

    // Stop cleanup intervals
    this.stopCleanupIntervals();

    this.isRunning = false;
    this.emit("stopped");
    this.logger("Service stopped");
  }

  /**
   * Check if the service is running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current statistics.
   */
  getStats(): AlertGeneratorStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalGenerated: 0,
      broadcastCount: 0,
      suppressedCount: 0,
      byType: {},
      bySeverity: {
        [AlertSeverity.INFO]: 0,
        [AlertSeverity.LOW]: 0,
        [AlertSeverity.MEDIUM]: 0,
        [AlertSeverity.HIGH]: 0,
        [AlertSeverity.CRITICAL]: 0,
      },
      startedAt: this.isRunning ? new Date() : null,
      lastAlertAt: null,
    };
    this.logger("Statistics reset");
  }

  /**
   * Update configuration.
   */
  updateConfig(
    config: Partial<
      Pick<
        AlertGeneratorConfig,
        | "enableEvents"
        | "enableTelegramBroadcast"
        | "whaleThreshold"
        | "suspicionThreshold"
        | "deduplicationWindowMs"
        | "maxAlertsPerWalletPerHour"
        | "maxAlertsPerMarketPerHour"
      >
    >
  ): void {
    if (config.enableEvents !== undefined) {
      this.config.enableEvents = config.enableEvents;
    }
    if (config.enableTelegramBroadcast !== undefined) {
      this.config.enableTelegramBroadcast = config.enableTelegramBroadcast;
    }
    if (config.whaleThreshold !== undefined) {
      this.config.whaleThreshold = config.whaleThreshold;
    }
    if (config.suspicionThreshold !== undefined) {
      this.config.suspicionThreshold = config.suspicionThreshold;
    }
    if (config.deduplicationWindowMs !== undefined) {
      this.config.deduplicationWindowMs = config.deduplicationWindowMs;
    }
    if (config.maxAlertsPerWalletPerHour !== undefined) {
      this.config.maxAlertsPerWalletPerHour = config.maxAlertsPerWalletPerHour;
    }
    if (config.maxAlertsPerMarketPerHour !== undefined) {
      this.config.maxAlertsPerMarketPerHour = config.maxAlertsPerMarketPerHour;
    }

    this.logger("Config updated", { config: this.config });
  }

  /**
   * Set up event handlers.
   */
  private setupEventHandlers(): void {
    // Listen to TradeStreamService events
    if (this.tradeStreamService) {
      this.tradeProcessedHandler = (event: TradeProcessedEvent) => {
        void this.handleTradeProcessed(event);
      };
      this.tradeStreamService.on("trade:processed", this.tradeProcessedHandler);

      this.whaleTradeHandler = (event: WhaleTradeEvent) => {
        void this.handleWhaleTrade(event);
      };
      this.tradeStreamService.on("trade:whale", this.whaleTradeHandler);

      this.newWalletHandler = (event: NewWalletEvent) => {
        void this.handleNewWallet(event);
      };
      this.tradeStreamService.on("wallet:new", this.newWalletHandler);
    }

    // Listen to WalletProfilerService events
    if (this.walletProfilerService) {
      this.walletProfiledHandler = (event: WalletProfiledEvent) => {
        void this.handleWalletProfiled(event);
      };
      this.walletProfilerService.on("wallet:profiled", this.walletProfiledHandler);
    }
  }

  /**
   * Remove event handlers.
   */
  private removeEventHandlers(): void {
    if (this.tradeStreamService) {
      if (this.tradeProcessedHandler) {
        this.tradeStreamService.off("trade:processed", this.tradeProcessedHandler);
        this.tradeProcessedHandler = undefined;
      }
      if (this.whaleTradeHandler) {
        this.tradeStreamService.off("trade:whale", this.whaleTradeHandler);
        this.whaleTradeHandler = undefined;
      }
      if (this.newWalletHandler) {
        this.tradeStreamService.off("wallet:new", this.newWalletHandler);
        this.newWalletHandler = undefined;
      }
    }

    if (this.walletProfilerService) {
      if (this.walletProfiledHandler) {
        this.walletProfilerService.off("wallet:profiled", this.walletProfiledHandler);
        this.walletProfiledHandler = undefined;
      }
    }
  }

  /**
   * Start cleanup intervals for deduplication and rate limiting.
   */
  private startCleanupIntervals(): void {
    // Clean up deduplication cache every minute
    this.deduplicationCleanupInterval = setInterval(() => {
      this.cleanupDeduplicationCache();
    }, 60 * 1000);

    // Clean up rate limits every 5 minutes
    this.rateLimitCleanupInterval = setInterval(() => {
      this.cleanupRateLimits();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup intervals.
   */
  private stopCleanupIntervals(): void {
    if (this.deduplicationCleanupInterval) {
      clearInterval(this.deduplicationCleanupInterval);
      this.deduplicationCleanupInterval = undefined;
    }
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = undefined;
    }
  }

  /**
   * Handle trade:processed event.
   */
  private async handleTradeProcessed(_event: TradeProcessedEvent): Promise<void> {
    // Check for unusual patterns or signals from the trade
    // Most detection happens via whale trades and wallet profiling
    // This handler is mainly for tracking and potential future extensions
  }

  /**
   * Handle trade:whale event - generate whale trade alert.
   */
  private async handleWhaleTrade(event: WhaleTradeEvent): Promise<void> {
    this.logger("Handling whale trade", {
      tradeId: event.tradeId,
      usdValue: event.usdValue,
      walletAddress: event.walletAddress,
    });

    // Check for deduplication and rate limiting
    if (!this.shouldGenerateAlert(AlertType.WHALE_TRADE, event.walletId, event.marketId)) {
      return;
    }

    // Determine severity based on trade size
    const severity = this.calculateWhaleTradeSeverity(event.usdValue);

    // Format trade value for display
    const formattedValue = this.formatUsdValue(event.usdValue);
    const sideLabel = event.side === "BUY" ? "buy" : "sell";

    // Create alert
    const alertInput: CreateAlertInput = {
      type: AlertType.WHALE_TRADE,
      severity,
      marketId: event.marketId,
      walletId: event.walletId,
      title: `🐋 Whale Trade: ${formattedValue} ${sideLabel}`,
      message: `Large ${sideLabel} trade detected. Wallet ${this.truncateAddress(event.walletAddress)} executed a ${formattedValue} trade at price ${(event.price * 100).toFixed(1)}%.`,
      data: {
        tradeId: event.tradeId,
        clobTradeId: event.clobTradeId,
        walletAddress: event.walletAddress,
        side: event.side,
        amount: event.amount,
        price: event.price,
        usdValue: event.usdValue,
        tradeValue: event.usdValue, // For Telegram formatter
        timestamp: event.timestamp.toISOString(),
      },
      tags: ["whale", "large-trade", event.side.toLowerCase()],
    };

    await this.createAndBroadcastAlert(alertInput);
  }

  /**
   * Handle wallet:new event - generate fresh wallet alert.
   */
  private async handleNewWallet(event: NewWalletEvent): Promise<void> {
    this.logger("Handling new wallet", {
      walletId: event.walletId,
      address: event.address,
    });

    // Check for deduplication and rate limiting
    if (!this.shouldGenerateAlert(AlertType.FRESH_WALLET, event.walletId)) {
      return;
    }

    // Create alert for new wallet
    const alertInput: CreateAlertInput = {
      type: AlertType.FRESH_WALLET,
      severity: AlertSeverity.MEDIUM,
      walletId: event.walletId,
      title: `🆕 New Wallet Trading`,
      message: `Fresh wallet ${this.truncateAddress(event.address)} made its first trade. This wallet has no prior Polymarket trading history.`,
      data: {
        walletAddress: event.address,
        fromTrade: event.fromTrade,
        timestamp: new Date().toISOString(),
      },
      tags: ["fresh-wallet", "first-trade", "new"],
    };

    await this.createAndBroadcastAlert(alertInput);
  }

  /**
   * Handle wallet:profiled event - generate alerts based on suspicion score.
   */
  private async handleWalletProfiled(event: WalletProfiledEvent): Promise<void> {
    const { walletId, address, suspicionScore, isFresh, riskLevel, confidenceLevel } = event;

    this.logger("Handling wallet profiled", {
      walletId,
      address,
      suspicionScore,
      isFresh,
      riskLevel,
    });

    // Only generate alert if suspicion score exceeds threshold
    if (suspicionScore < this.config.suspicionThreshold) {
      return;
    }

    // Check for deduplication and rate limiting
    if (!this.shouldGenerateAlert(AlertType.INSIDER_ACTIVITY, walletId)) {
      return;
    }

    // Determine severity based on suspicion score
    const severity = this.calculateSuspicionSeverity(suspicionScore);

    // Build alert message based on profile characteristics
    const characteristics: string[] = [];
    if (isFresh) {
      characteristics.push("fresh wallet");
    }
    if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
      characteristics.push(`${riskLevel.toLowerCase()} risk`);
    }

    const characteristicsText =
      characteristics.length > 0
        ? ` Characteristics: ${characteristics.join(", ")}.`
        : "";

    // Create alert
    const alertInput: CreateAlertInput = {
      type: AlertType.INSIDER_ACTIVITY,
      severity,
      walletId,
      title: `🕵️ High Suspicion Wallet: Score ${suspicionScore}`,
      message: `Wallet ${this.truncateAddress(address)} has a suspicion score of ${suspicionScore}/100.${characteristicsText}`,
      data: {
        walletAddress: address,
        suspicionScore,
        isFresh,
        characteristics,
        confidenceLevel,
        riskLevel,
        timestamp: new Date().toISOString(),
      },
      tags: [
        "suspicious",
        "high-score",
        ...(isFresh ? ["fresh-wallet"] : []),
      ],
    };

    await this.createAndBroadcastAlert(alertInput);
  }

  /**
   * Create an alert and broadcast it via Telegram.
   */
  private async createAndBroadcastAlert(input: CreateAlertInput): Promise<Alert> {
    // Create alert in database
    const alert = await this.alertService.create(input);

    this.logger("Alert created", {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
    });

    // Update statistics
    this.updateStats(alert);

    // Broadcast via Telegram if enabled
    let broadcastResult: BroadcastResult | undefined;
    if (this.config.enableTelegramBroadcast) {
      try {
        broadcastResult = await this.alertBroadcaster.broadcast(alert);
        this.stats.broadcastCount++;
        this.logger("Alert broadcast", {
          alertId: alert.id,
          sent: broadcastResult.sent,
          failed: broadcastResult.failed,
        });
      } catch (error) {
        this.logger("Failed to broadcast alert", {
          alertId: alert.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Emit to dashboard event bus for real-time UI updates
    this.emitDashboardEvent(alert, input);

    // Emit event
    if (this.config.enableEvents) {
      this.emit("alert:created", {
        type: "alert:created",
        alert,
        broadcastResult,
      } as AlertCreatedEvent);
    }

    return alert;
  }

  /**
   * Emit alert to dashboard event bus for real-time UI updates (UI-WS-001)
   */
  private emitDashboardEvent(alert: Alert, input: CreateAlertInput): void {
    try {
      const eventBus = getDashboardEventBus();
      const alertData: AlertEventData = {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        marketId: alert.marketId,
        walletId: alert.walletId,
        walletAddress: typeof input.data === 'object' && input.data !== null && 'walletAddress' in input.data
          ? String(input.data.walletAddress)
          : undefined,
        tags: input.tags ?? [],
        createdAt: alert.createdAt.toISOString(),
      };
      eventBus.emitAlertNew(alertData);
      this.logger("Dashboard event emitted", { alertId: alert.id });
    } catch (error) {
      this.logger("Failed to emit dashboard event", {
        alertId: alert.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if an alert should be generated (deduplication + rate limiting).
   */
  private shouldGenerateAlert(
    type: AlertType,
    walletId?: string,
    marketId?: string
  ): boolean {
    const now = Date.now();

    // Check deduplication
    const deduplicationKey = this.generateDeduplicationKey(type, walletId, marketId);
    const lastAlertTime = this.deduplicationCache.get(deduplicationKey);

    if (lastAlertTime && now - lastAlertTime < this.config.deduplicationWindowMs) {
      this.stats.suppressedCount++;
      if (this.config.enableEvents) {
        this.emit("alert:suppressed", {
          type: "alert:suppressed",
          reason: "duplicate",
          alertType: type,
          walletId,
          marketId,
        } as AlertSuppressedEvent);
      }
      this.logger("Alert suppressed (duplicate)", { type, walletId, marketId });
      return false;
    }

    // Check wallet rate limit
    if (walletId && !this.checkRateLimit(this.walletRateLimits, walletId, this.config.maxAlertsPerWalletPerHour)) {
      this.stats.suppressedCount++;
      if (this.config.enableEvents) {
        this.emit("alert:suppressed", {
          type: "alert:suppressed",
          reason: "rate_limit",
          alertType: type,
          walletId,
        } as AlertSuppressedEvent);
      }
      this.logger("Alert suppressed (wallet rate limit)", { type, walletId });
      return false;
    }

    // Check market rate limit
    if (marketId && !this.checkRateLimit(this.marketRateLimits, marketId, this.config.maxAlertsPerMarketPerHour)) {
      this.stats.suppressedCount++;
      if (this.config.enableEvents) {
        this.emit("alert:suppressed", {
          type: "alert:suppressed",
          reason: "rate_limit",
          alertType: type,
          marketId,
        } as AlertSuppressedEvent);
      }
      this.logger("Alert suppressed (market rate limit)", { type, marketId });
      return false;
    }

    // Update caches
    this.deduplicationCache.set(deduplicationKey, now);
    if (walletId) {
      this.incrementRateLimit(this.walletRateLimits, walletId);
    }
    if (marketId) {
      this.incrementRateLimit(this.marketRateLimits, marketId);
    }

    return true;
  }

  /**
   * Generate a deduplication key for an alert.
   */
  private generateDeduplicationKey(
    type: AlertType,
    walletId?: string,
    marketId?: string
  ): string {
    return `${type}:${walletId || ""}:${marketId || ""}`;
  }

  /**
   * Check if rate limit is exceeded.
   */
  private checkRateLimit(
    limits: Map<string, RateLimitEntry>,
    key: string,
    maxPerHour: number
  ): boolean {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const entry = limits.get(key);

    if (!entry) {
      return true;
    }

    // Reset if window expired
    if (entry.windowStart < hourAgo) {
      return true;
    }

    return entry.count < maxPerHour;
  }

  /**
   * Increment rate limit counter.
   */
  private incrementRateLimit(limits: Map<string, RateLimitEntry>, key: string): void {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const entry = limits.get(key);

    if (!entry || entry.windowStart < hourAgo) {
      limits.set(key, { count: 1, windowStart: now });
    } else {
      entry.count++;
    }
  }

  /**
   * Clean up deduplication cache.
   */
  private cleanupDeduplicationCache(): void {
    const now = Date.now();
    const cutoff = now - this.config.deduplicationWindowMs;
    let cleaned = 0;

    for (const [key, timestamp] of this.deduplicationCache.entries()) {
      if (timestamp < cutoff) {
        this.deduplicationCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger("Cleaned deduplication cache", { cleaned });
    }
  }

  /**
   * Clean up rate limits.
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    let cleaned = 0;

    for (const [key, entry] of this.walletRateLimits.entries()) {
      if (entry.windowStart < hourAgo) {
        this.walletRateLimits.delete(key);
        cleaned++;
      }
    }

    for (const [key, entry] of this.marketRateLimits.entries()) {
      if (entry.windowStart < hourAgo) {
        this.marketRateLimits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger("Cleaned rate limits", { cleaned });
    }
  }

  /**
   * Calculate severity for whale trade alerts.
   */
  private calculateWhaleTradeSeverity(usdValue: number): AlertSeverity {
    // Severity thresholds (can be made configurable)
    if (usdValue >= 500000) {
      return AlertSeverity.CRITICAL;
    } else if (usdValue >= 250000) {
      return AlertSeverity.HIGH;
    } else if (usdValue >= 100000) {
      return AlertSeverity.MEDIUM;
    } else if (usdValue >= 50000) {
      return AlertSeverity.LOW;
    }
    return AlertSeverity.INFO;
  }

  /**
   * Calculate severity based on suspicion score.
   */
  private calculateSuspicionSeverity(score: number): AlertSeverity {
    if (score >= 95) {
      return AlertSeverity.CRITICAL;
    } else if (score >= 85) {
      return AlertSeverity.HIGH;
    } else if (score >= 75) {
      return AlertSeverity.MEDIUM;
    } else if (score >= 70) {
      return AlertSeverity.LOW;
    }
    return AlertSeverity.INFO;
  }

  /**
   * Update statistics with new alert.
   */
  private updateStats(alert: Alert): void {
    this.stats.totalGenerated++;
    this.stats.lastAlertAt = new Date();
    this.stats.bySeverity[alert.severity]++;

    if (!this.stats.byType[alert.type]) {
      this.stats.byType[alert.type] = 0;
    }
    this.stats.byType[alert.type]!++;
  }

  /**
   * Format USD value for display.
   */
  private formatUsdValue(value: number): string {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  }

  /**
   * Truncate address for display.
   */
  private truncateAddress(address: string): string {
    if (address.length < 10) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Manually generate an alert (for testing or admin commands).
   */
  async generateAlert(input: CreateAlertInput): Promise<Alert> {
    return this.createAndBroadcastAlert(input);
  }

  /**
   * Dispose of the service and clean up resources.
   */
  dispose(): void {
    this.stop();
    this.deduplicationCache.clear();
    this.walletRateLimits.clear();
    this.marketRateLimits.clear();
    this.removeAllListeners();
    this.logger("Service disposed");
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Default alert generator service instance.
 */
export const alertGeneratorService = new AlertGeneratorService({
  tradeStreamService: defaultTradeStreamService,
});

/**
 * Create a new alert generator service instance with custom configuration.
 */
export function createAlertGeneratorService(
  config: AlertGeneratorConfig = {}
): AlertGeneratorService {
  return new AlertGeneratorService(config);
}
