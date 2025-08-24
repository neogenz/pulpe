import { Page, Route } from '@playwright/test';
import type { E2EWindow } from '../types/e2e.types';

/**
 * Simple auth bypass for E2E tests
 */
export async function mockAuth(page: Page) {
  await page.addInitScript(() => {
    const e2eWindow = window as E2EWindow;
    e2eWindow.__E2E_AUTH_BYPASS__ = true;
    localStorage.setItem('auth_token', 'mock-token');
  });
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