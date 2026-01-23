import { type Page, expect } from '@playwright/test';

export class BudgetDetailsPage {
  constructor(private readonly page: Page) {}

  async goto(budgetId = 'test-budget-123'): Promise<void> {
    // Navigate and wait for the API response to ensure data is loaded
    await Promise.all([
      this.page.waitForResponse(resp =>
        resp.url().includes('/api/v1/budgets/') && resp.url().includes('/details')
      ),
      this.page.goto(`/budget/${budgetId}`),
    ]);
    await this.expectPageLoaded();
  }

  async expectPageLoaded(): Promise<void> {
    await expect(this.page.getByTestId('budget-detail-page')).toBeVisible();
  }

  async switchToTableView(): Promise<void> {
    const tableChip = this.page.getByTestId('table-mode-chip');
    // Only click if visible (desktop view has the toggle, mobile doesn't)
    if (await tableChip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableChip.click();
      // Wait for the table to be visible
      await expect(this.page.locator('table[mat-table]')).toBeVisible();
    }
  }

  async expectBudgetLineVisible(lineName: string): Promise<void> {
    await expect(
      this.page.getByTestId(`budget-line-${lineName}`),
    ).toBeVisible();
  }

  async clickDeleteBudgetLine(lineName: string): Promise<void> {
    // Find the row with the budget line
    const row = this.page.getByTestId(`budget-line-${lineName}`);

    // The delete action is inside a menu - first open the menu
    const menuButton = row.locator('[data-testid^="actions-menu-"]');
    await menuButton.click();

    // Then click the delete menu item
    const deleteMenuItem = this.page.locator('button[mat-menu-item]').filter({ hasText: 'Supprimer' });
    await deleteMenuItem.click();
  }

  async clickEditBudgetLine(lineName: string): Promise<void> {
    // Find the row with the budget line
    const row = this.page.getByTestId(`budget-line-${lineName}`);

    // The edit action is inside a menu - first open the menu
    const menuButton = row.locator('[data-testid^="actions-menu-"]');
    await menuButton.click();

    // Then click the edit menu item
    const editMenuItem = this.page.locator('button[mat-menu-item]').filter({ hasText: 'Éditer' });
    await editMenuItem.click();
  }

  async confirmDelete(): Promise<void> {
    await this.page.getByTestId('confirm-delete-button').click();
  }

  async cancelDelete(): Promise<void> {
    await this.page.getByTestId('cancel-delete-button').click();
  }
}
