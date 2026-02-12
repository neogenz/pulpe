import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import type { Route } from '@playwright/test';

const mockSupabaseUpdateUser = async (page: import('@playwright/test').Page) => {
  await page.route('**/auth/v1/user**', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'e2e-user-id',
          email: 'e2e-user@test.local',
        },
      }),
    });
  });
};

test.describe('Google OAuth', () => {
  test.describe.configure({ mode: 'parallel' });

  test('first login completes vault setup', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('google-login-button')).toBeVisible();

    await page.getByTestId('google-login-button').click();

    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      provider: 'google',
      vaultCodeConfigured: false,
    });
    await mockSupabaseUpdateUser(page);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/setup-vault-code/);

    await page.getByTestId('vault-code-input').fill('12345678');
    await page
      .getByTestId('confirm-vault-code-input')
      .fill('12345678');
    await page.getByTestId('setup-vault-code-submit-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).toBeVisible();
    await page
      .getByTestId('recovery-key-confirm-input')
      .fill('aaaa-bbbb-cccc-dddd');
    await page.getByTestId('recovery-key-confirm-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).not.toBeVisible();

    // Simulate user metadata update after vault setup (E2E mock state is static otherwise)
    await setupAuthBypass(page, {
      includeApiMocks: false,
      setLocalStorage: false,
      provider: 'google',
      vaultCodeConfigured: true,
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(dashboard|budget)/);
  });

  test('returning Google user on new device enters vault code', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: false,
      provider: 'google',
      vaultCodeConfigured: true,
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/enter-vault-code/);

    await page.getByTestId('vault-code-input').fill('12345678');
    await page.getByTestId('enter-vault-code-submit-button').click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
