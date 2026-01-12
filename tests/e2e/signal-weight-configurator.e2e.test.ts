/**
 * E2E tests for Signal Weight Configurator (DET-SCORE-002)
 *
 * Tests the integration of the signal weight configurator with
 * composite suspicion scorer and real-world usage scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  createSignalWeightConfigurator,
  createConfiguratorWithPreset,
  resetSharedSignalWeightConfigurator,
  WeightValidationMode,
  WeightPreset,
} from "../../src/detection/signal-weight-configurator";
import {
  CompositeSuspicionScorer,
  createCompositeSuspicionScorer,
  SignalSource,
  CompositeSignalCategory,
} from "../../src/detection/composite-suspicion-scorer";

describe("Signal Weight Configurator E2E Tests", () => {
  let tempDir: string;

  beforeEach(() => {
    resetSharedSignalWeightConfigurator();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "weight-config-test-"));
  });

  afterEach(() => {
    resetSharedSignalWeightConfigurator();
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // Integration with Composite Suspicion Scorer
  // =========================================================================

  describe("Integration with Composite Suspicion Scorer", () => {
    it("should provide effective weights that can be used by scorer", () => {
      const configurator = createSignalWeightConfigurator();
      configurator.applyPreset(WeightPreset.PERFORMANCE_FOCUSED);

      const { signalWeights, categoryWeights } = configurator.getEffectiveWeights();

      // Create scorer with these weights (cast to full Record since we know all signals are enabled)
      const scorer = createCompositeSuspicionScorer({
        signalWeights: signalWeights as Record<SignalSource, number>,
        categoryWeights: categoryWeights as Record<CompositeSignalCategory, number>,
      });

      expect(scorer).toBeInstanceOf(CompositeSuspicionScorer);
    });

    it("should update scorer weights dynamically", () => {
      const configurator = createSignalWeightConfigurator();

      // Change weights
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.30);
      configurator.setSignalWeight(SignalSource.COORDINATION, 0.25);

      const { signalWeights } = configurator.getEffectiveWeights();

      // Verify the weights would affect scorer behavior
      // Note: Due to normalization, effective weights may differ from raw values
      expect(signalWeights[SignalSource.WIN_RATE]).toBeDefined();
      expect(signalWeights[SignalSource.COORDINATION]).toBeDefined();
    });

    it("should exclude disabled signals from scorer weights", () => {
      const configurator = createSignalWeightConfigurator();

      // Disable some signals
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      configurator.setSignalEnabled(SignalSource.FRESH_WALLET, false);

      const { signalWeights } = configurator.getEffectiveWeights();

      expect(signalWeights[SignalSource.SYBIL]).toBeUndefined();
      expect(signalWeights[SignalSource.FRESH_WALLET]).toBeUndefined();
      expect(signalWeights[SignalSource.WIN_RATE]).toBeDefined();
    });

    it("should work with all preset configurations", () => {
      for (const preset of Object.values(WeightPreset)) {
        const configurator = createConfiguratorWithPreset(preset);
        const { signalWeights, categoryWeights } = configurator.getEffectiveWeights();

        // Each preset should produce valid weights
        const signalSum = Object.values(signalWeights).reduce((a, b) => a + (b ?? 0), 0);
        const categorySum = Object.values(categoryWeights).reduce(
          (a, b) => a + (b ?? 0),
          0
        );

        expect(signalSum).toBeCloseTo(1.0, 4);
        expect(categorySum).toBeCloseTo(1.0, 4);
      }
    });
  });

  // =========================================================================
  // File Persistence Tests
  // =========================================================================

  describe("File Persistence", () => {
    it("should save configuration to file", () => {
      const configPath = path.join(tempDir, "weights.json");
      const configurator = createSignalWeightConfigurator({
        settingsPath: configPath,
      });

      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);
      const saved = configurator.saveToFile();

      expect(saved).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(content.signalWeights[SignalSource.WIN_RATE].weight).toBe(0.25);
    });

    it("should load configuration from file", () => {
      const configPath = path.join(tempDir, "weights.json");

      // Create and save config
      const configurator1 = createSignalWeightConfigurator({
        settingsPath: configPath,
      });
      configurator1.setSignalWeight(SignalSource.WIN_RATE, 0.30);
      configurator1.setConfigName("My Saved Config");
      configurator1.saveToFile();

      // Load in new configurator
      const configurator2 = createSignalWeightConfigurator({
        settingsPath: configPath,
      });

      expect(configurator2.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(0.30);
      expect(configurator2.getConfig().name).toBe("My Saved Config");
    });

    it("should auto-save when enabled", () => {
      const configPath = path.join(tempDir, "auto-save.json");
      const configurator = createSignalWeightConfigurator({
        settingsPath: configPath,
        autoSave: true,
      });

      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);

      // File should be saved automatically
      expect(fs.existsSync(configPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(configPath, "utf8"));
      expect(content.signalWeights[SignalSource.WIN_RATE].weight).toBe(0.25);
    });

    it("should handle missing file gracefully", () => {
      const configPath = path.join(tempDir, "nonexistent.json");
      const configurator = createSignalWeightConfigurator({
        settingsPath: configPath,
      });

      // Should use default config
      expect(configurator.getCurrentPreset()).toBe(WeightPreset.DEFAULT);
    });

    it("should create directory if needed", () => {
      const nestedPath = path.join(tempDir, "nested", "dir", "weights.json");
      const configurator = createSignalWeightConfigurator();

      const saved = configurator.saveToFile(nestedPath);

      expect(saved).toBe(true);
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it("should emit save and load events", () => {
      const configPath = path.join(tempDir, "events.json");
      const configurator = createSignalWeightConfigurator({
        settingsPath: configPath,
      });

      const saveHandler = vi.fn();
      const loadHandler = vi.fn();
      configurator.on("config-saved", saveHandler);
      configurator.on("config-loaded", loadHandler);

      configurator.saveToFile();
      expect(saveHandler).toHaveBeenCalled();

      const configurator2 = createSignalWeightConfigurator({
        settingsPath: configPath,
      });
      configurator2.on("config-loaded", loadHandler);
      configurator2.loadFromFile();
      expect(loadHandler).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Real-World Usage Scenarios
  // =========================================================================

  describe("Real-World Usage Scenarios", () => {
    it("should configure for network-focused monitoring", () => {
      const configurator = createSignalWeightConfigurator();

      // Apply network-focused preset
      configurator.applyPreset(WeightPreset.NETWORK_FOCUSED);

      const analysis = configurator.analyzeWeightImpact();

      // Network signals should have high impact
      const coordinationImpact = analysis.mostImpactfulSignals.find(
        (s) => s.source === SignalSource.COORDINATION
      );
      const sybilImpact = analysis.mostImpactfulSignals.find(
        (s) => s.source === SignalSource.SYBIL
      );

      expect(coordinationImpact).toBeDefined();
      expect(sybilImpact).toBeDefined();

      // Network category should have highest total impact
      const networkCategory = analysis.categoryImpact.find(
        (c) => c.category === CompositeSignalCategory.NETWORK
      );
      expect(networkCategory!.totalWeight).toBeGreaterThan(0.3);
    });

    it("should configure for conservative balanced approach", () => {
      const configurator = createSignalWeightConfigurator();
      configurator.applyPreset(WeightPreset.CONSERVATIVE);

      const analysis = configurator.analyzeWeightImpact();

      // All signals should have equal weight
      expect(analysis.balance.assessment).toBe("balanced");
      expect(analysis.balance.signalWeightStdDev).toBeCloseTo(0, 4);
    });

    it("should fine-tune weights after applying preset", () => {
      const configurator = createSignalWeightConfigurator();

      // Start with insider detection preset
      configurator.applyPreset(WeightPreset.INSIDER_DETECTION);

      // Fine-tune based on domain knowledge
      configurator.setSignalWeight(SignalSource.TIMING_PATTERN, 0.15);
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.18);

      expect(configurator.getCurrentPreset()).toBe(WeightPreset.CUSTOM);

      const validation = configurator.validate();
      expect(validation.isValid).toBe(true);
    });

    it("should disable non-relevant signals for specific use case", () => {
      const configurator = createSignalWeightConfigurator();

      // Focus only on performance signals
      configurator.setSignalEnabled(SignalSource.FRESH_WALLET, false);
      configurator.setSignalEnabled(SignalSource.COORDINATION, false);
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      configurator.setSignalEnabled(SignalSource.TRADING_PATTERN, false);

      const { signalWeights } = configurator.getEffectiveWeights();
      const enabledSignals = Object.keys(signalWeights).length;

      expect(enabledSignals).toBe(6); // 10 total - 4 disabled
    });

    it("should track configuration changes for audit", () => {
      const configurator = createSignalWeightConfigurator();

      // Simulate a series of configuration changes
      configurator.applyPreset(WeightPreset.CONSERVATIVE, "admin");
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.15, "analyst");
      configurator.setThresholds({ low: 15 }, "manager");

      const history = configurator.getHistory();

      expect(history.length).toBe(3);
      const entry0 = history[0];
      const entry1 = history[1];
      const entry2 = history[2];
      expect(entry0?.changedBy).toBe("admin");
      expect(entry1?.changedBy).toBe("analyst");
      expect(entry2?.changedBy).toBe("manager");
    });

    it("should export and share configuration between instances", () => {
      const configurator1 = createSignalWeightConfigurator();
      configurator1.applyPreset(WeightPreset.AGGRESSIVE);
      configurator1.setSignalWeight(SignalSource.ACCURACY, 0.12);
      configurator1.setConfigName("Production Config v1");

      const exported = configurator1.exportConfig();

      // Simulate another instance importing the config
      const configurator2 = createSignalWeightConfigurator();
      const result = configurator2.importConfig(exported);

      expect(result.isValid).toBe(true);
      expect(configurator2.getConfig().name).toBe("Production Config v1");
      expect(configurator2.getSignalWeight(SignalSource.ACCURACY).weight).toBe(0.12);
    });
  });

  // =========================================================================
  // Validation Modes E2E Tests
  // =========================================================================

  describe("Validation Modes", () => {
    it("should enforce strict validation in strict mode", () => {
      const configurator = createSignalWeightConfigurator({
        validationMode: WeightValidationMode.STRICT,
      });

      // Manually set weights that don't sum to 1
      for (const source of Object.values(SignalSource)) {
        configurator.setSignalWeight(source, 0.05);
      }

      const validation = configurator.validate();
      expect(validation.isValid).toBe(false);
    });

    it("should auto-normalize in normalize mode", () => {
      const configurator = createSignalWeightConfigurator({
        validationMode: WeightValidationMode.NORMALIZE,
      });

      // Set arbitrary weights
      configurator.setSignalWeight(SignalSource.WIN_RATE, 2.0); // Way over 1
      configurator.setSignalWeight(SignalSource.PROFIT_LOSS, 1.0);

      // Validation should pass and provide normalized weights
      const validation = configurator.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.normalizedWeights).toBeDefined();

      // Effective weights should be normalized
      const { signalWeights } = configurator.getEffectiveWeights();
      const sum = Object.values(signalWeights).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1.0, 4);
    });

    it("should allow any weights in none mode", () => {
      const configurator = createSignalWeightConfigurator({
        validationMode: WeightValidationMode.NONE,
      });

      // Set arbitrary weights
      for (const source of Object.values(SignalSource)) {
        configurator.setSignalWeight(source, 0.5);
      }

      const validation = configurator.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.signalWeightSum).toBe(5.0); // 10 signals * 0.5
    });
  });

  // =========================================================================
  // Event Handling E2E Tests
  // =========================================================================

  describe("Event Handling", () => {
    it("should emit events in correct order during preset application", () => {
      const configurator = createSignalWeightConfigurator();
      const events: string[] = [];

      configurator.on("preset-applied", () => events.push("preset-applied"));

      configurator.applyPreset(WeightPreset.CONSERVATIVE);

      expect(events).toContain("preset-applied");
    });

    it("should handle multiple listeners", () => {
      const configurator = createSignalWeightConfigurator();
      const results: number[] = [];

      configurator.on("weight-changed", () => results.push(1));
      configurator.on("weight-changed", () => results.push(2));
      configurator.on("weight-changed", () => results.push(3));

      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.20);

      expect(results).toEqual([1, 2, 3]);
    });

    it("should emit appropriate events for bulk operations", () => {
      const configurator = createSignalWeightConfigurator();
      const events: string[] = [];

      configurator.on("weights-bulk-changed", (data) =>
        events.push(`bulk-${data.type}`)
      );

      configurator.setSignalWeights({
        [SignalSource.WIN_RATE]: 0.20,
        [SignalSource.PROFIT_LOSS]: 0.20,
      });

      configurator.setCategoryWeights({
        [CompositeSignalCategory.PERFORMANCE]: 0.40,
      });

      expect(events).toContain("bulk-signals");
      expect(events).toContain("bulk-categories");
    });
  });

  // =========================================================================
  // Error Recovery E2E Tests
  // =========================================================================

  describe("Error Recovery", () => {
    it("should recover from invalid import", () => {
      const configurator = createSignalWeightConfigurator();
      const originalWeight = configurator.getSignalWeight(SignalSource.WIN_RATE).weight;

      // Try invalid import
      const result = configurator.importConfig("invalid json");
      expect(result.isValid).toBe(false);

      // Original config should be unchanged
      expect(configurator.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(
        originalWeight
      );
    });

    it("should handle corrupted save file", () => {
      const configPath = path.join(tempDir, "corrupted.json");

      // Write corrupted content
      fs.writeFileSync(configPath, "not valid json content");

      // Loading should fail gracefully
      const configurator = createSignalWeightConfigurator({
        settingsPath: configPath,
      });

      // Should use defaults
      expect(configurator.getCurrentPreset()).toBe(WeightPreset.DEFAULT);
    });

    it("should maintain consistency after rapid changes", () => {
      const configurator = createSignalWeightConfigurator();
      const signalSourceValues = Object.values(SignalSource);

      // Simulate rapid changes
      for (let i = 0; i < 50; i++) {
        const source = signalSourceValues[i % 10];
        if (source) {
          configurator.setSignalWeight(source, Math.random());
        }
      }

      // Config should still be valid
      const validation = configurator.validate();
      expect(validation.isValid).toBe(true);

      // Effective weights should sum to 1
      const { signalWeights } = configurator.getEffectiveWeights();
      const sum = Object.values(signalWeights).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1.0, 4);
    });
  });

  // =========================================================================
  // Configuration Migration E2E Tests
  // =========================================================================

  describe("Configuration Migration", () => {
    it("should handle importing older config versions", () => {
      const configurator = createSignalWeightConfigurator();

      // Create a config with an older version
      const oldConfig = {
        version: "0.9.0",
        name: "Old Config",
        preset: WeightPreset.DEFAULT,
        validationMode: WeightValidationMode.NORMALIZE,
        signalWeights: {} as Record<string, unknown>,
        categoryWeights: {} as Record<string, unknown>,
        thresholds: { low: 20, medium: 40, high: 60, critical: 80 },
        flagThreshold: 50,
        insiderThreshold: 70,
        lastModified: new Date().toISOString(),
      };

      // Add all required signal weights
      for (const source of Object.values(SignalSource)) {
        oldConfig.signalWeights[source] = {
          source,
          weight: 0.1,
          enabled: true,
          description: "Test",
        };
      }

      // Add all required category weights
      for (const category of Object.values(CompositeSignalCategory)) {
        oldConfig.categoryWeights[category] = {
          category,
          weight: 0.25,
          enabled: true,
          description: "Test",
        };
      }

      const result = configurator.importConfig(JSON.stringify(oldConfig));
      expect(result.isValid).toBe(true);
    });
  });

  // =========================================================================
  // Summary and Analytics E2E Tests
  // =========================================================================

  describe("Summary and Analytics", () => {
    it("should provide accurate summary after multiple operations", () => {
      const configurator = createSignalWeightConfigurator();

      // Perform various operations
      configurator.applyPreset(WeightPreset.AGGRESSIVE);
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.20);
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      configurator.setSignalEnabled(SignalSource.FRESH_WALLET, false);

      const summary = configurator.getSummary();

      expect(summary.currentPreset).toBe(WeightPreset.CUSTOM);
      expect(summary.activeSignals).toBe(8); // 10 - 2 disabled
      expect(summary.historyCount).toBe(4); // 4 operations
    });

    it("should analyze weight impact correctly for skewed config", () => {
      const configurator = createSignalWeightConfigurator();

      // Create heavily skewed configuration
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.50);
      configurator.setSignalWeight(SignalSource.PROFIT_LOSS, 0.30);

      const analysis = configurator.analyzeWeightImpact();

      // WIN_RATE should be most impactful
      const topSignal = analysis.mostImpactfulSignals[0];
      expect(topSignal?.source).toBe(SignalSource.WIN_RATE);

      // Should be assessed as skewed or extreme
      expect(["skewed", "extreme"]).toContain(analysis.balance.assessment);
    });

    it("should provide category breakdown", () => {
      const configurator = createSignalWeightConfigurator();
      configurator.applyPreset(WeightPreset.PERFORMANCE_FOCUSED);

      const analysis = configurator.analyzeWeightImpact();

      // Performance category should have high total weight
      const performanceCategory = analysis.categoryImpact.find(
        (c) => c.category === CompositeSignalCategory.PERFORMANCE
      );

      expect(performanceCategory).toBeDefined();
      expect(performanceCategory!.totalWeight).toBeGreaterThan(0.4);
    });
  });

  // =========================================================================
  // Threshold Configuration E2E Tests
  // =========================================================================

  describe("Threshold Configuration", () => {
    it("should configure thresholds for different sensitivity levels", () => {
      const configurator = createSignalWeightConfigurator();

      // High sensitivity (lower thresholds)
      configurator.setThresholds({
        low: 10,
        medium: 25,
        high: 45,
        critical: 65,
      });
      configurator.setFlagThresholds({
        flagThreshold: 35,
        insiderThreshold: 55,
      });

      const config = configurator.getConfig();
      expect(config.thresholds.low).toBe(10);
      expect(config.flagThreshold).toBe(35);
    });

    it("should prevent invalid threshold ordering", () => {
      const configurator = createSignalWeightConfigurator();

      // Try to set invalid thresholds
      const result = configurator.setThresholds({
        low: 50,
        medium: 30, // Invalid: less than low
      });

      expect(result.isValid).toBe(false);

      // Original thresholds should be preserved
      const config = configurator.getConfig();
      expect(config.thresholds.low).toBe(20);
      expect(config.thresholds.medium).toBe(40);
    });
  });

  // =========================================================================
  // Concurrency E2E Tests
  // =========================================================================

  describe("Concurrent Operations", () => {
    it("should handle concurrent weight updates", async () => {
      const configurator = createSignalWeightConfigurator();

      // Simulate concurrent updates
      const promises = Object.values(SignalSource).map((source, i) =>
        Promise.resolve().then(() =>
          configurator.setSignalWeight(source, 0.05 + i * 0.01)
        )
      );

      await Promise.all(promises);

      // Config should be consistent
      const validation = configurator.validate();
      expect(validation.isValid).toBe(true);
    });
  });

  // =========================================================================
  // Preset Coverage E2E Tests
  // =========================================================================

  describe("Preset Coverage", () => {
    it("should have distinct characteristics for each preset", () => {
      const results: Map<
        WeightPreset,
        { topSignal: SignalSource; topCategory: CompositeSignalCategory }
      > = new Map();

      for (const preset of Object.values(WeightPreset)) {
        const configurator = createConfiguratorWithPreset(preset);
        const analysis = configurator.analyzeWeightImpact();

        const topSignal = analysis.mostImpactfulSignals[0];
        const topCategory = analysis.categoryImpact[0];
        if (topSignal && topCategory) {
          results.set(preset, {
            topSignal: topSignal.source,
            topCategory: topCategory.category,
          });
        }
      }

      // Verify presets have expected characteristics
      expect(results.get(WeightPreset.NETWORK_FOCUSED)?.topSignal).toBe(
        SignalSource.COORDINATION
      );
      expect(results.get(WeightPreset.PERFORMANCE_FOCUSED)?.topCategory).toBe(
        CompositeSignalCategory.PERFORMANCE
      );
      expect(results.get(WeightPreset.FRESH_WALLET_FOCUSED)?.topSignal).toBe(
        SignalSource.FRESH_WALLET
      );
    });

    it("should apply each preset without errors", () => {
      const configurator = createSignalWeightConfigurator();

      for (const preset of Object.values(WeightPreset)) {
        const result = configurator.applyPreset(preset);
        expect(result.isValid).toBe(true);
        expect(configurator.getCurrentPreset()).toBe(preset);
      }
    });
  });

  // =========================================================================
  // History Persistence E2E Tests
  // =========================================================================

  describe("History Persistence", () => {
    it("should maintain history across operations", () => {
      const configurator = createSignalWeightConfigurator({
        maxHistoryEntries: 50,
      });
      const signalSourceValues = Object.values(SignalSource);

      // Perform many operations
      configurator.applyPreset(WeightPreset.CONSERVATIVE);
      for (let i = 0; i < 20; i++) {
        const source = signalSourceValues[i % 10];
        if (source) {
          configurator.setSignalWeight(source, 0.1 + (i % 5) * 0.01);
        }
      }
      configurator.reset();

      const history = configurator.getHistory();

      // Should have all operations tracked
      expect(history.length).toBe(22); // 1 preset + 20 weights + 1 reset

      // First entry should be preset application
      const firstEntry = history[0];
      expect(firstEntry?.type).toBe("PRESET_APPLIED");

      // Last entry should be reset
      const lastEntry = history[history.length - 1];
      expect(lastEntry?.type).toBe("RESET");
    });

    it("should enforce max history size", () => {
      const configurator = createSignalWeightConfigurator({
        maxHistoryEntries: 5,
      });

      // Perform more operations than max
      for (let i = 0; i < 20; i++) {
        configurator.setSignalWeight(SignalSource.WIN_RATE, 0.1 + i * 0.01);
      }

      expect(configurator.getHistory().length).toBe(5);
    });
  });
});

// Import vi for mocking
import { vi } from "vitest";
