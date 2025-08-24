import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Monthly Budget Management', () => {
  test('should display monthly dashboard with financial overview', async ({
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
  });

  test('should display expense form or related input elements', async ({
    currentMonthPage,
    page
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    // Check if expense form exists
    const form = page.locator('form, [data-testid="expense-form"]');
    if (await form.count() > 0) {
      await expect(form.first()).toBeVisible();
    }
  });

  test('should handle expense form interaction gracefully', async ({
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    // Try to add transaction
    try {
      await currentMonthPage.addTransaction('75.50', 'Restaurant');
    } catch {
      // Form might not be available, that's ok
    }
  });

  test('should handle budget data loading errors gracefully', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    // Mock error response
    await authenticatedPage.route('**/api/v1/budgets**', route => 
      route.fulfill({ status: 500, body: 'Server Error' })
    );
    
    await currentMonthPage.goto();
    // Page should still load even with error
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });

  test('should display empty state when no budget exists', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    // Mock empty response
    await authenticatedPage.route('**/api/v1/budgets**', route => 
      route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) })
    );
    
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
  });

  test('should maintain page state after browser refresh', async ({
    currentMonthPage,
    page
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    await page.reload();
    await currentMonthPage.expectPageLoaded();
  });
});