import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import { TEST_CONFIG } from '../../config/test-config';
import { TEST_UUIDS } from '../../helpers/api-mocks';

test.describe('Template propagation choices', () => {
  const templateDetailUrl = `/budget-templates/details/${TEST_CONFIG.TEMPLATES.DEFAULT.id}`;
  const bulkOperationsEndpoint =
    '**/api/v1/budget-templates/*/lines/bulk-operations';
  const usageEndpoint = '**/api/v1/budget-templates/*/usage';

  async function mockTemplateUsageAsActive(page: Page) {
    await page.route(usageEndpoint, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            isUsed: true,
            budgetCount: 1,
            budgets: [
              {
                id: TEST_UUIDS.BUDGET_2,
                month: 1,
                year: 2025,
                description: 'Budget futur',
              },
            ],
          },
        }),
      });
    });
  }

  async function openEditDialog(page: Page) {
    await page.goto(templateDetailUrl);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('template-detail-page')).toBeVisible();

    // Open the line card menu and click edit for the income line
    await page.getByTestId(`template-line-menu-${TEST_UUIDS.LINE_1}`).click();
    await page.getByTestId(`edit-template-line-${TEST_UUIDS.LINE_1}`).click();

    // Ensure the edit dialog is visible
    await expect(
      page.getByRole('heading', {
        name: /Modifier la prévision/i,
      }),
    ).toBeVisible();
  }

  async function makeLineAdjustment(page: Page) {
    const amountInput = page.locator(
      '[data-testid="edit-template-line-dialog"] [data-testid="amount-input-value"]',
    );
    await expect(amountInput).toBeVisible();
    await amountInput.fill('5100');
  }

  test('should keep changes on template only when propagation is skipped', async ({
    authenticatedPage,
  }) => {
    const capturedBodies: unknown[] = [];

    await mockTemplateUsageAsActive(authenticatedPage);
    await authenticatedPage.route(bulkOperationsEndpoint, async (route) => {
      const body = route.request().postDataJSON();
      capturedBodies.push(body);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            created: [],
            updated: [
              {
                id: TEST_UUIDS.LINE_1,
                templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
                name: 'Salaire',
                amount: 5100,
                kind: 'income',
                recurrence: 'fixed',
                description: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            deleted: [],
            propagation: {
              mode: 'template-only',
              affectedBudgetIds: [],
              affectedBudgetsCount: 0,
            },
          },
        }),
      });
    });

    await openEditDialog(authenticatedPage);
    await makeLineAdjustment(authenticatedPage);

    await authenticatedPage.getByTestId('save-edit-template-line').click();

    // Default selection is "Mettre à jour uniquement le modèle"; confirm dialog
    await expect(
      authenticatedPage.getByRole('dialog', {
        name: 'Comment appliquer ces modifications ?',
      }),
    ).toBeVisible();

    await authenticatedPage
      .getByRole('button', { name: 'Continuer', exact: true })
      .click();

    await expect.poll(() => capturedBodies.length).toBe(1);
    const requestBody = capturedBodies[0] as { propagateToBudgets: boolean };
    expect(requestBody.propagateToBudgets).toBe(false);

    await expect(
      authenticatedPage.getByText('Prévision modifiée'),
    ).toBeVisible();
  });

  test('should propagate changes to future budgets when requested', async ({
    authenticatedPage,
  }) => {
    const capturedBodies: unknown[] = [];

    await mockTemplateUsageAsActive(authenticatedPage);
    await authenticatedPage.route(bulkOperationsEndpoint, async (route) => {
      const body = route.request().postDataJSON();
      capturedBodies.push(body);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            created: [],
            updated: [
              {
                id: TEST_UUIDS.LINE_1,
                templateId: TEST_CONFIG.TEMPLATES.DEFAULT.id,
                name: 'Salaire',
                amount: 5200,
                kind: 'income',
                recurrence: 'fixed',
                description: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            deleted: [],
            propagation: {
              mode: 'propagate',
              affectedBudgetIds: [TEST_UUIDS.BUDGET_2],
              affectedBudgetsCount: 1,
            },
          },
        }),
      });
    });

    await openEditDialog(authenticatedPage);
    await makeLineAdjustment(authenticatedPage);

    await authenticatedPage.getByTestId('save-edit-template-line').click();

    const propagationDialog = authenticatedPage.getByRole('dialog', {
      name: 'Comment appliquer ces modifications ?',
    });
    await expect(propagationDialog).toBeVisible();

    await propagationDialog
      .getByRole('radio', {
        name: 'Mettre à jour le modèle et les budgets actuels et futurs',
      })
      .click();

    await propagationDialog
      .getByRole('button', { name: 'Continuer', exact: true })
      .click();

    await expect.poll(() => capturedBodies.length).toBe(1);
    const requestBody = capturedBodies[0] as { propagateToBudgets: boolean };
    expect(requestBody.propagateToBudgets).toBe(true);

    await expect(
      authenticatedPage.getByText(
        'Modèle et budgets futurs mis à jour (1 budget ajusté)',
      ),
    ).toBeVisible();
  });
});
