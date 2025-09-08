import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Progress Bar Over Budget Warning', () => {
  test('should display warning message when over budget', async ({
    authenticatedPage,
  }) => {
    // Mock budget data with overspending scenario
    await authenticatedPage.route('**/api/v1/budgets/current**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            budget: {
              id: 'test-budget',
              month: 12,
              year: 2025,
              description: 'Test Budget',
              endingBalance: -500, // Negative balance
            },
            budgetLines: [
              {
                id: 'line-1',
                name: 'Salary',
                amount: 3000,
                kind: 'income',
                recurrence: 'fixed',
              },
              {
                id: 'line-2',
                name: 'Rent',
                amount: 1500,
                kind: 'expense',
                recurrence: 'fixed',
              },
            ],
            transactions: [
              {
                id: 'trans-1',
                name: 'Extra expense',
                amount: 2000,
                kind: 'expense',
                date: '2025-12-15',
              },
            ],
          },
        }),
      });
    });

    // Navigate to current month page where budget progress bar is displayed
    await authenticatedPage.goto('/app/current-month');
    
    // Wait for the budget progress bar to load
    await authenticatedPage.waitForSelector('pulpe-budget-progress-bar');
    
    // Check that the warning message is displayed
    const warningMessage = authenticatedPage.locator('text=Tu es en hors budget !');
    await expect(warningMessage).toBeVisible();
    
    // Check that the warning badge has the correct styling
    const warningBadge = authenticatedPage.locator('.bg-error-container');
    await expect(warningBadge).toBeVisible();
    
    // Check that the icon is displayed
    const warningIcon = authenticatedPage.locator('mat-icon.icon-filled');
    await expect(warningIcon).toBeVisible();
    await expect(warningIcon).toHaveText('report');
    
    // Check that the amount is shown in error color
    const amountDisplay = authenticatedPage.locator('.text-error');
    await expect(amountDisplay).toBeVisible();
    
    // Check that the amount shows the absolute value (positive number when over budget)
    // The displayed amount should be positive (the exceeded amount)
    await expect(amountDisplay).not.toContainText('-');
    
    // Check that the text says "dépassé sur" instead of "restant sur"
    const overBudgetText = authenticatedPage.locator('text=dépassé sur');
    await expect(overBudgetText).toBeVisible();
  });

  test('should show percentage above 100% when over budget', async ({
    authenticatedPage,
  }) => {
    // Mock with specific overspending amounts
    await authenticatedPage.route('**/api/v1/budgets/current**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            budget: {
              id: 'test-budget',
              month: 12,
              year: 2025,
              description: 'Test Budget',
              endingBalance: -1000,
            },
            budgetLines: [
              {
                id: 'line-1',
                name: 'Income',
                amount: 2000,
                kind: 'income',
                recurrence: 'fixed',
              },
            ],
            transactions: [
              {
                id: 'trans-1',
                name: 'Overspending',
                amount: 3000, // 150% of budget
                kind: 'expense',
                date: '2025-12-15',
              },
            ],
          },
        }),
      });
    });

    await authenticatedPage.goto('/app/current-month');
    await authenticatedPage.waitForSelector('pulpe-budget-progress-bar');
    
    // Check that percentage shows 150%
    const percentageText = authenticatedPage.locator('text=/150.*%.*budget/');
    await expect(percentageText).toBeVisible();
    
    // Progress bar should still be visible and use warn color
    const progressBar = authenticatedPage.locator('mat-progress-bar[color="warn"]');
    await expect(progressBar).toBeVisible();
  });

  test('should not display warning when within budget', async ({
    authenticatedPage,
  }) => {
    // Mock budget data with normal spending
    await authenticatedPage.route('**/api/v1/budgets/current**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            budget: {
              id: 'test-budget',
              month: 12,
              year: 2025,
              description: 'Test Budget',
              endingBalance: 500, // Positive balance
            },
            budgetLines: [
              {
                id: 'line-1',
                name: 'Salary',
                amount: 3000,
                kind: 'income',
                recurrence: 'fixed',
              },
              {
                id: 'line-2',
                name: 'Rent',
                amount: 1500,
                kind: 'expense',
                recurrence: 'fixed',
              },
            ],
            transactions: [
              {
                id: 'trans-1',
                name: 'Groceries',
                amount: 1000,
                kind: 'expense',
                date: '2025-12-15',
              },
            ],
          },
        }),
      });
    });

    await authenticatedPage.goto('/app/current-month');
    await authenticatedPage.waitForSelector('pulpe-budget-progress-bar');
    
    // Check that the warning message is NOT displayed
    const warningMessage = authenticatedPage.locator('text=Tu es en hors budget !');
    await expect(warningMessage).not.toBeVisible();
    
    // Check that the amount is shown in primary color (not error)
    const amountDisplay = authenticatedPage.locator('.text-primary');
    await expect(amountDisplay).toBeVisible();
    
    // Check that the text says "restant sur" not "dépassé sur"
    const remainingText = authenticatedPage.locator('text=restant sur');
    await expect(remainingText).toBeVisible();
    
    // Progress bar should use primary color
    const progressBar = authenticatedPage.locator('mat-progress-bar[color="primary"]');
    await expect(progressBar).toBeVisible();
  });
});