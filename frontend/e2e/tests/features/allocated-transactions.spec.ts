import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  createAllocatedTransactionsResponseMock,
} from '../../helpers/api-mocks';

test.describe('Allocated Transactions', () => {
  const budgetId = 'test-budget-123';
  const budgetLineId = 'line-1';

  test('should open allocated transactions dialog from budget table', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetLine = createBudgetLineMock(budgetLineId, budgetId, {
      name: 'Courses alimentaires',
      amount: 500,
      kind: 'expense',
    });

    // Mock budget details API
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createBudgetDetailsMock(budgetId, {
            budgetLines: [budgetLine],
          }),
        ),
      });
    });

    // Mock allocated transactions API
    await authenticatedPage.route(
      `**/api/v1/budget-lines/${budgetLineId}/transactions`,
      (route) => {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createAllocatedTransactionsResponseMock([
              createTransactionMock('tx-1', budgetId, {
                name: 'Supermarché',
                amount: 85,
                kind: 'expense',
                budgetLineId,
              }),
              createTransactionMock('tx-2', budgetId, {
                name: 'Boulangerie',
                amount: 15,
                kind: 'expense',
                budgetLineId,
              }),
            ]),
          ),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();

    // Click on the transactions button for the budget line
    const transactionsButton = authenticatedPage.locator(
      `[data-testid="transactions-${budgetLineId}"]`,
    );
    await expect(transactionsButton).toBeVisible();
    await transactionsButton.click();

    // Verify dialog opens
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Verify dialog title
    await expect(dialog.locator('h2')).toContainText('Transactions allouées');

    // Verify budget line info is displayed
    await expect(dialog).toContainText('Courses alimentaires');
    await expect(dialog).toContainText('500'); // Prévu

    // Verify transactions are displayed in table
    await expect(dialog.locator('table')).toBeVisible();
    await expect(dialog).toContainText('Supermarché');
    await expect(dialog).toContainText('Boulangerie');
    await expect(dialog).toContainText('85');
    await expect(dialog).toContainText('15');

    // Close dialog
    await dialog.locator('button:has-text("Fermer")').click();
    await expect(dialog).not.toBeVisible();
  });

  test('should display empty state when no allocated transactions', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetLine = createBudgetLineMock(budgetLineId, budgetId, {
      name: 'Épargne',
      amount: 200,
      kind: 'saving',
    });

    // Mock budget details API
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createBudgetDetailsMock(budgetId, {
            budgetLines: [budgetLine],
          }),
        ),
      });
    });

    // Mock allocated transactions API - return empty list
    await authenticatedPage.route(
      `**/api/v1/budget-lines/${budgetLineId}/transactions`,
      (route) => {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createAllocatedTransactionsResponseMock([])),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();

    // Click on transactions button
    const transactionsButton = authenticatedPage.locator(
      `[data-testid="transactions-${budgetLineId}"]`,
    );
    await transactionsButton.click();

    // Verify dialog opens with empty state
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Aucune transaction allouée');
  });
});
