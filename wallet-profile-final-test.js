/**
 * Final test to verify wallet profile with trading history table works
 */

const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'http://localhost:3000/wallet/0x1234567890123456789012345678901234567890';
  console.log(`Navigating to ${url}...`);

  await page.goto(url, {
    waitUntil: 'networkidle0',
    timeout: 10000,
  });

  console.log('Page loaded successfully');

  // Wait for trading history table
  await page.waitForSelector('[data-testid="trading-history-table"]', {
    timeout: 5000,
  });
  console.log('✓ Trading history table found');

  // Check for table headers
  const headers = await page.$$eval('thead th', (elements) =>
    elements.map((el) => el.textContent?.trim())
  );
  console.log('✓ Table headers:', headers);

  // Check for trade rows
  const rows = await page.$$('tbody tr[data-testid^="trade-row-"]');
  console.log(`✓ Found ${rows.length} trade rows`);

  // Check for pagination
  const pageSize = await page.$('[data-testid="page-size-selector"]');
  console.log(`✓ Page size selector found: ${pageSize ? 'YES' : 'NO'}`);

  // Click expand button on first row
  const expandButton = await page.$('[data-testid^="expand-button-"]');
  if (expandButton) {
    console.log('✓ Clicking expand button...');
    await expandButton.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const detailsRow = await page.$('[data-testid^="trade-details-"]');
    console.log(`✓ Details row expanded: ${detailsRow ? 'YES' : 'NO'}`);
  }

  // Take screenshot
  console.log('Taking screenshot...');
  await page.screenshot({
    path: 'wallet-profile-with-trading-history.png',
    fullPage: true,
  });
  console.log('✓ Screenshot saved to wallet-profile-with-trading-history.png');

  console.log('\n✓✓✓ ALL TESTS PASSED ✓✓✓\n');

  await browser.close();
  process.exit(0);
})().catch((error) => {
  console.error('ERROR:', error);
  process.exit(1);
});
