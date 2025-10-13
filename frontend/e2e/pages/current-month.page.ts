import { Page, expect } from '@playwright/test';

export class CurrentMonthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/current-month');
    await this.expectPageLoaded();
  }

  async addTransaction(amount: string, description: string) {
    await this.page.getByTestId('add-transaction-fab').click();
    await expect(this.page.getByTestId('transaction-form')).toBeVisible();
    
    await this.page.getByTestId('transaction-amount-input').fill(amount);
    await this.page.getByTestId('transaction-description-input').fill(description);
    await this.page.getByTestId('transaction-submit-button').click();
    
    await expect(this.page.getByTestId('transaction-form')).toBeHidden();
  }


  async expectPageLoaded() {
    await expect(this.page.getByTestId('current-month-page')).toBeVisible();
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