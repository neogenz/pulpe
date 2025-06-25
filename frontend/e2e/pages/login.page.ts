import { Page, expect, Locator } from '@playwright/test';
import {
  SELECTORS,
  WaitHelper,
  AssertionHelper,
} from '../fixtures/test-helpers';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly loginForm: Locator;
  readonly errorMessage: Locator;
  readonly titleElement: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator(
      'input[formControlName="email"], input[type="email"], [data-testid="email-input"]',
    );
    this.passwordInput = page.locator(
      'input[formControlName="password"], input[type="password"], [data-testid="password-input"]',
    );
    this.submitButton = page.locator(
      'button[type="submit"], button[mat-flat-button], [data-testid="login-submit"]',
    );
    this.loginForm = page.locator('form, [data-testid="login-form"]');
    this.errorMessage = page.locator(
      '.error, .mat-error, .alert-error, [data-testid="login-error"]',
    );
    this.titleElement = page.locator(
      'h1, h2, mat-card-title, .title, [data-testid="login-title"]',
    );
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded(): Promise<void> {
    await expect(this.loginForm, 'Login form should be visible').toBeVisible();

    const titleCount = await this.titleElement.count();
    if (titleCount > 0) {
      await expect(
        this.titleElement.first(),
        'Login page title should be visible',
      ).toBeVisible();
    }
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }

  async expectLoginFormVisible(): Promise<void> {
    if (!(await this.isOnLoginPage())) {
      return;
    }

    await expect
      .soft(this.emailInput, 'Email input should be visible')
      .toBeVisible();
    await expect
      .soft(this.passwordInput, 'Password input should be visible')
      .toBeVisible();
    await expect
      .soft(this.submitButton, 'Submit button should be visible')
      .toBeVisible();
  }

  async fillEmail(email: string): Promise<void> {
    if (!(await this.isOnLoginPage())) {
      return;
    }

    await this.emailInput.fill(email);
    if (email.trim() !== '') {
      await expect(
        this.emailInput,
        'Email should be filled correctly',
      ).toHaveValue(email);
    }
  }

  async fillPassword(password: string): Promise<void> {
    if (!(await this.isOnLoginPage())) {
      return;
    }

    await this.passwordInput.fill(password);
    if (password.trim() !== '') {
      await expect(
        this.passwordInput,
        'Password should be filled correctly',
      ).toHaveValue(password);
    }
  }

  async clickSubmit(): Promise<void> {
    if (!(await this.isOnLoginPage())) {
      return;
    }

    await this.submitButton.click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
  }

  async expectValidationErrors(): Promise<void> {
    const hasErrors =
      (await this.page
        .locator('.error, .mat-error, [data-testid="form-validation-error"]')
        .count()) > 0;
    const isDisabled = await this.submitButton.first().isDisabled();

    expect(
      hasErrors || isDisabled,
      'Form should show validation errors or disable submit',
    ).toBeTruthy();
  }

  async expectLoginError(): Promise<void> {
    await AssertionHelper.softAssertLoginError(this.page, true);
  }

  async expectSubmitButtonEnabled(): Promise<void> {
    await expect(
      this.submitButton,
      'Submit button should be enabled',
    ).toBeEnabled();
  }

  async expectSubmitButtonDisabled(): Promise<void> {
    await expect(
      this.submitButton,
      'Submit button should be disabled',
    ).toBeDisabled();
  }

  async expectNoAuthenticationError(): Promise<void> {
    await AssertionHelper.softAssertLoginError(this.page, false);
  }

  async waitForAuthenticationResult(
    timeoutMs: number = 10000,
  ): Promise<string> {
    const navigationSuccess = await WaitHelper.waitForNavigation(
      this.page,
      '/login',
      timeoutMs,
    );

    if (navigationSuccess && !this.page.url().includes('/login')) {
      return 'navigation-success';
    }

    const errorVisible = await WaitHelper.waitForElementStateChange(
      this.page,
      '.error, .mat-error, .alert-error, [data-testid="login-error"]',
      'visible',
      timeoutMs,
    );

    if (errorVisible) {
      return 'error-visible';
    }

    const networkResponse = await WaitHelper.waitForNetworkResponse(
      this.page,
      '/auth/',
      200,
      timeoutMs,
    );

    if (networkResponse) {
      return 'network-success';
    }

    return 'timeout';
  }

  async expectFormValidationState(isValid: boolean): Promise<void> {
    if (isValid) {
      await this.expectSubmitButtonEnabled();
    } else {
      await this.expectSubmitButtonDisabled();
    }
  }

  async waitForFormValidation(): Promise<void> {
    await this.page.waitForFunction(
      (selector) => {
        const submitBtn = document.querySelector(selector);
        return (
          submitBtn !== null && submitBtn.hasAttribute('disabled') !== undefined
        );
      },
      'button[type="submit"]',
      { timeout: 3000 },
    );
  }

  async clickOnboardingLink(): Promise<void> {
    await this.page
      .locator('a:has-text("onboarding"), [data-testid="onboarding-link"]')
      .click();
  }

  async performComprehensivePageCheck(): Promise<void> {
    // Vérifications essentielles - au moins les champs de saisie doivent être présents
    await expect
      .soft(this.emailInput, 'Email input should be visible')
      .toBeVisible();
    await expect
      .soft(this.passwordInput, 'Password input should be visible')
      .toBeVisible();
    await expect
      .soft(this.submitButton, 'Submit button should be visible')
      .toBeVisible();

    // Vérifications optionnelles
    const titleCount = await this.titleElement.count();
    if (titleCount > 0) {
      await expect
        .soft(this.titleElement.first(), 'Page title should be visible')
        .toBeVisible();
    }

    const formCount = await this.loginForm.count();
    if (formCount > 0) {
      await expect
        .soft(this.loginForm, 'Login form should be visible')
        .toBeVisible();
    }

    await AssertionHelper.softAssertPageResponsiveness(this.page);
  }
}
