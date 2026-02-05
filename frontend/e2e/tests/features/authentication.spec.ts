import { test, expect } from '../../fixtures/test-fixtures';
import { setupAuthBypass } from '../../utils/auth-bypass';

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
    await page.goto('/dashboard');
    
    // Should redirect to login or welcome page
    await expect(page).toHaveURL(/(\/login|\/welcome)/);
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


  test('should maintain session after refresh', async ({ authenticatedPage }) => {
    // Navigate to protected route
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    
    // Refresh the page
    await authenticatedPage.reload();
    
    // Should still be on the same page (not redirected to login)
    await expect(authenticatedPage).toHaveURL(/\/(dashboard|budget)/);
  });

  test('should handle logout properly', async ({ authenticatedPage }) => {
    // Navigate to app
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Wait for user menu to be visible before clicking
    await expect(authenticatedPage.getByTestId('user-menu-trigger')).toBeVisible();
    await authenticatedPage.getByTestId('user-menu-trigger').click();

    // Wait for logout button to be visible before clicking
    await expect(authenticatedPage.getByTestId('logout-button')).toBeVisible();
    await authenticatedPage.getByTestId('logout-button').click();

    // Should redirect away from app
    await expect(authenticatedPage).toHaveURL(/\/(login|welcome)/);
  });

  test('should clear vault client keys on logout', async ({ page }) => {
    await setupAuthBypass(page, {
      includeApiMocks: true,
      setLocalStorage: true,
      vaultCodeConfigured: true,
    });

    await page.addInitScript(() => {
      const path = window.location.pathname;
      if (path === '/login' || path === '/welcome') {
        return;
      }

      const entry = {
        version: 1,
        data: 'aa'.repeat(32),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        'pulpe-vault-client-key-local',
        JSON.stringify(entry),
      );
      sessionStorage.setItem(
        'pulpe-vault-client-key-session',
        JSON.stringify(entry),
      );
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
    await page.getByTestId('user-menu-trigger').click();
    await expect(page.getByTestId('logout-button')).toBeVisible();
    await page.getByTestId('logout-button').click();

    await expect(page).toHaveURL(/\/(login|welcome)/);

    const storage = await page.evaluate(() => ({
      local: localStorage.getItem('pulpe-vault-client-key-local'),
      session: sessionStorage.getItem('pulpe-vault-client-key-session'),
    }));

    expect(storage.local).toBeNull();
    expect(storage.session).toBeNull();
  });
});
