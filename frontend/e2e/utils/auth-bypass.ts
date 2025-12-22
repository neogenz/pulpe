import type { Page, Route } from '@playwright/test';
import type { E2EWindow } from '../types/e2e.types';
import { TEST_CONFIG } from '../config/test-config';
import { MOCK_API_RESPONSES } from '../mocks/api-responses';
import { TOUR_STORAGE_KEYS } from '../../projects/webapp/src/app/core/product-tour/product-tour.service';

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
    const e2eWindow = window as unknown as E2EWindow;
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
    for (const key of Object.values(config.tourKeys)) {
      localStorage.setItem(key, 'true');
    }
  }, { ...TEST_CONFIG, setLocalStorage, tourKeys: TOUR_STORAGE_KEYS });

  // Setup API mocks if requested
  if (includeApiMocks) {
    await setupApiMocks(page);
  }
}

/**
 * Setup API mocks for E2E testing
 */
export async function setupApiMocks(page: Page) {
  await page.route('**/api/v1/**', (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();
    
    // Auth endpoints
    if (url.includes('auth')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.auth)
      });
    }
    
    // Budget endpoints
    if (url.includes('budgets')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_API_RESPONSES.budgets)
      });
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
    
    // Default empty array for other GETs
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] })
    });
  });
}