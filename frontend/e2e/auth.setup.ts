import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { getTestCredentials } from './utils/env-check';
import { AuthMockHelper } from './fixtures/test-helpers';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  console.log('🔐 Starting authentication setup...');

  // Get credentials with validation
  const { email, password } = getTestCredentials();

  // Si on utilise les credentials par défaut (pas de variables d'environnement),
  // utiliser les mocks comme les autres tests
  const isUsingDefaultCredentials =
    email === 'test@example.com' && password === 'password123';

  if (isUsingDefaultCredentials) {
    console.log('🎭 Using mocked authentication for default credentials');
    await AuthMockHelper.setupAuthScenario(page, 'SUCCESS');

    // Mock les API backend pour éviter les erreurs
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], message: 'Mock response' }),
      }),
    );
  }

  // Perform authentication steps
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // Si authentification mockée et qu'on est déjà redirigé, pas besoin de login manuel
  if (isUsingDefaultCredentials && !(await loginPage.isOnLoginPage())) {
    console.log('✅ Already authenticated via mocks');
  } else {
    console.log(`📧 Logging in with: ${email}`);
    await loginPage.login(email, password);

    // Wait until the page receives the cookies and redirects
    console.log('⏳ Waiting for successful authentication...');
    await page.waitForURL(/\/app\/current-month/, { timeout: 10000 });
  }

  // Verify we're actually authenticated (not on login page)
  await expect(page.locator('h1:has-text("Login")')).toHaveCount(0);

  // Save authentication state
  console.log('💾 Saving authentication state...');
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication setup completed successfully!');
});
