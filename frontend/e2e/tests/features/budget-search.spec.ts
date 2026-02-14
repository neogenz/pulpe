import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  createTransactionMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

/**
 * E2E Tests for Budget Search
 *
 * Scenario 5.14: Local search in budget details
 * - Instant client-side filtering by name or amount
 * - Accent-insensitive and case-insensitive
 * - Combines with checked/unchecked filter
 * - Shows "Contient" annotation when transaction matches
 *
 * Scenario 5.15: Global search across budgets
 * - Minimum 2 chars before search triggers
 * - Results with period, name, amount columns
 * - Click navigates to budget
 */

// ── 5.14: Local Search in Budget Details ──

test.describe('Local Search in Budget Details', () => {
  const budgetId = TEST_UUIDS.BUDGET_1;

  const mockResponse = createBudgetDetailsMock(budgetId, {
    budget: { rollover: 0 },
    budgetLines: [
      createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
        name: 'Salaire',
        amount: 5000,
        kind: 'income',
        checkedAt: '2025-01-15T00:00:00Z',
      }),
      createBudgetLineMock(TEST_UUIDS.LINE_2, budgetId, {
        name: 'Courses',
        amount: 500,
        kind: 'expense',
        checkedAt: null,
      }),
      createBudgetLineMock(TEST_UUIDS.LINE_3, budgetId, {
        name: 'Épargne',
        amount: 300,
        kind: 'saving',
        checkedAt: null,
      }),
      createBudgetLineMock(TEST_UUIDS.LINE_4, budgetId, {
        name: 'Transport',
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
      }),
      createTransactionMock(TEST_UUIDS.TRANSACTION_2, budgetId, {
        name: 'Café',
        amount: 50,
        kind: 'expense',
        budgetLineId: null,
      }),
    ],
  });

  function setupBudgetDetailsMock(page: import('@playwright/test').Page) {
    return page.route('**/api/v1/budgets/*/details', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });
  }

  test('should filter by budget line name', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupBudgetDetailsMock(authenticatedPage);
    await budgetDetailsPage.goto(budgetId);

    const searchInput = authenticatedPage.getByPlaceholder(
      'Rechercher une prévision...',
    );
    await searchInput.fill('Courses');

    // "Courses" envelope should be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();

    // Other envelopes should not be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeHidden();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_4}`),
    ).toBeHidden();
  });

  test('should filter by amount', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupBudgetDetailsMock(authenticatedPage);
    await budgetDetailsPage.goto(budgetId);

    const searchInput = authenticatedPage.getByPlaceholder(
      'Rechercher une prévision...',
    );
    await searchInput.fill('500');

    // "Courses" (amount 500) should be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();

    // "Transport" (amount 200) should not be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_4}`),
    ).toBeHidden();
  });

  test('should be accent-insensitive', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupBudgetDetailsMock(authenticatedPage);
    await budgetDetailsPage.goto(budgetId);

    const searchInput = authenticatedPage.getByPlaceholder(
      'Rechercher une prévision...',
    );
    await searchInput.fill('epargne');

    // "Épargne" should be visible despite searching without accent
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeVisible();

    // Others should not be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeHidden();
  });

  test('should restore all items when clearing search', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupBudgetDetailsMock(authenticatedPage);
    await budgetDetailsPage.goto(budgetId);

    const searchInput = authenticatedPage.getByPlaceholder(
      'Rechercher une prévision...',
    );
    await searchInput.fill('Courses');

    // Only "Courses" visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeHidden();

    // Click clear button
    await authenticatedPage
      .getByLabel('Effacer la recherche')
      .click();

    // All unchecked items should be visible again (default filter is "Non comptabilisees")
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_3}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_4}`),
    ).toBeVisible();
  });

  test('should combine search with unchecked filter', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupBudgetDetailsMock(authenticatedPage);
    await budgetDetailsPage.goto(budgetId);

    // Switch to "Toutes" to see all items including checked
    await authenticatedPage.getByTestId('all-items-filter-chip').click();

    // Salaire (checked) should now be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeVisible();

    // Search for "Salaire"
    const searchInput = authenticatedPage.getByPlaceholder(
      'Rechercher une prévision...',
    );
    await searchInput.fill('Salaire');

    // Only Salaire should be visible
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeHidden();

    // Switch back to "Non comptabilisees" - Salaire is checked, so it should disappear
    await authenticatedPage.getByTestId('unchecked-filter-chip').click();

    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_1}`),
    ).toBeHidden();
  });

  test('should show parent envelope when allocated transaction matches search', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await setupBudgetDetailsMock(authenticatedPage);
    await budgetDetailsPage.goto(budgetId);

    const searchInput = authenticatedPage.getByPlaceholder(
      'Rechercher une prévision...',
    );
    // Search for the allocated transaction name
    await searchInput.fill('Supermarché');

    // Parent envelope "Courses" should be visible (contains matching transaction)
    await expect(
      authenticatedPage.getByTestId(`envelope-card-${TEST_UUIDS.LINE_2}`),
    ).toBeVisible();

    // Should show "Contient" annotation
    await expect(
      authenticatedPage.getByText('Contient'),
    ).toBeVisible();
  });
});

// ── 5.15: Global Search Across Budgets ──

test.describe('Global Search Across Budgets', () => {
  test('should show minimum characters message initially', async ({
    authenticatedPage,
  }) => {
    // Navigate to budget list page
    await authenticatedPage.goto('/budget');

    // Open search dialog
    await authenticatedPage.getByTestId('search-transactions-btn').click();

    // Should show the dialog with min chars message
    await expect(
      authenticatedPage.getByText('Saisissez au moins 2 caractères'),
    ).toBeVisible();
  });

  test('should display search results with period, name, and amount', async ({
    authenticatedPage,
  }) => {
    const searchResults = {
      success: true,
      data: [
        {
          id: TEST_UUIDS.TRANSACTION_1,
          itemType: 'transaction',
          name: 'Loyer janvier',
          amount: 1800,
          kind: 'expense',
          recurrence: 'fixed',
          transactionDate: '2025-01-15T12:00:00Z',
          category: null,
          budgetId: TEST_UUIDS.BUDGET_1,
          budgetName: 'Budget Janvier',
          year: 2025,
          month: 1,
          monthLabel: 'Janvier',
        },
        {
          id: TEST_UUIDS.TRANSACTION_2,
          itemType: 'budget_line',
          name: 'Loyer mensuel',
          amount: 1800,
          kind: 'expense',
          recurrence: 'fixed',
          transactionDate: null,
          category: null,
          budgetId: TEST_UUIDS.BUDGET_2,
          budgetName: 'Budget Février',
          year: 2025,
          month: 2,
          monthLabel: 'Février',
        },
      ],
    };

    // Mock the search endpoint
    await authenticatedPage.route('**/api/v1/transactions/search*', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResults),
      });
    });

    await authenticatedPage.goto('/budget');
    await authenticatedPage.getByTestId('search-transactions-btn').click();

    // Type search query (>= 2 chars)
    const searchInput = authenticatedPage.getByTestId('search-input');
    await searchInput.fill('loyer');

    // Results table should appear
    const resultsTable = authenticatedPage.getByTestId('search-results-table');
    await expect(resultsTable).toBeVisible();

    // Verify first result has period, name, and amount
    await expect(resultsTable.getByText('2025 / Janvier')).toBeVisible();
    await expect(resultsTable.getByText('Loyer janvier')).toBeVisible();
    await expect(resultsTable.getByText('CHF')).toBeVisible();
  });

  test('should navigate to budget when clicking a result', async ({
    authenticatedPage,
  }) => {
    const targetBudgetId = TEST_UUIDS.BUDGET_1;

    const searchResults = {
      success: true,
      data: [
        {
          id: TEST_UUIDS.TRANSACTION_1,
          itemType: 'transaction',
          name: 'Loyer',
          amount: 1800,
          kind: 'expense',
          recurrence: 'fixed',
          transactionDate: '2025-01-15T12:00:00Z',
          category: null,
          budgetId: targetBudgetId,
          budgetName: 'Budget Janvier',
          year: 2025,
          month: 1,
          monthLabel: 'Janvier',
        },
      ],
    };

    await authenticatedPage.route('**/api/v1/transactions/search*', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResults),
      });
    });

    await authenticatedPage.goto('/budget');
    await authenticatedPage.getByTestId('search-transactions-btn').click();

    const searchInput = authenticatedPage.getByTestId('search-input');
    await searchInput.fill('Loyer');

    // Click the result row
    const resultsTable = authenticatedPage.getByTestId('search-results-table');
    await expect(resultsTable).toBeVisible();
    await resultsTable.getByText('Loyer').click();

    // Should navigate to the budget details page
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/budget/${targetBudgetId}`),
    );
  });

  test('should show empty results message', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/v1/transactions/search*', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await authenticatedPage.goto('/budget');
    await authenticatedPage.getByTestId('search-transactions-btn').click();

    const searchInput = authenticatedPage.getByTestId('search-input');
    await searchInput.fill('zzzzz');

    await expect(
      authenticatedPage.getByText('Pas de résultat'),
    ).toBeVisible();
  });
});
