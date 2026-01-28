import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Template propagation choices', () => {
  const templateDetailUrl = '/budget-templates/details/e2e-template-default';
  const bulkOperationsEndpoint =
    '**/api/v1/budget-templates/*/lines/bulk-operations';

  async function openEditDialog(page: Page) {
    await page.goto(templateDetailUrl);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('template-detail-page')).toBeVisible();

    // Click the edit button directly (desktop view)
    await page.getByTestId('template-detail-edit-button').click();

    // Ensure dialog is visible
    await expect(
      page.getByRole('heading', {
        name: /Éditer les transactions/i,
      }),
    ).toBeVisible();
  }

  async function makeLineAdjustment(page: Page) {
    const amountInput = page.getByTestId('edit-line-amount').first();
    await expect(amountInput).toBeVisible();
    await amountInput.fill('5100');
  }

  test('should keep changes on template only when propagation is skipped', async ({
    authenticatedPage,
  }) => {
    const capturedBodies: unknown[] = [];

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
                id: '1',
                templateId: 'e2e-template-default',
                name: 'Salaire',
                amount: 5100,
                kind: 'income',
                recurrence: 'fixed',
                description: null,
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

    await authenticatedPage
      .getByRole('button', { name: 'Enregistrer', exact: true })
      .click();

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
      authenticatedPage.getByText('Modèle mis à jour (budgets non modifiés).'),
    ).toBeVisible();
  });

  test('should propagate changes to future budgets when requested', async ({
    authenticatedPage,
  }) => {
    const capturedBodies: unknown[] = [];

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
                id: '1',
                templateId: 'e2e-template-default',
                name: 'Salaire',
                amount: 5200,
                kind: 'income',
                recurrence: 'fixed',
                description: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            deleted: [],
            propagation: {
              mode: 'propagate',
              affectedBudgetIds: ['future-budget-1'],
              affectedBudgetsCount: 1,
            },
          },
        }),
      });
    });

    await openEditDialog(authenticatedPage);
    await makeLineAdjustment(authenticatedPage);

    await authenticatedPage
      .getByRole('button', { name: 'Enregistrer', exact: true })
      .click();

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
