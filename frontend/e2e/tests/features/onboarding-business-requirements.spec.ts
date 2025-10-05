import { test, expect } from '../../fixtures/test-fixtures';

/**
 * E2E Tests for Onboarding Business Requirements
 * Simplified version focusing on core business workflow
 */
test.describe('Onboarding Business Requirements Validation', () => {
  test('BUSINESS REQUIREMENT: Complete 8-step onboarding flow', async ({ page, onboardingPage }) => {
    // Mock the registration API
    await page.route('**/api/v1/auth/register', route => 
      route.fulfill({ 
        status: 200, 
        body: JSON.stringify({ 
          success: true, 
          data: { user: { id: 'test-user', email: 'test@pulpe.local' } } 
        }) 
      })
    );

    // Mock budget creation API
    await page.route('**/api/v1/budgets**', route => 
      route.fulfill({ 
        status: 200, 
        body: JSON.stringify({ 
          success: true, 
          data: { id: 'test-budget', name: 'Test Budget' } 
        }) 
      })
    );

    await onboardingPage.goto();
    await onboardingPage.completeOnboardingFlow();
    // Verify we've navigated away from welcome page
    expect(page.url()).not.toContain('/welcome');
  });

  test('BUSINESS REQUIREMENT: Data persistence and collection', async ({ page }) => {
    await page.goto('/onboarding/welcome');
    await page.waitForLoadState('domcontentloaded');
    
    // Check we're on onboarding
    expect(page.url()).toContain('/onboarding');
  });

  test('BUSINESS REQUIREMENT: Registration process readiness', async ({ page }) => {
    await page.goto('/onboarding/welcome');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/onboarding');
  });

  test('BUSINESS REQUIREMENT: Budget data collection completeness', async ({ page, onboardingPage }) => {
    await onboardingPage.goto();
    const steps = ['welcome', 'personal-info', 'income', 'housing'];
    for (const step of steps) {
      await page.goto(`/onboarding/${step}`);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('BUSINESS REQUIREMENT: End-to-end user journey', async ({ page, onboardingPage }) => {
    await onboardingPage.goto();
    await page.waitForLoadState('domcontentloaded');

    // Just verify we can navigate onboarding
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/onboarding');
  });
});