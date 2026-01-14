/**
 * Outcome Sync Service (Production)
 * 
 * Automatically syncs outcomes from Polymarket API on startup.
 * File: src/services/outcome-sync.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface OutcomeSyncStats {
  marketsProcessed: number;
  outcomesCreated: number;
  outcomesUpdated: number;
  errors: number;
  durationMs: number;
}

/**
 * Sync all outcomes from Polymarket Gamma API.
 * Fetches each market individually based on markets in our database.
 */
export async function syncAllOutcomes(): Promise<OutcomeSyncStats> {
  const startTime = Date.now();
  const stats: OutcomeSyncStats = {
    marketsProcessed: 0,
    outcomesCreated: 0,
    outcomesUpdated: 0,
    errors: 0,
    durationMs: 0,
  };

  console.log("[OutcomeSync] Starting outcome sync...");

  const GAMMA_API = "https://gamma-api.polymarket.com";

  try {
    // Get all market IDs from our database
    const dbMarkets = await prisma.market.findMany({
      select: { id: true },
    });

    console.log("[OutcomeSync] Found " + dbMarkets.length + " markets in database");

    // Process in batches
    const batchSize = 50;

    for (let i = 0; i < dbMarkets.length; i += batchSize) {
      const batch = dbMarkets.slice(i, i + batchSize);

      await Promise.all(batch.map(async (dbMarket) => {
        try {
          // Fetch this specific market from API
          const url = GAMMA_API + "/markets/" + dbMarket.id;
          const res = await fetch(url);

          if (!res.ok) {
            stats.errors++;
            return;
          }

          const market = await res.json();
          if (!market || !market.id) {
            stats.errors++;
            return;
          }

          // Parse JSON string fields
          let outcomeNames: string[] = ["Yes", "No"];
          let tokenIds: string[] = [];
          let prices: string[] = [];

          // Parse outcomes
          if (market.outcomes) {
            if (typeof market.outcomes === "string") {
              try {
                outcomeNames = JSON.parse(market.outcomes);
              } catch {}
            } else if (Array.isArray(market.outcomes)) {
              outcomeNames = market.outcomes;
            }
          }

          // Parse clobTokenIds
          if (market.clobTokenIds) {
            if (typeof market.clobTokenIds === "string") {
              try {
                tokenIds = JSON.parse(market.clobTokenIds);
              } catch {}
            } else if (Array.isArray(market.clobTokenIds)) {
              tokenIds = market.clobTokenIds;
            }
          }

          // Parse outcomePrices
          if (market.outcomePrices) {
            if (typeof market.outcomePrices === "string") {
              try {
                prices = JSON.parse(market.outcomePrices);
              } catch {}
            } else if (Array.isArray(market.outcomePrices)) {
              prices = market.outcomePrices;
            }
          }

          if (tokenIds.length === 0) {
            return;
          }

          // Create/update outcomes
          for (let j = 0; j < tokenIds.length; j++) {
            const tokenId = tokenIds[j] || "";
            if (!tokenId || tokenId.length < 10) continue;

            const name = outcomeNames[j] || (j === 0 ? "Yes" : "No");
            const price = prices[j] ? parseFloat(String(prices[j])) : 0;

            // Check if exists
            const existing = await prisma.outcome.findFirst({
              where: { marketId: market.id, clobTokenId: tokenId }
            });

            if (existing) {
              await prisma.outcome.update({
                where: { id: existing.id },
                data: { name, price, probability: price * 100 },
              });
              stats.outcomesUpdated++;
            } else {
              await prisma.outcome.create({
                data: {
                  marketId: market.id,
                  name,
                  clobTokenId: tokenId,
                  price,
                  probability: price * 100,
                  displayOrder: j,
                },
              });
              stats.outcomesCreated++;
            }
          }

          stats.marketsProcessed++;
        } catch (e) {
          stats.errors++;
        }
      }));

      // Log progress every 500 markets
      if ((i + batchSize) % 500 === 0 || i + batchSize >= dbMarkets.length) {
        console.log("[OutcomeSync] Progress: " + Math.min(i + batchSize, dbMarkets.length) + "/" + dbMarkets.length + " markets");
      }
    }
  } catch (error) {
    console.error("[OutcomeSync] Fatal error:", error);
  }

  stats.durationMs = Date.now() - startTime;

  console.log("[OutcomeSync] Sync complete", stats);
  return stats;
}

/**
 * Check if outcomes need syncing (less than expected count).
 */
export async function needsOutcomeSync(): Promise<boolean> {
  const marketCount = await prisma.market.count();
  const outcomeCount = await prisma.outcome.count();

  // Expect roughly 2 outcomes per market (Yes/No)
  // If we have less than 80% of expected, sync is needed
  const expectedOutcomes = marketCount * 1.5;
  const needsSync = outcomeCount < expectedOutcomes;
  
  console.log("[OutcomeSync] Check: " + outcomeCount + " outcomes, " + marketCount + " markets, needs sync: " + needsSync);
  
  return needsSync;
}

// Export prisma for direct execution
export { prisma };