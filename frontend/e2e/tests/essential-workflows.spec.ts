import { test, expect } from '../fixtures/test-fixtures';

test.describe('Essential Workflows', () => {
  
  test('User can navigate main sections', async ({ authenticatedPage, currentMonthPage }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    // Navigate to templates
    await authenticatedPage.goto('/budget-templates');
    await expect(authenticatedPage.locator('body')).toBeVisible();
    
    // Navigate back to current month
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
  });

  test('User can access budget templates', async ({ authenticatedPage, budgetTemplatesPage }) => {
    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectPageLoaded();
    expect(authenticatedPage.url()).toContain('/budget-templates');
  });

  test('User can view current month', async ({ authenticatedPage, currentMonthPage }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    expect(authenticatedPage.url()).toContain('/dashboard');
  });

  test('User can logout', async ({ authenticatedPage, mainLayoutPage }) => {
    await authenticatedPage.goto('/dashboard');
    await mainLayoutPage.performLogout();
    await mainLayoutPage.expectLogoutSuccess();
  });
});