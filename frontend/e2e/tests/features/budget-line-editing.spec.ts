import { test, expect } from '../../fixtures/test-fixtures';
import { createBudgetDetailsMock, createBudgetLineMock, createBudgetLineResponseMock } from '../../helpers/api-mocks';

test.describe('Budget Line Editing', () => {
  test('should edit budget line inline', async ({
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
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
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
    
    // Wait for the DOM to update with the new values
    await expect(authenticatedPage.locator('tr:has-text("' + updatedName + '")')).toBeVisible();
    
    // Verify the row contains the updated values
    const updatedRow = authenticatedPage.locator('tr').filter({ hasText: updatedName });
    await expect(updatedRow).toContainText(updatedName);
    await expect(updatedRow).toContainText('150');
  });

  test('should cancel editing without saving changes', async ({
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
    
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
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

    // Verify the original values are still displayed
    const budgetLineRow = authenticatedPage.locator('tr').filter({ hasText: originalName });
    await expect(budgetLineRow).toBeVisible();
    await expect(budgetLineRow).toContainText(originalName);
  });
});