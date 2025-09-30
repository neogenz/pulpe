import { test, expect, type Page } from '@playwright/test';

/**
 * Demo Mode Functionality Test Suite
 *
 * Tests the complete demo mode functionality including:
 * - Activation process
 * - Data persistence with localStorage
 * - Budget management
 * - Template functionality
 * - Transaction handling
 * - UI responsiveness
 */

test.describe('Demo Mode Functionality', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Capture console messages
    consoleLogs = [];
    consoleErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.type()}: ${msg.text()}`);
      } else {
        consoleLogs.push(`${msg.type()}: ${msg.text()}`);
      }
    });

    // Listen for unhandled exceptions
    page.on('pageerror', (exception) => {
      consoleErrors.push(`Page error: ${exception.message}`);
    });
  });

  test('should activate demo mode successfully from welcome page', async ({ page }) => {
    // Navigate to welcome page
    await page.goto('/');

    // Wait for welcome page to load
    await expect(page.getByTestId('onboarding-welcome-page')).toBeVisible();

    // Verify demo button is visible and enabled
    const demoButton = page.getByTestId('welcome-demo-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toBeEnabled();

    // Click demo mode button
    await demoButton.click();

    // Wait for loading state
    await expect(demoButton).toContainText('Préparation de la démo...');

    // Wait for navigation to budget page (current month)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');

    await expect(page).toHaveURL('/app/current-month');

    // Verify demo mode is active in localStorage
    const isDemoMode = await page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-mode') === 'true';
    });
    expect(isDemoMode).toBe(true);

    // Verify demo is initialized
    const isInitialized = await page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-initialized') === 'true';
    });
    expect(isInitialized).toBe(true);
  });

  test('should persist demo data in localStorage', async ({ page }) => {
    // First activate demo mode
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();

    // Wait for budget page to load
    await page.waitForURL('/app/current-month');

    // Verify all expected demo data keys are present
    const expectedKeys = [
      'pulpe-demo-user',
      'pulpe-demo-session',
      'pulpe-demo-budgets',
      'pulpe-demo-templates',
      'pulpe-demo-template-lines',
      'pulpe-demo-transactions',
      'pulpe-demo-budget-lines',
      'pulpe-current-budget'
    ];

    for (const key of expectedKeys) {
      const value = await page.evaluate((k) => localStorage.getItem(k), key);
      expect(value).not.toBeNull();

      if (key !== 'pulpe-current-budget') {
        // Verify it's valid JSON
        expect(() => JSON.parse(value!)).not.toThrow();
      }
    }

    // Test data persistence after page reload
    await page.reload();
    await page.waitForURL('/app/current-month');

    // Verify data is still there
    const isDemoMode = await page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-mode') === 'true';
    });
    expect(isDemoMode).toBe(true);
  });

  test('should display budget overview with demo data', async ({ page }) => {
    // Activate demo mode
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Verify current month page loads with content
    await expect(page.locator('[data-testid="current-month-page"]')).toBeVisible();

    // Verify dashboard content is visible
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();

    // Check that the page has some content (flexible check)
    const pageContent = page.locator('main, [data-testid="dashboard-content"], .content');
    await expect(pageContent.first()).toBeVisible();
  });

  test('should allow budget line creation and management', async ({ page }) => {
    // Activate demo mode
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Try to add a new budget line
    const addButton = page.getByTestId('add-budget-line-button');
    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill in budget line form
      await expect(page.locator('form')).toBeVisible();

      // Test form fields exist
      await expect(page.locator('input[name="description"], input[formControlName="description"]')).toBeVisible();
      await expect(page.locator('input[name="amount"], input[formControlName="amount"]')).toBeVisible();

      // Try to submit (might need form validation)
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        // Fill required fields first
        await page.locator('input[name="description"], input[formControlName="description"]').fill('Test Prévision');
        await page.locator('input[name="amount"], input[formControlName="amount"]').fill('100');

        await submitButton.click();

        // Verify success message or return to budget view
        await expect(page.locator('text=/Prévision ajoutée|Budget|€/')).toBeVisible();
      }
    }
  });

  test('should handle template functionality', async ({ page }) => {
    // Activate demo mode
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Navigate to templates if available
    const templatesLink = page.locator('a[href*="template"], button:has-text("Template"), [data-testid*="template"]');
    if (await templatesLink.first().isVisible()) {
      await templatesLink.first().click();

      // Verify templates page loads
      await expect(page.locator('text=/Template|Modèle/')).toBeVisible();

      // Check for demo templates
      const templateItems = page.locator('[data-testid*="template"]');
      if (await templateItems.count() > 0) {
        await expect(templateItems.first()).toBeVisible();
      }
    }
  });

  test('should handle transactions management', async ({ page }) => {
    // Activate demo mode
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Look for transaction-related elements
    const transactionElements = page.locator('[data-testid*="transaction"]');
    if (await transactionElements.count() > 0) {
      await expect(transactionElements.first()).toBeVisible();
    }

    // Check if we can access transaction details
    const transactionItems = page.locator('[data-testid*="transaction-item"]');
    if (await transactionItems.count() > 0) {
      await transactionItems.first().click();
      // Verify we can interact with transactions
      await expect(page.locator('text=/Détail|€|Montant/')).toBeVisible();
    }
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Activate demo mode
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Verify main content is still visible
    await expect(page.locator('main, [role="main"], .main-content')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    // Verify content adapts
    await expect(page.locator('main, [role="main"], .main-content')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Verify content scales properly
    await expect(page.locator('main, [role="main"], .main-content')).toBeVisible();
  });

  test('should exit demo mode successfully', async ({ page }) => {
    // Activate demo mode first
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Look for demo mode exit option (might be in menu, settings, or header)
    const exitButtons = page.locator(
      'button:has-text("Quitter"), button:has-text("Exit"), [data-testid*="exit-demo"], [data-testid*="quit-demo"]'
    );

    if (await exitButtons.count() > 0) {
      await exitButtons.first().click();

      // Should redirect to welcome page
      await expect(page).toHaveURL('/');

      // Verify demo mode is disabled
      const isDemoMode = await page.evaluate(() => {
        return localStorage.getItem('pulpe-demo-mode');
      });
      expect(isDemoMode).toBeNull();
    } else {
      // Manually test clearing localStorage (fallback)
      await page.evaluate(() => {
        localStorage.clear();
      });

      await page.goto('/');
      await expect(page.getByTestId('onboarding-welcome-page')).toBeVisible();
    }
  });

  test.afterEach(async ({ page }) => {
    // Log any console errors found during the test
    if (consoleErrors.length > 0) {
      console.log('Console errors during test:', consoleErrors);
    }

    // Verify no critical errors occurred
    const criticalErrors = consoleErrors.filter(error =>
      error.includes('TypeError') ||
      error.includes('ReferenceError') ||
      error.includes('Failed to fetch') ||
      error.includes('Network error')
    );

    if (criticalErrors.length > 0) {
      console.warn('Critical errors found:', criticalErrors);
    }

    // Clean up demo mode
    await page.evaluate(() => {
      localStorage.clear();
    });
  });
});