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
