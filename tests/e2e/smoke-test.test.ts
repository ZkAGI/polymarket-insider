import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('should load the homepage successfully', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check that the page loads
    await expect(page).toHaveTitle(/Polymarket Tracker/);

    // Check that key elements are visible
    await expect(page.locator('h1')).toContainText('Polymarket Tracker');
    await expect(page.locator('a[data-testid="dashboard-link"]')).toBeVisible();
  });

  test('should navigate to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Click the dashboard link
    await page.click('a[data-testid="dashboard-link"]');

    // Wait for navigation
    await page.waitForURL('**/dashboard');

    // Should be on dashboard page
    expect(page.url()).toContain('/dashboard');
  });
});
