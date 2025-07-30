import { test, expect } from '../../fixtures/test-fixtures';
import { createBudgetDetailsMock, createBudgetLineMock } from '../../helpers/api-mocks';

test.describe('Budget Line Deletion Dialog', () => {
  test('should show confirmation dialog when clicking delete button', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    // Mock the budget details API with a budget line using typed helper
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock('line-1', budgetId, {
          name: 'Test Budget Line',
          amount: 100,
          recurrence: 'one_off',
        }),
      ],
    });
    
    await authenticatedPage.route('**/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
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
