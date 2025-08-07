import { test, expect } from '@playwright/test';

test.describe('Current Month - Delete Transactions', () => {
  test('should show delete button when transactions are selected', async ({ page }) => {
    // Navigate to the current month page (assuming user is already logged in)
    await page.goto('/current-month');
    
    // Wait for the page to load
    await page.waitForSelector('[data-testid="current-month-page"]');
    
    // Check if there are any transactions in the variable expenses list
    const transactionsList = page.locator('[data-testid="variable-expenses-list"]');
    
    // Try to find checkboxes in the transactions list
    const checkboxes = transactionsList.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 0) {
      // Select the first transaction
      await checkboxes.first().check();
      
      // Verify the delete button appears with correct count
      const deleteButton = page.locator('[data-testid="delete-selected-button"]');
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toContainText('Supprimer (1)');
      
      // Select another transaction if available
      if (checkboxCount > 1) {
        await checkboxes.nth(1).check();
        await expect(deleteButton).toContainText('Supprimer (2)');
      }
      
      // Click the delete button
      await deleteButton.click();
      
      // Verify the confirmation dialog appears
      const dialog = page.locator('mat-dialog-container');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Supprimer les transactions');
      
      // Check the correct message based on selection count
      if (checkboxCount > 1) {
        await expect(dialog).toContainText('Êtes-vous sûr de vouloir supprimer ces 2 transactions ?');
      } else {
        await expect(dialog).toContainText('Êtes-vous sûr de vouloir supprimer cette transaction ?');
      }
      
      // Verify dialog buttons
      const cancelButton = dialog.locator('button:has-text("Annuler")');
      const confirmButton = dialog.locator('button:has-text("Supprimer")');
      
      await expect(cancelButton).toBeVisible();
      await expect(confirmButton).toBeVisible();
      
      // Cancel the operation
      await cancelButton.click();
      
      // Dialog should close
      await expect(dialog).not.toBeVisible();
      
      // Selections should still be there
      await expect(deleteButton).toBeVisible();
    }
  });
  
  test('should hide bulk actions when no transactions are selected', async ({ page }) => {
    await page.goto('/current-month');
    await page.waitForSelector('[data-testid="current-month-page"]');
    
    // Initially, bulk actions should not be visible
    const bulkActions = page.locator('[data-testid="bulk-actions"]');
    await expect(bulkActions).not.toBeVisible();
    
    // Check if there are transactions to select
    const checkboxes = page.locator('[data-testid="variable-expenses-list"] input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    if (checkboxCount > 0) {
      // Select a transaction
      await checkboxes.first().check();
      
      // Bulk actions should appear
      await expect(bulkActions).toBeVisible();
      
      // Unselect the transaction
      await checkboxes.first().uncheck();
      
      // Bulk actions should disappear
      await expect(bulkActions).not.toBeVisible();
    }
  });
});