import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createBudgetLineResponseMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Budget Line Editing', () => {
  test('should edit budget line inline', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;
    const originalName = 'Test Budget Line';
    const originalAmount = 100;
    const updatedName = 'Updated Budget Line';
    const updatedAmount = 150;

    // Track whether the update has been called and validate the payload
    let hasBeenUpdated = false;
    let updatePayload: unknown = null;

    // Mock the budget details API with a budget line using typed helper
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      // Return updated data if the PATCH has been called
      const mockResponse = hasBeenUpdated
        ? createBudgetDetailsMock(budgetId, {
            budgetLines: [
              createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
                name: updatedName,
                amount: updatedAmount,
                recurrence: 'fixed',
                isManuallyAdjusted: true, // Should be true after edit
              }),
            ],
          })
        : createBudgetDetailsMock(budgetId, {
            budgetLines: [
              createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
                name: originalName,
                amount: originalAmount,
                recurrence: 'fixed',
                isManuallyAdjusted: false, // Initially false
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
    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_1}`,
      (route) => {
        if (route.request().method() === 'PATCH') {
          // Capture the update payload
          updatePayload = route.request().postDataJSON();

          // Validate that isManuallyAdjusted is set to true
          expect(updatePayload).toHaveProperty('isManuallyAdjusted', true);

          // Mark that the update has been called
          hasBeenUpdated = true;

          const updatedBudgetLine = createBudgetLineMock(
            TEST_UUIDS.LINE_1,
            budgetId,
            {
              name: updatedName,
              amount: updatedAmount,
              recurrence: 'fixed',
              isManuallyAdjusted: true, // Ensure the response reflects the update
            },
          );
          const updateResponse =
            createBudgetLineResponseMock(updatedBudgetLine);

          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(updateResponse),
          });
        }
      },
    );

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.switchToTableView();

    // Open the actions menu first
    const menuButton = authenticatedPage.locator(
      `[data-testid="actions-menu-${TEST_UUIDS.LINE_1}"]`,
    );
    await menuButton.click();

    // Click the edit menu item
    const editMenuItem = authenticatedPage
      .locator('button[mat-menu-item]')
      .filter({ hasText: 'Éditer' });
    await editMenuItem.click();

    // Wait for the edit dialog to open
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Find the inputs in the dialog using their data-testid
    const nameInput = authenticatedPage.locator(
      '[data-testid="edit-line-name"]',
    );
    const amountInput = authenticatedPage.locator(
      '[data-testid="edit-line-amount"]',
    );

    // Verify dialog inputs are visible
    await expect(nameInput).toBeVisible();
    await expect(amountInput).toBeVisible();

    // Clear and update the values
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Clear and update the amount
    await amountInput.clear();
    await amountInput.fill(updatedAmount.toString());

    // Save the changes using the dialog save button
    const saveButton = authenticatedPage.locator(
      '[data-testid="save-edit-line"]',
    );
    await saveButton.click();

    // Wait for the API request to complete by waiting for the success message
    await expect(
      authenticatedPage.locator('.mat-mdc-snack-bar-label').last(),
    ).toHaveText('Modification enregistrée');

    // Wait for the DOM to update with the new values
    await expect(
      authenticatedPage.locator('tr:has-text("' + updatedName + '")'),
    ).toBeVisible();

    // Verify the row contains the updated values
    const updatedRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: updatedName });
    await expect(updatedRow).toContainText(updatedName);
    await expect(updatedRow).toContainText('150');

    // Verify that the update payload included isManuallyAdjusted: true
    expect(updatePayload).toBeDefined();
    expect(updatePayload).toHaveProperty('isManuallyAdjusted', true);
  });

  test('should cancel editing without saving changes', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;
    const originalName = 'Test Budget Line';
    const originalAmount = 100;

    // Mock the budget details API using typed helper
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
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
    await budgetDetailsPage.switchToTableView();

    // Wait for the row to be visible
    await authenticatedPage.waitForSelector('tr:has-text("Test Budget Line")');

    // Open the actions menu first
    const menuButton = authenticatedPage.locator(
      `[data-testid="actions-menu-${TEST_UUIDS.LINE_1}"]`,
    );
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // Click the edit menu item
    const editMenuItem = authenticatedPage
      .locator('button[mat-menu-item]')
      .filter({ hasText: 'Éditer' });
    await editMenuItem.click();

    // Wait for the edit dialog to open
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Find the name input in the dialog
    const nameInput = authenticatedPage.locator(
      '[data-testid="edit-line-name"]',
    );
    await expect(nameInput).toBeVisible();

    // Make some changes
    await nameInput.clear();
    await nameInput.fill('Changed Name That Should Not Be Saved');

    // Cancel the changes using the dialog cancel button
    const cancelButton = authenticatedPage.locator(
      '[data-testid="cancel-edit-line"]',
    );
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Verify the dialog is closed
    await expect(dialog).not.toBeVisible();

    // Verify the original values are still displayed
    const budgetLineRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: originalName });
    await expect(budgetLineRow).toBeVisible();
    await expect(budgetLineRow).toContainText(originalName);
  });

  test('should show propagation locked indicator after editing template-linked line', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;
    const originalName = 'Template Linked Line';
    const updatedName = 'Modified Template Line';

    let hasBeenUpdated = false;

    // Mock budget line linked to template (templateLineId set)
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const mockResponse = hasBeenUpdated
        ? createBudgetDetailsMock(budgetId, {
            budgetLines: [
              createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
                name: updatedName,
                amount: 100,
                recurrence: 'fixed',
                templateLineId: TEST_UUIDS.TEMPLATE_1, // Linked to template
                isManuallyAdjusted: true, // Set after edit
              }),
            ],
          })
        : createBudgetDetailsMock(budgetId, {
            budgetLines: [
              createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
                name: originalName,
                amount: 100,
                recurrence: 'fixed',
                templateLineId: TEST_UUIDS.TEMPLATE_1, // Linked to template
                isManuallyAdjusted: false, // Not yet edited
              }),
            ],
          });

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Mock update endpoint
    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_1}`,
      (route) => {
        if (route.request().method() === 'PATCH') {
          hasBeenUpdated = true;

          const updatedBudgetLine = createBudgetLineMock(
            TEST_UUIDS.LINE_1,
            budgetId,
            {
              name: updatedName,
              amount: 100,
              recurrence: 'fixed',
              templateLineId: TEST_UUIDS.TEMPLATE_1,
              isManuallyAdjusted: true,
            },
          );

          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              createBudgetLineResponseMock(updatedBudgetLine),
            ),
          });
        }
      },
    );

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();
    await budgetDetailsPage.switchToTableView();

    // Initially no lock icon should be visible for this line
    const initialRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: originalName });
    await expect(initialRow).toBeVisible();
    const initialLockIcon = initialRow.locator('mat-icon:has-text("lock")');
    await expect(initialLockIcon).not.toBeVisible();

    // Open actions menu and edit
    const menuButton = authenticatedPage.locator(
      `[data-testid="actions-menu-${TEST_UUIDS.LINE_1}"]`,
    );
    await menuButton.click();

    const editMenuItem = authenticatedPage
      .locator('button[mat-menu-item]')
      .filter({ hasText: 'Éditer' });
    await editMenuItem.click();

    // Wait for dialog and update name
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    const nameInput = authenticatedPage.locator(
      '[data-testid="edit-line-name"]',
    );
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Save changes
    const saveButton = authenticatedPage.locator(
      '[data-testid="save-edit-line"]',
    );
    await saveButton.click();

    // Wait for success
    await expect(
      authenticatedPage.locator('.mat-mdc-snack-bar-label').last(),
    ).toHaveText('Modification enregistrée');

    // After edit, lock icon should be visible
    const updatedRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: updatedName });
    await expect(updatedRow).toBeVisible();

    const lockIcon = updatedRow.locator('mat-icon:has-text("lock")');
    await expect(lockIcon).toBeVisible();
  });
});
