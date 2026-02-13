import { test, test as base, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';
import { MOCK_API_RESPONSES } from '../../mocks/api-responses';
import { TEST_CONFIG } from '../../config/test-config';

test.describe.configure({ mode: 'parallel' });

test.describe('Template Details View', () => {
  test('should display template details with complete financial summary', async ({
    authenticatedPage,
  }) => {
    // The global mocks handle all API responses
    // Navigate to the default template from global mocks

    // Act - Navigate directly to template details page
    // Using the default template ID from global mocks
    await authenticatedPage.goto(
      `/budget-templates/details/${TEST_CONFIG.TEMPLATES.DEFAULT.id}`,
    );
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Assert - Verify page loaded correctly
    await expect(
      authenticatedPage.getByTestId('template-detail-page'),
    ).toBeVisible();

    // Verify page title shows template name
    const pageTitle = authenticatedPage.getByTestId('page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toHaveText('E2E Test Template');

    // Verify financial overview section is displayed
    const financialSection = authenticatedPage.locator(
      '[aria-labelledby="financial-summary-heading"]',
    );
    await expect(financialSection).toBeVisible();

    // Verify the three financial pills (Revenus, Dépenses, Épargne)
    await expect(financialSection.getByText('Revenus')).toBeVisible();
    await expect(financialSection.getByText('Dépenses')).toBeVisible();
    await expect(financialSection.getByText('Épargne')).toBeVisible();

    // Verify transactions table is displayed
    const transactionsTable = authenticatedPage.locator(
      'pulpe-transactions-table',
    );
    await expect(transactionsTable).toBeVisible();

    // Verify transactions heading
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Prévisions du modèle' }),
    ).toBeVisible();

    // Verify action buttons are accessible (desktop buttons)
    const editButton = authenticatedPage.getByTestId(
      'template-detail-edit-button',
    );
    const deleteButton = authenticatedPage.getByTestId(
      'delete-template-detail-button',
    );
    await expect(editButton).toBeVisible();
    await expect(deleteButton).toBeVisible();

    // Verify back button exists (without clicking it to avoid navigation issues)
    const backButton = authenticatedPage.getByLabel(
      'Retour à la liste des modèles',
    );
    await expect(backButton).toBeVisible();
  });

  // Use base test without global mocks for error handling
  base('should handle template loading errors gracefully', async ({ page }) => {
    // Setup auth bypass FIRST to inject auth state
    await setupAuthBypass(page, {
      includeApiMocks: false,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    // Set up all API routes AFTER auth bypass
    // Mock maintenance status endpoint (required for all navigation)
    await page.route('**/maintenance/status', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ maintenanceMode: false, message: null }),
      });
    });

    // Mock encryption/validate-key (required for vault code validation)
    await page.route('**/api/v1/encryption/validate-key', (route) => {
      return route.fulfill({ status: 204, body: '' });
    });

    // Mock budgets/exists endpoint (required for hasBudgetGuard)
    await page.route('**/api/v1/budgets/exists', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasBudget: true }),
      });
    });

    // Mock budgets endpoint to pass hasBudgetGuard (required for protected routes)
    await page.route('**/api/v1/budgets', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.budgets),
      });
    });

    // Mock users/settings endpoint (required to prevent 401 → login redirect)
    await page.route('**/api/v1/users/settings', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { payDayOfMonth: null } }),
      });
    });

    // Mock error template endpoints
    await page.route('**/api/v1/budget-templates/error-template', (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to load template',
        }),
      });
    });

    await page.route(
      '**/api/v1/budget-templates/error-template/lines',
      (route) => {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal Server Error',
            message: 'Failed to load template lines',
          }),
        });
      },
    );

    await page.addInitScript(() => {
      const entry = { version: 1, data: 'aa'.repeat(32), updatedAt: new Date().toISOString() };
      sessionStorage.setItem('pulpe-vault-client-key-session', JSON.stringify(entry));
    });

    // Navigate to the error template and wait for error state
    await page.goto(
      'http://localhost:4200/budget-templates/details/error-template',
    );

    // Wait for error alert to appear (max 5s)
    const errorContainer = page.getByRole('alert').first();
    await expect(errorContainer).toBeVisible({ timeout: 5000 });
    await expect(errorContainer).toContainText('Une erreur est survenue');

    // Verify retry button is present and clickable
    const retryButton = page.getByRole('button', {
      name: 'Réessayer le chargement',
    });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  test('should display correct amounts in financial summary', async ({
    authenticatedPage,
  }) => {
    // Navigate directly to template details page using default template
    await authenticatedPage.goto(
      `/budget-templates/details/${TEST_CONFIG.TEMPLATES.DEFAULT.id}`,
    );
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await expect(
      authenticatedPage.getByTestId('template-detail-page'),
    ).toBeVisible();

    // Verify the financial section displays correct calculated values
    const financialSection = authenticatedPage.locator(
      '[aria-labelledby="financial-summary-heading"]',
    );

    // Based on global mock data: income 5000, expenses 2600, savings 500
    // Format is de-CH with no decimals (e.g., "5'000 CHF")
    const incomePill = financialSection.getByTestId('income-pill');
    await expect(incomePill).toContainText(/5.000/);

    // Total expenses: 1800 + 600 + 200 = 2600
    const expensePill = financialSection.getByTestId('expense-pill');
    await expect(expensePill).toContainText(/2.600/);

    // Total savings: 500
    const savingsPill = financialSection.getByTestId('savings-pill');
    await expect(savingsPill).toContainText(/500/);

    // Net balance hero card (5000 - 2600 - 500 = 1900)
    await expect(financialSection.getByText(/1.900/)).toBeVisible();
  });
});
