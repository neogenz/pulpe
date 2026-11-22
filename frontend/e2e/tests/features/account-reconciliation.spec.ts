import { createMockBudgetDetailsResponse } from '../../mocks/api-responses';
import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';
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

// The comparison calls no reconciliation endpoint: each call sent is
// recorded, and the list must stay empty. Registered after the fixture's
// catch-all, so it wins.
async function watchReconciliationCalls(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route('**/api/v1/reconciliation/**', (route) => {
    calls.push(`${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  return calls;
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
  await watchReconciliationCalls(page);
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
  await page.getByTestId('reconcile-record-button').click();

  const toast = page.locator('mat-snack-bar-container');
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  const footerBox = await page.locator('.reconcile-footer').boundingBox();
  expect(toastBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(toastBox!.y + toastBox!.height).toBeLessThan(footerBox!.y);
  // On a phone the toast sits over the header; the retry, in the footer, stays free.
  await page
    .getByTestId('reconcile-record-button')
    .click({ trial: true, timeout: 2000 });

  await toast.getByRole('button', { name: 'Fermer' }).click();
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
    await watchReconciliationCalls(page);
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
    await expect(page.getByTestId('reconcile-compare-step')).toBeVisible();

    await page.getByTestId('reconcile-back-button').click();
    await page.getByTestId('reconcile-close-button').click();
    await expect(page.getByTestId('reconcile-accounts-step')).toBeHidden();
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
    // The month above comes from the Node clock: the browser reads the same instant.
    await page.clock.setFixedTime(now);
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
    await watchReconciliationCalls(page);
    await page.route('**/api/v1/transactions', async (route) => {
      const payload = route.request().postDataJSON();
      expect(payload).toMatchObject({
        budgetId: response.data.budget.id,
        name: 'Écart avec mes comptes',
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
    await page.getByTestId('reconcile-record-button').click();
    await expect(page.getByTestId('reconcile-record-button')).toBeHidden();
    await page.getByTestId('budget-reconcile-button').click();
    await page.getByTestId('reconcile-amount-input').fill('30');
    await page.getByTestId('reconcile-next-button').click();
    await expect(page.getByTestId('reconcile-finish-button')).toBeVisible();
  });
}

// Pulpe holds 3 200.00 checked (salary in, rent out). Three items wait to be
// checked: Assurance 100.00, Essence 60.00, Pharmacie 40.00. Each check answers
// like the server and the details follow it.
async function mockMonthToCheck(page: Page): Promise<void> {
  const response = structuredClone(createMockBudgetDetailsResponse());
  const budgetId = response.data.budget.id;
  const today = new Date().toISOString();
  const checked = new Set<string>();
  const lines = [
    createBudgetLineMock('a1111111-1111-4111-8111-111111111111', budgetId, {
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      checkedAt: today,
    }),
    createBudgetLineMock('a2222222-2222-4222-8222-222222222222', budgetId, {
      name: 'Loyer',
      amount: 1800,
      checkedAt: today,
    }),
    createBudgetLineMock('a3333333-3333-4333-8333-333333333333', budgetId, {
      name: 'Assurance',
      amount: 100,
    }),
  ];
  const transactions = [
    createTransactionMock('b1111111-1111-4111-8111-111111111111', budgetId, {
      name: 'Essence',
      amount: 60,
      transactionDate: today,
    }),
    createTransactionMock('b2222222-2222-4222-8222-222222222222', budgetId, {
      name: 'Pharmacie',
      amount: 40,
      transactionDate: today,
    }),
  ];
  const withChecks = <T extends { id: string; checkedAt: string | null }>(
    item: T,
  ) => (checked.has(item.id) ? { ...item, checkedAt: today } : item);
  await page.route('**/api/v1/budgets/*/details', (route) =>
    route.fulfill({
      json: {
        ...response,
        data: {
          ...response.data,
          budgetLines: lines.map(withChecks),
          transactions: transactions.map(withChecks),
        },
      },
    }),
  );
  for (const item of [...lines, ...transactions]) {
    const path = 'transactionDate' in item ? 'transactions' : 'budget-lines';
    await page.route(`**/api/v1/${path}/${item.id}/toggle-check`, (route) => {
      checked.add(item.id);
      return route.fulfill({
        json: { success: true, data: { ...item, checkedAt: today } },
      });
    });
  }
}

async function compareWith(page: Page, ...amounts: string[]): Promise<void> {
  await page.getByTestId('hero-reconcile-button').click();
  for (const [index, amount] of amounts.entries()) {
    await page.getByTestId('reconcile-amount-input').nth(index).fill(amount);
  }
  await page.getByTestId('reconcile-next-button').click();
}

for (const viewport of VIEWPORTS) {
  test(`suggests the items that explain the gap, then ends matched once they are checked (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    await mockMonthToCheck(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '3100');

    const heading = page.getByTestId('reconcile-step-heading');
    await expect(heading).toHaveText(
      'Tes comptes ont 100.00 CHF de moins que Pulpe',
    );
    await expect(heading).toBeFocused();
    const suggestions = page.getByTestId('reconcile-suggestion');
    await expect(suggestions).toHaveCount(3);
    await expect(suggestions.first()).toContainText('Assurance');
    await expect(page.getByTestId('reconcile-dismiss-button')).toBeInViewport({
      ratio: 1,
    });

    await suggestions.filter({ hasText: 'Essence' }).click();
    await expect(page.getByTestId('reconcile-compared-before')).toHaveText(
      '3’200.00 CHF',
    );
    await expect(page.getByTestId('reconcile-found')).toContainText(
      '60.00 CHF trouvés',
    );
    await expect(heading).toHaveText(
      'Tes comptes ont 40.00 CHF de moins que Pulpe',
    );
    await expect(page.getByTestId('reconcile-view-items-button')).toHaveText(
      'Voir 1 autre à cocher',
    );

    await suggestions.filter({ hasText: 'Pharmacie' }).click();
    await expect(heading).toHaveText('Pareil des deux côtés');
    await expect(page.getByTestId('reconcile-finish-button')).toBeInViewport({
      ratio: 1,
    });
    await page.getByTestId('reconcile-finish-button').click();
    await expect(page.getByTestId('reconcile-compare-step')).toBeHidden();
    expect(calls).toEqual([]);
  });

  test(`notes a large gap once on a double tap, under the name « Écart avec mes comptes » (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    const entries: unknown[] = [];
    await page.route('**/api/v1/transactions', (route) => {
      const payload = route.request().postDataJSON();
      entries.push(payload);
      return route.fulfill({
        json: {
          success: true,
          data: {
            ...payload,
            id: 'c1111111-1111-4111-8111-111111111111',
            budgetLineId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    });
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '-120');

    await expect(page.getByTestId('reconcile-large-gap')).toContainText(
      "Tu vois −120.00 CHF dans l'app de ta banque, mais pas dans Pulpe ?",
    );
    const record = page.getByTestId('reconcile-record-button');
    await expect(record).toContainText('Oui, noter une dépense de 120.00 CHF');
    await expect(record).toBeInViewport({ ratio: 1 });
    await record.dblclick();

    await expect(page.getByTestId('reconcile-compare-step')).toBeHidden();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      name: 'Écart avec mes comptes',
      kind: 'expense',
      amount: 120,
    });
    expect(calls).toEqual([]);
  });

  test(`offers a small gap as a rounding, and leaves it without writing (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '-2.40');

    await expect(page.getByTestId('reconcile-small-gap')).toContainText(
      'Café · payé 3.80 · noté 3.00',
    );
    await expect(page.getByTestId('reconcile-record-button')).toContainText(
      'Noter une dépense de 2.40 CHF',
    );
    await page.getByTestId('reconcile-leave-button').click();

    await expect(page.getByTestId('reconcile-compare-step')).toBeHidden();
    expect(calls).toEqual([]);
  });

  test(`speaks of the card with a « Je dois » row, and can take it out (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    await watchReconciliationCalls(page);
    await mockMonthToCheck(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await page.getByTestId('hero-reconcile-button').click();
    await page.getByTestId('reconcile-amount-input').fill('3900');
    await page.getByTestId('reconcile-add-owe-help-button').click();
    await page.getByTestId('reconcile-label-input').nth(1).fill('Visa');
    await page.getByTestId('reconcile-amount-input').nth(1).fill('800');
    await page.getByTestId('reconcile-next-button').click();

    await expect(page.getByTestId('reconcile-compare-step')).toContainText(
      'Coche les achats faits avec ta carte.',
    );
    await expect(page.getByTestId('reconcile-owe-box')).toContainText(
      'Tu coches tes achats de carte à la facture ?',
    );
    await page.getByTestId('reconcile-remove-owe-button').click();

    await expect(page.getByTestId('reconcile-step-heading')).toHaveText(
      'Tes comptes ont 700.00 CHF de plus que Pulpe',
    );
  });
}

// The page scrolls under a sticky toolbar on a phone: the title must land in
// view and uncovered, not just somewhere in the document.
test('lands on the items still to check from home, title in view and focused, on a phone', async ({
  authenticatedPage: page,
  currentMonthPage,
}) => {
  await markGuideSeen(page);
  await watchReconciliationCalls(page);
  await mockMonthToCheck(page);
  await page.setViewportSize({ width: 390, height: 664 });
  await currentMonthPage.goto();
  await compareWith(page, '3100');
  await page
    .getByTestId('reconcile-suggestion')
    .filter({ hasText: 'Essence' })
    .click();
  await page.getByTestId('reconcile-view-items-button').click();
  // Closing hands the home's scroll position back: judge the title after it.
  await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
  await expect(page).toHaveURL(/\/budget\//);

  const title = page.locator('#budget-items-title');
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport({ ratio: 1 });
  // Polled: the route's view transition covers the page for a moment.
  await expect
    .poll(() =>
      title.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + 4, box.top + 4);
        return element.contains(hit);
      }),
    )
    .toBe(true);
  await expect(page.getByTestId('unchecked-filter-chip')).toHaveClass(
    /mat-button-toggle-checked/,
  );
});

// Pulpe holds 900.00 checked: the salary, nothing else. « Disponible » is 900.00 too.
async function mockMonthOf900(page: Page): Promise<void> {
  const now = new Date();
  const id = TEST_UUIDS.BUDGET_1;
  await page.route('**/api/v1/budgets/*/details', (route) =>
    route.fulfill({
      json: createBudgetDetailsMock(id, {
        budget: { month: now.getMonth() + 1, year: now.getFullYear() },
        budgetLines: [
          createBudgetLineMock(TEST_UUIDS.LINE_1, id, {
            name: 'Salaire',
            kind: 'income',
            amount: 900,
            checkedAt: now.toISOString(),
          }),
        ],
      }),
    }),
  );
}

for (const viewport of VIEWPORTS) {
  // The money that was there before Pulpe is a gap like any other.
  test(`compares the accounts with the « Solde pointé » alone (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    // The month comes from the Node clock: the browser reads the same instant.
    await page.clock.setFixedTime(new Date());
    await mockMonthOf900(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '4000');

    await expect(page.getByTestId('reconcile-step-heading')).toHaveText(
      'Tes comptes ont 3’100.00 CHF de plus que Pulpe',
    );
    await expect(page.getByTestId('reconcile-compared')).toHaveText(
      '900.00 CHF',
    );
    await expect(page.getByTestId('reconcile-record-button')).toContainText(
      'Oui, noter un revenu de 3’100.00 CHF',
    );
    await expect(page.getByRole('dialog')).not.toContainText('avant Pulpe');
    expect(calls).toEqual([]);
  });

  // Maxime's month: an unchecked salary last month no longer weighs here.
  test(`shows a 29.52 gap for a « Solde pointé » of -1 832.48 against -1 862 (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    const now = new Date();
    await page.clock.setFixedTime(now);
    await page.route('**/api/v1/budgets/*/details', (route) =>
      route.fulfill({
        json: createBudgetDetailsMock(TEST_UUIDS.BUDGET_1, {
          budget: { month: now.getMonth() + 1, year: now.getFullYear() },
          budgetLines: [
            createBudgetLineMock(TEST_UUIDS.LINE_1, TEST_UUIDS.BUDGET_1, {
              name: 'Loyer',
              amount: 1832.48,
              checkedAt: now.toISOString(),
            }),
          ],
        }),
      }),
    );
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '-1862');

    await expect(page.getByTestId('reconcile-step-heading')).toHaveText(
      'Tes comptes ont 29.52 CHF de moins que Pulpe',
    );
    await expect(page.getByTestId('reconcile-compared')).toHaveText(
      '-1’832.48 CHF',
    );
    await expect(page.getByRole('dialog')).not.toContainText('avant Pulpe');
    expect(calls).toEqual([]);
  });

  test(`asks about a card when the accounts hold more, and adds what I owe (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    await markGuideSeen(page);
    await watchReconciliationCalls(page);
    // The month comes from the Node clock: the browser reads the same instant.
    await page.clock.setFixedTime(new Date());
    await mockMonthOf900(page);
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '1700');

    await expect(page.getByTestId('reconcile-card-question')).toContainText(
      'Tu as payé par carte de crédit, PayPal ou Klarna ?',
    );
    await expect(page.getByTestId('reconcile-large-gap')).toContainText(
      "Tu vois +800.00 CHF dans l'app de ta banque, mais pas dans Pulpe ?",
    );
    await expect(page.getByTestId('reconcile-record-button')).toContainText(
      'Oui, noter un revenu de 800.00 CHF',
    );
    await page.getByTestId('reconcile-card-owe-button').click();

    await expect(page.getByTestId('reconcile-accounts-step')).toBeVisible();
    await expect(
      page.getByTestId('reconcile-amount-input').first(),
    ).toHaveValue('1700');
    await expect(
      page.getByTestId('reconcile-label-input').nth(1),
    ).toBeFocused();
  });

  test(`says the salary may be early two days before pay day (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    const now = new Date();
    await page.clock.setFixedTime(
      new Date(now.getFullYear(), now.getMonth(), 23, 12),
    );
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    await mockMonthOf900(page);
    await page.route('**/api/v1/users/settings', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            json: { success: true, data: { payDayOfMonth: 25 } },
          })
        : route.fallback(),
    );
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '6900');

    await expect(page.getByTestId('reconcile-step-heading')).toHaveText(
      'Tes comptes ont 6’000.00 CHF de plus que Pulpe',
    );
    await expect(page.getByTestId('reconcile-salary-early')).toHaveText(
      'Ton salaire est arrivé en avance ? Reviens comparer le 25, jour de ta paie.',
    );
    await page.getByTestId('reconcile-leave-button').click();

    await expect(page.getByTestId('reconcile-compare-step')).toBeHidden();
    expect(calls).toEqual([]);
  });
}

// Pulpe holds 900.00 checked: the salary of 1 500.00, minus Courses 600.00
// checked with 200.00 noted on it, so 400.00 of it is still on the account.
async function mockMonthWithPartlySpentLine(page: Page): Promise<void> {
  const now = new Date();
  const id = TEST_UUIDS.BUDGET_1;
  const groceriesId = 'a4444444-4444-4444-8444-444444444444';
  await page.route('**/api/v1/budgets/*/details', (route) =>
    route.fulfill({
      json: createBudgetDetailsMock(id, {
        budget: { month: now.getMonth() + 1, year: now.getFullYear() },
        budgetLines: [
          createBudgetLineMock(TEST_UUIDS.LINE_1, id, {
            name: 'Salaire',
            kind: 'income',
            amount: 1500,
            checkedAt: now.toISOString(),
          }),
          createBudgetLineMock(groceriesId, id, {
            name: 'Courses',
            amount: 600,
            checkedAt: now.toISOString(),
          }),
        ],
        transactions: [
          createTransactionMock('b3333333-3333-4333-8333-333333333333', id, {
            name: 'Migros',
            amount: 200,
            budgetLineId: groceriesId,
            transactionDate: now.toISOString(),
            checkedAt: now.toISOString(),
          }),
        ],
      }),
    }),
  );
}

for (const viewport of VIEWPORTS) {
  test(`lists the other reasons from salary early, then notes the income once (${viewport.name})`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    const now = new Date();
    await page.clock.setFixedTime(
      new Date(now.getFullYear(), now.getMonth(), 23, 12),
    );
    await markGuideSeen(page);
    const calls = await watchReconciliationCalls(page);
    await mockMonthWithPartlySpentLine(page);
    await page.route('**/api/v1/users/settings', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            json: { success: true, data: { payDayOfMonth: 25 } },
          })
        : route.fallback(),
    );
    const entries: unknown[] = [];
    await page.route('**/api/v1/transactions', (route) => {
      const payload = route.request().postDataJSON();
      entries.push(payload);
      return route.fulfill({
        json: {
          success: true,
          data: {
            ...payload,
            id: 'c2222222-2222-4222-8222-222222222222',
            budgetLineId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    });
    await page.setViewportSize(viewport);
    await currentMonthPage.goto();
    await compareWith(page, '6900');

    await expect(page.getByTestId('reconcile-salary-early')).toBeVisible();
    await expect(page.getByTestId('reconcile-leave-button')).toBeVisible();
    await page.getByTestId('reconcile-reasons-button').click();

    const sheet = page.getByTestId('reconcile-reasons-sheet');
    await expect(
      page.locator(
        viewport.name === 'phone'
          ? 'mat-bottom-sheet-container'
          : '.mat-mdc-dialog-container >> nth=1',
      ),
    ).toBeVisible();
    await expect(sheet.locator('h2')).toHaveText(
      "D'où viennent ces 6’000.00 CHF ?",
    );
    await expect(sheet.getByTestId('reconcile-reason')).toHaveCount(3);
    await expect(sheet.getByTestId('reconcile-reason').nth(0)).toContainText(
      'Tu as payé par carte de crédit, PayPal ou Klarna ?',
    );
    await expect(sheet.getByTestId('reconcile-reason-spent')).toHaveText(
      '200.00 CHF dépensés',
    );
    await expect(sheet.getByTestId('reconcile-reason-left')).toHaveText(
      '400.00 CHF encore là',
    );
    await expect(sheet.getByTestId('reconcile-reason').nth(2)).toContainText(
      'Disponible : 900.00 CHF → 6’900.00 CHF',
    );
    const income = sheet.getByTestId('reconcile-reasons-income-button');
    await expect(income).toHaveText('Noter un revenu de 6’000.00 CHF');
    await income.click();

    await expect(page.getByTestId('reconcile-compare-step')).toBeHidden();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      name: 'Écart avec mes comptes',
      kind: 'income',
      amount: 6000,
    });
    expect(calls).toEqual([]);
  });
}
