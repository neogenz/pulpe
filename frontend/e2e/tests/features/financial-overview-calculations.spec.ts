import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createBudgetLineResponseMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Financial Overview Calculations', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  const salaireLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
    name: 'Salaire',
    amount: 3500,
    kind: 'income',
    recurrence: 'fixed',
  });

  const freelanceLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
    name: 'Freelance',
    amount: 800,
    kind: 'income',
    recurrence: 'one_off',
  });

  const loyerLine = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
    name: 'Loyer',
    amount: 1200,
    kind: 'expense',
    recurrence: 'fixed',
  });

  const coursesLine = createBudgetLineMock(TEST_UUIDS.LINE_4, budgetId, {
    name: 'Courses',
    amount: 400,
    kind: 'expense',
    recurrence: 'one_off',
  });

  const transportLine = createBudgetLineMock(TEST_UUIDS.LINE_5, budgetId, {
    name: 'Transport',
    amount: 75,
    kind: 'expense',
    recurrence: 'fixed',
  });

  const epargneLine = createBudgetLineMock(TEST_UUIDS.LINE_6, budgetId, {
    name: 'Épargne',
    amount: 500,
    kind: 'saving',
    recurrence: 'fixed',
  });

  const allLines = [salaireLine, freelanceLine, loyerLine, coursesLine, transportLine, epargneLine];

  // Revenus = 3500 + 800 = 4300
  // With rollover 500: Disponible (income) = 4300 + 500 = 4800
  // Dépenses = 1200 + 400 + 75 = 1675
  // Épargne = 500
  // Reste = 4800 - 1675 - 500 = 2625

  function createMockWithRollover() {
    return createBudgetDetailsMock(budgetId, {
      budget: {
        rollover: 500,
        previousBudgetId: TEST_UUIDS.BUDGET_2,
        month: 2,
        year: 2026,
      },
      budgetLines: allLines,
    });
  }

  test('Disponible shows sum of revenus plus rollover', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createMockWithRollover()),
      });
    });

    await budgetDetailsPage.goto(budgetId);

    const financialOverview = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(financialOverview).toBeVisible();

    // Revenus pill should show 4800 (3500 + 800 + 500 rollover)
    // Note: de-CH locale uses RIGHT SINGLE QUOTATION MARK (U+2019) as thousands separator
    await expect(financialOverview).toContainText("4\u2019800 CHF");
  });

  test('Reste equals Disponible minus Depenses minus Epargne', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createMockWithRollover()),
      });
    });

    await budgetDetailsPage.goto(budgetId);

    const financialOverview = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(financialOverview).toBeVisible();

    // Dépenses pill: 1675
    await expect(financialOverview).toContainText("1\u2019675 CHF");

    // Épargne pill: 500
    await expect(financialOverview).toContainText('500 CHF');

    // Reste = 4800 - 1675 - 500 = 2625
    await expect(
      financialOverview.locator('.text-display-medium, .text-display-large'),
    ).toContainText("2\u2019625");
  });

  test('budget with rollover shows increased Disponible compared to without', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Budget WITHOUT rollover: Revenus = 4300
    const noRolloverMock = createBudgetDetailsMock(budgetId, {
      budget: { rollover: 0 },
      budgetLines: allLines,
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(noRolloverMock),
      });
    });

    await budgetDetailsPage.goto(budgetId);

    const financialOverview = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(financialOverview).toBeVisible();

    // Without rollover: Revenus = 4300, Reste = 4300 - 1675 - 500 = 2125
    await expect(financialOverview).toContainText("4\u2019300 CHF");
    await expect(
      financialOverview.locator('.text-display-medium, .text-display-large'),
    ).toContainText("2\u2019125");
  });

  test('adding an expense decreases Reste by exactly the expense amount', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    let hasCreated = false;

    const newExpenseLine = createBudgetLineMock(TEST_UUIDS.LINE_7, budgetId, {
      name: 'Abonnement',
      amount: 200,
      kind: 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: true,
    });

    const initialMock = createMockWithRollover();

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = hasCreated
        ? createBudgetDetailsMock(budgetId, {
            budget: {
              rollover: 500,
              previousBudgetId: TEST_UUIDS.BUDGET_2,
              month: 2,
              year: 2026,
            },
            budgetLines: [...allLines, newExpenseLine],
          })
        : initialMock;

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await authenticatedPage.route('**/api/v1/budget-lines', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createBudgetLineResponseMock(newExpenseLine)),
        });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    const financialOverview = authenticatedPage.locator('pulpe-budget-financial-overview');

    // Before: Reste = 2625
    await expect(
      financialOverview.locator('.text-display-medium, .text-display-large'),
    ).toContainText("2\u2019625");

    // Add expense
    await authenticatedPage.getByTestId('add-budget-line').click();
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    await authenticatedPage.locator('[data-testid="new-line-name"]').fill('Abonnement');
    await authenticatedPage.locator('[data-testid="new-line-amount"]').fill('200');
    await authenticatedPage.getByTestId('add-new-line').click();
    await expect(dialog).not.toBeVisible();

    // After: Reste = 2625 - 200 = 2425
    await expect(
      financialOverview.locator('.text-display-medium, .text-display-large'),
    ).toContainText("2\u2019425");
  });
});
