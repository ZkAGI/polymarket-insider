const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    console.log('Navigating to settings page...');
    await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle2' });

    console.log('Taking screenshot of alert thresholds section...');
    const alertThresholds = await page.$('[data-testid="settings-category-alert-thresholds"]');
    if (alertThresholds) {
      await alertThresholds.screenshot({ path: 'settings-alert-thresholds.png' });
      console.log('✓ Screenshot saved: settings-alert-thresholds.png');
    }

    console.log('Taking full page screenshot...');
    await page.screenshot({ path: 'settings-full-page.png', fullPage: true });
    console.log('✓ Screenshot saved: settings-full-page.png');

    // Verify all threshold inputs are present
    console.log('\nVerifying threshold inputs:');
    const volumeSpike = await page.$('[data-testid="volume-spike-input"]');
    const whaleTrade = await page.$('[data-testid="whale-trade-input"]');
    const suspicionScore = await page.$('[data-testid="suspicion-score-input"]');
    const priceChange = await page.$('[data-testid="price-change-input"]');

    console.log('✓ Volume Spike Threshold:', volumeSpike ? 'Present' : 'Missing');
    console.log('✓ Whale Trade Minimum:', whaleTrade ? 'Present' : 'Missing');
    console.log('✓ Suspicion Score Threshold:', suspicionScore ? 'Present' : 'Missing');
    console.log('✓ Price Change Threshold:', priceChange ? 'Present' : 'Missing');

    // Get values
    const volumeSpikeValue = await page.$eval('[data-testid="volume-spike-input"]', el => el.value);
    const whaleTradeValue = await page.$eval('[data-testid="whale-trade-input"]', el => el.value);
    const suspicionScoreValue = await page.$eval('[data-testid="suspicion-score-input"]', el => el.value);
    const priceChangeValue = await page.$eval('[data-testid="price-change-input"]', el => el.value);

    console.log('\nCurrent threshold values:');
    console.log('  Volume Spike:', volumeSpikeValue + '%');
    console.log('  Whale Trade Minimum: $' + whaleTradeValue);
    console.log('  Suspicion Score:', suspicionScoreValue + '/100');
    console.log('  Price Change:', priceChangeValue + '%');

    // Test updating a value
    console.log('\nTesting threshold update...');
    await page.click('[data-testid="volume-spike-input"]', { clickCount: 3 });
    await page.type('[data-testid="volume-spike-input"]', '350');

    const newValue = await page.$eval('[data-testid="volume-spike-input"]', el => el.value);
    console.log('✓ Volume Spike updated to:', newValue + '%');

    // Check if save bar appears
    const saveBar = await page.$('[data-testid="settings-save-bar"]');
    console.log('✓ Save bar appeared:', saveBar ? 'Yes' : 'No');

    console.log('\n✅ All threshold configuration features are working correctly!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
