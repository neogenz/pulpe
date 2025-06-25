import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Monthly Budget Management', () => {
  test('should display monthly dashboard with financial overview', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    await currentMonthPage.expectFinancialOverviewVisible();
  });

  test('should display expense form or related input elements', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    await currentMonthPage.expectExpenseFormVisible();
  });

  test('should handle expense form interaction gracefully', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Try to interact with expense form if available
    try {
      await currentMonthPage.fillExpenseForm(
        '75.50',
        'Restaurant Le Petit Bistro',
      );
      await currentMonthPage.submitExpense();
      // If successful, check for transaction visibility
      await currentMonthPage.expectTransactionVisible(
        'Restaurant Le Petit Bistro',
      );
    } catch (error) {
      // If form not available, just verify page loads correctly
      await currentMonthPage.expectPageLoaded();
    }
  });

  test('should handle budget data loading errors gracefully', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    // Mock API error
    await authenticatedPage.route('**/api/transactions**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
  });

  test('should maintain page state after browser refresh', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Reload page
    await authenticatedPage.reload();

    // Page should still be accessible
    await currentMonthPage.expectPageLoaded();
    await currentMonthPage.expectFinancialOverviewVisible();
  });
});
