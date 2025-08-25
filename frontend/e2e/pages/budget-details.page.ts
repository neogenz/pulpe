import { Page, expect } from '@playwright/test';

export class BudgetDetailsPage {
  constructor(private page: Page) {}

  async goto(budgetId = 'test-budget-123') {
    await this.page.goto(`/app/budget/${budgetId}`);
  }

  async expectPageLoaded() {
    await expect(this.page.locator('[data-testid="budget-detail-page"], main').first()).toBeVisible();
  }

  async clickDeleteBudgetLine(lineIndex = 0) {
    await this.page.locator('button[aria-label*="delete"], button[aria-label*="supprimer"]').nth(lineIndex).click();
  }

  async confirmDelete() {
    await this.page.click('button:has-text("Supprimer")');
  }

  async expectBudgetLineVisible(lineName: string) {
    await expect(this.page.locator(`tr:has-text("${lineName}")`)).toBeVisible();
  }
}