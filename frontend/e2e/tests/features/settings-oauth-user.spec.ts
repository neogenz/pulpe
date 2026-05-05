import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';

const injectClientKey = async (
  page: import('@playwright/test').Page,
): Promise<void> => {
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

test.describe('Settings OAuth User', () => {
  test.describe.configure({ mode: 'parallel' });

  test('hides change password button for OAuth-only user', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      provider: 'google',
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await expect(page.getByTestId('change-password-button')).toHaveCount(0);
    await expect(
      page.getByTestId('generate-recovery-key-button'),
    ).toBeVisible();
  });

  test('shows PIN form in delete account dialog for OAuth-only user', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      provider: 'google',
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('delete-account-button').click();
    const dialog = page.getByRole('dialog', { name: 'Supprimer ton compte' });
    await expect(dialog).toBeVisible();

    await expect(
      dialog.getByTestId('delete-confirm-vault-code-input'),
    ).toBeVisible();
    await expect(
      dialog.getByTestId('delete-confirm-password-input'),
    ).toHaveCount(0);
  });
});
