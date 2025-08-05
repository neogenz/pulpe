import { test, expect } from '../../fixtures/test-fixtures';
import { BudgetTemplatesPage } from '../../pages/budget-templates.page';

test.describe('Budget Template Deletion', () => {
  test.describe('Delete from Details Page', () => {
    test('should delete template when no budgets are associated', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // First create a template to delete
      const templateName = `Delete Test ${Date.now()}`;
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.clickCreateTemplate();
      
      // Try to create template if form is available
      const hasForm = (await authenticatedPage.locator('form, input').count()) > 0;
      if (hasForm) {
        await budgetTemplatesPage.fillTemplateName(templateName);
        await budgetTemplatesPage.submitForm();
        
        // Wait for navigation back to list
        await authenticatedPage.waitForURL('**/budget-templates');
      }
      
      // Navigate to the template details
      await authenticatedPage.locator(`text="${templateName}"`).first().click();
      await authenticatedPage.waitForLoadState('networkidle');
      
      // Click on menu and delete
      await authenticatedPage.locator('[aria-label*="Options"]').click();
      await authenticatedPage.locator('button:has-text("Supprimer")').click();
      
      // Confirm deletion in dialog
      await authenticatedPage.locator('mat-dialog-container').waitFor();
      await authenticatedPage.locator('button:has-text("Supprimer")').last().click();
      
      // Verify template is deleted
      await authenticatedPage.waitForURL('**/budget-templates');
      await expect(authenticatedPage.locator(`text="${templateName}"`)).toHaveCount(0);
      
      // Check success message
      const hasSuccessMessage = await authenticatedPage
        .locator('.mat-snack-bar, [data-testid="success-message"]')
        .isVisible();
      expect(hasSuccessMessage).toBeTruthy();
    });

    test('should show budget usage dialog when template has associated budgets', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock API to return template with associated budgets
      await authenticatedPage.route('**/api/v1/budget-templates/*/usage', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              isUsed: true,
              budgetCount: 3,
              budgets: [
                { id: '1', month: 1, year: 2025, description: 'Janvier 2025' },
                { id: '2', month: 2, year: 2025, description: 'Février 2025' },
                { id: '3', month: 3, year: 2025, description: 'Mars 2025' },
              ],
            },
          }),
        });
      });
      
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.gotoTemplate('test-template-id');
      
      // Click on menu and delete
      await authenticatedPage.locator('[aria-label*="Options"]').click();
      await authenticatedPage.locator('button:has-text("Supprimer")').click();
      
      // Verify usage dialog appears
      await authenticatedPage.locator('mat-dialog-container').waitFor();
      await expect(authenticatedPage.locator('h2:has-text("Suppression impossible")')).toBeVisible();
      
      // Verify budget list is shown
      await expect(authenticatedPage.locator('mat-card')).toHaveCount(3);
      await expect(authenticatedPage.locator('text="Janvier 2025"')).toBeVisible();
      
      // Close dialog
      await authenticatedPage.locator('button[matButton="filled"]:has-text("Compris")').click();
      await expect(authenticatedPage.locator('mat-dialog-container')).toHaveCount(0);
    });
  });

  test.describe('Delete from List View', () => {
    test('should delete template from card menu', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock API to return templates
      await authenticatedPage.route('**/api/v1/budget-templates', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'template-1',
                name: 'Template to Delete',
                description: 'Test template',
                isDefault: false,
              },
            ],
          }),
        });
      });
      
      // Mock usage check to return no budgets
      await authenticatedPage.route('**/api/v1/budget-templates/*/usage', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              isUsed: false,
              budgetCount: 0,
              budgets: [],
            },
          }),
        });
      });
      
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.expectTemplatesListVisible();
      
      // Click menu on template card
      await authenticatedPage.locator('mat-card').first().locator('[aria-label*="Options"]').click();
      await authenticatedPage.locator('button:has-text("Supprimer")').click();
      
      // Confirm deletion
      await authenticatedPage.locator('mat-dialog-container').waitFor();
      await authenticatedPage.locator('button:has-text("Supprimer")').last().click();
      
      // Verify success message
      const hasSuccessMessage = await authenticatedPage
        .locator('.mat-snack-bar')
        .isVisible();
      expect(hasSuccessMessage).toBeTruthy();
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state after deleting last template', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock API to return empty templates after deletion
      let templatesDeleted = false;
      
      await authenticatedPage.route('**/api/budget-templates', (route) => {
        if (templatesDeleted) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [],
            }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: 'last-template',
                  name: 'Last Template',
                  description: 'The last one',
                  isDefault: false,
                },
              ],
            }),
          });
        }
      });
      
      await budgetTemplatesPage.goto();
      
      // Mock deletion
      await authenticatedPage.route('**/api/v1/budget-templates/*', (route) => {
        if (route.request().method() === 'DELETE') {
          templatesDeleted = true;
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Template deleted successfully',
            }),
          });
        }
      });
      
      // Verify empty state appears
      await expect(authenticatedPage.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(authenticatedPage.locator('text="Aucun modèle de budget"')).toBeVisible();
      await expect(authenticatedPage.locator('mat-icon:has-text("library_books")')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle deletion errors gracefully', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock API to return error on deletion
      await authenticatedPage.route('**/api/v1/budget-templates/*', (route) => {
        if (route.request().method() === 'DELETE') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal server error',
              code: 'SERVER_ERROR',
            }),
          });
        }
      });
      
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.gotoTemplate('test-template-id');
      
      // Try to delete
      await authenticatedPage.locator('[aria-label*="Options"]').click();
      await authenticatedPage.locator('button:has-text("Supprimer")').click();
      
      // Verify error message appears
      await expect(authenticatedPage.locator('.mat-snack-bar')).toContainText('erreur');
      
      // Verify template is still visible
      await authenticatedPage.reload();
      await expect(authenticatedPage.locator('h1, h2')).toBeVisible();
    });

    test('should handle usage check errors', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock API to return error on usage check
      await authenticatedPage.route('**/api/v1/budget-templates/*/usage', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to check usage',
            code: 'USAGE_CHECK_ERROR',
          }),
        });
      });
      
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.gotoTemplate('test-template-id');
      
      // Try to delete
      await authenticatedPage.locator('[aria-label*="Options"]').click();
      await authenticatedPage.locator('button:has-text("Supprimer")').click();
      
      // Verify error message appears
      await expect(authenticatedPage.locator('.mat-snack-bar')).toContainText('vérification');
    });
  });
});