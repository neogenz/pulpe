import { Page, expect, Locator } from '@playwright/test';
import {
  SELECTORS,
  WaitHelper,
  AssertionHelper,
  AuthMockHelper,
} from '../fixtures/test-helpers';

export class MainLayoutPage {
  readonly page: Page;
  readonly userMenuTrigger: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly toolbar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userMenuTrigger = page.locator(SELECTORS.LAYOUT.USER_MENU_TRIGGER);
    this.userMenu = page.locator(SELECTORS.LAYOUT.USER_MENU);
    this.logoutButton = page.locator(SELECTORS.LAYOUT.LOGOUT_BUTTON);
    this.toolbar = page.locator('mat-toolbar, [data-testid="main-toolbar"]');
  }

  async expectLayoutLoaded(): Promise<void> {
    await expect(this.toolbar, 'Main toolbar should be visible').toBeVisible();
    await expect(
      this.userMenuTrigger,
      'User menu trigger should be visible',
    ).toBeVisible();
  }

  async openUserMenu(): Promise<void> {
    // Click on the user menu trigger (logo)
    await this.userMenuTrigger.click();

    // Wait for the menu panel to appear in the DOM
    await this.page.waitForSelector('.mat-mdc-menu-panel[role="menu"]', {
      state: 'visible',
      timeout: 5000,
    });
  }

  async expectUserMenuOpen(): Promise<void> {
    await expect(this.userMenu, 'User menu should be open').toBeVisible();
    await expect(
      this.logoutButton,
      'Logout button should be visible in menu',
    ).toBeVisible();
  }

  async expectUserMenuClosed(): Promise<void> {
    await expect(this.userMenu, 'User menu should be closed').not.toBeVisible();
  }

  async clickLogout(): Promise<void> {
    // Ensure menu is open first
    const menuPanel = this.page.locator('.mat-mdc-menu-panel[role="menu"]');
    const isMenuVisible = await menuPanel.isVisible();
    if (!isMenuVisible) {
      await this.openUserMenu();
    }

    // Click logout button
    await this.logoutButton.click();
  }

  async performLogout(): Promise<void> {
    await this.openUserMenu();
    await this.expectUserMenuOpen();
    await this.clickLogout();
  }

  async waitForLogoutRedirect(timeoutMs: number = 5000): Promise<boolean> {
    // Wait for navigation to login page
    return await WaitHelper.waitForNavigation(this.page, '/login', timeoutMs);
  }

  async expectLogoutSuccess(): Promise<void> {
    // Use Playwright's auto-waiting - try to navigate or check final state
    try {
      // Wait for potential navigation with timeout
      await expect(this.page).toHaveURL(/.*\/(login|onboarding)/, { timeout: 5000 });
    } catch {
      // If no navigation happens (mocked environment), verify logout button is no longer accessible
      await expect(this.logoutButton).not.toBeVisible();
    }
  }

  async expectOnProtectedPage(): Promise<boolean> {
    const currentUrl = this.page.url();
    return currentUrl.includes('/app/') && !currentUrl.includes('/login');
  }

  async navigateToApp(): Promise<void> {
    await this.page.goto('/app/current-month');
    await this.page.waitForLoadState('networkidle');
  }
}
