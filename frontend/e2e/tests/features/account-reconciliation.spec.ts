import { test, expect } from '../../fixtures/test-fixtures';

test('keeps the live account total visible while editing several accounts on a short mobile viewport', async ({
  authenticatedPage: page,
  currentMonthPage,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await currentMonthPage.goto();
  await page.getByTestId('hero-reconcile-button').click();
  await page.getByTestId('reconcile-amount-input').fill('100.10');
  await page.getByTestId('reconcile-add-account-button').click();
  await page.getByTestId('reconcile-amount-input').nth(1).fill('120.20');
  await page.getByTestId('reconcile-add-account-button').click();
  await page.getByTestId('reconcile-amount-input').nth(2).fill('-80.05');

  await expect(page.getByTestId('reconcile-total')).toBeInViewport({
    ratio: 1,
  });
  await expect(page.getByTestId('reconcile-next-button')).toBeInViewport({
    ratio: 1,
  });
});

test('keeps reconciliation navigation usable while an error toast is visible', async ({
  authenticatedPage: page,
  currentMonthPage,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.route('**/api/v1/transactions', (route) =>
    route.fulfill({
      status: 500,
      json: { success: false, error: { message: 'Simulated failure' } },
    }),
  );
  await currentMonthPage.goto();
  await page.getByTestId('hero-reconcile-button').click();
  await page.getByTestId('reconcile-amount-input').fill('100.10');
  await page.getByTestId('reconcile-next-button').click();
  await page.getByTestId('reconcile-next-button').click();
  await page.getByTestId('reconcile-record-button').click();

  const toast = page.locator('mat-snack-bar-container');
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  const footerBox = await page.locator('.reconcile-footer').boundingBox();
  expect(toastBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(toastBox!.y + toastBox!.height).toBeLessThan(footerBox!.y);

  await page.getByTestId('reconcile-back-button').click({ timeout: 2000 });
  await expect(page.getByTestId('reconcile-realized-step')).toBeVisible();
  await page.getByTestId('reconcile-back-button').click({ timeout: 2000 });
  await expect(page.getByTestId('reconcile-amount-input')).toHaveValue(
    '100.10',
  );
});
