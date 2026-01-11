import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Core Application Navigation (Unauthenticated)', () => {
  test('should show login form when accessing login page', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('should show welcome page for unauthenticated users', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page).toHaveURL(/.*welcome.*/);
    await expect(page.getByTestId('welcome-page')).toBeVisible();
  });

  test('should redirect unauthenticated users to welcome page', async ({ page }) => {
    await page.goto('/app/current-month');
    await expect(page).toHaveURL(/.*welcome.*/);
  });
});

test.describe('Core Application Navigation (Authenticated)', () => {
  test('should allow access to current month page', async ({ authenticatedPage, currentMonthPage }) => {
    await currentMonthPage.goto();
    await expect(authenticatedPage).toHaveURL(/\/current-month/);
  });

  test('should allow access to budget templates', async ({ authenticatedPage, budgetTemplatesPage }) => {
    await budgetTemplatesPage.goto();
    await expect(authenticatedPage).toHaveURL(/\/budget-templates/);
  });

  test('should show user menu and allow logout', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/app/current-month');
    await expect(authenticatedPage.getByTestId('user-menu-trigger')).toBeVisible();
    
    await authenticatedPage.getByTestId('user-menu-trigger').click();
    await expect(authenticatedPage.getByTestId('logout-button')).toBeVisible();
    
    await authenticatedPage.getByTestId('logout-button').click();
    await expect(authenticatedPage).toHaveURL(/.*login.*|.*welcome.*/);
  });
});