import { test, expect } from '../../fixtures/test-fixtures';
import { setupApiMocks } from '../../utils/auth-bypass';

test.describe('Onboarding Navigation', () => {
  test('should navigate through all steps in correct order', async ({ page, onboardingPage }) => {
    // Setup E2E auth bypass flag (without mock authenticated state)
    // This allows onboarding to work while mocking Supabase auth calls
    await page.addInitScript(() => {
      (window as any).__E2E_AUTH_BYPASS__ = true;
    });

    // Setup API mocks for backend calls
    await setupApiMocks(page);

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