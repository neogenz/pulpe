import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Template Management', () => {
  test('should create and navigate to template', async ({
    authenticatedPage,
    budgetTemplatesPage,
  }) => {
    // Mock templates API with inline data
    await authenticatedPage.route('**/api/v1/budget-templates**', route => 
      route.fulfill({ 
        status: 200, 
        body: JSON.stringify({ 
          success: true, 
          data: [{ 
            id: 'test-template',
            name: 'Template Test',
            description: 'Test template'
          }] 
        }) 
      })
    );

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
    // Mock with inline data
    await authenticatedPage.route('**/api/v1/budget-templates**', route => 
      route.fulfill({ 
        status: 200, 
        body: JSON.stringify({ 
          success: true, 
          data: [{ 
            id: 'test-template',
            name: 'Template Test',
            description: 'Test template'
          }] 
        }) 
      })
    );

    // Mock template details endpoint
    await authenticatedPage.route('**/api/v1/budget-templates/test-template/details', route => 
      route.fulfill({ 
        status: 200, 
        body: JSON.stringify({ 
          success: true, 
          data: {
            id: 'test-template',
            name: 'Template Test',
            description: 'Test template',
            isDefault: false,
            lines: []
          }
        }) 
      })
    );

    await budgetTemplatesPage.goto();
    await budgetTemplatesPage.expectTemplateVisible('Template Test');
    await budgetTemplatesPage.navigateToTemplateDetails('Template Test');
    
    // Wait for navigation to complete
    await authenticatedPage.waitForURL('**/budget-templates/details/**');
    expect(authenticatedPage.url()).toContain('/budget-templates/details/');
  });
});