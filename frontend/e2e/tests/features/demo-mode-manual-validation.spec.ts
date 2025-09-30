import { test, expect, type Page } from '@playwright/test';

/**
 * Manual Demo Mode Validation
 *
 * This test manually validates the demo mode functionality step by step
 * to understand the actual behavior and identify any issues.
 */

test.describe('Demo Mode Manual Validation', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Capture console messages
    consoleLogs = [];
    consoleErrors = [];

    page.on('console', (msg) => {
      const message = `${msg.type()}: ${msg.text()}`;
      if (msg.type() === 'error') {
        consoleErrors.push(message);
      } else {
        consoleLogs.push(message);
      }
    });

    page.on('pageerror', (exception) => {
      consoleErrors.push(`Page error: ${exception.message}`);
    });
  });

  test('Manual validation - complete demo mode flow', async ({ page }) => {
    console.log('🎭 Starting manual demo mode validation...');

    // Step 1: Navigate to homepage and verify welcome page
    await page.goto('/');
    console.log('📍 Current URL after goto /:', page.url());

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/step1-homepage.png' });

    // Check what's actually on the page
    const pageTitle = await page.title();
    console.log('📄 Page title:', pageTitle);

    const bodyText = await page.locator('body').textContent();
    console.log('📝 Body text preview:', bodyText?.substring(0, 200) + '...');

    // Look for welcome page elements
    const welcomePage = page.getByTestId('onboarding-welcome-page');
    const isWelcomeVisible = await welcomePage.isVisible().catch(() => false);
    console.log('👋 Welcome page visible:', isWelcomeVisible);

    if (isWelcomeVisible) {
      // Step 2: Look for demo button
      const demoButton = page.getByTestId('welcome-demo-button');
      const isDemoButtonVisible = await demoButton.isVisible().catch(() => false);
      console.log('🎯 Demo button visible:', isDemoButtonVisible);

      if (isDemoButtonVisible) {
        const buttonText = await demoButton.textContent();
        console.log('🔤 Demo button text:', buttonText);

        // Step 3: Click demo button
        console.log('🖱️ Clicking demo button...');
        await demoButton.click();

        // Wait a bit for processing
        await page.waitForTimeout(3000);

        // Step 4: Check current URL after click
        const urlAfterClick = page.url();
        console.log('📍 URL after demo button click:', urlAfterClick);

        // Step 5: Check localStorage for demo mode activation
        const localStorageState = await page.evaluate(() => {
          const keys = Object.keys(localStorage);
          const state: any = {};
          keys.forEach(key => {
            if (key.includes('pulpe') || key.includes('demo')) {
              state[key] = localStorage.getItem(key);
            }
          });
          return state;
        });
        console.log('💾 LocalStorage state:', JSON.stringify(localStorageState, null, 2));

        // Step 6: Check for demo mode indicators
        const isDemoMode = localStorageState['pulpe-demo-mode'] === 'true';
        const isInitialized = localStorageState['pulpe-demo-initialized'] === 'true';
        console.log('🎭 Demo mode active:', isDemoMode);
        console.log('✅ Demo initialized:', isInitialized);

        // Step 7: Take screenshot of current state
        await page.screenshot({ path: 'test-results/step7-after-demo-click.png' });

        // Step 8: Check for any visible content
        const currentPageText = await page.locator('body').textContent();
        console.log('📝 Current page content preview:', currentPageText?.substring(0, 300) + '...');

        // Step 9: Look for budget-related content
        const budgetElements = await page.locator('text=/budget|Budget|prévision|Prévision|€/').count();
        console.log('💰 Budget-related elements found:', budgetElements);

        // Step 10: Check for navigation or app shell
        const appShellElements = await page.locator('nav, header, [role="navigation"], [role="banner"]').count();
        console.log('🧭 Navigation/header elements found:', appShellElements);

        // Step 11: Look for specific demo indicators
        const demoIndicators = await page.locator('text=/démo|demo|Démo|Demo/').count();
        console.log('🎭 Demo mode indicators on page:', demoIndicators);

        // Report findings
        console.log('\n📊 DEMO MODE VALIDATION SUMMARY:');
        console.log('================================');
        console.log('✅ Demo mode activation:', isDemoMode ? 'SUCCESS' : 'FAILED');
        console.log('✅ Demo initialization:', isInitialized ? 'SUCCESS' : 'FAILED');
        console.log('📍 Final URL:', urlAfterClick);
        console.log('🔢 Console errors:', consoleErrors.length);
        console.log('💾 Demo data keys:', Object.keys(localStorageState).filter(k => k.includes('demo')).length);

      } else {
        console.log('❌ Demo button not found on welcome page');
      }
    } else {
      console.log('❌ Welcome page not found');

      // Check what page we're actually on
      const currentContent = await page.locator('h1, h2, h3').textContent();
      console.log('📄 Current page heading:', currentContent);
    }

    // Always log console output
    console.log('\n📜 CONSOLE LOGS:');
    consoleLogs.forEach(log => console.log('  ', log));

    if (consoleErrors.length > 0) {
      console.log('\n❌ CONSOLE ERRORS:');
      consoleErrors.forEach(error => console.log('  ', error));
    }
  });

  test('Quick localStorage persistence check', async ({ page }) => {
    // Navigate and activate demo
    await page.goto('/');
    await page.waitForTimeout(1000);

    const welcomePage = page.getByTestId('onboarding-welcome-page');
    if (await welcomePage.isVisible().catch(() => false)) {
      const demoButton = page.getByTestId('welcome-demo-button');
      if (await demoButton.isVisible().catch(() => false)) {
        await demoButton.click();
        await page.waitForTimeout(3000);

        // Check localStorage keys
        const demoKeys = await page.evaluate(() => {
          const keys = Object.keys(localStorage);
          return keys.filter(key => key.includes('pulpe-demo') || key.includes('pulpe-current'));
        });

        console.log('🔑 Demo localStorage keys found:', demoKeys);

        // Verify specific keys exist
        const expectedKeys = [
          'pulpe-demo-mode',
          'pulpe-demo-initialized',
          'pulpe-demo-user',
          'pulpe-demo-session',
          'pulpe-demo-budgets',
          'pulpe-demo-templates'
        ];

        const missingKeys = expectedKeys.filter(key => !demoKeys.includes(key));
        const presentKeys = expectedKeys.filter(key => demoKeys.includes(key));

        console.log('✅ Present keys:', presentKeys);
        console.log('❌ Missing keys:', missingKeys);

        // Verify data content
        for (const key of presentKeys) {
          const value = await page.evaluate((k) => localStorage.getItem(k), key);
          console.log(`📊 ${key}:`, typeof value, value?.substring(0, 100) + '...');
        }
      }
    }
  });
});