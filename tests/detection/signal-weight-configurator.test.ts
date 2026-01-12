/**
 * Unit tests for Signal Weight Configurator (DET-SCORE-002)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SignalWeightConfigurator,
  createSignalWeightConfigurator,
  createConfiguratorWithPreset,
  getSharedSignalWeightConfigurator,
  setSharedSignalWeightConfigurator,
  resetSharedSignalWeightConfigurator,
  getEffectiveWeights,
  setSignalWeight,
  setCategoryWeight,
  applyWeightPreset,
  validateWeights,
  analyzeWeightImpact,
  resetWeightsToDefaults,
  exportWeightsConfig,
  importWeightsConfig,
  getConfiguratorSummary,
  getPresetDescription,
  getSignalDescription,
  getCategoryDescription,
  getValidationModeDescription,
  WeightValidationMode,
  WeightPreset,
  WeightChangeType,
  CONFIG_VERSION,
  SIGNAL_DESCRIPTIONS,
  CATEGORY_DESCRIPTIONS,
  WEIGHT_PRESETS,
  DEFAULT_CONFIGURATOR_OPTIONS,
} from "../../src/detection/signal-weight-configurator";
import {
  SignalSource,
  CompositeSignalCategory,
  COMPOSITE_DEFAULT_SIGNAL_WEIGHTS,
} from "../../src/detection/composite-suspicion-scorer";

describe("Signal Weight Configurator", () => {
  let configurator: SignalWeightConfigurator;

  beforeEach(() => {
    configurator = new SignalWeightConfigurator();
    resetSharedSignalWeightConfigurator();
  });

  afterEach(() => {
    resetSharedSignalWeightConfigurator();
  });

  // =========================================================================
  // Constants and Enums Tests
  // =========================================================================

  describe("Constants and Enums", () => {
    it("should have correct WeightValidationMode values", () => {
      expect(WeightValidationMode.STRICT).toBe("STRICT");
      expect(WeightValidationMode.NORMALIZE).toBe("NORMALIZE");
      expect(WeightValidationMode.NONE).toBe("NONE");
    });

    it("should have correct WeightPreset values", () => {
      expect(WeightPreset.DEFAULT).toBe("DEFAULT");
      expect(WeightPreset.NETWORK_FOCUSED).toBe("NETWORK_FOCUSED");
      expect(WeightPreset.PERFORMANCE_FOCUSED).toBe("PERFORMANCE_FOCUSED");
      expect(WeightPreset.BEHAVIOR_FOCUSED).toBe("BEHAVIOR_FOCUSED");
      expect(WeightPreset.CONSERVATIVE).toBe("CONSERVATIVE");
      expect(WeightPreset.AGGRESSIVE).toBe("AGGRESSIVE");
      expect(WeightPreset.FRESH_WALLET_FOCUSED).toBe("FRESH_WALLET_FOCUSED");
      expect(WeightPreset.INSIDER_DETECTION).toBe("INSIDER_DETECTION");
      expect(WeightPreset.CUSTOM).toBe("CUSTOM");
    });

    it("should have correct WeightChangeType values", () => {
      expect(WeightChangeType.SIGNAL_WEIGHT).toBe("SIGNAL_WEIGHT");
      expect(WeightChangeType.CATEGORY_WEIGHT).toBe("CATEGORY_WEIGHT");
      expect(WeightChangeType.PRESET_APPLIED).toBe("PRESET_APPLIED");
      expect(WeightChangeType.RESET).toBe("RESET");
      expect(WeightChangeType.THRESHOLD).toBe("THRESHOLD");
      expect(WeightChangeType.BULK_UPDATE).toBe("BULK_UPDATE");
    });

    it("should have all signal descriptions", () => {
      for (const source of Object.values(SignalSource)) {
        expect(SIGNAL_DESCRIPTIONS[source]).toBeDefined();
        expect(typeof SIGNAL_DESCRIPTIONS[source]).toBe("string");
        expect(SIGNAL_DESCRIPTIONS[source].length).toBeGreaterThan(0);
      }
    });

    it("should have all category descriptions", () => {
      for (const category of Object.values(CompositeSignalCategory)) {
        expect(CATEGORY_DESCRIPTIONS[category]).toBeDefined();
        expect(typeof CATEGORY_DESCRIPTIONS[category]).toBe("string");
        expect(CATEGORY_DESCRIPTIONS[category].length).toBeGreaterThan(0);
      }
    });

    it("should have all weight presets defined", () => {
      for (const preset of Object.values(WeightPreset)) {
        expect(WEIGHT_PRESETS[preset]).toBeDefined();
        expect(WEIGHT_PRESETS[preset].signalWeights).toBeDefined();
        expect(WEIGHT_PRESETS[preset].categoryWeights).toBeDefined();
        expect(WEIGHT_PRESETS[preset].description).toBeDefined();
      }
    });

    it("should have correct CONFIG_VERSION", () => {
      expect(CONFIG_VERSION).toBe("1.0.0");
    });

    it("should have valid DEFAULT_CONFIGURATOR_OPTIONS", () => {
      expect(DEFAULT_CONFIGURATOR_OPTIONS.initialPreset).toBe(WeightPreset.DEFAULT);
      expect(DEFAULT_CONFIGURATOR_OPTIONS.validationMode).toBe(WeightValidationMode.NORMALIZE);
      expect(DEFAULT_CONFIGURATOR_OPTIONS.autoSave).toBe(false);
      expect(DEFAULT_CONFIGURATOR_OPTIONS.settingsPath).toBe("");
      expect(DEFAULT_CONFIGURATOR_OPTIONS.maxHistoryEntries).toBe(100);
    });
  });

  // =========================================================================
  // Constructor Tests
  // =========================================================================

  describe("Constructor", () => {
    it("should create configurator with default options", () => {
      const cfg = new SignalWeightConfigurator();
      expect(cfg).toBeInstanceOf(SignalWeightConfigurator);

      const config = cfg.getConfig();
      expect(config.preset).toBe(WeightPreset.DEFAULT);
      expect(config.validationMode).toBe(WeightValidationMode.NORMALIZE);
    });

    it("should create configurator with custom preset", () => {
      const cfg = new SignalWeightConfigurator({
        initialPreset: WeightPreset.CONSERVATIVE,
      });

      const config = cfg.getConfig();
      expect(config.preset).toBe(WeightPreset.CONSERVATIVE);
    });

    it("should create configurator with custom validation mode", () => {
      const cfg = new SignalWeightConfigurator({
        validationMode: WeightValidationMode.STRICT,
      });

      const config = cfg.getConfig();
      expect(config.validationMode).toBe(WeightValidationMode.STRICT);
    });

    it("should initialize all signal weights", () => {
      const config = configurator.getConfig();

      for (const source of Object.values(SignalSource)) {
        expect(config.signalWeights[source]).toBeDefined();
        expect(config.signalWeights[source].source).toBe(source);
        expect(config.signalWeights[source].enabled).toBe(true);
        expect(typeof config.signalWeights[source].weight).toBe("number");
      }
    });

    it("should initialize all category weights", () => {
      const config = configurator.getConfig();

      for (const category of Object.values(CompositeSignalCategory)) {
        expect(config.categoryWeights[category]).toBeDefined();
        expect(config.categoryWeights[category].category).toBe(category);
        expect(config.categoryWeights[category].enabled).toBe(true);
        expect(typeof config.categoryWeights[category].weight).toBe("number");
      }
    });

    it("should initialize thresholds", () => {
      const config = configurator.getConfig();
      expect(config.thresholds).toBeDefined();
      expect(config.thresholds.low).toBe(20);
      expect(config.thresholds.medium).toBe(40);
      expect(config.thresholds.high).toBe(60);
      expect(config.thresholds.critical).toBe(80);
    });

    it("should initialize flag thresholds", () => {
      const config = configurator.getConfig();
      expect(config.flagThreshold).toBe(50);
      expect(config.insiderThreshold).toBe(70);
    });
  });

  // =========================================================================
  // Get Configuration Tests
  // =========================================================================

  describe("Get Configuration", () => {
    it("should return a deep copy of config", () => {
      const config1 = configurator.getConfig();
      const config2 = configurator.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1.signalWeights).not.toBe(config2.signalWeights);
    });

    it("should return current preset", () => {
      expect(configurator.getCurrentPreset()).toBe(WeightPreset.DEFAULT);
    });

    it("should get individual signal weight", () => {
      const sw = configurator.getSignalWeight(SignalSource.WIN_RATE);
      expect(sw.source).toBe(SignalSource.WIN_RATE);
      expect(typeof sw.weight).toBe("number");
    });

    it("should get all signal weights", () => {
      const weights = configurator.getAllSignalWeights();
      expect(Object.keys(weights).length).toBe(Object.keys(SignalSource).length);
    });

    it("should get individual category weight", () => {
      const cw = configurator.getCategoryWeight(CompositeSignalCategory.PERFORMANCE);
      expect(cw.category).toBe(CompositeSignalCategory.PERFORMANCE);
      expect(typeof cw.weight).toBe("number");
    });

    it("should get all category weights", () => {
      const weights = configurator.getAllCategoryWeights();
      expect(Object.keys(weights).length).toBe(Object.keys(CompositeSignalCategory).length);
    });
  });

  // =========================================================================
  // Effective Weights Tests
  // =========================================================================

  describe("Effective Weights", () => {
    it("should get effective weights (normalized by default)", () => {
      const { signalWeights, categoryWeights } = configurator.getEffectiveWeights();

      // Should have all enabled signals
      expect(Object.keys(signalWeights).length).toBe(Object.keys(SignalSource).length);

      // Should sum to 1 (or very close due to floating point)
      const signalSum = Object.values(signalWeights).reduce((a, b) => a + (b ?? 0), 0);
      expect(signalSum).toBeCloseTo(1.0, 4);

      const categorySum = Object.values(categoryWeights).reduce((a, b) => a + (b ?? 0), 0);
      expect(categorySum).toBeCloseTo(1.0, 4);
    });

    it("should exclude disabled signals from effective weights", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      const { signalWeights } = configurator.getEffectiveWeights();

      expect(signalWeights[SignalSource.SYBIL]).toBeUndefined();
    });

    it("should still normalize after disabling signals", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      configurator.setSignalEnabled(SignalSource.COORDINATION, false);

      const { signalWeights } = configurator.getEffectiveWeights();
      const sum = Object.values(signalWeights).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1.0, 4);
    });
  });

  // =========================================================================
  // Set Signal Weight Tests
  // =========================================================================

  describe("Set Signal Weight", () => {
    it("should set signal weight successfully", () => {
      const result = configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);
      expect(result.isValid).toBe(true);

      const sw = configurator.getSignalWeight(SignalSource.WIN_RATE);
      expect(sw.weight).toBe(0.25);
    });

    it("should reject weight less than 0", () => {
      const result = configurator.setSignalWeight(SignalSource.WIN_RATE, -0.1);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject weight greater than 1", () => {
      const result = configurator.setSignalWeight(SignalSource.WIN_RATE, 1.5);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should change preset to CUSTOM when weight is changed", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);
      expect(configurator.getCurrentPreset()).toBe(WeightPreset.CUSTOM);
    });

    it("should record change in history", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);
      const history = configurator.getHistory();
      expect(history.length).toBeGreaterThan(0);
      const lastEntry = history[history.length - 1];
      expect(lastEntry?.type).toBe(WeightChangeType.SIGNAL_WEIGHT);
    });

    it("should emit weight-changed event", () => {
      const handler = vi.fn();
      configurator.on("weight-changed", handler);

      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "signal",
          source: SignalSource.WIN_RATE,
          newValue: 0.25,
        })
      );
    });
  });

  // =========================================================================
  // Set Category Weight Tests
  // =========================================================================

  describe("Set Category Weight", () => {
    it("should set category weight successfully", () => {
      const result = configurator.setCategoryWeight(
        CompositeSignalCategory.PERFORMANCE,
        0.40
      );
      expect(result.isValid).toBe(true);

      const cw = configurator.getCategoryWeight(CompositeSignalCategory.PERFORMANCE);
      expect(cw.weight).toBe(0.40);
    });

    it("should reject weight less than 0", () => {
      const result = configurator.setCategoryWeight(
        CompositeSignalCategory.PERFORMANCE,
        -0.1
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject weight greater than 1", () => {
      const result = configurator.setCategoryWeight(
        CompositeSignalCategory.PERFORMANCE,
        1.5
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should emit weight-changed event for category", () => {
      const handler = vi.fn();
      configurator.on("weight-changed", handler);

      configurator.setCategoryWeight(CompositeSignalCategory.PERFORMANCE, 0.40);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "category",
          category: CompositeSignalCategory.PERFORMANCE,
          newValue: 0.40,
        })
      );
    });
  });

  // =========================================================================
  // Bulk Weight Update Tests
  // =========================================================================

  describe("Bulk Weight Updates", () => {
    it("should bulk set signal weights", () => {
      const result = configurator.setSignalWeights({
        [SignalSource.WIN_RATE]: 0.20,
        [SignalSource.PROFIT_LOSS]: 0.20,
        [SignalSource.ACCURACY]: 0.15,
      });

      expect(result.isValid).toBe(true);
      expect(configurator.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(0.20);
      expect(configurator.getSignalWeight(SignalSource.PROFIT_LOSS).weight).toBe(0.20);
      expect(configurator.getSignalWeight(SignalSource.ACCURACY).weight).toBe(0.15);
    });

    it("should bulk set category weights", () => {
      const result = configurator.setCategoryWeights({
        [CompositeSignalCategory.PERFORMANCE]: 0.40,
        [CompositeSignalCategory.NETWORK]: 0.30,
      });

      expect(result.isValid).toBe(true);
      expect(
        configurator.getCategoryWeight(CompositeSignalCategory.PERFORMANCE).weight
      ).toBe(0.40);
      expect(
        configurator.getCategoryWeight(CompositeSignalCategory.NETWORK).weight
      ).toBe(0.30);
    });

    it("should record bulk update in history", () => {
      configurator.setSignalWeights({
        [SignalSource.WIN_RATE]: 0.20,
        [SignalSource.PROFIT_LOSS]: 0.20,
      });

      const history = configurator.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry?.type).toBe(WeightChangeType.BULK_UPDATE);
    });
  });

  // =========================================================================
  // Enable/Disable Tests
  // =========================================================================

  describe("Enable/Disable Signals", () => {
    it("should disable a signal", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      expect(configurator.getSignalWeight(SignalSource.SYBIL).enabled).toBe(false);
    });

    it("should enable a signal", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      configurator.setSignalEnabled(SignalSource.SYBIL, true);
      expect(configurator.getSignalWeight(SignalSource.SYBIL).enabled).toBe(true);
    });

    it("should emit signal-toggled event", () => {
      const handler = vi.fn();
      configurator.on("signal-toggled", handler);

      configurator.setSignalEnabled(SignalSource.SYBIL, false);

      expect(handler).toHaveBeenCalledWith({
        source: SignalSource.SYBIL,
        enabled: false,
      });
    });

    it("should disable a category", () => {
      configurator.setCategoryEnabled(CompositeSignalCategory.NETWORK, false);
      expect(
        configurator.getCategoryWeight(CompositeSignalCategory.NETWORK).enabled
      ).toBe(false);
    });

    it("should emit category-toggled event", () => {
      const handler = vi.fn();
      configurator.on("category-toggled", handler);

      configurator.setCategoryEnabled(CompositeSignalCategory.NETWORK, false);

      expect(handler).toHaveBeenCalledWith({
        category: CompositeSignalCategory.NETWORK,
        enabled: false,
      });
    });
  });

  // =========================================================================
  // Apply Preset Tests
  // =========================================================================

  describe("Apply Preset", () => {
    it("should apply DEFAULT preset", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.50);
      const result = configurator.applyPreset(WeightPreset.DEFAULT);

      expect(result.isValid).toBe(true);
      expect(configurator.getCurrentPreset()).toBe(WeightPreset.DEFAULT);
      expect(configurator.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(
        COMPOSITE_DEFAULT_SIGNAL_WEIGHTS[SignalSource.WIN_RATE]
      );
    });

    it("should apply CONSERVATIVE preset (equal weights)", () => {
      configurator.applyPreset(WeightPreset.CONSERVATIVE);

      const weights = configurator.getAllSignalWeights();
      const firstWeight = weights[SignalSource.FRESH_WALLET].weight;

      for (const source of Object.values(SignalSource)) {
        expect(weights[source].weight).toBe(firstWeight);
      }
    });

    it("should apply NETWORK_FOCUSED preset", () => {
      configurator.applyPreset(WeightPreset.NETWORK_FOCUSED);

      expect(configurator.getCurrentPreset()).toBe(WeightPreset.NETWORK_FOCUSED);
      expect(configurator.getSignalWeight(SignalSource.COORDINATION).weight).toBe(0.22);
      expect(configurator.getSignalWeight(SignalSource.SYBIL).weight).toBe(0.20);
    });

    it("should apply PERFORMANCE_FOCUSED preset", () => {
      configurator.applyPreset(WeightPreset.PERFORMANCE_FOCUSED);

      expect(configurator.getCurrentPreset()).toBe(WeightPreset.PERFORMANCE_FOCUSED);
      expect(configurator.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(0.20);
      expect(configurator.getSignalWeight(SignalSource.PROFIT_LOSS).weight).toBe(0.20);
    });

    it("should apply INSIDER_DETECTION preset", () => {
      configurator.applyPreset(WeightPreset.INSIDER_DETECTION);

      expect(configurator.getCurrentPreset()).toBe(WeightPreset.INSIDER_DETECTION);
    });

    it("should emit preset-applied event", () => {
      const handler = vi.fn();
      configurator.on("preset-applied", handler);

      configurator.applyPreset(WeightPreset.CONSERVATIVE);

      expect(handler).toHaveBeenCalledWith({
        preset: WeightPreset.CONSERVATIVE,
        previousPreset: WeightPreset.DEFAULT,
      });
    });

    it("should record preset change in history", () => {
      configurator.applyPreset(WeightPreset.AGGRESSIVE);
      const history = configurator.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry?.type).toBe(WeightChangeType.PRESET_APPLIED);
    });
  });

  // =========================================================================
  // Threshold Tests
  // =========================================================================

  describe("Thresholds", () => {
    it("should set thresholds successfully", () => {
      const result = configurator.setThresholds({
        low: 15,
        medium: 35,
        high: 55,
        critical: 75,
      });

      expect(result.isValid).toBe(true);

      const config = configurator.getConfig();
      expect(config.thresholds.low).toBe(15);
      expect(config.thresholds.medium).toBe(35);
      expect(config.thresholds.high).toBe(55);
      expect(config.thresholds.critical).toBe(75);
    });

    it("should reject invalid threshold order", () => {
      const result = configurator.setThresholds({
        low: 50,
        medium: 40, // Invalid: medium < low
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("ascending order"))).toBe(true);
    });

    it("should set partial thresholds", () => {
      const originalMedium = configurator.getConfig().thresholds.medium;
      configurator.setThresholds({ low: 15 });

      const config = configurator.getConfig();
      expect(config.thresholds.low).toBe(15);
      expect(config.thresholds.medium).toBe(originalMedium);
    });

    it("should set flag and insider thresholds", () => {
      configurator.setFlagThresholds({
        flagThreshold: 45,
        insiderThreshold: 65,
      });

      const config = configurator.getConfig();
      expect(config.flagThreshold).toBe(45);
      expect(config.insiderThreshold).toBe(65);
    });

    it("should emit thresholds-changed event", () => {
      const handler = vi.fn();
      configurator.on("thresholds-changed", handler);

      configurator.setThresholds({ low: 15 });

      expect(handler).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Reset Tests
  // =========================================================================

  describe("Reset", () => {
    it("should reset to defaults", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.50);
      configurator.applyPreset(WeightPreset.AGGRESSIVE);

      const result = configurator.reset();

      expect(result.isValid).toBe(true);
      expect(configurator.getCurrentPreset()).toBe(WeightPreset.DEFAULT);
      expect(configurator.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(
        COMPOSITE_DEFAULT_SIGNAL_WEIGHTS[SignalSource.WIN_RATE]
      );
    });

    it("should emit config-reset event", () => {
      const handler = vi.fn();
      configurator.on("config-reset", handler);

      configurator.reset();

      expect(handler).toHaveBeenCalled();
    });

    it("should record reset in history", () => {
      configurator.reset();
      const history = configurator.getHistory();
      const lastEntry = history[history.length - 1];
      expect(lastEntry?.type).toBe(WeightChangeType.RESET);
    });
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("Validation", () => {
    it("should validate successfully with normalize mode", () => {
      const result = configurator.validate();
      expect(result.isValid).toBe(true);
    });

    it("should fail strict validation when weights don't sum to 1", () => {
      const strictConfigurator = new SignalWeightConfigurator({
        validationMode: WeightValidationMode.STRICT,
      });

      strictConfigurator.setSignalWeight(SignalSource.WIN_RATE, 0.50);

      const result = strictConfigurator.validate();
      expect(result.isValid).toBe(false);
    });

    it("should pass strict validation when weights sum to 1", () => {
      const strictConfigurator = new SignalWeightConfigurator({
        validationMode: WeightValidationMode.STRICT,
      });

      strictConfigurator.applyPreset(WeightPreset.CONSERVATIVE);

      const result = strictConfigurator.validate();
      expect(result.isValid).toBe(true);
    });

    it("should warn about disabled signals", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      const result = configurator.validate();

      expect(result.warnings.some((w) => w.includes("disabled"))).toBe(true);
    });

    it("should warn about zero weights", () => {
      configurator.setSignalWeight(SignalSource.TRADING_PATTERN, 0);
      const result = configurator.validate();

      expect(result.warnings.some((w) => w.includes("zero weight"))).toBe(true);
    });

    it("should provide normalized weights when applicable", () => {
      const result = configurator.validate();
      expect(result.normalizedWeights).toBeDefined();
    });

    it("should fail when all signals have zero weight (normalize mode)", () => {
      for (const source of Object.values(SignalSource)) {
        configurator.setSignalEnabled(source, false);
      }

      const result = configurator.validate();
      expect(result.isValid).toBe(false);
    });
  });

  // =========================================================================
  // Weight Impact Analysis Tests
  // =========================================================================

  describe("Weight Impact Analysis", () => {
    it("should analyze weight impact", () => {
      const analysis = configurator.analyzeWeightImpact();

      expect(analysis.mostImpactfulSignals).toBeDefined();
      expect(analysis.mostImpactfulSignals.length).toBeGreaterThan(0);
      expect(analysis.categoryImpact).toBeDefined();
      expect(analysis.balance).toBeDefined();
    });

    it("should sort most impactful signals by effective weight", () => {
      const analysis = configurator.analyzeWeightImpact();

      for (let i = 1; i < analysis.mostImpactfulSignals.length; i++) {
        const prev = analysis.mostImpactfulSignals[i - 1];
        const curr = analysis.mostImpactfulSignals[i];
        if (prev && curr) {
          expect(prev.effectiveWeight).toBeGreaterThanOrEqual(curr.effectiveWeight);
        }
      }
    });

    it("should identify disabled signals", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      const analysis = configurator.analyzeWeightImpact();

      expect(analysis.disabledSignals).toContain(SignalSource.SYBIL);
    });

    it("should assess balance correctly for conservative preset", () => {
      configurator.applyPreset(WeightPreset.CONSERVATIVE);
      const analysis = configurator.analyzeWeightImpact();

      expect(analysis.balance.assessment).toBe("balanced");
    });

    it("should detect extreme weights", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.90);
      for (const source of Object.values(SignalSource)) {
        if (source !== SignalSource.WIN_RATE) {
          configurator.setSignalWeight(source, 0.01);
        }
      }

      const analysis = configurator.analyzeWeightImpact();
      expect(analysis.balance.assessment).toBe("extreme");
    });
  });

  // =========================================================================
  // History Tests
  // =========================================================================

  describe("Change History", () => {
    it("should track history", () => {
      expect(configurator.getHistory()).toHaveLength(0);

      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.20);
      configurator.setSignalWeight(SignalSource.PROFIT_LOSS, 0.20);

      expect(configurator.getHistory()).toHaveLength(2);
    });

    it("should get recent history", () => {
      for (let i = 0; i < 10; i++) {
        configurator.setSignalWeight(SignalSource.WIN_RATE, 0.10 + i * 0.01);
      }

      const recent = configurator.getRecentHistory(3);
      expect(recent).toHaveLength(3);
    });

    it("should clear history", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.20);
      configurator.clearHistory();

      expect(configurator.getHistory()).toHaveLength(0);
    });

    it("should limit history entries", () => {
      const cfg = new SignalWeightConfigurator({
        maxHistoryEntries: 5,
      });

      for (let i = 0; i < 10; i++) {
        cfg.setSignalWeight(SignalSource.WIN_RATE, 0.10 + i * 0.01);
      }

      expect(cfg.getHistory().length).toBe(5);
    });

    it("should have correct history record structure", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25, "test-user");
      const history = configurator.getHistory();
      const record = history[0];

      expect(record).toBeDefined();
      if (record) {
        expect(record.id).toBeDefined();
        expect(record.type).toBe(WeightChangeType.SIGNAL_WEIGHT);
        expect(record.timestamp).toBeInstanceOf(Date);
        expect(record.previousValue).toBeDefined();
        expect(record.newValue).toBeDefined();
        expect(record.description).toBeDefined();
        expect(record.changedBy).toBe("test-user");
      }
    });
  });

  // =========================================================================
  // Export/Import Tests
  // =========================================================================

  describe("Export/Import", () => {
    it("should export config to JSON", () => {
      const json = configurator.exportConfig();
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(CONFIG_VERSION);
      expect(parsed.signalWeights).toBeDefined();
      expect(parsed.categoryWeights).toBeDefined();
    });

    it("should import config from JSON", () => {
      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);
      const exported = configurator.exportConfig();

      const newConfigurator = new SignalWeightConfigurator();
      const result = newConfigurator.importConfig(exported);

      expect(result.isValid).toBe(true);
      expect(newConfigurator.getSignalWeight(SignalSource.WIN_RATE).weight).toBe(0.25);
    });

    it("should fail import with invalid JSON", () => {
      const result = configurator.importConfig("not valid json");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should fail import with missing signalWeights", () => {
      const result = configurator.importConfig(JSON.stringify({ categoryWeights: {} }));
      expect(result.isValid).toBe(false);
    });

    it("should fail import with missing signals", () => {
      const partial = {
        signalWeights: {},
        categoryWeights: {},
      };
      const result = configurator.importConfig(JSON.stringify(partial));
      expect(result.isValid).toBe(false);
    });

    it("should emit config-imported event", () => {
      const handler = vi.fn();
      configurator.on("config-imported", handler);

      configurator.setSignalWeight(SignalSource.WIN_RATE, 0.25);
      const exported = configurator.exportConfig();

      const newConfigurator = new SignalWeightConfigurator();
      newConfigurator.on("config-imported", handler);
      newConfigurator.importConfig(exported);

      expect(handler).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Summary Tests
  // =========================================================================

  describe("Summary", () => {
    it("should get configurator summary", () => {
      const summary = configurator.getSummary();

      expect(summary.currentPreset).toBe(WeightPreset.DEFAULT);
      expect(summary.activeSignals).toBe(Object.keys(SignalSource).length);
      expect(summary.totalSignals).toBe(Object.keys(SignalSource).length);
      expect(summary.activeCategories).toBe(Object.keys(CompositeSignalCategory).length);
      expect(summary.totalCategories).toBe(Object.keys(CompositeSignalCategory).length);
      expect(summary.validationMode).toBe(WeightValidationMode.NORMALIZE);
      expect(summary.lastModified).toBeInstanceOf(Date);
      expect(typeof summary.historyCount).toBe("number");
    });

    it("should reflect disabled signals in summary", () => {
      configurator.setSignalEnabled(SignalSource.SYBIL, false);
      const summary = configurator.getSummary();

      expect(summary.activeSignals).toBe(Object.keys(SignalSource).length - 1);
    });
  });

  // =========================================================================
  // Config Metadata Tests
  // =========================================================================

  describe("Config Metadata", () => {
    it("should set config name", () => {
      configurator.setConfigName("My Custom Config");
      expect(configurator.getConfig().name).toBe("My Custom Config");
    });

    it("should set config description", () => {
      configurator.setConfigDescription("A custom configuration for testing");
      expect(configurator.getConfig().description).toBe(
        "A custom configuration for testing"
      );
    });

    it("should set validation mode", () => {
      configurator.setValidationMode(WeightValidationMode.STRICT);
      expect(configurator.getConfig().validationMode).toBe(WeightValidationMode.STRICT);
    });

    it("should emit validation-mode-changed event", () => {
      const handler = vi.fn();
      configurator.on("validation-mode-changed", handler);

      configurator.setValidationMode(WeightValidationMode.STRICT);

      expect(handler).toHaveBeenCalledWith({ mode: WeightValidationMode.STRICT });
    });
  });

  // =========================================================================
  // Signals by Category Tests
  // =========================================================================

  describe("Signals by Category", () => {
    it("should get signals by category", () => {
      const performanceSignals = configurator.getSignalsByCategory(
        CompositeSignalCategory.PERFORMANCE
      );

      expect(performanceSignals.length).toBeGreaterThan(0);
      expect(performanceSignals.some((s) => s.source === SignalSource.WIN_RATE)).toBe(true);
      expect(performanceSignals.some((s) => s.source === SignalSource.PROFIT_LOSS)).toBe(true);
      expect(performanceSignals.some((s) => s.source === SignalSource.ACCURACY)).toBe(true);
    });

    it("should get network category signals", () => {
      const networkSignals = configurator.getSignalsByCategory(
        CompositeSignalCategory.NETWORK
      );

      expect(networkSignals.some((s) => s.source === SignalSource.COORDINATION)).toBe(true);
      expect(networkSignals.some((s) => s.source === SignalSource.SYBIL)).toBe(true);
    });
  });

  // =========================================================================
  // Available Presets Tests
  // =========================================================================

  describe("Available Presets", () => {
    it("should list all available presets", () => {
      const presets = configurator.getAvailablePresets();

      expect(presets.length).toBe(Object.keys(WeightPreset).length);
      expect(presets.every((p) => p.preset && p.description)).toBe(true);
    });
  });

  // =========================================================================
  // Shared Instance Tests
  // =========================================================================

  describe("Shared Instance", () => {
    it("should get shared instance", () => {
      const shared1 = getSharedSignalWeightConfigurator();
      const shared2 = getSharedSignalWeightConfigurator();

      expect(shared1).toBe(shared2);
    });

    it("should set shared instance", () => {
      const custom = new SignalWeightConfigurator({
        initialPreset: WeightPreset.CONSERVATIVE,
      });

      setSharedSignalWeightConfigurator(custom);

      const shared = getSharedSignalWeightConfigurator();
      expect(shared.getCurrentPreset()).toBe(WeightPreset.CONSERVATIVE);
    });

    it("should reset shared instance", () => {
      const shared1 = getSharedSignalWeightConfigurator();
      resetSharedSignalWeightConfigurator();
      const shared2 = getSharedSignalWeightConfigurator();

      expect(shared1).not.toBe(shared2);
    });
  });

  // =========================================================================
  // Factory Functions Tests
  // =========================================================================

  describe("Factory Functions", () => {
    it("should create configurator with factory", () => {
      const cfg = createSignalWeightConfigurator({
        initialPreset: WeightPreset.AGGRESSIVE,
      });

      expect(cfg).toBeInstanceOf(SignalWeightConfigurator);
      expect(cfg.getCurrentPreset()).toBe(WeightPreset.AGGRESSIVE);
    });

    it("should create configurator with preset factory", () => {
      const cfg = createConfiguratorWithPreset(WeightPreset.INSIDER_DETECTION);

      expect(cfg).toBeInstanceOf(SignalWeightConfigurator);
      expect(cfg.getCurrentPreset()).toBe(WeightPreset.INSIDER_DETECTION);
    });
  });

  // =========================================================================
  // Convenience Functions Tests
  // =========================================================================

  describe("Convenience Functions", () => {
    beforeEach(() => {
      resetSharedSignalWeightConfigurator();
    });

    it("should get effective weights from shared instance", () => {
      const { signalWeights, categoryWeights } = getEffectiveWeights();
      expect(signalWeights).toBeDefined();
      expect(categoryWeights).toBeDefined();
    });

    it("should set signal weight on shared instance", () => {
      const result = setSignalWeight(SignalSource.WIN_RATE, 0.25);
      expect(result.isValid).toBe(true);
    });

    it("should set category weight on shared instance", () => {
      const result = setCategoryWeight(CompositeSignalCategory.PERFORMANCE, 0.40);
      expect(result.isValid).toBe(true);
    });

    it("should apply preset on shared instance", () => {
      const result = applyWeightPreset(WeightPreset.CONSERVATIVE);
      expect(result.isValid).toBe(true);
      expect(getSharedSignalWeightConfigurator().getCurrentPreset()).toBe(
        WeightPreset.CONSERVATIVE
      );
    });

    it("should validate weights on shared instance", () => {
      const result = validateWeights();
      expect(result.isValid).toBe(true);
    });

    it("should analyze weight impact on shared instance", () => {
      const analysis = analyzeWeightImpact();
      expect(analysis.mostImpactfulSignals).toBeDefined();
    });

    it("should reset weights on shared instance", () => {
      applyWeightPreset(WeightPreset.AGGRESSIVE);
      resetWeightsToDefaults();
      expect(getSharedSignalWeightConfigurator().getCurrentPreset()).toBe(
        WeightPreset.DEFAULT
      );
    });

    it("should export weights config from shared instance", () => {
      const json = exportWeightsConfig();
      expect(typeof json).toBe("string");
      expect(JSON.parse(json).signalWeights).toBeDefined();
    });

    it("should import weights config on shared instance", () => {
      setSignalWeight(SignalSource.WIN_RATE, 0.30);
      const json = exportWeightsConfig();

      resetSharedSignalWeightConfigurator();
      importWeightsConfig(json);

      expect(
        getSharedSignalWeightConfigurator().getSignalWeight(SignalSource.WIN_RATE).weight
      ).toBe(0.30);
    });

    it("should get summary from shared instance", () => {
      const summary = getConfiguratorSummary();
      expect(summary.currentPreset).toBeDefined();
    });
  });

  // =========================================================================
  // Description Helper Functions Tests
  // =========================================================================

  describe("Description Helper Functions", () => {
    it("should get preset description", () => {
      const desc = getPresetDescription(WeightPreset.CONSERVATIVE);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should return unknown for invalid preset", () => {
      const desc = getPresetDescription("INVALID" as WeightPreset);
      expect(desc).toBe("Unknown preset");
    });

    it("should get signal description", () => {
      const desc = getSignalDescription(SignalSource.WIN_RATE);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should return unknown for invalid signal", () => {
      const desc = getSignalDescription("INVALID" as SignalSource);
      expect(desc).toBe("Unknown signal");
    });

    it("should get category description", () => {
      const desc = getCategoryDescription(CompositeSignalCategory.PERFORMANCE);
      expect(typeof desc).toBe("string");
      expect(desc.length).toBeGreaterThan(0);
    });

    it("should return unknown for invalid category", () => {
      const desc = getCategoryDescription("INVALID" as CompositeSignalCategory);
      expect(desc).toBe("Unknown category");
    });

    it("should get validation mode description", () => {
      expect(getValidationModeDescription(WeightValidationMode.STRICT)).toContain(
        "exactly"
      );
      expect(getValidationModeDescription(WeightValidationMode.NORMALIZE)).toContain(
        "normalized"
      );
      expect(getValidationModeDescription(WeightValidationMode.NONE)).toContain(
        "No validation"
      );
    });

    it("should return unknown for invalid validation mode", () => {
      const desc = getValidationModeDescription("INVALID" as WeightValidationMode);
      expect(desc).toBe("Unknown validation mode");
    });
  });

  // =========================================================================
  // Edge Cases Tests
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle setting same weight value", () => {
      const originalWeight = configurator.getSignalWeight(SignalSource.WIN_RATE).weight;
      const result = configurator.setSignalWeight(SignalSource.WIN_RATE, originalWeight);

      expect(result.isValid).toBe(true);
    });

    it("should handle zero weight for all but one signal", () => {
      for (const source of Object.values(SignalSource)) {
        configurator.setSignalWeight(source, source === SignalSource.WIN_RATE ? 1.0 : 0);
      }

      const { signalWeights } = configurator.getEffectiveWeights();
      expect(signalWeights[SignalSource.WIN_RATE]).toBeCloseTo(1.0, 4);
    });

    it("should handle rapidly changing weights", () => {
      for (let i = 0; i < 100; i++) {
        configurator.setSignalWeight(SignalSource.WIN_RATE, Math.random());
      }

      const validation = configurator.validate();
      expect(validation.isValid).toBe(true);
    });

    it("should handle applying same preset multiple times", () => {
      configurator.applyPreset(WeightPreset.CONSERVATIVE);
      configurator.applyPreset(WeightPreset.CONSERVATIVE);
      configurator.applyPreset(WeightPreset.CONSERVATIVE);

      expect(configurator.getCurrentPreset()).toBe(WeightPreset.CONSERVATIVE);
    });

    it("should handle very small weights", () => {
      const result = configurator.setSignalWeight(SignalSource.WIN_RATE, 0.000001);
      expect(result.isValid).toBe(true);
    });

    it("should handle weight at exact boundaries", () => {
      expect(configurator.setSignalWeight(SignalSource.WIN_RATE, 0).isValid).toBe(true);
      expect(configurator.setSignalWeight(SignalSource.WIN_RATE, 1).isValid).toBe(true);
    });
  });

  // =========================================================================
  // Preset Weight Sum Verification Tests
  // =========================================================================

  describe("Preset Weight Sum Verification", () => {
    it("should have signal weights summing to 1.0 for all presets", () => {
      for (const presetData of Object.values(WEIGHT_PRESETS)) {
        const sum = Object.values(presetData.signalWeights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 4);
      }
    });

    it("should have category weights summing to 1.0 for all presets", () => {
      for (const presetData of Object.values(WEIGHT_PRESETS)) {
        const sum = Object.values(presetData.categoryWeights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 4);
      }
    });
  });
});
