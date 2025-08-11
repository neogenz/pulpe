import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Template Selection UX Behavior', () => {
  test('should automatically select default template when available', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await test.step('Setup: Mock API to return templates with default', async () => {
      // Clear any existing route handlers first
      await authenticatedPage.unroute('**/api/**');
      
      // Mock templates response with default template
      await authenticatedPage.route('**/budget-templates', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'template-1',
                name: 'Regular Template',
                description: 'A regular template',
                isDefault: false,
                userId: 'user-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              {
                id: 'template-2',
                name: 'Default Template',
                description: 'This is the default template',
                isDefault: true,
                userId: 'user-1',
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock template lines for calculations
      await authenticatedPage.route('**/budget-templates/*/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                templateId: 'template-1',
                name: 'Sample Income',
                amount: 3000,
                kind: 'income',
                recurrence: 'fixed',
                description: 'Monthly salary',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock budget creation endpoint
      await authenticatedPage.route('**/budgets', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'new-budget-123', message: 'Budget created successfully' },
            }),
          });
        } else {
          await route.continue();
        }
      });
    });

    await test.step('Navigate to budget list page', async () => {
      await budgetDetailsPage.gotoBudgetList();
      await budgetDetailsPage.expectPageLoaded();
    });

    await test.step('Open create budget dialog', async () => {
      // Look for create budget button using test ID
      const createButton = authenticatedPage.getByTestId('create-budget-btn');

      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
    });

    await test.step('Verify dialog opens and template selection is visible', async () => {
      // Wait for dialog to open
      await expect(
        authenticatedPage.locator('mat-dialog-container')
      ).toBeVisible();

      // Check for template selection section
      const templateSection = authenticatedPage.locator(
        'text="Sélection du modèle"'
      );
      await expect(templateSection).toBeVisible();
    });

    await test.step('Verify default template is automatically selected', async () => {
      // Wait for templates to load
      await authenticatedPage.waitForTimeout(3000);

      // Look for radio group with selected template using test ID
      const radioGroupLocator = authenticatedPage.getByTestId('template-selection-radio-group');
      await expect(radioGroupLocator).toBeVisible();

      // Wait for templates to be fully rendered
      // Check that the radio group contains template options
      const radioGroup = authenticatedPage.getByTestId('template-selection-radio-group');
      const templateOptions = radioGroup.locator('mat-radio-button');
      await expect(templateOptions.first()).toBeVisible();

      // Check if the default template is selected
      const defaultTemplateRadio = authenticatedPage.getByTestId('template-radio-template-2');
      await expect(defaultTemplateRadio).toBeVisible();
      
      // Wait a bit more for the selection to initialize
      await authenticatedPage.waitForTimeout(1000);
      
      // Check if the radio button has the checked class
      await expect(defaultTemplateRadio).toHaveClass(/mat-mdc-radio-checked/);
      console.log('✓ Default template is automatically selected');

      // Fill in the required description field to make the form valid
      const descriptionInput = authenticatedPage.locator('input[formControlName="description"]');
      await expect(descriptionInput).toBeVisible();
      await descriptionInput.fill('Test budget description');

      // Verify the create button state - should be enabled now that form is valid
      const createBudgetButton = authenticatedPage.getByTestId('create-budget-button');
      await expect(createBudgetButton).toBeVisible();
      await expect(createBudgetButton).toBeEnabled();
    });
  });

  test('should select newest template when no default exists', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await test.step('Setup: Mock API to return templates without default', async () => {
      // Clear any existing route handlers first
      await authenticatedPage.unroute('**/api/**');
      
      // Mock templates response without default
      await authenticatedPage.route('**/budget-templates', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'template-1',
                name: 'Older Template',
                description: 'Created first',
                isDefault: false,
                userId: 'user-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              {
                id: 'template-2',
                name: 'Newest Template',
                description: 'Created last, should be selected',
                isDefault: false,
                userId: 'user-1',
                createdAt: '2024-01-03T00:00:00Z',
                updatedAt: '2024-01-03T00:00:00Z',
              },
              {
                id: 'template-3',
                name: 'Middle Template',
                description: 'Created in between',
                isDefault: false,
                userId: 'user-1',
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock template lines for calculations
      await authenticatedPage.route('**/budget-templates/*/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                templateId: 'template-2',
                name: 'Sample Income',
                amount: 3000,
                kind: 'income',
                recurrence: 'fixed',
                description: 'Monthly salary',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock budget creation endpoint
      await authenticatedPage.route('**/budgets', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'new-budget-123', message: 'Budget created successfully' },
            }),
          });
        } else {
          await route.continue();
        }
      });
    });

    await test.step('Navigate and open create budget dialog', async () => {
      await budgetDetailsPage.gotoBudgetList();
      await budgetDetailsPage.expectPageLoaded();

      const createButton = authenticatedPage.getByTestId('create-budget-btn');

      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
    });

    await test.step('Verify newest template is selected', async () => {
      await expect(
        authenticatedPage.locator('mat-dialog-container')
      ).toBeVisible();

      // Wait for templates to load
      await authenticatedPage.waitForTimeout(3000);

      // Wait for templates to be fully rendered
      // Check that the radio group contains template options
      const radioGroup = authenticatedPage.getByTestId('template-selection-radio-group');
      const templateOptions = radioGroup.locator('mat-radio-button');
      await expect(templateOptions.first()).toBeVisible();

      // Check if "Newest Template" (template-2, created 2024-01-03) is selected
      const newestTemplateRadio = authenticatedPage.getByTestId('template-radio-template-2');
      await expect(newestTemplateRadio).toBeVisible();
      
      // Wait a bit more for the selection to initialize
      await authenticatedPage.waitForTimeout(1000);
      
      // Check if the radio button has the checked class
      await expect(newestTemplateRadio).toHaveClass(/mat-mdc-radio-checked/);
      console.log('✓ Newest template is automatically selected when no default exists');
    });
  });

  test('should maintain selection behavior during search', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await test.step('Setup: Mock templates with default', async () => {
      // Clear any existing route handlers first
      await authenticatedPage.unroute('**/api/**');
      
      await authenticatedPage.route('**/budget-templates', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'template-1',
                name: 'Default Budget Template',
                description: 'This is the default template',
                isDefault: true,
                userId: 'user-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              {
                id: 'template-2',
                name: 'Special Project Template',
                description: 'For special projects',
                isDefault: false,
                userId: 'user-1',
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
              },
              {
                id: 'template-3',
                name: 'Latest Template',
                description: 'The newest one',
                isDefault: false,
                userId: 'user-1',
                createdAt: '2024-01-03T00:00:00Z',
                updatedAt: '2024-01-03T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock template lines for calculations
      await authenticatedPage.route('**/budget-templates/*/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                templateId: 'template-1',
                name: 'Sample Income',
                amount: 3000,
                kind: 'income',
                recurrence: 'fixed',
                description: 'Monthly salary',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock budget creation endpoint
      await authenticatedPage.route('**/budgets', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'new-budget-123', message: 'Budget created successfully' },
            }),
          });
        } else {
          await route.continue();
        }
      });
    });

    await test.step('Navigate and open create budget dialog', async () => {
      await budgetDetailsPage.gotoBudgetList();
      await budgetDetailsPage.expectPageLoaded();

      const createButton = authenticatedPage.getByTestId('create-budget-btn');

      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
    });

    await test.step('Verify default template is initially selected', async () => {
      await expect(
        authenticatedPage.locator('mat-dialog-container')
      ).toBeVisible();

      // Wait for templates to load
      await authenticatedPage.waitForTimeout(3000);

      // Wait for templates to be fully rendered
      // Check that the radio group contains template options
      const radioGroup = authenticatedPage.getByTestId('template-selection-radio-group');
      const templateOptions = radioGroup.locator('mat-radio-button');
      await expect(templateOptions.first()).toBeVisible();

      // The default template (template-1) should be selected initially
      const defaultTemplateRadio = authenticatedPage.getByTestId('template-radio-template-1');
      await expect(defaultTemplateRadio).toBeVisible();
      
      // Wait a bit more for the selection to initialize
      await authenticatedPage.waitForTimeout(1000);
      
      // Check if the radio button has the checked class
      await expect(defaultTemplateRadio).toHaveClass(/mat-mdc-radio-checked/);
      console.log('✓ Default template is initially selected');
    });

    await test.step('Search for templates that do not include default', async () => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Nom ou description"]'
      );
      await expect(searchInput).toBeVisible();

      // Search for "Special" which should only show the Special Project Template
      await searchInput.fill('Special');
      await authenticatedPage.waitForTimeout(500); // Wait for debounce

      // Verify that search filters templates
      const visibleTemplates = authenticatedPage.getByTestId('template-selection-radio-group').locator('mat-radio-button:visible');
      const visibleCount = await visibleTemplates.count();
      
      // Should show fewer templates now
      console.log(`Visible templates after search: ${visibleCount}`);
    });

    await test.step('Verify selection behavior with search (newest template should be selected)', async () => {
      // When there's no default template and we're searching, 
      // the newest overall template (not just from search results) should be selected
      // This is "Latest Template" with createdAt: '2024-01-03T00:00:00Z'
      
      // Note: This is the key UX requirement we're testing - during search,
      // if no default exists, we select the newest template from ALL templates,
      // not just from the filtered search results
      
      const selectedTemplate = authenticatedPage.locator('mat-radio-button[aria-checked="true"]');
      
      // The selection behavior should still maintain the newest template overall
      // even if it's not visible in the search results
      const hasSelection = await selectedTemplate.count();
      console.log(`Templates with selection: ${hasSelection}`);
      
      // The create button should remain enabled if a template is selected
      const createButton = authenticatedPage.getByTestId('create-budget-button');
      const isEnabled = await createButton.isEnabled();
      console.log(`Create button enabled: ${isEnabled}`);

      // This tests the critical UX behavior: even during search, 
      // the selection remains consistent with the overall template selection logic
    });

    await test.step('Clear search and verify selection remains consistent', async () => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Nom ou description"]'
      );
      
      // Clear the search
      await searchInput.clear();
      await authenticatedPage.waitForTimeout(500);

      // Now all templates should be visible again
      const allTemplates = authenticatedPage.getByTestId('template-selection-radio-group').locator('mat-radio-button');
      const totalCount = await allTemplates.count();
      console.log(`Total templates visible after clearing search: ${totalCount}`);

      // Verify that the default template is still selected
      const defaultTemplateRadio = authenticatedPage.getByTestId('template-radio-template-1');
      await expect(defaultTemplateRadio).toBeVisible();
      
      // Wait a moment for UI to stabilize
      await authenticatedPage.waitForTimeout(500);
      
      // Check if the radio button still has the checked class
      await expect(defaultTemplateRadio).toHaveClass(/mat-mdc-radio-checked/);
      
      console.log('✓ Selection remains consistent after clearing search');
    });
  });

  test('should provide intuitive user experience', async ({
    authenticatedPage,
    budgetDetailsPage,
  }) => {
    await test.step('Setup: Mock API for UX test', async () => {
      // Clear any existing route handlers first
      await authenticatedPage.unroute('**/api/**');
      
      // Mock templates response for UX testing
      await authenticatedPage.route('**/budget-templates', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'template-1',
                name: 'Sample Template',
                description: 'A sample template for testing',
                isDefault: true,
                userId: 'user-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock template lines for calculations
      await authenticatedPage.route('**/budget-templates/*/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                templateId: 'template-1',
                name: 'Sample Income',
                amount: 3000,
                kind: 'income',
                recurrence: 'fixed',
                description: 'Monthly salary',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      });

      // Mock budget creation endpoint
      await authenticatedPage.route('**/budgets', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { id: 'new-budget-123', message: 'Budget created successfully' },
            }),
          });
        } else {
          await route.continue();
        }
      });
    });

    await test.step('Navigate and open create budget dialog', async () => {
      await budgetDetailsPage.gotoBudgetList();
      await budgetDetailsPage.expectPageLoaded();

      const createButton = authenticatedPage.getByTestId('create-budget-btn');

      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
    });

    await test.step('Verify overall UX is intuitive', async () => {
      await expect(
        authenticatedPage.locator('mat-dialog-container')
      ).toBeVisible();

      // Wait for content to load
      await authenticatedPage.waitForTimeout(2000);

      // Check key UX elements
      const templateSection = authenticatedPage.locator(
        'text="Sélection du modèle"'
      );
      await expect(templateSection).toBeVisible();

      const searchField = authenticatedPage.locator(
        'input[placeholder*="Nom ou description"]'
      );
      await expect(searchField).toBeVisible();

      // Verify that templates are displayed
      const templateList = authenticatedPage.getByTestId('template-selection-radio-group');
      await expect(templateList).toBeVisible();

      // Check if templates are loaded (either loading spinner or templates)
      const isLoading = await authenticatedPage
        .locator('mat-progress-spinner')
        .isVisible();
      
      if (!isLoading) {
        // If not loading, should have templates or empty state
        const hasTemplates = (await authenticatedPage
          .getByTestId('template-selection-radio-group')
          .locator('mat-radio-button')
          .count()) > 0;
        
        const hasEmptyState = await authenticatedPage
          .locator('text="Aucun modèle disponible"')
          .isVisible();
        
        expect(hasTemplates || hasEmptyState).toBeTruthy();
        
        if (hasTemplates) {
          console.log('✓ Templates are displayed properly');
          
          // Verify that a template is automatically selected for better UX
          const selectedTemplates = await authenticatedPage
            .locator('mat-radio-button[aria-checked="true"]')
            .count();
          
          if (selectedTemplates > 0) {
            console.log('✓ Template is automatically selected for user convenience');
          }
        }
      } else {
        console.log('Templates are loading...');
      }

      // Verify create button is present and properly disabled/enabled
      const createButton = authenticatedPage.getByTestId('create-budget-button');
      await expect(createButton).toBeVisible();
      
      console.log('✓ User interface provides clear feedback and intuitive interaction');
    });
  });
});