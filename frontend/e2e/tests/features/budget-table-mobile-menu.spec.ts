import { test, expect } from '../../fixtures/test-fixtures';
import { createBudgetDetailsMock, createBudgetLineMock } from '../../helpers/api-mocks';

/**
 * Budget Table Menu Tests
 *
 * NOTE: The current implementation uses a menu-based approach for BOTH mobile and desktop views.
 * - Mobile: Uses `card-menu-*` data-testid prefix
 * - Desktop: Uses `actions-menu-*` data-testid prefix
 *
 * Both views display actions through a dropdown menu (not separate buttons).
 */
test.describe('Budget Table Mobile Menu', () => {
  const budgetId = 'test-budget-123';

  // Helper to set up route mocking (used by each nested describe's beforeEach)
  async function setupBudgetDetailsMock(page: import('@playwright/test').Page) {
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { month: 8, year: 2025 },
      budgetLines: [
        createBudgetLineMock('line-1', budgetId, { name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' }),
        createBudgetLineMock('line-2', budgetId, { name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' }),
        createBudgetLineMock('line-3', budgetId, { name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }),
      ],
      transactions: [],
    });

    await page.route('**/api/v1/budgets/*/details', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      }),
    );
  }

  test.describe('Mobile View', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

    test.beforeEach(async ({ authenticatedPage: page }) => {
      await setupBudgetDetailsMock(page);
      await page.goto('/app/budget/test-budget-123');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('pulpe-budget-table')).toBeVisible();
    });

    test('shows menu button for budget line actions', async ({ authenticatedPage: page }) => {
      // Mobile view uses card-menu-* prefix
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();
      await expect(menuButton).toBeVisible();
    });

    test('opens menu when clicking menu button', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();
      await menuButton.click();

      // Check that menu panel is visible (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();
    });

    test('closes menu when clicking outside', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();
      await menuButton.click();

      // Verify menu is open (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();

      // Click the overlay backdrop to close the menu (Angular Material standard pattern)
      await page.locator('.cdk-overlay-backdrop').click();

      // Verify menu is closed
      await expect(menu).not.toBeVisible();
    });

    test('shows correct menu item text in French', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();
      await menuButton.click();

      // Check for "Éditer" menu item
      const editMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Éditer' });
      await expect(editMenuItem).toBeVisible();

      // Check for "Supprimer" menu item
      const deleteMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Supprimer' });
      await expect(deleteMenuItem).toBeVisible();
    });

    test('triggers edit action when clicking edit menu item', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();
      await menuButton.click();

      // Click edit menu item
      const editMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Éditer' });
      await editMenuItem.click();

      // Verify that edit dialog opens (mobile uses dialog)
      const dialog = page.locator('mat-dialog-container');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Close dialog
      const cancelButton = page.locator('mat-dialog-container button').filter({ hasText: 'Annuler' });
      await cancelButton.click();
    });

    test('triggers delete action when clicking delete menu item', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();
      await menuButton.click();

      // Click delete menu item
      const deleteMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Supprimer' });
      await deleteMenuItem.click();

      // Verify that confirmation dialog appears
      const confirmDialog = page.locator('mat-dialog-container');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // Verify it's a confirmation dialog
      await expect(confirmDialog).toContainText('Supprimer');

      // Cancel the deletion
      const cancelButton = page.locator('mat-dialog-container button').filter({ hasText: 'Annuler' });
      await cancelButton.click();
    });
  });

  test.describe('Desktop View', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ authenticatedPage: page }) => {
      await setupBudgetDetailsMock(page);
      await page.goto('/app/budget/test-budget-123');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('pulpe-budget-table')).toBeVisible();
    });

    test('shows menu button for row actions', async ({ authenticatedPage: page }) => {
      // Desktop view uses actions-menu-* prefix in the table
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await expect(menuButton).toBeVisible();
    });

    test('opens menu and shows edit option when clicking menu button', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Check that menu panel is visible
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();

      // Check edit option exists
      const editMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Éditer' });
      await expect(editMenuItem).toBeVisible();
    });

    test('triggers inline edit when clicking edit menu item', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Click edit menu item
      const editMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Éditer' });
      await editMenuItem.click();

      // On desktop, inline editing should activate
      const editNameInput = page.locator('[data-testid^="edit-name-"]').first();
      const editAmountInput = page.locator('[data-testid^="edit-amount-"]').first();

      await expect(editNameInput).toBeVisible();
      await expect(editAmountInput).toBeVisible();

      // Cancel editing
      const cancelButton = page.locator('[data-testid^="cancel-"]').first();
      await cancelButton.click();
    });

    test('triggers delete action when clicking delete menu item', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Click delete menu item
      const deleteMenuItem = page.locator('button[mat-menu-item]').filter({ hasText: 'Supprimer' });
      await deleteMenuItem.click();

      // Verify that confirmation dialog appears
      const confirmDialog = page.locator('mat-dialog-container');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // Cancel the deletion
      const cancelButton = page.locator('mat-dialog-container button').filter({ hasText: 'Annuler' });
      await cancelButton.click();
    });
  });

  test.describe('Responsive Behavior', () => {
    test.beforeEach(async ({ authenticatedPage: page }) => {
      await setupBudgetDetailsMock(page);
    });

    test('uses different menu button prefixes for mobile vs desktop', async ({ authenticatedPage: page }) => {
      // Start with desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/app/budget/test-budget-123');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('pulpe-budget-table')).toBeVisible();

      // Desktop uses actions-menu-* prefix (table view)
      const desktopMenuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await expect(desktopMenuButton).toBeVisible();

      // Switch to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Mobile uses card-menu-* prefix (card view)
      const mobileMenuButton = page.locator('[data-testid^="card-menu-"]').first();
      await expect(mobileMenuButton).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

    test.beforeEach(async ({ authenticatedPage: page }) => {
      await setupBudgetDetailsMock(page);
      await page.goto('/app/budget/test-budget-123');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('pulpe-budget-table')).toBeVisible();
    });

    test('can navigate menu with keyboard on mobile', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="card-menu-"]').first();

      // Focus and activate menu with keyboard
      await menuButton.focus();
      await page.keyboard.press('Enter');

      // Verify menu opened (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');

      // Close menu with Escape
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
    });
  });
});
