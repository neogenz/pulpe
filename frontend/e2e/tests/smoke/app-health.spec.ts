import { test, expect } from '@playwright/test';
import type { Request } from '@playwright/test';

/**
 * Smoke Tests: App Health Check
 *
 * These basic tests verify that the application can start and basic functionality works.
 * They should run quickly and catch fundamental issues that would prevent the app from working.
 */

test.describe('App Health Check', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start with a clean state
    await page.goto('/');
  });

  test('application loads without errors', async ({ page }) => {
    // Check that the page loads and doesn't have any console errors
    const errors: string[] = [];
    page.on('pageerror', (error: Error) => {
      errors.push(error.message);
    });

    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Should not have any JavaScript errors
    expect(errors).toHaveLength(0);

    // Should have basic Angular app structure (pulpe-root, not app-root)
    await expect(page.locator('pulpe-root')).toBeVisible();
  });

  test('redirects to onboarding for new users', async ({ page }) => {
    await page.goto('/');

    // Should be redirected to onboarding welcome page for new users
    await expect(page).toHaveURL(/\/onboarding\/welcome/);

    // Should have some content on the page (any visible element)
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Page should not be completely empty
    const pageText = await page.textContent('body');
    expect(pageText?.trim().length).toBeGreaterThan(0);
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');

    // Should navigate to login page
    await expect(page).toHaveURL(/\/login/);

    // Should have login elements
    const loginContainer = page.locator(
      '[data-testid="login-container"], .login-container, form, main',
    );
    await expect(loginContainer).toBeVisible();
  });

  test('static assets load correctly (allowing for some dynamic chunks)', async ({
    page,
  }) => {
    // Track failed network requests
    const failedRequests: string[] = [];
    page.on('requestfailed', (request: Request) => {
      failedRequests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should not have failed requests for critical assets (excluding dynamic chunks which can fail)
    const criticalAssetFailures = failedRequests.filter((url) => {
      // Allow chunk files to fail as they might be from previous builds
      if (url.includes('chunk-') && url.includes('.js')) {
        return false;
      }
      // Allow Angular Material and deps to fail as they might be dynamically loaded
      if (url.includes('@angular_material') || url.includes('/deps/')) {
        return false;
      }
      // Allow vite hot module replacement to fail
      if (url.includes('@vite') || url.includes('/@fs/')) {
        return false;
      }
      // Allow config files to fail as they might be dynamically loaded
      if (url.includes('config.json')) {
        return false;
      }
      // Allow animation files to fail as they are optional
      if (url.includes('lottie') || url.includes('animation')) {
        return false;
      }
      // Only critical are main app files and favicon
      return (
        url.includes('.css') ||
        url.includes('.ico') ||
        (url.includes('.js') && !url.includes('chunk-') && !url.includes('/@'))
      );
    });

    expect(criticalAssetFailures).toHaveLength(0);
  });

  test('can handle basic routing', async ({ page }) => {
    await page.goto('/');

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Try navigating to different routes that should exist
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/onboarding/);

    // Should not show 404 or error pages
    const errorText = page.locator('text=/404|not found|error/i');
    await expect(errorText).not.toBeVisible();
  });

  test('application is responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Should still load without issues
    await page.waitForLoadState('networkidle');
    await expect(page.locator('pulpe-root')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();

    await page.waitForLoadState('networkidle');
    await expect(page.locator('pulpe-root')).toBeVisible();
  });
});
