import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Rollover Propagation (Scenario 7.3)
 *
 * Verifies:
 * - Rollover from month M surfaces in month M+1 via the dedicated read-only widget
 *   (`pulpe-budget-rollover-info`), not as a budget line.
 * - Cross-month navigation toggles widget visibility based on rollover state.
 * - Financial overview Reste reflects rollover from the previous month.
 */

const BUDGET_IDS = {
  FEBRUARY: TEST_UUIDS.BUDGET_1,
  MARCH: TEST_UUIDS.BUDGET_2,
} as const;

function createBudgetListMock() {
  return {
    success: true,
    data: [
      {
        id: BUDGET_IDS.FEBRUARY,
        month: 2,
        year: 2026,
        userId: TEST_UUIDS.USER_1,
        description: 'Fevrier budget',
        templateId: TEST_UUIDS.TEMPLATE_1,
        endingBalance: 3800,
        rollover: 0,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      },
      {
        id: BUDGET_IDS.MARCH,
        month: 3,
        year: 2026,
        userId: TEST_UUIDS.USER_1,
        description: 'Mars budget',
        templateId: TEST_UUIDS.TEMPLATE_1,
        endingBalance: 7600,
        rollover: 3800,
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
      },
    ],
  };
}

// Feb: Income 5000, Loyer 1200 => endingBalance 3800, rollover 0
const februaryDetails = createBudgetDetailsMock(BUDGET_IDS.FEBRUARY, {
  budget: {
    month: 2,
    year: 2026,
    description: 'Fevrier budget',
    endingBalance: 3800,
    rollover: 0,
  },
  budgetLines: [
    createBudgetLineMock(TEST_UUIDS.LINE_1, BUDGET_IDS.FEBRUARY, {
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
    }),
    createBudgetLineMock(TEST_UUIDS.LINE_2, BUDGET_IDS.FEBRUARY, {
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
    }),
  ],
});

// Mar: Income 5000 + rollover 3800 from Feb, Loyer 1200 => Reste 7600
const marchDetails = createBudgetDetailsMock(BUDGET_IDS.MARCH, {
  budget: {
    month: 3,
    year: 2026,
    description: 'Mars budget',
    endingBalance: 7600,
    rollover: 3800,
    previousBudgetId: BUDGET_IDS.FEBRUARY,
  },
  budgetLines: [
    createBudgetLineMock(TEST_UUIDS.LINE_3, BUDGET_IDS.MARCH, {
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
    }),
    createBudgetLineMock(TEST_UUIDS.LINE_4, BUDGET_IDS.MARCH, {
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
    }),
  ],
});

const detailsByBudgetId: Record<string, unknown> = {
  [BUDGET_IDS.FEBRUARY]: februaryDetails,
  [BUDGET_IDS.MARCH]: marchDetails,
};

function setupRoutes(authenticatedPage: import('@playwright/test').Page) {
  return Promise.all([
    authenticatedPage.route('**/api/v1/budgets', (route) => {
      const url = route.request().url();
      if (url.includes('/details') || url.includes('/exists')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createBudgetListMock()),
      });
    }),
    authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const url = route.request().url();
      const budgetId = Object.keys(detailsByBudgetId).find((id) =>
        url.includes(id),
      );
      const response = budgetId ? detailsByBudgetId[budgetId] : februaryDetails;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }),
  ]);
}

test.describe('Rollover Propagation - Impact on next month', () => {
  test('rollover from Feb surfaces in March via dedicated widget', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupRoutes(authenticatedPage);
    await budgetDetailsPage.goto(BUDGET_IDS.MARCH);

    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('mars 2026');

    const rolloverWidget = authenticatedPage.locator(
      'pulpe-budget-rollover-info',
    );
    await expect(rolloverWidget).toBeVisible();
    await expect(rolloverWidget).toContainText(/Report/i);
    await expect(rolloverWidget).toContainText('+3’800');
    await expect(rolloverWidget).toContainText('CHF');
  });

  test('widget visibility toggles correctly across month navigation', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupRoutes(authenticatedPage);

    await budgetDetailsPage.goto(BUDGET_IDS.FEBRUARY);
    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('février 2026');

    const rolloverWidget = authenticatedPage.locator(
      'pulpe-budget-rollover-info',
    );
    await expect(rolloverWidget).not.toBeVisible();

    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();

    await authenticatedPage.getByTestId('next-month-button-desktop').click();
    await expect(heading).toContainText('mars 2026');

    await expect(rolloverWidget).toBeVisible();
    await expect(rolloverWidget).toContainText('+3’800');

    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).not.toBeVisible();

    await authenticatedPage
      .getByTestId('previous-month-button-desktop')
      .click();
    await expect(heading).toContainText('février 2026');

    await expect(rolloverWidget).not.toBeVisible();
  });

  test('March Reste in financial overview includes rollover from February', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupRoutes(authenticatedPage);
    await budgetDetailsPage.goto(BUDGET_IDS.MARCH);

    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('mars 2026');

    const financialOverview = authenticatedPage.locator(
      'pulpe-budget-financial-overview',
    );
    await expect(financialOverview).toBeVisible();

    // Reste = income (5000) - expenses (1200) + rollover (3800) = 7600
    await expect(financialOverview).toContainText('7’600');
  });
});
