// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// async function main() {
//   console.log("Fetching markets with tokens...\n");
  
//   const GAMMA_API = "https://gamma-api.polymarket.com";
//   let offset = 0;
//   let totalOutcomes = 0;
//   let errors = 0;
  
//   while (true) {
//     const url = GAMMA_API + "/markets?limit=100&offset=" + offset + "&active=true";
//     const res = await fetch(url);
//     const markets = await res.json();
    
//     if (!markets || markets.length === 0) break;
    
//     for (const m of markets) {
//       const dbMarket = await prisma.market.findUnique({ where: { id: m.id } });
//       if (!dbMarket) continue;
      
//       const tokens = m.tokens || [];
//       const clobTokenIds = m.clobTokenIds || [];
//       const outcomes = m.outcomes || ["Yes", "No"];
//       const prices = m.outcomePrices || [];
      
//       if (tokens.length > 0) {
//         for (let i = 0; i < tokens.length; i++) {
//           const t = tokens[i];
//           try {
//             const existing = await prisma.outcome.findFirst({
//               where: { marketId: m.id, clobTokenId: t.token_id }
//             });
            
//             if (existing) {
//               await prisma.outcome.update({
//                 where: { id: existing.id },
//                 data: {
//                   name: t.outcome || "Unknown",
//                   price: parseFloat(String(t.price)) || 0,
//                   probability: (parseFloat(String(t.price)) || 0) * 100,
//                 },
//               });
//             } else {
//               await prisma.outcome.create({
//                 data: {
//                   marketId: m.id,
//                   name: t.outcome || "Unknown",
//                   clobTokenId: t.token_id,
//                   price: parseFloat(String(t.price)) || 0,
//                   probability: (parseFloat(String(t.price)) || 0) * 100,
//                   displayOrder: i,
//                 },
//               });
//             }
//             totalOutcomes++;
//           } catch (e) {
//             errors++;
//           }
//         }
//       } else if (clobTokenIds.length > 0) {
//         for (let i = 0; i < clobTokenIds.length; i++) {
//           try {
//             const price = prices[i] ? parseFloat(String(prices[i])) : 0;
//             const name = outcomes[i] || (i === 0 ? "Yes" : "No");
            
//             const existing = await prisma.outcome.findFirst({
//               where: { marketId: m.id, clobTokenId: clobTokenIds[i] }
//             });
            
//             if (existing) {
//               await prisma.outcome.update({
//                 where: { id: existing.id },
//                 data: { name, price, probability: price * 100 },
//               });
//             } else {
//               await prisma.outcome.create({
//                 data: {
//                   marketId: m.id,
//                   name,
//                   clobTokenId: clobTokenIds[i],
//                   price,
//                   probability: price * 100,
//                   displayOrder: i,
//                 },
//               });
//             }
//             totalOutcomes++;
//           } catch (e) {
//             errors++;
//           }
//         }
//       }
//     }
    
//     console.log("Processed " + (offset + markets.length) + " markets, " + totalOutcomes + " outcomes (" + errors + " errors)");
//     offset += 100;
    
//     if (markets.length < 100) break;
//   }
  
//   const count = await prisma.outcome.count();
//   console.log("\nDone! Total outcomes in DB: " + count);
// }

// main().catch(console.error).finally(() => prisma.$disconnect());

// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// async function main() {
//   console.log("Syncing outcomes from Polymarket API...\n");
  
//   // First, clear existing bad outcomes
//   const deleted = await prisma.outcome.deleteMany({});
//   console.log("Cleared " + deleted.count + " existing outcomes\n");
  
//   const GAMMA_API = "https://gamma-api.polymarket.com";
//   let offset = 0;
//   let totalOutcomes = 0;
//   let marketsProcessed = 0;
//   let errors = 0;
  
//   while (true) {
//     const url = GAMMA_API + "/markets?limit=100&offset=" + offset;
//     const res = await fetch(url);
//     const markets = await res.json();
    
//     if (!markets || markets.length === 0) break;
    
//     for (const m of markets) {
//       // Check if market exists in our DB
//       const dbMarket = await prisma.market.findUnique({ where: { id: m.id } });
//       if (!dbMarket) continue;
      
//       marketsProcessed++;
      
//       try {
//         // Parse the JSON strings - this is the key fix!
//         let outcomeNames: string[] = [];
//         let tokenIds: string[] = [];
//         let prices: string[] = [];
        
//         // Parse outcomes (it's a JSON string like "[\"Yes\", \"No\"]")
//         if (m.outcomes && typeof m.outcomes === "string") {
//           try {
//             outcomeNames = JSON.parse(m.outcomes);
//           } catch (e) {
//             outcomeNames = ["Yes", "No"];
//           }
//         } else if (Array.isArray(m.outcomes)) {
//           outcomeNames = m.outcomes;
//         } else {
//           outcomeNames = ["Yes", "No"];
//         }
        
//         // Parse clobTokenIds (also a JSON string)
//         if (m.clobTokenIds && typeof m.clobTokenIds === "string") {
//           try {
//             tokenIds = JSON.parse(m.clobTokenIds);
//           } catch (e) {
//             tokenIds = [];
//           }
//         } else if (Array.isArray(m.clobTokenIds)) {
//           tokenIds = m.clobTokenIds;
//         }
        
//         // Parse outcomePrices
//         if (m.outcomePrices && typeof m.outcomePrices === "string") {
//           try {
//             prices = JSON.parse(m.outcomePrices);
//           } catch (e) {
//             prices = [];
//           }
//         } else if (Array.isArray(m.outcomePrices)) {
//           prices = m.outcomePrices;
//         }
        
//         // Skip if no token IDs
//         if (tokenIds.length === 0) continue;
        
//         // Create outcomes
//         for (let i = 0; i < tokenIds.length; i++) {
//           const tokenId = tokenIds[i];
//           const name = outcomeNames[i] || (i === 0 ? "Yes" : "No");
//           const price = prices[i] ? parseFloat(String(prices[i])) : 0;

          
//           // Skip invalid token IDs
//           if (!tokenId || tokenId.length < 10) continue;
          
//           await prisma.outcome.create({
//             data: {
//               marketId: m.id,
//               name: name,
//               clobTokenId: tokenId,
//               price: price,
//               probability: price * 100,
//               displayOrder: i,
//             },
//           });
//           totalOutcomes++;
//         }
//       } catch (e) {
//         errors++;
//       }
//     }
    
//     console.log("Processed " + (offset + markets.length) + " API markets, " + marketsProcessed + " matched, " + totalOutcomes + " outcomes created");
//     offset += 100;
    
//     if (markets.length < 100) break;
//   }
  
//   const finalCount = await prisma.outcome.count();
//   console.log("\n========================================");
//   console.log("DONE!");
//   console.log("Markets processed: " + marketsProcessed);
//   console.log("Outcomes created: " + finalCount);
//   console.log("Errors: " + errors);
//   console.log("========================================");
// }

// main().catch(console.error).finally(() => prisma.$disconnect());

/**
 * Sync Outcomes - Fixed Version
 * 
 * This version fetches each market individually from the API
 * based on markets that exist in our database.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Syncing outcomes for markets in database...\n");
  
  const GAMMA_API = "https://gamma-api.polymarket.com";
  
  // Get all market IDs from our database
  const dbMarkets = await prisma.market.findMany({
    select: { id: true },
  });
  
  console.log("Found " + dbMarkets.length + " markets in database\n");
  
  let totalOutcomes = 0;
  let errors = 0;
  let processed = 0;
  
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
          errors++;
          return;
        }
        
        const market = await res.json();
        if (!market || !market.id) {
          errors++;
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
        
        // Create outcomes
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
          }
          totalOutcomes++;
        }
        
        processed++;
      } catch (e) {
        errors++;
      }
    }));
    
    console.log("Progress: " + (i + batch.length) + "/" + dbMarkets.length + " markets, " + totalOutcomes + " outcomes, " + errors + " errors");
  }
  
  const finalCount = await prisma.outcome.count();
  console.log("\n========================================");
  console.log("DONE!");
  console.log("Markets processed: " + processed);
  console.log("Outcomes in DB: " + finalCount);
  console.log("Errors: " + errors);
  console.log("========================================");
}

main().catch(console.error).finally(() => prisma.$disconnect());