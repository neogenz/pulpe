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

    // Validate and sanitize data before injection
    const sanitizedFirstName = typeof validOnboardingData.firstName === 'string' 
      ? validOnboardingData.firstName.slice(0, 100) 
      : 'Test User';

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
    }, sanitizedFirstName);

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

    // Validate and sanitize data before injection
    const sanitizedData = {
      firstName: typeof validOnboardingData.firstName === 'string' 
        ? validOnboardingData.firstName.slice(0, 100) 
        : 'Test User',
      monthlyIncome: typeof validOnboardingData.monthlyIncome === 'number' && validOnboardingData.monthlyIncome >= 0
        ? validOnboardingData.monthlyIncome
        : 5000
    };

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
      sanitizedData,
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

    // Validate and sanitize all onboarding data before injection
    const sanitizedData = {
      firstName: typeof validOnboardingData.firstName === 'string' 
        ? validOnboardingData.firstName.slice(0, 100) 
        : 'Test User',
      monthlyIncome: typeof validOnboardingData.monthlyIncome === 'number' && validOnboardingData.monthlyIncome >= 0
        ? validOnboardingData.monthlyIncome
        : 5000,
      housingCosts: typeof validOnboardingData.housingCosts === 'number' && validOnboardingData.housingCosts >= 0
        ? validOnboardingData.housingCosts
        : 0,
      healthInsurance: typeof validOnboardingData.healthInsurance === 'number' && validOnboardingData.healthInsurance >= 0
        ? validOnboardingData.healthInsurance
        : 0,
      phonePlan: typeof validOnboardingData.phonePlan === 'number' && validOnboardingData.phonePlan >= 0
        ? validOnboardingData.phonePlan
        : 0,
      transportCosts: typeof validOnboardingData.transportCosts === 'number' && validOnboardingData.transportCosts >= 0
        ? validOnboardingData.transportCosts
        : 0,
      leasingCredit: typeof validOnboardingData.leasingCredit === 'number' && validOnboardingData.leasingCredit >= 0
        ? validOnboardingData.leasingCredit
        : 0,
    };

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
    }, sanitizedData);

    await use(onboardingPage);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper function to set up minimal onboarding state in localStorage
 * Useful for tests that need basic prerequisites without full fixtures
 */
export async function setupMinimalOnboardingState(
  page: import('@playwright/test').Page,
  data: { firstName?: string; monthlyIncome?: number } = {}
) {
  // Validate input data to prevent injection
  const sanitizedData = {
    firstName: typeof data.firstName === 'string' ? data.firstName.slice(0, 100) : 'Test User',
    monthlyIncome: typeof data.monthlyIncome === 'number' && data.monthlyIncome >= 0 ? data.monthlyIncome : null
  };

  await page.evaluate((stateData) => {
    localStorage.setItem('pulpe-onboarding-data', JSON.stringify({
      firstName: stateData.firstName,
      monthlyIncome: stateData.monthlyIncome,
      email: '',
      housingCosts: null,
      healthInsurance: null,
      phonePlan: null,
      transportCosts: null,
      leasingCredit: null,
      isUserCreated: false
    }));
  }, sanitizedData);
}
