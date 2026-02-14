import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Allocated Transaction Lifecycle (Scenario 5.7)
 *
 * Tests the full transaction lifecycle within envelopes:
 * - Viewing allocated transactions inside an envelope
 * - Progress bar and consumed amounts
 * - Overage indicators when consumed > planned
 * - Free transactions appearing outside envelopes
 * - Remaining budget calculation with mixed scenarios
 */
test.describe('Allocated Transaction Lifecycle', () => {
  test('envelope with single transaction shows transaction in detail panel', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { rollover: 0 },
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
          name: 'Supermarche',
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

    await budgetDetailsPage.goto(budgetId);

    // Envelope card should be visible with "Courses"
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();
    await expect(envelopeCard).toContainText('Courses');
    await expect(envelopeCard).toContainText('500 CHF');

    // Click the card to open the detail panel
    await envelopeCard.click();

    // The detail panel shows the allocated transaction
    const detailTransaction = authenticatedPage.getByTestId(
      `detail-transaction-${TEST_UUIDS.TRANSACTION_1}`,
    );
    await expect(detailTransaction).toBeVisible();
    await expect(detailTransaction).toContainText('Supermarche');
    await expect(detailTransaction).toContainText('100 CHF');
  });

  test('envelope with multiple transactions shows consumed total and progress', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Envelope 500 CHF with 3 transactions: 100 + 150 + 80 = 330
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { rollover: 0 },
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
          name: 'Migros',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
          amount: 150,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_3, budgetId, {
          name: 'Lidl',
          amount: 80,
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

    await budgetDetailsPage.goto(budgetId);

    // Envelope card shows consumed amount "CHF 330 depense"
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();
    await expect(envelopeCard).toContainText('330 CHF');

    // Progress bar should be visible (segmented-budget-progress renders segments)
    const progressBar = envelopeCard.locator('pulpe-segmented-budget-progress');
    await expect(progressBar).toBeVisible();

    // 330/500 = 66% should be displayed
    await expect(envelopeCard).toContainText('66%');

    // Click to open detail panel and verify all 3 transactions
    await envelopeCard.click();

    await expect(
      authenticatedPage.getByTestId(
        `detail-transaction-${TEST_UUIDS.TRANSACTION_1}`,
      ),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(
        `detail-transaction-${TEST_UUIDS.TRANSACTION_2}`,
      ),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(
        `detail-transaction-${TEST_UUIDS.TRANSACTION_3}`,
      ),
    ).toBeVisible();
  });

  test('overage display when consumed exceeds envelope amount', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Envelope 100 CHF with 250 allocated -> overage
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { rollover: 0 },
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
          name: 'Gros achat',
          amount: 250,
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

    await budgetDetailsPage.goto(budgetId);

    // Envelope card should show overage indicator
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();

    // Desktop card shows "depasse" text when percentage > 100
    await expect(envelopeCard).toContainText(/d[ée]pass[ée]/);
  });

  test.describe('Mobile - Free Transactions', () => {
    test.use({
      viewport: { width: 375, height: 667 },
      isMobile: true,
    });

    test('free transactions appear in transaction section', async ({
      authenticatedPage,
      budgetDetailsPage,
    }) => {
      const budgetId = TEST_UUIDS.BUDGET_1;

      const mockResponse = createBudgetDetailsMock(budgetId, {
        budget: { rollover: 0 },
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
          // Allocated transaction
          createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
            name: 'Migros',
            amount: 100,
            kind: 'expense',
            budgetLineId: TEST_UUIDS.LINE_2,
          }),
          // Free transaction (no budgetLineId)
          createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
            name: 'Cafe imprev',
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

      await budgetDetailsPage.goto(budgetId);

      // Envelope card for allocated transaction should be visible
      const envelopeCard = authenticatedPage.getByTestId(
        `envelope-card-${TEST_UUIDS.LINE_2}`,
      );
      await expect(envelopeCard).toBeVisible();

      // Free transaction should appear in the transactions section
      const freeTransactionCard = authenticatedPage.getByTestId(
        `transaction-card-${TEST_UUIDS.TRANSACTION_2}`,
      );
      await expect(freeTransactionCard).toBeVisible();
      await expect(freeTransactionCard).toContainText('Cafe imprev');
    });
  });

  test('mixed scenario with correct remaining calculation', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Setup: Income 5000, Envelope 500 (allocated 200), Free tx 100
    // totalExpenses = max(500, 200) + 100 = 600
    // totalAvailable = 5000
    // remaining = 5000 - 600 = 4400
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: { rollover: 0 },
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
          name: 'Supermarche',
          amount: 200,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Achat libre',
          amount: 100,
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

    // Verify expenses = 500 (envelope) + 100 (free) = 600
    await currentMonthPage.expectExpensesAmount('600.00');
    // Verify remaining = 5000 - 600 = 4400
    await currentMonthPage.expectRemainingAmount("4'400.00");
  });
});
