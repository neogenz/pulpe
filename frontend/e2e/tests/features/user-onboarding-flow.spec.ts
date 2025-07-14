import { test, expect } from '../../fixtures/test-fixtures';
import { OnboardingPage } from '../../pages/onboarding.page';
import { 
  validOnboardingData, 
  minimalValidData,
  highIncomeData 
} from '../../fixtures/onboarding-test-data';

test.describe('Onboarding Main Flow', () => {
  let onboardingPage: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboardingPage = new OnboardingPage(page);
    await onboardingPage.clearLocalStorageData();
  });

  test.describe('Complete Workflow Tests', () => {
    test('should complete full onboarding flow with valid data', async () => {
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      await onboardingPage.expectCurrentStep('registration');
    });

    test('should complete onboarding with minimal valid data', async () => {
      await onboardingPage.completeOnboardingFlow(minimalValidData);
      await onboardingPage.expectCurrentStep('registration');
    });

    test('should complete onboarding with high income scenario', async () => {
      await onboardingPage.completeOnboardingFlow(highIncomeData);
      await onboardingPage.expectCurrentStep('registration');
    });
  });

  test.describe('Individual Step Validation', () => {
    test('should display welcome content correctly', async () => {
      await onboardingPage.goto();
      await onboardingPage.expectWelcomePageVisible();
    });

    test('should validate personal info input', async () => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      
      // Verify we're on personal-info step
      await onboardingPage.expectCurrentStep('personal-info');
      
      // Fill personal info
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      
      // Should navigate to income
      await onboardingPage.expectCurrentStep('income');
    });

    test('should handle numeric input steps correctly', async () => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      
      // Test income step
      await onboardingPage.fillIncomeStep(validOnboardingData.monthlyIncome);
      await onboardingPage.expectCurrentStep('housing');
      
      // Test housing step
      await onboardingPage.fillHousingStep(validOnboardingData.housingCosts);
      await onboardingPage.expectCurrentStep('health-insurance');
    });

    test('should reach registration step after all onboarding steps', async () => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      await onboardingPage.fillIncomeStep(validOnboardingData.monthlyIncome);
      await onboardingPage.fillHousingStep(validOnboardingData.housingCosts);
      await onboardingPage.fillHealthInsuranceStep(validOnboardingData.healthInsurance);
      await onboardingPage.fillPhonePlanStep(validOnboardingData.phonePlan);
      await onboardingPage.fillTransportStep(validOnboardingData.transportCosts);
      await onboardingPage.fillLeasingCreditStep(validOnboardingData.leasingCredit);
      
      // Should be on registration
      await onboardingPage.expectCurrentStep('registration');
      await onboardingPage.expectRegistrationFormVisible();
    });
  });

  test.describe('Form Input Validation', () => {
    test('should accept valid email format', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      await onboardingPage.emailInput.fill('test@example.com');
      await expect(onboardingPage.emailInput).toHaveValue('test@example.com');
    });

    test('should accept valid password', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      await onboardingPage.passwordInput.fill('validPassword123');
      await expect(onboardingPage.passwordInput).toHaveValue('validPassword123');
    });

    test('should handle numeric value inputs correctly', async () => {
      await onboardingPage.gotoStep('income');
      
      const testValue = '5000';
      await onboardingPage.monthlyIncomeInput.fill(testValue);
      await expect(onboardingPage.monthlyIncomeInput).toHaveValue(testValue);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle large numeric values', async () => {
      await onboardingPage.gotoStep('income');
      
      const largeValue = '999999';
      await onboardingPage.monthlyIncomeInput.fill(largeValue);
      await expect(onboardingPage.monthlyIncomeInput).toHaveValue(largeValue);
    });

    test('should handle special characters in email', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      
      const specialEmail = 'test+special@example.co.uk';
      await onboardingPage.emailInput.fill(specialEmail);
      await expect(onboardingPage.emailInput).toHaveValue(specialEmail);
    });

    test('should handle very long first name', async () => {
      const longName = 'Jean-Baptiste-Alexandre-Ferdinand-Maximilian';
      
      await onboardingPage.gotoStep('personal-info');
      await onboardingPage.firstNameInput.fill(longName);
      await expect(onboardingPage.firstNameInput).toHaveValue(longName);
    });
  });

  test.describe('Registration Process Setup', () => {
    test('should display registration form with proper fields', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      await onboardingPage.expectRegistrationFormVisible();
      
      // Verify form fields are present
      await expect(onboardingPage.emailInput).toBeVisible();
      await expect(onboardingPage.passwordInput).toBeVisible();
    });

    test('should prepare for registration after complete flow', async () => {
      // Complete the full onboarding flow
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      
      // Should be ready for registration
      await onboardingPage.expectCurrentStep('registration');
      await onboardingPage.expectRegistrationFormVisible();
      
      // Form should be fillable
      await onboardingPage.emailInput.fill(validOnboardingData.email);
      await onboardingPage.passwordInput.fill('testPassword123');
      
      await expect(onboardingPage.emailInput).toHaveValue(validOnboardingData.email);
      await expect(onboardingPage.passwordInput).toHaveValue('testPassword123');
    });
  });
});