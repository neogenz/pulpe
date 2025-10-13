import type { Page } from '@playwright/test';
import type { E2EWindow } from '../types/e2e.types';

/**
 * Setup E2E bypass for demo mode
 *
 * Allows tests to skip Turnstile verification and backend demo session creation
 * by directly injecting a mock demo session into the window.
 *
 * This bypass works in conjunction with the __E2E_DEMO_BYPASS__ flag that's
 * checked in demo-initializer.service.ts
 */
export async function setupDemoBypass(page: Page, options: {
  userId?: string;
  userEmail?: string;
  accessToken?: string;
  refreshToken?: string;
} = {}): Promise<void> {
  const {
    userId = 'e2e-demo-user-' + Date.now(),
    userEmail = 'demo@e2e.test',
    accessToken = 'e2e-demo-access-token',
    refreshToken = 'e2e-demo-refresh-token',
  } = options;

  await page.addInitScript(
    ({ userId, userEmail, accessToken, refreshToken }) => {
      const w = window as unknown as E2EWindow;
      w.__E2E_DEMO_BYPASS__ = true;
      w.__E2E_DEMO_SESSION__ = {
        user: { id: userId, email: userEmail },
        access_token: accessToken,
        refresh_token: refreshToken,
      };
    },
    { userId, userEmail, accessToken, refreshToken }
  );
}
