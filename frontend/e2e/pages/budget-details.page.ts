import { type Page, expect } from '@playwright/test';

export class BudgetDetailsPage {
  constructor(private readonly page: Page) {}

  async goto(budgetId = 'test-budget-123'): Promise<void> {
    await this.page.goto(`/app/budget/${budgetId}`);
    await this.expectPageLoaded();
  }

  async expectPageLoaded(): Promise<void> {
    await expect(this.page.getByTestId('budget-detail-page')).toBeVisible();
  }

  async expectBudgetLineVisible(lineName: string): Promise<void> {
    await expect(
      this.page.getByTestId(`budget-line-${lineName}`),
    ).toBeVisible();
  }

  async clickDeleteBudgetLine(lineName: string): Promise<void> {
    // Find the row with the budget line, then click its delete button
    const row = this.page.getByTestId(`budget-line-${lineName}`);
    await row.getByTestId('delete-button').click();
  }

  async confirmDelete(): Promise<void> {
    await this.page.getByTestId('confirm-delete-button').click();
  }

  async cancelDelete(): Promise<void> {
    await this.page.getByTestId('cancel-delete-button').click();
  }
}
