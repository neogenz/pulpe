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
 * - Rollover from month M appears as a virtual income line in month M+1
 * - Navigation between months shows consistent rollover data
 * - Available amount correctly includes rollover
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

// Mar: Income 5000 + rollover 3800 from Feb, Loyer 1200 => remaining 7600
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
      const response = budgetId
        ? detailsByBudgetId[budgetId]
        : februaryDetails;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }),
  ]);
}

test.describe('Rollover Propagation - Impact on next month', () => {
  test('rollover from Feb appears as virtual income line in March', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Rollover line starts as "checked"; disable the unchecked-only filter to see it
    await authenticatedPage.addInitScript(() => {
      const entry = { version: 1, data: false, updatedAt: new Date().toISOString() };
      localStorage.setItem('pulpe-budget-show-only-unchecked', JSON.stringify(entry));
    });
    await setupRoutes(authenticatedPage);
    await budgetDetailsPage.goto(BUDGET_IDS.MARCH);

    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('mars 2026');

    // Virtual rollover line should appear as an envelope card
    // id = 'rollover-display', name rendered as "Report fevrier 2026"
    const rolloverCard = authenticatedPage.getByTestId(
      'envelope-card-rollover-display',
    );
    await expect(rolloverCard).toBeVisible();
    await expect(rolloverCard).toContainText(/Report/i);
    await expect(rolloverCard).toContainText('CHF');
  });

  test('navigating Feb to Mar to Feb shows consistent data', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Rollover line starts as "checked"; disable the unchecked-only filter to see it
    await authenticatedPage.addInitScript(() => {
      const entry = { version: 1, data: false, updatedAt: new Date().toISOString() };
      localStorage.setItem('pulpe-budget-show-only-unchecked', JSON.stringify(entry));
    });
    await setupRoutes(authenticatedPage);

    // Start on February
    await budgetDetailsPage.goto(BUDGET_IDS.FEBRUARY);
    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('février 2026');

    // Feb should NOT have a rollover line (rollover = 0)
    await expect(
      authenticatedPage.getByTestId('envelope-card-rollover-display'),
    ).not.toBeVisible();

    // Feb budget lines should be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();

    // Navigate to March
    await authenticatedPage
      .getByTestId('next-month-button-desktop')
      .click();
    await expect(heading).toContainText('mars 2026');

    // March SHOULD have a rollover line
    await expect(
      authenticatedPage.getByTestId('envelope-card-rollover-display'),
    ).toBeVisible();

    // March budget lines visible, Feb lines gone
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).not.toBeVisible();

    // Navigate back to February
    await authenticatedPage
      .getByTestId('previous-month-button-desktop')
      .click();
    await expect(heading).toContainText('février 2026');

    // Feb should still have no rollover line
    await expect(
      authenticatedPage.getByTestId('envelope-card-rollover-display'),
    ).not.toBeVisible();
  });

  test('March available amount includes rollover from February', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupRoutes(authenticatedPage);
    await budgetDetailsPage.goto(BUDGET_IDS.MARCH);

    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('mars 2026');

    // Income pill should show 8800 (5000 salary + 3800 rollover)
    // The financial overview computes income from all income-type budget lines
    // including the virtual rollover line
    const financialOverview = authenticatedPage.locator(
      'pulpe-budget-financial-overview',
    );
    await expect(financialOverview).toBeVisible();

    // Remaining = income (5000 + 3800) - expenses (1200) = 7600
    // The hero section shows the remaining amount
    await expect(financialOverview).toContainText("7\u2019600");
  });
});
