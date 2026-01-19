import { test, expect } from '../fixtures/test-fixtures';
import { LoginHelper } from '../helpers/login-helper';
import { getByTestId } from '../helpers/test-id-helper';

test.describe('Budget Line Edit - Mobile', () => {
  const loginHelper = new LoginHelper();

  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE viewport
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await loginHelper.login(page, '/dashboard');
  });

  test('should open edit dialog on mobile when clicking edit button', async ({
    page,
  }) => {
    // Wait for the budget items table to load
    await page.waitForSelector('pulpe-budget-items', {
      state: 'visible',
    });

    // Check if there are any budget lines
    const hasBudgetLines = await page
      .locator('[data-testid^="edit-"]')
      .count();

    if (hasBudgetLines === 0) {
      // Add a budget line first if none exists
      await page.click('[data-testid="add-first-line"], [data-testid="add-budget-line"]');
      
      // Fill in the dialog to create a budget line
      await page.fill('[data-testid="new-line-name"]', 'Test Budget Line');
      await page.fill('[data-testid="new-line-amount"]', '100');
      await page.click('[data-testid="add-new-line"]');
      
      // Wait for the new line to appear
      await page.waitForSelector('[data-testid^="edit-"]', {
        state: 'visible',
      });
    }

    // Click on the first edit button
    const editButton = page.locator('[data-testid^="edit-"]').first();
    await editButton.click();

    // On mobile, it should open a dialog
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Check that the dialog title is correct
    const dialogTitle = dialog.locator('h2');
    await expect(dialogTitle).toHaveText('Modifier la prévision');

    // Check that all form fields are present
    await expect(dialog.locator('[data-testid="edit-line-name"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="edit-line-amount"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="edit-line-kind"]')).toBeVisible();

    // Check that cancel and save buttons are present
    await expect(dialog.locator('[data-testid="cancel-edit-line"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="save-edit-line"]')).toBeVisible();
  });

  test('should update budget line when submitting the edit dialog', async ({
    page,
  }) => {
    // Wait for the budget items table to load
    await page.waitForSelector('pulpe-budget-items', {
      state: 'visible',
    });

    // Ensure we have at least one budget line
    const hasBudgetLines = await page
      .locator('[data-testid^="edit-"]')
      .count();

    if (hasBudgetLines === 0) {
      // Add a budget line first if none exists
      await page.click('[data-testid="add-first-line"], [data-testid="add-budget-line"]');
      await page.fill('[data-testid="new-line-name"]', 'Initial Name');
      await page.fill('[data-testid="new-line-amount"]', '100');
      await page.click('[data-testid="add-new-line"]');
      await page.waitForSelector('[data-testid^="edit-"]', {
        state: 'visible',
      });
    }

    // Click on the first edit button
    const editButton = page.locator('[data-testid^="edit-"]').first();
    await editButton.click();

    // Wait for dialog
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Update the values
    const nameField = dialog.locator('[data-testid="edit-line-name"]');
    await nameField.clear();
    await nameField.fill('Updated Budget Line');

    const amountField = dialog.locator('[data-testid="edit-line-amount"]');
    await amountField.clear();
    await amountField.fill('250');

    // Submit the form
    await dialog.locator('[data-testid="save-edit-line"]').click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // Check that the table has been updated
    const table = page.locator('pulpe-budget-items');
    await expect(table).toContainText('Updated Budget Line');
    await expect(table).toContainText('250');
  });

  test('should cancel edit dialog without saving changes', async ({ page }) => {
    // Wait for the budget items table to load
    await page.waitForSelector('pulpe-budget-items', {
      state: 'visible',
    });

    // Ensure we have at least one budget line
    const hasBudgetLines = await page
      .locator('[data-testid^="edit-"]')
      .count();

    if (hasBudgetLines === 0) {
      // Add a budget line first if none exists
      await page.click('[data-testid="add-first-line"], [data-testid="add-budget-line"]');
      await page.fill('[data-testid="new-line-name"]', 'Original Name');
      await page.fill('[data-testid="new-line-amount"]', '100');
      await page.click('[data-testid="add-new-line"]');
      await page.waitForSelector('[data-testid^="edit-"]', {
        state: 'visible',
      });
    }

    // Get the original name from the table
    const table = page.locator('pulpe-budget-items');
    const originalText = await table.textContent();

    // Click on the first edit button
    const editButton = page.locator('[data-testid^="edit-"]').first();
    await editButton.click();

    // Wait for dialog
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Modify the values (but won't save)
    const nameField = dialog.locator('[data-testid="edit-line-name"]');
    await nameField.clear();
    await nameField.fill('This should not be saved');

    // Cancel the dialog
    await dialog.locator('[data-testid="cancel-edit-line"]').click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // Check that the table has NOT been updated
    const updatedText = await table.textContent();
    expect(updatedText).toBe(originalText);
  });
});

test.describe('Budget Line Edit - Desktop', () => {
  const loginHelper = new LoginHelper();

  test.use({
    viewport: { width: 1280, height: 720 }, // Desktop viewport
  });

  test.beforeEach(async ({ page }) => {
    await loginHelper.login(page, '/dashboard');
  });

  test('should use dialog editing on desktop', async ({ page }) => {
    // Wait for the budget items table to load
    await page.waitForSelector('pulpe-budget-items', {
      state: 'visible',
    });

    // Ensure we have at least one budget line
    const hasBudgetLines = await page
      .locator('[data-testid^="edit-"]')
      .count();

    if (hasBudgetLines === 0) {
      // Add a budget line first if none exists
      await page.click('[data-testid="add-first-line"], [data-testid="add-budget-line"]');
      await page.fill('[data-testid="new-line-name"]', 'Test Budget Line');
      await page.fill('[data-testid="new-line-amount"]', '100');
      await page.click('[data-testid="add-new-line"]');
      await page.waitForSelector('[data-testid^="edit-"]', {
        state: 'visible',
      });
    }

    // Click on the first edit button
    const editButton = page.locator('[data-testid^="edit-"]').first();
    await editButton.click();

    // On desktop, it should open a dialog (same as mobile after migration)
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Check that the dialog title is correct
    const dialogTitle = dialog.locator('h2');
    await expect(dialogTitle).toHaveText('Modifier la prévision');

    // Check that all form fields are present
    await expect(dialog.locator('[data-testid="edit-line-name"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="edit-line-amount"]')).toBeVisible();

    // Check that cancel and save buttons are present
    await expect(dialog.locator('[data-testid="cancel-edit-line"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="save-edit-line"]')).toBeVisible();

    // Close the dialog
    await dialog.locator('[data-testid="cancel-edit-line"]').click();
    await expect(dialog).not.toBeVisible();
  });
});