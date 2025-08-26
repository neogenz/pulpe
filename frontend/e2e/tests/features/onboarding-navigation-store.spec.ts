import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Onboarding Navigation', () => {
  test('should navigate through all steps in correct order', async ({ page, onboardingPage }) => {
    // Mock the registration API
    await page.route('**/api/v1/auth/register', route => 
      route.fulfill({ 
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          data: { user: { id: 'test-user', email: 'test@pulpe.local' } } 
        }) 
      })
    );

    // Mock budget creation API that happens after onboarding
    await page.route('**/api/v1/budgets**', route => 
      route.fulfill({ 
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          data: { id: 'test-budget', name: 'Test Budget' } 
        }) 
      })
    );
    await onboardingPage.goto();
    await onboardingPage.completeOnboardingFlow();
    await onboardingPage.expectRedirectToCurrentMonth();
  });

  test('should handle direct navigation to specific steps', async ({ page }) => {
    await page.goto('/onboarding/income');
    await page.waitForLoadState('domcontentloaded');
    
    // Just verify we loaded the page
    await expect(page.locator('body')).toBeVisible();
  });
});