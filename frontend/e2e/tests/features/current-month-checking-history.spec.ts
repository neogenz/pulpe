import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

for (const learned of [false, true]) {
  test(`should ${learned ? 'learn' : 'keep the fallback'} for home checking suggestions`, async ({
    authenticatedPage: page,
    currentMonthPage,
  }) => {
    const now = new Date();
    await page.clock.setFixedTime(
      new Date(now.getFullYear(), now.getMonth(), 10, 12),
    );
    const id = TEST_UUIDS.BUDGET_1;
    const rent = createBudgetLineMock(TEST_UUIDS.LINE_1, id, {
      name: 'Loyer',
      amount: 10,
      recurrence: 'fixed',
    });
    const unknown = createBudgetLineMock(TEST_UUIDS.LINE_2, id, {
      name: 'Courses',
      amount: 1000,
    });
    const salary = createBudgetLineMock(TEST_UUIDS.LINE_3, id, {
      name: 'Salaire',
      kind: 'income',
      amount: 5000,
      recurrence: 'fixed',
    });
    let checked = false;
    await page.route('**/api/v1/budgets/*/details', (route) => {
      const response = createBudgetDetailsMock(id, {
        budget: { month: now.getMonth() + 1, year: now.getFullYear() },
        budgetLines: [
          { ...rent, checkedAt: checked ? now.toISOString() : null },
          unknown,
          salary,
        ],
        transactions: [],
      });
      return route.fulfill({
        json: {
          ...response,
          data: {
            ...response.data,
            checkingDays: learned
              ? { [rent.id]: 1, [salary.id]: 25 }
              : undefined,
          },
        },
      });
    });
    await page.route(
      `**/api/v1/budget-lines/${rent.id}/toggle-check`,
      (route) => {
        checked = true;
        return route.fulfill({
          json: {
            success: true,
            data: { ...rent, checkedAt: now.toISOString() },
          },
        });
      },
    );
    await currentMonthPage.goto();
    const names = page.getByTestId('dashboard-forecasts-name');
    await expect(names).toHaveText(
      learned
        ? ['Loyer', 'Courses', 'Salaire']
        : ['Courses', 'Loyer', 'Salaire'],
    );
    await page
      .getByTestId('dashboard-forecasts-row')
      .filter({ hasText: 'Loyer' })
      .getByTestId('dashboard-forecasts-toggle')
      .click();
    await expect(names).toHaveText(['Courses', 'Salaire']);
  });
}
