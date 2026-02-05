import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import type { Page, Route } from '@playwright/test';

const MOCK_RECOVERY_KEY = 'AAAA-BBBB-CCCC-DDDD';

const injectClientKey = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const entry = {
      version: 1,
      data: 'aa'.repeat(32),
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(
      'pulpe-vault-client-key-session',
      JSON.stringify(entry),
    );
  });
};

test.describe('Settings Change Password', () => {
  test.describe.configure({ mode: 'parallel' });

  test('validates change password form before enabling submit', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('change-password-button').click();

    const submitButton = page.getByTestId('submit-password-button');
    await expect(submitButton).toBeDisabled();

    await page.getByTestId('current-password-input').fill('current-password');
    await page.getByTestId('new-password-input').fill('short');
    await page.getByTestId('new-password-input').blur();

    await expect(page.locator('mat-error')).toContainText('Au moins');
    await expect(submitButton).toBeDisabled();

    await page.getByTestId('new-password-input').fill('new-password-123');
    await page.getByTestId('confirm-password-input').fill('different-password');
    await expect(submitButton).toBeDisabled();

    await page.getByTestId('confirm-password-input').fill('new-password-123');
    await expect(submitButton).toBeEnabled();
  });

  test('shows error when current password verification fails', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.route('**/auth/v1/token**', (route: Route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid login credentials',
          error_description: 'Invalid login credentials',
        }),
      });
    });

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('change-password-button').click();

    await page.getByTestId('current-password-input').fill('wrong-password');
    await page.getByTestId('new-password-input').fill('new-password-123');
    await page.getByTestId('confirm-password-input').fill('new-password-123');

    await page.getByTestId('submit-password-button').click();

    await expect(page.getByTestId('change-password-error')).toContainText(
      'Email ou mot de passe incorrect',
    );
  });

  test('opens recovery key dialog after successful password change', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.route('**/auth/v1/token**', (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'e2e-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'e2e-refresh-token',
          user: {
            id: 'e2e-user-id',
            email: 'e2e-user@test.local',
          },
        }),
      });
    });

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

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('change-password-button').click();

    await page.getByTestId('current-password-input').fill('current-password');
    await page.getByTestId('new-password-input').fill('new-password-123');
    await page.getByTestId('confirm-password-input').fill('new-password-123');

    await page.getByTestId('submit-password-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).toBeVisible();
    await expect(page.getByTestId('recovery-key-display')).toContainText(
      MOCK_RECOVERY_KEY,
    );

    await page.getByTestId('recovery-key-confirm-input').fill('aaaa-bbbb-cccc-dddd');
    await page.getByTestId('recovery-key-confirm-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).not.toBeVisible();
  });
});
