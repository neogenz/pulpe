import { test, expect } from '@playwright/test';

test.describe('Authenticated Session Management', () => {
  test('should redirect authenticated users from login page', async ({
    page,
  }) => {
    await page.goto('/login');
    // Should redirect to the main app dashboard
    await expect(page).toHaveURL(/.*current-month/);
    await expect(page.locator('h1')).not.toContainText('Login');
  });

  test('should maintain authentication across different sections', async ({
    page,
  }) => {
    const appRoutes = ['/app/current-month', '/app/budget-templates'];

    for (const route of appRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace('/app', '')));
      // Verify page loads successfully (not redirected to login)
      await expect(page.locator('h1:has-text("Login")')).toHaveCount(0);
    }
  });

  test('should maintain user session across page refreshes', async ({
    page,
  }) => {
    await page.goto('/app/current-month');
    await expect(page).toHaveURL(/.*current-month/);

    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });

    // Should remain authenticated and on same page
    await expect(page).toHaveURL(/.*current-month/);
    await expect(page.locator('h1:has-text("Login")')).toHaveCount(0);
  });

  test('should allow user to log out successfully', async ({ page }) => {
    await page.goto('/app/current-month');

    // Click logout button
    // This selector needs to be adapted to your application's logout button
    await page
      .locator(
        '[data-testid="logout-button"], a:has-text("Logout"), button:has-text("Déconnexion")',
      )
      .click();

    // Should be redirected to the login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1, h2')).toContainText(['Connexion']);
  });
});
