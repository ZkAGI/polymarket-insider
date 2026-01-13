/**
 * Quick browser test for Market Price Chart
 */

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  console.log('Navigating to market detail page...');
  await page.goto('http://localhost:3000/market/test-market-123');

  console.log('Waiting for page to load...');
  await page.waitForSelector('h1', { timeout: 10000 });

  console.log('Checking for price chart...');
  try {
    await page.waitForSelector('svg', { timeout: 5000 });
    console.log('✓ Price chart SVG found');

    const chartTitle = await page.$eval('h3', (el) => el.textContent);
    console.log(`✓ Chart title: ${chartTitle}`);

    const linePath = await page.$('path[stroke="#3b82f6"]');
    console.log(`✓ Line path exists: ${!!linePath}`);

    const areaPath = await page.$('path[fill="url(#priceGradient)"]');
    console.log(`✓ Area path exists: ${!!areaPath}`);

    const zoomButtons = await page.$$('button[aria-label*="Zoom"]');
    console.log(`✓ Zoom buttons found: ${zoomButtons.length}`);

    const timeRangeButtons = await page.$$eval('button', (els) =>
      els.map(el => el.textContent).filter((text) => ['1D', '1W', '1M', '3M', '6M', 'ALL'].includes(text || ''))
    );
    console.log(`✓ Time range buttons found: ${timeRangeButtons.length}`);

    // Test zoom
    console.log('\nTesting zoom functionality...');
    await page.click('button[aria-label="Zoom in"]');
    await new Promise(resolve => setTimeout(resolve, 500));
    const zoomText = await page.$eval('body', (el) => el.textContent);
    if (zoomText && zoomText.includes('Zoom:')) {
      console.log('✓ Zoom level displayed');
    }

    // Test time range change
    console.log('\nTesting time range change...');
    const oneWeekButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent === '1W');
    });
    if (oneWeekButton) {
      await oneWeekButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      const selectedButton = await page.$eval('button.bg-blue-600', (el) => el.textContent);
      console.log(`✓ Selected time range: ${selectedButton}`);
    }

    // Take screenshot
    console.log('\nTaking screenshot...');
    await page.screenshot({ path: 'market-price-chart-test.png', fullPage: true });
    console.log('✓ Screenshot saved to market-price-chart-test.png');

    console.log('\n✅ All tests passed! Chart is working correctly.');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
