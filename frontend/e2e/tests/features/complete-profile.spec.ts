import { test as base, expect } from '../../fixtures/test-fixtures';
import { TEST_CONFIG } from '../../config/test-config';
import { setupAuthBypass } from '../../utils/auth-bypass';

/**
 * Complete Profile Flow E2E Tests
 *
 * Tests navigation behavior only (not testable in unit tests):
 * - Returning user redirect (existing budget → dashboard)
 * - First-time user form display (no budget → complete-profile form)
 *
 * Business logic (validation, prefill, submission) is covered by
 * 22 unit tests in complete-profile-store.spec.ts
 */
base.describe('Complete Profile Flow', () => {
  base.describe.configure({ mode: 'parallel' });

  base.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/encryption/validate-key', (route) => {
      return route.fulfill({ status: 204, body: '' });
    });
  });

  base('should redirect returning user with existing budget to dashboard', async ({
    page,
  }) => {
    await page.route('**/api/v1/budgets**', (route) => {
      const url = route.request().url();

      if (url.includes('/details')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              budget: {
                id: TEST_CONFIG.BUDGETS.CURRENT_MONTH.id,
                month: TEST_CONFIG.BUDGETS.CURRENT_MONTH.month,
                year: TEST_CONFIG.BUDGETS.CURRENT_MONTH.year,
              },
              transactions: [],
              budgetLines: [],
            },
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: TEST_CONFIG.BUDGETS.CURRENT_MONTH.id,
              month: TEST_CONFIG.BUDGETS.CURRENT_MONTH.month,
              year: TEST_CONFIG.BUDGETS.CURRENT_MONTH.year,
              description: 'Existing Budget',
              userId: TEST_CONFIG.USER.ID,
              templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/users/settings**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { payDayOfMonth: null } }),
      });
    });

    await page.route('**/api/v1/auth**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: TEST_CONFIG.USER.ID, email: TEST_CONFIG.USER.EMAIL },
        }),
      });
    });

    await setupAuthBypass(page, {
      includeApiMocks: false,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await page.addInitScript(() => {
      const entry = { version: 1, data: 'aa'.repeat(32), updatedAt: new Date().toISOString() };
      sessionStorage.setItem('pulpe-vault-client-key-session', JSON.stringify(entry));
    });

    await page.goto('/complete-profile');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  base('should display complete profile form for first-time user', async ({ page }) => {
    await page.route('**/api/v1/budgets**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/v1/users/settings**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { payDayOfMonth: null } }),
      });
    });

    await page.route('**/api/v1/auth**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: TEST_CONFIG.USER.ID, email: TEST_CONFIG.USER.EMAIL },
        }),
      });
    });

    await setupAuthBypass(page, {
      includeApiMocks: false,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await page.addInitScript(() => {
      const entry = { version: 1, data: 'aa'.repeat(32), updatedAt: new Date().toISOString() };
      sessionStorage.setItem('pulpe-vault-client-key-session', JSON.stringify(entry));
    });

    await page.goto('/complete-profile');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/complete-profile/);

    await expect(page.getByTestId('first-name-input')).toBeVisible();
    await expect(page.getByTestId('monthly-income-input')).toBeVisible();
  });

  base('should complete onboarding and redirect to dashboard', async ({ page }) => {
    let budgetCreated = false;
    const createdBudget = {
      id: TEST_CONFIG.BUDGETS.CURRENT_MONTH.id,
      month: TEST_CONFIG.BUDGETS.CURRENT_MONTH.month,
      year: TEST_CONFIG.BUDGETS.CURRENT_MONTH.year,
      description: 'Budget initial',
      templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    await page.route('**/api/v1/budgets**', (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === 'POST') {
        budgetCreated = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: createdBudget }),
        });
      }

      if (url.includes('/details')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              budget: createdBudget,
              transactions: [],
              budgetLines: [],
            },
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: budgetCreated ? [createdBudget] : [],
        }),
      });
    });

    await page.route('**/api/v1/budget-templates/from-onboarding', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            template: {
              id: TEST_CONFIG.TEMPLATES.DEFAULT.id,
              name: 'Mois Standard',
              isDefault: true,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
            lines: [],
          },
        }),
      });
    });

    await page.route('**/api/v1/users/settings**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { payDayOfMonth: null } }),
      });
    });

    await page.route('**/api/v1/auth**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: TEST_CONFIG.USER.ID, email: TEST_CONFIG.USER.EMAIL },
        }),
      });
    });

    await setupAuthBypass(page, {
      includeApiMocks: false,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await page.addInitScript(() => {
      const entry = { version: 1, data: 'aa'.repeat(32), updatedAt: new Date().toISOString() };
      sessionStorage.setItem('pulpe-vault-client-key-session', JSON.stringify(entry));
    });

    await page.goto('/complete-profile');
    await page.waitForLoadState('domcontentloaded');

    // Step 1: Fill required fields
    await page.getByTestId('first-name-input').fill('Marie');
    await page.getByTestId('monthly-income-input').fill('4500');

    // Navigate to step 2
    await page.getByTestId('next-step-button').click();

    // Step 2: Submit (skip optional charges)
    await expect(page.getByTestId('submit-button')).toBeVisible();
    await page.getByTestId('submit-button').click();

    // User should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
