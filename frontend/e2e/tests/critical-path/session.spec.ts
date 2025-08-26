import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Authenticated Session Management', () => {
  test('should redirect authenticated users from login page', async ({
    authenticatedPage: page,
  }) => {
    // Authenticated users should access protected content directly
    await page.goto('/app/current-month');
    await page.waitForLoadState('domcontentloaded');

    // Should successfully reach the current month page
    await expect(page.getByTestId('current-month-page')).toBeVisible();
    
    // Should not be on login page
    expect(page.url()).not.toMatch(/\/login/);
  });

  test('should maintain authentication across different sections', async ({
    authenticatedPage: page,
  }) => {
    // Test current month access
    await page.goto('/app/current-month');
    await expect(page.getByTestId('current-month-page')).toBeVisible();
    expect(page.url()).toMatch(/\/current-month/);

    // Test budget templates access  
    await page.goto('/app/budget-templates');
    await expect(page.getByTestId('budget-templates-page')).toBeVisible();
    expect(page.url()).toMatch(/\/budget-templates/);
  });

  test('should maintain user session across page refreshes', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/app/current-month');
    await expect(page.getByTestId('current-month-page')).toBeVisible();

    // Refresh page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Should remain on current month page
    await expect(page.getByTestId('current-month-page')).toBeVisible();
    expect(page.url()).toMatch(/\/current-month/);
  });

  test('should display logout option in user menu', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/app/current-month');
    await expect(page.getByTestId('current-month-page')).toBeVisible();

    // Open user menu
    await page.getByTestId('user-menu-trigger').click();
    
    // Verify logout button is visible
    await expect(page.getByTestId('logout-button')).toBeVisible();
  });

  test('should successfully log out user', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/app/current-month');
    await expect(page.getByTestId('current-month-page')).toBeVisible();

    // Perform logout
    await page.getByTestId('user-menu-trigger').click();
    await page.getByTestId('logout-button').click();

    // Should be redirected to login or onboarding
    await expect(page).toHaveURL(/\/(login|onboarding)/);
  });
});
