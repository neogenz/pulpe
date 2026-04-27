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

  test('reset password shows validation errors for empty fields', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: false,
    });

    await mockSupabaseUpdateUser(page);

    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-page')).toBeVisible();

    await page.getByTestId('new-password-input').focus();
    await page.getByTestId('new-password-input').blur();

    await expect(page.locator('mat-error')).toContainText(
      'Ton nouveau mot de passe est nécessaire',
    );
  });

  test('reset password shows minlength error for short password', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: false,
    });

    await mockSupabaseUpdateUser(page);

    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-page')).toBeVisible();

    await page.getByTestId('new-password-input').fill('short');
    await page.getByTestId('new-password-input').blur();

    await expect(page.locator('mat-error')).toContainText(
      '8 caractères minimum',
    );
  });

  test('reset password completes and redirects to dashboard', async ({
    page,
  }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    // Inject client key so encryptionSetupGuard allows navigation to dashboard
    await page.addInitScript(() => {
      const validKeyHex = 'aa'.repeat(32);
      sessionStorage.setItem(
        'pulpe-vault-client-key-session',
        JSON.stringify({
          version: 1,
          data: validKeyHex,
          updatedAt: new Date().toISOString(),
        }),
      );
    });

    await mockSupabaseUpdateUser(page);

    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-page')).toBeVisible();

    await page.getByTestId('new-password-input').fill('new-password-123');
    await page.getByTestId('confirm-password-input').fill('new-password-123');
    await page.getByTestId('reset-password-submit-button').click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
