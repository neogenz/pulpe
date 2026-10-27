import { createMockBudgetDetailsResponse } from '../../mocks/api-responses';
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

for (const year of [2020, 2030]) {
  test(`reconciles the viewed ${year} budget and refreshes its balance`, async ({
    authenticatedPage: page,
    budgetDetailsPage,
  }) => {
    const response = structuredClone(createMockBudgetDetailsResponse());
    response.data.budget.year = year;
    response.data.budget.rollover = -20;
    await page.route('**/budgets/*/details', (route) =>
      route.fulfill({ json: response }),
    );
    await page.route('**/api/v1/transactions', async (route) => {
      const payload = route.request().postDataJSON();
      expect(payload).toMatchObject({
        budgetId: response.data.budget.id,
        amount: 50,
        kind: 'income',
      });
      expect(payload.checkedAt).toBeTruthy();
      const transaction = {
        ...payload,
        budgetLineId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      response.data.transactions.push(transaction);
      await route.fulfill({ json: { success: true, data: transaction } });
    });
    await budgetDetailsPage.goto(response.data.budget.id);
    await page.getByTestId('budget-reconcile-button').click();
    await page.getByTestId('reconcile-amount-input').fill('30');
    await page.getByTestId('reconcile-next-button').click();
    await page.getByTestId('reconcile-next-button').click();
    await page.getByTestId('reconcile-record-button').click();
    await expect(page.getByTestId('reconcile-record-button')).toBeHidden();
    await page.getByTestId('budget-reconcile-button').click();
    await page.getByTestId('reconcile-amount-input').fill('30');
    await page.getByTestId('reconcile-next-button').click();
    await page.getByTestId('reconcile-next-button').click();
    await expect(page.getByTestId('reconcile-finish-button')).toBeVisible();
  });
}
