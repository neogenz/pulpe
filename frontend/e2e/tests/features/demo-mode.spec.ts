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
    await page.goto('/welcome');

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
    await authenticatedPage.goto('/app/current-month', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // IMPORTANT: Verify we're actually on the protected route (not redirected)
    await expect(authenticatedPage).toHaveURL(/\/app\/current-month/, {
      timeout: 5000,
    });

    // Verify page has loaded content (Playwright will auto-wait)
    await expect(authenticatedPage.getByTestId('current-month-page')).toBeVisible();
  });

  test('should work with authenticatedPage fixture', async ({ authenticatedPage }) => {
    // Setup demo bypass on authenticated page
    await setupDemoBypass(authenticatedPage, {
      userId: 'demo-auth-test',
      userEmail: 'demo-auth@test.local',
    });

    // Navigate to dashboard
    await authenticatedPage.goto('/app/current-month', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Verify page loads successfully
    await expect(authenticatedPage.getByTestId('current-month-page')).toBeVisible();

    // Verify demo flags are accessible
    const hasDemoBypass = await authenticatedPage.evaluate(() => {
      const w = window as unknown as import('../../types/e2e.types').E2EWindow;
      return !!w.__E2E_DEMO_BYPASS__;
    });
    expect(hasDemoBypass).toBe(true);
  });
});
