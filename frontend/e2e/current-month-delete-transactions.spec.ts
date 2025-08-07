import { test, expect } from '@playwright/test';

test.describe('Current Month - Delete Transaction', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the current month page
    await page.goto('/current-month');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="current-month-page"]');
  });

  test('should show delete button on each transaction', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForSelector('[data-testid="variable-expenses-list"]');
    
    // Check that delete buttons are visible on transactions
    const deleteButtons = await page.locator('[data-testid^="delete-transaction-"]').all();
    
    // Should have at least one delete button if there are transactions
    const transactionItems = await page.locator('[data-testid="variable-expenses-list"] .mat-mdc-list-item').count();
    if (transactionItems > 0) {
      expect(deleteButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBe(transactionItems);
    }
  });

  test('should show confirmation dialog when clicking delete', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForSelector('[data-testid="variable-expenses-list"]');
    
    // Find the first delete button
    const firstDeleteButton = page.locator('[data-testid^="delete-transaction-"]').first();
    
    // Check if delete button exists (there might be no transactions)
    const buttonCount = await firstDeleteButton.count();
    if (buttonCount === 0) {
      test.skip();
      return;
    }
    
    // Get the transaction name for verification
    const transactionName = await page.locator('[data-testid="variable-expenses-list"] .mat-mdc-list-item').first()
      .locator('[matlistitemtitle]').textContent();
    
    // Click the delete button
    await firstDeleteButton.click();
    
    // Check that confirmation dialog appears
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await expect(page.locator('mat-dialog-container')).toContainText('Supprimer la transaction');
    
    // Check that the transaction name is mentioned in the dialog
    if (transactionName) {
      await expect(page.locator('mat-dialog-container')).toContainText(transactionName);
    }
    
    // Check dialog buttons
    await expect(page.locator('button:has-text("Supprimer")')).toBeVisible();
    await expect(page.locator('button:has-text("Annuler")')).toBeVisible();
  });

  test('should cancel deletion when clicking cancel in dialog', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForSelector('[data-testid="variable-expenses-list"]');
    
    // Count initial transactions
    const initialCount = await page.locator('[data-testid="variable-expenses-list"] .mat-mdc-list-item').count();
    
    if (initialCount === 0) {
      test.skip();
      return;
    }
    
    // Click the first delete button
    await page.locator('[data-testid^="delete-transaction-"]').first().click();
    
    // Wait for dialog and click cancel
    await page.waitForSelector('mat-dialog-container');
    await page.locator('button:has-text("Annuler")').click();
    
    // Wait for dialog to close
    await expect(page.locator('mat-dialog-container')).not.toBeVisible();
    
    // Check that transaction count is unchanged
    const finalCount = await page.locator('[data-testid="variable-expenses-list"] .mat-mdc-list-item').count();
    expect(finalCount).toBe(initialCount);
  });

  test('should not show bulk delete actions', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('[data-testid="current-month-page"]');
    
    // Check that bulk actions are not present
    await expect(page.locator('[data-testid="bulk-actions"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="delete-selected-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="merge-selected-button"]')).not.toBeVisible();
  });

  test('should not allow selection of transactions', async ({ page }) => {
    // Wait for transactions to load
    await page.waitForSelector('[data-testid="variable-expenses-list"]');
    
    // Check that checkboxes are not present
    const checkboxes = await page.locator('[data-testid="variable-expenses-list"] mat-checkbox').count();
    expect(checkboxes).toBe(0);
    
    // Also check for input checkboxes
    const inputCheckboxes = await page.locator('[data-testid="variable-expenses-list"] input[type="checkbox"]').count();
    expect(inputCheckboxes).toBe(0);
  });
});