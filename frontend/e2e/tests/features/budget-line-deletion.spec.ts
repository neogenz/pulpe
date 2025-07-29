import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Line Deletion Dialog', () => {
  test('should show confirmation dialog when clicking delete button', async ({
    authenticatedPage,
  }) => {
    // Mock the budget details API with a budget line
    await authenticatedPage.route('**/api/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            budget: {
              id: 'test-budget-123',
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
                budgetId: 'test-budget-123',
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

    // Navigate directly to the budget details page
    await authenticatedPage.goto('/app/budget/test-budget-123');
    await authenticatedPage.waitForLoadState('networkidle');

    // Find and click the delete button
    const deleteButton = authenticatedPage.locator(
      '[data-testid="delete-line-1"]',
    );
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    await deleteButton.click();

    // Verify dialog appears
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog content
    await expect(dialog.locator('h2')).toContainText('Supprimer');
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Supprimer' }),
    ).toBeVisible();
  });
});
