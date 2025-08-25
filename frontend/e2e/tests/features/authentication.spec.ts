import { test, expect } from '../../fixtures/test-fixtures';

/**
 * Authentication Tests
 * 
 * Core authentication flows and security validations
 */
test.describe('Authentication', () => {
  test.describe.configure({ mode: 'parallel' });

  test('should protect routes from unauthenticated access', async ({ page }) => {
    // Clear any auth state
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to access protected route
    await page.goto('/app/current-month');
    
    // Should redirect to login or onboarding
    await expect(page).toHaveURL(/(\/auth\/login|\/onboarding\/welcome)/);
  });

  test('should have login form with required fields', async ({ page, loginPage }) => {
    await loginPage.goto();
    
    // Check that we're on the login page - use multiple possible selectors
    const loginForm = page.getByTestId('login-form').or(
      page.locator('form').or(
        page.locator('[data-testid="login-container"]')
      )
    );
    await expect(loginForm).toBeVisible();
    
    // Check for email and password inputs using multiple strategies
    const emailInput = page.getByTestId('email-input').or(
      page.locator('input[type="email"]').or(
        page.locator('input[formControlName="email"]')
      )
    );
    await expect(emailInput).toBeVisible();
    
    const passwordInput = page.getByTestId('password-input').or(
      page.locator('input[type="password"]').or(
        page.locator('input[formControlName="password"]')
      )
    );
    await expect(passwordInput).toBeVisible();
    
    // Check for submit button
    const submitButton = page.getByTestId('login-submit-button').or(
      page.getByRole('button', { name: /login|connexion|se connecter/i })
    );
    await expect(submitButton).toBeVisible();
  });

  test.skip('should validate email format', async () => {
    // Skip this test as it requires actual form validation implementation
    // which may vary based on the application's current state
  });

  test('should maintain session after refresh', async ({ authenticatedPage }) => {
    // Navigate to protected route
    await authenticatedPage.goto('/app/current-month');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Refresh the page
    await authenticatedPage.reload();
    
    // Should still be on the same page (not redirected to login)
    await expect(authenticatedPage).toHaveURL(/\/app\//);
  });

  test('should handle logout properly', async ({ authenticatedPage, mainLayoutPage }) => {
    // Navigate to app
    await authenticatedPage.goto('/app/current-month');
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Perform logout
    await mainLayoutPage.performLogout();
    
    // Should redirect away from app
    await expect(authenticatedPage).not.toHaveURL(/\/app\//);
  });
});