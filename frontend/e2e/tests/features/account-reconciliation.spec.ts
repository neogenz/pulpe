import { createMockBudgetDetailsResponse } from '../../mocks/api-responses';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';

const GUIDE_SEEN_KEY = 'pulpe-reconcile-guide-seen';

// The guide opens by itself on a first open: only the flows that start on step 1
// call this. First-open scenarios start with no key at all.
async function markGuideSeen(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        data: true,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, GUIDE_SEEN_KEY);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 664 },
];

for (const viewport of VIEWPORTS) {
  test(`guides the first comparison, then goes straight to step 1 (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();

    await page.getByTestId('hero-reconcile-button').click();
    await expect(page.getByTestId('reconcile-guide')).toBeVisible();
    await expect(
      page.getByTestId('reconcile-guide').getByRole('heading'),
    ).toHaveText('Vérifie que Pulpe et ta banque disent la même chose');
    await expect(page.getByTestId('reconcile-guide-scene')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // Each scene's button must fit on screen: a click would scroll to it.
    for (let scene = 0; scene < 3; scene++) {
      await expect(page.getByTestId('reconcile-guide-primary')).toBeInViewport({
        ratio: 1,
      });
      await page.getByTestId('reconcile-guide-primary').click();
    }
    await expect(page.getByTestId('reconcile-guide')).toBeHidden();
    await expect(page.getByTestId('reconcile-accounts-step')).toBeVisible();

    await page.getByTestId('reconcile-close-button').click();
    await expect(page.getByTestId('reconcile-accounts-step')).toBeHidden();
    await page.getByTestId('hero-reconcile-button').click();
    await expect(page.getByTestId('reconcile-accounts-step')).toBeVisible();
    await expect(page.getByTestId('reconcile-guide')).toHaveCount(0);

    // Teardown of the flag: the guide comes back on the next open.
    await page.getByTestId('reconcile-close-button').click();
    await expect(page.getByTestId('reconcile-accounts-step')).toBeHidden();
    await page.evaluate((key) => localStorage.removeItem(key), GUIDE_SEEN_KEY);
    await page.getByTestId('hero-reconcile-button').click();
    await expect(page.getByTestId('reconcile-guide')).toBeVisible();
  });

  test(`keeps the typed amount when « ? » replays the guide (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await page.getByTestId('hero-reconcile-button').click();
    await page.getByTestId('reconcile-amount-input').fill('890');

    await page.getByTestId('reconcile-guide-help-button').click();
    await expect(page.getByTestId('reconcile-guide')).toBeVisible();
    await page.getByTestId('reconcile-guide-skip').click();

    await expect(page.getByTestId('reconcile-amount-input')).toHaveValue('890');
  });
}

test('shows each guide scene at its final state at once under reduced motion', async ({
  authenticatedPage: page,
  currentMonthPage,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await currentMonthPage.goto();
  await page.getByTestId('hero-reconcile-button').click();
  const scene = page.getByTestId('reconcile-guide-scene');
  await expect(scene.locator('.differs')).toHaveCSS('animation-name', 'none');
  await page.getByTestId('reconcile-guide-primary').click();
  await page.getByTestId('reconcile-guide-primary').click();
  await expect(scene.locator('.tick')).toHaveCSS('animation-name', 'none');
  await expect(scene.getByText('Pareil des deux côtés')).toHaveCSS(
    'opacity',
    '1',
  );
  await expect(
    scene.getByText("Tu vois cette dépense dans l'app de ta banque ?"),
  ).toHaveCSS('opacity', '0');
});

test('keeps the live account total visible while editing several accounts on a short mobile viewport', async ({
  authenticatedPage: page,
  currentMonthPage,
}) => {
  await markGuideSeen(page);
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
  await markGuideSeen(page);
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
    await markGuideSeen(page);
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
