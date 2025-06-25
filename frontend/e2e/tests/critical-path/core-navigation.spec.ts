import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Core Application Navigation (Authenticated)', () => {
  test('should allow authenticated users to access main dashboard', async ({
    page,
    currentMonthPage,
  }) => {
    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();
    await currentMonthPage.expectFinancialOverviewVisible();
  });

  test('should allow authenticated users to access budget templates management', async ({
    page,
    budgetTemplatesPage,
  }) => {
    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectPageLoaded();
    await budgetTemplatesPage.expectTemplatesListVisible();
  });
});
