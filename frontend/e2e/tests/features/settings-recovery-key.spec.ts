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

test.describe('Settings Recovery Key', () => {
  test.describe.configure({ mode: 'parallel' });

  test('regenerates recovery key after verification', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('generate-recovery-key-button').click();

    await expect(page.getByTestId('verify-password-input')).toBeVisible();
    await page.getByTestId('verify-password-input').fill('current-password');

    await page.getByTestId('submit-regenerate-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).toBeVisible();
    await expect(page.getByTestId('recovery-key-display')).toContainText(
      MOCK_RECOVERY_KEY,
    );

    await page
      .getByTestId('recovery-key-confirm-input')
      .fill('aaaa-bbbb-cccc-dddd');
    await page.getByTestId('recovery-key-confirm-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).not.toBeVisible();
  });

  test('shows error when verification fails', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await injectClientKey(page);

    await page.route('**/api/v1/encryption/validate-key', (route: Route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Key check failed' }),
      });
    });

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('settings-page')).toBeVisible();

    await page.getByTestId('generate-recovery-key-button').click();

    await page.getByTestId('verify-password-input').fill('wrong-password');

    await page.getByTestId('submit-regenerate-button').click();

    await expect(page.getByTestId('regenerate-key-error')).toContainText(
      'Mot de passe incorrect ou clé de chiffrement invalide',
    );
    await expect(page.getByTestId('recovery-key-dialog')).toHaveCount(0);
  });
});
