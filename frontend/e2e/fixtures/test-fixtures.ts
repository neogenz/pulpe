import { test as base, type Page, type Route } from '@playwright/test';
import { LoginPage } from '../pages/auth/login.page';
import { OnboardingPage } from '../pages/onboarding.page';
import { CurrentMonthPage } from '../pages/current-month.page';
import { BudgetTemplatesPage } from '../pages/budget-templates.page';
import { BudgetDetailsPage } from '../pages/budget-details.page';
import { MainLayoutPage } from '../pages/main-layout.page';

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

  // Authenticated page - balanced between simplicity and functionality
  authenticatedPage: async ({ page }, use) => {
    // Import test config (injected as parameter to avoid bundling issues)
    const { TEST_CONFIG } = await import('../config/test-config');
    
    // Setup auth bypass with complete mock state
    await page.addInitScript((config) => {
      // Security check
      if (window.location.hostname === 'production.pulpe.com') {
        throw new Error('E2E auth bypass cannot be used in production');
      }
      
      const e2eWindow = window as typeof window & {
        __E2E_AUTH_BYPASS__: boolean;
        __E2E_MOCK_AUTH_STATE__: {
          user: { id: string; email: string };
          session: { access_token: string; user: { id: string; email: string } };
          isLoading: boolean;
          isAuthenticated: boolean;
        };
      };
      e2eWindow.__E2E_AUTH_BYPASS__ = true;
      e2eWindow.__E2E_MOCK_AUTH_STATE__ = {
        user: { id: config.USER.ID, email: config.USER.EMAIL },
        session: { 
          access_token: config.TOKENS.ACCESS, 
          user: { id: config.USER.ID, email: config.USER.EMAIL } 
        },
        isLoading: false,
        isAuthenticated: true
      };
      localStorage.setItem('auth_token', config.TOKENS.ACCESS);
    }, TEST_CONFIG);

    // Import mock responses
    const { MOCK_API_RESPONSES } = await import('../mocks/api-responses');
    
    // API mocks with minimal but complete data for tests
    await page.route('**/api/**', (route: Route) => {
      const url = route.request().url();
      const method = route.request().method();
      
      // Auth endpoints
      if (url.includes('auth')) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MOCK_API_RESPONSES.auth)
        });
      }
      
      // Budget endpoints - complete data for tests
      if (url.includes('budgets')) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MOCK_API_RESPONSES.budgets)
        });
      }
      
      // Templates for template tests
      if (url.includes('templates')) {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MOCK_API_RESPONSES.templates)
        });
      }
      
      // Success for mutations (POST/PUT/DELETE)
      if (method !== 'GET') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MOCK_API_RESPONSES.success)
        });
      }
      
      // Default empty array for other GETs
      return route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [] })
      });
    });

    await use(page);
  }
});

export { expect } from '@playwright/test';