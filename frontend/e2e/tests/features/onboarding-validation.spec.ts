import { test, expect } from '../../fixtures/test-fixtures';
import { OnboardingPage } from '../../pages/onboarding.page';
import { validOnboardingData } from '../../fixtures/onboarding-test-data';

test.describe('Onboarding Form Validation', () => {
  let onboardingPage: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboardingPage = new OnboardingPage(page);
    await onboardingPage.clearLocalStorageData();
  });

  test.describe('Input Field Validation', () => {
    test('should accept valid first names', async () => {
      await onboardingPage.gotoStep('personal-info');
      
      const validNames = ['Jean', 'Marie-Claire', 'Jean-Baptiste', 'Anne'];
      
      for (const validName of validNames) {
        await onboardingPage.firstNameInput.fill(validName);
        await expect(onboardingPage.firstNameInput).toHaveValue(validName);
      }
    });

    test('should accept valid email formats', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+tag@example.org',
        'user123@test-domain.com'
      ];
      
      for (const email of validEmails) {
        await onboardingPage.emailInput.fill(email);
        await expect(onboardingPage.emailInput).toHaveValue(email);
      }
    });

    test('should accept valid passwords', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      
      const validPasswords = [
        'Password123!',
        'SecurePass456',
        'MyStrongP@ssw0rd',
        'Test123456'
      ];
      
      for (const password of validPasswords) {
        await onboardingPage.passwordInput.fill(password);
        await expect(onboardingPage.passwordInput).toHaveValue(password);
      }
    });
  });

  test.describe('Numeric Input Validation', () => {
    test('should accept valid income values', async () => {
      // Set up required data to access income step
      await onboardingPage.page.evaluate(() => {
        localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
          firstName: 'Test User',
          monthlyIncome: null,
          email: '',
          housingCosts: null,
          healthInsurance: null,
          phonePlan: null,
          transportCosts: null,
          leasingCredit: null,
          isUserCreated: false
        }));
      });
      
      await onboardingPage.gotoStep('income');
      
      const validIncomes = ['1500', '5000', '10000', '15000'];
      
      for (const income of validIncomes) {
        await onboardingPage.monthlyIncomeInput.fill(income);
        await expect(onboardingPage.monthlyIncomeInput).toHaveValue(income);
      }
    });

    test('should accept zero values for optional expenses', async () => {
      // Set up required data for accessing steps after income
      await onboardingPage.page.evaluate(() => {
        localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
          firstName: 'Test User',
          monthlyIncome: 5000, // Required for steps after income
          email: '',
          housingCosts: null,
          healthInsurance: null,
          phonePlan: null,
          transportCosts: null,
          leasingCredit: null,
          isUserCreated: false
        }));
      });
      
      const steps = [
        { step: 'housing', input: () => onboardingPage.housingCostsInput },
        { step: 'health-insurance', input: () => onboardingPage.healthInsuranceInput },
        { step: 'phone-plan', input: () => onboardingPage.phonePlanInput },
        { step: 'transport', input: () => onboardingPage.transportCostsInput },
        { step: 'leasing-credit', input: () => onboardingPage.leasingCreditInput }
      ];
      
      for (const stepInfo of steps) {
        await onboardingPage.gotoStep(stepInfo.step);
        await stepInfo.input().fill('0');
        await expect(stepInfo.input()).toHaveValue('0');
      }
    });

    test('should accept decimal values', async () => {
      // Set up required data to access income step
      await onboardingPage.page.evaluate(() => {
        localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
          firstName: 'Test User',
          monthlyIncome: null,
          email: '',
          housingCosts: null,
          healthInsurance: null,
          phonePlan: null,
          transportCosts: null,
          leasingCredit: null,
          isUserCreated: false
        }));
      });
      
      await onboardingPage.gotoStep('income');
      
      // Test decimal values - note that HTML number inputs may normalize trailing zeros
      const decimalTests = [
        { input: '1500.50', expected: '1500.50' },
        { input: '2000.75', expected: '2000.75' },
        { input: '3500.25', expected: '3500.25' }
      ];
      
      for (const test of decimalTests) {
        await onboardingPage.monthlyIncomeInput.fill(test.input);
        await expect(onboardingPage.monthlyIncomeInput).toHaveValue(test.expected);
      }
    });
  });

  test.describe('Edge Case Validation', () => {
    test('should handle very long first names', async () => {
      await onboardingPage.gotoStep('personal-info');
      
      const longName = 'Jean-Baptiste-Alexandre-Ferdinand-Maximilian-Christopher';
      await onboardingPage.firstNameInput.fill(longName);
      await expect(onboardingPage.firstNameInput).toHaveValue(longName);
    });

    test('should handle large numeric values', async () => {
      // Set up required data to access income step
      await onboardingPage.page.evaluate(() => {
        localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
          firstName: 'Test User',
          monthlyIncome: null,
          email: '',
          housingCosts: null,
          healthInsurance: null,
          phonePlan: null,
          transportCosts: null,
          leasingCredit: null,
          isUserCreated: false
        }));
      });
      
      await onboardingPage.gotoStep('income');
      
      const largeValue = '999999';
      await onboardingPage.monthlyIncomeInput.fill(largeValue);
      await expect(onboardingPage.monthlyIncomeInput).toHaveValue(largeValue);
    });

    test('should handle special characters in email', async () => {
      // Need to complete minimal required steps to access registration
      await onboardingPage.navigateToRegistrationWithMinimalData();
      
      const specialEmails = [
        'test+special@example.com',
        'user.name+tag@domain.co.uk',
        'test-user@test-domain.org'
      ];
      
      for (const email of specialEmails) {
        await onboardingPage.emailInput.fill(email);
        await expect(onboardingPage.emailInput).toHaveValue(email);
      }
    });
  });

  test.describe('Complete Flow Validation', () => {
    test('should validate complete form submission readiness', async () => {
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

  test.describe('Field Interaction Validation', () => {
    test('should handle focus and blur events correctly', async () => {
      await onboardingPage.gotoStep('personal-info');
      
      // Focus the input
      await onboardingPage.firstNameInput.focus();
      
      // Fill and blur
      await onboardingPage.firstNameInput.fill('TestName');
      await onboardingPage.firstNameInput.blur();
      
      // Value should be retained
      await expect(onboardingPage.firstNameInput).toHaveValue('TestName');
    });

    test('should handle clearing and refilling fields', async () => {
      // Set up required data to access income step
      await onboardingPage.page.evaluate(() => {
        localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
          firstName: 'Test User',
          monthlyIncome: null,
          email: '',
          housingCosts: null,
          healthInsurance: null,
          phonePlan: null,
          transportCosts: null,
          leasingCredit: null,
          isUserCreated: false
        }));
      });
      
      await onboardingPage.gotoStep('income');
      
      // Fill initial value
      await onboardingPage.monthlyIncomeInput.fill('5000');
      await expect(onboardingPage.monthlyIncomeInput).toHaveValue('5000');
      
      // Clear and refill
      await onboardingPage.monthlyIncomeInput.clear();
      await onboardingPage.monthlyIncomeInput.fill('7500');
      await expect(onboardingPage.monthlyIncomeInput).toHaveValue('7500');
    });
  });
});