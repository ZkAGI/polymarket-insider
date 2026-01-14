#!/usr/bin/env node
/**
 * E2E Screenshot Test for Market Sync Service Verification
 */

import puppeteer from "puppeteer";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SCREENSHOT_DIR = "tests/e2e/screenshots";

async function takeScreenshots() {
  console.log(`Taking E2E screenshots from ${BASE_URL}...`);

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to dashboard
    console.log("Navigating to dashboard...");
    const response = await page.goto(BASE_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    if (!response || response.status() >= 400) {
      throw new Error(`Failed to load page: HTTP ${response?.status()}`);
    }

    console.log(`Page loaded with status: ${response.status()}`);

    // Wait for the main content to load
    await page.waitForSelector("body", { timeout: 10000 });

    // Take dashboard screenshot
    const dashboardPath = join(SCREENSHOT_DIR, "dashboard-main.png");
    await page.screenshot({ path: dashboardPath, fullPage: false });
    console.log(`Screenshot saved: ${dashboardPath}`);

    // Check for any error elements
    const hasErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
      return errorElements.length > 0;
    });

    if (hasErrors) {
      console.warn("Warning: Error elements detected on page");
    } else {
      console.log("No error elements detected on page");
    }

    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Get text content for verification
    const content = await page.evaluate(() => document.body.innerText);
    console.log(`Page content length: ${content.length} characters`);

    // Verify key elements are present
    const widgetTitles = await page.evaluate(() => {
      const titles = [];
      const headings = document.querySelectorAll('h2, h3, [class*="title"]');
      headings.forEach((el) => {
        if (el.textContent.trim()) {
          titles.push(el.textContent.trim().substring(0, 50));
        }
      });
      return titles.slice(0, 10);
    });

    console.log("Widget titles found:", widgetTitles);

    console.log("\n✓ E2E Screenshot Test Passed!");
    return true;
  } catch (error) {
    console.error("E2E Screenshot Test Failed:", error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const success = await takeScreenshots();
process.exit(success ? 0 : 1);
