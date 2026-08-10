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
    const amountInput = this.page.locator(
      '[data-testid="transaction-form"] [data-testid="amount-input-value"]',
    );
    await expect(amountInput).toBeFocused();

    await amountInput.fill(amount);
    await this.page
      .getByTestId('transaction-description-input')
      .fill(description);
    await this.page.getByTestId('transaction-submit-button').click();

    await expect(this.page.getByTestId('transaction-form')).toBeHidden();
  }

  /**
   * PUL-329 — an income funded by a savings goal. The origin toggle only exists
   * for an income, so the kind is picked before it is looked for; the goal is
   * chosen by its visible name, never by option index.
   */
  async openTransactionForm(amount: string, description: string) {
    await this.page.getByTestId('add-transaction-fab').click();
    await expect(this.page.getByTestId('transaction-form')).toBeVisible();

    const amountInput = this.page.locator(
      '[data-testid="transaction-form"] [data-testid="amount-input-value"]',
    );
    await expect(amountInput).toBeFocused();
    await amountInput.fill(amount);
    await this.page
      .getByTestId('transaction-description-input')
      .fill(description);
  }

  async selectTransactionKind(kind: 'Revenu' | 'Dépense' | 'Épargne') {
    await this.page.getByTestId('transaction-type-select').click();
    await this.page.getByRole('option').filter({ hasText: kind }).click();
  }

  async enableSavingsGoalSource() {
    await this.page.getByTestId('transaction-savings-source-toggle').click();
    await expect(
      this.page.getByTestId('savings-goal-withdrawal-select'),
    ).toBeVisible();
  }

  async selectSavingsGoalSource(goalName: string) {
    await this.page.getByTestId('savings-goal-withdrawal-select').click();
    await this.page
      .getByRole('option')
      .filter({ hasText: goalName })
      .first()
      .click();
  }

  withdrawalPreview() {
    return this.page.getByTestId('savings-goal-withdrawal-preview');
  }

  withdrawalInsufficientWarning() {
    return this.page.getByTestId('savings-goal-withdrawal-insufficient');
  }

  submitButton() {
    return this.page.getByTestId('transaction-submit-button');
  }

  async submitTransactionForm() {
    await this.submitButton().click();
    await expect(this.page.getByTestId('transaction-form')).toBeHidden();
  }

  async expectPageLoaded() {
    await expect(this.page.getByTestId('dashboard-page')).toBeVisible();
  }

  async getRemainingAmount(): Promise<string> {
    const element = this.page.getByTestId('hero-remaining-amount');
    await expect(element).toBeVisible();
    return (await element.textContent()) ?? '';
  }

  // The hero no longer prints total expenses as one figure. Its legend splits
  // the month into two disjoint shares — Dépensé (recorded) and Engagé (planned
  // and not yet recorded) — whose sum is the number this helper has always
  // meant. Reading either one alone silently compares against a part.
  async getExpensesAmount(): Promise<string> {
    return String(await this.readTotalExpenses());
  }

  private async readTotalExpenses(): Promise<number> {
    const parse = async (testId: string) => {
      const element = this.page.getByTestId(testId);
      await expect(element).toBeVisible();
      const text = this.normalizeSwissNumber(
        (await element.textContent()) ?? '',
      );
      return Number(text.replace(/[^\d-]/g, ''));
    };
    // « Dépensé » est toujours rendu, donc le lire en premier établit que le
    // hero a peint — et rend concluante l'absence constatée juste après.
    const spent = await parse('hero-spent-amount');
    // « Engagé » quitte le DOM dès que sa part tombe à zéro, ce qui arrive
    // précisément quand tout le mois est pointé — l'état où ces assertions
    // travaillent. L'exiger visible faisait expirer le test sur une absence qui
    // est le résultat attendu, et rien ne restait à ajouter à « Dépensé ».
    const isEngagedShown =
      (await this.page.getByTestId('hero-engaged-amount').count()) > 0;
    return spent + (isEngagedShown ? await parse('hero-engaged-amount') : 0);
  }

  async expectRemainingAmount(expectedAmount: string) {
    const element = this.page.getByTestId('hero-remaining-amount');
    const normalizedExpected = this.normalizeSwissNumber(expectedAmount);
    await expect
      .poll(async () =>
        this.normalizeSwissNumber((await element.textContent()) ?? ''),
      )
      .toContain(normalizedExpected);
  }

  async expectExpensesAmount(expectedAmount: string) {
    const expected = Number(
      this.normalizeSwissNumber(expectedAmount).replace(/[^\d-]/g, ''),
    );
    await expect.poll(async () => this.readTotalExpenses()).toBe(expected);
  }

  private normalizeSwissNumber(text: string): string {
    return text
      .replace(/[\u2019\u0027\u2018\u202F\u00A0]/g, ' ')
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
