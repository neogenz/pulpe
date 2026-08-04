import type { Page, Request } from '@playwright/test';
import type { SavingsGoalWithdrawal, Transaction } from 'pulpe-shared';
import { test, expect } from '../../fixtures/test-fixtures';
import { TEST_CONFIG } from '../../config/test-config';
import {
  TEST_UUIDS,
  createBudgetDetailsMock,
  createBudgetLineMock,
  createSavingsGoalDeletionImpactMock,
  createSavingsGoalMock,
  createSavingsGoalProgressMock,
  createSavingsGoalWithdrawalMock,
  createSavingsGoalWithdrawalOptionMock,
  createTransactionMock,
} from '../../helpers/api-mocks';

/**
 * PUL-329 — utiliser un objectif d'épargne comme source d'un revenu.
 *
 * One franc is followed end to end: it leaves a goal, lands in a budget as an
 * income, and every screen that mentions it must agree on where it came from.
 * The fake backend below keeps a single balance and derives every read from it,
 * so the equation `solde = 10'000 − Σ retraits` is what the assertions actually
 * exercise — no screen is allowed to compute it on its own.
 */

const GOAL_ID = TEST_UUIDS.GOAL_1;
const GOAL_NAME = 'Vacances';
const INCOME_NAME = 'Apport cuisine';
const INCOME_ID = TEST_UUIDS.TRANSACTION_1;
const INITIAL_BALANCE = 10000;
const WITHDRAWAL_AMOUNT = 4500;
const CURRENT_BUDGET = TEST_CONFIG.BUDGETS.CURRENT_MONTH;

interface GoalWorld {
  balance: number;
  withdrawals: SavingsGoalWithdrawal[];
  transactions: Transaction[];
  isGoalDeleted: boolean;
}

function createIncome(amount: number, isLinked: boolean): Transaction {
  return createTransactionMock(INCOME_ID, CURRENT_BUDGET.id, {
    name: INCOME_NAME,
    amount,
    kind: 'income',
    // The edit form only accepts a date inside the budget's month, and that
    // month is the real one: the transaction has to be dated accordingly.
    transactionDate: new Date().toISOString(),
    sourceSavingsGoalId: isLinked ? GOAL_ID : null,
    sourceSavingsGoalName: GOAL_NAME,
  });
}

/** The state a scenario starts from once the income already exists. */
function withdrawnWorld(amount = WITHDRAWAL_AMOUNT): Partial<GoalWorld> {
  return {
    balance: INITIAL_BALANCE - amount,
    withdrawals: [
      createSavingsGoalWithdrawalMock(INCOME_ID, CURRENT_BUDGET.id, {
        name: INCOME_NAME,
        amount,
      }),
    ],
    transactions: [createIncome(amount, true)],
  };
}

/**
 * A write only moves the balance once the browser has actually sent it; leaving
 * the page first would cancel it and let the next screen read a stale goal.
 */
function waitForTransactionWrite(page: Page, method: string): Promise<Request> {
  return page.waitForRequest(
    (request) =>
      request.method() === method &&
      /\/transactions\/[^/]+$/.test(request.url()),
  );
}

/**
 * Registered after the fixture's catch-all, so it wins on the routes it knows
 * and falls back for everything else. Every read is derived from the mutable
 * world: a screen can never be right by luck.
 */
async function installGoalWorld(
  page: Page,
  seed: Partial<GoalWorld> = {},
): Promise<GoalWorld> {
  const world: GoalWorld = {
    balance: INITIAL_BALANCE,
    withdrawals: [],
    transactions: [],
    isGoalDeleted: false,
    ...seed,
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (path.endsWith('/users/settings') && method === 'GET') {
      return json({
        success: true,
        data: {
          currency: 'CHF',
          payDayOfMonth: 1,
          showCurrencySelector: false,
        },
      });
    }
    if (path.endsWith('/savings-goals/withdrawal-options')) {
      const isOffered = !world.isGoalDeleted && world.balance > 0;
      return json({
        success: true,
        data: isOffered
          ? [
              createSavingsGoalWithdrawalOptionMock(GOAL_ID, {
                name: GOAL_NAME,
                availableAmount: world.balance,
              }),
            ]
          : [],
      });
    }
    if (path.endsWith('/withdrawals')) {
      return json({ success: true, data: world.withdrawals });
    }
    if (path.endsWith('/progress')) {
      return json({
        success: true,
        data: createSavingsGoalProgressMock(GOAL_ID, {
          confirmed: world.balance,
          achievementPercent: Math.round((world.balance / 12000) * 100),
        }),
      });
    }
    if (path.endsWith('/contributions')) {
      return json({ success: true, data: [] });
    }
    if (path.endsWith('/deletion-impact')) {
      return json({
        success: true,
        data: createSavingsGoalDeletionImpactMock(GOAL_ID, world.withdrawals),
      });
    }
    if (path.endsWith('/deletion') && method === 'POST') {
      world.isGoalDeleted = true;
      // The income survives every mode; only its link dies.
      world.transactions = world.transactions.map((transaction) => ({
        ...transaction,
        sourceSavingsGoalId: null,
      }));
      return json({ success: true, message: 'deleted' });
    }
    if (path.endsWith('/savings-goals') && method === 'GET') {
      return json({
        success: true,
        data: world.isGoalDeleted
          ? []
          : [createSavingsGoalMock(GOAL_ID, { name: GOAL_NAME })],
      });
    }
    if (path.includes('/budgets/') && path.endsWith('/details')) {
      return json(
        createBudgetDetailsMock(CURRENT_BUDGET.id, {
          budget: {
            month: CURRENT_BUDGET.month,
            year: CURRENT_BUDGET.year,
            rollover: 0,
          },
          budgetLines: [
            createBudgetLineMock(TEST_UUIDS.LINE_1, CURRENT_BUDGET.id, {
              name: 'Salaire',
              amount: 5000,
              kind: 'income',
            }),
          ],
          transactions: world.transactions,
        }),
      );
    }
    if (path.endsWith('/transactions') && method === 'POST') {
      const payload = request.postDataJSON() as {
        amount: number;
        sourceSavingsGoalId?: string | null;
      };
      const income = createIncome(
        payload.amount,
        !!payload.sourceSavingsGoalId,
      );
      if (payload.sourceSavingsGoalId) {
        world.balance -= payload.amount;
        world.withdrawals = [
          createSavingsGoalWithdrawalMock(INCOME_ID, CURRENT_BUDGET.id, {
            name: INCOME_NAME,
            amount: payload.amount,
          }),
          ...world.withdrawals,
        ];
      }
      world.transactions = [...world.transactions, income];
      return json({ success: true, data: income });
    }
    if (/\/transactions\/[^/]+$/.test(path) && method === 'PATCH') {
      const payload = request.postDataJSON() as { amount?: number };
      const previous = world.withdrawals[0]?.amount ?? 0;
      const amount = payload.amount ?? previous;
      world.balance += previous - amount;
      world.withdrawals = [
        createSavingsGoalWithdrawalMock(INCOME_ID, CURRENT_BUDGET.id, {
          name: INCOME_NAME,
          amount,
        }),
      ];
      const income = createIncome(amount, true);
      world.transactions = [income];
      return json({ success: true, data: income });
    }
    if (/\/transactions\/[^/]+$/.test(path) && method === 'DELETE') {
      world.balance += world.withdrawals[0]?.amount ?? 0;
      world.withdrawals = [];
      world.transactions = [];
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fallback();
  });

  return world;
}

test.describe('Savings goal as the source of an income', () => {
  test('the same money is navigable from the budget to the goal and back', async ({
    authenticatedPage,
    currentMonthPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    await installGoalWorld(authenticatedPage);

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('10 000');
    // A goal nobody drew from says nothing rather than announcing an emptiness.
    await expect(savingsGoalsPage.withdrawalsSection()).toBeHidden();

    await currentMonthPage.goto();
    await currentMonthPage.openTransactionForm('4500', INCOME_NAME);
    await currentMonthPage.selectTransactionKind('Revenu');
    await currentMonthPage.enableSavingsGoalSource();
    await currentMonthPage.selectSavingsGoalSource(GOAL_NAME);

    const preview = currentMonthPage.withdrawalPreview();
    await expect(preview).toContainText(/10.000 CHF/);
    await expect(preview).toContainText(/5.500 CHF/);

    const createRequest = authenticatedPage.waitForRequest(
      (request) =>
        request.url().endsWith('/transactions') && request.method() === 'POST',
    );
    await currentMonthPage.submitTransactionForm();
    // One POST carries the origin: the link is never a second write.
    expect((await createRequest).postDataJSON()).toMatchObject({
      amount: 4500,
      kind: 'income',
      sourceSavingsGoalId: GOAL_ID,
    });

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await expect(budgetDetailsPage.transactionSource(INCOME_ID)).toContainText(
      `Pris sur · ${GOAL_NAME}`,
    );

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('5 500');
    await savingsGoalsPage.expectWithdrawalCount(1);
    await expect(savingsGoalsPage.withdrawalRows()).toContainText(/4.500\.00/);

    await savingsGoalsPage.openWithdrawal(INCOME_NAME);
    await expect(budgetDetailsPage.transactionDialogSourceLink()).toBeVisible();

    await authenticatedPage.goBack();
    await savingsGoalsPage.expectDetailLoaded();
    // The consumed query param must not reopen the transaction on the way back.
    await expect(budgetDetailsPage.transactionDialogSourceLink()).toBeHidden();
  });

  test('editing and deleting the income keep the balance equation', async ({
    authenticatedPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    await installGoalWorld(authenticatedPage, withdrawnWorld());

    await budgetDetailsPage.gotoTargetedTransaction(
      CURRENT_BUDGET.id,
      INCOME_ID,
    );
    const amountInput = authenticatedPage.getByTestId('amount-input-value');
    await amountInput.fill('3500');
    const patched = waitForTransactionWrite(authenticatedPage, 'PATCH');
    await authenticatedPage
      .getByRole('button', { name: 'Enregistrer les modifications' })
      .click();
    expect((await patched).postDataJSON()).toMatchObject({ amount: 3500 });

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('6 500');
    await savingsGoalsPage.expectWithdrawalCount(1);

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    await authenticatedPage.getByTestId(`tx-menu-${INCOME_ID}`).click();
    await authenticatedPage.getByTestId(`delete-tx-${INCOME_ID}`).click();
    const deleted = waitForTransactionWrite(authenticatedPage, 'DELETE');
    await budgetDetailsPage.confirmDelete();
    await deleted;

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.expectConfirmedAmount('10 000');
    // The history entry goes with the money: nothing left to explain.
    await expect(savingsGoalsPage.withdrawalsSection()).toBeHidden();
  });

  test('an amount over the balance is refused before it can be sent', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await installGoalWorld(authenticatedPage);

    await currentMonthPage.goto();
    await currentMonthPage.openTransactionForm('10000.01', INCOME_NAME);
    await currentMonthPage.selectTransactionKind('Revenu');
    await currentMonthPage.enableSavingsGoalSource();
    await currentMonthPage.selectSavingsGoalSource(GOAL_NAME);

    await expect(
      currentMonthPage.withdrawalInsufficientWarning(),
    ).toBeVisible();
    await expect(currentMonthPage.submitButton()).toBeDisabled();
  });

  test('a goal emptied to the last franc is no longer offered', async ({
    authenticatedPage,
    currentMonthPage,
  }) => {
    await installGoalWorld(authenticatedPage, withdrawnWorld(INITIAL_BALANCE));

    await currentMonthPage.goto();
    await currentMonthPage.openTransactionForm('50', 'Autre apport');
    await currentMonthPage.selectTransactionKind('Revenu');
    await currentMonthPage.enableSavingsGoalSource();

    await expect(
      authenticatedPage.getByTestId('savings-goal-withdrawal-empty'),
    ).toBeVisible();
    await expect(currentMonthPage.submitButton()).toBeDisabled();
  });

  test('deleting the goal keeps the income and only breaks its link', async ({
    authenticatedPage,
    budgetDetailsPage,
    savingsGoalsPage,
  }) => {
    await installGoalWorld(authenticatedPage, withdrawnWorld());

    await savingsGoalsPage.gotoDetail(GOAL_ID);
    await savingsGoalsPage.openDeletionDialog();

    // Its own block, with no per-row action: an income already lived through is
    // never a candidate for deletion.
    await expect(savingsGoalsPage.deletionWithdrawalsSection()).toContainText(
      'Retraits vers tes budgets',
    );
    await expect(savingsGoalsPage.deletionWithdrawalRows()).toHaveCount(1);
    await expect(savingsGoalsPage.deletionWithdrawalRows()).toContainText(
      INCOME_NAME,
    );
    // An aggregate, so no decimals — and signed, because the block reads as what
    // the goal gave away. The rows above keep their two decimals. The symbol is
    // part of the assertion: without it the substring would still match a total
    // that grew decimals back, which is precisely what this pins down.
    await savingsGoalsPage.expectDeletionWithdrawalTotal('-4 500 CHF');

    await savingsGoalsPage.confirmDeletion();
    await expect(
      authenticatedPage.getByTestId('savings-goals-page'),
    ).toBeVisible();

    await budgetDetailsPage.goto(CURRENT_BUDGET.id);
    const source = budgetDetailsPage.transactionSource(INCOME_ID);
    // History, not an anomaly: the full name is spoken, and nothing is clickable.
    // The visible text IS the accessible name — a generic <span> cannot be named
    // by aria-label, ARIA in HTML forbids it and browsers drop it. So the name is
    // asserted on the text, and the icon is what must stay out of the reading.
    await expect(source).toContainText(`Objectif supprimé · ${GOAL_NAME}`);
    await expect(source.locator('mat-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(source.locator('a')).toHaveCount(0);

    await budgetDetailsPage.gotoTargetedTransaction(
      CURRENT_BUDGET.id,
      INCOME_ID,
    );
    await expect(
      budgetDetailsPage.transactionDialogSourceBroken(),
    ).toBeVisible();
    await expect(budgetDetailsPage.transactionDialogSourceLink()).toHaveCount(
      0,
    );
  });
});
