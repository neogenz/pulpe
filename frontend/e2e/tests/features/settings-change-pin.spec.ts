import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import type { Page, Route } from '@playwright/test';

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

const VALID_OLD_PIN = '123456';
const VALID_NEW_PIN = '654321';

const navigateToSettings = async (page: Page): Promise<void> => {
  await setupAuthBypass(page, {
    includeApiMocks: true,
    setLocalStorage: true,
    vaultCodeConfigured: true,
  });
  await injectClientKey(page);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('settings-page')).toBeVisible();
};

const submitOldPin = async (page: Page, pin: string): Promise<void> => {
  await page.getByTestId('change-pin-old-pin-input').fill(pin);
  await page.getByTestId('change-pin-submit-button').click();
};

const submitNewPin = async (page: Page, pin: string): Promise<void> => {
  await page.getByTestId('change-pin-new-pin-input').fill(pin);
  await page.getByTestId('change-pin-submit-button').click();
};

test.describe('Settings Change PIN', () => {
  test.describe.configure({ mode: 'parallel' });

  test('completes full PIN change flow with recovery key confirmation', async ({ page }) => {
    await navigateToSettings(page);

    await page.getByTestId('change-pin-button').click();

    // Step 1: enter old PIN → validate-key (mock returns 204)
    await expect(page.getByTestId('change-pin-old-pin-input')).toBeVisible();
    await submitOldPin(page, VALID_OLD_PIN);

    // Step 2: enter new PIN → change-pin (mock returns 200 with recoveryKey)
    await expect(page.getByTestId('change-pin-new-pin-input')).toBeVisible();
    await submitNewPin(page, VALID_NEW_PIN);

    // Recovery key dialog appears
    const recoveryDialog = page.getByTestId('recovery-key-dialog');
    await expect(recoveryDialog).toBeVisible();
    await expect(page.getByTestId('recovery-key-display')).toContainText('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGHH-IIJJ');

    // Type the recovery key to confirm
    await page.getByTestId('recovery-key-confirm-input').fill('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGHH-IIJJ');
    await page.getByTestId('recovery-key-confirm-button').click();

    // Snackbar confirms success
    await expect(page.locator('simple-snack-bar')).toContainText('Code PIN modifié');
  });

  test('shows error when old PIN is incorrect', async ({ page }) => {
    await navigateToSettings(page);

    // Override validate-key to return 400
    await page.route('**/api/v1/encryption/validate-key', (route: Route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          statusCode: 400,
          error: 'EncryptionException',
          code: 'ERR_ENCRYPTION_KEY_CHECK_FAILED',
          message: 'Key check failed',
        }),
      });
    });

    await page.getByTestId('change-pin-button').click();
    await submitOldPin(page, VALID_OLD_PIN);

    await expect(page.getByTestId('change-pin-error')).toBeVisible();
  });

  test('shows error when new PIN is same as old', async ({ page }) => {
    await navigateToSettings(page);

    // Override change-pin to return ERR_ENCRYPTION_SAME_KEY
    await page.route('**/api/v1/encryption/change-pin', (route: Route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          statusCode: 400,
          error: 'EncryptionException',
          code: 'ERR_ENCRYPTION_SAME_KEY',
          message: 'New key is the same as the old key',
        }),
      });
    });

    await page.getByTestId('change-pin-button').click();

    // Step 1: old PIN passes validation
    await submitOldPin(page, VALID_OLD_PIN);

    // Step 2: new PIN triggers same-key error
    await expect(page.getByTestId('change-pin-new-pin-input')).toBeVisible();
    await submitNewPin(page, VALID_OLD_PIN);

    await expect(page.getByTestId('change-pin-error')).toBeVisible();
  });

  test('shows rate limit error on 429', async ({ page }) => {
    await navigateToSettings(page);

    // Override validate-key to return 429
    await page.route('**/api/v1/encryption/validate-key', (route: Route) => {
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          statusCode: 429,
          error: 'ThrottlerException',
          code: 'HTTP_429',
          message: 'Too many requests',
        }),
      });
    });

    await page.getByTestId('change-pin-button').click();
    await submitOldPin(page, VALID_OLD_PIN);

    await expect(page.getByTestId('change-pin-error')).toBeVisible();
  });

  test('shows error on rekey failure', async ({ page }) => {
    await navigateToSettings(page);

    // Override change-pin to return ERR_ENCRYPTION_REKEY_FAILED
    await page.route('**/api/v1/encryption/change-pin', (route: Route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          statusCode: 500,
          error: 'EncryptionException',
          code: 'ERR_ENCRYPTION_REKEY_FAILED',
          message: 'Rekey operation failed',
        }),
      });
    });

    await page.getByTestId('change-pin-button').click();

    // Step 1: old PIN passes
    await submitOldPin(page, VALID_OLD_PIN);

    // Step 2: new PIN triggers rekey failure
    await expect(page.getByTestId('change-pin-new-pin-input')).toBeVisible();
    await submitNewPin(page, VALID_NEW_PIN);

    await expect(page.getByTestId('change-pin-error')).toBeVisible();
  });
});
