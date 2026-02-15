import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Transaction Check Independence (Scenario 5.10)', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  test('checking all allocated transactions does NOT auto-check the parent envelope', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const envelopeLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      checkedAt: null,
    });

    const tx1 = createTransactionMock(TEST_UUIDS.TRANSACTION_1, budgetId, {
      name: 'Migros',
      amount: 100,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
      checkedAt: null,
    });
    const tx2 = createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
      name: 'Coop',
      amount: 150,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
      checkedAt: null,
    });
    const tx3 = createTransactionMock(TEST_UUIDS.TRANSACTION_3, budgetId, {
      name: 'Lidl',
      amount: 200,
      kind: 'expense',
      budgetLineId: TEST_UUIDS.LINE_2,
      checkedAt: null,
    });

    const mockResponse = createBudgetDetailsMock(budgetId, {
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 5000,
          kind: 'income',
        }),
        envelopeLine,
      ],
      transactions: [tx1, tx2, tx3],
    });

    // Show all items (not just unchecked)
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

    // Mock toggle-check for each transaction
    const checkedTimestamp = '2025-01-15T12:00:00Z';

    const togglePromises: Promise<unknown>[] = [];

    for (const tx of [tx1, tx2, tx3]) {
      await authenticatedPage.route(
        `**/api/v1/transactions/${tx.id}/toggle-check`,
        (route) => {
          void route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { ...tx, checkedAt: checkedTimestamp, updatedAt: checkedTimestamp },
            }),
          });
        },
      );
    }

    // Track if budget-line toggle-check is called (it should NOT be)
    let envelopeToggleCalled = false;
    await authenticatedPage.route(
      `**/api/v1/budget-lines/${TEST_UUIDS.LINE_2}/toggle-check`,
      (route) => {
        envelopeToggleCalled = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: envelopeLine }),
        });
      },
    );

    await budgetDetailsPage.goto(budgetId);

    // Wait for the progress bar component to render before asserting text
    await expect(authenticatedPage.getByTestId('realized-balance-progress')).toBeVisible();

    // Verify initial pointés count: 0/5 (2 lines + 3 transactions, all unchecked)
    await expect(
      authenticatedPage.getByText('0/5 éléments comptabilisés'),
    ).toBeVisible();

    // Open the envelope detail panel by clicking the envelope card
    const envelopeCard = authenticatedPage.getByTestId(
      `envelope-card-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeCard).toBeVisible();
    await envelopeCard.click();

    // Check transaction 1
    const toggleTx1Promise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/transactions/${TEST_UUIDS.TRANSACTION_1}/toggle-check`) &&
        req.method() === 'POST',
    );
    const toggleTx1 = authenticatedPage.getByTestId(
      `toggle-tx-check-${TEST_UUIDS.TRANSACTION_1}`,
    );
    await expect(toggleTx1).toBeVisible();
    await toggleTx1.click();
    await toggleTx1Promise;

    // Verify pointés count: 1/5
    await expect(
      authenticatedPage.getByText('1/5 éléments comptabilisés'),
    ).toBeVisible();

    // Check transaction 2
    const toggleTx2Promise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/transactions/${TEST_UUIDS.TRANSACTION_2}/toggle-check`) &&
        req.method() === 'POST',
    );
    const toggleTx2 = authenticatedPage.getByTestId(
      `toggle-tx-check-${TEST_UUIDS.TRANSACTION_2}`,
    );
    await expect(toggleTx2).toBeVisible();
    await toggleTx2.click();
    await toggleTx2Promise;

    // Verify pointés count: 2/5
    await expect(
      authenticatedPage.getByText('2/5 éléments comptabilisés'),
    ).toBeVisible();

    // Check transaction 3
    const toggleTx3Promise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/transactions/${TEST_UUIDS.TRANSACTION_3}/toggle-check`) &&
        req.method() === 'POST',
    );
    const toggleTx3 = authenticatedPage.getByTestId(
      `toggle-tx-check-${TEST_UUIDS.TRANSACTION_3}`,
    );
    await expect(toggleTx3).toBeVisible();
    await toggleTx3.click();
    await toggleTx3Promise;

    // Verify pointés count: 3/5 (all 3 transactions checked, but envelope + income still unchecked)
    await expect(
      authenticatedPage.getByText('3/5 éléments comptabilisés'),
    ).toBeVisible();

    // Close the detail panel to verify the envelope toggle state
    await authenticatedPage.keyboard.press('Escape');

    // Verify the parent envelope switch is still NOT checked
    const envelopeToggle = authenticatedPage.getByTestId(
      `toggle-check-${TEST_UUIDS.LINE_2}`,
    );
    await expect(envelopeToggle).toBeVisible();
    const switchElement = envelopeToggle.getByRole('switch');
    await expect(switchElement).not.toBeChecked();

    // Verify no budget-line toggle-check API was called
    expect(envelopeToggleCalled).toBe(false);
  });
});
