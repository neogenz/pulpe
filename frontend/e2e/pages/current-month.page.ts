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
}