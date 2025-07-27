import { test, expect } from '../../fixtures/test-fixtures';
import { MainLayoutPage } from '../../pages/main-layout.page';
import {
  AssertionHelper,
  WaitHelper,
  SELECTORS,
  type TestStepContext,
} from '../../fixtures/test-helpers';

// Configuration pour l'exécution en parallèle
test.describe.configure({ mode: 'parallel' });

test.describe('User Logout Functionality', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Ajout d'informations de contexte pour le debugging
    await testInfo.attach('test-environment', {
      body: JSON.stringify({
        userAgent: await page.evaluate(() => navigator.userAgent),
        viewport: await page.viewportSize(),
        url: page.url(),
      }),
      contentType: 'application/json',
    });
  });

  test.describe('Logout Menu Interaction', () => {
    test('should display user menu when clicking on toolbar logo', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate to authenticated page', async () => {
        await mainLayoutPage.navigateToApp();
        await mainLayoutPage.expectLayoutLoaded();
      });

      await test.step('Click user menu trigger', async () => {
        await mainLayoutPage.openUserMenu();
      });

      await test.step('Verify user menu is visible', async () => {
        await mainLayoutPage.expectUserMenuOpen();
      });

      await test.step('Verify logout button is present', async () => {
        const logoutButton = page.locator(SELECTORS.LAYOUT.LOGOUT_BUTTON);
        await expect
          .soft(logoutButton, 'Logout button should be visible in menu')
          .toBeVisible();
        await expect
          .soft(logoutButton, 'Logout button should contain logout text')
          .toContainText('Se déconnecter');
      });
    });

    test('should close menu when clicking outside', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate and open menu', async () => {
        await mainLayoutPage.navigateToApp();
        await mainLayoutPage.openUserMenu();
        await mainLayoutPage.expectUserMenuOpen();
      });

      await test.step('Click outside menu to close', async () => {
        // Click somewhere outside the menu
        await page.locator('body').click({ position: { x: 10, y: 10 } });

        // Wait for menu to close
        await page.waitForTimeout(500);
        await mainLayoutPage.expectUserMenuClosed();
      });
    });
  });

  test.describe('Logout Process', () => {
    test('should successfully log out user and redirect to login', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate to authenticated page', async () => {
        await mainLayoutPage.navigateToApp();
        const isOnProtectedPage = await mainLayoutPage.expectOnProtectedPage();
        await expect
          .soft(isOnProtectedPage, 'Should be on protected page initially')
          .toBeTruthy();
      });

      await test.step('Perform logout action', async () => {
        await mainLayoutPage.performLogout();
      });

      await test.step('Wait for logout redirect', async () => {
        const redirected = await mainLayoutPage.waitForLogoutRedirect(8000);
        await expect
          .soft(redirected, 'Should be redirected after logout')
          .toBeTruthy();
      });

      await test.step('Verify logout success', async () => {
        await mainLayoutPage.expectLogoutSuccess();
      });

      await test.step('Verify cannot access protected pages after logout', async () => {
        // Try to navigate to protected page
        await page.goto('/app/current-month');

        // Should be redirected back to login or onboarding
        const isOnPublicPage =
          page.url().includes('/login') || page.url().includes('/onboarding');
        await expect
          .soft(
            isOnPublicPage,
            'Should not access protected pages after logout',
          )
          .toBeTruthy();
      });
    });

    test('should maintain logout state across page refreshes', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate and logout', async () => {
        await mainLayoutPage.navigateToApp();
        await mainLayoutPage.performLogout();
        await mainLayoutPage.expectLogoutSuccess();
      });

      await test.step('Refresh page', async () => {
        await page.reload({ waitUntil: 'networkidle' });
      });

      await test.step('Verify still logged out', async () => {
        const isOnLoginPage =
          page.url().includes('/login') || page.url().includes('/onboarding');
        await expect
          .soft(isOnLoginPage, 'Should remain logged out after refresh')
          .toBeTruthy();

        // Should not see logout button since not authenticated
        const logoutButtonCount = await page
          .locator(SELECTORS.LAYOUT.LOGOUT_BUTTON)
          .count();
        await expect
          .soft(
            logoutButtonCount,
            'Should not see logout button when logged out',
          )
          .toBe(0);
      });
    });

    test('should handle logout gracefully with network issues', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate to authenticated page', async () => {
        await mainLayoutPage.navigateToApp();
        await mainLayoutPage.expectLayoutLoaded();
      });

      await test.step('Simulate network issues during logout', async () => {
        // Intercept and delay logout requests
        await page.route('**/auth/**', async (route) => {
          await page.waitForTimeout(1000); // Simulate slow network
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        });

        await mainLayoutPage.performLogout();
      });

      await test.step('Verify logout still works', async () => {
        const redirected = await mainLayoutPage.waitForLogoutRedirect(10000);

        // Should eventually be redirected even with network delay
        const isOnPublicPage =
          page.url().includes('/login') ||
          page.url().includes('/onboarding') ||
          redirected;
        await expect
          .soft(isOnPublicPage, 'Should handle logout with network delays')
          .toBeTruthy();
      });
    });
  });

  test.describe('UI State Validation', () => {
    test('should show proper menu positioning and styling', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate and open menu', async () => {
        await mainLayoutPage.navigateToApp();
        await mainLayoutPage.openUserMenu();
      });

      await test.step('Verify menu positioning', async () => {
        const menuElement = page.locator(SELECTORS.LAYOUT.USER_MENU);

        // Check menu is positioned correctly (should be visible and properly positioned)
        await expect.soft(menuElement, 'Menu should be visible').toBeVisible();

        // Verify menu has proper Material Design attributes
        const hasMenuRole = await menuElement.getAttribute('role');
        await expect
          .soft(
            hasMenuRole === 'menu',
            'Menu should have proper role attribute',
          )
          .toBeTruthy();
      });

      await test.step('Verify logout button accessibility', async () => {
        const logoutButton = page.locator(SELECTORS.LAYOUT.LOGOUT_BUTTON);

        // Check button is properly accessible
        await expect
          .soft(logoutButton, 'Logout button should be enabled')
          .toBeEnabled();

        // Check for proper text content
        const buttonText = await logoutButton.textContent();
        await expect
          .soft(
            buttonText?.includes('Se déconnecter'),
            'Button should have proper text',
          )
          .toBeTruthy();
      });
    });

    test('should provide visual feedback during logout process', async ({
      authenticatedPage: page,
    }) => {
      const mainLayoutPage = new MainLayoutPage(page);

      await test.step('Navigate to authenticated page', async () => {
        await mainLayoutPage.navigateToApp();
        await mainLayoutPage.expectLayoutLoaded();
      });

      await test.step('Monitor UI during logout', async () => {
        const stepContext: TestStepContext = {
          stepName: 'logout-visual-feedback',
          description: 'Monitoring UI changes during logout process',
          data: { timestamp: new Date().toISOString() },
        };

        await test.info().attach('logout-process-context', {
          body: JSON.stringify(stepContext),
          contentType: 'application/json',
        });

        // Open menu and click logout
        await mainLayoutPage.openUserMenu();
        await mainLayoutPage.clickLogout();

        // Menu should close after logout click
        await WaitHelper.waitForElementStateChange(
          page,
          SELECTORS.LAYOUT.USER_MENU,
          'hidden',
          3000,
        );

        // Should eventually navigate away
        const navigationSuccess = await WaitHelper.waitForNavigation(
          page,
          '/login',
          8000,
        );

        await expect
          .soft(navigationSuccess, 'Should provide clear navigation feedback')
          .toBeTruthy();
      });
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log final state for debugging
    if (testInfo.status === 'failed') {
      await testInfo.attach('final-logout-state', {
        body: JSON.stringify({
          url: page.url(),
          title: await page.title(),
          timestamp: new Date().toISOString(),
          userMenuVisible: await page
            .locator(SELECTORS.LAYOUT.USER_MENU)
            .isVisible(),
          logoutButtonVisible: await page
            .locator(SELECTORS.LAYOUT.LOGOUT_BUTTON)
            .isVisible(),
        }),
        contentType: 'application/json',
      });
    }
  });
});
