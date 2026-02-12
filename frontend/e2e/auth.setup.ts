import { test as setup } from '@playwright/test';
import { setupAuthBypass } from './utils/auth-bypass';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Setup auth bypass with API mocks for critical path tests
  // Note: This creates a mocked session, not a real login
  await setupAuthBypass(page, {
    includeApiMocks: true,
    setLocalStorage: true,
    vaultCodeConfigured: true,
  });

  // Inject a valid client key so encryptionSetupGuard allows through
  await page.addInitScript(() => {
    const validKeyHex = 'aa'.repeat(32);
    const entry = {
      version: 1,
      data: validKeyHex,
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem('pulpe-vault-client-key-session', JSON.stringify(entry));
  });
  
  // Navigate and save mocked auth state for critical path tests
  await page.goto('/dashboard');
  await page.context().storageState({ path: authFile });
});