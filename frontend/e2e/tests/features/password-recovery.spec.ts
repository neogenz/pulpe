import { test, expect } from '../../fixtures/test-fixtures';
import type { Route } from '@playwright/test';

const mockSupabaseResetEmail = async (page: import('@playwright/test').Page) => {
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

  test('forgot password shows validation error for invalid email', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('forgot-password-page')).toBeVisible();

    await page.getByTestId('email-input').fill('invalid-email');
    await page.getByTestId('email-input').blur();

    await expect(page.locator('mat-error')).toContainText(
      'Cette adresse email ne semble pas valide',
    );
  });

  test('forgot password shows success message after submission', async ({ page }) => {
    await mockSupabaseResetEmail(page);

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('forgot-password-page')).toBeVisible();

    await page.getByTestId('email-input').fill('user@test.local');
    await page.getByTestId('forgot-password-submit-button').click();

    await expect(page.getByTestId('forgot-password-success')).toBeVisible();
  });

  test('reset password shows invalid link message when session is missing', async ({ page }) => {
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('invalid-link-message')).toBeVisible();
    await expect(page.getByTestId('back-to-forgot-password-button')).toBeVisible();
  });
});
