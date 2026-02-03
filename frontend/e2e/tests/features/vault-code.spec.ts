import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import type { Route } from '@playwright/test';

const MOCK_RECOVERY_KEY = 'AAAA-BBBB-CCCC-DDDD';

test.describe('Vault Code', () => {
  test.describe.configure({ mode: 'parallel' });

  // --- Scenario A: Setup vault code (first-time user) ---

  test.describe('Setup vault code', () => {
    test('redirects to setup-vault-code when vaultCodeConfigured is false', async ({ page }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        provider: 'google',
        vaultCodeConfigured: false,
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/setup-vault-code/);
      await expect(page.getByTestId('setup-vault-code-page')).toBeVisible();
    });

    test('shows required error when vault code field is touched empty', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: false,
      });

      await vaultCodePage.gotoSetup();

      // Touch the vault code field then blur to trigger validation
      await page.getByTestId('vault-code-input').focus();
      await page.getByTestId('vault-code-input').blur();

      await expect(page.locator('mat-error')).toContainText('Ton code coffre-fort est nécessaire');
    });

    test('shows error when codes do not match', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: false,
      });

      await vaultCodePage.gotoSetup();

      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.fillConfirmCode('differentCode99');
      // Blur to trigger cross-field validation
      await page.getByTestId('confirm-vault-code-input').blur();

      await expect(page.locator('mat-error')).toContainText('Les codes ne correspondent pas');
    });

    test('shows minlength error for short code', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: false,
      });

      await vaultCodePage.gotoSetup();

      await vaultCodePage.fillVaultCode('short');
      // Blur to trigger validation
      await page.getByTestId('vault-code-input').blur();

      await expect(page.locator('mat-error')).toContainText('8 caractères minimum');
    });

    test('happy path: setup completes with recovery key dialog', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: false,
      });

      // Mock Supabase auth updateUser endpoint (called after setup to mark vaultCodeConfigured)
      await page.route('**/auth/v1/user', (route: Route) => {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-4000-a000-000000000201',
            user_metadata: { vaultCodeConfigured: true },
          }),
        });
      });

      await vaultCodePage.gotoSetup();

      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.fillConfirmCode('mySecureCode123');

      await vaultCodePage.submitSetup();

      // Recovery key dialog should appear
      await vaultCodePage.expectRecoveryKeyDialogVisible();
      await vaultCodePage.expectRecoveryKeyDisplayed(MOCK_RECOVERY_KEY);

      // Confirm recovery key by pasting it
      await vaultCodePage.confirmRecoveryKey(MOCK_RECOVERY_KEY);

      // Dialog should close after confirmation (no error visible)
      await expect(page.getByTestId('recovery-key-dialog')).not.toBeVisible();
    });
  });

  // --- Scenario B: Enter vault code (returning user) ---

  test.describe('Enter vault code', () => {
    test('redirects to enter-vault-code when vaultCodeConfigured but no client key', async ({ page }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        provider: 'google',
        vaultCodeConfigured: true,
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/enter-vault-code/);
      await expect(page.getByTestId('enter-vault-code-page')).toBeVisible();
    });

    test('happy path: enter code redirects to dashboard', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();

      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.submitEnter();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });

    test('shows error on 400 response (incorrect code)', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      // Override validate-key endpoint to return 400 (simulates wrong vault code)
      await page.route('**/api/v1/encryption/validate-key', (route: Route) => {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Key check failed' }),
        });
      });

      await vaultCodePage.gotoEnter();

      await vaultCodePage.fillVaultCode('wrongCode123');
      await vaultCodePage.submitEnter();

      // Error alert should show
      await expect(page.locator('[role="alert"]')).toContainText('Ce code ne semble pas correct');
    });

    test('lost code link navigates to recover page', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();

      await vaultCodePage.clickLostCodeLink();

      await expect(page).toHaveURL(/\/recover-vault-code/);
    });
  });

  // --- Scenario C: Recover vault code ---

  test.describe('Recover vault code', () => {
    test('happy path: recover and show new recovery key', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoRecover();

      await vaultCodePage.fillRecoveryKey('XXXX-YYYY-ZZZZ-1234');
      await vaultCodePage.fillNewVaultCode('newSecureCode1');
      await vaultCodePage.fillConfirmCode('newSecureCode1');

      await vaultCodePage.submitRecover();

      // New recovery key dialog should appear
      await vaultCodePage.expectRecoveryKeyDialogVisible();
      await vaultCodePage.expectRecoveryKeyDisplayed(MOCK_RECOVERY_KEY);

      await vaultCodePage.confirmRecoveryKey(MOCK_RECOVERY_KEY);

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });

    test('shows error on invalid recovery key (400)', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      // Override recover endpoint to return 400
      await page.route('**/api/v1/encryption/recover', (route: Route) => {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid recovery key' }),
        });
      });

      await vaultCodePage.gotoRecover();

      await vaultCodePage.fillRecoveryKey('INVALID-KEY-HERE');
      await vaultCodePage.fillNewVaultCode('newSecureCode1');
      await vaultCodePage.fillConfirmCode('newSecureCode1');

      await vaultCodePage.submitRecover();

      await expect(page.locator('[role="alert"]')).toContainText('Clé de récupération invalide');
    });

    test('back link navigates to enter vault code', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoRecover();

      // Click the "Retour" back link
      await page.locator('a', { hasText: 'Retour' }).click();

      await expect(page).toHaveURL(/\/enter-vault-code/);
    });
  });

  // --- Scenario D: Non-regression email/password ---

  test.describe('Non-regression', () => {
    test('email user with vault code configured and client key accesses dashboard directly', async ({ page }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      // Inject a valid client key into session storage to bypass encryption guard
      await page.addInitScript(() => {
        const validKeyHex = 'aa'.repeat(32); // 64 hex chars, valid key
        const entry = {
          version: 1,
          data: validKeyHex,
          updatedAt: new Date().toISOString(),
        };
        sessionStorage.setItem('pulpe-vault-client-key-session', JSON.stringify(entry));
      });

      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      // Should NOT redirect to vault code pages
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
