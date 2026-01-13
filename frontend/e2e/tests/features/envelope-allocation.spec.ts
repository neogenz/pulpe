import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Envelope Allocation Business Logic
 *
 * Business rule:
 * - Allocated transactions are "covered" by their envelope (budget line)
 * - Only overage (consumed > envelope.amount) impacts the budget
 * - Free transactions (no budgetLineId) impact the budget directly
 *
 * Formula:
 * totalExpenses = Σ(max(envelope.amount, consumed)) + Σ(freeTransactions)
 * remaining = (totalIncome + rollover) - totalExpenses
 */
test.describe('Envelope Allocation - Remaining Budget Calculation', () => {
  test('allocated transaction within envelope should NOT reduce remaining budget', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Setup: Income 5000, Envelope 500 (expense), Allocated transaction 100
    // Expected: totalExpenses = 500 (envelope amount, since 100 < 500)
    // Expected: remaining = 5000 - 500 = 4500
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        rollover: 0,
      },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Verify expenses = 500 (envelope amount, not 100)
    await currentMonthPage.expectExpensesAmount('500.00');
    // Verify remaining = 5000 - 500 = 4500
    await currentMonthPage.expectRemainingAmount("4'500.00");
  });

  test('allocated transaction exceeding envelope should only count overage', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Setup: Income 5000, Envelope 100, Allocated transaction 150
    // Expected: totalExpenses = 150 (consumed > envelope, so take consumed)
    // Expected: remaining = 5000 - 150 = 4850
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        rollover: 0,
      },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 100,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 150,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Verify expenses = 150 (consumed amount, not 100)
    await currentMonthPage.expectExpensesAmount('150.00');
    // Verify remaining = 5000 - 150 = 4850
    await currentMonthPage.expectRemainingAmount("4'850.00");
  });

  test('mixed free and allocated transactions should be calculated correctly', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Setup: Income 5000
    // Envelope 500 (expense) + allocated 200 within it
    // Free transaction 50
    // Expected: totalExpenses = 500 (envelope) + 50 (free) = 550
    // Expected: remaining = 5000 - 550 = 4450
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        rollover: 0,
      },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 200,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Café',
          amount: 50,
          kind: 'expense',
          budgetLineId: null,
        }),
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Verify expenses = 500 + 50 = 550
    await currentMonthPage.expectExpensesAmount('550.00');
    // Verify remaining = 5000 - 550 = 4450
    await currentMonthPage.expectRemainingAmount("4'450.00");
  });

  test('real user scenario: 88 CHF overage (envelope 100, allocated 188)', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Setup: User scenario from bug report
    // Envelope 100, Allocated 188 → expenses = 188 (overage 88)
    // Income 1000
    // Expected: remaining = 1000 - 188 = 812
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        rollover: 0,
      },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 1000,
          kind: 'income',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 100,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Restaurant',
          amount: 188,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Verify expenses = 188 (consumed amount since > envelope)
    await currentMonthPage.expectExpensesAmount('188.00');
    // Verify remaining = 1000 - 188 = 812
    await currentMonthPage.expectRemainingAmount('812.00');
  });

  test('multiple envelopes with different states should calculate correctly', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Setup:
    // Income 5000
    // Envelope1: 500 with 300 allocated (within) → count 500
    // Envelope2: 200 with 350 allocated (overage 150) → count 350
    // Expected: totalExpenses = 500 + 350 = 850
    // Expected: remaining = 5000 - 850 = 4150
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        rollover: 0,
      },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 500,
          kind: 'expense',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
          name: 'Loisirs',
          amount: 200,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 300,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Concert',
          amount: 350,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_3,
        }),
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await currentMonthPage.goto();
    await currentMonthPage.expectPageLoaded();

    // Verify expenses = 500 + 350 = 850
    await currentMonthPage.expectExpensesAmount('850.00');
    // Verify remaining = 5000 - 850 = 4150
    await currentMonthPage.expectRemainingAmount("4'150.00");
  });
});
