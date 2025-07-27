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

  static #mockSuccessfulAuth = async (page: Page): Promise<void> => {
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
    USER_MENU: 'mat-menu, [role="menu"], [data-testid="user-menu"]',
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
