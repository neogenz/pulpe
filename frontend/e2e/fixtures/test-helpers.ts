import { Page, expect } from '@playwright/test';
import { TEST_USERS } from './test-data';

// Enum pour les types d'authentification
type AuthScenario = 'SUCCESS' | 'FAILURE' | 'SERVER_ERROR';

// Helper pour configurer les mocks d'authentification
export class AuthMockHelper {
  static async setupAuthScenario(
    page: Page,
    scenario: AuthScenario,
  ): Promise<void> {
    switch (scenario) {
      case 'SUCCESS':
        await this.#mockSuccessfulAuth(page);
        break;
      case 'FAILURE':
        await this.#mockFailedAuth(page);
        break;
      case 'SERVER_ERROR':
        await this.#mockServerError(page);
        break;
    }
  }

  static async resetAuthState(page: Page): Promise<void> {
    await page.evaluate(() => {
      if (window.__E2E_RESET_AUTH_STATE__) {
        window.__E2E_RESET_AUTH_STATE__();
      }
    });
  }

  static #mockSuccessfulAuth = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
      window.__E2E_AUTH_BYPASS__ = true;
      window.__E2E_MOCK_AUTH_STATE__ = {
        user: {
          id: 'test-user',
          email: 'test@example.com',
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          role: 'authenticated',
        },
        session: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: { 
            id: 'test-user', 
            email: 'test@example.com',
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
            role: 'authenticated',
          },
        },
        isLoading: false,
        isAuthenticated: true,
      };
      
      // Fonction utilitaire pour resettre l'état
      window.__E2E_RESET_AUTH_STATE__ = () => {
        window.__E2E_MOCK_AUTH_STATE__ = {
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        };
      };
    });

    await page.route('**/auth/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: {
            id: 'test-user',
            email: TEST_USERS.VALID_USER.email,
            name: `${TEST_USERS.VALID_USER.firstName} ${TEST_USERS.VALID_USER.lastName}`,
          },
          expires_in: 3600,
        }),
      }),
    );
  };

  static #mockFailedAuth = async (page: Page): Promise<void> => {
    await page.route('**/auth/**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials',
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect',
        }),
      });
    });
  };

  static #mockServerError = async (page: Page): Promise<void> => {
    await page.route('**/auth/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          code: 'SERVER_ERROR',
          message: "Une erreur inattendue s'est produite",
        }),
      });
    });
  };
}

// Helper pour les attentes robustes
export class WaitHelper {
  static async waitForNavigation(
    page: Page,
    expectedUrlPattern: RegExp | string,
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    try {
      if (typeof expectedUrlPattern === 'string') {
        await page.waitForURL((url) => url.href.includes(expectedUrlPattern), {
          timeout: timeoutMs,
        });
      } else {
        await page.waitForURL(expectedUrlPattern, { timeout: timeoutMs });
      }
      return true;
    } catch {
      return false;
    }
  }

  static async waitForElementStateChange(
    page: Page,
    selector: string,
    state: 'visible' | 'hidden' | 'attached' | 'detached',
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    try {
      await page.locator(selector).waitFor({ state, timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  static async waitForNetworkResponse(
    page: Page,
    urlPattern: string,
    statusCode: number = 200,
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    try {
      const response = await page.waitForResponse(
        (response) =>
          response.url().includes(urlPattern) &&
          response.status() === statusCode,
        { timeout: timeoutMs },
      );
      return response.ok();
    } catch {
      return false;
    }
  }
}

// Helper pour les assertions soft et groupées
export class AssertionHelper {
  static async softAssertFormValidation(
    page: Page,
    emailSelector: string,
    passwordSelector: string,
    submitSelector: string,
  ): Promise<void> {
    await expect
      .soft(page.locator(emailSelector), 'Email input should be visible')
      .toBeVisible();
    await expect
      .soft(page.locator(passwordSelector), 'Password input should be visible')
      .toBeVisible();
    await expect
      .soft(page.locator(submitSelector), 'Submit button should be visible')
      .toBeVisible();
  }

  static async softAssertLoginError(
    page: Page,
    shouldHaveError: boolean = true,
  ): Promise<void> {
    const errorLocator = page.locator(SELECTORS.LOGIN.ERROR_MESSAGE);
    if (shouldHaveError) {
      await expect
        .soft(errorLocator, 'Login error should be visible')
        .toBeVisible();
      await expect
        .soft(page, 'Should remain on login page')
        .toHaveURL(/.*login.*/);
    } else {
      await expect
        .soft(errorLocator, 'Login error should not be visible')
        .not.toBeVisible();
    }
  }

  static async softAssertPageResponsiveness(page: Page): Promise<void> {
    await expect
      .soft(page.locator('body'), 'Page body should be visible')
      .toBeVisible();
    await expect
      .soft(page.locator('html'), 'Page should be interactive')
      .toBeEnabled();
  }
}

// Constantes pour les sélecteurs robustes avec fallbacks CSS
export const SELECTORS = {
  LOGIN: {
    FORM: 'form, [data-testid="login-form"]',
    EMAIL_INPUT:
      'input[formControlName="email"], input[type="email"], [data-testid="email-input"]',
    PASSWORD_INPUT:
      'input[formControlName="password"], input[type="password"], [data-testid="password-input"]',
    SUBMIT_BUTTON:
      'button[type="submit"], button[mat-flat-button], [data-testid="login-submit"]',
    ERROR_MESSAGE:
      '.error, .mat-error, .alert-error, [data-testid="login-error"]',
    TITLE: 'h1, h2, mat-card-title, .title, [data-testid="login-title"]',
  },
  NAVIGATION: {
    ONBOARDING_LINK:
      'a:has-text("onboarding"), [data-testid="onboarding-link"]',
    BACK_BUTTON: 'button:has-text("Retour"), [data-testid="back-button"]',
  },
  LAYOUT: {
    USER_MENU_TRIGGER:
      '[data-testid="user-menu-trigger"], .toolbar-logo-button',
    USER_MENU: '.mat-mdc-menu-panel[role="menu"]',
    LOGOUT_BUTTON:
      '[data-testid="logout-button"], button:has-text("Se déconnecter"), button:has-text("Logout")',
    MAIN_TOOLBAR: 'mat-toolbar, [data-testid="main-toolbar"]',
  },
  COMMON: {
    LOADING_SPINNER: '.spinner, .loading, [data-testid="loading-spinner"]',
    SUCCESS_MESSAGE:
      '.success, .alert-success, [data-testid="success-message"]',
    ERROR_MESSAGE: '.error, .alert-error, [data-testid="error-message"]',
    FORM_VALIDATION_ERROR:
      '.error, .mat-error, [data-testid="form-validation-error"]',
  },
} as const;

// Factory pour créer des données de test cohérentes
export class TestDataFactory {
  static createValidLoginCredentials() {
    return {
      email: TEST_USERS.VALID_USER.email,
      password: TEST_USERS.VALID_USER.password,
    };
  }

  static createInvalidLoginCredentials() {
    return {
      email: TEST_USERS.INVALID_USER.email,
      password: TEST_USERS.INVALID_USER.password,
    };
  }

  static createUserProfile() {
    return {
      firstName: TEST_USERS.VALID_USER.firstName,
      lastName: TEST_USERS.VALID_USER.lastName,
      email: TEST_USERS.VALID_USER.email,
      fullName: `${TEST_USERS.VALID_USER.firstName} ${TEST_USERS.VALID_USER.lastName}`,
    };
  }

  static createBudgetTemplateData() {
    return {
      id: 'test-template-id',
      name: 'Test Template',
      description: 'A test template for E2E testing',
      isDefault: false,
      income: 5000,
      expenses: 2000,
      savings: 3000,
      transactions: [
        {
          id: 'transaction-1',
          name: 'Test Income',
          amount: 5000,
          transactionType: 'income',
          recurrenceType: 'fixed',
        },
        {
          id: 'transaction-2',
          name: 'Test Expense',
          amount: 2000,
          transactionType: 'expense',
          recurrenceType: 'fixed',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

// Helper pour mocker les appels API
export class ApiMockHelper {
  static async mockBudgetTemplatesApi(page: Page, templates: any[] = []) {
    await page.route('**/api/v1/budget-templates', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: templates })
        });
      } else {
        await route.continue();
      }
    });
  }

  static async mockBudgetTemplateDetailsApi(page: Page, templateId: string, templateData: any) {
    await page.route(`**/api/v1/budget-templates/${templateId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(templateData)
      });
    });
  }

  static async mockApiError(page: Page, endpoint: string, status = 500) {
    await page.route(endpoint, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'API Error' })
      });
    });
  }
}

// Helper pour les mocks d'API Budget et Transaction
export class BudgetApiMockHelper {
  static async setupBudgetScenario(
    page: Page,
    scenario: 'WITH_BUDGET' | 'EMPTY_STATE' | 'SERVER_ERROR'
  ): Promise<void> {
    switch (scenario) {
      case 'WITH_BUDGET':
        await this.#mockBudgetWithData(page);
        break;
      case 'EMPTY_STATE':
        await this.#mockEmptyBudget(page);
        break;
      case 'SERVER_ERROR':
        await this.#mockBudgetServerError(page);
        break;
    }
  }

  static #mockBudgetWithData = async (page: Page): Promise<void> => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const mockBudget = {
      id: 'test-budget-123',
      name: 'Budget Test',
      month: currentMonth,
      year: currentYear,
      templateId: 'test-template-123',
      userId: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockBudgetLines = [
      {
        id: 'line-1',
        budgetId: 'test-budget-123',
        templateLineId: 'template-line-1',
        name: 'Salaire',
        amount: 6500,
        kind: 'income',
        recurrence: 'fixed',
        category: null,
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'line-2',
        budgetId: 'test-budget-123',
        templateLineId: 'template-line-2',
        name: 'Loyer',
        amount: 1800,
        kind: 'expense',
        recurrence: 'fixed',
        category: 'housing',
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'line-3',
        budgetId: 'test-budget-123',
        templateLineId: 'template-line-3',
        name: 'Épargne générale',
        amount: 500,
        kind: 'saving',
        recurrence: 'fixed',
        category: null,
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    const mockTransactions = [
      {
        id: 'transaction-1',
        budgetId: 'test-budget-123',
        name: 'Courses alimentaires',
        amount: 85.50,
        kind: 'expense',
        category: 'groceries',
        transactionDate: new Date().toISOString(),
        isOutOfBudget: false,
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'transaction-2',
        budgetId: 'test-budget-123',
        name: 'Restaurant',
        amount: 45.00,
        kind: 'expense',
        category: 'dining',
        transactionDate: new Date().toISOString(),
        isOutOfBudget: false,
        userId: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    // Mock getAllBudgets endpoint
    await page.route('**/api/v1/budgets', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [mockBudget],
            message: 'Budgets récupérés avec succès'
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock getBudgetWithDetails endpoint
    await page.route('**/api/v1/budgets/*/details', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            budget: mockBudget,
            budgetLines: mockBudgetLines,
            transactions: mockTransactions
          },
          message: 'Détails du budget récupérés avec succès'
        }),
      });
    });

    // Mock transactions endpoint for creating new transactions
    await page.route('**/api/v1/transactions', (route) => {
      if (route.request().method() === 'POST') {
        const newTransaction = {
          id: `transaction-${Date.now()}`,
          budgetId: 'test-budget-123',
          ...JSON.parse(route.request().postData() || '{}'),
          userId: 'test-user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: newTransaction,
            message: 'Transaction créée avec succès'
          }),
        });
      } else {
        route.continue();
      }
    });
  };

  static #mockEmptyBudget = async (page: Page): Promise<void> => {
    // Mock getAllBudgets endpoint - return empty array
    await page.route('**/api/v1/budgets', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [],
            message: 'Aucun budget trouvé'
          }),
        });
      } else {
        route.continue();
      }
    });
  };

  static #mockBudgetServerError = async (page: Page): Promise<void> => {
    await page.route('**/api/v1/budgets**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
          message: 'Erreur lors de la récupération des données'
        }),
      });
    });
  };
}

// Types utilitaires pour les tests
export interface TestCredentials {
  email: string;
  password: string;
}

export interface TestStepContext {
  stepName: string;
  description: string;
  data?: unknown;
}
