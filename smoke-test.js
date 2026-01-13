const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 });
    const title = await page.title();
    console.log('Page title:', title);
    console.log('✓ App loads successfully');

    await page.screenshot({ path: './smoke-test.png' });
    console.log('✓ Screenshot saved');
  } catch (error) {
    console.error('✗ App failed to load:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
