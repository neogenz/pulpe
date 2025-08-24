import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Mock auth
  await page.addInitScript(() => {
    (window as any).__E2E_AUTH_BYPASS__ = true;
    (window as any).__E2E_MOCK_AUTH_STATE__ = {
      user: { id: 'test-user', email: 'test@example.com' },
      session: { access_token: 'mock-token', user: { id: 'test-user', email: 'test@example.com' } },
      isLoading: false,
      isAuthenticated: true
    };
  });

  // Mock API basique
  await page.route('**/api/**', route => 
    route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) })
  );
  
  // Navigate et sauver
  await page.goto('/app/current-month');
  await page.context().storageState({ path: authFile });
});