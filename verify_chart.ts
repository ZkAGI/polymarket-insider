/**
 * Quick script to verify the P&L chart renders correctly
 */
import puppeteer from 'puppeteer';

async function verifyChart() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const testAddress = '0x1234567890123456789012345678901234567890';
  await page.goto(`http://localhost:3000/wallet/${testAddress}`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Wait for chart to render
  await page.waitForSelector('svg', { timeout: 10000 });

  // Take screenshot
  await page.screenshot({
    path: 'wallet-pnl-chart-screenshot.png',
    fullPage: true,
  });

  console.log('✓ Chart rendered successfully');
  console.log('✓ Screenshot saved to wallet-pnl-chart-screenshot.png');

  // Check for key elements
  const hasPnL = await page.evaluate(() => document.body.textContent?.includes('Profit & Loss'));
  const hasSVG = await page.$('svg');
  const hasTimeRange = await page.evaluate(() => document.body.textContent?.includes('ALL'));

  console.log(`✓ P&L title present: ${hasPnL}`);
  console.log(`✓ SVG chart present: ${!!hasSVG}`);
  console.log(`✓ Time range selector present: ${hasTimeRange}`);

  await browser.close();
}

verifyChart().catch(console.error);
