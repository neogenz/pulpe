import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Core Application Navigation (Unauthenticated)', () => {
  test('should allow users to access login page', async ({
    page,
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.expectPageLoaded();
    await loginPage.expectLoginFormVisible();
  });

  test('should allow new users to access onboarding welcome', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.goto();
    await onboardingPage.expectPageLoaded();
  });

  test('should protect authenticated routes from unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/app/current-month');
    await expect(page).toHaveURL(/.*login.*/);
  });
});
