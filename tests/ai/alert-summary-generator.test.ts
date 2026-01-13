/**
 * Unit tests for AI-NLP-001: Alert Summary Generator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AlertSummaryGenerator,
  AlertType,
  AlertSeverity,
  SummaryStyle,
  SummaryLanguage,
  AlertData,
  DEFAULT_SUMMARY_CONFIG,
  ALERT_TYPE_DESCRIPTIONS,
  SEVERITY_DESCRIPTORS,
  RISK_THRESHOLDS,
  createAlertSummaryGenerator,
  getSharedAlertSummaryGenerator,
  setSharedAlertSummaryGenerator,
  resetSharedAlertSummaryGenerator,
  generateAlertSummary,
  getBriefSummary,
  getStandardSummary,
  getDetailedSummary,
  getTechnicalSummary,
  getCasualSummary,
  truncateAddress,
  truncateText,
  formatNumber,
  capitalize,
  formatTimestamp,
  getSeverityEmoji,
  getTypeVerb,
  calculateConfidence,
  validateAlertData,
  parseAlertType,
  parseAlertSeverity,
  createMockAlert,
  createMockAlertBatch,
} from "../../src/ai/alert-summary-generator";

describe("AlertSummaryGenerator", () => {
  let generator: AlertSummaryGenerator;
  let mockAlert: AlertData;

  beforeEach(() => {
    resetSharedAlertSummaryGenerator();
    generator = createAlertSummaryGenerator();
    mockAlert = createMockAlert();
  });

  afterEach(() => {
    generator.clearCache();
    resetSharedAlertSummaryGenerator();
  });

  describe("constructor and configuration", () => {
    it("should create instance with default config", () => {
      const gen = new AlertSummaryGenerator();
      const config = gen.getConfig();
      expect(config.defaultStyle).toBe(SummaryStyle.STANDARD);
      expect(config.defaultLanguage).toBe(SummaryLanguage.EN);
      expect(config.enableCache).toBe(true);
    });

    it("should create instance with custom config", () => {
      const gen = new AlertSummaryGenerator({
        defaultStyle: SummaryStyle.BRIEF,
        enableCache: false,
      });
      const config = gen.getConfig();
      expect(config.defaultStyle).toBe(SummaryStyle.BRIEF);
      expect(config.enableCache).toBe(false);
    });

    it("should update configuration", () => {
      generator.updateConfig({ defaultStyle: SummaryStyle.DETAILED });
      expect(generator.getConfig().defaultStyle).toBe(SummaryStyle.DETAILED);
    });
  });

  describe("generateSummary", () => {
    it("should generate standard summary", () => {
      const result = generator.generateSummary(mockAlert);
      expect(result).toBeDefined();
      expect(result.summary).toBeTruthy();
      expect(typeof result.summary).toBe("string");
      expect(result.style).toBe(SummaryStyle.STANDARD);
      expect(result.language).toBe(SummaryLanguage.EN);
    });

    it("should generate brief summary", () => {
      const result = generator.generateSummary(mockAlert, {
        style: SummaryStyle.BRIEF,
      });
      expect(result.style).toBe(SummaryStyle.BRIEF);
      expect(result.summary.length).toBeLessThan(200);
    });

    it("should generate detailed summary", () => {
      const result = generator.generateSummary(mockAlert, {
        style: SummaryStyle.DETAILED,
      });
      expect(result.style).toBe(SummaryStyle.DETAILED);
      expect(result.summary).toContain("ALERT SUMMARY");
      expect(result.summary).toContain("Overview:");
    });

    it("should generate technical summary", () => {
      const result = generator.generateSummary(mockAlert, {
        style: SummaryStyle.TECHNICAL,
      });
      expect(result.style).toBe(SummaryStyle.TECHNICAL);
      expect(result.summary).toContain(mockAlert.id);
      expect(result.summary).toContain(mockAlert.type.toUpperCase());
    });

    it("should generate casual summary", () => {
      const result = generator.generateSummary(mockAlert, {
        style: SummaryStyle.CASUAL,
      });
      expect(result.style).toBe(SummaryStyle.CASUAL);
      // Should contain an emoji (including warning signs, info, etc.)
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2139}]/u;
      expect(emojiRegex.test(result.summary)).toBe(true);
    });

    it("should include key insights", () => {
      const result = generator.generateSummary(mockAlert);
      expect(Array.isArray(result.keyInsights)).toBe(true);
    });

    it("should include suggested actions", () => {
      const result = generator.generateSummary(mockAlert);
      expect(Array.isArray(result.suggestedActions)).toBe(true);
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it("should include risk assessment", () => {
      const result = generator.generateSummary(mockAlert);
      expect(typeof result.riskAssessment).toBe("string");
      expect(result.riskAssessment).toContain("Risk Level:");
    });

    it("should calculate confidence score", () => {
      const result = generator.generateSummary(mockAlert);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it("should record generation time", () => {
      const result = generator.generateSummary(mockAlert);
      expect(result.generationTime).toBeGreaterThanOrEqual(0);
    });

    it("should respect maxLength option", () => {
      const maxLength = 100;
      const result = generator.generateSummary(mockAlert, { maxLength });
      expect(result.summary.length).toBeLessThanOrEqual(maxLength);
    });

    it("should exclude key insights when disabled", () => {
      const result = generator.generateSummary(mockAlert, {
        includeKeyInsights: false,
      });
      expect(result.keyInsights).toHaveLength(0);
    });

    it("should exclude suggested actions when disabled", () => {
      const result = generator.generateSummary(mockAlert, {
        includeSuggestedActions: false,
      });
      expect(result.suggestedActions).toHaveLength(0);
    });

    it("should exclude risk assessment when disabled", () => {
      const result = generator.generateSummary(mockAlert, {
        includeRiskAssessment: false,
      });
      expect(result.riskAssessment).toBe("");
    });

    it("should emit summary_generated event", () => {
      const handler = vi.fn();
      generator.on("summary_generated", handler);
      generator.generateSummary(mockAlert);
      expect(handler).toHaveBeenCalledWith(mockAlert.id, expect.any(Object));
    });
  });

  describe("caching", () => {
    it("should cache summaries when enabled", () => {
      const result1 = generator.generateSummary(mockAlert);
      const result2 = generator.generateSummary(mockAlert);
      expect(result1.summary).toBe(result2.summary);

      const cacheStats = generator.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0);
    });

    it("should not cache when disabled", () => {
      const gen = createAlertSummaryGenerator({ enableCache: false });
      gen.generateSummary(mockAlert);
      gen.generateSummary(mockAlert);
      expect(gen.getCacheStats().size).toBe(0);
    });

    it("should clear cache", () => {
      generator.generateSummary(mockAlert);
      expect(generator.getCacheStats().size).toBeGreaterThan(0);
      generator.clearCache();
      expect(generator.getCacheStats().size).toBe(0);
    });

    it("should emit cache_hit event", () => {
      const handler = vi.fn();
      generator.on("cache_hit", handler);
      generator.generateSummary(mockAlert);
      generator.generateSummary(mockAlert);
      expect(handler).toHaveBeenCalledWith(mockAlert.id);
    });

    it("should emit cache_miss event", () => {
      const handler = vi.fn();
      generator.on("cache_miss", handler);
      generator.generateSummary(mockAlert);
      expect(handler).toHaveBeenCalledWith(mockAlert.id);
    });

    it("should expire cached items", async () => {
      const gen = createAlertSummaryGenerator({ cacheTTL: 50 });
      gen.generateSummary(mockAlert);
      await new Promise((resolve) => setTimeout(resolve, 100));
      // After TTL, cache miss should occur
      const handler = vi.fn();
      gen.on("cache_miss", handler);
      gen.generateSummary(mockAlert);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("generateBatchSummaries", () => {
    it("should generate summaries for multiple alerts", () => {
      const alerts = createMockAlertBatch(5);
      const result = generator.generateBatchSummaries(alerts);
      expect(result.summaries).toHaveLength(5);
      expect(result.totalProcessed).toBe(5);
      expect(result.failed).toBe(0);
    });

    it("should emit batch events", () => {
      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      generator.on("batch_started", startHandler);
      generator.on("batch_completed", completeHandler);

      const alerts = createMockAlertBatch(3);
      generator.generateBatchSummaries(alerts);

      expect(startHandler).toHaveBeenCalledWith(3);
      expect(completeHandler).toHaveBeenCalledWith(expect.objectContaining({
        totalProcessed: 3,
      }));
    });

    it("should calculate average generation time", () => {
      const alerts = createMockAlertBatch(5);
      const result = generator.generateBatchSummaries(alerts);
      expect(result.avgGenerationTime).toBeGreaterThanOrEqual(0);
    });

    it("should calculate total batch time", () => {
      const alerts = createMockAlertBatch(5);
      const result = generator.generateBatchSummaries(alerts);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("statistics", () => {
    it("should track total generated count", () => {
      generator.generateSummary(mockAlert);
      generator.generateSummary(createMockAlert());
      const stats = generator.getStats();
      expect(stats.totalGenerated).toBeGreaterThanOrEqual(2);
    });

    it("should track cache hits and misses", () => {
      generator.generateSummary(mockAlert);
      generator.generateSummary(mockAlert);
      const stats = generator.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it("should calculate average generation time", () => {
      generator.generateSummary(mockAlert);
      generator.generateSummary(createMockAlert());
      const stats = generator.getStats();
      expect(stats.avgGenerationTime).toBeGreaterThanOrEqual(0);
    });

    it("should reset statistics", () => {
      generator.generateSummary(mockAlert);
      generator.resetStats();
      const stats = generator.getStats();
      expect(stats.totalGenerated).toBe(0);
      expect(stats.cacheHits).toBe(0);
    });
  });
});

describe("Summary generation for different alert types", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    resetSharedAlertSummaryGenerator();
    generator = createAlertSummaryGenerator();
  });

  afterEach(() => {
    resetSharedAlertSummaryGenerator();
  });

  Object.values(AlertType).forEach((type) => {
    it(`should generate summary for ${type}`, () => {
      const alert = createMockAlert({ type });
      const result = generator.generateSummary(alert);
      expect(result.summary).toBeTruthy();
      expect(result.keyInsights.length).toBeGreaterThanOrEqual(0);
    });
  });

  Object.values(AlertSeverity).forEach((severity) => {
    it(`should generate summary for ${severity} severity`, () => {
      const alert = createMockAlert({ severity });
      const result = generator.generateSummary(alert);
      expect(result.summary).toBeTruthy();
      expect(result.riskAssessment).toContain("Risk Level:");
    });
  });
});

describe("Key insights generation", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    generator = createAlertSummaryGenerator();
  });

  it("should identify fresh wallets", () => {
    const alert = createMockAlert({ walletAge: 2 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some((i) =>
      i.toLowerCase().includes("fresh wallet")
    );
    expect(hasInsight).toBe(true);
  });

  it("should identify high win rate", () => {
    const alert = createMockAlert({ winRate: 85 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some((i) =>
      i.toLowerCase().includes("win rate")
    );
    expect(hasInsight).toBe(true);
  });

  it("should identify whale trades", () => {
    const alert = createMockAlert({ tradeSize: 150000 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some((i) =>
      i.toLowerCase().includes("whale")
    );
    expect(hasInsight).toBe(true);
  });

  it("should identify price impact", () => {
    const alert = createMockAlert({ priceChange: 8 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some(
      (i) =>
        i.toLowerCase().includes("price") ||
        i.toLowerCase().includes("increase")
    );
    expect(hasInsight).toBe(true);
  });

  it("should identify coordination", () => {
    const alert = createMockAlert({ coordinatedWallets: 5 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some((i) =>
      i.toLowerCase().includes("coord")
    );
    expect(hasInsight).toBe(true);
  });

  it("should identify pre-event timing", () => {
    const alert = createMockAlert({ preEventHours: 6 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some((i) =>
      i.toLowerCase().includes("before")
    );
    expect(hasInsight).toBe(true);
  });

  it("should identify high suspicion score", () => {
    const alert = createMockAlert({ suspicionScore: 90 });
    const result = generator.generateSummary(alert);
    const hasInsight = result.keyInsights.some((i) =>
      i.toLowerCase().includes("suspicion")
    );
    expect(hasInsight).toBe(true);
  });
});

describe("Suggested actions generation", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    generator = createAlertSummaryGenerator();
  });

  it("should suggest escalation for critical alerts", () => {
    const alert = createMockAlert({ severity: AlertSeverity.CRITICAL });
    const result = generator.generateSummary(alert);
    const hasAction = result.suggestedActions.some((a) =>
      a.toLowerCase().includes("escalation") || a.toLowerCase().includes("immediate")
    );
    expect(hasAction).toBe(true);
  });

  it("should suggest watchlist for high severity", () => {
    const alert = createMockAlert({ severity: AlertSeverity.HIGH });
    const result = generator.generateSummary(alert);
    const hasAction = result.suggestedActions.some((a) =>
      a.toLowerCase().includes("watchlist") || a.toLowerCase().includes("monitor")
    );
    expect(hasAction).toBe(true);
  });

  it("should suggest investigation for wallet alerts", () => {
    const alert = createMockAlert({
      walletAddress: "0x123",
      type: AlertType.FRESH_WALLET,
    });
    const result = generator.generateSummary(alert);
    const hasAction = result.suggestedActions.some((a) =>
      a.toLowerCase().includes("investigate") || a.toLowerCase().includes("funding")
    );
    expect(hasAction).toBe(true);
  });

  it("should suggest network mapping for coordination", () => {
    const alert = createMockAlert({ coordinatedWallets: 4 });
    const result = generator.generateSummary(alert);
    const hasAction = result.suggestedActions.some((a) =>
      a.toLowerCase().includes("network") || a.toLowerCase().includes("map")
    );
    expect(hasAction).toBe(true);
  });

  it("should have at least one suggested action", () => {
    const alert = createMockAlert({
      severity: AlertSeverity.INFO,
      type: AlertType.SYSTEM,
    });
    const result = generator.generateSummary(alert);
    expect(result.suggestedActions.length).toBeGreaterThan(0);
  });
});

describe("Risk assessment generation", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    generator = createAlertSummaryGenerator();
  });

  it("should assess critical risk for critical severity", () => {
    const alert = createMockAlert({
      severity: AlertSeverity.CRITICAL,
      suspicionScore: 95,
      type: AlertType.INSIDER_ACTIVITY,
      walletAge: 1, // Fresh wallet adds risk
      tradeSize: 150000, // Whale trade adds risk
    });
    const result = generator.generateSummary(alert);
    expect(result.riskAssessment).toContain("CRITICAL");
  });

  it("should assess high risk appropriately", () => {
    const alert = createMockAlert({
      severity: AlertSeverity.HIGH,
      suspicionScore: 85,
      tradeSize: 120000, // Whale trade adds risk
      walletAge: 3, // Fresh wallet adds risk
    });
    const result = generator.generateSummary(alert);
    expect(
      result.riskAssessment.includes("HIGH") ||
        result.riskAssessment.includes("CRITICAL")
    ).toBe(true);
  });

  it("should include contributing factors", () => {
    const alert = createMockAlert({
      severity: AlertSeverity.CRITICAL,
      walletAge: 2,
      tradeSize: 150000,
    });
    const result = generator.generateSummary(alert);
    expect(result.riskAssessment).toContain("Contributing factors:");
  });

  it("should normalize risk score to 100", () => {
    // Even with many risk factors, score shouldn't exceed 100
    const alert = createMockAlert({
      severity: AlertSeverity.CRITICAL,
      suspicionScore: 100,
      walletAge: 1,
      tradeSize: 500000,
      coordinatedWallets: 10,
      type: AlertType.INSIDER_ACTIVITY,
    });
    const result = generator.generateSummary(alert);
    const scoreMatch = result.riskAssessment.match(/\((\d+)\/100\)/);
    expect(scoreMatch).not.toBeNull();
    if (scoreMatch && scoreMatch[1]) {
      const score = parseInt(scoreMatch[1], 10);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("Utility functions", () => {
  describe("truncateAddress", () => {
    it("should truncate long addresses", () => {
      const addr = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78";
      const truncated = truncateAddress(addr);
      expect(truncated).toContain("...");
      expect(truncated.length).toBeLessThan(addr.length);
    });

    it("should not truncate short addresses", () => {
      const addr = "0x123456";
      const truncated = truncateAddress(addr);
      expect(truncated).toBe(addr);
    });

    it("should handle custom char count", () => {
      const addr = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD78";
      const truncated = truncateAddress(addr, 4);
      expect(truncated).toBe("0x742d...bD78");
    });

    it("should handle empty string", () => {
      expect(truncateAddress("")).toBe("");
    });
  });

  describe("truncateText", () => {
    it("should truncate long text", () => {
      const text = "This is a very long text that should be truncated";
      const truncated = truncateText(text, 20);
      expect(truncated.length).toBe(20);
      expect(truncated).toContain("...");
    });

    it("should not truncate short text", () => {
      const text = "Short text";
      expect(truncateText(text, 50)).toBe(text);
    });

    it("should handle empty string", () => {
      expect(truncateText("", 10)).toBe("");
    });
  });

  describe("formatNumber", () => {
    it("should format millions", () => {
      expect(formatNumber(1500000)).toBe("1.50M");
    });

    it("should format thousands", () => {
      expect(formatNumber(25000)).toBe("25.0K");
    });

    it("should format small numbers", () => {
      expect(formatNumber(999)).toBe("999.00");
    });

    it("should handle zero", () => {
      expect(formatNumber(0)).toBe("0.00");
    });
  });

  describe("capitalize", () => {
    it("should capitalize first letter", () => {
      expect(capitalize("hello")).toBe("Hello");
    });

    it("should handle single letter", () => {
      expect(capitalize("h")).toBe("H");
    });

    it("should handle empty string", () => {
      expect(capitalize("")).toBe("");
    });

    it("should handle already capitalized", () => {
      expect(capitalize("Hello")).toBe("Hello");
    });
  });

  describe("formatTimestamp", () => {
    it("should format timestamp", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const formatted = formatTimestamp(date);
      expect(formatted).toContain("2024");
      expect(formatted).toContain("Jan");
    });
  });

  describe("getSeverityEmoji", () => {
    it("should return emoji for each severity", () => {
      expect(getSeverityEmoji(AlertSeverity.CRITICAL)).toBe("🚨");
      expect(getSeverityEmoji(AlertSeverity.HIGH)).toBe("⚠️");
      expect(getSeverityEmoji(AlertSeverity.MEDIUM)).toBe("🔔");
      expect(getSeverityEmoji(AlertSeverity.LOW)).toBe("📢");
      expect(getSeverityEmoji(AlertSeverity.INFO)).toBe("ℹ️");
    });
  });

  describe("getTypeVerb", () => {
    it("should return verb for each type", () => {
      expect(getTypeVerb(AlertType.WHALE_TRADE)).toContain("Whale");
      expect(getTypeVerb(AlertType.FRESH_WALLET)).toContain("Fresh wallet");
      expect(getTypeVerb(AlertType.INSIDER_ACTIVITY)).toContain("insider");
    });
  });

  describe("calculateConfidence", () => {
    it("should calculate base confidence", () => {
      const alert = createMockAlert({
        walletAddress: undefined,
        marketTitle: undefined,
        tradeSize: undefined,
      });
      const confidence = calculateConfidence(alert);
      expect(confidence).toBeGreaterThanOrEqual(70);
    });

    it("should increase confidence with more data", () => {
      const minAlert: AlertData = {
        id: "test",
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: "Test",
        timestamp: new Date(),
      };
      const fullAlert = createMockAlert();

      const minConf = calculateConfidence(minAlert);
      const fullConf = calculateConfidence(fullAlert);

      expect(fullConf).toBeGreaterThan(minConf);
    });

    it("should cap at 100", () => {
      const alert = createMockAlert();
      const confidence = calculateConfidence(alert);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });

  describe("validateAlertData", () => {
    it("should validate valid alert", () => {
      const alert = createMockAlert();
      expect(validateAlertData(alert)).toBe(true);
    });

    it("should reject missing id", () => {
      expect(validateAlertData({ type: AlertType.SYSTEM })).toBe(false);
    });

    it("should reject invalid type", () => {
      expect(
        validateAlertData({
          id: "test",
          type: "invalid",
          severity: AlertSeverity.INFO,
          title: "Test",
          timestamp: new Date(),
        })
      ).toBe(false);
    });

    it("should reject null", () => {
      expect(validateAlertData(null)).toBe(false);
    });

    it("should reject non-object", () => {
      expect(validateAlertData("string")).toBe(false);
    });
  });

  describe("parseAlertType", () => {
    it("should parse valid types", () => {
      expect(parseAlertType("whale_trade")).toBe(AlertType.WHALE_TRADE);
      expect(parseAlertType("fresh_wallet")).toBe(AlertType.FRESH_WALLET);
    });

    it("should return null for invalid type", () => {
      expect(parseAlertType("invalid")).toBeNull();
    });

    it("should handle case variations", () => {
      expect(parseAlertType("WHALE_TRADE".toLowerCase())).toBe(
        AlertType.WHALE_TRADE
      );
    });
  });

  describe("parseAlertSeverity", () => {
    it("should parse valid severities", () => {
      expect(parseAlertSeverity("critical")).toBe(AlertSeverity.CRITICAL);
      expect(parseAlertSeverity("high")).toBe(AlertSeverity.HIGH);
    });

    it("should return null for invalid severity", () => {
      expect(parseAlertSeverity("invalid")).toBeNull();
    });
  });
});

describe("Factory functions", () => {
  afterEach(() => {
    resetSharedAlertSummaryGenerator();
  });

  describe("createAlertSummaryGenerator", () => {
    it("should create new instance", () => {
      const gen1 = createAlertSummaryGenerator();
      const gen2 = createAlertSummaryGenerator();
      expect(gen1).not.toBe(gen2);
    });

    it("should accept config", () => {
      const gen = createAlertSummaryGenerator({
        defaultStyle: SummaryStyle.BRIEF,
      });
      expect(gen.getConfig().defaultStyle).toBe(SummaryStyle.BRIEF);
    });
  });

  describe("shared instance management", () => {
    it("should get shared instance", () => {
      const gen1 = getSharedAlertSummaryGenerator();
      const gen2 = getSharedAlertSummaryGenerator();
      expect(gen1).toBe(gen2);
    });

    it("should set shared instance", () => {
      const custom = createAlertSummaryGenerator({
        defaultStyle: SummaryStyle.DETAILED,
      });
      setSharedAlertSummaryGenerator(custom);
      expect(getSharedAlertSummaryGenerator()).toBe(custom);
    });

    it("should reset shared instance", () => {
      const gen1 = getSharedAlertSummaryGenerator();
      resetSharedAlertSummaryGenerator();
      const gen2 = getSharedAlertSummaryGenerator();
      expect(gen1).not.toBe(gen2);
    });
  });
});

describe("Convenience functions", () => {
  beforeEach(() => {
    resetSharedAlertSummaryGenerator();
  });

  afterEach(() => {
    resetSharedAlertSummaryGenerator();
  });

  it("generateAlertSummary should use shared instance", () => {
    const alert = createMockAlert();
    const result = generateAlertSummary(alert);
    expect(result.summary).toBeTruthy();
  });

  it("getBriefSummary should return brief text", () => {
    const alert = createMockAlert();
    const summary = getBriefSummary(alert);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeLessThan(200);
  });

  it("getStandardSummary should return standard text", () => {
    const alert = createMockAlert();
    const summary = getStandardSummary(alert);
    expect(typeof summary).toBe("string");
    expect(summary).toContain("detected");
  });

  it("getDetailedSummary should return detailed text", () => {
    const alert = createMockAlert();
    const summary = getDetailedSummary(alert);
    expect(typeof summary).toBe("string");
    expect(summary).toContain("ALERT SUMMARY");
  });

  it("getTechnicalSummary should return technical text", () => {
    const alert = createMockAlert();
    const summary = getTechnicalSummary(alert);
    expect(typeof summary).toBe("string");
    expect(summary).toContain(alert.type.toUpperCase());
  });

  it("getCasualSummary should return casual text", () => {
    const alert = createMockAlert();
    const summary = getCasualSummary(alert);
    expect(typeof summary).toBe("string");
    // Should contain emoji (including warning signs, info, etc.)
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2139}]/u;
    expect(emojiRegex.test(summary)).toBe(true);
  });
});

describe("Mock data generators", () => {
  describe("createMockAlert", () => {
    it("should create alert with defaults", () => {
      const alert = createMockAlert();
      expect(alert.id).toBeTruthy();
      expect(alert.type).toBe(AlertType.WHALE_TRADE);
      expect(alert.severity).toBe(AlertSeverity.HIGH);
    });

    it("should accept overrides", () => {
      const alert = createMockAlert({
        type: AlertType.FRESH_WALLET,
        severity: AlertSeverity.CRITICAL,
      });
      expect(alert.type).toBe(AlertType.FRESH_WALLET);
      expect(alert.severity).toBe(AlertSeverity.CRITICAL);
    });

    it("should include all expected fields", () => {
      const alert = createMockAlert();
      expect(alert.walletAddress).toBeTruthy();
      expect(alert.marketId).toBeTruthy();
      expect(alert.marketTitle).toBeTruthy();
      expect(alert.tradeSize).toBeGreaterThan(0);
    });
  });

  describe("createMockAlertBatch", () => {
    it("should create specified number of alerts", () => {
      const alerts = createMockAlertBatch(10);
      expect(alerts).toHaveLength(10);
    });

    it("should create alerts with varied types", () => {
      const alerts = createMockAlertBatch(20);
      const types = new Set(alerts.map((a) => a.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it("should accept base overrides", () => {
      const alerts = createMockAlertBatch(5, { marketId: "same-market" });
      alerts.forEach((alert) => {
        expect(alert.marketId).toBe("same-market");
      });
    });

    it("should assign unique IDs", () => {
      const alerts = createMockAlertBatch(5);
      const ids = new Set(alerts.map((a) => a.id));
      expect(ids.size).toBe(5);
    });
  });
});

describe("Constants", () => {
  it("should have default config values", () => {
    expect(DEFAULT_SUMMARY_CONFIG.defaultStyle).toBe(SummaryStyle.STANDARD);
    expect(DEFAULT_SUMMARY_CONFIG.enableCache).toBe(true);
    expect(DEFAULT_SUMMARY_CONFIG.cacheTTL).toBeGreaterThan(0);
    expect(DEFAULT_SUMMARY_CONFIG.maxCacheSize).toBeGreaterThan(0);
  });

  it("should have descriptions for all alert types", () => {
    Object.values(AlertType).forEach((type) => {
      expect(ALERT_TYPE_DESCRIPTIONS[type]).toBeTruthy();
    });
  });

  it("should have descriptors for all severities", () => {
    Object.values(AlertSeverity).forEach((severity) => {
      expect(SEVERITY_DESCRIPTORS[severity]).toBeTruthy();
    });
  });

  it("should have valid risk thresholds", () => {
    expect(RISK_THRESHOLDS.critical).toBeGreaterThan(RISK_THRESHOLDS.high);
    expect(RISK_THRESHOLDS.high).toBeGreaterThan(RISK_THRESHOLDS.medium);
    expect(RISK_THRESHOLDS.medium).toBeGreaterThan(RISK_THRESHOLDS.low);
  });
});

describe("Edge cases", () => {
  let generator: AlertSummaryGenerator;

  beforeEach(() => {
    generator = createAlertSummaryGenerator();
  });

  it("should handle alert with minimal data", () => {
    const minAlert: AlertData = {
      id: "min-alert",
      type: AlertType.SYSTEM,
      severity: AlertSeverity.INFO,
      title: "Minimal Alert",
      timestamp: new Date(),
    };
    const result = generator.generateSummary(minAlert);
    expect(result.summary).toBeTruthy();
  });

  it("should handle alert with zero values", () => {
    const alert = createMockAlert({
      tradeSize: 0,
      priceChange: 0,
      suspicionScore: 0,
      walletAge: 0,
    });
    const result = generator.generateSummary(alert);
    expect(result.summary).toBeTruthy();
  });

  it("should handle negative price change", () => {
    const alert = createMockAlert({ priceChange: -15.5 });
    const result = generator.generateSummary(alert);
    const containsDecrease = result.summary.includes("decrease") || result.summary.includes("-");
    expect(containsDecrease).toBe(true);
  });

  it("should handle string timestamp", () => {
    const alert = {
      ...createMockAlert(),
      timestamp: "2024-01-15T10:30:00Z" as unknown as Date,
    };
    const result = generator.generateSummary(alert);
    expect(result.summary).toBeTruthy();
  });

  it("should handle very large trade size", () => {
    const alert = createMockAlert({ tradeSize: 10000000 });
    const result = generator.generateSummary(alert);
    expect(result.summary).toBeTruthy();
  });

  it("should handle empty wallet address", () => {
    const alert = createMockAlert({ walletAddress: "" });
    const result = generator.generateSummary(alert);
    expect(result.summary).toBeTruthy();
  });

  it("should handle very long market title", () => {
    const alert = createMockAlert({
      marketTitle: "A".repeat(500),
    });
    const result = generator.generateSummary(alert, { style: SummaryStyle.BRIEF });
    expect(result.summary.length).toBeLessThan(alert.marketTitle!.length);
  });
});

describe("Performance", () => {
  it("should generate summary quickly", () => {
    const generator = createAlertSummaryGenerator();

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      generator.generateSummary(createMockAlert({ id: `perf-${i}` }));
    }
    const duration = Date.now() - start;

    // Should process 100 summaries in under 1 second
    expect(duration).toBeLessThan(1000);
  });

  it("should handle batch efficiently", () => {
    const generator = createAlertSummaryGenerator();
    const alerts = createMockAlertBatch(50);

    const start = Date.now();
    const result = generator.generateBatchSummaries(alerts);
    const duration = Date.now() - start;

    expect(result.summaries).toHaveLength(50);
    // Should process batch in under 500ms
    expect(duration).toBeLessThan(500);
  });
});
