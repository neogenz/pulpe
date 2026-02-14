import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Envelope Overage Reste Impact (Scenario 7.10)
 *
 * Business rule: totalExpenses(envelope) = max(envelope_amount, sum_allocated_transactions)
 * - When transactions < envelope amount: expense counted as envelope amount
 * - When transactions = envelope amount: expense counted as envelope amount
 * - When transactions > envelope amount: expense counted as transaction total (excess impacts Reste)
 */
test.describe('Envelope Overage Reste Impact', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  test('transactions under envelope amount — Reste uses envelope amount', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 5000, Envelope 200, Transaction 80
    // expense_total = max(200, 80) = 200 → Reste = 5000 - 200 = 4800
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
          amount: 200,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
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

    // Envelope card shows consumed 80 / 200
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();
    await expect(envelopeCard).toContainText('80 CHF');
    await expect(envelopeCard).toContainText('200 CHF');

    // Progress bar: 80/200 = 40%
    await expect(envelopeCard).toContainText('40%');

    // Reste = 5000 - 200 = 4800 (envelope covers the 80 transaction)
    const heroSection = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(heroSection).toContainText("4\u2019800");
    await expect(heroSection).toContainText('Ce qu\'il te reste ce mois');
  });

  test('transactions exactly at envelope amount — Reste unchanged', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 5000, Envelope 200, Transactions 120+80=200
    // expense_total = max(200, 200) = 200 → Reste = 5000 - 200 = 4800
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
          amount: 200,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
          amount: 120,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
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

    // Envelope card shows consumed 200 / 200
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();
    await expect(envelopeCard).toContainText('200 CHF');

    // Progress bar: 200/200 = 100%
    await expect(envelopeCard).toContainText('100%');

    // Reste = 5000 - 200 = 4800
    const heroSection = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(heroSection).toContainText("4\u2019800");
  });

  test('transactions exceeding envelope — Reste decreases by excess', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 5000, Envelope 200, Transactions 150+100=250
    // expense_total = max(200, 250) = 250 → Reste = 5000 - 250 = 4750
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
          amount: 200,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Migros',
          amount: 150,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Coop',
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

    // Envelope card shows consumed 250 / 200 (overage)
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();
    await expect(envelopeCard).toContainText('250 CHF');
    await expect(envelopeCard).toContainText('200 CHF');

    // Overage indicator
    await expect(envelopeCard).toContainText(/d[ée]pass[ée]/);

    // Reste = 5000 - 250 = 4750 (excess 50 reduces Reste)
    const heroSection = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(heroSection).toContainText("4\u2019750");
    await expect(heroSection).toContainText('Ce qu\'il te reste ce mois');
  });

  test('progress bar shows overage percentage when transactions exceed envelope', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 5000, Envelope 200, Transaction 250
    // Progress = 250/200 = 125%
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
          amount: 200,
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

    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();

    // Progress bar should be visible with overage
    const progressBar = envelopeCard.locator('pulpe-segmented-budget-progress');
    await expect(progressBar).toBeVisible();

    // 250/200 = 125% — component shows "dépassé" instead of percentage when > 100%
    await expect(envelopeCard).toContainText(/d[ée]pass[ée]/);
  });
});
