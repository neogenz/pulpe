import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { OnboardingPage } from '../pages/onboarding.page';
import { CurrentMonthPage } from '../pages/current-month.page';
import { BudgetTemplatesPage } from '../pages/budget-templates.page';

// Types pour nos fixtures
type AppFixtures = {
  loginPage: LoginPage;
  onboardingPage: OnboardingPage;
  currentMonthPage: CurrentMonthPage;
  budgetTemplatesPage: BudgetTemplatesPage;
  authenticatedPage: Page;
};

// Étendre le test de base avec nos fixtures personnalisées
export const test = base.extend<AppFixtures>({
  // Page Object pour Login
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  // Page Object pour Onboarding
  onboardingPage: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },

  // Page Object pour Current Month
  currentMonthPage: async ({ page }, use) => {
    await use(new CurrentMonthPage(page));
  },

  // Page Object pour Budget Templates
  budgetTemplatesPage: async ({ page }, use) => {
    await use(new BudgetTemplatesPage(page));
  },

  // Page avec authentification mockée - SIMPLE et EFFICACE
  authenticatedPage: async ({ page }, use) => {
    // Mock auth avant toute navigation
    await page.addInitScript(() => {
      window.__E2E_AUTH_BYPASS__ = true;
      window.__E2E_MOCK_AUTH_STATE__ = {
        user: {
          id: 'test-user',
          email: 'test@example.com',
          aud: 'authenticated',
        },
        session: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'test-user', email: 'test@example.com' },
        },
        isLoading: false,
        isAuthenticated: true,
      };
    });

    // Mock toutes les API calls d'auth
    await page.route('**/auth/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'test-user' },
        }),
      }),
    );

    // Mock les API backend
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], message: 'Mock response' }),
      }),
    );

    await use(page);
  },
});

export { expect } from '@playwright/test';
