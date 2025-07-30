import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { OnboardingPage } from '../pages/onboarding.page';
import { CurrentMonthPage } from '../pages/current-month.page';
import { BudgetTemplatesPage } from '../pages/budget-templates.page';
import { BudgetDetailsPage } from '../pages/budget-details.page';
import { AuthMockHelper, TestDataFactory } from './test-helpers';

// Types pour nos fixtures améliorées
interface AppFixtures {
  loginPage: LoginPage;
  onboardingPage: OnboardingPage;
  currentMonthPage: CurrentMonthPage;
  budgetTemplatesPage: BudgetTemplatesPage;
  budgetDetailsPage: BudgetDetailsPage;
  authenticatedPage: Page;
  authFailurePage: Page;
  serverErrorPage: Page;
  testCredentials: {
    valid: { email: string; password: string };
    invalid: { email: string; password: string };
  };
}

// Base test avec beforeEach/afterEach pour l'isolation
const baseTest = base.extend<AppFixtures>({
  // Factory pour les credentials de test
  testCredentials: async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    {},
    use,
  ) => {
    await use({
      valid: TestDataFactory.createValidLoginCredentials(),
      invalid: TestDataFactory.createInvalidLoginCredentials(),
    });
  },

  // Page Object pour Login avec navigation automatique
  loginPage: async ({ page }, use, testInfo) => {
    const loginPage = new LoginPage(page);

    // Automatiquement aller à la page de login avant chaque test
    await loginPage.goto();

    // Vérifier les éléments de login seulement si on est sur la page de login
    if (page.url().includes('/login')) {
      await loginPage.expectLoginFormVisible();
    }

    await use(loginPage);

    // Cleanup après le test si nécessaire
    await testInfo.attach('page-state', {
      body: `Test completed on page: ${page.url()}`,
      contentType: 'text/plain',
    });
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

  // Page Object pour Budget Details
  budgetDetailsPage: async ({ page }, use) => {
    await use(new BudgetDetailsPage(page));
  },

  // Page avec authentification mockée - utilise AuthMockHelper
  authenticatedPage: async ({ page }, use) => {
    await AuthMockHelper.setupAuthScenario(page, 'SUCCESS');

    // Mock les API backend pour éviter les erreurs
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], message: 'Mock response' }),
      }),
    );

    await use(page);
  },

  // Page avec échec d'authentification mocké
  authFailurePage: async ({ page }, use) => {
    await AuthMockHelper.setupAuthScenario(page, 'FAILURE');
    await use(page);
  },

  // Page avec erreur serveur mockée
  serverErrorPage: async ({ page }, use) => {
    await AuthMockHelper.setupAuthScenario(page, 'SERVER_ERROR');
    await use(page);
  },
});

// Test étendu avec gestion d'isolation automatique
export const test = baseTest.extend({
  page: async ({ page }, use, testInfo) => {
    // BeforeEach automatique : isoler le test
    await page.goto('/'); // Page neutre
    await page.evaluate(() => {
      // Nettoyer le localStorage et sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      // Supprimer les cookies
      document.cookie.split(';').forEach((cookie) => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    });

    await use(page);

    // AfterEach automatique : capturer l'état en cas d'échec
    if (testInfo.status === 'failed') {
      await testInfo.attach('screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      await testInfo.attach('console-logs', {
        body: JSON.stringify(
          page.context().serviceWorkers().length > 0
            ? 'Service workers active'
            : 'No service workers',
        ),
        contentType: 'application/json',
      });
    }
  },
});

export { expect } from '@playwright/test';
