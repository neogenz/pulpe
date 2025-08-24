import { Page, expect } from '@playwright/test';

/**
 * Login Page Object - Simplified and Standards-Compliant
 * Uses data-testid selectors added to the Angular component
 */
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    // Use the new data-testid selectors
    await this.page.getByTestId('email-input').fill(email);
    await this.page.getByTestId('password-input').fill(password);
    await this.page.getByTestId('login-submit-button').click();
    
    // Wait for navigation after login
    await this.page.waitForURL(/\/app/, { timeout: 10000 });
  }

  async fillEmail(email: string) {
    await this.page.getByTestId('email-input').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.getByTestId('password-input').fill(password);
  }

  async clickLogin() {
    await this.page.getByTestId('login-submit-button').click();
  }

  async expectLoginFormVisible() {
    await expect(this.page.getByTestId('login-form')).toBeVisible();
  }

  async expectErrorMessage(text: string | RegExp) {
    const errorElement = this.page.getByTestId('login-error-message').or(
      this.page.locator('.mat-error').or(
        this.page.locator('[role="alert"]')
      )
    );
    await expect(errorElement).toContainText(text);
  }
}