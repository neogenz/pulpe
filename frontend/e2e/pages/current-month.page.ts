import { Page, expect } from '@playwright/test';

export class CurrentMonthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
    await this.expectPageLoaded();
  }

  async addTransaction(amount: string, description: string) {
    await this.page.getByTestId('add-transaction-fab').click();
    await expect(this.page.getByTestId('transaction-form')).toBeVisible();

    // Wait for the component's auto-focus setTimeout(200ms) to settle
    // before filling, to prevent focus steal during typing
    const amountInput = this.page.getByTestId('transaction-amount-input');
    await expect(amountInput).toBeFocused();

    await amountInput.fill(amount);
    await this.page
      .getByTestId('transaction-description-input')
      .fill(description);
    await this.page.getByTestId('transaction-submit-button').click();

    await expect(this.page.getByTestId('transaction-form')).toBeHidden();
  }

  async expectPageLoaded() {
    await expect(this.page.getByTestId('current-month-page')).toBeVisible();
  }

  async getRemainingAmount(): Promise<string> {
    const element = this.page.getByTestId('remaining-amount');
    await expect(element).toBeVisible();
    return (await element.textContent()) ?? '';
  }

  async getExpensesAmount(): Promise<string> {
    const element = this.page.getByTestId('expenses-amount');
    await expect(element).toBeVisible();
    return (await element.textContent()) ?? '';
  }

  async expectRemainingAmount(expectedAmount: string) {
    const element = this.page.getByTestId('remaining-amount');
    const normalizedExpected = this.normalizeSwissNumber(expectedAmount);
    await expect
      .poll(async () => this.normalizeSwissNumber((await element.textContent()) ?? ''))
      .toContain(normalizedExpected);
  }

  async expectExpensesAmount(expectedAmount: string) {
    const element = this.page.getByTestId('expenses-amount');
    const normalizedExpected = this.normalizeSwissNumber(expectedAmount);
    await expect
      .poll(async () => this.normalizeSwissNumber((await element.textContent()) ?? ''))
      .toContain(normalizedExpected);
  }

  private normalizeSwissNumber(text: string): string {
    return text
      .replace(/[\u2019\u0027\u2018]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Demo Mode Methods
   */

  async expectDemoModeActive() {
    // Check localStorage for demo mode flag
    const isDemoMode = await this.page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-mode');
    });
    expect(isDemoMode).toBe('true');
  }

  async expectDemoData() {
    // Verify page has budget-related content
    const bodyContent = this.page.locator('body');
    await expect(bodyContent).toContainText(/(CHF|budget|disponible|dépens)/i, {
      timeout: 5000,
    });
  }

  async getDemoUserEmail(): Promise<string | null> {
    return this.page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-user-email');
    });
  }
}
