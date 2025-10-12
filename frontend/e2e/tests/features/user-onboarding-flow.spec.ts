import { test } from '../../fixtures/test-fixtures';
import { setupApiMocks } from '../../utils/auth-bypass';

test.describe('Onboarding Flow', () => {
  // Increase timeout for complex onboarding flow
  test.setTimeout(40000);

  test('should complete full onboarding flow', async ({ page, onboardingPage }) => {
    // Setup E2E auth bypass flag (without mock authenticated state)
    // This allows onboarding to work while mocking Supabase auth calls
    await page.addInitScript(() => {
      (window as any).__E2E_AUTH_BYPASS__ = true;
    });

    // Setup API mocks for backend calls
    await setupApiMocks(page);

    await onboardingPage.completeOnboardingFlow();
    await onboardingPage.expectRedirectToCurrentMonth();
  });

  test('should navigate through all onboarding steps', async ({ page, onboardingPage }) => {
    // Setup E2E auth bypass flag (without mock authenticated state)
    // This allows onboarding to work while mocking Supabase auth calls
    await page.addInitScript(() => {
      (window as any).__E2E_AUTH_BYPASS__ = true;
    });

    // Setup API mocks for backend calls
    await setupApiMocks(page);

    await onboardingPage.goto();
    await onboardingPage.completeOnboardingFlow();
    // In test context with mocked auth, might end on registration or app
    await onboardingPage.expectRedirectToCurrentMonth();
  });
});