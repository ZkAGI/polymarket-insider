/**
 * Geopolitical Event Market Tagger Tests (DET-NICHE-003)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
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
  getRelatedGeopoliticalMarkets,
  linkRelatedGeopoliticalMarkets,
  getGeopoliticalTaggerSummary,
  GeopoliticalRegion,
  GeopoliticalEventType,
  GeopoliticalActor,
  TagConfidence,
  DEFAULT_GEOPOLITICAL_KEYWORDS,
  DEFAULT_GEOPOLITICAL_SITUATIONS,
  type MarketForGeopoliticalTagging,
  type GeopoliticalKeyword,
  type GeopoliticalSituation,
} from "../../src/detection/geopolitical-event-tagger";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestMarket(
  id: string,
  question: string,
  description?: string,
  slug?: string,
  tags?: string[]
): MarketForGeopoliticalTagging {
  return {
    id,
    question,
    description,
    slug,
    tags,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("GeopoliticalEventTagger", () => {
  let tagger: GeopoliticalEventTagger;

  beforeEach(() => {
    tagger = createGeopoliticalEventTagger({
      debug: false,
    });
  });

  afterEach(() => {
    tagger.clearCache();
    resetSharedGeopoliticalEventTagger();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe("constructor", () => {
    it("should create tagger with default config", () => {
      const defaultTagger = createGeopoliticalEventTagger();
      const keywords = defaultTagger.getKeywords();

      expect(keywords.length).toBe(DEFAULT_GEOPOLITICAL_KEYWORDS.length);
      expect(keywords.length).toBeGreaterThan(0);
    });

    it("should create tagger with custom config", () => {
      const customTagger = createGeopoliticalEventTagger({
        cacheTtlMs: 60000,
        maxCacheSize: 100,
        minGeopoliticalScore: 20,
        debug: true,
      });

      expect(customTagger).toBeDefined();
      expect(customTagger.getCacheSize()).toBe(0);
    });

    it("should accept additional keywords", () => {
      const additionalKeywords: GeopoliticalKeyword[] = [
        {
          keyword: "custom-keyword",
          weight: 15,
          triggers: { regions: [GeopoliticalRegion.GLOBAL] },
        },
      ];

      const customTagger = createGeopoliticalEventTagger({
        additionalKeywords,
      });

      const keywords = customTagger.getKeywords();
      expect(keywords.length).toBe(DEFAULT_GEOPOLITICAL_KEYWORDS.length + 1);
      expect(keywords.some((k) => k.keyword === "custom-keyword")).toBe(true);
    });

    it("should accept additional situations", () => {
      const additionalSituations: GeopoliticalSituation[] = [
        {
          id: "custom-situation",
          name: "Custom Situation",
          description: "A custom geopolitical situation",
          regions: [GeopoliticalRegion.GLOBAL],
          actors: [GeopoliticalActor.UNITED_NATIONS],
          eventTypes: [GeopoliticalEventType.DIPLOMACY],
          identifyingKeywords: ["custom-keyword"],
          isOngoing: true,
        },
      ];

      const customTagger = createGeopoliticalEventTagger({
        additionalSituations,
      });

      const situations = customTagger.getSituations();
      expect(situations.length).toBe(DEFAULT_GEOPOLITICAL_SITUATIONS.length + 1);
      expect(situations.some((s) => s.id === "custom-situation")).toBe(true);
    });
  });

  // ==========================================================================
  // Basic Tagging - War and Conflict
  // ==========================================================================

  describe("tagMarket - War and Conflict", () => {
    it("should tag Ukraine-Russia war market correctly", () => {
      const market = createTestMarket(
        "market1",
        "Will Russia withdraw from Ukraine before 2025?",
        "The ongoing conflict and ceasefire negotiations between Russia and Ukraine."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.relevanceScore).toBeGreaterThan(30);
      expect(result.primaryRegion).toBe(GeopoliticalRegion.EASTERN_EUROPE);
      expect(result.regionTags.length).toBeGreaterThan(0);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.RUSSIA)).toBe(true);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.UKRAINE)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.ARMED_CONFLICT)).toBe(true);
    });

    it("should tag Israel-Gaza conflict market correctly", () => {
      const market = createTestMarket(
        "market2",
        "Will Israel and Hamas agree to a ceasefire in Gaza?",
        "Ongoing conflict and humanitarian crisis in Gaza."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.primaryRegion).toBe(GeopoliticalRegion.MENA);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.ISRAEL)).toBe(true);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.PALESTINE)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.ARMED_CONFLICT)).toBe(true);
    });

    it("should tag generic war market", () => {
      const market = createTestMarket(
        "market3",
        "Will there be a new military invasion in 2024?",
        "Experts predict potential conflicts worldwide."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.eventTypeTags.some((t) =>
        t.value === GeopoliticalEventType.ARMED_CONFLICT ||
        t.value === GeopoliticalEventType.MILITARY_ACTIVITY
      )).toBe(true);
    });
  });

  // ==========================================================================
  // Basic Tagging - Taiwan and China
  // ==========================================================================

  describe("tagMarket - Taiwan and China", () => {
    it("should tag China-Taiwan tensions market correctly", () => {
      const market = createTestMarket(
        "market4",
        "Will China invade Taiwan before 2026?",
        "Cross-strait tensions between Beijing and Taipei escalate."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.primaryRegion).toBe(GeopoliticalRegion.EAST_ASIA);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.CHINA)).toBe(true);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.TAIWAN)).toBe(true);
      expect(result.eventTypeTags.some((t) =>
        t.value === GeopoliticalEventType.TERRITORIAL_DISPUTE ||
        t.value === GeopoliticalEventType.ARMED_CONFLICT
      )).toBe(true);
    });

    it("should tag Taiwan strait military exercise market", () => {
      const market = createTestMarket(
        "market5",
        "Will China conduct military exercises near the Taiwan Strait in Q2 2024?"
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.MILITARY_ACTIVITY)).toBe(true);
    });
  });

  // ==========================================================================
  // Basic Tagging - Nuclear
  // ==========================================================================

  describe("tagMarket - Nuclear", () => {
    it("should tag North Korea nuclear market correctly", () => {
      const market = createTestMarket(
        "market6",
        "Will North Korea conduct another nuclear test in 2024?",
        "Kim Jong Un's regime continues to develop ICBM capabilities."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.primaryRegion).toBe(GeopoliticalRegion.EAST_ASIA);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.NORTH_KOREA)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.NUCLEAR_WMD)).toBe(true);
    });

    it("should tag Iran nuclear deal market correctly", () => {
      const market = createTestMarket(
        "market7",
        "Will Iran and the US reach a new nuclear deal?",
        "Tehran continues uranium enrichment despite sanctions."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.primaryRegion).toBe(GeopoliticalRegion.MENA);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.IRAN)).toBe(true);
      expect(result.eventTypeTags.some((t) =>
        t.value === GeopoliticalEventType.NUCLEAR_WMD ||
        t.value === GeopoliticalEventType.DIPLOMACY
      )).toBe(true);
    });
  });

  // ==========================================================================
  // Basic Tagging - Sanctions
  // ==========================================================================

  describe("tagMarket - Sanctions", () => {
    it("should tag sanctions market correctly", () => {
      const market = createTestMarket(
        "market8",
        "Will the EU impose new sanctions on Russia in 2024?",
        "Economic sanctions targeting Russian oligarchs and banks."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.SANCTIONS)).toBe(true);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.RUSSIA)).toBe(true);
    });

    it("should tag trade war market correctly", () => {
      const market = createTestMarket(
        "market9",
        "Will the US impose new tariffs on China?",
        "Trade war between the two economic superpowers continues."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.TRADE_CONFLICT)).toBe(true);
    });
  });

  // ==========================================================================
  // Basic Tagging - International Organizations
  // ==========================================================================

  describe("tagMarket - International Organizations", () => {
    it("should tag NATO market correctly", () => {
      const market = createTestMarket(
        "market10",
        "Will Sweden join NATO in 2024?",
        "Nordic expansion of the alliance continues."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.NATO)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.ALLIANCE_DYNAMICS)).toBe(true);
    });

    it("should tag UN Security Council market correctly", () => {
      const market = createTestMarket(
        "market11",
        "Will the UN Security Council pass new resolutions on Gaza?",
        "International efforts to address humanitarian crisis."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.UNITED_NATIONS)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.INTERNATIONAL_ORG)).toBe(true);
    });

    it("should tag BRICS market correctly", () => {
      const market = createTestMarket(
        "market12",
        "Will more countries join BRICS alliance in 2025?",
        "International organization expansion in global diplomacy."
      );

      const result = tagger.tagMarket(market);

      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.BRICS)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.INTERNATIONAL_ORG)).toBe(true);
    });

    it("should tag OPEC market correctly", () => {
      const market = createTestMarket(
        "market13",
        "Will OPEC cut oil production and create an energy crisis in Q1 2025?",
        "Oil embargo discussions among major oil producing nations."
      );

      const result = tagger.tagMarket(market);

      expect(result.actorTags.some((t) => t.value === GeopoliticalActor.OPEC)).toBe(true);
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.ENERGY_RESOURCES)).toBe(true);
    });
  });

  // ==========================================================================
  // Non-Geopolitical Markets
  // ==========================================================================

  describe("tagMarket - Non-Geopolitical", () => {
    it("should not tag sports market as geopolitical", () => {
      const market = createTestMarket(
        "market14",
        "Will the Kansas City Chiefs win Super Bowl LVIII?",
        "NFL championship game prediction."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(false);
      expect(result.relevanceScore).toBeLessThan(15);
    });

    it("should not tag crypto market as geopolitical", () => {
      const market = createTestMarket(
        "market15",
        "Will Bitcoin reach $100,000 by end of 2024?",
        "BTC price prediction for the cryptocurrency market."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(false);
    });

    it("should not tag entertainment market as geopolitical", () => {
      const market = createTestMarket(
        "market16",
        "Will Barbie win Best Picture at the Oscars?",
        "Academy Awards prediction for the Greta Gerwig film."
      );

      const result = tagger.tagMarket(market);

      // Entertainment markets should have very low relevance scores
      expect(result.relevanceScore).toBeLessThan(20);
    });
  });

  // ==========================================================================
  // Situation Assignment
  // ==========================================================================

  describe("situation assignment", () => {
    it("should assign Russia-Ukraine war situation", () => {
      const market = createTestMarket(
        "market17",
        "Will Zelensky announce a major counteroffensive?",
        "Ukraine prepares for new military operations against Russian forces."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.situationId).toBe("russia-ukraine-war");
    });

    it("should assign Israel-Hamas conflict situation", () => {
      const market = createTestMarket(
        "market18",
        "Will Netanyahu agree to a ceasefire in Gaza?",
        "IDF operations continue in the Gaza Strip."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.situationId).toBe("israel-hamas-conflict");
    });

    it("should assign China-Taiwan tensions situation", () => {
      const market = createTestMarket(
        "market19",
        "Will Taiwan hold military exercises near Taiwan Strait?",
        "Taipei responds to Chinese military pressure."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.situationId).toBe("china-taiwan-tensions");
    });

    it("should assign North Korea nuclear situation", () => {
      const market = createTestMarket(
        "market20",
        "Will Kim Jong Un meet with US officials in 2024?",
        "Denuclearization talks may resume with DPRK."
      );

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.situationId).toBe("north-korea-nuclear");
    });
  });

  // ==========================================================================
  // Related Markets
  // ==========================================================================

  describe("related markets", () => {
    it("should link markets with same situation", () => {
      const market1 = createTestMarket(
        "market21",
        "Will Ukraine retake Crimea in 2024?"
      );
      const market2 = createTestMarket(
        "market22",
        "Will Russia mobilize more troops for Ukraine?"
      );

      const result1 = tagger.tagMarket(market1);
      const result2 = tagger.tagMarket(market2);

      expect(result1.situationId).toBe("russia-ukraine-war");
      expect(result2.situationId).toBe("russia-ukraine-war");

      // Re-tag to get updated related markets
      const result1Updated = tagger.tagMarket(market1, { bypassCache: true });
      expect(result1Updated.relatedMarketIds).toContain("market22");
    });

    it("should get related markets for a market ID", () => {
      const market1 = createTestMarket(
        "market23",
        "Will NATO send troops to Ukraine?"
      );
      const market2 = createTestMarket(
        "market24",
        "Will Russia launch a new offensive in Donbas?"
      );

      tagger.tagMarket(market1);
      tagger.tagMarket(market2);

      const related = tagger.getRelatedMarkets("market23");
      expect(related).toContain("market24");
    });

    it("should link markets manually", () => {
      const market1 = createTestMarket(
        "market25",
        "Custom geopolitical market 1"
      );
      const market2 = createTestMarket(
        "market26",
        "Custom geopolitical market 2"
      );

      tagger.tagMarket(market1);
      tagger.tagMarket(market2);

      tagger.linkRelatedMarkets("market25", "market26");

      const related = tagger.getRelatedMarkets("market25");
      expect(related).toContain("market26");
    });
  });

  // ==========================================================================
  // Batch Tagging
  // ==========================================================================

  describe("tagMarkets", () => {
    it("should tag multiple markets in batch", () => {
      const markets = [
        createTestMarket("batch1", "Will Russia withdraw from Ukraine?"),
        createTestMarket("batch2", "Will China invade Taiwan?"),
        createTestMarket("batch3", "Will Bitcoin reach $100,000?"),
        createTestMarket("batch4", "Will Iran test a nuclear weapon?"),
      ];

      const result = tagger.tagMarkets(markets);

      expect(result.totalProcessed).toBe(4);
      expect(result.geopoliticalCount).toBe(3); // Ukraine, Taiwan, Iran
      expect(result.errors.size).toBe(0);
      expect(result.results.size).toBe(4);
    });

    it("should include distributions in batch result", () => {
      const markets = [
        createTestMarket("batch5", "Will Russia expand sanctions evasion?"),
        createTestMarket("batch6", "Will NATO deploy troops to Poland?"),
        createTestMarket("batch7", "Will Israel and Hamas reach a ceasefire?"),
      ];

      const result = tagger.tagMarkets(markets);

      expect(result.regionDistribution.size).toBeGreaterThan(0);
      expect(result.eventTypeDistribution.size).toBeGreaterThan(0);
      expect(result.actorDistribution.size).toBeGreaterThan(0);
    });

    it("should track processing time", () => {
      const markets = [
        createTestMarket("batch8", "Will Ukraine join the EU?"),
        createTestMarket("batch9", "Will China conduct military exercises?"),
      ];

      const result = tagger.tagMarkets(markets);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Filter by Region
  // ==========================================================================

  describe("getMarketsByRegion", () => {
    it("should filter markets by region", () => {
      const markets = [
        createTestMarket("region1", "Will Russia attack Ukraine again?"),
        createTestMarket("region2", "Will China invade Taiwan?"),
        createTestMarket("region3", "Will Iran develop nuclear weapons?"),
        createTestMarket("region4", "Will North Korea launch missiles?"),
      ];

      const eastAsiaMarkets = tagger.getMarketsByRegion(markets, GeopoliticalRegion.EAST_ASIA);
      expect(eastAsiaMarkets.length).toBe(2); // Taiwan, North Korea

      const menaMarkets = tagger.getMarketsByRegion(markets, GeopoliticalRegion.MENA);
      expect(menaMarkets.length).toBe(1); // Iran
    });

    it("should sort by relevance score", () => {
      const markets = [
        createTestMarket("region5", "Will tensions in East Asia rise?"),
        createTestMarket("region6", "Will China conduct military exercises near Taiwan and threaten invasion?"),
      ];

      const results = tagger.getMarketsByRegion(markets, GeopoliticalRegion.EAST_ASIA);

      if (results.length >= 2) {
        expect(results[0]!.relevanceScore).toBeGreaterThanOrEqual(results[1]!.relevanceScore);
      }
    });
  });

  // ==========================================================================
  // Filter by Event Type
  // ==========================================================================

  describe("getMarketsByEventType", () => {
    it("should filter markets by event type", () => {
      const markets = [
        createTestMarket("event1", "Will there be a ceasefire in Ukraine?"),
        createTestMarket("event2", "Will the EU impose new sanctions on Russia?"),
        createTestMarket("event3", "Will there be peace talks between Israel and Hamas?"),
      ];

      const conflictMarkets = tagger.getMarketsByEventType(
        markets,
        GeopoliticalEventType.ARMED_CONFLICT
      );
      expect(conflictMarkets.length).toBeGreaterThan(0);

      const sanctionsMarkets = tagger.getMarketsByEventType(
        markets,
        GeopoliticalEventType.SANCTIONS
      );
      expect(sanctionsMarkets.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Filter by Actor
  // ==========================================================================

  describe("getMarketsByActor", () => {
    it("should filter markets by actor", () => {
      const markets = [
        createTestMarket("actor1", "Will Putin survive 2024?"),
        createTestMarket("actor2", "Will Xi Jinping visit the US?"),
        createTestMarket("actor3", "Will NATO expand further?"),
      ];

      const russiaMarkets = tagger.getMarketsByActor(markets, GeopoliticalActor.RUSSIA);
      expect(russiaMarkets.length).toBe(1);
      expect(russiaMarkets[0]!.marketId).toBe("actor1");

      const chinaMarkets = tagger.getMarketsByActor(markets, GeopoliticalActor.CHINA);
      expect(chinaMarkets.length).toBe(1);
      expect(chinaMarkets[0]!.marketId).toBe("actor2");

      const natoMarkets = tagger.getMarketsByActor(markets, GeopoliticalActor.NATO);
      expect(natoMarkets.length).toBe(1);
      expect(natoMarkets[0]!.marketId).toBe("actor3");
    });
  });

  // ==========================================================================
  // Filter by Situation
  // ==========================================================================

  describe("getMarketsBySituation", () => {
    it("should filter markets by situation", () => {
      const markets = [
        createTestMarket("sit1", "Will Ukraine launch a new counteroffensive?"),
        createTestMarket("sit2", "Will Russia mobilize more troops?"),
        createTestMarket("sit3", "Will China blockade Taiwan?"),
      ];

      const ukraineMarkets = tagger.getMarketsBySituation(markets, "russia-ukraine-war");
      expect(ukraineMarkets.length).toBe(2);

      const taiwanMarkets = tagger.getMarketsBySituation(markets, "china-taiwan-tensions");
      expect(taiwanMarkets.length).toBe(1);
    });
  });

  // ==========================================================================
  // Caching
  // ==========================================================================

  describe("caching", () => {
    it("should cache tagging results", () => {
      const market = createTestMarket(
        "cache1",
        "Will Russia withdraw from Ukraine?"
      );

      const result1 = tagger.tagMarket(market);
      expect(result1.fromCache).toBe(false);

      const result2 = tagger.tagMarket(market);
      expect(result2.fromCache).toBe(true);
    });

    it("should bypass cache when requested", () => {
      const market = createTestMarket(
        "cache2",
        "Will China invade Taiwan?"
      );

      const result1 = tagger.tagMarket(market);
      expect(result1.fromCache).toBe(false);

      const result2 = tagger.tagMarket(market, { bypassCache: true });
      expect(result2.fromCache).toBe(false);
    });

    it("should clear cache", () => {
      const market = createTestMarket(
        "cache3",
        "Will there be peace in the Middle East?"
      );

      tagger.tagMarket(market);
      expect(tagger.getCacheSize()).toBe(1);

      tagger.clearCache();
      expect(tagger.getCacheSize()).toBe(0);
    });
  });

  // ==========================================================================
  // Tag Confidence
  // ==========================================================================

  describe("tag confidence", () => {
    it("should assign high confidence for explicit mentions", () => {
      const market = createTestMarket(
        "conf1",
        "Will Russia's invasion of Ukraine end in 2024?",
        "Putin's war against Ukraine continues with ceasefire negotiations."
      );

      const result = tagger.tagMarket(market);

      const russiaTag = result.actorTags.find((t) => t.value === GeopoliticalActor.RUSSIA);
      expect(russiaTag).toBeDefined();
      // Multiple Russia keywords (russia, putin, russian) give high confidence
      expect([TagConfidence.HIGH, TagConfidence.VERY_HIGH]).toContain(russiaTag!.confidence);
    });

    it("should include trigger keywords in tags", () => {
      const market = createTestMarket(
        "conf2",
        "Will NATO expand to include Ukraine?"
      );

      const result = tagger.tagMarket(market);

      const natoTag = result.actorTags.find((t) => t.value === GeopoliticalActor.NATO);
      expect(natoTag).toBeDefined();
      expect(natoTag!.triggerKeywords).toContain("nato");
    });
  });

  // ==========================================================================
  // Singleton Management
  // ==========================================================================

  describe("singleton management", () => {
    it("should return shared instance", () => {
      const instance1 = getSharedGeopoliticalEventTagger();
      const instance2 = getSharedGeopoliticalEventTagger();

      expect(instance1).toBe(instance2);
    });

    it("should allow setting shared instance", () => {
      const customTagger = createGeopoliticalEventTagger({ debug: false });
      setSharedGeopoliticalEventTagger(customTagger);

      const sharedInstance = getSharedGeopoliticalEventTagger();
      expect(sharedInstance).toBe(customTagger);
    });

    it("should reset shared instance", () => {
      const instance1 = getSharedGeopoliticalEventTagger();
      resetSharedGeopoliticalEventTagger();
      const instance2 = getSharedGeopoliticalEventTagger();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedGeopoliticalEventTagger();
    });

    it("tagMarket should use shared instance", () => {
      const market = createTestMarket(
        "conv1",
        "Will Russia invade Ukraine again?"
      );

      const result = tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
      expect(result.marketId).toBe("conv1");
    });

    it("tagMarkets should use shared instance", () => {
      const markets = [
        createTestMarket("conv2", "Will China blockade Taiwan?"),
        createTestMarket("conv3", "Will Bitcoin reach $200,000?"),
      ];

      const result = tagMarkets(markets);

      expect(result.totalProcessed).toBe(2);
      expect(result.geopoliticalCount).toBe(1);
    });

    it("isGeopoliticalMarket should use shared instance", () => {
      const geoMarket = createTestMarket("conv4", "Will Russia withdraw from Ukraine?");
      const nonGeoMarket = createTestMarket("conv5", "Will Bitcoin reach $100,000?");

      expect(isGeopoliticalMarket(geoMarket)).toBe(true);
      expect(isGeopoliticalMarket(nonGeoMarket)).toBe(false);
    });

    it("getGeopoliticalMarketsByRegion should use shared instance", () => {
      const markets = [
        createTestMarket("conv6", "Will China invade Taiwan?"),
        createTestMarket("conv7", "Will Russia attack NATO?"),
      ];

      const eastAsiaMarkets = getGeopoliticalMarketsByRegion(markets, GeopoliticalRegion.EAST_ASIA);
      expect(eastAsiaMarkets.length).toBe(1);
    });

    it("getGeopoliticalMarketsByEventType should use shared instance", () => {
      const markets = [
        createTestMarket("conv8", "Will the EU impose new sanctions?"),
        createTestMarket("conv9", "Will there be a nuclear test?"),
      ];

      const sanctionsMarkets = getGeopoliticalMarketsByEventType(
        markets,
        GeopoliticalEventType.SANCTIONS
      );
      expect(sanctionsMarkets.length).toBeGreaterThanOrEqual(1);
    });

    it("getGeopoliticalMarketsByActor should use shared instance", () => {
      const markets = [
        createTestMarket("conv10", "Will Putin survive 2025?"),
        createTestMarket("conv11", "Will Xi visit the US?"),
      ];

      const russiaMarkets = getGeopoliticalMarketsByActor(markets, GeopoliticalActor.RUSSIA);
      expect(russiaMarkets.length).toBe(1);
    });

    it("getRelatedGeopoliticalMarkets should use shared instance", () => {
      const market1 = createTestMarket("conv12", "Will Ukraine retake Crimea?");
      const market2 = createTestMarket("conv13", "Will Russia mobilize troops?");

      tagMarket(market1);
      tagMarket(market2);

      const related = getRelatedGeopoliticalMarkets("conv12");
      expect(related).toContain("conv13");
    });

    it("linkRelatedGeopoliticalMarkets should use shared instance", () => {
      tagMarket(createTestMarket("conv14", "Custom market 1"));
      tagMarket(createTestMarket("conv15", "Custom market 2"));

      linkRelatedGeopoliticalMarkets("conv14", "conv15");

      const related = getRelatedGeopoliticalMarkets("conv14");
      expect(related).toContain("conv15");
    });

    it("getGeopoliticalTaggerSummary should use shared instance", () => {
      tagMarket(createTestMarket("conv16", "Will Russia withdraw from Ukraine?"));
      tagMarket(createTestMarket("conv17", "Will Bitcoin reach $100,000?"));

      const summary = getGeopoliticalTaggerSummary();

      expect(summary.totalTagged).toBe(2);
      expect(summary.geopoliticalMarketsCount).toBe(1);
    });
  });

  // ==========================================================================
  // Summary Statistics
  // ==========================================================================

  describe("getSummary", () => {
    it("should return correct summary statistics", () => {
      const markets = [
        createTestMarket("sum1", "Will Russia withdraw from Ukraine?"),
        createTestMarket("sum2", "Will China invade Taiwan?"),
        createTestMarket("sum3", "Will Bitcoin reach $100,000?"),
      ];

      tagger.tagMarkets(markets);

      const summary = tagger.getSummary();

      expect(summary.totalTagged).toBe(3);
      expect(summary.geopoliticalMarketsCount).toBe(2);
      expect(summary.geopoliticalPercentage).toBeCloseTo(66.7, 0);
      expect(summary.regionBreakdown.size).toBeGreaterThan(0);
      expect(summary.averageRelevanceScore).toBeGreaterThan(0);
    });

    it("should track cache hit rate", () => {
      const market = createTestMarket(
        "sum4",
        "Will Russia mobilize more troops?"
      );

      // First call - cache miss
      tagger.tagMarket(market);

      // Second call - cache hit
      tagger.tagMarket(market);

      const summary = tagger.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty question", () => {
      const market = createTestMarket("edge1", "");

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(false);
      expect(result.allTags.length).toBe(0);
    });

    it("should handle market with only slug", () => {
      const market: MarketForGeopoliticalTagging = {
        id: "edge2",
        question: "Generic question",
        slug: "russia-ukraine-war-ceasefire",
      };

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
    });

    it("should handle market with only tags", () => {
      const market: MarketForGeopoliticalTagging = {
        id: "edge3",
        question: "Generic question",
        tags: ["russia", "ukraine", "war", "conflict"],
      };

      const result = tagger.tagMarket(market);

      expect(result.isGeopolitical).toBe(true);
    });

    it("should handle excluded keywords", () => {
      const market = createTestMarket(
        "edge4",
        "Will Star Wars movies dominate the box office?"
      );

      const result = tagger.tagMarket(market);

      // "war" should be excluded because of "star wars"
      expect(result.eventTypeTags.some((t) => t.value === GeopoliticalEventType.ARMED_CONFLICT)).toBe(false);
    });

    it("should handle custom minimum relevance score", () => {
      const market = createTestMarket(
        "edge5",
        "Will there be minor border tensions?"
      );

      const resultDefault = tagger.tagMarket(market);
      const resultHighThreshold = tagger.tagMarket(market, { minRelevanceScore: 50 });

      // With high threshold, may not qualify as geopolitical
      if (resultDefault.relevanceScore < 50) {
        expect(resultHighThreshold.isGeopolitical).toBe(false);
      }
    });
  });

  // ==========================================================================
  // Situation and Keyword Management
  // ==========================================================================

  describe("situation and keyword management", () => {
    it("should get all situations", () => {
      const situations = tagger.getSituations();

      expect(situations.length).toBe(DEFAULT_GEOPOLITICAL_SITUATIONS.length);
      expect(situations.some((s) => s.id === "russia-ukraine-war")).toBe(true);
      expect(situations.some((s) => s.id === "israel-hamas-conflict")).toBe(true);
    });

    it("should get situation by ID", () => {
      const situation = tagger.getSituation("russia-ukraine-war");

      expect(situation).toBeDefined();
      expect(situation!.name).toBe("Russia-Ukraine War");
      expect(situation!.isOngoing).toBe(true);
    });

    it("should return null for unknown situation", () => {
      const situation = tagger.getSituation("unknown-situation");

      expect(situation).toBeNull();
    });

    it("should get all keywords", () => {
      const keywords = tagger.getKeywords();

      expect(keywords.length).toBe(DEFAULT_GEOPOLITICAL_KEYWORDS.length);
      expect(keywords.some((k) => k.keyword === "ukraine")).toBe(true);
      expect(keywords.some((k) => k.keyword === "russia")).toBe(true);
    });
  });
});
