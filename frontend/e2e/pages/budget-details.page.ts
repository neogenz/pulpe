import { Locator, Page, expect } from '@playwright/test';

export class BudgetDetailsPage {
  constructor(private readonly page: Page) {}

  async goto(budgetId = 'test-budget-123'): Promise<void> {
    await this.page.goto(`/app/budget/${budgetId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded(): Promise<void> {
    // Wait for the page to load by checking for the header elements
    await expect(this.page.locator('h1, h2').first()).toBeVisible({
      timeout: 10000,
    });
  }

  async expectBudgetLineVisible(lineName: string): Promise<void> {
    await expect(
      this.page.locator('tbody tr').filter({ hasText: lineName }),
    ).toBeVisible({ timeout: 5000 });
  }

  async clickDeleteBudgetLine(lineIndex = 0): Promise<void> {
    const deleteButton = this.page
      .locator('[data-testid^="delete-"]')
      .nth(lineIndex);
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();
  }

  getDialog(): Locator {
    return this.page.locator('mat-dialog-container');
  }

  getDialogTitle(): Locator {
    return this.getDialog().locator('h2[mat-dialog-title]');
  }

  getDialogMessage(): Locator {
    return this.getDialog().locator('mat-dialog-content p');
  }

  getCancelButton(): Locator {
    const dialog = this.page.locator('mat-dialog-container');
    return dialog.locator('button').filter({ hasText: 'Annuler' });
  }

  getConfirmDeleteButton(): Locator {
    const dialog = this.page.locator('mat-dialog-container');
    return dialog.locator('button').filter({ hasText: 'Supprimer' });
  }
}
