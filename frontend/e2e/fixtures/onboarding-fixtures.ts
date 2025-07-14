import { test as base } from '@playwright/test';
import { OnboardingPage } from '../pages/onboarding.page';
import { validOnboardingData } from './onboarding-test-data';

/**
 * Enhanced fixtures for onboarding testing following E2E best practices.
 *
 * This provides pre-configured states for different testing scenarios:
 * - onboardingPage: Clean state, no pre-existing data
 * - onboardingWithPersonalInfo: Personal info completed (firstName set)
 * - onboardingWithIncomeData: Personal info and income completed
 * - onboardingReadyForRegistration: All onboarding steps completed
 *
 * Usage:
 * - Use onboardingPage for complete flow tests
 * - Use onboardingWithPersonalInfo for income/housing/etc. step tests
 * - Use onboardingWithIncomeData for optional expense step tests
 * - Use onboardingReadyForRegistration for registration/final step tests
 */

export interface OnboardingFixtures {
  onboardingPage: OnboardingPage;
  onboardingWithPersonalInfo: OnboardingPage;
  onboardingWithIncomeData: OnboardingPage;
  onboardingReadyForRegistration: OnboardingPage;
}

export const test = base.extend<OnboardingFixtures>({
  /**
   * Clean onboarding page with no pre-existing data
   * Use for: Complete flow tests, fresh start scenarios
   */
  onboardingPage: async ({ page }, use) => {
    const onboardingPage = new OnboardingPage(page);
    // Navigate first to ensure localStorage is accessible
    await page.goto('/onboarding/welcome');
    await onboardingPage.clearLocalStorageData();
    await use(onboardingPage);
  },

  /**
   * Onboarding page with personal info completed (firstName set)
   * Use for: Income step tests, housing step tests, navigation tests
   * Allows direct navigation to income step and beyond
   */
  onboardingWithPersonalInfo: async ({ page }, use) => {
    const onboardingPage = new OnboardingPage(page);
    // Navigate first to ensure localStorage is accessible
    await page.goto('/onboarding/welcome');
    await onboardingPage.clearLocalStorageData();

    // Set up minimal state with personal info completed
    await page.evaluate((firstName) => {
      localStorage.setItem(
        'pulpe-onboarding-data',
        JSON.stringify({
          firstName: firstName,
          email: '',
          monthlyIncome: null,
          housingCosts: null,
          healthInsurance: null,
          phonePlan: null,
          transportCosts: null,
          leasingCredit: null,
          isUserCreated: false,
        }),
      );
    }, validOnboardingData.firstName);

    await use(onboardingPage);
  },

  /**
   * Onboarding page with personal info and income completed
   * Use for: Optional expense step tests (housing, health, transport, etc.)
   * Allows direct navigation to housing step and beyond
   */
  onboardingWithIncomeData: async ({ page }, use) => {
    const onboardingPage = new OnboardingPage(page);
    // Navigate first to ensure localStorage is accessible
    await page.goto('/onboarding/welcome');
    await onboardingPage.clearLocalStorageData();

    // Set up state with personal info and income completed
    await page.evaluate(
      (data) => {
        localStorage.setItem(
          'pulpe-onboarding-data',
          JSON.stringify({
            firstName: data.firstName,
            email: '',
            monthlyIncome: data.monthlyIncome,
            housingCosts: null,
            healthInsurance: null,
            phonePlan: null,
            transportCosts: null,
            leasingCredit: null,
            isUserCreated: false,
          }),
        );
      },
      {
        firstName: validOnboardingData.firstName,
        monthlyIncome: validOnboardingData.monthlyIncome,
      },
    );

    await use(onboardingPage);
  },

  /**
   * Onboarding page with all required data completed
   * Use for: Registration step tests, final form validation
   * Ready for registration step testing
   */
  onboardingReadyForRegistration: async ({ page }, use) => {
    const onboardingPage = new OnboardingPage(page);
    // Navigate first to ensure localStorage is accessible
    await page.goto('/onboarding/welcome');
    await onboardingPage.clearLocalStorageData();

    // Set up complete onboarding data
    await page.evaluate((data) => {
      localStorage.setItem(
        'pulpe-onboarding-data',
        JSON.stringify({
          firstName: data.firstName,
          email: '',
          monthlyIncome: data.monthlyIncome,
          housingCosts: data.housingCosts,
          healthInsurance: data.healthInsurance,
          phonePlan: data.phonePlan,
          transportCosts: data.transportCosts,
          leasingCredit: data.leasingCredit,
          isUserCreated: false,
        }),
      );
    }, validOnboardingData);

    await use(onboardingPage);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper function to set up minimal onboarding state in localStorage
 * Useful for tests that need basic prerequisites without full fixtures
 */
export async function setupMinimalOnboardingState(
  page: any,
  data: { firstName?: string; monthlyIncome?: number } = {}
) {
  await page.evaluate((stateData) => {
    localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
      firstName: stateData.firstName || 'Test User',
      monthlyIncome: stateData.monthlyIncome || null,
      email: '',
      housingCosts: null,
      healthInsurance: null,
      phonePlan: null,
      transportCosts: null,
      leasingCredit: null,
      isUserCreated: false
    }));
  }, data);
}
