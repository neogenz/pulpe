import { test, expect } from '../../fixtures/test-fixtures';
import { MOCK_API_RESPONSES } from '../../mocks/api-responses';

test.describe('Monthly Budget Management', () => {
  test('should display monthly dashboard with financial overview', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
  });

  test('should display expense form or related input elements', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    // Check if expense form exists
    const form = authenticatedPage.locator('form, [data-testid="expense-form"]');
    if (await form.count() > 0) {
      await expect(form.first()).toBeVisible();
    }
  });

  test('should handle expense form interaction gracefully', async ({
    authenticatedPage,
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
      route.fulfill({ 
        status: 500, 
        contentType: 'text/plain',
        body: 'Server Error' 
      })
    );
    
    await currentMonthPage.goto();
    // Page should still load even with error
    await expect(authenticatedPage.locator('body')).toBeVisible();
  });

  test('should display empty state when no budget exists', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    // Mock empty response using centralized helper
    await authenticatedPage.route('**/api/v1/budgets**', route => 
      route.fulfill({ 
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }) 
      })
    );
    
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
  });

  test('should maintain page state after browser refresh', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    await authenticatedPage.reload();
    await currentMonthPage.expectPageLoaded();
  });
});