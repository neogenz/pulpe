import { test } from '../../fixtures/test-fixtures';

test.describe('Onboarding Flow', () => {
  // Increase timeout for complex onboarding flow
  test.setTimeout(40000);
  
  test('should complete full onboarding flow', async ({ onboardingPage }) => {
    await onboardingPage.completeOnboardingFlow();
    await onboardingPage.expectRedirectToCurrentMonth();
  });

  test('should navigate through all onboarding steps', async ({ onboardingPage }) => {
    await onboardingPage.goto();
    await onboardingPage.completeOnboardingFlow();
    // In test context with mocked auth, might end on registration or app
    await onboardingPage.expectRedirectToCurrentMonth();
  });
});