import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Line Inline Editing', () => {
  test('should allow inline editing of budget lines', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const originalName = 'Test Budget Line';
    const originalAmount = 100;
    const updatedName = 'Updated Budget Line';
    const updatedAmount = 150;

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
                name: originalName,
                amount: originalAmount,
                budgetId,
                kind: 'FIXED_EXPENSE',
                recurrence: 'fixed',
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

    // Mock the update API endpoint
    await authenticatedPage.route('**/api/budget-lines/line-1', (route) => {
      if (route.request().method() === 'PATCH') {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'line-1',
            name: updatedName,
            amount: updatedAmount,
            budgetId,
            kind: 'FIXED_EXPENSE',
            recurrence: 'fixed',
            templateLineId: null,
            savingsGoalId: null,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          }),
        });
      }
    });

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.expectBudgetLineVisible(originalName);

    // Find the budget line row
    const budgetLineRow = authenticatedPage.locator('tr', { hasText: originalName });
    
    // Click the edit button
    await budgetLineRow.locator('button[aria-label*="Edit"]').click();

    // Verify we're in edit mode
    await expect(budgetLineRow.locator('input[name="name"]')).toBeVisible();
    await expect(budgetLineRow.locator('input[name="amount"]')).toBeVisible();

    // Clear and update the name
    const nameInput = budgetLineRow.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Clear and update the amount
    const amountInput = budgetLineRow.locator('input[name="amount"]');
    await amountInput.clear();
    await amountInput.fill(updatedAmount.toString());

    // Save the changes
    await budgetLineRow.locator('button:has(mat-icon:text("check"))').click();

    // Verify the update was successful
    await expect(authenticatedPage.locator('.mat-mdc-snack-bar-label')).toHaveText('Prévision modifiée.');
    
    // Verify the values are updated in the table
    await expect(budgetLineRow.locator('td').nth(0)).toContainText(updatedName);
    await expect(budgetLineRow.locator('td').nth(1)).toContainText('150.00');
  });

  test('should cancel inline editing without saving changes', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const originalName = 'Test Budget Line';
    const originalAmount = 100;

    // Mock the budget details API
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
                name: originalName,
                amount: originalAmount,
                budgetId,
                kind: 'FIXED_EXPENSE',
                recurrence: 'fixed',
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
    await budgetDetailsPage.expectBudgetLineVisible(originalName);

    // Find the budget line row
    const budgetLineRow = authenticatedPage.locator('tr', { hasText: originalName });
    
    // Click the edit button
    await budgetLineRow.locator('button[aria-label*="Edit"]').click();

    // Verify we're in edit mode
    await expect(budgetLineRow.locator('input[name="name"]')).toBeVisible();

    // Make some changes
    const nameInput = budgetLineRow.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill('Changed Name That Should Not Be Saved');

    // Cancel the changes
    await budgetLineRow.locator('button:has(mat-icon:text("close"))').click();

    // Verify we're no longer in edit mode
    await expect(budgetLineRow.locator('input[name="name"]')).not.toBeVisible();

    // Verify the original values are still displayed
    await expect(budgetLineRow.locator('td').nth(0)).toContainText(originalName);
  });

  test('should validate input fields during inline editing', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const originalName = 'Test Budget Line';

    // Mock the budget details API
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
                name: originalName,
                amount: 100,
                budgetId,
                kind: 'FIXED_EXPENSE',
                recurrence: 'fixed',
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
    await budgetDetailsPage.expectBudgetLineVisible(originalName);

    // Find the budget line row
    const budgetLineRow = authenticatedPage.locator('tr', { hasText: originalName });
    
    // Click the edit button
    await budgetLineRow.locator('button[aria-label*="Edit"]').click();

    // Try to save with empty name
    const nameInput = budgetLineRow.locator('input[name="name"]');
    await nameInput.clear();

    // The save button should be disabled
    const saveButton = budgetLineRow.locator('button:has(mat-icon:text("check"))');
    await expect(saveButton).toBeDisabled();

    // Fill valid name but invalid amount
    await nameInput.fill('Valid Name');
    const amountInput = budgetLineRow.locator('input[name="amount"]');
    await amountInput.clear();
    await amountInput.fill('-100'); // Negative amount

    // The save button should still be disabled
    await expect(saveButton).toBeDisabled();

    // Fill valid values
    await amountInput.clear();
    await amountInput.fill('200');

    // Now the save button should be enabled
    await expect(saveButton).toBeEnabled();
  });

  test('should handle multiple budget lines in edit mode', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';

    // Mock the budget details API with multiple budget lines
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
                name: 'First Budget Line',
                amount: 100,
                budgetId,
                kind: 'INCOME',
                recurrence: 'fixed',
                templateLineId: null,
                savingsGoalId: null,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
              },
              {
                id: 'line-2',
                name: 'Second Budget Line',
                amount: 200,
                budgetId,
                kind: 'FIXED_EXPENSE',
                recurrence: 'fixed',
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

    // Find both budget line rows
    const firstRow = authenticatedPage.locator('tr', { hasText: 'First Budget Line' });
    const secondRow = authenticatedPage.locator('tr', { hasText: 'Second Budget Line' });

    // Edit first line
    await firstRow.locator('button[matTooltip="Modifier"]').click();
    await expect(firstRow.locator('input[name="name"]')).toBeVisible();

    // Edit second line (both should be in edit mode)
    await secondRow.locator('button[matTooltip="Modifier"]').click();
    await expect(secondRow.locator('input[name="name"]')).toBeVisible();

    // Both should still be in edit mode
    await expect(firstRow.locator('input[name="name"]')).toBeVisible();
    await expect(secondRow.locator('input[name="name"]')).toBeVisible();

    // Cancel first line
    await firstRow.locator('button:has(mat-icon:text("close"))').click();
    await expect(firstRow.locator('input[name="name"]')).not.toBeVisible();

    // Second line should still be in edit mode
    await expect(secondRow.locator('input[name="name"]')).toBeVisible();
  });
});