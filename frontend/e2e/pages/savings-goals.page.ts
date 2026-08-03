import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Savings-goal detail screen: the balance, the withdrawal history and the
 * deletion preview (PUL-329).
 *
 * The balance is read through `expect.poll` rather than a one-shot read: every
 * assertion in the withdrawal journey lands after a mutation invalidated the
 * progression, so the number under test is the one the app settles on, not the
 * one it happened to be showing when the click returned.
 */
export class SavingsGoalsPage {
  constructor(private readonly page: Page) {}

  async gotoDetail(goalId: string): Promise<void> {
    await this.page.goto(`/savings-goals/${goalId}`, {
      waitUntil: 'domcontentloaded',
    });
    await this.expectDetailLoaded();
  }

  async expectDetailLoaded(): Promise<void> {
    await expect(
      this.page.getByTestId('savings-goal-detail-page'),
    ).toBeVisible();
    await expect(this.page.getByTestId('stat-confirmed')).toBeVisible();
  }

  /** « Confirmé » — the stock actually held by the goal. */
  async expectConfirmedAmount(expected: string): Promise<void> {
    const stat = this.page.getByTestId('stat-confirmed');
    await expect
      .poll(async () => normalizeAmount((await stat.textContent()) ?? ''))
      .toContain(normalizeAmount(expected));
  }

  withdrawalsSection(): Locator {
    return this.page.getByTestId('savings-goal-withdrawals');
  }

  withdrawalRows(): Locator {
    return this.page.getByTestId('savings-goal-withdrawal-row');
  }

  async expectWithdrawalCount(expected: number): Promise<void> {
    await expect.poll(async () => this.withdrawalRows().count()).toBe(expected);
  }

  /** Opens a withdrawal in its budget, by the accessible name of its link. */
  async openWithdrawal(name: string): Promise<void> {
    await this.withdrawalLink(name).click();
  }

  withdrawalLink(name: string): Locator {
    return this.page.getByRole('link', {
      name: new RegExp(`Ouvrir .*${name}.* dans son budget`),
    });
  }

  async openDeletionDialog(): Promise<void> {
    await this.page.getByTestId('delete-savings-goal-button').click();
    await expect(this.page.getByTestId('goal-deletion-summary')).toBeVisible();
  }

  deletionWithdrawalsSection(): Locator {
    return this.page.getByTestId('goal-deletion-withdrawals');
  }

  deletionWithdrawalRows(): Locator {
    return this.page.getByTestId('goal-deletion-withdrawal-row');
  }

  async expectDeletionWithdrawalTotal(expected: string): Promise<void> {
    const total = this.page.getByTestId('goal-deletion-withdrawals-total');
    await expect
      .poll(async () => normalizeAmount((await total.textContent()) ?? ''))
      .toContain(normalizeAmount(expected));
  }

  async confirmDeletion(): Promise<void> {
    await this.page.getByTestId('goal-deletion-confirm').click();
  }
}

/**
 * Swiss grouping uses an apostrophe (`10’000`) that no test should have to
 * spell; the separator is a formatting concern, the digits are the assertion.
 */
function normalizeAmount(text: string): string {
  return text
    .replace(/[\u2019\u0027\u2018\u202F\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
