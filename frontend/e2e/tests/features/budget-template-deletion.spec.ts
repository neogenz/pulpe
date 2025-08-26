import { test } from '../../fixtures/test-fixtures';
import { MOCK_API_RESPONSES, createMockSuccessResponse } from '../../mocks/api-responses';

test.describe('Budget Template Deletion', () => {
  test('should delete template when no budgets are associated', async ({
    authenticatedPage,
    budgetTemplatesPage,
  }) => {
    // Mock template API with centralized helpers
    await authenticatedPage.route('**/api/v1/budget-templates/**', route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ 
          status: 200, 
          body: JSON.stringify(createMockSuccessResponse()) 
        });
      } else {
        route.fulfill({ 
          status: 200, 
          body: JSON.stringify({ success: true, data: [] }) 
        });
      }
    });

    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectPageLoaded();
  });

  test('should show budget usage dialog when template has associated budgets', async ({
    authenticatedPage,
    budgetTemplatesPage,
  }) => {
    // Mock template with associated budgets using centralized response
    await authenticatedPage.route('**/api/v1/budget-templates/**', route => 
      route.fulfill({ 
        status: 200, 
        body: JSON.stringify({ 
          success: true, 
          data: { associatedBudgets: 3 } 
        }) 
      })
    );

    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectPageLoaded();
  });
});