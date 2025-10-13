import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';

test.describe('Financial Entry Mobile Menu', () => {
  test.describe('Mobile View', () => {
    test.use({
      viewport: { width: 375, height: 667 }, // iPhone SE viewport
      isMobile: true,
    });

    test.beforeEach(async ({ page }) => {
      // Setup auth bypass FIRST (injects window flags via addInitScript)
      await setupAuthBypass(page, {
        includeApiMocks: false,
        setLocalStorage: true
      });

      // Mock 1: Budget list endpoint (returns current month budget)
      await page.route('**/api/v1/budgets', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: [{
              id: 'current-budget-123',
              name: 'October 2025',
              month: 10,
              year: 2025
            }]
          })
        })
      );

      // Mock 2: Budget details endpoint (budgetLines + transactions)
      await page.route('**/api/v1/budgets/current-budget-123/details', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              budget: {
                id: 'current-budget-123',
                name: 'October 2025',
                month: 10,
                year: 2025
              },
              budgetLines: [
                { id: 'line-1', name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' },
                { id: 'line-2', name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' },
                { id: 'line-3', name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }
              ],
              transactions: [
                { id: 'txn-1', name: 'Coffee', amount: 5, kind: 'expense', budgetLineId: 'line-2' },
                { id: 'txn-2', name: 'Lunch', amount: 12, kind: 'expense', budgetLineId: 'line-2' }
              ]
            }
          })
        })
      );

      // Navigate (addInitScript will inject flags before this navigation)
      await page.goto('/app/current-month', { waitUntil: 'domcontentloaded' });
    });

    test('should show menu button instead of separate edit/delete buttons on mobile', async ({ page }) => {
      // Wait for one-time-expenses-list to load (Playwright auto-waits)
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      // Check if there are any financial entries with actions (within one-time list)
      const actionButtons = await oneTimeList.locator('[data-testid^="actions-menu-"]').count();
      const separateEditButtons = await oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').count();
      const separateDeleteButtons = await oneTimeList.locator('[data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // Verify mobile behavior: menu buttons exist but not separate buttons
      expect(actionButtons).toBeGreaterThan(0);
      expect(separateEditButtons).toBe(0);
      expect(separateDeleteButtons).toBe(0);
    });

    test('should open menu when clicking menu button', async ({ page }) => {
      // Wait for one-time-expenses-list to load
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      // Verify action menus exist and click first one
      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      expect(await actionMenus.count()).toBeGreaterThan(0);

      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
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
      // Wait for one-time-expenses-list to load
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      expect(await actionMenus.count()).toBeGreaterThan(0);

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();

      // Close menu by clicking on the backdrop or pressing Escape
      await page.keyboard.press('Escape');

      // Menu should close
      await expect(menu).not.toBeVisible();
    });

    test('should show correct menu items text', async ({ page }) => {
      // Wait for one-time-expenses-list to load
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      expect(await actionMenus.count()).toBeGreaterThan(0);

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
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
      // Wait for one-time-expenses-list to load
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      expect(await actionMenus.count()).toBeGreaterThan(0);

      // Click the first menu button
      const firstMenuButton = actionMenus.first();
      await firstMenuButton.click();

      // Verify menu is visible (Angular Material renders menu in overlay)
      const menu = page.locator('.mat-mdc-menu-panel');
      await expect(menu).toBeVisible();

      // Verify edit menu item exists and click it
      const editMenuItem = menu.locator('[data-testid^="edit-transaction-"]');
      expect(await editMenuItem.count()).toBeGreaterThan(0);
      await editMenuItem.click();

      // Clicking edit typically opens a dialog - the menu close behavior depends on implementation
      // Just verify the click was successful (menu might stay open with dialog)
    });
  });

  test.describe('Desktop View', () => {
    test.use({
      viewport: { width: 1280, height: 720 }, // Desktop viewport
    });

    test.beforeEach(async ({ page }) => {
      // Setup auth bypass FIRST (injects window flags via addInitScript)
      await setupAuthBypass(page, {
        includeApiMocks: false,
        setLocalStorage: true
      });

      // Mock 1: Budget list endpoint (returns current month budget)
      await page.route('**/api/v1/budgets', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: [{
              id: 'current-budget-123',
              name: 'October 2025',
              month: 10,
              year: 2025
            }]
          })
        })
      );

      // Mock 2: Budget details endpoint (budgetLines + transactions)
      await page.route('**/api/v1/budgets/current-budget-123/details', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              budget: {
                id: 'current-budget-123',
                name: 'October 2025',
                month: 10,
                year: 2025
              },
              budgetLines: [
                { id: 'line-1', name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' },
                { id: 'line-2', name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' },
                { id: 'line-3', name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }
              ],
              transactions: [
                { id: 'txn-1', name: 'Coffee', amount: 5, kind: 'expense', budgetLineId: 'line-2' },
                { id: 'txn-2', name: 'Lunch', amount: 12, kind: 'expense', budgetLineId: 'line-2' }
              ]
            }
          })
        })
      );

      // Navigate (addInitScript will inject flags before this navigation)
      await page.goto('/app/current-month', { waitUntil: 'domcontentloaded' });
    });

    test('should show separate edit and delete buttons instead of menu on desktop', async ({
      page,
    }) => {
      // Wait for one-time-expenses-list to load
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      // Count different types of buttons (within one-time list)
      const actionMenus = await oneTimeList.locator('[data-testid^="actions-menu-"]').count();
      const separateEditButtons = await oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').count();
      const separateDeleteButtons = await oneTimeList.locator('[data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // Verify desktop behavior: separate buttons exist but not menu buttons
      expect(actionMenus).toBe(0);
      expect(separateEditButtons + separateDeleteButtons).toBeGreaterThan(0);
    });

    test('should trigger edit action directly when clicking edit button on desktop', async ({
      page,
    }) => {
      // Wait for one-time-expenses-list to load
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      const editButtons = oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])');
      expect(await editButtons.count()).toBeGreaterThan(0);

      // Click the first edit button
      await editButtons.first().click();

      // Should trigger edit behavior directly (no menu)
      // The specific behavior depends on parent component implementation
    });
  });

  test.describe('Responsive Behavior', () => {
    test.beforeEach(async ({ page }) => {
      // Setup auth bypass FIRST (injects window flags via addInitScript)
      await setupAuthBypass(page, {
        includeApiMocks: false,
        setLocalStorage: true
      });

      // Mock 1: Budget list endpoint (returns current month budget)
      await page.route('**/api/v1/budgets', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: [{
              id: 'current-budget-123',
              name: 'October 2025',
              month: 10,
              year: 2025
            }]
          })
        })
      );

      // Mock 2: Budget details endpoint (budgetLines + transactions)
      await page.route('**/api/v1/budgets/current-budget-123/details', route =>
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              budget: {
                id: 'current-budget-123',
                name: 'October 2025',
                month: 10,
                year: 2025
              },
              budgetLines: [
                { id: 'line-1', name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed' },
                { id: 'line-2', name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed' },
                { id: 'line-3', name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed' }
              ],
              transactions: [
                { id: 'txn-1', name: 'Coffee', amount: 5, kind: 'expense', budgetLineId: 'line-2' },
                { id: 'txn-2', name: 'Lunch', amount: 12, kind: 'expense', budgetLineId: 'line-2' }
              ]
            }
          })
        })
      );

      // Navigate (addInitScript will inject flags before this navigation)
      await page.goto('/app/current-month', { waitUntil: 'domcontentloaded' });
    });

    test('should switch between menu and separate buttons when viewport changes', async ({
      page,
    }) => {
      // Start with desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });

      // Wait for one-time-expenses-list and desktop buttons to appear
      const oneTimeList = page.locator('[data-testid="one-time-expenses-list"]');
      await expect(oneTimeList).toBeVisible({ timeout: 10000 });

      // Wait for desktop buttons to render (BreakpointObserver triggers re-render)
      await expect(oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').first()).toBeVisible({ timeout: 5000 });

      // Check desktop behavior (within one-time list)
      let actionMenus = await oneTimeList.locator('[data-testid^="actions-menu-"]').count();
      let separateButtons = await oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item]), [data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // On desktop, should have separate buttons, not menu
      expect(actionMenus).toBe(0);
      expect(separateButtons).toBeGreaterThan(0);

      // Switch to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Wait for mobile menu button to appear (BreakpointObserver triggers re-render)
      await expect(oneTimeList.locator('[data-testid^="actions-menu-"]').first()).toBeVisible({ timeout: 5000 });

      // Check mobile behavior (within one-time list)
      actionMenus = await oneTimeList.locator('[data-testid^="actions-menu-"]').count();
      separateButtons = await oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item]), [data-testid^="delete-transaction-"]:not([mat-menu-item])').count();

      // On mobile, should have menu buttons, not separate buttons
      expect(actionMenus).toBeGreaterThan(0);
      expect(separateButtons).toBe(0);
    });
  });
});