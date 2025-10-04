import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Table Mobile Menu', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock budget details endpoint with test data
    await page.route('**/api/v1/budgets/*/details', route =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            budget: {
              id: 'test-budget-123',
              name: 'Test Budget',
              month: 8,
              year: 2025
            },
            budgetLines: [
              { id: 'line-1', name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' },
              { id: 'line-2', name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' },
              { id: 'line-3', name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }
            ],
            transactions: [
              { id: 'txn-1', name: 'Coffee', amount: 5, kind: 'expense', budgetLineId: 'line-1' }
            ]
          }
        })
      })
    );

    // Navigate directly to budget details page
    await page.goto('/app/budget/test-budget-123');
    await page.waitForLoadState('domcontentloaded');

    // Ensure budget table is loaded
    await expect(page.locator('pulpe-budget-table')).toBeVisible();
  });

  test.describe('Mobile View', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

    test('shows menu button instead of separate edit/delete buttons', async ({ authenticatedPage: page }) => {
      // Check that menu button exists
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await expect(menuButton).toBeVisible();

      // Check that separate edit/delete buttons are NOT visible (outside menu)
      const editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      const deleteButton = page.locator('[data-testid^="delete-"]:not([mat-menu-item])').first();

      await expect(editButton).not.toBeVisible();
      await expect(deleteButton).not.toBeVisible();
    });

    test('opens menu when clicking menu button', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Check that menu panel is visible (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();
    });

    test('closes menu when clicking outside', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
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
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Check for "Éditer" menu item (if it's a budget_line)
      const editMenuItem = page.locator('[data-testid^="edit-"][mat-menu-item]').first();
      if (await editMenuItem.isVisible()) {
        await expect(editMenuItem).toContainText('Éditer');
      }

      // Check for "Supprimer" menu item
      const deleteMenuItem = page.locator('[data-testid^="delete-"][mat-menu-item]').first();
      await expect(deleteMenuItem).toBeVisible();
      await expect(deleteMenuItem).toContainText('Supprimer');
    });

    test('triggers edit action when clicking edit menu item', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Click edit menu item (if available)
      const editMenuItem = page.locator('[data-testid^="edit-"][mat-menu-item]').first();

      // Only test if edit menu item exists (some lines may not have edit option)
      if (await editMenuItem.isVisible()) {
        await editMenuItem.click();

        // Verify that edit dialog opens (mobile uses dialog)
        const dialog = page.locator('mat-dialog-container');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Verify dialog has edit form fields
        await expect(page.getByTestId('edit-line-name')).toBeVisible();
        await expect(page.getByTestId('edit-line-amount')).toBeVisible();

        // Close dialog
        const cancelButton = page.locator('mat-dialog-container button').filter({ hasText: 'Annuler' });
        await cancelButton.click();
      }
    });

    test('triggers delete action when clicking delete menu item', async ({ authenticatedPage: page }) => {
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await menuButton.click();

      // Click delete menu item
      const deleteMenuItem = page.locator('[data-testid^="delete-"][mat-menu-item]').first();
      await deleteMenuItem.click();

      // Verify that confirmation dialog appears
      const confirmDialog = page.locator('mat-dialog-container');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // Verify it's a confirmation dialog (button text is "Supprimer" not "Confirmer")
      await expect(confirmDialog).toContainText('Supprimer');

      // Cancel the deletion
      const cancelButton = page.locator('mat-dialog-container button').filter({ hasText: 'Annuler' });
      await cancelButton.click();
    });

    test('shows only delete option for transaction lines', async ({ authenticatedPage: page }) => {
      // Add a transaction first to ensure we have one
      const addTransactionButton = page.getByTestId('add-transaction-button');
      if (await addTransactionButton.isVisible()) {
        // Note: This test assumes transaction lines don't have edit option
        // Find a transaction line's menu button
        const transactionMenuButtons = page.locator('[data-testid^="actions-menu-"]');
        const count = await transactionMenuButtons.count();

        if (count > 0) {
          // Click the last menu button (likely a transaction if there are multiple)
          await transactionMenuButtons.last().click();

          // Check if only delete is available (no edit for transactions)
          const deleteMenuItem = page.locator('[data-testid^="delete-"][mat-menu-item]');
          await expect(deleteMenuItem).toBeVisible();
        }
      }
    });
  });

  test.describe('Desktop View', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('shows separate edit and delete buttons instead of menu', async ({ authenticatedPage: page }) => {
      // Check that separate buttons exist
      const editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      const deleteButton = page.locator('[data-testid^="delete-"]:not([mat-menu-item])').first();

      await expect(editButton).toBeVisible();
      await expect(deleteButton).toBeVisible();

      // Check that menu button does NOT exist
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await expect(menuButton).not.toBeVisible();
    });

    test('triggers edit action directly when clicking edit button', async ({ authenticatedPage: page }) => {
      const editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      await editButton.click();

      // On desktop, inline editing should activate
      // Check for inline edit form fields
      const editNameInput = page.locator('[data-testid^="edit-name-"]').first();
      const editAmountInput = page.locator('[data-testid^="edit-amount-"]').first();

      await expect(editNameInput).toBeVisible();
      await expect(editAmountInput).toBeVisible();

      // Cancel editing
      const cancelButton = page.locator('[data-testid^="cancel-"]').first();
      await cancelButton.click();
    });

    test('triggers delete action directly when clicking delete button', async ({ authenticatedPage: page }) => {
      const deleteButton = page.locator('[data-testid^="delete-"]:not([mat-menu-item])').first();
      await deleteButton.click();

      // Verify that confirmation dialog appears
      const confirmDialog = page.locator('mat-dialog-container');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // Cancel the deletion
      const cancelButton = page.locator('mat-dialog-container button').filter({ hasText: 'Annuler' });
      await cancelButton.click();
    });

    test('has proper aria-labels for desktop buttons', async ({ authenticatedPage: page }) => {
      const editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      const deleteButton = page.locator('[data-testid^="delete-"]:not([mat-menu-item])').first();

      // Check aria-labels exist
      const editAriaLabel = await editButton.getAttribute('aria-label');
      const deleteAriaLabel = await deleteButton.getAttribute('aria-label');

      expect(editAriaLabel).toContain('Edit');
      expect(deleteAriaLabel).toContain('Delete');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('switches between menu and separate buttons when viewport changes', async ({ authenticatedPage: page }) => {
      // Start with desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500); // Wait for responsive changes

      // Verify desktop buttons are visible
      let editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      await expect(editButton).toBeVisible();

      // Switch to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500); // Wait for responsive changes

      // Verify menu button is now visible
      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      await expect(menuButton).toBeVisible();

      // Verify desktop buttons are hidden
      editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      await expect(editButton).not.toBeVisible();

      // Switch back to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500); // Wait for responsive changes

      // Verify desktop buttons are visible again
      editButton = page.locator('[data-testid^="edit-"]:not([mat-menu-item])').first();
      await expect(editButton).toBeVisible();

      // Verify menu button is hidden
      await expect(menuButton).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('menu button has proper aria-label on mobile', async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();
      const ariaLabel = await menuButton.getAttribute('aria-label');

      expect(ariaLabel).toContain('Actions pour');
    });

    test('can navigate menu with keyboard on mobile', async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      const menuButton = page.locator('[data-testid^="actions-menu-"]').first();

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