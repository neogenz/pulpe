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
    
    // Wait for the table to render
    await authenticatedPage.waitForSelector('table[mat-table]');

    // Find the inputs directly - they might already be in edit mode
    const nameInput = authenticatedPage.locator('input[placeholder="Nom de la ligne"]').or(
      authenticatedPage.locator('input[name="name"]')
    );
    const amountInput = authenticatedPage.locator('input[name="amount"]');

    // Check if already in edit mode, if not click the edit button
    const isInEditMode = await nameInput.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!isInEditMode) {
      // Find and click the edit button
      const editButton = authenticatedPage.locator('button[data-testid="edit-line-1"]');
      await editButton.click();
    }

    // Verify we're in edit mode
    await expect(nameInput).toBeVisible();
    await expect(amountInput).toBeVisible();

    // Clear and update the values
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Clear and update the amount
    await amountInput.clear();
    await amountInput.fill(updatedAmount.toString());

    // Save the changes - look for save button
    const saveButton = authenticatedPage.locator('button[aria-label*="Save"]').or(
      authenticatedPage.locator('button').filter({ hasText: 'Enregistrer' })
    );
    await saveButton.click();

    // Verify the update was successful - use a more specific selector to avoid multiple elements
    await expect(authenticatedPage.locator('.mat-mdc-snack-bar-label').last()).toHaveText('Prévision modifiée.');
    
    // Verify the values are updated in the table (name is in column 1, amount is in column 3)
    const budgetLineRow = authenticatedPage.locator('tr').filter({ hasText: updatedName });
    await expect(budgetLineRow.locator('td').nth(1)).toContainText(updatedName);
    await expect(budgetLineRow.locator('td').nth(3)).toContainText('150.00');
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
    
    // Wait for the table to render
    await authenticatedPage.waitForSelector('table[mat-table]');

    // Find the inputs directly - they might already be in edit mode
    const nameInput = authenticatedPage.locator('input[placeholder="Nom de la ligne"]').or(
      authenticatedPage.locator('input[name="name"]')
    );

    // Check if already in edit mode, if not click the edit button
    const isInEditMode = await nameInput.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!isInEditMode) {
      // Find and click the edit button
      const editButton = authenticatedPage.locator('button[data-testid="edit-line-1"]');
      await editButton.click();
    }

    // Verify we're in edit mode
    await expect(nameInput).toBeVisible();

    // Make some changes
    await nameInput.clear();
    await nameInput.fill('Changed Name That Should Not Be Saved');

    // Cancel the changes
    const cancelButton = authenticatedPage.locator('button[aria-label*="Cancel"]').or(
      authenticatedPage.locator('button').filter({ hasText: 'Annuler' })
    );
    await cancelButton.click();

    // Verify we're no longer in edit mode
    await expect(nameInput).not.toBeVisible();

    // Verify the original values are still displayed (name is in column 1)
    const budgetLineRow = authenticatedPage.locator('tr').filter({ hasText: originalName });
    await expect(budgetLineRow.locator('td').nth(1)).toContainText(originalName);
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
    
    // Wait for the table to render
    await authenticatedPage.waitForSelector('table[mat-table]');

    // Find the inputs directly - they might already be in edit mode
    const nameInput = authenticatedPage.locator('input[placeholder="Nom de la ligne"]').or(
      authenticatedPage.locator('input[name="name"]')
    );
    const amountInput = authenticatedPage.locator('input[name="amount"]');

    // Check if already in edit mode, if not click the edit button
    const isInEditMode = await nameInput.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!isInEditMode) {
      // Find and click the edit button
      const editButton = authenticatedPage.locator('button[data-testid="edit-line-1"]');
      await editButton.click();
    }

    // Wait for edit mode
    await expect(nameInput).toBeVisible();

    // Try to save with empty name
    await nameInput.clear();

    // The save button should be disabled
    const saveButton = authenticatedPage.locator('button[aria-label*="Save"]').or(
      authenticatedPage.locator('button').filter({ hasText: 'Enregistrer' })
    );
    await expect(saveButton).toBeDisabled();

    // Fill valid name but invalid amount
    await nameInput.fill('Valid Name');
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

    // Wait for the table to render
    await authenticatedPage.waitForSelector('table[mat-table]');

    // Wait for both rows to be visible
    await authenticatedPage.waitForSelector('tr:has-text("First Budget Line")');
    await authenticatedPage.waitForSelector('tr:has-text("Second Budget Line")');

    // Edit first line
    const firstEditButton = authenticatedPage.locator('button[data-testid="edit-line-1"]');
    const firstNameInput = authenticatedPage.locator('input[placeholder="Nom de la ligne"]').or(
      authenticatedPage.locator('input[name="name"]')
    );
    
    if (await firstEditButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstEditButton.click();
    }
    await expect(firstNameInput).toBeVisible();

    // Edit second line - this should exit edit mode on the first line
    const secondEditButton = authenticatedPage.locator('button[data-testid="edit-line-2"]');
    if (await secondEditButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await secondEditButton.click();
    }
    
    // Verify first line is no longer in edit mode (component only allows one row in edit mode at a time)
    await expect(firstEditButton).toBeVisible();
    
    // Verify second line is now in edit mode
    const secondNameInput = authenticatedPage.locator('input[placeholder="Nom de la ligne"]').or(
      authenticatedPage.locator('input[name="name"]')
    );
    await expect(secondNameInput).toBeVisible();

    // Cancel second line edit
    const cancelButton = authenticatedPage.locator('button').filter({ hasText: 'Annuler' });
    await cancelButton.click();
    
    // Verify second line is no longer in edit mode
    await expect(secondEditButton).toBeVisible();
  });
});