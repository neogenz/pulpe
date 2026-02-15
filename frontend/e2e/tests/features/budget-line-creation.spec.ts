import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createBudgetLineResponseMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Budget Line Creation', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  const salaireLine = createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
    name: 'Salaire',
    amount: 5000,
    kind: 'income',
    recurrence: 'fixed',
  });

  const loyerLine = createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
    name: 'Loyer',
    amount: 1500,
    kind: 'expense',
    recurrence: 'fixed',
  });

  function initialMock() {
    return createBudgetDetailsMock(budgetId, {
      budget: { rollover: 0 },
      budgetLines: [salaireLine, loyerLine],
    });
  }

  test('should create an expense budget line and display it in Depenses section', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    let hasCreated = false;

    const newExpenseLine = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: true,
    });

    // Mock budget details — returns updated data after creation
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = hasCreated
        ? createBudgetDetailsMock(budgetId, {
            budget: { rollover: 0 },
            budgetLines: [salaireLine, loyerLine, newExpenseLine],
          })
        : initialMock();

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Mock POST budget-lines
    await authenticatedPage.route('**/api/v1/budget-lines', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createBudgetLineResponseMock(newExpenseLine)),
        });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    // Click "Ajouter une enveloppe"
    await authenticatedPage
      .getByTestId('add-budget-line')
      .click();

    // Wait for the dialog to appear
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Fill form: name
    const nameInput = authenticatedPage.locator('[data-testid="new-line-name"]');
    await nameInput.fill('Courses');

    // Fill form: amount
    const amountInput = authenticatedPage.locator('[data-testid="new-line-amount"]');
    await amountInput.fill('500');

    // Kind defaults to "expense" — no change needed

    // Submit
    await authenticatedPage.getByTestId('add-new-line').click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();

    // The new line should appear — verify envelope card is visible
    await expect(
      authenticatedPage.locator(`[data-testid="envelope-card-${TEST_UUIDS.LINE_3}"]`),
    ).toBeVisible();

    // Verify it appears in the Depenses section
    const depensesSection = authenticatedPage
      .locator('pulpe-budget-grid-section')
      .filter({ hasText: 'Dépenses' });
    await expect(depensesSection).toContainText('Courses');
  });

  test('should create an income budget line and display it in Revenus section', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    let hasCreated = false;

    const newIncomeLine = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
      name: 'Freelance',
      amount: 1000,
      kind: 'income',
      recurrence: 'one_off',
      isManuallyAdjusted: true,
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = hasCreated
        ? createBudgetDetailsMock(budgetId, {
            budget: { rollover: 0 },
            budgetLines: [salaireLine, loyerLine, newIncomeLine],
          })
        : initialMock();

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await authenticatedPage.route('**/api/v1/budget-lines', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createBudgetLineResponseMock(newIncomeLine)),
        });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    await authenticatedPage.getByTestId('add-budget-line').click();

    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    // Fill form
    await authenticatedPage.locator('[data-testid="new-line-name"]').fill('Freelance');
    await authenticatedPage.locator('[data-testid="new-line-amount"]').fill('1000');

    // Change kind to income via mat-select
    await authenticatedPage.locator('[data-testid="new-line-kind"]').click();
    await authenticatedPage.locator('mat-option[value="income"]').click();

    // Submit
    await authenticatedPage.getByTestId('add-new-line').click();
    await expect(dialog).not.toBeVisible();

    // Verify it appears in the Revenus section
    const revenusSection = authenticatedPage
      .locator('pulpe-budget-grid-section')
      .filter({ hasText: 'Revenus' });
    await expect(revenusSection).toContainText('Freelance');
  });

  test('should create a saving budget line and display it in Epargnes section', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    let hasCreated = false;

    const newSavingLine = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
      name: 'Vacances',
      amount: 300,
      kind: 'saving',
      recurrence: 'one_off',
      isManuallyAdjusted: true,
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = hasCreated
        ? createBudgetDetailsMock(budgetId, {
            budget: { rollover: 0 },
            budgetLines: [salaireLine, loyerLine, newSavingLine],
          })
        : initialMock();

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await authenticatedPage.route('**/api/v1/budget-lines', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createBudgetLineResponseMock(newSavingLine)),
        });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    await authenticatedPage.getByTestId('add-budget-line').click();

    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    await authenticatedPage.locator('[data-testid="new-line-name"]').fill('Vacances');
    await authenticatedPage.locator('[data-testid="new-line-amount"]').fill('300');

    // Change kind to saving
    await authenticatedPage.locator('[data-testid="new-line-kind"]').click();
    await authenticatedPage.locator('mat-option[value="saving"]').click();

    await authenticatedPage.getByTestId('add-new-line').click();
    await expect(dialog).not.toBeVisible();

    // Verify it appears in the Epargnes section
    const epargnesSection = authenticatedPage
      .locator('pulpe-budget-grid-section')
      .filter({ hasText: /Épargnes/ });
    await expect(epargnesSection).toContainText('Vacances');
  });

  test('should send correct POST payload when creating a budget line', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    let postPayload: unknown = null;

    const newLine = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
      name: 'Transport',
      amount: 200,
      kind: 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: true,
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(initialMock()),
      });
    });

    await authenticatedPage.route('**/api/v1/budget-lines', (route) => {
      if (route.request().method() === 'POST') {
        postPayload = route.request().postDataJSON();
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createBudgetLineResponseMock(newLine)),
        });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    await authenticatedPage.getByTestId('add-budget-line').click();
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    await authenticatedPage.locator('[data-testid="new-line-name"]').fill('Transport');
    await authenticatedPage.locator('[data-testid="new-line-amount"]').fill('200');

    await authenticatedPage.getByTestId('add-new-line').click();
    await expect(dialog).not.toBeVisible();

    // Verify POST payload
    expect(postPayload).toBeDefined();
    expect(postPayload).toHaveProperty('name', 'Transport');
    expect(postPayload).toHaveProperty('amount', 200);
    expect(postPayload).toHaveProperty('kind', 'expense');
    expect(postPayload).toHaveProperty('budgetId', budgetId);
    expect(postPayload).toHaveProperty('isManuallyAdjusted', true);
  });

  test('submit button should be disabled when required fields are empty', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(initialMock()),
      });
    });

    await budgetDetailsPage.goto(budgetId);

    await authenticatedPage.getByTestId('add-budget-line').click();
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    const submitButton = authenticatedPage.getByTestId('add-new-line');

    // Initially disabled — name and amount are empty
    await expect(submitButton).toBeDisabled();

    // Fill only name — still disabled (amount missing)
    await authenticatedPage.locator('[data-testid="new-line-name"]').fill('Test');
    await expect(submitButton).toBeDisabled();

    // Fill amount — now enabled
    await authenticatedPage.locator('[data-testid="new-line-amount"]').fill('100');
    await expect(submitButton).toBeEnabled();

    // Clear name — disabled again
    await authenticatedPage.locator('[data-testid="new-line-name"]').clear();
    await expect(submitButton).toBeDisabled();
  });

  test('totals should recalculate after adding an expense line', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    let hasCreated = false;

    const newExpenseLine = createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
      name: 'Courses',
      amount: 500,
      kind: 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: true,
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      const response = hasCreated
        ? createBudgetDetailsMock(budgetId, {
            budget: { rollover: 0 },
            budgetLines: [salaireLine, loyerLine, newExpenseLine],
          })
        : initialMock();

      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await authenticatedPage.route('**/api/v1/budget-lines', (route) => {
      if (route.request().method() === 'POST') {
        hasCreated = true;
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(createBudgetLineResponseMock(newExpenseLine)),
        });
      } else {
        void route.fallback();
      }
    });

    await budgetDetailsPage.goto(budgetId);

    // Before creation: income=5000, expenses=1500, remaining=3500
    // Verify initial expenses in financial overview
    const financialOverview = authenticatedPage.locator('pulpe-budget-financial-overview');
    await expect(financialOverview).toContainText("1\u2019500");

    // Click add and fill form
    await authenticatedPage.getByTestId('add-budget-line').click();
    const dialog = authenticatedPage.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();

    await authenticatedPage.locator('[data-testid="new-line-name"]').fill('Courses');
    await authenticatedPage.locator('[data-testid="new-line-amount"]').fill('500');
    await authenticatedPage.getByTestId('add-new-line').click();
    await expect(dialog).not.toBeVisible();

    // After creation: income=5000, expenses=1500+500=2000, remaining=3000
    // Expenses total should now show 2000
    await expect(financialOverview).toContainText("2\u2019000");

    // Remaining should show 3000
    await expect(
      financialOverview.locator('.text-display-medium, .text-display-large'),
    ).toContainText('3 000');
  });
});
