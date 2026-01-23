import { Page, expect } from '@playwright/test';

/**
 * Main Layout Page Object - Clean and Standards-Compliant
 * Manages header, navigation, and user menu interactions
 */
export class MainLayoutPage {
  constructor(private page: Page) {}

  async expectLayoutLoaded() {
    // Wait for the main layout header to be visible
    await expect(this.page.locator('mat-toolbar').or(this.page.locator('header'))).toBeVisible();
  }

  async openUserMenu() {
    // Wait for user menu trigger to be visible before clicking
    const userMenuTrigger = this.page.getByTestId('user-menu-trigger');
    await expect(userMenuTrigger).toBeVisible();
    await userMenuTrigger.click();
  }

  async performLogout() {
    await this.openUserMenu();
    // Wait for logout button to be visible before clicking
    const logoutButton = this.page.getByTestId('logout-button');
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    // Wait for navigation to complete
    await this.page.waitForURL(/\/(login|welcome)/, { timeout: 10000 });
  }

  async expectLogoutSuccess() {
    // Verify we're back at login or welcome page
    await expect(this.page).toHaveURL(/\/(login|welcome)/);
  }
}