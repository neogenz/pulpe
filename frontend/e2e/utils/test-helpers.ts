import { Page, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-data';

// Types pour les mocks globaux
declare global {
  interface Window {
    __E2E_AUTH_BYPASS__?: boolean;
    __E2E_MOCK_AUTH_STATE__?: {
      user: { id: string; email: string; aud: string };
      session: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
        user: { id: string; email: string };
      };
      isLoading: boolean;
      isAuthenticated: boolean;
    };
    mockAuthApi?: {
      isAuthenticated: () => boolean;
      isLoading: () => boolean;
      authState: () => any;
      session: () => any;
      currentUser: () => any;
    };
    ng?: any;
  }
}

export class TestHelpers {
  constructor(private page: Page) {}

  async waitForAngularLoad(): Promise<void> {
    await this.page.waitForFunction(() => {
      return window['ng'] && window['ng'].getComponent;
    });
  }

  async loginUser(
    email = TEST_USERS.VALID_USER.email,
    password = TEST_USERS.VALID_USER.password,
  ): Promise<void> {
    await this.page.goto('/login');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.waitForNavigation();
  }

  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async expectToBeOnPage(url: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(url));
  }

  async expectElementToBeVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async expectElementToHaveText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toHaveText(text);
  }

  async fillCurrencyInput(selector: string, amount: number): Promise<void> {
    const formattedAmount = new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

    await this.page.fill(selector, formattedAmount);
  }

  async clickButton(text: string): Promise<void> {
    await this.page.click(`button:has-text("${text}")`);
  }

  async expectLoadingSpinner(): Promise<void> {
    await expect(
      this.page.locator('[data-testid="loading-spinner"]'),
    ).toBeVisible();
  }

  async expectNoLoadingSpinner(): Promise<void> {
    await expect(
      this.page.locator('[data-testid="loading-spinner"]'),
    ).not.toBeVisible();
  }

  async expectErrorMessage(message?: string): Promise<void> {
    const errorLocator = this.page.locator('[data-testid="error-message"]');
    await expect(errorLocator).toBeVisible();
    if (message) {
      await expect(errorLocator).toContainText(message);
    }
  }

  async expectSuccessMessage(message?: string): Promise<void> {
    const successLocator = this.page.locator('[data-testid="success-message"]');
    await expect(successLocator).toBeVisible();
    if (message) {
      await expect(successLocator).toContainText(message);
    }
  }

  async mockApiResponse(endpoint: string, response: object): Promise<void> {
    await this.page.route(`**/api/**${endpoint}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  async mockApiError(
    endpoint: string,
    status = 500,
    message = 'Internal Server Error',
  ): Promise<void> {
    await this.page.route(`**/api/**${endpoint}`, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ message }),
      });
    });
  }

  async mockApiEndpoint(
    endpoint: string,
    response: unknown,
    status = 200,
  ): Promise<void> {
    await this.page.route(`**${endpoint}**`, async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  async mockAuthentication(): Promise<void> {
    // Mock complet du client Supabase et de l'état d'authentification
    await this.page.addInitScript(() => {
      // Mock du localStorage Supabase avec la clé correcte
      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: 'mock-user-id',
          aud: 'authenticated',
          email: 'test@example.com',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_metadata: {},
          app_metadata: {},
        },
      };

      // Stocker la session avec la clé que Supabase utilise réellement
      const supabaseKey = `sb-${window.location.hostname.replace(/\./g, '-')}-auth-token`;
      localStorage.setItem(supabaseKey, JSON.stringify(mockSession));

      // Aussi avec la clé par défaut si différente
      localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession));
    });

    // Mock des appels réseau Supabase
    await this.page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/session')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'mock-user-id',
              email: 'test@example.com',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  async bypassAngularAuth(): Promise<void> {
    // Approche radicale : remplacer directement le service Angular d'authentification
    await this.page.addInitScript(() => {
      // Flag global pour indiquer qu'on est en mode test
      window.__E2E_AUTH_BYPASS__ = true;

      // Mock d'une session utilisateur valide
      window.__E2E_MOCK_AUTH_STATE__ = {
        user: {
          id: 'e2e-test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
        },
        session: {
          access_token: 'e2e-mock-token',
          refresh_token: 'e2e-mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'e2e-test-user-id',
            email: 'test@example.com',
          },
        },
        isLoading: false,
        isAuthenticated: true,
      };

      // Intercepter les principales méthodes du service d'auth Angular
      // Ceci sera détecté par notre AuthApi si on ajoute une vérification
      if (typeof window !== 'undefined') {
        window.mockAuthApi = {
          isAuthenticated: () => true,
          isLoading: () => false,
          authState: () => window.__E2E_MOCK_AUTH_STATE__!,
          session: () => window.__E2E_MOCK_AUTH_STATE__!.session,
          currentUser: () => window.__E2E_MOCK_AUTH_STATE__!.user,
        };
      }
    });

    // Aussi intercepter les appels réseau pour éviter les vraies requêtes
    await this.page.route('**/auth/v1/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'e2e-mock-token',
          refresh_token: 'e2e-mock-refresh',
          expires_in: 3600,
          user: { id: 'e2e-test-user-id', email: 'test@example.com' },
        }),
      });
    });
  }
}

// Fonction helper standalone pour l'authentification
export async function authenticateUser(page: Page): Promise<void> {
  const helpers = new TestHelpers(page);

  // Utiliser le bypass d'authentification
  await helpers.bypassAngularAuth();

  // Recharger la page pour que les mocks prennent effet
  await page.reload();

  // Attendre que Angular soit chargé
  await helpers.waitForAngularLoad();
}
