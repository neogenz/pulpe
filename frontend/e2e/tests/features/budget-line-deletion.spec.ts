import { test, expect } from '../../fixtures/test-fixtures';
import { createBudgetDetailsMock, createBudgetLineMock, TEST_UUIDS } from '../../helpers/api-mocks';

test.describe('Budget Line Deletion', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  test('should show confirmation dialog and delete budget line', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Mock budget details endpoint with typed helpers
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { month: 8, year: 2025 },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, { name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, { name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' }),
      ],
      transactions: [],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
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
    await budgetDetailsPage.switchToTableView();
    await budgetDetailsPage.expectBudgetLineVisible('Groceries');

    // Test actual deletion flow
    await budgetDetailsPage.clickDeleteBudgetLine('Groceries');
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeVisible();

    await budgetDetailsPage.confirmDelete();
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeHidden();
  });

  test('should cancel deletion when clicking cancel', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Mock budget details endpoint with typed helpers
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { month: 8, year: 2025 },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, { name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }),
      ],
      transactions: [],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      })
    );

    await budgetDetailsPage.goto();
    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.switchToTableView();
    await budgetDetailsPage.expectBudgetLineVisible('Transport');

    // Test cancellation flow
    await budgetDetailsPage.clickDeleteBudgetLine('Transport');
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeVisible();

    await budgetDetailsPage.cancelDelete();
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeHidden();
    
    // Verify line is still visible
    await budgetDetailsPage.expectBudgetLineVisible('Transport');
  });
});
