import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Current Month Transactions (Scenarios 6.2-6.4)
 *
 * Tests the transaction lifecycle on the current month dashboard:
 * - Adding a transaction via FAB
 * - Editing a transaction
 * - Deleting a transaction
 * - Totals recalculation after adding a free transaction
 */
test.describe('Current Month Transactions', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  // Use current month for dates so edit form's date validator accepts them
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();
  const currentMonthDate = new Date(currentYear, now.getMonth(), 15).toISOString();

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

  test('should add a transaction via FAB and display it in the list', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    let hasCreated = false;

    const newTransaction = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Cafe',
      amount: 15,
      kind: 'expense',
      budgetLineId: null,
      transactionDate: currentMonthDate,
    });

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
          data: { id: budgetId, month: currentMonth, year: currentYear, userId: TEST_UUIDS.USER_1, rollover: 0 },
        }),
      });
    });

    await currentMonthPage.goto();

    // Open bottom sheet via FAB
    await authenticatedPage.getByTestId('add-transaction-fab').click();

    // Fill the transaction form
    const form = authenticatedPage.getByTestId('transaction-form');
    await expect(form).toBeVisible();

    await authenticatedPage.getByTestId('transaction-amount-input').fill('15');
    await authenticatedPage.getByTestId('transaction-description-input').clear();
    await authenticatedPage.getByTestId('transaction-description-input').fill('Cafe');

    // Submit
    await authenticatedPage.getByTestId('transaction-submit-button').click();

    // Bottom sheet should close
    await expect(form).toBeHidden();

    // Transaction should appear in the one-time expenses list
    const oneTimeList = authenticatedPage.getByTestId('one-time-expenses-list');
    await expect(oneTimeList).toContainText('Cafe');
  });

  test('should edit a transaction amount from current month view', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const existingTransaction = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Courses Migros',
      amount: 100,
      kind: 'expense',
      budgetLineId: null,
      transactionDate: currentMonthDate,
    });

    const updatedTransaction = {
      ...existingTransaction,
      name: 'Courses Migros modifie',
      amount: 150,
    };

    let hasUpdated = false;

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = createBudgetDetailsMock(budgetId, {
        budget: { rollover: 0, month: currentMonth, year: currentYear },
        budgetLines: [salaireLine, coursesLine],
        transactions: [hasUpdated ? updatedTransaction : existingTransaction],
      });

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Mock PATCH /transactions/:id
    await authenticatedPage.route(
      `**/api/v1/transactions/${TEST_UUIDS.TRANSACTION_1}`,
      (route) => {
        if (route.request().method() === 'PATCH') {
          hasUpdated = true;
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: updatedTransaction }),
          });
        } else {
          void route.fallback();
        }
      },
    );

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
          data: { id: budgetId, month: currentMonth, year: currentYear, userId: TEST_UUIDS.USER_1, rollover: 0 },
        }),
      });
    });

    await currentMonthPage.goto();

    // Click edit on the transaction (desktop view uses direct edit button)
    await authenticatedPage
      .getByTestId(`edit-transaction-${TEST_UUIDS.TRANSACTION_1}`)
      .first()
      .click();

    // Edit dialog should appear
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Change name and amount
    const nameInput = dialog.locator('input[formControlName="name"]');
    await nameInput.clear();
    await nameInput.fill('Courses Migros modifie');

    const amountInput = dialog.locator('input[formControlName="amount"]');
    await amountInput.clear();
    await amountInput.fill('150');

    // Click save ("Enregistrer")
    await dialog.locator('button:has-text("Enregistrer")').click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // Updated name should appear
    const oneTimeList = authenticatedPage.getByTestId('one-time-expenses-list');
    await expect(oneTimeList).toContainText('Courses Migros modifie');
  });

  test('should delete a transaction from current month view', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const existingTransaction = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Achat impulsif',
      amount: 50,
      kind: 'expense',
      budgetLineId: null,
      transactionDate: currentMonthDate,
    });

    let hasDeleted = false;

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createBudgetDetailsMock(budgetId, {
            budget: { rollover: 0, month: currentMonth, year: currentYear },
            budgetLines: [salaireLine, coursesLine],
            transactions: hasDeleted ? [] : [existingTransaction],
          }),
        ),
      });
    });

    // Mock DELETE /transactions/:id
    await authenticatedPage.route(
      `**/api/v1/transactions/${TEST_UUIDS.TRANSACTION_1}`,
      (route) => {
        if (route.request().method() === 'DELETE') {
          hasDeleted = true;
          void route.fulfill({ status: 204, body: '' });
        } else {
          void route.fallback();
        }
      },
    );

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
          data: { id: budgetId, month: currentMonth, year: currentYear, userId: TEST_UUIDS.USER_1, rollover: 0 },
        }),
      });
    });

    await currentMonthPage.goto();

    // Verify transaction is displayed initially
    const oneTimeList = authenticatedPage.getByTestId('one-time-expenses-list');
    await expect(oneTimeList).toContainText('Achat impulsif');

    // Click delete on the transaction
    await authenticatedPage
      .getByTestId(`delete-transaction-${TEST_UUIDS.TRANSACTION_1}`)
      .first()
      .click();

    // Confirmation dialog should appear
    const confirmDialog = authenticatedPage.getByTestId('confirmation-dialog');
    await expect(confirmDialog).toBeVisible();

    // Confirm deletion
    await authenticatedPage.getByTestId('confirmation-confirm-button').click();

    // Transaction should be removed from the list (optimistic update)
    await expect(oneTimeList).not.toContainText('Achat impulsif');
  });

  test('totals should recalculate after adding a free transaction', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    // Setup: Income 5000, expense envelope 500, existing free transaction 100
    // Initial expenses = max(500, 0) + 100 = 600
    // Initial remaining = 5000 - 600 = 4400
    const existingTransaction = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Existing expense',
      amount: 100,
      kind: 'expense',
      budgetLineId: null,
      transactionDate: currentMonthDate,
    });

    const newTransaction = createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
      name: 'New expense',
      amount: 200,
      kind: 'expense',
      budgetLineId: null,
      transactionDate: currentMonthDate,
    });

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
          data: { id: budgetId, month: currentMonth, year: currentYear, userId: TEST_UUIDS.USER_1, rollover: 0 },
        }),
      });
    });

    await currentMonthPage.goto();

    // Initial state: expenses = 500 (envelope) + 100 (free) = 600
    await currentMonthPage.expectExpensesAmount('600.00');
    // Initial remaining = 5000 - 600 = 4400
    await currentMonthPage.expectRemainingAmount("4'400.00");

    // Add a new free transaction of 200
    await currentMonthPage.addTransaction('200', 'New expense');

    // After adding: expenses = 500 (envelope) + 100 + 200 (free) = 800
    await currentMonthPage.expectExpensesAmount('800.00');
    // Remaining = 5000 - 800 = 4200
    await currentMonthPage.expectRemainingAmount("4'200.00");
  });
});
