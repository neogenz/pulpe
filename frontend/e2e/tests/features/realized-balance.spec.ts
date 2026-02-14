import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Solde Realise (Realized Balance)', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  // All tests need to show checked items (default filter hides them)
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.addInitScript(() => {
      const entry = { version: 1, data: false, updatedAt: new Date().toISOString() };
      localStorage.setItem('pulpe-budget-show-only-unchecked', JSON.stringify(entry));
    });
  });

  test('(7.5) envelope checked without overage uses envelope amount', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Envelope 2000 CHF, transactions sum 1000 < 2000 => max(2000, 1000) = 2000
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 2000,
          kind: 'expense',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
          amount: 900,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
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

    await budgetDetailsPage.goto(budgetId);

    const progressBar = authenticatedPage.getByTestId('realized-balance-progress');
    await expect(progressBar).toBeVisible();

    // Realized expenses = max(2000, 1000) = 2000
    await expect(progressBar).toContainText("2'000 CHF");
    // Realized balance = 5000 - 2000 = 3000
    await expect(progressBar).toContainText("3'000 CHF");
  });

  test('(7.6) envelope checked with overage uses transaction sum', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Envelope 2000 CHF, transactions sum 3000 > 2000 => max(2000, 3000) = 3000
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 2000,
          kind: 'expense',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
          amount: 900,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_3, budgetId, {
          name: 'Denner',
          amount: 2000,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
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

    await budgetDetailsPage.goto(budgetId);

    const progressBar = authenticatedPage.getByTestId('realized-balance-progress');
    await expect(progressBar).toBeVisible();

    // Realized expenses = max(2000, 3000) = 3000
    await expect(progressBar).toContainText("3'000 CHF");
    // Realized balance = 5000 - 3000 = 2000
    await expect(progressBar).toContainText("2'000 CHF");
  });

  test('(7.7) no double counting when envelope and transactions are checked', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Envelope 500 CHF, transactions sum 450, all checked
    // Expected: max(500, 450) = 500, NOT 500 + 450 = 950
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 500,
          kind: 'expense',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
          amount: 150,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_3, budgetId, {
          name: 'Lidl',
          amount: 200,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
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

    await budgetDetailsPage.goto(budgetId);

    const progressBar = authenticatedPage.getByTestId('realized-balance-progress');
    await expect(progressBar).toBeVisible();

    // Realized expenses = max(500, 450) = 500 (NOT 950)
    await expect(progressBar).toContainText('500 CHF');
    // Realized balance = 5000 - 500 = 4500
    await expect(progressBar).toContainText("4'500 CHF");
  });

  test('(7.8) envelope not checked — only checked transactions count', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Envelope 500 NOT checked, transactions 100+150+200=450 all checked
    // Expected: only sum of checked transactions = 450 (envelope not counted)
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 500,
          kind: 'expense',
          checkedAt: null, // NOT checked
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
          amount: 150,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_3, budgetId, {
          name: 'Lidl',
          amount: 200,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-15T12:00:00Z',
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

    await budgetDetailsPage.goto(budgetId);

    const progressBar = authenticatedPage.getByTestId('realized-balance-progress');
    await expect(progressBar).toBeVisible();

    // Realized expenses = 450 (only checked transactions, envelope not checked)
    await expect(progressBar).toContainText('450 CHF');
    // Realized balance = 5000 - 450 = 4550
    await expect(progressBar).toContainText("4'550 CHF");
  });
});
