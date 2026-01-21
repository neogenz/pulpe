import { test as setup } from '@playwright/test';
import { setupAuthBypass } from './utils/auth-bypass';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Setup auth bypass with API mocks for critical path tests
  // Note: This creates a mocked session, not a real login
  await setupAuthBypass(page, { 
    includeApiMocks: true, 
    setLocalStorage: true // Enable localStorage for session persistence
  });
  
  // Navigate and save mocked auth state for critical path tests
  await page.goto('/dashboard');
  await page.context().storageState({ path: authFile });
});