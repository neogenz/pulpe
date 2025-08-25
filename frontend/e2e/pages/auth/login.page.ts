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
    try {
      // Use the new data-testid selectors
      await this.page.getByTestId('email-input').fill(email);
      await this.page.getByTestId('password-input').fill(password);
      await this.page.getByTestId('login-submit-button').click();
      
      // Wait for navigation after login
      await this.page.waitForURL(/\/app/, { timeout: 10000 });
    } catch (error) {
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fillEmail(email: string) {
    try {
      await this.page.getByTestId('email-input').fill(email);
    } catch (error) {
      throw new Error(`Failed to fill email field: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fillPassword(password: string) {
    try {
      await this.page.getByTestId('password-input').fill(password);
    } catch (error) {
      throw new Error(`Failed to fill password field: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clickLogin() {
    try {
      await this.page.getByTestId('login-submit-button').click();
    } catch (error) {
      throw new Error(`Failed to click login button: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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