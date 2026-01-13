/**
 * E2E tests for AI-NLP-001: Alert Summary Generator
 *
 * Tests the alert summary generator with realistic scenarios
 * and integration with other system components.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  AlertSummaryGenerator,
  AlertType,
  AlertSeverity,
  SummaryStyle,
  AlertData,
  createAlertSummaryGenerator,
  getSharedAlertSummaryGenerator,
  resetSharedAlertSummaryGenerator,
  generateAlertSummary,
  createMockAlert,
  createMockAlertBatch,
  truncateAddress,
  formatNumber,
  validateAlertData,
} from "../../src/ai/alert-summary-generator";

describe("E2E: Alert Summary Generator Integration", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    resetSharedAlertSummaryGenerator();
    generator = createAlertSummaryGenerator();
  });

  afterEach(() => {
    generator.clearCache();
    resetSharedAlertSummaryGenerator();
  });

  describe("Real-world whale trade alert scenarios", () => {
    it("should generate comprehensive summary for whale trade", () => {
      const alert: AlertData = {
        id: "whale_001",
        type: AlertType.WHALE_TRADE,
        severity: AlertSeverity.HIGH,
        title: "Large Trade Detected",
        message: "A wallet has placed a significant trade on a political market",
        timestamp: new Date(),
        walletAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        marketId: "0x123456",
        marketTitle: "Will the Federal Reserve cut interest rates in Q1 2024?",
        tradeSize: 250000,
        priceChange: 5.2,
        suspicionScore: 72,
        walletAge: 180,
        winRate: 68,
        totalVolume: 1500000,
      };

      const summary = generator.generateSummary(alert);

      // Verify all components are present
      expect(summary.summary).toBeTruthy();
      // Standard summary uses "large trade activity" for whale trades
      expect(summary.summary.toLowerCase()).toContain("large trade");
      expect(summary.keyInsights.length).toBeGreaterThan(0);
      expect(summary.suggestedActions.length).toBeGreaterThan(0);
      expect(summary.riskAssessment).toContain("Risk Level:");
      expect(summary.confidence).toBeGreaterThan(80);
    });

    it("should generate summary for whale trade by fresh wallet", () => {
      const alert: AlertData = {
        id: "whale_fresh_001",
        type: AlertType.WHALE_TRADE,
        severity: AlertSeverity.CRITICAL,
        title: "Fresh Wallet Whale Trade",
        timestamp: new Date(),
        walletAddress: "0xNewWallet123456789012345678901234567890",
        marketTitle: "Bitcoin ETF approval by SEC?",
        tradeSize: 500000,
        priceChange: 8.5,
        suspicionScore: 88,
        walletAge: 2,
        winRate: 100,
      };

      const summary = generator.generateSummary(alert);

      // Should identify both whale and fresh wallet concerns
      const hasWhaleInsight = summary.keyInsights.some(
        (i) => i.toLowerCase().includes("whale")
      );
      const hasFreshInsight = summary.keyInsights.some(
        (i) => i.toLowerCase().includes("fresh") || i.toLowerCase().includes("new")
      );

      expect(hasWhaleInsight).toBe(true);
      expect(hasFreshInsight).toBe(true);
      expect(summary.riskAssessment).toContain("CRITICAL");
    });
  });

  describe("Insider activity detection scenarios", () => {
    it("should generate summary for potential insider trading", () => {
      const alert: AlertData = {
        id: "insider_001",
        type: AlertType.INSIDER_ACTIVITY,
        severity: AlertSeverity.CRITICAL,
        title: "Potential Insider Trading Detected",
        timestamp: new Date(),
        walletAddress: "0xInsiderSuspect1234567890123456789012345",
        marketTitle: "Will Company X announce acquisition by Friday?",
        tradeSize: 75000,
        priceChange: 12.5,
        suspicionScore: 95,
        walletAge: 365,
        winRate: 92,
        preEventHours: 4,
      };

      const summary = generator.generateSummary(alert);

      // Should highlight insider trading concerns
      expect(summary.keyInsights.some((i) => i.toLowerCase().includes("insider"))).toBe(true);
      expect(summary.keyInsights.some((i) => i.toLowerCase().includes("before"))).toBe(true);
      expect(summary.suggestedActions.some((a) =>
        a.toLowerCase().includes("regulatory") || a.toLowerCase().includes("document")
      )).toBe(true);
    });

    it("should generate summary for pre-event trading pattern", () => {
      const alert: AlertData = {
        id: "prevent_001",
        type: AlertType.UNUSUAL_PATTERN,
        severity: AlertSeverity.HIGH,
        title: "Unusual Pre-Event Trading",
        timestamp: new Date(),
        walletAddress: "0xPreEventTrader12345678901234567890123456",
        marketTitle: "Election outcome prediction",
        tradeSize: 45000,
        preEventHours: 2.5,
        suspicionScore: 78,
      };

      const summary = generator.generateSummary(alert);

      // Should identify timing concern
      expect(summary.keyInsights.some((i) =>
        i.toLowerCase().includes("hours") || i.toLowerCase().includes("before")
      )).toBe(true);
    });
  });

  describe("Coordinated trading detection scenarios", () => {
    it("should generate summary for coordinated wallet activity", () => {
      const alert: AlertData = {
        id: "coord_001",
        type: AlertType.COORDINATED_ACTIVITY,
        severity: AlertSeverity.HIGH,
        title: "Coordinated Trading Pattern Detected",
        timestamp: new Date(),
        walletAddress: "0xCoordinator1234567890123456789012345678",
        marketTitle: "Will new crypto regulations pass?",
        tradeSize: 25000,
        coordinatedWallets: 8,
        suspicionScore: 82,
      };

      const summary = generator.generateSummary(alert);

      // Should identify coordination
      expect(summary.keyInsights.some((i) =>
        i.includes("8 wallets") || i.toLowerCase().includes("coord")
      )).toBe(true);
      expect(summary.suggestedActions.some((a) =>
        a.toLowerCase().includes("network") || a.toLowerCase().includes("map")
      )).toBe(true);
    });

    it("should generate summary for suspected sybil attack", () => {
      const alerts: AlertData[] = Array.from({ length: 5 }, (_, i) => ({
        id: `sybil_${i}`,
        type: AlertType.COORDINATED_ACTIVITY,
        severity: AlertSeverity.CRITICAL,
        title: `Sybil Cluster Wallet ${i + 1}`,
        timestamp: new Date(Date.now() - i * 1000),
        walletAddress: `0xSybilWallet${i}00000000000000000000000000`,
        marketTitle: "Controversial prediction market",
        tradeSize: 10000 + i * 1000,
        coordinatedWallets: 25,
        suspicionScore: 90 + i,
        walletAge: 1 + i,
      }));

      const result = generator.generateBatchSummaries(alerts);

      expect(result.summaries).toHaveLength(5);
      expect(result.failed).toBe(0);

      // All should identify high coordination
      result.summaries.forEach((summary) => {
        expect(summary.keyInsights.some((i) =>
          i.toLowerCase().includes("25 wallets") || i.toLowerCase().includes("coord")
        )).toBe(true);
      });
    });
  });

  describe("Fresh wallet activity scenarios", () => {
    it("should generate summary for brand new wallet making large trade", () => {
      const alert: AlertData = {
        id: "fresh_001",
        type: AlertType.FRESH_WALLET,
        severity: AlertSeverity.HIGH,
        title: "Fresh Wallet Large Trade",
        timestamp: new Date(),
        walletAddress: "0xBrandNewWallet123456789012345678901234",
        marketTitle: "Tech earnings prediction",
        tradeSize: 50000,
        walletAge: 0,
        totalVolume: 50000,
        suspicionScore: 75,
      };

      const summary = generator.generateSummary(alert);

      expect(summary.keyInsights.some((i) =>
        i.toLowerCase().includes("fresh") || i.toLowerCase().includes("0 days")
      )).toBe(true);
      expect(summary.suggestedActions.some((a) =>
        a.toLowerCase().includes("monitor") || a.toLowerCase().includes("7 days")
      )).toBe(true);
    });

    it("should generate summary for wallet reactivation", () => {
      const alert: AlertData = {
        id: "reactivate_001",
        type: AlertType.WALLET_REACTIVATION,
        severity: AlertSeverity.MEDIUM,
        title: "Dormant Wallet Reactivated",
        timestamp: new Date(),
        walletAddress: "0xDormantWallet123456789012345678901234567",
        marketTitle: "Sports championship outcome",
        tradeSize: 15000,
        walletAge: 500,
        suspicionScore: 55,
      };

      const summary = generator.generateSummary(alert);

      expect(summary.keyInsights.some((i) =>
        i.toLowerCase().includes("dormant") || i.toLowerCase().includes("reactivat")
      )).toBe(true);
    });
  });

  describe("Summary style variations", () => {
    const baseAlert = createMockAlert({
      type: AlertType.WHALE_TRADE,
      tradeSize: 100000,
      suspicionScore: 75,
    });

    it("should generate all style variations consistently", () => {
      const styles = Object.values(SummaryStyle);
      const summaries = styles.map((style) =>
        generator.generateSummary(baseAlert, { style })
      );

      // Each style should produce different output
      const uniqueSummaries = new Set(summaries.map((s) => s.summary));
      expect(uniqueSummaries.size).toBe(styles.length);

      // All should have same confidence (based on same data)
      const confidences = summaries.map((s) => s.confidence);
      expect(new Set(confidences).size).toBe(1);
    });

    it("brief style should be shortest", () => {
      const brief = generator.generateSummary(baseAlert, { style: SummaryStyle.BRIEF });
      const standard = generator.generateSummary(baseAlert, { style: SummaryStyle.STANDARD });
      const detailed = generator.generateSummary(baseAlert, { style: SummaryStyle.DETAILED });

      expect(brief.summary.length).toBeLessThan(standard.summary.length);
      expect(standard.summary.length).toBeLessThan(detailed.summary.length);
    });

    it("technical style should include raw data", () => {
      const technical = generator.generateSummary(baseAlert, { style: SummaryStyle.TECHNICAL });

      expect(technical.summary).toContain(baseAlert.id);
      expect(technical.summary).toContain(baseAlert.type.toUpperCase());
      expect(technical.summary).toContain("SEV:");
    });
  });

  describe("Batch processing scenarios", () => {
    it("should process large batch of mixed alerts efficiently", () => {
      const alerts = createMockAlertBatch(100);
      const startTime = Date.now();

      const result = generator.generateBatchSummaries(alerts);

      const duration = Date.now() - startTime;

      expect(result.summaries).toHaveLength(100);
      expect(result.failed).toBe(0);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it("should handle alerts with missing optional fields", () => {
      const minimalAlerts: AlertData[] = Array.from({ length: 20 }, (_, i) => ({
        id: `minimal_${i}`,
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: `System notification ${i}`,
        timestamp: new Date(),
      }));

      const result = generator.generateBatchSummaries(minimalAlerts);

      expect(result.summaries).toHaveLength(20);
      expect(result.failed).toBe(0);
      result.summaries.forEach((summary) => {
        expect(summary.summary).toBeTruthy();
      });
    });

    it("should produce consistent summaries for identical alerts", () => {
      const alert = createMockAlert();
      const duplicates = Array(5).fill(null).map((_, i) => ({
        ...alert,
        id: `dup_${i}`,
      }));

      const result = generator.generateBatchSummaries(duplicates);

      // Summaries should be identical except for ID differences
      const firstSummary = result.summaries[0]?.summary;
      expect(firstSummary).toBeDefined();
      if (firstSummary) {
        result.summaries.forEach((summary) => {
          // Remove ID from comparison
          const normalized = summary.summary.replace(/dup_\d+/g, "");
          expect(normalized).toBe(firstSummary.replace(/dup_\d+/g, ""));
        });
      }
    });
  });

  describe("Caching and performance", () => {
    it("should leverage cache for repeated requests", () => {
      const alert = createMockAlert();

      // First request - cache miss
      generator.generateSummary(alert);

      // Second request - cache hit
      generator.generateSummary(alert);

      // Cache hit should generally be faster (though might not always be measurable)
      const cacheStats = generator.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });

    it("should respect cache TTL", async () => {
      const gen = createAlertSummaryGenerator({ cacheTTL: 100 });
      const alert = createMockAlert();

      gen.generateSummary(alert);
      expect(gen.getCacheStats().size).toBe(1);

      await new Promise((resolve) => setTimeout(resolve, 150));

      // After TTL, cache entry should be expired (but still in map until regenerated)
      gen.generateSummary(alert);
      const stats = gen.getStats();
      expect(stats.cacheMisses).toBe(2); // Both requests should be misses
    });

    it("should clear cache on demand", () => {
      const alerts = createMockAlertBatch(10);
      alerts.forEach((alert) => generator.generateSummary(alert));

      expect(generator.getCacheStats().size).toBe(10);

      generator.clearCache();
      expect(generator.getCacheStats().size).toBe(0);
    });
  });

  describe("Event emission integration", () => {
    it("should emit all expected events during processing", async () => {
      const events: string[] = [];

      generator.on("cache_miss", () => events.push("cache_miss"));
      generator.on("summary_generated", () => events.push("summary_generated"));

      const alert = createMockAlert();
      generator.generateSummary(alert);

      expect(events).toContain("cache_miss");
      expect(events).toContain("summary_generated");
    });

    it("should emit batch events", () => {
      const batchEvents: string[] = [];

      generator.on("batch_started", () => batchEvents.push("batch_started"));
      generator.on("batch_completed", () => batchEvents.push("batch_completed"));

      const alerts = createMockAlertBatch(5);
      generator.generateBatchSummaries(alerts);

      expect(batchEvents).toContain("batch_started");
      expect(batchEvents).toContain("batch_completed");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle alerts with extreme values", () => {
      const alert = createMockAlert({
        tradeSize: 999999999,
        priceChange: -99.99,
        suspicionScore: 100,
        coordinatedWallets: 100,
        walletAge: 0,
        winRate: 100,
      });

      const summary = generator.generateSummary(alert);
      expect(summary.summary).toBeTruthy();
      expect(summary.confidence).toBeLessThanOrEqual(100);
    });

    it("should handle alerts with special characters in text", () => {
      const alert = createMockAlert({
        title: 'Alert with "quotes" & <brackets> and émojis 🚨',
        marketTitle: "Market: Will BTC reach $100k? (Yes/No)",
      });

      const summary = generator.generateSummary(alert);
      expect(summary.summary).toBeTruthy();
    });

    it("should handle timestamp as string", () => {
      const alert = {
        ...createMockAlert(),
        timestamp: "2024-01-15T12:00:00Z" as unknown as Date,
      };

      const summary = generator.generateSummary(alert);
      expect(summary.summary).toBeTruthy();
    });

    it("should handle empty wallet address", () => {
      const alert = createMockAlert({
        walletAddress: "",
      });

      const summary = generator.generateSummary(alert);
      expect(summary.summary).toBeTruthy();
    });

    it("should handle undefined optional fields", () => {
      const alert: AlertData = {
        id: "minimal_alert",
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: "Minimal Alert",
        timestamp: new Date(),
      };

      const summary = generator.generateSummary(alert);
      expect(summary.summary).toBeTruthy();
      expect(summary.keyInsights).toBeDefined();
      expect(summary.suggestedActions).toBeDefined();
    });
  });

  describe("Statistics tracking", () => {
    it("should track accurate statistics over multiple operations", () => {
      const alerts = createMockAlertBatch(10);

      // Generate summaries
      alerts.forEach((alert) => generator.generateSummary(alert));

      // Generate again (should hit cache)
      alerts.forEach((alert) => generator.generateSummary(alert));

      const stats = generator.getStats();

      expect(stats.totalGenerated).toBeGreaterThanOrEqual(10);
      expect(stats.cacheHits).toBeGreaterThanOrEqual(10);
      expect(stats.cacheMisses).toBeGreaterThanOrEqual(10);
      expect(stats.avgGenerationTime).toBeGreaterThanOrEqual(0);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(10);
    });

    it("should reset statistics correctly", () => {
      generator.generateSummary(createMockAlert());
      generator.resetStats();

      const stats = generator.getStats();
      expect(stats.totalGenerated).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe("Shared instance management", () => {
    it("should maintain singleton behavior", () => {
      const instance1 = getSharedAlertSummaryGenerator();
      const instance2 = getSharedAlertSummaryGenerator();

      expect(instance1).toBe(instance2);
    });

    it("should allow custom shared instance", () => {
      // Create custom generator with specific config
      const customGenerator = createAlertSummaryGenerator({
        defaultStyle: SummaryStyle.BRIEF,
      });

      // Verify custom generator works
      const alert = createMockAlert();
      const customSummary = customGenerator.generateSummary(alert);
      expect(customSummary.style).toBe(SummaryStyle.BRIEF);

      // Verify shared instance also works
      const sharedSummary = generateAlertSummary(alert);
      expect(sharedSummary).toBeTruthy();
    });
  });

  describe("Integration with real data patterns", () => {
    it("should generate summaries matching notification template data", () => {
      // Simulate alert data that would come from the notification system
      const alertFromSystem: AlertData = {
        id: "notif_alert_001",
        type: AlertType.WHALE_TRADE,
        severity: AlertSeverity.HIGH,
        title: "Whale Trade Detected",
        message: "Large trade on prediction market",
        timestamp: new Date(),
        walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78",
        marketId: "mkt_12345",
        marketTitle: "Will ETF be approved?",
        tradeSize: 75000,
        priceChange: 3.5,
        suspicionScore: 65,
        metadata: {
          source: "clob_api",
          chain: "polygon",
        },
      };

      const summary = generator.generateSummary(alertFromSystem);

      // Should produce usable content
      expect(summary.summary.length).toBeGreaterThan(50);
      expect(summary.confidence).toBeGreaterThan(70);
    });

    it("should generate summaries suitable for email templates", () => {
      const alert = createMockAlert({
        type: AlertType.INSIDER_ACTIVITY,
        severity: AlertSeverity.CRITICAL,
      });

      const briefSummary = generator.generateSummary(alert, {
        style: SummaryStyle.BRIEF,
        maxLength: 150,
      });

      const detailedSummary = generator.generateSummary(alert, {
        style: SummaryStyle.DETAILED,
      });

      // Brief for subject line / preview
      expect(briefSummary.summary.length).toBeLessThanOrEqual(150);

      // Detailed for email body
      expect(detailedSummary.summary.length).toBeGreaterThan(200);
      expect(detailedSummary.keyInsights.length).toBeGreaterThan(0);
    });

    it("should generate summaries suitable for Telegram messages", () => {
      const alert = createMockAlert({
        type: AlertType.WHALE_TRADE,
        severity: AlertSeverity.HIGH,
      });

      const casualSummary = generator.generateSummary(alert, {
        style: SummaryStyle.CASUAL,
        maxLength: 500, // Telegram has message limits
      });

      // Should be concise but informative
      expect(casualSummary.summary.length).toBeLessThanOrEqual(500);
      // Should contain emoji for visual appeal
      expect(casualSummary.summary).toMatch(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u);
    });
  });

  describe("Utility function integration", () => {
    it("should correctly truncate addresses", () => {
      const fullAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78";
      const truncated = truncateAddress(fullAddress);

      expect(truncated).toContain("...");
      expect(truncated.length).toBeLessThan(fullAddress.length);
      expect(truncated).toMatch(/^0x[a-fA-F0-9]+\.\.\.[a-fA-F0-9]+$/);
    });

    it("should correctly format large numbers", () => {
      expect(formatNumber(1500000)).toBe("1.50M");
      expect(formatNumber(250000)).toBe("250.0K");
      expect(formatNumber(999)).toBe("999.00");
    });

    it("should validate alert data correctly", () => {
      const validAlert = createMockAlert();
      const invalidAlert = { foo: "bar" };

      expect(validateAlertData(validAlert)).toBe(true);
      expect(validateAlertData(invalidAlert)).toBe(false);
      expect(validateAlertData(null)).toBe(false);
      expect(validateAlertData(undefined)).toBe(false);
    });
  });
});

describe("E2E: Summary Quality Assurance", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    resetSharedAlertSummaryGenerator();
    generator = createAlertSummaryGenerator();
  });

  afterEach(() => {
    resetSharedAlertSummaryGenerator();
  });

  describe("Summary readability", () => {
    it("should produce grammatically correct standard summaries", () => {
      const alert = createMockAlert();
      const summary = generator.generateSummary(alert);

      // Should start with capital letter
      expect(summary.summary.charAt(0)).toBe(summary.summary.charAt(0).toUpperCase());

      // Should end with period
      expect(summary.summary.trim().slice(-1)).toBe(".");
    });

    it("should not contain placeholder text", () => {
      const alert = createMockAlert();
      const summary = generator.generateSummary(alert);

      expect(summary.summary).not.toContain("[");
      expect(summary.summary).not.toContain("]");
      expect(summary.summary).not.toContain("undefined");
      expect(summary.summary).not.toContain("null");
      expect(summary.summary).not.toContain("NaN");
    });

    it("should not have excessive whitespace", () => {
      const alert = createMockAlert();
      const summary = generator.generateSummary(alert);

      expect(summary.summary).not.toMatch(/  +/); // No double spaces
      expect(summary.summary.trim()).toBe(summary.summary); // No leading/trailing whitespace
    });
  });

  describe("Key insight quality", () => {
    it("should produce actionable insights", () => {
      const alert = createMockAlert({
        suspicionScore: 85,
        walletAge: 2,
        tradeSize: 150000,
      });

      const summary = generator.generateSummary(alert);

      // Insights should be specific, not generic
      summary.keyInsights.forEach((insight) => {
        expect(insight.length).toBeGreaterThan(20);
        expect(insight).not.toBe("No insights available");
      });
    });

    it("should not duplicate insights", () => {
      const alert = createMockAlert({
        suspicionScore: 90,
        walletAge: 1,
        tradeSize: 200000,
        coordinatedWallets: 5,
      });

      const summary = generator.generateSummary(alert);
      const uniqueInsights = new Set(summary.keyInsights);

      expect(uniqueInsights.size).toBe(summary.keyInsights.length);
    });
  });

  describe("Suggested action quality", () => {
    it("should provide relevant actions for alert type", () => {
      const insiderAlert = createMockAlert({
        type: AlertType.INSIDER_ACTIVITY,
        severity: AlertSeverity.CRITICAL,
      });

      const summary = generator.generateSummary(insiderAlert);

      // Should suggest regulatory/documentation actions
      const hasRelevantAction = summary.suggestedActions.some(
        (a) =>
          a.toLowerCase().includes("regulatory") ||
          a.toLowerCase().includes("document") ||
          a.toLowerCase().includes("compliance")
      );
      expect(hasRelevantAction).toBe(true);
    });

    it("should prioritize actions by severity", () => {
      const criticalAlert = createMockAlert({
        severity: AlertSeverity.CRITICAL,
      });

      const criticalSummary = generator.generateSummary(criticalAlert);

      // Critical should have more urgent actions
      const hasUrgentAction = criticalSummary.suggestedActions.some(
        (a) =>
          a.toLowerCase().includes("immediate") ||
          a.toLowerCase().includes("escalat") ||
          a.toLowerCase().includes("review")
      );
      expect(hasUrgentAction).toBe(true);
    });
  });

  describe("Risk assessment quality", () => {
    it("should provide consistent risk levels", () => {
      // Same alert data should always produce same risk level
      const alert = createMockAlert({
        severity: AlertSeverity.HIGH,
        suspicionScore: 80,
      });

      const summary1 = generator.generateSummary(alert);

      // Clear cache to force recalculation
      generator.clearCache();

      const summary2 = generator.generateSummary(alert);

      expect(summary1.riskAssessment).toBe(summary2.riskAssessment);
    });

    it("should include score breakdown", () => {
      const alert = createMockAlert({
        severity: AlertSeverity.CRITICAL,
        suspicionScore: 90,
        walletAge: 1,
      });

      const summary = generator.generateSummary(alert);

      // Should include numeric score
      expect(summary.riskAssessment).toMatch(/\d+\/100/);
    });
  });
});
