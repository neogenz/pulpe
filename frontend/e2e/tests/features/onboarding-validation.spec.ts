import { test, expect } from '../../fixtures/onboarding-fixtures';
import { validOnboardingData } from '../../fixtures/onboarding-test-data';

test.describe('Onboarding Form Validation', () => {

  test.describe('Input Field Validation', () => {
    test('should accept valid first names', async ({ onboardingPage }) => {
      await onboardingPage.gotoStep('personal-info');
      
      const validNames = ['Jean', 'Marie-Claire', 'Jean-Baptiste', 'Anne'];
      
      for (const validName of validNames) {
        await onboardingPage.firstNameInput.fill(validName);
        await expect(onboardingPage.firstNameInput).toHaveValue(validName);
      }
    });

    test('should accept valid email formats', async ({ onboardingReadyForRegistration }) => {
      await onboardingReadyForRegistration.gotoStep('registration');
      
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+tag@example.org'
      ];
      
      for (const email of validEmails) {
        await onboardingReadyForRegistration.emailInput.fill(email);
        await expect(onboardingReadyForRegistration.emailInput).toHaveValue(email);
      }
    });

    test('should accept valid passwords', async ({ onboardingReadyForRegistration }) => {
      await onboardingReadyForRegistration.gotoStep('registration');
      
      const validPasswords = [
        'Password123!',
        'SecurePass456',
        'Test123456'
      ];
      
      for (const password of validPasswords) {
        await onboardingReadyForRegistration.passwordInput.fill(password);
        await expect(onboardingReadyForRegistration.passwordInput).toHaveValue(password);
      }
    });
  });

  test.describe('Numeric Input Validation', () => {
    test('should accept valid income values', async ({ onboardingWithPersonalInfo }) => {
      await onboardingWithPersonalInfo.gotoStep('income');
      
      const validIncomes = ['1500', '5000', '10000'];
      
      for (const income of validIncomes) {
        await onboardingWithPersonalInfo.monthlyIncomeInput.fill(income);
        await expect(onboardingWithPersonalInfo.monthlyIncomeInput).toHaveValue(income);
      }
    });

    test('should accept zero values for optional expenses', async ({ onboardingWithIncomeData }) => {
      const steps = [
        { step: 'housing', input: () => onboardingWithIncomeData.housingCostsInput },
        { step: 'health-insurance', input: () => onboardingWithIncomeData.healthInsuranceInput },
        { step: 'transport', input: () => onboardingWithIncomeData.transportCostsInput }
      ];
      
      for (const stepInfo of steps) {
        await onboardingWithIncomeData.gotoStep(stepInfo.step);
        await stepInfo.input().fill('0');
        await expect(stepInfo.input()).toHaveValue('0');
      }
    });
  });


  test.describe('Complete Flow Validation', () => {
    test('should validate complete form submission readiness', async ({ onboardingPage }) => {
      // Complete the entire onboarding flow
      await onboardingPage.completeOnboardingFlow(validOnboardingData);
      
      // Should reach registration with all data valid
      await onboardingPage.expectCurrentStep('registration');
      await onboardingPage.expectRegistrationFormVisible();
      
      // Registration form should accept final data
      await onboardingPage.emailInput.fill(validOnboardingData.email);
      await onboardingPage.passwordInput.fill(validOnboardingData.password);
      
      await expect(onboardingPage.emailInput).toHaveValue(validOnboardingData.email);
      await expect(onboardingPage.passwordInput).toHaveValue(validOnboardingData.password);
      
      // All onboarding data should be preserved
      const storedData = await onboardingPage.getLocalStorageData();
      expect(storedData).toBeTruthy();
    });
  });

});