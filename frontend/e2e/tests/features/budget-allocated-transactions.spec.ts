import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  createTransactionCreateResponseMock,
  createTransactionUpdateResponseMock,
} from '../../helpers/api-mocks';

test.describe('Budget Allocated Transactions', () => {
  test('should open allocated transactions dialog from budget table', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';

    // Mock budget with budget line (December 2025)
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 12,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(budgetLineId, budgetId, {
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();

    // Wait for budget line row to be visible in the table
    const budgetLineRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: 'Groceries' });
    await expect(budgetLineRow).toBeVisible({ timeout: 10000 });

    // Click on "View transactions" button (desktop mode)
    const viewTransactionsButton = authenticatedPage.locator(
      `[data-testid="view-transactions-${budgetLineId}"]`
    );
    await expect(viewTransactionsButton).toBeVisible({ timeout: 5000 });
    await viewTransactionsButton.click();

    // Wait for dialog to open
    await authenticatedPage.waitForTimeout(500);

    // Verify dialog is opened with correct title
    await expect(
      authenticatedPage.locator('.mat-mdc-dialog-container')
    ).toBeVisible({ timeout: 5000 });

    await expect(
      authenticatedPage
        .locator('.mat-mdc-dialog-container h2')
        .filter({ hasText: 'Groceries' })
    ).toBeVisible();

    // Verify empty state message
    await expect(
      authenticatedPage.locator('.mat-mdc-dialog-container')
    ).toContainText('Aucune transaction');
  });

  test('should display allocated transactions count badge', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';

    // Mock budget with budget line and 2 allocated transactions (December 2025)
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 12,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(budgetLineId, budgetId, {
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock('tx-1', budgetId, {
          name: 'Migros',
          amount: 120,
          kind: 'expense',
          budgetLineId,
          transactionDate: '2025-12-05T00:00:00Z',
        }),
        createTransactionMock('tx-2', budgetId, {
          name: 'Coop',
          amount: 80,
          kind: 'expense',
          budgetLineId,
          transactionDate: '2025-12-08T00:00:00Z',
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
    await budgetDetailsPage.expectPageLoaded();

    // Wait for table to render
    await authenticatedPage.waitForSelector('table[mat-table]', { timeout: 10000 });

    // Verify badge shows count of 2
    const budgetLineRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: 'Groceries' });
    await expect(budgetLineRow.locator('.rounded-full')).toContainText('2', {
      timeout: 5000,
    });
  });

  test('should add a transaction to budget line', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';
    let transactionCreated = false;

    // Initial mock - no transactions (December 2025 to match current date)
    const initialMockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 12,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(budgetLineId, budgetId, {
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [],
    });

    // Mock after transaction creation (December 2025)
    const newTransaction = createTransactionMock('tx-new', budgetId, {
      name: 'Migros',
      amount: 120,
      kind: 'expense',
      budgetLineId,
      transactionDate: '2025-12-15T00:00:00Z',
    });

    const updatedMockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 12,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(budgetLineId, budgetId, {
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [newTransaction],
    });

    // Mock budget details endpoint
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = transactionCreated
        ? updatedMockResponse
        : initialMockResponse;
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Mock transaction creation endpoint
    await authenticatedPage.route('**/api/v1/transactions', (route) => {
      if (route.request().method() === 'POST') {
        transactionCreated = true;
        const response = createTransactionCreateResponseMock(newTransaction);
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      }
    });

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();

    // Open allocated transactions dialog
    const viewTransactionsButton = authenticatedPage.locator(
      `[data-testid="view-transactions-${budgetLineId}"]`
    );
    await viewTransactionsButton.click();

    // Click "Add transaction" button
    const addButton = authenticatedPage.locator(
      '[data-testid="add-transaction"]'
    );
    await addButton.click();

    // Wait for form to be visible
    await authenticatedPage.waitForSelector('[data-testid="transaction-name-input"]');

    // Fill transaction form
    await authenticatedPage
      .locator('[data-testid="transaction-name-input"]')
      .fill('Migros');
    await authenticatedPage
      .locator('[data-testid="transaction-amount-input"]')
      .fill('120');

    // Fill date using datepicker toggle
    const dateToggle = authenticatedPage.locator('mat-datepicker-toggle button');
    await dateToggle.click();
    await authenticatedPage.waitForTimeout(300);

    // Select first available day in calendar
    const firstDay = authenticatedPage
      .locator('.mat-calendar-body-cell')
      .filter({ hasNotText: '' })
      .first();
    await firstDay.click();
    await authenticatedPage.waitForTimeout(300);

    // Submit form
    const submitButton = authenticatedPage.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeEnabled({ timeout: 3000 });
    await submitButton.click();

    // Verify success snackbar
    await expect(
      authenticatedPage.locator('.mat-mdc-snack-bar-label').last()
    ).toHaveText('Transaction ajoutée.');

    // Wait for dialogs to settle
    await authenticatedPage.waitForTimeout(2000);

    // Verify allocated transactions dialog reopened by checking for the dialog title
    const dialogTitle = authenticatedPage
      .locator('h2')
      .filter({ hasText: 'Groceries' });

    // If dialog is open, verify transaction is shown
    if (await dialogTitle.isVisible({ timeout: 1000 })) {
      const transactionItem = authenticatedPage
        .locator('mat-list-item')
        .filter({ hasText: 'Migros' });
      await expect(transactionItem).toBeVisible();

      // Close the dialog
      await authenticatedPage.locator('button:has-text("Fermer")').first().click();
      await authenticatedPage.waitForTimeout(300);
    }

    // Verify the badge shows 1 transaction in the budget table
    const budgetLineRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: 'Groceries' });
    await expect(budgetLineRow.locator('.rounded-full')).toContainText('1');
  });

  test('should edit an allocated transaction', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';
    const transactionId = 'tx-1';
    let transactionUpdated = false;

    const originalTransaction = createTransactionMock(transactionId, budgetId, {
      name: 'Migros',
      amount: 120,
      kind: 'expense',
      budgetLineId,
      transactionDate: '2025-12-10T00:00:00Z',
    });

    const updatedTransaction = createTransactionMock(transactionId, budgetId, {
      name: 'Migros Updated',
      amount: 150,
      kind: 'expense',
      budgetLineId,
      transactionDate: '2025-12-10T00:00:00Z',
    });

    // Mock budget details endpoint (December 2025)
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const transaction = transactionUpdated
        ? updatedTransaction
        : originalTransaction;
      const mockResponse = createBudgetDetailsMock(budgetId, {
        budget: {
          month: 12,
          year: 2025,
        },
        budgetLines: [
          createBudgetLineMock(budgetLineId, budgetId, {
            name: 'Groceries',
            amount: 500,
            kind: 'expense',
          }),
        ],
        transactions: [transaction],
      });
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Mock transaction update endpoint
    await authenticatedPage.route(
      `**/api/v1/transactions/${transactionId}`,
      (route) => {
        if (route.request().method() === 'PATCH') {
          transactionUpdated = true;
          const response =
            createTransactionUpdateResponseMock(updatedTransaction);
          void route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
          });
        }
      }
    );

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();

    // Wait for table to render
    await authenticatedPage.waitForSelector('table[mat-table]', { timeout: 10000 });

    // Open allocated transactions dialog
    const viewTransactionsButton = authenticatedPage.locator(
      `[data-testid="view-transactions-${budgetLineId}"]`
    );
    await viewTransactionsButton.click();

    // Wait for dialog to open and transaction to be visible
    await expect(
      authenticatedPage.locator('.mat-mdc-dialog-container')
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.locator('.mat-mdc-dialog-container mat-list-item')
    ).toContainText('Migros');

    // Open transaction action menu (more_vert button)
    const menuButton = authenticatedPage.locator('[data-testid^="transaction-menu-"]').first();
    await expect(menuButton).toBeVisible({ timeout: 3000 });
    await menuButton.click();

    // Wait for menu to open
    await authenticatedPage.waitForTimeout(300);

    // Click edit button in menu
    const editButton = authenticatedPage.locator('[data-testid="edit-transaction"]');
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();

    // Update form fields
    const nameInput = authenticatedPage.locator(
      '[data-testid="transaction-name-input"]'
    );
    await nameInput.clear();
    await nameInput.fill('Migros Updated');

    const amountInput = authenticatedPage.locator(
      '[data-testid="transaction-amount-input"]'
    );
    await amountInput.clear();
    await amountInput.fill('150');

    // Submit form
    const submitButton = authenticatedPage.locator(
      '[data-testid="submit-button"]'
    );
    await submitButton.click();

    // Verify success snackbar
    await expect(
      authenticatedPage.locator('.mat-mdc-snack-bar-label').last()
    ).toHaveText('Transaction modifiée.');

    // Verify dialog reopened with updated transaction
    await expect(authenticatedPage.locator('mat-list-item')).toContainText(
      'Migros Updated'
    );
    await expect(authenticatedPage.locator('mat-list-item')).toContainText(
      '150'
    );
  });

  test('should delete an allocated transaction', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';
    const transactionId = 'tx-1';
    let transactionDeleted = false;

    const transaction = createTransactionMock(transactionId, budgetId, {
      name: 'Migros',
      amount: 120,
      kind: 'expense',
      budgetLineId,
      transactionDate: '2025-12-10T00:00:00Z',
    });

    // Mock budget details endpoint (December 2025)
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const transactions = transactionDeleted ? [] : [transaction];
      const mockResponse = createBudgetDetailsMock(budgetId, {
        budget: {
          month: 12,
          year: 2025,
        },
        budgetLines: [
          createBudgetLineMock(budgetLineId, budgetId, {
            name: 'Groceries',
            amount: 500,
            kind: 'expense',
          }),
        ],
        transactions,
      });
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Mock transaction delete endpoint
    await authenticatedPage.route(
      `**/api/v1/transactions/${transactionId}`,
      (route) => {
        if (route.request().method() === 'DELETE') {
          transactionDeleted = true;
          void route.fulfill({
            status: 204,
          });
        }
      }
    );

    await budgetDetailsPage.goto(budgetId);
    await budgetDetailsPage.expectPageLoaded();

    // Wait for table to render
    await authenticatedPage.waitForSelector('table[mat-table]', { timeout: 10000 });

    // Open allocated transactions dialog
    const viewTransactionsButton = authenticatedPage.locator(
      `[data-testid="view-transactions-${budgetLineId}"]`
    );
    await viewTransactionsButton.click();

    // Wait for dialog to open and transaction to be visible
    await expect(
      authenticatedPage.locator('.mat-mdc-dialog-container')
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.locator('.mat-mdc-dialog-container mat-list-item')
    ).toContainText('Migros');

    // Open transaction action menu (more_vert button)
    const menuButton = authenticatedPage.locator('[data-testid^="transaction-menu-"]').first();
    await expect(menuButton).toBeVisible({ timeout: 3000 });
    await menuButton.click();

    // Wait for menu to open
    await authenticatedPage.waitForTimeout(300);

    // Click delete button in menu
    const deleteButton = authenticatedPage.locator('[data-testid="delete-transaction"]');
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    // Wait for confirmation dialog to open
    await authenticatedPage.waitForTimeout(500);

    // Confirm deletion in confirmation dialog
    const confirmButton = authenticatedPage
      .locator('.mat-mdc-dialog-container button')
      .filter({ hasText: 'Supprimer' })
      .last(); // Use last() in case multiple dialogs are stacked
    await expect(confirmButton).toBeVisible({ timeout: 3000 });
    await confirmButton.click();

    // Verify success snackbar
    await expect(
      authenticatedPage.locator('.mat-mdc-snack-bar-label').last()
    ).toHaveText('Transaction supprimée.');

    // Wait for deletion to complete
    await authenticatedPage.waitForTimeout(1000);

    // The dialog should be closed after deletion
    // Verify the badge is no longer visible (no transactions allocated)
    const budgetLineRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: 'Groceries' });
    await expect(budgetLineRow).toBeVisible();

    // Badge should not be present anymore
    await expect(budgetLineRow.locator('.rounded-full')).not.toBeVisible();
  });

  test('should display consumed and remaining amounts correctly', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';

    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 12,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(budgetLineId, budgetId, {
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock('tx-1', budgetId, {
          name: 'Migros',
          amount: 120,
          kind: 'expense',
          budgetLineId,
          transactionDate: '2025-12-05T00:00:00Z',
        }),
        createTransactionMock('tx-2', budgetId, {
          name: 'Coop',
          amount: 200,
          kind: 'expense',
          budgetLineId,
          transactionDate: '2025-12-10T00:00:00Z',
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
    await budgetDetailsPage.expectPageLoaded();

    // Open allocated transactions dialog
    const viewTransactionsButton = authenticatedPage.locator(
      `[data-testid="view-transactions-${budgetLineId}"]`
    );
    await viewTransactionsButton.click();

    // Verify amounts are displayed correctly with the new grid layout
    const dialog = authenticatedPage.locator('.mat-mdc-dialog-container');

    // Check for "Prévu", "Consommé", "Restant" labels
    await expect(dialog).toContainText('Prévu');
    await expect(dialog).toContainText('Consommé');
    await expect(dialog).toContainText('Restant');

    // Check amounts (Swiss format: CHF 500.00)
    await expect(dialog).toContainText('CHF 500.00'); // Planned
    await expect(dialog).toContainText('CHF 320.00'); // Consumed
    await expect(dialog).toContainText('CHF 180.00'); // Remaining (500 - 320)
  });

  test('should show over-budget indicator when consumed exceeds planned', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = 'test-budget-123';
    const budgetLineId = 'line-1';

    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 12,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(budgetLineId, budgetId, {
          name: 'Groceries',
          amount: 500,
          kind: 'expense',
        }),
      ],
      transactions: [
        createTransactionMock('tx-1', budgetId, {
          name: 'Migros',
          amount: 600, // Exceeds planned amount
          kind: 'expense',
          budgetLineId,
          transactionDate: '2025-12-15T00:00:00Z',
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
    await budgetDetailsPage.expectPageLoaded();

    // Open allocated transactions dialog
    const viewTransactionsButton = authenticatedPage.locator(
      `[data-testid="view-transactions-${budgetLineId}"]`
    );
    await viewTransactionsButton.click();

    // Verify negative remaining amount is shown
    const dialog = authenticatedPage.locator('.mat-mdc-dialog-container');

    // Check labels and amounts
    await expect(dialog).toContainText('Prévu');
    await expect(dialog).toContainText('Consommé');
    await expect(dialog).toContainText('Restant');

    await expect(dialog).toContainText('CHF 500.00'); // Planned
    await expect(dialog).toContainText('CHF 600.00'); // Consumed (over budget)
    await expect(dialog).toContainText('CHF-100.00'); // Negative remaining (500 - 600)

    // Verify negative amount has error styling
    const remainingValue = dialog
      .locator('span')
      .filter({ hasText: 'CHF-100.00' });
    await expect(remainingValue).toHaveClass(/text-financial-negative/);
  });
});
