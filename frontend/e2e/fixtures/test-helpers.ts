import { Page, Route } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

/**
 * Simple auth bypass for E2E tests with security checks
 */
export async function mockAuth(page: Page) {
  await page.addInitScript((config) => {
    // Security check to prevent use in production
    if (window.location.hostname === 'production.pulpe.com') {
      throw new Error('E2E auth bypass cannot be used in production');
    }
    
    const e2eWindow = window as typeof window & {
      __E2E_AUTH_BYPASS__: boolean;
    };
    e2eWindow.__E2E_AUTH_BYPASS__ = true;
    localStorage.setItem('auth_token', config.TOKENS.ACCESS);
  }, TEST_CONFIG);
}

/**
 * Simple API mock that returns empty data
 */
export async function mockApi(page: Page) {
  await page.route('**/api/**', (route: Route) => 
    route.fulfill({ 
      status: 200, 
      body: JSON.stringify({ data: [] }) 
    })
  );
}