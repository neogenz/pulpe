import { test, expect } from '../../fixtures/test-fixtures';
import { setupDemoBypass } from '../../utils/demo-bypass';
import { setupAuthBypass } from '../../utils/auth-bypass';

/**
 * Demo Mode Tests
 *
 * Tests the E2E demo bypass mechanism and demo mode functionality.
 *
 * Note: These tests validate the __E2E_DEMO_BYPASS__ mechanism that allows
 * E2E tests to skip Turnstile verification and backend calls.
 */
test.describe('Demo Mode', () => {
  test.describe.configure({ mode: 'parallel' });

  test('should inject demo bypass flags correctly', async ({ page }) => {
    // Setup demo bypass
    await setupDemoBypass(page, {
      userId: 'test-demo-123',
      userEmail: 'demo@test.local',
    });

    // Navigate to any page
    await page.goto('/onboarding/welcome');

    // Verify the bypass flags were injected
    const bypassFlags = await page.evaluate(() => {
      const w = window as any;
      return {
        demoBypass: w.__E2E_DEMO_BYPASS__,
        demoSession: w.__E2E_DEMO_SESSION__,
      };
    });

    expect(bypassFlags.demoBypass).toBe(true);
    expect(bypassFlags.demoSession).toBeDefined();
    expect(bypassFlags.demoSession.user.id).toBe('test-demo-123');
    expect(bypassFlags.demoSession.user.email).toBe('demo@test.local');
  });

  test('should show demo data from API', async ({ authenticatedPage }) => {
    // Setup demo bypass on authenticated page
    await setupDemoBypass(authenticatedPage, {
      userId: 'demo-data-test',
      userEmail: 'demo-data@test.local',
    });

    // Navigate to dashboard
    await authenticatedPage.goto('/app/current-month');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // IMPORTANT: Verify we're actually on the protected route (not redirected)
    await expect(authenticatedPage).toHaveURL(/\/app\/current-month/, {
      timeout: 5000,
    });

    // Wait for API calls to complete
    await authenticatedPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      // Ignore timeout - networkidle may not be reached with mocks
    });

    // Verify page has loaded content (budget data should be visible)
    const pageContent = authenticatedPage.locator('body');
    await expect(pageContent).toContainText(/(CHF|budget|disponible|dépens)/i, {
      timeout: 5000,
    });
  });

  test('should work with authenticatedPage fixture', async ({ authenticatedPage }) => {
    // Setup demo bypass on authenticated page
    await setupDemoBypass(authenticatedPage, {
      userId: 'demo-auth-test',
      userEmail: 'demo-auth@test.local',
    });

    // Navigate to dashboard
    await authenticatedPage.goto('/app/current-month');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify page loads successfully with both bypasses
    await expect(authenticatedPage.locator('body')).toContainText(/(CHF|budget|pulpe)/i, {
      timeout: 10000,
    });

    // Verify demo flags are accessible
    const hasDemoBypass = await authenticatedPage.evaluate(() => {
      return !!(window as any).__E2E_DEMO_BYPASS__;
    });
    expect(hasDemoBypass).toBe(true);
  });
});
