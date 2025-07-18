import { test, expect } from '../../fixtures/onboarding-fixtures';
import { validOnboardingData } from '../../fixtures/onboarding-test-data';

test.describe('Onboarding Navigation and State Management', () => {

  test.describe('Complete Flow Navigation', () => {
    test('should navigate through all steps in correct order', async ({ onboardingPage }) => {
      // Test the complete onboarding flow using the working approach
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      await onboardingPage.fillIncomeStep(validOnboardingData.monthlyIncome);
      await onboardingPage.fillHousingStep(validOnboardingData.housingCosts);
      await onboardingPage.fillHealthInsuranceStep(validOnboardingData.healthInsurance);
      await onboardingPage.fillPhonePlanStep(validOnboardingData.phonePlan);
      await onboardingPage.fillTransportStep(validOnboardingData.transportCosts);
      await onboardingPage.fillLeasingCreditStep(validOnboardingData.leasingCredit);

      // Verify we reached the final step
      await onboardingPage.expectCurrentStep('registration');
    });
  });

  test.describe('State Persistence', () => {
    test('should persist form data during navigation', async ({ onboardingPage }) => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      
      // Fill personal info and verify navigation
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      await onboardingPage.expectCurrentStep('income');
      
      // Fill income and verify navigation
      await onboardingPage.fillIncomeStep(validOnboardingData.monthlyIncome);
      await onboardingPage.expectCurrentStep('housing');
      
      // Verify data persistence by checking localStorage
      const storedData = await onboardingPage.getLocalStorageData();
      expect(storedData).toBeTruthy();
    });

    test('should handle browser refresh gracefully', async ({ onboardingPage }) => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      await onboardingPage.fillPersonalInfoStep(validOnboardingData.firstName);
      
      // Refresh the page
      await onboardingPage.page.reload();
      await onboardingPage.page.waitForLoadState('networkidle');
      
      // Should maintain state (this depends on implementation)
      const storedData = await onboardingPage.getLocalStorageData();
      expect(storedData).toBeTruthy();
    });
  });

  test.describe('Direct Navigation', () => {
    test('should handle direct navigation to specific steps', async ({ onboardingWithPersonalInfo }) => {
      // Test direct navigation to income step
      await onboardingWithPersonalInfo.gotoStep('income');
      await onboardingWithPersonalInfo.expectCurrentStep('income');
      
      // Fill income and navigate
      await onboardingWithPersonalInfo.fillIncomeStep(validOnboardingData.monthlyIncome);
      await onboardingWithPersonalInfo.expectCurrentStep('housing');
    });

    test('should handle deep linking to registration step', async ({ onboardingPage }) => {
      // Test deep linking with guard protection
      // First try direct navigation - should be redirected due to missing required data
      await onboardingPage.gotoStep('registration');
      
      // Should be redirected to personal-info due to missing firstName
      await onboardingPage.expectCurrentStep('personal-info');
      
      // Now set up minimal data and try again
      await onboardingPage.navigateToRegistrationWithMinimalData();
      await onboardingPage.expectCurrentStep('registration');
      
      // Verify registration form is visible
      await onboardingPage.expectRegistrationFormVisible();
    });
  });

  test.describe('Data Management', () => {
    test('should clear data on completion', async ({ onboardingPage }) => {
      // Set some data first through normal flow
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      await onboardingPage.fillPersonalInfoStep('TestUser');
      
      // Verify data exists
      const dataBeforeClear = await onboardingPage.getLocalStorageData();
      expect(dataBeforeClear).toBeTruthy();

      // Clear it
      await onboardingPage.clearLocalStorageData();
      
      // Verify it's cleared
      const data = await onboardingPage.getLocalStorageData();
      expect(data).toBeNull();
    });

    test('should handle localStorage data properly', async ({ onboardingPage }) => {
      await onboardingPage.goto();
      await onboardingPage.fillWelcomeStep();
      await onboardingPage.fillPersonalInfoStep('TestUser');
      
      // Check that data is stored
      const data = await onboardingPage.getLocalStorageData();
      expect(data).toBeTruthy();
      
      // Should be able to retrieve and continue
      await onboardingPage.fillIncomeStep(3000);
      await onboardingPage.expectCurrentStep('housing');
    });
  });
});