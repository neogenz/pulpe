import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Current Month Transactions
 *
 * Tests the transaction lifecycle on the dashboard:
 * - Adding a transaction via FAB
 * - Totals recalculation after adding a free transaction
 *
 * Note: Edit/delete functionality lives in budget-details, not the dashboard.
 */
test.describe('Current Month Transactions', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  // Use current month for dates so edit form's date validator accepts them
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();
  const currentMonthDate = new Date(
    currentYear,
    now.getMonth(),
    15,
  ).toISOString();

  const salaireLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
    name: 'Salaire',
    amount: 5000,
    kind: 'income',
  });

  const coursesLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
    name: 'Courses',
    amount: 500,
    kind: 'expense',
  });

  test('should adapt the quick transaction surface to the viewport', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = createBudgetDetailsMock(budgetId, {
        budget: { rollover: 0, month: currentMonth, year: currentYear },
        budgetLines: [salaireLine, coursesLine],
        transactions: [],
      });

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
    await currentMonthPage.goto();

    for (const viewport of [
      { width: 600, height: 900, expectedSurface: 'dialog' },
      { width: 768, height: 1024, expectedSurface: 'dialog' },
      { width: 1440, height: 900, expectedSurface: 'dialog' },
      { width: 390, height: 844, expectedSurface: 'bottom-sheet' },
    ] as const) {
      await authenticatedPage.setViewportSize(viewport);
      await authenticatedPage.getByTestId('add-transaction-fab').click();

      const surface = authenticatedPage.locator(
        viewport.expectedSurface === 'dialog'
          ? 'pulpe-add-transaction-dialog'
          : 'pulpe-add-transaction-bottom-sheet',
      );
      await expect(surface).toBeVisible();

      if (viewport.expectedSurface === 'dialog') {
        await expect(surface.locator('h2[mat-dialog-title]')).toBeVisible();
        const closeButton = surface.locator('button[maticonbutton]').first();
        const dialogSurface = authenticatedPage.locator(
          '.mat-mdc-dialog-surface',
        );
        await expect(closeButton).toHaveCSS('position', 'absolute');

        const [surfaceBox, closeButtonBox] = await Promise.all([
          dialogSurface.boundingBox(),
          closeButton.boundingBox(),
        ]);
        if (!surfaceBox || !closeButtonBox) {
          throw new Error('Dialog surface geometry is unavailable');
        }
        expect(closeButtonBox.x + closeButtonBox.width / 2).toBeGreaterThan(
          surfaceBox.x + surfaceBox.width / 2,
        );
      }

      const quickAmount = surface.locator('button[matbutton="tonal"]').first();
      await expect(quickAmount).toHaveCSS('white-space', 'nowrap');

      const formColumns = await surface
        .locator('.add-transaction-form-grid')
        .evaluate((element) =>
          getComputedStyle(element).gridTemplateColumns.split(' '),
        );
      expect(formColumns).toHaveLength(
        viewport.expectedSurface === 'dialog' ? 2 : 1,
      );

      const submit = surface.getByTestId('transaction-submit-button');
      await expect(submit).toBeInViewport();

      await surface.getByTestId('transaction-cancel-button').click();
      await expect(surface).toBeHidden();
    }
  });

  test('should add a transaction via FAB and display it in recent transactions', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    let hasCreated = false;

    const newTransaction = createTransactionMock(
      TEST_UUIDS.TRANSACTION_1,
      budgetId,
      {
        name: 'Cafe',
        amount: 15,
        kind: 'expense',
        budgetLineId: null,
        transactionDate: currentMonthDate,
      },
    );

    // Mock budget details — initial state with no transactions
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = createBudgetDetailsMock(budgetId, {
        budget: { rollover: 0, month: currentMonth, year: currentYear },
        budgetLines: [salaireLine, coursesLine],
        transactions: hasCreated ? [newTransaction] : [],
      });

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Mock POST /transactions
    await authenticatedPage.route('**/api/v1/transactions', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: newTransaction }),
        });
      } else {
        void route.fallback();
      }
    });

    // Mock GET /budgets/:id (called after optimistic update)
    await authenticatedPage.route('**/api/v1/budgets/' + budgetId, (route) => {
      if (route.request().url().includes('/details')) {
        void route.fallback();
        return;
      }
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: budgetId,
            month: currentMonth,
            year: currentYear,
            userId: TEST_UUIDS.USER_1,
            rollover: 0,
          },
        }),
      });
    });

    await currentMonthPage.goto();

    // Open the adaptive transaction surface via FAB
    await authenticatedPage.getByTestId('add-transaction-fab').click();

    // Fill the transaction form
    const form = authenticatedPage.getByTestId('transaction-form');
    await expect(form).toBeVisible();

    // Wait for the surface opening animation and initial focus to settle
    const amountInput = authenticatedPage.locator(
      '[data-testid="transaction-form"] [data-testid="amount-input-value"]',
    );
    await expect(amountInput).toBeFocused();

    await amountInput.fill('15');
    await authenticatedPage
      .getByTestId('transaction-description-input')
      .clear();
    await authenticatedPage
      .getByTestId('transaction-description-input')
      .fill('Cafe');

    // Submit
    await authenticatedPage.getByTestId('transaction-submit-button').click();

    // The transaction surface should close
    await expect(form).toBeHidden();

    // Transaction should appear in the recent transactions block
    const recentTransactions = authenticatedPage.getByTestId(
      'dashboard-block-recent-transactions',
    );
    await expect(recentTransactions).toContainText('Cafe');
  });

  test('totals should recalculate after adding a free transaction', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    // Setup: Income 5000, expense envelope 500, existing free transaction 100
    // Initial expenses = max(500, 0) + 100 = 600
    // Initial remaining = 5000 - 600 = 4400
    const existingTransaction = createTransactionMock(
      TEST_UUIDS.TRANSACTION_1,
      budgetId,
      {
        name: 'Existing expense',
        amount: 100,
        kind: 'expense',
        budgetLineId: null,
        transactionDate: currentMonthDate,
      },
    );

    const newTransaction = createTransactionMock(
      TEST_UUIDS.TRANSACTION_2,
      budgetId,
      {
        name: 'New expense',
        amount: 200,
        kind: 'expense',
        budgetLineId: null,
        transactionDate: currentMonthDate,
      },
    );

    let hasCreated = false;

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = createBudgetDetailsMock(budgetId, {
        budget: { rollover: 0, month: currentMonth, year: currentYear },
        budgetLines: [salaireLine, coursesLine],
        transactions: hasCreated
          ? [existingTransaction, newTransaction]
          : [existingTransaction],
      });

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await authenticatedPage.route('**/api/v1/transactions', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: newTransaction }),
        });
      } else {
        void route.fallback();
      }
    });

    // Mock GET /budgets/:id
    await authenticatedPage.route('**/api/v1/budgets/' + budgetId, (route) => {
      if (route.request().url().includes('/details')) {
        void route.fallback();
        return;
      }
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: budgetId,
            month: currentMonth,
            year: currentYear,
            userId: TEST_UUIDS.USER_1,
            rollover: 0,
          },
        }),
      });
    });

    await currentMonthPage.goto();

    // Initial state: expenses = 500 (envelope) + 100 (free) = 600
    await currentMonthPage.expectExpensesAmount('600');
    // Initial remaining = 5000 - 600 = 4400
    await currentMonthPage.expectRemainingAmount('4 400');

    // Add a new free transaction of 200
    await currentMonthPage.addTransaction('200', 'New expense');

    // After adding: expenses = 500 (envelope) + 100 + 200 (free) = 800
    await currentMonthPage.expectExpensesAmount('800');
    // Remaining = 5000 - 800 = 4200
    await currentMonthPage.expectRemainingAmount('4 200');
  });
});
