import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Line Deletion', () => {
  test('should show confirmation dialog and delete budget line', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Mock budget details endpoint with correct structure
    await authenticatedPage.route('**/api/v1/budgets/*/details', route => 
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            budget: {
              id: 'test-budget-123',
              name: 'Test Budget',
              month: 8,
              year: 2025
            },
            budgetLines: [
              { id: 'line-1', name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' },
              { id: 'line-2', name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' }
            ],
            transactions: []
          }
        })
      })
    );

    // Mock successful deletion
    await authenticatedPage.route('**/api/v1/budget-lines/*', route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      }
    });

    await budgetDetailsPage.goto();
    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.expectBudgetLineVisible('Groceries');

    // Test actual deletion flow
    await budgetDetailsPage.clickDeleteBudgetLine('Groceries');
    await expect(authenticatedPage.getByTestId('delete-confirmation-dialog')).toBeVisible();
    
    await budgetDetailsPage.confirmDelete();
    await expect(authenticatedPage.getByTestId('delete-confirmation-dialog')).toBeHidden();
  });

  test('should cancel deletion when clicking cancel', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Mock budget details endpoint with correct structure
    await authenticatedPage.route('**/api/v1/budgets/*/details', route => 
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            budget: {
              id: 'test-budget-123',
              name: 'Test Budget',
              month: 8,
              year: 2025
            },
            budgetLines: [
              { id: 'line-1', name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }
            ],
            transactions: []
          }
        })
      })
    );

    await budgetDetailsPage.goto();
    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.expectBudgetLineVisible('Transport');

    // Test cancellation flow
    await budgetDetailsPage.clickDeleteBudgetLine('Transport');
    await expect(authenticatedPage.getByTestId('delete-confirmation-dialog')).toBeVisible();
    
    await budgetDetailsPage.cancelDelete();
    await expect(authenticatedPage.getByTestId('delete-confirmation-dialog')).toBeHidden();
    
    // Verify line is still visible
    await budgetDetailsPage.expectBudgetLineVisible('Transport');
  });
});