import { test, expect } from '../../fixtures/test-fixtures';
import { TEST_CONFIG } from '../../config/test-config';
import { TEST_UUIDS } from '../../helpers/api-mocks';

test.describe('Budget Template Management', () => {
  test('should create and navigate to template', async ({
    authenticatedPage,
    budgetTemplatesPage,
  }) => {
    // Mock templates API with schema-valid payloads
    await authenticatedPage.route('**/api/v1/budget-templates**', (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'POST') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              template: TEST_CONFIG.TEMPLATES.DEFAULT,
              lines: [],
            },
          }),
        });
      }

      if (url.match(/\/budget-templates\/[^/]+$/)) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: TEST_CONFIG.TEMPLATES.DEFAULT,
          }),
        });
      }

      if (url.match(/\/budget-templates\/[^/]+\/lines$/)) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: [],
          }),
        });
      }

      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: [TEST_CONFIG.TEMPLATES.DEFAULT],
        }),
      });
    });

    // Navigate and create template
    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectPageLoaded();
    await budgetTemplatesPage.clickCreateTemplate();
    await budgetTemplatesPage.fillTemplateName('New Template');
    await budgetTemplatesPage.submitForm();
    
    // Verify creation success (no error)
    expect(authenticatedPage.url()).not.toContain('/error');
  });

  test('should navigate to template details', async ({
    authenticatedPage,
    budgetTemplatesPage,
  }) => {
    await authenticatedPage.route('**/api/v1/budget-templates**', (route) => {
      const url = route.request().url();

      if (url.match(/\/budget-templates\/[^/]+\/lines$/)) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: TEST_UUIDS.LINE_1,
                templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
                name: 'Salaire',
                amount: 5000,
                kind: 'income',
                recurrence: 'fixed',
                description: '',
                createdAt: TEST_CONFIG.TEMPLATES.DEFAULT.createdAt,
                updatedAt: TEST_CONFIG.TEMPLATES.DEFAULT.updatedAt,
              },
            ],
          }),
        });
      }

      if (url.match(/\/budget-templates\/[^/]+$/)) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: TEST_CONFIG.TEMPLATES.DEFAULT,
          }),
        });
      }

      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: [TEST_CONFIG.TEMPLATES.DEFAULT],
        }),
      });
    });

    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectTemplateVisible(
      TEST_CONFIG.TEMPLATES.DEFAULT.name,
    );
    await budgetTemplatesPage.navigateToTemplateDetails(
      TEST_CONFIG.TEMPLATES.DEFAULT.name,
    );
    
    // Wait for navigation to complete
    await authenticatedPage.waitForURL('**/budget-templates/details/**');
    expect(authenticatedPage.url()).toContain('/budget-templates/details/');
  });
});
