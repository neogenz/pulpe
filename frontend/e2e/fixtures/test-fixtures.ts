import { test as base, type Page, type Route } from '@playwright/test';
import { LoginPage } from '../pages/auth/login.page';
import { OnboardingPage } from '../pages/onboarding.page';
import { CurrentMonthPage } from '../pages/current-month.page';
import { BudgetTemplatesPage } from '../pages/budget-templates.page';
import { BudgetDetailsPage } from '../pages/budget-details.page';
import { MainLayoutPage } from '../pages/main-layout.page';
import { setupAuthBypass } from '../utils/auth-bypass';

// Simple fixture types - only what we actually use
interface AppFixtures {
  loginPage: LoginPage;
  onboardingPage: OnboardingPage;
  currentMonthPage: CurrentMonthPage;
  budgetTemplatesPage: BudgetTemplatesPage;
  budgetDetailsPage: BudgetDetailsPage;
  mainLayoutPage: MainLayoutPage;
  authenticatedPage: Page;
}

// Simple, direct fixture extension - KISS principle
export const test = base.extend<AppFixtures>({
  // Page Objects - simple instantiation
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  onboardingPage: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },

  currentMonthPage: async ({ page }, use) => {
    await use(new CurrentMonthPage(page));
  },

  budgetTemplatesPage: async ({ page }, use) => {
    await use(new BudgetTemplatesPage(page));
  },

  budgetDetailsPage: async ({ page }, use) => {
    await use(new BudgetDetailsPage(page));
  },

  mainLayoutPage: async ({ page }, use) => {
    await use(new MainLayoutPage(page));
  },

  // Authenticated page - for feature tests with mocks
  authenticatedPage: async ({ page }, use) => {
    // Setup auth bypass with API mocks and localStorage for feature tests
    await setupAuthBypass(page, { 
      includeApiMocks: true, 
      setLocalStorage: true 
    });

    await use(page);
  }
});

export { expect } from '@playwright/test';