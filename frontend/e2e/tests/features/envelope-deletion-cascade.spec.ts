import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Envelope Deletion Cascade (Scenario 7.9)
 *
 * When an envelope is deleted:
 * - Its allocated transactions become free (budgetLineId → null)
 * - The Reste recalculates: envelope coverage removed, only free transactions count
 *
 * Formula impact:
 * Before: totalExpenses includes max(envelope_amount, sum_allocated_transactions)
 * After:  envelope gone, transactions free → totalExpenses includes sum_transactions
 */
test.describe('Envelope Deletion Cascade', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  test('delete envelope with transactions increases Reste by coverage difference', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 7500, Envelope "Courses" 2000 CHF with tx 500+300=800
    // Before: expenses = max(2000, 800) = 2000 → Reste = 7500 - 2000 = 5500
    // After:  expenses = 800 (free tx) → Reste = 7500 - 800 = 6700
    const incomeLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
      name: 'Salaire',
      amount: 7500,
      kind: 'income',
      recurrence: 'fixed',
    });
    const envelopeLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Courses',
      amount: 2000,
      kind: 'expense',
      recurrence: 'one_off',
    });
    const tx1 = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Migros',
      amount: 500,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
    });
    const tx2 = createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
      name: 'Coop',
      amount: 300,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
    });

    const beforeResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [incomeLine, envelopeLine],
      transactions: [tx1, tx2],
    });

    const afterResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [incomeLine],
      transactions: [
        { ...tx1, budgetLineId: null },
        { ...tx2, budgetLineId: null },
      ],
    });

    let hasDeleted = false;

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(hasDeleted ? afterResponse : beforeResponse),
      });
    });

    await authenticatedPage.route(`**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}`, (route) => {
      if (route.request().method() === 'DELETE') {
        hasDeleted = true;
        void route.fulfill({ status: 200, body: JSON.stringify({ success: true, message: 'Deleted' }) });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    // Before deletion: hero shows Reste = 5500
    const heroSection = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(heroSection).toContainText("5\u2019500");
    await expect(heroSection).toContainText('Ce qu\'il te reste ce mois');

    // Delete the envelope via table view
    await budgetDetailsPage.switchToTableView();
    await budgetDetailsPage.clickDeleteBudgetLine('Courses');
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeVisible();
    await budgetDetailsPage.confirmDelete();

    // After deletion: hero shows Reste = 6700
    await expect(heroSection).toContainText("6\u2019700");
  });

  test('delete envelope without transactions increases Reste by full amount', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 7500, Envelope "Abonnement" 200 CHF, no transactions
    // Before: expenses = 200 → Reste = 7500 - 200 = 7300
    // After:  expenses = 0 → Reste = 7500
    const incomeLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
      name: 'Salaire',
      amount: 7500,
      kind: 'income',
      recurrence: 'fixed',
    });
    const envelopeLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Abonnement',
      amount: 200,
      kind: 'expense',
      recurrence: 'fixed',
    });

    const beforeResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [incomeLine, envelopeLine],
      transactions: [],
    });

    const afterResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [incomeLine],
      transactions: [],
    });

    let hasDeleted = false;

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(hasDeleted ? afterResponse : beforeResponse),
      });
    });

    await authenticatedPage.route(`**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}`, (route) => {
      if (route.request().method() === 'DELETE') {
        hasDeleted = true;
        void route.fulfill({ status: 200, body: JSON.stringify({ success: true, message: 'Deleted' }) });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    // Before deletion: hero shows Reste = 7300
    const heroSection = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(heroSection).toContainText("7\u2019300");

    // Delete the envelope
    await budgetDetailsPage.switchToTableView();
    await budgetDetailsPage.clickDeleteBudgetLine('Abonnement');
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeVisible();
    await budgetDetailsPage.confirmDelete();

    // After deletion: hero shows Reste = 7500
    await expect(heroSection).toContainText("7\u2019500");
  });

  test('delete envelope with overage keeps Reste unchanged', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Income 7500, Envelope "Courses" 500 CHF with tx 500+300=800 (overage)
    // Before: expenses = max(500, 800) = 800 → Reste = 7500 - 800 = 6700
    // After:  expenses = 800 (free tx) → Reste = 7500 - 800 = 6700 (unchanged)
    const incomeLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
      name: 'Salaire',
      amount: 7500,
      kind: 'income',
      recurrence: 'fixed',
    });
    const envelopeLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      recurrence: 'one_off',
    });
    const tx1 = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Migros',
      amount: 500,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
    });
    const tx2 = createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
      name: 'Coop',
      amount: 300,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
    });

    const beforeResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [incomeLine, envelopeLine],
      transactions: [tx1, tx2],
    });

    const afterResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [incomeLine],
      transactions: [
        { ...tx1, budgetLineId: null },
        { ...tx2, budgetLineId: null },
      ],
    });

    let hasDeleted = false;

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(hasDeleted ? afterResponse : beforeResponse),
      });
    });

    await authenticatedPage.route(`**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}`, (route) => {
      if (route.request().method() === 'DELETE') {
        hasDeleted = true;
        void route.fulfill({ status: 200, body: JSON.stringify({ success: true, message: 'Deleted' }) });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    // Before deletion: hero shows Reste = 6700 (max(500,800)=800, 7500-800=6700)
    const heroSection = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(heroSection).toContainText("6\u2019700");

    // Delete the envelope
    await budgetDetailsPage.switchToTableView();
    await budgetDetailsPage.clickDeleteBudgetLine('Courses');
    await expect(authenticatedPage.getByTestId('confirmation-dialog')).toBeVisible();
    await budgetDetailsPage.confirmDelete();

    // After deletion: Reste unchanged at 6700 (free tx 800, 7500-800=6700)
    await expect(heroSection).toContainText("6\u2019700");
  });
});
