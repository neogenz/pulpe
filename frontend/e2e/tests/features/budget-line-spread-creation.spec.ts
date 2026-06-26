import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import { createBudgetLineMock, TEST_UUIDS } from '../../helpers/api-mocks';
import type { BudgetDetailsResponse } from 'pulpe-shared';

/**
 * Dual-mode additive spread create (PUL-17): the user picks `total` (default —
 * the server divides cents-preservingly) or `perMonth` (the server replicates).
 * These tests drive the webapp through the add-line dialog and assert the
 * toggle, the live per-month breakdown, and the wire payload.
 */
const budgetId = TEST_UUIDS.BUDGET_1;

const salaire = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
  name: 'Salaire',
  amount: 5000,
  kind: 'income',
  recurrence: 'fixed',
});

function detailsMock(): BudgetDetailsResponse {
  return {
    success: true,
    data: {
      budget: {
        id: budgetId,
        month: 6,
        year: 2026,
        userId: TEST_UUIDS.USER_1,
        description: 'E2E spread budget',
        templateId: TEST_UUIDS.TEMPLATE_1,
        rollover: 0,
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
      },
      transactions: [],
      budgetLines: [salaire],
    },
  };
}

const amountInput =
  '[data-testid="add-budget-line-dialog"] [data-testid="amount-input-value"]';

async function openSpreadDialog(
  page: Page,
  budgetDetailsPage: { goto: (id: string) => Promise<void> },
): Promise<void> {
  await page.route('**/api/v1/budgets/*/details', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detailsMock()),
    }),
  );

  await budgetDetailsPage.goto(budgetId);
  await page.getByTestId('budget-items-add-line-button').click();

  await expect(page.locator('mat-dialog-container')).toBeVisible();
  await page.locator('[data-testid="new-line-name"]').fill('Prime assurance');

  // Switch the entry mode from "Ponctuelle" to "Lissée" (spread).
  await page
    .locator('[data-testid="spread-mode-toggle"]')
    .getByText('Lissée')
    .click();
}

test.describe('Budget Line Spread Creation (dual mode)', () => {
  test('defaults to total mode and renders a cents-preserving per-month breakdown', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await openSpreadDialog(authenticatedPage, budgetDetailsPage);

    // The amount-mode toggle is visible and "Total" is selected by default.
    const amountModeToggle = authenticatedPage.locator(
      '[data-testid="spread-amount-mode-toggle"]',
    );
    await expect(amountModeToggle).toBeVisible();
    await expect(
      amountModeToggle.locator('.mat-button-toggle-checked'),
    ).toHaveText(/Total/);

    await authenticatedPage.locator(amountInput).fill('4000');
    await authenticatedPage.locator(amountInput).blur();

    // Default window is 6 months → 6 breakdown rows (server divides the total).
    const breakdown = authenticatedPage.locator(
      '[data-testid="spread-breakdown"]',
    );
    await expect(breakdown).toBeVisible();
    await expect(
      breakdown.locator('[data-testid^="spread-breakdown-"]'),
    ).toHaveCount(6);

    // Aggregated echo shows the typed total (no decimals).
    await expect(
      authenticatedPage.locator('[data-testid="spread-total-echo"]'),
    ).toContainText(/4[\s’']?000/);
  });

  test('switching to per-month mode replaces the breakdown with a single total echo', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await openSpreadDialog(authenticatedPage, budgetDetailsPage);

    await authenticatedPage.locator(amountInput).fill('500');
    await authenticatedPage.locator(amountInput).blur();

    await expect(
      authenticatedPage.locator('[data-testid="spread-breakdown"]'),
    ).toBeVisible();

    await authenticatedPage
      .locator('[data-testid="spread-amount-mode-toggle"]')
      .getByText('Par mois')
      .click();

    // breakdown gone; a single total echo remains (500 × 6 = 3000)
    await expect(
      authenticatedPage.locator('[data-testid="spread-breakdown"]'),
    ).toHaveCount(0);
    await expect(
      authenticatedPage.locator('[data-testid="spread-total-echo"]'),
    ).toBeVisible();
  });

  test('submits a total-mode intent to /budget-lines/spread', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await openSpreadDialog(authenticatedPage, budgetDetailsPage);

    await authenticatedPage.locator(amountInput).fill('4000');
    await authenticatedPage.locator(amountInput).blur();

    const spreadResponse = {
      success: true,
      data: {
        spreadGroupId: '00000000-0000-4000-a000-000000003001',
        lines: [
          createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
            name: 'Prime assurance',
            amount: 666.67,
            kind: 'expense',
            recurrence: 'one_off',
          }),
        ],
        createdBudgets: [],
        skippedMonths: [],
      },
    };

    await authenticatedPage.route('**/api/v1/budget-lines/spread', (route) => {
      if (route.request().method() === 'POST') {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(spreadResponse),
        });
      } else {
        void route.fallback();
      }
    });

    const submitButton = authenticatedPage.getByTestId('add-new-line');
    await expect(submitButton).toBeEnabled();

    const postRequestPromise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes('/api/v1/budget-lines/spread') &&
        req.method() === 'POST',
    );

    await submitButton.click();

    const payload = (await postRequestPromise).postDataJSON();

    expect(payload).toMatchObject({
      name: 'Prime assurance',
      kind: 'expense',
      mode: 'total',
      totalAmount: 4000,
    });
    expect(Array.isArray(payload.months)).toBe(true);
    expect(payload.months.length).toBe(6);
    expect(payload).not.toHaveProperty('perMonthAmount');
  });

  test('a recurrent line shows a disabled "Lisser" with an explanation; a one-off line offers it', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const recurrent = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Loisirs',
      amount: 100,
      kind: 'expense',
      recurrence: 'fixed',
    });
    const oneOff = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
      name: 'Caution',
      amount: 4000,
      kind: 'expense',
      recurrence: 'one_off',
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ...detailsMock().data, budgetLines: [recurrent, oneOff] },
        }),
      }),
    );

    await budgetDetailsPage.goto(budgetId);

    // Recurrent line → "Lisser" present but disabled (not silently absent).
    await authenticatedPage
      .getByTestId(`card-menu-${TEST_UUIDS.LINE_2}`)
      .click();
    const disabled = authenticatedPage.getByTestId(
      `spread-disabled-${TEST_UUIDS.LINE_2}`,
    );
    await expect(disabled).toBeVisible();
    await expect(disabled).toBeDisabled();
    await expect(
      authenticatedPage.getByTestId(`spread-${TEST_UUIDS.LINE_2}`),
    ).toHaveCount(0);
    await authenticatedPage.keyboard.press('Escape');

    // One-off line → "Lisser" enabled, no disabled variant.
    await authenticatedPage
      .getByTestId(`card-menu-${TEST_UUIDS.LINE_3}`)
      .click();
    await expect(
      authenticatedPage.getByTestId(`spread-${TEST_UUIDS.LINE_3}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`spread-disabled-${TEST_UUIDS.LINE_3}`),
    ).toHaveCount(0);
  });
});
