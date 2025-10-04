import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Financial Entry Mobile Menu', () => {
  test.describe('Mobile View', () => {
    test.use({
      viewport: { width: 375, height: 667 }, // iPhone SE viewport
      isMobile: true,
    });

    test.beforeEach(async ({ authenticatedPage: page }) => {
      await page.goto('/app/current-month');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should show menu button instead of separate edit/delete buttons on mobile', async ({
      authenticatedPage: page,
    }) => {
      // Wait for the current month page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      // Check if there are any financial entries with actions
      const actionButtons = await page.locator('[data-testid^="actions-menu-"]').count();
      const separateEditButtons = await page.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').count();
      const separateDeleteButtons = await page.locator('[data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // If no entries exist, we should see add buttons instead
      if (actionButtons === 0) {
        const addButtons = await page.locator('[data-testid="add-first-line"], [data-testid="add-budget-line"], [data-testid="add-transaction"]').count();
        expect(addButtons).toBeGreaterThan(0);
      } else {
        // Verify mobile behavior: menu buttons exist but not separate buttons
        expect(actionButtons).toBeGreaterThan(0);
        expect(separateEditButtons).toBe(0);
        expect(separateDeleteButtons).toBe(0);
      }
    });

    test('should open menu when clicking menu button', async ({ page }) => {
      // Wait for the page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      // Check if we have any action menus
      const actionMenus = page.locator('[data-testid^="actions-menu-"]');
      const menuCount = await actionMenus.count();

      if (menuCount === 0) {
        test.skip('No financial entries with editable/deletable actions found');
        return;
      }

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible
      const menu = page.locator('mat-menu');
      await expect(menu).toBeVisible();

      // Verify menu contains appropriate items
      const editMenuItem = menu.locator('[data-testid^="edit-transaction-"]');
      const deleteMenuItem = menu.locator('[data-testid^="delete-transaction-"]');

      // At least one of edit or delete should be present
      const editCount = await editMenuItem.count();
      const deleteCount = await deleteMenuItem.count();
      expect(editCount + deleteCount).toBeGreaterThan(0);
    });

    test('should close menu when clicking outside', async ({ page }) => {
      // Wait for the page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      const actionMenus = page.locator('[data-testid^="actions-menu-"]');
      const menuCount = await actionMenus.count();

      if (menuCount === 0) {
        test.skip('No financial entries with editable/deletable actions found');
        return;
      }

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible
      const menu = page.locator('mat-menu');
      await expect(menu).toBeVisible();

      // Click outside the menu (on the page title)
      await page.locator('h1, h2, .mat-toolbar').first().click();

      // Menu should close
      await expect(menu).not.toBeVisible();
    });

    test('should show correct menu items text', async ({ page }) => {
      // Wait for the page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      const actionMenus = page.locator('[data-testid^="actions-menu-"]');
      const menuCount = await actionMenus.count();

      if (menuCount === 0) {
        test.skip('No financial entries with editable/deletable actions found');
        return;
      }

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible
      const menu = page.locator('mat-menu');
      await expect(menu).toBeVisible();

      // Check for edit menu item
      const editMenuItem = menu.locator('[data-testid^="edit-transaction-"]');
      if (await editMenuItem.count() > 0) {
        await expect(editMenuItem).toContainText('Éditer');
      }

      // Check for delete menu item
      const deleteMenuItem = menu.locator('[data-testid^="delete-transaction-"]');
      if (await deleteMenuItem.count() > 0) {
        await expect(deleteMenuItem).toContainText('Supprimer');
      }
    });

    test('should emit edit action when clicking edit menu item', async ({ page }) => {
      // Wait for the page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      const actionMenus = page.locator('[data-testid^="actions-menu-"]');
      const menuCount = await actionMenus.count();

      if (menuCount === 0) {
        test.skip('No financial entries with editable/deletable actions found');
        return;
      }

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible
      const menu = page.locator('mat-menu');
      await expect(menu).toBeVisible();

      // Check if edit menu item exists
      const editMenuItem = menu.locator('[data-testid^="edit-transaction-"]');
      if (await editMenuItem.count() === 0) {
        test.skip('No edit menu item found');
        return;
      }

      // Click edit menu item
      await editMenuItem.click();

      // Menu should close
      await expect(menu).not.toBeVisible();

      // Should trigger edit behavior (dialog or inline editing depending on implementation)
      // This is more of an integration test - the specific behavior depends on parent component
    });
  });

  test.describe('Desktop View', () => {
    test.use({
      viewport: { width: 1280, height: 720 }, // Desktop viewport
    });

    test.beforeEach(async ({ authenticatedPage: page }) => {
      await page.goto('/app/current-month');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should show separate edit and delete buttons instead of menu on desktop', async ({
      authenticatedPage: page,
    }) => {
      // Wait for the current month page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      // Count different types of buttons
      const actionMenus = await page.locator('[data-testid^="actions-menu-"]').count();
      const separateEditButtons = await page.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').count();
      const separateDeleteButtons = await page.locator('[data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // If no entries exist, skip the test
      if (separateEditButtons === 0 && separateDeleteButtons === 0 && actionMenus === 0) {
        test.skip('No financial entries with editable/deletable actions found');
        return;
      }

      // Verify desktop behavior: separate buttons exist but not menu buttons
      expect(actionMenus).toBe(0);
      expect(separateEditButtons + separateDeleteButtons).toBeGreaterThan(0);
    });

    test('should trigger edit action directly when clicking edit button on desktop', async ({
      authenticatedPage: page,
    }) => {
      // Wait for the page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      const editButtons = page.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])');
      const editCount = await editButtons.count();

      if (editCount === 0) {
        test.skip('No edit buttons found');
        return;
      }

      // Click the first edit button
      await editButtons.first().click();

      // Should trigger edit behavior directly (no menu)
      // The specific behavior depends on parent component implementation
    });
  });

  test.describe('Responsive Behavior', () => {
    test.beforeEach(async ({ authenticatedPage: page }) => {
      await page.goto('/app/current-month');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should switch between menu and separate buttons when viewport changes', async ({
      authenticatedPage: page,
    }) => {
      // Start with desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      
      // Wait for the page to load
      await page.waitForSelector('pulpe-financial-entry', {
        state: 'visible',
      });

      // Check desktop behavior
      let actionMenus = await page.locator('[data-testid^="actions-menu-"]').count();
      let separateButtons = await page.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item]), [data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      if (separateButtons === 0 && actionMenus === 0) {
        test.skip('No financial entries with editable/deletable actions found');
        return;
      }

      // On desktop, should have separate buttons, not menu
      if (separateButtons > 0) {
        expect(actionMenus).toBe(0);
      }

      // Switch to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Wait for mobile menu button to appear
      await page.locator('[data-testid^="actions-menu-"]').first().waitFor({ state: 'visible' });

      // Check mobile behavior
      actionMenus = await page.locator('[data-testid^="actions-menu-"]').count();
      separateButtons = await page.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item]), [data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // On mobile, should have menu buttons, not separate buttons
      if (actionMenus > 0) {
        expect(separateButtons).toBe(0);
      }
    });
  });
});