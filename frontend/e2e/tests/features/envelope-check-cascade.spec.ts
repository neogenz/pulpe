import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Envelope Check/Uncheck Cascade', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  test('should check envelope without transactions directly (no cascade dialog)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const uncheckedLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      checkedAt: null,
    });

    const checkedLine = {
      ...uncheckedLine,
      checkedAt: '2025-01-15T12:00:00Z',
      updatedAt: '2025-01-15T12:00:00Z',
    };

    // No transactions allocated to this envelope
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        uncheckedLine,
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    const togglePromise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/budget-lines/${TEST_UUIDS.LINE_1}/toggle-check`) &&
        req.method() === 'POST',
    );

    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_1}/toggle-check`,
      (route) => {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: checkedLine }),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);

    const toggle = authenticatedPage.getByTestId(
      `toggle-check-${TEST_UUIDS.LINE_1}`,
    );
    await expect(toggle).toBeVisible();
    await toggle.click();

    // No cascade dialog should appear - toggle-check is called directly
    await togglePromise;

    // Verify no dialog appeared
    await expect(
      authenticatedPage.getByText('Comptabiliser les transactions ?'),
    ).not.toBeVisible();
  });

  test('should uncheck a checked envelope via toggle switch', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const checkedLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      checkedAt: '2025-01-15T12:00:00Z',
    });

    const uncheckedLine = {
      ...checkedLine,
      checkedAt: null,
      updatedAt: '2025-01-16T12:00:00Z',
    };

    // By default isShowingOnlyUnchecked is true, so we need to disable it
    // to see checked items. StorageService uses versioned format.
    await authenticatedPage.addInitScript(() => {
      const entry = { version: 1, data: false, updatedAt: new Date().toISOString() };
      localStorage.setItem('pulpe-budget-show-only-unchecked', JSON.stringify(entry));
    });

    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        checkedLine,
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    const togglePromise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/budget-lines/${TEST_UUIDS.LINE_1}/toggle-check`) &&
        req.method() === 'POST',
    );

    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_1}/toggle-check`,
      (route) => {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: uncheckedLine }),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);

    const toggle = authenticatedPage.getByTestId(
      `toggle-check-${TEST_UUIDS.LINE_1}`,
    );
    await expect(toggle).toBeVisible();

    // Verify it starts checked
    const switchElement = toggle.getByRole('switch');
    await expect(switchElement).toBeChecked();

    // Click to uncheck
    await toggle.click();

    // Verify API was called
    await togglePromise;

    // Verify it becomes unchecked
    await expect(switchElement).not.toBeChecked();
  });

  test('should update pointés count when checking an envelope', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    // Setup: 5 items total (3 lines + 2 transactions), 2 already checked
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
          checkedAt: '2025-01-10T12:00:00Z',
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
          name: 'Courses',
          amount: 500,
          kind: 'expense',
          checkedAt: null,
        }),
        createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
          name: 'Loisirs',
          amount: 200,
          kind: 'expense',
          checkedAt: null,
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: '2025-01-12T12:00:00Z',
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Café',
          amount: 20,
          kind: 'expense',
          budgetLineId: null,
          checkedAt: null,
        }),
      ],
    });

    // Show all items (not just unchecked). StorageService uses versioned format.
    await authenticatedPage.addInitScript(() => {
      const entry = { version: 1, data: false, updatedAt: new Date().toISOString() };
      localStorage.setItem('pulpe-budget-show-only-unchecked', JSON.stringify(entry));
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    const checkedLine2 = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      checkedAt: '2025-01-15T12:00:00Z',
    });

    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}/toggle-check`,
      (route) => {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: checkedLine2 }),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);

    // Wait for the progress bar component to render before asserting text
    await expect(authenticatedPage.getByTestId('realized-balance-progress')).toBeVisible();

    // Verify initial pointés count: 2/5 (Salaire + Supermarché checked)
    await expect(
      authenticatedPage.getByText('2/5 éléments pointés'),
    ).toBeVisible();

    // Check the "Courses" envelope
    const toggle = authenticatedPage.getByTestId(
      `toggle-check-${TEST_UUIDS.LINE_2}`,
    );
    await toggle.click();

    // Verify updated count: 3/5
    await expect(
      authenticatedPage.getByText('3/5 éléments pointés'),
    ).toBeVisible();
  });

  test('should show cascade confirmation when checking envelope with unchecked transactions', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const mockResponse = createBudgetDetailsMock(budgetId, {
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
          checkedAt: null,
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: null,
        }),
        createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
          name: 'Boulangerie',
          amount: 30,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: null,
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

    const checkedLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      checkedAt: '2025-01-15T12:00:00Z',
    });

    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}/toggle-check`,
      (route) => {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: checkedLine }),
        });
      },
    );

    // Mock cascade check-transactions endpoint
    const cascadePromise = authenticatedPage.waitForRequest(
      (req) =>
        req
          .url()
          .includes(
            `/budget-lines/${TEST_UUIDS.LINE_2}/check-transactions`,
          ) && req.method() === 'POST',
    );

    const checkedTx1 = createTransactionMock(
      TEST_UUIDS.TRANSACTION_1,
      budgetId,
      {
        name: 'Supermarché',
        amount: 100,
        kind: 'expense',
        budgetLineId: TEST_UUIDS.LINE_2,
        checkedAt: '2025-01-15T12:00:00Z',
      },
    );
    const checkedTx2 = createTransactionMock(
      TEST_UUIDS.TRANSACTION_2,
      budgetId,
      {
        name: 'Boulangerie',
        amount: 30,
        kind: 'expense',
        budgetLineId: TEST_UUIDS.LINE_2,
        checkedAt: '2025-01-15T12:00:00Z',
      },
    );

    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}/check-transactions`,
      (route) => {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [checkedTx1, checkedTx2],
          }),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);

    // Click the toggle for the envelope with unchecked transactions
    const toggle = authenticatedPage.getByTestId(
      `toggle-check-${TEST_UUIDS.LINE_2}`,
    );
    await toggle.click();

    // Confirmation dialog should appear
    await expect(
      authenticatedPage.getByText('Comptabiliser les transactions ?'),
    ).toBeVisible();

    // Confirm cascade
    await authenticatedPage
      .getByTestId('confirmation-confirm-button')
      .click();

    // Verify cascade API was called
    await cascadePromise;
  });

  test('should check only envelope when declining cascade confirmation', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const mockResponse = createBudgetDetailsMock(budgetId, {
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
          checkedAt: null,
        }),
      ],
      transactions: [
        createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
          name: 'Supermarché',
          amount: 100,
          kind: 'expense',
          budgetLineId: TEST_UUIDS.LINE_2,
          checkedAt: null,
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

    const checkedLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      checkedAt: '2025-01-15T12:00:00Z',
    });

    const togglePromise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/budget-lines/${TEST_UUIDS.LINE_2}/toggle-check`) &&
        req.method() === 'POST',
    );

    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}/toggle-check`,
      (route) => {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: checkedLine }),
        });
      },
    );

    // Track if cascade endpoint is called (it should NOT be)
    let cascadeCalled = false;
    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}/check-transactions`,
      (route) => {
        cascadeCalled = true;
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);

    const toggle = authenticatedPage.getByTestId(
      `toggle-check-${TEST_UUIDS.LINE_2}`,
    );
    await toggle.click();

    // Confirmation dialog should appear
    await expect(
      authenticatedPage.getByText('Comptabiliser les transactions ?'),
    ).toBeVisible();

    // Decline cascade - click "Non, juste l'enveloppe"
    await authenticatedPage
      .getByTestId('confirmation-cancel-button')
      .click();

    // Envelope toggle-check should still be called
    await togglePromise;

    // Cascade endpoint should NOT have been called
    expect(cascadeCalled).toBe(false);
  });
});
