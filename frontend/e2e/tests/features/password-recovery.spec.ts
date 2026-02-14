import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import type { Page, Route } from '@playwright/test';

const mockSupabaseUpdateUser = async (page: Page) => {
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

const mockSupabaseResetEmail = async (page: Page) => {
  await page.route('**/auth/v1/recover**', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
};

const mockSalt = async (page: Page, hasRecoveryKey: boolean) => {
  await page.route('**/api/v1/encryption/salt', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        salt: '00000000000000000000000000000000',
        kdfIterations: 1,
        hasRecoveryKey,
      }),
    });
  });
};

test.describe('Password Recovery', () => {
  test.describe.configure({ mode: 'parallel' });

  test('forgot password shows validation error for invalid email', async ({
    page,
  }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('forgot-password-page')).toBeVisible();

    await page.getByTestId('email-input').fill('invalid-email');
    await page.getByTestId('email-input').blur();

    await expect(page.locator('mat-error')).toContainText(
      'Cette adresse email ne semble pas valide',
    );
  });

  test('forgot password shows success message after submission', async ({
    page,
  }) => {
    await mockSupabaseResetEmail(page);

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('forgot-password-page')).toBeVisible();

    await page.getByTestId('email-input').fill('user@test.local');
    await page.getByTestId('forgot-password-submit-button').click();

    await expect(page.getByTestId('forgot-password-success')).toBeVisible();
  });

  test('reset password shows invalid link message when session is missing', async ({
    page,
  }) => {
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('invalid-link-message')).toBeVisible();
    await expect(
      page.getByTestId('back-to-forgot-password-button'),
    ).toBeVisible();
  });

  test('reset password with recovery key shows required error when input contains only invalid chars', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: false,
    });

    await mockSalt(page, true);
    await mockSupabaseUpdateUser(page);

    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-page')).toBeVisible();
    await expect(page.getByTestId('recovery-key-input')).toBeVisible();

    await page.getByTestId('recovery-key-input').fill('@@@');
    await page.getByTestId('recovery-key-input').blur();

    await expect(page.locator('mat-error')).toContainText(
      'Ta clé de récupération est nécessaire',
    );
  });

  test('reset password with recovery key shows error on invalid key response', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: false,
    });

    await mockSalt(page, true);
    await mockSupabaseUpdateUser(page);

    await page.route('**/api/v1/encryption/recover', (route: Route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid recovery key' }),
      });
    });

    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-page')).toBeVisible();
    await expect(page.getByTestId('recovery-key-input')).toBeVisible();

    await page.getByTestId('recovery-key-input').fill('AAAA-BBBB-CCCC-DDDD');
    await page.getByTestId('new-password-input').fill('new-password-123');
    await page.getByTestId('confirm-password-input').fill('new-password-123');

    await page.getByTestId('reset-password-submit-button').click();

    await expect(page.locator('[role="alert"]')).toContainText(
      'Clé de récupération invalide',
    );
  });

  test('reset password with recovery key completes, shows new key dialog, and redirects to setup vault code', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: false,
    });

    await mockSalt(page, true);
    await mockSupabaseUpdateUser(page);

    await page.route('**/api/v1/encryption/recover', (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-page')).toBeVisible();
    await expect(page.getByTestId('recovery-key-input')).toBeVisible();

    await page.getByTestId('recovery-key-input').fill('aaaa-bbbb-cccc-dddd');
    await expect(page.getByTestId('recovery-key-input')).toHaveValue(
      'AAAA-BBBB-CCCC-DDDD',
    );

    await page.getByTestId('new-password-input').fill('new-password-123');
    await page.getByTestId('confirm-password-input').fill('new-password-123');
    await page.getByTestId('reset-password-submit-button').click();

    await expect(page.getByTestId('recovery-key-dialog')).toBeVisible();
    await page
      .getByTestId('recovery-key-confirm-input')
      .fill('AAAA-BBBB-CCCC-DDDD');
    await page.getByTestId('recovery-key-confirm-button').click();
    await expect(page).toHaveURL(/\/setup-vault-code/);
  });
});
