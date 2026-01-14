/**
 * Telegram Alert Broadcaster Service
 *
 * Broadcasts alerts to all active Telegram subscribers based on their
 * individual alert preferences and severity settings.
 */

import type { Alert, TelegramSubscriber, PrismaClient } from "@prisma/client";
import { AlertType, AlertSeverity } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/client";
import {
  TelegramSubscriberService,
  telegramSubscriberService,
  type AlertPreferences,
} from "../db/telegram-subscribers";
import { TelegramBotClient, getTelegramBot } from "./bot";

/**
 * Severity level hierarchy for comparison
 * Higher number = higher severity
 */
const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  [AlertSeverity.INFO]: 0,
  [AlertSeverity.LOW]: 1,
  [AlertSeverity.MEDIUM]: 2,
  [AlertSeverity.HIGH]: 3,
  [AlertSeverity.CRITICAL]: 4,
};

/**
 * Alert type to preference key mapping
 */
const ALERT_TYPE_TO_PREFERENCE: Partial<Record<AlertType, keyof AlertPreferences>> = {
  [AlertType.WHALE_TRADE]: "whaleAlerts",
  [AlertType.INSIDER_ACTIVITY]: "insiderAlerts",
  [AlertType.PRICE_MOVEMENT]: "priceMovementAlerts",
  [AlertType.MARKET_RESOLVED]: "marketResolutionAlerts",
  [AlertType.FRESH_WALLET]: "insiderAlerts", // Fresh wallet is considered insider activity
  [AlertType.WALLET_REACTIVATION]: "insiderAlerts",
  [AlertType.COORDINATED_ACTIVITY]: "insiderAlerts",
  [AlertType.UNUSUAL_PATTERN]: "insiderAlerts",
  [AlertType.SUSPICIOUS_FUNDING]: "insiderAlerts",
  [AlertType.NEW_MARKET]: "priceMovementAlerts",
};

/**
 * Result of a single send operation
 */
export interface SendResult {
  chatId: bigint;
  success: boolean;
  messageId?: number;
  error?: string;
  shouldDeactivate?: boolean;
  deactivationReason?: string;
}

/**
 * Result of a broadcast operation
 */
export interface BroadcastResult {
  alertId: string;
  totalSubscribers: number;
  eligibleSubscribers: number;
  sent: number;
  failed: number;
  deactivated: number;
  results: SendResult[];
  duration: number;
}

/**
 * Options for broadcast operations
 */
export interface BroadcastOptions {
  /** Override the bot client (for testing) */
  botClient?: TelegramBotClient;
  /** Override the subscriber service (for testing) */
  subscriberService?: TelegramSubscriberService;
  /** Override the prisma client (for testing) */
  prisma?: PrismaClient;
  /** Dry run mode - don't actually send messages */
  dryRun?: boolean;
  /** Maximum concurrent sends */
  concurrency?: number;
  /** Delay between sends in ms (for rate limiting) */
  sendDelay?: number;
}

/**
 * Get emoji for alert severity
 */
export function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.INFO:
      return "ℹ️";
    case AlertSeverity.LOW:
      return "🔵";
    case AlertSeverity.MEDIUM:
      return "🟡";
    case AlertSeverity.HIGH:
      return "🟠";
    case AlertSeverity.CRITICAL:
      return "🔴";
    default:
      return "📢";
  }
}

/**
 * Get emoji for alert type
 */
export function getAlertTypeEmoji(type: AlertType): string {
  switch (type) {
    case AlertType.WHALE_TRADE:
      return "🐋";
    case AlertType.INSIDER_ACTIVITY:
      return "🕵️";
    case AlertType.PRICE_MOVEMENT:
      return "📈";
    case AlertType.FRESH_WALLET:
      return "🆕";
    case AlertType.WALLET_REACTIVATION:
      return "⏰";
    case AlertType.COORDINATED_ACTIVITY:
      return "🔗";
    case AlertType.UNUSUAL_PATTERN:
      return "⚠️";
    case AlertType.MARKET_RESOLVED:
      return "✅";
    case AlertType.NEW_MARKET:
      return "🆕";
    case AlertType.SUSPICIOUS_FUNDING:
      return "💰";
    default:
      return "📢";
  }
}

/**
 * Format an alert for Telegram message
 */
export function formatAlertMessage(alert: Alert): string {
  const severityEmoji = getSeverityEmoji(alert.severity);
  const typeEmoji = getAlertTypeEmoji(alert.type);
  const severityLabel = alert.severity.charAt(0) + alert.severity.slice(1).toLowerCase();

  // Build the message
  let message = `${severityEmoji} ${typeEmoji} *${escapeMarkdown(alert.title)}*\n\n`;
  message += `${escapeMarkdown(alert.message)}\n\n`;
  message += `📊 Severity: ${severityLabel}\n`;
  message += `🏷️ Type: ${formatAlertType(alert.type)}\n`;

  // Add data details if available
  const data = alert.data as Record<string, unknown> | null;
  if (data) {
    if (data.tradeValue !== undefined) {
      message += `💵 Trade Value: $${formatNumber(data.tradeValue as number)}\n`;
    }
    if (data.walletAddress !== undefined) {
      const addr = data.walletAddress as string;
      message += `👛 Wallet: \`${addr.slice(0, 6)}...${addr.slice(-4)}\`\n`;
    }
    if (data.marketQuestion !== undefined) {
      message += `❓ Market: ${escapeMarkdown(data.marketQuestion as string)}\n`;
    }
  }

  // Add timestamp
  message += `\n🕐 ${formatTimestamp(alert.createdAt)}`;

  return message;
}

/**
 * Format alert type for display
 */
export function formatAlertType(type: AlertType): string {
  const formatted = type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return formatted;
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Escape special characters for Telegram Markdown
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

/**
 * Compare severities - returns true if severity meets or exceeds minimum
 */
export function meetsSeverityRequirement(
  alertSeverity: AlertSeverity,
  minSeverity: AlertSeverity
): boolean {
  return SEVERITY_ORDER[alertSeverity] >= SEVERITY_ORDER[minSeverity];
}

/**
 * Check if an alert matches a subscriber's preferences
 */
export function matchesAlertPreferences(
  alert: Alert,
  subscriber: TelegramSubscriber
): boolean {
  // Check severity requirement first
  if (!meetsSeverityRequirement(alert.severity, subscriber.minSeverity)) {
    return false;
  }

  const preferences = subscriber.alertPreferences as AlertPreferences | null;

  // If no preferences set, accept all alerts that meet severity
  if (!preferences) {
    return true;
  }

  // Check if this alert type is disabled
  const disabledTypes = preferences.disabledTypes || [];
  if (disabledTypes.includes(alert.type)) {
    return false;
  }

  // Check if enabled types are specified and this type is not in the list
  const enabledTypes = preferences.enabledTypes || [];
  if (enabledTypes.length > 0 && !enabledTypes.includes(alert.type)) {
    return false;
  }

  // Check specific preference toggles
  const preferenceKey = ALERT_TYPE_TO_PREFERENCE[alert.type];
  if (preferenceKey) {
    const preferenceValue = preferences[preferenceKey];
    // If explicitly disabled, reject
    if (preferenceValue === false) {
      return false;
    }
  }

  // Check whale alert toggle
  if (alert.type === AlertType.WHALE_TRADE && preferences.whaleAlerts === false) {
    return false;
  }

  // Check insider alert toggle (covers multiple types)
  const insiderAlertTypes: AlertType[] = [
    AlertType.INSIDER_ACTIVITY,
    AlertType.FRESH_WALLET,
    AlertType.WALLET_REACTIVATION,
    AlertType.COORDINATED_ACTIVITY,
    AlertType.UNUSUAL_PATTERN,
    AlertType.SUSPICIOUS_FUNDING,
  ];
  if (insiderAlertTypes.includes(alert.type) && preferences.insiderAlerts === false) {
    return false;
  }

  // Check minimum trade value
  if (preferences.minTradeValue !== undefined && preferences.minTradeValue > 0) {
    const data = alert.data as Record<string, unknown> | null;
    const tradeValue = data?.tradeValue as number | undefined;
    if (tradeValue !== undefined && tradeValue < preferences.minTradeValue) {
      return false;
    }
  }

  // Check watched markets
  if (preferences.watchedMarkets && preferences.watchedMarkets.length > 0) {
    if (alert.marketId && !preferences.watchedMarkets.includes(alert.marketId)) {
      return false;
    }
  }

  // Check watched wallets
  if (preferences.watchedWallets && preferences.watchedWallets.length > 0) {
    if (alert.walletId && !preferences.watchedWallets.includes(alert.walletId)) {
      // If wallet filter is set, only show alerts for watched wallets
      // But still show alerts without a wallet ID
      if (alert.walletId) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filter subscribers by alert preferences
 */
export function filterEligibleSubscribers(
  alert: Alert,
  subscribers: TelegramSubscriber[]
): TelegramSubscriber[] {
  return subscribers.filter((subscriber) => matchesAlertPreferences(alert, subscriber));
}

/**
 * Check if an error indicates the user blocked the bot or chat not found
 */
export function shouldDeactivateOnError(error: string): {
  shouldDeactivate: boolean;
  reason?: string;
} {
  const lowerError = error.toLowerCase();

  // Telegram error codes/messages that indicate user blocked bot or chat not found
  if (
    lowerError.includes("forbidden") ||
    lowerError.includes("bot was blocked") ||
    lowerError.includes("user is deactivated") ||
    lowerError.includes("403")
  ) {
    return { shouldDeactivate: true, reason: "User blocked the bot" };
  }

  if (
    lowerError.includes("chat not found") ||
    lowerError.includes("bad request: chat not found") ||
    lowerError.includes("400")
  ) {
    return { shouldDeactivate: true, reason: "Chat not found" };
  }

  if (
    lowerError.includes("kicked") ||
    lowerError.includes("bot was kicked")
  ) {
    return { shouldDeactivate: true, reason: "Bot was kicked from chat" };
  }

  return { shouldDeactivate: false };
}

/**
 * Send an alert to a single subscriber
 */
export async function sendAlertToSubscriber(
  alert: Alert,
  subscriber: TelegramSubscriber,
  botClient: TelegramBotClient,
  subscriberService: TelegramSubscriberService,
  dryRun = false
): Promise<SendResult> {
  const chatId = subscriber.chatId;

  // In dry run mode, simulate success
  if (dryRun) {
    return { chatId, success: true };
  }

  try {
    const message = formatAlertMessage(alert);
    const result = await botClient.sendMessage(chatId.toString(), message, {
      parseMode: "Markdown",
      disableWebPagePreview: true,
    });

    if (result.success) {
      // Increment alerts sent counter
      await subscriberService.incrementAlertsSent(chatId);
      return { chatId, success: true, messageId: result.messageId };
    } else {
      // Check if we should deactivate the user
      const deactivateCheck = shouldDeactivateOnError(result.error || "");
      if (deactivateCheck.shouldDeactivate) {
        await subscriberService.markBlocked(chatId);
        return {
          chatId,
          success: false,
          error: result.error,
          shouldDeactivate: true,
          deactivationReason: deactivateCheck.reason,
        };
      }
      return { chatId, success: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const deactivateCheck = shouldDeactivateOnError(errorMessage);

    if (deactivateCheck.shouldDeactivate) {
      try {
        await subscriberService.markBlocked(chatId);
      } catch {
        // Ignore errors when marking blocked
      }
      return {
        chatId,
        success: false,
        error: errorMessage,
        shouldDeactivate: true,
        deactivationReason: deactivateCheck.reason,
      };
    }

    return { chatId, success: false, error: errorMessage };
  }
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Broadcast an alert to all eligible subscribers
 *
 * @param alert - The alert to broadcast
 * @param options - Broadcast options
 * @returns Broadcast result with statistics
 */
export async function broadcastAlert(
  alert: Alert,
  options: BroadcastOptions = {}
): Promise<BroadcastResult> {
  const startTime = Date.now();
  const botClient = options.botClient ?? getTelegramBot();
  const subscriberService = options.subscriberService ?? telegramSubscriberService;
  const dryRun = options.dryRun ?? false;
  const sendDelay = options.sendDelay ?? 50; // 50ms default delay between sends

  // Get all active subscribers
  const activeSubscribers = await subscriberService.findActive();
  const totalSubscribers = activeSubscribers.length;

  // Filter subscribers by alert preferences
  const eligibleSubscribers = filterEligibleSubscribers(alert, activeSubscribers);
  const eligibleCount = eligibleSubscribers.length;

  // Send to each eligible subscriber
  const results: SendResult[] = [];
  let sent = 0;
  let failed = 0;
  let deactivated = 0;

  for (const subscriber of eligibleSubscribers) {
    const result = await sendAlertToSubscriber(
      alert,
      subscriber,
      botClient,
      subscriberService,
      dryRun
    );

    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.shouldDeactivate) {
        deactivated++;
      }
    }

    // Add delay between sends to avoid rate limiting
    if (sendDelay > 0 && eligibleSubscribers.indexOf(subscriber) < eligibleSubscribers.length - 1) {
      await sleep(sendDelay);
    }
  }

  const duration = Date.now() - startTime;

  return {
    alertId: alert.id,
    totalSubscribers,
    eligibleSubscribers: eligibleCount,
    sent,
    failed,
    deactivated,
    results,
    duration,
  };
}

/**
 * Broadcaster service class for managing alert broadcasts
 */
export class AlertBroadcaster {
  private botClient: TelegramBotClient;
  private subscriberService: TelegramSubscriberService;
  private prisma: PrismaClient;

  constructor(options: BroadcastOptions = {}) {
    this.botClient = options.botClient ?? getTelegramBot();
    this.subscriberService = options.subscriberService ?? telegramSubscriberService;
    this.prisma = options.prisma ?? defaultPrisma;
  }

  /**
   * Broadcast a single alert
   */
  async broadcast(
    alert: Alert,
    options?: Omit<BroadcastOptions, "botClient" | "subscriberService" | "prisma">
  ): Promise<BroadcastResult> {
    return broadcastAlert(alert, {
      ...options,
      botClient: this.botClient,
      subscriberService: this.subscriberService,
      prisma: this.prisma,
    });
  }

  /**
   * Broadcast an alert by ID
   */
  async broadcastById(
    alertId: string,
    options?: Omit<BroadcastOptions, "botClient" | "subscriberService" | "prisma">
  ): Promise<BroadcastResult | null> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return null;
    }

    return this.broadcast(alert, options);
  }

  /**
   * Get broadcast statistics
   */
  async getStats(): Promise<{
    totalSubscribers: number;
    activeSubscribers: number;
    blockedSubscribers: number;
  }> {
    const stats = await this.subscriberService.getStats();
    return {
      totalSubscribers: stats.total,
      activeSubscribers: stats.active,
      blockedSubscribers: stats.blocked,
    };
  }
}

/**
 * Create a new AlertBroadcaster instance
 */
export function createAlertBroadcaster(options: BroadcastOptions = {}): AlertBroadcaster {
  return new AlertBroadcaster(options);
}

/**
 * Default broadcaster instance
 */
export const alertBroadcaster = new AlertBroadcaster();
