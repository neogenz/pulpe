import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Line Deletion Dialog', () => {
  test('should show confirmation dialog when clicking delete button', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    // Mock the budget details API with a budget line
    await authenticatedPage.route('**/api/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            budget: {
              id: budgetId,
              month: 1,
              year: 2025,
              userId: 'test-user',
              description: 'Test budget for E2E testing',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
            budgetLines: [
              {
                id: 'line-1',
                name: 'Test Budget Line',
                amount: 100,
                budgetId,
                kind: 'expense',
                recurrence: 'once',
                templateLineId: null,
                savingsGoalId: null,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
              },
            ],
          },
        }),
      });
    });

    await budgetDetailsPage.goto(budgetId);

    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.expectBudgetLineVisible('Test Budget Line');

    // Utilisez la méthode du Page Object pour l'interaction
    await budgetDetailsPage.clickDeleteBudgetLine();

    // Utilisez les méthodes du Page Object pour les assertions
    await expect(budgetDetailsPage.getDialog()).toBeVisible();
    await expect(budgetDetailsPage.getDialogTitle()).toHaveText(
      'Supprimer la prévision',
    );
    await expect(budgetDetailsPage.getDialogMessage()).toHaveText(
      'Êtes-vous sûr de vouloir supprimer cette prévision ?',
    );
    await expect(budgetDetailsPage.getCancelButton()).toBeVisible();
    await expect(budgetDetailsPage.getConfirmDeleteButton()).toBeVisible();
  });
});
