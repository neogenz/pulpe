import { test, expect } from '../../fixtures/onboarding-fixtures';
import { 
  validOnboardingData, 
  minimalValidData,
  highIncomeData 
} from '../../fixtures/onboarding-test-data';

test.describe('Onboarding Main Flow', () => {

  test.describe('Complete Workflow Tests', () => {
    test('should complete full onboarding flow with valid data', async ({ onboardingPage }) => {
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      await onboardingPage.expectCurrentStep('registration');
    });

    test('should complete onboarding with minimal valid data', async ({ onboardingPage }) => {
      await onboardingPage.completeOnboardingFlow(minimalValidData);
      await onboardingPage.expectCurrentStep('registration');
    });

    test('should complete onboarding with high income scenario', async ({ onboardingPage }) => {
      await onboardingPage.completeOnboardingFlow(highIncomeData);
      await onboardingPage.expectCurrentStep('registration');
    });
  });

  test.describe('Individual Step Validation', () => {
    test('should display welcome content correctly', async ({ onboardingPage }) => {
      await onboardingPage.goto();
      await onboardingPage.expectWelcomePageVisible();
    });

    test('should validate personal info input', async ({ onboardingPage }) => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      
      // Verify we're on personal-info step
      await onboardingPage.expectCurrentStep('personal-info');
      
      // Fill personal info
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      
      // Should navigate to income
      await onboardingPage.expectCurrentStep('income');
    });

    test('should handle numeric input steps correctly', async ({ onboardingPage }) => {
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

    test('should reach registration step after all onboarding steps', async ({ onboardingPage }) => {
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
    test('should accept valid email format', async ({ onboardingReadyForRegistration }) => {
      await onboardingReadyForRegistration.gotoStep('registration');
      await onboardingReadyForRegistration.emailInput.fill('test@example.com');
      await expect(onboardingReadyForRegistration.emailInput).toHaveValue('test@example.com');
    });

    test('should accept valid password', async ({ onboardingReadyForRegistration }) => {
      await onboardingReadyForRegistration.gotoStep('registration');
      await onboardingReadyForRegistration.passwordInput.fill('validPassword123');
      await expect(onboardingReadyForRegistration.passwordInput).toHaveValue('validPassword123');
    });

    test('should handle numeric value inputs correctly', async ({ onboardingWithPersonalInfo }) => {
      await onboardingWithPersonalInfo.gotoStep('income');
      
      const testValue = '5000';
      await onboardingWithPersonalInfo.monthlyIncomeInput.fill(testValue);
      await expect(onboardingWithPersonalInfo.monthlyIncomeInput).toHaveValue(testValue);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle large numeric values', async ({ onboardingWithPersonalInfo }) => {
      await onboardingWithPersonalInfo.gotoStep('income');
      
      const largeValue = '999999';
      await onboardingWithPersonalInfo.monthlyIncomeInput.fill(largeValue);
      await expect(onboardingWithPersonalInfo.monthlyIncomeInput).toHaveValue(largeValue);
    });

    test('should handle special characters in email', async ({ onboardingReadyForRegistration }) => {
      await onboardingReadyForRegistration.gotoStep('registration');
      
      const specialEmail = 'test+special@example.co.uk';
      await onboardingReadyForRegistration.emailInput.fill(specialEmail);
      await expect(onboardingReadyForRegistration.emailInput).toHaveValue(specialEmail);
    });
  });

  test.describe('Registration Process Setup', () => {
    test('should display registration form with proper fields', async ({ onboardingReadyForRegistration }) => {
      await onboardingReadyForRegistration.gotoStep('registration');
      await onboardingReadyForRegistration.expectRegistrationFormVisible();
      
      // Verify form fields are present
      await expect(onboardingReadyForRegistration.emailInput).toBeVisible();
      await expect(onboardingReadyForRegistration.passwordInput).toBeVisible();
    });

    test('should prepare for registration after complete flow', async ({ onboardingPage }) => {
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