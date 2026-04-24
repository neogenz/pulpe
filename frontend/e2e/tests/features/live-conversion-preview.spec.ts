import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * Live Conversion Preview — amount-entry dialogs
 *
 * Context: when the user picks a secondary currency in an amount-entry
 * dialog, the converted value + rate used to be hidden until submit.
 * A caption now sits right under the amount field with a live preview.
 *
 * Covered on `add-budget-line-dialog` as the representative surface —
 * the logic is factored into `injectLiveConversionPreview()` and the
 * `<pulpe-conversion-preview-line>` UI component, so all wired dialogs
 * share the same behaviour (verified via unit tests).
 */

const BUDGET_ID = TEST_UUIDS.BUDGET_1;
const PREVIEW = '[data-testid="conversion-preview-line"]';
const PREVIEW_AMOUNT = '[data-testid="conversion-preview-amount"]';
const PREVIEW_ERROR = '[data-testid="conversion-preview-error"]';

async function mockUserCurrency(
  page: Page,
  currency: 'CHF' | 'EUR',
  showCurrencySelector: boolean,
) {
  // The auth-bypass fixture registers a default /users/settings handler that
  // omits `currency` and `showCurrencySelector`. Remove it first so our
  // currency-aware response is the only match.
  await page.unroute('**/api/v1/users/settings').catch(() => {});
  await page.route('**/api/v1/users/settings', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { payDayOfMonth: 25, currency, showCurrencySelector },
      }),
    });
  });
}

async function mockEmptyBudget(page: Page) {
  await page.route('**/api/v1/budgets/*/details', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createBudgetDetailsMock(BUDGET_ID)),
    }),
  );
}

type RateHandler =
  | { kind: 'success'; rate: number; date: string }
  | { kind: 'error'; status: number };

async function mockRate(page: Page, handler: RateHandler) {
  await page.route('**/api/v1/currency/rate**', (route) => {
    if (handler.kind === 'error') {
      return route.fulfill({
        status: handler.status,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'FX indisponible' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          base: 'CHF',
          target: 'EUR',
          rate: handler.rate,
          date: handler.date,
        },
      }),
    });
  });
}

async function openAddBudgetLineDialog(
  page: Page,
  budgetDetailsPage: { goto: (id: string) => Promise<void> },
) {
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/users/settings') && r.request().method() === 'GET',
    ),
    budgetDetailsPage.goto(BUDGET_ID),
  ]);
  await page.getByTestId('add-first-line').click();
  await expect(page.getByTestId('new-line-amount')).toBeVisible();
}

function currencyPicker(page: Page) {
  // mat-select inherits its accessible name from the surrounding mat-label
  // ("Montant"), so we disambiguate by selected text (flag + code).
  return page
    .getByRole('dialog')
    .getByRole('combobox')
    .filter({ hasText: /CHF|EUR/ });
}

async function selectCurrency(page: Page, code: 'CHF' | 'EUR') {
  await currencyPicker(page).click();
  await page.getByRole('option', { name: new RegExp(code) }).click();
}

test.describe('Live Conversion Preview — add budget line dialog', () => {

  test('shows the converted amount and rate when a secondary currency is picked (AC1)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockUserCurrency(authenticatedPage, 'EUR', true);
    await mockEmptyBudget(authenticatedPage);
    await mockRate(authenticatedPage, {
      kind: 'success',
      rate: 1.0899,
      date: '2026-04-22',
    });

    await openAddBudgetLineDialog(authenticatedPage, budgetDetailsPage);

    await authenticatedPage.getByTestId('new-line-amount').fill('100');
    await selectCurrency(authenticatedPage, 'CHF');

    const caption = authenticatedPage.locator(PREVIEW);
    await expect(caption).toBeVisible();

    const amount = authenticatedPage.locator(PREVIEW_AMOUNT);
    await expect(amount).toContainText('108,99');
    await expect(amount).toContainText('€');
    await expect(amount).toContainText('1,0899');
    await expect(caption).toHaveClass(/ph-no-capture/);
  });

  test('hides the caption when the user returns to the display currency (AC2)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockUserCurrency(authenticatedPage, 'EUR', true);
    await mockEmptyBudget(authenticatedPage);
    await mockRate(authenticatedPage, {
      kind: 'success',
      rate: 1.0899,
      date: '2026-04-22',
    });

    await openAddBudgetLineDialog(authenticatedPage, budgetDetailsPage);

    await authenticatedPage.getByTestId('new-line-amount').fill('100');
    await selectCurrency(authenticatedPage, 'CHF');
    await expect(authenticatedPage.locator(PREVIEW)).toBeVisible();

    await selectCurrency(authenticatedPage, 'EUR');
    await expect(authenticatedPage.locator(PREVIEW)).toHaveCount(0);
  });

  test('hides the caption when the amount is cleared (AC3)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockUserCurrency(authenticatedPage, 'EUR', true);
    await mockEmptyBudget(authenticatedPage);
    await mockRate(authenticatedPage, {
      kind: 'success',
      rate: 1.0899,
      date: '2026-04-22',
    });

    await openAddBudgetLineDialog(authenticatedPage, budgetDetailsPage);

    await selectCurrency(authenticatedPage, 'CHF');
    await authenticatedPage.getByTestId('new-line-amount').fill('100');
    await expect(authenticatedPage.locator(PREVIEW)).toBeVisible();

    await authenticatedPage.getByTestId('new-line-amount').fill('');
    await expect(authenticatedPage.locator(PREVIEW)).toHaveCount(0);
  });

  test('renders nothing when the currency selector is disabled in user settings (AC4)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockUserCurrency(authenticatedPage, 'EUR', false);
    await mockEmptyBudget(authenticatedPage);

    await openAddBudgetLineDialog(authenticatedPage, budgetDetailsPage);

    await authenticatedPage.getByTestId('new-line-amount').click();
    await authenticatedPage.getByTestId('new-line-amount').fill('100');
    await expect(authenticatedPage.locator(PREVIEW)).toHaveCount(0);
    await expect(currencyPicker(authenticatedPage)).toHaveCount(0);
  });

  test('renders a "rate unavailable" message when the FX fetch fails without a cache (AC5)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await mockUserCurrency(authenticatedPage, 'EUR', true);
    await mockEmptyBudget(authenticatedPage);
    await mockRate(authenticatedPage, { kind: 'error', status: 500 });

    await openAddBudgetLineDialog(authenticatedPage, budgetDetailsPage);

    await authenticatedPage.getByTestId('new-line-amount').fill('100');
    await selectCurrency(authenticatedPage, 'CHF');

    await expect(authenticatedPage.locator(PREVIEW_ERROR)).toBeVisible();
    await expect(authenticatedPage.locator(PREVIEW_ERROR)).toContainText(
      'Taux indisponible',
    );
  });
});
