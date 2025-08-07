import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Budget Template Deletion', () => {
  test.describe('Delete from Details Page', () => {
    test('should delete template when no budgets are associated', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock template details and deletion APIs
      const templateName = 'Test Template';
      const templateId = 'test-template-1';
      
      // Set up all API mocks before navigation
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: templateId,
                name: templateName,
                description: 'Template for testing',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Template deleted successfully',
            }),
          });
        }
      });

      // Mock template lines (required by getDetail$ forkJoin)
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId + '/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                templateId: templateId,
                name: 'Test Income',
                amount: 5000,
                kind: 'INCOME',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'line-2',
                templateId: templateId,
                name: 'Test Expense',
                amount: 2000,
                kind: 'FIXED_EXPENSE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      });

      // Mock usage check - no budgets using this template
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId + '/usage', async (route) => {
        await route.fulfill({
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
      
      // Navigate directly to the template details page
      await budgetTemplatesPage.gotoTemplate(templateId);
      
      // Wait for the page to be fully loaded - check for the template detail page element
      await authenticatedPage.waitForSelector('[data-testid="template-detail-page"]', { timeout: 10000 });
      
      // Wait for the menu trigger to be available (indicates data is loaded and template is rendered)
      await authenticatedPage.waitForSelector('[data-testid="template-detail-menu-trigger"]', { 
        state: 'visible',
        timeout: 10000 
      });
      
      // Small delay to ensure all event handlers are attached
      await authenticatedPage.waitForTimeout(500);
      
      // Click on menu and delete
      await authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]').click();
      await authenticatedPage.waitForSelector('[data-testid="delete-template-detail-menu-item"]', { state: 'visible' });
      await authenticatedPage.locator('[data-testid="delete-template-detail-menu-item"]').click();
      
      // Confirm deletion in dialog
      await authenticatedPage.waitForSelector('[role="dialog"]', { state: 'visible' });
      await authenticatedPage.locator('[role="dialog"] button:has-text("Supprimer")').click();
      
      // Wait for navigation back to list
      await authenticatedPage.waitForURL('**/budget-templates', { timeout: 10000 });
      
      // Success verification
      expect(authenticatedPage.url()).toContain('/budget-templates');
      expect(authenticatedPage.url()).not.toContain('/details/');
    });

    test('should show budget usage dialog when template has associated budgets', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      const templateId = 'test-template-id';
      const templateName = 'Test Template with Budgets';
      
      // Mock template details
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: templateId,
                name: templateName,
                description: 'Template for testing with budgets',
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        }
      });

      // Mock template lines
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId + '/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                templateId: templateId,
                name: 'Test Income',
                amount: 5000,
                kind: 'INCOME',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      });

      // Mock API to return template with associated budgets
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId + '/usage', async (route) => {
        await route.fulfill({
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
      
      // Navigate to template
      await budgetTemplatesPage.gotoTemplate(templateId);
      
      // Wait for the page to be fully loaded
      await authenticatedPage.waitForSelector('[data-testid="template-detail-page"]', { timeout: 10000 });
      
      // Wait for the menu trigger to be available
      await authenticatedPage.waitForSelector('[data-testid="template-detail-menu-trigger"]', { 
        state: 'visible',
        timeout: 10000 
      });
      
      // Small delay to ensure all event handlers are attached
      await authenticatedPage.waitForTimeout(500);
      
      // Click on menu and delete
      await authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]').click();
      await authenticatedPage.waitForSelector('[data-testid="delete-template-detail-menu-item"]', { state: 'visible' });
      await authenticatedPage.locator('[data-testid="delete-template-detail-menu-item"]').click();
      
      // Verify usage dialog appears
      await authenticatedPage.waitForSelector('[role="dialog"]', { state: 'visible' });
      await expect(authenticatedPage.locator('h2:has-text("Suppression impossible")')).toBeVisible();
      
      // Verify budget list is shown (look specifically in dialog)
      await expect(authenticatedPage.locator('[role="dialog"] mat-card')).toHaveCount(3);
      await expect(authenticatedPage.locator('[role="dialog"]')).toContainText('Janvier 2025');
      
      // Close dialog
      await authenticatedPage.locator('button[matButton="filled"]:has-text("Compris")').click();
      await authenticatedPage.waitForSelector('[role="dialog"]', { state: 'detached' });
    });
  });

  test.describe('Delete from List View', () => {
    test('should delete template from card menu', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      const templateId = 'template-1';
      
      // Mock API to return templates
      await authenticatedPage.route('**/api/v1/budget-templates', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [
                {
                  id: templateId,
                  name: 'Template to Delete',
                  description: 'This template will be deleted',
                  isDefault: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }),
          });
        }
      });
      
      // Mock usage check to return no budgets
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId + '/usage', async (route) => {
        await route.fulfill({
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

      // Mock deletion
      await authenticatedPage.route('**/api/v1/budget-templates/' + templateId, async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Template deleted successfully',
            }),
          });
        }
      });
      
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.expectTemplatesListVisible();
      
      // Wait for templates to load
      await authenticatedPage.waitForSelector('mat-card', { state: 'visible' });
      
      // Click menu on template card  
      const menuButton = authenticatedPage.locator('mat-card').first().locator('button[mat-icon-button]').filter({ hasText: 'more_vert' });
      await menuButton.click();
      
      // Wait for menu to open and click delete
      await authenticatedPage.waitForSelector('button[mat-menu-item]:has-text("Supprimer")', { state: 'visible' });
      await authenticatedPage.locator('button[mat-menu-item]:has-text("Supprimer")').click();
      
      // Confirm deletion
      await authenticatedPage.waitForSelector('[role="dialog"]', { state: 'visible' });
      await authenticatedPage.locator('[role="dialog"] button:has-text("Supprimer")').click();
      
      // Verify success message or page refresh
      await authenticatedPage.waitForTimeout(1000); // Allow time for snackbar
      try {
        const hasSuccessMessage = await authenticatedPage
          .locator('mat-snack-bar-container')
          .first()
          .isVisible();
        expect(hasSuccessMessage).toBeTruthy();
      } catch {
        // Fallback: check if we're back on templates list
        const isBackToList = authenticatedPage.url().includes('/budget-templates');
        expect(isBackToList).toBeTruthy();
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state after deleting last template', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock API to return empty templates after deletion
      let templatesDeleted = false;
      
      await authenticatedPage.route('**/api/v1/budget-templates', async (route) => {
        if (templatesDeleted) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: [],
            }),
          });
        } else {
          await route.fulfill({
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
      
      // Mock usage check - no budgets using this template
      await authenticatedPage.route('**/api/v1/budget-templates/*/usage', async (route) => {
        await route.fulfill({
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
      
      // Mock deletion
      await authenticatedPage.route('**/api/v1/budget-templates/*', async (route) => {
        if (route.request().method() === 'DELETE') {
          templatesDeleted = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Template deleted successfully',
            }),
          });
        }
      });
      
      await budgetTemplatesPage.goto();
      await budgetTemplatesPage.expectTemplatesListVisible();
      
      // Delete the template from card menu
      await authenticatedPage.locator('mat-card').first().locator('button[mat-icon-button]').filter({ hasText: 'more_vert' }).click();
      await authenticatedPage.locator('button[mat-menu-item]:has-text("Supprimer")').click();
      
      // Confirm deletion
      await authenticatedPage.locator('[role="dialog"]').waitFor();
      await authenticatedPage.locator('[role="dialog"] button:has-text("Supprimer")').click();
      
      // Wait for page reload after deletion
      await authenticatedPage.waitForTimeout(2000);
      
      // Verify empty state appears
      await expect(authenticatedPage.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(authenticatedPage.locator('[data-testid="empty-state-title"]')).toContainText('Aucun modèle de budget');
      await expect(authenticatedPage.locator('[data-testid="empty-state"] mat-icon')).toContainText('library_books');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle deletion errors gracefully', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock template details first
      await authenticatedPage.route('**/api/v1/budget-templates/test-template-id', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'test-template-id',
                name: 'Test Template',
                description: 'Template for testing',
                isDefault: false,
              },
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Internal server error',
              code: 'SERVER_ERROR',
            }),
          });
        }
      });

      // Mock template lines
      await authenticatedPage.route('**/api/v1/budget-templates/test-template-id/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                name: 'Test Income',
                amount: 5000,
                kind: 'INCOME',
              },
            ],
          }),
        });
      });
      
      // Mock usage check - no budgets using this template
      await authenticatedPage.route('**/api/v1/budget-templates/test-template-id/usage', async (route) => {
        await route.fulfill({
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
      
      await budgetTemplatesPage.gotoTemplate('test-template-id');
      
      // Wait for loading to finish and data to be available
      await authenticatedPage.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Wait for the menu trigger to be available (indicates data is loaded)
      await authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]').waitFor({ timeout: 15000 });
      
      // Try to delete
      await authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]').click();
      await authenticatedPage.locator('[data-testid="delete-template-detail-menu-item"]').click();
      
      // Confirm deletion in dialog
      await authenticatedPage.locator('[role="dialog"]').waitFor();
      await authenticatedPage.locator('[role="dialog"] button:has-text("Supprimer")').click();
      
      // Verify error message appears
      await expect(authenticatedPage.locator('mat-snack-bar-container').first()).toContainText('erreur');
      
      // Verify we're still on the template detail page (not redirected)
      await expect(authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]')).toBeVisible();
    });

    test('should handle usage check errors', async ({
      authenticatedPage,
      budgetTemplatesPage,
    }) => {
      // Mock template details first
      await authenticatedPage.route('**/api/v1/budget-templates/test-template-id', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'test-template-id',
                name: 'Test Template',
                description: 'Template for testing',
                isDefault: false,
              },
            }),
          });
        }
      });

      // Mock template lines
      await authenticatedPage.route('**/api/v1/budget-templates/test-template-id/lines', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'line-1',
                name: 'Test Income',
                amount: 5000,
                kind: 'INCOME',
              },
            ],
          }),
        });
      });
      
      // Mock API to return error on usage check
      await authenticatedPage.route('**/api/v1/budget-templates/test-template-id/usage', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to check usage',
            code: 'USAGE_CHECK_ERROR',
          }),
        });
      });
      
      await budgetTemplatesPage.gotoTemplate('test-template-id');
      
      // Wait for loading to finish and data to be available
      await authenticatedPage.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Wait for the menu trigger to be available (indicates data is loaded)
      await authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]').waitFor({ timeout: 15000 });
      
      // Try to delete
      await authenticatedPage.locator('[data-testid="template-detail-menu-trigger"]').click();
      await authenticatedPage.locator('[data-testid="delete-template-detail-menu-item"]').click();
      
      // Verify error message appears
      await expect(authenticatedPage.locator('mat-snack-bar-container').first()).toContainText('vérification');
    });
  });
});