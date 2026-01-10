#!/usr/bin/env node
/**
 * Browser smoke test to verify the Next.js app loads correctly
 */

import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function runSmokeTest() {
  console.log(`Running browser smoke test against ${BASE_URL}...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Navigate to the app
    console.log("Navigating to app...");
    const response = await page.goto(BASE_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Check response status
    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load page: HTTP ${response?.status()}`);
    }
    console.log(`Page loaded with status: ${response.status()}`);

    // Check the page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    if (!title) {
      throw new Error("Page has no title");
    }

    // Check for basic page content
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (!bodyText || bodyText.length < 10) {
      throw new Error("Page has no content");
    }
    console.log(`Page content length: ${bodyText.length} characters`);

    // Check for no JavaScript errors
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait a bit to catch any delayed errors
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (errors.length > 0) {
      console.warn("Console errors detected:", errors);
    }

    console.log("Browser smoke test passed!");
    return true;
  } catch (error) {
    console.error("Browser smoke test failed:", error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const success = await runSmokeTest();
process.exit(success ? 0 : 1);
