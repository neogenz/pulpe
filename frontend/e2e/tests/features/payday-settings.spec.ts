import { test, expect } from '../../fixtures/test-fixtures';
import {
  createBudgetDetailsMock,
  createBudgetLineMock,
  TEST_UUIDS,
} from '../../helpers/api-mocks';

test.describe('Pay Day Settings', () => {
  test('should load settings page with initial payDay value', async ({
    authenticatedPage,
    settingsPage,
  }) => {
    // Arrange: Mock settings API with null payDay (default)
    await authenticatedPage.route('**/api/v1/users/settings', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { payDayOfMonth: null },
          }),
        });
      }
      return route.fallback();
    });

    // Act
    await settingsPage.goto();

    // Assert
    await settingsPage.expectPageLoaded();
    await settingsPage.expectPayDaySelected(null);
    await settingsPage.expectHintContains('calendrier standard');
  });

  test('should update hint when selecting a custom pay day', async ({
    authenticatedPage,
    settingsPage,
  }) => {
    // Arrange
    await authenticatedPage.route('**/api/v1/users/settings', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { payDayOfMonth: null },
          }),
        });
      }
      return route.fallback();
    });

    await settingsPage.goto();

    // Act: Select day 27
    await settingsPage.selectPayDay(27);

    // Assert: Hint should update and save button should appear
    await settingsPage.expectHintContains('commence le 27');
    await settingsPage.expectSaveButtonVisible();
  });

  test('should save pay day and show success message', async ({
    authenticatedPage,
    settingsPage,
  }) => {
    // Arrange: Track API calls
    let savedPayDay: number | null = null;

    await authenticatedPage.route('**/api/v1/users/settings', (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { payDayOfMonth: savedPayDay },
          }),
        });
      }

      if (method === 'PUT') {
        const body = route.request().postDataJSON();
        savedPayDay = body.payDayOfMonth;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: body,
          }),
        });
      }

      return route.fallback();
    });

    await settingsPage.goto();

    // Act: Select day 27 and save
    await settingsPage.selectPayDay(27);
    await settingsPage.saveSettings();

    // Assert
    await settingsPage.expectSuccessMessage();
    expect(savedPayDay).toBe(27);
  });

  test('should cancel changes and restore original value', async ({
    authenticatedPage,
    settingsPage,
  }) => {
    // Arrange
    await authenticatedPage.route('**/api/v1/users/settings', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { payDayOfMonth: 15 },
          }),
        });
      }
      return route.fallback();
    });

    await settingsPage.goto();
    await settingsPage.expectPayDaySelected(15);

    // Act: Change to 27, then cancel
    await settingsPage.selectPayDay(27);
    await settingsPage.expectPayDaySelected(27);
    await settingsPage.cancelChanges();

    // Assert: Should restore to 15
    await settingsPage.expectPayDaySelected(15);
    await settingsPage.expectSaveButtonHidden();
  });

  test('should display period on budget details when payDay is configured', async ({
    authenticatedPage,
    settingsPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Arrange: Mock settings with payDay=27
    await authenticatedPage.route('**/api/v1/users/settings', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { payDayOfMonth: 27 },
        }),
      });
    });

    // Mock budget details for January 2025
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 1,
        year: 2025,
      },
      budgetLines: [
        createBudgetLineMock(TEST_UUIDS.LINE_1, budgetId, {
          name: 'Salaire',
          amount: 3000,
          kind: 'income',
        }),
      ],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Act: Navigate to budget details
    await budgetDetailsPage.goto(budgetId);

    // Assert: Period should be displayed (27 déc - 26 jan for January with payDay=27)
    const periodDisplay = authenticatedPage.getByTestId(
      'budget-period-display',
    );
    await expect(periodDisplay).toBeVisible();
    await expect(periodDisplay).toContainText('déc');
    await expect(periodDisplay).toContainText('jan');
  });

  test('should NOT display period when payDay is null (standard calendar)', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    const budgetId = TEST_UUIDS.BUDGET_1;

    // Arrange: Mock settings with payDay=null (standard calendar)
    await authenticatedPage.route('**/api/v1/users/settings', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { payDayOfMonth: null },
        }),
      });
    });

    // Mock budget details
    const mockResponse = createBudgetDetailsMock(budgetId, {
      budget: {
        month: 1,
        year: 2025,
      },
      budgetLines: [],
    });

    await authenticatedPage.route('**/api/v1/budgets/*/details', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      });
    });

    // Act: Navigate to budget details
    await budgetDetailsPage.goto(budgetId);

    // Assert: Period should NOT be displayed
    const periodDisplay = authenticatedPage.getByTestId(
      'budget-period-display',
    );
    await expect(periodDisplay).not.toBeVisible();
  });
});
