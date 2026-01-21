import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await this.expectLoginFormVisible();
  }

  async login(email: string, password: string) {
    await this.page.getByTestId('email-input').fill(email);
    await this.page.getByTestId('password-input').fill(password);
    await this.page.getByTestId('login-submit-button').click();
    await this.page.waitForURL(/\/(dashboard|budget)/, { timeout: 10000 });
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
    await expect(this.page.getByTestId('login-error-message')).toContainText(text);
  }
}