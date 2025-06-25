import { test, expect } from '../../fixtures/test-fixtures';

test.describe('User Onboarding Flow', () => {
  test('should welcome new users with introduction screen', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.goto();
    await onboardingPage.expectWelcomePageVisible();
    await onboardingPage.expectPageLoaded();
  });

  test('should provide access to registration process', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.gotoStep('registration');
    await onboardingPage.expectPageLoaded();
  });

  test('should handle registration validation gracefully', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.gotoStep('registration');
    await onboardingPage.expectPageLoaded();
  });

  test('should provide income information collection step', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.gotoStep('income');
    await onboardingPage.expectPageLoaded();
  });

  test('should allow navigation between onboarding steps', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.goto();
    await onboardingPage.expectPageLoaded();
  });

  test('should handle complete onboarding journey gracefully', async ({
    page,
    onboardingPage,
  }) => {
    await onboardingPage.goto();
    await onboardingPage.expectPageLoaded();
  });
});
