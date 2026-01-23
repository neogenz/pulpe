import type { Page, Route } from '@playwright/test';
import type { E2ETestWindow } from '../types/e2e.types';
import { TEST_CONFIG } from '../config/test-config';
import { MOCK_API_RESPONSES } from '../mocks/api-responses';

/**
 * Tour IDs that match the ProductTourService.
 * We define them here to avoid importing Angular code into Playwright.
 */
const TOUR_IDS = ['intro', 'current-month', 'budget-list', 'budget-details', 'templates-list'] as const;

/**
 * Shared utility for E2E auth bypass setup
 * Consolidates the auth bypass logic used in both setup and fixtures
 */
export async function setupAuthBypass(page: Page, options: {
  includeApiMocks?: boolean;
  setLocalStorage?: boolean;
} = {}) {
  const { includeApiMocks = true, setLocalStorage = false } = options;

  // Inject E2E auth bypass
  await page.addInitScript((config) => {
    const e2eWindow = window as unknown as E2ETestWindow;
    e2eWindow.__E2E_AUTH_BYPASS__ = true;
    e2eWindow.__E2E_MOCK_AUTH_STATE__ = {
      user: {
        id: config.USER.ID,
        email: config.USER.EMAIL
      },
      session: {
        access_token: config.TOKENS.ACCESS,
        user: {
          id: config.USER.ID,
          email: config.USER.EMAIL
        }
      },
      isLoading: false,
      isAuthenticated: true
    };

    // Only set localStorage if explicitly requested (for fixtures)
    if (config.setLocalStorage) {
      localStorage.setItem('auth_token', config.TOKENS.ACCESS);
    }

    // Disable product tours in E2E tests by marking them as already seen
    // Key format matches ProductTourService: pulpe-tour-{tourId} (device-scoped)
    for (const tourId of config.tourIds) {
      localStorage.setItem(`pulpe-tour-${tourId}`, 'true');
    }
  }, { ...TEST_CONFIG, setLocalStorage, tourIds: TOUR_IDS });

  // Setup API mocks if requested
  if (includeApiMocks) {
    await setupApiMocks(page);
  }
}

/**
 * Setup only the maintenance status mock
 * Used for ALL tests (including unauthenticated) to prevent maintenance mode blocking navigation
 */
export async function setupMaintenanceMock(page: Page) {
  await page.route('**/maintenance/status', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ maintenanceMode: false, message: null })
    });
  });
}

/**
 * Setup API mocks for E2E testing
 * Uses route.fallback() to allow test-specific routes to override these defaults
 */
export async function setupApiMocks(page: Page) {
  await page.route('**/api/v1/**', (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Maintenance status endpoint - must return false to allow normal navigation
    if (url.includes('maintenance/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ maintenanceMode: false, message: null })
      });
    }

    // Auth endpoints
    if (url.includes('auth')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.auth)
      });
    }

    // Budget exists endpoint (for hasBudgetGuard - must check BEFORE other budget endpoints)
    if (url.includes('budgets/exists')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasBudget: true }),
      });
    }

    // Budget details endpoint (must check BEFORE budget list due to url.includes)
    if (url.includes('budgets') && url.includes('/details')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.budgetDetails),
      });
    }

    // Budget list endpoint
    if (url.includes('budgets')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.budgets),
      });
    }

    // User settings endpoint
    if (url.includes('users/settings')) {
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { payDayOfMonth: null },
          }),
        });
      }
      if (method === 'PUT') {
        // Echo back the payload for PUT requests
        const body = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: body,
          }),
        });
      }
    }

    // Template endpoints - handle different patterns
    if (url.includes('budget-templates')) {
      // Template lines endpoint: /api/v1/budget-templates/{id}/lines
      if (url.match(/budget-templates\/[^/]+\/lines/)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_API_RESPONSES.templateLines)
        });
      }

      // Single template endpoint: /api/v1/budget-templates/{id}
      if (url.match(/budget-templates\/[^/]+$/)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_API_RESPONSES.templateDetail)
        });
      }

      // Template list endpoint: /api/v1/budget-templates
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.templates)
      });
    }

    // Success for mutations (POST/PUT/DELETE)
    if (method !== 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.success)
      });
    }

    // For unhandled GET routes, fall back to allow test-specific handlers
    return route.fallback();
  });
}