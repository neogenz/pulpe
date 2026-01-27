import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Mobile scroll behavior', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Mock budgets list endpoint
    await page.route('**/api/v1/budgets', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: budgetId,
                month: currentMonth,
                year: currentYear,
                description: 'Budget du mois',
                templateId: TEST_UUIDS.TEMPLATE_1,
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-01T00:00:00Z',
              },
            ],
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock budget details endpoint with enough budget lines to force scrolling
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { month: currentMonth, year: currentYear },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, { name: 'Salaire', amount: 5000, kind: 'income' }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, { name: 'Loyer', amount: 1200, kind: 'expense' }),
        createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, { name: 'Électricité', amount: 100, kind: 'expense' }),
        createBudgetLineMock(TEST_UUIDS.LINE_4, budgetId, { name: 'Internet', amount: 50, kind: 'expense' }),
        createBudgetLineMock(TEST_UUIDS.LINE_5, budgetId, { name: 'Courses', amount: 400, kind: 'expense' }),
        createBudgetLineMock(TEST_UUIDS.LINE_6, budgetId, { name: 'Transport', amount: 150, kind: 'expense' }),
        createBudgetLineMock(TEST_UUIDS.LINE_7, budgetId, { name: 'Loisirs', amount: 200, kind: 'expense' }),
        createBudgetLineMock(TEST_UUIDS.LINE_8, budgetId, { name: 'Épargne', amount: 300, kind: 'saving' }),
      ],
    });

    await page.route('**/api/v1/budgets/*/details', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      }),
    );

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="page-content"]');
  });

  test.describe('Mobile View', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

    test('body should have proper overflow settings for browser navbar auto-hide', async ({
      authenticatedPage: page,
    }) => {
      await page.waitForLoadState('networkidle');

      const { bodyOverflowX, bodyOverflowY } = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        return {
          bodyOverflowX: bodyStyle.overflowX,
          bodyOverflowY: bodyStyle.overflowY,
        };
      });

      expect(bodyOverflowX).toBe('hidden');
      // Body-level scroll enables iOS Safari toolbar translucency
      // and Android Chrome/Samsung/Firefox navbar auto-hide
      expect(bodyOverflowY).toBe('auto');
    });

    test('main content should not create its own scroll container on mobile', async ({
      authenticatedPage: page,
    }) => {
      const mainOverflow = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="page-content"]');
        if (!main) {
          throw new Error(
            'Element [data-testid="page-content"] not found in DOM. ' +
              'Verify the component rendered correctly and the test ID exists.',
          );
        }
        return window.getComputedStyle(main).overflowY;
      });

      // Mobile: body scrolls, not main container
      expect(mainOverflow).toBe('visible');
    });

    test('navbar should stay sticky when scrolling body', async ({
      authenticatedPage: page,
    }) => {
      const toolbar = page.locator('mat-toolbar').first();
      await expect(toolbar).toBeVisible({ timeout: 5000 });

      const initialPosition = await toolbar.boundingBox();
      expect(initialPosition).not.toBeNull();

      // Ensure body is tall enough to scroll
      await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '200vh';
        document.body.appendChild(spacer);
      });

      // Body-level scroll (not container scroll)
      await page.evaluate(() => window.scrollTo(0, 100));
      await page.waitForFunction(() => window.scrollY >= 100);

      const afterScrollPosition = await toolbar.boundingBox();
      expect(afterScrollPosition).not.toBeNull();

      expect(afterScrollPosition!.y).toBe(initialPosition!.y);
    });

    test('menu should open correctly after scrolling', async ({
      authenticatedPage: page,
    }) => {
      // Ensure body is tall enough to scroll
      await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '200vh';
        document.body.appendChild(spacer);
      });

      // Body-level scroll (not container scroll)
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForFunction(() => window.scrollY >= 300);

      const menuTrigger = page.locator('[data-testid="user-menu-trigger"]');
      await expect(menuTrigger).toBeVisible({ timeout: 5000 });
      await menuTrigger.click();

      const menuPanel = page.locator('.mat-mdc-menu-panel');
      await expect(menuPanel).toBeVisible({ timeout: 5000 });

      const menuBox = await menuPanel.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox!.width).toBeGreaterThan(0);
      expect(menuBox!.height).toBeGreaterThan(0);
    });
  });

  test.describe('Desktop View', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('scroll behavior should work correctly on desktop', async ({
      authenticatedPage: page,
    }) => {
      const mainOverflow = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="page-content"]');
        if (!main) {
          throw new Error(
            'Element [data-testid="page-content"] not found in DOM. ' +
              'Verify the component rendered correctly and the test ID exists.',
          );
        }
        return window.getComputedStyle(main).overflowY;
      });

      expect(mainOverflow).toBe('auto');
    });

    test('body should have proper overflow settings on desktop', async ({
      authenticatedPage: page,
    }) => {
      await page.waitForLoadState('networkidle');

      const { bodyOverflowX, bodyOverflowY } = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        return {
          bodyOverflowX: bodyStyle.overflowX,
          bodyOverflowY: bodyStyle.overflowY,
        };
      });

      expect(bodyOverflowX).toBe('hidden');
      // Desktop: overflow-y hidden (navbar auto-hide is mobile-only)
      expect(bodyOverflowY).toBe('hidden');
    });
  });
});
