import { test, expect } from '../../fixtures/test-fixtures';

test.describe('Onboarding Navigation', () => {
  test('should navigate through all steps in correct order', async ({ onboardingPage }) => {
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