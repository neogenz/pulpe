import { test, expect } from '../../fixtures/test-fixtures';
import { createBudgetDetailsMock, createBudgetLineMock, createBudgetLineResponseMock } from '../../helpers/api-mocks';

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

    // Track whether the update has been called
    let hasBeenUpdated = false;
    
    // Mock the budget details API with a budget line using typed helper
    await authenticatedPage.route('**/budgets/*/details', (route) => {
      // Return updated data if the PATCH has been called
      const mockResponse = hasBeenUpdated
        ? createBudgetDetailsMock(budgetId, {
            budgetLines: [
              createBudgetLineMock('line-1', budgetId, {
                name: updatedName,
                amount: updatedAmount,
                recurrence: 'fixed',
              }),
            ],
          })
        : createBudgetDetailsMock(budgetId, {
            budgetLines: [
              createBudgetLineMock('line-1', budgetId, {
                name: originalName,
                amount: originalAmount,
                recurrence: 'fixed',
              }),
            ],
          });
          
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Mock the update API endpoint using typed helper
    await authenticatedPage.route('**/api/v1/budget-lines/line-1', (route) => {
      if (route.request().method() === 'PATCH') {
        // Mark that the update has been called
        hasBeenUpdated = true;
        
        const updatedBudgetLine = createBudgetLineMock('line-1', budgetId, {
          name: updatedName,
          amount: updatedAmount,
          recurrence: 'fixed',
        });
        const updateResponse = createBudgetLineResponseMock(updatedBudgetLine);
        
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updateResponse),
        });
      }
    });

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();
    
    // Wait for the table to render
    await authenticatedPage.waitForSelector('table[mat-table]');

    // Find the inputs directly using data-testid
    const nameInput = authenticatedPage.locator('[data-testid="edit-name-line-1"]');
    const amountInput = authenticatedPage.locator('[data-testid="edit-amount-line-1"]');

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

    // Save the changes using data-testid
    const saveButton = authenticatedPage.locator('[data-testid="save-line-1"]');
    await saveButton.click();

    // Wait for the API request to complete by waiting for the success message
    await expect(authenticatedPage.locator('.mat-mdc-snack-bar-label').last()).toHaveText('Prévision modifiée.');
    
    // Wait a bit more to ensure the DOM has been updated with the server response
    await authenticatedPage.waitForTimeout(500);
    
    // Since we can't find the updated row by text, let's verify by looking at the first row
    // (there should only be one row in our test)
    const firstRowNameCell = authenticatedPage.locator('table[mat-table] tbody tr').first().locator('td').nth(1);
    const firstRowAmountCell = authenticatedPage.locator('table[mat-table] tbody tr').first().locator('td').nth(3);
    
    // Verify the first row contains the updated values
    await expect(firstRowNameCell).toContainText(updatedName);
    await expect(firstRowAmountCell).toContainText('150.00');
  });

  test('should cancel inline editing without saving changes', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const originalName = 'Test Budget Line';
    const originalAmount = 100;

    // Mock the budget details API using typed helper
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock('line-1', budgetId, {
          name: originalName,
          amount: originalAmount,
          recurrence: 'fixed',
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
    
    // Wait for the table to render and for the row to be visible
    await authenticatedPage.waitForSelector('table[mat-table]');
    await authenticatedPage.waitForSelector('tr:has-text("Test Budget Line")');

    // Find and click the edit button
    const editButton = authenticatedPage.locator('button[data-testid="edit-line-1"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for edit mode to be active
    const nameInput = authenticatedPage.locator('[data-testid="edit-name-line-1"]');
    await expect(nameInput).toBeVisible();

    // Make some changes
    await nameInput.clear();
    await nameInput.fill('Changed Name That Should Not Be Saved');

    // Cancel the changes using data-testid
    const cancelButton = authenticatedPage.locator('[data-testid="cancel-line-1"]');
    await expect(cancelButton).toBeVisible();
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
    await authenticatedPage.route('**/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            budget: {
              id: budgetId,
              month: 1,
              year: 2025,
              userId: 'test-user',
              description: 'Test budget for E2E testing',
              templateId: 'test-template-123',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
            transactions: [],
            budgetLines: [
              {
                id: 'line-1',
                name: originalName,
                amount: 100,
                budgetId,
                kind: 'expense',
                recurrence: 'fixed',
                isManuallyAdjusted: false,
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

    // Find the inputs directly using data-testid
    const nameInput = authenticatedPage.locator('[data-testid="edit-name-line-1"]');
    const amountInput = authenticatedPage.locator('[data-testid="edit-amount-line-1"]');

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
    const saveButton = authenticatedPage.locator('[data-testid="save-line-1"]');
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
    await authenticatedPage.route('**/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            budget: {
              id: budgetId,
              month: 1,
              year: 2025,
              userId: 'test-user',
              description: 'Test budget for E2E testing',
              templateId: 'test-template-123',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
            transactions: [],
            budgetLines: [
              {
                id: 'line-1',
                name: 'First Budget Line',
                amount: 100,
                budgetId,
                kind: 'income',
                recurrence: 'fixed',
                isManuallyAdjusted: false,
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
                kind: 'expense',
                recurrence: 'fixed',
                isManuallyAdjusted: false,
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

    // Edit first line using data-testid
    const firstEditButton = authenticatedPage.locator('[data-testid="edit-line-1"]');  
    const firstNameInput = authenticatedPage.locator('[data-testid="edit-name-line-1"]');
    
    if (await firstEditButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstEditButton.click();
    }
    await expect(firstNameInput).toBeVisible();

    // Edit second line - this should exit edit mode on the first line
    const secondEditButton = authenticatedPage.locator('[data-testid="edit-line-2"]');
    if (await secondEditButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await secondEditButton.click();
    }
    
    // Verify first line is no longer in edit mode (component only allows one row in edit mode at a time)
    await expect(firstEditButton).toBeVisible();
    
    // Verify second line is now in edit mode
    const secondNameInput = authenticatedPage.locator('[data-testid="edit-name-line-2"]');
    await expect(secondNameInput).toBeVisible();

    // Cancel second line edit
    const cancelButton = authenticatedPage.locator('[data-testid="cancel-line-2"]');
    await cancelButton.click();
    
    // Verify second line is no longer in edit mode
    await expect(secondEditButton).toBeVisible();
  });
});