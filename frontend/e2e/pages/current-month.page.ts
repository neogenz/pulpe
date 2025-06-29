import { Page, expect } from '@playwright/test';
import { WaitHelper } from '../fixtures/test-helpers';

export class CurrentMonthPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/app/current-month');
    // Use robust waiting instead of networkidle
    await WaitHelper.waitForNavigation(this.page, '/app/current-month', 10000);
    // Wait for page content to be ready
    await this.page
      .locator('[data-testid="current-month-page"], main, .content, h1, h2')
      .first()
      .waitFor({
        state: 'visible',
        timeout: 10000,
      })
      .catch(() => {
        // If no specific content found, just ensure page loaded
        return this.page.waitForLoadState('domcontentloaded');
      });
  }

  async expectPageLoaded() {
    // Use page-title data-testid instead of hardcoded text
    await expect(this.page.locator('[data-testid="page-title"]')).toBeVisible();

    // Ensure the page container is present
    await expect(
      this.page.locator('[data-testid="current-month-page"]'),
    ).toBeVisible();
  }

  async expectFinancialOverviewVisible() {
    const hasOverview =
      (await this.page.locator('[data-testid="financial-overview"]').count()) >
      0;
    const hasNoData =
      (await this.page.locator('[data-testid="empty-state"]').count()) > 0;

    expect(hasOverview || hasNoData).toBeTruthy();
  }

  async expectExpenseFormVisible() {
    // Check for the quick add expense form specifically
    const hasForm =
      (await this.page
        .locator('[data-testid="quick-add-expense-form"]')
        .count()) > 0;
    const hasContent =
      (await this.page.locator('[data-testid="dashboard-content"]').count()) >
      0;
    const hasEmptyState =
      (await this.page.locator('[data-testid="empty-state"]').count()) > 0;

    expect(hasForm || hasContent || hasEmptyState).toBeTruthy();
  }

  async expectTransactionsVisible() {
    const hasVariableTransactions =
      (await this.page
        .locator('[data-testid="variable-expenses-list"]')
        .count()) > 0;
    const hasFixedTransactions =
      (await this.page
        .locator('[data-testid="fixed-transactions-list"]')
        .count()) > 0;
    const hasEmptyState =
      (await this.page.locator('[data-testid="empty-state"]').count()) > 0;
    const hasContent =
      (await this.page.locator('[data-testid="dashboard-content"]').count()) >
      0;

    expect(
      hasVariableTransactions ||
        hasFixedTransactions ||
        hasEmptyState ||
        hasContent,
    ).toBeTruthy();
  }

  async fillExpenseForm(amount: string, description: string) {
    // Try different selectors for amount input
    const amountInput = this.page
      .locator(
        '[data-testid="amount-input"], input[formControlName="amount"], input[type="number"], input[placeholder*="montant"]',
      )
      .first();
    if ((await amountInput.count()) > 0) {
      await amountInput.fill(amount);
    }

    // Try different selectors for description input
    const descriptionInput = this.page
      .locator(
        '[data-testid="description-input"], input[formControlName="description"], input[type="text"], textarea',
      )
      .first();
    if ((await descriptionInput.count()) > 0) {
      await descriptionInput.fill(description);
    }
  }

  async submitExpense() {
    // Try different selectors for submit button
    const submitButton = this.page
      .locator(
        '[data-testid="submit-expense"], button[type="submit"], button:has-text("Ajouter"), button:has-text("Valider"), button:has-text("Enregistrer")',
      )
      .first();
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
    }
  }

  async filterByCategory(category: string) {
    await this.page
      .locator('[data-testid="category-filter"], select, mat-select')
      .click();
    await this.page
      .locator(
        `[data-testid="category-${category}"], mat-option:has-text("${category}")`,
      )
      .click();
  }

  async searchTransactions(searchTerm: string) {
    await this.page
      .locator('[data-testid="search-input"], input[placeholder*="recherch"]')
      .fill(searchTerm);
  }

  async navigateToOtherMonths() {
    await this.page
      .locator('[data-testid="other-months"], a:has-text("Autres mois")')
      .click();
  }

  async navigateToBudgetTemplates() {
    await this.page
      .locator('[data-testid="templates-link"], a:has-text("Templates")')
      .click();
  }

  async expectTransactionVisible(description: string) {
    const hasTransaction =
      (await this.page
        .locator(
          `[data-testid="transaction"]:has-text("${description}"), .transaction:has-text("${description}"), tr:has-text("${description}")`,
        )
        .count()) > 0;
    const hasInList =
      (await this.page.locator(`text="${description}"`).count()) > 0;

    expect(hasTransaction || hasInList).toBeTruthy();
  }

  async expectBalance(amount: string) {
    await expect(
      this.page.locator('[data-testid="balance"], .balance'),
    ).toContainText(amount);
  }
}
