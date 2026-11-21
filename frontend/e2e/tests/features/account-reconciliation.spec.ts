import { createMockBudgetDetailsResponse } from '../../mocks/api-responses';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import { enableFeatureFlags } from '../../utils/feature-flags';

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

const SAVING_TARGET_ID = '55555555-5555-4555-8555-555555555555';

const CATEGORY = {
  accounts: '33333333-3333-4333-8333-333333333333',
  cards: '44444444-4444-4444-8444-444444444444',
};

const netWorthAsset = (
  id: string,
  name: string,
  direction: 'own' | 'owe',
  categoryId: string,
  inPulpe: boolean,
) => ({
  id,
  categoryId,
  name,
  currency: 'CHF',
  direction,
  inPulpe,
  archivedAt: null,
  latestValue: 0,
  latestRecordedAt: new Date().toISOString(),
  convertedValue: 0,
  suggestion: null,
});

// « Mon patrimoine » with one followed account, one followed card, and two
// items still on offer. Registered after the fixture's catch-all, so it wins.
async function mockNetWorth(page: Page): Promise<void> {
  await enableFeatureFlags(page, { net_worth: true });
  await page.route('**/api/v1/assets', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          json: {
            success: true,
            data: {
              totals: {
                baseCurrency: 'CHF',
                gross: 0,
                debts: 0,
                net: 0,
                incomplete: false,
              },
              categories: [
                { id: CATEGORY.accounts, name: 'Comptes', total: 0 },
                { id: CATEGORY.cards, name: 'Cartes et crédits', total: 0 },
              ],
              assets: [
                netWorthAsset(
                  '11111111-1111-4111-8111-111111111111',
                  'Compte courant',
                  'own',
                  CATEGORY.accounts,
                  true,
                ),
                netWorthAsset(
                  '22222222-2222-4222-8222-222222222222',
                  'Carte Cembra',
                  'owe',
                  CATEGORY.cards,
                  false,
                ),
                netWorthAsset(
                  SAVING_TARGET_ID,
                  'PostFinance',
                  'own',
                  CATEGORY.accounts,
                  false,
                ),
              ],
            },
          },
        })
      : route.fallback(),
  );
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
  await page.getByTestId('reconcile-add-new-button').click();
  await page.getByTestId('reconcile-amount-input').nth(1).fill('120.20');
  await page.getByTestId('reconcile-add-account-button').click();
  await page.getByTestId('reconcile-add-new-button').click();
  await page.getByTestId('reconcile-amount-input').nth(2).fill('-80.05');

  await expect(page.getByTestId('reconcile-total')).toBeInViewport({
    ratio: 1,
  });
  await expect(page.getByTestId('reconcile-next-button')).toBeInViewport({
    ratio: 1,
  });
});

test('wraps the have-minus-owe line inside the footer on a phone with enlarged text', async ({
  authenticatedPage: page,
  currentMonthPage,
}) => {
  await markGuideSeen(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await currentMonthPage.goto();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByTestId('hero-reconcile-button').click();
  await page.getByTestId('reconcile-amount-input').first().fill('300000.55');
  await page.getByTestId('reconcile-add-account-button').click();
  await page.getByTestId('reconcile-add-owe-button').click();
  await page.getByTestId('reconcile-amount-input').nth(1).fill('100000.25');

  const breakdown = page.getByTestId('reconcile-total-breakdown');
  await expect(breakdown).toBeVisible();
  const fits = await breakdown.evaluate((el) => {
    const footer = el.closest('.reconcile-footer')!.getBoundingClientRect();
    return (
      el.scrollWidth <= el.clientWidth &&
      el.getBoundingClientRect().right <= footer.right
    );
  });
  expect(fits).toBe(true);
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

for (const viewport of VIEWPORTS) {
  test(`compares typed accounts, a free row and a card, then remembers the free row (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    await mockNetWorth(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await page.getByTestId('hero-reconcile-button').click();

    await expect(page.getByTestId('reconcile-row-name')).toHaveText([
      'Compte courant',
    ]);
    await page.getByTestId('reconcile-amount-input').first().fill('3000');
    await page.getByTestId('reconcile-add-account-button').click();
    await expect(page.getByTestId('reconcile-add-account-sheet')).toBeVisible();
    await expect(page.getByTestId('reconcile-add-asset-button')).toHaveText([
      /PostFinance/,
      /Carte Cembra/,
    ]);
    await page
      .getByTestId('reconcile-add-asset-button')
      .filter({ hasText: 'Carte Cembra' })
      .click();
    await expect(page.getByTestId('reconcile-row-name')).toHaveText([
      'Compte courant',
      'Carte Cembra',
    ]);
    await page.getByTestId('reconcile-amount-input').nth(1).fill('800');
    await page.getByTestId('reconcile-add-account-button').click();
    await page.getByTestId('reconcile-add-new-button').click();
    await page.getByTestId('reconcile-label-input').fill('Revolut');
    await page.getByTestId('reconcile-amount-input').nth(2).fill('1000');

    await expect(page.getByTestId('reconcile-total')).toContainText('3’200.00');
    await expect(page.getByTestId('reconcile-total-breakdown')).toContainText(
      '4’000.00 CHF − 800.00 CHF que tu dois',
    );
    await page.getByTestId('reconcile-next-button').click();
    await expect(page.getByTestId('reconcile-realized-step')).toBeVisible();

    await page.getByTestId('reconcile-back-button').click();
    await page.getByTestId('reconcile-close-button').click();
    await page.getByTestId('hero-reconcile-button').click();
    await expect(page.getByTestId('reconcile-label-input')).toHaveValue(
      'Revolut',
    );
    await expect(page.getByTestId('reconcile-amount-input').nth(1)).toHaveValue(
      '',
    );
  });

  test(`shows the card help until a « Je dois » row exists, and hides Mon patrimoine with the flag off (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await page.getByTestId('hero-reconcile-button').click();

    await expect(page.getByTestId('reconcile-card-help')).toBeVisible();
    await page.getByTestId('reconcile-add-account-button').click();
    await expect(page.getByTestId('reconcile-add-account-sheet')).toBeVisible();
    await expect(page.getByText('Depuis Mon patrimoine')).toHaveCount(0);
    await page.getByTestId('reconcile-add-close-button').click();

    await page.getByTestId('reconcile-add-owe-help-button').click();
    await expect(page.getByTestId('reconcile-card-help')).toBeHidden();
    await expect(
      page.getByTestId('reconcile-label-input').nth(1),
    ).toBeFocused();
  });

  test(`opens the add sheet in the right frame (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await page.getByTestId('hero-reconcile-button').click();
    await page.getByTestId('reconcile-add-account-button').click();

    await expect(
      page.locator(
        viewport.name === 'phone'
          ? 'mat-bottom-sheet-container'
          : '.mat-mdc-dialog-container >> nth=1',
      ),
    ).toBeVisible();
  });
}

for (const viewport of VIEWPORTS) {
  test(`does not offer an account that a saving prévision of the month points to (${viewport.name})`, async ({
    authenticatedPage: page,
    budgetDetailsPage,
  }) => {
    await markGuideSeen(page);
    await mockNetWorth(page);
    await page.setViewportSize(viewport);
    const response = structuredClone(createMockBudgetDetailsResponse());
    const stamp = new Date().toISOString();
    response.data.budget.year = new Date().getFullYear();
    response.data.budget.month = new Date().getMonth() + 1;
    response.data.budgetLines.push({
      id: '77777777-7777-4777-8777-777777777777',
      budgetId: response.data.budget.id,
      name: 'Épargne PostFinance',
      amount: 100,
      kind: 'saving',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
      templateLineId: null,
      savingsGoalId: null,
      assetId: SAVING_TARGET_ID,
      checkedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await page.route('**/budgets/*/details', (route) =>
      route.fulfill({ json: response }),
    );
    await budgetDetailsPage.goto(response.data.budget.id);
    await page.getByTestId('budget-reconcile-button').click();
    await page.getByTestId('reconcile-add-account-button').click();

    await expect(page.getByTestId('reconcile-add-account-sheet')).toBeVisible();
    await expect(page.getByTestId('reconcile-add-asset-button')).toHaveText([
      /Carte Cembra/,
    ]);
  });
}

const now = new Date();
for (const [name, year, month, isCurrent] of [
  ['current', now.getFullYear(), now.getMonth() + 1, true],
  ['past', 2020, 3, false],
  ['future', 2030, 3, false],
] as const) {
  test(`${isCurrent ? 'reconciles' : 'offers no comparison on'} the ${name} budget`, async ({
    authenticatedPage: page,
    budgetDetailsPage,
  }) => {
    await markGuideSeen(page);
    const response = structuredClone(createMockBudgetDetailsResponse());
    response.data.budget.year = year;
    response.data.budget.month = month;
    response.data.budget.rollover = -20;
    await page.route('**/budgets/*/details', (route) =>
      route.fulfill({ json: response }),
    );
    await budgetDetailsPage.goto(response.data.budget.id);
    if (!isCurrent) {
      // The page is loaded once its month title shows: absence means nothing before.
      await expect(
        page.getByRole('heading', { level: 1, name: `mars ${year}` }),
      ).toBeVisible();
      await expect(page.getByTestId('budget-reconcile-button')).toHaveCount(0);
      return;
    }
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
