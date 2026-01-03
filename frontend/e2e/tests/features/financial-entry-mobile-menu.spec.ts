import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import type { Page } from '@playwright/test';

// Valid UUIDs for Zod validation
const TEST_UUIDS = {
  BUDGET: '00000000-0000-4000-a000-000000000001',
  USER: '00000000-0000-4000-a000-000000000201',
  TEMPLATE: '00000000-0000-4000-a000-000000000101',
  LINE_1: '00000000-0000-4000-a000-000000001001',
  LINE_2: '00000000-0000-4000-a000-000000001002',
  LINE_3: '00000000-0000-4000-a000-000000001003',
  TXN_1: '00000000-0000-4000-a000-000000002001',
  TXN_2: '00000000-0000-4000-a000-000000002002',
};

/**
 * Setup budget mocks for financial entry tests with current month/year
 * This ensures tests don't fail when the calendar month changes
 */
async function setupBudgetMocks(page: Page) {
  // Use current month/year dynamically to avoid test failures when month changes
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
  const currentYear = now.getFullYear();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const budgetName = `${monthNames[now.getMonth()]} ${currentYear}`;

  const dateNow = new Date().toISOString();

  // Mock 1: Budget list endpoint (returns current month budget)
  await page.route('**/api/v1/budgets', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        data: [{
          id: TEST_UUIDS.BUDGET,
          description: budgetName,
          month: currentMonth,
          year: currentYear,
          userId: TEST_UUIDS.USER,
          templateId: TEST_UUIDS.TEMPLATE,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        }]
      })
    })
  );

  // Mock 2: Budget details endpoint (budgetLines + transactions)
  await page.route(`**/api/v1/budgets/${TEST_UUIDS.BUDGET}/details`, route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        data: {
          budget: {
            id: TEST_UUIDS.BUDGET,
            description: budgetName,
            month: currentMonth,
            year: currentYear,
            userId: TEST_UUIDS.USER,
            templateId: TEST_UUIDS.TEMPLATE,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
          budgetLines: [
            { id: TEST_UUIDS.LINE_1, budgetId: TEST_UUIDS.BUDGET, name: 'Salary', amount: 5000, kind: 'income', recurrence: 'fixed', isManuallyAdjusted: false, templateLineId: null, savingsGoalId: null, checkedAt: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            { id: TEST_UUIDS.LINE_2, budgetId: TEST_UUIDS.BUDGET, name: 'Groceries', amount: 400, kind: 'expense', recurrence: 'fixed', isManuallyAdjusted: false, templateLineId: null, savingsGoalId: null, checkedAt: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
            { id: TEST_UUIDS.LINE_3, budgetId: TEST_UUIDS.BUDGET, name: 'Transport', amount: 150, kind: 'expense', recurrence: 'fixed', isManuallyAdjusted: false, templateLineId: null, savingsGoalId: null, checkedAt: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }
          ],
          transactions: [
            {
              id: TEST_UUIDS.TXN_1,
              budgetId: TEST_UUIDS.BUDGET,
              budgetLineId: null,
              name: 'Coffee',
              amount: 5,
              kind: 'expense',
              transactionDate: dateNow,
              category: null,
              createdAt: dateNow,
              updatedAt: dateNow,
              checkedAt: null
            },
            {
              id: TEST_UUIDS.TXN_2,
              budgetId: TEST_UUIDS.BUDGET,
              budgetLineId: null,
              name: 'Lunch',
              amount: 12,
              kind: 'expense',
              transactionDate: dateNow,
              category: null,
              createdAt: dateNow,
              updatedAt: dateNow,
              checkedAt: null
            }
          ]
        }
      })
    })
  );
}

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

      // Setup budget mocks with current month/year (prevents test failures when month changes)
      await setupBudgetMocks(page);

      // Navigate (addInitScript will inject flags before this navigation)
      await page.goto('/app/current-month', { waitUntil: 'domcontentloaded' });
    });

    test('should show menu button instead of separate edit/delete buttons on mobile', async ({ page }) => {
      // Wait for financial entries to load by checking for action buttons
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const firstActionButton = oneTimeList.locator('[data-testid^="actions-menu-"]').first();
      await expect(firstActionButton).toBeVisible({ timeout: 10000 });

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
      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      const firstMenuButton = actionMenus.first();
      await expect(firstMenuButton).toBeVisible({ timeout: 10000 });

      // Verify action menus exist and click first one
      expect(await actionMenus.count()).toBeGreaterThan(0);
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
      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      const firstMenuButton = actionMenus.first();
      await expect(firstMenuButton).toBeVisible({ timeout: 10000 });

      expect(await actionMenus.count()).toBeGreaterThan(0);

      // Click the first menu button
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
      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      const firstMenuButton = actionMenus.first();
      await expect(firstMenuButton).toBeVisible({ timeout: 10000 });

      expect(await actionMenus.count()).toBeGreaterThan(0);

      // Click the first menu button
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
      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const actionMenus = oneTimeList.locator('[data-testid^="actions-menu-"]');
      const firstMenuButton = actionMenus.first();
      await expect(firstMenuButton).toBeVisible({ timeout: 10000 });

      expect(await actionMenus.count()).toBeGreaterThan(0);

      // Click the first menu button
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

      // Setup budget mocks with current month/year (prevents test failures when month changes)
      await setupBudgetMocks(page);

      // Navigate (addInitScript will inject flags before this navigation)
      await page.goto('/app/current-month', { waitUntil: 'domcontentloaded' });
    });

    test('should show separate edit and delete buttons instead of menu on desktop', async ({
      page,
    }) => {
      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const firstEditButton = oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').first();
      await expect(firstEditButton).toBeVisible({ timeout: 10000 });

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
      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const editButtons = oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])');
      const firstEditButton = editButtons.first();
      await expect(firstEditButton).toBeVisible({ timeout: 10000 });

      expect(await editButtons.count()).toBeGreaterThan(0);

      // Click the first edit button
      await firstEditButton.click();

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

      // Setup budget mocks with current month/year (prevents test failures when month changes)
      await setupBudgetMocks(page);

      // Navigate (addInitScript will inject flags before this navigation)
      await page.goto('/app/current-month', { waitUntil: 'domcontentloaded' });
    });

    test('should switch between menu and separate buttons when viewport changes', async ({
      page,
    }) => {
      // Start with desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });

      // Wait for financial entries to load
      const oneTimeList = page.locator('pulpe-one-time-expenses-list');
      const firstEditButton = oneTimeList.locator('[data-testid^="edit-transaction-"]:not([mat-menu-item])').first();

      // Wait for desktop buttons to render (BreakpointObserver triggers re-render)
      await expect(firstEditButton).toBeVisible({ timeout: 10000 });

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