import { type Locator, type Page, expect } from '@playwright/test';

export class BudgetDetailsPage {
  constructor(private readonly page: Page) {}

  /** Opens a transaction's editor the way a user does: its row menu, then Modifier. */
  async openTransactionEditor(
    budgetId: string,
    transactionId: string,
  ): Promise<void> {
    await this.goto(budgetId);
    await this.page.getByTestId(`tx-menu-${transactionId}`).click();
    await this.page.getByTestId(`edit-tx-${transactionId}`).click();
  }

  /**
   * The « Pris sur · nom » / « Objectif supprimé · nom » metadata of a row.
   * Scoped to the labelled span, since that is what carries the accessible name.
   */
  transactionSource(transactionId: string): Locator {
    return this.page
      .getByTestId(`transaction-source-${transactionId}`)
      .getByTestId('savings-goal-source-line');
  }

  /**
   * PUL-329 v2 — annoncer un retrait, c'est créer une prévision `income` dont
   * l'origine est un objectif. L'objectif se choisit après le montant : c'est
   * lui que l'aperçu de projection retranche.
   */
  async openPlannedWithdrawalForm(name: string, amount: string): Promise<void> {
    await this.page.getByTestId('add-budget-line-fab').click();
    await expect(this.page.getByTestId('add-budget-line-dialog')).toBeVisible();
    await this.page.getByTestId('new-line-name').fill(name);
    await this.page.getByTestId('new-line-kind').click();
    await this.page.getByRole('option').filter({ hasText: 'Revenu' }).click();
    await this.page
      .locator(
        '[data-testid="add-budget-line-dialog"] [data-testid="amount-input-value"]',
      )
      .fill(amount);
    await this.page.getByTestId('new-line-income-origin').click();
    await this.page
      .getByRole('option')
      .filter({ hasText: "Retrait d'un objectif" })
      .click();
  }

  async selectPlannedWithdrawalGoal(goalName: string): Promise<void> {
    await this.page
      .getByTestId('savings-goal-planned-withdrawal-select')
      .click();
    await this.page
      .getByRole('option')
      .filter({ hasText: goalName })
      .first()
      .click();
  }

  async submitNewBudgetLine(): Promise<void> {
    await this.page.getByTestId('add-new-line').click();
    await expect(this.page.getByTestId('add-budget-line-dialog')).toBeHidden();
  }

  /**
   * Ouvre le panneau d'une enveloppe en cliquant dessus — c'est là que vivent
   * ses transactions allouées, invisibles depuis la grille.
   */
  async openEnvelopePanel(lineName: string): Promise<void> {
    await this.page.getByText(lineName, { exact: true }).first().click();
  }

  /** L'aperçu « avant → après » du picker, à la période du budget. */
  plannedWithdrawalPreview(): Locator {
    return this.page.getByTestId('savings-goal-planned-withdrawal-preview');
  }

  /** La provenance affichée sur la prévision elle-même. */
  budgetLineSource(lineId: string): Locator {
    return this.page
      .getByTestId(`envelope-source-goal-${lineId}`)
      .getByTestId('savings-goal-source-line');
  }

  /**
   * Le geste qui remplace le pointage sur un retrait annoncé : il ouvre la
   * saisie du revenu réel, seul mouvement qui débite l'objectif.
   */
  async realizeWithdrawal(lineId: string): Promise<void> {
    await this.page.getByTestId(`realize-withdrawal-${lineId}`).click();
    await expect(
      this.page.getByTestId('realize-withdrawal-context'),
    ).toBeVisible();
  }

  transactionDialogSourceLink(): Locator {
    return this.page.getByTestId('edit-transaction-source-link');
  }

  transactionDialogSourceBroken(): Locator {
    return this.page.getByTestId('edit-transaction-source-broken');
  }

  async goto(budgetId = 'test-budget-123'): Promise<void> {
    // Navigate and wait for the API response to ensure data is loaded
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/v1/budgets/') &&
          resp.url().includes('/details'),
      ),
      this.page.goto(`/budget/${budgetId}`, { waitUntil: 'domcontentloaded' }),
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
    const deleteMenuItem = this.page
      .locator('button[mat-menu-item]')
      .filter({ hasText: 'Supprimer' });
    await deleteMenuItem.click();
  }

  async clickEditBudgetLine(lineName: string): Promise<void> {
    // Find the row with the budget line
    const row = this.page.getByTestId(`budget-line-${lineName}`);

    // The edit action is inside a menu - first open the menu
    const menuButton = row.locator('[data-testid^="actions-menu-"]');
    await menuButton.click();

    // Then click the edit menu item
    const editMenuItem = this.page
      .locator('button[mat-menu-item]')
      .filter({ hasText: 'Modifier' });
    await editMenuItem.click();
  }

  async confirmDelete(): Promise<void> {
    await this.page.getByTestId('confirmation-confirm-button').click();
  }

  async cancelDelete(): Promise<void> {
    await this.page.getByTestId('confirmation-cancel-button').click();
  }
}
