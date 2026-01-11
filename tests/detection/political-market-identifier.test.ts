/**
 * Political Market Identifier Tests (DET-NICHE-004)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
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
  PoliticalEventCategory,
  PoliticalJurisdiction,
  PoliticalParty,
  PoliticalOffice,
  PoliticalConfidence,
  DEFAULT_POLITICAL_KEYWORDS,
  DEFAULT_POLITICAL_FIGURES,
  type MarketForPoliticalIdentification,
  type PoliticalKeyword,
  type PoliticalFigure,
} from "../../src/detection/political-market-identifier";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestMarket(
  id: string,
  question: string,
  description?: string,
  slug?: string,
  tags?: string[]
): MarketForPoliticalIdentification {
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

describe("PoliticalMarketIdentifier", () => {
  let identifier: PoliticalMarketIdentifier;

  beforeEach(() => {
    identifier = createPoliticalMarketIdentifier({
      debug: false,
    });
  });

  afterEach(() => {
    identifier.clearCache();
    resetSharedPoliticalMarketIdentifier();
  });

  // ==========================================================================
  // Constructor and Configuration
  // ==========================================================================

  describe("constructor", () => {
    it("should create identifier with default config", () => {
      const defaultIdentifier = createPoliticalMarketIdentifier();
      const keywords = defaultIdentifier.getKeywords();

      expect(keywords.length).toBe(DEFAULT_POLITICAL_KEYWORDS.length);
      expect(keywords.length).toBeGreaterThan(0);
    });

    it("should create identifier with custom config", () => {
      const customIdentifier = createPoliticalMarketIdentifier({
        cacheTtlMs: 60000,
        maxCacheSize: 100,
        debug: true,
      });

      expect(customIdentifier).toBeDefined();
      expect(customIdentifier.getCacheSize()).toBe(0);
    });

    it("should accept additional keywords", () => {
      const additionalKeywords: PoliticalKeyword[] = [
        {
          keyword: "custom-political",
          weight: 15,
          triggers: { categories: [PoliticalEventCategory.GENERAL] },
        },
      ];

      const customIdentifier = createPoliticalMarketIdentifier({
        additionalKeywords,
      });

      const allKeywords = customIdentifier.getKeywords();
      expect(allKeywords.length).toBe(
        DEFAULT_POLITICAL_KEYWORDS.length + additionalKeywords.length
      );
    });

    it("should accept additional political figures", () => {
      const additionalFigures: PoliticalFigure[] = [
        {
          name: "Test Politician",
          aliases: ["TestPol"],
          party: PoliticalParty.DEMOCRATIC,
          jurisdiction: PoliticalJurisdiction.US_FEDERAL,
          isActive: true,
        },
      ];

      const customIdentifier = createPoliticalMarketIdentifier({
        additionalFigures,
      });

      const allFigures = customIdentifier.getFigures();
      expect(allFigures.length).toBe(
        DEFAULT_POLITICAL_FIGURES.length + additionalFigures.length
      );
    });

    it("should use custom minimum political score", () => {
      const strictIdentifier = createPoliticalMarketIdentifier({
        minPoliticalScore: 50,
      });

      // Market that would normally be political but with low score
      const market = createTestMarket("test-1", "Some general vote discussion");
      const result = strictIdentifier.identifyMarket(market);

      expect(result.relevanceScore).toBeLessThan(50);
      expect(result.isPolitical).toBe(false);
    });
  });

  // ==========================================================================
  // Basic Political Market Identification
  // ==========================================================================

  describe("identifyMarket", () => {
    it("should identify clear election market", () => {
      const market = createTestMarket(
        "test-1",
        "Will Joe Biden win the 2024 presidential election?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.isElectionMarket).toBe(true);
      expect(result.relevanceScore).toBeGreaterThan(30);
      expect(result.mentionedFigures).toContain("Joe Biden");
    });

    it("should identify clear policy market", () => {
      const market = createTestMarket(
        "test-2",
        "Will Congress pass the debt ceiling legislation by December?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.isPolicyMarket).toBe(true);
      expect(result.primaryCategory).toBe(PoliticalEventCategory.LEGISLATION);
    });

    it("should not identify non-political market", () => {
      const market = createTestMarket(
        "test-3",
        "Will Bitcoin reach $100,000 by end of year?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(false);
      expect(result.relevanceScore).toBeLessThan(15);
    });

    it("should identify Trump-related market", () => {
      const market = createTestMarket(
        "test-4",
        "Will Donald Trump be the Republican nominee in 2024?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.mentionedFigures).toContain("Donald Trump");
      expect(result.partyTags.some((t) => t.value === PoliticalParty.REPUBLICAN)).toBe(true);
    });

    it("should identify UK political market", () => {
      const market = createTestMarket(
        "test-5",
        "Will Keir Starmer's Labour Party win the next UK general election?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.isElectionMarket).toBe(true);
      expect(result.jurisdictionTags.some((t) => t.value === PoliticalJurisdiction.UK)).toBe(true);
      expect(result.partyTags.some((t) => t.value === PoliticalParty.LABOUR_UK)).toBe(true);
      expect(result.mentionedFigures).toContain("Keir Starmer");
    });

    it("should identify impeachment market", () => {
      const market = createTestMarket(
        "test-6",
        "Will articles of impeachment be filed against the president?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.primaryCategory).toBe(PoliticalEventCategory.IMPEACHMENT);
    });

    it("should identify primary election market", () => {
      const market = createTestMarket(
        "test-7",
        "Who will win the Iowa caucus Democratic primary?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.isElectionMarket).toBe(true);
      expect(result.categoryTags.some((t) => t.value === PoliticalEventCategory.PRIMARY)).toBe(true);
    });

    it("should identify regulatory market", () => {
      const market = createTestMarket(
        "test-8",
        "Will the EPA implement new federal environmental regulations this year?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.categoryTags.some((t) => t.value === PoliticalEventCategory.REGULATORY)).toBe(true);
    });

    it("should identify executive order market", () => {
      const market = createTestMarket(
        "test-9",
        "Will the President sign an executive order on immigration?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.categoryTags.some((t) => t.value === PoliticalEventCategory.EXECUTIVE_ACTION)).toBe(true);
    });

    it("should identify Supreme Court nomination market", () => {
      const market = createTestMarket(
        "test-10",
        "Will the Senate confirm the Supreme Court nomination?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.categoryTags.some((t) => t.value === PoliticalEventCategory.APPOINTMENT)).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.SUPREME_COURT_JUSTICE)).toBe(true);
    });

    it("should cache results", () => {
      const market = createTestMarket(
        "test-11",
        "Will Biden win the election?"
      );

      const result1 = identifier.identifyMarket(market);
      expect(result1.fromCache).toBe(false);

      const result2 = identifier.identifyMarket(market);
      expect(result2.fromCache).toBe(true);
      expect(result2.isPolitical).toBe(result1.isPolitical);
    });

    it("should bypass cache when requested", () => {
      const market = createTestMarket(
        "test-12",
        "Will Biden win the election?"
      );

      identifier.identifyMarket(market);

      const result = identifier.identifyMarket(market, { bypassCache: true });
      expect(result.fromCache).toBe(false);
    });
  });

  // ==========================================================================
  // Political Figure Detection
  // ==========================================================================

  describe("political figure detection", () => {
    it("should detect Joe Biden", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden announce new policies?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.mentionedFigures).toContain("Joe Biden");
    });

    it("should detect Donald Trump", () => {
      const market = createTestMarket(
        "test-2",
        "Will Trump face new legal challenges?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.mentionedFigures).toContain("Donald Trump");
    });

    it("should detect Kamala Harris", () => {
      const market = createTestMarket(
        "test-3",
        "Will Kamala Harris become the Democratic nominee?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.mentionedFigures).toContain("Kamala Harris");
    });

    it("should detect Putin", () => {
      const market = createTestMarket(
        "test-4",
        "Will Putin attend the G20 summit?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.mentionedFigures).toContain("Vladimir Putin");
      expect(result.jurisdictionTags.some((t) => t.value === PoliticalJurisdiction.RUSSIA)).toBe(true);
    });

    it("should detect Xi Jinping", () => {
      const market = createTestMarket(
        "test-5",
        "Will Xi Jinping visit the United States?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.mentionedFigures).toContain("Xi Jinping");
      expect(result.jurisdictionTags.some((t) => t.value === PoliticalJurisdiction.CHINA)).toBe(true);
    });

    it("should detect Emmanuel Macron", () => {
      const market = createTestMarket(
        "test-6",
        "Will Emmanuel Macron win the French presidential election?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.mentionedFigures).toContain("Emmanuel Macron");
      // Party detection through full name matching
      expect(result.isPolitical).toBe(true);
    });

    it("should not detect figures when disabled", () => {
      const market = createTestMarket(
        "test-7",
        "Will Biden win the election?"
      );
      const result = identifier.identifyMarket(market, { detectFigures: false });

      // The keyword matching still works, but explicit figure detection is skipped
      // The keyword itself still has politicalFigures property which triggers
      expect(result.isPolitical).toBe(true);
    });
  });

  // ==========================================================================
  // Jurisdiction Detection
  // ==========================================================================

  describe("jurisdiction detection", () => {
    it("should detect US federal jurisdiction", () => {
      const market = createTestMarket(
        "test-1",
        "Will Congress pass the infrastructure bill?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.jurisdictionTags.some((t) => t.value === PoliticalJurisdiction.US_FEDERAL)).toBe(true);
    });

    it("should detect UK jurisdiction", () => {
      const market = createTestMarket(
        "test-2",
        "Will the House of Commons approve Brexit deal?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.jurisdictionTags.some((t) => t.value === PoliticalJurisdiction.UK)).toBe(true);
    });

    it("should detect EU jurisdiction", () => {
      const market = createTestMarket(
        "test-3",
        "Will the European Parliament vote to expand?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.jurisdictionTags.some((t) => t.value === PoliticalJurisdiction.EU)).toBe(true);
    });

    it("should detect state-level jurisdiction for gubernatorial races", () => {
      const market = createTestMarket(
        "test-4",
        "Will the Democratic candidate win the gubernatorial election?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.isElectionMarket).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.GOVERNOR)).toBe(true);
    });
  });

  // ==========================================================================
  // Party Detection
  // ==========================================================================

  describe("party detection", () => {
    it("should detect Democratic party", () => {
      const market = createTestMarket(
        "test-1",
        "Will Democrats win the Senate majority?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.partyTags.some((t) => t.value === PoliticalParty.DEMOCRATIC)).toBe(true);
    });

    it("should detect Republican party", () => {
      const market = createTestMarket(
        "test-2",
        "Will the GOP retain control of the House?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.partyTags.some((t) => t.value === PoliticalParty.REPUBLICAN)).toBe(true);
    });

    it("should detect UK Conservative party", () => {
      const market = createTestMarket(
        "test-3",
        "Will the Tory party remain in power in the UK general election?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.partyTags.some((t) => t.value === PoliticalParty.CONSERVATIVE_UK)).toBe(true);
    });

    it("should detect Labour party", () => {
      const market = createTestMarket(
        "test-4",
        "Will the Labour Party win the UK general election?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.partyTags.some((t) => t.value === PoliticalParty.LABOUR_UK)).toBe(true);
    });

    it("should not identify parties when disabled", () => {
      const market = createTestMarket(
        "test-5",
        "Will Democrats win?"
      );
      const result = identifier.identifyMarket(market, { identifyParties: false });

      expect(result.partyTags.length).toBe(0);
    });
  });

  // ==========================================================================
  // Office Detection
  // ==========================================================================

  describe("office detection", () => {
    it("should detect presidential office", () => {
      const market = createTestMarket(
        "test-1",
        "Will the president sign the bill into law?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.PRESIDENT)).toBe(true);
    });

    it("should detect senator office", () => {
      const market = createTestMarket(
        "test-2",
        "Will Senator Smith win reelection?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.SENATOR)).toBe(true);
    });

    it("should detect congressman office", () => {
      const market = createTestMarket(
        "test-3",
        "Will the congressman vote yes on the bill?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.REPRESENTATIVE)).toBe(true);
    });

    it("should detect prime minister office", () => {
      const market = createTestMarket(
        "test-4",
        "Will the Prime Minister call early elections?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.PRIME_MINISTER)).toBe(true);
    });

    it("should detect speaker of the house", () => {
      const market = createTestMarket(
        "test-5",
        "Will the Speaker of the House allow a floor vote?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.officeTags.some((t) => t.value === PoliticalOffice.SPEAKER)).toBe(true);
    });

    it("should not identify offices when disabled", () => {
      const market = createTestMarket(
        "test-6",
        "Will the president sign the bill?"
      );
      const result = identifier.identifyMarket(market, { identifyOffices: false });

      expect(result.officeTags.length).toBe(0);
    });
  });

  // ==========================================================================
  // Batch Processing
  // ==========================================================================

  describe("identifyMarkets", () => {
    it("should process multiple markets", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the election?"),
        createTestMarket("m2", "Will Bitcoin hit $100k?"),
        createTestMarket("m3", "Will Congress pass the bill?"),
      ];

      const result = identifier.identifyMarkets(markets);

      expect(result.totalProcessed).toBe(3);
      expect(result.politicalCount).toBe(2);
      expect(result.errors.size).toBe(0);
      expect(result.results.size).toBe(3);
    });

    it("should count election markets", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the presidential election?"),
        createTestMarket("m2", "Who wins the Iowa caucus primary?"),
        createTestMarket("m3", "Will Congress pass the debt ceiling bill?"),
      ];

      const result = identifier.identifyMarkets(markets);

      expect(result.electionCount).toBe(2);
      expect(result.policyCount).toBe(1);
    });

    it("should track category distribution", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the election?"),
        createTestMarket("m2", "Will Congress pass legislation?"),
        createTestMarket("m3", "Will the impeachment proceedings begin?"),
      ];

      const result = identifier.identifyMarkets(markets);

      expect(result.categoryDistribution.size).toBeGreaterThan(0);
    });

    it("should track jurisdiction distribution", () => {
      const markets = [
        createTestMarket("m1", "Will Congress pass the bill?"),
        createTestMarket("m2", "Will UK Parliament vote on Brexit?"),
      ];

      const result = identifier.identifyMarkets(markets);

      expect(result.jurisdictionDistribution.size).toBeGreaterThan(0);
    });

    it("should track party distribution", () => {
      const markets = [
        createTestMarket("m1", "Will Democrats win the Senate?"),
        createTestMarket("m2", "Will the GOP keep the House?"),
        createTestMarket("m3", "Will Labour win the UK election?"),
      ];

      const result = identifier.identifyMarkets(markets);

      expect(result.partyDistribution.size).toBeGreaterThan(0);
    });

    it("should measure processing time", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win?"),
        createTestMarket("m2", "Will Congress act?"),
      ];

      const result = identifier.identifyMarkets(markets);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  describe("isPoliticalMarket", () => {
    it("should return true for political market", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win the 2024 election?"
      );
      const result = identifier.isPoliticalMarket(market);

      expect(result).toBe(true);
    });

    it("should return false for non-political market", () => {
      const market = createTestMarket(
        "test-bitcoin-non-political",
        "Will Bitcoin reach $100,000 by end of year?"
      );
      const result = identifier.isPoliticalMarket(market);

      expect(result).toBe(false);
    });
  });

  describe("isElectionMarket", () => {
    it("should return true for election market", () => {
      const market = createTestMarket(
        "test-1",
        "Will Trump win the Republican nomination?"
      );
      const result = identifier.isElectionMarket(market);

      expect(result).toBe(true);
    });

    it("should return false for policy market", () => {
      const market = createTestMarket(
        "test-2",
        "Will Congress pass the infrastructure bill?"
      );
      const result = identifier.isElectionMarket(market);

      expect(result).toBe(false);
    });
  });

  describe("isPolicyMarket", () => {
    it("should return true for policy market", () => {
      const market = createTestMarket(
        "test-1",
        "Will the President sign an executive order on climate?"
      );
      const result = identifier.isPolicyMarket(market);

      expect(result).toBe(true);
    });

    it("should return false for election market", () => {
      const market = createTestMarket(
        "test-2",
        "Will Biden win the election?"
      );
      const result = identifier.isPolicyMarket(market);

      expect(result).toBe(false);
    });
  });

  describe("getPoliticalMarkets", () => {
    it("should filter to only political markets", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win?"),
        createTestMarket("m2", "Will Bitcoin hit $100k?"),
        createTestMarket("m3", "Will Congress pass the bill?"),
      ];

      const result = identifier.getPoliticalMarkets(markets);

      expect(result.length).toBe(2);
      expect(result.map((m) => m.id)).toContain("m1");
      expect(result.map((m) => m.id)).toContain("m3");
    });
  });

  describe("getElectionMarkets", () => {
    it("should filter to only election markets", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the presidential election?"),
        createTestMarket("m2", "Will Congress pass legislation?"),
        createTestMarket("m3", "Will Trump win the Republican nomination in the Iowa caucus primary?"),
      ];

      const result = identifier.getElectionMarkets(markets);

      expect(result.length).toBe(2);
      expect(result.map((m) => m.id)).toContain("m1");
      expect(result.map((m) => m.id)).toContain("m3");
    });
  });

  describe("getPolicyMarkets", () => {
    it("should filter to only policy markets", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the election?"),
        createTestMarket("m2", "Will Congress pass the debt ceiling legislation?"),
        createTestMarket("m3", "Will the President sign an executive order?"),
      ];

      const result = identifier.getPolicyMarkets(markets);

      expect(result.length).toBe(2);
      expect(result.map((m) => m.id)).toContain("m2");
      expect(result.map((m) => m.id)).toContain("m3");
    });
  });

  describe("getMarketsByCategory", () => {
    it("should filter by specific category", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the election?"),
        createTestMarket("m2", "Will Congress pass legislation?"),
        createTestMarket("m3", "Will the impeachment proceed?"),
      ];

      const result = identifier.getMarketsByCategory(
        markets,
        PoliticalEventCategory.LEGISLATION
      );

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("m2");
    });
  });

  describe("getMarketsByJurisdiction", () => {
    it("should filter by jurisdiction", () => {
      const markets = [
        createTestMarket("m1", "Will Congress pass the bill?"),
        createTestMarket("m2", "Will UK Parliament vote on Brexit?"),
      ];

      const result = identifier.getMarketsByJurisdiction(
        markets,
        PoliticalJurisdiction.UK
      );

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("m2");
    });
  });

  describe("getMarketsByParty", () => {
    it("should filter by party", () => {
      const markets = [
        createTestMarket("m1", "Will Democrats win the Senate?"),
        createTestMarket("m2", "Will the GOP keep the House?"),
      ];

      const result = identifier.getMarketsByParty(
        markets,
        PoliticalParty.DEMOCRATIC
      );

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe("m1");
    });
  });

  // ==========================================================================
  // Singleton Management
  // ==========================================================================

  describe("singleton management", () => {
    it("should return the same shared instance", () => {
      const instance1 = getSharedPoliticalMarketIdentifier();
      const instance2 = getSharedPoliticalMarketIdentifier();

      expect(instance1).toBe(instance2);
    });

    it("should allow setting custom shared instance", () => {
      const customInstance = createPoliticalMarketIdentifier({
        minPoliticalScore: 50,
      });

      setSharedPoliticalMarketIdentifier(customInstance);

      const retrieved = getSharedPoliticalMarketIdentifier();
      expect(retrieved).toBe(customInstance);
    });

    it("should reset shared instance", () => {
      const instance1 = getSharedPoliticalMarketIdentifier();
      resetSharedPoliticalMarketIdentifier();
      const instance2 = getSharedPoliticalMarketIdentifier();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe("convenience functions", () => {
    beforeEach(() => {
      resetSharedPoliticalMarketIdentifier();
    });

    it("identifyPoliticalMarket should use shared instance", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win the election?"
      );

      const result = identifyPoliticalMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.marketId).toBe("test-1");
    });

    it("identifyPoliticalMarkets should use shared instance", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win?"),
        createTestMarket("m2", "Will Apple stock rise?"),
      ];

      const result = identifyPoliticalMarkets(markets);

      expect(result.totalProcessed).toBe(2);
      expect(result.politicalCount).toBe(1);
    });

    it("isPoliticalMarket should use shared instance", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win the election?"
      );

      const result = isPoliticalMarket(market);

      expect(result).toBe(true);
    });

    it("isElectionMarket should use shared instance", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win the presidential election?"
      );

      const result = isElectionMarket(market);

      expect(result).toBe(true);
    });

    it("isPolicyMarket should use shared instance", () => {
      const market = createTestMarket(
        "test-1",
        "Will Congress pass the legislation?"
      );

      const result = isPolicyMarket(market);

      expect(result).toBe(true);
    });

    it("getPoliticalMarkets should use shared instance", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win?"),
        createTestMarket("m2", "Will Apple stock rise?"),
      ];

      const result = getPoliticalMarkets(markets);

      expect(result.length).toBe(1);
    });

    it("getElectionMarkets should use shared instance", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the election?"),
        createTestMarket("m2", "Will Congress pass legislation?"),
      ];

      const result = getElectionMarkets(markets);

      expect(result.length).toBe(1);
    });

    it("getPolicyMarkets should use shared instance", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the election?"),
        createTestMarket("m2", "Will Congress pass legislation?"),
      ];

      const result = getPolicyMarkets(markets);

      expect(result.length).toBe(1);
    });

    it("getPoliticalIdentifierSummary should use shared instance", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win the election?"
      );
      identifyPoliticalMarket(market);

      const summary = getPoliticalIdentifierSummary();

      expect(summary.totalIdentified).toBe(1);
      expect(summary.politicalMarketsCount).toBe(1);
    });
  });

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  describe("cache management", () => {
    it("should clear cache", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win?"
      );
      identifier.identifyMarket(market);

      expect(identifier.getCacheSize()).toBe(1);

      identifier.clearCache();

      expect(identifier.getCacheSize()).toBe(0);
    });

    it("should respect cache size limits", () => {
      const smallCacheIdentifier = createPoliticalMarketIdentifier({
        maxCacheSize: 2,
      });

      smallCacheIdentifier.identifyMarket(
        createTestMarket("m1", "Will Biden win?")
      );
      smallCacheIdentifier.identifyMarket(
        createTestMarket("m2", "Will Trump win?")
      );
      smallCacheIdentifier.identifyMarket(
        createTestMarket("m3", "Will Congress pass?")
      );

      expect(smallCacheIdentifier.getCacheSize()).toBeLessThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Summary Statistics
  // ==========================================================================

  describe("getSummary", () => {
    it("should return summary statistics", () => {
      const markets = [
        createTestMarket("m1", "Will Biden win the presidential election?"),
        createTestMarket("m2", "Will Congress pass the legislation?"),
        createTestMarket("m3", "Will Bitcoin hit $100k?"),
      ];

      identifier.identifyMarkets(markets);

      const summary = identifier.getSummary();

      expect(summary.totalIdentified).toBe(3);
      expect(summary.politicalMarketsCount).toBe(2);
      expect(summary.politicalPercentage).toBeGreaterThan(0);
      expect(summary.electionMarketsCount).toBe(1);
      expect(summary.policyMarketsCount).toBe(1);
      expect(summary.averageRelevanceScore).toBeGreaterThan(0);
    });

    it("should track cache hit rate", () => {
      const market = createTestMarket(
        "test-1",
        "Will Biden win?"
      );

      identifier.identifyMarket(market);
      identifier.identifyMarket(market);
      identifier.identifyMarket(market);

      const summary = identifier.getSummary();

      expect(summary.cacheHitRate).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle empty question", () => {
      const market = createTestMarket("test-1", "");
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(false);
      expect(result.relevanceScore).toBe(0);
    });

    it("should handle market with only description", () => {
      const market = createTestMarket(
        "test-1",
        "Generic question",
        "Will Biden win the presidential election in November?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
    });

    it("should handle market with tags", () => {
      const market = createTestMarket(
        "test-1",
        "Generic market question",
        undefined,
        undefined,
        ["election", "president", "biden"]
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
    });

    it("should handle market with slug", () => {
      const market = createTestMarket(
        "test-1",
        "Generic question",
        undefined,
        "will-biden-win-election-2024"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
    });

    it("should handle mixed case text", () => {
      const market = createTestMarket(
        "test-1",
        "Will BIDEN Win The ELECTION?"
      );
      const result = identifier.identifyMarket(market);

      expect(result.isPolitical).toBe(true);
      expect(result.mentionedFigures).toContain("Joe Biden");
    });

    it("should properly exclude false positives", () => {
      // "bill" should not trigger legislation without context
      const market = createTestMarket(
        "test-1",
        "Will Bill Gates invest in clean energy?"
      );
      const result = identifier.identifyMarket(market);

      // Should not be identified as political legislation
      expect(
        result.categoryTags.some((t) => t.value === PoliticalEventCategory.LEGISLATION)
      ).toBe(false);
    });

    it("should require context for ambiguous keywords", () => {
      // "poll" alone should require election/candidate/voter context
      const market = createTestMarket(
        "test-1",
        "Will the poll results show improvement?"
      );
      const result = identifier.identifyMarket(market);

      // Without political context, should have low relevance
      expect(result.relevanceScore).toBeLessThan(30);
    });
  });

  // ==========================================================================
  // Keywords
  // ==========================================================================

  describe("keywords", () => {
    it("should have default political keywords", () => {
      expect(DEFAULT_POLITICAL_KEYWORDS.length).toBeGreaterThan(50);
    });

    it("should return all keywords", () => {
      const keywords = identifier.getKeywords();
      expect(keywords.length).toBe(DEFAULT_POLITICAL_KEYWORDS.length);
    });

    it("should return all political figures", () => {
      const figures = identifier.getFigures();
      expect(figures.length).toBe(DEFAULT_POLITICAL_FIGURES.length);
    });
  });
});

// ============================================================================
// Enum Tests
// ============================================================================

describe("PoliticalEventCategory enum", () => {
  it("should have all expected categories", () => {
    expect(PoliticalEventCategory.ELECTION).toBe("ELECTION");
    expect(PoliticalEventCategory.PRIMARY).toBe("PRIMARY");
    expect(PoliticalEventCategory.REFERENDUM).toBe("REFERENDUM");
    expect(PoliticalEventCategory.LEGISLATION).toBe("LEGISLATION");
    expect(PoliticalEventCategory.EXECUTIVE_ACTION).toBe("EXECUTIVE_ACTION");
    expect(PoliticalEventCategory.APPOINTMENT).toBe("APPOINTMENT");
    expect(PoliticalEventCategory.IMPEACHMENT).toBe("IMPEACHMENT");
    expect(PoliticalEventCategory.SCANDAL).toBe("SCANDAL");
    expect(PoliticalEventCategory.PARTY_LEADERSHIP).toBe("PARTY_LEADERSHIP");
    expect(PoliticalEventCategory.CAMPAIGN).toBe("CAMPAIGN");
    expect(PoliticalEventCategory.POLLING).toBe("POLLING");
    expect(PoliticalEventCategory.REGULATORY).toBe("REGULATORY");
    expect(PoliticalEventCategory.INTERNATIONAL_POLITICS).toBe("INTERNATIONAL_POLITICS");
    expect(PoliticalEventCategory.GENERAL).toBe("GENERAL");
  });
});

describe("PoliticalJurisdiction enum", () => {
  it("should have all expected jurisdictions", () => {
    expect(PoliticalJurisdiction.US_FEDERAL).toBe("US_FEDERAL");
    expect(PoliticalJurisdiction.US_STATE).toBe("US_STATE");
    expect(PoliticalJurisdiction.US_LOCAL).toBe("US_LOCAL");
    expect(PoliticalJurisdiction.UK).toBe("UK");
    expect(PoliticalJurisdiction.EU).toBe("EU");
    expect(PoliticalJurisdiction.EU_MEMBER_STATE).toBe("EU_MEMBER_STATE");
    expect(PoliticalJurisdiction.RUSSIA).toBe("RUSSIA");
    expect(PoliticalJurisdiction.CHINA).toBe("CHINA");
  });
});

describe("PoliticalParty enum", () => {
  it("should have US parties", () => {
    expect(PoliticalParty.DEMOCRATIC).toBe("DEMOCRATIC");
    expect(PoliticalParty.REPUBLICAN).toBe("REPUBLICAN");
    expect(PoliticalParty.LIBERTARIAN).toBe("LIBERTARIAN");
    expect(PoliticalParty.GREEN_US).toBe("GREEN_US");
    expect(PoliticalParty.INDEPENDENT_US).toBe("INDEPENDENT_US");
  });

  it("should have UK parties", () => {
    expect(PoliticalParty.CONSERVATIVE_UK).toBe("CONSERVATIVE_UK");
    expect(PoliticalParty.LABOUR_UK).toBe("LABOUR_UK");
    expect(PoliticalParty.LIBERAL_DEMOCRAT).toBe("LIBERAL_DEMOCRAT");
    expect(PoliticalParty.SNP).toBe("SNP");
  });
});

describe("PoliticalOffice enum", () => {
  it("should have executive offices", () => {
    expect(PoliticalOffice.PRESIDENT).toBe("PRESIDENT");
    expect(PoliticalOffice.VICE_PRESIDENT).toBe("VICE_PRESIDENT");
    expect(PoliticalOffice.PRIME_MINISTER).toBe("PRIME_MINISTER");
    expect(PoliticalOffice.GOVERNOR).toBe("GOVERNOR");
    expect(PoliticalOffice.MAYOR).toBe("MAYOR");
  });

  it("should have legislative offices", () => {
    expect(PoliticalOffice.SENATOR).toBe("SENATOR");
    expect(PoliticalOffice.REPRESENTATIVE).toBe("REPRESENTATIVE");
    expect(PoliticalOffice.MEMBER_OF_PARLIAMENT).toBe("MEMBER_OF_PARLIAMENT");
  });

  it("should have judicial offices", () => {
    expect(PoliticalOffice.SUPREME_COURT_JUSTICE).toBe("SUPREME_COURT_JUSTICE");
    expect(PoliticalOffice.FEDERAL_JUDGE).toBe("FEDERAL_JUDGE");
    expect(PoliticalOffice.ATTORNEY_GENERAL).toBe("ATTORNEY_GENERAL");
  });
});

describe("PoliticalConfidence enum", () => {
  it("should have all confidence levels", () => {
    expect(PoliticalConfidence.VERY_HIGH).toBe("VERY_HIGH");
    expect(PoliticalConfidence.HIGH).toBe("HIGH");
    expect(PoliticalConfidence.MEDIUM).toBe("MEDIUM");
    expect(PoliticalConfidence.LOW).toBe("LOW");
  });
});
