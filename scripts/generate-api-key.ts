/**
 * Generate Polymarket CLOB API Credentials
 * 
 * Usage:
 *   npx ts-node scripts/generate-api-key.ts
 */

import { ClobClient } from "@polymarket/clob-client";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon Mainnet

async function main() {
  console.log("\n=== Polymarket API Key Generator ===\n");

  const privateKey = process.env.POLYMARKET_PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ Error: POLYMARKET_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  try {
    console.log("Creating wallet signer...");
    const wallet = new ethers.Wallet(privateKey);
    console.log(`Wallet address: ${wallet.address}\n`);

    console.log("Connecting to Polymarket CLOB...");
    const client = new ClobClient(HOST, CHAIN_ID, wallet);

    // CREATE new API key
    console.log("Creating NEW API credentials...\n");
    
    const creds = await client.createApiKey();
    
    // Log raw response to see actual structure
    console.log("Raw response:", JSON.stringify(creds, null, 2));

    // Try different property names (key vs apiKey)
    const apiKey = (creds as any).key || (creds as any).apiKey || "";
    const apiSecret = (creds as any).secret || (creds as any).apiSecret || "";
    const passphrase = (creds as any).passphrase || (creds as any).apiPassphrase || "";

    if (apiKey) {
      console.log("\n╔════════════════════════════════════════════════════════════╗");
      console.log("║           ADD THESE TO YOUR .env FILE                      ║");
      console.log("╠════════════════════════════════════════════════════════════╣");
      console.log(`POLYMARKET_API_KEY=${apiKey}`);
      console.log(`POLYMARKET_API_SECRET=${apiSecret}`);
      console.log(`POLYMARKET_API_PASSPHRASE=${passphrase}`);
      console.log("╚════════════════════════════════════════════════════════════╝");
      console.log("\n✅ Done! Copy the values above to your .env file.\n");
    } else {
      console.log("❌ Failed to get credentials. Check raw response above.");
    }

  } catch (error: any) {
    console.error("❌ Error:", error?.message || error);
    
    if (error?.response?.data) {
      console.error("API Response:", error.response.data);
    }
    
    process.exit(1);
  }
}

main();