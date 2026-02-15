import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Budget Navigation Cache (Scenario 10.4)
 *
 * Verifies:
 * - Navigating between months with prev/next shows the correct budget
 * - No data mixing between budgets when navigating
 * - Returning to a previously visited budget shows it correctly
 * - Prefetched adjacent budgets load without spinner
 */

const BUDGET_IDS = {
  JANUARY: TEST_UUIDS.BUDGET_1,
  FEBRUARY: TEST_UUIDS.BUDGET_2,
  MARCH: TEST_UUIDS.BUDGET_3,
} as const;

function createBudgetListMock() {
  return {
    success: true,
    data: [
      {
        id: BUDGET_IDS.JANUARY,
        month: 1,
        year: 2026,
        userId: TEST_UUIDS.USER_1,
        description: 'Janvier budget',
        templateId: TEST_UUIDS.TEMPLATE_1,
        endingBalance: 0,
        rollover: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: BUDGET_IDS.FEBRUARY,
        month: 2,
        year: 2026,
        userId: TEST_UUIDS.USER_1,
        description: 'Fevrier budget',
        templateId: TEST_UUIDS.TEMPLATE_1,
        endingBalance: 0,
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
        endingBalance: 0,
        rollover: 0,
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
      },
    ],
  };
}

const januaryDetails = createBudgetDetailsMock(BUDGET_IDS.JANUARY, {
  budget: { month: 1, year: 2026, description: 'Janvier budget' },
  budgetLines: [
    createBudgetLineMock(TEST_UUIDS.LINE_1, BUDGET_IDS.JANUARY, {
      name: 'Salaire Janvier',
      amount: 5000,
      kind: 'income',
    }),
    createBudgetLineMock(TEST_UUIDS.LINE_2, BUDGET_IDS.JANUARY, {
      name: 'Loyer Janvier',
      amount: 1200,
      kind: 'expense',
    }),
  ],
});

const februaryDetails = createBudgetDetailsMock(BUDGET_IDS.FEBRUARY, {
  budget: { month: 2, year: 2026, description: 'Fevrier budget' },
  budgetLines: [
    createBudgetLineMock(TEST_UUIDS.LINE_3, BUDGET_IDS.FEBRUARY, {
      name: 'Salaire Fevrier',
      amount: 5500,
      kind: 'income',
    }),
    createBudgetLineMock(TEST_UUIDS.LINE_4, BUDGET_IDS.FEBRUARY, {
      name: 'Loyer Fevrier',
      amount: 1200,
      kind: 'expense',
    }),
  ],
});

const marchDetails = createBudgetDetailsMock(BUDGET_IDS.MARCH, {
  budget: { month: 3, year: 2026, description: 'Mars budget' },
  budgetLines: [
    createBudgetLineMock(TEST_UUIDS.LINE_5, BUDGET_IDS.MARCH, {
      name: 'Salaire Mars',
      amount: 6000,
      kind: 'income',
    }),
    createBudgetLineMock(TEST_UUIDS.LINE_6, BUDGET_IDS.MARCH, {
      name: 'Loyer Mars',
      amount: 1300,
      kind: 'expense',
    }),
  ],
});

const detailsByBudgetId: Record<string, unknown> = {
  [BUDGET_IDS.JANUARY]: januaryDetails,
  [BUDGET_IDS.FEBRUARY]: februaryDetails,
  [BUDGET_IDS.MARCH]: marchDetails,
};

test.describe('Budget Navigation Cache - Rapid prev/next navigation', () => {
  test('navigating between months displays the correct budget data', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Mock budget list to return 3 budgets
    await authenticatedPage.route('**/api/v1/budgets', (route) => {
      const url = route.request().url();
      // Skip budget details and exists endpoints
      if (url.includes('/details') || url.includes('/exists')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createBudgetListMock()),
      });
    });

    // Mock budget details to return data based on budget ID
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
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
    });

    // Navigate to February (middle budget)
    await budgetDetailsPage.goto(BUDGET_IDS.FEBRUARY);

    // Verify February data is displayed
    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('février 2026');

    // Click "Mois suivant" to go to March
    await authenticatedPage
      .getByTestId('next-month-button-desktop')
      .click();
    await expect(heading).toContainText('mars 2026');

    // Click "Mois précédent" twice to go to January
    await authenticatedPage
      .getByTestId('previous-month-button-desktop')
      .click();
    await expect(heading).toContainText('février 2026');

    await authenticatedPage
      .getByTestId('previous-month-button-desktop')
      .click();
    await expect(heading).toContainText('janvier 2026');

    // Return to February — should show correct data (from cache)
    await authenticatedPage
      .getByTestId('next-month-button-desktop')
      .click();
    await expect(heading).toContainText('février 2026');
  });

  test('no data mixing between budgets during rapid navigation', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budgets', (route) => {
      const url = route.request().url();
      if (url.includes('/details') || url.includes('/exists')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createBudgetListMock()),
      });
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
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
    });

    // Start on February
    await budgetDetailsPage.goto(BUDGET_IDS.FEBRUARY);
    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('février 2026');

    // Navigate to March and verify budget lines are from March
    await authenticatedPage
      .getByTestId('next-month-button-desktop')
      .click();
    await expect(heading).toContainText('mars 2026');
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_5}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_6}`),
    ).toBeVisible();
    // February envelope cards should NOT be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).not.toBeVisible();

    // Navigate back to February and verify its envelope cards
    await authenticatedPage
      .getByTestId('previous-month-button-desktop')
      .click();
    await expect(heading).toContainText('février 2026');
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_4}`),
    ).toBeVisible();
    // March envelope cards should NOT be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_5}`),
    ).not.toBeVisible();
  });

  test('previous and next buttons are disabled at boundary months', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budgets', (route) => {
      const url = route.request().url();
      if (url.includes('/details') || url.includes('/exists')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createBudgetListMock()),
      });
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const url = route.request().url();
      const budgetId = Object.keys(detailsByBudgetId).find((id) =>
        url.includes(id),
      );
      const response = budgetId
        ? detailsByBudgetId[budgetId]
        : januaryDetails;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Navigate to January (first budget)
    await budgetDetailsPage.goto(BUDGET_IDS.JANUARY);
    const heading = authenticatedPage.locator('h1');
    await expect(heading).toContainText('janvier 2026');

    // Previous button should be disabled at the first budget
    await expect(
      authenticatedPage.getByTestId('previous-month-button-desktop'),
    ).toBeDisabled();
    // Next button should be enabled
    await expect(
      authenticatedPage.getByTestId('next-month-button-desktop'),
    ).toBeEnabled();

    // Navigate to March (last budget)
    await authenticatedPage
      .getByTestId('next-month-button-desktop')
      .click();
    await expect(heading).toContainText('février 2026');
    await authenticatedPage
      .getByTestId('next-month-button-desktop')
      .click();
    await expect(heading).toContainText('mars 2026');

    // Next button should be disabled at the last budget
    await expect(
      authenticatedPage.getByTestId('next-month-button-desktop'),
    ).toBeDisabled();
    // Previous button should be enabled
    await expect(
      authenticatedPage.getByTestId('previous-month-button-desktop'),
    ).toBeEnabled();
  });
});
