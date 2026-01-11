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
    // Use data-testid for reliable selection
    await this.page.getByTestId('user-menu-trigger').click();
  }

  async performLogout() {
    await this.openUserMenu();
    // Use data-testid for logout button
    await this.page.getByTestId('logout-button').click();
    // Wait for navigation to complete
    await this.page.waitForURL(/\/(login|welcome)/, { timeout: 10000 });
  }

  async expectLogoutSuccess() {
    // Verify we're back at login or welcome page
    await expect(this.page).toHaveURL(/\/(login|welcome)/);
  }
}