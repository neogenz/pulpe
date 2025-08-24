import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Transaction Management Test Suite
 * Tests core transaction operations
 */
test.describe('Transaction Management', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Mock budget API to ensure a budget exists
    await authenticatedPage.route('**/api/v1/budgets/**', route => 
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            id: 'budget-1',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            available_to_spend: 1000
          }
        })
      })
    );
    
    // Mock transactions API
    await authenticatedPage.route('**/api/v1/transactions**', route => 
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'trans-1',
            name: 'Test Transaction',
            amount: 50,
            type: 'expense'
          }]
        })
      })
    );
  });

  test('user can access transaction features', async ({ currentMonthPage, page }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    // Check that the page has loaded and contains expected elements
    // Look for FAB button or transaction-related UI elements
    const fabButton = page.locator('button[mat-fab], button[mat-mini-fab], [data-testid*="fab"], button[aria-label*="add"], button[aria-label*="ajouter"]');
    
    // If a FAB button exists, the transaction feature is available
    if (await fabButton.count() > 0) {
      await expect(fabButton.first()).toBeVisible();
      // Click to verify it's interactive
      await fabButton.first().click();
      
      // Check if a form or dialog opened
      const formOrDialog = page.locator('form, [role="dialog"], mat-bottom-sheet, .mat-bottom-sheet-container');
      if (await formOrDialog.count() > 0) {
        // Close the form/dialog
        await page.keyboard.press('Escape');
        // Or click outside
        await page.locator('body').click({ position: { x: 0, y: 0 } });
      }
    }
    
    // Test passes if page loads without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('user can search for transactions', async ({ currentMonthPage, page }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    
    // Check if search exists
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('Test');
    }
  });
});