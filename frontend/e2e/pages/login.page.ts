import { Page, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded() {
    await expect(
      this.page.locator('h1, h2, [data-testid="login-title"]'),
    ).toBeVisible();
  }

  async expectLoginFormVisible() {
    await expect(
      this.page.locator('[data-testid="login-form"], form'),
    ).toBeVisible();
    await expect(
      this.page.locator(
        '[data-testid="email-input"], input[formControlName="email"], input[type="email"]',
      ),
    ).toBeVisible();
    await expect(
      this.page.locator(
        '[data-testid="password-input"], input[formControlName="password"], input[type="password"]',
      ),
    ).toBeVisible();
  }

  async fillEmail(email: string) {
    await this.page
      .locator(
        '[data-testid="email-input"], input[formControlName="email"], input[type="email"]',
      )
      .fill(email);
  }

  async fillPassword(password: string) {
    await this.page
      .locator(
        '[data-testid="password-input"], input[formControlName="password"], input[type="password"]',
      )
      .fill(password);
  }

  async clickSubmit() {
    await this.page
      .locator(
        '[data-testid="login-btn"], button[type="submit"], button[mat-flat-button]',
      )
      .click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
  }

  async expectValidationErrors() {
    const hasErrors =
      (await this.page
        .locator('.error, .mat-error, [data-testid="error"]')
        .count()) > 0;
    const isDisabled = await this.page
      .locator('button[type="submit"]')
      .first()
      .isDisabled();

    expect(hasErrors || isDisabled).toBeTruthy();
  }

  async expectLoginError() {
    await expect(
      this.page.locator('[data-testid="login-error"], .error, .mat-error'),
    ).toBeVisible();
  }

  async expectSubmitButtonEnabled() {
    await expect(
      this.page.locator('[data-testid="login-btn"], button[type="submit"]'),
    ).toBeEnabled();
  }

  async expectSubmitButtonDisabled() {
    await expect(
      this.page.locator('[data-testid="login-btn"], button[type="submit"]'),
    ).toBeDisabled();
  }

  async clickOnboardingLink() {
    await this.page
      .locator('[data-testid="onboarding-link"], a:has-text("onboarding")')
      .click();
  }
}
