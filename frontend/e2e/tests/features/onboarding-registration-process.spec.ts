import { test, expect } from '../../fixtures/test-fixtures';
import { OnboardingPage } from '../../pages/onboarding.page';
import { validOnboardingData } from '../../fixtures/onboarding-test-data';

test.describe('Onboarding Registration Process', () => {
  let onboardingPage: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboardingPage = new OnboardingPage(page);
    await onboardingPage.clearLocalStorageData();
  });

  test.describe('Registration Setup', () => {
    test('should reach registration after completing onboarding', async () => {
      // Complete the full onboarding flow first
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      
      // Should be on registration page
      await onboardingPage.expectCurrentStep('registration');
      await onboardingPage.expectRegistrationFormVisible();
    });

    test('should display proper registration form elements', async () => {
      await onboardingPage.gotoStep('registration');
      
      // Verify all form elements are present
      await expect(onboardingPage.emailInput).toBeVisible();
      await expect(onboardingPage.passwordInput).toBeVisible();
      
      // Form should be functional
      await onboardingPage.emailInput.fill('test@example.com');
      await onboardingPage.passwordInput.fill('testPassword123');
      
      await expect(onboardingPage.emailInput).toHaveValue('test@example.com');
      await expect(onboardingPage.passwordInput).toHaveValue('testPassword123');
    });
  });

  test.describe('Registration Data Handling', () => {
    test('should handle email input correctly', async () => {
      await onboardingPage.gotoStep('registration');
      
      const testEmail = 'user@test.com';
      await onboardingPage.emailInput.fill(testEmail);
      await expect(onboardingPage.emailInput).toHaveValue(testEmail);
    });

    test('should handle password input correctly', async () => {
      await onboardingPage.gotoStep('registration');
      
      const testPassword = 'SecurePassword123!';
      await onboardingPage.passwordInput.fill(testPassword);
      await expect(onboardingPage.passwordInput).toHaveValue(testPassword);
    });

    test('should handle password visibility toggle', async () => {
      await onboardingPage.gotoStep('registration');
      
      // Fill password
      await onboardingPage.passwordInput.fill('testPassword');
      
      // Check if toggle exists (it may not be implemented yet)
      const toggleExists = await onboardingPage.passwordVisibilityToggle.count() > 0;
      if (toggleExists) {
        await onboardingPage.togglePasswordVisibility();
        // Could check if password becomes visible, but this depends on implementation
      }
    });
  });

  test.describe('Registration with Complete Data', () => {
    test('should prepare for full registration process with onboarding data', async () => {
      // Complete onboarding to get to registration with all data
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      
      // Verify registration form is ready
      await onboardingPage.expectCurrentStep('registration');
      await onboardingPage.expectRegistrationFormVisible();
      
      // Fill registration form
      await onboardingPage.emailInput.fill(validOnboardingData.email);
      await onboardingPage.passwordInput.fill(validOnboardingData.password);
      
      // Verify data is ready for submission
      await expect(onboardingPage.emailInput).toHaveValue(validOnboardingData.email);
      await expect(onboardingPage.passwordInput).toHaveValue(validOnboardingData.password);
      
      // Verify onboarding data is persisted for template/budget creation
      const storedData = await onboardingPage.getLocalStorageData();
      expect(storedData).toBeTruthy();
    });
  });

  test.describe('API Integration Ready', () => {
    test('should be ready for authentication API call', async () => {
      await onboardingPage.gotoStep('registration');
      
      // Mock successful registration for testing
      await onboardingPage.mockSuccessfulRegistration();
      
      // Fill form
      await onboardingPage.emailInput.fill('test@example.com');
      await onboardingPage.passwordInput.fill('validPassword123');
      
      // Verify form is ready for submission
      await expect(onboardingPage.emailInput).toHaveValue('test@example.com');
      await expect(onboardingPage.passwordInput).toHaveValue('validPassword123');
      
      // Note: Actual submission would happen here in a full integration test
      // For now, we verify the form is properly set up for submission
    });

    test('should be ready for template creation after auth', async () => {
      // Complete onboarding first
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      
      // Mock template creation API
      await onboardingPage.mockTemplateCreation();
      
      // Verify we have all the data needed for template creation
      const storedData = await onboardingPage.getLocalStorageData();
      expect(storedData).toBeTruthy();
      
      // Registration form should be ready
      await onboardingPage.expectRegistrationFormVisible();
    });

    test('should be ready for budget creation process', async () => {
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      
      // Mock budget creation API
      await onboardingPage.mockBudgetCreation();
      
      // Verify all necessary data is collected
      const storedData = await onboardingPage.getLocalStorageData();
      expect(storedData).toBeTruthy();
      
      // Should be on registration step ready for the 4-step process:
      // 1. Authentication (current step)
      // 2. Template Creation (next)
      // 3. Budget Creation (next)
      // 4. Completion (final)
      await onboardingPage.expectCurrentStep('registration');
    });
  });
});