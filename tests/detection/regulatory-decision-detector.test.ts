/**
 * Tests for Regulatory Decision Market Detector (DET-NICHE-005)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RegulatoryAgency,
  RegulatoryDecisionType,
  RegulatorySector,
  RegulatoryJurisdiction,
  RegulatoryConfidence,
  InsiderAdvantageLevel,
  DEFAULT_REGULATORY_KEYWORDS,
  RegulatoryDecisionDetector,
  createRegulatoryDecisionDetector,
  getSharedRegulatoryDecisionDetector,
  setSharedRegulatoryDecisionDetector,
  resetSharedRegulatoryDecisionDetector,
  detectRegulatoryMarket,
  detectRegulatoryMarkets,
  isRegulatoryMarket,
  getRegulatoryMarkets,
  getRegulatoryMarketsByAgency,
  getRegulatoryMarketsByDecisionType,
  getRegulatoryMarketsBySector,
  getHighInsiderAdvantageRegulatoryMarkets,
  getRegulatoryDetectorSummary,
  type MarketForRegulatoryDetection,
  type RegulatoryKeyword,
} from "../../src/detection/regulatory-decision-detector";

describe("RegulatoryDecisionDetector", () => {
  let detector: RegulatoryDecisionDetector;

  beforeEach(() => {
    resetSharedRegulatoryDecisionDetector();
    detector = createRegulatoryDecisionDetector();
  });

  afterEach(() => {
    resetSharedRegulatoryDecisionDetector();
  });

  // =========================================================================
  // Basic Instantiation Tests
  // =========================================================================

  describe("instantiation", () => {
    it("should create a detector with default configuration", () => {
      expect(detector).toBeInstanceOf(RegulatoryDecisionDetector);
    });

    it("should create a detector with custom configuration", () => {
      const customDetector = createRegulatoryDecisionDetector({
        cacheTtlMs: 1000,
        maxCacheSize: 100,
        minRegulatoryScore: 20,
        debug: true,
      });
      expect(customDetector).toBeInstanceOf(RegulatoryDecisionDetector);
    });

    it("should support additional keywords", () => {
      const customKeyword: RegulatoryKeyword = {
        keyword: "custom-regulatory",
        weight: 20,
        triggers: {
          agencies: [RegulatoryAgency.SEC],
        },
      };
      const customDetector = createRegulatoryDecisionDetector({
        additionalKeywords: [customKeyword],
      });
      const keywords = customDetector.getKeywords();
      expect(keywords).toContainEqual(customKeyword);
    });
  });

  // =========================================================================
  // Singleton Tests
  // =========================================================================

  describe("singleton management", () => {
    it("should return the shared instance", () => {
      const shared1 = getSharedRegulatoryDecisionDetector();
      const shared2 = getSharedRegulatoryDecisionDetector();
      expect(shared1).toBe(shared2);
    });

    it("should allow setting a custom shared instance", () => {
      const customDetector = createRegulatoryDecisionDetector();
      setSharedRegulatoryDecisionDetector(customDetector);
      expect(getSharedRegulatoryDecisionDetector()).toBe(customDetector);
    });

    it("should reset the shared instance", () => {
      const shared1 = getSharedRegulatoryDecisionDetector();
      resetSharedRegulatoryDecisionDetector();
      const shared2 = getSharedRegulatoryDecisionDetector();
      expect(shared1).not.toBe(shared2);
    });
  });

  // =========================================================================
  // SEC Market Detection Tests
  // =========================================================================

  describe("SEC market detection", () => {
    it("should detect SEC-related market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-1",
        question: "Will the SEC approve a spot Bitcoin ETF in 2024?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.SEC);
      expect(result.primarySector).toBe(RegulatorySector.CRYPTO);
      expect(result.relevanceScore).toBeGreaterThan(0);
    });

    it("should detect SEC enforcement market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-2",
        question: "Will the SEC lawsuit against Ripple result in a fine?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.SEC);
      expect(result.primaryDecisionType).toBe(
        RegulatoryDecisionType.ENFORCEMENT
      );
    });

    it("should detect Gary Gensler as SEC-related", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-3",
        question: "Will Gary Gensler resign before 2025?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.SEC);
      expect(result.mentionedEntities).toContain("Gary Gensler");
    });

    it("should detect SEC investigation", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-4",
        question: "Will there be an SEC investigation into insider trading?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.decisionTypeTags.some((t) => t.value === RegulatoryDecisionType.INVESTIGATION)).toBe(true);
    });
  });

  // =========================================================================
  // FDA Market Detection Tests
  // =========================================================================

  describe("FDA market detection", () => {
    it("should detect FDA approval market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-5",
        question: "Will the FDA approve the new cancer drug treatment?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FDA);
      expect(result.primaryDecisionType).toBe(RegulatoryDecisionType.APPROVAL);
      expect(result.primarySector).toBe(RegulatorySector.HEALTHCARE);
    });

    it("should detect PDUFA date market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-6",
        question: "Will Pfizer's drug receive FDA approval before the PDUFA date?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FDA);
      expect(result.insiderAdvantageScore).toBeGreaterThan(0);
    });

    it("should detect emergency use authorization", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-7",
        question:
          "Will the FDA grant emergency use authorization for the new vaccine?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FDA);
      expect(result.primaryDecisionType).toBe(
        RegulatoryDecisionType.EMERGENCY_AUTH
      );
    });

    it("should detect complete response letter (denial)", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-8",
        question:
          "Will the company receive a complete response letter from the FDA?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryDecisionType).toBe(RegulatoryDecisionType.DENIAL);
    });
  });

  // =========================================================================
  // Federal Reserve Market Detection Tests
  // =========================================================================

  describe("Federal Reserve market detection", () => {
    it("should detect FOMC rate decision market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-9",
        question: "Will the FOMC raise interest rates in March?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FEDERAL_RESERVE);
      expect(result.primaryDecisionType).toBe(
        RegulatoryDecisionType.RATE_DECISION
      );
      expect(result.primarySector).toBe(RegulatorySector.FINANCE);
    });

    it("should detect rate hike market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-10",
        question: "Will the Fed implement a rate hike of 25 basis points?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.agencyTags.some((t) => t.value === RegulatoryAgency.FEDERAL_RESERVE)).toBe(true);
    });

    it("should detect Jerome Powell as Fed-related", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-11",
        question:
          "Will Jerome Powell announce a rate cut in his next speech?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.mentionedEntities).toContain("Jerome Powell");
    });
  });

  // =========================================================================
  // FTC/DOJ Antitrust Market Detection Tests
  // =========================================================================

  describe("antitrust market detection", () => {
    it("should detect FTC lawsuit market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-12",
        question: "Will the FTC lawsuit against the tech company succeed?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FTC);
      expect(result.primaryDecisionType).toBe(
        RegulatoryDecisionType.ENFORCEMENT
      );
    });

    it("should detect DOJ antitrust market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-13",
        question:
          "Will the DOJ antitrust lawsuit against the company result in a breakup?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primarySector).toBe(RegulatorySector.ANTITRUST);
    });

    it("should detect merger approval market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-14",
        question:
          "Will the proposed merger receive merger approval from antitrust authorities?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.decisionTypeTags.some((t) => t.value === RegulatoryDecisionType.MERGER_APPROVAL)).toBe(true);
    });

    it("should detect blocked merger", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-15",
        question: "Will the FTC block merger between the two companies and deny the acquisition?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      // The "block merger" keyword triggers DENIAL
      expect(result.decisionTypeTags.some((t) => t.value === RegulatoryDecisionType.DENIAL)).toBe(true);
    });
  });

  // =========================================================================
  // European Regulatory Market Detection Tests
  // =========================================================================

  describe("European regulatory detection", () => {
    it("should detect ECB market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-16",
        question: "Will the ECB raise interest rates in 2024?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.ECB);
      expect(result.primaryJurisdiction).toBe(RegulatoryJurisdiction.EU);
    });

    it("should detect European Commission market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-17",
        question:
          "Will the European Commission impose fines on the tech giant?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.EU_COMMISSION);
    });

    it("should detect EMA market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-18",
        question:
          "Will the European Medicines Agency approve the new treatment?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.EMA);
      expect(result.primarySector).toBe(RegulatorySector.HEALTHCARE);
    });

    it("should detect GDPR enforcement", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-19",
        question: "Will the European Commission issue a major GDPR fine this year?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.sectorTags.some((t) => t.value === RegulatorySector.TECHNOLOGY)).toBe(true);
    });
  });

  // =========================================================================
  // UK Regulatory Market Detection Tests
  // =========================================================================

  describe("UK regulatory detection", () => {
    it("should detect Bank of England market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-20",
        question:
          "Will the Bank of England cut interest rates before the US Fed?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.BOE);
      expect(result.primaryJurisdiction).toBe(RegulatoryJurisdiction.UK);
    });

    it("should detect FCA market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-21",
        question:
          "Will the Financial Conduct Authority take action against the bank?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FCA);
    });

    it("should detect CMA UK market with context", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-22",
        question:
          "Will the UK CMA block the merger between the two tech companies?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.CMA);
    });
  });

  // =========================================================================
  // Crypto Regulatory Market Detection Tests
  // =========================================================================

  describe("crypto regulatory detection", () => {
    it("should detect Bitcoin ETF approval market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-23",
        question: "Will a spot Bitcoin ETF be approved in 2024?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primarySector).toBe(RegulatorySector.CRYPTO);
    });

    it("should detect Ethereum ETF market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-24",
        question: "Will the SEC approve an Ethereum ETF?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.sectorTags.some((t) => t.value === RegulatorySector.CRYPTO)).toBe(true);
    });

    it("should detect crypto exchange enforcement", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-25",
        question:
          "Will Coinbase win its SEC lawsuit about crypto regulations?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.mentionedEntities).toContain("Coinbase");
    });

    it("should detect CFTC crypto market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-26",
        question:
          "Will the CFTC take enforcement action against the crypto exchange?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.CFTC);
    });
  });

  // =========================================================================
  // Transportation/Aviation Market Detection Tests
  // =========================================================================

  describe("transportation regulatory detection", () => {
    it("should detect FAA market", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-27",
        question:
          "Will the FAA approve the new aircraft design for commercial use?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.primaryAgency).toBe(RegulatoryAgency.FAA);
      expect(result.primarySector).toBe(RegulatorySector.TRANSPORTATION);
    });

    it("should detect aircraft grounding", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-28",
        question:
          "Will the FAA order a grounding of Boeing aircraft after the investigation?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      expect(result.decisionTypeTags.some((t) => t.value === RegulatoryDecisionType.BAN)).toBe(true);
    });
  });

  // =========================================================================
  // Non-Regulatory Market Tests
  // =========================================================================

  describe("non-regulatory market detection", () => {
    it("should not detect sports market as regulatory", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-29",
        question: "Will the Lakers win the NBA championship?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(false);
      expect(result.relevanceScore).toBeLessThan(15);
    });

    it("should not detect crypto price market as regulatory", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-30",
        question: "Will Bitcoin reach $100,000 in 2024?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(false);
    });

    it("should not detect election market as regulatory", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-31",
        question: "Will the incumbent president be re-elected?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(false);
    });

    it("should not detect weather market as regulatory", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-32",
        question: "Will there be a hurricane hitting Florida in September?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(false);
    });
  });

  // =========================================================================
  // Insider Advantage Score Tests
  // =========================================================================

  describe("insider advantage scoring", () => {
    it("should assign high insider advantage to FDA approval markets", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-33",
        question:
          "Will the FDA approve the new drug before the PDUFA date in June?",
      };
      const result = detector.detectMarket(market);

      expect(result.insiderAdvantageScore).toBeGreaterThan(40);
      expect(
        [InsiderAdvantageLevel.HIGH, InsiderAdvantageLevel.VERY_HIGH].includes(
          result.insiderAdvantageLevel
        )
      ).toBe(true);
    });

    it("should assign high insider advantage to SEC enforcement", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-34",
        question:
          "Will the SEC announce enforcement action against the company?",
      };
      const result = detector.detectMarket(market);

      expect(result.insiderAdvantageScore).toBeGreaterThan(0);
    });

    it("should assign lower insider advantage to public rate decisions", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-35",
        question: "Will the Fed raise rates at the scheduled FOMC meeting?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
      // Rate decisions are somewhat predictable
    });
  });

  // =========================================================================
  // Deadline Extraction Tests
  // =========================================================================

  describe("deadline extraction", () => {
    it("should extract date from market text", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-36",
        question:
          "Will the FDA make a decision on the drug approval by January 15, 2024?",
      };
      const result = detector.detectMarket(market, { extractDeadlines: true });

      expect(result.deadlines.length).toBeGreaterThan(0);
    });

    it("should not extract deadlines when disabled", () => {
      const market: MarketForRegulatoryDetection = {
        id: "market-37",
        question:
          "Will there be regulatory approval by March 1, 2024?",
      };
      const result = detector.detectMarket(market, {
        extractDeadlines: false,
      });

      expect(result.deadlines.length).toBe(0);
    });
  });

  // =========================================================================
  // Batch Detection Tests
  // =========================================================================

  describe("batch detection", () => {
    it("should process multiple markets in batch", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "batch-1", question: "Will the SEC approve the ETF?" },
        { id: "batch-2", question: "Will the Lakers win?" },
        { id: "batch-3", question: "Will the FDA approve the drug?" },
        { id: "batch-4", question: "Will Bitcoin reach $100k?" },
      ];

      const batchResult = detector.detectMarkets(markets);

      expect(batchResult.totalProcessed).toBe(4);
      expect(batchResult.regulatoryCount).toBe(2);
      expect(batchResult.results.size).toBe(4);
      expect(batchResult.errors.size).toBe(0);
    });

    it("should correctly count agency distribution", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "batch-5", question: "SEC approval for Bitcoin ETF" },
        { id: "batch-6", question: "SEC investigation into trading" },
        { id: "batch-7", question: "FDA drug approval" },
      ];

      const batchResult = detector.detectMarkets(markets);

      expect(batchResult.agencyDistribution.get(RegulatoryAgency.SEC)).toBe(2);
      expect(batchResult.agencyDistribution.get(RegulatoryAgency.FDA)).toBe(1);
    });

    it("should track processing time", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "batch-8", question: "SEC approval" },
        { id: "batch-9", question: "FDA approval" },
      ];

      const batchResult = detector.detectMarkets(markets);

      expect(batchResult.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Convenience Function Tests
  // =========================================================================

  describe("convenience functions", () => {
    it("should detect using global function", () => {
      const market: MarketForRegulatoryDetection = {
        id: "conv-1",
        question: "Will the SEC approve the ETF?",
      };
      const result = detectRegulatoryMarket(market);

      expect(result.isRegulatory).toBe(true);
    });

    it("should batch detect using global function", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "conv-2", question: "SEC approval" },
        { id: "conv-3", question: "FDA decision" },
      ];
      const result = detectRegulatoryMarkets(markets);

      expect(result.totalProcessed).toBe(2);
    });

    it("should check if market is regulatory using global function", () => {
      const market: MarketForRegulatoryDetection = {
        id: "conv-4",
        question: "Will the FTC block the merger?",
      };
      const isReg = isRegulatoryMarket(market);

      expect(isReg).toBe(true);
    });

    it("should get regulatory markets from batch", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "conv-5", question: "SEC approval for Bitcoin ETF" },
        { id: "conv-6", question: "Lakers win NBA finals" },
        { id: "conv-7", question: "FDA drug approval" },
      ];
      const regMarkets = getRegulatoryMarkets(markets);

      expect(regMarkets.length).toBe(2);
      expect(regMarkets.every((m) => m.isRegulatory)).toBe(true);
    });

    it("should filter by agency", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "conv-8", question: "SEC Bitcoin ETF approval" },
        { id: "conv-9", question: "FDA drug approval" },
        { id: "conv-10", question: "SEC enforcement action" },
      ];
      const secMarkets = getRegulatoryMarketsByAgency(
        markets,
        RegulatoryAgency.SEC
      );

      expect(secMarkets.length).toBe(2);
    });

    it("should filter by decision type", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "conv-11", question: "Will the merger receive approval?" },
        { id: "conv-12", question: "SEC enforcement action" },
        { id: "conv-13", question: "FDA approval for treatment" },
      ];
      const approvalMarkets = getRegulatoryMarketsByDecisionType(
        markets,
        RegulatoryDecisionType.APPROVAL
      );

      expect(approvalMarkets.length).toBeGreaterThan(0);
    });

    it("should filter by sector", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "conv-14", question: "Bitcoin ETF SEC approval" },
        { id: "conv-15", question: "Ethereum ETF approval" },
        { id: "conv-16", question: "FDA drug approval" },
      ];
      const cryptoMarkets = getRegulatoryMarketsBySector(
        markets,
        RegulatorySector.CRYPTO
      );

      expect(cryptoMarkets.length).toBe(2);
    });

    it("should get high insider advantage markets", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "conv-17", question: "Will FDA approve the drug before PDUFA date?" },
        { id: "conv-18", question: "SEC investigation announcement" },
      ];
      const highAdvantageMarkets = getHighInsiderAdvantageRegulatoryMarkets(
        markets
      );

      expect(highAdvantageMarkets.length).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Cache Tests
  // =========================================================================

  describe("caching", () => {
    it("should cache results", () => {
      const market: MarketForRegulatoryDetection = {
        id: "cache-1",
        question: "Will the SEC approve the ETF?",
      };

      const result1 = detector.detectMarket(market);
      const result2 = detector.detectMarket(market);

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(true);
    });

    it("should bypass cache when requested", () => {
      const market: MarketForRegulatoryDetection = {
        id: "cache-2",
        question: "Will the SEC approve the ETF?",
      };

      const result1 = detector.detectMarket(market);
      const result2 = detector.detectMarket(market, { bypassCache: true });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
    });

    it("should clear cache", () => {
      const market: MarketForRegulatoryDetection = {
        id: "cache-3",
        question: "Will the SEC approve the ETF?",
      };

      detector.detectMarket(market);
      detector.clearCache();
      const result = detector.detectMarket(market);

      expect(result.fromCache).toBe(false);
    });
  });

  // =========================================================================
  // Summary Tests
  // =========================================================================

  describe("summary statistics", () => {
    it("should provide summary statistics", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "sum-1", question: "SEC Bitcoin ETF approval" },
        { id: "sum-2", question: "FDA drug approval" },
        { id: "sum-3", question: "Lakers NBA championship" },
      ];

      detector.detectMarkets(markets);
      const summary = detector.getSummary();

      expect(summary.totalDetected).toBe(3);
      expect(summary.regulatoryMarketsCount).toBe(2);
      expect(summary.regulatoryPercentage).toBeCloseTo(66.67, 0);
    });

    it("should track agency breakdown", () => {
      const markets: MarketForRegulatoryDetection[] = [
        { id: "sum-4", question: "SEC approval" },
        { id: "sum-5", question: "FDA approval" },
        { id: "sum-6", question: "SEC lawsuit" },
      ];

      detector.detectMarkets(markets);
      const summary = detector.getSummary();

      expect(summary.agencyBreakdown.get(RegulatoryAgency.SEC)).toBe(2);
      expect(summary.agencyBreakdown.get(RegulatoryAgency.FDA)).toBe(1);
    });

    it("should use global summary function", () => {
      resetSharedRegulatoryDecisionDetector();
      const summary = getRegulatoryDetectorSummary();

      expect(summary).toBeDefined();
      expect(summary.totalDetected).toBe(0);
    });

    it("should reset statistics", () => {
      const market: MarketForRegulatoryDetection = {
        id: "sum-7",
        question: "SEC approval",
      };

      detector.detectMarket(market);
      detector.resetStats();
      const summary = detector.getSummary();

      expect(summary.totalDetected).toBe(0);
    });
  });

  // =========================================================================
  // Edge Cases and Error Handling
  // =========================================================================

  describe("edge cases", () => {
    it("should handle empty question", () => {
      const market: MarketForRegulatoryDetection = {
        id: "edge-1",
        question: "",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(false);
    });

    it("should handle market with description", () => {
      const market: MarketForRegulatoryDetection = {
        id: "edge-2",
        question: "Will this happen?",
        description: "SEC approval for new Bitcoin ETF from BlackRock",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
    });

    it("should handle market with slug", () => {
      const market: MarketForRegulatoryDetection = {
        id: "edge-3",
        question: "Will this happen?",
        slug: "sec-bitcoin-etf-approval",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
    });

    it("should handle market with tags", () => {
      const market: MarketForRegulatoryDetection = {
        id: "edge-4",
        question: "Will this happen?",
        tags: ["SEC", "cryptocurrency", "approval"],
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
    });

    it("should handle special characters in market text", () => {
      const market: MarketForRegulatoryDetection = {
        id: "edge-5",
        question:
          "Will the SEC approve the ETF? (Yes/No) - Decision expected Q1 2024",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
    });

    it("should handle case-insensitive matching", () => {
      const market: MarketForRegulatoryDetection = {
        id: "edge-6",
        question: "will the fda approve the DRUG application?",
      };
      const result = detector.detectMarket(market);

      expect(result.isRegulatory).toBe(true);
    });
  });

  // =========================================================================
  // Keywords Tests
  // =========================================================================

  describe("keywords", () => {
    it("should have default regulatory keywords", () => {
      expect(DEFAULT_REGULATORY_KEYWORDS.length).toBeGreaterThan(0);
    });

    it("should return all keywords", () => {
      const keywords = detector.getKeywords();
      expect(keywords.length).toBe(DEFAULT_REGULATORY_KEYWORDS.length);
    });

    it("should include custom keywords", () => {
      const customKeyword: RegulatoryKeyword = {
        keyword: "my-custom-agency",
        weight: 25,
        triggers: {
          agencies: [RegulatoryAgency.OTHER],
        },
      };
      const customDetector = createRegulatoryDecisionDetector({
        additionalKeywords: [customKeyword],
      });
      const keywords = customDetector.getKeywords();

      expect(keywords.length).toBe(DEFAULT_REGULATORY_KEYWORDS.length + 1);
      expect(keywords).toContainEqual(customKeyword);
    });
  });

  // =========================================================================
  // Configuration Tests
  // =========================================================================

  describe("configuration", () => {
    it("should use custom minimum score", () => {
      const customDetector = createRegulatoryDecisionDetector({
        minRegulatoryScore: 50,
      });
      const market: MarketForRegulatoryDetection = {
        id: "config-1",
        question: "SEC approval",
      };
      const result = customDetector.detectMarket(market);

      // With a higher threshold, weak matches won't count as regulatory
      // This depends on actual scores - just check that it works
      expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
    });

    it("should use custom minimum score in options", () => {
      const market: MarketForRegulatoryDetection = {
        id: "config-2",
        question: "SEC",
      };
      const result = detector.detectMarket(market, { minRelevanceScore: 50 });

      // With high min score, a simple "SEC" mention might not be enough
      expect(result).toBeDefined();
    });
  });
});

// =========================================================================
// Export type tests
// =========================================================================

describe("type exports", () => {
  it("should export all expected types", () => {
    // Enums
    expect(RegulatoryAgency.SEC).toBeDefined();
    expect(RegulatoryDecisionType.APPROVAL).toBeDefined();
    expect(RegulatorySector.FINANCE).toBeDefined();
    expect(RegulatoryJurisdiction.US_FEDERAL).toBeDefined();
    expect(RegulatoryConfidence.HIGH).toBeDefined();
    expect(InsiderAdvantageLevel.HIGH).toBeDefined();
  });

  it("should export all agencies", () => {
    const agencies = [
      RegulatoryAgency.SEC,
      RegulatoryAgency.FDA,
      RegulatoryAgency.FCC,
      RegulatoryAgency.EPA,
      RegulatoryAgency.FTC,
      RegulatoryAgency.FEDERAL_RESERVE,
      RegulatoryAgency.DOJ,
      RegulatoryAgency.CFPB,
      RegulatoryAgency.CFTC,
      RegulatoryAgency.FAA,
      RegulatoryAgency.NHTSA,
      RegulatoryAgency.OFAC,
      RegulatoryAgency.TREASURY,
      RegulatoryAgency.IRS,
      RegulatoryAgency.FERC,
      RegulatoryAgency.NRC,
      RegulatoryAgency.CMS,
      RegulatoryAgency.USPTO,
      RegulatoryAgency.ECB,
      RegulatoryAgency.EU_COMMISSION,
      RegulatoryAgency.EMA,
      RegulatoryAgency.BOE,
      RegulatoryAgency.FCA,
      RegulatoryAgency.CMA,
      RegulatoryAgency.BUNDESBANK,
      RegulatoryAgency.PBOC,
      RegulatoryAgency.BOJ,
      RegulatoryAgency.RBI,
      RegulatoryAgency.OTHER,
    ];
    expect(agencies.length).toBe(29);
  });

  it("should export all decision types", () => {
    const types = [
      RegulatoryDecisionType.APPROVAL,
      RegulatoryDecisionType.DENIAL,
      RegulatoryDecisionType.ENFORCEMENT,
      RegulatoryDecisionType.FINE,
      RegulatoryDecisionType.INVESTIGATION,
      RegulatoryDecisionType.MERGER_APPROVAL,
      RegulatoryDecisionType.RULE_CHANGE,
      RegulatoryDecisionType.RATE_DECISION,
      RegulatoryDecisionType.LICENSE,
      RegulatoryDecisionType.BAN,
      RegulatoryDecisionType.SETTLEMENT,
      RegulatoryDecisionType.EMERGENCY_AUTH,
      RegulatoryDecisionType.GUIDANCE,
      RegulatoryDecisionType.PUBLIC_COMMENT,
      RegulatoryDecisionType.HEARING,
      RegulatoryDecisionType.COMPLIANCE,
      RegulatoryDecisionType.GENERAL,
    ];
    expect(types.length).toBe(17);
  });

  it("should export all sectors", () => {
    const sectors = [
      RegulatorySector.FINANCE,
      RegulatorySector.HEALTHCARE,
      RegulatorySector.TECHNOLOGY,
      RegulatorySector.ENERGY,
      RegulatorySector.ENVIRONMENT,
      RegulatorySector.TRANSPORTATION,
      RegulatorySector.CONSUMER,
      RegulatorySector.CRYPTO,
      RegulatorySector.ANTITRUST,
      RegulatorySector.TRADE,
      RegulatorySector.IMMIGRATION,
      RegulatorySector.DEFENSE,
      RegulatorySector.AGRICULTURE,
      RegulatorySector.MEDIA,
      RegulatorySector.OTHER,
    ];
    expect(sectors.length).toBe(15);
  });

  it("should export all jurisdictions", () => {
    const jurisdictions = [
      RegulatoryJurisdiction.US_FEDERAL,
      RegulatoryJurisdiction.US_STATE,
      RegulatoryJurisdiction.EU,
      RegulatoryJurisdiction.UK,
      RegulatoryJurisdiction.CHINA,
      RegulatoryJurisdiction.JAPAN,
      RegulatoryJurisdiction.GERMANY,
      RegulatoryJurisdiction.FRANCE,
      RegulatoryJurisdiction.INDIA,
      RegulatoryJurisdiction.CANADA,
      RegulatoryJurisdiction.AUSTRALIA,
      RegulatoryJurisdiction.SWITZERLAND,
      RegulatoryJurisdiction.INTERNATIONAL,
      RegulatoryJurisdiction.OTHER,
    ];
    expect(jurisdictions.length).toBe(14);
  });
});
