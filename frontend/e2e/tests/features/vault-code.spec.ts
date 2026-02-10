import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass, setupMaintenanceMock } from '../../utils/auth-bypass';
import type { Route } from '@playwright/test';

const MOCK_RECOVERY_KEY = 'AAAA-BBBB-CCCC-DDDD';
const MOCK_RECOVERY_KEY_LONG =
  'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ12-3456-7890-ABCD-1234-5678-9ABC';

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

      await expect(page.locator('mat-error')).toContainText('Les deux codes ne sont pas identiques — on réessaie ?');
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

    test('recovery key dialog supports copy and confirmation (case-insensitive)', async ({ page, vaultCodePage }) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: false,
      });

      await page.route('**/auth/v1/user', (route: Route) => {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '00000000-0000-4000-a000-000000000202',
            user_metadata: { vaultCodeConfigured: true },
          }),
        });
      });

      await page.route('**/api/v1/encryption/setup-recovery', (route: Route) => {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ recoveryKey: MOCK_RECOVERY_KEY_LONG }),
        });
      });

      await vaultCodePage.gotoSetup();
      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.fillConfirmCode('mySecureCode123');
      await vaultCodePage.submitSetup();

      await vaultCodePage.expectRecoveryKeyDialogVisible();
      await vaultCodePage.expectRecoveryKeyDisplayed(MOCK_RECOVERY_KEY_LONG);

      await page.keyboard.press('Escape');
      await vaultCodePage.expectRecoveryKeyDialogVisible();

      await page.getByTestId('copy-recovery-key-button').click();
      await expect(page.getByTestId('copy-recovery-key-button')).toContainText('Copié !');

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(MOCK_RECOVERY_KEY_LONG);

      const normalized = MOCK_RECOVERY_KEY_LONG.replace(/-/g, '').toLowerCase();
      await page.getByTestId('recovery-key-confirm-input').fill(normalized);
      await expect(page.getByTestId('recovery-key-confirm-button')).toBeEnabled();
      await page.getByTestId('recovery-key-confirm-button').click();

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

    test('logout from vault code screen redirects to login', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();
      await page.getByTestId('vault-code-logout-button').click();

      await expect(page).toHaveURL(/\/(login|welcome)/);
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

    test('formats recovery key input to uppercase grouped format', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoRecover();

      const recoveryInput = page.getByTestId('recovery-key-input');
      await recoveryInput.fill('abcd2345efgh');

      await expect(recoveryInput).toHaveValue('ABCD-2345-EFGH');
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
      await page.getByRole('button', { name: 'Retour' }).click();

      await expect(page).toHaveURL(/\/enter-vault-code/);
    });
  });

  // --- Scenario D: Remember device storage behavior ---

  test.describe('Remember device storage', () => {
    test('stores client key in localStorage when remember device is checked', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();
      await vaultCodePage.toggleRememberDevice();
      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.submitEnter();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      const storage = await page.evaluate(() => ({
        local: localStorage.getItem('pulpe-vault-client-key-local'),
        session: sessionStorage.getItem('pulpe-vault-client-key-session'),
      }));

      expect(storage.local).not.toBeNull();
      expect(storage.session).toBeNull();

      const parsed = JSON.parse(storage.local as string) as { data?: string };
      expect(parsed.data).toMatch(/^[0-9a-f]{64}$/i);
    });

    test('stores client key in sessionStorage when remember device is unchecked', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();
      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.submitEnter();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      const storage = await page.evaluate(() => ({
        local: localStorage.getItem('pulpe-vault-client-key-local'),
        session: sessionStorage.getItem('pulpe-vault-client-key-session'),
      }));

      expect(storage.local).toBeNull();
      expect(storage.session).not.toBeNull();

      const parsed = JSON.parse(storage.session as string) as { data?: string };
      expect(parsed.data).toMatch(/^[0-9a-f]{64}$/i);
    });

    test('localStorage client key persists across new context', async ({ page, browser, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();
      await vaultCodePage.toggleRememberDevice();
      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.submitEnter();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      const storageState = await page.context().storageState();
      const newContext = await browser.newContext({ storageState });
      const newPage = await newContext.newPage();

      await setupAuthBypass(newPage, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });
      await setupMaintenanceMock(newPage);

      await newPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(newPage).toHaveURL(/\/dashboard/);

      await newContext.close();
    });

    test('sessionStorage client key does not persist across new tab', async ({ page, vaultCodePage }) => {
      await setupAuthBypass(page, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });

      await vaultCodePage.gotoEnter();
      await vaultCodePage.fillVaultCode('mySecureCode123');
      await vaultCodePage.submitEnter();

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

      const secondPage = await page.context().newPage();
      await setupAuthBypass(secondPage, {
        includeApiMocks: true,
        setLocalStorage: true,
        vaultCodeConfigured: true,
      });
      await setupMaintenanceMock(secondPage);

      await secondPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(secondPage).toHaveURL(/\/enter-vault-code/);
    });
  });

  // --- Scenario E: Non-regression email/password ---

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
