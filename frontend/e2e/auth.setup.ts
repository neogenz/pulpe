import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { getTestCredentials } from './utils/env-check';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  console.log('🔐 Starting authentication setup...');

  // Get credentials with validation
  const { email, password } = getTestCredentials();

  // Perform authentication steps
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  console.log(`📧 Logging in with: ${email}`);
  await loginPage.login(email, password);

  // Wait until the page receives the cookies and redirects
  console.log('⏳ Waiting for successful authentication...');
  await page.waitForURL(/\/current-month/, { timeout: 10000 });

  // Verify we're actually authenticated
  await expect(page.locator('h1:has-text("Login")')).toHaveCount(0);

  // Save authentication state
  console.log('💾 Saving authentication state...');
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication setup completed successfully!');
});
