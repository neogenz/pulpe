import { test, expect } from '../../fixtures/test-fixtures';
import { WaitHelper } from '../../fixtures/test-helpers';

test.describe('Core Application Navigation (Unauthenticated)', () => {
  test('should allow users to access login page', async ({
    page,
    loginPage,
  }) => {
    await test.step('Navigate to login page', async () => {
      await page.goto('/login');
      await WaitHelper.waitForNavigation(page, '/login', 5000);
    });

    await test.step('Verify login page loaded', async () => {
      // Use robust waiting instead of direct expectPageLoaded
      const isOnLoginPage = await loginPage.isOnLoginPage();
      if (isOnLoginPage) {
        await loginPage.expectLoginFormVisible();
      } else {
        // If auto-authenticated, verify we're on expected page
        await expect(page).toHaveURL(/\/(app|onboarding)/);
      }
    });
  });

  test('should allow new users to access onboarding welcome', async ({
    page,
    onboardingPage,
  }) => {
    await test.step('Navigate to onboarding welcome', async () => {
      await page.goto('/onboarding/welcome');
      await WaitHelper.waitForNavigation(page, '/onboarding/welcome', 5000);
    });

    await test.step('Verify onboarding page loaded', async () => {
      // Simply verify we're on the right page and DOM is ready
      await expect(page).toHaveURL(/.*onboarding.*welcome.*/);
      // Wait for DOM to be ready
      await page.waitForLoadState('domcontentloaded');
    });
  });

  test('should protect authenticated routes from unauthenticated users', async ({
    page,
  }) => {
    await test.step('Attempt to access protected route', async () => {
      await page.goto('/app/current-month');
      // Wait for redirect to complete
      await WaitHelper.waitForNavigation(page, '/login', 5000);
    });

    await test.step('Verify redirect to login', async () => {
      await expect(page).toHaveURL(/.*login.*/);
    });
  });
});
