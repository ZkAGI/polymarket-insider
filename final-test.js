const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  try {
    console.log('Testing wallet profile page...');
    await page.goto('http://localhost:3000/wallet/0x1234567890abcdef1234567890abcdef12345678', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    await page.waitForSelector('[data-testid="wallet-profile-header"]', { timeout: 10000 });
    console.log('✓ Wallet profile page loads successfully');

    await page.waitForSelector('[data-testid="suspicion-score-display"]', { timeout: 5000 });
    console.log('✓ Suspicion score widget renders');

    await page.waitForSelector('[data-testid="activity-summary-widget"]', { timeout: 5000 });
    console.log('✓ Activity summary widget renders');

    await page.screenshot({ path: './wallet-profile-final-test.png', fullPage: true });
    console.log('✓ Screenshot saved to wallet-profile-final-test.png');

    console.log('\n✅ All checks passed! UI-WALLET-001 is complete.');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
